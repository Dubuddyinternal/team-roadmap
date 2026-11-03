-- =====================================================================
-- STAGE 23a — Individual OKR emails (Social Media → 🎯 Individual OKRs)
--
-- Each person given monthly key results in a Social Media space (Shorts, Reels, long videos,
-- subscriber / follower totals) gets:
--   * on the 20th, 10:00 AM India time — a friendly reminder, only if a key result isn't reached yet;
--   * on the 1st, 10:00 AM India time — a summary of the month before: each target and what was done.
-- People who may edit social targets (and owners) can also send either one right away from the tab.
-- The emails are built by the "social-okr" Edge Function (Verify JWT OFF; it checks the same key as
-- social-weekly: feedback_cron.cron_key). Run after stage22c. Safe to run again.
-- =====================================================================

create or replace function public.social_okr_post(p_team text, p_mode text, p_email text, p_month text) returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  select cron_key into k from public.feedback_cron where id = 1;
  perform net.http_post(
    url     := 'https://bzhnzrmnbphkcasvrsnc.supabase.co/functions/v1/social-okr',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
    body    := jsonb_strip_nulls(jsonb_build_object('team', p_team, 'mode', p_mode, 'email', p_email, 'month', p_month, 'force', p_email is not null)),
    timeout_milliseconds := 120000);
end $$;

create or replace function public.social_okr_tick(p_mode text) returns void
language sql security definer set search_path = '' as $$ select public.social_okr_post(null, p_mode, null, null) $$;

-- ✉️ Send … now, from the tab: owners, people who may edit social targets, super-admins
create or replace function public.social_okr_send_now(p_team text, p_email text, p_mode text, p_month text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_super() or public.my_role(p_team) = 'owner' or public.has_perm(p_team, 'edit_targets')) then
    raise exception 'Only owners or people who edit social targets can send it.';
  end if;
  if p_mode not in ('mid', 'end') then raise exception 'mode must be mid or end'; end if;
  perform public.social_okr_post(p_team, p_mode, lower(p_email), p_month);
  return true;
end $$;

revoke execute on function public.social_okr_post(text, text, text, text), public.social_okr_tick(text) from public, anon, authenticated;
revoke execute on function public.social_okr_send_now(text, text, text, text) from public, anon;
grant execute on function public.social_okr_send_now(text, text, text, text) to authenticated;

-- 04:30 UTC = 10:00 AM India time
select cron.schedule('social-okr-mid', '30 4 20 * *', $$select public.social_okr_tick('mid')$$);
select cron.schedule('social-okr-end', '30 4 1 * *', $$select public.social_okr_tick('end')$$);
