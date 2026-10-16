// =====================================================================
// LOCAL SERVER for the Dubuddy tools site: runs everything on this Mac.
//
//   * Serves the site files (index.html, social-space.js, ...).
//   * Reloads the browser by itself whenever a site file changes.
//   * Answers the app's database calls (sent by local-supabase.js) from
//     local/data/db.json, so nothing goes to Supabase. index.html itself
//     stays production-ready: the Supabase library is swapped for
//     local-supabase.js only while this server sends the page.
//   * Runs the Claude pipeline's website functions (api/pipeline/*, the
//     same code Vercel runs) with files in ~/Dubuddy Pipeline.
//     Who does the work: local/data/pipeline-config.json {"mode": …}
//       "local" Claude Code on this Mac (default) · "fake" test stand-in
//
// Start:  node local/server.mjs        (from the site folder)
// Open:   http://localhost:5180/?team=dubuddy
// No packages to install: it only uses what comes with Node.
// =====================================================================
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seed } from "./seed.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, "..");
const DATA_DIR = path.join(HERE, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PORT = Number(process.env.PORT) || 5180;

// ---------------------------------------------------------------- data
fs.mkdirSync(DATA_DIR, { recursive: true });
let DB;
if (fs.existsSync(DB_FILE)) DB = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
else { DB = seed(); save(); console.log("Created local/data/db.json with demo data"); }

function save() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(DB, null, 1));
  fs.renameSync(tmp, DB_FILE);   // write whole file then swap, so a crash never leaves half a file
}

// ---------------------------------------------------------------- Claude pipeline
// mode comes from local/data/pipeline-config.json; set before the pipeline code reads it
try { const c = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "pipeline-config.json"), "utf8")); if (c.mode) process.env.PIPELINE_MODE = c.mode; } catch {}
process.env.PORT = String(PORT);
const API = {
  "/api/pipeline/jobs": (await import("../api/pipeline/jobs.js")).default,
  "/api/pipeline/action": (await import("../api/pipeline/action.js")).default,
  "/api/pipeline/upload-url": (await import("../api/pipeline/upload-url.js")).default,
  "/api/pipeline/callback": (await import("../api/pipeline/callback.js")).default,
  "/api/pipeline/preview": (await import("../api/pipeline/preview.js")).default,
  "/api/pipeline/storage": (await import("../api/pipeline/storage.js")).default,
  "/api/transcribe": (await import("../api/transcribe.js")).default,   // 🎤 dictation (ElevenLabs Scribe)
  "/api/transcribe-token": (await import("../api/transcribe-token.js")).default,   // 🎤 live dictation token
};
const { serveLocalFile } = await import("../lib/pipeline/files.js");
const { MODE } = await import("../lib/pipeline/config.js");
const { runDue } = await import("../lib/pipeline/core.js");
setInterval(() => runDue().catch(e => console.error("[tick]", e.message)), 60000);   // scheduled posts go out on time

// primary keys, used by upsert when the app doesn't name one
const KEYS = { team_data: ["team_slug", "section"], teams: ["slug"], profiles: ["id"],
  memberships: ["team_slug", "user_id"], team_roles: ["team_slug", "key"],
  my_todos: ["user_id", "team_slug"] };

const matches = (row, [kind, col, val]) => {
  const v = row[col];
  switch (kind) {
    case "eq": return v === val;
    case "neq": return v !== val;
    case "gt": return v > val;
    case "gte": return v >= val;
    case "lt": return v < val;
    case "lte": return v <= val;
    case "in": return (val || []).includes(v);
    case "is": return val === null ? v == null : v === val;
    case "contains": return Array.isArray(v) ? [].concat(val).every(x => v.includes(x))
      : v && typeof v === "object" ? Object.keys(val || {}).every(k => v[k] === val[k]) : false;
    default: return true;
  }
};

function pick(row, columns) {
  if (!columns || columns.trim() === "*") return { ...row };
  const out = {};
  columns.split(",").map(s => s.trim()).filter(Boolean).forEach(c => { out[c] = row[c] === undefined ? null : row[c]; });
  return out;
}

function runQuery(q) {
  const rows = DB.tables[q.table] || (DB.tables[q.table] = []);
  const hit = r => q.filters.every(f => matches(r, f));
  const now = new Date().toISOString();

  if (q.op === "select") {
    let out = rows.filter(hit);
    q.order.forEach(([c, asc]) => out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)));
    if (q.offset) out = out.slice(q.offset);
    if (q.limit != null) out = out.slice(0, q.limit);
    out = out.map(r => pick(r, q.columns));
    if (q.single) {
      if (out.length === 1) return { data: out[0] };
      if (!out.length && q.single === "maybe") return { data: null };
      return { error: out.length ? "More than one row" : "No row found" };
    }
    return { data: out, count: out.length };
  }

  const changed = [];
  if (q.op === "insert" || q.op === "upsert") {
    const keys = q.onConflict ? q.onConflict.split(",").map(s => s.trim()) : KEYS[q.table];
    [].concat(q.values || []).forEach(v => {
      const row = { ...v, updated_at: now };
      if (!row.id && !(KEYS[q.table] || []).length) row.id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const i = q.op === "upsert" && keys ? rows.findIndex(r => keys.every(k => r[k] === row[k])) : -1;
      if (i >= 0) rows[i] = { ...rows[i], ...row }; else rows.push(row);
      changed.push(i >= 0 ? rows[i] : row);
    });
  } else if (q.op === "update") {
    rows.forEach((r, i) => { if (hit(r)) { rows[i] = { ...r, ...q.values, updated_at: now }; changed.push(rows[i]); } });
  } else if (q.op === "delete") {
    DB.tables[q.table] = rows.filter(r => { if (hit(r)) { changed.push(r); return false; } return true; });
  }
  save();
  const data = q.returning ? changed.map(r => pick(r, q.columns)) : null;
  return { data: q.single && data ? data[0] || null : data };
}

// ---------------------------------------------------------------- live reload
const clients = new Set();
const SUPABASE_TAG = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
const RELOAD_SNIPPET = `<script>/* local live reload */(function(){var s=new EventSource("/__reload");s.onmessage=function(){location.reload()};})();</script>`;
let reloadTimer = null;
fs.watch(SITE, { recursive: true }, (_e, file) => {
  if (!file || file.startsWith("local" + path.sep + "data") || file.includes(".git")) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => { clients.forEach(res => res.write("data: reload\n\n")); }, 150);
});

// ---------------------------------------------------------------- http
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8" };

function readBody(req) {
  return new Promise(ok => { let b = ""; req.on("data", c => b += c); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); });
}
function json(res, obj) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); }

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = decodeURIComponent(url.pathname);

  if (p === "/__reload") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(": ok\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return;
  }
  if (API[p]) return API[p](req, res);
  const pv = /^\/pv\/([^/]+)\/(.+)$/.exec(p);   // same rewrite as vercel.json
  if (pv) { req.url = `/api/pipeline/preview?token=${encodeURIComponent(pv[1])}&path=${encodeURIComponent(pv[2])}`; return API["/api/pipeline/preview"](req, res); }
  if (p === "/api/pipeline/local-file") return serveLocalFile(req, res, url);
  if (req.method === "POST" && p === "/api/db") {
    try { return json(res, runQuery(await readBody(req))); } catch (e) { return json(res, { error: e.message }); }
  }
  if (req.method === "POST" && (p.startsWith("/api/rpc/") || p.startsWith("/api/fn/"))) {
    await readBody(req);
    return json(res, { data: null });   // server functions aren't run locally
  }

  // static files (never outside the site folder, never the local data)
  let file = path.join(SITE, p.endsWith("/") ? p + "index.html" : p);
  if (!file.startsWith(SITE) || file.startsWith(DATA_DIR)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err2, buf) => {
      if (err2) { res.writeHead(404); return res.end("Not found"); }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { "content-type": TYPES[ext] || "application/octet-stream", "cache-control": "no-store" });
      if (ext === ".html") return res.end(buf.toString()
        .replace(SUPABASE_TAG, '<script src="local-supabase.js"></script><!-- local mode -->')
        .replace("</body>", RELOAD_SNIPPET + "</body>"));
      res.end(buf);
    });
  });
}).listen(PORT, () => console.log(`Dubuddy tools (local) → http://localhost:${PORT}/?team=dubuddy · pipeline: ${MODE}`));
