-- =====================================================================
-- STAGE 22f — Monthly feedback: lock the account after the last date
--
-- Same idea as the HR rules' lock (stage 18i). An owner switches it on in
-- My Team → Monthly feedback → ⚙️ Settings ("Lock the account of anyone who
-- hasn't sent it by the last date"). Once a month's last date (stage 22e)
-- has passed, anyone who still hasn't sent that month's feedback sees a
-- lock screen with the form in it. They can still fill it in and send it
-- (it's marked late), and everything opens again straight away.
-- Only months whose last date falls after the lock was switched on count,
-- so switching it on never locks people for old months.
-- Super-admins are left out.
-- Run after stage22e. Safe to run again.
-- =====================================================================

alter table public.feedback_settings add column if not exists lock_on boolean not null default false;
alter table public.feedback_settings add column if not exists lock_since timestamptz;

-- the month this person is locked for ('YYYY-MM'), or null: the latest month whose last date has passed,
-- if it isn't sent
create or replace function public.feedback_locked_month(p_team text, p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare s public.feedback_settings; l timestamp := now() at time zone 'Asia/Kolkata'; m text; last_date date;
begin
  select * into s from public.feedback_settings f where f.team_slug = p_team;
  if not found or not s.enabled or not s.lock_on or s.lock_since is null then return null; end if;
  if exists (select 1 from public.profiles p where p.id = p_user and coalesce(p.is_super, false)) then return null; end if;
  if not exists (select 1 from public.memberships x where x.team_slug = p_team and x.user_id = p_user) then return null; end if;
  -- past this month's last date → last month counts; otherwise the month before
  if extract(day from l) > coalesce(s.late_day, 10) then m := to_char(l - interval '1 month', 'YYYY-MM');
  else m := to_char(l - interval '2 months', 'YYYY-MM'); end if;
  last_date := (to_date(m || '-01', 'YYYY-MM-DD') + interval '1 month' + make_interval(days => coalesce(s.late_day, 10) - 1))::date;
  if last_date < (s.lock_since at time zone 'Asia/Kolkata')::date then return null; end if;
  if public.feedback_sent(p_team, p_user, m) then return null; end if;
  return m;
end $$;

-- what the signed-in person sees: as stage 22e, plus 'locked' (the locked month comes first)
create or replace function public.feedback_me(p_team text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); m text; lm text; s public.feedback_settings;
begin
  if me is null or public.is_super()
     or not exists (select 1 from public.memberships x where x.team_slug = p_team and x.user_id = me) then
    return jsonb_build_object('pending', false);
  end if;
  select * into s from public.feedback_settings f where f.team_slug = p_team;
  lm := public.feedback_locked_month(p_team, me);
  if lm is not null then
    return jsonb_build_object('pending', true, 'locked', true, 'month', lm, 'late', true,
      'due', (to_date(lm || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date,
      'late_until', (to_date(lm || '-01', 'YYYY-MM-DD') + interval '1 month' + make_interval(days => coalesce(s.late_day, 10) - 1))::date,
      'strip', false,
      'draft', exists (select 1 from public.monthly_feedback f where f.team_slug = p_team and f.user_id = me and f.month = lm));
  end if;
  m := public.feedback_target(p_team);
  if m is null or public.feedback_sent(p_team, me, m) then return jsonb_build_object('pending', false); end if;
  return jsonb_build_object(
    'pending', true, 'locked', false, 'month', m,
    'late', public.feedback_window(p_team, m) = 'late',
    'due', (to_date(m || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date,
    'late_until', (to_date(m || '-01', 'YYYY-MM-DD') + interval '1 month' + make_interval(days => coalesce(s.late_day, 10) - 1))::date,
    'strip', coalesce(s.strip, true),
    'draft', exists (select 1 from public.monthly_feedback f where f.team_slug = p_team and f.user_id = me and f.month = m));
end $$;

-- ---------- writing it: as stage 16a, but a locked month can still be sent ----------
create or replace function public.feedback_save(p_team text, p_month text, p_answers jsonb, p_submit boolean)
returns public.monthly_feedback language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  w text;
  r public.monthly_feedback;
  mgr uuid;
  who text;
begin
  if me is null or not public.has_role(p_team, 'viewer') then raise exception 'Sign in to this team first.'; end if;
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Bad month.'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 40000 then
    raise exception 'The answers are too long.';
  end if;
  w := public.feedback_window(p_team, p_month);
  -- a locked account can always send the month it's locked for (marked late)
  if w = 'closed' and p_month = public.feedback_locked_month(p_team, me) then w := 'late'; end if;
  if w = 'closed' then raise exception 'Feedback for this month isn''t open.'; end if;
  select * into r from public.monthly_feedback f where f.team_slug = p_team and f.user_id = me and f.month = p_month;
  if found and r.status = 'submitted' then raise exception 'You already sent this month''s feedback.'; end if;

  insert into public.monthly_feedback as f (team_slug, user_id, month, answers, status, submitted_at, late, updated_at)
  values (p_team, me, p_month, p_answers,
          case when p_submit then 'submitted' else 'draft' end,
          case when p_submit then now() end,
          coalesce(p_submit, false) and w = 'late', now())
  on conflict (team_slug, user_id, month) do update
    set answers = excluded.answers, status = excluded.status, submitted_at = excluded.submitted_at,
        late = excluded.late, updated_at = now()
  returning * into r;

  if p_submit then
    -- the daily reminder stops
    update public.team_notifications n set stopped = true
     where n.team_slug = p_team and n.ref = 'feedback:' || p_month and n.recipients = array[me];
    -- the nearest senior hears about it
    mgr := public.fb_manager_of(p_team, me);
    if mgr is not null and mgr <> me then
      select coalesce(nullif(p.profile->>'displayName', ''), p.name, 'A teammate') into who from public.profiles p where p.id = me;
      insert into public.team_notifications (team_slug, title, body, audience, recipients, bell, popup, created_by)
      values (p_team,
              left('📝 ' || who || ' sent their ' || to_char(to_date(p_month || '-01', 'YYYY-MM-DD'), 'FMMonth') || ' feedback', 140),
              'Read it in My Team → Monthly feedback before your review meeting.',
              'people', array[mgr], true, false, me);
    end if;
  end if;
  return r;
end $$;

-- owners: switch the lock on/off (the clock starts when it's switched on)
create or replace function public.feedback_set_lock(p_team text, p_on boolean)
returns public.feedback_settings language plpgsql security definer set search_path = '' as $$
declare s public.feedback_settings;
begin
  if public.my_role(p_team) <> 'owner' and not public.is_super() then raise exception 'Only owners can change this.'; end if;
  insert into public.feedback_settings as f (team_slug, lock_on, lock_since, updated_at, updated_by)
  values (p_team, coalesce(p_on, false), case when p_on then now() end, now(), auth.uid())
  on conflict (team_slug) do update
    set lock_since = case when excluded.lock_on and not f.lock_on then now() when excluded.lock_on then f.lock_since end,
        lock_on = excluded.lock_on, updated_at = now(), updated_by = auth.uid()
  returning * into s;
  return s;
end $$;

-- who is locked right now (My Team → Monthly feedback shows a 🔒)
create or replace function public.feedback_locked_people(p_team text) returns table (user_id uuid, month text)
language sql stable security definer set search_path = '' as $$
  select x.user_id, public.feedback_locked_month(p_team, x.user_id)
    from public.memberships x
   where x.team_slug = p_team and public.has_role(p_team, 'viewer')
     and (public.is_super() or x.user_id = auth.uid() or x.user_id in (select public.fb_reports(p_team)))
     and public.feedback_locked_month(p_team, x.user_id) is not null
$$;

revoke execute on function public.feedback_locked_month(text, uuid) from public, anon, authenticated;
revoke execute on function public.feedback_set_lock(text, boolean), public.feedback_locked_people(text) from public, anon;
grant execute on function public.feedback_set_lock(text, boolean), public.feedback_locked_people(text) to authenticated;
