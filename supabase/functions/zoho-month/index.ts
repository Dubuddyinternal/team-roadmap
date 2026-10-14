// =====================================================================
// STAGE 19f — "zoho-month" Edge Function: close a month of Cashfree sales
// into Zoho Books (India). Accounts → Monthly checks → Close month.
//
//   { action: "check",   month }        → summary + checks (incl. "already in Zoho?")
//   { action: "preview", month }        → the exact Zoho payloads, NOTHING is sent
//                                          (always, whatever ZOHO_DRY_RUN says)
//   { action: "post",    month, ack }   → creates them (dry run if ZOHO_DRY_RUN isn't
//                                          "false"); all checks green, ack = amber ones seen
//   { action: "unlock",  month }        → super admin only, once the Zoho entries are deleted
//
// All dated the last day of the month:
//   A. per place of supply: invoice "App Subscription" (SAC 999299, GST-inclusive,
//      GST18 for HR else IGST18), ref CF-SALES-YYYYMM-<STATE>, marked sent,
//      + customer payment into "Cashfree"
//   B. per place of supply: credit note (ref CF-REFUND-YYYYMM-<STATE>) + refund from "Cashfree"
//   C. expense "Payment Gateway Charges" paid through "Cashfree", vendor Cashfree
//      (GSTIN 29AAICP2912R1ZR, KA → HR): exempt fee line + taxable fee line with IGST18,
//      from the Cashfree GST invoice typed in by the admin (+ its PDF)
//   D. payouts to PNB are NOT posted (a Zoho bank rule moves them from "Cashfree")
// Before each create it searches Zoho by reference number and skips what exists.
// Every write (and every failed call) goes to acc_zoho_log; tokens are never logged.
//
// Secrets: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID?, ZOHO_DRY_RUN
// DEPLOY: name exactly  zoho-month , "Verify JWT" OFF (it checks the login itself:
// Accounts permission, or the internal key for check / preview only).
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!, ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!, SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API = "https://www.zohoapis.in/books/v3";
const ORG = Deno.env.get("ZOHO_ORG_ID") || "60041846412";
const ENV_DRY = (Deno.env.get("ZOHO_DRY_RUN") || "true").toLowerCase() !== "false";
const CID = Deno.env.get("ZOHO_CLIENT_ID") || "", CSEC = Deno.env.get("ZOHO_CLIENT_SECRET") || "", RTOK = Deno.env.get("ZOHO_REFRESH_TOKEN") || "";
const HAS_CREDS = !!(CID && CSEC && RTOK);
const OUR_STATE = "HR";
const CUSTOMER = "B2C Customers – App", VENDOR = "Cashfree Payments India Pvt Ltd", VENDOR_GSTIN = "29AAICP2912R1ZR", VENDOR_STATE = "KA";
const ITEM = "App Subscription", SAC = "999299";
const CLEARING = "Cashfree", FEES_ACCOUNT = "Payment Gateway Charges";
const LINK = (kind: string, id: string) => `https://books.zoho.in/app/${ORG}#/${kind}/${id}`;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const money = (n: number) => Math.round(Number(n || 0) * 100) / 100;

// ---------- Zoho ----------
let accessToken = "", tokenUntil = 0, dry = true, dryN = 0;
let steps: any[] = [];
async function token(): Promise<string> {
  if (accessToken && Date.now() < tokenUntil) return accessToken;
  const u = "https://accounts.zoho.in/oauth/v2/token?" + new URLSearchParams({ refresh_token: RTOK, client_id: CID, client_secret: CSEC, grant_type: "refresh_token" });
  const r = await fetch(u, { method: "POST" });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error("Zoho sign-in failed: " + (j.error || r.status));
  accessToken = j.access_token; tokenUntil = Date.now() + ((j.expires_in || 3600) - 120) * 1000;
  return accessToken;
}
async function log(ref: string, method: string, path: string, request: unknown, response: unknown, http: number, ok: boolean, isDry: boolean) {
  await admin.from("acc_zoho_log").insert({ action: "month", ref, method, path, request, response, http, ok, dry: isDry });
}
// reads always go to Zoho (so a preview shows real ids); writes are faked in a dry run
async function zoho(ref: string, method: string, path: string, body?: unknown, form?: FormData, label?: string): Promise<any> {
  const write = method !== "GET";
  if (write) steps.push({ step: label || ref, method, path, body: body ?? (form ? "(PDF file)" : null), dry });
  if (write && dry) {
    const id = "dry-" + (++dryN), fake: any = { code: 0, dry_run: true };
    for (const k of ["invoice", "payment", "creditnote", "creditnote_refund", "expense", "contact"]) fake[k] = { [k === "payment" ? "payment_id" : k === "creditnote_refund" ? "creditnote_refund_id" : k + "_id"]: id };
    await log(ref, method, path, body ?? "(file)", fake, 0, true, true);
    return fake;
  }
  if (!HAS_CREDS) { if (write) throw new Error("Zoho isn't connected (ZOHO_* secrets missing)."); return {}; }
  const headers: Record<string, string> = { Authorization: "Zoho-oauthtoken " + await token() };
  if (body) headers["Content-Type"] = "application/json";
  const r = await fetch(API + path + (path.includes("?") ? "&" : "?") + "organization_id=" + ORG, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const j = await r.json().catch(() => ({ message: "Not JSON (" + r.status + ")" }));
  const ok = r.ok && (j.code === 0 || j.code === undefined);
  if (write || !ok) await log(ref, method, path, body ?? (form ? "(file)" : null), j, r.status, ok, false);
  if (write) steps[steps.length - 1].response = ok ? "created" : j.message;
  if (!ok) throw new Error((j.message || "Zoho error") + " [" + r.status + "] on " + method + " " + path.split("?")[0]);
  return j;
}
// an existing document with exactly this reference number
async function findRef(kind: "invoices" | "customerpayments" | "creditnotes" | "expenses", ref: string): Promise<any | null> {
  if (!HAS_CREDS || !ref) return null;
  const j = await zoho(ref, "GET", "/" + kind + "?search_text=" + encodeURIComponent(ref));
  const list = j[kind] || [];
  return list.find((x: any) => String(x.reference_number || "").trim() === ref) || null;
}

// accounts, taxes, contacts, item — looked up by exact name
type Ctx = { accounts: Record<string, string>; taxes: Record<string, string>; exemption: string | null; customer: string | null; vendor: string | null; item: string | null; problems: string[] };
async function context(): Promise<Ctx> {
  const { data } = await admin.from("acc_zoho_settings").select("*").eq("id", 1).single();
  const accounts: Record<string, string> = { ...(data?.accounts || {}) }, taxes: Record<string, string> = { ...(data?.taxes || {}) };
  const problems: string[] = [];
  const c: Ctx = { accounts, taxes, exemption: null, customer: null, vendor: null, item: null, problems };
  if (!HAS_CREDS) { problems.push("Zoho isn't connected."); return c; }
  if (!accounts[CLEARING] || !accounts[FEES_ACCOUNT]) {
    for (let page = 1; page < 20; page++) {
      const j = await zoho("month", "GET", "/chartofaccounts?per_page=200&page=" + page);
      for (const a of j.chartofaccounts || []) if (a.account_name === CLEARING || a.account_name === FEES_ACCOUNT) accounts[a.account_name] = a.account_id;
      if (!j.page_context?.has_more_page) break;
    }
    await admin.from("acc_zoho_settings").update({ accounts }).eq("id", 1);
  }
  for (const n of [CLEARING, FEES_ACCOUNT]) if (!accounts[n]) problems.push(`Create the account “${n}” in Zoho (Accountant → Chart of Accounts)${n === CLEARING ? " as a Bank or Other Current Asset account" : " as an Expense account"}.`);
  for (const t of ["GST18", "IGST18"]) if (!taxes[t]) problems.push(`Zoho tax “${t}” not found: press “Fetch Zoho accounts”.`);
  try {
    const ex = await zoho("month", "GET", "/settings/taxexemptions");
    const hit = (ex.tax_exemptions || []).find((x: any) => /exempt/i.test((x.tax_exemption_code || "") + " " + (x.description || "")));
    c.exemption = hit ? hit.tax_exemption_id : null;
  } catch (_) { /* optional */ }
  const cu = await zoho("month", "GET", "/contacts?contact_type=customer&contact_name=" + encodeURIComponent(CUSTOMER));
  c.customer = (cu.contacts || []).find((x: any) => x.contact_name === CUSTOMER)?.contact_id || null;
  const ve = await zoho("month", "GET", "/contacts?contact_type=vendor&search_text=Cashfree");
  c.vendor = (ve.contacts || []).find((x: any) => x.gst_no === VENDOR_GSTIN || x.contact_name === VENDOR)?.contact_id || null;
  const it = await zoho("month", "GET", "/items?name=" + encodeURIComponent(ITEM));
  c.item = (it.items || []).find((x: any) => x.name === ITEM)?.item_id || null;
  return c;
}

// ---------- the month ----------
async function summary(month: string) {
  const { data, error } = await admin.rpc("acc_sales_month_summary", { p_month: month });
  if (error) throw new Error(error.message);
  return data;
}
const label = (m: string) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

async function checks(month: string, withZoho: boolean) {
  const S = await summary(month), M = S.month_row || {}, inv = S.invoices || {}, cn = S.credit_notes || {}, fees = S.fees || {};
  const out: any[] = [];
  const add = (key: string, level: "ok" | "warn" | "bad", text: string) => out.push({ key, level, text });
  const salesN = (S.sales || []).reduce((a: number, x: any) => a + Number(x.count), 0);
  // the month is over
  const lastDay = new Date(S.last_day + "T23:59:59+05:30");
  add("over", Date.now() > lastDay.getTime() ? "ok" : "bad", Date.now() > lastDay.getTime() ? label(month) + " is over." : label(month) + " isn't over yet: post after " + S.last_day + ".");
  // every sale is here (the warehouse may have started mid-month)
  const { data: cfg } = await admin.from("acc_sales_settings").select("sync_from").eq("id", 1).single();
  const from = cfg?.sync_from ? new Date(cfg.sync_from) : null;
  if (from && from > new Date(S.from) && from < new Date(S.to)) {
    const { count } = await admin.from("acc_sales").select("id", { count: "exact", head: true }).eq("status", "SUCCESS").gte("txn_time", S.from).lt("txn_time", from.toISOString());
    add("coverage", count ? "ok" : "bad", count ? "Sales before the warehouse started are imported (" + count + ")." :
      "Sales before " + from.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) +
      " aren't here yet: import them (Sales → Import CSV, from the B2C sheet), or this month's totals will be short.");
  }
  // one Zoho invoice per state: together they must equal the month's gross sales, to the paisa
  {
    const { data: rows } = await admin.from("acc_sales").select("txn_amount").eq("status", "SUCCESS").gte("txn_time", S.from).lt("txn_time", S.to).limit(100000);
    const direct = Math.round((rows || []).reduce((a: number, r: any) => a + Number(r.txn_amount) * 100, 0));
    const states = Math.round((S.sales || []).reduce((a: number, x: any) => a + Number(x.gross) * 100, 0));
    const names = (S.sales || []).map((x: any) => x.pos + " ₹" + money(x.gross)).join(" + ");
    add("statesum", direct === states ? "ok" : "bad", direct === states ? `${(S.sales || []).length || "No"} state invoice(s)${names ? ": " + names : ""} = month's gross sales ₹${money(direct / 100)}.`
      : `State invoices total ₹${money(states / 100)} but the month's sales are ₹${money(direct / 100)}.`);
  }
  add("invoices", Number(inv.without_invoice) === 0 ? "ok" : "bad", Number(inv.without_invoice) === 0 ? "Every successful payment has one invoice (" + salesN + ")." : inv.without_invoice + " successful payment(s) have no invoice number.");
  add("cns", Number(cn.without_cn || 0) === 0 ? "ok" : "bad", Number(cn.count) ? "Every refund has one credit note (" + cn.count + ": " + cn.first + "–" + cn.last + ")." : "No refunds this month.");
  const gaps = inv.gaps || [];
  add("gaps", gaps.length ? "bad" : "ok", gaps.length ? "Missing invoice numbers: " + gaps.slice(0, 10).map((g: number) => inv.prefix + g).join(", ") + (gaps.length > 10 ? " …" : "") : salesN ? "No gaps: " + inv.prefix + inv.first + " to " + inv.prefix + inv.last + "." : "No invoices this month.");
  if (inv.previous_last != null && inv.first != null && Number(inv.first) !== Number(inv.previous_last) + 1)
    add("carry", "warn", "Last month ended at " + inv.prefix + inv.previous_last + " but this month starts at " + inv.prefix + inv.first + ".");
  if (Number(inv.other_prefix)) add("prefix", "warn", inv.other_prefix + " invoice(s) use another prefix (imported); they aren't in the gap check.");
  // fees vs the Cashfree GST invoice
  const typed = M.cf_invoice_no ? { no: M.cf_invoice_no, exempt: Number(M.cf_exempt_fee || 0), taxable: Number(M.cf_taxable_fee || 0), igst: Number(M.cf_igst || 0) } : null;
  if (Number(fees.missing)) add("feesknown", "warn", fees.missing + " payment(s) don't have Cashfree's fee yet (it arrives after settlement).");
  if (!typed) add("feeinv", Number(fees.total) || salesN ? "bad" : "ok", Number(fees.total) || salesN ? "Type in Cashfree's GST invoice for " + label(month) + " (number, exempt fee, taxable fee, IGST)." : "No Cashfree fees this month.");
  else {
    const diff = money(typed.exempt + typed.taxable - Number(fees.total)), gd = money(typed.igst - Number(fees.gst));
    const igstCalc = money(typed.taxable * 0.18);
    add("feediff", Math.abs(diff) <= 5 && Math.abs(gd) <= 5 ? "ok" : "warn",
      `Cashfree invoice ${typed.no}: fees ₹${money(typed.exempt + typed.taxable)} vs ₹${money(fees.total)} from payments (difference ₹${diff}); GST ₹${typed.igst} vs ₹${money(fees.gst)} (₹${gd}).`);
    if (Math.abs(igstCalc - typed.igst) > 1) add("igst18", "warn", `IGST on the invoice (₹${typed.igst}) isn't 18% of the taxable fee (₹${igstCalc}); Zoho will book ₹${igstCalc}.`);
  }
  // posted already?
  if (M.status === "posted") add("posted", "bad", "This month is already posted to Zoho (" + new Date(M.posted_at).toLocaleDateString("en-GB") + ").");
  let ctx: Ctx | null = null;
  if (withZoho) {
    ctx = await context();
    for (const p of ctx.problems) add("zoho", "bad", p);
    if (!ctx.customer) add("customer", "warn", `Customer “${CUSTOMER}” isn't in Zoho yet; it will be created.`);
    if (!ctx.vendor) add("vendor", "warn", `Vendor “${VENDOR}” (${VENDOR_GSTIN}) isn't in Zoho yet; it will be created.`);
    if (!ctx.item) add("item", "warn", `Item “${ITEM}” isn't in Zoho; the invoice line uses the name with SAC ${SAC}.`);
    if (M.status !== "posted" && HAS_CREDS) {
      const ym = month.replace("-", "");
      const found: string[] = [];
      for (const x of S.sales || []) if (await findRef("invoices", `CF-SALES-${ym}-${x.pos}`)) found.push(`CF-SALES-${ym}-${x.pos}`);
      for (const x of S.refunds || []) if (await findRef("creditnotes", `CF-REFUND-${ym}-${x.pos}`)) found.push(`CF-REFUND-${ym}-${x.pos}`);
      if (typed && await findRef("expenses", typed.no)) found.push(typed.no);
      if (found.length) add("inzoho", "warn", "Already in Zoho (will be skipped, not duplicated): " + found.join(", ") + ".");
      else add("inzoho", "ok", "Nothing for " + label(month) + " is in Zoho yet.");
    }
  }
  return { summary: S, checks: out, ctx };
}

// the documents, in order; skips what already exists; returns ids
async function run(month: string, ctx: Ctx, S: any, prior: any) {
  const ym = month.replace("-", ""), date = S.last_day, M = S.month_row || {};
  const ids: any = { invoices: [], payments: [], creditnotes: [], refunds: [], expense: null, ...(prior || {}) };
  const save = async () => { if (!dry) await admin.from("acc_sales_months").upsert({ month, zoho: ids, updated_at: new Date().toISOString() }); };
  const acct = (n: string) => ctx.accounts[n] || (dry ? "account:" + n : (() => { throw new Error("Zoho account “" + n + "” not found."); })());
  const tax = (pos: string) => ctx.taxes[pos === OUR_STATE ? "GST18" : "IGST18"] || (dry ? "tax:" + (pos === OUR_STATE ? "GST18" : "IGST18") : "");
  // contacts
  if (!ctx.customer && ((S.sales || []).length || (S.refunds || []).length)) {
    const j = await zoho("contact", "POST", "/contacts", { contact_name: CUSTOMER, contact_type: "customer", gst_treatment: "consumer", place_of_contact: OUR_STATE }, undefined, "Create customer " + CUSTOMER);
    ctx.customer = j.contact?.contact_id;
  }
  if (!ctx.vendor && M.cf_invoice_no) {
    const j = await zoho("contact", "POST", "/contacts", { contact_name: VENDOR, company_name: VENDOR, contact_type: "vendor", gst_treatment: "business_gst", gst_no: VENDOR_GSTIN, place_of_contact: VENDOR_STATE }, undefined, "Create vendor " + VENDOR);
    ctx.vendor = j.contact?.contact_id;
  }
  const line = (gross: number, pos: string, what: string) => ({ ...(ctx.item ? { item_id: ctx.item } : { name: ITEM }), description: what, hsn_or_sac: SAC, product_type: "service",
    quantity: 1, rate: money(gross), tax_id: tax(pos) });
  // series per place of supply, for the notes
  const { data: rows } = await admin.from("acc_sales").select("invoice_no, place_of_supply").eq("status", "SUCCESS").gte("txn_time", S.from).lt("txn_time", S.to).not("invoice_no", "is", null);
  const { data: rrows } = await admin.from("acc_sale_refunds").select("cn_no, invoice_no, place_of_supply").gte("refund_time", S.from).lt("refund_time", S.to);
  const range = (list: string[]) => { const s = list.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); return s.length ? s[0] + "–" + s[s.length - 1] + " (" + s.length + ")" : ""; };

  // A. sales
  for (const x of S.sales || []) {
    if (!Number(x.gross)) continue;
    const ref = `CF-SALES-${ym}-${x.pos}`;
    let inv = ids.invoices.find((v: any) => v.ref === ref);
    if (!inv) {
      const hit = await findRef("invoices", ref);
      if (hit) { inv = { ref, pos: x.pos, id: hit.invoice_id, number: hit.invoice_number, link: LINK("invoices", hit.invoice_id), existed: true }; steps.push({ step: "Sales invoice " + x.pos, skipped: "already in Zoho: " + hit.invoice_number }); }
      else {
        const j = await zoho(ref, "POST", "/invoices", {
          customer_id: ctx.customer, date, reference_number: ref, gst_treatment: "consumer", place_of_supply: x.pos, is_inclusive_tax: true,
          line_items: [line(x.gross, x.pos, `App subscriptions – ${label(month)} (${x.count} sale${Number(x.count) === 1 ? "" : "s"})`)],
          notes: "Summary of invoices " + range((rows || []).filter((r: any) => r.place_of_supply === x.pos).map((r: any) => r.invoice_no)) }, undefined, "A1 Sales invoice " + x.pos);
        inv = { ref, pos: x.pos, id: j.invoice?.invoice_id, number: j.invoice?.invoice_number, link: LINK("invoices", j.invoice?.invoice_id) };
        await zoho(ref, "POST", "/invoices/" + inv.id + "/status/sent", undefined, undefined, "A2 Mark invoice " + x.pos + " as sent");
      }
      ids.invoices.push(inv); await save();
    }
    if (!ids.payments.find((v: any) => v.ref === ref)) {
      const hit = await findRef("customerpayments", ref);
      let pay: any;
      if (hit) { pay = { ref, id: hit.payment_id, link: LINK("paymentsreceived", hit.payment_id), existed: true }; steps.push({ step: "Payment " + x.pos, skipped: "already in Zoho" }); }
      else {
        const j = await zoho(ref, "POST", "/customerpayments", { customer_id: ctx.customer, payment_mode: "banktransfer", amount: money(x.gross), date, reference_number: ref,
          account_id: acct(CLEARING), description: "Collected through Cashfree – " + label(month), invoices: [{ invoice_id: inv.id, amount_applied: money(x.gross) }] }, undefined, "A3 Payment received " + x.pos + " into Cashfree");
        pay = { ref, id: j.payment?.payment_id, link: LINK("paymentsreceived", j.payment?.payment_id) };
      }
      ids.payments.push(pay); await save();
    }
  }
  // B. refunds (never as expenses)
  for (const x of S.refunds || []) {
    if (!Number(x.gross)) continue;
    const ref = `CF-REFUND-${ym}-${x.pos}`;
    let cn = ids.creditnotes.find((v: any) => v.ref === ref);
    if (!cn) {
      const hit = await findRef("creditnotes", ref);
      if (hit) { cn = { ref, pos: x.pos, id: hit.creditnote_id, number: hit.creditnote_number, link: LINK("creditnotes", hit.creditnote_id), existed: true }; steps.push({ step: "Credit note " + x.pos, skipped: "already in Zoho" }); }
      else {
        const mine = (rrows || []).filter((r: any) => r.place_of_supply === x.pos);
        const j = await zoho(ref, "POST", "/creditnotes", {
          customer_id: ctx.customer, date, reference_number: ref, gst_treatment: "consumer", place_of_supply: x.pos, is_inclusive_tax: true,
          line_items: [line(x.gross, x.pos, `Refunds – ${label(month)} (${x.count})`)],
          notes: "Summary of credit notes " + range(mine.map((r: any) => r.cn_no)) + " against invoices " + mine.map((r: any) => r.invoice_no || "before the warehouse").join(", ").slice(0, 900) }, undefined, "B1 Credit note " + x.pos);
        cn = { ref, pos: x.pos, id: j.creditnote?.creditnote_id, number: j.creditnote?.creditnote_number, link: LINK("creditnotes", j.creditnote?.creditnote_id) };
      }
      ids.creditnotes.push(cn); await save();
    }
    if (!ids.refunds.find((v: any) => v.ref === ref)) {
      let done = false;
      if (cn.existed && HAS_CREDS) { const r = await zoho(ref, "GET", "/creditnotes/" + cn.id + "/refunds"); done = (r.creditnote_refunds || []).length > 0; }
      if (done) steps.push({ step: "Refund " + x.pos, skipped: "already in Zoho" });
      else {
        const j = await zoho(ref, "POST", "/creditnotes/" + cn.id + "/refunds", { date, refund_mode: "banktransfer", amount: money(x.gross), from_account_id: acct(CLEARING), reference_number: ref,
          description: "Refunded through Cashfree – " + label(month) }, undefined, "B2 Refund " + x.pos + " from Cashfree");
        ids.refunds.push({ ref, id: j.creditnote_refund?.creditnote_refund_id });
      }
      if (done) ids.refunds.push({ ref, existed: true });
      await save();
    }
  }
  // C. Cashfree fees + GST on fees, from the Cashfree GST invoice
  if (M.cf_invoice_no && !ids.expense) {
    const ref = String(M.cf_invoice_no).trim();
    const hit = await findRef("expenses", ref);
    if (hit) { ids.expense = { ref, id: hit.expense_id, link: LINK("expenses", hit.expense_id), existed: true }; steps.push({ step: "Cashfree fees", skipped: "already in Zoho" }); }
    else {
      const lines: any[] = [];
      if (Number(M.cf_exempt_fee) > 0) lines.push({ account_id: acct(FEES_ACCOUNT), description: "Exempt fees (debit card / UPI up to ₹2,000) – " + label(month), amount: money(M.cf_exempt_fee),
        ...(ctx.exemption ? { tax_exemption_id: ctx.exemption } : {}), product_type: "service" });
      if (Number(M.cf_taxable_fee) > 0) lines.push({ account_id: acct(FEES_ACCOUNT), description: "Payment gateway fees – " + label(month), amount: money(M.cf_taxable_fee),
        tax_id: ctx.taxes["IGST18"] || (dry ? "tax:IGST18" : ""), product_type: "service" });
      if (lines.length) {
        const j = await zoho(ref, "POST", "/expenses", { date, vendor_id: ctx.vendor, paid_through_account_id: acct(CLEARING), reference_number: ref, is_inclusive_tax: false,
          gst_treatment: "business_gst", gst_no: VENDOR_GSTIN, source_of_supply: VENDOR_STATE, destination_of_supply: OUR_STATE,
          description: "Cashfree payment gateway charges – " + label(month) + " (invoice " + ref + "; payout fees excluded)", line_items: lines }, undefined, "C1 Cashfree fees expense");
        ids.expense = { ref, id: j.expense?.expense_id, link: LINK("expenses", j.expense?.expense_id) };
        if (M.cf_invoice_path) {
          const { data: blob } = await admin.storage.from("acc-docs").download(M.cf_invoice_path);
          if (blob) { const form = new FormData(); form.append("receipt", blob, "cashfree-invoice-" + month + ".pdf");
            await zoho(ref, "POST", "/expenses/" + ids.expense.id + "/receipt", undefined, form, "C2 Attach the Cashfree invoice PDF").catch((e) => { ids.expense.receipt = "failed: " + e.message; }); }
        }
      }
    }
    await save();
  }
  return ids;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  let body: any; try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const month = String(body.month || ""), action = String(body.action || "");
  // the internal key may only look (check / preview never write to Zoho); posting needs a person
  const key = req.headers.get("x-cron-key") || "";
  let can = false;
  if (key) {
    if (action === "check" || action === "preview") { const { data } = await admin.from("acc_sales_cron").select("cron_key").eq("id", 1).single(); can = !!data && data.cron_key === key; }
  } else { const { data } = await caller.rpc("acc_can"); can = data === true; }
  if (!can) return json({ error: "You need the “Accounts: payments & payroll” permission." }, 403);
  if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: "Pick a month." }, 400);
  steps = []; dryN = 0;
  try {
    if (action === "check") { const c = await checks(month, true); return json({ summary: c.summary, checks: c.checks, env_dry: ENV_DRY }); }
    if (action === "preview" || action === "post") {
      dry = action === "preview" || ENV_DRY;
      const c = await checks(month, true);
      const bad = c.checks.filter((x: any) => x.level === "bad"), warn = c.checks.filter((x: any) => x.level === "warn");
      if (action === "post" && !dry) {
        if (bad.length) return json({ error: "Fix these first: " + bad.map((x: any) => x.text).join(" · "), checks: c.checks }, 409);
        if (warn.length && !body.ack) return json({ error: "Tick that you've seen the warnings.", checks: c.checks }, 409);
      }
      const prior = (c.summary.month_row || {}).zoho || null;
      const ids = await run(month, c.ctx!, c.summary, dry ? null : prior);
      if (!dry) {
        const { data: me } = await caller.auth.getUser();
        await admin.from("acc_sales_months").upsert({ month, status: "posted", zoho: ids, snapshot: c.summary, posted_at: new Date().toISOString(), posted_by: me.user?.id || null, updated_at: new Date().toISOString() });
      }
      return json({ dry, env_dry: ENV_DRY, steps, ids: dry ? null : ids, checks: c.checks });
    }
    if (action === "unlock") {
      const { data: sup } = await caller.rpc("is_super");
      if (!sup) return json({ error: "Only an admin can unlock a posted month." }, 403);
      const { data: M } = await admin.from("acc_sales_months").select("*").eq("month", month).single();
      if (!M || M.status !== "posted") return json({ error: "This month isn't posted." }, 400);
      const z = M.zoho || {}, still: string[] = [];
      const check = async (kind: string, id: string, what: string) => {
        if (!id || String(id).startsWith("dry")) return;
        try { await zoho(month, "GET", "/" + kind + "/" + id); still.push(what); }
        catch (e) { if (!/\[404\]|does not exist|not found|invalid .*id/i.test((e as Error).message)) throw e; /* deleted in Zoho */ }
      };
      for (const p of z.payments || []) await check("customerpayments", p.id, "payment " + p.ref);
      for (const i of z.invoices || []) await check("invoices", i.id, "invoice " + (i.number || i.ref));
      for (const c of z.creditnotes || []) await check("creditnotes", c.id, "credit note " + (c.number || c.ref));
      if (z.expense) await check("expenses", z.expense.id, "expense " + z.expense.ref);
      if (still.length) return json({ error: "Delete these in Zoho first: " + still.join(", ") + "." }, 409);
      await admin.from("acc_sales_months").update({ status: "open", zoho: null, snapshot: null, posted_at: null, posted_by: null, updated_at: new Date().toISOString() }).eq("month", month);
      await log(month, "UNLOCK", "-", { previous: z }, { ok: true }, 200, true, false);
      return json({ ok: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) { return json({ error: (e as Error).message, steps }, 500); }
});
