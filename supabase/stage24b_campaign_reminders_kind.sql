-- =====================================================================
-- STAGE 24b — campaign board: deadline-day reminders and 🔔 Notify
--
-- campaign_reminders.kind: 'due' (the deadline day, 10 AM), 'overdue' (the morning after),
-- 'nudge-<time>' (someone pressed 🔔 Notify). One 'due' and one 'overdue' per deadline.
-- Sub tasks use item_id "<card id>~<sub task id>". Run after stage24a. Safe to run again.
-- =====================================================================
alter table public.campaign_reminders add column if not exists kind text not null default 'overdue';
alter table public.campaign_reminders drop constraint if exists campaign_reminders_team_slug_campaign_id_item_id_due_key;
alter table public.campaign_reminders drop constraint if exists campaign_reminders_once;
alter table public.campaign_reminders add constraint campaign_reminders_once unique (team_slug, campaign_id, item_id, due, kind);
