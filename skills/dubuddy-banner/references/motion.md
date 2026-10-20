# Motion

60fps master, about 25s, one seamless loop. The light export halves everything to 30fps.

## Beat timeline (frames at 60fps)

| Frames | Beat | Notes |
|---|---|---|
| 0–70 | Hook | Tight close-up on the centre character (camera scale 190). A smug brow raise and a chuckle. No text. |
| 70–126 | Pull back | The camera eases out to the full cast (zoom 80). |
| 140–470 | Problems | Labels land one every 32 frames in `pop_order` (random-feeling). Each character laughs **only when its own label lands**. The caption fades in at 134. |
| 470–500 | Read pause | Everything holds so people can read. |
| 500–556 | Aim | The hero object slides in, aims (pulsing gold ring) and draws back. Every character stops, the eyes snap to it, brows shoot up in fear, and they squash slightly. Labels dim to 22% and the caption fades out. |
| 556–576 | Release | A fast, straight, linear flight with a flame trail, hitting the centre face. |
| 576–616 | Burst | Rockets streak out and pop into firework flowers while the saffron disc floods the frame. Flowers must be **gone before** the headline (by T_A-6). |
| 618–768 | A | Headline lines rise in (second line +9 frames), hold, then exit. |
| 768–918 | B | Hook line; the marker wipes across the word at +26. |
| 918–1008 | C1 | The coupon pops in centred (overshoot to 160%, settles at 150%, tilt -8° → 0). |
| 1008–1158 | C2 | The coupon slides left and shrinks. "50% OFF" slides in from the right. The sale line rises and the date pill wipes. The code highlight sweeps (+50) and the code pulses (+76). |
| 1158–1430 | D | The cream wipe, the logo mark spins in (pop to 124% → 115%), the wordmark slides in, the 8 chips pop every 11 frames, then the sign-off and the beating heart. It holds for reading. |
| 1430–1520 | Outro | The offer shrinks to 72% and fades **behind** the cast while the characters rise from below (centre first, 7-frame stagger), landing exactly on frame 0. |

The loop works because the camera and cast reset at T_RESET (1410) while hidden behind the offer,
and the offer is drawn twice: once above the cast while it plays, then again underneath it from
T_OUT0, so the cast can rise in front of it. This replaced an iris wipe the user didn't like.

## Pacing the user asked for

- The first cut panned through 10 close-ups (5s), which was "not retentive". Use one short hook, then
  bring the problems in on the zoom-out.
- "A lot of things are happening fast": give the labels about 0.5s each, add a read pause before the
  action, and hold the offer frames long enough to read (each beat about 2.5s, the logo frame about 4.5s with
  8 features).

## Character acting

- **Idle (always on):** each head blinks on its own schedule, glances around (pupil darts),
  sways gently (period 152), swings its earrings (period 152), and twinkles its crown sparkle every 230 frames.
  **Every periodic motion uses a period that divides OP** (1520), so frame 0 equals the last frame.
- **Laugh** (`laugh_pose`, 66 frames): lean back over 10 frames, then three big chuckles with a
  ~14-frame cycle (mouth opens 50–100%, head bobs, moustache bounces, eyes squint to 62%, brows lift
  6 px), then a smug settle. The user called the first version (8-frame cycle) "jittery". Keep it slow
  and expressive, and never have everyone laugh at once.
- **Fear on aim:** pupils snap toward the threat, brows lift 9 px, a slight squash (96/104%), held
  until the hit.
- **Hit:** the centre head cracks (an overlay stroke) and shakes with decaying rotation. The others flinch
  (scale 88% → 100%).

## The hero object (arrow)

1.22x scale with a **white outline** (a fatter copy underneath) so it reads on cream. It slides in to
an aim spot in clear space (bottom-left, `AIM`) pointing at the target, with a pulsing gold ring at
the tip, then draws back 50 px. The release is linear and fast, with a gold trail and a soft orange flame
trail behind. On impact there's a white ring and a decaying wobble. The user had asked to "showcase the arrow".
It must be fully visible during the aim (not cropped by the frame edge).

## Eases (lottie_kit.EASE)

`entrance` for fast in and soft land, `settle` for deep ease-out (most landings), `pop` for
overshoot entries, `travel` for camera and state-to-state moves, `exit` for accelerating exits, `sine` for
loops and oscillation, `linear` for baked or mechanical motion. Overshoot is done with a settle-back keyframe
(for example 0 → 112 → 100).
