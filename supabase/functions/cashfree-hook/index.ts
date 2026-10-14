// =====================================================================
// STAGE 19d — "cashfree-hook" Edge Function: Cashfree payments → acc_sales
//
// Cashfree Payment Gateway webhooks (API version 2023-08-01) POST here:
//   PAYMENT_SUCCESS_WEBHOOK, PAYMENT_FAILED_WEBHOOK, PAYMENT_USER_DROPPED_WEBHOOK
//     → one row per payment; a success gets the next invoice number (acc_sale_record)
//   REFUND_STATUS_WEBHOOK → marks the payment refunded (acc_sale_refund)
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

// Cashfree's own order id (the "Cashfree Order ID" column); best effort
async function cfOrderId(orderId: string): Promise<string> {
  if (!APP_ID || !orderId) return "";
  try {
    const r = await fetch(API + "/orders/" + encodeURIComponent(orderId), { headers: { "x-client-id": APP_ID, "x-client-secret": SECRET, "x-api-version": "2023-08-01" } });
    const j = await r.json();
    return j.cf_order_id ? String(j.cf_order_id) : "";
  } catch { return ""; }
}

// the payment-mode names Cashfree's transaction report uses
function mode(p: any): string {
  const g = String(p.payment_group || "").toLowerCase();
  if (g === "wallet") return "Wallet";
  if (g === "upi" && p.payment_method?.upi?.upi_instrument) return "UPI_" + String(p.payment_method.upi.upi_instrument).toUpperCase().replace(/\s+/g, "_");
  return g.toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true, hint: "Cashfree webhooks only" });
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
      const { error } = await admin.rpc("acc_sale_record", { p: {
        cf_payment_id: String(p.cf_payment_id), order_id: String(o.order_id || ""), cf_order_id: await cfOrderId(String(o.order_id || "")),
        txn_time: p.payment_time || ev.event_time || new Date().toISOString(),
        order_amount: o.order_amount, txn_amount: p.payment_amount ?? o.order_amount, currency: p.payment_currency || o.order_currency || "INR",
        customer_phone: String(c.customer_phone || ""), customer_email: String(c.customer_email || ""), customer_name: String(c.customer_name || ""),
        customer_id: String(c.customer_id || ""), payment_mode: mode(p), status: String(p.payment_status || ""), message: String(p.payment_message || ""),
        raw: ev } });
      if (error) throw new Error(error.message);
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
