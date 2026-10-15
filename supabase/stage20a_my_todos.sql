-- =====================================================================
-- STAGE 20a — My To-do (my-todo.js)
--
-- One private row per person per team: their own to-dos and where they
-- moved assigned cards on their My To-do board. Only that person can read
-- or write it (not owners, not super-admins). Assigned work itself is read
-- from the boards as usual; nothing here is shared.
--
-- Who sees the My To-do board is decided by the "My To-do" permission
-- (Owners and super-admins have it; give it to other roles in
-- Roles & permissions). Until this is run the app keeps to-dos in the
-- browser only.
-- =====================================================================
create table if not exists public.my_todos (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_slug  text not null references public.teams(slug) on update cascade on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, team_slug)
);
alter table public.my_todos enable row level security;
revoke all on public.my_todos from anon;
grant select, insert, update, delete on public.my_todos to authenticated;

drop policy if exists "own to-dos" on public.my_todos;
create policy "own to-dos" on public.my_todos for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_role(team_slug, 'viewer'));
