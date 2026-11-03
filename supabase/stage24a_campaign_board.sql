-- =====================================================================
-- STAGE 24a — Campaign board reminders (Marketing → a campaign → Board / Reminders)
--
-- The morning after a deadline (10:00 AM India time), every board card that isn't Live sends its
-- owner a 🔔 "This card's status isn't updated" (with ✓ Published) and an email. Pressing ✓ Published
-- (on the board or in the bell) marks it here and tells the campaign lead (🔔 + email).
-- Built by the "campaign-remind" Edge Function (Verify JWT OFF; same key as social-okr:
-- feedback_cron.cron_key). Safe to run again.
-- =====================================================================

create table if not exists public.campaign_reminders (
  id          bigint generated always as identity primary key,
  team_slug   text not null,
  campaign_id text not null,
  item_id     text not null,
  title       text not null default '',
  due         date not null,
  to_user     uuid,
  to_name     text,
  sent_at     timestamptz not null default now(),
  status      text not null default 'waiting',   -- waiting | done | moved
  how         text,                              -- "Confirmed by Aditya", "Live in Content Process", "New date: 12 Nov"
  done_at     timestamptz,
  unique (team_slug, campaign_id, item_id, due)
);
create index if not exists campaign_reminders_open on public.campaign_reminders (team_slug, campaign_id) where status = 'waiting';
alter table public.campaign_reminders enable row level security;
drop policy if exists campaign_reminders_read on public.campaign_reminders;
create policy campaign_reminders_read on public.campaign_reminders for select to authenticated
  using (public.is_super() or exists (select 1 from public.memberships m where m.team_slug = campaign_reminders.team_slug and m.user_id = auth.uid()));
-- writes only through the Edge Function (service key)

create or replace function public.campaign_remind_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  select cron_key into k from public.feedback_cron where id = 1;
  perform net.http_post(
    url     := 'https://bzhnzrmnbphkcasvrsnc.supabase.co/functions/v1/campaign-remind',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
    body    := jsonb_build_object('action', 'tick'),
    timeout_milliseconds := 120000);
end $$;
revoke execute on function public.campaign_remind_tick() from public, anon, authenticated;

-- 04:30 UTC = 10:00 AM India time, every day
select cron.unschedule('campaign-remind') where exists (select 1 from cron.job where jobname = 'campaign-remind');
select cron.schedule('campaign-remind', '30 4 * * *', $$select public.campaign_remind_tick()$$);
