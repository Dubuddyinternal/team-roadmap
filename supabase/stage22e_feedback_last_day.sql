-- =====================================================================
-- STAGE 22e — Monthly feedback: you choose the last date
--
-- Until now late sends were allowed until the 10th of the next month,
-- fixed. Owners now pick that day in My Team → Monthly feedback →
-- ⚙️ Settings ("Last date to send"), anywhere from the 1st to the 25th of
-- the next month, and can push it later when people need more time.
-- Reminders (🔔, pop-up, emails, strip) and the month-end OKR check-in
-- follow the same date.
-- Run after stage22d. Safe to run again.
-- =====================================================================

alter table public.feedback_settings add column if not exists late_day int not null default 10;
do $$ begin
  alter table public.feedback_settings add constraint feedback_settings_late_day check (late_day between 1 and 25);
exception when duplicate_object then null; end $$;

-- 'open' (open day → month end), 'late' (until the last date in the next month) or 'closed'
create or replace function public.feedback_window(p_team text, p_month text)
returns text language sql stable security definer set search_path = '' as $$
  with n as (select (now() at time zone 'Asia/Kolkata') as l),
       s as (select coalesce((select f.enabled from public.feedback_settings f where f.team_slug = p_team), true) as en,
                    coalesce((select f.open_day from public.feedback_settings f where f.team_slug = p_team), 25) as od,
                    coalesce((select f.late_day from public.feedback_settings f where f.team_slug = p_team), 10) as ld)
  select case
    when not s.en then 'closed'
    when p_month = to_char(n.l, 'YYYY-MM') and extract(day from n.l) >= s.od then 'open'
    when p_month = to_char(n.l - interval '1 month', 'YYYY-MM') and extract(day from n.l) <= s.ld then 'late'
    else 'closed' end
  from n, s
$$;

-- what the signed-in person sees (same as stage 22a, with the chosen last date)
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
    'late_until', (to_date(m || '-01', 'YYYY-MM-DD') + interval '1 month' + make_interval(days => coalesce(s.late_day, 10) - 1))::date,
    'strip', coalesce(s.strip, true),
    'draft', exists (select 1 from public.monthly_feedback f where f.team_slug = p_team and f.user_id = me and f.month = m));
end $$;

-- the month-end OKR check-in stays open until the same last date
create or replace function public.okr_checkin_target(p_team text) returns text
language sql stable security definer set search_path = '' as $$
  with n as (select (now() at time zone 'Asia/Kolkata') as l),
       s as (select coalesce(f.okr_on, true) as okr_on, coalesce(f.okr_mid_day, 15) as md, coalesce(f.open_day, 25) as od,
                    coalesce(f.late_day, 10) as ld
               from (select 1) x left join public.feedback_settings f on f.team_slug = p_team)
  select case
    when not s.okr_on then null
    when extract(day from n.l) >= s.od then to_char(n.l, 'YYYY-MM') || '-end'
    when extract(day from n.l) <= s.ld then to_char(n.l - interval '1 month', 'YYYY-MM') || '-end'
    when extract(day from n.l) >= s.md then to_char(n.l, 'YYYY-MM') || '-mid'
  end from n, s
$$;

-- owners: the last date (day of the next month)
create or replace function public.feedback_set_late_day(p_team text, p_day int)
returns public.feedback_settings language plpgsql security definer set search_path = '' as $$
declare s public.feedback_settings;
begin
  if public.my_role(p_team) <> 'owner' and not public.is_super() then raise exception 'Only owners can change this.'; end if;
  if p_day is null or p_day < 1 or p_day > 25 then raise exception 'Pick a day between 1 and 25.'; end if;
  insert into public.feedback_settings as f (team_slug, late_day, updated_at, updated_by)
  values (p_team, p_day, now(), auth.uid())
  on conflict (team_slug) do update set late_day = excluded.late_day, updated_at = now(), updated_by = auth.uid()
  returning * into s;
  return s;
end $$;

revoke execute on function public.feedback_set_late_day(text, int) from public, anon;
grant execute on function public.feedback_set_late_day(text, int) to authenticated;
