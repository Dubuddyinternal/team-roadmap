# Design system

Everything here was chosen or corrected by the user during the Dussehra build. Keep it consistent
across campaigns so the banners read as one brand.

## Canvas

- Lay out in a **1000x444 band** (all positions in this file use band coordinates).
- **App:** a 1000x640 canvas with the band at y=98. Backgrounds (cream, saffron, the cream wipe) extend over
  the whole canvas. The **top** edge gets the misty fade; the bottom stays solid because the app's white
  rounded "CUET 2026 PREP" card overlaps it, and a fade there showed as a whitish band.
- **Website:** a 1000x360 strip with the band scaled to 0.8 and centred (x 100, y ≈ 2). Fills and the fairy
  lights must run the full width, so the fairy-light wire is drawn from x -260 to 1260 and the
  saffron disc and cream wipe grow to 1600. No edge fade.
- Both variants are produced by one build: a root null (`band offset`) moves and scales the band, in
  the main comp and inside the offer precomp.

## Edge treatment (app top edge)

The user rejected hard edges, then rejected a straight-line gradient fade ("should not feel like
ending in a straight line"). What worked: a linear white fade (eased opacity stops
1 → .75 → .3 → .08 → 0 over 80 px) plus a row of 12 radial-gradient white "mist" puffs of varied size
(r 48–92, scaled 150% horizontally), sitting 12–40 px from the edge and drifting slowly sideways
(period 380, which divides the loop). Keep the mist high so it doesn't veil content (lights, crowns).

## Palette

| Role | Hex |
|---|---|
| Cream background | `FBF1E6` |
| Ink (text, pills, outlines) | `15131C` |
| DuBuddy orange / saffron field | `F26522` |
| Deep orange (eyebrows, accents) | `D9531A` |
| Muted text | `6B6573` |
| Gold (marker, highlights, crowns) | `FFC233`, `F5A300`, `D98200` |
| Light orange | `FF9A52` |
| Teal (burst accent only) | `2B6F77` |
| Red (gems, anar) | `C41D2E` |
| Cream white | `FFFDF8` |

On saffron, the burst residue must stay warm: teal and red shapes faded to muddy brown, so only
warm colours remain.

## Type

- **Plus Jakarta Sans ExtraBold:** headlines, labels, chips, captions, "50% OFF", the sale line.
- **Plus Jakarta Sans Bold:** the wordmark "DuBuddy", secondary lines ("by DU students").
- **DM Mono Medium:** the coupon code, "USE CODE", the coupon stub text, validity, the kicker.
- All text is vector glyphs (`glyphs(font, text, size, colour, x, baseline_y, j=0|1|2, tracking)`).
  `j=2` centres on x.
- **Measure, don't guess.** Use `Font.width()` and `Font.cap` to centre runs, size pills and
  balance margins. The user caught a sale line that was off-centre by 72 px and a block 13 px off the coupon's centre
  line. Centre mixed-colour lines as one unit (for example the marker plus " in CUET").
- Grammar matters: the user had "questions that repeat" fixed from "repeats". Proofread copy; flag
  grammar politely once, then follow the user's call.

## Logo

The DuBuddy mark is traced from the real logo (`assets/dubuddy_mark.json`: ink and orange
polygons, 100 units tall, Chaikin-smoothed at build time). Never hand-draw it: the user called a
hand-drawn version "wrong". The wordmark is "Du" in ink and "Buddy" in orange, Plus Jakarta Sans Bold at 66 px,
next to the mark (mark at x 341, wordmark from x 414, centre y 196). The logo's tagline is left out
by default. Orange "Buddy" disappears on saffron, so the logo frame uses the cream background.

## Components

**Problem label (zoom-out):** a dark pill, an orange circle with a white ✕, ExtraBold text 13–18 px,
each with its own size and a slight tilt (-4…4°), **scattered** loosely in the free space around the cast (not
in columns; the user asked for "more dispersed"). Each pops in with an overshoot.

**Connector lines:** dashed ink lines from the label's centre to the **centre of its face**, drawn
**behind the faces** (layer order: connectors under the heads). The user rejected lines ending on
the crowns.

**Caption under the cast:** "**10 problems** every CUET aspirant faces", 24 px, orange plus ink, centred
at y 384.

**Beat A, headline:** two centred lines at 78 px (white, then ink) at baselines 223 and 315.

**Beat B, hook line:** line 1 white at 60 px; line 2 is a gold marker pill (14 px padding, 74 px tall)
behind the highlighted word in ink, followed by the rest in white. The marker wipes in from the left.

**Coupon ticket (C1/C2):** a white 420x160 rounded ticket with notch circles in the background colour, a dashed
divider, a vertical stub text (the festival name, DM Mono), "USE CODE" (15 px), the code (DM Mono 56 px) and a
gold highlight that wipes across the code. C1: centred, scale 150%, with "VALID …" on the ticket.
C2: slides left (to 315, 201, scale 128%) while "50%" (132 px white) and "OFF" (64 px ink) come in on the
right. The pair is centred as a group (46 px margins, 60 px gap) and shares one centre line.

**Sale line (C2):** "DUSSEHRA SALE" white plus a gold date pill with ink dates, 42 px, centred as one
unit at baseline 390. The dates are the highlighted part.

**Beat D, logo frame:** a cream circular wipe, the logo centred, 8 feature chips scattered around it
(4 rows, one chip each side, alternating tilts, chips clamped inside the frame), and the sign-off
"Made with love ♥ / by DU students" at the bottom centre. The heart is orange and beats.

## Festive decoration (saffron frames)

Keep it light and at the edges ("not that much but some"):
- **Fairy lights:** a scalloped wire across the top, with bulbs in 4 colour variants twinkling in 4 phase groups.
- **Two small corner firework bursts** (r 26–30) that bloom and fade on a 190-frame cycle.
- **Anar (fountain cracker):** bottom-left, sparks flickering in 3 phase groups.
- **A few twinkling 4-point sparkles.**

Text must never sit under decoration: content is centred around y 240, below the lights.

## The cast (reference: Ravan)

A flat vector style like the user's references: warm skin, a tiered gold crown with red gems, a tilak,
kohl-lined eyes with highlights, angry brows, a big curled moustache, side hair and hoop earrings. The
centre head is biggest; the side heads shrink and overlap in an arc (`HEADS`). Static artwork is one shared
precomp (`head_static_shapes`), and moving parts are per head (`head_anim_shapes`).
