// =====================================================================
// STAGE 23a — "social-okr" Edge Function: Individual OKR emails
//
// Social Media → 🎯 Individual OKRs keeps monthly key results per person (socialTargets → <space>.people):
// Shorts / Reels / long videos published that month, and the YouTube subscriber / Instagram follower totals.
//   mode "mid" (cron, the 20th): a friendly reminder to everyone with a key result not reached yet.
//   mode "end" (cron, the 1st):  each person's summary of the month before — target vs done.
//   body: { team?, mode: "mid"|"end", email?, month?: "YYYY-MM", force? }   header x-cron-key
// "✉️ Send … now" in the tab goes through public.social_okr_send_now (stage23a SQL), which checks who's asking.
//
// Same Zoho Mail secrets and the same key as social-weekly (feedback_cron.cron_key).
// DEPLOY: name exactly  social-okr , "Verify JWT" OFF (it checks the cron key). Deploy index.ts AND mail.ts.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";
import { buildMail, krMet, type KR, type Month } from "./mail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://tools.dubuddy.in/";

type Pt = { d: string; v: number };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const quarterEnd = (d: string) => { const x = new Date(d + "T00:00:00Z"); return new Date(Date.UTC(x.getUTCFullYear(), Math.floor(x.getUTCMonth() / 3) * 3 + 3, 0)).toISOString().slice(0, 10); };
function valueAt(s: Pt[], d: string) { let v: number | null = null; for (const p of s) { if (p.d <= d) v = p.v; else break; } return v; }
function monthOf(k: string) {
  const [y, m] = k.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10), to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { k, from, to, label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) };
}
const ytId = (u: string) => (/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(u || "")) || [])[1] || null;
const igCode = (u: string) => (/instagram\.com\/(?:[^/]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/.exec(String(u || "")) || [])[1] || null;
/* every published post (synced, plus published cards the sync doesn't have), like the Summary counts them */
function postRows(posts: any[], sx: any) {
  const VT: Record<string, string> = { "Short": "short", "Long video": "long", "Live": "live", "Reel": "reel", "Carousel": "carousel", "Image": "image" };
  const rows: any[] = [], yt = new Set<string>(), ig = new Set<string>();
  posts.forEach((p) => {
    const pl = p.platform === "youtube" ? "yt" : p.platform === "instagram" ? "ig" : p.platform;
    if (pl === "yt") yt.add(p.external_id); else { const c = igCode(p.url); if (c) ig.add(c); }
    rows.push({ platform: pl, vtype: VT[p.post_type] || "long", date: p.published_at ? new Date(Date.parse(p.published_at) + 5.5 * 3600e3).toISOString().slice(0, 10) : null });
  });
  ((sx && sx.cards) || []).filter((c: any) => c && c.stage === "published").forEach((c: any) => {
    const pls: string[] = Array.isArray(c.platforms) && c.platforms.length ? c.platforms : [c.platform];
    pls.forEach((pl) => {
      const url = ((c.post && c.post.links) || {})[pl] || (pl === c.platform && c.post && c.post.postUrl) || "";
      if (pl === "yt" && yt.has(ytId(url) || "")) return;
      if (pl === "ig" && ig.has(igCode(url) || "")) return;
      const vt = (c.vtype === "short" || c.vtype === "reel") ? (pl === "yt" ? "short" : "reel") : c.vtype;
      rows.push({ platform: pl, vtype: vt, date: c.published || null });
    });
  });
  return rows;
}
const DEFS = [
  { k: "shorts", label: "YouTube Shorts published", tag: "YT Short", unit: "Shorts", f: (r: any) => r.platform === "yt" && r.vtype === "short" },
  { k: "reels", label: "Instagram Reels published", tag: "Insta Reel", unit: "Reels", f: (r: any) => r.platform === "ig" && r.vtype === "reel" },
  { k: "longs", label: "YouTube long videos published", tag: "YT Long video", unit: "long videos", f: (r: any) => r.platform === "yt" && r.vtype === "long" },
  { k: "ytTotal", label: "YouTube subscribers", tag: "YouTube", unit: "subscribers", pl: "yt" },
  { k: "igTotal", label: "Instagram followers", tag: "Instagram", unit: "followers", pl: "ig" },
];
function results(p: any, M: { from: string; to: string }, rows: any[], ser: Record<string, Pt[]>, T: any, today: string): KR[] {
  const end = M.to < today ? M.to : today;
  const inM = rows.filter((r) => r.date && r.date >= M.from && r.date <= end);
  const out: KR[] = [];
  for (const d of DEFS) {
    const target = Number((p.krs || {})[d.k]); if (!(target > 0)) continue;
    if (d.f) { out.push({ label: d.label, tag: d.tag, unit: d.unit, target, done: inM.filter(d.f).length }); continue; }
    const s = ser[d.pl!] || []; if (!s.length) continue;
    const startV = valueAt(s, addDays(M.from, -1)) ?? (s.find((x) => x.d >= M.from) || ({} as Pt)).v ?? null, now = valueAt(s, end);
    const dl = (T.by || {})[d.pl!] || quarterEnd(M.from);
    const a = new Date(M.from + "T00:00:00Z"), b = new Date(dl + "T00:00:00Z");
    const monthsLeft = Math.max(1, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1);
    const need = startV == null ? null : Math.max(0, Math.ceil((target - startV) / monthsLeft));
    out.push({ label: d.label, tag: d.tag, unit: d.unit, target, total: true, now, by: dl, need, gained: startV == null || now == null ? null : now - startV });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: cfg } = await admin.from("feedback_cron").select("cron_key").eq("id", 1).single();
  const key = req.headers.get("x-cron-key") || "";
  if (!cfg || !key || key !== cfg.cron_key) return json({ error: "Not allowed" }, 403);
  let body: { team?: string; mode?: string; email?: string; month?: string; force?: boolean } = {};
  try { body = await req.json(); } catch { body = {}; }
  const mode = body.mode === "end" ? "end" : "mid", today = todayIST();
  // the 20th looks at this month; the 1st at the month before
  const mk = body.month || (mode === "end" ? addDays(today.slice(0, 8) + "01", -1).slice(0, 7) : today.slice(0, 7));
  const M0 = monthOf(mk), M: Month = { label: M0.label, from: M0.from, to: M0.to, daysLeft: Math.max(0, days(today, M0.to) + 1) };

  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return json({ error: "email isn't set up (SMTP_USER / SMTP_PASS missing)" }, 500);
  const mailer = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") || "smtp.zoho.in", port: 465, secure: true, auth: { user, pass } });
  const from = Deno.env.get("MAIL_FROM") || ("DU Buddy <" + user + ">");

  let q = admin.from("team_data").select("team_slug,data").eq("section", "socialTargets");
  if (body.team) q = q.eq("team_slug", body.team);
  const { data: tgts } = await q;
  const sent: string[] = [], skipped: string[] = [], failed: string[] = [];
  for (const row of tgts || []) {
    const team = row.team_slug, ST = row.data || {};
    const { data: csRow } = await admin.from("team_data").select("data").eq("team_slug", team).eq("section", "cspaces").maybeSingle();
    const spaces: any[] = (csRow && csRow.data && csRow.data.list) || [];
    const { data: snaps } = await admin.from("social_snapshots").select("platform,day,followers").eq("team_slug", team)
      .gte("day", addDays(M.from, -40)).order("day", { ascending: true }).limit(3000);
    const { data: posts } = await admin.from("social_posts").select("platform,external_id,url,post_type,published_at")
      .eq("team_slug", team).gte("published_at", addDays(M.from, -2)).lte("published_at", addDays(M.to, 2)).limit(3000);
    const ser: Record<string, Pt[]> = {
      yt: (snaps || []).filter((r: any) => r.platform === "youtube" && r.followers != null).map((r: any) => ({ d: r.day, v: Number(r.followers) })),
      ig: (snaps || []).filter((r: any) => r.platform === "instagram" && r.followers != null).map((r: any) => ({ d: r.day, v: Number(r.followers) })),
    };
    const link = APP_URL.replace(/\/?$/, "/") + "?team=" + encodeURIComponent(team);
    for (const spaceId of Object.keys(ST)) {
      const T = ST[spaceId] || {}, sp = spaces.find((x) => x.id === spaceId);
      if (!sp || sp.type !== "social") continue;
      const rows = postRows(posts || [], sp.sx);
      for (const p of (T.people || [])) {
        const email = String(p.email || "").toLowerCase(); if (!email) continue;
        if (body.email && body.email.toLowerCase() !== email) continue;
        if (!body.email && (p.mail || {})[mode] === false) { skipped.push(email + ": turned off"); continue; }   // the tab's "Send now" always sends
        const krs = results(p, M, rows, ser, T, today);
        if (!krs.length) { skipped.push(email + ": no key results"); continue; }
        if (mode === "mid" && !body.force && krs.every(krMet)) { skipped.push(email + ": everything already reached 🎉"); continue; }
        const { data: prof } = await admin.from("profiles").select("email,name,profile").ilike("email", email).maybeSingle();
        const name = (prof && ((prof.profile && prof.profile.displayName) || prof.name)) || p.name || email.split("@")[0];
        const m = buildMail(mode, name, M, krs, link);
        try { await mailer.sendMail({ from, to: email, subject: m.subject, text: m.text, html: m.html }); sent.push(email); }
        catch (e) { failed.push(email + ": " + ((e as Error)?.message || String(e))); }
      }
    }
  }
  return json({ mode, month: mk, sent, skipped, failed });
});
