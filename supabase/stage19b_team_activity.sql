-- =====================================================================
-- STAGE 19b — 🕘 History: what changed, who changed it, old → new
--
-- One row per changed field, written by the browser as a change is saved
-- (social-space.js: cards and ideas), shown under Activity → History next to
-- the comments (comments.js).
--   place   the card / idea it's about  ("card:card:<id>", "card:idea:<id>")
--   scope   the space it sits in        ("cs:<space id>") — a tab's History
--   field   the label that changed ("Status", "Title", …), or "created" / "deleted"
-- A log only grows: nobody edits or deletes rows from the app.
-- =====================================================================
create table if not exists public.team_activity (
  id          uuid primary key default gen_random_uuid(),
  team_slug   text not null references public.teams(slug) on delete cascade on update cascade,
  place       text not null check (length(place) between 3 and 300),
  scope       text not null default '' check (length(scope) <= 300),
  place_label text not null default '' check (length(place_label) <= 200),
  actor_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  actor_name  text not null default '' check (length(actor_name) <= 120),
  field       text not null check (length(field) between 1 and 80),
  old_val     text not null default '' check (length(old_val) <= 2000),
  new_val     text not null default '' check (length(new_val) <= 2000),
  created_at  timestamptz not null default now()
);
create index if not exists team_activity_place_idx on public.team_activity (team_slug, place, created_at desc);
create index if not exists team_activity_scope_idx on public.team_activity (team_slug, scope, created_at desc);

alter table public.team_activity enable row level security;

drop policy if exists "team reads history" on public.team_activity;
create policy "team reads history" on public.team_activity for select to authenticated
  using (public.has_role(team_slug, 'viewer'));

drop policy if exists "team writes history" on public.team_activity;
create policy "team writes history" on public.team_activity for insert to authenticated
  with check (public.has_role(team_slug, 'viewer') and actor_id = auth.uid());

revoke all on public.team_activity from anon;
revoke update, delete, truncate on public.team_activity from authenticated;
grant select, insert on public.team_activity to authenticated;
