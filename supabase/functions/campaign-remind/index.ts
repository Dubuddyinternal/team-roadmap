// =====================================================================
// STAGE 24a — "campaign-remind" Edge Function: campaign board reminders
//
// action "tick"    (cron, header x-cron-key — every day 10:00 AM India time)
//   For every campaign (team_data cspaces): each board card (a piece from Campaign Details, or a board
//   task) whose deadline has passed and that isn't Live gets ONE reminder per deadline: a 🔔 to its owner
//   ("This card's status isn't updated", ref camp:<campaign>:<item> → ✓ Published in the bell) and an email.
//   Cards that went Live (in Content Process, or confirmed) close their waiting reminders.
// action "confirm" (a signed-in team member — the board's / bell's ✓ Published, or "Not yet: new date")
//   body { team, campaign_id, campaign, item_id, title, by, link?, new_date?, lead? }
//   Closes the reminder and tells the campaign lead (🔔 + email).
// Same Zoho Mail secrets as social-okr. DEPLOY: name exactly  campaign-remind , "Verify JWT" OFF.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("APP_URL") || "https://tools.dubuddy.in/").replace(/\/?$/, "/");
const DEFAULT_LEAD = "mannat.dubuddy@gmail.com";
// deadlines before the board existed don't send anything (no flood of old campaigns on day one)
const START = "2026-11-03";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const dmy = (d: string) => d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "";
const plats = (it: any) => Array.isArray(it.platforms) && it.platforms.length ? it.platforms : (it.platform ? [it.platform] : []);
const isContent = (it: any) => plats(it).some((p: string) => p === "YouTube" || p === "Instagram");

async function mailer() {
  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return null;
  const t = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") || "smtp.zoho.in", port: 465, secure: true, auth: { user, pass } });
  const from = Deno.env.get("MAIL_FROM") || ("DU Buddy <" + user + ">");
  return async (to: string, subject: string, text: string, html: string) => {
    try { await t.sendMail({ from, to, subject, text, html }); return null; } catch (e) { return (e as Error)?.message || String(e); }
  };
}
function page(name: string, paras: string[], rows: [string, string][], button: string, link: string) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1A1614;max-width:540px">'
    + '<div style="font-weight:800;font-size:18px;margin-bottom:14px">DU <span style="color:#E8622B">Buddy</span></div>'
    + "<p>Hi " + esc(name) + ",</p>" + paras.map((p) => "<p>" + p + "</p>").join("")
    + '<table style="border-collapse:collapse;margin:10px 0">' + rows.filter((r) => r[1]).map((r) => '<tr><td style="color:#8C7F75;padding:3px 14px 3px 0">' + esc(r[0]) + "</td><td><b>" + esc(r[1]) + "</b></td></tr>").join("") + "</table>"
    + '<p style="margin:20px 0"><a href="' + esc(link) + '" style="background:#E8622B;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px;display:inline-block">' + esc(button) + "</a></p>"
    + "<p>— The DU Buddy team</p></div>";
}
const firstName = (p: any) => String((p && ((p.profile && p.profile.displayName) || p.name)) || (p && p.email || "there").split("@")[0]).split(" ")[0];

/* every card on a campaign's board, with whether it's live */
function boardRows(cs: any, soc: any) {
  const cards: any[] = (soc && soc.sx && soc.sx.cards) || [];
  const out: any[] = [];
  for (const it of cs.items || []) {
    if (isContent(it)) {
      const card = it.sentCardId ? cards.find((c) => c && c.id === it.sentCardId) : null;
      out.push({ id: it.id, title: it.name || "(untitled)", due: it.date || "", ownerId: it.ownerId || (card && card.ownerId) || "", content: true,
        live: !!(card && card.stage === "published"), how: card && card.liveBy ? "Confirmed by " + card.liveBy : "Live in Content Process" });
    } else out.push({ id: it.id, title: it.name || "(untitled)", due: it.date || "", ownerId: it.ownerId || "", content: false, live: !!it.live, how: "Confirmed by " + (it.liveBy || "the team") });
  }
  for (const t of cs.tasks || []) out.push({ id: t.id, title: t.title || "(untitled)", due: t.due || "", ownerId: t.ownerId || "", content: false, live: !!t.live, how: "Confirmed by " + (t.liveBy || "the team") });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const send = await mailer();

  // ---------------------------------------------------------------- confirm
  if (body.action === "confirm") {
    const raw = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (raw.split(".").length !== 3) return json({ error: "Sign in first." }, 401);
    const { data: who } = await admin.auth.getUser(raw);
    const me = who?.user; if (!me) return json({ error: "Sign in first." }, 401);
    const team = String(body.team || ""), cid = String(body.campaign_id || ""), iid = String(body.item_id || "");
    if (!team || !cid || !iid) return json({ error: "Bad request" }, 400);
    const { data: mem } = await admin.from("memberships").select("user_id").eq("team_slug", team).eq("user_id", me.id).maybeSingle();
    const { data: meP } = await admin.from("profiles").select("id,email,name,profile,is_super").eq("id", me.id).maybeSingle();
    if (!mem && !(meP && meP.is_super)) return json({ error: "Not in this team" }, 403);
    const by = String(body.by || firstName(meP)).slice(0, 80), title = String(body.title || "a card").slice(0, 160);
    const camp = String(body.campaign || "the campaign").slice(0, 140), link = String(body.link || "").slice(0, 500), nd = /^\d{4}-\d{2}-\d{2}$/.test(body.new_date || "") ? body.new_date : "";
    await admin.from("campaign_reminders").update({ status: nd ? "moved" : "done", how: nd ? "New date: " + dmy(nd) + " (" + by + ")" : "Confirmed by " + by, done_at: new Date().toISOString() })
      .eq("team_slug", team).eq("campaign_id", cid).eq("item_id", iid).eq("status", "waiting");
    // the lead: the campaign's, else Mannat
    let lead: any = null;
    if (body.lead) { const { data } = await admin.from("profiles").select("id,email,name,profile").eq("id", body.lead).maybeSingle(); lead = data; }
    if (!lead) { const { data } = await admin.from("profiles").select("id,email,name,profile").ilike("email", DEFAULT_LEAD).maybeSingle(); lead = data; }
    if (!lead || lead.id === me.id) return json({ ok: true, told: null });
    const appLink = APP_URL + "?team=" + encodeURIComponent(team);
    const t1 = nd ? "🗓 “" + title + "” has a new date: " + dmy(nd) : "✅ “" + title + "” is live";
    const b1 = camp + " · " + (nd ? by + " moved it to " + dmy(nd) : "Confirmed by " + by) + (link ? "\n" + link : "");
    await admin.from("team_notifications").insert({ team_slug: team, title: t1, body: b1, audience: "people", recipients: [lead.id], bell: true, popup: false, created_by: me.id, ref: "campboard:" + cid });
    let mailed: string | null = "no email";
    if (send && lead.email) {
      const paras = nd ? ["<b>" + esc(by) + "</b> gave <b>“" + esc(title) + "”</b> in " + esc(camp) + " a new date: <b>" + esc(dmy(nd)) + "</b>."]
        : ["<b>" + esc(by) + "</b> confirmed <b>“" + esc(title) + "”</b> in " + esc(camp) + " is published. It's green on the board."];
      mailed = await send(lead.email, t1 + " — " + camp, "Hi " + firstName(lead) + ",\n\n" + b1 + "\n\n" + appLink, page(firstName(lead), paras, [["Link", link]], "Open the campaign board", appLink));
    }
    return json({ ok: true, told: lead.email, mailed: mailed || "sent" });
  }

  // ---------------------------------------------------------------- tick (cron)
  const { data: cfg } = await admin.from("feedback_cron").select("cron_key").eq("id", 1).single();
  const key = req.headers.get("x-cron-key") || "";
  if (!cfg || !key || key !== cfg.cron_key) return json({ error: "Not allowed" }, 403);
  const today = body.today && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : todayIST();
  let q = admin.from("team_data").select("team_slug,data").eq("section", "cspaces");
  if (body.team) q = q.eq("team_slug", body.team);
  const { data: rowsT } = await q;
  const sent: string[] = [], closed: string[] = [], failed: string[] = [];
  for (const row of rowsT || []) {
    const team = row.team_slug, list: any[] = (row.data && row.data.list) || [];
    const appLink = APP_URL + "?team=" + encodeURIComponent(team);
    const { data: open } = await admin.from("campaign_reminders").select("id,campaign_id,item_id,due,status").eq("team_slug", team).eq("status", "waiting");
    for (const cs of list.filter((x) => x && x.type === "campaign")) {
      const soc = list.find((x) => x.type === "social" && cs.parent && x.parent === cs.parent) || list.find((x) => x.type === "social") || null;
      const camp = (cs.details && cs.details.name) || cs.name || "a campaign";
      for (const r of boardRows(cs, soc)) {
        const mine = (open || []).filter((o: any) => o.campaign_id === cs.id && o.item_id === r.id);
        if (r.live) {   // went live: close what's waiting
          for (const o of mine) { await admin.from("campaign_reminders").update({ status: "done", how: r.how, done_at: new Date().toISOString() }).eq("id", o.id); closed.push(r.title); }
          continue;
        }
        // a new date replaced the old deadline: the old reminder is "moved"
        for (const o of mine.filter((o: any) => o.due !== r.due)) await admin.from("campaign_reminders").update({ status: "moved", how: "New date: " + dmy(r.due), done_at: new Date().toISOString() }).eq("id", o.id);
        if (!r.due || r.due >= today || r.due < START || !r.ownerId) continue;
        const { data: prof } = await admin.from("profiles").select("id,email,name,profile").eq("id", r.ownerId).maybeSingle();
        const ins = await admin.from("campaign_reminders").insert({ team_slug: team, campaign_id: cs.id, item_id: r.id, title: r.title, due: r.due,
          to_user: r.ownerId, to_name: prof ? ((prof.profile && prof.profile.displayName) || prof.name || "") : "" }).select("id").maybeSingle();
        if (ins.error) continue;   // already reminded for this deadline (unique), or a bad row
        await admin.from("team_notifications").insert({ team_slug: team, title: "⏰ This card's status isn't updated", audience: "people", recipients: [r.ownerId],
          body: "“" + r.title + "” · " + camp + " · was due " + dmy(r.due) + "\nIs it out? Press ✓ Published, or open the board to give it a new date.",
          bell: true, popup: true, ref: "camp:" + cs.id + ":" + r.id });
        if (send && prof && prof.email) {
          const err = await send(prof.email, "⏰ Is “" + r.title + "” out? — " + camp,
            "Hi " + firstName(prof) + ",\n\n“" + r.title + "” in " + camp + " was due " + dmy(r.due) + ", but its card isn't Live yet.\nIf it's out, press ✓ Published on the campaign board (or in your 🔔). If not, give it a new date there.\n\n" + appLink + "\n\n— The DU Buddy team",
            page(firstName(prof), ["<b>“" + esc(r.title) + "”</b> in <b>" + esc(camp) + "</b> was due <b>" + esc(dmy(r.due)) + "</b>, but its card isn't Live yet.",
              "If it's out, press <b>✓ Published</b> on the campaign board (or in your 🔔). If not, give it a new date there."],
              [["Campaign", camp], ["Was due", dmy(r.due)], ["Where", r.content ? "Campaign board + Content Process" : "Campaign board"]], "Open the campaign board", appLink));
          if (err) failed.push(prof.email + ": " + err);
        }
        sent.push(r.title + " → " + (prof ? prof.email : r.ownerId));
      }
    }
  }
  return json({ today, sent, closed, failed });
});
