// =====================================================================
// CLAUDE PIPELINE: where the videos live, as short-lived links.
//
// Nobody else ever gets storage keys: the browser and the routine only
// receive links that work for one file, for a limited time.
//   R2 (Vercel):  presigned S3 links to the Cloudflare R2 bucket
//   local (Mac):  signed links to /api/pipeline/local-file on the local server
// =====================================================================
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { FILES, R2, BASE_URL, SECRET, PIPE_DIR } from "./config.js";

const DAY = 86400;
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const hmac = (k, s) => crypto.createHmac("sha256", k).update(s).digest();
const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");

// every file of a job sits under jobs/<team>/<card>/
export const keyFor = (team, card, name) => `jobs/${team}/${card}/${name}`;

// AWS Signature V4 query presign, which R2 speaks (region "auto"). Exported for the test in local/test-sigv4.mjs.
export function presignV4({ method, host, path: p, region, accessKey, secretKey, expires, now = new Date() }) {
  const amz = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amz.slice(0, 8), scope = `${day}/${region}/s3/aws4_request`;
  const q = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${accessKey}/${scope}`, "X-Amz-Date": amz,
    "X-Amz-Expires": String(Math.min(expires, 7 * DAY)), "X-Amz-SignedHeaders": "host" };
  const query = Object.keys(q).sort().map(k => `${enc(k)}=${enc(q[k])}`).join("&");
  const canonical = [method, p, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, sha256(canonical)].join("\n");
  const kSign = hmac(hmac(hmac(hmac("AWS4" + secretKey, day), region), "s3"), "aws4_request");
  return `https://${host}${p}?${query}&X-Amz-Signature=${crypto.createHmac("sha256", kSign).update(toSign).digest("hex")}`;
}
const r2Link = (method, key, expires) => presignV4({ method, host: `${R2.account}.r2.cloudflarestorage.com`,
  path: `/${R2.bucket}/${key.split("/").map(enc).join("/")}`, region: "auto", accessKey: R2.key, secretKey: R2.secret, expires });

// local: a link to the local server, signed so only links we handed out work
const localSig = (method, key, exp) => crypto.createHmac("sha256", SECRET).update(`${method}\n${key}\n${exp}`).digest("hex").slice(0, 32);
function localLink(method, key, expires) {
  const exp = Math.floor(Date.now() / 1000) + expires;
  return `${BASE_URL}/api/pipeline/local-file?key=${enc(key)}&m=${method}&exp=${exp}&sig=${localSig(method, key, exp)}`;
}

export const downloadLink = (key, expires = DAY) => FILES === "r2" ? r2Link("GET", key, expires) : localLink("GET", key, expires);
export const uploadLink = (key, expires = DAY) => FILES === "r2" ? r2Link("PUT", key, expires) : localLink("PUT", key, expires);

export async function removeFile(key) {
  if (FILES === "r2") { await fetch(r2Link("DELETE", key, 600), { method: "DELETE" }); return; }
  fs.rmSync(path.join(PIPE_DIR, key), { force: true });
}

// ---- the local server's side of local links (not used on Vercel) ----
export function serveLocalFile(req, res, url) {
  const key = url.searchParams.get("key") || "", m = url.searchParams.get("m"), exp = Number(url.searchParams.get("exp"));
  const file = path.join(PIPE_DIR, key);
  const bad = (code, msg) => { res.writeHead(code, { "content-type": "text/plain" }); res.end(msg); };
  if (!key || key.includes("..") || !file.startsWith(PIPE_DIR + path.sep)) return bad(400, "Bad key");
  if (m !== req.method || exp < Date.now() / 1000 || localSig(m, key, exp) !== url.searchParams.get("sig")) return bad(403, "Link expired or not valid");

  if (m === "PUT") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".part", out = fs.createWriteStream(tmp);
    req.pipe(out);
    out.on("finish", () => { fs.renameSync(tmp, file); res.writeHead(200); res.end("ok"); });
    out.on("error", e => bad(500, e.message));
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return bad(404, "Not found");
    const type = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json",
      ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".gz": "application/gzip" }[path.extname(file).toLowerCase()] || "application/octet-stream";
    const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    if (r) {   // byte ranges, so the video player can seek
      const a = r[1] ? Number(r[1]) : 0, b = r[2] ? Math.min(Number(r[2]), st.size - 1) : st.size - 1;
      res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${st.size}`, "content-length": b - a + 1 });
      return fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": st.size });
    fs.createReadStream(file).pipe(res);
  });
}
