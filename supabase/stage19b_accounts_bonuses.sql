-- =====================================================================
-- STAGE 19b — bonuses
--
-- Accounts → Bonuses: a bonus for a person and a month, either a fixed
-- amount or units × rate (e.g. 40 sales × ₹200). Approved bonuses go into
-- that month's payroll (acc_payroll.bonus) when it's filled or refreshed,
-- and are marked paid with the salary. Run after stage19a. Safe to run again.
-- =====================================================================

create table if not exists public.acc_bonuses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  month      text not null check (month ~ '^\d{4}-\d{2}$'),
  reason     text not null check (length(trim(reason)) between 2 and 200),
  units      numeric(12,2) check (units is null or units >= 0),
  rate       numeric(12,2) check (rate is null or rate >= 0),
  amount     numeric(12,2) not null check (amount > 0 and amount < 100000000),
  status     text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists acc_bonuses_month on public.acc_bonuses (month, user_id);
alter table public.acc_bonuses enable row level security;
create policy "read own paid or as accounts" on public.acc_bonuses for select to authenticated
  using ((user_id = auth.uid() and status = 'paid') or public.acc_can());
revoke all on public.acc_bonuses from anon;
grant select on public.acc_bonuses to authenticated;

-- add or edit (only while draft); units × rate wins over a typed amount
create or replace function public.acc_bonus_save(p_id uuid, p_user uuid, p_month text, p_reason text, p_units numeric, p_rate numeric, p_amount numeric)
returns public.acc_bonuses language plpgsql security definer set search_path = '' as $$
declare b public.acc_bonuses; amt numeric;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Pick a month.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 2 then raise exception 'Say what the bonus is for.'; end if;
  amt := case when p_units is not null and p_rate is not null then round(p_units * p_rate, 2) else round(coalesce(p_amount, 0), 2) end;
  if amt <= 0 then raise exception 'The bonus amount is 0.'; end if;
  if p_id is null then
    if not exists (select 1 from public.memberships m where m.user_id = p_user) then raise exception 'Pick a person.'; end if;
    insert into public.acc_bonuses (user_id, month, reason, units, rate, amount, created_by)
    values (p_user, p_month, left(trim(p_reason), 200), p_units, p_rate, amt, auth.uid()) returning * into b;
  else
    update public.acc_bonuses set month = p_month, reason = left(trim(p_reason), 200), units = p_units, rate = p_rate, amount = amt, updated_at = now()
     where id = p_id and status = 'draft' returning * into b;
    if b.id is null then raise exception 'Only a draft bonus can be changed.'; end if;
  end if;
  return b;
end $$;

-- draft → approved / cancelled, approved → draft
create or replace function public.acc_bonus_status(p_ids uuid[], p_status text)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  if p_status = 'approved' then update public.acc_bonuses set status = 'approved', updated_at = now() where id = any(p_ids) and status = 'draft';
  elsif p_status = 'draft' then update public.acc_bonuses set status = 'draft', updated_at = now() where id = any(p_ids) and status = 'approved';
  elsif p_status = 'cancelled' then update public.acc_bonuses set status = 'cancelled', updated_at = now() where id = any(p_ids) and status in ('draft', 'approved');
  else raise exception 'Unknown status.'; end if;
  get diagnostics n = row_count;
  return n;
end $$;

-- payroll fill: also bring in approved bonuses (and people who only have a bonus)
create or replace function public.acc_payroll_fill(p_month text, p_refresh boolean default false)
returns int language plpgsql security definer set search_path = '' as $$
declare n int; u record; base numeric; reimb numeric; bon numeric;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Pick a month.'; end if;
  for u in select x.user_id, max(x.ctc) as ctc from (
             select r.user_id, nullif(regexp_replace(coalesce(r.job->>'ctc', ''), '[^0-9.]', '', 'g'), '') as ctc
               from public.hr_records r where exists (select 1 from public.memberships m where m.user_id = r.user_id)
             union all
             select b.user_id, null from public.acc_bonuses b where b.month = p_month and b.status = 'approved'
           ) x group by x.user_id loop
    select coalesce(sum(b.amount), 0) into bon from public.acc_bonuses b where b.user_id = u.user_id and b.month = p_month and b.status = 'approved';
    if u.ctc is null and bon = 0 then continue; end if;
    base := case when u.ctc is null then 0 else round(u.ctc::numeric / 12) end;
    select coalesce(sum(a.amount), 0) into reimb from public.acc_requests a where a.user_id = u.user_id and a.kind = 'reimbursement' and a.status = 'approved';
    insert into public.acc_payroll (month, user_id, base, bonus, reimb, updated_by) values (p_month, u.user_id, base, bon, reimb, auth.uid())
    on conflict (month, user_id) do update set base = case when p_refresh then excluded.base else public.acc_payroll.base end,
           bonus = case when p_refresh then excluded.bonus else public.acc_payroll.bonus end,
           reimb = case when p_refresh then excluded.reimb else public.acc_payroll.reimb end, updated_at = now()
     where public.acc_payroll.status = 'draft';
  end loop;
  select count(*) into n from public.acc_payroll where month = p_month;
  return n;
end $$;

-- when a month's salaries are paid, its approved bonuses are paid too
create or replace function public.acc_bonus_paid_with_salary() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paid' and old.status <> 'paid' then
    update public.acc_bonuses set status = 'paid', updated_at = now() where user_id = new.user_id and month = new.month and status = 'approved';
  end if;
  return new;
end $$;
create or replace trigger acc_payroll_paid_bonuses after update on public.acc_payroll for each row execute function public.acc_bonus_paid_with_salary();

revoke execute on function public.acc_bonus_paid_with_salary() from public, anon, authenticated;
revoke execute on function public.acc_bonus_save(uuid, uuid, text, text, numeric, numeric, numeric), public.acc_bonus_status(uuid[], text) from public, anon;
grant execute on function public.acc_bonus_save(uuid, uuid, text, text, numeric, numeric, numeric), public.acc_bonus_status(uuid[], text) to authenticated;
