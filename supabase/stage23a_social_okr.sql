-- =====================================================================
-- STAGE 23a — Individual OKR emails (Social Media → 🎯 Individual OKRs)
--
-- Everyone given objectives in a Social Media space gets, at their registered email:
--   * on the 15th, 10:00 AM India time — their OKR status so far (each key result, target vs done);
--   * on the month's last day, 6:00 PM India time — the month's summary.
-- Both are friendly notes. Each can be turned off per person in the tab. Owners and people who may
-- edit social targets can also send either one now, or ✍️ write their own mail, from the tab.
-- Built by the "social-okr" Edge Function (Verify JWT OFF; same key as social-weekly:
-- feedback_cron.cron_key). Run after stage22c. Safe to run again.
-- =====================================================================

create or replace function public.social_okr_post(p_body jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  select cron_key into k from public.feedback_cron where id = 1;
  perform net.http_post(
    url     := 'https://bzhnzrmnbphkcasvrsnc.supabase.co/functions/v1/social-okr',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
    body    := p_body,
    timeout_milliseconds := 120000);
end $$;

create or replace function public.social_okr_tick(p_mode text) returns void
language sql security definer set search_path = '' as $$ select public.social_okr_post(jsonb_build_object('mode', p_mode)) $$;

-- the tab's "Send status now" / "Send summary now" / ✍️ Write a mail: only the logins the tab shows it to
-- (Mannat and Aditya — OKR_MAILERS in social-space.js), plus super-admins
create or replace function public.social_okr_send_now(p_team text, p_email text, p_mode text, p_from text, p_to text,
  p_subject text, p_message text, p_with_status boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_super() or lower(coalesce(auth.jwt() ->> 'email', '')) in ('mannat.dubuddy@gmail.com', 'aditya.dubuddy@gmail.com')) then
    raise exception 'Only Mannat and Aditya can send these emails.';
  end if;
  if p_mode not in ('mid', 'end', 'note') then raise exception 'mode must be mid, end or note'; end if;
  if p_mode = 'note' and coalesce(trim(p_message), '') = '' then raise exception 'Write a message first.'; end if;
  perform public.social_okr_post(jsonb_strip_nulls(jsonb_build_object('team', p_team, 'mode', p_mode, 'email', lower(p_email),
    'from', p_from, 'to', p_to, 'subject', p_subject, 'message', left(p_message, 5000), 'withStatus', p_with_status)));
  return true;
end $$;

revoke execute on function public.social_okr_post(jsonb), public.social_okr_tick(text) from public, anon, authenticated;
revoke execute on function public.social_okr_send_now(text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.social_okr_send_now(text, text, text, text, text, text, text, boolean) to authenticated;

-- 04:30 UTC = 10:00 AM India time on the 15th; 12:30 UTC = 6:00 PM India time on the 28th–31st (the function sends only on the last day)
select cron.schedule('social-okr-mid', '30 4 15 * *', $$select public.social_okr_tick('mid')$$);
select cron.schedule('social-okr-end', '30 12 28-31 * *', $$select public.social_okr_tick('end')$$);
