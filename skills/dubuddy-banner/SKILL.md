---
name: dubuddy-banner
description: Build DuBuddy's animated campaign banners as Lottie JSON for both the mobile app (1000x640) and the website (1000x360), in the established DuBuddy festival-banner style - a character "cast" of student problems that gets defeated, a festive offer sequence (headline, hook line, coupon code, discount, logo + features) and a seamless loop. Use this whenever the user wants a sale, festival, offer, coupon, launch or campaign banner / hero animation / Lottie for DuBuddy (Dussehra, Diwali, Holi, New Year, Independence Day, exam season, back-to-school, any discount code), wants to adapt or re-theme the Dussehra Ravan banner, or asks for app and website banner versions - even if they only say "make a banner for Diwali" or "same banner but for New Year".
---

# DuBuddy campaign banners (Lottie, app + website)

This skill packages a pipeline that was built and refined with the user over many rounds. The
reference campaign is the Dussehra 2026 sale (Ravan's 10 heads = 10 CUET problems, an arrow
defeats them, then the VIJAY50 offer). New campaigns keep the same **structure, design system,
motion language and delivery rules** and change the theme: the festival, the character, the
hero object, the copy and the offer.

## What you deliver

For every campaign, two variants that share one build:

| Variant | Canvas | Edge treatment | Use |
|---|---|---|---|
| app | 1000x640 (1000x444 band + white space) | soft wavy mist on the **top** edge only; bottom runs solid (the app's white card overlaps it) | React Native app (lottie-react-native / lottie-ios) |
| website | 1000x360 wide strip (band scaled to 80%, centred) | none (the site shows it in a rounded card) | website hero carousel |

Each variant ships as a 30fps light file (what the developers use) plus the 60fps master, plus an
MP4 preview for the user. Report raw and gzip sizes.

## Workflow

1. **Collect the brief.** Festival or occasion, the "villain"/obstacle metaphor and its cast, the
   list of problems (usually 10), the headline, the hook line and the word to highlight, the code,
   the discount, the validity dates, the feature list, and the sign-off. Ask for what is missing; never
   invent offer terms, prices, dates or codes. Don't put a clickable CTA in the Lottie: it can't be
   tapped. The link lives on the container in the app or site.
2. **Discuss before building.** The user explicitly prefers this ("first let's discuss, then make";
   "show me, then build"). Show a storyboard of the beats and reference frames as an inline visual
   (show_widget SVG mockups at 1000x444), lay out text from real font measurements, and offer a
   guides toggle when alignment matters. Iterate until they say go. Show mocks for anything subjective
   (character look, layout, decoration) rather than describing it.
3. **Set up a project** (once per campaign):
   `bash <skill>/scripts/setup_project.sh <project-dir> [--player]`
   This copies the template build, the helper scripts, the fonts and the traced logo, and installs
   opentype.js and CanvasKit. `--player` also fetches the official Lottie player for live preview.
4. **Edit `CAMPAIGN`** at the top of `build_banner.py` (copy, code, dates, features, problems,
   label order). For a new festival, swap the character, the hero object and the decoration as described in
   `references/new-campaign.md`.
5. **Build both variants:** `python3 build_banner.py` and `VARIANT=website python3 build_banner.py`.
   Output goes to `out/<slug>-app.json` and `out/<slug>-website.json`.
6. **Review frames yourself before showing the user.** Render key frames with
   `node render_frames.cjs <dir with lottie.json> <outdir> <frames...>` (env `SCALE`, `PAD`) and look at
   contact sheets (`python3 sheet.py out.png <dir> <frames...>`). Check every beat: hook, labels,
   arrow aim and hit, burst, A, B, C1, C2, D, and the outro. Fix overlaps, clipping, things leaking into
   the next beat, and unbalanced margins before showing anything.
7. **Make the light files:** `python3 export_light.py out/<slug>-app.json out/<slug>-app-30fps.json 30`
   (and the same for website). This retimes to 30fps, drops redundant keyframes and trims precision.
8. **Run the checks:** `python3 check_banner.py out/<slug>-app-30fps.json [frames...]`. It must PASS:
   no slots or `sid`, no text layers, no images, no expressions, and a seamless loop.
9. **Preview:** render all frames (`SCALE=1 PAD=4`) and run
   `ffmpeg -framerate 30 -i f%04d.png -pix_fmt yuv420p preview.mp4`. Send the MP4 and the light JSONs.
   Optionally confirm in lottie-web (cdnjs bodymovin 5.12.2) from a local page.
10. **Hand off** with the sizes, the canvas size per variant (the containers must match the aspect
    ratio) and anything not verified on a device.

## Delivery rules (from the app team; non-negotiable)

lottie-ios rejected an early export, so every file must be **plain Lottie**:
- **No Slots.** No `"sid"` and no top-level `"slots"`; every property carries its own value.
  `lottie_kit.inline_slots()` runs in the build, and `check_banner.py` verifies it.
- **Shapes only.** No text layers: all copy is converted to vector glyph outlines with `glyphs()`, so
  no fonts are needed at runtime. No image assets and no expressions.
- **Keep it light.** 30fps for the app and site, the same duration. Share repeated artwork through one
  precomp (the heads do this) instead of copying geometry, and group twinkles and flickers into phase groups
  instead of animating each element. Target under about 900 KB raw and under about 100 KB gzip for a ~25s loop.
- Precomps, null parenting, gradient fills (linear and radial with opacity stops), track-free
  masks and trim paths all render in Skottie, lottie-web and lottie-ios. Blur effects don't work
  in lottie-ios, so soft edges are made with gradients (see design-system.md).

## Reference files (read when needed)

- `references/design-system.md`: palette, fonts, logo, every component (problem labels, coupon,
  chips, marker highlight, sale line), alignment rules, festive decoration, canvas and edge treatment.
  Read it before laying out anything.
- `references/motion.md`: beat timings, idle character motion, the laugh and fear acting, the arrow,
  the burst, the offer-beat animations, the loop outro and pacing rules the user asked for. Read it
  before touching timing.
- `references/new-campaign.md`: how to re-theme for another festival: what to swap in the code,
  character and hero-object ideas, and what must stay the same.
- `references/lessons.md`: bugs and feedback from the first build. Skim it before starting so
  you don't repeat them.

## Scripts (copied into the project by setup_project.sh)

| Script | What it does |
|---|---|
| `template/build_banner.py` | The full banner build (Dussehra reference). Edit `CAMPAIGN` first. |
| `lottie_kit.py` | Lottie helpers: keyframes and eases, shapes, SVG path parsing, vector glyph text, `inline_slots`. |
| `text_to_paths.cjs` | Converts text to Lottie bezier glyphs (opentype.js); called by `glyphs()`. |
| `render_frames.cjs` | Renders exact frames to PNG with CanvasKit Skottie (the same engine as the official player). |
| `sheet.py` | Contact sheet of rendered frames. |
| `export_light.py` | 30fps light export (retime, thin keyframes, trim precision, strip shape names). |
| `check_banner.py` | Delivery checklist and loop-seam check, plus an optional contact sheet. |
| `trace_logo.py` | Traces a two-colour logo PNG into vector paths (how `dubuddy_mark.json` was made). |

Assets: `assets/fonts/` (Plus Jakarta Sans ExtraBold and Bold, DM Mono Medium),
`assets/dubuddy_mark.json` (traced DuBuddy mark), `assets/dubuddy_logo_source.png` (its source).
