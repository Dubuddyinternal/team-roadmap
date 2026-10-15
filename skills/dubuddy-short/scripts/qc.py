#!/usr/bin/env python3
"""Stage 3b — validate final.mp4 and assemble <edit_dir>/output/.

    python3 ~/.agents/skills/dubuddy-short/scripts/qc.py <edit_dir>

Checks: 1080x1920 · source frame rate · expected duration · black frames · frozen frames
(outside the end card) · unexpected silence · true-peak clipping · loudness · missing media.
Writes qc/report.md and output/ = 01_edit_plan.md · 02_transcript.json · 03_captions.json ·
04_final.mp4 · captions.srt · credits.md · (05_broll_requirements.md when plan.broll_needed).
Exit code 1 when a hard check fails.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


def ff(args):
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True).stderr


def main():
    ed = Path(sys.argv[1]).expanduser().resolve()
    plan = json.loads((ed / "plan.json").read_text())
    tl = json.loads((ed / "timeline.json").read_text())
    words = json.loads((ed / "words.json").read_text())
    variant = sys.argv[2] if len(sys.argv) > 2 else ""          # yt | ig | "" (single version)
    suf = f"_{variant}" if variant else ""
    hfd = ed / f"hf{suf}"
    final = ed / f"final{suf}.mp4"
    cta = plan.get("cta") or {}
    T = tl["duration"]
    idx = (hfd / "index.html").read_text()
    expect = float(re.search(r'id="root"[^>]*data-duration="([\d.]+)"', idx).group(1))   # what build.py composed
    end_mode = expect - T > 1.0                                                       # a real end card (not just a held tail)
    speech_end = T

    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate",
                                    "-show_entries", "format=duration", "-of", "json", str(final)], capture_output=True, text=True).stdout)
    v = next(s for s in pr["streams"] if s["codec_type"] == "video")
    a = next((s for s in pr["streams"] if s["codec_type"] == "audio"), None)
    dur = float(pr["format"]["duration"])

    rows, hard = [], False

    def check(name, ok, detail, is_hard=True):
        nonlocal hard
        rows.append(f"| {'✅' if ok else ('❌' if is_hard else '⚠️')} | {name} | {detail} |")
        if not ok and is_hard:
            hard = True

    check("Resolution 1080×1920 (9:16)", (v["width"], v["height"]) == (1080, 1920), f'{v["width"]}×{v["height"]}')
    check("Codec H.264 + AAC", v["codec_name"] == "h264" and a and a["codec_name"] == "aac", f'{v["codec_name"]} / {a and a["codec_name"]}')
    check("Frame rate matches source", v["r_frame_rate"] == str(tl.get("fps")), f'{v["r_frame_rate"]} (source {tl.get("fps")})', False)
    check("Duration", abs(dur - expect) < 0.25, f"{dur:.2f}s (expected {expect:.2f}s)")

    blk = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", ff(["-i", str(final), "-vf", "blackdetect=d=0.25:pix_th=0.06", "-an", "-f", "null", "-"]))
    check("No black frames", not blk, ", ".join(f"{float(x):.1f}–{float(y):.1f}s" for x, y in blk) or "none")

    fz = ff(["-i", str(final), "-vf", "freezedetect=n=0.002:d=1.2", "-an", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"freeze_start: ([\d.]+)", fz)]
    ends = [float(x) for x in re.findall(r"freeze_end: ([\d.]+)", fz)] + [dur] * 5
    frz = [(s0, e0) for s0, e0 in zip(starts, ends) if not (end_mode and s0 >= speech_end - 0.3)]
    check("No frozen frames (outside end card)", not frz, ", ".join(f"{s0:.1f}–{e0:.1f}s" for s0, e0 in frz) or "none", False)

    sil = ff(["-i", str(final), "-af", "silencedetect=n=-45dB:d=0.8", "-vn", "-f", "null", "-"])
    ss = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", sil)]
    se = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", sil)] + [dur] * 5
    gaps = [(s0, e0) for s0, e0 in zip(ss, se) if s0 < speech_end - 0.2]
    check("No unexpected silence during speech", not gaps, ", ".join(f"{s0:.1f}–{e0:.1f}s" for s0, e0 in gaps) or "none")

    eb = ff(["-i", str(final), "-af", "ebur128=peak=true", "-vn", "-f", "null", "-"])
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", eb)[-1])
    tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", eb)[-1])
    check("Loudness ≈ -14 LUFS", abs(I + 14) <= 1.0, f"{I:.1f} LUFS")
    check("No clipping (true peak ≤ -1 dBTP)", tp <= -1.0, f"{tp:.1f} dBTP")

    miss = []
    for src in re.findall(r'src="(assets/[^"]+)"', idx):
        if not (hfd / src).exists():
            miss.append(src)
    check("No missing media", not miss, ", ".join(miss) or "all assets present")

    (ed / f"qc{suf}").mkdir(exist_ok=True)
    rep = ["# QC report", "", "| | check | result |", "|---|---|---|", *rows, "",
           "Cuts are snapped to word boundaries by cut.py (no mid-word cuts); captions and graphics were layout/contrast-checked by `hyperframes check` in the brief."]
    (ed / f"qc{suf}" / "report.md").write_text("\n".join(rep))

    # ---- output/
    out = ed / "output"
    out.mkdir(exist_ok=True)
    brief = ed / "brief" / "brief.md"
    if brief.exists():
        shutil.copy2(brief, out / "01_edit_plan.md")
    byi = {w["i"]: w for w in tl["words"]}
    seg_of = {}
    for sg in tl["segments"]:
        for i in sg["words"]:
            seg_of.setdefault(i, sg)
    transcript = dict(source=tl["source"], language="hi", script=tl.get("script", "hinglish"),
                      words=[dict(i=w["i"], hindi=w.get("dv") or w["raw"], hinglish=w["text"], src_start=w["s"], src_end=w["e"],
                                  kept=w["i"] in byi, out_start=byi[w["i"]]["s"] if w["i"] in byi else None,
                                  out_end=byi[w["i"]]["e"] if w["i"] in byi else None) for w in words if w.get("text")])
    (out / "02_transcript.json").write_text(json.dumps(transcript, ensure_ascii=False, indent=1))
    caps = [dict(start=c["s"], end=c["e"], text=" ".join(byi[i]["text"] for i in c["words"]),
                 words=[dict(text=byi[i]["text"], start=byi[i]["s"], end=byi[i]["e"], emphasis=byi[i]["kw"]) for i in c["words"]])
            for c in tl["chunks"]]
    (out / "03_captions.json").write_text(json.dumps(dict(script=tl.get("script", "hinglish"), style="pop", chunks=caps), ensure_ascii=False, indent=1))
    if variant:                                   # output/youtube/final_yt.mp4 · output/instagram/final_ig.mp4
        vd = out / {"yt": "youtube", "ig": "instagram"}.get(variant, variant)
        vd.mkdir(exist_ok=True)
        shutil.copy2(final, vd / f"final_{variant}.mp4")
    else:
        shutil.copy2(final, out / "04_final.mp4")
    shutil.copy2(ed / "captions.srt", out / "captions.srt")
    need = plan.get("broll_needed") or []
    if need:
        (out / "05_broll_requirements.md").write_text("# B-roll still needed\n\n" + "\n".join(
            f"- **{n.get('at', '')}** — {n.get('what', '')}" + (f" ({n['why']})" if n.get("why") else "") for n in need))
    cred_p = ed / "broll" / "credits.json"
    if cred_p.exists():
        used = {Path(it["file"]).name for it in plan.get("broll", []) if it.get("file")}
        cred = json.loads(cred_p.read_text())
        lines = [f"- {v['credit']} — {v['license']}" for k, v in cred.items() if k in used and v.get("src") != "site"]
        if plan.get("music", {}) and (plan.get("music") or {}).get("credit"):
            lines.append(f"- Music: {plan['music']['credit']}")
        (out / "credits.md").write_text("# Credits (paste into the description)\n\n" + ("\n".join(lines) or "- none required"))
    print("\n".join(rows))
    print(out)
    sys.exit(1 if hard else 0)


if __name__ == "__main__":
    main()
