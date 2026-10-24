-- =====================================================================
-- STAGE 20b — Our To-do: share your plan with chosen teammates (my-todo.js)
--
-- WHAT THIS DOES, in plain words:
--   * A "circle" is a small group of people in one team who share their
--     To-do with each other (e.g. two co-founders). Anyone with the
--     "My To-do" permission can start one by inviting a teammate.
--   * todo_circles         one row per circle (who started it, which team)
--   * todo_circle_members  who is in it: 'invited' (asked, not answered yet)
--                          or 'joined'. The invited person answers Join /
--                          Decline; anyone can leave.
--   * todo_circle_ideas    the circle's shared ideas warehouse: every joined
--                          member reads and writes it.
--   * my_todos gets one more read rule: people who have both JOINED the same
--     circle can READ each other's plan (never write it). Everything else in
--     my_todos stays private as before.
--
-- SAFETY: creates three tables, two helper functions and their rules, and
-- adds one read rule to my_todos. Deletes nothing.
-- Run after stage20a_my_todos.sql.
-- =====================================================================

begin;

create table if not exists public.todo_circles (
  id         uuid primary key default gen_random_uuid(),
  team_slug  text not null references public.teams(slug) on update cascade on delete cascade,
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null default 'Our To-do',
  created_at timestamptz not null default now()
);
create index if not exists todo_circles_team_idx on public.todo_circles(team_slug);

create table if not exists public.todo_circle_members (
  circle_id  uuid not null references public.todo_circles(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'invited' check (status in ('invited','joined')),
  invited_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index if not exists todo_circle_members_user_idx on public.todo_circle_members(user_id);

create table if not exists public.todo_circle_ideas (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.todo_circles(id) on delete cascade,
  author_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text       text not null check (length(text) between 1 and 20000),
  kind       text not null default 'idea',
  pin        boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists todo_circle_ideas_circle_idx on public.todo_circle_ideas(circle_id, created_at desc);

-- ---------- helpers (security definer, so the rules below don't loop) ----------
-- my status in a circle: 'joined', 'invited' or null
create or replace function public.todo_circle_status(c uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.status from public.todo_circle_members m where m.circle_id = c and m.user_id = auth.uid()
$$;

-- have I and `other` both joined some circle of this team?
create or replace function public.todo_shares_with(other uuid, team text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.todo_circles c
    join public.todo_circle_members a on a.circle_id = c.id and a.user_id = auth.uid() and a.status = 'joined'
    join public.todo_circle_members b on b.circle_id = c.id and b.user_id = other     and b.status = 'joined'
    where c.team_slug = team
  )
$$;

-- is `who` a member of the circle's team? (only teammates can be invited)
create or replace function public.todo_circle_teammate(c uuid, who uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.todo_circles t join public.memberships m on m.team_slug = t.team_slug
    where t.id = c and m.user_id = who
  ) or exists (select 1 from public.profiles p where p.id = who and p.is_super)
$$;

create or replace function public.todo_circle_owner(c uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select t.owner_id from public.todo_circles t where t.id = c
$$;

-- ---------- rules ----------
alter table public.todo_circles        enable row level security;
alter table public.todo_circle_members enable row level security;
alter table public.todo_circle_ideas   enable row level security;
revoke all on public.todo_circles, public.todo_circle_members, public.todo_circle_ideas from anon;
grant select, insert, update, delete on public.todo_circles, public.todo_circle_members, public.todo_circle_ideas to authenticated;

-- circles: seen by whoever started it and by anyone invited to / in it
drop policy if exists "circle read" on public.todo_circles;
create policy "circle read" on public.todo_circles for select to authenticated
  using (owner_id = auth.uid() or public.todo_circle_status(id) is not null);
drop policy if exists "circle create" on public.todo_circles;
create policy "circle create" on public.todo_circles for insert to authenticated
  with check (owner_id = auth.uid() and public.has_role(team_slug, 'viewer'));
drop policy if exists "circle edit" on public.todo_circles;
create policy "circle edit" on public.todo_circles for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "circle delete" on public.todo_circles;
create policy "circle delete" on public.todo_circles for delete to authenticated
  using (owner_id = auth.uid());

-- members: everyone in a circle (or invited to it) sees who else is
drop policy if exists "members read" on public.todo_circle_members;
create policy "members read" on public.todo_circle_members for select to authenticated
  using (user_id = auth.uid() or public.todo_circle_status(circle_id) is not null or public.todo_circle_owner(circle_id) = auth.uid());
-- the one who started a circle puts themself in as joined; a joined member invites teammates
drop policy if exists "members add" on public.todo_circle_members;
create policy "members add" on public.todo_circle_members for insert to authenticated
  with check (
    (user_id = auth.uid() and status = 'joined' and public.todo_circle_owner(circle_id) = auth.uid())
    or (status = 'invited' and invited_by = auth.uid() and user_id <> auth.uid()
        and public.todo_circle_status(circle_id) = 'joined'
        and public.todo_circle_teammate(circle_id, user_id))
  );
-- the invited person answers (invited -> joined)
drop policy if exists "members answer" on public.todo_circle_members;
create policy "members answer" on public.todo_circle_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'joined');
-- leave / decline yourself; whoever invited (or started the circle) can cancel an invite or remove someone
drop policy if exists "members remove" on public.todo_circle_members;
create policy "members remove" on public.todo_circle_members for delete to authenticated
  using (user_id = auth.uid() or invited_by = auth.uid() or public.todo_circle_owner(circle_id) = auth.uid());

-- shared ideas: joined members read and add; anyone in it can pin / edit; the author or the circle's starter deletes
drop policy if exists "ideas read" on public.todo_circle_ideas;
create policy "ideas read" on public.todo_circle_ideas for select to authenticated
  using (public.todo_circle_status(circle_id) = 'joined');
drop policy if exists "ideas add" on public.todo_circle_ideas;
create policy "ideas add" on public.todo_circle_ideas for insert to authenticated
  with check (author_id = auth.uid() and public.todo_circle_status(circle_id) = 'joined');
drop policy if exists "ideas edit" on public.todo_circle_ideas;
create policy "ideas edit" on public.todo_circle_ideas for update to authenticated
  using (public.todo_circle_status(circle_id) = 'joined') with check (public.todo_circle_status(circle_id) = 'joined');
drop policy if exists "ideas delete" on public.todo_circle_ideas;
create policy "ideas delete" on public.todo_circle_ideas for delete to authenticated
  using (public.todo_circle_status(circle_id) = 'joined' and (author_id = auth.uid() or public.todo_circle_owner(circle_id) = auth.uid()));

-- my_todos: people in the same circle can read (not change) each other's plan
drop policy if exists "shared to-dos read" on public.my_todos;
create policy "shared to-dos read" on public.my_todos for select to authenticated
  using (public.todo_shares_with(user_id, team_slug));

commit;
