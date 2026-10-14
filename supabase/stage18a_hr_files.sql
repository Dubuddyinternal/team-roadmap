-- =====================================================================
-- STAGE 18a — HR files: details, documents and the work contract
--
-- 1. Every teammate fills in their HR file in the app (account menu →
--    🗂️ My HR file, also linked from 👤 My profile): personal details,
--    family, emergency contacts, address, ID and bank details, education and
--    past work. They upload proofs (Aadhaar, PAN, photo, bank proof…), tick
--    the consent box and submit.
-- 2. HR (super-admins, and roles with the new "Manage HR files" permission)
--    sees everyone in Administration → 🗂️ Employees (HR): who has finished,
--    what is missing, every document. HR approves or rejects documents,
--    sends a file back with a note, fills in the job terms and emails the
--    work contract (the hr-mail Edge Function sends it).
-- 3. The person signs the contract, uploads the signed copy, and HR marks
--    the file complete.
--
-- PRIVACY: none of this is in public.profiles (every teammate can read that
-- table). The rows below and the files in the private "hr-docs" bucket can
-- only be read by the person and by HR for people in their teams. Every
-- write goes through the functions below (security definer), except
-- uploading your own documents.
--
-- RUN: paste this whole file into Supabase → SQL editor → Run.
-- SAFETY: only adds things. Deletes nothing.
-- =====================================================================

-- ---------- 1. a new permission: "Manage HR files" ----------
create or replace function public.all_perms() returns text[]
language sql immutable set search_path = '' as $$
  select array['view','comment','edit','delete','spaces','okr_structure','module_vision',
               'request_members','approve_requests','manage_people','create_games','edit_targets','edit_utm',
               'send_notifications','manage_learning','add_spaces','delete_spaces','add_roadmaps','delete_roadmaps',
               'review_student_ideas','manage_hr']
$$;
update public.team_roles set perms = public.all_perms() where key = 'owner';

-- can the signed-in person act as HR for this person?
create or replace function public.hr_can_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (public.is_super() or exists (
    select 1 from public.memberships m
     where m.user_id = p_user and public.has_perm(m.team_slug, 'manage_hr')))
$$;
-- is the signed-in person HR anywhere?
create or replace function public.hr_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (public.is_super() or exists (
    select 1 from public.memberships m
     where m.user_id = auth.uid() and public.has_perm(m.team_slug, 'manage_hr')))
$$;

-- ---------- 2. company details + the contract template ----------
create table if not exists public.hr_settings (
  id                int primary key default 1 check (id = 1),
  company           jsonb not null default '{}'::jsonb,   -- name, address, city, signatory, signatory_title, email
  contract_template text not null default '' check (length(contract_template) <= 60000),
  updated_at        timestamptz not null default now(),
  updated_by        uuid default auth.uid() references auth.users(id) on delete set null
);
alter table public.hr_settings enable row level security;
drop policy if exists "hr reads settings" on public.hr_settings;
create policy "hr reads settings" on public.hr_settings for select using (public.hr_is_admin());
insert into public.hr_settings (id, company) values (1, jsonb_build_object(
  'name', 'Cyberflow Tech Pvt Ltd', 'address', '', 'city', '', 'signatory', 'Sumit', 'signatory_title', 'Director', 'email', ''))
on conflict (id) do nothing;

-- ---------- 3. one HR file per person ----------
create table if not exists public.hr_records (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  details          jsonb not null default '{}'::jsonb check (length(details::text) <= 30000),  -- filled in by the person
  job              jsonb not null default '{}'::jsonb check (length(job::text) <= 8000),      -- filled in by HR
  status           text not null default 'draft'
                   check (status in ('draft', 'submitted', 'changes', 'contract_sent', 'signed', 'complete')),
  consent_at       timestamptz,
  submitted_at     timestamptz,
  hr_note          text check (length(hr_note) <= 2000),
  contract_html    text check (length(contract_html) <= 200000),
  contract_sent_at timestamptz,
  signed_at        timestamptz,
  completed_at     timestamptz,
  completed_by     uuid references auth.users(id) on delete set null,
  updated_at       timestamptz not null default now()
);
alter table public.hr_records enable row level security;
drop policy if exists "read own or as hr" on public.hr_records;
create policy "read own or as hr" on public.hr_records
  for select using (user_id = auth.uid() or public.hr_can_admin(user_id));

-- ---------- 4. documents (the files live in the private hr-docs bucket) ----------
create table if not exists public.hr_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('photo', 'aadhaar', 'pan', 'address', 'bank', 'education', 'experience', 'contract', 'other')),
  path        text not null unique,
  file_name   text not null check (length(file_name) between 1 and 200),
  mime        text check (length(mime) <= 100),
  size        int check (size between 0 and 10485760),
  status      text not null default 'uploaded' check (status in ('uploaded', 'approved', 'rejected')),
  note        text check (length(note) <= 500),
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);
create index if not exists hr_documents_user on public.hr_documents (user_id, kind);
alter table public.hr_documents enable row level security;
drop policy if exists "read own docs or as hr" on public.hr_documents;
create policy "read own docs or as hr" on public.hr_documents
  for select using (user_id = auth.uid() or public.hr_can_admin(user_id));
drop policy if exists "add own docs" on public.hr_documents;
create policy "add own docs" on public.hr_documents
  for insert to authenticated with check (
    user_id = auth.uid() and status = 'uploaded' and reviewed_by is null
    and path like auth.uid()::text || '/%'
    and coalesce((select r.status from public.hr_records r where r.user_id = auth.uid()), 'draft') <> 'complete');
drop policy if exists "remove own docs unless approved" on public.hr_documents;
create policy "remove own docs unless approved" on public.hr_documents
  for delete to authenticated using (user_id = auth.uid() and status <> 'approved');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-docs', 'hr-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- files sit at  <user id>/<random>-<name>
drop policy if exists "hr-docs upload own" on storage.objects;
create policy "hr-docs upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'hr-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "hr-docs read own or as hr" on storage.objects;
create policy "hr-docs read own or as hr" on storage.objects for select to authenticated
  using (bucket_id = 'hr-docs' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.hr_can_admin(((storage.foldername(name))[1])::uuid))));
drop policy if exists "hr-docs delete own unless approved" on storage.objects;
create policy "hr-docs delete own unless approved" on storage.objects for delete to authenticated
  using (bucket_id = 'hr-docs' and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from public.hr_documents d where d.path = name and d.status = 'approved'));

-- ---------- 5. bells ----------
-- a 🔔 for each person, filed under p_team (the team of the person the file
-- is about), or else the first team the recipient is in
create or replace function public.hr_bell(p_to uuid[], p_title text, p_body text, p_team text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare t text; who uuid;
begin
  foreach who in array coalesce(p_to, '{}') loop
    t := p_team;
    if t is null then
      select m.team_slug into t from public.memberships m where m.user_id = who order by m.added_at limit 1;
    end if;
    if t is not null then
      insert into public.team_notifications (team_slug, title, body, audience, recipients, bell, popup, created_by)
      values (t, left(p_title, 140), left(coalesce(p_body, ''), 4000), 'people', array[who], true, false, auth.uid());
    end if;
  end loop;
end $$;
create or replace function public.hr_team_of(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.team_slug from public.memberships m where m.user_id = p_user order by m.added_at limit 1
$$;
-- the HR people for someone: super-admins + anyone with "Manage HR files" in a team they share
create or replace function public.hr_admins_for(p_user uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x.id), '{}') from (
    select p.id from public.profiles p where p.is_super
    union
    select m2.user_id from public.memberships m1
      join public.memberships m2 on m2.team_slug = m1.team_slug
      join public.team_roles r on r.team_slug = m2.team_slug and r.key = m2.role
     where m1.user_id = p_user and (m2.role = 'owner' or 'manage_hr' = any(r.perms))
  ) x where x.id <> p_user
$$;
create or replace function public.hr_name(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(p.profile->>'displayName', ''), nullif(p.name, ''), p.email) from public.profiles p where p.id = p_user
$$;

-- ---------- 6. the person: save, submit, "I've uploaded the signed contract" ----------
create or replace function public.hr_save(p_details jsonb, p_submit boolean default false, p_consent boolean default false)
returns public.hr_records language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.hr_records; missing text;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  if jsonb_typeof(coalesce(p_details, '{}'::jsonb)) <> 'object' then raise exception 'Bad details.'; end if;
  insert into public.hr_records (user_id) values (me) on conflict (user_id) do nothing;
  select * into r from public.hr_records where user_id = me for update;
  if r.status not in ('draft', 'changes') then
    raise exception 'Your HR file is with HR now. Ask HR to send it back if something needs to change.';
  end if;
  update public.hr_records set details = coalesce(p_details, '{}'::jsonb), updated_at = now() where user_id = me;

  if p_submit then
    if not p_consent then raise exception 'Please tick the consent box first.'; end if;
    select string_agg(k, ', ') into missing
      from unnest(array['full_name','dob','gender','father_name','mother_name','mobile','personal_email',
                        'cur_line','cur_city','cur_state','cur_pin','em1_name','em1_relation','em1_phone',
                        'aadhaar','pan','bank_holder','bank_name','bank_account','bank_ifsc']) k
     where coalesce(trim(p_details->>k), '') = '';
    if missing is not null then raise exception 'Some required details are empty: %', missing; end if;
    select string_agg(k, ', ') into missing
      from unnest(array['photo','aadhaar','pan','bank']) k
     where not exists (select 1 from public.hr_documents d where d.user_id = me and d.kind = k and d.status <> 'rejected');
    if missing is not null then raise exception 'Please upload: %', missing; end if;
    update public.hr_records
       set status = 'submitted', submitted_at = now(), consent_at = coalesce(consent_at, now()), hr_note = null
     where user_id = me;
    perform public.hr_bell(public.hr_admins_for(me), '🗂️ ' || public.hr_name(me) || ' submitted their HR file',
      'Check it in Administration → Employees (HR).', public.hr_team_of(me));
  end if;
  select * into r from public.hr_records where user_id = me;
  return r;
end $$;

create or replace function public.hr_mark_signed() returns public.hr_records
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.hr_records;
begin
  select * into r from public.hr_records where user_id = me for update;
  if r.user_id is null or r.status not in ('contract_sent', 'signed') then raise exception 'There is no contract waiting for you.'; end if;
  if not exists (select 1 from public.hr_documents d where d.user_id = me and d.kind = 'contract' and d.status <> 'rejected') then
    raise exception 'Upload the signed contract first.';
  end if;
  update public.hr_records set status = 'signed', signed_at = now(), updated_at = now() where user_id = me returning * into r;
  perform public.hr_bell(public.hr_admins_for(me), '✍️ ' || public.hr_name(me) || ' uploaded their signed contract',
    'Check it and mark the file complete in Administration → Employees (HR).', public.hr_team_of(me));
  return r;
end $$;

-- ---------- 7. HR actions ----------
-- p_action: save_job | send_back | contract_sent | complete | reopen
create or replace function public.hr_admin_update(p_user uuid, p_action text, p_job jsonb default null,
                                                  p_note text default null, p_contract_html text default null)
returns public.hr_records language plpgsql security definer set search_path = '' as $$
declare r public.hr_records;
begin
  if not public.hr_can_admin(p_user) then raise exception 'Only HR can do this.'; end if;
  insert into public.hr_records (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into r from public.hr_records where user_id = p_user for update;

  if p_action = 'save_job' then
    if jsonb_typeof(coalesce(p_job, '{}'::jsonb)) <> 'object' then raise exception 'Bad job details.'; end if;
    update public.hr_records set job = coalesce(p_job, '{}'::jsonb), updated_at = now() where user_id = p_user returning * into r;
  elsif p_action = 'send_back' then
    if coalesce(trim(p_note), '') = '' then raise exception 'Write what needs to change.'; end if;
    update public.hr_records set status = 'changes', hr_note = left(p_note, 2000), updated_at = now() where user_id = p_user returning * into r;
    perform public.hr_bell(array[p_user], '🗂️ HR asked for changes to your HR file', left(p_note, 600) || E'\n\nOpen your account menu → My HR file.');
  elsif p_action = 'contract_sent' then
    if coalesce(p_contract_html, '') = '' then raise exception 'The contract is empty.'; end if;
    update public.hr_records set status = 'contract_sent', contract_html = p_contract_html, contract_sent_at = now(),
           signed_at = null, updated_at = now() where user_id = p_user returning * into r;
    perform public.hr_bell(array[p_user], '✍️ Your work contract is in your email',
      'Read it, sign it, and upload the signed copy in your account menu → My HR file.');
  elsif p_action = 'complete' then
    update public.hr_records set status = 'complete', completed_at = now(), completed_by = auth.uid(), hr_note = null, updated_at = now()
     where user_id = p_user returning * into r;
    perform public.hr_bell(array[p_user], '✅ Your HR file is complete', 'Thanks! Nothing more is needed from you.');
  elsif p_action = 'reopen' then
    update public.hr_records set status = 'changes', hr_note = coalesce(nullif(left(p_note, 2000), ''), r.hr_note), completed_at = null, updated_at = now()
     where user_id = p_user returning * into r;
    perform public.hr_bell(array[p_user], '🗂️ HR reopened your HR file', coalesce(nullif(left(p_note, 600), ''), 'Please check your details.'));
  else
    raise exception 'Unknown action.';
  end if;
  return r;
end $$;

create or replace function public.hr_review_doc(p_doc uuid, p_status text, p_note text default null)
returns public.hr_documents language plpgsql security definer set search_path = '' as $$
declare d public.hr_documents;
begin
  select * into d from public.hr_documents where id = p_doc for update;
  if d.id is null or not public.hr_can_admin(d.user_id) then raise exception 'Only HR can do this.'; end if;
  if p_status not in ('uploaded', 'approved', 'rejected') then raise exception 'Unknown status.'; end if;
  update public.hr_documents set status = p_status, note = left(nullif(trim(p_note), ''), 500),
         reviewed_by = auth.uid(), reviewed_at = now() where id = p_doc returning * into d;
  if p_status = 'rejected' then
    perform public.hr_bell(array[d.user_id], '📄 Please upload a document again',
      d.kind || ': ' || coalesce(nullif(trim(p_note), ''), 'it could not be accepted') || E'\n\nOpen your account menu → My HR file.');
  end if;
  return d;
end $$;

create or replace function public.hr_save_settings(p_company jsonb, p_template text)
returns public.hr_settings language plpgsql security definer set search_path = '' as $$
declare s public.hr_settings;
begin
  if not public.is_super() then raise exception 'Only a super-admin can change the contract template.'; end if;
  update public.hr_settings set company = coalesce(p_company, company), contract_template = coalesce(p_template, contract_template),
         updated_at = now(), updated_by = auth.uid() where id = 1 returning * into s;
  return s;
end $$;

-- ---------- 8. who may call what ----------
revoke execute on function public.hr_bell(uuid[], text, text, text), public.hr_admins_for(uuid), public.hr_name(uuid),
  public.hr_team_of(uuid) from public, anon, authenticated;
revoke execute on function public.hr_can_admin(uuid), public.hr_is_admin(), public.hr_save(jsonb, boolean, boolean),
  public.hr_mark_signed(), public.hr_admin_update(uuid, text, jsonb, text, text), public.hr_review_doc(uuid, text, text),
  public.hr_save_settings(jsonb, text) from public, anon;
grant execute on function public.hr_can_admin(uuid), public.hr_is_admin(), public.hr_save(jsonb, boolean, boolean),
  public.hr_mark_signed(), public.hr_admin_update(uuid, text, jsonb, text, text), public.hr_review_doc(uuid, text, text),
  public.hr_save_settings(jsonb, text) to authenticated;
