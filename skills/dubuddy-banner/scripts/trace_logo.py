"""Traces the DuBuddy mark (two figures) from the avatar PNG into vector paths.

Writes dubuddy_mark.json: {"ink": [svg path d...], "orange": [...]}, centred on (0, 0), 100 units tall.
"""
import json, sys
import cv2, numpy as np

src = sys.argv[1]
img = cv2.imread(src)
img = cv2.resize(img, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
b, g, r = [img[:, :, k].astype(int) for k in range(3)]
lum = 0.299 * r + 0.587 * g + 0.114 * b
masks = {
    "ink": (lum < 110).astype(np.uint8) * 255,
    "orange": ((r > 180) & (g < 170) & (b < 150) & (r - b > 60)).astype(np.uint8) * 255,
}
k = np.ones((5, 5), np.uint8)
paths, pts_all = {}, []
for name, m in masks.items():
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
    m = cv2.GaussianBlur(m, (9, 9), 0); m = (m > 127).astype(np.uint8) * 255
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    keep = [c for c in cs if cv2.contourArea(c) > 400]
    paths[name] = [cv2.approxPolyDP(c, 1.6, True)[:, 0, :].astype(float) for c in keep]
    pts_all += [p for c in paths[name] for p in c]
pts_all = np.array(pts_all)
x0, y0 = pts_all.min(0); x1, y1 = pts_all.max(0)
cx, cy, s = (x0 + x1) / 2, (y0 + y1) / 2, 100 / (y1 - y0)
out = {}
for name, cs in paths.items():
    out[name] = ["M" + " L".join(f"{(x - cx) * s:.2f} {(y - cy) * s:.2f}" for x, y in c) + "Z" for c in cs]
out["size"] = [round((x1 - x0) * s, 2), 100]
json.dump(out, open("dubuddy_mark.json", "w"))
print({k: len(v) for k, v in out.items() if k != "size"}, "size", out["size"], "points", sum(len(p) for p in paths["ink"] + paths["orange"]))
