-- =====================================================================
-- STAGE 21a — 🔑 Log in as (super-admin only)
--
-- The record of every "Log in as": who, as whom, in which team, when.
-- Written only by the login-as Edge Function (service role); only
-- super-admins can read it. Nothing else changes.
-- =====================================================================
create table if not exists public.login_as_log (
  id        bigserial primary key,
  by_user   uuid not null references auth.users(id) on delete cascade,
  as_user   uuid not null references auth.users(id) on delete cascade,
  team_slug text,
  at        timestamptz not null default now()
);
alter table public.login_as_log enable row level security;
revoke all on public.login_as_log from anon, authenticated;
grant select on public.login_as_log to authenticated;
drop policy if exists "super reads" on public.login_as_log;
create policy "super reads" on public.login_as_log for select to authenticated using (public.is_super());
