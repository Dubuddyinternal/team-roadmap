// =====================================================================
// STAGE 23a — "social-okr" Edge Function: Individual OKR emails
//
// Social Media → 🎯 Individual OKRs keeps each person's objectives and key results
// (socialTargets → <space>.people[].objectives). Key results count themselves: ideas logged in
// Ideation by category, posts published by type; % and "done" counts are updated by the team.
//   mode "mid"  — cron on the 15th, 10:00 AM India time: OKR status so far, this month
//   mode "end"  — cron on the 28th–31st, 6:00 PM India time: sends only on the month's last day — the month's summary
//   mode "note" — ✍️ Write a mail from the tab: the message, optionally with the status below
//   body: { team?, mode, email?, from?, to?, subject?, message?, withStatus? }   header x-cron-key
// The tab's buttons go through public.social_okr_send_now (stage23a SQL), which checks who's asking.
// The email is built by okr-mail.js — the same file the page uses for 👁 Preview (deploy it next to this one).
//
// Same Zoho Mail secrets and key as social-weekly (feedback_cron.cron_key).
// DEPLOY: name exactly  social-okr , "Verify JWT" OFF. Files: index.ts + okr-mail.js (the repo's root okr-mail.js).
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";
import "./okr-mail.js";
// deno-lint-ignore no-explicit-any
const OKRMAIL = (globalThis as any).OKRMAIL;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://tools.dubuddy.in/";

type Pt = { d: string; v: number };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const dmy = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
function valueAt(s: Pt[], d: string) { let v: number | null = null; for (const p of s) { if (p.d <= d) v = p.v; else break; } return v; }
const monthEnd = (d: string) => { const x = new Date(d + "T00:00:00Z"); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); };
const monthLabel = (d: string) => new Date(d.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const quarterKey = (d: string) => d.slice(0, 4) + "-Q" + (Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1);
const ytId = (u: string) => (/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(u || "")) || [])[1] || null;
const igCode = (u: string) => (/instagram\.com\/(?:[^/]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/.exec(String(u || "")) || [])[1] || null;
const KIND: Record<string, string> = { "yt:short": "YT Short", "yt:long": "YT Long video", "yt:live": "YT Live", "ig:reel": "Insta Reel", "ig:image": "Insta Post", "ig:story": "Insta Story", "ig:live": "Insta Live" };
/* every published post, like the Summary counts them: synced posts, plus published cards the sync doesn't have */
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
      rows.push({ platform: pl, vtype: (c.vtype === "short" || c.vtype === "reel") ? (pl === "yt" ? "short" : "reel") : c.vtype, date: c.published || null });
    });
  });
  return rows;
}
/* one person's objectives for a date range, in the shape okr-mail.js takes */
function model(p: any, name: string, R: { from: string; asOf: string; months: number; custom: boolean }, ideas: any[], rows: any[], ser: Record<string, Pt[]>, cats: Record<string, string>) {
  const by = (i: any) => { const a = String(i.by || "").trim().toLowerCase(), n = name.trim().toLowerCase(); return !!a && (a === n || a.split(" ")[0] === n.split(" ")[0]); };
  const plats = (x: any) => Array.isArray(x.platforms) && x.platforms.length ? x.platforms : [x.platform || "ig"];
  return (p.objectives || []).map((ob: any) => {
    const krs = (ob.krs || []).filter((k: any) => Number(k.target) > 0).map((k: any) => {
      let v = 0;
      if (k.type === "ideas") v = ideas.filter((i) => by(i) && i.created >= R.from && i.created <= R.asOf && (!k.cat || i.cat === k.cat) && (!k.plat || plats(i).includes(k.plat))).length;
      else if (k.type === "posts") { const vert = k.vtype === "short" || k.vtype === "reel"; v = rows.filter((r) => r.date && r.date >= R.from && r.date <= R.asOf && r.platform === k.pl && (vert ? (r.vtype === "short" || r.vtype === "reel") : r.vtype === k.vtype)).length; }
      else v = Number((k.log || {})[k.period === "quarter" ? quarterKey(R.asOf) : R.asOf.slice(0, 7)] || 0);
      const t = k.period === "month" && k.type !== "manual_pct" && R.custom ? Math.ceil(Number(k.target) * R.months) : Number(k.target);
      const tag = k.type === "posts" ? (KIND[k.pl + ":" + k.vtype] || "Posts") : k.type === "ideas" ? (cats[k.cat] || "Any") + " ideas" : k.type === "count" ? "Done count" : "%";
      return { title: k.title, type: k.type, done: v, target: t, pct: Math.round(t ? Math.min(100, v / t * 100) : 0), tag };
    });
    let total = null;
    if (ob.pl && Number(ob.total) > 0) { const s = ser[ob.pl] || []; const now = s.length ? valueAt(s, R.asOf) : null, st = s.length ? valueAt(s, addDays(R.from, -1)) : null;
      total = { label: ob.pl === "yt" ? "YouTube subscribers" : "Instagram followers", now, target: Number(ob.total), gained: now != null && st != null ? now - st : null }; }
    return { title: ob.title, pct: krs.length ? Math.round(krs.reduce((a: number, k: any) => a + k.pct, 0) / krs.length) : 0, total, krs };
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: cfg } = await admin.from("feedback_cron").select("cron_key").eq("id", 1).single();
  const key = req.headers.get("x-cron-key") || "";
  if (!cfg || !key || key !== cfg.cron_key) return json({ error: "Not allowed" }, 403);
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const mode = ["mid", "end", "note"].includes(body.mode) ? body.mode : "mid", today = todayIST();
  // the month-end job runs on the 28th–31st and only sends on the month's last day
  if (mode === "end" && !body.email && addDays(today, 1).slice(8) !== "01") return json({ skipped: "not the last day of the month" });
  if (mode === "note" && !String(body.message || "").trim()) return json({ error: "no message" }, 400);
  const from = body.from || today.slice(0, 7) + "-01", asOf = body.to || today;
  const custom = !(from.slice(8) === "01" && (asOf === monthEnd(from) || asOf.slice(0, 7) === from.slice(0, 7)));
  const R = { from, asOf, custom, months: Math.max(1, Math.round((days(from, asOf) + 1) / 30.4)) };
  const period = custom ? dmy(from) + " – " + dmy(asOf) : monthLabel(from);

  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return json({ error: "email isn't set up (SMTP_USER / SMTP_PASS missing)" }, 500);
  const mailer = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") || "smtp.zoho.in", port: 465, secure: true, auth: { user, pass } });
  const sender = Deno.env.get("MAIL_FROM") || ("DU Buddy <" + user + ">");

  let q = admin.from("team_data").select("team_slug,data").eq("section", "socialTargets");
  if (body.team) q = q.eq("team_slug", body.team);
  const { data: tgts } = await q;
  const sent: string[] = [], skipped: string[] = [], failed: string[] = [];
  for (const row of tgts || []) {
    const team = row.team_slug, ST = row.data || {};
    const { data: csRow } = await admin.from("team_data").select("data").eq("team_slug", team).eq("section", "cspaces").maybeSingle();
    const spaces: any[] = (csRow && csRow.data && csRow.data.list) || [];
    const { data: snaps } = await admin.from("social_snapshots").select("platform,day,followers").eq("team_slug", team)
      .gte("day", addDays(from, -40)).order("day", { ascending: true }).limit(3000);
    const { data: posts } = await admin.from("social_posts").select("platform,external_id,url,post_type,published_at")
      .eq("team_slug", team).gte("published_at", addDays(from, -2)).lte("published_at", addDays(asOf, 2)).limit(3000);
    const ser: Record<string, Pt[]> = {
      yt: (snaps || []).filter((r: any) => r.platform === "youtube" && r.followers != null).map((r: any) => ({ d: r.day, v: Number(r.followers) })),
      ig: (snaps || []).filter((r: any) => r.platform === "instagram" && r.followers != null).map((r: any) => ({ d: r.day, v: Number(r.followers) })),
    };
    const link = APP_URL.replace(/\/?$/, "/") + "?team=" + encodeURIComponent(team);
    for (const spaceId of Object.keys(ST)) {
      const T = ST[spaceId] || {}, sp = spaces.find((x) => x.id === spaceId);
      if (!sp || sp.type !== "social") continue;
      const rows = postRows(posts || [], sp.sx), ideas = (sp.sx && sp.sx.ideas) || [];
      const cats = Object.assign({ helpful: "Helpful", product: "Product", experimental: "Experimental" }, (sp.sx && sp.sx.reg && sp.sx.reg.ideacat) || {});
      for (const p of (T.people || [])) {
        const email = String(p.email || "").toLowerCase(); if (!email) continue;
        if (body.email && String(body.email).toLowerCase() !== email) continue;
        if (!body.email && mode !== "note" && (p.mail || {})[mode] === false) { skipped.push(email + ": turned off"); continue; }   // "Send now" always sends
        const { data: prof } = await admin.from("profiles").select("email,name,profile").ilike("email", email).maybeSingle();
        const name = (prof && ((prof.profile && prof.profile.displayName) || prof.name)) || p.name || email.split("@")[0];
        const objectives = model(p, p.name || name, R, ideas, rows, ser, cats);
        if (mode !== "note" && !objectives.some((o: any) => o.krs.length)) { skipped.push(email + ": no key results"); continue; }
        const m = OKRMAIL.build({ mode, name, period, asOf: dmy(asOf), daysLeft: custom ? 0 : Math.max(0, days(asOf, monthEnd(from))), objectives,
          subject: body.subject || "", message: body.message || "", withStatus: body.withStatus !== false, link });
        try { await mailer.sendMail({ from: sender, to: email, subject: m.subject, text: m.text, html: m.html }); sent.push(email); }
        catch (e) { failed.push(email + ": " + ((e as Error)?.message || String(e))); }
      }
    }
  }
  return json({ mode, from, asOf, sent, skipped, failed });
});
