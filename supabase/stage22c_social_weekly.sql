-- =====================================================================
-- STAGE 22c — Weekly Social Media progress email
--
-- Every Monday at 9:00 AM India time, each Social Media space's accountable
-- people (⭐ Main accountable per platform + everyone 👥 ticked on a line in
-- its 🤝 Our agreement) get an email with the subscriber / follower
-- progress the Summary shows: from the "counting from" day to the target,
-- the end-of-month / end-of-quarter checkpoints and the last weeks.
-- The email itself is built by the "social-weekly" Edge Function (Verify JWT
-- OFF; it checks the same key as feedback-remind: feedback_cron.cron_key).
-- Owners can also send it right away from Our agreement (✉️ Send it now).
-- Run after stage22a. Safe to run again.
-- =====================================================================

create or replace function public.social_weekly_post(p_team text) returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  select cron_key into k from public.feedback_cron where id = 1;
  perform net.http_post(
    url     := 'https://bzhnzrmnbphkcasvrsnc.supabase.co/functions/v1/social-weekly',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
    body    := case when p_team is null then '{}'::jsonb else jsonb_build_object('team', p_team) end,
    timeout_milliseconds := 120000);
end $$;

-- the Monday job: every team
create or replace function public.social_weekly_tick() returns void
language sql security definer set search_path = '' as $$ select public.social_weekly_post(null) $$;

-- ✉️ Send it now (owners, people who may edit social targets, super-admins): this team only
create or replace function public.social_weekly_send_now(p_team text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_super() or public.my_role(p_team) = 'owner' or public.has_perm(p_team, 'edit_targets')) then
    raise exception 'Only owners or people who edit social targets can send it.';
  end if;
  perform public.social_weekly_post(p_team);
  return true;
end $$;

revoke execute on function public.social_weekly_post(text), public.social_weekly_tick() from public, anon, authenticated;
revoke execute on function public.social_weekly_send_now(text) from public, anon;
grant execute on function public.social_weekly_send_now(text) to authenticated;

-- Mondays 03:30 UTC = 9:00 AM India time
select cron.schedule('social-weekly', '30 3 * * 1', 'select public.social_weekly_tick()');
