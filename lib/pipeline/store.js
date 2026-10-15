// =====================================================================
// CLAUDE PIPELINE: where job statuses are kept.
//   supabase (Vercel): table public.edit_jobs (supabase/stage17a_edit_jobs.sql),
//                      written only with the server key, from these functions
//   local (Mac):       local/data/pipeline-jobs.json
//
// save(job, expected) only writes when the job's status is still
// `expected`, so two clicks (or a click and a routine callback) can never
// both move the same job: the second one gets a conflict. With `run` it also has to still be that run
// (two automatic restarts of the same stuck run can't both go through).
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STORE, SUPABASE } from "./config.js";

export class Conflict extends Error {}

// ---------------------------------------------------------------- local
const LOCAL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../local/data/pipeline-jobs.json");
const readAll = () => { try { return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8")); } catch { return {}; } };
function writeAll(all) {
  fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FILE + ".tmp", JSON.stringify(all, null, 1));
  fs.renameSync(LOCAL_FILE + ".tmp", LOCAL_FILE);
}
const local = {
  async get(team, card) { return readAll()[`${team}/${card}`] || null; },
  async list(team) { return Object.values(readAll()).filter(j => j.team === team); },
  async scheduled() { return Object.values(readAll()).filter(j => j.status === "scheduled"); },
  async save(job, expected, run) {
    const all = readAll(), k = `${job.team}/${job.card_id}`, cur = all[k];
    if ((cur ? cur.status : null) !== expected) throw new Conflict(`Job is ${cur ? cur.status : "not started"} now`);
    if (run && !(cur && cur.run && cur.run.id === run)) throw new Conflict("Job moved to another run");
    all[k] = job; writeAll(all); return job;
  },
};

// ---------------------------------------------------------------- supabase
async function rest(method, query, body, prefer) {
  const r = await fetch(`${SUPABASE.url}/rest/v1/edit_jobs?${query}`, {
    method, headers: { apikey: SUPABASE.service, authorization: `Bearer ${SUPABASE.service}`, "content-type": "application/json",
      ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const t = await r.text(); if (r.status === 409) throw new Conflict("Job was just started by someone else"); throw new Error(`Database: ${r.status} ${t.slice(0, 200)}`); }
  return r.status === 204 ? [] : r.json();
}
const q = s => encodeURIComponent(s);
const supabase = {
  async get(team, card) { const r = await rest("GET", `team_slug=eq.${q(team)}&card_id=eq.${q(card)}&select=data`); return r[0] ? r[0].data : null; },
  async list(team) { return (await rest("GET", `team_slug=eq.${q(team)}&select=data`)).map(r => r.data); },
  async scheduled() { return (await rest("GET", `status=eq.scheduled&select=data`)).map(r => r.data); },
  async save(job, expected, run) {
    const row = { team_slug: job.team, card_id: job.card_id, status: job.status, data: job, updated_at: new Date().toISOString() };
    if (expected === null) { await rest("POST", "", row, "return=minimal"); return job; }   // primary key stops a double start
    const r = await rest("PATCH", `team_slug=eq.${q(job.team)}&card_id=eq.${q(job.card_id)}&status=eq.${q(expected)}`
      + (run ? `&data->run->>id=eq.${q(run)}` : ""), row, "return=representation");
    if (!r.length) throw new Conflict("Job changed meanwhile — refresh");
    return job;
  },
};

export const store = STORE === "supabase" ? supabase : local;
