// =====================================================================
// CLAUDE PIPELINE: stay inside Cloudflare R2's free tier — never a bill.
//
// Free each month: 10 GB storage · 1,000,000 Class A operations (uploads,
// listings) · 10,000,000 Class B operations (downloads, reads).
// At STOP (90%) new uploads and new Claude runs are refused with a reason;
// a run that was asked for while stopped waits as "paused" and starts by
// itself once there is room again (storage: when files are deleted;
// operations: when the next free month begins).
//
// Storage is counted by listing the bucket. Operations come from Cloudflare's
// own usage numbers (GraphQL Analytics), which needs CF_API_TOKEN (a token with
// "Account Analytics: Read" only). Without it, operations aren't checked and
// System stats says so.
//
// Env: CF_API_TOKEN, R2_ACCOUNT_ID, R2_BUCKET, R2_CYCLE_DAY (day of the month
// the Cloudflare period starts, default 15).
// =====================================================================
import { listFiles } from "./files.js";
import { FILES, R2 } from "./config.js";

export const FREE = { storage: 10e9, classA: 1e6, classB: 10e6 };
export const STOP = 0.9;   // stop at 90% of each
const env = process.env;
const CYCLE_DAY = Math.min(28, Math.max(1, Number(env.R2_CYCLE_DAY) || 15));

// operation names Cloudflare counts as Class A / Class B (deletes and aborts are free)
const CLASS_A = new Set(["ListBuckets", "PutBucket", "ListObjects", "PutObject", "CopyObject", "CompleteMultipartUpload",
  "CreateMultipartUpload", "ListMultipartUploads", "UploadPart", "UploadPartCopy", "ListParts", "PutBucketEncryption",
  "PutBucketCors", "PutBucketLifecycleConfiguration", "LifecycleStorageTierTransition"]);
const FREE_OPS = new Set(["DeleteObject", "DeleteObjects", "DeleteBucket", "AbortMultipartUpload"]);   // Cloudflare doesn't charge these
const CLASS_B = new Set(["HeadBucket", "HeadObject", "GetObject", "UsageSummary", "GetBucketEncryption", "GetBucketLocation",
  "GetBucketCors", "GetBucketLifecycleConfiguration"]);

// the current free period: from the cycle day this month (or last month) to the same day next month
export function period(now = new Date()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  let from = new Date(Date.UTC(y, m, CYCLE_DAY));
  if (from > now) from = new Date(Date.UTC(y, m - 1, CYCLE_DAY));
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, CYCLE_DAY));
  return { from, to };
}

async function operations(p) {
  if (!env.CF_API_TOKEN || !R2.account) return null;
  // the free tier is per Cloudflare account, so count every bucket and account-level call (e.g. ListBuckets), not just ours
  const q = `query($acc: string!, $from: Time!, $to: Time!) { viewer { accounts(filter: { accountTag: $acc }) {
    r2OperationsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $from, datetime_lt: $to }) {
      sum { requests } dimensions { actionType } } } } }`;
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST",
    headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query: q, variables: { acc: R2.account, from: p.from.toISOString(), to: p.to.toISOString() } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j.errors && j.errors.length)) throw new Error("Cloudflare usage: " + ((j.errors && j.errors[0] && j.errors[0].message) || r.status));
  let a = 0, b = 0;
  for (const g of (((j.data || {}).viewer || {}).accounts || [])[0]?.r2OperationsAdaptiveGroups || []) {
    const t = g.dimensions.actionType;
    if (CLASS_B.has(t)) b += g.sum.requests;
    else if (!FREE_OPS.has(t)) a += g.sum.requests;   // Class A, and anything not known for sure — never under-count
  }
  return { classA: a, classB: b };
}

let cache = null;   // { at, data } — one check every few minutes is plenty
export async function usage(fresh = false) {
  if (!fresh && cache && Date.now() - cache.at < 3 * 60000) return cache.data;
  const p = period(), files = await listFiles("");
  let ops = null, opsError = null;
  try { ops = await operations(p); } catch (e) { opsError = e.message; }
  const data = { storage: files.reduce((s, f) => s + f.size, 0), files: files.length, classA: ops ? ops.classA : null, classB: ops ? ops.classB : null,
    opsChecked: !!ops, opsError, period: { from: p.from.toISOString(), to: p.to.toISOString() }, mode: FILES, at: new Date().toISOString() };
  cache = { at: Date.now(), data };
  return data;
}
export const forget = () => { cache = null; };

// may this happen now? need: { bytes: extra storage it will add, a: Class A it will use, b: Class B }
// → null when fine, else { why, resumes } in plain words
export async function blocked(need = {}) {
  if (FILES !== "r2") return null;   // the Mac's own disk: no Cloudflare limits
  const u = await usage(), gb = n => (n / 1e9).toFixed(2) + " GB", day = new Date(u.period.to).toDateString().slice(4, 10);
  if (u.storage + (need.bytes || 0) > FREE.storage * STOP)
    return { kind: "storage", resumes: "when space is freed",
      why: `Cloudflare storage is at ${gb(u.storage)} of the free 10 GB (stops at ${gb(FREE.storage * STOP)})${need.bytes ? `, and this needs about ${gb(need.bytes)} more` : ""}. Delete old videos in Administration → System stats.` };
  if (u.opsChecked && u.classA + (need.a || 0) > FREE.classA * STOP)
    return { kind: "classA", resumes: day, why: `Cloudflare uploads/listings (Class A) are at ${u.classA.toLocaleString()} of the free 1,000,000 this month. They reset on ${day}.` };
  if (u.opsChecked && u.classB + (need.b || 0) > FREE.classB * STOP)
    return { kind: "classB", resumes: day, why: `Cloudflare downloads (Class B) are at ${u.classB.toLocaleString()} of the free 10,000,000 this month. They reset on ${day}.` };
  return null;
}
