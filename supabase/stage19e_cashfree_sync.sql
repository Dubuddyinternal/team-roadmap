-- =====================================================================
-- STAGE 19e — fetch Cashfree payments every 10 minutes
--
-- Cashfree allows only one webhook URL and the Dubuddy app already uses it,
-- so the tools pull instead: every 10 minutes pg_cron asks the
-- "cashfree-hook" function to sync the last 48 hours from Cashfree's
-- reconciliation API (new payments get invoice numbers, refunds are
-- marked). Accounts can also press "Sync now". Run after stage19d.
-- =====================================================================

alter table public.acc_sales_settings add column if not exists last_sync_at timestamptz;
alter table public.acc_sales_settings add column if not exists last_sync_note jsonb;

-- the timer's key; no one can read it through the API
create table if not exists public.acc_sales_cron (
  id       int primary key default 1 check (id = 1),
  cron_key text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
insert into public.acc_sales_cron (id) values (1) on conflict (id) do nothing;
alter table public.acc_sales_cron enable row level security;
revoke all on public.acc_sales_cron from anon, authenticated;

create or replace function public.acc_sales_tick()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url     := 'https://bzhnzrmnbphkcasvrsnc.supabase.co/functions/v1/cashfree-hook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select cron_key from public.acc_sales_cron where id = 1)),
    body    := '{"hours":48}'::jsonb,
    timeout_milliseconds := 120000);
end $$;
revoke execute on function public.acc_sales_tick() from public, anon, authenticated;

select cron.schedule('cashfree-sales-sync', '*/10 * * * *', 'select public.acc_sales_tick()');
