-- =====================================================================
-- STAGE 20c — Thoughts warehouse (was Ideas warehouse) on Our To-do (my-todo.js)
--
-- WHAT THIS DOES, in plain words:
--   * The shared list gets two new kinds in the app: ⚖️ Contention and
--     🔁 Recurring issue (kind is free text already — nothing to change).
--   * todo_circle_ideas gets two columns so the shared list keeps them too:
--       again      when a recurring issue came up once more ("🔁 Again"):
--                  a list of times, e.g. ["2026-10-30T08:00:00Z", …]
--       solved_at  when a contention / recurring issue was marked ✔ Solved
--   * My To-do itself needs nothing new: every team member can already keep
--     their own row in my_todos (stage20a).
--
-- SAFETY: adds two columns with defaults. Deletes nothing.
-- Until it's run, the app keeps working; "Again" / "Solved" just stay on
-- the private list only.
-- Run after stage20b_our_todos.sql.
-- =====================================================================
alter table public.todo_circle_ideas add column if not exists again     jsonb not null default '[]'::jsonb;
alter table public.todo_circle_ideas add column if not exists solved_at timestamptz;
