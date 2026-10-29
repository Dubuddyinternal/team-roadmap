// =====================================================================
// STAGE 22a — "feedback-remind" Edge Function
//
// Emails people whose monthly feedback isn't sent yet. Called only by the
// hourly job public.feedback_mail_tick() (stage22a SQL), which picks who
// gets an email and sends
//   body: { people: [{ user_id, team, month: "YYYY-MM", late }] }
// with header x-cron-key = feedback_cron.cron_key.
//
// Uses the same Zoho Mail secrets as hr-remind:
//   SMTP_USER, SMTP_PASS, SMTP_HOST (optional), MAIL_FROM (optional), APP_URL (optional)
//
// DEPLOY: name exactly  feedback-remind , "Verify JWT" OFF (it checks the cron key).
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
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: cfg } = await admin.from("feedback_cron").select("cron_key").eq("id", 1).single();
  const key = req.headers.get("x-cron-key") || "";
  if (!cfg || !key || key !== cfg.cron_key) return json({ error: "Not allowed" }, 403);

  let body: { people?: { user_id?: string; team?: string; month?: string; late?: boolean }[] };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const people = (body.people || [])
    .filter((p) => /^[0-9a-f-]{36}$/.test(String(p.user_id || "")) && /^\d{4}-(0[1-9]|1[0-2])$/.test(String(p.month || "")))
    .slice(0, 200);

  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return json({ error: "email isn't set up (SMTP_USER / SMTP_PASS missing)" }, 500);
  const mailer = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") || "smtp.zoho.in", port: 465, secure: true, auth: { user, pass } });
  const from = Deno.env.get("MAIL_FROM") || ("DU Buddy <" + user + ">");

  let sent = 0;
  const failed: string[] = [];
  for (const p of people) {
    // sent in the meantime? skip
    const { data: done } = await admin.from("monthly_feedback").select("id").eq("team_slug", p.team!).eq("user_id", p.user_id!)
      .eq("month", p.month!).eq("status", "submitted").maybeSingle();
    if (done) continue;
    const { data: prof } = await admin.from("profiles").select("email,name,profile").eq("id", p.user_id!).maybeSingle();
    if (!prof?.email) continue;
    const name = (prof.profile && prof.profile.displayName) || prof.name || "there";
    const [y, m] = p.month!.split("-").map(Number);
    const mon = MONTHS[m - 1];
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const nextMon = MONTHS[m % 12];
    const when = p.late
      ? "It was due on " + last + " " + mon + ". You can still send it until 10 " + nextMon + "."
      : "Please send it by " + last + " " + mon + ".";
    const link = APP_URL.replace(/\/?$/, "/") + "?team=" + encodeURIComponent(p.team || "") + "&fb=1";
    const subject = p.late ? "Your " + mon + " feedback is overdue" : "Your " + mon + " feedback is pending";
    const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1A1614;max-width:600px">'
      + '<div style="font-weight:800;font-size:18px;margin-bottom:14px">DU <span style="color:#E8622B">Buddy</span></div>'
      + "<p>Hi " + esc(name) + ",</p>"
      + "<p>Your " + esc(mon) + " monthly feedback isn't sent yet. " + esc(when) + "</p>"
      + "<p>It takes about 10 minutes: how your month went, your wins, what got in the way, and your goals for next month. You can save a draft and finish it later.</p>"
      + '<p style="margin:18px 0"><a href="' + esc(link) + '" style="background:#E8622B;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px;display:inline-block">Fill in my feedback</a></p>'
      + '<p style="color:#8C7F75;font-size:12.5px;margin-top:22px">These reminders stop once you send it.</p></div>';
    const text = "Hi " + name + ",\n\nYour " + mon + " monthly feedback isn't sent yet. " + when
      + "\n\nIt takes about 10 minutes. You can save a draft and finish it later.\n\nFill it in here: " + link;
    try {
      await mailer.sendMail({ from, to: prof.email, subject, text, html });
      sent++;
    } catch (e) { failed.push(prof.email + ": " + ((e as Error)?.message || String(e))); }
  }
  return json({ sent, failed });
});
