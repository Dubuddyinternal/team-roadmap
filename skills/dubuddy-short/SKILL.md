---
name: dubuddy-short
description: Automatic edit of a raw Hindi/Hinglish talking-head clip into a finished Dubuddy Short in TWO versions (YouTube + Instagram) — transcript, hook, cuts, punch-ins, word-by-word pop captions, relevant B-roll, platform Subscribe/Follow CTA, QC. Shows a full brief with preview stills and waits for approval BEFORE rendering. Use for "/dubuddy-short <video>", "edit this for dubuddy", or raw Dubuddy footage.
---

# Dubuddy Short

`S=~/.agents/skills/dubuddy-short/scripts` · per clip: `ED=<footage_dir>/edit/<stem>` · source is never modified.
Extras (music, Devanagari, custom graphics, Codex, missing B-roll, troubleshooting): read `references/extras.md` only when needed.

## Rules
- **One video → one brief.** Batch only when the user says batch.
- **Every video ships 2 versions** from one edit: YouTube (`hf_yt/`) + Instagram (`hf_ig/`). Only the ending CTA + IG caption height differ.
- **Nothing renders before the user approves the brief** ("render"/"approved"). Every revision → rebuild + re-show.
- Captions **Hinglish** by default (Devanagari only on request), **every word pops** orange as spoken; brand/key words stay orange.
- **All text centre-aligned** (only the rows inside a `steps` list stay left).
- Brief changes apply to this video only. If a change sounds like a lasting style preference (caption size/colour, SFX, layout, pacing) and the user didn't say "save"/"always"/"from now on", ask: "just this video, or save as default?" Defaults go into the skill files (template/style.css, build.py, this file — keep it lean).
- **No dead panels.** A full/split panel appears ≤ 0.5 s before its first content animates (never a title alone for 1–2 s), and when the next item is ≥ 3–4 s away it leaves → back to the anchor's face → returns just before the next item. Applies to custom animations too (their content must start at `{S}`+0.3, not later).
- **Texture on what we create** (panels, cards, graphic text). Over the footage only where it adds mood for a short moment (e.g. a scary/glitch hook: grain + scanlines that leave with the hook) — never on the regular talking footage. Use judgment, not literal rules.
- B-roll display by purpose: explains → `full` (steps/site/media) · small animation → `split` (stat/list/media) · text → `float` (text/stat/mark).
- Sources, free only, in order: dubuddy.in capture → HyperFrames animation → Pexels video → Openverse/Wikimedia photo. No AI generation unless asked. Only claim what dubuddy.in actually shows.
- Judgment: hook → info density → clarity → pacing → captions → variation → polish. Every cut/zoom/graphic/sound must improve retention or clarity, else skip it. Professional, not AI-looking; the speaker and the info stay the focus. Content beats rules.

## 0 · Storyboard first (every video)
Before building anything, list every moment that can be **demonstrated as a vector animation** (not just text): beat · what's said · the scene idea · display (full/split/float) · depth/alive details. Give the user this storyboard with the hook + cut plan and **wait for approval**; only then build. Animation bar: detailed illustrated scenes with depth (parallax layers, soft shadows, light), **always alive** (idle breathing, drifting particles, flicker, bobbing — nothing frozen), smooth at the source fps (29.97/59.94 → eased GSAP tweens, no step holds), toned-down grain on our graphics only. CTA (default, user 2026-10-12): from the "comment mein batao" line → `common.comment_cards(start, T-1.25, comments)` (square sticker comment cards beside the head with example student comments + COMMENT KARO pill) + punch-in ~1.18 on "comment mein batao" + `common.comment_cta(start, text="Comment: kaunsa course?", end=T+1)` on the chest for the **last ≥5 s**; the Subscribe/Follow card joins at the end. Run `sfx_lib.py` first (bubble/ding).

**Animation QA (before showing ANY animation):** snapshot 6–10 frames per scene (entry · each beat · exit) and check: no part of one character on separate moving layers · nothing clipped at panel edges · no text on busy art (labels get pills) · no empty placeholders for steps not yet shown · no stray dots/blobs (fromTo renders FROM state immediately) · counters are plain number tweens · cut-out (matte) colour matches the clip (`scripts/matte.sh`). **Read `references/animation-lessons.md` first** — every mistake the user has caught and its fix.

**Phones = real phone mockups** (user rule): any app/site on a phone uses `iphone()` from `references/scenes/common.py` (titanium frame, buttons, Dynamic Island, 9:41 status bar, glare) — never a plain rounded rectangle.

Scene generators to reuse/adapt: `references/scenes/README.md` (hook, calendar, study room, notebook, road, ending cards, comment CTA).

## 1 · Analyse
```bash
cd ~/Developer/video-use && uv run python $S/prep.py "<video>"
```
Read `$ED/analysis.md` (`i:word`; `*` auto-removed filler · `~` soft filler · `?` check spelling · `!` low confidence · `#` key info) and `frames/raw_2.jpg` (face position). Fill `$ED/plan.json`:
- `hook {kicker, text, dur}` — ≤6-word promise, `|` newline, `*x*` orange. **Hook card sits mid-frame** (chest, just under the chin — default `layout.hook_y` 900; custom hooks: wrap the svg in `top:640px`), single items start centred in the card (user default 2026-10-12). Weak opening → cut it and/or `teaser: [i, j]` (strongest/most surprising later line first) + `teaser_move: true` so it isn't said twice. Never invent dialogue.
- `end_at` / `start_at` — `{"<word idx>": source_sec}` hand-trims a segment edge. **Check every cut's edges on the waveform**: after cut.py run `python3 $S/trim_edges.py "$ED"` (prints RMS strips + suggested trims; `--apply` writes them, then re-run cut.py; keep the word boundary where speech is continuous — no valley): end ≤0.1 s after the last word's energy drops, never into the breath/onset of the next (removed) word — the user catches these.
- `remove` — fillers that add nothing, the worse take of each retake, false starts, repeats, off-topic, intros. Keep natural pauses; don't over-cut.
- `spell` — `{"पूछे": "pooche"}` (all + learned) or `{"#57": "CUET"}` (one word).
- `captions.emphasis` — indices of key info (`#`: numbers, dates, fees, deadlines, sites, exams, warnings); consider a float callout for them.
- `punch {auto, levels:[1.0,1.1], moments:[{at, until, level 1.1–1.25, smooth?}]}` — moments only on key lines; `layout.face_x/face_y` = zoom origin.
- `broll` — 3–6 items, `from`/`to` = word indices; each must match what is said. One float/hook/CTA at a time; no float during 1.2× punch.
  `media {file, chip?, title?, media_start?}` · `site {file, scroll, chip?, title?}` · `steps {kicker, title, steps:[{t, sub?, at}], face_between?}` (auto-starts 0.6 s before the first `at` — `lead_in` tweaks it; face_between is ON by default: a gap ≥ ~3.5 s between steps goes back to the speaker and returns 0.5 s before the next — `hold`/`lead` tweak it, `false` disables) · `list {kicker, title, items:[{t, on?, at?}]}` · `stat {value, prefix?, suffix?, label, kicker?}` · `text {kicker?, text, hit?}` (white one-line pill, words rise in; `*x*` word gets an orange sweep at word `hit`; `=`/`→`/`+` become round badges; keep ≤ ~30 chars) · `mark {icon: check|cross|question|warning|arrow|star, label?}`
- Boxes hug their text (hook height auto, text floats = pill); every caption ≤ max_chars (cut.py never merges past it).
- `cta` — **no end screen** (a post-speech card = swipe-away zone). The CTA overlays the LAST spoken line (starts 1.2 s before speech ends, after any split panel clears) + 0.35 s held frame, then the video loops. Top of frame (y 230): profile card — YT red **Subscribe** → click → Subscribed + bell ring · IG blue **Follow** → tap → Following + story ring + hearts; sound = pop + chime. Chest (y 1110): "Comment your doubt" types in. Keys: `channel`, `handle`, `url`, `comment`, `y`, `comment_y`, `dur`, `tail`; per platform `variants: {yt:{…}, ig:{…}}`.
- `mattes` — `[{file, start, dur}]` speaker cut-outs so a graphic sits BEHIND the head; make them with `bash $S/matte.sh "$ED" <start> <dur>` (colour-matched). `cta.comment: false` when a custom comment CTA owns the last 5 s.
- `layout`: keep eyes/mouth clear, stay inside x 60–1020, y 220–1550. **Frame the face high (every video):** check a frame sheet of the whole cut; set `layout.frame_y` (e.g. −160) so the eyes sit ≈ y 600–650 all through — the uncovered bottom strip auto-fills with a feathered blurred copy (never black bars). Then re-check top graphics (hook text, `y` of floats, CTA card) don't sit on the face; splits keep their own `shift` and return to `frame_y`.

B-roll: `python3 $S/broll.py site "$ED" https://dubuddy.in/app/ dubuddy_app --mobile --tall` · `broll.py search "$ED" "<query>" --src pexels|pexels-photo|openverse|wikimedia` → `broll.py sheet "$ED" <src>` → Read `broll/cand_sheet.jpg` → `broll.py get "$ED" <id>`.

## 2 · Build + brief (no render)
```bash
python3 $S/cut.py "$ED" && python3 $S/build.py "$ED" && python3 $S/build.py "$ED" --variant yt && python3 $S/build.py "$ED" --variant ig \
  && (cd ~/Developer/video-use && uv run python $S/brief.py "$ED")
```
brief.py prints the check summary. Fix every error / `content_overlap` (details: `brief/check.txt`). Read `brief/sheet_small.jpg` (collisions, text on face, empty panels, glyph boxes).
Show the user, in chat: the timeline (brief.md §0), the cut + hook reasoning, every graphic/B-roll (time, display, text, source, line), the full caption text, audio (-14 LUFS, SFX, music). `SendUserFile` `brief/sheet.jpg` (render). **Always open the live Studio preview** (plays the real motion, no render): in Claude, `preview_start` the `dubuddy-studio` config — if the session's `.claude/launch.json` lacks it, add `{"name":"dubuddy-studio","runtimeExecutable":"bash","runtimeArgs":["<S>/studio.sh"],"port":3012,"autoPort":true}` (studio.sh opens the clip brief.py built last); after a rebuild just reload the tab. Also open both versions side by side: `dubuddy-studio-yt` (`HF=hf_yt PORT=3013`) and `dubuddy-studio-ig` (`HF=hf_ig PORT=3014`) — same studio.sh via `bash -c`. Elsewhere/Codex: `bash $S/studio.sh` → http://localhost:3012. Never kill another clip's preview server. The user may cut/trim/move clips in Studio (razor, split at playhead, drag edges) — those edits live in `hf*/index.html`: **don't rebuild over them** (build.py refuses and backs up to `studio_backups/`; `--force` only if the user wants plan.json to win). To keep Studio edits, render as-is. **Wait.** Changes → edit plan.json → re-run (cut.py only if cuts/spelling changed; `--no-video` if only text).

## 3 · Render (after approval only)
```bash
bash $S/finish.sh "$ED"          # renders hf_yt then hf_ig (or one: finish.sh "$ED" yt|ig)
```
Prints the QC table per version. Read `qc_yt/sheet.jpg` + `qc_ig/sheet.jpg`; fix + re-render anything off. Deliver `$ED/output/` (`youtube/final_yt.mp4`, `instagram/final_ig.mp4` + plan, transcript, captions, srt, credits) and `SendUserFile` both mp4s.
**Then send both mp4s to DropShelf** (finish.sh does it after both versions: `open -a DropShelf <yt.mp4> <ig.mp4>`; the shelf keeps them across restarts). If you re-render after fixes, send the new files again. Stop Studio preview servers before rendering (8 GB Mac: they starve the render).

## 4 · Clean (end of session, or when the user says "clean")
"Clean" = keep ONLY the rendered videos (`output/youtube/final_yt.mp4`, `output/instagram/final_ig.mp4`); everything else for the clip goes — edit files, previews, mattes, cut.mp4, cached transcript, **and the original source footage**. `bash $S/clean.sh "$ED" --dry-run` → show the list → `bash $S/clean.sh "$ED"` (moves to Trash; refuses if no rendered finals exist). At the end of every session remind the user / run it once they're happy — after this nothing can be re-edited, only re-shot.
