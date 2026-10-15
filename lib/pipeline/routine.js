// =====================================================================
// CLAUDE PIPELINE: start one step of a job somewhere that can run it.
//
//   fire   the Claude Code routine in the cloud (claude.ai). The payload
//          travels as the fire text; Claude reads it from the
//          <routine-fire-payload> block and follows routine/RUNNER.md.
//   local  Claude Code on this Mac (local/runner.mjs), same RUNNER.md
//   fake   a stand-in that makes dummy files (local/fake-routine.mjs),
//          to test the whole flow without spending any Claude usage
//
// Returns { session_id, session_url } (null locally) or throws.
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MODE, ROUTINE, PIPE_DIR } from "./config.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function startRun(payload) {
  if (MODE === "fire") {
    if (!ROUTINE.id || !ROUTINE.token) throw new Error("The routine isn't set up yet (ROUTINE_ID / ROUTINE_TOKEN)");
    const r = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${encodeURIComponent(ROUTINE.id)}/fire`, {
      method: "POST",
      headers: { authorization: `Bearer ${ROUTINE.token}`, "anthropic-version": "2023-06-01",
        "anthropic-beta": "experimental-cc-routine-2026-04-01", "content-type": "application/json" },
      body: JSON.stringify({ text: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(45000),   // never hang past the function's limit: the card says "failed" with a reason instead
    }).catch(e => { throw new Error(e.name === "TimeoutError" ? "Anthropic took too long to start the cloud run — press Retry" : "Couldn't reach Anthropic to start the cloud run: " + e.message); });
    const j = await r.json().catch(() => ({}));
    if (r.status === 429) throw new Error(`Too many runs started this hour — try again in ${r.headers.get("retry-after") || "a few"} seconds`);
    if (!r.ok) throw new Error(`Couldn't start the cloud run (${r.status}): ${(j.error && j.error.message) || JSON.stringify(j).slice(0, 200)}`);
    return { session_id: j.claude_code_session_id || null, session_url: j.claude_code_session_url || null };
  }

  // local / fake: hand the payload to a separate process that keeps going on its own
  const dir = path.join(PIPE_DIR, "runs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${payload.job}-${payload.run}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 1));
  const script = path.join(HERE, "../../local", MODE === "fake" ? "fake-routine.mjs" : "runner.mjs");
  const child = spawn(process.execPath, [script, file], { detached: true, stdio: "ignore", env: process.env });
  child.unref();
  return { session_id: null, session_url: null };
}
