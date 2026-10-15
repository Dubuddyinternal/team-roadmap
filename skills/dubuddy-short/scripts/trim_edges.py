#!/usr/bin/env python3
"""Waveform check of every cut edge (user rule 2026-10-12: a cut must never run into the breath/onset of the next word).
For each segment edge that borders a removed word (or a teaser boundary), measures RMS per 10 ms around the edge and
moves the edge to the quiet valley between words. Prints the RMS strip per edge so odd ones can be eyeballed.
usage: python3 trim_edges.py <ED> [--apply]   (--apply writes plan.end_at / plan.start_at; re-run cut.py after)"""
import json, re, subprocess, sys
from pathlib import Path

ed = Path(sys.argv[1]).expanduser()
plan = json.loads((ed / "plan.json").read_text())
words = {w["i"]: w for w in json.loads((ed / "words.json").read_text())}
tl = json.loads((ed / "timeline.json").read_text())
src = plan["source"]


def rms(a, b):
    out = subprocess.run(["ffmpeg", "-v", "info", "-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", src, "-vn", "-af",
                          "asetnsamples=n=480,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    return [(a + k * .01, -99.0 if v == "-inf" else float(v)) for k, v in enumerate(re.findall(r"RMS_level=(\S+)", out))]


end_at, start_at = dict(plan.get("end_at", {})), dict(plan.get("start_at", {}))
for sg in tl["segments"]:
    a, b = sg["words"][0], sg["words"][-1]
    nxt, prv = words.get(b + 1), words.get(a - 1)
    # END: the valley after the last word, before the next word's onset (search a bit past the scribe end)
    if nxt and (nxt["s"] - sg["e"] < .08):
        r = rms(words[b]["e"] - .12, min(nxt["s"] + .06, words[b]["e"] + .3))
        lo = min(v for _, v in r)
        cand = [t for t, v in r if t >= words[b]["e"] - .06 and v <= lo + 4]
        e = round(cand[0] + .03, 3) if cand else sg["e"]
        if abs(e - sg["e"]) > .02 and str(b) not in plan.get("end_at", {}):
            end_at[str(b)] = e
        print(f"END   {b:>4} {words[b]['text']:<14} {sg['e']:.2f} -> {e:.2f} | " + " ".join(f"{v:.0f}" for _, v in r))
    # START: the valley before the first word (latest quiet frame before its onset)
    if prv and (sg["s"] - prv["e"] < .08):
        r = rms(max(prv["e"] - .06, words[a]["s"] - .3), words[a]["s"] + .06)
        lo = min(v for _, v in r)
        cand = [t for t, v in r if t <= words[a]["s"] + .02 and v <= lo + 4]
        s = round(cand[-1] - .01, 3) if cand else sg["s"]
        if abs(s - sg["s"]) > .02 and str(a) not in plan.get("start_at", {}):
            start_at[str(a)] = s
        print(f"START {a:>4} {words[a]['text']:<14} {sg['s']:.2f} -> {s:.2f} | " + " ".join(f"{v:.0f}" for _, v in r))
print("end_at", end_at, "\nstart_at", start_at)
if "--apply" in sys.argv:
    plan["end_at"], plan["start_at"] = end_at, start_at
    (ed / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False))
    print("applied → re-run cut.py")
