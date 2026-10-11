-- =====================================================================
-- STAGE 17a: Claude pipeline jobs (edit → check → render → SEO → post)
--
-- WHAT THIS DOES, in plain words:
--   * Creates ONE new table, edit_jobs: one row per Content Process card
--     that was sent to Claude. The row holds the job's status, the brief,
--     the SEO suggestions and the post links (a few KB; the videos
--     themselves live in Cloudflare R2, not here).
--   * Security: members of the team can READ their team's jobs. Nobody
--     can write from the browser. Only the website's pipeline functions
--     (api/pipeline/*, with the server key) write, after checking roles.
--
-- WHAT THIS DOES NOT DO: it deletes nothing and changes nothing that
-- exists. There is no DROP, DELETE or TRUNCATE in this file.
--
-- HOW TO RUN: SQL Editor -> New query -> paste -> Run.
-- Expected: "Success. No rows returned".
-- =====================================================================

create table public.edit_jobs (
  team_slug  text not null references public.teams(slug) on delete cascade on update cascade,
  card_id    text not null check (card_id ~ '^[A-Za-z0-9_-]{1,60}$'),
  status     text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (team_slug, card_id)
);

alter table public.edit_jobs enable row level security;
revoke all on public.edit_jobs from anon, authenticated;
grant select on public.edit_jobs to authenticated;

create policy "members read their team's edit jobs" on public.edit_jobs
  for select to authenticated using (public.has_role(team_slug, 'viewer'));
