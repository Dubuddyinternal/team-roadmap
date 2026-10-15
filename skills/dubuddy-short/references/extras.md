# dubuddy-short — extras (read only when the situation comes up)

## Music (only when the plan uses music)
`plan.music = {file, volume: 0.10, start, credit}`. Tracks are the user's **Epidemic Sound** downloads in `~/Music/Dubuddy-BGM/` — list the folder, pick by mood/tempo from file names (calm / lo-fi for explainers). 0.10 ≈ -20 dB under the voice; build.py lifts it on the end card and fades it out. Nothing fits → no music. Remind the user their channel must be whitelisted in Epidemic to avoid Content ID claims.

## B-roll that isn't available
`plan.broll_needed = [{at: "0:12", what: "SRCC campus gate", why: "speaker names the college"}]` → shown in the brief and written to `output/05_broll_requirements.md`. Use it instead of a misleading stand-in (never fake a specific real place/document).

## Sourcing details
- Openverse copies of hot-link-blocked images max out ~960px → split/float only.
- Wikimedia is best for real DU colleges/places (credit line required — it lands in `output/credits.md`).
- `broll.py site ... --tall` unlocks apps that scroll an inner div; without `--tall` you get one screen.
- `mp4` media: set `media_start` to skip slow openings.

## `custom` B-roll kind
`{display: split|full|float, kind: "custom", html, js, from, to, sfx?: [[name, sec, vol?]]}` (float: html positions itself, js does entry + exit) — `{ID}` = element id prefix, `{S}`/`{E}`/`{D}` = start/end/duration in output seconds; add tweens to the existing `tl`. Follow hyperframes-core rules: seekable, no `Math.random` (sin-hash instead), never a CSS `transform` on an element GSAP also transforms, set hidden state with `tl.set(el,{autoAlpha:0},0)`, add a hard `tl.set(...autoAlpha:0)` after every exit. Centre-align text (house style).

## Devanagari captions
`captions.script: "devanagari"` → Scribe's own script (Hindi in Devanagari, English words stay Roman) + glossary brand fixes; font Baloo 2. `spell {"#i": "..."}` fixes a single word in either script. Check the sheet for missing-glyph boxes.

## Running in Codex
Same files (`~/.agents/skills` + links in `~/.codex/skills`). Needs **network access** (Scribe, Pexels/Openverse, dubuddy.in, npx) — Full access or approve each network command. Instead of `SendUserFile`/`Read` on an image: open it with the image viewer (or `open <path>`) and give the user the path.

## QC / output details
`qc.py` checks 1080×1920, H.264/AAC, source fps, duration, black frames, frozen frames (outside the end card), silence during speech, -14 LUFS, true peak ≤ -1 dBTP, missing media → `qc/report.md`, exit 1 on a hard failure. `output/`: `01_edit_plan.md` · `02_transcript.json` (Hindi + Hinglish, source + output times) · `03_captions.json` · `04_final.mp4` · `captions.srt` · `credits.md` · `05_broll_requirements.md` (if needed). Full render log: `qc/render.log`.

## Troubleshooting
- Transcripts are cached in `<footage_dir>/edit/transcripts/` — never re-transcribe an unchanged clip.
- Scribe writes CUET as "CUT"/"CET" (glossary maps them) — add new variants to `glossary.json`.
- build.py stops if a `from`/`to`/`at` word was cut → pick a kept word.
- python.org Python on this Mac has no CA certs → broll.py uses curl; keep it that way.
- Logo PNG has a light background → only on the light CTA card (multiply blend).
- `hyperframes check` full output: `brief/check.txt`. Expected warnings: composition_file_too_large, timeline_track_too_dense.
- Render failed → `tail -40 qc/render.log`.

## Studio timeline structure
Every graphic is a timed clip: `<div id="X-clip" class="clip layer" data-start data-duration data-track-index>` wrapping the element `#X` that GSAP animates (the framework owns the wrapper's visibility — never tween autoAlpha on a `.clip`). Video B-roll is its own timed `<video class="bvid clip">` beside its panel (media can't sit in a timed wrapper) and only gets transform/clip-path tweens. Lanes: 0 a-roll · 2 B-roll panels · 3 B-roll video · 4 floats/marks · 5 hook + end bg · 6 CTA · 7 captions · 10 voice · 15 music · 20+ SFX. Studio stamps `data-hf-id` on every element when it opens a file — build.py ignores those when detecting hand edits.

## YouTube + Instagram versions
`build.py --variant yt|ig` → `hf_yt/` / `hf_ig/`. Plain `build.py` = the YouTube look in `hf/` (brief + default Studio). Merge order: plan → `VARIANT_DEFAULTS[v]` (build.py) → `plan.variants[v]`. `cta.style: "classic"` restores the old dubuddy.in card (not recommended: no end screens).
- IG default: captions `y` 1380 (IG bottom UI covers more). Handles (confirmed 2026-09-29): YouTube `@dubuddy`, Instagram `dubuddy.in`.
- Studio guard ignores Studio's own save formatting (data-hf-id, `/>`, doctype); backups are `studio_backups/<hf dir>.studio-<time>.html`. Real moves show up as `gsap.set("[data-hf-id=…]", {x, y})` — carry them into plan.json before `--force`.
- zsh: don't pass `${v:+--variant $v}` unquoted (becomes ONE argument) — write the flags out.
- qc.py `<ed> yt|ig` reads the expected length from `hf_<v>/index.html` (root data-duration).

## User SFX library (preferred over the house sounds)
`~/Library/CloudStorage/OneDrive-Personal/Assests/Sound Effects/` (root + `Library/` + `Editing SFX/`, ~290 files). `python3 $S/sfx_lib.py "$ED"` trims/levels the standard picks into `<ED>/sfx/<name>.mp3` (silenceremove start → atrim → short fade → peak -1 dBFS, 48 kHz). build.py copies `<ED>/sfx/` over the house set: same name (pop, whoosh-short, whoosh, click, chime, typing, boom, tick, flip, sparkle, riser, drone, glitch) overrides it; new names (slide, thud, correct, wrong, count, write, pencil, crumple, throw, clank, stamp, ding, swing, clockbed, flare, bubble, cinwhoosh) are usable in broll `sfx` lists. Volumes 0.12–0.28 keep SFX ~8–12 dB under the voice. Proven map: DJI 0850 `edit/.../sfx/`. Skip meme sounds unless the beat is comedic.
