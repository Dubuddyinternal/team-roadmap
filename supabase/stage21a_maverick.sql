-- =====================================================================
-- STAGE 21a — Maverick: creator videos, review, day-30 bonus, payouts
--
-- WHAT THIS DOES
-- Maverick (creators.dubuddy.in, a separate Next.js app) pays students for
-- short videos about DuBuddy. Creators sign in there with phone OTP; the
-- team reviews and pays from the Maverick space on this site. Both apps
-- use this database.
--   1. mav_config     — every rupee, day and cap (the prototype's CFG).
--   2. mav_creators   — one row per creator, with their MAV### code.
--   3. mav_videos     — submissions and their review status.
--   4. mav_video_notes, mav_appeals — "needs info" threads and appeals.
--   5. mav_claims     — day-30 view bonus claims.
--   6. mav_payouts    — base, bonus and referral money, with UTR.
--   7. mav_referrals, mav_events — referrals and analytics.
-- New permissions: maverick_review, maverick_pay, maverick_settings.
--
-- SAFETY
-- Creators are auth users with NO profile and NO membership, so every
-- existing team table stays hidden from them. They read only their own
-- mav_* rows; every write is a security-definer function below.
--
-- HOW TO RUN
-- Paste into the Supabase SQL Editor after stage20a. Safe to run again.
-- =====================================================================

create or replace function public.all_perms() returns text[]
language sql immutable set search_path = '' as $$
  select array['view','comment','edit','delete','spaces','okr_structure','module_vision',
               'request_members','approve_requests','manage_people','create_games','edit_targets','edit_utm',
               'send_notifications','manage_learning','add_spaces','delete_spaces','add_roadmaps','delete_roadmaps',
               'review_student_ideas','manage_hr','view_hr','manage_policies','hr_settings','accounts',
               'maverick_review','maverick_pay','maverick_settings']
$$;
update public.team_roles set perms = public.all_perms() where key = 'owner';

create or replace function public.mav_can(p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$ select public.hr_perm_any(p_perm) $$;

-- ---------- config ----------
create table if not exists public.mav_config (
  id         int primary key default 1 check (id = 1),
  cfg        jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.mav_config (id, cfg) values (1, '{
  "currency":"₹","base":50,"basePayDays":7,"reviewHours":48,"measureDay":30,"remindDay":28,"bonusPayDays":10,
  "slabs":[{"min":1000,"max":5000,"bonus":50,"label":"1K–5K"},{"min":5000,"max":20000,"bonus":150,"label":"5K–20K"},
           {"min":20000,"max":50000,"bonus":400,"label":"20K–50K"},{"min":50000,"max":null,"bonus":1000,"label":"50K+"}],
  "capPerDay":1,"capPerWeek":5,"maxResubmits":1,"referCreator":100,"referAppUser":20,"level2At":10,"dormantDays":14,
  "panLimit":15000,"appealDays":3,"supportHours":24,"pyqYears":"2022 to 2026",
  "placeholders":["slabs","referCreator","referAppUser","panLimit","level2At","dormantDays","appealDays","supportHours","basePayDays","bonusPayDays"]
}'::jsonb) on conflict (id) do nothing;

create or replace function public.mav_cfg_num(p_key text) returns numeric
language sql stable security definer set search_path = '' as $$
  select (cfg->>p_key)::numeric from public.mav_config where id = 1
$$;

-- ---------- creators ----------
create sequence if not exists public.mav_code_seq start 101;
create table if not exists public.mav_creators (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  name               text not null check (length(trim(name)) between 2 and 80),
  handle             text not null check (length(trim(handle)) between 2 and 80),
  class_or_college   text not null default '' check (length(class_or_college) <= 120),
  dob                date not null,
  code               text not null unique,
  upi                text not null default '' check (length(upi) <= 100),
  pan                text not null default '' check (pan = '' or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  guardian_name      text not null default '' check (length(guardian_name) <= 80),
  guardian_phone     text not null default '' check (length(guardian_phone) <= 20),
  guardian_consent_at timestamptz,
  referred_by        text references public.mav_creators(code) on delete set null,
  flagged            boolean not null default false,
  flag_note          text not null default '' check (length(flag_note) <= 500),
  created_at         timestamptz not null default now()
);

-- ---------- videos ----------
create table if not exists public.mav_videos (
  id           bigint generated always as identity (start with 801) primary key,
  creator_id   uuid not null references public.mav_creators(user_id) on delete cascade,
  url          text not null check (length(url) <= 500),
  url_norm     text not null unique,                       -- one submission per post, ever
  platform     text not null check (platform in ('instagram', 'youtube')),
  kind         text not null default '' check (length(kind) <= 40),
  title        text not null default '' check (length(title) <= 160),
  caption      text not null default '' check (length(caption) <= 2200),
  status       text not null default 'in_review' check (status in ('in_review', 'needs_info', 'approved', 'rejected', 'paid')),
  reason_code  text check (reason_code is null or length(reason_code) <= 40),
  reason_text  text check (reason_text is null or length(reason_text) <= 500),
  fix_text     text check (fix_text is null or length(fix_text) <= 500),
  resubmit_of  bigint references public.mav_videos(id) on delete set null,
  posted_at    date,
  submitted_at timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references auth.users(id) on delete set null
);
create index if not exists mav_videos_status on public.mav_videos (status, submitted_at);
create index if not exists mav_videos_creator on public.mav_videos (creator_id, submitted_at desc);

create table if not exists public.mav_video_notes (
  id         bigint generated always as identity primary key,
  video_id   bigint not null references public.mav_videos(id) on delete cascade,
  author     uuid references auth.users(id) on delete set null,
  from_staff boolean not null,
  body       text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.mav_appeals (
  id         bigint generated always as identity primary key,
  video_id   bigint not null unique references public.mav_videos(id) on delete cascade,
  reason     text not null check (length(trim(reason)) between 5 and 1000),
  status     text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- day-30 claims ----------
create table if not exists public.mav_claims (
  id              bigint generated always as identity primary key,
  video_id        bigint not null unique references public.mav_videos(id) on delete cascade,
  views           int check (views is null or views >= 0),
  source          text check (source is null or source in ('api', 'screenshot', 'manual')),
  screenshot_path text,
  slab_index      int,
  bonus           numeric(12,2) not null default 0,
  status          text not null default 'needs_review'
                  check (status in ('needs_review', 'approved', 'below_slab', 'went_private')),
  decided_by      uuid references auth.users(id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- ---------- referrals ----------
create table if not exists public.mav_referrals (
  id           bigint generated always as identity primary key,
  referrer_id  uuid not null references public.mav_creators(user_id) on delete cascade,
  kind         text not null check (kind in ('creator', 'app_user')),
  referred_ref text not null check (length(referred_ref) <= 120),  -- creator user_id or app user id
  status       text not null default 'pending' check (status in ('pending', 'earned', 'void')),
  created_at   timestamptz not null default now(),
  unique (kind, referred_ref)
);

-- ---------- payouts ----------
create table if not exists public.mav_payouts (
  id          bigint generated always as identity primary key,
  creator_id  uuid not null references public.mav_creators(user_id) on delete cascade,
  kind        text not null check (kind in ('base', 'bonus', 'referral')),
  amount      numeric(12,2) not null check (amount > 0),
  video_id    bigint references public.mav_videos(id) on delete set null,
  referral_id bigint references public.mav_referrals(id) on delete set null,
  status      text not null default 'queued' check (status in ('queued', 'paid', 'failed')),
  utr         text check (utr is null or length(utr) <= 60),
  fail_reason text check (fail_reason is null or length(fail_reason) <= 300),
  paid_at     date,
  paid_by     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (kind, video_id),
  unique (referral_id)
);
create index if not exists mav_payouts_status on public.mav_payouts (status, created_at);

-- ---------- analytics ----------
create table if not exists public.mav_events (
  id         bigint generated always as identity primary key,
  name       text not null check (length(name) <= 60),
  creator_id uuid references public.mav_creators(user_id) on delete set null,
  props      jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now()
);
create index if not exists mav_events_name on public.mav_events (name, at);

-- ---------- row level security: read own, or as staff ----------
alter table public.mav_config      enable row level security;
alter table public.mav_creators    enable row level security;
alter table public.mav_videos      enable row level security;
alter table public.mav_video_notes enable row level security;
alter table public.mav_appeals     enable row level security;
alter table public.mav_claims      enable row level security;
alter table public.mav_referrals   enable row level security;
alter table public.mav_payouts     enable row level security;
alter table public.mav_events      enable row level security;

revoke all on public.mav_config, public.mav_creators, public.mav_videos, public.mav_video_notes, public.mav_appeals,
              public.mav_claims, public.mav_referrals, public.mav_payouts, public.mav_events from anon, authenticated;
grant select on public.mav_creators, public.mav_videos, public.mav_video_notes, public.mav_appeals,
                public.mav_claims, public.mav_referrals, public.mav_payouts, public.mav_events to authenticated;
-- the public site shows the numbers before sign-in
grant select on public.mav_config to anon, authenticated;

drop policy if exists "anyone reads config" on public.mav_config;
create policy "anyone reads config" on public.mav_config for select to anon, authenticated using (true);
drop policy if exists "own or staff" on public.mav_creators;
create policy "own or staff" on public.mav_creators for select to authenticated
  using (user_id = auth.uid() or public.mav_can('maverick_review') or public.mav_can('maverick_pay'));
drop policy if exists "own or staff" on public.mav_videos;
create policy "own or staff" on public.mav_videos for select to authenticated
  using (creator_id = auth.uid() or public.mav_can('maverick_review') or public.mav_can('maverick_pay'));
drop policy if exists "own or staff" on public.mav_video_notes;
create policy "own or staff" on public.mav_video_notes for select to authenticated
  using (public.mav_can('maverick_review')
         or exists (select 1 from public.mav_videos v where v.id = video_id and v.creator_id = auth.uid()));
drop policy if exists "own or staff" on public.mav_appeals;
create policy "own or staff" on public.mav_appeals for select to authenticated
  using (public.mav_can('maverick_review')
         or exists (select 1 from public.mav_videos v where v.id = video_id and v.creator_id = auth.uid()));
drop policy if exists "own or staff" on public.mav_claims;
create policy "own or staff" on public.mav_claims for select to authenticated
  using (public.mav_can('maverick_review') or public.mav_can('maverick_pay')
         or exists (select 1 from public.mav_videos v where v.id = video_id and v.creator_id = auth.uid()));
drop policy if exists "own or staff" on public.mav_referrals;
create policy "own or staff" on public.mav_referrals for select to authenticated
  using (referrer_id = auth.uid() or public.mav_can('maverick_pay'));
drop policy if exists "own or staff" on public.mav_payouts;
create policy "own or staff" on public.mav_payouts for select to authenticated
  using (creator_id = auth.uid() or public.mav_can('maverick_pay'));
drop policy if exists "staff" on public.mav_events;
create policy "staff" on public.mav_events for select to authenticated
  using (public.mav_can('maverick_review') or public.mav_can('maverick_pay') or public.mav_can('maverick_settings'));

-- insight screenshots for day-30 claims (private, a folder per creator)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mav-proofs', 'mav-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "mav-proofs upload own" on storage.objects;
create policy "mav-proofs upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'mav-proofs' and (storage.foldername(name))[1] = auth.uid()::text
              and exists (select 1 from public.mav_creators c where c.user_id = auth.uid()));
drop policy if exists "mav-proofs read own or staff" on storage.objects;
create policy "mav-proofs read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'mav-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.mav_can('maverick_review')));

-- ---------- creator functions ----------
-- strips tracking bits so the same post can't be submitted twice
create or replace function public.mav_norm_url(p_url text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(regexp_replace(split_part(split_part(trim(p_url), '?', 1), '#', 1),
         '^https?://(www\.|m\.)?', ''), '/+$', ''))
$$;

create or replace function public.mav_log(p_name text, p_creator uuid, p_props jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.mav_events (name, creator_id, props) values (p_name, p_creator, coalesce(p_props, '{}'::jsonb))
$$;

create or replace function public.mav_register(p jsonb)
returns public.mav_creators language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.mav_creators; d date; ref text := upper(nullif(trim(p->>'referred_by'), ''));
begin
  if me is null then raise exception 'Please sign in.'; end if;
  select * into r from public.mav_creators where user_id = me;
  if found then return r; end if;
  begin d := (p->>'dob')::date; exception when others then raise exception 'Enter your date of birth.'; end;
  if d is null or d > current_date - interval '13 years' then raise exception 'You need to be 13 or older to join.'; end if;
  if ref is not null and not exists (select 1 from public.mav_creators c where c.code = ref) then ref := null; end if;
  insert into public.mav_creators (user_id, name, handle, class_or_college, dob, code, referred_by)
  values (me, trim(p->>'name'), trim(p->>'handle'), coalesce(trim(p->>'class_or_college'), ''), d,
          'MAV' || nextval('public.mav_code_seq'), ref)
  returning * into r;
  if ref is not null then
    insert into public.mav_referrals (referrer_id, kind, referred_ref)
    select c.user_id, 'creator', me::text from public.mav_creators c where c.code = ref
    on conflict do nothing;
  end if;
  perform public.mav_log('signup_completed', me, jsonb_build_object('referred_by', ref));
  return r;
end $$;

create or replace function public.mav_set_payout_details(p_upi text, p_pan text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.mav_creators where user_id = auth.uid()) then raise exception 'Please sign up first.'; end if;
  if p_upi is not null and p_upi !~ '^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$' then raise exception 'That UPI ID doesn''t look right.'; end if;
  update public.mav_creators
     set upi = coalesce(trim(p_upi), upi),
         pan = coalesce(upper(nullif(trim(p_pan), '')), pan)
   where user_id = auth.uid();
  -- failed payouts go back in the queue for the next run
  if p_upi is not null then
    update public.mav_payouts set status = 'queued', fail_reason = null where creator_id = auth.uid() and status = 'failed';
  end if;
end $$;

create or replace function public.mav_guardian_consent(p_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 10 then
    raise exception 'Add your guardian''s name and phone number.';
  end if;
  update public.mav_creators set guardian_name = trim(p_name), guardian_phone = trim(p_phone), guardian_consent_at = now()
   where user_id = auth.uid();
end $$;

create or replace function public.mav_submit_video(p jsonb)
returns public.mav_videos language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.mav_creators; v public.mav_videos; n text; prev public.mav_videos;
        today_ist date := (now() at time zone 'Asia/Kolkata')::date; used_day int; used_week int; resub int;
begin
  select * into c from public.mav_creators where user_id = me;
  if not found then raise exception 'Please sign up first.'; end if;
  if c.flagged then raise exception 'Your account is under review. Write to creators@dubuddy.in.'; end if;
  if coalesce(p->>'platform', '') not in ('instagram', 'youtube') then raise exception 'Pick Instagram or YouTube.'; end if;
  n := public.mav_norm_url(p->>'url');
  if n !~ '^(instagram\.com/(reel|p)/|youtube\.com/shorts/|youtu\.be/|youtube\.com/watch)' then
    raise exception 'Paste the public link to your reel or short.';
  end if;
  if position(upper(c.code) in upper(coalesce(p->>'caption', ''))) = 0 then
    raise exception 'Add your code % to the caption, then try again.', c.code;
  end if;
  if exists (select 1 from public.mav_videos where url_norm = n) then raise exception 'This video was already submitted.'; end if;

  -- resubmitting a rejected video: max per rejected link from config
  if (p->>'resubmit_of') is not null then
    select * into prev from public.mav_videos where id = (p->>'resubmit_of')::bigint and creator_id = me and status = 'rejected';
    if not found then raise exception 'Only a rejected video can be resubmitted.'; end if;
    with recursive chain as (select id, resubmit_of from public.mav_videos where id = prev.id
                             union all select m.id, m.resubmit_of from public.mav_videos m join chain on m.id = chain.resubmit_of)
    select count(*) - 1 into resub from chain;
    if resub >= public.mav_cfg_num('maxResubmits') then raise exception 'You''ve used your resubmission for this video.'; end if;
  end if;

  select count(*) filter (where (submitted_at at time zone 'Asia/Kolkata')::date = today_ist),
         count(*) filter (where (submitted_at at time zone 'Asia/Kolkata')::date > today_ist - 7)
    into used_day, used_week
    from public.mav_videos where creator_id = me and status <> 'rejected';
  if used_day >= public.mav_cfg_num('capPerDay') then raise exception 'That''s today''s limit. Submit this one tomorrow.'; end if;
  if used_week >= public.mav_cfg_num('capPerWeek') then raise exception 'You''ve hit this week''s limit.'; end if;

  insert into public.mav_videos (creator_id, url, url_norm, platform, kind, title, caption, resubmit_of, posted_at)
  values (me, trim(p->>'url'), n, p->>'platform', coalesce(p->>'kind', ''), coalesce(trim(p->>'title'), ''),
          coalesce(p->>'caption', ''), prev.id, nullif(p->>'posted_at', '')::date)
  returning * into v;
  if nullif(trim(p->>'upi'), '') is not null then perform public.mav_set_payout_details(p->>'upi', null); end if;
  perform public.mav_log('video_submitted', me, jsonb_build_object('video', v.id,
          'first', not exists (select 1 from public.mav_videos where creator_id = me and id <> v.id)));
  return v;
end $$;

create or replace function public.mav_reply_note(p_video bigint, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.mav_videos where id = p_video and creator_id = auth.uid() and status = 'needs_info') then
    raise exception 'This video isn''t waiting on you.';
  end if;
  insert into public.mav_video_notes (video_id, author, from_staff, body) values (p_video, auth.uid(), false, trim(p_body));
  update public.mav_videos set status = 'in_review' where id = p_video;
end $$;

create or replace function public.mav_appeal(p_video bigint, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.mav_videos where id = p_video and creator_id = auth.uid() and status = 'rejected') then
    raise exception 'Only a rejected video can be appealed.';
  end if;
  insert into public.mav_appeals (video_id, reason) values (p_video, trim(p_reason));
exception when unique_violation then raise exception 'You''ve already appealed this one.';
end $$;

-- day-30: the app reads the view count (YouTube API) server-side and passes it in;
-- otherwise the creator uploads a screenshot and a reviewer reads it.
create or replace function public.mav_claim(p_video bigint, p_screenshot text default null)
returns public.mav_claims language plpgsql security definer set search_path = '' as $$
declare v public.mav_videos; r public.mav_claims;
begin
  select * into v from public.mav_videos where id = p_video and creator_id = auth.uid() and status in ('approved', 'paid');
  if not found then raise exception 'Only an approved video can claim a bonus.'; end if;
  if coalesce(v.posted_at, v.submitted_at::date) + public.mav_cfg_num('measureDay')::int > current_date then
    raise exception 'Not day % yet.', public.mav_cfg_num('measureDay');
  end if;
  if p_screenshot is not null and p_screenshot not like auth.uid()::text || '/%' then raise exception 'Upload the screenshot again.'; end if;
  insert into public.mav_claims (video_id, source, screenshot_path)
  values (p_video, case when p_screenshot is null then null else 'screenshot' end, p_screenshot)
  returning * into r;
  perform public.mav_log('bonus_claimed', auth.uid(), jsonb_build_object('video', p_video));
  return r;
exception when unique_violation then raise exception 'Already claimed.';
end $$;

-- ---------- staff functions ----------
create or replace function public.mav_decide(p_video bigint, p_action text, p_reason_code text default null,
                                             p_reason text default null, p_fix text default null)
returns public.mav_videos language plpgsql security definer set search_path = '' as $$
declare v public.mav_videos; ref public.mav_referrals;
begin
  if not public.mav_can('maverick_review') then raise exception 'You don''t have permission to review Maverick videos.'; end if;
  select * into v from public.mav_videos where id = p_video for update;
  if not found then raise exception 'Video not found.'; end if;
  if v.status not in ('in_review', 'needs_info') and not (v.status = 'rejected' and p_action = 'approve'
     and exists (select 1 from public.mav_appeals a where a.video_id = v.id and a.status = 'open')) then
    raise exception 'This video was already decided.';
  end if;

  if p_action = 'approve' then
    update public.mav_videos set status = 'approved', reason_code = null, reason_text = null, fix_text = null,
           decided_at = now(), decided_by = auth.uid() where id = p_video returning * into v;
    insert into public.mav_payouts (creator_id, kind, amount, video_id)
    values (v.creator_id, 'base', public.mav_cfg_num('base'), v.id) on conflict do nothing;
    -- referral: paid when the referred creator's first video is approved
    update public.mav_referrals set status = 'earned'
     where kind = 'creator' and referred_ref = v.creator_id::text and status = 'pending' returning * into ref;
    if ref.id is not null then
      insert into public.mav_payouts (creator_id, kind, amount, referral_id)
      values (ref.referrer_id, 'referral', public.mav_cfg_num('referCreator'), ref.id) on conflict do nothing;
    end if;
    update public.mav_appeals set status = 'overturned', decided_by = auth.uid(), decided_at = now()
     where video_id = v.id and status = 'open';
  elsif p_action = 'reject' then
    if coalesce(trim(p_reason), '') = '' then raise exception 'Give the creator one reason.'; end if;
    update public.mav_videos set status = 'rejected', reason_code = p_reason_code, reason_text = trim(p_reason),
           fix_text = nullif(trim(coalesce(p_fix, '')), ''), decided_at = now(), decided_by = auth.uid()
     where id = p_video returning * into v;
  elsif p_action = 'needs_info' then
    if coalesce(trim(p_reason), '') = '' then raise exception 'Write the question for the creator.'; end if;
    update public.mav_videos set status = 'needs_info' where id = p_video returning * into v;
    insert into public.mav_video_notes (video_id, author, from_staff, body) values (p_video, auth.uid(), true, trim(p_reason));
  else
    raise exception 'Unknown action.';
  end if;
  perform public.mav_log('review_decided', v.creator_id,
          jsonb_build_object('video', v.id, 'action', p_action, 'reason', p_reason_code,
                             'hours', round(extract(epoch from now() - v.submitted_at) / 3600)));
  return v;
end $$;

create or replace function public.mav_appeal_uphold(p_video bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.mav_can('maverick_review') then raise exception 'You don''t have permission.'; end if;
  update public.mav_appeals set status = 'upheld', decided_by = auth.uid(), decided_at = now()
   where video_id = p_video and status = 'open';
end $$;

create or replace function public.mav_claim_decide(p_claim bigint, p_views int, p_went_private boolean default false)
returns public.mav_claims language plpgsql security definer set search_path = '' as $$
declare r public.mav_claims; v public.mav_videos; s jsonb; i int := -1; b numeric := 0; k int := 0;
begin
  if not public.mav_can('maverick_review') then raise exception 'You don''t have permission.'; end if;
  select * into r from public.mav_claims where id = p_claim for update;
  if not found or r.status <> 'needs_review' then raise exception 'This claim was already decided.'; end if;
  select * into v from public.mav_videos where id = r.video_id;
  if p_went_private then
    update public.mav_claims set status = 'went_private', decided_by = auth.uid(), decided_at = now()
     where id = p_claim returning * into r;
    update public.mav_creators set flagged = true, flag_note = 'Video ' || v.id || ' went private before day 30'
     where user_id = v.creator_id;
    return r;
  end if;
  for s in select value from jsonb_array_elements((select cfg->'slabs' from public.mav_config where id = 1)) loop
    if p_views >= (s->>'min')::int and (s->'max' = 'null'::jsonb or p_views < (s->>'max')::int) then
      i := k; b := (s->>'bonus')::numeric;
    end if;
    k := k + 1;
  end loop;
  update public.mav_claims set views = p_views, source = coalesce(source, 'manual'), slab_index = nullif(i, -1), bonus = b,
         status = case when i < 0 then 'below_slab' else 'approved' end, decided_by = auth.uid(), decided_at = now()
   where id = p_claim returning * into r;
  if b > 0 then
    insert into public.mav_payouts (creator_id, kind, amount, video_id) values (v.creator_id, 'bonus', b, v.id)
    on conflict do nothing;
  end if;
  return r;
end $$;

-- rows for the bank's bulk-payment file; blocks under-18 without consent and
-- anyone over the PAN limit this financial year without a PAN
create or replace function public.mav_payout_rows()
returns table (payout_id bigint, creator_id uuid, name text, code text, upi text, kind text, amount numeric, blocked text)
language plpgsql stable security definer set search_path = '' as $$
declare fy_start date := make_date(extract(year from current_date - interval '3 months')::int, 4, 1);
begin
  if not public.mav_can('maverick_pay') then raise exception 'You don''t have permission.'; end if;
  return query
  select p.id, c.user_id, c.name, c.code, c.upi, p.kind, p.amount,
         case when c.upi = '' then 'No UPI ID'
              when c.dob > current_date - interval '18 years' and c.guardian_consent_at is null then 'Guardian consent needed'
              when c.pan = '' and (select coalesce(sum(x.amount), 0) from public.mav_payouts x
                                    where x.creator_id = c.user_id and x.status <> 'failed'
                                      and x.created_at >= fy_start) > public.mav_cfg_num('panLimit') then 'PAN needed'
              when c.flagged then 'Account flagged'
         end
    from public.mav_payouts p join public.mav_creators c on c.user_id = p.creator_id
   where p.status = 'queued'
   order by p.created_at;
end $$;

create or replace function public.mav_payout_mark(p_ids bigint[], p_status text, p_utr text default null, p_reason text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.mav_can('maverick_pay') then raise exception 'You don''t have permission.'; end if;
  if p_status = 'paid' and coalesce(trim(p_utr), '') = '' then raise exception 'Add the UTR from the bank.'; end if;
  if p_status = 'failed' and coalesce(trim(p_reason), '') = '' then raise exception 'Say why it failed.'; end if;
  if p_status not in ('paid', 'failed') then raise exception 'Mark as paid or failed.'; end if;
  update public.mav_payouts
     set status = p_status, utr = case when p_status = 'paid' then trim(p_utr) end,
         fail_reason = case when p_status = 'failed' then trim(p_reason) end,
         paid_at = case when p_status = 'paid' then current_date end, paid_by = auth.uid()
   where id = any(p_ids) and status = 'queued';
  get diagnostics n = row_count;
  -- a video is 'paid' once its base is paid
  update public.mav_videos v set status = 'paid'
   where p_status = 'paid' and v.status = 'approved'
     and exists (select 1 from public.mav_payouts p where p.video_id = v.id and p.kind = 'base' and p.id = any(p_ids));
  perform public.mav_log(case when p_status = 'paid' then 'payout_succeeded' else 'payout_failed' end, null,
                         jsonb_build_object('count', n));
  return n;
end $$;

create or replace function public.mav_flag_creator(p_user uuid, p_flagged boolean, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.mav_can('maverick_review') then raise exception 'You don''t have permission.'; end if;
  update public.mav_creators set flagged = p_flagged, flag_note = coalesce(p_note, '') where user_id = p_user;
end $$;

create or replace function public.mav_set_config(p_cfg jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.mav_can('maverick_settings') then raise exception 'You don''t have permission to change Maverick settings.'; end if;
  if jsonb_typeof(p_cfg->'slabs') <> 'array' or (p_cfg->>'base')::numeric is null then raise exception 'Settings are incomplete.'; end if;
  update public.mav_config set cfg = p_cfg, updated_at = now(), updated_by = auth.uid() where id = 1;
end $$;

-- ---------- execute grants ----------
revoke execute on function public.mav_can(text), public.mav_cfg_num(text), public.mav_log(text, uuid, jsonb),
  public.mav_register(jsonb), public.mav_set_payout_details(text, text), public.mav_guardian_consent(text, text),
  public.mav_submit_video(jsonb), public.mav_reply_note(bigint, text), public.mav_appeal(bigint, text),
  public.mav_claim(bigint, text), public.mav_decide(bigint, text, text, text, text), public.mav_appeal_uphold(bigint),
  public.mav_claim_decide(bigint, int, boolean), public.mav_payout_rows(), public.mav_payout_mark(bigint[], text, text, text),
  public.mav_flag_creator(uuid, boolean, text), public.mav_set_config(jsonb)
  from public, anon;
grant execute on function public.mav_can(text), public.mav_cfg_num(text),
  public.mav_register(jsonb), public.mav_set_payout_details(text, text), public.mav_guardian_consent(text, text),
  public.mav_submit_video(jsonb), public.mav_reply_note(bigint, text), public.mav_appeal(bigint, text),
  public.mav_claim(bigint, text), public.mav_decide(bigint, text, text, text, text), public.mav_appeal_uphold(bigint),
  public.mav_claim_decide(bigint, int, boolean), public.mav_payout_rows(), public.mav_payout_mark(bigint[], text, text, text),
  public.mav_flag_creator(uuid, boolean, text), public.mav_set_config(jsonb)
  to authenticated;
