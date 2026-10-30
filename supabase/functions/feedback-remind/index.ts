// =====================================================================
// STAGE 22a — "feedback-remind" Edge Function
//
// Emails people whose monthly feedback isn't sent yet. Called only by the
// hourly job public.feedback_mail_tick() (stage22a SQL), which picks who
// gets an email and sends
//   body: { people: [{ user_id, team, month: "YYYY-MM" | null, late, due, last: "YYYY-MM-DD", okr: "YYYY-MM-mid|end" | null }] }
//   due = the due date people are shown, last = the last date (stage 22g)
// (stage 22b: one email covers monthly feedback and/or the OKR check-in)
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

  let body: { people?: { user_id?: string; team?: string; month?: string | null; late?: boolean; due?: string | null; last?: string | null; okr?: string | null }[] };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const people = (body.people || [])
    .filter((p) => /^[0-9a-f-]{36}$/.test(String(p.user_id || "")))
    .map((p) => ({ ...p,
      month: /^\d{4}-(0[1-9]|1[0-2])$/.test(String(p.month || "")) ? p.month : null,
      okr: /^\d{4}-(0[1-9]|1[0-2])-(mid|end)$/.test(String(p.okr || "")) ? p.okr : null }))
    .filter((p) => p.month || p.okr)
    .slice(0, 200);

  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return json({ error: "email isn't set up (SMTP_USER / SMTP_PASS missing)" }, 500);
  const mailer = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") || "smtp.zoho.in", port: 465, secure: true, auth: { user, pass } });
  const from = Deno.env.get("MAIL_FROM") || ("DU Buddy <" + user + ">");

  let sent = 0;
  const failed: string[] = [];
  for (const p of people) {
    // done in the meantime? drop that part
    if (p.month) {
      const { data: done } = await admin.from("monthly_feedback").select("id").eq("team_slug", p.team!).eq("user_id", p.user_id!)
        .eq("month", p.month).eq("status", "submitted").maybeSingle();
      if (done) p.month = null;
    }
    if (p.okr) {
      const { data: done } = await admin.from("okr_checkins").select("id").eq("team_slug", p.team!).eq("user_id", p.user_id!)
        .eq("period", p.okr).maybeSingle();
      if (done) p.okr = null;
    }
    if (!p.month && !p.okr) continue;
    const { data: prof } = await admin.from("profiles").select("email,name,profile").eq("id", p.user_id!).maybeSingle();
    if (!prof?.email) continue;
    const name = (prof.profile && prof.profile.displayName) || prof.name || "there";
    const base = APP_URL.replace(/\/?$/, "/") + "?team=" + encodeURIComponent(p.team || "");
    const parts: string[] = [], partsHtml: string[] = [];
    let subject = "", link = "", button = "";
    if (p.month) {
      const [y, m] = p.month.split("-").map(Number);
      const mon = MONTHS[m - 1], last = new Date(Date.UTC(y, m, 0)).getUTCDate(), nextMon = MONTHS[m % 12];
      // "8 November" from "2026-11-08"; older callers sent no dates: month end, and the 10th
      const dm = (iso: string | null | undefined, dflt: string) => {
        const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
        return a ? Number(a[3]) + " " + MONTHS[Number(a[2]) - 1] : dflt;
      };
      const due = dm(p.due, last + " " + mon), lastDate = dm(p.last, "10 " + nextMon);
      const when = p.late
        ? "It was due on " + due + ". Last chance: please send it by " + lastDate + "."
        : "Please send it by " + due + ".";
      const line = "Your " + mon + " monthly feedback isn't sent yet. " + when + " It takes about 10 minutes, and you can save a draft and finish it later.";
      parts.push(line); partsHtml.push(esc(line));
      subject = p.late ? "Your " + mon + " feedback is overdue" : "Your " + mon + " feedback is pending";
      link = base + "&fb=1"; button = "Fill in my feedback";
    }
    if (p.okr) {
      const mon = MONTHS[Number(p.okr.slice(5, 7)) - 1];
      const mid = p.okr.endsWith("-mid");
      const line = (mid ? "It's time for your mid-month OKR check-in" : "Your " + mon + " OKR check-in is waiting")
        + ": update the numbers on your key results. It takes 2 minutes.";
      parts.push(line); partsHtml.push(esc(line));
      if (subject) subject = subject.replace(/ is (pending|overdue)$/, "") + " and OKR check-in are pending";
      else { subject = mid ? "Your mid-month OKR check-in is waiting" : "Your " + mon + " OKR check-in is waiting"; link = base + "&okr=1"; button = "Update my OKRs"; }
    }
    const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1A1614;max-width:600px">'
      + '<div style="font-weight:800;font-size:18px;margin-bottom:14px">DU <span style="color:#E8622B">Buddy</span></div>'
      + "<p>Hi " + esc(name) + ",</p>"
      + partsHtml.map((x) => "<p>" + x + "</p>").join("")
      + '<p style="margin:18px 0"><a href="' + esc(link) + '" style="background:#E8622B;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px;display:inline-block">' + esc(button) + "</a></p>"
      + '<p style="color:#8C7F75;font-size:12.5px;margin-top:22px">These reminders stop once you\'ve done it.</p></div>';
    const text = "Hi " + name + ",\n\n" + parts.join("\n\n") + "\n\nOpen it here: " + link;
    try {
      await mailer.sendMail({ from, to: prof.email, subject, text, html });
      sent++;
    } catch (e) { failed.push(prof.email + ": " + ((e as Error)?.message || String(e))); }
  }
  return json({ sent, failed });
});
