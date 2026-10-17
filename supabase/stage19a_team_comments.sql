-- =====================================================================
-- STAGE 19a — 💬 Comments at the bottom of every tab and every card
--
-- One row per comment. `place` says where it sits:
--   "tab:<key>"   a tab of the app (e.g. tab:v=social|cs=<space>|sv=process)
--   "card:<key>"  a card or idea (e.g. card:card:c-123)
-- `nav` is the app's own "where am I" snapshot (the same one used to keep your
-- place on refresh), so a link in an email opens exactly that tab or card.
-- Replies point at the comment they answer (`parent_id`, one level).
-- `body` is the rich text as light markdown (richtext.js), `mentions` the
-- teammates tagged with @ (the comment-mail function emails them),
-- `files` the photos / videos attached (stored in Cloudflare R2:
-- [{ key, name, type, size }]).
--
-- Who can do what: anyone in the team reads and writes comments; you delete
-- (or edit) your own; owners/admins can delete anyone's.
-- =====================================================================
create table if not exists public.team_comments (
  id          uuid primary key default gen_random_uuid(),
  team_slug   text not null references public.teams(slug) on delete cascade on update cascade,
  place       text not null check (length(place) between 3 and 300),
  place_label text not null default '' check (length(place_label) <= 200),
  nav         jsonb not null default '{}'::jsonb,
  parent_id   uuid references public.team_comments(id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '' check (length(author_name) <= 120),
  body        text not null default '' check (length(body) <= 20000),
  mentions    uuid[] not null default '{}',
  files       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  mailed_at   timestamptz,   -- when the tagged people were emailed (once per comment)
  check (length(trim(body)) > 0 or jsonb_array_length(files) > 0)
);
create index if not exists team_comments_place_idx on public.team_comments (team_slug, place, created_at);
create index if not exists team_comments_parent_idx on public.team_comments (parent_id);

alter table public.team_comments enable row level security;

drop policy if exists "team reads comments" on public.team_comments;
create policy "team reads comments" on public.team_comments for select to authenticated
  using (public.has_role(team_slug, 'viewer'));

drop policy if exists "team writes comments" on public.team_comments;
create policy "team writes comments" on public.team_comments for insert to authenticated
  with check (public.has_role(team_slug, 'viewer') and author_id = auth.uid()
    -- a reply must answer a comment in the same place
    and (team_comments.parent_id is null or exists (select 1 from public.team_comments p
           where p.id = team_comments.parent_id and p.team_slug = team_comments.team_slug and p.place = team_comments.place and p.parent_id is null)));

drop policy if exists "edit own comment" on public.team_comments;
create policy "edit own comment" on public.team_comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
-- mailed_at is the server's: the browser can't clear it to send the emails again
revoke update on public.team_comments from authenticated;

drop policy if exists "delete own or admin" on public.team_comments;
create policy "delete own or admin" on public.team_comments for delete to authenticated
  using (author_id = auth.uid() or public.has_role(team_slug, 'admin'));

grant select, insert, delete on public.team_comments to authenticated;
grant update (body, mentions, files, edited_at) on public.team_comments to authenticated;
