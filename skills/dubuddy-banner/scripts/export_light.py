"""Lighter mobile export of a Lottie: halves the frame rate, drops redundant keyframes, trims precision.

usage: python3 export_light.py in.json out.json [fps]

- Retimes to the target fps with the same duration (every time value is scaled).
- Removes linear keyframes that lie on the straight line between their neighbours (baked motion).
- Rounds shape vertices/tangents to 0.1 px and other numbers to 3 decimals; drops shape-item names.
"""
import json, sys

src, dst = sys.argv[1], sys.argv[2]
fps = float(sys.argv[3]) if len(sys.argv) > 3 else 30
L = json.load(open(src))
k = fps / L["fr"]
L["fr"] = fps

def is_linear(kf):
    o, i = kf.get("o"), kf.get("i")
    if not o or not i or kf.get("h"): return False
    ox, oy, ix, iy = (v if isinstance(v, list) else [v] for v in (o["x"], o["y"], i["x"], i["y"]))
    return all(abs(a) < 1e-6 for a in ox + oy) and all(abs(a - 1) < 1e-6 for a in ix + iy)

def numeric(v): return isinstance(v, list) and all(isinstance(a, (int, float)) for a in v)

def thin(keys, tol=0.3):
    """Greedy: drop a key when the previous kept key and the next key are linear and it sits on their line."""
    if len(keys) < 3: return keys
    out = [keys[0]]
    for j in range(1, len(keys) - 1):
        a, b, c = out[-1], keys[j], keys[j + 1]
        if (is_linear(a) and is_linear(b) and numeric(a.get("s")) and numeric(b.get("s")) and numeric(c.get("s"))
                and len(a["s"]) == len(b["s"]) == len(c["s"]) and c["t"] > a["t"]):
            u = (b["t"] - a["t"]) / (c["t"] - a["t"])
            if all(abs(a["s"][d] + (c["s"][d] - a["s"][d]) * u - b["s"][d]) <= tol for d in range(len(b["s"]))):
                continue
        out.append(b)
    out.append(keys[-1])
    return out

def r(v, n):
    v = round(v, n)
    return int(v) if v == int(v) else v

def walk(o, in_path=False):
    if isinstance(o, dict):
        # animated property: retime and thin
        if o.get("a") == 1 and isinstance(o.get("k"), list) and o["k"] and isinstance(o["k"][0], dict) and "t" in o["k"][0]:
            for kf in o["k"]:
                kf["t"] = r(kf["t"] * k, 3)
            o["k"] = thin(o["k"])
        out = {}
        for key, v in o.items():
            if key == "nm" and "ty" in o and isinstance(o.get("ty"), str):   # shape-item names are not needed
                continue
            if key in ("ip", "op", "st") and isinstance(v, (int, float)):
                out[key] = r(v * k, 3); continue
            if key in ("v", "i", "o") and isinstance(v, list) and v and isinstance(v[0], list):   # bezier geometry
                out[key] = [[r(x, 1) for x in p] for p in v]; continue
            out[key] = walk(v)
        return out
    if isinstance(o, list): return [walk(v) for v in o]
    if isinstance(o, float): return r(o, 3)
    return o

L = walk(L)
s = json.dumps(L, separators=(",", ":"))
assert '"sid"' not in s and '"slots"' not in s
open(dst, "w").write(s)
print(f"{dst}: {len(s) / 1024:.0f} KB at {fps:g} fps, {L['op'] / fps:.2f}s")
