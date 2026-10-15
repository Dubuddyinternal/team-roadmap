#!/usr/bin/env python3
"""Stage 1b — apply plan.json: cut the video and build the output-timeline word map.

    python3 ~/.agents/skills/dubuddy-short/scripts/cut.py <edit_dir> [--no-video]

Reads plan.json + words.json. Writes:
  cut.mp4          1080x1920 30fps, 30ms audio fades at every cut (skipped with --no-video)
  timeline.json    segments + every kept word on the OUTPUT timeline (+ caption chunks)
  captions.srt     Hinglish SRT on the output timeline
  cut_report.md    kept/removed list for the brief
plan.spell: {"#57": "text"} fixes one word; {"पूछे": "pooche"} fixes every occurrence AND is
learned into glossary.json (Devanagari keys only).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent


def source_fps(src):
    """Match the source frame rate (e.g. DJI 30000/1001); fall back to 30 for odd/variable rates."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                        "-of", "csv=p=0", str(src)], capture_output=True, text=True).stdout.strip()
    try:
        n, d = (int(x) for x in r.split("/"))
        f = n / d
    except Exception:
        return "30", 30.0
    return (r, f) if 23 <= f <= 61 else ("30", 30.0)


def srt_ts(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    ed = Path(sys.argv[1]).expanduser().resolve()
    no_video = "--no-video" in sys.argv
    plan = json.loads((ed / "plan.json").read_text())
    words = json.loads((ed / "words.json").read_text())
    src = Path(plan["source"])
    FPS_S, FPS = source_fps(src)
    cap = plan.get("captions", {})
    script = cap.get("script", "hinglish")
    emphasis = set(cap.get("emphasis", []))

    # --- spelling overrides (+ learn Devanagari ones into the glossary)
    spell = plan.get("spell", {})
    gl = json.loads((SKILL / "glossary.json").read_text())
    learned = 0
    for k, v in spell.items():
        if k.startswith("#"):
            words[int(k[1:])]["text"] = v
            continue
        for w in words:
            core = re.sub(r"[.,!?।…:;\"']", "", w["raw"].strip())
            if core == k or core.lower() == k.lower():
                trail = re.search(r"[.,!?]*$", w["text"] or "").group(0)
                w["text"] = v + trail
        if re.search(r"[ऀ-ॿ]", k) and gl["hinglish"].get(k) != v:
            gl["hinglish"][k] = v
            learned += 1
    if learned:
        (SKILL / "glossary.json").write_text(json.dumps(gl, ensure_ascii=False, indent=2))
    kwset = {re.sub(r"\W", "", k.lower()) for k in gl.get("keywords", [])}

    remove = set(plan.get("remove", []))
    max_gap = plan.get("max_gap", 0.4)
    pad_in, pad_out = plan.get("pad", [0.06, 0.10])

    # --- build source segments from kept words
    def segments_for(idxs):
        segs, cur = [], []
        for i in idxs:
            w = words[i]
            if i in remove or not w["text"]:
                if cur:
                    segs.append(cur); cur = []
                continue
            if cur and (w["s"] - words[cur[-1]]["e"] > max_gap or i != cur[-1] + 1 and any(j in remove for j in range(cur[-1] + 1, i))):
                segs.append(cur); cur = []
            cur.append(i)
        if cur:
            segs.append(cur)
        out = []
        for seg in segs:
            a, b = seg[0], seg[-1]
            s = words[a]["s"] - pad_in
            e = words[b]["e"] + pad_out
            # never leak a removed word's audio; never overlap a neighbouring kept word
            if a > 0:
                p = words[a - 1]
                s = max(s, p["e"] if (a - 1) in remove else (p["e"] + words[a]["s"]) / 2)
            if b + 1 < len(words):
                q = words[b + 1]
                e = min(e, q["s"] if (b + 1) in remove else (words[b]["e"] + q["s"]) / 2)
            ov = plan.get("end_at", {})                  # end_at: {"<word idx>": source sec} — hand-trim a segment that ends on that word
            if str(b) in ov:
                e = float(ov[str(b)])
            ov = plan.get("start_at", {})                # start_at: same for the segment's first word
            if str(a) in ov:
                s = float(ov[str(a)])
            out.append(dict(words=seg, s=round(max(0, s), 3), e=round(e, 3)))
        return out

    all_idx = list(range(len(words)))
    segs = []
    if plan.get("teaser"):
        a, b = plan["teaser"]
        for sg in segments_for(range(a, b + 1)):
            sg["teaser"] = True
            segs.append(sg)
    if plan.get("teaser") and plan.get("teaser_move"):      # teaser_move: the teaser words play only up front, not again in the body
        a, b = plan["teaser"]
        all_idx = [i for i in all_idx if not a <= i <= b]
    segs += segments_for(all_idx)

    # --- output timeline (frame-quantised so audio/video stay locked)
    t = 0.0
    out_words = []
    for sg in segs:
        sg["dur"] = round(round((sg["e"] - sg["s"]) * FPS) / FPS, 4)
        sg["out"] = round(t, 4)
        for i in sg["words"]:
            w = words[i]
            shown = (w.get("dv") or w["raw"]).strip() if script == "devanagari" else w["text"]
            if script == "devanagari" and f"#{i}" in spell:
                shown = spell[f"#{i}"]
            out_words.append(dict(i=i, text=shown, s=round(t + w["s"] - sg["s"], 3), e=round(min(t + w["e"] - sg["s"], t + sg["dur"]), 3),
                                  kw=re.sub(r"\W", "", (w["text"] or "").lower()) in kwset or i in emphasis, teaser=bool(sg.get("teaser"))))
        t += sg["dur"]
    total = round(t, 3)

    # --- caption chunks (2-4 words, break on punctuation / pauses / segment joins)
    mw, mc = cap.get("max_words", 4), cap.get("max_chars", 22)
    chunks, cur = [], []
    for k, w in enumerate(out_words):
        cur.append(w)
        nxt = out_words[k + 1] if k + 1 < len(out_words) else None
        chars = sum(len(x["text"]) + 1 for x in cur)
        brk = (nxt is None or len(cur) >= mw or re.search(r"[.?!,।]$", w["text"]) or nxt["s"] - w["e"] > 0.35
               or chars + len(nxt["text"]) > mc)
        if brk:
            chunks.append(cur); cur = []
    # avoid 1-word orphans by merging into the previous chunk when it fits
    merged = []
    for c in chunks:
        if merged and len(c) == 1 and len(merged[-1]) < mw and c[0]["s"] - merged[-1][-1]["e"] < 0.3 \
                and sum(len(x["text"]) + 1 for x in merged[-1] + c) - 1 <= mc \
                and not re.search(r"[.?!]$", merged[-1][-1]["text"]):   # never exceed max_words / max_chars
            merged[-1] += c
        elif merged and len(c) == 1 and len(merged[-1]) >= 3 and c[0]["s"] - merged[-1][-1]["e"] < 0.3 \
                and not re.search(r"[.?!,।]$", merged[-1][-1]["text"]):   # rebalance: pull the previous word in
            merged.append([merged[-1].pop()] + c)
        else:
            merged.append(c)
    cjson = []
    for k, c in enumerate(merged):
        end = c[-1]["e"] + 0.3
        if k + 1 < len(merged):
            end = min(end, merged[k + 1][0]["s"])
        cjson.append(dict(s=round(c[0]["s"], 3), e=round(max(end, c[-1]["e"]), 3), words=[w["i"] for w in c]))

    tl = dict(source=str(src), duration=total, fps=FPS_S, script=script, segments=segs, words=out_words, chunks=cjson)
    (ed / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1))

    byi = {w["i"]: w for w in out_words}
    srt = []
    for n, c in enumerate(cjson, 1):
        txt = " ".join(byi[i]["text"] for i in c["words"])
        srt.append(f"{n}\n{srt_ts(c['s'])} --> {srt_ts(c['e'])}\n{txt}\n")
    (ed / "captions.srt").write_text("\n".join(srt))

    # --- report
    src_dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                                   capture_output=True, text=True).stdout)
    R = [f"**Length:** {src_dur:.1f}s → **{total:.1f}s** ({len(segs)} segments, {len(remove)} words removed)", "",
         "| # | out | source | kept line |", "|---|---|---|---|"]
    for n, sg in enumerate(segs, 1):
        line = " ".join(words[i]["text"] for i in sg["words"])
        R.append(f"| {n}{' (teaser)' if sg.get('teaser') else ''} | {sg['out']:.1f}s | {sg['s']:.1f}–{sg['e']:.1f} | {line} |")
    rem = sorted(remove)
    if rem:
        R += ["", "**Removed:** " + ", ".join(f"`{words[i]['text'] or words[i]['raw']}` @{words[i]['s']:.1f}s" for i in rem)]
    (ed / "cut_report.md").write_text("\n".join(R))

    if not no_video:
        fc, n = [], len(segs)
        for k, sg in enumerate(segs):
            d = sg["e"] - sg["s"]
            fc.append(f"[0:v]trim=start={sg['s']}:duration={sg['dur']},setpts=PTS-STARTPTS,fps={FPS_S},"
                      f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v{k}]")
            fc.append(f"[0:a]atrim=start={sg['s']}:duration={sg['dur']},asetpts=PTS-STARTPTS,aresample=48000,"
                      f"afade=t=in:d=0.03,afade=t=out:st={max(0, sg['dur'] - 0.03):.3f}:d=0.03[a{k}]")
        fc.append("".join(f"[v{k}][a{k}]" for k in range(n)) + f"concat=n={n}:v=1:a=1[v][a]")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]",
                        "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-r", FPS_S,
                        "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", str(ed / "cut.mp4")], check=True)
    print(f"{total:.2f}s · {len(segs)} segments · {len(cjson)} caption chunks · learned {learned} spellings")


if __name__ == "__main__":
    main()
