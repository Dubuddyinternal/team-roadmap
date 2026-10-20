"""DuBuddy campaign banner (Lottie) - template build. Reference campaign: Dussehra 2026 sale.

Run (from the project folder that holds this file, lottie_kit.py, the fonts/ folder and dubuddy_mark.json):
    python3 build_banner.py                    # app variant      -> out/<slug>-app.json      (1000x640)
    VARIANT=website python3 build_banner.py    # website variant  -> out/<slug>-website.json  (1000x360)
Then make the light mobile files with export_light.py (30fps). Output is plain Lottie: shapes only, no slots,
no text layers (all copy is vector glyphs), no images, no expressions.

Story (60fps frame numbers):
  hook: close-up on the hero character (0-70) -> pull back to the full cast (70-126) ->
  problems pop in at random, each character laughs as its label lands (140-470) -> the hero
  object aims while the cast freezes in fear (500-556) -> it flies and hits the centre (556-576) ->
  cracker burst floods the frame (576-616) -> offer beats A headline, B hook line, C1 coupon,
  C2 coupon + discount, D logo + features (616-1430) -> the offer shrinks back while the cast
  rises in from below, landing exactly on frame 0 (1430-1520).

To make a new campaign: edit CAMPAIGN below first. Swapping the character (Ravan heads) or the
hero object (arrow) means replacing head_static_shapes / head_anim_shapes / arrow_body - see
references/new-campaign.md in the dubuddy-banner skill.
"""
import json, math, os
from lottie_kit import (hx, Font, anim, static, prop, ks, Layers, fill, stroke, tr, group, rect,
                        ellipse, path, circle_path, svg_paths, glyphs, inline_slots)

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "fonts")

# ==== CAMPAIGN: everything a new festival / sale usually changes ====================================
CAMPAIGN = {
    "slug": "dussehra-ravan",                    # output file prefix
    # the 10 problems shown on the cast (left to right) and the line under them
    "problems": ["Confusion", "Poor Strategy", "Bad Resources", "Lack of Practice", "Mock Fear",
                 "Doubt Pileup", "No Consistency", "Wasted Time", "Self-Doubt", "Uncertainty"],
    "caption": ("10 problems", " every CUET aspirant faces"),      # (orange part, ink part)
    "pop_order": [4, 8, 1, 6, 2, 9, 0, 5, 7, 3],                   # random-feeling label order
    # beat A: big headline, two centred lines (white, ink)
    "headline": ("Defeat the problems", "in your CUET journey"),
    # beat B: line 1, then line 2 = highlighted word + rest
    "hook": ("Practice questions that", "repeat", " in CUET"),
    # beats C1/C2: the coupon
    "code": "VIJAY50", "code_label": "USE CODE",
    "coupon_side": "DUSSEHRA",                   # vertical text on the ticket stub
    "valid": "VALID 20–25 OCTOBER",              # shown on the ticket in C1
    "discount": ("50%", "OFF"),
    "sale_line": ("DUSSEHRA SALE", "20–25 OCT"),  # (white text, highlighted date pill)
    # beat D: features scattered around the logo: (x, y, [(text, size, colour-name)...], tilt)
    "features": [
        (190, 62, [("Every single CUET PYQ", 22, "white"), ("only on DuBuddy", 17, "gold")], -3),
        (740, 52, [("Chapter-wise question papers", 20, "white")], 3),
        (140, 196, [("Best CUET practice", 21, "white")], 3),
        (868, 196, [("NTA interface", 22, "white")], -3),
        (170, 308, [("Full-length mocks", 22, "white")], -2),
        (816, 308, [("Weak and strong area analysis", 18, "white")], 2),
        (136, 400, [("No clickbait", 22, "white")], 3),
        (864, 400, [("Doubt solving", 22, "white")], -3),
    ],
    "signoff": ("Made with love", "by DU students"),   # a beating heart follows line 1
}
# =====================================================================================================

VARIANT = os.environ.get("VARIANT", "app")       # "app": 1000x640, misty top edge | "website": 1000x360 wide strip
OUT_DIR = os.path.join(HERE, "out", VARIANT)
os.makedirs(OUT_DIR, exist_ok=True)
W, H, FR, OP = 1000, 444, 60, 1520
# The banner is laid out in a 1000x444 band, placed in a taller canvas with white space above and
# below; backgrounds extend into that space so the app shows no hard edges.
if VARIANT == "website":
    # website: same width, short and wide; the 1000x444 band is scaled down and centred, and the
    # backgrounds, lights and close-ups run the full width. No misty edge: the site shows it in a rounded card.
    CANVAS_H, BAND_S, EDGE_FADE = 360, 0.8, 0
else:
    CANVAS_H, BAND_S, EDGE_FADE = 640, 1.0, 80
BAND_X = (1000 - 1000 * BAND_S) / 2
BAND_Y = 98 if VARIANT == "app" else (CANVAS_H - 444 * BAND_S) / 2
# Only the top edge fades: in the app a white rounded card overlaps the bottom of the banner, so the
# background runs solid to the bottom edge and fills in behind the card's corners.

PROBLEMS = CAMPAIGN["problems"]
CAPTION_A, CAPTION_B = CAMPAIGN["caption"]
POP_ORDER = CAMPAIGN["pop_order"]
CODE_LABEL, CODE = CAMPAIGN["code_label"], CAMPAIGN["code"]

# ---- palette (Dubuddy + Ravan) --------------------------------------------------
BG, INK, OR, DOR = hx("FBF1E6"), hx("15131C"), hx("F26522"), hx("D9531A")
MUTE, WHITE, CREAM = hx("6B6573"), hx("FFFFFF"), hx("FFFDF8")
G1, G2, G3 = hx("FFC233"), hx("F5A300"), hx("D98200")
SK, SK2, SK3 = hx("F6AE6A"), hx("E8904A"), hx("D2763A")
RED, HAIR, MUS, MUS2 = hx("C41D2E"), hx("2A1810"), hx("3B2215"), hx("5C3A26")
IRIS, LIPS, MOUTH, TONGUE = hx("5A2E14"), hx("9C3A2A"), hx("7A1F1A"), hx("E0605A")
TEAL, LIGHT_OR = hx("2B6F77"), hx("FF9A52")

PJX = Font(os.path.join(FONT_DIR, "PlusJakartaSans-ExtraBold.ttf"))
PJB = Font(os.path.join(FONT_DIR, "PlusJakartaSans-Bold.ttf"))
MONO = Font(os.path.join(FONT_DIR, "DMMono-Medium.ttf"))

L = Layers(OP)

# ---- head placement (world space, like the reference arc) ------------------------
C = 4
HEADS = []
for i in range(10):
    d = i - C; k = abs(d)
    s = 1 if d == 0 else 0.84 ** k * 0.92
    x = 500
    for j in range(1, k + 1):
        x += math.copysign(96 * 0.86 ** (j - 1), d)
    HEADS.append({"i": i, "k": k, "x": x, "y": 262 + k * 6, "s": s * 0.95})

CLOSE = {"a": [500, 252], "p": [500, 236], "s": 190}                # opening hook: tight on the centre face
ZOOM = {"a": [500, 262], "p": [500, 246], "s": 80}
def zoom_screen(x, y):
    z = ZOOM["s"] / 100
    return ZOOM["p"][0] + (x - ZOOM["a"][0]) * z, ZOOM["p"][1] + (y - ZOOM["a"][1]) * z

T_ZOOM0, T_ZOOM1 = 70, 126
T_POP0, T_POP_STEP = 140, 32     # first label, gap between labels
T_AIM, T_ARROW0, T_HIT = 500, 556, 576
T_OFFER = 616                    # burst has filled the frame with saffron
T_A, T_B, T_C1, T_C2, T_D = 618, 768, 918, 1008, 1158   # headline, repeat line, coupon, coupon + 50% off, logo frame
T_OUT0 = 1430                    # offer recedes, heads rise back in
T_RESET = T_OUT0 - 20            # hidden behind the offer: camera to frame 0, heads parked below frame
HEAD_DROP = 330                  # how far below their spot the heads wait (world units)

# ---- keyframe helpers -------------------------------------------------------------
class Track:
    """Collects keys for one property; later keys at the same time win."""
    def __init__(self, rest): self.rest, self.k = rest, {}
    def key(self, t, v, e="sine"): self.k[round(t, 3)] = (v, e)
    def build(self):
        if not self.k: return static(self.rest)
        return anim(*[(t, v, e) for t, (v, e) in sorted(self.k.items())])

def sine_keys(track, period, amp, phase, base=0, dims=None):
    """Sine-like oscillation as eased extremes; whole cycles over OP keep the loop seamless."""
    half = period / 2
    t = phase - period
    sgn = 1
    while t <= OP + period:
        v = base + sgn * amp
        track.key(t, [v] if dims is None else [base[0], base[1] + sgn * amp], "sine")
        t += half; sgn = -sgn

# ---- face parts (local units; drawn bottom -> top, reversed for Lottie) -------------
def part(nm, d, col, o=100):
    return group(nm, svg_paths(d) + [fill(col, o=o)])

def lines(nm, d, col, w):
    shapes = svg_paths(d)
    for s in shapes: s["ks"]["k"]["c"] = False
    return group(nm, shapes + [stroke(col, w)])

HEAD_PC_W, HEAD_PC_H, HEAD_PC_OX, HEAD_PC_OY = 300, 320, 150, 200   # static artwork precomp; origin offset keeps it in-bounds

def head_static_shapes():
    """Artwork that never moves relative to the head: drawn once, shared by all 10 heads."""
    crown_gems = []
    for k, c in enumerate([-54, -36, -18, 0, 18, 36, 54]):
        crown_gems.append(group("gem", [ellipse(c, -46, 8 if k % 2 else 11), fill(CREAM if k % 2 else RED)]))
    teeth = "".join(f"M{c} -30 L{c + 8} -30 L{c + 4} -22Z " for c in (-60, -44, -28, -12, 4, 20, 36, 52))
    bottom_to_top = [
        part("hair", "M-70 -30 C-92 10 -88 70 -62 96 L-50 60 C-58 30 -58 0 -50 -20Z M70 -30 C92 10 88 70 62 96 L50 60 C58 30 58 0 50 -20Z", HAIR),
        group("ears", [ellipse(-60, 14, 24, 36), ellipse(60, 14, 24, 36), fill(SK2)]),
        part("face", "M0 -42 C38 -42 58 -20 58 14 C58 56 34 84 0 88 C-34 84 -58 56 -58 14 C-58 -20 -38 -42 0 -42Z", SK),
        part("shade", "M30 -36 C52 -20 60 20 50 54 C40 76 22 86 0 88 C30 76 44 40 40 6 C38 -14 34 -28 30 -36Z", SK2, 70),
        group("cheeks", [ellipse(-30, 38, 24, 14), ellipse(30, 38, 24, 14), fill(OR, o=35)]),
        part("tilak", "M-7 -40 L-9 -6 L-4 -6 L-2 -40Z M7 -40 L9 -6 L4 -6 L2 -40Z", CREAM),
        lines("tilak red", "M0 -40 L0 -8", RED, 4),
        group("bindi", [ellipse(0, -2, 7), fill(RED)]),
        part("eye whites", "M-42 8 C-34 -2 -18 -2 -10 8 C-18 16 -34 16 -42 8Z M42 8 C34 -2 18 -2 10 8 C18 16 34 16 42 8Z", CREAM),
        part("nose", "M-4 10 C-6 22 -10 30 -10 36 C-6 40 6 40 10 36 C10 30 6 22 4 10Z", SK2),
        lines("nostrils", "M-8 36 C-4 39 4 39 8 36", SK3, 2.5),
        part("crown", "M-66 -38 L-66 -92 L-50 -78 L-44 -116 L-26 -96 L-14 -138 L0 -112 L14 -138 L26 -96 L44 -116 L50 -78 L66 -92 L66 -38Z", G1),
        part("crown upper", "M-44 -116 L-26 -96 L-14 -138 L0 -112 L14 -138 L26 -96 L44 -116 L40 -86 L-40 -86Z", G2),
        part("spire", "M0 -112 L-10 -150 L0 -176 L10 -150Z", G1),
        group("spire gem", [ellipse(0, -150, 12), fill(RED)]),
        group("finial", [ellipse(0, -176, 10), fill(G2)]),
        group("crown gems", [ellipse(-14, -138, 8), ellipse(14, -138, 8), ellipse(-44, -116, 8), ellipse(44, -116, 8), fill(RED)]),
        part("plate", "M-24 -96 C-16 -110 16 -110 24 -96 C16 -84 -16 -84 -24 -96Z", G3),
        group("centre gem", [ellipse(0, -97, 18, 14), fill(RED)]),
        group("gem glint", [ellipse(-2, -99, 6, 4), fill(WHITE, o=60)]),
        group("band", [rect(0, -46, 136, 20, 4), fill(G2)]),
        group("band gems", crown_gems[::-1]),
        part("trim", "M-68 -36 L68 -36 L64 -30 L-64 -30Z", G3),
        part("teeth", teeth, G2),
        part("flaps", "M-66 -92 L-82 -60 L-66 -56Z M66 -92 L82 -60 L66 -56Z", G2),
    ]
    return [group("head art", bottom_to_top[::-1], p=(HEAD_PC_OX, HEAD_PC_OY))]

def head_anim_shapes(tracks):
    """Per-head moving parts, drawn above the shared artwork."""
    ear = lambda sx: group("earring", [
        group("drop", [ellipse(sx * 62, 44, 8), fill(RED)]),
        group("ring", [ellipse(sx * 62, 34, 16), stroke(G2, 4)]),
    ], a=(sx * 62, 26), p=(sx * 62, 26), r=tracks[f"ear{sx}"].build())
    bottom_to_top = [
        group("pupils", [
            group("glints", [ellipse(-22, 6, 3.2), ellipse(26, 6, 3.2), fill(WHITE)]),
            group("pupil", [ellipse(-24, 8, 6.4), ellipse(24, 8, 6.4), fill(INK)]),
            group("iris", [ellipse(-24, 8, 13), ellipse(24, 8, 13), fill(IRIS)]),
        ], p=tracks["pupils"].build()),
        group("lids", [
            lines("lash", "M-44 8 C-34 15 -16 15 -8 8 M44 8 C34 15 16 15 8 8", INK, 3),
            part("lid", "M-45 8 C-34 -5 -16 -5 -7 8 C-16 16 -34 16 -45 8Z M45 8 C34 -5 16 -5 7 8 C16 16 34 16 45 8Z", SK),
        ], a=(0, -2), p=(0, -2), s=tracks["lids"].build()),
        lines("liner", "M-44 8 C-34 -4 -16 -4 -8 8 M44 8 C34 -4 16 -4 8 8", INK, 3),
        group("brows", [part("brow", "M-46 -12 C-36 -22 -20 -18 -10 -6 L-14 -2 C-24 -12 -36 -12 -44 -6Z M46 -12 C36 -22 20 -18 10 -6 L14 -2 C24 -12 36 -12 44 -6Z", HAIR)],
              p=tracks["brows"].build()),
        part("lips", "M-12 62 C-6 58 6 58 12 62 C6 68 -6 68 -12 62Z", LIPS),
        group("laugh mouth", [
            group("tongue", [ellipse(0, 72, 14, 8), fill(TONGUE)]),
            part("teeth", "M-14 58 L14 58 L12 63 L-12 63Z", CREAM),
            part("mouth", "M-18 58 C-10 56 10 56 18 58 C14 80 -14 80 -18 58Z", MOUTH),
        ], a=(0, 58), p=(0, 58), s=tracks["mouth"].build()),
        group("moustache", [
            lines("strands", "M-6 50 C-20 46 -34 50 -44 58 M6 50 C20 46 34 50 44 58", MUS2, 2.5),
            part("moustache", "M0 46 C-12 40 -30 42 -42 52 C-52 60 -66 58 -70 46 C-74 54 -70 66 -60 70 C-70 68 -76 62 -78 54 C-80 70 -62 80 -44 70 C-30 62 -16 56 0 54 C16 56 30 62 44 70 C62 80 80 70 78 54 C76 62 70 68 60 70 C70 66 74 54 70 46 C66 58 52 60 42 52 C30 42 12 40 0 46Z", MUS),
        ], a=(0, 50), p=tracks["mus_p"].build(), r=tracks["mus_r"].build()),
        group("twinkle", [part("star", "M6 -112 L8 -104 L16 -102 L8 -100 L6 -92 L4 -100 L-4 -102 L4 -104Z", WHITE)],
              a=(6, -102), p=(6, -102), s=tracks["twinkle"].build()),
        ear(-1), ear(1),
        group("crack", [lines("crack", "M-8 -36 L8 0 L-6 18 L10 70", BG, 6)], o=tracks["crack"].build()),
    ]
    return bottom_to_top[::-1]

# ---- per-head motion -------------------------------------------------------------------
def pop_time(i): return T_POP0 + POP_ORDER.index(i) * T_POP_STEP

def laugh_windows(i):
    """Each head laughs once, when its own label lands; the centre head also opens the hook."""
    w = [(pop_time(i) + 2, LAUGH_LEN)]
    if i == C: w.insert(0, (6, LAUGH_LEN))
    return w

LAUGH_LEN = 66

def laugh_pose(f):
    """Slow, expressive cackle: lean back, three big chuckles, then a smug settle. f = frames in."""
    def ease(x): x = max(0, min(1, x)); return x * x * (3 - 2 * x)
    lean = ease(f / 10) * (1 - ease((f - 54) / 12))           # 0..1 envelope
    ph = max(0, f - 8) / 14 * 2 * math.pi                     # ~14-frame chuckle cycle
    a = abs(math.sin(ph)) if 8 <= f <= 54 else 0
    return {
        "laugh_p": [0, 40 - (4 * lean + 5 * a * lean)],
        "laugh_r": [-5 * lean + 2.2 * math.sin(ph) * lean],
        "mouth": [100, round(100 * lean * (0.5 + 0.5 * a), 1)],
        "mus_p": [0, 50 - 4 * a * lean],
        "mus_r": [2.5 * math.sin(ph) * lean],
        "lids": [100, 62 * lean],
        "brows": [0, -6 * lean],
    }

def head_tracks(h):
    i = h["i"]
    t = {n: Track(r) for n, r in {
        "sway": [0], "laugh_p": [0, 40], "laugh_r": [0], "laugh_s": [100, 100], "lids": [100, 0],
        "pupils": [0, 0], "brows": [0, 0], "mouth": [100, 0], "mus_p": [0, 50], "mus_r": [0],
        "ear-1": [0], "ear1": [0], "twinkle": [0, 0], "crack": [0]}.items()}
    sine_keys(t["sway"], 152, 1.8 + 0.3 * (i % 3), (i * 17) % 152)
    sine_keys(t["ear-1"], 152, 8, (i * 11) % 152)
    sine_keys(t["ear1"], 152, 8, (i * 11 + 30) % 152)

    wins = laugh_windows(i)
    busy = lambda a, b: any(a < s + d + 6 and b > s - 6 for s, d in wins) or (T_AIM - 10 < b and a < T_RESET)

    for s0, dur in wins:
        for key in ("laugh_p", "laugh_r", "mouth", "mus_p", "mus_r", "lids", "brows"):
            t[key].key(s0 - 1, t[key].rest, "sine")
        for f in range(0, dur + 1, 2):
            for key, v in laugh_pose(f).items():
                t[key].key(s0 + f, v, "linear")
        for key in ("laugh_p", "laugh_r", "mouth", "mus_p", "mus_r", "lids", "brows"):
            t[key].key(s0 + dur + 2, t[key].rest, "sine")

    # blinks, staggered per head, never during a laugh or the arrow
    b = 30 + (i * 37) % 110
    while b < OP - 20:
        if not busy(b - 2, b + 10):
            t["lids"].key(b - 1, [100, 0], "sine"); t["lids"].key(b + 3, [100, 100], "sine")
            t["lids"].key(b + 4, [100, 100], "sine"); t["lids"].key(b + 9, [100, 0], "sine")
        b += 140 + (i * 29) % 50

    # eyes dart around between laughs
    seq = [-4, 0, 4, 0] if i % 2 else [4, 0, -4, 0]
    d0, j = 50 + (i * 23) % 50, 0
    while d0 < T_AIM - 30:
        if not busy(d0, d0 + 8):
            t["pupils"].key(d0, [seq[(j - 1) % 4] if j else 0, 0], "settle")
            t["pupils"].key(d0 + 6, [seq[j % 4], 0], "settle")
            j += 1
        d0 += 80 + (i * 13) % 40

    # the arrow appears: every head stops, eyes snap wide to the arrow, brows shoot up in fear
    react = T_AIM + 4 + h["k"] * 2
    t["pupils"].key(react - 6, [0, 0], "settle"); t["pupils"].key(react, [-6, 1], "settle")
    t["pupils"].key(T_HIT, [-6, 1], "hold"); t["pupils"].key(T_HIT + 1, [0, 0], "hold")
    t["brows"].key(react - 6, [0, 0], "settle"); t["brows"].key(react + 4, [0, -9], "settle")
    t["brows"].key(T_HIT + 30, [0, -9], "sine"); t["brows"].key(T_RESET, [0, 0], "hold")
    t["laugh_s"].key(react - 4, [100, 100], "settle"); t["laugh_s"].key(react + 4, [96, 104], "settle")
    t["laugh_s"].key(T_HIT, [96, 104], "sine")

    # crown twinkle
    tw = 20 + (i * 41) % 220
    while tw < OP - 20:
        if not (T_AIM < tw < T_RESET):
            t["twinkle"].key(tw, [0, 0], "settle"); t["twinkle"].key(tw + 7, [100, 100], "settle")
            t["twinkle"].key(tw + 16, [0, 0], "settle")
        tw += 230

    # the hit: centre head cracks and shakes, the others flinch
    if i == C:
        t["crack"].key(T_HIT, [0], "hold"); t["crack"].key(T_HIT + 1, [100], "hold"); t["crack"].key(T_RESET, [0], "hold")
        for f in range(T_HIT, T_HIT + 22, 2):
            t["laugh_r"].key(f, [6 * math.sin((f - T_HIT) * 1.4) * (1 - (f - T_HIT) / 22)], "linear")
        t["laugh_r"].key(T_HIT + 22, [0], "sine")
        t["laugh_s"].key(T_HIT + 1, [100, 100], "sine")
    else:
        t["laugh_s"].key(T_HIT + 2, [96, 104], "sine")
        t["laugh_s"].key(T_HIT + 8, [88, 88], "settle")
        t["laugh_s"].key(T_HIT + 22, [100, 100], "sine")
    return t

# ---- callout card (problem label) ------------------------------------------------------
def card_items(cx, cy, text, sz, pointer):
    h = sz * 2.2; ic = h * 0.6
    w = PJX.width(text, sz) + ic + sz * 2.0
    x0 = cx - w / 2; icx = x0 + sz * 0.45 + ic / 2
    tip = None if pointer is None else {"up": [[cx - 9, cy - h / 2 + 1], [cx, cy - h / 2 - 10], [cx + 9, cy - h / 2 + 1]],
           "down": [[cx - 9, cy + h / 2 - 1], [cx, cy + h / 2 + 10], [cx + 9, cy + h / 2 - 1]],
           "right": [[cx + w / 2 - 1, cy - 7], [cx + w / 2 + 9, cy], [cx + w / 2 - 1, cy + 7]],
           "left": [[cx - w / 2 + 1, cy - 7], [cx - w / 2 - 9, cy], [cx - w / 2 + 1, cy + 7]]}[pointer]
    q = ic * 0.18
    items = [
        glyphs(PJX, text, sz, WHITE, icx + ic / 2 + sz * 0.5, cy + PJX.cap * sz / 2),
        group("x", [path([[icx - q, cy - q], [icx + q, cy + q]], closed=False),
                    path([[icx + q, cy - q], [icx - q, cy + q]], closed=False), stroke(WHITE, sz * 0.14)]),
        group("icon", [ellipse(icx, cy, ic), fill(OR)]),
        group("pill", [rect(cx, cy, w, h, h / 2), fill(INK)]),
    ] + ([group("pointer", [path(tip), fill(INK)])] if tip else [])
    return items, w

layers = []

PL = Layers(OP)
offer_layers = []
BURST_C = [500, 252]
CY = 240                           # visual centre of the offer frames (lights take the top edge)

def rise_in(t0, dy=22, dur=24):
    return dict(o=anim((t0, 0, "settle"), (t0 + 12, 100, "settle")),
                p=anim((t0, [0, dy], "settle"), (t0 + dur, [0, 0], "settle")))

def beat_out(t_out, keys_o, keys_p=None):
    """Appends a quick fade-and-lift exit to existing opacity (and position) keys."""
    keys_o += [(t_out, 100, "exit"), (t_out + 14, 0, "hold")]
    if keys_p is not None:
        keys_p += [(t_out, [0, 0], "exit"), (t_out + 14, [0, -14], "hold")]

def text_layer_beat(nm, items, t_in, t_out, dy=22):
    o = [(t_in, 0, "settle"), (t_in + 12, 100, "settle")]
    p = [(t_in, [0, dy], "settle"), (t_in + 24, [0, 0], "settle")]
    beat_out(t_out, o, p)
    return PL.layer(nm, 4, shapes=items, ks=ks(o=anim(*o), p=anim(*p)))

# -- D: cream frame with the traced DuBuddy logo (drawn first = on top) ----------------------
def chaikin(pts, n=2):
    for _ in range(n):
        new = []
        for k in range(len(pts)):
            p, q = pts[k], pts[(k + 1) % len(pts)]
            new += [[0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]]
        pts = new
    return pts

MARK = json.load(open(os.path.join(HERE, "dubuddy_mark.json")))
def mark_shapes():
    out = []
    for col, key in ((OR, "orange"), (INK, "ink")):
        shp = []
        for d in MARK[key]:
            pts = [[float(a) for a in p.split()] for p in d.strip("MZ").split(" L")]
            shp.append(path([[round(x, 2), round(y, 2)] for x, y in chaikin(pts)]))
        out.append(group(key, shp + [fill(col)]))
    return out

dm, dn = T_D, T_OUT0
MARK_X, LOGO_Y, WORD_X = 341, 196, 414
heart = "M0 8 C-2 4 -8 -2 -12 -2 C-17 -2 -20 2 -20 7 C-20 14 -10 20 0 27 C10 20 20 14 20 7 C20 2 17 -2 12 -2 C8 -2 2 4 0 8Z"
LOVE_Y = 362
love_w = PJX.width(CAMPAIGN["signoff"][0], 30)
love_x0 = 500 - (love_w + 10 + 34) / 2
beat = [(dm + 148, [0, 0], "pop"), (dm + 160, [118, 118], "settle"), (dm + 172, [100, 100], "settle")]
t = dm + 198
while t < dn - 30:
    beat += [(t, [100, 100], "sine"), (t + 8, [116, 116], "sine"), (t + 16, [100, 100], "sine"), (t + 22, [110, 110], "sine"), (t + 32, [100, 100], "sine")]
    t += 70
offer_layers.append(PL.layer("D made with love", 4, shapes=[
    group("heart", svg_paths(heart) + [fill(OR)], a=(0, 12), p=(love_x0 + love_w + 10 + 17, LOVE_Y - 12), s=anim(*beat)),
    glyphs(PJX, CAMPAIGN["signoff"][0], 30, INK, love_x0, LOVE_Y),
    glyphs(PJB, CAMPAIGN["signoff"][1], 22, MUTE, 500, LOVE_Y + 36, j=2),
], ks=ks(**rise_in(dm + 140, 16))))

def chip(cx, cy, lines, tilt, t0, nm):
    """Dark pill; lines = [(text, size, colour)]."""
    ws = [PJX.width(tx, s) for tx, s, _ in lines]
    s0 = lines[0][1]
    w = max(ws) + s0 * 2.2
    h = s0 * 2.2 if len(lines) == 1 else lines[0][1] * 1.4 + lines[1][1] * 1.4 + s0 * 0.9
    items = []
    if len(lines) == 1:
        items.append(glyphs(PJX, lines[0][0], s0, lines[0][2], 0, PJX.cap * s0 / 2, j=2))
    else:
        top = -h / 2 + s0 * 0.45
        y1 = top + lines[0][1] * 1.0 + 2
        y2 = y1 + lines[1][1] * 1.35
        items += [glyphs(PJX, lines[0][0], lines[0][1], lines[0][2], 0, y1, j=2),
                  glyphs(PJX, lines[1][0], lines[1][1], lines[1][2], 0, y2, j=2)]
    items.append(group("pill", [rect(0, 0, w, h, min(h / 2, 24)), fill(INK)]))
    return PL.layer(nm, 4, shapes=items, ks=ks(p=(cx, cy), r=tilt,
        s=anim((t0, [0, 0], "pop"), (t0 + 14, [112, 112], "settle"), (t0 + 26, [100, 100], "settle"))))

offer_layers += [
]
# eight features in a balanced scatter around the logo: four rows, one chip each side, alternating tilts
NAMED = {"white": WHITE, "gold": G1, "ink": INK, "orange": OR}
FEATURES = [(x, y, [(t, sz, NAMED[c]) for t, sz, c in feat], tilt) for x, y, feat, tilt in CAMPAIGN["features"]]
for k, (x, y, feat, tilt) in enumerate(FEATURES):
    w = max(PJX.width(t, sz) for t, sz, _ in feat) + feat[0][1] * 2.2
    x = max(14 + w / 2, min(W - 14 - w / 2, x))          # keep every chip inside the frame
    offer_layers.insert(1, chip(x, y, feat, tilt, dm + 46 + k * 11, f"D chip {feat[0][0]}"))
offer_layers.append(PL.layer("D wordmark", 4, shapes=[
    glyphs(PJB, "Buddy", 66, OR, WORD_X + PJB.width("Du", 66), LOGO_Y + PJB.cap * 66 / 2),
    glyphs(PJB, "Du", 66, INK, WORD_X, LOGO_Y + PJB.cap * 66 / 2)],
    ks=ks(o=anim((dm + 30, 0, "settle"), (dm + 42, 100, "settle")), p=anim((dm + 30, [-24, 0], "settle"), (dm + 52, [0, 0], "settle")))))
offer_layers.append(PL.layer("D logo mark", 4, shapes=mark_shapes(),
    ks=ks(p=(MARK_X, LOGO_Y), s=anim((dm + 18, [0, 0], "pop"), (dm + 34, [124, 124], "settle"), (dm + 48, [115, 115], "settle")),
          r=anim((dm + 18, [-12], "settle"), (dm + 46, [0], "settle")))))
offer_layers.append(PL.layer("D cream wipe", 4, shapes=[group("disc", [
    {"ty": "el", "nm": "disc", "d": 1, "p": static([500, CY]),
     "s": anim((dm, [0, 0], "entrance"), (dm + 26, [1600, 1600], "settle"))}, fill(BG)])], ip=dm))

# -- C2: coupon slides left, 50% OFF and the sale line ----------------------------------------
c2, c2_out = T_C2, T_D - 16
SALE_TXT, SALE_DATE = CAMPAIGN["sale_line"]
sale_runs = PJX.width(SALE_TXT, 42), PJX.width(SALE_DATE, 42)
sale_pill_w = sale_runs[1] + 36
sale_x0 = 500 - (sale_runs[0] + 14 + sale_pill_w) / 2
SALE_Y = 390
o = [(c2 + 24, 0, "settle"), (c2 + 36, 100, "settle")]; p = [(c2 + 24, [0, 18], "settle"), (c2 + 46, [0, 0], "settle")]
beat_out(c2_out, o, p)
pill_x = sale_x0 + sale_runs[0] + 14
offer_layers.append(PL.layer("C2 sale line", 4, shapes=[
    glyphs(PJX, SALE_DATE, 42, INK, pill_x + sale_pill_w / 2, SALE_Y, j=2),
    group("date pill", [rect(pill_x + sale_pill_w / 2, SALE_Y - PJX.cap * 42 / 2, sale_pill_w, 54, 10), fill(G1)],
          a=(pill_x, SALE_Y - PJX.cap * 42 / 2), p=(pill_x, SALE_Y - PJX.cap * 42 / 2),
          s=anim((c2 + 40, [0, 100], "entrance"), (c2 + 58, [100, 100], "settle"))),
    glyphs(PJX, SALE_TXT, 42, WHITE, sale_x0, SALE_Y),
], ks=ks(o=anim(*o), p=anim(*p))))
o = [(c2 + 12, 0, "settle"), (c2 + 24, 100, "settle")]; p = [(c2 + 12, [40, 0], "settle"), (c2 + 36, [0, 0], "settle")]
beat_out(c2_out, o, p)
offer_layers.append(PL.layer("C2 50% off", 4, shapes=[
    glyphs(PJX, CAMPAIGN["discount"][1], 64, INK, 799, 284, j=2, tracking=31),
    glyphs(PJX, CAMPAIGN["discount"][0], 132, WHITE, 799, 216, j=2, tracking=-23),
], ks=ks(o=anim(*o), p=anim(*p))))

# -- C1/C2 coupon (one layer that pops in centred, then slides left) -----------------------------
c1 = T_C1
dash = [{"n": "d", "nm": "dash", "v": static(6)}, {"n": "g", "nm": "gap", "v": static(6)}]
divider = stroke(INK, 2, o=25); divider["d"] = dash
CODE_HL_W = MONO.width(CODE, 56, 40) + 20          # highlight sized to the code (keep codes <= ~8 chars)
code_g = group("code", [
    glyphs(MONO, CODE, 56, INK, 45, 24, j=2, tracking=40),
    group("highlight", [rect(45, 6, CODE_HL_W, 56, 8), fill(G1, o=60)], a=(45 - CODE_HL_W / 2, 6), p=(45 - CODE_HL_W / 2, 6),
          s=anim((c2 + 50, [0, 100], "entrance"), (c2 + 68, [100, 100], "settle"))),
    glyphs(MONO, CODE_LABEL, 15, MUTE, 45, -40, j=2, tracking=200),
], a=(45, 6), p=anim((c2, [45, 6], "settle"), (c2 + 24, [45, 14], "settle")),
   s=anim((c2 + 76, [100, 100], "sine"), (c2 + 86, [110, 110], "sine"), (c2 + 98, [100, 100], "sine")))
coupon = [
    group("valid", [glyphs(MONO, CAMPAIGN["valid"], 14, OR, 45, 62, j=2, tracking=100)],
          o=anim((c2, 100, "settle"), (c2 + 12, 0, "settle"))),
    code_g,
    group("side", [glyphs(MONO, CAMPAIGN["coupon_side"], 16, OR, 0, 6, j=2, tracking=200)], p=(-165, 0), r=-90),
    group("divider", [path([[-120, -60], [-120, 60]], closed=False), divider]),
    group("notches", [ellipse(-210, 0, 36), ellipse(210, 0, 36), fill(OR)]),
    group("ticket", [rect(0, 0, 420, 160, 22), fill(WHITE)]),
]
o = [(c1, 0, "settle"), (c1 + 8, 100, "settle")]
beat_out(c2_out, o)
offer_layers.append(PL.layer("coupon", 4, shapes=coupon, ks=ks(
    p=anim((c1, [500, CY], "hold"), (c2, [500, CY], "travel"), (c2 + 30, [315.5, 201], "hold")),
    s=anim((c1, [0, 0], "pop"), (c1 + 16, [160, 160], "settle"), (c1 + 28, [150, 150], "travel"),
           (c2, [150, 150], "travel"), (c2 + 30, [128, 128], "hold")),
    r=anim((c1, [-8], "settle"), (c1 + 26, [0], "hold")),
    o=anim(*o))))

# -- B: "Practice questions that / repeat in CUET" with a marker on "repeat" ------------------
b0, b_out = T_B, T_C1 - 16
B1_Y, B2_Y = 219.7, 305.7
PAD = 14                                         # marker padding either side of "repeat"
HOOK1, HOOK_WORD, HOOK_REST = CAMPAIGN["hook"]
w_rep, w_rest = PJX.width(HOOK_WORD, 60), PJX.width(HOOK_REST, 60)
mark_w = w_rep + 2 * PAD
mark_x = 500 - (mark_w + w_rest) / 2                # marker + rest of the line centred as one unit
offer_layers.append(text_layer_beat("B line 2", [
    glyphs(PJX, HOOK_REST, 60, WHITE, mark_x + mark_w, B2_Y),
    glyphs(PJX, HOOK_WORD, 60, INK, mark_x + PAD, B2_Y),
    group("marker", [rect(mark_x + mark_w / 2, B2_Y - PJX.cap * 60 / 2, mark_w, 74, 14), fill(G1)],
          a=(mark_x, 0), p=(mark_x, 0), s=anim((b0 + 26, [0, 100], "entrance"), (b0 + 44, [100, 100], "settle"))),
], b0 + 8, b_out))
offer_layers.append(text_layer_beat("B line 1", [glyphs(PJX, HOOK1, 60, WHITE, 500, B1_Y, j=2)], b0, b_out))

# -- A: big headline ------------------------------------------------------------------------
a0, a_out = T_A, T_B - 16
offer_layers.append(text_layer_beat("A line 2", [glyphs(PJX, CAMPAIGN["headline"][1], 78, INK, 500, 315, j=2)], a0 + 9, a_out))
offer_layers.append(text_layer_beat("A line 1", [glyphs(PJX, CAMPAIGN["headline"][0], 78, WHITE, 500, 223, j=2)], a0, a_out))

# -- festive background: fairy lights, corner fireworks, an anar, sparkles ----------------------
deco_end = T_D + 26
def twinkle_keys(t0, t1, period, phase, lo, hi):
    keys, t, up = [], t0 + phase % period, True
    keys.append((t0, hi, "sine"))
    while t < t1:
        keys.append((t, lo if up else hi, "sine")); up = not up; t += period / 2
    return anim(*keys)

LX0 = -260
bulbs, wire = [], f"M{LX0} 6"                                       # lights start/end beyond the band edges
n_sc, step = 14, 1520 / 14
for i in range(n_sc):
    wire += f" Q{LX0 + i * step + step / 2:.1f} 52 {LX0 + (i + 1) * step:.1f} 6"
for i in range(n_sc):
    for k in range(1, 5):
        u = k / 5; x = LX0 + i * step + u * step; y = 6 + (1 - (2 * u - 1) ** 2) * 23
        c = [G1, CREAM, G1, LIGHT_OR][(i + k) % 4]
        bulbs.append(((i * 4 + k) % 4, group(f"bulb {i}.{k}", [
            group("bulb", [ellipse(x, y + 9, 9, 12), fill(c)]),
            group("cap", [rect(x, y + 2, 5, 4), fill(hx("7A3B12"), o=60)]),
            group("glow", [ellipse(x, y + 9, 22), fill(c, o=30)]),
        ])))
# neighbouring bulbs sit in different phase groups, so the string still twinkles one after another
lights = [group(f"bulbs phase {ph}", [b for p_, b in bulbs if p_ == ph], o=twinkle_keys(T_OFFER, deco_end, 90, ph * 22, 45, 100))
          for ph in range(4)] + [group("wire", svg_paths(wire) + [stroke(hx("7A3B12"), 2, o=55)])]
for s in lights[-1]["it"][:-2]:
    s["ks"]["k"]["c"] = False

def firework(cx, cy, r, col, n, period, phase):
    rays = [path([[cx + math.cos(a) * r * 0.35, cy + math.sin(a) * r * 0.35],
                  [cx + math.cos(a) * r, cy + math.sin(a) * r]], closed=False)
            for a in [k / n * 2 * math.pi for k in range(n)]]
    dots = [ellipse(cx + math.cos(a) * r * 1.2, cy + math.sin(a) * r * 1.2, 6) for a in [k / n * 2 * math.pi for k in range(n)]]
    s, o = [], []
    t = T_OFFER + phase
    while t < deco_end:
        s += [(t, [20, 20], "entrance"), (t + 40, [100, 100], "settle"), (t + 110, [108, 108], "linear")]
        o += [(t, 0, "settle"), (t + 8, 100, "settle"), (t + 70, 90, "sine"), (t + 110, 0, "hold")]
        t += period
    return group("firework", [group("rays", rays + [stroke(col, 3)]), group("dots", dots + [fill(col)])],
                 a=(cx, cy), p=(cx, cy), s=anim(*s), o=anim(*o))

anar = [group("cone", [path([[52, 436], [88, 436], [81, 402], [59, 402]]), fill(RED)]),
        group("band", [rect(70, 416, 26, 5), fill(G1)])]
sparks = [[], [], []]                            # three flicker phases; neighbours land in different phases
for k in range(14):
    a = -math.pi / 2 + (k - 6.5) * 0.13; Ld = 40 + (k % 4) * 16
    sparks[k % 3].append(group(f"spark {k}", [ellipse(70 + math.cos(a) * Ld, 402 + math.sin(a) * Ld, 4 + 2 * (k % 3)), fill(G1 if k % 2 else CREAM)]))
for ph, grp in enumerate(sparks):
    anar.insert(0, group(f"sparks phase {ph}", grp, o=twinkle_keys(T_OFFER, deco_end, 30, ph * 10, 0, 100)))
def sparkle(x, y, sz, col, phase):
    star = f"M{x} {y - sz} L{x + sz * .25} {y - sz * .25} L{x + sz} {y} L{x + sz * .25} {y + sz * .25} L{x} {y + sz} L{x - sz * .25} {y + sz * .25} L{x - sz} {y} L{x - sz * .25} {y - sz * .25}Z"
    keys = [(T_OFFER + phase + k * 54, [40 if k % 2 == 0 else 100] * 2, "sine") for k in range(int((deco_end - T_OFFER - phase) / 54))]
    return group("sparkle", svg_paths(star) + [fill(col)], a=(x, y), p=(x, y), s=anim(*keys))
offer_layers.append(PL.layer("festive decor", 4, ip=T_OFFER - 10, op=deco_end, shapes=lights + [
    firework(64, 100, 30, G1, 12, 190, 10), firework(940, 104, 26, CREAM, 10, 190, 105),
    group("anar", anar),
    sparkle(950, 380, 9, CREAM, 0), sparkle(170, 210, 6, G1, 20), sparkle(880, 260, 6, CREAM, 40),
], ks=ks(o=anim((T_OFFER - 10, 0, "settle"), (T_OFFER + 14, 100, "settle")))))

# -- the arrow-hit burst: rockets streak out and pop into firework flowers -------------------------
rockets = []
for k, (x, y, r, col) in enumerate([(180, 96, 70, G1), (820, 86, 64, CREAM), (300, 338, 58, TEAL), (724, 346, 66, G1),
                                     (500, 70, 50, RED), (92, 262, 44, CREAM), (918, 268, 48, G1), (560, 210, 84, CREAM)]):
    t0 = T_HIT + 2 + k * 2
    streak = group("streak", [path([BURST_C, [x, y]], closed=False), stroke(G1, 3, o=70),
                              {"ty": "tm", "nm": "trail", "s": anim((t0 + 6, [0], "settle"), (t0 + 18, [100], "settle")),
                               "e": anim((t0, [0], "entrance"), (t0 + 12, [100], "settle")), "o": static(0), "m": 1}])
    n = 14 if k % 2 == 0 else 10
    ang = [j / n * 2 * math.pi for j in range(n)]
    flower = group("flower", [
        group("rays", [path([[x + math.cos(a) * r * 0.3, y + math.sin(a) * r * 0.3], [x + math.cos(a) * r, y + math.sin(a) * r]], closed=False) for a in ang] + [stroke(col, 4)]),
        group("dots", [ellipse(x + math.cos(a) * r * 1.18, y + math.sin(a) * r * 1.18, 7) for a in ang] + [fill(col)]),
    ], a=(x, y), p=(x, y), s=anim((t0 + 10, [0, 0], "entrance"), (t0 + 34, [100, 100], "settle"), (t0 + 60, [110, 110], "linear")),
       o=anim((t0 + 10, 100, "settle"), (min(t0 + 20, T_A - 20), 100, "sine"), (T_A - 6, 0, "sine")))   # gone before the headline
    rockets += [flower, streak]
offer_layers.append(PL.layer("cracker burst", 4, ip=T_HIT, op=T_HIT + 90, shapes=rockets))
offer_layers.append(PL.layer("saffron field", 4, shapes=[group("disc", [
    {"ty": "el", "nm": "disc", "d": 1, "p": static(BURST_C),
     "s": anim((T_HIT + 2, [0, 0], "entrance"), (T_HIT + 38, [1600, 1600], "settle"))}, fill(OR)])]))


# The offer is drawn twice: above the heads while it plays, then (from T_OUT0, with the heads parked
# below frame) underneath them, so it can shrink back while the heads rise in front of it.
layers.append(L.layer("offer", 0, refId="offer", w=W, h=CANVAS_H, ip=T_HIT, op=T_OUT0))
offer_back = L.layer("offer (receding)", 0, refId="offer", w=W, h=CANVAS_H, ip=T_OUT0, op=OP,
                     ks=ks(a=(500, BAND_Y + 222 * BAND_S), p=(500, BAND_Y + 222 * BAND_S),
                           s=anim((T_OUT0, [100, 100], "travel"), (T_OUT0 + 46, [72, 72], "settle")),
                           o=anim((T_OUT0 + 8, 100, "sine"), (T_OUT0 + 46, 0, "sine"))))

# ---- impact ring + arrow -------------------------------------------------------------
TIP_X, TIP_Y = 466, 254
layers.append(L.layer("impact", 4, ip=T_HIT - 1, op=T_HIT + 24, shapes=[group("ring", [
    {"ty": "el", "nm": "ring", "d": 1, "p": static([TIP_X, TIP_Y]),
     "s": anim((T_HIT, [10, 10], "entrance"), (T_HIT + 18, [260, 260], "settle"))},
    stroke(WHITE, 12, o=anim((T_HIT, 100, "settle"), (T_HIT + 18, 0, "settle")))])]))

def arrow_body(col, extra=0):
    """Arrow pointing right with its tip at (0, 0); extra > 0 draws a fatter copy for the outline."""
    e = extra
    return [
        group("head", [path([[2 + e * 1.4, 0], [-30 - e, -15 - e], [-22, 0], [-30 - e, 15 + e]]), fill(col)]),
        group("shaft", [path([[-210, 0], [-20, 0]], closed=False), stroke(col, 5 + 2 * e)]),
        group("feathers", [path([[-224 - e, -2], [-200, -2], [-182 + e, -20 - e], [-206 - e, -20 - e]]),
                           path([[-224 - e, 2], [-200, 2], [-182 + e, 20 + e], [-206 - e, 20 + e]]), fill(col if e else OR)]),
    ]
glow = {"ty": "el", "nm": "glow", "d": 1, "p": static([-10, 0]),
        "s": anim((T_AIM + 14, [0, 0], "settle"), (T_AIM + 26, [46, 46], "settle"), (T_AIM + 34, [34, 34], "sine"),
                  (T_AIM + 42, [46, 46], "sine"))}
trail = group("trail", [path([[-1500, 0], [-226, 0]], closed=False), stroke(G1, 9),
                        {"ty": "tm", "nm": "trim", "s": static(0), "e": static(100), "o": static(0), "m": 1}],
              o=anim((T_ARROW0, 0, "settle"), (T_ARROW0 + 2, 70, "settle")))
flame = group("flame trail", [path([[-1500, 0], [-226, 0]], closed=False), stroke(OR, 18, o=35)],
              o=anim((T_ARROW0, 0, "settle"), (T_ARROW0 + 2, 100, "settle")))
arrow = arrow_body(INK) + arrow_body(WHITE, 3) + [trail, flame, group("aim glow", [glow, stroke(G1, 4)], o=anim((T_ARROW0 - 2, 100, "settle"), (T_ARROW0 + 4, 0, "settle")))]
AIM = [250, 322]                                   # clear space under the left heads; whole arrow stays in frame
ang = math.degrees(math.atan2(TIP_Y - AIM[1], TIP_X - AIM[0]))
ux, uy = math.cos(math.radians(ang)), math.sin(math.radians(ang))
on_line = lambda d: [AIM[0] + ux * d, AIM[1] + uy * d]
wob = [(T_AIM, [ang], "linear"), (T_HIT, [ang], "linear")] + \
      [(T_HIT + 2 * k, [ang + 5 * (1 - k / 8) * (1 if k % 2 else -1)], "linear") for k in range(1, 9)]
layers.append(L.layer("arrow", 4, ip=T_AIM, op=T_OFFER, shapes=arrow, ks=ks(
    p=anim((T_AIM, on_line(-420), "entrance"), (T_AIM + 20, on_line(0), "settle"),        # slides in and aims
           (T_AIM + 28, on_line(0), "settle"), (T_ARROW0, on_line(-50), "exit"),           # draws back
           (T_ARROW0 + 1, on_line(-50), "linear"), (T_HIT, [TIP_X, TIP_Y], "hold")),      # released: fast and straight
    s=anim((T_AIM, [122, 122], "hold")),
    r=anim(*wob))))

# ---- labels scattered around the heads, landing in random order -------------------------
# (head index): (x, y, text size, tilt) - loose, varied placement in the free space around the arc
SCATTER = {0: (128, 372, 16, -4), 1: (122, 238, 14, 3), 2: (226, 70, 15, -3), 3: (372, 104, 13, 2),
           4: (500, 36, 18, 0), 5: (640, 102, 14, -2), 6: (782, 62, 15, 3), 7: (880, 178, 14, -3),
           8: (904, 300, 16, 4), 9: (880, 404, 13, -2)}
def dashed(w=1.5):
    st = stroke(INK, w); st["d"] = [{"n": "d", "nm": "dash", "v": static(4)}, {"n": "g", "nm": "gap", "v": static(4)}]
    return st
connectors = []
for h in HEADS:
    i = h["i"]; text = PROBLEMS[i]
    x, y, sz, tilt = SCATTER[i]
    w = PJX.width(text, sz) + sz * 3.3
    cx, cy = max(12 + w / 2, min(W - 12 - w / 2, x)), y
    fx, fy = zoom_screen(h["x"], h["y"] + 10 * h["s"])
    card, _ = card_items(cx, cy, text, sz, None)
    t0 = pop_time(i)
    fade = anim((t0, 0, "settle"), (t0 + 6, 100, "settle"), (T_AIM, 100, "settle"), (T_AIM + 12, 22, "settle"))
    layers.append(L.layer(f"label {text}", 4, ip=T_ZOOM1, op=T_OFFER + 10, shapes=card,
        ks=ks(a=(cx, cy), p=(cx, cy), r=tilt,
              s=anim((t0, [0, 0], "pop"), (t0 + 12, [112, 112], "settle"), (t0 + 22, [100, 100], "settle")), o=fade)))
    # line from the label's centre to the face centre; drawn under the heads so it disappears behind them
    connectors.append(L.layer(f"connector {text}", 4, ip=T_ZOOM1, op=T_OFFER + 10, shapes=[
        group("line", [path([[cx, cy], [fx, fy]], closed=False), dashed()],
              )], ks=ks(o=anim((t0 + 4, 0, "settle"), (t0 + 14, 100, "settle"), (T_AIM, 100, "settle"), (T_AIM + 12, 22, "settle")))))
    trim_end = anim((t0 + 4, [0], "settle"), (t0 + 18, [100], "settle"))
    connectors[-1]["shapes"][0]["it"].insert(-1, {"ty": "tm", "nm": "draw", "s": static(0), "e": trim_end, "o": static(0), "m": 1})

cap_w = PJX.width(CAPTION_A + CAPTION_B, 24)
layers.append(L.layer("caption", 4, ip=T_ZOOM1, op=T_OFFER + 10, shapes=[
    glyphs(PJX, CAPTION_B, 24, INK, 500 - cap_w / 2 + PJX.width(CAPTION_A, 24), 384),
    glyphs(PJX, CAPTION_A, 24, OR, 500 - cap_w / 2, 384)],
    ks=ks(o=anim((T_POP0 - 6, 0, "settle"), (T_POP0 + 8, 100, "settle"), (T_AIM, 100, "settle"), (T_AIM + 12, 0, "settle")),
          p=anim((T_POP0 - 6, [0, 14], "settle"), (T_POP0 + 16, [0, 0], "settle")))))

# ---- camera -----------------------------------------------------------------------------
def cam(*keys):
    return ks(a=anim(*[(t, c["a"], e) for t, c, e in keys]), p=anim(*[(t, c["p"], e) for t, c, e in keys]),
              s=anim(*[(t, [c["s"]] * 2, e) for t, c, e in keys]))
camera = L.layer("camera", 3, ks=cam((0, CLOSE, "hold"), (T_ZOOM0, CLOSE, "travel"), (T_ZOOM1, ZOOM, "hold"),
                                     (T_RESET, CLOSE, "hold"), (OP, CLOSE, "hold")))
layers.append(camera)

# Each head = 3 null layers carrying its motion (placement -> sway -> laugh/flinch), the shared static
# artwork precomp, and a small shape layer with the parts that move (eyes, lids, brows, mouth, ...).
head_nulls, head_layers = [], []
for h in sorted(HEADS, key=lambda h: h["k"]):
    tr_ = head_tracks(h)
    name = f"head {h['i'] + 1} {PROBLEMS[h['i']]}"
    place = L.layer(f"{name} / place", 3, parent=camera["ind"], ks=ks(
        p=anim((0, [h["x"], h["y"]], "hold"), (T_RESET, [h["x"], h["y"] + HEAD_DROP], "hold"),
               (T_OUT0 + 4 + h["k"] * 7, [h["x"], h["y"] + HEAD_DROP], "settle"),
               (T_OUT0 + 40 + h["k"] * 7, [h["x"], h["y"]], "hold"), (OP, [h["x"], h["y"]], "hold")),
        s=(h["s"] * 100, h["s"] * 100)))
    sway = L.layer(f"{name} / sway", 3, parent=place["ind"], ks=ks(a=(0, 40), p=(0, 40), r=tr_["sway"].build()))
    laugh = L.layer(f"{name} / laugh", 3, parent=sway["ind"],
                    ks=ks(a=(0, 40), p=tr_["laugh_p"].build(), r=tr_["laugh_r"].build(), s=tr_["laugh_s"].build()))
    head_nulls += [place, sway, laugh]
    head_layers += [L.layer(f"{name} / moving parts", 4, parent=laugh["ind"], shapes=head_anim_shapes(tr_)),
                    L.layer(f"{name} / art", 0, refId="head_static", w=HEAD_PC_W, h=HEAD_PC_H, parent=laugh["ind"],
                            ks=ks(a=(HEAD_PC_OX, HEAD_PC_OY), p=(0, 0)))]
layers += head_nulls + head_layers
layers += connectors
layers.append(offer_back)

layers.append(L.layer("background", 4, shapes=[group("bg", [rect(W / 2, CANVAS_H / 2, W, CANVAS_H), fill(None, "bgColor")])]))

# ---- place the band in the taller canvas -----------------------------------------------------
def offset_root(lst, lay_factory, name):
    """Adds a null at (0, BAND_Y) and parents every unparented layer (except full-canvas ones) to it."""
    root = lay_factory.layer(name, 3, ks=ks(p=(BAND_X, BAND_Y), s=(BAND_S * 100, BAND_S * 100)))
    for l in lst:
        if "parent" not in l and l["ty"] != 0 and l["nm"] != "background":
            l["parent"] = root["ind"]
    lst.insert(0, root)
offset_root(layers, L, "band offset")
offset_root(offer_layers, PL, "band offset")

# ---- soft, uneven white fades over the top and bottom edges (drawn above everything) -------------
# Lottie players can't blur, so the softness comes from gradients: an eased linear fade plus a row of
# drifting radial "mist" puffs of different sizes, which breaks the fade boundary into a wavy edge.
def white_gradient(kind, start, end, alpha):
    """Gradient fill in plain white; alpha = [(position, opacity)...]."""
    cols = [0, 1, 1, 1, 1, 1, 1, 1]
    ops = [v for pos_op in alpha for v in pos_op]
    g = {"ty": "gf", "nm": "fade", "o": static(100), "r": 1, "t": kind,
         "s": static(start), "e": static(end), "g": {"p": 2, "k": static(cols + ops)}}
    if kind == 2:
        g["h"] = static(0); g["a"] = static(0)
    return g

def edge_fade(top):
    y_edge = 0 if top else CANVAS_H
    y_in = EDGE_FADE if top else CANVAS_H - EDGE_FADE
    band = group("linear fade", [rect(W / 2, (y_edge + y_in) / 2, W, EDGE_FADE + 2),
                                  white_gradient(1, [W / 2, y_edge], [W / 2, y_in],
                                                 [(0, 1), (0.3, 0.75), (0.6, 0.3), (0.85, 0.08), (1, 0)])])
    puffs = []
    for k in range(12):
        seed = k * 7 + (0 if top else 3)
        x = -20 + k * 94 + (seed * 37) % 40 - 20
        r = 48 + (seed * 53) % 44
        dy = 12 + (seed * 29) % 28                     # how far the puff reaches into the frame (kept high)
        y = dy if top else CANVAS_H - dy
        period, amp, phase = 380, 10 + (seed % 3) * 5, (seed * 61) % 380
        drift = []
        t, sgn = phase - period, 1
        while t <= OP + period:
            drift.append((t, [x + sgn * amp, y], "sine")); sgn = -sgn; t += period / 2
        puffs.append(group(f"mist {k}", [ellipse(0, 0, r * 2),
                                         white_gradient(2, [0, 0], [r, 0], [(0, 0.95), (0.45, 0.6), (0.75, 0.2), (1, 0)])],
                           p=anim(*drift), s=(150, 100)))
    return group("top edge" if top else "bottom edge", puffs + [band])
if EDGE_FADE:
    layers.insert(0, L.layer("edge fade", 4, shapes=[edge_fade(True)]))

lottie = {"v": "5.7.0", "fr": FR, "ip": 0, "op": OP, "w": W, "h": CANVAS_H, "nm": f"DuBuddy banner - {CAMPAIGN['slug']} ({VARIANT})",
          "ddd": 0, "assets": [{"id": "offer", "nm": "offer", "fr": FR, "layers": offer_layers},
                               {"id": "head_static", "nm": "head art", "fr": FR, "layers": [
                                   Layers(OP).layer("head art", 4, shapes=head_static_shapes())]}],
          "layers": layers, "slots": {"bgColor": {"p": static(BG + [1])}}}
def tidy(o):
    """Rounds floats to keep the file small (3 decimals is sub-pixel at this size)."""
    if isinstance(o, float):
        r = round(o, 3)
        return int(r) if r == int(r) else r
    if isinstance(o, list): return [tidy(v) for v in o]
    if isinstance(o, dict): return {k: tidy(v) for k, v in o.items()}
    return o
# plain Lottie for app players: colours inlined, no slots (lottie-ios rejects slot-only properties)
OUT_FILE = os.path.join(HERE, "out", f"{CAMPAIGN['slug']}-{VARIANT}.json")
json.dump(tidy(inline_slots(lottie)), open(OUT_FILE, "w"), separators=(",", ":"))
json.dump(tidy(inline_slots(lottie)), open(os.path.join(OUT_DIR, "lottie.json"), "w"), separators=(",", ":"))   # scene folder for the player
json.dump({"controls": []}, open(os.path.join(OUT_DIR, "controls.json"), "w"), indent=2)
print("wrote", OUT_FILE, os.path.getsize(OUT_FILE) // 1024, "KB")
