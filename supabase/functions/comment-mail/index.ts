// =====================================================================
// STAGE 19 — "comment-mail" Edge Function
//
// 💬 Someone posted a comment and tagged teammates with @: each tagged person
// gets an email with a button that opens the app on exactly that tab or card
// (and scrolls to the comment), plus a 🔔 in the app.
//
//   POST { team, comment_id, app_url? }   (called right after posting)
//
// Checked here, with the service key:
//   - the caller is signed in and wrote the comment, in the last 15 minutes
//   - it hasn't been mailed before (mailed_at), so each comment emails once
//   - every tagged person is in the team (anyone else is skipped)
// app_url: the site the comment was written on (the live site, or a preview
// link on vercel.app), so the button opens the same site. Anything else → APP_URL.
//
// Uses the same Zoho Mail secrets as manage-people / idea-mail:
//   SMTP_USER, SMTP_PASS, SMTP_HOST (optional), MAIL_FROM (optional)
// DEPLOY: name exactly  comment-mail , "Verify JWT" ON.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("APP_URL") || "https://tools.dubuddy.in/");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// the markdown the comment box writes → plain text for the email
const plain = (md: string) => String(md || "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").trim();
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function sendMail(to: string, subject: string, text: string, html: string): Promise<string | null> {
  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return "email isn't set up (SMTP_USER / SMTP_PASS missing)";
  try {
    const mailer = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") || "smtp.zoho.in", port: 465, secure: true, auth: { user, pass } });
    await mailer.sendMail({ from: Deno.env.get("MAIL_FROM") || ("DU Buddy <" + user + ">"), to, subject, text, html });
    return null;
  } catch (e) { return (e as Error)?.message || String(e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  let body: any; try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const team = String(body?.team || ""), id = String(body?.comment_id || "");
  if (!team || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Bad request" }, 400);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: who } = await admin.auth.getUser(token);
  const me = who?.user;
  if (!me) return json({ error: "Sign in first." }, 401);

  const { data: c } = await admin.from("team_comments").select("*").eq("id", id).eq("team_slug", team).maybeSingle();
  if (!c || c.author_id !== me.id) return json({ sent: 0, reason: "not your comment" });
  if (c.mailed_at) return json({ sent: 0, reason: "already emailed" });
  if (Date.now() - new Date(c.created_at).getTime() > 15 * 60000) return json({ sent: 0, reason: "too old" });
  await admin.from("team_comments").update({ mailed_at: new Date().toISOString() }).eq("id", id);

  const ids = [...new Set((c.mentions || []) as string[])].filter((u) => u !== me.id).slice(0, 25);
  if (!ids.length) return json({ sent: 0 });
  const { data: mem } = await admin.from("memberships").select("user_id").eq("team_slug", team).in("user_id", ids);
  const { data: profs } = await admin.from("profiles").select("id, email, name, profile, is_super").in("id", ids);
  const inTeam = new Set((mem || []).map((m: any) => m.user_id));
  const people = (profs || []).filter((p: any) => p.email && (inTeam.has(p.id) || p.is_super));

  // the reply's context: the comment it answers
  let parent: any = null;
  if (c.parent_id) parent = (await admin.from("team_comments").select("author_name, body").eq("id", c.parent_id).maybeSingle()).data;

  const site = /^https:\/\/(tools\.dubuddy\.in|team-roadmap-[a-z0-9-]+-dubuddy2\.vercel\.app)\/?$/.test(String(body.app_url || ""))
    ? String(body.app_url).replace(/\/?$/, "/") : APP_URL;
  const nav = b64url(JSON.stringify(c.nav || {}));
  const link = site + "?team=" + encodeURIComponent(team) + "&place=" + nav + "&cm=" + id;
  const where = c.place_label || "a comment thread";
  const by = c.author_name || "A teammate";
  const text0 = plain(c.body).slice(0, 3000);
  const files = (c.files || []).length;

  let sent = 0; const errors: string[] = [];
  for (const p of people) {
    const first = String((p.profile && p.profile.displayName) || p.name || "there").split(" ")[0];
    const subject = `💬 ${by} tagged you — ${where}`.slice(0, 200);
    const text = `Hi ${first},\n\n${by} tagged you in a comment on ${where}${parent ? " (a reply to " + (parent.author_name || "a comment") + ")" : ""}:\n\n`
      + text0 + (files ? `\n\n📎 ${files} attachment${files > 1 ? "s" : ""}` : "") + `\n\nOpen it: ${link}\n\n— The DU Buddy team`;
    const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1A1614;max-width:560px">'
      + '<div style="font-weight:800;font-size:18px;margin-bottom:14px">DU <span style="color:#E8622B">Buddy</span></div>'
      + `<p>Hi ${esc(first)},</p><p><b>${esc(by)}</b> tagged you in a comment on <b>${esc(where)}</b>${parent ? ", replying to " + esc(parent.author_name || "a comment") : ""}:</p>`
      + (parent ? `<p style="color:#8C7F75;border-left:3px solid #E5DDD5;padding:2px 0 2px 10px;margin:8px 0">${esc(plain(parent.body).slice(0, 300))}</p>` : "")
      + `<p style="white-space:pre-wrap;background:#FBF6F1;border-radius:8px;padding:10px 12px">${esc(text0)}</p>`
      + (files ? `<p style="color:#8C7F75">📎 ${files} attachment${files > 1 ? "s" : ""}</p>` : "")
      + `<p style="margin:20px 0"><a href="${esc(link)}" style="background:#E8622B;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px;display:inline-block">Open the comment</a></p>`
      + '<p style="color:#8C7F75;font-size:12.5px;margin-top:26px">You got this because a teammate tagged you on tools.dubuddy.in.</p></div>';
    const err = await sendMail(p.email, subject, text, html);
    if (err) errors.push(err); else sent++;
  }
  // a 🔔 in the app too; clicking it opens the same place
  if (people.length) await admin.from("team_notifications").insert({
    team_slug: team, title: `💬 ${by} tagged you`.slice(0, 140), body: (where + "\n\n" + text0).slice(0, 1200),
    audience: "people", recipients: people.map((p: any) => p.id), bell: true, popup: false, created_by: me.id,
    ref: "place:" + nav + ":" + id,
  });
  return json({ sent, of: people.length, errors: errors.slice(0, 3) });
});
