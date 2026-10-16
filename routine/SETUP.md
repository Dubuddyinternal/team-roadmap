# Claude pipeline: going live on tools.dubuddy.in

How the pieces fit:

```
card on tools.dubuddy.in ──(button)──▶ Vercel function api/pipeline/action
     ▲                                     │ checks the role, locks the job (Supabase edit_jobs)
     │ status + links                      ▼ POST …/routines/{id}/fire  {payload as text}
api/pipeline/callback ◀──(pipe.py)── Claude Code routine (cloud computer, your Max plan)
                                          downloads/uploads ONLY through one-file links to Cloudflare R2
```

## 1. Cloudflare R2: where the videos live (free up to 10 GB)
1. Cloudflare dashboard → R2 → **Create bucket**, named e.g. `dubuddy-pipeline`.
2. Bucket → Settings → **CORS policy** (lets the browser upload straight to it):
   ```json
   [{"AllowedOrigins":["https://tools.dubuddy.in"],"AllowedMethods":["GET","PUT"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]
   ```
3. R2 → **Manage API tokens** → Create → *Object Read & Write*, this bucket only. Keep the Access Key ID, the Secret,
   and your Account ID for step 4.

## 2. Supabase: the jobs table
Run `supabase/stage17a_edit_jobs.sql` (SQL Editor → paste → Run), or let Claude apply it.

## 3. The routine on claude.ai
1. The routine runs from this repo, **team-roadmap**. At its root it needs, next to `routine/`: `skills/dubuddy-short/` (the skill),
   `video-use/`, and `sfx/` (the SFX library). Claude can prepare it.
2. claude.ai → Code → **Environments → New**:
   - Setup script: the contents of `routine/setup.sh`
   - Network: *Custom*. Allow `*.r2.cloudflarestorage.com`, `tools.dubuddy.in`, `api.elevenlabs.io`, `api.pexels.com`,
     `*.pexels.com`, `api.openverse.org`, `*.wikimedia.org`, `dubuddy.in`, `www.dubuddy.in`,
     `cdn.jsdelivr.net` (GSAP: without it every animation is frozen), `hyperframes.heygen.com`, plus the package registries
   - Secret: `ELEVENLABS_API_KEY`
3. claude.ai → Code → **Routines → New** → repo `team-roadmap`, that environment, prompt = `routine/ROUTINE_PROMPT.md`.
   Trigger: **API**. Copy the **routine ID** and the **token**.
4. Make sure **vidIQ** is connected on this same claude.ai account (Settings → Connectors).

## 3b. Scheduled posts ("Post at slot")
Run `supabase/stage17b_pipeline_tick.sql` after putting the tick key in Supabase Vault (the file says how). Supabase then
calls `/api/pipeline/tick` every 5 minutes and posts whatever is due. On the Mac the local server does this every minute.

## 4. Vercel: Project → Settings → Environment Variables
| Name | Value |
|---|---|
| `PIPELINE_MODE` | `fire` |
| `ROUTINE_ID` / `ROUTINE_TOKEN` | from step 3 |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | from step 1 |
| `SUPABASE_URL` | `https://bzhnzrmnbphkcasvrsnc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (server only, never in the browser) |
| `PIPELINE_SECRET` | any long random string |
| `PUBLIC_BASE_URL` | `https://tools.dubuddy.in` |
| `ELEVENLABS_API_KEY` | for the 🎤 mic in every text box (speech → text with ElevenLabs Scribe) |
| `CF_API_TOKEN` | Cloudflare token with **Account Analytics: Read** only — lets the site read this month's R2 Class A / B operations and stop uploads + runs at 90% of the free tier (storage is checked without it) |
| `R2_CYCLE_DAY` | optional: the day of the month your Cloudflare period starts (default 15) |

Redeploy. The card panel then shows **☁️ Cloud routine**.

## Testing on the Mac first
`local/data/pipeline-config.json`: `{"mode":"fake"}` (dummy files, costs nothing) or `{"mode":"local"}`
(Claude Code on this Mac: run `claude` once and /login, then `node local/runner.mjs --doctor`). Restart the local server
after changing it. `node local/test-sigv4.mjs` checks the R2 link signing.

## 🎬 HyperFrames Studio (on a Mac)
When a brief is ready, the card's **Open in Studio** gives a one-line Terminal command (`studio/dubuddy-studio.sh`, valid 12 h).
It downloads the edit folder, opens the YouTube and Instagram versions in Studio, and on Return sends the edited folder back.
**Approve** then renders exactly what Studio showed. Needs Node.js on the Mac.

