-- =====================================================================
-- STAGE 19d — Cashfree sales warehouse
--
-- Every Cashfree payment lands in acc_sales: the "cashfree-hook" Edge
-- Function receives Cashfree's webhooks (payment success / failed /
-- dropped, refunds) and calls acc_sale_record / acc_sale_refund. A
-- successful payment gets the next invoice number (CYBRCT4730, 4731, …)
-- and its GST split (price includes GST: taxable = amount ÷ 1.18,
-- CGST = SGST = 9% of taxable). Accounts → Sales (Cashfree) shows it like
-- the B2C sheet, downloads it, and imports Cashfree's own transaction
-- export for history or gaps. Run after stage19c. Safe to run again.
-- =====================================================================

create table if not exists public.acc_sales (
  id             uuid primary key default gen_random_uuid(),
  cf_payment_id  text not null unique,           -- "Reference Id"
  order_id       text not null default '',
  cf_order_id    text not null default '',
  invoice_no     text unique,
  txn_time       timestamptz,
  order_amount   numeric(12,2) not null default 0,
  txn_amount     numeric(12,2) not null default 0,
  currency       text not null default 'INR',
  taxable        numeric(12,2) not null default 0,
  cgst           numeric(12,2) not null default 0,
  sgst           numeric(12,2) not null default 0,
  customer_phone text not null default '',
  customer_email text not null default '',
  customer_name  text not null default '',
  customer_id    text not null default '',     -- "Customer Reference ID"
  payment_mode   text not null default '',
  status         text not null default '',     -- SUCCESS, FAILED, USER_DROPPED…
  message        text not null default '',     -- "Failure Reason"
  refunded       boolean not null default false,
  refund_type    text not null default 'NOT_REFUNDED',
  refund_amount  numeric(12,2) not null default 0,
  refund_ids     jsonb not null default '[]',
  captured       int not null default 1,
  source         text not null default 'webhook' check (source in ('webhook', 'import')),
  raw            jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists acc_sales_time on public.acc_sales (txn_time desc);
alter table public.acc_sales enable row level security;
drop policy if exists "accounts read sales" on public.acc_sales;
create policy "accounts read sales" on public.acc_sales for select to authenticated using (public.acc_can());
revoke all on public.acc_sales from anon;
grant select on public.acc_sales to authenticated;

-- invoice series and GST rate (one row)
create table if not exists public.acc_sales_settings (
  id       int primary key default 1 check (id = 1),
  prefix   text not null default 'CYBRCT',
  next_no  int not null default 4730,
  gst_rate numeric(5,2) not null default 18
);
insert into public.acc_sales_settings (id) values (1) on conflict (id) do nothing;
alter table public.acc_sales_settings enable row level security;
drop policy if exists "accounts read sales settings" on public.acc_sales_settings;
create policy "accounts read sales settings" on public.acc_sales_settings for select to authenticated using (public.acc_can());
revoke all on public.acc_sales_settings from anon;
grant select on public.acc_sales_settings to authenticated;

-- next invoice number; the row lock keeps the series gap-free and in order
create or replace function public.acc_sale_next_invoice()
returns text language plpgsql security definer set search_path = '' as $$
declare s public.acc_sales_settings;
begin
  update public.acc_sales_settings set next_no = next_no + 1 where id = 1 returning * into s;
  return s.prefix || (s.next_no - 1);
end $$;

-- GST inside a GST-inclusive amount
create or replace function public.acc_sale_gst(p_amount numeric, out taxable numeric, out half numeric)
language sql stable security definer set search_path = '' as $$
  select round(p_amount / (1 + s.gst_rate / 100), 2), round(round(p_amount / (1 + s.gst_rate / 100), 2) * s.gst_rate / 200, 2)
    from public.acc_sales_settings s where s.id = 1
$$;

-- one payment from the webhook (or import); a success gets an invoice once
create or replace function public.acc_sale_record(p jsonb)
returns public.acc_sales language plpgsql security definer set search_path = '' as $$
declare r public.acc_sales; amt numeric := coalesce(nullif(p->>'txn_amount', '')::numeric, nullif(p->>'order_amount', '')::numeric, 0); g record;
begin
  if coalesce(p->>'cf_payment_id', '') = '' then raise exception 'Payment id missing.'; end if;
  select * into g from public.acc_sale_gst(amt);
  insert into public.acc_sales (cf_payment_id, order_id, cf_order_id, txn_time, order_amount, txn_amount, currency, taxable, cgst, sgst,
                                customer_phone, customer_email, customer_name, customer_id, payment_mode, status, message, captured, source, raw)
  values (p->>'cf_payment_id', coalesce(p->>'order_id', ''), coalesce(p->>'cf_order_id', ''), nullif(p->>'txn_time', '')::timestamptz,
          coalesce(nullif(p->>'order_amount', '')::numeric, amt), amt, coalesce(nullif(p->>'currency', ''), 'INR'), g.taxable, g.half, g.half,
          coalesce(p->>'customer_phone', ''), coalesce(p->>'customer_email', ''), coalesce(p->>'customer_name', ''), coalesce(p->>'customer_id', ''),
          coalesce(p->>'payment_mode', ''), upper(coalesce(p->>'status', '')), coalesce(p->>'message', ''), 1, coalesce(p->>'source', 'webhook'), p->'raw')
  on conflict (cf_payment_id) do update
     set status = case when public.acc_sales.status = 'SUCCESS' then 'SUCCESS' else excluded.status end,   -- a late "failed" never undoes a success
         message = case when public.acc_sales.status = 'SUCCESS' then public.acc_sales.message else excluded.message end,
         cf_order_id = coalesce(nullif(excluded.cf_order_id, ''), public.acc_sales.cf_order_id),
         customer_email = coalesce(nullif(excluded.customer_email, ''), public.acc_sales.customer_email),
         customer_name = coalesce(nullif(excluded.customer_name, ''), public.acc_sales.customer_name),
         raw = coalesce(excluded.raw, public.acc_sales.raw), updated_at = now()
  returning * into r;
  if r.status = 'SUCCESS' and r.invoice_no is null then
    update public.acc_sales set invoice_no = coalesce(nullif(trim(p->>'invoice_no'), ''), public.acc_sale_next_invoice()) where id = r.id returning * into r;
  end if;
  return r;
end $$;

-- a refund on a payment (Cashfree sends one webhook per refund status)
create or replace function public.acc_sale_refund(p jsonb)
returns public.acc_sales language plpgsql security definer set search_path = '' as $$
declare r public.acc_sales; rid text := coalesce(p->>'cf_refund_id', ''); amt numeric := coalesce(nullif(p->>'refund_amount', '')::numeric, 0);
begin
  select * into r from public.acc_sales where cf_payment_id = p->>'cf_payment_id' or (coalesce(p->>'cf_payment_id', '') = '' and order_id = p->>'order_id')
   order by (status = 'SUCCESS') desc limit 1 for update;
  if r.id is null then return null; end if;
  if upper(coalesce(p->>'refund_status', '')) <> 'SUCCESS' or r.refund_ids ? rid then return r; end if;
  update public.acc_sales set refunded = true, refund_amount = refund_amount + amt, refund_ids = refund_ids || to_jsonb(rid),
         refund_type = case when refund_amount + amt >= txn_amount then 'FULL' else 'PARTIAL' end, updated_at = now()
   where id = r.id returning * into r;
  return r;
end $$;

-- Accounts imports Cashfree's transaction export (or the old B2C sheet);
-- invoice numbers in the file are kept, the series moves past them
create or replace function public.acc_sales_import(p_rows jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare x jsonb; n int := 0; s public.acc_sales_settings; mx int;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  -- move the series past the numbers in the file first, so new ones never clash
  select * into s from public.acc_sales_settings where id = 1;
  select max(substring(v->>'invoice_no' from length(s.prefix) + 1)::int) into mx from jsonb_array_elements(p_rows) v
   where v->>'invoice_no' like s.prefix || '%' and substring(v->>'invoice_no' from length(s.prefix) + 1) ~ '^\d+$';
  if mx is not null and mx >= s.next_no then update public.acc_sales_settings set next_no = mx + 1 where id = 1; end if;
  for x in select * from jsonb_array_elements(p_rows) loop
    if coalesce(x->>'cf_payment_id', '') = '' then continue; end if;
    if exists (select 1 from public.acc_sales where cf_payment_id = x->>'cf_payment_id') then continue; end if;
    if nullif(trim(x->>'invoice_no'), '') is not null and exists (select 1 from public.acc_sales where invoice_no = trim(x->>'invoice_no')) then continue; end if;
    perform public.acc_sale_record(x || '{"source":"import"}');
    if coalesce((x->>'refunded')::boolean, false) then
      update public.acc_sales set refunded = true, refund_type = coalesce(nullif(x->>'refund_type', ''), 'FULL') where cf_payment_id = x->>'cf_payment_id';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- invoice series and GST rate
create or replace function public.acc_sales_settings_save(p_prefix text, p_next int, p_rate numeric)
returns public.acc_sales_settings language plpgsql security definer set search_path = '' as $$
declare s public.acc_sales_settings;
begin
  if not public.acc_can() then raise exception 'You need the “Accounts: payments & payroll” permission.'; end if;
  if coalesce(trim(p_prefix), '') !~ '^[A-Za-z0-9/-]{1,12}$' then raise exception 'The prefix can have letters, numbers, / and - (up to 12).'; end if;
  if p_next is null or p_next < 1 then raise exception 'Enter the next invoice number.'; end if;
  if exists (select 1 from public.acc_sales where invoice_no = trim(p_prefix) || p_next) then raise exception 'Invoice % is already used.', trim(p_prefix) || p_next; end if;
  if p_rate is null or p_rate < 0 or p_rate > 28 then raise exception 'Enter the GST rate (0–28%%).'; end if;
  update public.acc_sales_settings set prefix = trim(p_prefix), next_no = p_next, gst_rate = p_rate where id = 1 returning * into s;
  return s;
end $$;

revoke execute on function public.acc_sale_next_invoice(), public.acc_sale_gst(numeric), public.acc_sale_record(jsonb), public.acc_sale_refund(jsonb)
  from public, anon, authenticated;
revoke execute on function public.acc_sales_import(jsonb), public.acc_sales_settings_save(text, int, numeric) from public, anon;
grant execute on function public.acc_sales_import(jsonb), public.acc_sales_settings_save(text, int, numeric) to authenticated;
