"""Small helpers for hand-building Lottie JSON (shapes, keyframes, SVG paths, vector text)."""
import json, os, re, struct, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))

def hx(h, a=None):
    h = h.lstrip("#")
    c = [round(int(h[i:i + 2], 16) / 255, 4) for i in (0, 2, 4)]
    return c + [a] if a is not None else c

# ---- font metrics -------------------------------------------------------------
class Font:
    def __init__(self, path):
        self.path = path
        d = open(path, "rb").read()
        n = struct.unpack(">H", d[4:6])[0]
        t = {d[12 + i * 16:16 + i * 16].decode(): struct.unpack(">I", d[20 + i * 16:24 + i * 16])[0] for i in range(n)}
        self.upm = struct.unpack(">H", d[t["head"] + 18:t["head"] + 20])[0]
        self.cap = struct.unpack(">h", d[t["OS/2"] + 88:t["OS/2"] + 90])[0] / self.upm
        nhm = struct.unpack(">H", d[t["hhea"] + 34:t["hhea"] + 36])[0]
        hm = [struct.unpack(">H", d[t["hmtx"] + i * 4:t["hmtx"] + i * 4 + 2])[0] for i in range(nhm)]
        c = t["cmap"]; self.map = {}
        for i in range(struct.unpack(">H", d[c + 2:c + 4])[0]):
            pid, eid, off = struct.unpack(">HHI", d[c + 4 + i * 8:c + 12 + i * 8])
            o = c + off
            if pid == 3 and eid == 1 and struct.unpack(">H", d[o:o + 2])[0] == 4:
                seg = struct.unpack(">H", d[o + 6:o + 8])[0] // 2
                ends = struct.unpack(f">{seg}H", d[o + 14:o + 14 + seg * 2])
                st = o + 16 + seg * 2
                starts = struct.unpack(f">{seg}H", d[st:st + seg * 2])
                deltas = struct.unpack(f">{seg}h", d[st + seg * 2:st + seg * 4])
                ro = st + seg * 4
                offs = struct.unpack(f">{seg}H", d[ro:ro + seg * 2])
                for s in range(seg):
                    for ch in range(starts[s], ends[s] + 1):
                        if ch == 0xFFFF: continue
                        if offs[s] == 0: g = (ch + deltas[s]) & 0xFFFF
                        else:
                            a = ro + s * 2 + offs[s] + (ch - starts[s]) * 2
                            g = struct.unpack(">H", d[a:a + 2])[0]
                            if g: g = (g + deltas[s]) & 0xFFFF
                        self.map[ch] = g
        self.adv = lambda g: hm[min(g, nhm - 1)]

    def width(self, text, size, tracking=0):
        w = sum(self.adv(self.map.get(ord(ch), 0)) for ch in text) / self.upm * size
        return w + tracking / 1000 * size * (len(text) - 1)

# ---- keyframes ----------------------------------------------------------------
EASE = {
    "entrance": (.20, .75, .34, .94),
    "settle": (.00, .65, .51, .99),
    "pop": (.94, .75, .34, .94),
    "travel": (1.0, .49, .00, .55),
    "exit": (1.0, .02, .54, .42),
    "sine": (.37, 0, .63, 1),
    "linear": (0, 0, 1, 1),
}

def static(v): return {"a": 0, "k": v}

def anim(*keys):
    """keys: (t, value, ease) ... ease 'hold' holds until the next key; the last ease is ignored."""
    keys = sorted(keys, key=lambda k: k[0])
    out = []
    for i, (t, v, e) in enumerate(keys):
        v = v if isinstance(v, list) else [v]
        k = {"t": t, "s": v}
        if i < len(keys) - 1:
            if e == "hold":
                k["h"] = 1
            else:
                x1, y1, x2, y2 = EASE[e]
                n = len(v)
                k["o"] = {"x": [x1] * n, "y": [y1] * n}
                k["i"] = {"x": [x2] * n, "y": [y2] * n}
        out.append(k)
    if len(out) == 1:
        return static(keys[0][1])
    return {"a": 1, "k": out}

def prop(v): return v if isinstance(v, dict) else static(list(v) if isinstance(v, tuple) else v)

def ks(p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100):
    return {"o": prop(o), "r": prop(r), "p": prop(p), "a": prop(a), "s": prop(s)}

class Layers:
    def __init__(self, op): self.op, self.ind = op, 0
    def layer(self, nm, ty, **kw):
        self.ind += 1
        L = {"ddd": 0, "ind": self.ind, "ty": ty, "nm": nm, "ip": 0, "op": self.op, "st": 0, "sr": 1,
             "ks": kw.pop("ks", ks()), "ao": 0, "bm": 0}
        L.update(kw)
        return L

# ---- shapes -------------------------------------------------------------------
def fill(c, sid=None, o=100):
    col = {"sid": sid} if sid else static(c + [1] if len(c) == 3 else c)
    return {"ty": "fl", "c": col, "o": prop(o), "r": 1, "nm": "fill"}

def stroke(c, w, o=100, lc=2):
    return {"ty": "st", "c": static(c + [1] if len(c) == 3 else c), "o": prop(o), "w": static(w), "lc": lc, "lj": 2, "ml": 4, "nm": "stroke"}

def tr(p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100):
    t = {"ty": "tr", "nm": "transform"}
    for k, v in (("p", p), ("a", a), ("s", s), ("r", r), ("o", o)):
        t[k] = prop(v)
    return t

def group(nm, items, **t): return {"ty": "gr", "nm": nm, "it": list(items) + [tr(**t)]}

def rect(x, y, w, h, r=0): return {"ty": "rc", "nm": "rect", "p": static([x, y]), "s": static([w, h]), "r": static(r), "d": 1}

def ellipse(x, y, w, h=None): return {"ty": "el", "nm": "ellipse", "p": static([x, y]), "s": static([w, h or w]), "d": 1}

def shape_path(v, i=None, o=None, closed=True):
    n = len(v)
    return {"v": v, "i": i or [[0, 0]] * n, "o": o or [[0, 0]] * n, "c": closed}

def path(v, i=None, o=None, closed=True): return {"ty": "sh", "nm": "path", "ks": static(shape_path(v, i, o, closed))}

def circle_path(cx, cy, r):
    k = 0.5523 * r
    return shape_path([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]],
                      i=[[-k, 0], [0, -k], [k, 0], [0, k]], o=[[k, 0], [0, k], [-k, 0], [0, -k]])

def svg_paths(d):
    """Parses absolute M/L/C/Q/Z SVG path data into Lottie path shapes (one per subpath)."""
    toks = re.findall(r"[MLCQZmlcqz]|-?\d*\.?\d+(?:e-?\d+)?", d)
    out, cur, prev, cmd, i = [], None, None, None, 0
    def finish(closed):
        nonlocal cur
        if cur and len(cur["v"]) > 1:
            if closed and len(cur["v"]) > 1 and cur["v"][0] == cur["v"][-1]:
                cur["i"][0] = cur["i"][-1]; cur["v"].pop(); cur["i"].pop(); cur["o"].pop()
            out.append({"ty": "sh", "nm": "path", "ks": static(shape_path(cur["v"], cur["i"], cur["o"], closed))})
        cur = None
    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    while i < len(toks):
        t = toks[i]
        if re.match(r"[A-Za-z]", t):
            cmd = t.upper(); i += 1
            if cmd == "Z":
                finish(True); continue
        if cmd == "M":
            finish(False); p = [num(), num()]
            cur = {"v": [p], "i": [[0, 0]], "o": [[0, 0]]}; prev = p; cmd = "L"
        elif cmd == "L":
            p = [num(), num()]; cur["v"].append(p); cur["i"].append([0, 0]); cur["o"].append([0, 0]); prev = p
        elif cmd == "C":
            c1, c2, p = [num(), num()], [num(), num()], [num(), num()]
            cur["o"][-1] = [c1[0] - prev[0], c1[1] - prev[1]]
            cur["v"].append(p); cur["i"].append([c2[0] - p[0], c2[1] - p[1]]); cur["o"].append([0, 0]); prev = p
        elif cmd == "Q":
            q, p = [num(), num()], [num(), num()]
            c1 = [prev[0] + 2 / 3 * (q[0] - prev[0]), prev[1] + 2 / 3 * (q[1] - prev[1])]
            c2 = [p[0] + 2 / 3 * (q[0] - p[0]), p[1] + 2 / 3 * (q[1] - p[1])]
            cur["o"][-1] = [c1[0] - prev[0], c1[1] - prev[1]]
            cur["v"].append(p); cur["i"].append([c2[0] - p[0], c2[1] - p[1]]); cur["o"].append([0, 0]); prev = p
    finish(False)
    return out

# ---- export ---------------------------------------------------------------------
def inline_slots(lottie):
    """Plain-Lottie export: replaces every {"sid": ...} property with its slot's value and drops "slots".

    lottie-ios (and other players without slot support) reject properties that hold only a slot
    reference, so delivered files must carry real "a"/"k" values everywhere.
    """
    import copy
    slots = lottie.pop("slots", {}) or {}
    def walk(o):
        if isinstance(o, dict):
            if "sid" in o and o["sid"] in slots and "k" not in o:
                return copy.deepcopy(slots[o["sid"]]["p"])
            return {k: walk(v) for k, v in o.items() if k != "sid"}
        if isinstance(o, list):
            return [walk(v) for v in o]
        return o
    out = walk(lottie)
    assert '"sid"' not in json.dumps(out) and "slots" not in out, "slot reference left in export"
    return out

# ---- vector text ----------------------------------------------------------------
_glyph_cache = {}
def glyphs(font, text, size, color, x=0, y=0, j=0, tracking=0, nm=None):
    """A group of the text's glyph outlines, baseline origin at (x, y); j: 0 left, 1 right, 2 centre."""
    key = (font.path, text, size, tracking, j)
    if key not in _glyph_cache:
        req = {"font": font.path, "size": size, "text": text, "tracking": tracking, "j": j}
        out = subprocess.run(["node", os.path.join(HERE, "text_to_paths.cjs"), json.dumps(req)],
                             capture_output=True, text=True, check=True).stdout
        _glyph_cache[key] = json.loads(out)
    paths = [{"ty": "sh", "nm": f"glyph {k}", "ks": static(p)} for k, p in enumerate(_glyph_cache[key])]
    return group(nm or text, paths + [fill(color)], p=(x, y))
