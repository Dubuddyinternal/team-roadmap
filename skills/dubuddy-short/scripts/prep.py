#!/usr/bin/env python3
"""Stage 1 — analyse a raw Dubuddy short.

    cd ~/Developer/video-use && uv run python ~/.agents/skills/dubuddy-short/scripts/prep.py <video>

Writes to <footage_dir>/edit/<stem>/ :
  words.json     every spoken word: i, raw, text (glossary-fixed Hinglish), s, e, flags
  plan.json      DRAFT plan — auto-removed fillers, empty hook/broll/cta for Claude to fill
  analysis.md    compact sentence view with word indices, retake candidates, unknown words
  frames/        5 reference frames of the raw footage (for placing graphics around the face)
Transcripts are cached in <footage_dir>/edit/transcripts/ (shared with video-use).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path.home() / "Developer/video-use/helpers"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from translit import has_deva, translit  # noqa: E402

# Pure noise — removed automatically. Anything with meaning is only flagged.
HARD_FILLERS = {"um", "umm", "ummm", "uh", "uhh", "uhm", "hmm", "hmmm", "mm", "aa", "aaa", "ah", "er", "erm",
                "अ", "आ", "अं", "उम", "उम्म", "हम्म", "हम", "ऽ", "ए"}
SOFT_FILLERS = {"matlab", "basically", "actually", "like", "so", "okay", "ok", "toh", "na", "haan", "yaani",
                "you know", "i mean", "right", "मतलब", "यानी", "तो", "ना", "हाँ", "हां", "वो", "अच्छा", "बेसिकली"}
PUNCT = re.compile(r"^([\"'(“‘]*)(.*?)([.,!?।…:;\"')”’]*)$")


def norm(t: str) -> str:
    return re.sub(r"[^\wऀ-ॿ]", "", t.lower())


def load_glossary():
    g = json.loads((SKILL / "glossary.json").read_text())
    return g["fix"], g["hinglish"], set(g.get("keywords", []))


INFO_RX = re.compile(r"(\d|₹|%|\.in$|\.com$|\.ac\.in$)", re.I)
INFO_WORDS = {  # whole words only (lowercase / Devanagari) — numbers, dates, money, deadlines, warnings
    "rupees", "rupaye", "rupay", "रुपये", "रुपए", "lakh", "लाख", "hazaar", "हज़ार", "हजार", "percent", "प्रतिशत", "percentile",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
    "last", "deadline", "date", "तारीख", "website", "portal", "form", "forms", "fee", "fees", "फीस", "rank", "cutoff", "cut-off",
    "एक", "दो", "तीन", "चार", "पांच", "पाँच", "छह", "सात", "आठ", "नौ", "दस", "सौ", "पहला", "दूसरा", "तीसरा",
    "one", "two", "three", "four", "five", "first", "second", "third", "important", "ज़रूरी", "जरूरी", "mistake", "गलती", "ग़लती",
    "warning", "ध्यान", "free", "फ्री", "सिर्फ", "only",
}


def is_info(*texts):
    for t in texts:
        core = re.sub(r"[^\w\u0900-\u097F.%₹-]", "", (t or "").strip()).lower().strip(".")
        if INFO_RX.search(core) or core in INFO_WORDS:
            return True
    return False


def deva_word(raw: str, fix: dict):
    """Devanagari caption text: Scribe's own script (English words stay Roman) + brand fixes."""
    m = PUNCT.match(raw.strip())
    lead, core, trail = m.group(1), m.group(2), m.group(3)
    if core.lower() in fix:
        return lead + fix[core.lower()] + trail
    return raw.strip()


def fix_word(raw: str, fix: dict, hing: dict):
    """Return (display_text, source) where source is glossary|hinglish|auto|asis."""
    m = PUNCT.match(raw.strip())
    lead, core, trail = m.group(1), m.group(2), m.group(3)
    trail = trail.replace("।", ".")
    key = core.lower()
    if key in fix:
        return lead + fix[key] + trail, "glossary"
    if has_deva(core):
        if core in hing:
            return lead + hing[core] + trail, "hinglish"
        return lead + translit(core) + trail, "auto"
    return raw.strip().replace("।", "."), "asis"


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    video = Path(sys.argv[1]).expanduser().resolve()
    if not video.exists():
        sys.exit(f"not found: {video}")
    edit_root = video.parent / "edit"
    out = edit_root / video.stem
    (out / "frames").mkdir(parents=True, exist_ok=True)

    from transcribe import load_api_key, transcribe_one  # video-use helper
    tpath = edit_root / "transcripts" / f"{video.stem}.json"
    if not tpath.exists():
        tpath = transcribe_one(video, edit_root, load_api_key(), language="hin")
    tr = json.loads(tpath.read_text())

    probe = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,r_frame_rate:stream_side_data=rotation:format=duration", "-of", "json", str(video)],
        capture_output=True, text=True, check=True).stdout)
    st = probe["streams"][0]
    dur = float(probe["format"]["duration"])

    fix, hing, kws = load_glossary()
    words, unknown = [], {}
    for w in tr["words"]:
        if w["type"] not in ("word", "audio_event"):
            continue
        i = len(words)
        if w["type"] == "audio_event":
            words.append(dict(i=i, raw=w["text"], text=None, s=w["start"], e=w["end"], flags=["event"], src="event"))
            continue
        text, src = fix_word(w["text"], fix, hing)
        flags = []
        n = norm(w["text"])
        if n in HARD_FILLERS:
            flags.append("filler")
        elif n in SOFT_FILLERS or norm(text) in SOFT_FILLERS:
            flags.append("soft")
        if src == "auto":
            flags.append("auto-hinglish")
            unknown.setdefault(PUNCT.match(w["text"].strip()).group(2), []).append(i)
        if norm(text) in {norm(k) for k in kws}:
            flags.append("kw")
        if w.get("logprob", 0) < -1.2:
            flags.append("lowconf")
        if is_info(w["text"], text):
            flags.append("info")
        words.append(dict(i=i, raw=w["text"], text=text, dv=deva_word(w["text"], fix), s=round(w["start"], 3), e=round(w["end"], 3),
                          flags=flags, src=src))

    # retake candidates: a normalised 3-gram that re-occurs within 12 s
    spoken = [w for w in words if w["text"]]
    grams = {}
    retakes = []
    for k in range(len(spoken) - 2):
        g = tuple(norm(spoken[k + j]["text"]) for j in range(3))
        if not all(g):
            continue
        for prev in grams.get(g, []):
            if spoken[k]["s"] - spoken[prev]["s"] < 12 and k - prev >= 3:
                retakes.append((spoken[prev]["i"], spoken[k]["i"]))
        grams.setdefault(g, []).append(k)
    # collapse overlapping pairs
    merged = []
    for a, b in sorted(set(retakes)):
        if merged and a <= merged[-1][1]:
            continue
        merged.append((a, b))

    remove = [w["i"] for w in words if "filler" in w["flags"] or "event" in w["flags"]]

    # sentences: break on terminal punctuation or a gap > 0.6 s
    sents, cur = [], []
    for k, w in enumerate(words):
        cur.append(w)
        nxt = words[k + 1] if k + 1 < len(words) else None
        if nxt is None or re.search(r"[.?!।]$", w["raw"].strip()) or nxt["s"] - w["e"] > 0.6:
            sents.append(cur)
            cur = []

    (out / "words.json").write_text(json.dumps(words, ensure_ascii=False, indent=0))
    plan_path = out / "plan.json"
    if not plan_path.exists():
        plan = {
            "source": str(video),
            "remove": remove,
            "max_gap": 0.4,
            "pad": [0.06, 0.10],
            "spell": {},
            "hook": {"text": "", "accent": "", "kicker": "", "dur": 2.2},
            "teaser": None,
            "broll": [],
            "cta": {"line": "Free PYQs & tests", "url": "dubuddy.in", "dur": 3.0, "mode": "end"},
            "captions": {"script": "hinglish", "y": 1440, "max_words": 4, "max_chars": 22, "emphasis": []},
            "punch": {"auto": True, "levels": [1.0, 1.1], "moments": []},
            "music": None,
            "broll_needed": [],
            "sfx": True,
            "layout": {"face_x": 540, "face_y": 740, "split_shift": 520, "split_panel": 840, "split_caption_y": 905,
                       "float_side": "right", "float_y": 1060, "hook_y": 230},
        }
        plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2))

    # reference frames of the raw footage
    for k, f in enumerate([0.15, 0.3, 0.5, 0.7, 0.9]):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{dur * f:.2f}", "-i", str(video), "-frames:v", "1",
                        "-vf", "scale=360:-2", str(out / "frames" / f"raw_{k}.jpg")], check=True)

    L = [f"# {video.name}", "",
         f"{st['width']}x{st['height']} @ {st['r_frame_rate']} · {dur:.2f}s · lang {tr.get('language_code')} "
         f"({tr.get('language_probability', 0):.2f}) · {len(spoken)} words",
         f"auto-removed: {len(remove)} fillers/events · frames: {out/'frames'}", "",
         "## Sentences  (`idx:text`, *=filler auto-removed, ~=soft filler, ?=auto-hinglish, !=low confidence, #=key info → consider emphasis/callout)", ""]
    for s in sents:
        toks = []
        for w in s:
            mark = "*" if w["i"] in remove else "~" if "soft" in w["flags"] else ""
            mark += "?" if "auto-hinglish" in w["flags"] else ""
            mark += "!" if "lowconf" in w["flags"] else ""
            mark += "#" if "info" in w["flags"] else ""
            toks.append(f"{w['i']}:{w['text'] or w['raw']}{mark}")
        gap_before = s[0]["s"] - (words[s[0]["i"] - 1]["e"] if s[0]["i"] else 0)
        gap = f" [pause {gap_before:.1f}s]" if gap_before > 0.4 else ""
        L.append(f"- {s[0]['s']:.1f}–{s[-1]['e']:.1f}{gap} " + " ".join(toks))
    L += ["", "## Retake candidates (same 3 words repeated within 12s — keep the better take)", ""]
    L += [f"- first take @{a} ({words[a]['s']:.2f}s) … repeat @{b} ({words[b]['s']:.2f}s)" for a, b in merged] or ["- none"]
    L += ["", "## Auto-transliterated words — check spelling, add fixes to plan.spell", ""]
    L += [f"- {raw} → {translit(raw)}  (x{len(ix)}, first @{ix[0]})" for raw, ix in unknown.items()] or ["- none"]
    (out / "analysis.md").write_text("\n".join(L))
    print(out / "analysis.md")


if __name__ == "__main__":
    main()
