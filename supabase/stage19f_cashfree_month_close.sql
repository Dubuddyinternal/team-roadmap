-- =====================================================================
-- STAGE 19f — Cashfree month close → Zoho Books
--
-- · acc_sales gets place of supply, IGST and Cashfree's fee / settlement
--   details per payment (service_charge, service_tax = GST on the fee,
--   settlement_amount / utr / date), filled by the cashfree-hook sync.
-- · acc_sale_refunds: one row per refund with its own credit-note number
--   (CYBRCT-CN-0001…), linked to the original invoice.
-- · acc_cf_settlements: Cashfree's payouts to PNB.
-- · acc_sales_months: one row per month — the Cashfree GST invoice the
--   admin types in, the Zoho ids after posting, and the lock.
-- · acc_sales_month_summary(month): every figure on the Close-month screen
--   and the checks, used by the page and the zoho-month Edge Function.
-- Run after stage19e. Safe to run again.
-- =====================================================================

alter table public.acc_sales add column if not exists place_of_supply   text not null default 'HR';
alter table public.acc_sales add column if not exists igst              numeric(12,2) not null default 0;
alter table public.acc_sales add column if not exists service_charge    numeric(12,2);
alter table public.acc_sales add column if not exists service_tax       numeric(12,2);
alter table public.acc_sales add column if not exists settlement_amount numeric(12,2);
alter table public.acc_sales add column if not exists settlement_utr    text;
alter table public.acc_sales add column if not exists settlement_date   timestamptz;
alter table public.acc_sales add column if not exists cf_settlement_id  text;

alter table public.acc_sales_settings add column if not exists cn_prefix text not null default 'CYBRCT-CN-';
alter table public.acc_sales_settings add column if not exists cn_next   int  not null default 1;
-- when the warehouse started: the sync never creates or renumbers sales / refunds before it
-- (they were invoiced in the old B2C sheet; import them from there)
alter table public.acc_sales_settings add column if not exists sync_from timestamptz;
update public.acc_sales_settings set sync_from = '2026-10-14 17:20:00+05:30' where id = 1 and sync_from is null;

-- refunds, each with a credit note
create table if not exists public.acc_sale_refunds (
  id                uuid primary key default gen_random_uuid(),
  cf_refund_id      text not null unique,
  sale_id           uuid references public.acc_sales(id) on delete set null,
  cf_payment_id     text not null default '',
  order_id          text not null default '',
  invoice_no        text,                          -- the original invoice
  cn_no             text unique,
  refund_time       timestamptz,
  refund_amount     numeric(12,2) not null default 0,
  taxable           numeric(12,2) not null default 0,
  cgst              numeric(12,2) not null default 0,
  sgst              numeric(12,2) not null default 0,
  igst              numeric(12,2) not null default 0,
  place_of_supply   text not null default 'HR',
  service_charge    numeric(12,2),
  service_tax       numeric(12,2),
  settlement_amount numeric(12,2),
  settlement_utr    text,
  settlement_date   timestamptz,
  status            text not null default 'SUCCESS',
  raw               jsonb,
  created_at        timestamptz not null default now()
);
alter table public.acc_sale_refunds enable row level security;
drop policy if exists "accounts read refunds" on public.acc_sale_refunds;
create policy "accounts read refunds" on public.acc_sale_refunds for select to authenticated using (public.acc_can());
revoke all on public.acc_sale_refunds from anon;
grant select on public.acc_sale_refunds to authenticated;

-- Cashfree → PNB payouts
create table if not exists public.acc_cf_settlements (
  cf_settlement_id text primary key,
  settlement_date  timestamptz,
  amount_settled   numeric(14,2) not null default 0,
  payment_amount   numeric(14,2),
  service_charge   numeric(12,2),
  service_tax      numeric(12,2),
  adjustment       numeric(12,2),
  utr              text,
  payment_from     timestamptz,
  payment_till     timestamptz,
  status           text,
  raw              jsonb,
  updated_at       timestamptz not null default now()
);
alter table public.acc_cf_settlements enable row level security;
drop policy if exists "accounts read settlements" on public.acc_cf_settlements;
create policy "accounts read settlements" on public.acc_cf_settlements for select to authenticated using (public.acc_can());
revoke all on public.acc_cf_settlements from anon;
grant select on public.acc_cf_settlements to authenticated;

-- one row per month
create table if not exists public.acc_sales_months (
  month          text primary key check (month ~ '^\d{4}-\d{2}$'),
  status         text not null default 'open' check (status in ('open', 'posted')),
  cf_invoice_no  text not null default '',
  cf_exempt_fee  numeric(12,2),
  cf_taxable_fee numeric(12,2),
  cf_igst        numeric(12,2),
  cf_invoice_path text,
  snapshot       jsonb,           -- the summary as posted
  zoho           jsonb,           -- ids + links of what was created
  posted_at      timestamptz,
  posted_by      uuid references auth.users(id) on delete set null,
  updated_at     timestamptz not null default now()
);
alter table public.acc_sales_months enable row level security;
drop policy if exists "accounts read months" on public.acc_sales_months;
create policy "accounts read months" on public.acc_sales_months for select to authenticated using (public.acc_can());
revoke all on public.acc_sales_months from anon;
grant select on public.acc_sales_months to authenticated;

-- the Cashfree GST invoice for the month (typed from its PDF)
create or replace function public.acc_sales_month_save(p_month text, p_inv text, p_exempt numeric, p_taxable numeric, p_igst numeric, p_path text)
returns public.acc_sales_months language plpgsql security definer set search_path = '' as $$
declare m public.acc_sales_months;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Pick a month.'; end if;
  if exists (select 1 from public.acc_sales_months where month = p_month and status = 'posted') then raise exception 'This month is posted and locked.'; end if;
  insert into public.acc_sales_months (month, cf_invoice_no, cf_exempt_fee, cf_taxable_fee, cf_igst, cf_invoice_path)
  values (p_month, left(trim(coalesce(p_inv, '')), 60), p_exempt, p_taxable, p_igst, nullif(p_path, ''))
  on conflict (month) do update set cf_invoice_no = excluded.cf_invoice_no, cf_exempt_fee = excluded.cf_exempt_fee, cf_taxable_fee = excluded.cf_taxable_fee,
         cf_igst = excluded.cf_igst, cf_invoice_path = coalesce(excluded.cf_invoice_path, public.acc_sales_months.cf_invoice_path), updated_at = now()
  returning * into m;
  return m;
end $$;

-- is this IST month posted (locked)?
create or replace function public.acc_sales_month_locked(p_t timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.acc_sales_months where status = 'posted' and month = to_char(p_t at time zone 'Asia/Kolkata', 'YYYY-MM'))
$$;

-- GST inside a GST-inclusive amount, by place of supply
create or replace function public.acc_sale_split(p_amount numeric, p_pos text, out taxable numeric, out cgst numeric, out sgst numeric, out igst numeric)
language plpgsql stable security definer set search_path = '' as $$
declare r numeric;
begin
  select gst_rate into r from public.acc_sales_settings where id = 1;
  taxable := round(p_amount / (1 + r / 100), 2);
  if coalesce(p_pos, 'HR') = 'HR' then cgst := round(taxable * r / 200, 2); sgst := cgst; igst := 0;
  else cgst := 0; sgst := 0; igst := round(taxable * r / 100, 2); end if;
end $$;

-- a refund gets the next credit-note number once; refunds of sales older than
-- the warehouse are kept too (no original invoice row)
create or replace function public.acc_sale_refund(p jsonb)
returns public.acc_sales language plpgsql security definer set search_path = '' as $$
declare r public.acc_sales; rid text := coalesce(nullif(p->>'cf_refund_id', ''), ''); amt numeric := coalesce(nullif(p->>'refund_amount', '')::numeric, 0);
        g record; s public.acc_sales_settings; cn text; pos text;
begin
  select * into r from public.acc_sales where cf_payment_id = p->>'cf_payment_id' or (coalesce(p->>'cf_payment_id', '') = '' and order_id = p->>'order_id')
   order by (status = 'SUCCESS') desc limit 1 for update;
  if rid = '' or amt <= 0 then return r; end if;
  if upper(coalesce(p->>'refund_status', 'SUCCESS')) not in ('SUCCESS', 'PROCESSED', 'PAID') then return r; end if;
  if exists (select 1 from public.acc_sale_refunds where cf_refund_id = rid) then return r; end if;
  update public.acc_sales_settings set cn_next = cn_next + 1 where id = 1 returning * into s;
  cn := s.cn_prefix || lpad((s.cn_next - 1)::text, 4, '0');
  pos := coalesce(r.place_of_supply, 'HR');
  select * into g from public.acc_sale_split(amt, pos);
  insert into public.acc_sale_refunds (cf_refund_id, sale_id, cf_payment_id, order_id, invoice_no, cn_no, refund_time, refund_amount, taxable, cgst, sgst, igst, place_of_supply, raw)
  values (rid, r.id, coalesce(r.cf_payment_id, p->>'cf_payment_id', ''), coalesce(r.order_id, p->>'order_id', ''), r.invoice_no, cn,
          coalesce(nullif(p->>'refund_time', '')::timestamptz, now()), amt, g.taxable, g.cgst, g.sgst, g.igst, pos, p->'raw');
  if r.id is not null then
    update public.acc_sales set refunded = true, refund_amount = refund_amount + amt, refund_ids = refund_ids || to_jsonb(rid),
           refund_type = case when refund_amount + amt >= txn_amount then 'FULL' else 'PARTIAL' end, updated_at = now()
     where id = r.id returning * into r;
  end if;
  return r;
end $$;

-- imports never touch a posted month
create or replace function public.acc_sales_import(p_rows jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare x jsonb; n int := 0; s public.acc_sales_settings; mx int;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  select * into s from public.acc_sales_settings where id = 1;
  select max(substring(v->>'invoice_no' from length(s.prefix) + 1)::int) into mx from jsonb_array_elements(p_rows) v
   where v->>'invoice_no' like s.prefix || '%' and substring(v->>'invoice_no' from length(s.prefix) + 1) ~ '^\d+$';
  if mx is not null and mx >= s.next_no then update public.acc_sales_settings set next_no = mx + 1 where id = 1; end if;
  for x in select * from jsonb_array_elements(p_rows) loop
    if coalesce(x->>'cf_payment_id', '') = '' then continue; end if;
    if exists (select 1 from public.acc_sales where cf_payment_id = x->>'cf_payment_id') then continue; end if;
    if nullif(trim(x->>'invoice_no'), '') is not null and exists (select 1 from public.acc_sales where invoice_no = trim(x->>'invoice_no')) then continue; end if;
    if nullif(x->>'txn_time', '') is not null and public.acc_sales_month_locked((x->>'txn_time')::timestamptz) then continue; end if;
    perform public.acc_sale_record(x || '{"source":"import"}');
    if coalesce((x->>'refunded')::boolean, false) then
      update public.acc_sales set refunded = true, refund_type = coalesce(nullif(x->>'refund_type', ''), 'FULL') where cf_payment_id = x->>'cf_payment_id';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- everything on the Close-month screen
create or replace function public.acc_sales_month_summary(p_month text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a timestamptz; b timestamptz; s public.acc_sales_settings; m public.acc_sales_months; out jsonb;
        sales jsonb; refunds jsonb; inv jsonb; cn jsonb; fees jsonb; settled numeric; cum jsonb; prev_last int;
begin
  if not (public.acc_can() or coalesce(auth.role(), '') = 'service_role') then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Pick a month.'; end if;
  a := (p_month || '-01 00:00')::timestamp at time zone 'Asia/Kolkata';
  b := ((p_month || '-01')::date + interval '1 month')::timestamp at time zone 'Asia/Kolkata';
  select * into s from public.acc_sales_settings where id = 1;
  select * into m from public.acc_sales_months where month = p_month;

  -- 1. sales by place of supply
  select coalesce(jsonb_agg(x order by x->>'pos'), '[]') into sales from (
    select jsonb_build_object('pos', place_of_supply, 'count', count(*), 'gross', sum(txn_amount), 'taxable', sum(taxable),
                              'cgst', sum(cgst), 'sgst', sum(sgst), 'igst', sum(igst)) x
      from public.acc_sales where status = 'SUCCESS' and txn_time >= a and txn_time < b group by place_of_supply) q;
  -- 2. refunds by place of supply
  select coalesce(jsonb_agg(x order by x->>'pos'), '[]') into refunds from (
    select jsonb_build_object('pos', place_of_supply, 'count', count(*), 'gross', sum(refund_amount), 'taxable', sum(taxable),
                              'cgst', sum(cgst), 'sgst', sum(sgst), 'igst', sum(igst)) x
      from public.acc_sale_refunds where refund_time >= a and refund_time < b group by place_of_supply) q;

  -- 7. invoice series (numbers in the current prefix), gaps, missing numbers
  with nums as (
    select substring(invoice_no from length(s.prefix) + 1)::int n from public.acc_sales
     where status = 'SUCCESS' and txn_time >= a and txn_time < b and invoice_no like s.prefix || '%' and substring(invoice_no from length(s.prefix) + 1) ~ '^\d+$'),
  rng as (select min(n) lo, max(n) hi, count(*) c from nums)
  select jsonb_build_object('prefix', s.prefix, 'first', rng.lo, 'last', rng.hi, 'count', rng.c,
           'gaps', coalesce((select jsonb_agg(g) from (select g from generate_series(rng.lo, rng.hi) g
                                where not exists (select 1 from public.acc_sales x where x.invoice_no = s.prefix || g) limit 50) z), '[]'),
           'other_prefix', (select count(*) from public.acc_sales where status = 'SUCCESS' and txn_time >= a and txn_time < b and invoice_no is not null
                              and not (invoice_no like s.prefix || '%' and substring(invoice_no from length(s.prefix) + 1) ~ '^\d+$')),
           'without_invoice', (select count(*) from public.acc_sales where status = 'SUCCESS' and txn_time >= a and txn_time < b and invoice_no is null),
           'cancelled', 0)
    into inv from rng;
  -- the series should carry on from the previous month
  select max(substring(invoice_no from length(s.prefix) + 1)::int) into prev_last from public.acc_sales
   where status = 'SUCCESS' and txn_time < a and invoice_no like s.prefix || '%' and substring(invoice_no from length(s.prefix) + 1) ~ '^\d+$';
  inv := inv || jsonb_build_object('previous_last', prev_last);
  select jsonb_build_object('prefix', s.cn_prefix, 'first', min(cn_no), 'last', max(cn_no), 'count', count(*),
           'without_cn', count(*) filter (where cn_no is null))
    into cn from public.acc_sale_refunds where refund_time >= a and refund_time < b;

  -- 4. Cashfree fees on this month's payments and refunds (exempt = no GST charged on the fee)
  select jsonb_build_object(
      'total', coalesce(sum(service_charge), 0), 'gst', coalesce(sum(service_tax), 0),
      'exempt', coalesce(sum(service_charge) filter (where coalesce(service_tax, 0) = 0), 0),
      'taxable', coalesce(sum(service_charge) filter (where coalesce(service_tax, 0) > 0), 0),
      'missing', count(*) filter (where service_charge is null))
    into fees from (
      select service_charge, service_tax from public.acc_sales where status = 'SUCCESS' and txn_time >= a and txn_time < b
      union all
      select service_charge, service_tax from public.acc_sale_refunds where refund_time >= a and refund_time < b and service_charge is not null) f;

  -- 5. paid out to PNB this month
  select coalesce(sum(amount_settled), 0) into settled from public.acc_cf_settlements where settlement_date >= a and settlement_date < b;

  -- 6. expected Cashfree balance at month end, from everything we hold up to then
  select jsonb_build_object(
      'sales', (select coalesce(sum(txn_amount), 0) from public.acc_sales where status = 'SUCCESS' and txn_time < b),
      'refunds', (select coalesce(sum(refund_amount), 0) from public.acc_sale_refunds where refund_time < b),
      'fees', (select coalesce(sum(service_charge), 0) from public.acc_sales where status = 'SUCCESS' and txn_time < b),
      'fee_gst', (select coalesce(sum(service_tax), 0) from public.acc_sales where status = 'SUCCESS' and txn_time < b),
      'settled', (select coalesce(sum(amount_settled), 0) from public.acc_cf_settlements where settlement_date < b),
      'since', (select min(txn_time) from public.acc_sales where status = 'SUCCESS'))
    into cum;

  return jsonb_build_object('month', p_month, 'from', a, 'to', b, 'last_day', to_char((p_month || '-01')::date + interval '1 month' - interval '1 day', 'YYYY-MM-DD'),
    'sales', sales, 'refunds', refunds, 'invoices', inv, 'credit_notes', cn, 'fees', fees, 'settled', settled, 'cumulative', cum,
    'month_row', to_jsonb(m));
end $$;

revoke execute on function public.acc_sale_split(numeric, text), public.acc_sale_refund(jsonb), public.acc_sales_month_locked(timestamptz) from public, anon, authenticated;
revoke execute on function public.acc_sales_month_save(text, text, numeric, numeric, numeric, text), public.acc_sales_month_summary(text) from public, anon;
grant execute on function public.acc_sales_month_save(text, text, numeric, numeric, numeric, text), public.acc_sales_month_summary(text) to authenticated;
