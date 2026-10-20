# Lessons from the first build (don't repeat these)

## User feedback that shaped the style
- Hard banner edges in the app looked bad. A straight fade line also looked bad. The fix is a wavy mist on the top edge
  only, with the bottom solid under the app card.
- The website version was "too big". Keep the width; make it a short, wide strip.
- The label text overlapped. Stagger labels and measure the pills; later the user asked for them "more
  dispersed": scattered, with varied sizes and tilts.
- Lines on top of the crowns looked wrong. Connectors go to the face centre, behind the faces.
- The offer page "not looking good". Bigger, bolder, centred text; a real coupon ticket; precise
  alignment measured from font metrics.
- Plain geometric burst shapes were replaced by crackers, fairy lights and a little decoration.
- The pan was too long and the laugh too jittery. Use one hook, slow expressive laughs, staggered rather than all at once.
- The arrow was not visible enough. Make it bigger with an outline, give it an aim beat in clear space, and have the cast react.
- Everything was too fast. Add read pauses and longer holds on the offer.
- The feature list was "in addition to" the ones already discussed. Merge the lists rather than replace them.
- The user prefers to see plans and mocks first ("show me the plans", "don't build, let's discuss").

## Technical pitfalls hit
- **Skottie ignores `tr` (tracking) on native text,** so measured widths were wrong. Vector glyphs
  avoid this, and lottie-ios needs no text layers anyway.
- **Slots broke lottie-ios** ("data couldn't be read because it is missing"). Always run `inline_slots`.
- **Keyframes out of time order** (`min()` missing when a computed key lands after a fixed one)
  made the burst linger over the headline. When mixing computed and fixed key times, clamp them.
- **Name shadowing:** a loop variable called `lines` hid the `lines()` drawing helper. Avoid
  reusing helper names.
- **Shell quoting:** `$FRAMES` in quotes passes one argument, so pass frame lists unquoted.
- **Precomp clipping:** some players clip precomps to their w/h, so keep precomp art inside its bounds (the head
  art precomp is offset by (150, 200)).
- **Periodic motion must divide OP,** or the loop pops. `check_banner.py` catches this.
- **Size:** 10 copies of the head geometry and per-bulb twinkle keys made the file 1.2 MB. Sharing the
  precomp and phase-grouping the twinkles brought it to about 850 KB at 30fps.
- CanvasKit's `Path.MakeFromText` doesn't exist in 0.41, so text is outlined with opentype.js
  (`text_to_paths.cjs`).
- The Lottie player's `/__context` and UI overlays get in the way of screenshots. Render exact frames with
  `render_frames.cjs` instead.
