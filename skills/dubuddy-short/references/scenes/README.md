# Reusable vector-scene recipes (built for DJI 0748, 2026-10-02)
Generators that write `custom` broll items into a clip's plan.json (edit the ED path + word indices, run, then build.py).
- hook.py — A scary glitch hook (extruded title, cracks, dust, heartbeat vignette) + B wall calendar (page tear, flip-digit counter, 90 dates ticking, KAAFI HAI stamp). Needs sfx: boom, heartbeat, glitch, drone, riser, tick, flip.
- scene.py — D study-room split: parallax layers L0/L1/L2 + camera drift, lamp cone, steam, blink, pencil scribble, answer-sheet card (bubbles, ✓/✗, magnifier, sticky note, ANALYSED stamp).
- ending.py — F float cards above the head: NCERT progress 0→100% → complete ✓, PYQ card + phone mock-up with rows fanning, dubuddy.in chip + cursor click.
- final.py — C syllabus notebook float (chapters tick, ring fills), E isometric 3-step road (full panel, camera dolly via svgOrigin:"0 0" on the cam group, milestones light up), G comment CTA for the last ≥5 s (heartbeat glow, typing, ? bubbles, bouncing arrow; set plan.cta.comment=false).
Rules baked in: graphics only carry texture (NZ noise ~.14 / feTurbulence), idle motion loops on everything, eased tweens, no dead panels (panel opens ≤0.5 s before content), seeded jitter instead of random().
Gotcha: GSAP transformOrigin on SVG <g> is bbox-relative — use svgOrigin for camera/scene groups.

## Lessons from the first review (2026-10-02)
- Never move parts of one character on different parallax layers (arm detached from body) — drift whole scenes or nothing.
- Keep counters as plain number tweens; flip-digit squash read as broken.
- No big soft 'light pool' circles behind panels — read as a stray white blob. GSAP fromTo renders its FROM state immediately: start hidden things at autoAlpha 0.
- Graphics behind the head: `scripts/matte.sh <ED> <start> <dur>` (alpha from the AI matte, RGB from cut.mp4, bt709-tagged — an untagged matte shifts colour ~6 levels), then `plan.mattes=[{file,start,dur}]`; build.py layers the cut-out above floats and mirrors every reframe/zoom.
- Labels never sit on busy art (road dashes) — give them a pill. Hide objects of unlit steps entirely, don't show empty boxes.
- No crack/lightning squiggles; glitch bars stay inside the title band, never across the face.
- Audit every scene frame-by-frame (6–10 snapshots per scene) before showing the user.
- common.py — comment_cards() (DEFAULT square comment stickers), comment_cta(text=…), pill(), psvg(), grain(); shared textures/defs, svg(), card_rect(), dust, POST/WALL, words(ed), comment_cta(start). Import it in a clip scenes.py instead of copying from old clips (old edit folders get cleaned).
- common.py iphone(idp, x, y, h, content) — realistic iPhone 15 Pro mockup (status bar: 9:41 left, ONE combined ring/wifi/dots icon right); always use it for app/site-on-phone shots.
