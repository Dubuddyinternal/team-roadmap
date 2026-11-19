-- 25a: YouTube subscribers gained / lost per video, per day (YouTube Analytics, exact).
-- Filled by sync-social; the Analysis → Day by day table opens them when you click a day's Gain.
alter table public.social_post_daily add column if not exists subs_gained bigint;
alter table public.social_post_daily add column if not exists subs_lost bigint;
