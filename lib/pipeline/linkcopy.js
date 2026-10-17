// =====================================================================
// CLAUDE PIPELINE: copy the raw video from a pasted link into storage.
//
// Google Drive and OneDrive links (a file, or a folder with the video in it),
// Dropbox, or any direct link to a video file. The link must be shared as
// "anyone with the link". The server copies the file in pieces of 64 MB:
// each call to /api/pipeline/import copies as many pieces as fit in ~40 s and
// hands back a signed "state" for the next call, so a big video never hits the
// function's time limit. The browser just keeps calling until it's done.
//
//   resolve(link)  → { files: [{ name, size, type, ref }] }  (ref = where to download it from)
//   source(ref)    → { url, headers }  a download link that takes Range requests
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { FILES, PIPE_DIR } from "./config.js";
import { multipart } from "./files.js";

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv)$/i;
const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const b64url = s => Buffer.from(s).toString("base64").replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
const htmlText = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const NOT_SHARED = "The link isn't open to everyone. Share it as \"Anyone with the link can view\" and try again.";

// ---- what kind of link is it?
export function kindOf(link) {
  let u; try { u = new URL(link); } catch { return null; }
  const h = u.hostname.toLowerCase(), p = u.pathname;
  if (/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$|drive\.usercontent\.google\.com$/.test(h)) {
    const folder = /\/folders\/([\w-]{10,})/.exec(p);
    if (folder) return { kind: "gdrive-folder", id: folder[1] };
    const id = (/\/(?:file\/)?d\/([\w-]{10,})/.exec(p) || [])[1] || u.searchParams.get("id");
    return id ? { kind: "gdrive", id } : null;
  }
  if (/(^|\.)1drv\.ms$|(^|\.)onedrive\.live\.com$|(^|\.)onedrive\.com$/.test(h)) return { kind: "onedrive", url: link };
  if (/\.sharepoint\.com$/.test(h)) return { kind: "sharepoint", url: link };
  if (/(^|\.)dropbox\.com$/.test(h)) return { kind: "direct", url: link.replace(/([?&])dl=0/, "$1dl=1") + (/[?&]dl=/.test(link) ? "" : (link.includes("?") ? "&" : "?") + "dl=1") };
  if (u.protocol === "https:" || u.protocol === "http:") return { kind: "direct", url: link };
  return null;
}

// ---- size, name and type of one download link, with a 1-byte Range request
async function probe(url, headers = {}) {
  const r = await fetch(url, { headers: { ...UA, ...headers, range: "bytes=0-0" }, redirect: "follow" });
  const type = (r.headers.get("content-type") || "").toLowerCase();
  if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error(NOT_SHARED);
  if (type.startsWith("text/html")) throw new Error(NOT_SHARED);
  const total = Number((/\/(\d+)$/.exec(r.headers.get("content-range") || "") || [])[1]) || 0;
  const cd = r.headers.get("content-disposition") || "";
  const name = decodeURIComponent((/filename\*=UTF-8''([^;]+)/i.exec(cd) || [])[1] || "") || (/filename="?([^";]+)"?/i.exec(cd) || [])[1] || "";
  try { await r.body?.cancel(); } catch {}
  if (r.status !== 206 || !total) throw new Error("That link can't be copied in pieces — download the video and upload the file instead.");
  return { size: total, name, type };
}

// ---- Google Drive
const gdriveUrl = id => `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
async function gdriveFolder(id, depth = 0) {
  // a public folder's own simple page lists its files (no Google key needed)
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(id)}`, { headers: UA });
  if (!r.ok) throw new Error(NOT_SHARED);
  const x = await r.text(), out = [];
  for (const m of x.matchAll(/<div class="flip-entry" id="entry-([\w-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>/g)) {
    const [, fid, href, title] = m, name = htmlText(title);
    if (/\/folders\//.test(href)) { if (depth < 2) out.push(...await gdriveFolder(fid, depth + 1).catch(() => [])); }
    else if (VIDEO_EXT.test(name)) out.push({ name, ref: { kind: "gdrive", id: fid } });
  }
  if (!out.length && !/flip-entry/.test(x)) throw new Error(NOT_SHARED);
  return out;
}

// ---- OneDrive (personal): the same public "shares" API the OneDrive website uses for shared links
async function badger() {
  const r = await fetch("https://api-badgerp.svc.ms/v1.0/token", { method: "POST", headers: { "content-type": "application/json", ...UA },
    body: JSON.stringify({ appId: "5cbed6ac-a083-4e14-b191-b4ba07653de2" }) });
  const j = await r.json().catch(() => ({})); if (!j.token) throw new Error("OneDrive didn't answer — try again in a minute");
  return j.token;
}
async function onedriveItem(link) {
  const enc = "u!" + b64url(link), tries = [];
  try {
    const t = await badger();
    tries.push(() => fetch(`https://my.microsoftpersonalcontent.com/_api/v2.0/shares/${enc}/driveitem?$expand=children`,
      { headers: { authorization: "Badger " + t, prefer: "autoredeem", ...UA } }));
  } catch {}
  tries.push(() => fetch(`https://api.onedrive.com/v1.0/shares/${enc}/root?expand=children`, { headers: UA }));
  let last = 0;
  for (const go of tries) { const r = await go().catch(() => null); if (!r) continue; last = r.status; if (r.ok) return r.json(); }
  throw new Error(last === 401 || last === 403 || last === 404 ? NOT_SHARED : `OneDrive answered ${last || "nothing"}`);
}
const dl = it => it["@content.downloadUrl"] || it["@microsoft.graph.downloadUrl"];
async function onedriveFiles(link) {
  let it = await onedriveItem(link);
  if (!it.folder && !it.children) return [{ name: it.name, size: it.size, ref: { kind: "onedrive", url: link } }];
  const out = [];
  for (const c of it.children || []) if (c.file && VIDEO_EXT.test(c.name || "")) out.push({ name: c.name, size: c.size, ref: { kind: "onedrive", url: link, child: c.id } });
  return out;
}

// a fresh download link for one file (OneDrive's links only last about an hour, so they're looked up again each time)
export async function source(ref) {
  if (ref.kind === "gdrive") return { url: gdriveUrl(ref.id), headers: {} };
  if (ref.kind === "onedrive") {
    const it = await onedriveItem(ref.url);
    const f = ref.child ? (it.children || []).find(c => c.id === ref.child) : it;
    if (!f || !dl(f)) throw new Error(NOT_SHARED);
    return { url: dl(f), headers: {} };
  }
  if (ref.kind === "sharepoint") return { url: ref.url + (ref.url.includes("?") ? "&" : "?") + "download=1", headers: {} };
  return { url: ref.url, headers: {} };
}

// every video the link points to, with its size
export async function resolve(link) {
  const k = kindOf(link);
  if (!k) throw new Error("Paste a full link (https://…)");
  let files;
  if (k.kind === "gdrive-folder") files = await gdriveFolder(k.id);
  else if (k.kind === "onedrive") files = await onedriveFiles(k.url);
  else files = [{ name: "", ref: k.kind === "gdrive" ? { kind: "gdrive", id: k.id } : k }];
  if (!files.length) throw new Error("No video file (.mp4 / .mov) in that folder");
  files = files.slice(0, 20);
  for (const f of files) {   // fill in size + name from the file itself (folders already know the names)
    const s = await source(f.ref), p = await probe(s.url, s.headers);
    f.size = p.size; f.name = f.name || p.name || "raw.mp4"; f.type = p.type;
  }
  return files.map(f => ({ name: f.name, size: f.size, type: f.type || "", ref: f.ref }));
}

export const extOf = f => ((VIDEO_EXT.exec(f.name || "") || [])[1] || (/quicktime/.test(f.type || "") ? "mov" : /matroska/.test(f.type || "") ? "mkv" : "mp4")).toLowerCase();
export const PART = Number(process.env.IMPORT_PART) || 64 * 1024 * 1024;   // IMPORT_PART: smaller pieces for tests

// ---- where the pieces go: R2 multipart, or one file on the Mac
export const sink = FILES === "r2" ? multipart : {
  async start(key) { const f = path.join(PIPE_DIR, key + ".part"); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, ""); return "local"; },
  async part(key, id, n, buf) { fs.appendFileSync(path.join(PIPE_DIR, key + ".part"), buf); return "local-" + n; },
  async finish(key) { fs.renameSync(path.join(PIPE_DIR, key + ".part"), path.join(PIPE_DIR, key)); },
  async abort(key) { fs.rmSync(path.join(PIPE_DIR, key + ".part"), { force: true }); },
};

// download bytes [from, to] of the file
export async function piece(ref, from, to, cached) {
  for (let i = 0; i < 2; i++) {
    const s = cached && i === 0 ? cached : await source(ref);
    const r = await fetch(s.url, { headers: { ...UA, ...s.headers, range: `bytes=${from}-${to}` } });
    if (r.status === 206) { const buf = Buffer.from(await r.arrayBuffer()); if (buf.length === to - from + 1) return { buf, src: s }; }
    else try { await r.body?.cancel(); } catch {}
    if (i === 1) throw new Error(`The link stopped answering (${r.status}) — try again`);
  }
}
