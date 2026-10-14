// =====================================================================
// STAGE 19d — "cashfree-hook" Edge Function: Cashfree payments → acc_sales
//
// Cashfree Payment Gateway webhooks (API version 2023-08-01) POST here:
//   PAYMENT_SUCCESS_WEBHOOK, PAYMENT_FAILED_WEBHOOK, PAYMENT_USER_DROPPED_WEBHOOK
//     → one row per payment; a success gets the next invoice number (acc_sale_record)
//   REFUND_STATUS_WEBHOOK → marks the payment refunded (acc_sale_refund)
// Cashfree allows one webhook URL (the Dubuddy app's), so it also PULLS:
//   POST {hours} with x-cron-key (pg_cron every 10 min, stage19e) or an
//   Accounts person's login ("Sync now") → reads /pg/recon for the window,
//   then each new payment's order + payment details, oldest first; refunds
//   (credit notes), payouts to PNB and each payment's Cashfree fee (stage19f).
// Place of supply: order_tags.state_code from the app (stage19g); none ⇒ HR by default.
// Every call is checked with Cashfree's signature:
//   x-webhook-signature = base64( HMAC-SHA256( x-webhook-timestamp + raw body, secret key ) )
//
// Secrets (Supabase → Edge Functions → Secrets):
//   CASHFREE_APP_ID, CASHFREE_SECRET   (Cashfree → Developers → API Keys, Production)
//   CASHFREE_ENV     "sandbox" for test keys; anything else = production
//
// DEPLOY: name exactly  cashfree-hook , "Verify JWT" OFF (Cashfree has no
// Supabase login; the signature check protects it).
// Webhook URL for Cashfree → Developers → Webhooks:
//   https://bzhnzrmnbphkcasvrsnc.supabase.co/functions/v1/cashfree-hook
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_ID = Deno.env.get("CASHFREE_APP_ID") || "", SECRET = Deno.env.get("CASHFREE_SECRET") || "";
const API = (Deno.env.get("CASHFREE_ENV") || "").toLowerCase() === "sandbox" ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function signed(ts: string, raw: string, sig: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ts + raw)));
  const want = btoa(String.fromCharCode(...mac));
  if (want.length !== sig.length) return false;
  let d = 0; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

// Cashfree's own order (the "Cashfree Order ID" column, and order_tags.state_code); best effort
async function cfOrder(orderId: string): Promise<any> {
  if (!APP_ID || !orderId) return {};
  try {
    const r = await fetch(API + "/orders/" + encodeURIComponent(orderId), { headers: { "x-client-id": APP_ID, "x-client-secret": SECRET, "x-api-version": "2023-08-01" } });
    return await r.json();
  } catch { return {}; }
}
// place of supply sent by the app at checkout: order_tags.state_code ("DL")
const stateOf = (...orders: any[]) => { for (const o of orders) { const t = o?.order_tags; const v = t && (t.state_code || t.STATE_CODE || t.state); if (v) return String(v).trim().toUpperCase(); } return ""; };

// the payment-mode names Cashfree's transaction report uses
function mode(p: any): string {
  const g = String(p.payment_group || "").toLowerCase();
  if (g === "wallet") return "Wallet";
  const ins = String(p.payment_method?.upi?.upi_instrument || "").toUpperCase().replace(/\s+/g, "_");
  if (g === "upi" && ins && ins !== "UPI") return "UPI_" + ins;   // e.g. UPI_CREDIT_CARD
  return g.toUpperCase();
}

// ---------- pull: Cashfree allows one webhook (it's the app's), so we also fetch ----------
const CF_HEAD = () => ({ "x-client-id": APP_ID, "x-client-secret": SECRET, "x-api-version": "2023-08-01", "Content-Type": "application/json" });
async function cf(path: string, body?: unknown): Promise<any> {
  const r = await fetch(API + path, { method: body ? "POST" : "GET", headers: CF_HEAD(), body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Cashfree " + path.split("?")[0] + " " + r.status + ": " + (j.message || j.code || "error"));
  return j;
}
const pick = (o: any, ...k: string[]) => { for (const x of k) if (o?.[x] != null && o[x] !== "") return o[x]; return undefined; };

const num = (v: any) => v == null || v === "" ? null : Number(v);
const noMs = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
// all pages of a Cashfree list API (recon / settlement recon) for a window
async function pages(path: string, start: Date, end: Date): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const j = await cf(path, { pagination: { limit: 100, ...(cursor ? { cursor } : {}) }, filters: { start_date: noMs(start), end_date: noMs(end) } });
    const d = Array.isArray(j.data) ? j.data : [];
    out.push(...d);
    cursor = j.cursor || null;
    if (!cursor || d.length < 100) break;
  }
  return out;
}
// fee + settlement for one order (available right after the payment; UTR once paid out)
async function orderFees(orderId: string) {
  if (!APP_ID || !orderId) return;
  try {
    const j = await cf("/orders/" + encodeURIComponent(orderId) + "/settlements");
    if (j && j.cf_payment_id && j.service_charge != null) {
      await admin.from("acc_sales").update({ service_charge: num(j.service_charge), service_tax: num(j.service_tax), settlement_amount: num(j.settlement_amount),
        settlement_utr: j.transfer_utr || null, settlement_date: j.transfer_time || null, cf_settlement_id: j.cf_settlement_id != null ? String(j.cf_settlement_id) : null })
        .eq("cf_payment_id", String(j.cf_payment_id));
    }
  } catch (_) { /* not settled / not found yet: the next sync tries again */ }
}

// Cashfree's reconciliation for the window:
//  /recon             → PAYMENT (new sales), REFUND (credit notes), SETTLEMENT (payouts to PNB)
//  /settlement/recon  → per payment / refund: fee, GST on fee, settled amount, UTR, date
// then fees for any recent sale still without them. New sales go in oldest first.
async function sync(hours: number) {
  if (!APP_ID || !SECRET) throw new Error("Add CASHFREE_APP_ID and CASHFREE_SECRET (Payment Gateway → Developers → API Keys) to the Supabase secrets.");
  const end = new Date(Date.now() - 5 * 60e3), start = new Date(end.getTime() - hours * 3600e3);
  const events = await pages("/recon", start, end);
  const type = (e: any) => String(pick(e, "event_type", "type") || "").toUpperCase();
  // sales and refunds before the warehouse started were invoiced in the old sheet: never renumber them
  const { data: cfg } = await admin.from("acc_sales_settings").select("sync_from").eq("id", 1).single();
  const from = cfg?.sync_from ? new Date(cfg.sync_from).getTime() : 0;
  const after = (e: any, ...k: string[]) => { const t = pick(e, ...k); return !from || (t && new Date(t).getTime() >= from); };
  const pays = events.filter((e) => type(e) === "PAYMENT" && pick(e, "cf_payment_id", "payment_id") && after(e, "payment_time", "event_time"));
  const refunds = events.filter((e) => type(e) === "REFUND" && after(e, "refund_processed_at", "event_time"));
  const payouts = events.filter((e) => type(e) === "SETTLEMENT" && pick(e, "cf_settlement_id"));
  const ids = [...new Set(pays.map((e) => String(pick(e, "cf_payment_id", "payment_id"))))];
  const have = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("acc_sales").select("cf_payment_id, status").in("cf_payment_id", ids.slice(i, i + 200));
    (data || []).forEach((r: any) => { if (r.status === "SUCCESS") have.add(r.cf_payment_id); });
  }
  const rows: any[] = [];
  const orders: Record<string, any> = {};
  for (const id of ids) {
    if (have.has(id)) continue;
    const e = pays.find((x) => String(pick(x, "cf_payment_id", "payment_id")) === id);
    const oid = String(pick(e, "order_id") || "");
    let p: any = {}, o: any = {};
    try {
      o = orders[oid] = orders[oid] || await cf("/orders/" + encodeURIComponent(oid));
      const list = await cf("/orders/" + encodeURIComponent(oid) + "/payments");
      p = (Array.isArray(list) ? list : []).find((x: any) => String(x.cf_payment_id) === id) || {};
    } catch (_) { /* fall back to what the recon row has */ }
    const c = o.customer_details || {};
    rows.push({
      cf_payment_id: id, order_id: oid, cf_order_id: o.cf_order_id ? String(o.cf_order_id) : "", state_code: stateOf(o),
      txn_time: pick(p, "payment_time") || pick(e, "payment_time", "event_time") || new Date().toISOString(),
      order_amount: pick(o, "order_amount") ?? pick(e, "order_amount", "event_amount"), txn_amount: pick(p, "payment_amount") ?? pick(e, "payment_amount", "event_amount", "order_amount"),
      currency: pick(p, "payment_currency") || pick(e, "event_currency") || "INR",
      customer_phone: String(pick(c, "customer_phone") || pick(e, "customer_phone") || ""), customer_email: String(pick(c, "customer_email") || pick(e, "customer_email") || ""),
      customer_name: String(pick(c, "customer_name") || pick(e, "customer_name") || ""), customer_id: String(pick(c, "customer_id") || ""),
      payment_mode: p.payment_group ? mode(p) : String(pick(e, "payment_mode", "payment_group") || "").toUpperCase(),
      status: String(pick(p, "payment_status") || pick(e, "event_status") || "").toUpperCase(), message: String(pick(p, "payment_message") || ""),
      raw: { recon: e, payment: p },
    });
  }
  rows.sort((a, b) => String(a.txn_time).localeCompare(String(b.txn_time)));
  let added = 0;
  for (const r of rows) { const { error } = await admin.rpc("acc_sale_record", { p: r }); if (error) throw new Error(error.message); if (r.status === "SUCCESS") added++; }
  // refunds → credit notes
  let cns = 0;
  for (const e of refunds) {
    const { data } = await admin.rpc("acc_sale_refund", { p: { cf_payment_id: String(pick(e, "cf_payment_id", "payment_id") || ""), order_id: String(pick(e, "order_id") || ""),
      cf_refund_id: String(pick(e, "refund_id", "cf_refund_id", "event_id") || ""), refund_amount: pick(e, "event_amount", "refund_amount"),
      refund_status: String(pick(e, "event_status", "refund_status") || "SUCCESS"), refund_time: pick(e, "refund_processed_at", "event_time"), raw: e } });
    if (data) cns++;
  }
  // payouts to PNB
  for (const e of payouts) {
    await admin.from("acc_cf_settlements").upsert({ cf_settlement_id: String(e.cf_settlement_id), settlement_date: pick(e, "settlement_date", "event_time") || null,
      amount_settled: num(pick(e, "amount_settled", "event_settlement_amount", "event_amount")) ?? 0, payment_amount: num(e.payment_amount),
      service_charge: num(e.service_charge), service_tax: num(e.service_tax), adjustment: num(e.adjustment), utr: pick(e, "settlement_utr", "utr") || null,
      payment_from: e.payment_from || null, payment_till: e.payment_till || null, status: pick(e, "event_status", "status") || null, raw: e, updated_at: new Date().toISOString() });
  }
  // fee + settlement per payment / refund
  let fees = 0;
  const srecon = await pages("/settlement/recon", start, end);
  for (const e of srecon) {
    const t = type(e), pid = String(pick(e, "cf_payment_id") || "");
    const patch = { service_charge: num(pick(e, "payment_service_charge", "service_charge")), service_tax: num(pick(e, "payment_service_tax", "service_tax")),
      settlement_amount: num(e.event_settlement_amount), settlement_utr: pick(e, "settlement_utr") || null, settlement_date: pick(e, "settlement_date") || null };
    if (t === "PAYMENT" && pid) { await admin.from("acc_sales").update({ ...patch, cf_settlement_id: e.cf_settlement_id != null ? String(e.cf_settlement_id) : null }).eq("cf_payment_id", pid); fees++; }
    else if (t === "REFUND" && pick(e, "refund_id")) { await admin.from("acc_sale_refunds").update(patch).eq("cf_refund_id", String(e.refund_id)); }
  }
  // recent sales still without a fee (not settled yet): ask per order, a few each run
  const since = new Date(Date.now() - 60 * 86400e3).toISOString();
  const { data: noFee } = await admin.from("acc_sales").select("order_id").eq("status", "SUCCESS").is("service_charge", null).gte("txn_time", since).limit(30);
  for (const r of noFee || []) await orderFees(r.order_id);
  return { events: events.length, payments: ids.length, added, refunds: refunds.length, credit_notes: cns, payouts: payouts.length, fee_rows: fees, fee_lookups: (noFee || []).length };
}
async function note(n: unknown) { await admin.from("acc_sales_settings").update({ last_sync_at: new Date().toISOString(), last_sync_note: n }).eq("id", 1); }

// who may ask for a sync: the 10-minute cron (x-cron-key) or an Accounts person
async function allowedToSync(req: Request): Promise<boolean> {
  const key = req.headers.get("x-cron-key") || "";
  if (key) { const { data } = await admin.from("acc_sales_cron").select("cron_key").eq("id", 1).single(); return !!data && data.cron_key === key; }
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data } = await user.rpc("acc_can");
  return data === true;
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: true, hint: "Cashfree webhooks only" });
  // a sync request (no Cashfree signature)
  if (!req.headers.get("x-webhook-signature")) {
    const send = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
    if (!(await allowedToSync(req))) return send({ error: "Not allowed" }, 403);
    const b = await req.json().catch(() => ({}));
    try { const r = await sync(Math.min(Math.max(Number(b.hours) || 48, 1), 24 * 62)); await note({ ok: true, ...r }); return send(r); }
    catch (e) { const m = (e as Error).message; await note({ ok: false, error: m }); return send({ error: m }); }
  }
  if (!SECRET) return json({ error: "CASHFREE_SECRET is not set" }, 503);
  const raw = await req.text();
  const ts = req.headers.get("x-webhook-timestamp") || "", sig = req.headers.get("x-webhook-signature") || "";
  if (!ts || !sig || !(await signed(ts, raw, sig))) return json({ error: "bad signature" }, 401);

  let ev: any;
  try { ev = JSON.parse(raw); } catch { return json({ error: "not JSON" }, 400); }
  const type = String(ev.type || ""), d = ev.data || {};
  try {
    if (type.startsWith("PAYMENT_") && d.payment) {
      const o = d.order || {}, p = d.payment, c = d.customer_details || {};
      const full = await cfOrder(String(o.order_id || ""));
      const { error } = await admin.rpc("acc_sale_record", { p: {
        cf_payment_id: String(p.cf_payment_id), order_id: String(o.order_id || ""), cf_order_id: full.cf_order_id ? String(full.cf_order_id) : "",
        state_code: stateOf(o, full),
        txn_time: p.payment_time || ev.event_time || new Date().toISOString(),
        order_amount: o.order_amount, txn_amount: p.payment_amount ?? o.order_amount, currency: p.payment_currency || o.order_currency || "INR",
        customer_phone: String(c.customer_phone || ""), customer_email: String(c.customer_email || ""), customer_name: String(c.customer_name || ""),
        customer_id: String(c.customer_id || ""), payment_mode: mode(p), status: String(p.payment_status || ""), message: String(p.payment_message || ""),
        raw: ev } });
      if (error) throw new Error(error.message);
      if (String(p.payment_status || "").toUpperCase() === "SUCCESS") await orderFees(String(o.order_id || ""));
    } else if (type.startsWith("REFUND_") && d.refund) {
      const r = d.refund;
      const { error } = await admin.rpc("acc_sale_refund", { p: {
        cf_payment_id: r.cf_payment_id != null ? String(r.cf_payment_id) : "", order_id: String(r.order_id || ""), cf_refund_id: String(r.cf_refund_id || r.refund_id || ""),
        refund_amount: r.refund_amount, refund_status: String(r.refund_status || "") } });
      if (error) throw new Error(error.message);
    }
    // anything else (test pings, other events) is acknowledged and ignored
    return json({ ok: true });
  } catch (e) {
    console.error("cashfree-hook", type, (e as Error).message);
    return json({ error: (e as Error).message }, 500);   // Cashfree retries on non-2xx
  }
});
