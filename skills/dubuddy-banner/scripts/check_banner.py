"""Delivery checks for a banner Lottie (run before handing files to the app/web team).

usage: python3 check_banner.py <file.json> [frames...]
  - plain-Lottie checklist: no "sid"/"slots", no text layers, no images, no expressions
  - size, fps, duration, raw and gzip size
  - loop seam: renders the first two and last two frames; the last->first jump must be no bigger
    than a normal frame step (otherwise the loop visibly pops)
  - optional extra frames are rendered to check/<name>/ and put on a contact sheet for review
Needs render_frames.cjs and sheet.py next to this script (setup_project.sh puts them there).
"""
import gzip, json, os, re, shutil, subprocess, sys, tempfile
from PIL import Image, ImageChops, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1]
extra = sys.argv[2:]
raw = open(src, "rb").read()
L = json.loads(raw)
s = raw.decode()
problems = []

def walk_layers(layers):
    for l in layers:
        yield l
all_layers = list(walk_layers(L["layers"])) + [l for a in L.get("assets", []) for l in a.get("layers", [])]
if '"sid"' in s: problems.append('contains "sid" (slot references) - lottie-ios rejects these')
if '"slots"' in s: problems.append('contains a "slots" block')
if any(l.get("ty") == 5 for l in all_layers): problems.append("contains text layers - convert copy to vector glyphs")
if any(a.get("p") for a in L.get("assets", [])): problems.append("contains image assets")
if re.search(r'"x"\s*:\s*"', s): problems.append("contains expressions")

dur = (L["op"] - L["ip"]) / L["fr"]
print(f"{os.path.basename(src)}: {L['w']}x{L['h']} @ {L['fr']:g}fps, {dur:.2f}s, "
      f"{len(raw) // 1024} KB raw / {len(gzip.compress(raw)) // 1024} KB gzip")

tmp = tempfile.mkdtemp()
scene = os.path.join(tmp, "scene"); frames = os.path.join(tmp, "frames")
os.makedirs(scene); os.makedirs(frames)
shutil.copy(src, os.path.join(scene, "lottie.json"))
last = int(L["op"]) - 1
fs = [0, 1, last - 1, last]
env = dict(os.environ, SCALE="1", PAD="5")
subprocess.run(["node", os.path.join(HERE, "render_frames.cjs"), scene, frames, *map(str, fs + [int(x) for x in extra])],
               check=True, capture_output=True, env=env)
img = lambda n: Image.open(os.path.join(frames, f"f{n:05d}.png")).convert("RGBA")
def diff(a, b):
    return sum(ImageStat.Stat(ImageChops.difference(img(a), img(b))).mean[:3]) / 3
normal = max(diff(0, 1), diff(last - 1, last))
seam = diff(last, 0)
ok_seam = seam <= normal * 1.5 + 0.05
print(f"loop seam: last->first {seam:.3f} vs normal step {normal:.3f} -> {'seamless' if ok_seam else 'POPS'}")
if not ok_seam: problems.append("loop seam pops: frame 0 and the last frame don't match")

if extra:
    name = os.path.splitext(os.path.basename(src))[0]
    dest = os.path.join(os.path.dirname(os.path.abspath(src)), "check", name)
    os.makedirs(dest, exist_ok=True)
    for x in extra:
        shutil.copy(os.path.join(frames, f"f{int(x):05d}.png"), os.path.join(dest, f"f{int(x):05d}.png"))
    subprocess.run([sys.executable, os.path.join(HERE, "sheet.py"), os.path.join(dest, "sheet.png"), dest, *extra], check=True)
shutil.rmtree(tmp)

if problems:
    print("FAIL:\n  - " + "\n  - ".join(problems)); sys.exit(1)
print("PASS: plain Lottie (no slots, text layers, images or expressions) and a seamless loop")
