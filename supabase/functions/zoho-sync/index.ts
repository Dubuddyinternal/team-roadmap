// =====================================================================
// STAGE 19c — "zoho-sync" Edge Function: Accounts → Zoho Books (India)
//
// Called from the tools page after "Mark paid" (payment requests) or
// "Mark paid" (payroll), and by the Retry buttons:
//   { action: "status" }                      → is it live or a dry run?
//   { action: "setup" }                       → fetch account + tax ids by exact name
//   { action: "requests", ids: [uuid, …] }    → post paid requests (rules B, C, D, E)
//   { action: "payroll",  month: "YYYY-MM" }  → one journal for the month's run (rule A)
// Only people with the "Accounts: payments & payroll" permission can call it.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN   (Zoho India, scope ZohoBooks.fullaccess.all)
//   ZOHO_ORG_ID      (optional, default 60041846412)
//   ZOHO_DRY_RUN     "false" to post for real. Anything else (or unset) = dry run:
//                    payloads are logged in acc_zoho_log, nothing is sent.
//
// DEPLOY: name exactly  zoho-sync , "Verify JWT" ON.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API = "https://www.zohoapis.in/books/v3";
const ORG = Deno.env.get("ZOHO_ORG_ID") || "60041846412";
const DRY = (Deno.env.get("ZOHO_DRY_RUN") || "true").toLowerCase() !== "false";
const CID = Deno.env.get("ZOHO_CLIENT_ID") || "", CSEC = Deno.env.get("ZOHO_CLIENT_SECRET") || "", RTOK = Deno.env.get("ZOHO_REFRESH_TOKEN") || "";
const HAS_CREDS = !!(CID && CSEC && RTOK);
const OUR_STATE = "HR";   // Haryana, GSTIN 06AAMCC3851G1ZN

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// the only Zoho accounts this tool posts to (exact names)
const ACCOUNTS = ["Punjab National Bank", "Pancham Imprest", "Mannat Imprest", "Imprest", "Employee Reimbursements", "TDS Payable",
  "Salaries and Employee Wages", "Diwali Bonus", "Freelancer Expense", "Influencer Expense", "Consultant Expense", "Professional Fee",
  "Rent Expense", "Electricity", "Facebook Ads", "Google Ads", "Advertising And Marketing", "MSG 91", "Adobe", "Canva", "Chatgpt",
  "Jotform", "Manychat", "Software Charges", "Meals and Entertainment", "Staff Celebration", "Staff Skill Development", "Travel Expense",
  "Office Supplies", "Printing and Stationery", "Telephone Expense", "Internet Expense", "Repairs and Maintenance", "Computer",
  "Furniture and Equipment", "Other Expenses"];
const IMPRESTS = ["Pancham Imprest", "Mannat Imprest", "Imprest"];
const ASSETS = ["Computer", "Furniture and Equipment"];
// categories typed before Zoho existed
const LEGACY: Record<string, string> = { "Influencer / creator": "Influencer Expense", "Ads": "Advertising And Marketing", "Travel": "Travel Expense",
  "Food": "Meals and Entertainment", "Software / subscription": "Software Charges", "Equipment": "Other Expenses", "Office": "Office Supplies",
  "Printing": "Printing and Stationery", "Freelancer": "Freelancer Expense", "Other": "Other Expenses" };
// GSTIN state code → Zoho place-of-supply code
const STATE: Record<string, string> = { "01": "JK", "02": "HP", "03": "PB", "04": "CH", "05": "UK", "06": "HR", "07": "DL", "08": "RJ", "09": "UP",
  "10": "BR", "11": "SK", "12": "AR", "13": "NL", "14": "MN", "15": "MZ", "16": "TR", "17": "ML", "18": "AS", "19": "WB", "20": "JH", "21": "OD",
  "22": "CG", "23": "MP", "24": "GJ", "26": "DN", "27": "MH", "29": "KA", "30": "GA", "31": "LD", "32": "KL", "33": "TN", "34": "PY", "35": "AN",
  "36": "TS", "37": "AP", "38": "LA" };

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
let accessToken = "", tokenUntil = 0, action = "", dryN = 0;

async function token(): Promise<string> {
  if (accessToken && Date.now() < tokenUntil) return accessToken;
  const u = "https://accounts.zoho.in/oauth/v2/token?" + new URLSearchParams({ refresh_token: RTOK, client_id: CID, client_secret: CSEC, grant_type: "refresh_token" });
  const r = await fetch(u, { method: "POST" });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error("Zoho sign-in failed: " + (j.error || r.status));
  accessToken = j.access_token; tokenUntil = Date.now() + ((j.expires_in || 3600) - 120) * 1000;
  return accessToken;
}
async function log(ref: string, method: string, path: string, request: unknown, response: unknown, http: number, ok: boolean, dry: boolean) {
  await admin.from("acc_zoho_log").insert({ action, ref, method, path, request, response, http, ok, dry });
}
// one Zoho call; POSTs are only logged in a dry run
async function zoho(ref: string, method: string, path: string, body?: unknown, form?: FormData): Promise<any> {
  const write = method !== "GET";
  if (write && DRY) { const fake = { code: 0, dry_run: true, id: "dry-" + (++dryN) }; await log(ref, method, path, body ?? "(file)", fake, 0, true, true); return fake; }
  if (!HAS_CREDS) throw new Error("Zoho isn't connected yet (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN missing).");
  const sep = path.includes("?") ? "&" : "?";
  const headers: Record<string, string> = { Authorization: "Zoho-oauthtoken " + await token() };
  if (body) headers["Content-Type"] = "application/json";
  const r = await fetch(API + path + sep + "organization_id=" + ORG, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const j = await r.json().catch(() => ({ message: "Not JSON (" + r.status + ")" }));
  const ok = r.ok && (j.code === 0 || j.code === undefined);
  if (write || !ok) await log(ref, method, path, body ?? (form ? "(file)" : null), j, r.status, ok, false);
  if (!ok) throw new Error((j.message || "Zoho error") + " [" + r.status + "]");
  return j;
}

type Settings = { accounts: Record<string, string>; taxes: Record<string, string> };
async function settings(): Promise<Settings> {
  const { data } = await admin.from("acc_zoho_settings").select("*").eq("id", 1).single();
  let s: Settings = { accounts: data?.accounts || {}, taxes: data?.taxes || {} };
  if (!Object.keys(s.accounts).length && HAS_CREDS) s = await setup();
  return s;
}
async function setup(): Promise<Settings> {
  const accounts: Record<string, string> = {};
  for (let page = 1; page < 20; page++) {
    const j = await zoho("setup", "GET", "/chartofaccounts?per_page=200&page=" + page);
    for (const a of j.chartofaccounts || []) if (ACCOUNTS.includes(a.account_name)) accounts[a.account_name] = a.account_id;
    if (!j.page_context?.has_more_page) break;
  }
  const taxes: Record<string, string> = {};
  const t = await zoho("setup", "GET", "/settings/taxes");
  for (const x of t.taxes || []) {
    const n = String(x.tax_name || "").replace(/\s/g, "").toUpperCase();
    if (n === "IGST18" || n === "GST18") taxes[n] = x.tax_id;
  }
  const missing = ACCOUNTS.filter((n) => !accounts[n]).concat(["IGST18", "GST18"].filter((n) => !taxes[n]));
  await admin.from("acc_zoho_settings").update({ accounts, taxes, missing, fetched_at: new Date().toISOString() }).eq("id", 1);
  return { accounts, taxes };
}
function acct(s: Settings, name: string): string {
  if (s.accounts[name]) return s.accounts[name];
  if (DRY && !HAS_CREDS) return "account:" + name;   // a readable placeholder in dry-run logs
  throw new Error("Zoho account “" + name + "” wasn't found. Check its exact name, then press “Fetch Zoho accounts” in Accounts → Checks.");
}
function category(c: string): string { const n = LEGACY[c] || c; return ACCOUNTS.includes(n) ? n : "Other Expenses"; }
// already in Zoho with this reference? (expenses / journals)
async function find(kind: "expenses" | "journals", ref: string): Promise<string | null> {
  if (DRY || !HAS_CREDS) return null;
  try {
    const j = await zoho(ref, "GET", "/" + kind + "?search_text=" + encodeURIComponent(ref));
    const hit = (j[kind] || []).find((x: any) => x.reference_number === ref);
    return hit ? (hit.expense_id || hit.journal_id) : null;
  } catch { return null; }   // the ids we save are the main guard against duplicates
}
function gst(r: any, s: Settings) {
  if (!r.has_gst_bill || !/^\d{2}[A-Z0-9]{13}$/.test(r.vendor_gstin || "")) return {};
  const from = STATE[r.vendor_gstin.slice(0, 2)];
  if (!from) return {};
  const tax = from === OUR_STATE ? "GST18" : "IGST18";
  const tid = s.taxes[tax] || (DRY && !HAS_CREDS ? "tax:" + tax : "");
  if (!tid) throw new Error("Zoho tax “" + tax + "” wasn't found. Press “Fetch Zoho accounts” in Accounts → Checks.");
  return { gst_treatment: "business_gst", gst_no: r.vendor_gstin, source_of_supply: from, destination_of_supply: OUR_STATE, tax_id: tid };
}
const money = (n: number) => Math.round(Number(n) * 100) / 100;
const iso = (d: string | null) => (d || new Date().toISOString()).slice(0, 10);

async function saveReq(id: string, patch: Record<string, unknown>) { await admin.from("acc_requests").update(patch).eq("id", id); }
async function uploadReceipt(r: any, expenseId: string) {
  const { data: f } = await admin.from("acc_files").select("*").eq("request_id", r.id).order("created_at").limit(1).maybeSingle();
  if (!f) return null;
  const { data: blob } = await admin.storage.from("acc-docs").download(f.path);
  if (!blob) return null;
  const form = new FormData(); form.append("receipt", blob, f.file_name || "receipt");
  await zoho("TOOLS-" + r.ref_no, "POST", "/expenses/" + expenseId + "/receipt", undefined, form);
  return f.file_name;
}

// ---------- payment requests ----------
async function postRequests(ids: string[]) {
  const s = await settings();
  const { data: rows } = await admin.from("acc_requests").select("*").in("id", ids).eq("status", "paid");
  const names = await namesOf([...new Set((rows || []).map((x: any) => x.user_id))]);
  for (const r of rows || []) r._name = names[r.user_id] || "";
  const out: Record<string, string> = {};
  const payJournals: Record<string, any[]> = {};   // reimbursements paid from the bank, grouped by person + UTR
  for (const r of rows || []) {
    if (r.zoho_status === "synced") { out[r.id] = "already synced"; continue; }
    const ref = "TOOLS-" + r.ref_no, ids2: Record<string, any> = { ...(r.zoho_ids || {}) };
    try {
      const cat = category(r.category || "");
      if (ASSETS.includes(cat)) {
        await saveReq(r.id, { zoho_status: "manual", zoho_error: "Assets go into Zoho as a bill with the vendor (then a vendor payment). Please enter it in Zoho by hand." });
        out[r.id] = "manual"; continue;
      }
      const paidFrom = r.paid_from || "Punjab National Bank";
      if (r.kind === "advance") {
        // E. advance: Dr <imprest> / Cr bank
        if (!ids2.journal) {
          ids2.journal = await find("journals", ref) || (await zoho(ref, "POST", "/journals", {
            journal_date: iso(r.paid_at), reference_number: ref, notes: "Advance: " + r.title + (r.paid_ref ? " · UTR " + r.paid_ref : ""),
            line_items: [{ account_id: acct(s, r.imprest_account || "Imprest"), debit_or_credit: "debit", amount: money(r.amount), description: r.title },
                         { account_id: acct(s, paidFrom), debit_or_credit: "credit", amount: money(r.amount), description: ref }] })).journal?.journal_id;
        }
      } else if (r.kind === "vendor" && Number(r.tds_amount) > 0) {
        // C with TDS: one journal — Dr category (gross) / Cr TDS Payable / Cr bank (net)
        if (!ids2.journal) {
          ids2.journal = await find("journals", ref) || (await zoho(ref, "POST", "/journals", {
            journal_date: iso(r.paid_at), reference_number: ref, notes: r.payee_name + " – " + r.title + (r.paid_ref ? " · UTR " + r.paid_ref : "") + " · TDS " + (r.tds_section || "") + " " + r.tds_percent + "%",
            line_items: [{ account_id: acct(s, cat), debit_or_credit: "debit", amount: money(r.amount), description: r.payee_name + " – " + r.title },
                         { account_id: acct(s, "TDS Payable"), debit_or_credit: "credit", amount: money(r.tds_amount), description: r.payee_name + (r.payee_pan ? " · PAN " + r.payee_pan : "") },
                         { account_id: acct(s, paidFrom), debit_or_credit: "credit", amount: money(r.amount - r.tds_amount), description: ref }] })).journal?.journal_id;
        }
      } else {
        // B (reimbursement) and C / D (vendor, no TDS): an expense
        const isReimb = r.kind === "reimbursement";
        const through = isReimb ? (IMPRESTS.includes(paidFrom) ? paidFrom : "Employee Reimbursements") : paidFrom;
        if (!ids2.expense) {
          const who = isReimb ? (r._name || "") : r.payee_name;
          ids2.expense = await find("expenses", ref) || (await zoho(ref, "POST", "/expenses", {
            date: iso(isReimb ? (r.spent_on || r.created_at) : (r.spent_on || r.paid_at)), account_id: acct(s, cat), paid_through_account_id: acct(s, through),
            amount: money(r.amount), is_inclusive_tax: true, reference_number: ref, description: (who ? who + " – " : "") + r.title, ...gst(r, s) })).expense?.expense_id;
          if (ids2.expense && !String(ids2.expense).startsWith("dry")) ids2.receipt = await uploadReceipt(r, ids2.expense).catch((e) => "receipt failed: " + e.message);
        }
        // B-2: the bank paid the employee back (not when it came out of an advance)
        if (isReimb && !IMPRESTS.includes(paidFrom) && !ids2.journal) {
          const key = r.user_id + "|" + (r.paid_ref || ref);
          (payJournals[key] = payJournals[key] || []).push({ r, ids2 });
        }
      }
      const pendingJournal = r.kind === "reimbursement" && !IMPRESTS.includes(paidFrom) && !ids2.journal;
      if (!pendingJournal) await finish(r.id, ids2);
      else await saveReq(r.id, { zoho_ids: ids2 });
      out[r.id] = DRY ? "dry run" : pendingJournal ? "expense posted" : "synced";
    } catch (e) {
      await saveReq(r.id, { zoho_ids: ids2, zoho_status: "failed", zoho_error: (e as Error).message });
      out[r.id] = "failed: " + (e as Error).message;
    }
  }
  // one payment journal per person + UTR: Dr Employee Reimbursements (one line each) / Cr bank
  for (const key of Object.keys(payJournals)) {
    const list = payJournals[key], first = list[0].r, jref = first.paid_ref || "TOOLS-" + first.ref_no;
    try {
      const total = list.reduce((a, x) => a + Number(x.r.amount), 0);
      const jid = (await zoho(jref, "POST", "/journals", {
        journal_date: iso(first.paid_at), reference_number: jref.slice(0, 50), notes: "Reimbursement paid to " + (first._name || "") + " · " + list.map((x) => "TOOLS-" + x.r.ref_no).join(", "),
        line_items: list.map((x) => ({ account_id: acct(s, "Employee Reimbursements"), debit_or_credit: "debit", amount: money(x.r.amount), description: "TOOLS-" + x.r.ref_no + " · " + x.r.title }))
          .concat([{ account_id: acct(s, first.paid_from || "Punjab National Bank"), debit_or_credit: "credit", amount: money(total), description: (first._name || "") + " reimbursement" }]) })).journal?.journal_id;
      for (const x of list) { x.ids2.journal = jid; await finish(x.r.id, x.ids2); out[x.r.id] = DRY ? "dry run" : "synced"; }
    } catch (e) {
      for (const x of list) { await saveReq(x.r.id, { zoho_ids: x.ids2, zoho_status: "failed", zoho_error: "Payment journal: " + (e as Error).message }); out[x.r.id] = "failed"; }
    }
  }
  return out;
}
async function finish(id: string, ids2: Record<string, any>) {
  if (DRY) await saveReq(id, { zoho_status: "dry_run", zoho_error: null });   // fake ids are not kept, so the real run posts them
  else await saveReq(id, { zoho_ids: ids2, zoho_status: "synced", zoho_error: null, zoho_synced_at: new Date().toISOString() });
}

// ---------- payroll: one journal per run ----------
async function postPayroll(month: string) {
  const s = await settings();
  const { data: run } = await admin.from("acc_payroll_runs").select("*").eq("month", month).maybeSingle();
  if (!run) throw new Error("This month hasn't been marked paid yet.");
  const { data: rows } = await admin.from("acc_payroll").select("*").eq("month", month).eq("status", "paid");
  const ids2: any = { journals: [], ...(run.zoho_ids || {}) };
  const done = new Set<string>((ids2.journals || []).flatMap((j: any) => j.rows || []));
  const todo = (rows || []).filter((r: any) => !done.has(r.id));
  const label = new Date(month + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  try {
    if (todo.length) {
      const names = await namesOf(todo.map((r: any) => r.user_id));
      const lines: any[] = [];
      let tds = 0, net = 0;
      for (const r of todo) {
        const sal = Number(r.base) - Number(r.deductions), bon = Number(r.bonus);
        if (sal > 0) lines.push({ account_id: acct(s, "Salaries and Employee Wages"), debit_or_credit: "debit", amount: money(sal), description: names[r.user_id] });
        if (bon > 0) lines.push({ account_id: acct(s, "Diwali Bonus"), debit_or_credit: "debit", amount: money(bon), description: names[r.user_id] + " · bonus" });
        tds += Number(r.tds); net += sal + bon - Number(r.tds);
      }
      if (tds > 0) lines.push({ account_id: acct(s, "TDS Payable"), debit_or_credit: "credit", amount: money(tds), description: "TDS on salaries (192)" });
      if (net > 0) lines.push({ account_id: acct(s, run.paid_from || "Punjab National Bank"), debit_or_credit: "credit", amount: money(net), description: "Salary " + label + (run.paid_ref ? " · " + run.paid_ref : "") });
      const ref = "TOOLS-PAYROLL-" + month + (ids2.journals.length ? "-" + (ids2.journals.length + 1) : "");
      if (lines.length) {
        const jid = (!ids2.journals.length && await find("journals", ref)) || (await zoho(ref, "POST", "/journals", {
          journal_date: iso(run.paid_on), reference_number: ref, notes: "Salary for " + label + " – " + todo.length + (todo.length === 1 ? " person" : " people"), line_items: lines })).journal?.journal_id;
        if (!DRY) ids2.journals.push({ id: jid, ref, rows: todo.map((r: any) => r.id) });
      }
    }
    await admin.from("acc_payroll_runs").update(DRY ? { zoho_status: "dry_run", zoho_error: null }
      : { zoho_ids: ids2, zoho_status: "synced", zoho_error: null, zoho_synced_at: new Date().toISOString() }).eq("month", month);
  } catch (e) {
    await admin.from("acc_payroll_runs").update({ zoho_ids: ids2, zoho_status: "failed", zoho_error: (e as Error).message }).eq("month", month);
    throw e;
  }
  // reimbursements paid along with these salaries
  const users = (rows || []).filter((r: any) => Number(r.reimb) > 0).map((r: any) => r.user_id);
  if (users.length) {
    const { data: rq } = await admin.from("acc_requests").select("id").in("user_id", users).eq("kind", "reimbursement").eq("status", "paid").in("zoho_status", ["pending", "failed", "dry_run"]);
    if (rq?.length) await postRequests(rq.map((x: any) => x.id));
  }
  return { journals: ids2.journals.length, dry: DRY };
}
async function namesOf(ids: string[]) {
  const { data } = await admin.from("profiles").select("id,name,email,profile").in("id", ids);
  const out: Record<string, string> = {};
  for (const p of data || []) out[p.id] = (p.profile && p.profile.displayName) || p.name || p.email;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: "Bearer " + tok } } });
  const { data: can } = await caller.rpc("acc_can");
  if (!can) return json({ error: "You need the “Accounts: payments & payroll” permission." }, 403);
  let body: any; try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  action = String(body.action || "");
  try {
    if (action === "status") return json({ dry: DRY, connected: HAS_CREDS, org: ORG });
    if (action === "setup") { const s = await setup(); return json({ ok: true, accounts: Object.keys(s.accounts).length, taxes: Object.keys(s.taxes) }); }
    if (action === "requests") {
      const ids = (body.ids || []).filter((x: string) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 100);
      return json({ ok: true, dry: DRY, results: await postRequests(ids) });
    }
    if (action === "payroll") {
      if (!/^\d{4}-\d{2}$/.test(String(body.month || ""))) return json({ error: "Pick a month." }, 400);
      return json({ ok: true, ...(await postPayroll(body.month)) });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
