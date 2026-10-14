-- =====================================================================
-- STAGE 18e — ask HR to change one locked detail
--
-- Once a teammate has submitted their HR file it's locked. To fix one
-- field they press ✏️ next to it and say why; HR approves or says no; if
-- approved, that one field opens for them, and saving it locks it again.
-- Run after stage18a. Safe to run again.
-- =====================================================================

create table if not exists public.hr_change_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  field      text not null check (field ~ '^[a-z0-9_]{1,40}$'),
  label      text not null check (length(label) between 1 and 120),
  reason     text not null check (length(trim(reason)) between 2 and 1000),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'done')),
  hr_note    text check (hr_note is null or length(hr_note) <= 1000),
  old_value  text check (old_value is null or length(old_value) <= 2000),
  new_value  text check (new_value is null or length(new_value) <= 2000),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  done_at    timestamptz
);
create index if not exists hr_change_requests_user on public.hr_change_requests (user_id, created_at desc);
-- one open request per field at a time
create unique index if not exists hr_change_requests_open on public.hr_change_requests (user_id, field)
  where status in ('pending', 'approved');
alter table public.hr_change_requests enable row level security;
drop policy if exists "read own or as hr" on public.hr_change_requests;
create policy "read own or as hr" on public.hr_change_requests for select to authenticated
  using (user_id = auth.uid() or public.hr_can_admin(user_id));
revoke all on public.hr_change_requests from anon;
grant select on public.hr_change_requests to authenticated;

-- the teammate asks
create or replace function public.hr_request_change(p_field text, p_label text, p_reason text)
returns public.hr_change_requests language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.hr_records; c public.hr_change_requests;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  select * into r from public.hr_records where user_id = me;
  if r.user_id is null or r.status in ('draft', 'changes') then raise exception 'Your file is open: just change it.'; end if;
  if coalesce(p_field, '') !~ '^[a-z0-9_]{1,40}$' then raise exception 'Pick a field.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 2 then raise exception 'Say why it needs to change.'; end if;
  if exists (select 1 from public.hr_change_requests x where x.user_id = me and x.field = p_field and x.status in ('pending', 'approved')) then
    raise exception 'You already asked to change this.';
  end if;
  insert into public.hr_change_requests (user_id, field, label, reason, old_value)
  values (me, p_field, left(coalesce(nullif(trim(p_label), ''), p_field), 120), left(trim(p_reason), 1000), left(r.details->>p_field, 2000))
  returning * into c;
  perform public.hr_bell(public.hr_admins_for(me), '✏️ ' || public.hr_name(me) || ' asked to change: ' || c.label,
    left(c.reason, 400) || E'\n\nApprove or say no in Administration → Employees (HR).', public.hr_team_of(me));
  return c;
end $$;

-- HR approves or says no
create or replace function public.hr_decide_change(p_id uuid, p_approve boolean, p_note text default null)
returns public.hr_change_requests language plpgsql security definer set search_path = '' as $$
declare c public.hr_change_requests;
begin
  select * into c from public.hr_change_requests where id = p_id for update;
  if c.id is null then raise exception 'That request doesn''t exist.'; end if;
  if not public.hr_can_admin(c.user_id) then raise exception 'Only HR can do this.'; end if;
  if c.status <> 'pending' then raise exception 'This request was already answered.'; end if;
  update public.hr_change_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         hr_note = nullif(left(trim(coalesce(p_note, '')), 1000), ''), decided_at = now(), decided_by = auth.uid()
   where id = p_id returning * into c;
  perform public.hr_bell(array[c.user_id],
    case when p_approve then '✏️ HR said yes: you can change ' || c.label else '✏️ HR said no to changing ' || c.label end,
    coalesce(c.hr_note, case when p_approve then 'Open My HR file, change it and press Save.' else 'Ask HR if you have questions.' end));
  return c;
end $$;

-- the teammate saves the approved change; the field locks again
create or replace function public.hr_apply_change(p_id uuid, p_value text)
returns public.hr_records language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.hr_change_requests; r public.hr_records;
begin
  select * into c from public.hr_change_requests where id = p_id and user_id = me for update;
  if c.id is null or c.status <> 'approved' then raise exception 'HR hasn''t approved this change.'; end if;
  if length(coalesce(p_value, '')) > 2000 then raise exception 'That''s too long.'; end if;
  update public.hr_records
     set details = case when coalesce(trim(p_value), '') = '' then details - c.field
                        else jsonb_set(details, array[c.field], to_jsonb(trim(p_value))) end,
         updated_at = now()
   where user_id = me returning * into r;
  update public.hr_change_requests set status = 'done', new_value = left(trim(p_value), 2000), done_at = now() where id = p_id;
  perform public.hr_bell(public.hr_admins_for(me), '✏️ ' || public.hr_name(me) || ' changed: ' || c.label,
    'See it in Administration → Employees (HR).', public.hr_team_of(me));
  return r;
end $$;

revoke execute on function public.hr_request_change(text, text, text), public.hr_decide_change(uuid, boolean, text),
  public.hr_apply_change(uuid, text) from public, anon;
grant execute on function public.hr_request_change(text, text, text), public.hr_decide_change(uuid, boolean, text),
  public.hr_apply_change(uuid, text) to authenticated;
