// =====================================================================
// STAGE 22c — "social-weekly" Edge Function
//
// Every Monday morning (pg_cron → public.social_weekly_tick(), stage22c
// SQL) it emails each Social Media space's accountable people — the
// ⭐ Main accountable per platform and everyone 👥 ticked on a line in that
// space's 🤝 Our agreement — the same progress the Summary shows:
// subscribers / followers from the "counting from" day (default the 1st of
// the quarter) to the target, the end-of-month and end-of-quarter
// checkpoints, and the last weeks, week by week.
//   body: { team?: "dubuddy" }   (no team = every team)   header x-cron-key
//
// Uses the same Zoho Mail secrets as hr-remind / feedback-remind:
//   SMTP_USER, SMTP_PASS, SMTP_HOST (optional), MAIL_FROM (optional), APP_URL (optional)
//
// DEPLOY: name exactly  social-weekly , "Verify JWT" OFF (it checks the cron key).
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://tools.dubuddy.in/";

type Pt = { d: string; v: number };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
function esc(v: unknown) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
const sgn = (n: number) => (n >= 0 ? "+" : "−") + fmt(Math.abs(n));
/* dates as YYYY-MM-DD, India time */
function todayIST() { return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); }
function addDays(d: string, n: number) { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function days(a: string, b: string) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5); }
function monday(d: string) { const x = new Date(d + "T00:00:00Z"); return addDays(d, -((x.getUTCDay() + 6) % 7)); }
function quarterStart(d: string) { const x = new Date(d + "T00:00:00Z"); return new Date(Date.UTC(x.getUTCFullYear(), Math.floor(x.getUTCMonth() / 3) * 3, 1)).toISOString().slice(0, 10); }
function quarterEnd(d: string) { const x = new Date(d + "T00:00:00Z"); return new Date(Date.UTC(x.getUTCFullYear(), Math.floor(x.getUTCMonth() / 3) * 3 + 3, 0)).toISOString().slice(0, 10); }
function monthEnd(d: string) { const x = new Date(d + "T00:00:00Z"); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); }
function dmy(d: string) { return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }); }
function valueAt(s: Pt[], d: string) { let v: number | null = null; for (const p of s) { if (p.d <= d) v = p.v; else break; } return v; }
const LABEL: Record<string, string> = { total: "", time: "posting time", longs: "long videos", shorts: "shorts", lives: "live sessions", webinars: "webinars",
  community: "community posts", views: "views", reels: "reels", carousels: "carousels", images: "single-image posts", stories: "stories",
  iglives: "live sessions", posts: "posts", likes: "likes", comments: "comments", shares: "shares" };

/* ---------- the agreement lines (long videos, shorts, reels…), counted like the Summary does ---------- */
const METRIC: Record<string, { label: string; only?: string; untracked?: boolean; calc?: (r: any[]) => number; pct?: boolean }> = {
  posts: { label: "Posts published", calc: (r) => r.length },
  longs: { label: "Long videos", only: "yt", calc: (r) => r.filter((x) => x.vtype === "long").length },
  shorts: { label: "Shorts", only: "yt", calc: (r) => r.filter((x) => x.vtype === "short").length },
  lives: { label: "Live sessions", only: "yt", calc: (r) => r.filter((x) => x.vtype === "live").length },
  webinars: { label: "Webinars", only: "yt", untracked: true },
  community: { label: "Community posts", only: "yt", untracked: true },
  reels: { label: "Reels", only: "ig", calc: (r) => r.filter((x) => x.vtype === "reel").length },
  carousels: { label: "Carousels", only: "ig", calc: (r) => r.filter((x) => x.vtype === "carousel").length },
  images: { label: "Single-image posts", only: "ig", calc: (r) => r.filter((x) => x.vtype === "image").length },
  stories: { label: "Stories", only: "ig", untracked: true },
  iglives: { label: "Live sessions", only: "ig", untracked: true },
  views: { label: "Views", calc: (r) => r.reduce((a, x) => a + (Number(x.views) || 0), 0) },
  likes: { label: "Likes", calc: (r) => r.reduce((a, x) => a + (Number(x.likes) || 0), 0) },
  comments: { label: "Comments", calc: (r) => r.reduce((a, x) => a + (Number(x.comments) || 0), 0) },
  shares: { label: "Shares", calc: (r) => r.reduce((a, x) => a + (Number(x.shares) || 0), 0) },
  watchh: { label: "Watch hours", only: "yt", calc: (r) => Math.round(r.reduce((a, x) => a + (Number(x.watchMin) || 0), 0) / 60) },
  avgviews: { label: "Average views per post", calc: (r) => r.length ? Math.round(r.reduce((a, x) => a + (Number(x.views) || 0), 0) / r.length) : 0 },
  viewedpct: { label: "Average % viewed", only: "yt", pct: true, calc: (r) => { const v = r.filter((x) => x.viewed != null); return v.length ? Math.round(v.reduce((a, x) => a + Number(x.viewed), 0) / v.length) : 0; } },
  engage: { label: "Engagement rate", pct: true, calc: (r) => { const v = r.reduce((a, x) => a + (Number(x.views) || 0), 0); return v ? Math.round(r.reduce((a, x) => a + (Number(x.likes) || 0) + (Number(x.comments) || 0) + (Number(x.shares) || 0), 0) / v * 1000) / 10 : 0; } },
};
const PER: Record<string, string> = { day: "per day", week: "per week", month: "per month", quarter: "per quarter" };
const ytId = (u: string) => (/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(u || "")) || [])[1] || null;
const igCode = (u: string) => (/instagram\.com\/(?:[^/]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/.exec(String(u || "")) || [])[1] || null;
/* every published post: the synced ones, plus published cards the sync doesn't have */
function postRows(posts: any[], sx: any) {
  const rows: any[] = [];
  const VT: Record<string, string> = { "Short": "short", "Long video": "long", "Live": "live", "Reel": "reel", "Carousel": "carousel", "Image": "image" };
  const ytIds = new Set<string>(), igCodes = new Set<string>();
  posts.forEach((p) => {
    const pl = p.platform === "youtube" ? "yt" : p.platform === "instagram" ? "ig" : p.platform;
    if (pl === "yt") ytIds.add(p.external_id); else { const c = igCode(p.url); if (c) igCodes.add(c); }
    const d = p.published_at ? new Date(Date.parse(p.published_at) + 5.5 * 3600e3).toISOString().slice(0, 10) : null;
    rows.push({ platform: pl, vtype: VT[p.post_type] || "long", date: d, views: p.views, likes: p.likes, comments: p.comments, shares: p.shares, watchMin: p.watch_minutes, viewed: p.avg_view_pct });
  });
  ((sx && sx.cards) || []).filter((c: any) => c && c.stage === "published").forEach((c: any) => {
    const links = (c.post && c.post.links) || {}, url = links[c.platform] || (c.post && c.post.postUrl) || "";
    if (c.platform === "yt" && ytIds.has(ytId(url) || "")) return;
    if (c.platform === "ig" && igCodes.has(igCode(url) || "")) return;
    const m = c.metrics || {};
    rows.push({ platform: c.platform, vtype: c.vtype, date: c.published || null, views: m.views, likes: m.likes, comments: m.comments, shares: m.shares });
  });
  return rows;
}
function periodsOf(period: string, today: string) {
  const out: { from: string; to: string; now: boolean }[] = [];
  const mk = (i: number) => {
    const t = new Date(today + "T00:00:00Z");
    if (period === "week" || period === "day") { const f = addDays(monday(today), -7 * i); return { from: f, to: addDays(f, 6) }; }
    if (period === "month") { const a = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - i, 1)); const b = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - i + 1, 0)); return { from: a.toISOString().slice(0, 10), to: b.toISOString().slice(0, 10) }; }
    const q = Math.floor(t.getUTCMonth() / 3) * 3 - 3 * i; const a = new Date(Date.UTC(t.getUTCFullYear(), q, 1)); const b = new Date(Date.UTC(t.getUTCFullYear(), q + 3, 0));
    return { from: a.toISOString().slice(0, 10), to: b.toISOString().slice(0, 10) };
  };
  const n = period === "month" ? 2 : period === "quarter" ? 1 : 4;
  for (let i = n; i >= 0; i--) { const p = mk(i); out.push({ ...p, now: i === 0 }); }
  return out;
}
function goalsBlock(pl: "yt" | "ig", T: any, rows: any[], manual: Record<string, number>, today: string, link: string, mine: Set<string>) {
  const P = pl === "yt" ? "YouTube" : "Instagram", grey = "#8C7F75", red = "#C0392B", green = "#2E9466";
  const goals = (T.goals || []).filter((g: any) => g && g.platform === pl && Number(g.target) > 0 && METRIC[g.metric]);
  if (!goals.length) {
    return { kept: 0, total: 0, html: `<div style="border:1px dashed #E0D3C7;border-radius:12px;padding:12px 16px;margin:0 0 14px;color:${grey}">
      <b style="color:#1A1614">${P} agreement</b> — no lines set yet (long videos, shorts, reels…). <a href="${esc(link)}" style="color:#E8622B;font-weight:700">Set up your ${P} agreement now →</a></div>`,
      text: `${P} agreement: nothing set up yet — set it up now: ${link}` };
  }
  let kept = 0, total = 0; const lines: string[] = [], texts: string[] = [];
  goals.forEach((g: any) => {
    const m = METRIC[g.metric], per = g.period || "week", tgt = Number(g.target) * (per === "day" ? 7 : 1);
    const cells = periodsOf(per, today).map((p) => {
      const v = m.untracked ? Number(manual[`${pl}:${g.metric}:${p.from}`] || 0)
        : m.calc!(rows.filter((r) => r.platform === pl && r.date && r.date >= p.from && r.date <= p.to));
      const ok = v >= tgt; if (!p.now) { total++; if (ok) kept++; }
      return { p, v, ok };
    });
    const cur = cells[cells.length - 1], past = cells.filter((c) => !c.p.now), pk = past.filter((c) => c.ok).length;
    const unit = m.pct ? "%" : "", isMine = mine.has(pl + ":" + g.metric);
    lines.push(`<tr><td style="padding:5px 0">${esc(m.label)} <span style="color:${grey}">· ${fmt(Number(g.target))}${unit} ${PER[per] || ""}</span>${isMine ? ` <span style="color:#E8622B;font-size:11px">← you</span>` : ""}${m.untracked ? ` <span style="color:${grey};font-size:11px">(from proof)</span>` : ""}</td>
      <td style="text-align:right;font-family:monospace;color:${cur.ok ? green : red}">${fmt(cur.v)}${unit} / ${fmt(tgt)}${unit}</td>
      <td style="text-align:right;letter-spacing:2px">${past.map((c) => `<span title="${c.p.from}" style="color:${c.ok ? green : red}">${c.ok ? "✓" : "✕"}</span>`).join("")}</td>
      <td style="text-align:right;color:${grey};font-size:12px;white-space:nowrap">${past.length ? pk + " of " + past.length + " kept" : ""}</td></tr>`);
    texts.push(`${m.label} (${fmt(Number(g.target))}${unit} ${PER[per] || ""}): ${fmt(cur.v)}${unit} now · ${pk} of ${past.length} kept`);
  });
  const html = `<div style="border:1px solid #E5DDD5;border-radius:12px;padding:12px 16px;margin:0 0 14px">
    <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${grey};margin-bottom:6px">${P} agreement · ${total ? kept + " of " + total + " kept recently" : "first period running"}</div>
    <table style="width:100%;font-size:13px;border-collapse:collapse"><tr style="color:${grey};font-size:11px;text-transform:uppercase"><td>Line</td><td style="text-align:right">This period</td><td style="text-align:right">Before</td><td></td></tr>${lines.join("")}</table></div>`;
  return { kept, total, html, text: `${P} agreement — ` + texts.join("; ") };
}

/* one platform's block, as the Summary works it out */
function platformBlock(name: string, word: string, series: Pt[], T: any, pl: "yt" | "ig", today: string) {
  if (!series.length) return null;
  const tgt = Number((T.targets || {})[pl]) || 0; if (!tgt) return null;
  const from = (T.from || {})[pl] || quarterStart(today), dl = (T.by || {})[pl] || quarterEnd(today);
  let sv = valueAt(series, from), sd = from;
  if (sv == null) { const f = series.find((p) => p.d >= from); if (!f) return null; sv = f.v; sd = f.d; }
  const last = series[series.length - 1], cur = last.v, gained = cur - sv, gap = Math.max(1, tgt - sv);
  const span = Math.max(1, days(sd, dl)), line = (d: string) => Math.round(sv! + (tgt - sv!) * Math.min(1, Math.max(0, days(sd, d)) / span));
  const weeks = Math.max(1, Math.ceil(days(sd, dl) / 7)), need = Math.max(0, Math.ceil((tgt - sv) / weeks));
  const me = monthEnd(today), qe = quarterEnd(today);
  const rows: { w: string; gain: number; at: number; should: number; now: boolean }[] = [];
  for (let w = monday(sd); w <= today && rows.length < 60; w = addDays(w, 7)) {
    const we = addDays(w, 6), a = valueAt(series, addDays(w, -1)) ?? (w <= sd ? sv : null), b = valueAt(series, we < today ? we : today);
    if (a != null && b != null) rows.push({ w, gain: b - a, at: b, should: line(we), now: we >= today });
  }
  const done = rows.filter((r) => !r.now), met = done.filter((r) => r.gain >= need).length;
  const red = "#C0392B", green = "#2E9466", grey = "#8C7F75";
  const cp = (lbl: string, d: string, v: number) => `<tr><td style="padding:4px 0">${lbl} <span style="color:${grey}">${dmy(d)}</span></td><td style="text-align:right;font-family:monospace">${fmt(v)}</td><td style="text-align:right;color:${v > cur ? red : green};font-weight:700">${v > cur ? fmt(v - cur) + " to go" : "on track ✓"}</td></tr>`;
  const wk = rows.slice(-6).reverse().map((r) => `<tr><td style="padding:4px 0">${r.now ? "This week" : "Week of " + dmy(r.w)}</td><td style="text-align:right;color:${r.gain >= need ? green : red};font-family:monospace">${sgn(r.gain)}</td><td style="text-align:right;color:${grey};font-family:monospace">+${fmt(need)}</td><td style="text-align:right;color:${grey};font-family:monospace">${fmt(r.should)}</td><td style="text-align:right;color:${r.at < r.should ? red : green};font-family:monospace;font-weight:700">${fmt(r.at)}</td><td style="text-align:center">${r.now ? "…" : r.gain >= need ? "✓" : "✕"}</td></tr>`).join("");
  const pct = Math.max(0, Math.min(100, gained / gap * 100));
  const html = `<div style="border:1px solid #E5DDD5;border-radius:12px;padding:14px 16px;margin:0 0 14px">
    <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${grey}">${name} ${word}</div>
    <div style="font-size:24px;font-weight:800;margin:2px 0">${fmt(cur)} <span style="font-size:15px;color:${grey};font-weight:500">/ ${fmt(tgt)}</span></div>
    <div style="font-size:13px;color:${grey}">Started at <b style="color:#1A1614">${fmt(sv)}</b> on ${dmy(sd)} → now <b style="color:#1A1614">${fmt(cur)}</b> → target <b style="color:#1A1614">${fmt(tgt)}</b> by ${dmy(dl)}</div>
    <div style="height:8px;background:#EEE6DF;border-radius:99px;margin:10px 0 6px;overflow:hidden"><div style="height:8px;width:${pct.toFixed(1)}%;background:${pl === "yt" ? "#D9682B" : "#6D4AE0"}"></div></div>
    <div style="font-size:13px"><b style="color:${gained > 0 ? green : red}">${sgn(gained)}</b> of +${fmt(tgt - sv)} gained · ${pct.toFixed(1)}% · ${fmt(Math.max(0, tgt - cur))} to go · needs +${fmt(need)} a week</div>
    <table style="width:100%;font-size:13px;margin-top:10px;border-collapse:collapse">${cp("By end of month", me, line(me))}${cp("By end of quarter", qe, qe >= dl ? tgt : line(qe))}</table>
    ${wk ? `<div style="font-size:12px;color:${grey};margin:12px 0 4px">Week by week · ${done.length ? met + " of " + done.length + " weeks on pace" : "first week running"}</div>
    <table style="width:100%;font-size:12.5px;border-collapse:collapse"><tr style="color:${grey};font-size:11px;text-transform:uppercase"><td>Week</td><td style="text-align:right">Change</td><td style="text-align:right">Needed</td><td style="text-align:right">Should be</td><td style="text-align:right">Reached</td><td></td></tr>${wk}</table>` : ""}</div>`;
  const text = `${name} ${word}: ${fmt(cur)} / ${fmt(tgt)} — started at ${fmt(sv)} on ${dmy(sd)}, ${sgn(gained)} gained (${pct.toFixed(1)}%). Needs +${fmt(need)} a week. By end of month should be ${fmt(line(me))}.`;
  return { html, text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: cfg } = await admin.from("feedback_cron").select("cron_key").eq("id", 1).single();
  const key = req.headers.get("x-cron-key") || "";
  if (!cfg || !key || key !== cfg.cron_key) return json({ error: "Not allowed" }, 403);
  let body: { team?: string } = {};
  try { body = await req.json(); } catch { body = {}; }

  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return json({ error: "email isn't set up (SMTP_USER / SMTP_PASS missing)" }, 500);
  const mailer = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") || "smtp.zoho.in", port: 465, secure: true, auth: { user, pass } });
  const from = Deno.env.get("MAIL_FROM") || ("DU Buddy <" + user + ">");
  const today = todayIST();

  let q = admin.from("team_data").select("team_slug,data").eq("section", "socialTargets");
  if (body.team) q = q.eq("team_slug", body.team);
  const { data: tgts } = await q;
  let sent = 0; const failed: string[] = [];
  for (const row of tgts || []) {
    const team = row.team_slug, ST = row.data || {};
    const { data: csRow } = await admin.from("team_data").select("data").eq("team_slug", team).eq("section", "cspaces").maybeSingle();
    const spaces: any[] = (csRow && csRow.data && csRow.data.list) || [];
    const { data: snaps } = await admin.from("social_snapshots").select("platform,day,followers").eq("team_slug", team)
      .gte("day", addDays(today, -200)).order("day", { ascending: true }).limit(3000);
    const { data: posts } = await admin.from("social_posts").select("platform,external_id,url,post_type,published_at,views,likes,comments,shares,watch_minutes,avg_view_pct")
      .eq("team_slug", team).gte("published_at", addDays(today, -200)).limit(3000);
    const ser = (p: string) => (snaps || []).filter((r: any) => r.platform === p && r.followers != null).map((r: any) => ({ d: r.day, v: Number(r.followers) }));
    for (const spaceId of Object.keys(ST)) {
      const T = ST[spaceId] || {}, sp = spaces.find((x) => x.id === spaceId);
      if (!sp || sp.type !== "social") continue;
      const lead = T.lead || {}, who = T.who || {};
      const people = new Set<string>();
      ["yt", "ig"].forEach((pl) => { if (lead[pl]) people.add(String(lead[pl]).toLowerCase()); });
      Object.values(who).forEach((l: any) => (l || []).forEach((e: string) => e && people.add(String(e).toLowerCase())));
      if (!people.size) continue;
      let ig = ser("instagram");
      if (!ig.length && sp.sx && Array.isArray(sp.sx.igFollowers)) ig = sp.sx.igFollowers.filter((f: any) => f && f.d && f.v != null).map((f: any) => ({ d: f.d, v: Number(f.v) })).sort((a: Pt, b: Pt) => a.d.localeCompare(b.d));
      const yb = platformBlock("YouTube", "subscribers", ser("youtube"), T, "yt", today);
      const ib = platformBlock("Instagram", "followers", ig, T, "ig", today);
      const link = APP_URL.replace(/\/?$/, "/") + "?team=" + encodeURIComponent(team);
      const rows = postRows(posts || [], sp.sx), manual = (sp.sx && sp.sx.manual) || {};
      for (const email of people) {
        const { data: prof } = await admin.from("profiles").select("email,name,profile").ilike("email", email).maybeSingle();
        if (!prof?.email) continue;
        const name = (prof.profile && prof.profile.displayName) || prof.name || "there";
        /* what this person is on */
        const roles: string[] = [];
        (["yt", "ig"] as const).forEach((pl) => {
          const P = pl === "yt" ? "YouTube" : "Instagram";
          if (String(lead[pl] || "").toLowerCase() === email) roles.push("⭐ main accountable for " + P);
          const lines = Object.keys(who).filter((k) => k.startsWith(pl + ":") && (who[k] || []).some((e: string) => String(e).toLowerCase() === email))
            .map((k) => { const m = k.slice(pl.length + 1); return m === "total" ? (pl === "yt" ? "subscribers" : "followers") : (LABEL[m] || m); });
          if (lines.length) roles.push("👥 " + P + ": " + lines.join(", "));
        });
        const mineKeys = new Set<string>(Object.keys(who).filter((k) => (who[k] || []).some((e: string) => String(e).toLowerCase() === email)));
        (["yt", "ig"] as const).forEach((pl) => { if (String(lead[pl] || "").toLowerCase() === email) Object.keys(METRIC).forEach((m) => mineKeys.add(pl + ":" + m)); });
        const yg = goalsBlock("yt", T, rows, manual, today, link, mineKeys), ig2 = goalsBlock("ig", T, rows, manual, today, link, mineKeys);
        const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1A1614;max-width:640px">'
          + '<div style="font-weight:800;font-size:18px;margin-bottom:12px">DU <span style="color:#E8622B">Buddy</span></div>'
          + `<p>Hi ${esc(name)},</p><p>Here's this week's progress for <b>${esc(sp.name || "Social Media")}</b>.${roles.length ? " You're on it as: " + esc(roles.join(" · ")) + "." : ""}</p>`
          + (yb ? yb.html : "") + yg.html + (ib ? ib.html : "") + ig2.html
          + `<p style="margin:16px 0"><a href="${esc(link)}" style="background:#E8622B;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px;display:inline-block">Open the Summary</a></p>`
          + '<p style="color:#8C7F75;font-size:12px">Sent every Monday to the people accountable in this space\'s 🤝 Our agreement.</p></div>';
        const text = `Hi ${name},\n\nThis week's progress for ${sp.name || "Social Media"}.${roles.length ? " You're on it as: " + roles.join(" · ") + "." : ""}\n\n` + [yb, yg, ib, ig2].filter(Boolean).map((b) => b!.text).join("\n") + `\n\nOpen the Summary: ${link}`;
        try {
          await mailer.sendMail({ from, to: prof.email, subject: `Weekly progress — ${sp.name || "Social Media"}: ${[yb ? "YouTube" : "", ib ? "Instagram" : ""].filter(Boolean).join(" & ")}`, text, html });
          sent++;
        } catch (e) { failed.push(prof.email + ": " + ((e as Error)?.message || String(e))); }
      }
    }
  }
  return json({ sent, failed });
});
