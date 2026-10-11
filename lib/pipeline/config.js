// =====================================================================
// CLAUDE PIPELINE: settings, read from environment variables.
//
// On Vercel (Project → Settings → Environment Variables):
//   PIPELINE_MODE=fire            run each step as a Claude Code routine in the cloud
//   ROUTINE_ID, ROUTINE_TOKEN     from claude.ai → the routine → API trigger
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET   Cloudflare R2 (videos)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY                            job statuses (table edit_jobs)
//   PIPELINE_SECRET               any long random string (signs the routine's callback links)
//   PUBLIC_BASE_URL               https://tools.dubuddy.in
//
// On this Mac (local/server.mjs) nothing needs setting: files go to
// ~/Dubuddy Pipeline, statuses to local/data, and PIPELINE_MODE is
// "local" (Claude Code on this Mac) or "fake" (a test stand-in).
// =====================================================================
import os from "node:os";
import path from "node:path";

const env = process.env;

export const MODE = env.PIPELINE_MODE || (env.VERCEL ? "fire" : "local");       // fire | local | fake
export const LOCAL = !env.VERCEL;                                              // running on the Mac
export const STORE = env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
export const FILES = env.R2_ACCESS_KEY_ID ? "r2" : "local";
export const BASE_URL = (env.PUBLIC_BASE_URL || "http://localhost:" + (env.PORT || 5180)).replace(/\/$/, "");
export const SECRET = env.PIPELINE_SECRET || (LOCAL ? "local-only-secret" : "");
export const PIPE_DIR = env.PIPE_DIR || path.join(os.homedir(), "Dubuddy Pipeline");

export const R2 = { account: env.R2_ACCOUNT_ID, key: env.R2_ACCESS_KEY_ID, secret: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET };
export const SUPABASE = { url: (env.SUPABASE_URL || "").replace(/\/$/, ""), service: env.SUPABASE_SERVICE_ROLE_KEY };
export const ROUTINE = { id: env.ROUTINE_ID, token: env.ROUTINE_TOKEN };

// on the live site the pipeline only switches on once storage, the jobs table and the key are set (routine/SETUP.md);
// until then every card says "not set up yet" instead of failing
export const CONFIGURED = LOCAL || !!(SECRET && SUPABASE.service && SUPABASE.url && R2.key);
