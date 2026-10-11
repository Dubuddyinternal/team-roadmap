// =====================================================================
// 🎤 DICTATION: speech → text with ElevenLabs Scribe, for every text box.
//
//   live (default)  GET /api/transcribe-token → a single-use 15-minute token;
//                   the browser streams the mic straight to Scribe Realtime
//                   (wss://api.elevenlabs.io/v1/speech-to-text/realtime) and
//                   shows the words as they come. Billed by audio length.
//   fallback        POST /api/transcribe with the whole clip (Scribe batch),
//                   used only if the live connection can't be opened.
//
// The ElevenLabs key stays on the server:
//   Vercel:  ELEVENLABS_API_KEY in the project's environment variables
//   Mac:     the same variable, or read from ~/Developer/video-use/.env
// Hinglish mode asks Scribe for Hindi; hinglish.js in the browser turns any
// Devanagari into Roman Hinglish. English mode asks for English.
// =====================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { whoIs } from "./pipeline/auth.js";
import { LOCAL } from "./pipeline/config.js";

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  if (!LOCAL) return null;
  try {
    const env = fs.readFileSync(path.join(os.homedir(), "Developer/video-use/.env"), "utf8");
    const m = /^ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m.exec(env);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

const MAX = 8 * 1024 * 1024;   // a few minutes of compressed speech; Vercel allows ~4.5 MB per request anyway
function readRaw(req) {
  return new Promise((ok, bad) => {
    if (Buffer.isBuffer(req.body)) return ok(req.body);
    const parts = []; let n = 0;
    req.on("data", c => { n += c.length; if (n > MAX) { bad(new Error("That recording is too long — keep it under a few minutes")); req.destroy(); } else parts.push(c); });
    req.on("end", () => ok(Buffer.concat(parts)));
    req.on("error", bad);
  });
}
function send(res, code, obj) { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); }

// POST /api/transcribe?team=<slug>&lang=hi|en   body: the audio (audio/webm, audio/mp4, …)
export async function transcribe(req, res) {
  try {
    const q = new URL(req.url, "http://x").searchParams, team = q.get("team") || "";
    if (!/^[a-z0-9-]{1,40}$/.test(team)) return send(res, 400, { error: "Bad team" });
    if (!(await whoIs(req, team))) return send(res, 401, { error: "Sign in to use the mic" });
    const key = apiKey();
    if (!key) return send(res, 500, { error: "Dictation isn't set up — ELEVENLABS_API_KEY is missing on the server" });
    const audio = await readRaw(req);
    if (audio.length < 1000) return send(res, 400, { error: "Didn't catch anything — hold the mic a bit longer" });

    const type = String(req.headers["content-type"] || "audio/webm").split(";")[0];
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append("tag_audio_events", "false");
    form.append("language_code", q.get("lang") === "en" ? "en" : "hi");
    form.append("file", new Blob([audio], { type }), "speech." + (type.split("/")[1] || "webm"));
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: form });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, 502, { error: "Transcription failed (" + r.status + "): " + ((j.detail && (j.detail.message || j.detail)) || "").toString().slice(0, 160) });
    send(res, 200, { data: { text: String(j.text || "").replace(/\s+/g, " ").trim() } });
  } catch (e) { send(res, 500, { error: e.message }); }
}

// GET /api/transcribe-token?team=<slug>  → { token } for one live Scribe session (expires in 15 min, used once)
export async function scribeToken(req, res) {
  try {
    const team = new URL(req.url, "http://x").searchParams.get("team") || "";
    if (!/^[a-z0-9-]{1,40}$/.test(team)) return send(res, 400, { error: "Bad team" });
    if (!(await whoIs(req, team))) return send(res, 401, { error: "Sign in to use the mic" });
    const key = apiKey();
    if (!key) return send(res, 500, { error: "Dictation isn't set up — ELEVENLABS_API_KEY is missing on the server" });
    const r = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", { method: "POST", headers: { "xi-api-key": key } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.token) return send(res, 502, { error: "Couldn't start live dictation (" + r.status + ")" });
    send(res, 200, { data: { token: j.token } });
  } catch (e) { send(res, 500, { error: e.message }); }
}
