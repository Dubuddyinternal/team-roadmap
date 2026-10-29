-- =====================================================================
-- STAGE 22b — OKR check-ins, twice a month
--
-- Everyone who owns an objective or a key result in the newest OKR cycle
-- updates their key results' numbers twice a month:
--   · mid-month: from the check-in day (default the 15th) until the day
--     before monthly feedback opens  — period 'YYYY-MM-mid'
--   · month end: together with monthly feedback (open day → 10th of the
--     next month)                     — period 'YYYY-MM-end'
-- Administration → 🎯 My OKR check-in (and at the top of My monthly feedback
-- at month end). Saving writes the numbers into the team's OKRs and records
-- the check-in; until then they get a 🔔 + daily pop-up (okr_checkin_remind,
-- 09:30 IST), the strip, the account-menu mark and emails (feedback_mail_tick
-- now sends one email covering feedback and/or the check-in).
-- Super-admins are left out. Run after stage22a. Safe to run again.
-- After running it, redeploy the "feedback-remind" Edge Function (new code).
-- =====================================================================

alter table public.feedback_settings add column if not exists okr_on boolean not null default true;
alter table public.feedback_settings add column if not exists okr_mid_day int not null default 15;
do $$ begin
  alter table public.feedback_settings add constraint feedback_settings_okr_mid_day check (okr_mid_day between 1 and 27);
exception when duplicate_object then null; end $$;

create table if not exists public.okr_checkins (
  id        uuid primary key default gen_random_uuid(),
  team_slug text not null references public.teams(slug) on update cascade on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  period    text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])-(mid|end)$'),
  updates   jsonb not null default '[]'::jsonb,
  note      text check (length(note) <= 4000),
  done_at   timestamptz not null default now(),
  unique (team_slug, user_id, period)
);
alter table public.okr_checkins enable row level security;
create policy "you, your seniors and super-admins read check-ins" on public.okr_checkins
  for select using (user_id = auth.uid() or public.is_super() or user_id in (select public.fb_reports(team_slug)));

-- the period people should be checking in for now ('YYYY-MM-mid' / 'YYYY-MM-end'), or null
create or replace function public.okr_checkin_target(p_team text) returns text
language sql stable security definer set search_path = '' as $$
  with n as (select (now() at time zone 'Asia/Kolkata') as l),
       s as (select coalesce(f.okr_on, true) as okr_on, coalesce(f.okr_mid_day, 15) as md, coalesce(f.open_day, 25) as od
               from (select 1) x left join public.feedback_settings f on f.team_slug = p_team)
  select case
    when not s.okr_on then null
    when extract(day from n.l) >= s.od then to_char(n.l, 'YYYY-MM') || '-end'
    when extract(day from n.l) <= 10 then to_char(n.l - interval '1 month', 'YYYY-MM') || '-end'
    when extract(day from n.l) >= s.md then to_char(n.l, 'YYYY-MM') || '-mid'
  end from n, s
$$;

-- emails of everyone owning an objective or key result in the team's newest OKR cycle
create or replace function public.okr_people(p_team text) returns setof text
language sql stable security definer set search_path = '' as $$
  with c as (select d.data->'cycles'->-1 as cyc from public.team_data d where d.team_slug = p_team and d.section = 'okrs'),
       o as (select ob from c, jsonb_array_elements(coalesce(c.cyc->'objectives', '[]'::jsonb)) ob),
       k as (select kr from o, jsonb_array_elements(case when jsonb_typeof(o.ob->'krs') = 'array' then o.ob->'krs' else '[]'::jsonb end) kr)
  select distinct lower(e) from (
    select jsonb_array_elements_text(case when jsonb_typeof(ob->'owners') = 'array' then ob->'owners' else '[]'::jsonb end) e from o
    union all select ob->>'assignee' from o
    union all select jsonb_array_elements_text(case when jsonb_typeof(kr->'owners') = 'array' then kr->'owners' else '[]'::jsonb end) from k
    union all select kr->>'owner' from k
  ) x where coalesce(e, '') <> ''
$$;

create or replace function public.okr_checkin_due(p_user uuid, p_team text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = p_user and not coalesce(p.is_super, false)
                   and lower(p.email) in (select public.okr_people(p_team)))
$$;

-- the signed-in person: is a check-in pending?
create or replace function public.okr_me(p_team text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); per text; m date; s public.feedback_settings;
begin
  per := public.okr_checkin_target(p_team);
  if me is null or per is null
     or not exists (select 1 from public.memberships x where x.team_slug = p_team and x.user_id = me)
     or not public.okr_checkin_due(me, p_team)
     or exists (select 1 from public.okr_checkins c where c.team_slug = p_team and c.user_id = me and c.period = per) then
    return jsonb_build_object('pending', false, 'period', per);
  end if;
  select * into s from public.feedback_settings f where f.team_slug = p_team;
  m := to_date(left(per, 7) || '-01', 'YYYY-MM-DD');
  return jsonb_build_object('pending', true, 'period', per, 'kind', right(per, 3),
    'due', case when right(per, 3) = 'mid' then m + (coalesce(s.okr_mid_day, 15) + 2 - 1)
                else (m + interval '1 month' - interval '1 day')::date end,
    'strip', coalesce(s.strip, true));
end $$;

-- save a check-in: [{oid, k (key result index), current}] into the newest cycle, then record it
create or replace function public.okr_checkin_save(p_team text, p_period text, p_updates jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); my text; d jsonb; ci int; oi int; ki int; ob jsonb; kr jsonb; u jsonb; n int := 0;
  per text := public.okr_checkin_target(p_team);
begin
  if me is null or not public.has_role(p_team, 'viewer') then raise exception 'Sign in to this team first.'; end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) > 200 then raise exception 'Bad updates.'; end if;
  if p_period is not null and p_period is distinct from per then raise exception 'This check-in isn''t open any more.'; end if;
  select lower(p.email) into my from public.profiles p where p.id = me;
  select t.data into d from public.team_data t where t.team_slug = p_team and t.section = 'okrs' for update;
  if d is null or jsonb_typeof(d->'cycles') <> 'array' or jsonb_array_length(d->'cycles') = 0 then raise exception 'No OKRs yet.'; end if;
  ci := jsonb_array_length(d->'cycles') - 1;
  for u in select * from jsonb_array_elements(p_updates) loop
    if jsonb_typeof(u->'current') <> 'number' then continue; end if;
    oi := null;
    select o.i - 1 into oi from jsonb_array_elements(d->'cycles'->ci->'objectives') with ordinality o(v, i) where o.v->>'id' = u->>'oid';
    continue when oi is null;
    ob := d->'cycles'->ci->'objectives'->oi;
    ki := (u->>'k')::int;
    kr := ob->'krs'->ki;
    continue when kr is null;
    -- yours: you own the objective or this key result
    if not (my in (select lower(x) from jsonb_array_elements_text(case when jsonb_typeof(ob->'owners') = 'array' then ob->'owners' else '[]'::jsonb end) x)
            or lower(coalesce(ob->>'assignee', '')) = my
            or my in (select lower(x) from jsonb_array_elements_text(case when jsonb_typeof(kr->'owners') = 'array' then kr->'owners' else '[]'::jsonb end) x)
            or lower(coalesce(kr->>'owner', '')) = my) then continue; end if;
    d := jsonb_set(d, array['cycles', ci::text, 'objectives', oi::text, 'krs', ki::text, 'current'], u->'current');
    d := jsonb_set(d, array['cycles', ci::text, 'objectives', oi::text, 'krs', ki::text, 'checkedAt'], to_jsonb(now()));
    n := n + 1;
  end loop;
  update public.team_data t set data = d where t.team_slug = p_team and t.section = 'okrs';
  if per is not null then
    insert into public.okr_checkins as c (team_slug, user_id, period, updates, note)
    values (p_team, me, per, p_updates, nullif(left(trim(coalesce(p_note, '')), 4000), ''))
    on conflict (team_slug, user_id, period) do update set updates = excluded.updates, note = excluded.note, done_at = now();
    update public.team_notifications x set stopped = true
     where x.team_slug = p_team and x.ref = 'okrci:' || per and x.recipients = array[me];
  end if;
  return jsonb_build_object('updated', n, 'period', per);
end $$;

-- owners: switch the check-in on/off and pick the mid-month day
create or replace function public.okr_set_checkin(p_team text, p_on boolean, p_mid_day int)
returns public.feedback_settings language plpgsql security definer set search_path = '' as $$
declare s public.feedback_settings;
begin
  if public.my_role(p_team) <> 'owner' and not public.is_super() then raise exception 'Only owners can change this.'; end if;
  if p_mid_day is null or p_mid_day < 1 or p_mid_day > 27 then raise exception 'Pick a day between 1 and 27.'; end if;
  insert into public.feedback_settings as f (team_slug, okr_on, okr_mid_day, updated_at, updated_by)
  values (p_team, coalesce(p_on, true), p_mid_day, now(), auth.uid())
  on conflict (team_slug) do update set okr_on = excluded.okr_on, okr_mid_day = excluded.okr_mid_day, updated_at = now(), updated_by = auth.uid()
  returning * into s;
  perform public.okr_checkin_remind();
  return s;
end $$;

-- daily 🔔 + pop-up until the check-in is saved (ref 'okrci:<period>')
create or replace function public.okr_checkin_remind() returns int
language plpgsql security definer set search_path = '' as $$
declare s record; per text; n int := 0; k int; untl timestamptz; mon text;
begin
  for s in select f.team_slug from public.feedback_settings f where f.okr_on loop
    per := public.okr_checkin_target(s.team_slug);
    continue when per is null;
    mon := to_char(to_date(left(per, 7) || '-01', 'YYYY-MM-DD'), 'FMMonth');
    untl := case when right(per, 3) = 'end'
                 then (to_date(left(per, 7) || '-01', 'YYYY-MM-DD') + interval '1 month' + interval '10 days')::timestamp at time zone 'Asia/Kolkata'
                 else (date_trunc('month', now() at time zone 'Asia/Kolkata')
                       + make_interval(days => coalesce((select f.open_day from public.feedback_settings f where f.team_slug = s.team_slug), 25) - 1)) at time zone 'Asia/Kolkata' end;
    insert into public.team_notifications
      (team_slug, title, body, audience, recipients, popup, popup_rule, popup_times, popup_gap, show_until, bell, created_by, ref)
    select s.team_slug,
           case when right(per, 3) = 'mid' then '🎯 Mid-month OKR check-in' else '🎯 ' || mon || ' OKR check-in' end,
           'Update the numbers on your key results — it takes 2 minutes. Find it in Administration → 🎯 My OKR check-in'
             || case when right(per, 3) = 'end' then ' (also at the top of your monthly feedback).' else '.' end,
           'people', array[m.user_id], true, 'times', 20, 'day', untl, true, null, 'okrci:' || per
      from public.memberships m
     where m.team_slug = s.team_slug
       and public.okr_checkin_due(m.user_id, s.team_slug)
       and not exists (select 1 from public.okr_checkins c where c.team_slug = s.team_slug and c.user_id = m.user_id and c.period = per)
       and not exists (select 1 from public.team_notifications x where x.team_slug = s.team_slug and x.ref = 'okrci:' || per and x.recipients = array[m.user_id]);
    get diagnostics k = row_count; n := n + k;
  end loop;
  return n;
end $$;

-- the hourly email job now covers both: monthly feedback and the OKR check-in (one email per person)
create or replace function public.feedback_mail_tick() returns int
language plpgsql security definer set search_path = '' as $$
declare
  l timestamp := now() at time zone 'Asia/Kolkata';
  day0 timestamptz := date_trunc('day', l) at time zone 'Asia/Kolkata';
  s record; u record; m text; per text; c int; last timestamptz; n int := 0;
  mail jsonb := '[]'::jsonb; key text; fb boolean; ok boolean;
begin
  if extract(hour from l) < 9 or extract(hour from l) >= 21 then return 0; end if;
  for s in select * from public.feedback_settings where emails_per_day > 0 loop
    m := case when s.enabled then public.feedback_target(s.team_slug) end;
    per := public.okr_checkin_target(s.team_slug);
    continue when m is null and per is null;
    for u in select distinct x.user_id from public.memberships x join public.profiles p on p.id = x.user_id
              where x.team_slug = s.team_slug and not coalesce(p.is_super, false) loop
      fb := m is not null and not public.feedback_sent(s.team_slug, u.user_id, m);
      ok := per is not null and public.okr_checkin_due(u.user_id, s.team_slug)
            and not exists (select 1 from public.okr_checkins k where k.team_slug = s.team_slug and k.user_id = u.user_id and k.period = per);
      continue when not fb and not ok;
      select count(*), max(sent_at) into c, last from public.feedback_mail_log
       where user_id = u.user_id and team_slug = s.team_slug and sent_at >= day0;
      if c < s.emails_per_day and (last is null or now() - last >= make_interval(hours => greatest(1, 12 / s.emails_per_day))) then
        mail := mail || jsonb_build_object('user_id', u.user_id, 'team', s.team_slug,
                                           'month', case when fb then m end,
                                           'late', fb and public.feedback_window(s.team_slug, m) = 'late',
                                           'okr', case when ok then per end);
        insert into public.feedback_mail_log (team_slug, user_id, month) values (s.team_slug, u.user_id, coalesce(case when fb then m end, left(per, 7)));
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

revoke execute on function public.okr_checkin_target(text), public.okr_people(text), public.okr_checkin_due(uuid, text),
  public.okr_checkin_remind(), public.feedback_mail_tick() from public, anon, authenticated;
revoke execute on function public.okr_me(text), public.okr_checkin_save(text, text, jsonb, text), public.okr_set_checkin(text, boolean, int)
  from public, anon;
grant execute on function public.okr_me(text), public.okr_checkin_save(text, text, jsonb, text), public.okr_set_checkin(text, boolean, int)
  to authenticated;

-- every morning at 09:30 India time, with the feedback reminders
select cron.schedule('okr-checkin-reminders', '0 4 * * *', 'select public.okr_checkin_remind()');
