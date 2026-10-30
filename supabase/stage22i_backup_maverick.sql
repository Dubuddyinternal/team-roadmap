-- =====================================================================
-- STAGE 22i — the morning backup also keeps Maverick Admin
--
-- WHAT THIS DOES, in plain words:
--   * Maverick Admin's data isn't in team_data: it's in four tables of its
--     own (maverick_creators, maverick_submissions, maverick_payouts,
--     maverick_emails). The 09:00 backup (stage 22h) now copies all four
--     too, into a new column `maverick` of team_data_backups:
--       { creators: [...], submissions: [...], payouts: [...], emails: [...] }
--     — for each team that has a Maverick Admin space.
--   * Videos aren't stored in Supabase (only their Drive links), so these
--     rows are everything Maverick keeps.
--   * They hold creators' phone numbers and UPI IDs: like the rest of the
--     backups, nobody in the app can read them.
--   * Takes today's backup again straight away, now with Maverick in it.
--
-- SAFETY: adds one column and replaces the backup function. It only reads
-- the Maverick tables — never changes them. Safe to run again.
-- Run after stage22h_daily_backups.sql.
-- =====================================================================

alter table public.team_data_backups add column if not exists maverick jsonb not null default '{}'::jsonb;

create or replace function public.team_data_backup_run() returns int
language plpgsql security definer set search_path = '' as $$
declare
  day date := (now() at time zone 'Asia/Kolkata')::date;
  t record; n int := 0;
  d jsonb; td jsonb; ci jsonb; mv jsonb; c int;
begin
  for t in select distinct team_slug from public.team_data loop
    select coalesce(jsonb_object_agg(x.section, x.data), '{}'::jsonb), count(*)
      into d, c from public.team_data x where x.team_slug = t.team_slug;
    select coalesce(jsonb_object_agg(m.user_id::text, m.data), '{}'::jsonb)
      into td from public.my_todos m where m.team_slug = t.team_slug;
    select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
      into ci from public.todo_circle_ideas i join public.todo_circles k on k.id = i.circle_id where k.team_slug = t.team_slug;
    -- Maverick Admin: its own tables, for a team that has a Maverick space
    mv := '{}'::jsonb;
    if coalesce(jsonb_path_exists(d, '$.cspaces.list[*] ? (@.type == "maverick")'), false) then
      mv := jsonb_build_object(
        'creators',    (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) from public.maverick_creators r),
        'submissions', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) from public.maverick_submissions r),
        'payouts',     (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) from public.maverick_payouts r),
        'emails',      (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) from public.maverick_emails r));
    end if;
    insert into public.team_data_backups (team_slug, taken_on, taken_at, data, todos, ideas, maverick, sections, size_bytes)
    values (t.team_slug, day, now(), d, td, ci, mv, c, length(d::text) + length(td::text) + length(ci::text) + length(mv::text))
    on conflict (team_slug, taken_on) do update
      set taken_at = now(), data = excluded.data, todos = excluded.todos, ideas = excluded.ideas, maverick = excluded.maverick,
          sections = excluded.sections, size_bytes = excluded.size_bytes;
    n := n + 1;
  end loop;
  delete from public.team_data_backups b where b.taken_on < day - 30;
  return n;
end $$;
revoke execute on function public.team_data_backup_run() from public, anon, authenticated;

-- today's backup again, now with Maverick in it
select public.team_data_backup_run();
