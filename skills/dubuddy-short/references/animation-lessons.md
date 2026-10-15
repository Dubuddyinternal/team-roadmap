# Animation lessons — mistakes the user caught, and the fixes

Read before building or showing any custom animation. Source: DJI 0748 edit (2026-10-02); the fixed generators are in `references/scenes/`.

## Judgment
- **Be smart, not literal.** "No texture on the video" meant the regular talking footage — the scary hook's grain + scanlines *added* to the hook and had to come back. Ask what the user is trying to fix; keep effects that serve it.
- **Storyboard → approval → build.** Propose every moment that can be a vector animation (rough sketches over real frames if asked), build only after "approved".
- **Quality bar:** detailed illustrated scenes (props, shading, light), toned-down grain (~.14) on our graphics only, info cards clean with a soft shadow, always alive (breathing, dust, steam, bobbing), smooth eased tweens at the source fps.
- **Pacing:** don't flip pages/months fast — one view, progressive animation (~2 s).
- **No dead panels:** panel appears ≤ 0.5 s before its content; gap ≥ 3–4 s → back to the face.
- **Frame the anchor high** every video (`layout.frame_y`, eyes ≈ y 600–650), blurred fill, never black bars.
- **Comment CTA** attention-grabbing, on screen for the last ≥ 5 s.

## Motion bugs
| Mistake | Fix |
|---|---|
| Parallax drift moved the student and the desk/arms on different layers → arm came off the body; user also didn't want unrequested drift | Never split one character across moving layers; drift whole scenes or nothing |
| Flip-digit counter (scaleY squash) looked broken, ended blank | Plain number tween (365→90) |
| Torn calendar pages flew up past the panel edge and got chopped | Fall + fade inside the panel in ~0.3 s |
| GSAP `fromTo` renders its FROM state at build time → hidden dust-puff dots showed from frame 0 (stray green dot) | FROM state `autoAlpha: 0`, or drop the effect |
| GSAP `transformOrigin` on SVG `<g>` is bbox-relative → camera dolly landed wrong | Use `svgOrigin` for SVG groups/cameras |
| `random()` in tweens → non-deterministic render | Seeded jitter / fixed keyframes |

## Layout bugs
| Mistake | Fix |
|---|---|
| Road: badge covered "MOCK x/20", labels on road dashes and cut at the frame edge, unlit steps showed empty white boxes, doubled road shadow | Milestones on the road, badge beside the tile, labels on white pills shown only when lit, objects hidden until lit, one offset shadow |
| Calendar spiral rings covered the "3 MAHINE" title | Keep binding off text |
| Odd drop shadow around the 100% ring; small notebook floating over the head | Flat ring with a solid offset shadow; notebook BIG and BEHIND the head via a speaker cut-out |
| Big soft "light pool" circle behind the calendar = stray white blob | No decorative blobs behind panels |
| Hook: full-frame red flash, crack lines over the face, glitch bars across the whole frame | Edge-only red glow, no cracks, glitch bars only in the title band |

## Colour
- Background-removed cut-out (untagged VP9) was ~6–7 levels off in G/B → visible jump when the normal clip resumes. **Fix:** `scripts/matte.sh <ED> <start> <dur>` — alpha from the AI matte, RGB straight from `cut.mp4`, bt709 tags (~1–2 levels). Then `plan.mattes=[{file,start,dur}]`.

## Tooling gotchas
- **Anchor jitter in behind-the-head scenes (CUET 0843, 2026-10-06):** mattes starting mid-clip (16.9 s, 20.0 s…) don't sit on a frame boundary → the cut-out showed a neighbouring frame every 2–4 frames (face diff vs cut.mp4 jumped 2 → 6–13). The matte starting at 0 was clean. **Fix:** ONE full-length matte from 0 (`matte.sh <ED> 0 <cut duration>`), hide `#fg-wrap` during split panels (`tl.set("#fg-wrap",{autoAlpha:0},{S})` … `{E}`). Verify with a per-frame face-region diff of final vs cut.mp4 (signalstats YAVG) — alternating spikes = desync.
- Studio re-saves `hf*/index.html` with lower-cased SVG filter tags → build.py reports "Studio edits". Diff first (ignore case + `data-hf-id`); if only that, `--force`.
- Snapshot audit before showing: 6–10 frames per scene (entry · each beat · exit). Look for detached parts, edge clipping, text on busy art, empty placeholders, stray dots/blobs, colour seams. The user found every bug above because this step was skipped.
- Render: HyperFrames' auto low-memory profile (1 worker, screenshot capture) stalled at ~19 s on this heavy composition (SVG filters + 3 videos) — twice. `--no-low-memory-mode --workers 4` rendered it in ~2 m 15 s. finish.sh now retries that way automatically and reuses a master newer than index.html.

| Phone mockup was a dark rounded rectangle with a notch bar → "not an actual phone" (0857) | `common.py iphone()`: real iPhone 15 Pro frame, buttons, Dynamic Island, status bar, glare; zoom-check status icons |
