# Animation + sound toolbox (extra skills and CLIs)

Used by `dubuddy-short`, `hindi-shorts` and any other video edit. HyperFrames stays the engine for every
short: these tools either help write better HyperFrames scenes, or render a clip that goes into
`plan.json` as B-roll (`media` in `full`/`split`, transparent `.mov`/`.webm` as an overlay).

**Not every machine has these.** Check first (skill in the skills list, `command -v <cli>`). If a tool is
missing, skip it and use the default path (hand-written GSAP scene, `sfx_lib.py`, Pexels/Openverse
B-roll). Never block an edit on a missing tool.

Every external render still goes through the **Animation QA** frame audit and the rules in
`animation-lessons.md` (no dead panels, alive, no clipped edges, text on pills, house colours/fonts)
before it is shown. Match the source fps (29.97/59.94) and 1080 wide; keep inside the safe zone.

## Pick the tool by what the line needs

| The line needs… | Use | How it lands in the short |
|---|---|---|
| Any custom scene / float / transition (default) | **gsap-core, gsap-timeline, gsap-utils** skills | Read before writing `kind:"custom"` js. Timeline position params, stagger, `gsap.utils` (mapRange, wrap, interpolate) for counters and idle loops |
| Hand-drawn lines, morphs, text splits, organic idle motion | **gsap-plugins** | DrawSVG (doodle/underline draws on), MorphSVG (icon → icon), MotionPath (arrow / paper plane along a path), SplitText (word/letter rises), CustomEase / CustomWiggle / CustomBounce ("always alive" breathing, wobbles, landings). All free since GSAP 3.13 |
| Jank, heavy scenes, slow Studio | **gsap-performance** | transforms + opacity only, no layout props, `force3D` |
| A real 3D moment: rotating object, India map / globe with college pins, 3D bar race, depth reveal | **threejs-*** skills (`threejs-fundamentals` first, then geometry/materials/lighting/animation) | Inside HyperFrames via its Three.js adapter (`hyperframes-animation` → runtime adapters). Seek-safe: drive the scene from the timeline time, no clock, no `Math.random` |
| Maths / numbers explained step by step: percentile, normalisation, marking scheme, cut-off formula, graphs, equations (CUET maths / quant) | **manimgl** (3b1b/manim, CLI) | `manimgl scene.py Name -w -t -r 1080x1080 --file_name x` → transparent ProRes 4444 `.mov`, 30 fps (don't pass `--fps`: ManimGL crashes on it; set `fps` in a `custom_config.yml` if 60 is needed) → `media` in a `split`/`full` panel (or overlay). House fonts/colours in the scene; dark text on our cream card, never default black bg |
| An illustrated / drawn explainer moment (student at a desk drawn live, chalkboard maths, marker-comic gag, a "how it works" doodle), or a drawing-timelapse hook | **anidoodle** plugin (32 styles: chalkboard, marker comic, ballpoint, crayon, cut-paper…) | Ask it for a 9:16 or 1:1 clip of the exact beat length → `media` B-roll. Good for the hook texture and "demonstrate as a vector animation" storyboard beats |
| A painterly / art-style moment or one of its explainer grammars | **huashu-art-motion** (36 styles, 9 explainer grammars; docs in Chinese) | Same: render the beat → `media` B-roll |
| A fully animated short or long segment (no talking head): faceless explainer, campus story, news-style recap, Dyng animated series | **lemo-opuscar** plugin (99 film styles) or **anidoodle** films | The whole video is made there; brand colours/handles added after, captions/CTA rules still apply |
| A launch / promo video for a Dubuddy product (dubuddy.in app, tools.dubuddy.in) | **brag** (`/brag-slim` on Opus 5.5 / Sonnet 5.5 / Fable 5.2) | Run inside the product's repo; then brand-check |
| Ready-made Remotion components (titles, charts, caption styles) | **remotion-elements** + remotion-* skills | Only when a project is in Remotion (user asks); shorts stay HyperFrames |

Prefer what explains the line best, not what is newest: a clean GSAP card beats a fancy render that
the line doesn't need. One external render per short is usually plenty.

## Sound effects — order of preference

1. Clip-local `<ED>/sfx/` and the user's OneDrive library via `sfx_lib.py` (house rule, unchanged).
2. **real-sfx** skill — same OneDrive library already indexed (279 sounds) + 78 CC0 UI sounds. Use it for
   frame-exact placement on busy animation: `python3 ~/.claude/skills/real-sfx/scripts/from_hyperframes.py
   "$ED/hf_yt/index.html" --out "$ED/work/moments.json"` lists every scene cut / entrance / burst with exact
   times → pick the beats that deserve a sound → add them to the broll `sfx` lists (build.py keeps owning
   the mix). For a finished video made outside build.py (anidoodle / lemo / brag / Dyng renders) let
   real-sfx do the whole pass (new MP4 + separate SFX WAV). It wants ffmpeg-full first on PATH:
   prefix `PATH="/opt/homebrew/opt/ffmpeg-full/bin:$PATH"` on its commands.
3. **earshot** (CLI + MCP) — when the library lacks the sound: `earshot make "a soft paper slide, 300 ms"
   -o "$ED/sfx/slide2.wav"` (interface, foley, game, motion sounds; 922 designs). Then name it in the broll `sfx` list.
4. **openverse** skill — real recordings not in the library: `python3 ~/.claude/skills/openverse/scripts/openverse.py
   grab "<sound>" --license cc0 --max-dur 4 -n 3 -o "$ED/sfx"` (credit file saved; CC0 only for brand videos).

Volumes stay 0.12–0.28 (8–12 dB under the voice). Skip meme sounds unless the beat is comedic.

## Around the edit

- **yt-dlp** — download a reference reel/short to study its pacing or style (never re-upload others' footage).
- **yt-script** — when planning a shoot from an idea: hook options scored against 21 formulas.
- **yt-package** + **yt-seo** — with the render: 3 linted title options + thumbnail text, then description and
  tags for the YouTube version (IG caption written from the same hook).
- **yt-chapters** (long videos), **yt-shorts** (find Shorts inside a long video), **yt-retention** (read a
  Studio retention CSV and say where viewers leave), **yt-comment**, **yt-plan**, **yt-audit**, **yt-viral**.
- **text-to-lottie** / `dubuddy-banner` — Lottie stays the format for app/web banners.
