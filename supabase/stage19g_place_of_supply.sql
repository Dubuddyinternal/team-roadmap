-- =====================================================================
-- STAGE 19g — place of supply (state) on every sale and refund
--
-- · acc_gst_states: the 36 states / UTs — 2-letter code, GST state number, name.
-- · acc_sales.place_of_supply is the state code; state_source says where it
--   came from: 'order_tags' (Cashfree order_tags.state_code, sent by the app),
--   'import', or 'default' (no address on record ⇒ supplier's state, HR).
-- · Tax split (price includes 18% GST): taxable = round(amount / 1.18, 2),
--   gst = amount − taxable; HR → CGST = round(gst / 2, 2), SGST = gst − CGST;
--   any other state → IGST = gst. Refunds copy the original sale's state.
-- · Existing rows keep their invoice numbers and amounts; they are marked
--   state_source = 'default' (HR).
-- Run after stage19f. Safe to run again.
-- =====================================================================

create table if not exists public.acc_gst_states (
  code   text primary key,          -- 2-letter code used by Zoho / order_tags
  gst_no text not null unique,      -- GST state code number, e.g. 07
  name   text not null
);
insert into public.acc_gst_states (code, gst_no, name) values
  ('JK','01','Jammu and Kashmir'), ('HP','02','Himachal Pradesh'), ('PB','03','Punjab'), ('CH','04','Chandigarh'),
  ('UK','05','Uttarakhand'), ('HR','06','Haryana'), ('DL','07','Delhi'), ('RJ','08','Rajasthan'), ('UP','09','Uttar Pradesh'),
  ('BR','10','Bihar'), ('SK','11','Sikkim'), ('AR','12','Arunachal Pradesh'), ('NL','13','Nagaland'), ('MN','14','Manipur'),
  ('MZ','15','Mizoram'), ('TR','16','Tripura'), ('ML','17','Meghalaya'), ('AS','18','Assam'), ('WB','19','West Bengal'),
  ('JH','20','Jharkhand'), ('OD','21','Odisha'), ('CG','22','Chhattisgarh'), ('MP','23','Madhya Pradesh'), ('GJ','24','Gujarat'),
  ('DN','26','Dadra and Nagar Haveli and Daman and Diu'), ('MH','27','Maharashtra'), ('KA','29','Karnataka'), ('GA','30','Goa'),
  ('LD','31','Lakshadweep'), ('KL','32','Kerala'), ('TN','33','Tamil Nadu'), ('PY','34','Puducherry'),
  ('AN','35','Andaman and Nicobar Islands'), ('TS','36','Telangana'), ('AP','37','Andhra Pradesh'), ('LA','38','Ladakh')
on conflict (code) do update set gst_no = excluded.gst_no, name = excluded.name;
alter table public.acc_gst_states enable row level security;
drop policy if exists "anyone signed in reads states" on public.acc_gst_states;
create policy "anyone signed in reads states" on public.acc_gst_states for select to authenticated using (true);
grant select on public.acc_gst_states to authenticated;

alter table public.acc_sales add column if not exists state_source text not null default 'default';
alter table public.acc_sale_refunds add column if not exists state_source text not null default 'default';
-- backfill: everything so far had no state ⇒ HR by default (amounts and numbers untouched)
update public.acc_sales set state_source = 'default' where state_source is null or state_source = '';

-- a known state code, or null
create or replace function public.acc_state(p text)
returns text language sql stable security definer set search_path = '' as $$
  select code from public.acc_gst_states where code = upper(trim(coalesce(p, '')))
$$;

-- GST inside a GST-inclusive amount, by place of supply (the rule above)
create or replace function public.acc_sale_split(p_amount numeric, p_pos text, out taxable numeric, out cgst numeric, out sgst numeric, out igst numeric)
language plpgsql stable security definer set search_path = '' as $$
declare r numeric; g numeric;
begin
  select gst_rate into r from public.acc_sales_settings where id = 1;
  taxable := round(p_amount / (1 + r / 100), 2);
  g := p_amount - taxable;
  if coalesce(p_pos, 'HR') = 'HR' then cgst := round(g / 2, 2); sgst := g - cgst; igst := 0;
  else cgst := 0; sgst := 0; igst := g; end if;
end $$;

-- one payment (webhook / sync / import); state from order_tags, else HR by default
create or replace function public.acc_sale_record(p jsonb)
returns public.acc_sales language plpgsql security definer set search_path = '' as $$
declare r public.acc_sales; amt numeric := coalesce(nullif(p->>'txn_amount', '')::numeric, nullif(p->>'order_amount', '')::numeric, 0); g record;
        st text := public.acc_state(p->>'state_code'); src text;
begin
  if coalesce(p->>'cf_payment_id', '') = '' then raise exception 'Payment id missing.'; end if;
  src := case when st is null then 'default' else coalesce(nullif(p->>'state_source', ''), 'order_tags') end;
  st := coalesce(st, 'HR');
  select * into g from public.acc_sale_split(amt, st);
  insert into public.acc_sales (cf_payment_id, order_id, cf_order_id, txn_time, order_amount, txn_amount, currency, taxable, cgst, sgst, igst, place_of_supply, state_source,
                                customer_phone, customer_email, customer_name, customer_id, payment_mode, status, message, captured, source, raw)
  values (p->>'cf_payment_id', coalesce(p->>'order_id', ''), coalesce(p->>'cf_order_id', ''), nullif(p->>'txn_time', '')::timestamptz,
          coalesce(nullif(p->>'order_amount', '')::numeric, amt), amt, coalesce(nullif(p->>'currency', ''), 'INR'), g.taxable, g.cgst, g.sgst, g.igst, st, src,
          coalesce(p->>'customer_phone', ''), coalesce(p->>'customer_email', ''), coalesce(p->>'customer_name', ''), coalesce(p->>'customer_id', ''),
          coalesce(p->>'payment_mode', ''), upper(coalesce(p->>'status', '')), coalesce(p->>'message', ''), 1, coalesce(p->>'source', 'webhook'), p->'raw')
  on conflict (cf_payment_id) do update
     set status = case when public.acc_sales.status = 'SUCCESS' then 'SUCCESS' else excluded.status end,   -- a late "failed" never undoes a success
         message = case when public.acc_sales.status = 'SUCCESS' then public.acc_sales.message else excluded.message end,
         cf_order_id = coalesce(nullif(excluded.cf_order_id, ''), public.acc_sales.cf_order_id),
         customer_email = coalesce(nullif(excluded.customer_email, ''), public.acc_sales.customer_email),
         customer_name = coalesce(nullif(excluded.customer_name, ''), public.acc_sales.customer_name),
         -- a state arriving before the invoice exists may still fix the default; an issued invoice never changes
         place_of_supply = case when public.acc_sales.invoice_no is null and excluded.state_source <> 'default' then excluded.place_of_supply else public.acc_sales.place_of_supply end,
         state_source = case when public.acc_sales.invoice_no is null and excluded.state_source <> 'default' then excluded.state_source else public.acc_sales.state_source end,
         taxable = case when public.acc_sales.invoice_no is null then excluded.taxable else public.acc_sales.taxable end,
         cgst = case when public.acc_sales.invoice_no is null and excluded.state_source <> 'default' then excluded.cgst else public.acc_sales.cgst end,
         sgst = case when public.acc_sales.invoice_no is null and excluded.state_source <> 'default' then excluded.sgst else public.acc_sales.sgst end,
         igst = case when public.acc_sales.invoice_no is null and excluded.state_source <> 'default' then excluded.igst else public.acc_sales.igst end,
         raw = coalesce(excluded.raw, public.acc_sales.raw), updated_at = now()
  returning * into r;
  if r.status = 'SUCCESS' and r.invoice_no is null then
    update public.acc_sales set invoice_no = coalesce(nullif(trim(p->>'invoice_no'), ''), public.acc_sale_next_invoice()) where id = r.id returning * into r;
  end if;
  return r;
end $$;

-- a refund: same place of supply and split rule as its sale; next credit-note number once
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
  pos := coalesce(r.place_of_supply, public.acc_state(p->>'state_code'), 'HR');
  select * into g from public.acc_sale_split(amt, pos);
  insert into public.acc_sale_refunds (cf_refund_id, sale_id, cf_payment_id, order_id, invoice_no, cn_no, refund_time, refund_amount, taxable, cgst, sgst, igst, place_of_supply, state_source, raw)
  values (rid, r.id, coalesce(r.cf_payment_id, p->>'cf_payment_id', ''), coalesce(r.order_id, p->>'order_id', ''), r.invoice_no, cn,
          coalesce(nullif(p->>'refund_time', '')::timestamptz, now()), amt, g.taxable, g.cgst, g.sgst, g.igst, pos,
          coalesce(r.state_source, case when public.acc_state(p->>'state_code') is null then 'default' else 'order_tags' end), p->'raw');
  if r.id is not null then
    update public.acc_sales set refunded = true, refund_amount = refund_amount + amt, refund_ids = refund_ids || to_jsonb(rid),
           refund_type = case when refund_amount + amt >= txn_amount then 'FULL' else 'PARTIAL' end, updated_at = now()
     where id = r.id returning * into r;
  end if;
  return r;
end $$;

revoke execute on function public.acc_state(text), public.acc_sale_split(numeric, text), public.acc_sale_record(jsonb), public.acc_sale_refund(jsonb)
  from public, anon, authenticated;
