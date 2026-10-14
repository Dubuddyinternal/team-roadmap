-- =====================================================================
-- STAGE 19a — Accounts: payment requests and payroll
--
-- 1. Payment requests. Anyone can ask for money: a reimbursement (they
--    already paid; paid back to the bank account in their HR file) or a
--    vendor payment (pay someone directly, e.g. an influencer). Accounts
--    approves or rejects, then marks it paid with the bank reference.
-- 2. Payroll. Each month's salaries start from the CTC in the person's
--    HR job terms (÷ 12). Accounts adds bonus / deductions / reimbursements,
--    approves the month and marks it paid.
-- 3. Bank details for the bulk-payment file come through acc_bank_rows()
--    (people with the Accounts permission only).
-- New permission: "accounts" (Accounts: payments & payroll). Owners and
-- super-admins have it. Run after stage18i. Safe to run again.
-- =====================================================================

create or replace function public.all_perms() returns text[]
language sql immutable set search_path = '' as $$
  select array['view','comment','edit','delete','spaces','okr_structure','module_vision',
               'request_members','approve_requests','manage_people','create_games','edit_targets','edit_utm',
               'send_notifications','manage_learning','add_spaces','delete_spaces','add_roadmaps','delete_roadmaps',
               'review_student_ideas','manage_hr','view_hr','manage_policies','hr_settings','accounts']
$$;
update public.team_roles set perms = public.all_perms() where key = 'owner';

create or replace function public.acc_can() returns boolean
language sql stable security definer set search_path = '' as $$ select public.hr_perm_any('accounts') $$;
-- who hears about new requests
create or replace function public.acc_people() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x.id), '{}') from (
    select p.id from public.profiles p where p.is_super
    union
    select m.user_id from public.memberships m join public.team_roles r on r.team_slug = m.team_slug and r.key = m.role
     where m.role = 'owner' or 'accounts' = any(r.perms)
  ) x
$$;

-- ---------- payment requests ----------
create table if not exists public.acc_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,   -- who asked
  kind          text not null check (kind in ('reimbursement', 'vendor')),
  title         text not null check (length(trim(title)) between 2 and 160),
  amount        numeric(12,2) not null check (amount > 0 and amount < 100000000),
  category      text not null default '' check (length(category) <= 60),
  spent_on      date,
  notes         text not null default '' check (length(notes) <= 2000),
  payee_name    text not null default '' check (length(payee_name) <= 140),
  payee_upi     text not null default '' check (length(payee_upi) <= 100),
  payee_account text not null default '' check (length(payee_account) <= 40),
  payee_ifsc    text not null default '' check (length(payee_ifsc) <= 20),
  payee_bank    text not null default '' check (length(payee_bank) <= 100),
  payee_pan     text not null default '' check (length(payee_pan) <= 20),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  decided_by    uuid references auth.users(id) on delete set null,
  decided_at    timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  paid_at       date,
  paid_ref      text check (paid_ref is null or length(paid_ref) <= 120),
  paid_by       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists acc_requests_status on public.acc_requests (status, created_at desc);
create index if not exists acc_requests_user on public.acc_requests (user_id, created_at desc);
alter table public.acc_requests enable row level security;
drop policy if exists "read own or as accounts" on public.acc_requests;
create policy "read own or as accounts" on public.acc_requests for select to authenticated
  using (user_id = auth.uid() or public.acc_can());

-- bills and invoices (private bucket, a folder per person)
create table if not exists public.acc_files (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.acc_requests(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  path       text not null unique,
  file_name  text not null default '' check (length(file_name) <= 200),
  mime       text not null default '',
  size       int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.acc_files enable row level security;
drop policy if exists "read own files or as accounts" on public.acc_files;
create policy "read own files or as accounts" on public.acc_files for select to authenticated
  using (user_id = auth.uid() or public.acc_can());
drop policy if exists "add files to own pending request" on public.acc_files;
create policy "add files to own pending request" on public.acc_files for insert to authenticated
  with check (user_id = auth.uid() and path like auth.uid()::text || '/%'
              and exists (select 1 from public.acc_requests r where r.id = request_id and r.user_id = auth.uid() and r.status = 'pending'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('acc-docs', 'acc-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "acc-docs upload own" on storage.objects;
create policy "acc-docs upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'acc-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "acc-docs read own or as accounts" on storage.objects;
create policy "acc-docs read own or as accounts" on storage.objects for select to authenticated
  using (bucket_id = 'acc-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.acc_can()));

-- ---------- payroll ----------
create table if not exists public.acc_payroll (
  id          uuid primary key default gen_random_uuid(),
  month       text not null check (month ~ '^\d{4}-\d{2}$'),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  base        numeric(12,2) not null default 0 check (base >= 0),
  bonus       numeric(12,2) not null default 0 check (bonus >= 0),
  reimb       numeric(12,2) not null default 0 check (reimb >= 0),
  deductions  numeric(12,2) not null default 0 check (deductions >= 0),
  note        text not null default '' check (length(note) <= 500),
  status      text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  paid_at     date,
  paid_ref    text check (paid_ref is null or length(paid_ref) <= 120),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null,
  unique (month, user_id)
);
alter table public.acc_payroll enable row level security;
drop policy if exists "read own paid or as accounts" on public.acc_payroll;
create policy "read own paid or as accounts" on public.acc_payroll for select to authenticated
  using ((user_id = auth.uid() and status = 'paid') or public.acc_can());

revoke all on public.acc_requests, public.acc_files, public.acc_payroll from anon;
grant select on public.acc_requests, public.acc_payroll to authenticated;
grant select, insert on public.acc_files to authenticated;

-- ---------- functions ----------
create or replace function public.acc_request_create(p jsonb)
returns public.acc_requests language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.acc_requests; k text := p->>'kind'; amt numeric;
begin
  if me is null or not exists (select 1 from public.memberships m where m.user_id = me) then raise exception 'Please sign in.'; end if;
  if k not in ('reimbursement', 'vendor') then raise exception 'Pick reimbursement or vendor payment.'; end if;
  begin amt := round((p->>'amount')::numeric, 2); exception when others then raise exception 'Enter the amount.'; end;
  if amt is null or amt <= 0 then raise exception 'Enter the amount.'; end if;
  if length(trim(coalesce(p->>'title', ''))) < 2 then raise exception 'Say what it''s for.'; end if;
  if k = 'vendor' and (length(trim(coalesce(p->>'payee_name', ''))) < 2
       or (coalesce(trim(p->>'payee_upi'), '') = '' and (coalesce(trim(p->>'payee_account'), '') = '' or coalesce(trim(p->>'payee_ifsc'), '') = ''))) then
    raise exception 'Add who to pay, and their UPI ID or bank account and IFSC.';
  end if;
  insert into public.acc_requests (user_id, kind, title, amount, category, spent_on, notes, payee_name, payee_upi, payee_account, payee_ifsc, payee_bank, payee_pan)
  values (me, k, left(trim(p->>'title'), 160), amt, left(coalesce(p->>'category', ''), 60), nullif(p->>'spent_on', '')::date,
          left(coalesce(p->>'notes', ''), 2000), left(coalesce(trim(p->>'payee_name'), ''), 140), left(coalesce(trim(p->>'payee_upi'), ''), 100),
          left(regexp_replace(coalesce(p->>'payee_account', ''), '\s', '', 'g'), 40), left(upper(coalesce(trim(p->>'payee_ifsc'), '')), 20),
          left(coalesce(trim(p->>'payee_bank'), ''), 100), left(upper(coalesce(trim(p->>'payee_pan'), '')), 20))
  returning * into r;
  perform public.hr_bell(array(select unnest(public.acc_people()) except select me),
    '💰 ' || public.hr_name(me) || ' asked for ₹' || to_char(amt, 'FM99,99,99,990.00') || ': ' || r.title,
    case when k = 'vendor' then 'Vendor payment to ' || r.payee_name else 'Reimbursement' end || E'.\n\nApprove it in Administration → Accounts → Payment requests.',
    public.hr_team_of(me));
  return r;
end $$;

create or replace function public.acc_request_cancel(p_id uuid)
returns public.acc_requests language plpgsql security definer set search_path = '' as $$
declare r public.acc_requests;
begin
  update public.acc_requests set status = 'cancelled', decided_at = now()
   where id = p_id and user_id = auth.uid() and status = 'pending' returning * into r;
  if r.id is null then raise exception 'Only a request that is still waiting can be cancelled.'; end if;
  return r;
end $$;

create or replace function public.acc_decide(p_id uuid, p_approve boolean, p_note text default null)
returns public.acc_requests language plpgsql security definer set search_path = '' as $$
declare r public.acc_requests;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  if not p_approve and length(trim(coalesce(p_note, ''))) < 2 then raise exception 'Say why it''s rejected.'; end if;
  update public.acc_requests set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(left(trim(coalesce(p_note, '')), 1000), '')
   where id = p_id and status = 'pending' returning * into r;
  if r.id is null then raise exception 'This request was already answered.'; end if;
  perform public.hr_bell(array[r.user_id],
    case when p_approve then '💰 Approved: ' else '💰 Not approved: ' end || r.title || ' (₹' || to_char(r.amount, 'FM99,99,99,990.00') || ')',
    coalesce(r.decision_note, case when p_approve then 'It will be paid soon.' else '' end) || E'\n\nSee it in Administration → For me → My payments.');
  return r;
end $$;

create or replace function public.acc_mark_paid(p_ids uuid[], p_date date, p_ref text)
returns int language plpgsql security definer set search_path = '' as $$
declare r public.acc_requests; n int := 0;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  for r in update public.acc_requests set status = 'paid', paid_at = coalesce(p_date, current_date), paid_ref = nullif(left(trim(coalesce(p_ref, '')), 120), ''), paid_by = auth.uid()
            where id = any(p_ids) and status = 'approved' returning * loop
    n := n + 1;
    perform public.hr_bell(array[r.user_id], '💸 Paid: ' || r.title || ' (₹' || to_char(r.amount, 'FM99,99,99,990.00') || ')',
      'Paid on ' || to_char(r.paid_at, 'DD Mon YYYY') || coalesce(' · Ref ' || r.paid_ref, '') || E'.\n\nSee it in Administration → For me → My payments.');
  end loop;
  return n;
end $$;

-- payroll: add everyone with a CTC; refresh draft rows (base, waiting reimbursements)
create or replace function public.acc_payroll_fill(p_month text, p_refresh boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare n int; u record; base numeric; reimb numeric;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Pick a month.'; end if;
  for u in select r.user_id, nullif(regexp_replace(coalesce(r.job->>'ctc', ''), '[^0-9.]', '', 'g'), '') as ctc
             from public.hr_records r
            where exists (select 1 from public.memberships m where m.user_id = r.user_id) loop
    if u.ctc is null then continue; end if;
    base := round(u.ctc::numeric / 12);
    select coalesce(sum(a.amount), 0) into reimb from public.acc_requests a where a.user_id = u.user_id and a.kind = 'reimbursement' and a.status = 'approved';
    insert into public.acc_payroll (month, user_id, base, reimb, updated_by) values (p_month, u.user_id, base, reimb, auth.uid())
    on conflict (month, user_id) do update set base = case when p_refresh then excluded.base else public.acc_payroll.base end,
           reimb = case when p_refresh then excluded.reimb else public.acc_payroll.reimb end, updated_at = now()
     where public.acc_payroll.status = 'draft';
  end loop;
  select count(*) into n from public.acc_payroll where month = p_month;
  return n;
end $$;

create or replace function public.acc_payroll_save(p_id uuid, p_base numeric, p_bonus numeric, p_reimb numeric, p_deductions numeric, p_note text)
returns public.acc_payroll language plpgsql security definer set search_path = '' as $$
declare r public.acc_payroll;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  update public.acc_payroll set base = greatest(coalesce(p_base, 0), 0), bonus = greatest(coalesce(p_bonus, 0), 0), reimb = greatest(coalesce(p_reimb, 0), 0),
         deductions = greatest(coalesce(p_deductions, 0), 0), note = left(coalesce(p_note, ''), 500), updated_at = now(), updated_by = auth.uid()
   where id = p_id and status <> 'paid' returning * into r;
  if r.id is null then raise exception 'A paid salary can''t be changed.'; end if;
  return r;
end $$;

-- draft → approved, or approved → paid (which also settles the reimbursements included)
create or replace function public.acc_payroll_status(p_ids uuid[], p_status text, p_date date default null, p_ref text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare r public.acc_payroll; n int := 0; m text;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  if p_status = 'approved' then
    update public.acc_payroll set status = 'approved', updated_at = now(), updated_by = auth.uid() where id = any(p_ids) and status = 'draft';
    get diagnostics n = row_count;
  elsif p_status = 'draft' then
    update public.acc_payroll set status = 'draft', updated_at = now(), updated_by = auth.uid() where id = any(p_ids) and status = 'approved';
    get diagnostics n = row_count;
  elsif p_status = 'paid' then
    for r in update public.acc_payroll set status = 'paid', paid_at = coalesce(p_date, current_date), paid_ref = nullif(left(trim(coalesce(p_ref, '')), 120), ''),
                    updated_at = now(), updated_by = auth.uid()
              where id = any(p_ids) and status = 'approved' returning * loop
      n := n + 1;
      m := to_char(to_date(r.month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY');
      if r.reimb > 0 then
        update public.acc_requests set status = 'paid', paid_at = r.paid_at, paid_ref = 'With ' || m || ' salary', paid_by = auth.uid()
         where user_id = r.user_id and kind = 'reimbursement' and status = 'approved';
      end if;
      perform public.hr_bell(array[r.user_id], '💸 Your ' || m || ' salary is paid',
        '₹' || to_char(r.base + r.bonus + r.reimb - r.deductions, 'FM99,99,99,990.00') || ' on ' || to_char(r.paid_at, 'DD Mon YYYY') || coalesce(' · Ref ' || r.paid_ref, '') || '.');
    end loop;
  else
    raise exception 'Unknown status.';
  end if;
  return n;
end $$;

-- bank details for the bulk-payment file (Accounts only)
create or replace function public.acc_bank_rows(p_users uuid[])
returns table (user_id uuid, holder text, bank text, account text, ifsc text, email text)
language sql stable security definer set search_path = '' as $$
  select r.user_id, r.details->>'bank_holder', r.details->>'bank_name', regexp_replace(coalesce(r.details->>'bank_account', ''), '\s', '', 'g'),
         upper(coalesce(r.details->>'bank_ifsc', '')), p.email
    from public.hr_records r join public.profiles p on p.id = r.user_id
   where public.acc_can() and r.user_id = any(p_users)
$$;

revoke execute on function public.acc_can(), public.acc_people() from public, anon;
revoke execute on function public.acc_people() from authenticated;
grant execute on function public.acc_can() to authenticated;
revoke execute on function public.acc_request_create(jsonb), public.acc_request_cancel(uuid), public.acc_decide(uuid, boolean, text),
  public.acc_mark_paid(uuid[], date, text), public.acc_payroll_fill(text, boolean), public.acc_payroll_save(uuid, numeric, numeric, numeric, numeric, text),
  public.acc_payroll_status(uuid[], text, date, text), public.acc_bank_rows(uuid[]) from public, anon;
grant execute on function public.acc_request_create(jsonb), public.acc_request_cancel(uuid), public.acc_decide(uuid, boolean, text),
  public.acc_mark_paid(uuid[], date, text), public.acc_payroll_fill(text, boolean), public.acc_payroll_save(uuid, numeric, numeric, numeric, numeric, text),
  public.acc_payroll_status(uuid[], text, date, text), public.acc_bank_rows(uuid[]) to authenticated;
