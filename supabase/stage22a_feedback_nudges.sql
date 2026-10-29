-- =====================================================================
-- STAGE 22a — Monthly feedback: keep nudging until it's sent
--
-- Same idea as the HR file rules (stage 18i), for monthly feedback:
--   · ✉️ emails, N a day (My Team → Monthly feedback → ⚙️ Settings, 0 = off)
--   · a strip at the top of every page ("Your October feedback is pending")
--     and a "pending" mark on the account menu — drawn in the browser from
--     feedback_me()
--   · the 🔔 and the daily pop-up still come from feedback_remind() (stage 16a)
-- It runs while the form is open (open day → month end) and in the late
-- window (1st–10th of the next month), and stops the moment it's sent.
-- Super-admins are left out (they read feedback; nobody nags them).
-- Emails go through the "feedback-remind" Edge Function (Verify JWT OFF,
-- checks feedback_cron.cron_key), from an hourly job 09:00–21:00 IST.
-- Run after stage16a. Safe to run again.
-- =====================================================================

alter table public.feedback_settings add column if not exists emails_per_day int not null default 1;
alter table public.feedback_settings add column if not exists strip boolean not null default true;
do $$ begin
  alter table public.feedback_settings add constraint feedback_settings_emails_per_day check (emails_per_day between 0 and 5);
exception when duplicate_object then null; end $$;

-- the key the Edge Function checks (kept away from members: feedback_settings is readable by them)
create table if not exists public.feedback_cron (
  id       int primary key default 1 check (id = 1),
  cron_key text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
insert into public.feedback_cron (id) values (1) on conflict (id) do nothing;
alter table public.feedback_cron enable row level security;   -- server only
revoke all on public.feedback_cron from anon, authenticated;

create table if not exists public.feedback_mail_log (
  id        bigint generated always as identity primary key,
  team_slug text not null,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  month     text not null,
  sent_at   timestamptz not null default now()
);
create index if not exists feedback_mail_log_user on public.feedback_mail_log (user_id, sent_at desc);
alter table public.feedback_mail_log enable row level security;   -- server only
revoke all on public.feedback_mail_log from anon, authenticated;

-- the month people should be sending now ('YYYY-MM'), or null
create or replace function public.feedback_target(p_team text) returns text
language sql stable security definer set search_path = '' as $$
  with n as (select (now() at time zone 'Asia/Kolkata') as l)
  select case
    when public.feedback_window(p_team, to_char(n.l, 'YYYY-MM')) = 'open' then to_char(n.l, 'YYYY-MM')
    when public.feedback_window(p_team, to_char(n.l - interval '1 month', 'YYYY-MM')) = 'late' then to_char(n.l - interval '1 month', 'YYYY-MM')
  end from n
$$;

-- has this person sent that month's feedback?
create or replace function public.feedback_sent(p_team text, p_user uuid, p_month text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.monthly_feedback f
                  where f.team_slug = p_team and f.user_id = p_user and f.month = p_month and f.status = 'submitted')
$$;

-- what the signed-in person sees: is theirs pending, for which month, due when, show the strip?
create or replace function public.feedback_me(p_team text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); m text; s public.feedback_settings;
begin
  if me is null or public.is_super()
     or not exists (select 1 from public.memberships x where x.team_slug = p_team and x.user_id = me) then
    return jsonb_build_object('pending', false);
  end if;
  m := public.feedback_target(p_team);
  if m is null or public.feedback_sent(p_team, me, m) then return jsonb_build_object('pending', false); end if;
  select * into s from public.feedback_settings f where f.team_slug = p_team;
  return jsonb_build_object(
    'pending', true, 'month', m,
    'late', public.feedback_window(p_team, m) = 'late',
    'due', (to_date(m || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date,
    'late_until', (to_date(m || '-01', 'YYYY-MM-DD') + interval '1 month' + interval '9 days')::date,
    'strip', coalesce(s.strip, true),
    'draft', exists (select 1 from public.monthly_feedback f where f.team_slug = p_team and f.user_id = me and f.month = m));
end $$;

-- owners: emails a day and the strip
create or replace function public.feedback_set_nudges(p_team text, p_emails int, p_strip boolean)
returns public.feedback_settings language plpgsql security definer set search_path = '' as $$
declare s public.feedback_settings;
begin
  if public.my_role(p_team) <> 'owner' and not public.is_super() then raise exception 'Only owners can change this.'; end if;
  insert into public.feedback_settings as f (team_slug, emails_per_day, strip, updated_at, updated_by)
  values (p_team, least(greatest(coalesce(p_emails, 1), 0), 5), coalesce(p_strip, true), now(), auth.uid())
  on conflict (team_slug) do update set emails_per_day = excluded.emails_per_day, strip = excluded.strip, updated_at = now(), updated_by = auth.uid()
  returning * into s;
  return s;
end $$;

-- the hourly job: who gets an email now (spread over 09:00–21:00 India time)
create or replace function public.feedback_mail_tick() returns int
language plpgsql security definer set search_path = '' as $$
declare
  l timestamp := now() at time zone 'Asia/Kolkata';
  day0 timestamptz := date_trunc('day', l) at time zone 'Asia/Kolkata';
  s record; u record; m text; c int; last timestamptz; n int := 0;
  mail jsonb := '[]'::jsonb; key text;
begin
  if extract(hour from l) < 9 or extract(hour from l) >= 21 then return 0; end if;
  for s in select * from public.feedback_settings where enabled and emails_per_day > 0 loop
    m := public.feedback_target(s.team_slug);
    continue when m is null;
    for u in select distinct x.user_id from public.memberships x join public.profiles p on p.id = x.user_id
              where x.team_slug = s.team_slug and not coalesce(p.is_super, false)
                and not public.feedback_sent(s.team_slug, x.user_id, m) loop
      select count(*), max(sent_at) into c, last from public.feedback_mail_log
       where user_id = u.user_id and team_slug = s.team_slug and sent_at >= day0;
      if c < s.emails_per_day and (last is null or now() - last >= make_interval(hours => greatest(1, 12 / s.emails_per_day))) then
        mail := mail || jsonb_build_object('user_id', u.user_id, 'team', s.team_slug, 'month', m,
                                           'late', public.feedback_window(s.team_slug, m) = 'late');
        insert into public.feedback_mail_log (team_slug, user_id, month) values (s.team_slug, u.user_id, m);
        n := n + 1;
      end if;
    end loop;
  end loop;
  if jsonb_array_length(mail) > 0 then
    select cron_key into key from public.feedback_cron where id = 1;
    perform net.http_post(
      url     := 'https://bzhnzrmnbphkcasvrsnc.supabase.co/functions/v1/feedback-remind',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', key),
      body    := jsonb_build_object('people', mail),
      timeout_milliseconds := 60000);
  end if;
  return n;
end $$;

revoke execute on function public.feedback_target(text), public.feedback_sent(text, uuid, text), public.feedback_mail_tick()
  from public, anon, authenticated;
revoke execute on function public.feedback_me(text), public.feedback_set_nudges(text, int, boolean) from public, anon;
grant execute on function public.feedback_me(text), public.feedback_set_nudges(text, int, boolean) to authenticated;

-- every hour at :17
select cron.schedule('feedback-mail-tick', '17 * * * *', 'select public.feedback_mail_tick()');
