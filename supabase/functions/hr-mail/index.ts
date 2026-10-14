// =====================================================================
// STAGE 18 — "hr-mail" Edge Function
//
// Emails a teammate their work contract (Administration → 🗂️ Employees (HR)
// → a person → ✉️ Email the contract).
//
//   body: { action: "contract", user_id, html }
//
// 1. Checks the caller is HR for that person (hr_can_admin, run with the
//    caller's own login — stage18a SQL).
// 2. Looks up the person's login email with the service key (the browser
//    never chooses the address) and sends the contract to it.
// 3. Records it with hr_admin_update(..., 'contract_sent') as the caller,
//    which also drops a 🔔 for the person.
//
// Uses the same Zoho Mail secrets as manage-people and idea-mail:
//   SMTP_USER, SMTP_PASS, SMTP_HOST (optional), MAIL_FROM (optional), APP_URL (optional)
//
// DEPLOY: whole file, name exactly  hr-mail , "Verify JWT" ON.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://tools.dubuddy.in/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function esc(v: unknown) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

async function sendMail(to: string, subject: string, text: string, html: string): Promise<string | null> {
  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return "email isn't set up (SMTP_USER / SMTP_PASS missing)";
  try {
    const mailer = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") || "smtp.zoho.in", port: 465, secure: true, auth: { user, pass },
    });
    await mailer.sendMail({ from: Deno.env.get("MAIL_FROM") || ("DU Buddy <" + user + ">"), to, subject, text, html });
    return null;
  } catch (e) { return (e as Error)?.message || String(e); }
}

// the contract HTML comes from our own page, built from the template in
// hr_settings; strip anything that could run or load in a mail client anyway
function clean(html: string) {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta)[\s\S]*?(<\/\s*\1\s*>|\/?>)/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please sign in." }, 401);

  let body: { action?: string; user_id?: string; html?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (body.action !== "contract") return json({ error: "Unknown action." }, 400);
  const userId = String(body.user_id || "");
  const html = clean(String(body.html || ""));
  if (!/^[0-9a-f-]{36}$/.test(userId)) return json({ error: "Pick a person." }, 400);
  if (!html.trim() || html.length > 200000) return json({ error: "The contract is empty or too long." }, 400);

  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: "Bearer " + token } } });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: ok, error: okErr } = await caller.rpc("hr_can_admin", { p_user: userId });
  if (okErr) return json({ error: okErr.message }, 400);
  if (!ok) return json({ error: "Only HR can send contracts." }, 403);

  const { data: prof, error: pErr } = await admin.from("profiles").select("email,name,profile").eq("id", userId).single();
  if (pErr || !prof?.email) return json({ error: "That person has no email address." }, 400);
  const name = (prof.profile && prof.profile.displayName) || prof.name || "there";
  const link = APP_URL.replace(/\/?$/, "/") + "?hr=1";

  const subject = "Your work contract with Cyberflow Tech";
  const steps = [
    "Read the contract below.",
    "Print it, sign every page, and scan it or take clear photos. (Or sign the PDF digitally.)",
    "Open tools.dubuddy.in → your account menu → 🗂️ My HR file, and upload the signed copy in the Contract step.",
  ];
  const mail = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1A1614;max-width:720px">'
    + '<div style="font-weight:800;font-size:18px;margin-bottom:14px">DU <span style="color:#E8622B">Buddy</span></div>'
    + "<p>Hi " + esc(name) + ",</p><p>Here is your work contract. Three steps:</p><ol>"
    + steps.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>"
    + '<p style="margin:18px 0"><a href="' + esc(link) + '" style="background:#E8622B;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px;display:inline-block">Upload the signed copy</a></p>'
    + '<div style="border:1px solid #E5DDD5;border-radius:10px;padding:22px 24px;margin-top:20px;background:#fff">' + html + "</div>"
    + '<p style="color:#8C7F75;font-size:12.5px;margin-top:22px">You got this because you work with Cyberflow Tech Pvt Ltd. Questions? Reply to this email.</p></div>';
  const text = "Hi " + name + ",\n\nYour work contract is in this email (open it in a mail app that shows formatting) and in tools.dubuddy.in → My HR file.\n\n" + steps.map((s, i) => (i + 1) + ". " + s).join("\n")
    + "\n\nUpload it here: " + link;

  const err = await sendMail(prof.email, subject, text, mail);
  if (err) return json({ error: "The email didn't go out: " + err }, 502);

  const { error: upErr } = await caller.rpc("hr_admin_update", {
    p_user: userId, p_action: "contract_sent", p_job: null, p_note: null, p_contract_html: html,
  });
  if (upErr) return json({ error: "Sent, but couldn't record it: " + upErr.message }, 500);
  return json({ ok: true, to: prof.email });
});
