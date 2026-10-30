-- =====================================================================
-- STAGE 22g — Monthly feedback: the due date people see, before the last date
--
-- Until now people were told "due on the last day of the month" (31 Oct),
-- with late sends allowed until the last date (stage 22e, e.g. 10 Nov).
-- Now the real deadline is the last date, and everyone is shown a due date
-- a few days before it (default 2: last date 10 Nov → "due 8 Nov"). The
-- days in between are a quiet last chance:
--   * strip, 🔔, pop-up and emails say "Please send it by 8 Nov", and after
--     that "It was due 8 Nov — send it by 10 Nov"
--   * sent after the shown due date, it's marked late (before: after the
--     month end)
--   * the lock (stage 22f) still comes after the last date
-- Owners pick the gap in My Team → Monthly feedback → ⚙️ Settings
-- ("Due date people see", 0–7 days before the last date).
-- Run after stage22f. Safe to run again.
-- =====================================================================

alter table public.feedback_settings add column if not exists due_gap int not null default 2;
do $$ begin
  alter table public.feedback_settings add constraint feedback_settings_due_gap check (due_gap between 0 and 7);
exception when duplicate_object then null; end $$;

-- a month's last date (the real deadline) and the due date people are shown
create or replace function public.feedback_last_date(p_team text, p_month text) returns date
language sql stable security definer set search_path = '' as $$
  select (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month'
          + make_interval(days => coalesce((select f.late_day from public.feedback_settings f where f.team_slug = p_team), 10) - 1))::date
$$;
create or replace function public.feedback_due_date(p_team text, p_month text) returns date
language sql stable security definer set search_path = '' as $$
  select public.feedback_last_date(p_team, p_month)
         - coalesce((select f.due_gap from public.feedback_settings f where f.team_slug = p_team), 2)
$$;
-- past the shown due date (India time)?
create or replace function public.feedback_past_due(p_team text, p_month text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date > public.feedback_due_date(p_team, p_month)
$$;

-- what the signed-in person sees: as stage 22f, with the shown due date and "late" = past it
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
      'due', public.feedback_due_date(p_team, lm),
      'late_until', public.feedback_last_date(p_team, lm),
      'strip', false,
      'draft', exists (select 1 from public.monthly_feedback f where f.team_slug = p_team and f.user_id = me and f.month = lm));
  end if;
  m := public.feedback_target(p_team);
  if m is null or public.feedback_sent(p_team, me, m) then return jsonb_build_object('pending', false); end if;
  return jsonb_build_object(
    'pending', true, 'locked', false, 'month', m,
    'late', public.feedback_past_due(p_team, m),
    'due', public.feedback_due_date(p_team, m),
    'late_until', public.feedback_last_date(p_team, m),
    'strip', coalesce(s.strip, true),
    'draft', exists (select 1 from public.monthly_feedback f where f.team_slug = p_team and f.user_id = me and f.month = m));
end $$;

-- writing it: as stage 22f, but "late" = sent after the shown due date
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
          coalesce(p_submit, false) and w = 'late' and public.feedback_past_due(p_team, p_month), now())
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

-- the daily 🔔 + pop-up (09:30): as stage 16a, telling the shown due date, shown until the last date
create or replace function public.feedback_remind()
returns int language plpgsql security definer set search_path = '' as $$
declare
  l timestamp := now() at time zone 'Asia/Kolkata';
  cur text := to_char(l, 'YYYY-MM');
  lbl text := to_char(l, 'FMMonth');
  due text;
  untl timestamptz;
  s record;
  n int := 0;
  k int;
begin
  for s in select * from public.feedback_settings where enabled loop
    if extract(day from l) >= s.open_day then
      due := to_char(public.feedback_due_date(s.team_slug, cur), 'FMDD FMMonth');
      untl := (public.feedback_last_date(s.team_slug, cur) + 1)::timestamp at time zone 'Asia/Kolkata';
      insert into public.team_notifications
        (team_slug, title, body, audience, recipients, popup, popup_rule, popup_times, popup_gap, show_until, bell, created_by, ref)
      select s.team_slug,
             '📝 Your ' || lbl || ' feedback is open',
             'Take 10 minutes to look back at your month — what went well, what got in the way, and what you need. '
               || 'Find it in Administration → 📝 My monthly feedback. You can save a draft and finish it later. Please send it by ' || due || '.',
             'people', array[m.user_id], true, 'times', 20, 'day', untl, true, null, 'feedback:' || cur
        from public.memberships m
       where m.team_slug = s.team_slug
         and not exists (select 1 from public.monthly_feedback f
                          where f.team_slug = s.team_slug and f.user_id = m.user_id and f.month = cur and f.status = 'submitted')
         and not exists (select 1 from public.team_notifications x
                          where x.team_slug = s.team_slug and x.ref = 'feedback:' || cur and x.recipients = array[m.user_id]);
      get diagnostics k = row_count;
      n := n + k;
    end if;
  end loop;
  return n;
end $$;

-- the hourly email job: as stage 22b, and each email gets the shown due date and the last date
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
                                           'late', fb and public.feedback_past_due(s.team_slug, m),
                                           'due', case when fb then public.feedback_due_date(s.team_slug, m) end,
                                           'last', case when fb then public.feedback_last_date(s.team_slug, m) end,
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

-- owners: how many days before the last date the due date is shown
create or replace function public.feedback_set_due_gap(p_team text, p_days int)
returns public.feedback_settings language plpgsql security definer set search_path = '' as $$
declare s public.feedback_settings;
begin
  if public.my_role(p_team) <> 'owner' and not public.is_super() then raise exception 'Only owners can change this.'; end if;
  if p_days is null or p_days < 0 or p_days > 7 then raise exception 'Pick 0 to 7 days.'; end if;
  insert into public.feedback_settings as f (team_slug, due_gap, updated_at, updated_by)
  values (p_team, p_days, now(), auth.uid())
  on conflict (team_slug) do update set due_gap = excluded.due_gap, updated_at = now(), updated_by = auth.uid()
  returning * into s;
  return s;
end $$;

-- this month's 🔔 already went out with "send it by 31 Oct": tell the new date instead
update public.team_notifications n
   set body = regexp_replace(n.body, 'Please send it by [^.]*\.', 'Please send it by '
         || to_char(public.feedback_due_date(n.team_slug, substr(n.ref, 10)), 'FMDD FMMonth') || '.'),
       show_until = (public.feedback_last_date(n.team_slug, substr(n.ref, 10)) + 1)::timestamp at time zone 'Asia/Kolkata'
 where n.ref ~ '^feedback:\d{4}-\d{2}$' and not coalesce(n.stopped, false)
   and n.created_at > now() - interval '45 days';

revoke execute on function public.feedback_last_date(text, text), public.feedback_due_date(text, text), public.feedback_past_due(text, text),
  public.feedback_remind(), public.feedback_mail_tick() from public, anon, authenticated;
revoke execute on function public.feedback_set_due_gap(text, int) from public, anon;
grant execute on function public.feedback_set_due_gap(text, int) to authenticated;
