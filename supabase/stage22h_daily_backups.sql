-- =====================================================================
-- STAGE 22h — a backup of the team's data every morning, kept 30 days
--
-- WHAT THIS DOES, in plain words:
--   * Every day at 09:00 India time a scheduled job copies, for each team:
--       data   every row of team_data (spaces, roadmaps, OKRs, Engineering,
--              bugs, org chart …) as { section: data }
--       todos  everyone's My To-do (my_todos) as { user_id: data }
--       ideas  the Our To-do circles' shared Thoughts warehouse
--     into public.team_data_backups — one row per team per day (running it
--     again the same day replaces that day's copy).
--   * Copies older than 30 days are removed.
--   * Nobody in the app can read or change the backups (no access for the
--     browser at all); they're restored by an owner / Claude with SQL, one
--     part at a time, e.g. just the spaces from a given morning.
--   * Runs one backup straight away at the end.
--
-- SAFETY: creates one table, one function and one scheduled job. It only
-- reads team_data / my_todos / todo_circle_ideas — never changes them.
-- Safe to run again.
-- =====================================================================

create table if not exists public.team_data_backups (
  id         bigserial primary key,
  team_slug  text not null,
  taken_on   date not null,                       -- the India-time day it was taken
  taken_at   timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb,  -- { section: data } from team_data
  todos      jsonb not null default '{}'::jsonb,  -- { user_id: data } from my_todos
  ideas      jsonb not null default '[]'::jsonb,  -- todo_circle_ideas rows of the team's circles
  sections   int not null default 0,
  size_bytes int not null default 0,
  unique (team_slug, taken_on)
);
alter table public.team_data_backups enable row level security;   -- no policies: the browser can't touch it
revoke all on public.team_data_backups from anon, authenticated;

create or replace function public.team_data_backup_run() returns int
language plpgsql security definer set search_path = '' as $$
declare
  day date := (now() at time zone 'Asia/Kolkata')::date;
  t record; n int := 0;
  d jsonb; td jsonb; ci jsonb; c int;
begin
  for t in select distinct team_slug from public.team_data loop
    select coalesce(jsonb_object_agg(x.section, x.data), '{}'::jsonb), count(*)
      into d, c from public.team_data x where x.team_slug = t.team_slug;
    select coalesce(jsonb_object_agg(m.user_id::text, m.data), '{}'::jsonb)
      into td from public.my_todos m where m.team_slug = t.team_slug;
    select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
      into ci from public.todo_circle_ideas i join public.todo_circles k on k.id = i.circle_id where k.team_slug = t.team_slug;
    insert into public.team_data_backups (team_slug, taken_on, taken_at, data, todos, ideas, sections, size_bytes)
    values (t.team_slug, day, now(), d, td, ci, c, length(d::text) + length(td::text) + length(ci::text))
    on conflict (team_slug, taken_on) do update
      set taken_at = now(), data = excluded.data, todos = excluded.todos, ideas = excluded.ideas,
          sections = excluded.sections, size_bytes = excluded.size_bytes;
    n := n + 1;
  end loop;
  delete from public.team_data_backups b where b.taken_on < day - 30;
  return n;
end $$;
revoke execute on function public.team_data_backup_run() from public, anon, authenticated;

-- every day at 09:00 India time (03:30 UTC)
select cron.schedule('team-data-backup', '30 3 * * *', 'select public.team_data_backup_run()');

-- the first backup, now
select public.team_data_backup_run();
