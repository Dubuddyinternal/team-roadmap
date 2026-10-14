// =====================================================================
// STAGE 18i — "hr-remind" Edge Function
//
// Emails people whose HR file isn't complete. Called only by the hourly
// job public.hr_rules_tick() (stage18i SQL), which picks who gets an email
// and sends   body: { people: [{ user_id, note }] }   with header
// x-cron-key = hr_rules.cron_key.
//
// Uses the same Zoho Mail secrets as hr-mail:
//   SMTP_USER, SMTP_PASS, SMTP_HOST (optional), MAIL_FROM (optional), APP_URL (optional)
//
// DEPLOY: name exactly  hr-remind , "Verify JWT" OFF (it checks the cron key).
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://tools.dubuddy.in/";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function esc(v: unknown) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: cfg } = await admin.from("hr_rules").select("cron_key, file_on").eq("id", 1).single();
  const key = req.headers.get("x-cron-key") || "";
  if (!cfg || !key || key !== cfg.cron_key) return json({ error: "Not allowed" }, 403);
  if (!cfg.file_on) return json({ sent: 0 });

  let body: { people?: { user_id?: string; note?: string }[] };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const people = (body.people || []).filter((p) => /^[0-9a-f-]{36}$/.test(String(p.user_id || ""))).slice(0, 200);

  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return json({ error: "email isn't set up (SMTP_USER / SMTP_PASS missing)" }, 500);
  const mailer = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") || "smtp.zoho.in", port: 465, secure: true, auth: { user, pass } });
  const from = Deno.env.get("MAIL_FROM") || ("DU Buddy <" + user + ">");
  const link = APP_URL.replace(/\/?$/, "/") + "?hr=1";

  let sent = 0;
  const failed: string[] = [];
  for (const p of people) {
    const { data: prof } = await admin.from("profiles").select("email,name,profile").eq("id", p.user_id!).maybeSingle();
    if (!prof?.email) continue;
    const name = (prof.profile && prof.profile.displayName) || prof.name || "there";
    const note = String(p.note || "Please finish it soon.");
    const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1A1614;max-width:600px">'
      + '<div style="font-weight:800;font-size:18px;margin-bottom:14px">DU <span style="color:#E8622B">Buddy</span></div>'
      + "<p>Hi " + esc(name) + ",</p>"
      + "<p>Your HR file isn't complete yet. " + esc(note) + "</p>"
      + "<p>It takes about 10 minutes: your details, your documents (Aadhaar, PAN, bank proof, photo) and signing the company policies.</p>"
      + '<p style="margin:18px 0"><a href="' + esc(link) + '" style="background:#E8622B;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px;display:inline-block">Complete my HR file</a></p>'
      + '<p style="color:#8C7F75;font-size:12.5px;margin-top:22px">You get this because you work with Cyberflow Tech Pvt Ltd. It stops once you submit your HR file.</p></div>';
    const text = "Hi " + name + ",\n\nYour HR file isn't complete yet. " + note
      + "\n\nIt takes about 10 minutes: your details, your documents and signing the company policies.\n\nComplete it here: " + link;
    try {
      await mailer.sendMail({ from, to: prof.email, subject: "Please complete your HR file", text, html });
      sent++;
    } catch (e) { failed.push(prof.email + ": " + ((e as Error)?.message || String(e))); }
  }
  return json({ sent, failed });
});
