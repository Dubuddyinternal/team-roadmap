"""Contact sheet of rendered frames.

usage: python3 sheet.py out.png <frames dir> f1 f2 ...   (frames named f<N>.png, any zero padding)
Two columns, each frame labelled, composited on white (the app/site background).
"""
import glob, os, sys
from PIL import Image, ImageDraw

out, fdir, frames = sys.argv[1], sys.argv[2], sys.argv[3:]
def find(f):
    for p in glob.glob(os.path.join(fdir, "f*.png")):
        if int(os.path.basename(p)[1:-4]) == int(f): return p
    raise SystemExit(f"frame {f} not found in {fdir}")
ims = []
for f in frames:
    im = Image.open(find(f)).convert("RGBA")
    bg = Image.new("RGB", im.size, (255, 255, 255)); bg.paste(im, (0, 0), im)
    ims.append(bg)
w, h = ims[0].size
cols = 2; rows = (len(ims) + 1) // 2
S = Image.new("RGB", (cols * (w + 10), rows * (h + 24)), (40, 40, 40))
for k, (im, f) in enumerate(zip(ims, frames)):
    x, y = (k % cols) * (w + 10), (k // cols) * (h + 24)
    S.paste(im, (x, y + 20)); ImageDraw.Draw(S).text((x + 6, y + 4), f"frame {f}", fill=(255, 255, 255))
S.save(out)
print("wrote", out)
