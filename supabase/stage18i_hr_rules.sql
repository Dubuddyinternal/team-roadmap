-- =====================================================================
-- STAGE 18i — HR rules: nudge people to finish their HR file
--
-- Administration → HR → Rules. The first rule, "HR file not complete":
--   · pop-ups a day, emails a day, 🔔 bells a day (each can be 0)
--   · a strip at the top of every page until it's done
--   · restrict the account after N days (blank = never)
-- "Done" = the person has submitted their HR file. Super-admins are left out.
-- Each person's clock starts when the rule is switched on, or when they
-- joined, whichever is later.
-- An hourly job (09:00–21:00 India time) sends the bells, pop-ups and
-- emails; emails go through the "hr-remind" Edge Function.
-- Run after stage18h. Safe to run again.
-- =====================================================================

create table if not exists public.hr_rules (
  id             int primary key default 1 check (id = 1),
  file_on        boolean not null default false,
  file_strip     boolean not null default true,
  file_popups    int not null default 1 check (file_popups between 0 and 10),
  file_emails    int not null default 1 check (file_emails between 0 and 5),
  file_bells     int not null default 1 check (file_bells between 0 and 5),
  file_restrict  int check (file_restrict is null or file_restrict between 1 and 365),
  file_started   timestamptz,
  cron_key       text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null
);
insert into public.hr_rules (id) values (1) on conflict (id) do nothing;
alter table public.hr_rules enable row level security;   -- read through the functions below
revoke all on public.hr_rules from anon, authenticated;

create table if not exists public.hr_rule_log (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null check (kind in ('bell', 'popup', 'email')),
  sent_at timestamptz not null default now()
);
create index if not exists hr_rule_log_user on public.hr_rule_log (user_id, kind, sent_at desc);
alter table public.hr_rule_log enable row level security;   -- server only
revoke all on public.hr_rule_log from anon, authenticated;

-- is this person's HR file in? (submitted or later)
create or replace function public.hr_file_done(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select r.status in ('submitted', 'contract_sent', 'signed', 'complete') from public.hr_records r where r.user_id = p_user), false)
$$;
-- when this person's restriction starts (null = never)
create or replace function public.hr_file_deadline(p_user uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select case when s.file_restrict is null or s.file_started is null then null
              else greatest(s.file_started, coalesce((select min(m.added_at) from public.memberships m where m.user_id = p_user), s.file_started))
                   + make_interval(days => s.file_restrict) end
    from public.hr_rules s where s.id = 1
$$;

-- what the signed-in person sees: strip, days left, restricted?
create or replace function public.hr_rule_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.hr_rules; me uuid := auth.uid(); dl timestamptz;
begin
  select * into s from public.hr_rules where id = 1;
  if me is null or s.id is null or not s.file_on or public.is_super() or public.hr_file_done(me)
     or not exists (select 1 from public.memberships m where m.user_id = me) then
    return jsonb_build_object('on', false);
  end if;
  dl := public.hr_file_deadline(me);
  return jsonb_build_object('on', true, 'strip', s.file_strip, 'deadline', dl, 'restricted', dl is not null and dl <= now());
end $$;

-- HR reads and saves the rule
create or replace function public.hr_rules_get() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.hr_perm_any('manage_hr') or public.hr_perm_any('view_hr')
              then (select to_jsonb(s) - 'cron_key' from public.hr_rules s where s.id = 1) end
$$;
create or replace function public.hr_rules_save(p_on boolean, p_strip boolean, p_popups int, p_emails int, p_bells int, p_restrict int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.hr_rules;
begin
  if not public.hr_perm_any('manage_hr') then raise exception 'Only HR can change the rules.'; end if;
  update public.hr_rules
     set file_started = case when p_on and not file_on then now() when not p_on then null else file_started end,
         file_on = coalesce(p_on, false), file_strip = coalesce(p_strip, true),
         file_popups = least(greatest(coalesce(p_popups, 0), 0), 10), file_emails = least(greatest(coalesce(p_emails, 0), 0), 5),
         file_bells = least(greatest(coalesce(p_bells, 0), 0), 5),
         file_restrict = case when p_restrict is null or p_restrict < 1 then null else least(p_restrict, 365) end,
         updated_at = now(), updated_by = auth.uid()
   where id = 1 returning * into s;
  return to_jsonb(s) - 'cron_key';
end $$;
-- who the rule is waiting on, with their deadline (HR)
create or replace function public.hr_rules_people() returns table (user_id uuid, deadline timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct m.user_id, public.hr_file_deadline(m.user_id)
    from public.memberships m join public.profiles p on p.id = m.user_id
   where (public.hr_perm_any('manage_hr') or public.hr_perm_any('view_hr'))
     and not coalesce(p.is_super, false) and not public.hr_file_done(m.user_id)
$$;

-- the hourly job: today's bells and pop-ups, and who to email
create or replace function public.hr_rules_tick() returns int
language plpgsql security definer set search_path = '' as $$
declare
  s public.hr_rules; u record; n int := 0;
  l timestamp := now() at time zone 'Asia/Kolkata';
  day0 timestamptz := date_trunc('day', l) at time zone 'Asia/Kolkata';
  eod  timestamptz := (date_trunc('day', l) + interval '1 day') at time zone 'Asia/Kolkata';
  dl timestamptz; left_txt text; c int; last timestamptz; mail jsonb := '[]'::jsonb; t text;
begin
  select * into s from public.hr_rules where id = 1;
  if s.id is null or not s.file_on then return 0; end if;
  if extract(hour from l) < 9 or extract(hour from l) >= 21 then return 0; end if;
  for u in select distinct m.user_id from public.memberships m join public.profiles p on p.id = m.user_id
            where not coalesce(p.is_super, false) and not public.hr_file_done(m.user_id) loop
    dl := public.hr_file_deadline(u.user_id);
    left_txt := case when dl is null then 'Please finish it soon.'
                     when dl <= now() then 'Your account is restricted until you submit it.'
                     else greatest(1, ceil(extract(epoch from dl - now()) / 86400))::int || ' day(s) left before your account is restricted.' end;
    t := public.hr_team_of(u.user_id);
    -- 🔔 bells, spread over the day
    select count(*), max(sent_at) into c, last from public.hr_rule_log where user_id = u.user_id and kind = 'bell' and sent_at >= day0;
    if t is not null and c < s.file_bells and (last is null or now() - last >= make_interval(hours => greatest(1, 12 / s.file_bells))) then
      insert into public.team_notifications (team_slug, title, body, audience, recipients, bell, popup, created_by, ref)
      values (t, '🗂️ Please complete your HR file', left_txt || E'\n\nOpen your profile menu → My HR file.', 'people', array[u.user_id], true, false, null, 'hr:remind');
      insert into public.hr_rule_log (user_id, kind) values (u.user_id, 'bell'); n := n + 1;
    end if;
    -- pop-ups: one notification a day that pops up to N times
    if t is not null and s.file_popups > 0 and not exists (select 1 from public.hr_rule_log where user_id = u.user_id and kind = 'popup' and sent_at >= day0) then
      insert into public.team_notifications (team_slug, title, body, audience, recipients, bell, popup, popup_rule, popup_times, show_until, created_by, ref)
      values (t, '🗂️ Your HR file isn''t complete', left_txt || E'\n\nIt takes about 10 minutes: your details, documents and the company policies.',
              'people', array[u.user_id], false, true, 'times', s.file_popups, eod, null, 'hr:popup');
      insert into public.hr_rule_log (user_id, kind) values (u.user_id, 'popup'); n := n + 1;
    end if;
    -- ✉️ emails, spread over the day
    select count(*), max(sent_at) into c, last from public.hr_rule_log where user_id = u.user_id and kind = 'email' and sent_at >= day0;
    if c < s.file_emails and (last is null or now() - last >= make_interval(hours => greatest(1, 12 / s.file_emails))) then
      mail := mail || jsonb_build_object('user_id', u.user_id, 'note', left_txt);
      insert into public.hr_rule_log (user_id, kind) values (u.user_id, 'email'); n := n + 1;
    end if;
  end loop;
  if jsonb_array_length(mail) > 0 then
    perform net.http_post(
      url     := 'https://bzhnzrmnbphkcasvrsnc.supabase.co/functions/v1/hr-remind',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', s.cron_key),
      body    := jsonb_build_object('people', mail),
      timeout_milliseconds := 60000);
  end if;
  return n;
end $$;

revoke execute on function public.hr_file_done(uuid), public.hr_file_deadline(uuid), public.hr_rules_tick() from public, anon, authenticated;
revoke execute on function public.hr_rule_me(), public.hr_rules_get(), public.hr_rules_save(boolean, boolean, int, int, int, int),
  public.hr_rules_people() from public, anon;
grant execute on function public.hr_rule_me(), public.hr_rules_get(), public.hr_rules_save(boolean, boolean, int, int, int, int),
  public.hr_rules_people() to authenticated;

-- every hour at :07
select cron.schedule('hr-rules-tick', '7 * * * *', 'select public.hr_rules_tick()');
