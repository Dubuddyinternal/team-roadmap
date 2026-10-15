#!/usr/bin/env python3
"""Stage 2b — the pre-render brief (nothing is rendered to video here).

    cd ~/Developer/video-use && uv run python ~/.agents/skills/dubuddy-short/scripts/brief.py <edit_dir> [--no-check]

Runs `hyperframes check`, snapshots every graphic over the real footage, and writes:
  brief/brief.md        cut list · full Hinglish captions · graphics table · credits · audio
  brief/sheet.jpg       labelled contact sheet of every snapshot (show this to the user)
  brief/NN_label.png    individual snapshots
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HF = ["npx", "--yes", "hyperframes@0.8.34"]
SKILL_DIR = Path(__file__).resolve().parent.parent


def fmt(t):
    return f"{int(t // 60)}:{t % 60:04.1f}"


def main():
    ed = Path(sys.argv[1]).expanduser().resolve()
    plan = json.loads((ed / "plan.json").read_text())
    tl = json.loads((ed / "timeline.json").read_text())
    hf, bd = ed / "hf", ed / "brief"
    if bd.exists():
        shutil.rmtree(bd)
    bd.mkdir()
    T = tl["duration"]
    W = {w["i"]: w for w in tl["words"]}

    def window(it):
        if "start" in it:
            return float(it["start"]), float(it["start"]) + float(it["dur"])
        return W[it["from"]]["s"] - 0.12, W[it["to"]]["e"] + 0.30

    shots = []  # (time, label)
    if plan.get("hook", {}).get("text"):
        shots.append((0.9, "hook"))
    rows = []
    for n, it in enumerate(plan.get("broll", [])):
        s, e = window(it)
        shots.append((min(e - 0.35, s + max(0.9, (e - s) * 0.6)), f"b{n}_{it.get('display','full')}_{it.get('kind','media')}"))
        said = " ".join(W[i]["text"] for i in range(it["from"], it["to"] + 1) if i in W) if "from" in it else ""
        what = it.get("title") or it.get("text") or it.get("label") or it.get("file") or it.get("kind")
        src = Path(it["file"]).name if it.get("file") else "HyperFrames animation"
        rows.append(f"| B{n} | {fmt(s)}–{fmt(e)} | **{it.get('display','full')}** · {it.get('kind','media')} | "
                    f"{str(what).replace('|', ' / ')} | {src} | “{said}” |")
    # a plain caption moment with no graphics on screen
    busy = [window(it) for it in plan.get("broll", [])] + [(0, float(plan.get("hook", {}).get("dur", 0)))]
    for c in tl["chunks"]:
        m = (c["s"] + c["e"]) / 2
        if m > 3 and not any(a - .3 <= m <= b + .3 for a, b in busy):
            shots.append((c["s"] + min(0.5, (c["e"] - c["s"]) * .6), "captions"))
            break
    cta = plan.get("cta", {})
    if cta.get("url"):
        end = cta.get("mode", "end") == "end"
        shots.append(((T + float(cta.get("dur", 3.0)) if end else T) - 0.4, "cta_endcard" if end else "cta"))
    shots.sort()

    check = ""
    if "--no-check" not in sys.argv:
        r = subprocess.run(HF + ["check"], cwd=hf, capture_output=True, text=True)
        check = re.sub(r"\x1b\[[0-9;]*m", "", r.stdout + r.stderr)
        (bd / "check.txt").write_text(check)

    ats = ",".join(f"{t:.2f}" for t, _ in shots)
    snapdir = hf / "snapshots"
    if snapdir.exists():
        shutil.rmtree(snapdir)
    subprocess.run(HF + ["snapshot", "--at", ats, "--no-end", "--describe", "false"], cwd=hf, check=True, capture_output=True)
    pngs = sorted(snapdir.glob("*.png"), key=lambda p: p.stat().st_mtime)
    # snapshot names contain the timestamp — match by order of requested times
    pngs = sorted(pngs, key=lambda p: float(re.findall(r"(\d+(?:\.\d+)?)", p.stem)[-1]) if re.findall(r"\d", p.stem) else 0)
    tiles = []
    for (t, label), p in zip(shots, pngs):
        dst = bd / f"{len(tiles) + 1:02d}_{label}.png"
        shutil.copy2(p, dst)
        tiles.append((dst, f"{len(tiles) + 1}. {label} @ {fmt(t)}"))

    # contact sheet, 4 per row, 360x640 tiles + label
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
    cols = min(4, len(tiles)) or 1
    rws = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 370 + 10, rws * 690 + 10), "#15131c")
    d = ImageDraw.Draw(sheet)
    for k, (p, lab) in enumerate(tiles):
        im = Image.open(p).convert("RGB").resize((360, 640))
        x, y = 10 + (k % cols) * 370, 10 + (k // cols) * 690
        sheet.paste(im, (x, y))
        d.text((x + 4, y + 648), lab, fill="#ff8c4b", font=font)
    sheet.save(bd / "sheet.jpg", quality=88)                       # full size → for the user
    small = sheet.resize((sheet.width // 2, sheet.height // 2))     # half size → for Claude's own review
    small.save(bd / "sheet_small.jpg", quality=80)

    # ---------- brief.md
    byi = W
    cap_lines = [f"- `{fmt(c['s'])}` " + " ".join(f"**{byi[i]['text']}**" if byi[i]["kw"] else byi[i]["text"] for i in c["words"]) for c in tl["chunks"]]
    cred_p = ed / "broll" / "credits.json"
    cred = json.loads(cred_p.read_text()) if cred_p.exists() else {}
    used = {Path(it["file"]).name for it in plan.get("broll", []) if it.get("file")}
    hook = plan.get("hook", {})
    # ---------- timestamped edit plan (one line per beat, gaps = talking head)
    cta = plan.get("cta") or {}
    end_mode = cta.get("url") and cta.get("mode", "end") == "end"
    TT = T + (float(cta.get("dur", 3.0)) if end_mode else 0)
    beats = []
    if hook.get("text"):
        beats.append((0.0, float(hook.get("dur", 2.2)), f"HOOK card — {hook.get('text', '').replace('|', ' ').replace('*', '')}"))
    for n, it in enumerate(plan.get("broll", [])):
        s0, e0 = window(it)
        lbl = it.get("title") or it.get("text") or it.get("label") or it.get("icon") or it.get("kind")
        beats.append((s0, e0, f"B{n} {it.get('display', 'full').upper()} {it.get('kind', 'media')} — {str(lbl).replace('|', ' ').replace('*', '')}"))
    pun = plan.get("punch") or {}
    for m in pun.get("moments", []):
        if m["at"] in W:
            s0 = W[m["at"]]["s"]
            e0 = W[m["until"]]["e"] if m.get("until") in W else s0 + float(m.get("dur", 2.0))
            beats.append((s0, e0, f"PUNCH-IN {int(float(m.get('level', 1.15)) * 100)}% — “{' '.join(W[i]['text'] for i in range(m['at'], (m.get('until') or m['at']) + 1) if i in W)}”"))
    if end_mode:
        beats.append((T, TT, f"END CARD — {cta.get('line', '')} · {cta.get('url', '')}"))
    elif cta.get("url"):
        beats.append((T - float(cta.get("dur", 3.0)), T, f"CTA overlay — {cta.get('url')}"))
    beats.sort()
    plan_lines, cur = [], 0.0
    for s0, e0, txt in beats:
        if s0 - cur > 0.8:
            plan_lines.append(f"- `{fmt(cur)}–{fmt(s0)}` talking head")
        plan_lines.append(f"- `{fmt(s0)}–{fmt(e0)}` {txt}")
        cur = max(cur, e0)
    if TT - cur > 0.8:
        plan_lines.append(f"- `{fmt(cur)}–{fmt(TT)}` talking head")
    auto = f"auto {'/'.join(str(int(l * 100)) + '%' for l in pun.get('levels', [1.0, 1.1]))} framing change at each of the {len(tl['segments']) - 1} cuts" if pun.get("auto", True) else "no automatic punch-ins"
    mus = plan.get("music") or {}
    need = plan.get("broll_needed") or []
    B = [f"# Brief — {ed.name}", "",
         f"**Final length:** {TT:.1f}s · captions: {tl.get('script', 'hinglish')}, pop · framing: {auto}", "",
         "## 0. Edit plan (timeline)", *plan_lines, "",
         "## 1. Cut", (ed / "cut_report.md").read_text(), "",
         "## 2. Motion graphics & B-roll",
         f"- **Hook** 0:00–{fmt(float(hook.get('dur', 0)))}: {hook.get('kicker', '')} / {hook.get('text', '—')}",
         "", "| # | time | display · kind | on screen | source | said |", "|---|---|---|---|---|---|", *rows, "",
         f"- **CTA** {'end card, +' + str(cta.get('dur', 3.0)) + 's after the speech' if cta.get('mode', 'end') == 'end' else 'overlay, last ' + str(cta.get('dur')) + 's'}: “{cta.get('line', '')}” + {cta.get('url', '—')} typed & clicked", "",
         "## 3. Hinglish captions (pop, word-by-word; **bold** = brand keyword, stays orange)", *cap_lines, "",
         "## 4. Audio",
         f"- Voice loudness-normalised to -14 LUFS (TP -1.5)",
         f"- SFX: {'whoosh on B-roll entrances, pop on cards/steps, typing+click on CTA' if plan.get('sfx', True) else 'off'}",
         f"- Music: {Path(mus['file']).name + ' at ' + str(mus.get('volume', 0.10)) + ' (≈-20 dB under voice), lifts on the end card' if mus.get('file') else 'none'}", "",
         *(["## B-roll still needed (not available — placeholder for you to supply)", *[f"- {n.get('at', '')}: {n.get('what', '')}" for n in need], ""] if need else []),
         "## 5. B-roll credits (for the YouTube description)",
         *([f"- {v['credit']} — {v['license']}" for k, v in cred.items() if k in used] or ["- none needed"]), "",
         f"Contact sheet: {bd / 'sheet.jpg'}"]
    if check:
        tail = [ln for ln in check.splitlines() if re.search(r"error|warn|finding|pass|✓|✗", ln, re.I)][-8:]
        B += ["", "## hyperframes check", "```", *tail, "```"]
    (bd / "brief.md").write_text("\n".join(B))
    # compact summary instead of the full check log (full log: brief/check.txt)
    if check:
        summ = [ln.strip() for ln in check.splitlines() if re.search(r"error\(s\)|✗|text checks|Check (passed|failed)", ln)]
        print("check:", " | ".join(summ[:10]))
    (SKILL_DIR / ".current").write_text(str(ed))   # studio.sh opens this clip
    print(bd / "brief.md", "·", len(tiles), "snapshots")


if __name__ == "__main__":
    main()
