# Social Media: Claude pipeline + new workflow, handover notes

Give this file to Claude with the zip. Say: "Read HANDOVER-claude-pipeline.md, then commit these changes to `main` of
sumitkumarimages777-stack/team-roadmap."

## What this zip is

The latest `main` of `team-roadmap` (as of commit `10b8d10`, PR #47, Keep an Eye on 2nd Love) with the Social Media work
below merged in. Nothing from `main` was removed. Two files were changed on both sides, `index.html` and
`social-space.js`. They merged line by line with **no conflicts**, and the merged `social-space.js` passes `node --check`.

**To apply:** copy everything in this zip over a checkout of `main`, review `git diff`, then commit and push.
`local/data/` is git-ignored (local test data only).

## What changed for users (Social Media space)

- **Content types** in the Ideation tab: 📱 Shorts / Reels (YT + IG, Claude can edit), 🎬 Long video (YT only), and
  🖼️ Post (IG + YT community post). "+ New idea" asks for the type first, and each type has its own form, icon and
  platforms. ⚙ Types adds more. They're stored in `space.sx.formats`, and every idea or card gets a `.format`, worked
  out from the video type for older records.
- **Several platforms per card or idea** (`.platforms` array; `.platform` stays the first one, for the numbers). Each
  card has a posting time (`.time`) and one link per platform (`post.links`).
- **Board columns renamed** to Ideas · To shoot · Editing · Your check · Scheduled · Live. The stage ids are unchanged,
  so no data moves. Accepting an idea books the next free posting slot from Targets → Posting time.
- **The card opens as a centred window.** It has two columns, a stage bar, a pinned Save bar with an unsaved-changes
  warning, and refresh keeps your place.
- **Pre-production:** Research (one keyword table, "🔎 Fill with vidIQ") and Draft copy. **Shoot block** with an
  optional "✍️ Draft hook & talking points". **Post-production:** edited video or design, then per-platform links.
- **🤖 Claude edit & post panel** (Shorts / Reels only): raw clip → plan → ✋ check → render → vidIQ SEO →
  ✋ final check → Post now or Post at slot.
- **🎤 Dictation** in text boxes, using ElevenLabs Scribe (`dictate.js`, `hinglish.js`, `api/transcribe*.js`, `lib/voice.js`).
- **Phone layout fix** in `index.html`: the page no longer becomes 1,400px wide on phones.

## New files

| Path | What |
|---|---|
| `pipeline.js` | The card's Claude panel (browser) |
| `api/pipeline/*.js` | Vercel functions: jobs, action, upload-url, callback, tick |
| `lib/pipeline/*.js` | The rules (core), storage links (R2), job store (Supabase `edit_jobs`), auth, routine trigger |
| `routine/` | What the cloud Claude routine runs (RUNNER.md, pipe.py, prompt, setup.sh), plus **SETUP.md** |
| `supabase/stage17a_edit_jobs.sql`, `stage17b_pipeline_tick.sql` | Jobs table and the scheduled-posts timer (**not applied yet**) |
| `dictate.js`, `hinglish.js`, `api/transcribe*.js`, `lib/voice.js` | Dictation |
| `local/`, `local-supabase.js` | Local test server (runs the site on a Mac without Supabase). Not used by the live site. |
| `package.json` | `"type":"module"` so Vercel runs the `api/` functions as ES modules |

## After it's live

Everything above works straight away **except** Claude edit/post, vidIQ research and dictation. Until they're set up,
those parts say "not set up yet" instead of failing. To switch them on, follow `routine/SETUP.md`:
1. Cloudflare R2 bucket and CORS.
2. Run `stage17a` (and `stage17b` for "Post at slot").
3. Create the claude.ai environment and routine.
4. Set the Vercel environment variables (`PIPELINE_SECRET`, `SUPABASE_*`, `R2_*`, `ROUTINE_*`, `ELEVENLABS_API_KEY`,
   `PUBLIC_BASE_URL`).
5. Redeploy.

**Not tested in the cloud yet:** the real routine (HyperFrames render time limits, vidIQ upload and publish). Test on
one short clip first, posting only private or unlisted.
