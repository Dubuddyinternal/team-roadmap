// =====================================================================
// CLAUDE PIPELINE: the rules. Used by the Vercel functions in api/pipeline/
// and by the local server, so both behave exactly the same.
//
// One job per Content Process card. Each step runs as one routine run:
//
//   [Edit with Claude] → chat: ONE cloud session you talk to in claude.ai ("Open the edit chat"). Claude watches the
//      clip and proposes (proposal_ready) → builds after your OK (brief_ready, ▶ live player on the card) → renders only
//      when you say "render" (final_review). It stays in the chat and reports each stage here (callback "stage").
//   [Edit again]       → reedit: a new chat with the last edit folder + notes, for one version or both
//   [Render] on the card → render: a one-shot render of the built edit (the versions the card posts to)
//   The older one-step-per-run actions (propose / plan / render) still work.
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
import { keyFor, downloadLink, uploadLink, removeFile, listFiles } from "./files.js";
import { startRun } from "./routine.js";
import { blocked, usage, forget, FREE, STOP } from "./limits.js";
import { whoIs } from "./auth.js";
import { apiKey as elevenKey } from "../voice.js";
import { resolve as resolveLink, piece, sink, extOf, PART } from "./linkcopy.js";
import { BASE_URL, SECRET, MODE, CONFIGURED, GIT_REF, BYPASS, SUPABASE, STORE, FILES } from "./config.js";

const STEP_STATUS = { chat: "proposing", reedit: "chat_open", propose: "proposing", plan: "planning", render: "rendering", seo: "seo_running", post: "posting", research: "researching", script: "scripting" };
const RUNNING = Object.values(STEP_STATUS);
const FILE = { brief_sheet: "brief_sheet.jpg", brief_md: "brief.md", plan_result: "plan_result.json", edit: "edit.tar.gz",
  yt: "final_yt.mp4", ig: "final_ig.mp4", render_result: "render_result.json", seo: "seo.json", post_result: "post_result.json",
  research: "research.json", script: "script.json", preview: "preview/hf_yt/index.html", proposal: "proposal.json" };
const IO = {
  chat:   { in: ["raw", "edit"], out: [] },                                   // uploads go out on demand (callback "uploads")
  reedit: { in: ["raw", "edit", "proposal", "plan_result"], out: [] },
  propose:{ in: ["raw", "edit"], out: ["proposal", "edit"] },
  plan:   { in: ["raw", "edit", "proposal"], out: ["brief_sheet", "brief_md", "plan_result", "edit"] },
  render: { in: ["raw", "edit"], out: ["yt", "ig", "render_result", "edit"] },
  seo:    { in: ["plan_result"], out: ["seo"] },
  post:   { in: ["yt", "ig"], out: ["post_result"] },
  research: { in: [], out: ["research"] },
  script:   { in: [], out: ["script"] },
};
const SFX_LIBRARY = "library/sound-effects.zip";
const SHOW = ["brief_sheet", "brief_md", "yt", "ig"];   // files the card can display

// what each button may do, from which states, and who may press it
const ACTIONS = {
  start:           { from: [null, "cancelled", "failed"], perm: "run", step: "chat" },
  edit_again:      { from: ["final_review", "brief_ready", "proposal_ready", "chat_open", "failed", "cancelled"], perm: "run", step: "reedit" },
  change_plan:     { from: ["proposal_ready"], perm: "run", step: "propose", notes: true },   // Check 1: "change the plan"
  approve_plan:    { from: ["proposal_ready"], perm: "run", step: "plan" },   // Check 1: "looks good — build it" (notes optional: small tweaks)
  request_changes: { from: ["brief_ready"], perm: "run", step: "plan", notes: true },
  approve_edit:    { from: ["brief_ready", "final_review"], perm: "approve", step: "render" },   // the card's Render button
  studio:          { from: ["brief_ready"], perm: "run" },   // links for HyperFrames Studio on a Mac (see studio/)
  redo_seo:        { from: ["final_review", "post_failed"], perm: "run", step: "seo" },
  back_to_edit:    { from: ["final_review", "post_failed", "scheduled"], perm: "run", step: "plan", notes: true },
  post:            { from: ["final_review", "post_failed", "scheduled"], perm: "approve", step: "post" },
  schedule:        { from: ["final_review", "post_failed"], perm: "approve" },
  unschedule:      { from: ["scheduled"], perm: "approve" },
  reschedule:      { from: ["scheduled"], perm: "approve" },   // the card was moved to another day on the calendar
  retry:           { from: ["failed", "cancelled", "paused"], perm: "run" },   // paused: "check again now"
  cancel:          { from: [...RUNNING, "proposal_ready", "chat_open", "brief_ready", "final_review", "failed", "post_failed", "scheduled", "paused"], perm: "run" },
  mark_linked:     { from: ["posted"], perm: "run" },
  research:        { from: [null, "research_ready", "failed", "cancelled"], perm: "run", step: "research", aux: "__r" },
  script:          { from: [null, "script_ready", "failed", "cancelled"], perm: "run", step: "script", aux: "__s" },
};

const now = () => new Date().toISOString();
const TEAM_RE = /^[a-z0-9-]{1,40}$/, CARD_RE = /^[A-Za-z0-9_-]{1,60}$/;
const auxOf = id => (/(__r|__s)$/.exec(id) || [])[1] || "";   // helper jobs: research / script
const sign = (team, card, run) => crypto.createHmac("sha256", SECRET).update(`${team}/${card}/${run}`).digest("hex").slice(0, 40);
// the link a run (or the Studio script) reports back to
const callbackUrl = (job, run) => `${BASE_URL}/api/pipeline/callback?team=${job.team}&job=${encodeURIComponent(job.card_id)}&run=${run}&sig=${sign(job.team, job.card_id, run)}`
  + (BYPASS ? `&x-vercel-protection-bypass=${encodeURIComponent(BYPASS)}` : "");
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
function payload(job, step, run, history) {
  const io = IO[step], inputs = {}, outputs = {};
  io.in.forEach(n => { if (n === "raw" ? job.raw_file : job.files && job.files[n]) inputs[n] = downloadLink(keyOf(job, n)); });
  io.out.forEach(n => { outputs[n] = uploadLink(keyOf(job, n)); });
  // the whole SFX library (uploaded once by an owner to library/sound-effects.zip in storage); the run skips it if missing
  if (["chat", "reedit", "propose", "plan", "render"].includes(step)) inputs.sfx_library = downloadLink(SFX_LIBRARY, 6 * 3600);
  // the owner's cleaned audio (Adobe Podcast): the run puts it into the raw video before editing
  if (["chat", "reedit", "propose", "plan"].includes(step) && job.clean_file) inputs.clean_audio = downloadLink(keyFor(job.team, job.card_id, job.clean_file));
  return {
    v: 1, mode: MODE, team: job.team, job: job.card_id, run, step,
    card: job.card || {}, notes: job.notes || "", raw_name: job.raw_file || null, clean_name: job.clean_file || null,
    post: step === "post" ? job.post_request : null,
    // which versions to make: the card's "Post on" (YouTube Short / Instagram Reel), or what "Edit again" / Render picked
    targets: (job.targets && job.targets.length ? job.targets : cardTargets(job)),
    chat: step === "chat" || step === "reedit", reedit: step === "reedit" ? { targets: job.targets || [], notes: job.notes || "" } : null,
    history: history || [],   // the card chat so far: a new session picks the conversation up where the last one stopped
    inputs, outputs,
    callback: callbackUrl(job, run),
    ref: GIT_REF || undefined,   // preview site: run with that branch's skill and instructions
  };
}

const cardTargets = job => { const pl = ((job.card && job.card.platforms) || [job.card && job.card.platform]).filter(x => x === "yt" || x === "ig");
  return pl.length ? [...new Set(pl)] : ["yt", "ig"]; };
const NEED = { chat: { bytes: 400e6, a: 400, b: 300 }, reedit: { bytes: 400e6, a: 400, b: 300 }, propose: { bytes: 200e6, a: 100, b: 100 }, plan: { bytes: 400e6, a: 400, b: 300 }, render: { bytes: 500e6, a: 100, b: 200 },
  seo: { a: 10, b: 10 }, post: { a: 10, b: 50 }, research: { a: 5, b: 5 }, script: { a: 5, b: 5 } };
async function fire(job, step, expected, by, restart) {   // restart: { of: <stuck run id>, n: <attempt> }
  const run = crypto.randomBytes(6).toString("hex");
  job.run = { id: run, step, started_at: now(), by: by || "", restarts: restart ? restart.n : 0 };
  job.status = STEP_STATUS[step]; job.last_step = step; job.error = null; job.progress = "Starting…";
  log(job, restart ? `${step} restarted by itself (attempt ${restart.n + 1}) — the last run never got going` : `${step} started${by ? " by " + by : ""}`);
  // never past the free tier: a step that would cross a limit waits as "paused" and starts by itself later (runDue)
  const stop = await blocked(NEED[step]).catch(() => null);
  if (stop) {
    job.status = "paused"; job.paused = { step, why: stop.why, resumes: stop.resumes, kind: stop.kind, at: now(), by: by || "" };
    job.error = null; job.progress = ""; log(job, `${step} paused — free limit: ${stop.why}`);
    await store.save(job, expected, restart && restart.of);
    return job;
  }
  job.paused = null;
  if (["chat", "reedit", "propose", "plan"].includes(step)) job.clean_file = await cleanFile(job.team, job.card_id);   // picked up fresh every time
  job.run.chat = step === "chat" || step === "reedit";
  await store.save(job, expected, restart && restart.of);  // the lock: fails if someone else moved it first
  try {
    const hist = job.run.chat ? ((await store.get(job.team, chatId(job.card_id)).catch(() => null)) || {}).msgs || [] : [];
    const notes = (((await store.get(job.team, SKILL_ID).catch(() => null)) || {}).notes || []).map(n => n.text);
    const s = await startRun({ ...payload(job, step, run, hist.slice(-80).map(m => ({ from: m.from, by: m.by, at: m.at, text: m.text, files: m.files, cmd: m.cmd, targets: m.targets }))),
      skill_notes: notes });
    Object.assign(job.run, s);
  } catch (e) {
    job.status = step === "post" ? "post_failed" : "failed"; job.error = e.message; job.progress = "";
    log(job, e.message);
  }
  try { await store.save(job, STEP_STATUS[step], run); }
  catch (e) { if (!(e instanceof Conflict)) throw e; }     // a very fast run already reported back, or it was restarted
  return job;
}

// ---------------------------------------------------------------- GET /api/pipeline/jobs?team=
export const jobs = wrap(async (req, res) => {
  const team = query(req).get("team");
  if (!TEAM_RE.test(team || "")) return send(res, 400, { error: "Bad team" });
  const me = await whoIs(req, team);
  if (!me) return send(res, 401, { error: "Sign in to see the pipeline" });
  const all = await store.list(team), out = {};
  // 🗑 bins: an hour up → gone from storage now (the tick does this too; this keeps it on time wherever the app is open)
  for (const r of all.filter(j => j.status === "bin" && new Date(j.due) <= Date.now())) await purgeBin(team, r.card_id.replace(/__bin$/, "")).catch(() => {});
  const chats = {}; all.filter(j => j.status === "chat").forEach(c => { chats[c.card_id.replace(/__chat$/, "")] = c; });
  const list = all.filter(j => j.status !== "bin" && j.status !== "chat" && j.status !== "skill");
  const skill = all.find(j => j.status === "skill");
  // a cloud run that never got going: stop it and start it again by itself (twice), then say so.
  //   no run at Anthropic: the website was cut off between "started" and Anthropic's answer → after 2 minutes
  //   a run that never reported back (still "Starting…") → after 20 minutes (setup takes 1–3)
  for (const j of list) {
    if (MODE !== "fire" || !RUNNING.includes(j.status) || !j.run || !j.run.id || j.progress !== "Starting…") continue;
    if (Date.now() - new Date(j.run.started_at) < (j.run.session_id ? 20 : 2) * 60000) continue;
    const was = j.status, step = j.run.step, n = j.run.restarts || 0;
    try {
      if (n < 2) await fire(j, step, was, j.run.by, { of: j.run.id, n: n + 1 });
      else {
        j.status = step === "post" ? "post_failed" : "failed"; j.progress = "";
        j.error = "The cloud run didn't start after 3 tries. Check claude.ai → Routines, then press Retry.";
        log(j, j.error); await store.save(j, was, j.run.id);
      }
    } catch (e) { if (!(e instanceof Conflict)) throw e; }   // another open page already restarted it
  }
  list.forEach(j => {
    const media = {};
    SHOW.forEach(n => { if (j.files && j.files[n]) media[n] = downloadLink(keyOf(j, n), 6 * 3600) + (MODE === "fire" ? "" : "&v=" + encodeURIComponent(j.files[n].at)); });
    if (j.files && j.files.preview) {   // ▶ live player: the composition itself, played in the browser (no render)
      const t = previewToken(j.team, j.card_id, Math.floor(Date.now() / 1000) + 6 * 3600);
      const vs = (j.variants && j.variants.length) ? j.variants : ["yt", "ig"], v = encodeURIComponent(j.files.preview.at);
      if (vs.includes("yt")) media.preview_yt = `/pv/${t}/hf_yt/index.html?v=${v}`;
      if (vs.includes("ig")) media.preview_ig = `/pv/${t}/hf_ig/index.html?v=${v}`;
    }
    const c = chats[j.card_id];   // 💬 the card's chat with Claude (its own row: you and Claude write to it at the same time)
    out[j.card_id] = { ...j, media, chat: c ? (c.msgs || []).slice(-120).map(m => ({ ...m, files: (m.files || []).map(f => ({ name: f, url: downloadLink(keyFor(j.team, j.card_id, "refs/" + f), 6 * 3600) })) })) : [],
      chat_live: chatAlive(j, c) };
  });
  send(res, 200, { data: out, mode: MODE, skill_notes: skill ? skill.notes || [] : [], me: { role: me.role, canRun: me.canRun, canApprove: me.canApprove } });
});

// ---------------------------------------------------------------- POST /api/pipeline/upload-url
// { team, job, name, size } → a link the browser PUTs the raw video to
// 💬 photos / videos attached to a comment: comments/<team>/<yyyy-mm>/<random>-<name>
const COMMENT_FILE = /\.(jpe?g|png|gif|webp|heic|mp4|mov|m4v|webm|pdf|docx?|xlsx?|pptx?|txt|csv|zip|key|pages|numbers|psd|ai|fig|srt)$/i;
const commentKeyOk = (team, k) => typeof k === "string" && k.startsWith(`comments/${team}/`) && !k.includes("..") && k.length < 300;
export const uploadUrl = wrap(async (req, res) => {
  const b = await body(req);
  if (b.kind === "comment") {   // any teammate may attach to a comment
    if (!TEAM_RE.test(b.team || "")) return send(res, 400, { error: "Bad team" });
    const me = await whoIs(req, b.team);
    if (!me) return send(res, 401, { error: "Sign in first" });
    const name = String(b.name || ""), size = Number(b.size) || 0, video = /\.(mp4|mov|m4v|webm)$/i.test(name), photo = /\.(jpe?g|png|gif|webp|heic)$/i.test(name);
    if (!COMMENT_FILE.test(name)) return send(res, 400, { error: "Attach a photo, a video, or a PDF / Word / Excel / PowerPoint / text / ZIP file" });
    if (size > (video ? 300e6 : photo ? 20e6 : 50e6)) return send(res, 400, { error: video ? "Videos up to 300 MB" : photo ? "Photos up to 20 MB" : "Files up to 50 MB" });
    const stop = await blocked({ bytes: size || 20e6, a: 2 }).catch(() => null);
    if (stop) return send(res, 429, { error: "⏸ Stopped to stay on the free plan — " + stop.why, limit: stop });
    forget();
    const key = `comments/${b.team}/${now().slice(0, 7)}/${crypto.randomBytes(6).toString("hex")}-${name.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
    return send(res, 200, { data: { url: uploadLink(key, 3 * 3600), key } });
  }
  if (!TEAM_RE.test(b.team || "") || !CARD_RE.test(b.job || "")) return send(res, 400, { error: "Bad team or card" });
  const me = await whoIs(req, b.team);
  if (!me || !me.canRun) return send(res, 403, { error: "Your role can't start edits" });
  if (b.kind === "ref") {   // 📎 Files for Claude: screenshots, reference videos, docs — the edit chat can fetch them
    const name = String(b.name || "").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(-90), size = Number(b.size) || 0;
    if (!COMMENT_FILE.test(name)) return send(res, 400, { error: "Add a photo, a video, or a PDF / Word / Excel / PowerPoint / text / ZIP file" });
    const video = /\.(mp4|mov|m4v|webm)$/i.test(name), photo = /\.(jpe?g|png|gif|webp|heic)$/i.test(name);
    if (size > (video ? 300e6 : photo ? 20e6 : 50e6)) return send(res, 400, { error: video ? "Videos up to 300 MB" : photo ? "Photos up to 20 MB" : "Files up to 50 MB" });
    const stop = await blocked({ bytes: size || 20e6, a: 2 }).catch(() => null);
    if (stop) return send(res, 429, { error: "⏸ Stopped to stay on the free plan — " + stop.why, limit: stop });
    forget();
    const file = Date.now().toString(36) + "-" + name;
    return send(res, 200, { data: { url: uploadLink(keyFor(b.team, b.job, "refs/" + file), 3 * 3600), file } });
  }
  const stop = await blocked({ bytes: Number(b.size) || (b.kind ? 60e6 : 300e6), a: 3 }).catch(() => null);
  if (stop) return send(res, 429, { error: "⏸ Stopped to stay on the free plan — " + stop.why, limit: stop });
  forget();   // the next check counts this upload
  if (b.kind === "audio") {   // the WAV the browser pulled out of the raw video
    return send(res, 200, { data: { url: uploadLink(keyFor(b.team, b.job, AUDIO), 3 * 3600), file: AUDIO } });
  }
  if (b.kind === "clean") {   // the cleaned audio coming back from Adobe Podcast (any common audio type)
    const ce = (/\.(wav|mp3|m4a|aac|flac|ogg)$/i.exec(b.name || "") || [])[1];
    if (!ce) return send(res, 400, { error: "Send an audio file (.wav / .mp3 / .m4a)" });
    const file = "raw-clean." + ce.toLowerCase();
    return send(res, 200, { data: { url: uploadLink(keyFor(b.team, b.job, file), 3 * 3600), file } });
  }
  const ext = (/\.(mp4|mov|m4v|mkv)$/i.exec(b.name || "") || [])[1];
  if (!ext) return send(res, 400, { error: "Send a video file (.mp4 / .mov)" });
  await purgeBin(b.team, b.job);   // a new raw video: the deleted one in the bin goes for good now
  const file = "raw." + ext.toLowerCase();
  send(res, 200, { data: { url: uploadLink(keyFor(b.team, b.job, file), 3 * 3600), file } });
});

// ---------------------------------------------------------------- /api/pipeline/storage
// The raw clip and its audio, deleting them, cleaning up a deleted card, and how full storage is.
//   GET  ?team&job          links to play / download the card's raw video and audio
//   GET  ?team&stats=1      storage used (Cloudflare R2 + Supabase) — owners and admins
//   POST { team, job, op:"delete_raw", keep? }  delete the raw video + audio (keep: a raw file to leave, after a replace)
//   POST { team, job, op:"purge" }              a deleted card: every file it has, and its Claude jobs
const AUDIO = "raw-audio.wav";
const CLEAN_FILES = ["wav", "mp3", "m4a", "aac", "flac", "ogg"].map(e => "raw-clean." + e);
const RAW_FILES = ["raw.mp4", "raw.mov", "raw.m4v", "raw.mkv", AUDIO, ...CLEAN_FILES];
// which of the card's raw files are in storage: one listing of its folder (more reliable than asking file by file)
async function rawFilesOf(team, card) {
  const pre = keyFor(team, card, ""), have = new Set((await listFiles(pre)).map(f => f.key.slice(pre.length)));
  return RAW_FILES.filter(f => have.has(f));
}
// 🗑 the bin: a deleted raw video (and its audio) stays in storage for an hour, so it can be restored;
// the 5-minute tick removes it for good after that. Kept as a small record "<card>__bin" in the jobs table.
const BIN_MS = 60 * 60000;
const binId = card => card + "__bin";
async function purgeBin(team, card) {   // remove the bin's files now (an hour passed, or a new raw video replaces it)
  const rec = await store.get(team, binId(card)); if (!rec) return 0;
  for (const f of rec.files || []) await removeFile(keyFor(team, card, f)).catch(() => {});
  if (store.remove) await store.remove(team, binId(card)).catch(() => {});
  return (rec.files || []).length;
}
// 💬 the card chat with Claude: a small record "<card>__chat" next to the job. You write from the card; the edit session
// reads it (callback "inbox", every ~15 s while it waits for you) and answers into it (callback "say"). When that session
// has gone to sleep, a message from the card starts a fresh one that gets the whole conversation (payload.history).
const chatId = card => card + "__chat";
const MSG_FILE = /^[\w.\- ]{1,120}$/;
async function chatPush(team, card, msgs, extra) {
  const at = now();
  return store.update(team, chatId(card), rec => {
    rec = rec || { team, card_id: chatId(card), status: "chat", msgs: [] };
    rec.msgs = (rec.msgs || []).concat(msgs.map(m => ({ id: crypto.randomBytes(5).toString("hex"), at, ...m }))).slice(-300);
    return Object.assign(rec, extra || {});
  });
}
// is a Claude session there to read the next message? (listening in the last 3 min, or busy and reporting)
function chatAlive(job, c) {
  if (!job || !job.run || !job.run.chat || !job.run.id || ["cancelled", "failed"].includes(job.status)) return false;
  if (c && c.asleep && c.asleep_run === job.run.id) return false;
  if (c && c.listening_at && c.listen_run === job.run.id && Date.now() - new Date(c.listening_at) < 3 * 60000) return true;
  return RUNNING.includes(job.status) && Date.now() - new Date(job.updated_at || 0) < 30 * 60000;
}
// 🧠 skill notes: rules the owner told Claude to remember for EVERY video ("remember this"), kept per team in "_skill".
// Only these carry over between videos — a card's brief and boxes are for that video alone.
const SKILL_ID = "_skill";
const SHOWING = ["proposal_ready", "brief_ready", "final_review"];   // checkpoints the card shows in full
const VNAMES = t => (t || []).map(x => x === "yt" ? "YouTube" : "Instagram").join(" + ");

async function cleanFile(team, card) { return (await rawFilesOf(team, card)).find(f => CLEAN_FILES.includes(f)) || null; }
const LIMITS = { r2: 10e9, db: 500e6, files: 1e9 };   // Cloudflare R2 free tier · Supabase free database · Supabase free file storage
async function supabaseStats() {
  if (STORE !== "supabase") return null;
  const r = await fetch(`${SUPABASE.url}/rest/v1/rpc/pipeline_storage_stats`, { method: "POST",
    headers: { apikey: SUPABASE.service, authorization: `Bearer ${SUPABASE.service}`, "content-type": "application/json" }, body: "{}" });
  return r.ok ? r.json() : { error: `Supabase answered ${r.status}` };
}
// ElevenLabs credits left this month (the 🎤 mic and Claude's voice/sound work use the same account)
async function elevenStats() {
  const key = elevenKey();
  if (!key) return { error: "ELEVENLABS_API_KEY isn't set on the server" };
  const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: r.status === 401 && /permission/i.test(JSON.stringify(j))
    ? "The ElevenLabs key can't read the plan — give it the \"User: Read\" permission in ElevenLabs → API keys"
    : `ElevenLabs answered ${r.status}` };
  return { used: j.character_count || 0, limit: j.character_limit || 0, tier: j.tier || "", resets: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toISOString() : null };
}
export const storage = wrap(async (req, res) => {
  const isGet = (req.method || "GET") === "GET";
  const b = isGet ? Object.fromEntries(query(req)) : await body(req);
  if (!TEAM_RE.test(b.team || "")) return send(res, 400, { error: "Bad team" });
  const me = await whoIs(req, b.team);
  if (!me) return send(res, 401, { error: "Sign in first" });

  if (isGet && b.stats) {
    if (!me.canApprove) return send(res, 403, { error: "Only an owner or admin can see storage" });
    const [files, db, eleven] = await Promise.all([listFiles(""), supabaseStats().catch(e => ({ error: e.message })), elevenStats().catch(e => ({ error: "Couldn't reach ElevenLabs: " + e.message }))]);
    const kind = k => /\/raw\.(mp4|mov|m4v|mkv)$/.test(k) ? "raw" : k.endsWith("/" + AUDIO) ? "audio" : /\/raw-clean\.\w+$/.test(k) ? "clean" : /\/final_(yt|ig)\.mp4$/.test(k) ? "final"
      : k.includes("/preview/") ? "preview" : /\/edit\.tar\.gz$/.test(k) ? "edit" : k.startsWith("library/") ? "library" : k.startsWith("comments/") ? "comments" : "other";
    const byKind = {}, byCard = {};
    files.forEach(f => {
      const kd = kind(f.key); byKind[kd] = (byKind[kd] || 0) + f.size;
      const m = /^jobs\/([^/]+)\/([^/]+)\//.exec(f.key);
      if (m) { const c = byCard[`${m[1]}/${m[2]}`] = byCard[`${m[1]}/${m[2]}`] || { team: m[1], card: m[2], bytes: 0, files: 0, at: "" };
        c.bytes += f.size; c.files++; if (f.at > c.at) c.at = f.at; }
    });
    forget(); const u = await usage(true).catch(e => ({ opsError: e.message })), stop = await blocked({}).catch(() => null);
    return send(res, 200, { data: { files: FILES, limits: LIMITS, free: FREE, stopAt: STOP, stop,
      ops: { checked: !!u.opsChecked, error: u.opsError || null, classA: u.classA, classB: u.classB, period: u.period },
      r2: { bytes: files.reduce((a, f) => a + f.size, 0), count: files.length, byKind },
      cards: Object.values(byCard).sort((a, b) => b.bytes - a.bytes).slice(0, 50), supabase: db, eleven, at: now() } });
  }

  // 💬 links to see a comment's photos / videos (GET ?team&files=k1,k2)
  if (isGet && b.files) {
    const keys = String(b.files).split(",").filter(k => commentKeyOk(b.team, k)).slice(0, 60);
    return send(res, 200, { data: Object.fromEntries(keys.map(k => [k, downloadLink(k, 6 * 3600)])) });
  }
  // 💬 a comment was deleted: remove its files — only those no remaining comment still uses
  if (!isGet && b.op === "comment_files_gone") {
    const keys = (Array.isArray(b.keys) ? b.keys : []).filter(k => commentKeyOk(b.team, k)).slice(0, 60);
    const gone = [];
    for (const k of keys) {
      if (STORE === "supabase") {
        const r = await fetch(`${SUPABASE.url}/rest/v1/team_comments?team_slug=eq.${encodeURIComponent(b.team)}&files=cs.${encodeURIComponent(JSON.stringify([{ key: k }]))}&select=id&limit=1`,
          { headers: { apikey: SUPABASE.service, authorization: `Bearer ${SUPABASE.service}` } });
        if (!r.ok || (await r.json()).length) continue;   // still used (or can't tell): keep it
      }
      await removeFile(k); gone.push(k);
    }
    return send(res, 200, { data: { deleted: gone } });
  }
  if (!CARD_RE.test(b.job || "")) return send(res, 400, { error: "Bad card" });
  if (isGet && b.refs) {   // 📎 Files for Claude on this card
    const refs = (await listFiles(keyFor(b.team, b.job, "refs/"))).map(f => ({ file: f.key.split("/").pop(), size: f.size, at: f.at, url: downloadLink(f.key, 6 * 3600) }));
    return send(res, 200, { data: refs });
  }
  if (!isGet && b.op === "delete_ref") {
    if (!me.canRun) return send(res, 403, { error: "Your role can't change this card's files" });
    const f = String(b.file || ""); if (!/^[\w.\- ]+$/.test(f)) return send(res, 400, { error: "Bad file" });
    await removeFile(keyFor(b.team, b.job, "refs/" + f));
    return send(res, 200, { data: { deleted: f } });
  }
  if (isGet) {   // play / download links for the raw video and its audio
    const out = {};
    for (const f of await rawFilesOf(b.team, b.job))
      out[f === AUDIO ? "audio" : CLEAN_FILES.includes(f) ? "clean" : "video"] = downloadLink(keyFor(b.team, b.job, f), 6 * 3600);
    return send(res, 200, { data: out });
  }
  if (!me.canRun) return send(res, 403, { error: "Your role can't change this card's files" });
  const job = await store.get(b.team, b.job);
  if (job && RUNNING.includes(job.status)) return send(res, 409, { error: "Claude is working on this video right now — cancel the job first" });

  if (b.op === "delete_raw" || b.op === "delete_clean") {
    const keep = String(b.keep || ""), pick = b.op === "delete_clean" ? CLEAN_FILES : RAW_FILES;
    const gone = (await rawFilesOf(b.team, b.job)).filter(f => pick.includes(f) && f !== keep);
    for (const f of gone) await removeFile(keyFor(b.team, b.job, f));
    // proof: list the folder again — a file that's still there is reported, never hidden
    const left = await rawFilesOf(b.team, b.job), still = gone.filter(f => left.includes(f));
    return send(res, 200, { data: { deleted: gone.filter(f => !still.includes(f)), still_there: still } });
  }
  if (b.op === "bin_raw") {   // Delete on the card: into the bin for an hour (nothing leaves storage yet)
    // pressing Delete again (a retry, a second tab) must never remove files: the bin keeps them, it never empties here
    const files = (await rawFilesOf(b.team, b.job)).filter(f => RAW_FILES.includes(f));
    const old = await store.get(b.team, binId(b.job));
    if (old && new Date(old.due) > Date.now()) {
      const all = [...new Set([...(old.files || []), ...files])];
      if (all.length !== (old.files || []).length) await store.save(Object.assign({}, old, { files: all }), "bin");
      return send(res, 200, { data: { files: all, due: old.due } });
    }
    if (old) await purgeBin(b.team, b.job);   // a bin whose hour is up (the clean-up hadn't run yet)
    if (!files.length) return send(res, 200, { data: { files: [], due: null } });
    const due = new Date(Date.now() + BIN_MS).toISOString();
    await store.save({ team: b.team, card_id: binId(b.job), status: "bin", files, due, by: me.name, at: now() }, null);
    return send(res, 200, { data: { files, due } });
  }
  if (b.op === "restore_raw") {
    const rec = await store.get(b.team, binId(b.job));
    if (!rec || new Date(rec.due) <= Date.now()) return send(res, 410, { error: "Too late — the hour is up and the video was deleted from storage" });
    const left = await rawFilesOf(b.team, b.job), back = (rec.files || []).filter(f => left.includes(f));
    if (store.remove) await store.remove(b.team, binId(b.job));
    if (!back.some(f => /^raw\.(mp4|mov|m4v|mkv)$/.test(f))) return send(res, 410, { error: "Too late — the video isn't in storage any more. Upload it again." });
    return send(res, 200, { data: { files: back } });
  }
  if (b.op === "purge") {
    if (!me.canApprove) return send(res, 403, { error: "Only an owner or admin can delete a card's files" });
    const files = await listFiles(`jobs/${b.team}/${b.job}/`);
    for (const f of files) await removeFile(f.key);
    const left = await listFiles(`jobs/${b.team}/${b.job}/`);
    if (store.remove) for (const id of [b.job, b.job + "__r", b.job + "__s", binId(b.job), chatId(b.job)]) await store.remove(b.team, id).catch(() => {});
    return send(res, 200, { data: { deleted: files.length - left.length, bytes: files.reduce((a, f) => a + f.size, 0), still_there: left.length } });
  }
  send(res, 400, { error: "Unknown storage action" });
});

// ---------------------------------------------------------------- POST /api/pipeline/import
// Copy the raw video from a pasted link (Google Drive / OneDrive file or folder, Dropbox, a direct link) into storage.
//   { team, job, op:"list", link }    → { files: [{ name, size, pick }] }   (a folder can hold several videos)
//   { team, job, op:"start", pick }   → { state, done:0, size }
//   { team, job, op:"step", state }   → copies pieces for ~40 s → { state, done, size } … until { file, name, size }
//   { team, job, op:"cancel", state }
// "pick" and "state" are signed by the server, so the browser can carry them between calls but can't change them.
const seal = o => { const t = Buffer.from(JSON.stringify(o)).toString("base64url");
  return t + "." + crypto.createHmac("sha256", SECRET).update("import:" + t).digest("base64url").slice(0, 32); };
const unseal = (s, team, job) => { const [t, sig] = String(s || "").split(".");
  if (!t || sig !== crypto.createHmac("sha256", SECRET).update("import:" + t).digest("base64url").slice(0, 32)) throw new Error("That copy expired — paste the link again");
  const o = JSON.parse(Buffer.from(t, "base64url").toString()); if (o.team !== team || o.job !== job) throw new Error("Wrong card"); return o; };
export const importLink = wrap(async (req, res) => {
  const b = await body(req);
  if (!TEAM_RE.test(b.team || "") || !CARD_RE.test(b.job || "")) return send(res, 400, { error: "Bad team or card" });
  const me = await whoIs(req, b.team);
  if (!me || !me.canRun) return send(res, 403, { error: "Your role can't add raw videos" });
  const fail = e => send(res, 400, { error: e.message || String(e) });
  try {
    if (b.op === "list") {
      const files = await resolveLink(String(b.link || "").trim());
      return send(res, 200, { data: { files: files.map(f => ({ name: f.name, size: f.size, pick: seal({ team: b.team, job: b.job, f, at: Date.now() }) })) } });
    }
    if (b.op === "start") {
      const { f } = unseal(b.pick, b.team, b.job);
      const job = await store.get(b.team, b.job);
      if (job && RUNNING.includes(job.status)) return send(res, 409, { error: "Claude is working on this video right now — cancel the job first" });
      const stop = await blocked({ bytes: f.size, a: Math.ceil(f.size / PART) + 3 }).catch(() => null);
      if (stop) return send(res, 429, { error: "⏸ Stopped to stay on the free plan — " + stop.why, limit: stop });
      forget();
      // straight to the card's raw file: a multipart upload only appears once it's finished, so the old video stays until then
      const file = "raw." + extOf(f), key = keyFor(b.team, b.job, file);
      await purgeBin(b.team, b.job);   // a new raw video: the deleted one in the bin goes for good now
      const upload = await sink.start(key);
      return send(res, 200, { data: { state: seal({ team: b.team, job: b.job, f, file, key, upload, etags: [] }), done: 0, size: f.size } });
    }
    const st = unseal(b.state, b.team, b.job);
    if (b.op === "cancel") { await sink.abort(st.key, st.upload); return send(res, 200, { data: { cancelled: true } }); }
    if (b.op !== "step") return send(res, 400, { error: "Unknown import action" });
    const t0 = Date.now(); let src = null, slowest = 0;
    while (st.etags.length * PART < st.f.size) {
      const from = st.etags.length * PART, to = Math.min(st.f.size, from + PART) - 1, t1 = Date.now();
      const p = await piece(st.f.ref, from, to, src); src = p.src;
      st.etags.push(await sink.part(st.key, st.upload, st.etags.length + 1, p.buf));
      slowest = Math.max(slowest, Date.now() - t1);
      if (Date.now() - t0 + slowest * 1.3 > 40000) break;   // stop before the function's time limit; the browser calls again
    }
    const done = Math.min(st.f.size, st.etags.length * PART);
    if (done < st.f.size) return send(res, 200, { data: { state: seal(st), done, size: st.f.size } });
    await sink.finish(st.key, st.upload, st.etags);
    forget();
    send(res, 200, { data: { file: st.file, name: st.f.name, size: st.f.size, done, sizeTotal: st.f.size } });
  } catch (e) { fail(e); }
});

// ---------------------------------------------------------------- POST /api/pipeline/action
// { team, job, action, card_info?, notes?, raw_file?, targets?, yt?, ig? }
export const action = wrap(async (req, res) => {
  const b = await body(req);
  if (!TEAM_RE.test(b.team || "") || !CARD_RE.test(b.job || "")) return send(res, 400, { error: "Bad team or card" });
  if (b.action === "say") return say(req, res, b);
  if (b.action === "forget_note") {   // remove a skill note (the 🧠 list on the card)
    if (!TEAM_RE.test(b.team || "")) return send(res, 400, { error: "Bad team" });
    const me = await whoIs(req, b.team);
    if (!me || !me.canApprove) return send(res, 403, { error: "Only an owner or admin can change the skill notes" });
    const rec = await store.update(b.team, SKILL_ID, r => r ? Object.assign(r, { notes: (r.notes || []).filter(n => n.id !== b.id) }) : null);
    return send(res, 200, { data: { notes: rec ? rec.notes : [] } });
  }
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
  if (b.action === "edit_again" || b.action === "approve_edit") {
    const t = (Array.isArray(b.targets) ? b.targets : []).filter(x => x === "yt" || x === "ig");
    job.targets = t.length ? [...new Set(t)] : cardTargets(job);
  } else if (b.action === "start") job.targets = null;   // a new edit follows the card's "Post on"
  const by = me.name;
  if ((b.action === "approve_edit" || b.action === "edit_again") && job.run && job.run.chat) {   // Claude is still in the chat: tell it there
    const c = await store.get(b.team, chatId(b.job));
    if (chatAlive(job, c)) {
      const render = b.action === "approve_edit";
      await chatPush(b.team, b.job, [{ from: "you", by, cmd: render ? "render" : "edit_again", targets: job.targets,
        text: (render ? "Render " : "Edit again — ") + VNAMES(job.targets) + (job.notes ? (render ? "\n" : ": ") + job.notes : "") }]);
      job.updated_at = now();
      return send(res, 200, { data: await store.save(job, expected), sent: "chat" });
    }
  }
  if (b.action === "start") {   // a new edit: a new conversation (your start notes are its first message)
    await store.update(b.team, chatId(b.job), () => ({ team: b.team, card_id: chatId(b.job), status: "chat", msgs: [] }));
    // the edit brief opens the conversation (with the files added for Claude), so the chat shows what Claude started from
    const brief = String((job.card && job.card.edit_brief) || "").trim();
    const refs = (await listFiles(keyFor(b.team, b.job, "refs/")).catch(() => [])).map(f => f.key.split("/").pop()).filter(f => MSG_FILE.test(f)).slice(0, 12);
    if (brief || refs.length) await chatPush(b.team, b.job, [{ from: "you", by, text: brief ? "📝 Edit brief: " + brief.slice(0, 3900) : "📎 Files for the edit", files: refs, seen: true }]);
    if (job.notes) await chatPush(b.team, b.job, [{ from: "you", by, text: job.notes, seen: true }]);
  }

  if (b.action === "cancel") {
    job.status = "cancelled"; job.progress = ""; if (job.run) job.run.id = null;   // its late reports get ignored
    log(job, "Cancelled by " + by);
    return send(res, 200, { data: await store.save(job, expected) });
  }
  if (b.action === "studio") {   // nothing moves: the Mac script gets the edit folder, a link to send it back, and a "done" link
    if (!job.files || !job.files.edit) return send(res, 409, { error: "This brief has no edit folder to open" });
    const run = "studio-" + (Math.floor(Date.now() / 1000) + 12 * 3600);
    return send(res, 200, { data: { get: downloadLink(keyOf(job, "edit"), 12 * 3600), put: uploadLink(keyOf(job, "edit"), 12 * 3600),
      done: callbackUrl(job, run) } });
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
  const step = b.action === "retry" ? ((job.paused && job.paused.step) || job.last_step || "plan") : a.step;
  if (b.action === "retry" && step === "post") {   // never re-post on Retry: back to the final check, Post needs a fresh click
    job.status = "final_review"; job.error = null; log(job, "Back to the final check — look at the channel before posting again");
    return send(res, 200, { data: await store.save(job, expected) });
  }
  send(res, 200, { data: await fire(job, step, expected, by) });
});

// 💬 a message from the card to Claude: { team, job, action:"say", text, files:[names in refs/] }
//   a session is listening → it reads it within seconds; asleep → a fresh session starts with the whole chat
async function say(req, res, b) {
  const me = await whoIs(req, b.team);
  if (!me) return send(res, 401, { error: "Sign in first" });
  if (!me.canRun) return send(res, 403, { error: "Your role can't run edits" });
  const text = String(b.text || "").trim().slice(0, 4000), files = (Array.isArray(b.files) ? b.files : []).filter(f => MSG_FILE.test(f) && !f.includes("..")).slice(0, 12);
  if (!text && !files.length) return send(res, 400, { error: "Write something or add a file first" });
  const job = await store.get(b.team, b.job);
  if (!job || !job.run) return send(res, 409, { error: "Start the edit first — then you can talk to Claude here" });
  const c = await store.get(b.team, chatId(b.job));
  if (["posting", "posted", "scheduled"].includes(job.status)) return send(res, 409, { error: "This video is posted or scheduled — the edit is closed" });
  if (!chatAlive(job, c) && RUNNING.includes(job.status)) return send(res, 409, { error: "Claude is in the middle of a step — send this when it finishes" });
  const by = me.name;
  await chatPush(b.team, b.job, [{ from: "you", by, text, files }]);
  if (chatAlive(job, c)) return send(res, 200, { data: job, sent: "live" });
  // nobody listening: wake Claude up — a new session, the same conversation
  if (b.card_info && typeof b.card_info === "object") job.card = b.card_info;
  job.notes = text; job.targets = job.targets && job.targets.length ? job.targets : null;
  send(res, 200, { data: await fire(job, "reedit", job.status, by), sent: "woke" });
}

// ---------------------------------------------------------------- POST /api/pipeline/callback?team&job&run&sig
// from the run: { event: "progress"|"done"|"failed", message, result, uploaded: [names] }
export const callback = wrap(async (req, res) => {
  const p = query(req), team = p.get("team"), card = p.get("job"), run = p.get("run");
  if (!TEAM_RE.test(team || "") || !CARD_RE.test(card || "") || !run || p.get("sig") !== sign(team, card, run)) return send(res, 403, { error: "Bad signature" });
  const b = await body(req);
  const job = await store.get(team, card);
  const st = /^studio-(\d+)$/.exec(run);
  if (st) {   // the Studio script sent the edited folder back: the next render uses it as it is
    if (Number(st[1]) < Date.now() / 1000) return send(res, 403, { error: "This Studio link has expired — press Open in Studio again" });
    if (!job || job.status !== "brief_ready") return send(res, 409, { error: "The card isn't waiting on the brief any more" });
    job.files.edit = { at: now() }; job.studio = { at: now() };
    log(job, "Studio edits received — Approve renders them as they are");
    await store.save(job, "brief_ready");
    return send(res, 200, { data: { ok: true } });
  }
  // a chat run stays valid between stages (it waits for you in claude.ai); a one-step run only while it's working
  const live = job && job.run && job.run.id === run && (job.run.chat ? job.status !== "cancelled" : RUNNING.includes(job.status));
  if (!live) return send(res, 200, { data: { ignored: true, why: !job || !job.run || job.run.id !== run
    ? "This chat isn't the card's current edit any more (it was cancelled, or a newer edit / render started from the card)."
    : "The edit was cancelled on the card." } });
  const expected = job.status, step = job.run.step;

  if (b.event === "links") {   // upload links for the live-player files (the run doesn't know the file list in advance)
    const names = (Array.isArray(b.names) ? b.names : []).filter(okPreviewPath).slice(0, 800), links = {};
    names.forEach(n => { links[n] = uploadLink(keyFor(team, card, "preview/" + n), 6 * 3600); });
    return send(res, 200, { data: { links } });
  }
  // ---- chat runs: links on demand, and each stage as it happens
  if (b.event === "uploads") {   // fresh upload links for results (a chat can go on for hours)
    const ok = ["proposal", "brief_sheet", "brief_md", "plan_result", "edit", "yt", "ig", "render_result"];
    const links = {}; (Array.isArray(b.names) ? b.names : []).filter(n => ok.includes(n)).forEach(n => { links[n] = uploadLink(keyOf(job, n), 6 * 3600); });
    return send(res, 200, { data: { links } });
  }
  if (b.event === "downloads") {   // the raw clip, the last edit folder, and the files the team added for Claude
    const links = {};
    for (const n of ["raw", "edit", "proposal", "plan_result", "yt", "ig"]) if (n === "raw" ? job.raw_file : job.files && job.files[n]) links[n] = downloadLink(keyOf(job, n), 6 * 3600);
    const refs = (await listFiles(keyFor(team, card, "refs/"))).map(f => ({ name: f.key.split("/").pop(), size: f.size, url: downloadLink(f.key, 6 * 3600) }));
    return send(res, 200, { data: { links, refs, targets: job.targets && job.targets.length ? job.targets : cardTargets(job) } });
  }
  if (b.event === "inbox" && job.run.chat) {   // the session checks for your messages from the card (and says it's listening)
    const listen = b.listening !== false; let got = [];
    await store.update(team, chatId(card), rec => {
      rec = rec || { team, card_id: chatId(card), status: "chat", msgs: [] };
      got = []; rec.msgs = (rec.msgs || []).map(m => { if (m.from === "you" && !m.seen) { got.push(m); return { ...m, seen: true }; } return m; });
      if (listen) { rec.listening_at = now(); rec.listen_run = run; }
      rec.asleep = false; return rec;
    });
    const msgs = got.map(m => ({ by: m.by, at: m.at, text: m.text, cmd: m.cmd, targets: m.targets,
      files: (m.files || []).map(f => ({ name: f, url: downloadLink(keyFor(team, card, "refs/" + f), 6 * 3600) })) }));
    return send(res, 200, { data: { msgs } });
  }
  if (b.event === "say" && job.run.chat) {   // Claude answers on the card (or copies what you typed in claude.ai: from "you")
    const text = String(b.message || "").trim().slice(0, 6000);
    if (text) await chatPush(team, card, [{ from: b.from === "you" ? "you" : "claude", by: b.from === "you" ? "in claude.ai" : "Claude", text, seen: true }]);
    return send(res, 200, { data: { ok: true } });
  }
  if (b.event === "remember" && job.run.chat) {   // the owner said "remember this" → a rule for every future video
    const text = String(b.message || "").trim().slice(0, 1500);
    if (!text) return send(res, 400, { error: "Nothing to remember" });
    await store.update(team, SKILL_ID, rec => {
      rec = rec || { team, card_id: SKILL_ID, status: "skill", notes: [] };
      rec.notes = (rec.notes || []).concat({ id: crypto.randomBytes(4).toString("hex"), text, at: now(), card }).slice(-100);
      return rec;
    });
    await chatPush(team, card, [{ from: "claude", by: "Claude", stage: "skill", seen: true, text: "🧠 Saved to the skill (every video from now on): " + text }]);
    return send(res, 200, { data: { ok: true } });
  }
  if (b.event === "sleep" && job.run.chat) {   // the session stopped listening; the next card message starts a fresh one
    await store.update(team, chatId(card), rec => Object.assign(rec || { team, card_id: chatId(card), status: "chat", msgs: [] }, { asleep: true, asleep_run: run, listening_at: null }));
    if (!RUNNING.includes(job.status)) { job.progress = "Claude is resting — write here and it picks the chat up again"; job.updated_at = now(); await store.save(job, expected); }
    return send(res, 200, { data: { ok: true } });
  }
  if (b.event === "busy" && job.run.chat) {   // Claude started working on something you asked for in the chat
    const map = { proposing: "proposing", building: "planning", rendering: "rendering" };
    job.status = map[b.what] || "planning"; job.error = null; job.progress = String(b.message || "").slice(0, 300); job.updated_at = now();
    log(job, ({ proposing: "Working on the plan", building: "Building the edit", rendering: "Rendering" })[b.what] || "Working");
    await store.save(job, expected); return send(res, 200, { data: { ok: true } });
  }
  if (b.event === "waiting" && job.run.chat) {   // Claude is asking you something in the chat
    if (!SHOWING.includes(job.status)) job.status = "chat_open";   // a plan / built edit / videos on the card stay on show
    job.progress = String(b.message || "").slice(0, 300); job.updated_at = now();
    await store.save(job, expected); return send(res, 200, { data: { ok: true } });
  }
  if (b.event === "stage" && job.run.chat) {
    (Array.isArray(b.uploaded) ? b.uploaded : []).filter(n => FILE[n] || n === "preview").forEach(n => { job.files[n] = { at: now() }; });
    const r = b.result && typeof b.result === "object" ? b.result : {};
    job.error = null; job.progress = ""; job.updated_at = now();
    if (b.stage === "proposal") { job.proposal = { ...r, at: now() }; job.status = "proposal_ready"; log(job, "Plan ready — say OK or what to change in the edit chat"); }
    else if (b.stage === "built") { job.brief = { ...r, at: now() }; job.variants = (r.variants || []).filter(x => x === "yt" || x === "ig"); job.status = "brief_ready"; log(job, "Edit built — watch it on the card; say “render” in the chat when it's right"); }
    else if (b.stage === "rendered") { job.outputs = { qc: r.qc || "" }; job.rendered = { at: now(), variants: (r.variants || []).filter(x => x === "yt" || x === "ig") }; job.status = "final_review"; log(job, "Rendered — " + (job.rendered.variants.map(x => x === "yt" ? "YouTube" : "Instagram").join(" + ") || "videos") + " ready"); }
    else return send(res, 400, { error: "Unknown stage" });
    await store.save(job, expected);
    await chatPush(team, card, [{ from: "claude", by: "Claude", stage: b.stage, seen: true, text: b.stage === "proposal" ? "📋 Here's my plan (above). Say OK, or tell me what to change."
      : b.stage === "built" ? "▶ The edit is built — watch it above. Tell me what to change, or press Render." : "🎬 Rendered: " + (VNAMES(job.rendered.variants) || "the videos") + ". They're on the card." }]).catch(() => {});
    return send(res, 200, { data: { ok: true, status: job.status } });
  }
  if (b.event === "failed" && job.run.chat) {   // something broke, but Claude is still in the chat with you
    if (!SHOWING.includes(job.status)) job.status = "chat_open";
    job.error = String(b.message || "Something went wrong").slice(0, 600); job.progress = ""; log(job, job.error);
    await store.save(job, expected); return send(res, 200, { data: { ok: true } });
  }
  if (b.event === "progress") {
    job.progress = String(b.message || "").slice(0, 300); job.updated_at = now();
    await store.save(job, expected); return send(res, 200, { data: { ok: true } });
  }
  (Array.isArray(b.uploaded) ? b.uploaded : []).filter(n => FILE[n]).forEach(n => { job.files[n] = { at: now() }; });
  const fail = msg => { job.status = step === "post" ? "post_failed" : "failed"; job.error = String(msg || "The run stopped").slice(0, 600); job.progress = ""; log(job, job.error); };
  const r = b.result && typeof b.result === "object" ? b.result : {};

  if (b.event !== "done") fail(b.message);
  else if (step === "propose") {
    if (!job.files.proposal) fail("The run finished but no plan was uploaded. " + (b.message || ""));
    else { job.proposal = { ...r, at: now() }; job.status = "proposal_ready"; job.notes = null; job.progress = ""; log(job, "Plan ready — your check"); }
  }
  else if (step === "plan") {
    if (!job.files.brief_sheet || !job.files.plan_result) fail("The run finished but no brief was uploaded. " + (b.message || ""));
    else { job.brief = { ...r, at: now() }; job.status = "brief_ready"; job.notes = null; job.progress = ""; log(job, "Brief ready for your review"); }
  } else if (step === "render") {
    if (!job.files.yt && !job.files.ig) fail("The run finished but no video was uploaded. " + (b.message || ""));
    else { job.outputs = { qc: r.qc || "" }; job.status = "final_review"; job.notes = null; job.progress = "";   // posting is off for now:
      log(job, "Rendered — both videos ready"); }                                                               // the videos are the end
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

// ---------------------------------------------------------------- GET /pv/<token>/<hf_yt|hf_ig>/<path>
// ▶ the live player. The run uploads hf_yt/ and hf_ig/ file by file under preview/; a signed token in the
// path keeps relative asset links working. index.html is served with the player script added; every other
// file is a redirect to a short-lived storage link.
const PV_RE = /^(hf_yt|hf_ig|hf)\/(?!.*\.\.)[A-Za-z0-9 ._\-\/()+]{1,200}$/;
function okPreviewPath(p) { return typeof p === "string" && PV_RE.test(p); }
function previewToken(team, card, exp) {
  return `${team}~${card}~${exp}~` + crypto.createHmac("sha256", SECRET).update(`pv/${team}/${card}/${exp}`).digest("hex").slice(0, 32);
}
export const preview = wrap(async (req, res) => {
  const q = query(req), [team, card, exp, sig] = String(q.get("token") || "").split("~"), p = String(q.get("path") || "");
  const bad = (code, msg) => { res.statusCode = code; res.setHeader("content-type", "text/plain"); res.end(msg); };
  if (!TEAM_RE.test(team || "") || !CARD_RE.test(card || "") || !okPreviewPath(p)) return bad(400, "Bad link");
  if (Number(exp) < Date.now() / 1000 || previewToken(team, card, exp).split("~")[3] !== sig) return bad(403, "This preview link has expired — reopen the card");
  const key = keyFor(team, card, "preview/" + p);
  if (!/\/index\.html$/.test(p)) { res.statusCode = 302; res.setHeader("location", downloadLink(key, 3 * 3600)); res.setHeader("cache-control", "private, max-age=600"); return res.end(); }
  const r = await fetch(downloadLink(key, 600));
  if (!r.ok) return bad(404, "No preview for this edit yet");
  const html = (await r.text()).replace(/<\/body>/i, '<script src="/studio/player.js"></script></body>');
  res.statusCode = 200; res.setHeader("content-type", "text/html; charset=utf-8"); res.setHeader("cache-control", "no-store");
  res.end(html);
});

// ---------------------------------------------------------------- scheduled posts
// Starts the post step for every scheduled job whose time has come. Called every minute by the local server,
// and on the live site by Supabase pg_cron through POST /api/pipeline/tick with the pipeline key.
export async function runDue() {
  const due = (await store.scheduled()).filter(j => j.status === "scheduled" && j.post_at && new Date(j.post_at) <= Date.now());
  for (const j of due) { try { await fire(j, "post", "scheduled", "the schedule"); } catch (e) { if (!(e instanceof Conflict)) console.error("[tick]", e.message); } }
  // jobs paused at a free limit: start them again once there's room (fire() pauses them again if there still isn't)
  let resumed = 0;
  for (const j of (store.byStatus ? await store.byStatus("paused") : [])) {
    if (await blocked(NEED[j.paused && j.paused.step] || {}).catch(() => true)) continue;
    try { await fire(j, (j.paused && j.paused.step) || "plan", "paused", "the free-limit check"); resumed++; }
    catch (e) { if (!(e instanceof Conflict)) console.error("[tick]", e.message); }
  }
  // 🗑 bins whose hour is up: the files leave storage now
  let binned = 0;
  for (const r of (store.byStatus ? await store.byStatus("bin") : [])) {
    if (new Date(r.due) > Date.now()) continue;
    try { binned += await purgeBin(r.team, r.card_id.replace(/__bin$/, "")); forget(); } catch (e) { console.error("[tick] bin", e.message); }
  }
  return due.length + resumed + binned;
}
export const tick = wrap(async (req, res) => {
  const key = String(req.headers["x-pipeline-key"] || "");
  if (!key || key !== crypto.createHmac("sha256", SECRET).update("tick").digest("hex")) return send(res, 403, { error: "Bad key" });
  send(res, 200, { data: { started: await runDue() } });
});
