// =====================================================================
// CLAUDE PIPELINE: the rules. Used by the Vercel functions in api/pipeline/
// and by the local server, so both behave exactly the same.
//
// One job per Content Process card. Each step runs as one routine run:
//
//   [Edit with Claude] → plan   → brief_ready  ✋ Check 1 (approve / changes)
//   [Approve]          → render → (seo starts by itself) → final_review ✋ Check 2
//   [Post]             → post   → posted
//
// Two small helper jobs live next to a card's edit job:
//   "<id>__r"  🔎 vidIQ research (cards and ideas) → research_ready
//   "<id>__s"  ✍️ hook + talking points for the shoot → script_ready
// [Post at slot] parks an approved post as "scheduled"; tick() (every
// minute locally, every few minutes from Supabase pg_cron on the live site)
// starts the post step once its time has come.
//
// A run gets: the card's text, links to download its inputs, links to
// upload its outputs, and a signed callback link to report back. It gets
// no storage or database keys. Callbacks from an old run (after Cancel or
// a new start) are ignored, and every move checks the job's status first,
// so a double click can't start a step twice.
// =====================================================================
import crypto from "node:crypto";
import { store, Conflict } from "./store.js";
import { keyFor, downloadLink, uploadLink, removeFile } from "./files.js";
import { startRun } from "./routine.js";
import { whoIs } from "./auth.js";
import { BASE_URL, SECRET, MODE, CONFIGURED } from "./config.js";

const STEP_STATUS = { plan: "planning", render: "rendering", seo: "seo_running", post: "posting", research: "researching", script: "scripting" };
const RUNNING = Object.values(STEP_STATUS);
const FILE = { brief_sheet: "brief_sheet.jpg", brief_md: "brief.md", plan_result: "plan_result.json", edit: "edit.tar.gz",
  yt: "final_yt.mp4", ig: "final_ig.mp4", render_result: "render_result.json", seo: "seo.json", post_result: "post_result.json",
  research: "research.json", script: "script.json" };
const IO = {
  plan:   { in: ["raw", "edit"], out: ["brief_sheet", "brief_md", "plan_result", "edit"] },
  render: { in: ["raw", "edit"], out: ["yt", "ig", "render_result", "edit"] },
  seo:    { in: ["plan_result"], out: ["seo"] },
  post:   { in: ["yt", "ig"], out: ["post_result"] },
  research: { in: [], out: ["research"] },
  script:   { in: [], out: ["script"] },
};
const SHOW = ["brief_sheet", "brief_md", "yt", "ig"];   // files the card can display

// what each button may do, from which states, and who may press it
const ACTIONS = {
  start:           { from: [null, "cancelled", "failed"], perm: "run", step: "plan" },
  request_changes: { from: ["brief_ready"], perm: "run", step: "plan", notes: true },
  approve_edit:    { from: ["brief_ready"], perm: "approve", step: "render" },
  redo_seo:        { from: ["final_review", "post_failed"], perm: "run", step: "seo" },
  back_to_edit:    { from: ["final_review", "post_failed", "scheduled"], perm: "run", step: "plan", notes: true },
  post:            { from: ["final_review", "post_failed", "scheduled"], perm: "approve", step: "post" },
  schedule:        { from: ["final_review", "post_failed"], perm: "approve" },
  unschedule:      { from: ["scheduled"], perm: "approve" },
  reschedule:      { from: ["scheduled"], perm: "approve" },   // the card was moved to another day on the calendar
  retry:           { from: ["failed", "cancelled"], perm: "run" },
  cancel:          { from: [...RUNNING, "brief_ready", "final_review", "failed", "post_failed", "scheduled"], perm: "run" },
  mark_linked:     { from: ["posted"], perm: "run" },
  research:        { from: [null, "research_ready", "failed", "cancelled"], perm: "run", step: "research", aux: "__r" },
  script:          { from: [null, "script_ready", "failed", "cancelled"], perm: "run", step: "script", aux: "__s" },
};

const now = () => new Date().toISOString();
const TEAM_RE = /^[a-z0-9-]{1,40}$/, CARD_RE = /^[A-Za-z0-9_-]{1,60}$/;
const auxOf = id => (/(__r|__s)$/.exec(id) || [])[1] || "";   // helper jobs: research / script
const sign = (team, card, run) => crypto.createHmac("sha256", SECRET).update(`${team}/${card}/${run}`).digest("hex").slice(0, 40);
const keyOf = (job, name) => keyFor(job.team, job.card_id, name === "raw" ? job.raw_file : FILE[name]);

function log(job, msg) {
  job.history = (job.history || []).concat({ at: now(), status: job.status, msg: msg || "" }).slice(-60);
  job.updated_at = now();
}

// ---------------------------------------------------------------- http helpers
export function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(obj));
}
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;                 // Vercel parsed it
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return new Promise(ok => { let s = ""; req.on("data", c => s += c); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch { ok({}); } }); });
}
const query = req => new URL(req.url, "http://x").searchParams;
const NOT_SET_UP = "The Claude pipeline isn't set up on this site yet (see routine/SETUP.md).";
const wrap = fn => async (req, res) => {
  if (!CONFIGURED) {   // GET jobs answers quietly so the card can show a note; everything else says why it can't run
    if (/\/jobs/.test(req.url || "")) return send(res, 200, { data: {}, mode: "off", me: { canRun: false, canApprove: false } });
    return send(res, 503, { error: NOT_SET_UP });
  }
  try { await fn(req, res); }
  catch (e) { send(res, e instanceof Conflict ? 409 : 500, { error: e.message }); }
};

// ---------------------------------------------------------------- starting a step
function payload(job, step, run) {
  const io = IO[step], inputs = {}, outputs = {};
  io.in.forEach(n => { if (n === "raw" ? job.raw_file : job.files && job.files[n]) inputs[n] = downloadLink(keyOf(job, n)); });
  io.out.forEach(n => { outputs[n] = uploadLink(keyOf(job, n)); });
  return {
    v: 1, mode: MODE, team: job.team, job: job.card_id, run, step,
    card: job.card || {}, notes: job.notes || "", raw_name: job.raw_file || null,
    post: step === "post" ? job.post_request : null,
    inputs, outputs,
    callback: `${BASE_URL}/api/pipeline/callback?team=${job.team}&job=${encodeURIComponent(job.card_id)}&run=${run}&sig=${sign(job.team, job.card_id, run)}`,
  };
}

async function fire(job, step, expected, by) {
  const run = crypto.randomBytes(6).toString("hex");
  job.run = { id: run, step, started_at: now(), by: by || "" };
  job.status = STEP_STATUS[step]; job.last_step = step; job.error = null; job.progress = "Starting…";
  log(job, `${step} started${by ? " by " + by : ""}`);
  await store.save(job, expected);                         // the lock: fails if someone else moved it first
  try {
    const s = await startRun(payload(job, step, run));
    Object.assign(job.run, s);
  } catch (e) {
    job.status = step === "post" ? "post_failed" : "failed"; job.error = e.message; job.progress = "";
    log(job, e.message);
  }
  try { await store.save(job, STEP_STATUS[step]); }
  catch (e) { if (!(e instanceof Conflict)) throw e; }     // a very fast run already reported back
  return job;
}

// ---------------------------------------------------------------- GET /api/pipeline/jobs?team=
export const jobs = wrap(async (req, res) => {
  const team = query(req).get("team");
  if (!TEAM_RE.test(team || "")) return send(res, 400, { error: "Bad team" });
  const me = await whoIs(req, team);
  if (!me) return send(res, 401, { error: "Sign in to see the pipeline" });
  const list = await store.list(team), out = {};
  list.forEach(j => {
    const media = {};
    SHOW.forEach(n => { if (j.files && j.files[n]) media[n] = downloadLink(keyOf(j, n), 6 * 3600) + (MODE === "fire" ? "" : "&v=" + encodeURIComponent(j.files[n].at)); });
    out[j.card_id] = { ...j, media };
  });
  send(res, 200, { data: out, mode: MODE, me: { role: me.role, canRun: me.canRun, canApprove: me.canApprove } });
});

// ---------------------------------------------------------------- POST /api/pipeline/upload-url
// { team, job, name, size } → a link the browser PUTs the raw video to
export const uploadUrl = wrap(async (req, res) => {
  const b = await body(req);
  if (!TEAM_RE.test(b.team || "") || !CARD_RE.test(b.job || "")) return send(res, 400, { error: "Bad team or card" });
  const me = await whoIs(req, b.team);
  if (!me || !me.canRun) return send(res, 403, { error: "Your role can't start edits" });
  const ext = (/\.(mp4|mov|m4v|mkv)$/i.exec(b.name || "") || [])[1];
  if (!ext) return send(res, 400, { error: "Send a video file (.mp4 / .mov)" });
  const file = "raw." + ext.toLowerCase();
  send(res, 200, { data: { url: uploadLink(keyFor(b.team, b.job, file), 3 * 3600), file } });
});

// ---------------------------------------------------------------- POST /api/pipeline/action
// { team, job, action, card_info?, notes?, raw_file?, targets?, yt?, ig? }
export const action = wrap(async (req, res) => {
  const b = await body(req);
  if (!TEAM_RE.test(b.team || "") || !CARD_RE.test(b.job || "")) return send(res, 400, { error: "Bad team or card" });
  const a = ACTIONS[b.action];
  if (!a) return send(res, 400, { error: "Unknown action" });
  const me = await whoIs(req, b.team);
  if (!me) return send(res, 401, { error: "Sign in first" });
  if (a.perm === "approve" ? !me.canApprove : !me.canRun) return send(res, 403, { error: a.perm === "approve" ? "Only an owner or admin can approve and post" : "Your role can't run edits" });

  if ((a.aux || "") !== auxOf(b.job) && b.action !== "cancel") return send(res, 400, { error: "That action doesn't apply here" });
  let job = await store.get(b.team, b.job);
  const expected = job ? job.status : null;
  if (!a.from.includes(expected)) return send(res, 409, { error: `Can't ${b.action.replace(/_/g, " ")} while the job is ${expected || "not started"}` });
  if (a.notes && !String(b.notes || "").trim()) return send(res, 400, { error: "Write what should change first" });

  if (a.aux) job = { team: b.team, card_id: b.job, kind: b.action, created_at: now(), files: {}, history: job ? job.history : [] };
  if (b.action === "start") {
    if (!/^raw\.(mp4|mov|m4v|mkv)$/.test(b.raw_file || "")) return send(res, 400, { error: "Upload the raw video first" });
    job = { team: b.team, card_id: b.job, created_at: now(), raw_file: b.raw_file, raw_name: String(b.raw_name || b.raw_file).slice(0, 120),
      files: {}, history: job ? job.history : [] };
  }
  if (b.card_info && typeof b.card_info === "object") job.card = b.card_info;
  job.notes = b.notes ? String(b.notes).slice(0, 4000) : null;
  const by = me.name;

  if (b.action === "cancel") {
    job.status = "cancelled"; job.progress = ""; if (job.run) job.run.id = null;   // its late reports get ignored
    log(job, "Cancelled by " + by);
    return send(res, 200, { data: await store.save(job, expected) });
  }
  if (b.action === "mark_linked") { job.linked = true; log(job, "Link saved on the card"); return send(res, 200, { data: await store.save(job, expected) }); }
  if (b.action === "unschedule") {
    job.status = "final_review"; job.post_at = null; log(job, "Unscheduled by " + by + " — back to the final check");
    return send(res, 200, { data: await store.save(job, expected) });
  }
  if (b.action === "reschedule") {   // same approved post, new time
    const at = new Date(b.post_at || "");
    if (isNaN(at) || at < Date.now() - 60000) return send(res, 400, { error: "Pick a posting time in the future" });
    job.post_at = at.toISOString(); log(job, `Moved by ${by} to ${job.post_at}`);
    return send(res, 200, { data: await store.save(job, expected) });
  }
  if (b.action === "post" || b.action === "schedule") {
    const t = (b.targets || []).filter(x => x === "yt" || x === "ig").filter(x => job.files && job.files[x]);
    if (!t.length) return send(res, 400, { error: "Pick YouTube, Instagram or both" });
    // posting a scheduled job now keeps the text that was approved for the slot unless new text comes with it
    if (!(expected === "scheduled" && !b.yt && !b.ig && job.post_request))
      job.post_request = { targets: t, yt: t.includes("yt") ? b.yt : null, ig: t.includes("ig") ? b.ig : null, approved_by: by, approved_at: now() };
  }
  if (b.action === "schedule") {
    const at = new Date(b.post_at || "");
    if (isNaN(at) || at < Date.now() - 60000) return send(res, 400, { error: "Pick a posting time in the future" });
    job.post_at = at.toISOString(); job.status = "scheduled"; job.error = null;
    log(job, `Scheduled by ${by} for ${job.post_at}`);
    return send(res, 200, { data: await store.save(job, expected) });
  }
  const step = b.action === "retry" ? (job.last_step || "plan") : a.step;
  if (b.action === "retry" && step === "post") {   // never re-post on Retry: back to the final check, Post needs a fresh click
    job.status = "final_review"; job.error = null; log(job, "Back to the final check — look at the channel before posting again");
    return send(res, 200, { data: await store.save(job, expected) });
  }
  send(res, 200, { data: await fire(job, step, expected, by) });
});

// ---------------------------------------------------------------- POST /api/pipeline/callback?team&job&run&sig
// from the run: { event: "progress"|"done"|"failed", message, result, uploaded: [names] }
export const callback = wrap(async (req, res) => {
  const p = query(req), team = p.get("team"), card = p.get("job"), run = p.get("run");
  if (!TEAM_RE.test(team || "") || !CARD_RE.test(card || "") || !run || p.get("sig") !== sign(team, card, run)) return send(res, 403, { error: "Bad signature" });
  const b = await body(req);
  const job = await store.get(team, card);
  if (!job || !job.run || job.run.id !== run || !RUNNING.includes(job.status)) return send(res, 200, { data: { ignored: true } });
  const expected = job.status, step = job.run.step;

  if (b.event === "progress") {
    job.progress = String(b.message || "").slice(0, 300); job.updated_at = now();
    await store.save(job, expected); return send(res, 200, { data: { ok: true } });
  }
  (Array.isArray(b.uploaded) ? b.uploaded : []).filter(n => FILE[n]).forEach(n => { job.files[n] = { at: now() }; });
  const fail = msg => { job.status = step === "post" ? "post_failed" : "failed"; job.error = String(msg || "The run stopped").slice(0, 600); job.progress = ""; log(job, job.error); };
  const r = b.result && typeof b.result === "object" ? b.result : {};

  if (b.event !== "done") fail(b.message);
  else if (step === "plan") {
    if (!job.files.brief_sheet || !job.files.plan_result) fail("The run finished but no brief was uploaded. " + (b.message || ""));
    else { job.brief = { ...r, at: now() }; job.status = "brief_ready"; job.notes = null; job.progress = ""; log(job, "Brief ready for your review"); }
  } else if (step === "render") {
    if (!job.files.yt && !job.files.ig) fail("The run finished but no video was uploaded. " + (b.message || ""));
    else { job.outputs = { qc: r.qc || "" }; log(job, "Rendered");
      return send(res, 200, { data: await fire(job, "seo", expected, "") }); }      // SEO follows straight away
  } else if (step === "seo") {
    if (!r.yt) fail("SEO results were missing. " + (b.message || ""));
    else { job.seo = r; job.status = "final_review"; job.notes = null; job.progress = ""; log(job, "Ready for your final check"); }
  } else if (step === "script") {
    if (!r.hook && !(r.points || []).length) fail("The script draft came back empty. " + (b.message || ""));
    else { job.script = { ...r, at: now() }; job.status = "script_ready"; job.progress = ""; log(job, "Hook and talking points ready"); }
  } else if (step === "research") {
    if (!Array.isArray(r.keywords)) fail("vidIQ research came back empty. " + (b.message || ""));
    else { job.research = { ...r, at: now() }; job.status = "research_ready"; job.progress = ""; log(job, "Research ready"); }
  } else if (step === "post") {
    job.posted = r; job.progress = "";
    const ok = (job.post_request.targets || []).every(t => r[t] && r[t].status === "posted");
    job.status = ok ? "posted" : "post_failed";
    if (!ok) job.error = "Posting didn't fully go through — check the channel before posting again";
    log(job, ok ? "Posted" : job.error);
    // once it's live, the raw clip and the edit folder can go (the finals stay for the record)
    if (ok) ["raw", "edit"].forEach(n => removeFile(keyOf(job, n)).catch(() => {}));
  }
  await store.save(job, expected);
  send(res, 200, { data: { ok: true } });
});

// ---------------------------------------------------------------- scheduled posts
// Starts the post step for every scheduled job whose time has come. Called every minute by the local server,
// and on the live site by Supabase pg_cron through POST /api/pipeline/tick with the pipeline key.
export async function runDue() {
  const due = (await store.scheduled()).filter(j => j.status === "scheduled" && j.post_at && new Date(j.post_at) <= Date.now());
  for (const j of due) { try { await fire(j, "post", "scheduled", "the schedule"); } catch (e) { if (!(e instanceof Conflict)) console.error("[tick]", e.message); } }
  return due.length;
}
export const tick = wrap(async (req, res) => {
  const key = String(req.headers["x-pipeline-key"] || "");
  if (!key || key !== crypto.createHmac("sha256", SECRET).update("tick").digest("hex")) return send(res, 403, { error: "Bad key" });
  send(res, 200, { data: { started: await runDue() } });
});
