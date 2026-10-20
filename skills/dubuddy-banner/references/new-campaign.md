# Re-theming for a new campaign

The story stays the same: **problems personified → they mock the student → a hero object
defeats them → festive offer → logo + features → loop.** Only the theme changes.

## 1. Copy and offer: edit `CAMPAIGN` (always)

`slug`, `problems` (10), `caption`, `pop_order`, `headline`, `hook` (line 1, highlighted word, rest),
`code`, `code_label`, `coupon_side`, `valid`, `discount`, `sale_line`, `features`, `signoff`.
Keep strings about as long as the reference, or re-check widths: headline lines ≤ ~800 px at 78 px,
hook line 1 ≤ ~800 px at 60 px, chips clamp themselves inside the frame, and label sizes are 13–18 px.
If a line is too long, reduce the size and keep it centred; don't let it touch the edges.

## 2. Cast and hero object: swap per festival

The cast is built from three functions; keep their structure (static art in the shared precomp,
moving parts on the per-head layer, motion on the null chain):
- `head_static_shapes()`: artwork that never moves (face, hair, headwear). Draw in head-local
  units, about 170 wide and 270 tall, centred on (0, 0), with the face centre near (0, 8).
- `head_anim_shapes(tracks)`: the parts that act (pupils, lids, brows, mouth, moustache, accessories),
  driven by `head_tracks()`. Keep the same track names so the laugh, fear and hit acting carry over.
- `arrow_body()`: the hero object, pointing right with its tip at (0, 0).

Ideas that fit the same story (confirm with the user first; show mocks):

| Occasion | Cast (the problems) | Hero object | Decoration |
|---|---|---|---|
| Dussehra (reference) | Ravan's 10 heads | Ram's arrow | Fairy lights, fireworks, anar |
| Diwali | Narakasura heads, or dark clouds dimming 10 diyas | A rocket cracker / a diya flame lighting them | Diyas, rangoli corners, lanterns |
| Holi | Grey "boring prep" faces | A colour balloon / pichkari splash | Gulal clouds, colour splats |
| New Year | Gremlins of last year's mistakes | A countdown rocket | Confetti, sparklers |
| Independence Day | Obstacles as walls/knots | A kite cutting the strings | Tricolour bunting |
| Exam season / launch | Monster versions of the problems | DuBuddy app phone / pencil arrow | Light, product-led |

Use the user's reference images when they share them; they steer the look a lot.

## 3. Decoration: swap per festival

The `festive decor` layer (lights, corner fireworks, anar, sparkles) and the `cracker burst` are
Diwali/Dussehra-specific. Replace them with the festival's equivalents, keeping the rules: few
elements, at the edges, phase-grouped twinkles, nothing under text, and burst elements gone before beat A.

## 4. Colours

The DuBuddy core (cream, ink, orange, gold) stays. A festival can bring one accent family (for example
Holi pinks or tricolour greens) for the decoration and burst, but keep text colours from the core
palette and keep the saffron/cream contrast rules.

## 5. What must not change

- Both variants (app 1000x640 with the top mist, website 1000x360 strip) from one build.
- Plain-Lottie delivery (no slots, text layers, images or expressions), the 30fps light export, and the checks.
- The seamless loop (periods divide OP, the cast lands on frame 0).
- Discuss and mock first, then build; review frames yourself before showing the user.
