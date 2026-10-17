#!/usr/bin/env python3
"""Stage 2 — generate the HyperFrames project for one short.

    python3 ~/.agents/skills/dubuddy-short/scripts/build.py <edit_dir>

Reads plan.json + timeline.json (run cut.py first) → <edit_dir>/hf/index.html (+ assets).
Layers (bottom → top): a-roll · split/full B-roll panels · float cards · hook/CTA · pop captions.
B-roll timing: {"from": word_i, "to": word_i} (source word indices — survives re-cuts) or
{"start": s, "dur": d} in OUTPUT seconds. See SKILL.md for every kind's fields.
"""
from __future__ import annotations

import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
ORANGE, WHITE, DIM = "#ff8c4b", "#ffffff", "#9d99a8"


ICONS = {  # 24x24 stroke icons for `mark` badges: (svg path, badge colour)
    "check": ('<path d="M5 12.5 L10 17.5 L19 7" pathLength="1"/>', "#0f7a50"),
    "cross": ('<path d="M6 6 L18 18 M18 6 L6 18"/>', "#c8321f"),
    "question": ('<path d="M8.5 9a3.5 3.5 0 1 1 5 3.2c-.9.5-1.5 1.2-1.5 2.3v.5"/><path d="M12 19.2v.1"/>', "#f26522"),
    "warning": ('<path d="M12 7v6"/><path d="M12 17.2v.1"/>', "#d4521a"),
    "arrow": ('<path d="M5 12h13M13 6l6 6-6 6"/>', "#15131c"),
    "star": ('<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>', "#f26522"),
}


def esc(s):
    return html.escape(str(s), quote=True)


def rich(s):
    """'12th + CUET|*ek saath* kaise?' → line spans, *x* → <em>x</em>."""
    lines = []
    for ln in str(s).split("|"):
        ln = esc(ln)
        ln = re.sub(r"\*(.+?)\*", r"<em>\1</em>", ln)
        lines.append(f'<span class="line">{ln}</span>')
    return "".join(lines)


def img_size(p: Path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(p)], capture_output=True, text=True).stdout
    w = int(re.search(r"pixelWidth: (\d+)", out).group(1))
    h = int(re.search(r"pixelHeight: (\d+)", out).group(1))
    return w, h


def place(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


# platform defaults for --variant (plan["variants"][v] overrides these)
VARIANT_DEFAULTS = {
    "yt": {"cta": {"mode": "overlay", "dur": 1.2, "tail": 0.35, "channel": "DuBuddy", "handle": "@dubuddy"}},
    "ig": {"cta": {"mode": "overlay", "dur": 1.2, "tail": 0.35, "channel": "DuBuddy", "handle": "dubuddy.in"}, "captions": {"y": 1380}},
}


def main():
    ed = Path(sys.argv[1]).expanduser().resolve()
    plan = json.loads((ed / "plan.json").read_text())
    tl = json.loads((ed / "timeline.json").read_text())
    # --variant yt|ig → same edit, platform ending (+ plan["variants"][v] overrides), built into hf_<v>
    variant = sys.argv[sys.argv.index("--variant") + 1] if "--variant" in sys.argv else None
    def merge(a, b):
        for k_, v_ in b.items():
            a[k_] = merge(dict(a.get(k_) or {}), v_) if isinstance(v_, dict) and isinstance(a.get(k_), dict) else v_
        return a
    pv = variant or "yt"                 # base hf/ = the YouTube look (brief + default Studio); cta.style "classic" opts out
    if (plan.get("cta") or {}).get("style") != "classic":
        plan = merge(plan, VARIANT_DEFAULTS.get(pv, {}))
        plan = merge(plan, (plan.get("variants") or {}).get(pv, {}))
        plan.setdefault("cta", {})["style"] = pv
    hf = ed / (f"hf_{variant}" if variant else "hf")
    (hf / "assets" / "broll").mkdir(parents=True, exist_ok=True)
    for sub in ("fonts", "sfx", "ui"):
        shutil.copytree(SKILL / "template/assets" / sub, hf / "assets" / sub, dirs_exist_ok=True)
    if (ed / "sfx").is_dir():      # clip-local SFX (same name overrides the house sound, new names usable in broll sfx lists)
        shutil.copytree(ed / "sfx", hf / "assets" / "sfx", dirs_exist_ok=True)
    place(ed / "cut.mp4", hf / "assets" / "cut.mp4")
    name = re.sub(r"[^a-z0-9-]+", "-", ed.name.lower()).strip("-")
    (hf / "hyperframes.json").write_text(json.dumps({"$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
        "paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
        "media": {"autoProxy": True}, "authoringSkill": "dubuddy-short"}, indent=2))
    (hf / "package.json").write_text(json.dumps({"name": name, "private": True, "type": "module", "scripts": {
        "dev": "npx --yes hyperframes@0.8.34 preview", "check": "npx --yes hyperframes@0.8.34 check",
        "render": "npx --yes hyperframes@0.8.34 render"}}, indent=2))

    T = tl["duration"]                      # speech length (a-roll)
    cta = plan.get("cta") or {}
    end_mode = cta.get("url") and cta.get("mode", "end") == "end"
    TT = round(T + float(cta.get("dur", 3.0)), 3) if end_mode else round(T + float(cta.get("tail", 0)), 3)   # composition length (tail = hold last frame)
    W = {w["i"]: w for w in tl["words"]}
    cap_y = plan.get("captions", {}).get("y", 1440)
    lay = {"split_shift": 460, "split_panel": 840, "split_caption_y": cap_y, "float_side": "right", "float_y": 1060,
           "hook_y": 900, "cta_y": 1050, **plan.get("layout", {})}
    sfx_on = plan.get("sfx", True)

    body, J, audio = [], [], []
    J.append('const tl = gsap.timeline({ paused: true });')

    sfx_len = {}

    def sfx(name, t, vol=0.25):
        if not (sfx_on and 0 <= t < TT):
            return
        if name not in sfx_len:
            sfx_len[name] = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                                  str(hf / "assets/sfx" / f"{name}.mp3")], capture_output=True, text=True).stdout)
        d = min(sfx_len[name], TT - t)
        audio.append(f'<audio id="sfx{len(audio)}" src="assets/sfx/{name}.mp3" data-start="{t:.3f}" data-duration="{d:.3f}" '
                     f'data-track-index="{20 + len(audio)}" data-volume="{vol}"></audio>')

    def window(it):
        if "start" in it:
            s = float(it["start"]); e = s + float(it["dur"])
        else:
            for k in ("from", "to"):
                if it[k] not in W:
                    sys.exit(f"broll {it.get('id')}: word {it[k]} was cut — pick a kept word")
            s = W[it["from"]]["s"] - 0.12
            e = W[it["to"]]["e"] + 0.30
        return max(0.0, round(s, 3)), round(min(e, TT), 3)   # TT: graphics may hold through the tail frame

    def clip(s0, e0, track):
        """Mark an element as a timed clip; the final pass wraps it in a `.clip` wrapper that exists only while
        on screen (its own bar in Studio). The framework owns the wrapper's visibility; GSAP animates the inside."""
        return f'data-wrap="{s0:.3f}|{max(0.05, e0 - s0):.3f}|{track}"'

    def clip_attrs(s0, e0, track):   # for <video>: timed directly (media may not sit inside a timed wrapper)
        return f'data-start="{s0:.3f}" data-duration="{max(0.05, e0 - s0):.3f}" data-track-index="{track}"'

    def at_word(i, default):
        return W[i]["s"] - 0.05 if i is not None and i in W else default

    # ------------------------------------------------------------------ a-roll
    fx, fy = lay.get("face_x", 540), lay.get("face_y", 740)
    css_extra_frame = ""
    fry = float(lay.get("frame_y", 0))     # reframe: negative lifts the speaker; the uncovered strip shows a blurred copy, never black
    if fry:
        body.append(f'<video id="aroll-bg" src="assets/cut.mp4" data-start="0" data-duration="{TT}" data-track-index="9" muted playsinline '
                    f'style="position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover;z-index:0;'
                    f'transform:scale(1.3);filter:blur(38px) brightness(.78) saturate(1.1)"></video>')
        J.append(f'tl.set("#aroll-wrap", {{y: {fry}}}, 0);')
        edge = "to bottom" if fry < 0 else "to top"       # feather the cut edge into the blur (wrap coords)
        css_extra_frame = f"#aroll-wrap{{-webkit-mask-image:linear-gradient({edge},#000 1790px,transparent 1920px);mask-image:linear-gradient({edge},#000 1790px,transparent 1920px)}}"
    body.append(f'<div id="aroll-wrap"><div id="aroll-zoom" style="transform-origin:{fx}px {fy}px">'
                f'<video id="aroll" src="assets/cut.mp4" data-start="0" data-duration="{TT}" '
                f'data-track-index="0" muted playsinline></video></div></div>')
    audio.append(f'<audio id="aroll-audio" src="assets/cut.mp4" data-start="0" data-duration="{T}" data-track-index="10" data-volume="1"></audio>')
    # mattes: speaker cut-outs (transparent webm) layered ABOVE floats so a graphic can sit behind the head.
    # plan.mattes = [{file, start, dur}] — the layer mirrors every #aroll-wrap / #aroll-zoom move (post-processed below)
    mattes = plan.get("mattes") or []
    if mattes:
        mv = []
        for k, mt in enumerate(mattes):
            mp_ = Path(mt["file"]).expanduser()
            mp_ = mp_ if mp_.is_absolute() else ed / mp_
            place(mp_, hf / "assets" / "broll" / mp_.name)
            mv.append(f'<video id="fgm{k}" src="assets/broll/{mp_.name}" data-start="{float(mt["start"]):.3f}" data-duration="{float(mt["dur"]):.3f}" '
                      f'data-track-index="{30 + k}" muted playsinline style="position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover"></video>')
        body.append(f'<div id="fg-wrap" style="position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:21;pointer-events:none">'
                    f'<div id="fg-zoom" style="position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:{fx}px {fy}px">{"".join(mv)}</div></div>')
        if css_extra_frame:
            css_extra_frame = css_extra_frame.replace("#aroll-wrap{", "#aroll-wrap,#fg-wrap{")

    # punch-ins: auto = alternate levels at every cut (hides jump cuts); moments = emphasis on key lines
    pun = plan.get("punch") or {}
    levels = pun.get("levels", [1.0, 1.1])
    seg_starts = [sg["out"] for sg in tl["segments"]]

    def base_level(t):
        k = max([n for n, st in enumerate(seg_starts) if st <= t + 1e-6] or [0])
        return levels[k % len(levels)] if pun.get("auto", True) else 1.0

    moments = []
    for m in pun.get("moments", []):
        if m["at"] not in W:
            sys.exit(f"punch moment: word {m['at']} was cut")
        ms = W[m["at"]]["s"] - 0.04
        me = W[m["until"]]["e"] + 0.15 if m.get("until") in W else ms + float(m.get("dur", 2.0))
        moments.append((ms, min(me, T), float(m.get("level", 1.15)), bool(m.get("smooth", False))))
    ev = []
    if pun.get("auto", True):
        ev += [(st, base_level(st), False) for st in seg_starts[1:]
               if not any(a <= st <= b for a, b, _, _ in moments)]
    for a, b, lv, sm in moments:
        ev += [(a, lv, sm), (b, base_level(b), sm)]
    ev.sort()
    J.append(f'tl.set("#aroll-zoom", {{scale: {base_level(0)}}}, 0);')
    for t0, lv, sm in ev:
        if sm:
            J.append(f'tl.to("#aroll-zoom", {{scale: {lv}, duration: .35, ease: "power2.inOut"}}, {t0:.3f});')
        else:
            J.append(f'tl.set("#aroll-zoom", {{scale: {lv}}}, {t0:.3f});')

    mus = plan.get("music") or {}
    if mus.get("file"):
        mp_ = Path(mus["file"]).expanduser()
        place(mp_, hf / "assets" / "music" / mp_.name)
        mv = float(mus.get("volume", 0.10))       # ~-20 dB under the voice
        audio.append(f'<audio id="bgm" src="assets/music/{mp_.name}" data-start="0" data-duration="{TT}" '
                     f'data-media-start="{mus.get("start", 0)}" data-track-index="15" data-volume="{mv}"></audio>')
        if end_mode:   # music lifts on the end card, then fades out
            J.append(f'tl.to("#bgm", {{volume: {min(1, mv * 3):.3f}, duration: .6}}, {T - .1:.3f});')
        J.append(f'tl.to("#bgm", {{volume: 0, duration: .8}}, {TT - .8:.3f});')

    # ------------------------------------------------------------------ B-roll
    split_windows = []
    for n, it in enumerate(plan.get("broll", [])):
        pid = f"b{n}"
        s, e = window(it)
        disp, kind = it.get("display", "full"), it.get("kind", "media")
        # never open a panel that just sits on its title: start ~0.6 s before the first item animates in
        if kind in ("steps", "list") and "start" not in it:
            ats = [x.get("at") for x in it.get("steps" if kind == "steps" else "items", []) if isinstance(x, dict) and x.get("at") in W]
            if ats and at_word(min(ats), s) - s > 0.8:
                s = round(at_word(min(ats), s) - it.get("lead_in", 0.6), 3)
        d = e - s
        inner = ""
        sib_video = ""        # video B-roll lives beside its panel, animated with it
        reveals = []          # step/chip reveal times (used by face_between)
        for xf in it.get("files", []):       # extra stills a custom item references as assets/broll/<name>
            xp = Path(xf).expanduser()
            xp = xp if xp.is_absolute() else ed / xp
            place(xp, hf / "assets" / "broll" / xp.name)
        media_file = it.get("file")
        if media_file:
            mp = Path(media_file).expanduser()
            if not mp.is_absolute():
                mp = ed / mp
            place(mp, hf / "assets" / "broll" / mp.name)
            rel = f"assets/broll/{mp.name}"
            is_vid = mp.suffix.lower() in (".mp4", ".mov", ".webm", ".m4v")

        if disp == "float" and kind == "mark":
            path, col = ICONS[it.get("icon", "check")]
            sz = it.get("size", 150)
            x = it.get("x", 1080 - 80 - sz if it.get("side", lay["float_side"]) == "right" else 80)
            y = it.get("y", lay["float_y"])
            lab = (f'<span class="mlabel">{esc(it["label"])}</span>' if it.get("label") else "")
            body.append(f'<div id="{pid}" class="mark" {clip(s, e, 4)} style="left:{x}px;top:{y}px;width:{sz}px">'
                        f'<div class="badge" style="width:{sz}px;height:{sz}px;background:{col}">'
                        f'<svg width="{sz * .56:.0f}" height="{sz * .56:.0f}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" '
                        f'stroke-linecap="round" stroke-linejoin="round">{path}</svg></div>{lab}</div>')
            J.append(f'tl.set("#{pid}", {{autoAlpha: 0}}, 0);')
            J.append(f'tl.fromTo("#{pid}", {{autoAlpha: 0, scale: .3, rotation: -25}}, {{autoAlpha: 1, scale: 1, rotation: 0, duration: .45, ease: "back.out(2.4)"}}, {s:.3f});')
            J.append(f'tl.to("#{pid}", {{autoAlpha: 0, scale: .6, duration: .22, ease: "power2.in"}}, {e - .22:.3f});')
            J.append(f'tl.set("#{pid}", {{autoAlpha: 0}}, {e:.3f});')
            sfx("pop", s, 0.3)
            continue

        if disp == "float" and kind == "custom":      # free-form float: html owns its position, js owns entry/exit
            sub_ = lambda t_: re.sub(r"\{W(\d+)\}", lambda m_: f"{at_word(int(m_.group(1)), s + 0.5):.3f}",
                                    t_.replace("{ID}", pid).replace("{S}", f"{s:.3f}").replace("{E}", f"{e:.3f}").replace("{D}", f"{d:.3f}"))
            body.append(f'<div id="{pid}" {clip(s, e, 4)} style="position:absolute;left:0;top:0;z-index:{it.get("z", 20)}">{sub_(it["html"])}</div>')
            J.append(sub_(it.get("js", "")))
            for fx_ in it.get("sfx", [["pop", s, 0.3]]):
                sfx(fx_[0], float(fx_[1]), float(fx_[2]) if len(fx_) > 2 else 0.22)
            continue

        if disp == "float" and kind == "text" and it.get("style", "pill") == "pill":
            # house default: white pill hugging ONE line of text, kicker tag on top, words rise in, *key* word gets an orange sweep
            fs = it.get("size", 46)
            toks = str(it.get("text", "")).replace("|", " ").split()
            ws = f"display:inline-block;font-size:{fs}px;font-weight:800;letter-spacing:-.03em;line-height:1;color:var(--ink)"
            parts, hl_k = [], None
            for k, tk in enumerate(toks):
                if tk in ("=", "→", "+", "vs", "≠"):
                    parts.append(f'<span id="{pid}w{k}" style="display:flex;align-items:center;justify-content:center;width:{fs + 8}px;height:{fs + 8}px;'
                                 f'border-radius:50%;background:var(--cream);font-size:{fs * .85:.0f}px;font-weight:800;color:var(--brand-dark);line-height:1;'
                                 f'padding-bottom:{fs * .15:.0f}px;box-sizing:border-box">{esc(tk)}</span>')
                elif tk.startswith("*") and tk.endswith("*") and len(tk) > 2:
                    hl_k = k
                    parts.append(f'<span id="{pid}w{k}" style="{ws};position:relative;padding:4px 12px;margin:-4px -4px">'
                                 f'<span class="hlb" id="{pid}h{k}" style="position:absolute;inset:0;border-radius:12px;background:var(--brand)"></span>'
                                 f'<span id="{pid}t{k}" style="position:relative;color:var(--brand-dark)">{esc(tk[1:-1])}</span></span>')
                else:
                    parts.append(f'<span id="{pid}w{k}" style="{ws}">{esc(tk)}</span>')
            tag = (f'<div style="position:absolute;left:0;right:0;top:-24px;display:flex;justify-content:center">'
                   f'<span id="{pid}k" style="padding:9px 20px;border-radius:12px;background:#b8430f;font-family:var(--mono);font-size:22px;'
                   f'letter-spacing:.16em;text-transform:uppercase;color:#fff">{esc(it["kicker"])}</span></div>') if it.get("kicker") else ""
            body.append(f'<div id="{pid}" {clip(s, e, 4)} style="position:absolute;left:0;top:0;z-index:20">'
                        f'<div id="{pid}p" style="position:absolute;left:{it.get("x", 540)}px;top:{it.get("y", lay["float_y"])}px;display:flex;align-items:center;gap:18px;'
                        f'padding:26px 38px;border-radius:999px;background:#fff;border:3px solid rgba(242,101,34,.45);box-shadow:0 18px 50px rgba(0,0,0,.30);'
                        f'white-space:nowrap">{tag}{"".join(parts)}</div></div>')
            wsel = "[" + ",".join(f'"#{pid}w{k}"' for k in range(len(toks))) + "]"
            J.append(f'tl.set("#{pid}p", {{xPercent: -50, autoAlpha: 0}}, 0);')
            J.append(f'tl.set({wsel}, {{autoAlpha: 0}}, 0);')
            J.append(f'tl.fromTo("#{pid}p", {{autoAlpha: 0, scaleX: .3, scaleY: .7, y: 40}}, {{autoAlpha: 1, scaleX: 1, scaleY: 1, y: 0, duration: .5, ease: "back.out(1.6)"}}, {s:.3f});')
            if tag:
                J.append(f'tl.fromTo("#{pid}k", {{autoAlpha: 0, y: -18}}, {{autoAlpha: 1, y: 0, duration: .35, ease: "back.out(2.4)"}}, {s + .28:.3f});')
            J.append(f'tl.fromTo({wsel}, {{autoAlpha: 0, y: 34, filter: "blur(8px)"}}, {{autoAlpha: 1, y: 0, filter: "blur(0px)", duration: .42, ease: "power3.out", stagger: .09}}, {s + .3:.3f});')
            if hl_k is not None:
                hit = at_word(it.get("hit"), s + .3 + .09 * len(toks) + .5)
                J.append(f'tl.set("#{pid}h{hl_k}", {{scaleX: 0, transformOrigin: "left center"}}, 0);')
                J.append(f'tl.to("#{pid}h{hl_k}", {{scaleX: 1, duration: .35, ease: "power3.out"}}, {hit:.3f});')
                J.append(f'tl.to("#{pid}t{hl_k}", {{color: "#ffffff", duration: .2}}, {hit + .08:.3f});')
                J.append(f'tl.to("#{pid}p", {{scale: 1.05, duration: .15, yoyo: true, repeat: 1, ease: "power1.out"}}, {hit + .06:.3f});')
                sfx("pop", hit, 0.22)
            J.append(f'tl.to("#{pid}p", {{autoAlpha: 0, y: 30, scale: .85, duration: .28, ease: "power2.in"}}, {e - .28:.3f});')
            J.append(f'tl.set("#{pid}p", {{autoAlpha: 0}}, {e:.3f});')
            sfx("pop", s, 0.3)
            continue

        if disp == "float":
            side = it.get("side", lay["float_side"])
            w_, h_ = it.get("w", 640), it.get("h", 240)
            x = it.get("x", 1080 - 60 - w_ if side == "right" else 60)
            y = it.get("y", lay["float_y"])
            if kind == "stat":
                inner = (f'<div class="bar"></div><div class="ctr" style="top:26px">'
                         f'<span class="statnum" id="{pid}n" style="font-size:{it.get("size", 120)}px">{esc(it.get("prefix",""))}0{esc(it.get("suffix",""))}</span>'
                         f'<span class="statlbl" style="font-size:40px;margin-top:8px">{rich(it.get("label",""))}</span></div>')
            else:
                inner = (f'<div class="bar"></div><div class="ctr" style="top:34px">'
                         + (f'<span class="kicker">{esc(it["kicker"])}</span>' if it.get("kicker") else "")
                         + f'<span class="head" style="font-size:{it.get("size", 58)}px;margin-top:10px">{rich(it.get("text",""))}</span></div>')
            body.append(f'<div id="{pid}" class="card" {clip(s, e, 4)} style="left:{x}px;top:{y}px;width:{w_}px;height:{h_}px;z-index:20">{inner}</div>')
            rot = -2 if side == "right" else 2
            J.append(f'tl.set("#{pid}", {{autoAlpha: 0}}, 0);')
            J.append(f'tl.fromTo("#{pid}", {{autoAlpha: 0, scale: .6, rotation: {rot * 4}, y: 50}}, {{autoAlpha: 1, scale: 1, rotation: {rot}, y: 0, duration: .5, ease: "back.out(1.7)"}}, {s:.3f});')
            J.append(f'tl.to("#{pid}", {{autoAlpha: 0, scale: .85, y: 30, duration: .25, ease: "power2.in"}}, {e - 0.25:.3f});')
            J.append(f'tl.set("#{pid}", {{autoAlpha: 0}}, {e:.3f});')
            sfx("pop", s, 0.3)
            if kind == "stat":
                J.append(f'(() => {{ const o = {{v: 0}}, el = document.getElementById("{pid}n"); tl.to(o, {{v: {it["value"]}, duration: {min(1.2, d * .5):.2f}, ease: "power2.out", '
                         f'onUpdate: () => {{ el.textContent = "{esc(it.get("prefix",""))}" + Math.round(o.v) + "{esc(it.get("suffix",""))}"; }}}}, {s + .2:.3f}); }})();')
            continue

        # split / full panel
        H = lay["split_panel"] if disp == "split" else 1920
        top_pad = 70 if disp == "split" else 250          # content inset from the panel top
        cls = f"panel {disp}"
        if kind in ("media", "site") and media_file:
            if kind == "site":
                full = disp == "full"
                titled = bool(it.get("title") or it.get("chip"))
                # full: phone centred under the title · split: title left, phone right (never overlapping)
                ph_w = 600 if full else 460
                ph_left = 240 if full else (1080 - 60 - ph_w if titled else (1080 - ph_w) // 2)
                ph_top = (470 if titled else 330) if full else 60
                ph_h = 1230 if full else H - 110
                sw, scr_h = ph_w - 44, ph_h - 44
                iw, ih = img_size(mp)
                disp_h = ih * sw / iw
                scroll = min(it.get("scroll", disp_h - scr_h), max(0, disp_h - scr_h))
                inner = (f'<div class="glow" style="left:{ph_left + ph_w // 2 - 450}px;top:{ph_top + ph_h // 2 - 450}px"></div>'
                         f'<div class="phone" style="left:{ph_left}px;top:{ph_top}px;width:{ph_w}px;height:{ph_h}px"><div class="scr">'
                         f'<img id="{pid}i" src="{rel}" alt=""/></div></div>')
                title_right = 60 if full else 1080 - ph_left + 30
                if scroll > 0:
                    J.append(f'tl.fromTo("#{pid}i", {{y: 0}}, {{y: {-scroll:.0f}, duration: {max(.5, d - 1.1):.2f}, ease: "power1.inOut"}}, {s + .6:.3f});')
            elif is_vid:
                sib_video = (f'<video id="{pid}v" class="bvid clip {disp}" src="{rel}" {clip_attrs(s, e, 3)} data-media-start="{it.get("media_start", 0)}" '
                             f'style="height:{H}px" muted playsinline></video>')
            else:
                inner = f'<img id="{pid}i" class="media" src="{rel}" alt=""/>'
                kb = it.get("kenburns", "in")
                a, b = ("1", "1.14") if kb == "in" else ("1.14", "1")
                J.append(f'tl.fromTo("#{pid}i", {{scale: {a}, x: 0}}, {{scale: {b}, x: {it.get("drift", -24)}, duration: {d:.2f}, ease: "none"}}, {s:.3f});')
            if it.get("title") or it.get("chip"):
                inner += ('<div class="scrim"></div>' if kind == "media" else "")
                tr = title_right if kind == "site" else 60
                inner += (f'<div class="ptitle" id="{pid}t" style="top:{(top_pad + 60 if kind == "site" else top_pad) if disp == "split" else 236}px;right:{tr}px">'
                          + (f'<span class="chip">{esc(it["chip"])}</span>' if it.get("chip") else "")
                          + (f'<span class="ttl">{rich(it["title"])}</span>' if it.get("title") else "") + "</div>")
                J.append(f'tl.fromTo("#{pid}t", {{autoAlpha: 0, y: 30}}, {{autoAlpha: 1, y: 0, duration: .4, ease: "power3.out"}}, {s + .35:.3f});')
        elif kind == "steps":
            cls += " cream"
            steps = it.get("steps", [])
            rows = "".join(f'<div class="step" id="{pid}s{k}"><div class="n">{k + 1}</div><div class="t">{rich(st["t"] if isinstance(st, dict) else st)}'
                           + (f'<small>{esc(st["sub"])}</small>' if isinstance(st, dict) and st.get("sub") else "") + '</div></div>'
                           for k, st in enumerate(steps))
            inner = (f'<div class="grid"></div><div class="ptitle" style="top:{top_pad}px">'
                     f'<span class="kicker">{esc(it.get("kicker",""))}</span>'
                     f'<span class="head" style="font-size:{it.get("size", 76)}px;margin-top:14px">{rich(it.get("title",""))}</span></div>'
                     f'<div class="steps" style="top:{top_pad + it.get("steps_top", 300)}px">{rows}</div>')
            for k, st in enumerate(steps):
                t0 = at_word(st.get("at") if isinstance(st, dict) else None, s + 0.55 + k * min(0.9, (d * .6) / max(1, len(steps))))
                reveals.append(t0)
                J.append(f'tl.fromTo("#{pid}s{k}", {{autoAlpha: 0, x: -60}}, {{autoAlpha: 1, x: 0, duration: .4, ease: "back.out(1.6)"}}, {t0:.3f});')
                sfx("pop", t0, 0.22)
        elif kind == "list":
            cls += " cream"
            chips = it.get("items", [])
            ch = "".join(f'<span class="chipx{" on" if (isinstance(c, dict) and c.get("on")) else ""}" id="{pid}c{k}">{esc(c["t"] if isinstance(c, dict) else c)}</span>'
                         for k, c in enumerate(chips))
            inner = (f'<div class="grid"></div><div class="ptitle" style="top:{top_pad}px">'
                     f'<span class="kicker"' + (f' style="font-size:{it["kicker_size"]}px;font-weight:600"' if it.get("kicker_size") else "") + f'>{esc(it.get("kicker",""))}</span>'
                     f'<span class="head" style="font-size:{it.get("size", 68)}px;margin-top:12px">{rich(it.get("title",""))}</span></div>'
                     f'<div class="chips" style="top:{top_pad + it.get("chips_top", 330)}px">{ch}</div>')
            for k, c in enumerate(chips):
                t0 = at_word(c.get("at") if isinstance(c, dict) else None, s + 0.5 + k * 0.28)
                reveals.append(t0)
                J.append(f'tl.fromTo("#{pid}c{k}", {{autoAlpha: 0, scale: .5}}, {{autoAlpha: 1, scale: 1, duration: .35, ease: "back.out(2.2)"}}, {t0:.3f});')
                sfx("pop", t0, 0.2)
        elif kind == "stat":
            cls += " cream"
            inner = (f'<div class="glow" style="left:90px;top:{(H - 900) // 2}px"></div>'
                     f'<div style="position:absolute;left:80px;right:80px;top:{top_pad + it.get("stat_top", 120)}px;text-align:center">'
                     + (f'<span class="kicker">{esc(it["kicker"])}</span>' if it.get("kicker") else "")
                     + f'<span class="statnum" id="{pid}n">{esc(it.get("prefix",""))}0{esc(it.get("suffix",""))}</span>'
                     f'<span class="statlbl">{rich(it.get("label",""))}</span></div>')
            J.append(f'(() => {{ const o = {{v: 0}}, el = document.getElementById("{pid}n"); tl.to(o, {{v: {it["value"]}, duration: {min(1.4, d * .5):.2f}, ease: "power2.out", '
                     f'onUpdate: () => {{ el.textContent = "{esc(it.get("prefix",""))}" + Math.round(o.v) + "{esc(it.get("suffix",""))}"; }}}}, {s + .35:.3f}); }})();')
        elif kind == "custom":
            inner = it["html"].replace("{ID}", pid)
            J.append(re.sub(r"\{W(\d+)\}", lambda m_: f"{at_word(int(m_.group(1)), s + 0.5):.3f}",
                            it.get("js", "").replace("{ID}", pid).replace("{S}", f"{s:.3f}").replace("{E}", f"{e:.3f}").replace("{D}", f"{d:.3f}")))
            for fx_ in it.get("sfx", []):              # [name, output_sec, vol?]
                sfx(fx_[0], float(fx_[1]), float(fx_[2]) if len(fx_) > 2 else 0.22)
        else:
            sys.exit(f"broll {n}: kind '{kind}' needs a file or is unknown")

        if sib_video:
            body.append(sib_video)
        body.append(f'<div id="{pid}" class="{cls}" {clip(s, e, 2)} style="height:{H}px{";background:transparent;z-index:11" if sib_video else ""}">{inner}</div>')
        tg = f"#{pid}"                                            # panel (inside its clip wrapper)
        vg = f"#{pid}v" if sib_video else ""                      # timed video: transforms/clip-path only
        J.append(f'tl.set("{tg}", {{autoAlpha: 0}}, 0);')
        if disp == "split":
            split_windows.append((s, e))
            J.append(f'tl.fromTo("{tg}", {{autoAlpha: 1, yPercent: -100}}, {{autoAlpha: 1, yPercent: 0, duration: .5, ease: "power3.out"}}, {s:.3f});')
            if vg:
                J.append(f'tl.fromTo("{vg}", {{yPercent: -100}}, {{yPercent: 0, duration: .5, ease: "power3.out"}}, {s:.3f});')
                J.append(f'tl.to("{vg}", {{yPercent: -100, duration: .4, ease: "power3.in"}}, {e - .4:.3f});')
            J.append(f'tl.to("#aroll-wrap", {{y: {it.get("shift", lay["split_shift"])}, duration: .5, ease: "power3.out"}}, {s:.3f});')
            J.append(f'tl.to("{tg}", {{yPercent: -100, duration: .4, ease: "power3.in"}}, {e - .4:.3f});')
            J.append(f'tl.to("#aroll-wrap", {{y: {fry}, duration: .4, ease: "power3.in"}}, {e - .4:.3f});')
            J.append(f'tl.set("{tg}", {{autoAlpha: 0}}, {e:.3f});')
        else:
            if vg:
                J.append(f'tl.fromTo("{vg}", {{clipPath: "circle(0% at 50% 45%)"}}, {{clipPath: "circle(120% at 50% 45%)", duration: .55, ease: "power2.inOut"}}, {s:.3f});')
                J.append(f'tl.to("{vg}", {{clipPath: "circle(0% at 50% 45%)", duration: .3, ease: "power1.in"}}, {e - .3:.3f});')
            J.append(f'tl.fromTo("{tg}", {{autoAlpha: 1, clipPath: "circle(0% at 50% 45%)"}}, {{autoAlpha: 1, clipPath: "circle(120% at 50% 45%)", duration: .55, ease: "power2.inOut"}}, {s:.3f});')
            # face_between: between reveals, cut back to the speaker; return just before the next reveal
            # default ON: a gap of ≥ ~3.5 s between items goes back to the face instead of a static panel
            if it.get("face_between", True) and len(reveals) > 1:
                hold, lead = float(it.get("hold", 1.5)), float(it.get("lead", 0.5))
                for k in range(len(reveals) - 1):
                    off, on = reveals[k] + 0.4 + hold, reveals[k + 1] - lead
                    if on - off >= 1.2:          # only worth leaving if the face gets ≥1.2 s
                        J.append(f'tl.to("{tg}", {{autoAlpha: 0, duration: .3, ease: "power1.in"}}, {off:.3f});')
                        J.append(f'tl.to("{tg}", {{autoAlpha: 1, duration: .3, ease: "power1.out"}}, {on - .3:.3f});')
                        sfx("whoosh-short", on - .35, 0.18)
            J.append(f'tl.to("{tg}", {{autoAlpha: 0, duration: .3, ease: "power1.in"}}, {e - .3:.3f});')
            J.append(f'tl.set("{tg}", {{autoAlpha: 0}}, {e:.3f});')
        sfx("whoosh-short", max(0, s - 0.05), 0.24)

    # ------------------------------------------------------------------ hook
    hook = plan.get("hook") or {}
    if hook.get("text"):
        hd = float(hook.get("dur", 2.2))
        hy = hook.get("y", lay["hook_y"])
        # card fits its text: top pad + kicker + lines + bottom pad (incl. 12px accent bar)
        hook_h = round(36 + (44 if hook.get("kicker") else 0) + 10 + (hook["text"].count("|") + 1) * hook.get("size", 80) * 1.04 + 44)
        body.append(f'<div id="hook" class="card" {clip(0, hd, 5)} style="left:60px;top:{hy}px;width:960px;height:{hook.get("h", hook_h)}px;z-index:30">'
                    f'<div class="bar"></div><div class="ctr" style="top:36px">'
                    + (f'<span class="kicker">{esc(hook["kicker"])}</span>' if hook.get("kicker") else "")
                    + f'<span class="head" style="font-size:{hook.get("size", 80)}px;margin-top:10px">{rich(hook["text"])}</span></div></div>')
        J.append('tl.fromTo("#hook", {autoAlpha: 1, clipPath: "inset(0% 100% 0% 0% round 30px)"}, {autoAlpha: 1, clipPath: "inset(-80px -80px -80px -80px round 30px)", duration: .5, ease: "power3.out"}, 0.05);')
        J.append('tl.fromTo("#hook .head", {y: 40, autoAlpha: 0}, {y: 0, autoAlpha: 1, duration: .45, ease: "power3.out"}, 0.2);')
        J.append(f'tl.to("#hook", {{autoAlpha: 0, y: -40, duration: .3, ease: "power2.in"}}, {hd - .3:.3f});')
        J.append(f'tl.set("#hook", {{autoAlpha: 0}}, {hd:.3f});')
        sfx("whoosh-short", 0.0, 0.26)

    # ------------------------------------------------------------------ platform CTA (YouTube Subscribe / Instagram Follow)
    # Plays OVER the last line of speech (no end screen = no skip zone; video ends on the last word and loops).
    def platform_end(cta, c0, body, J, sfx, esc):
        yt = cta["style"] == "yt"
        r = c0
        CT, CL, CW, CH = cta.get("y", 230), 90, 900, 170   # profile card: top of frame, above the head
        BW, BH = (300, 80) if yt else (250, 76)
        bx, by = CL + CW - 36 - BW, CT + (CH - BH) // 2
        ring = "background:linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5);" if not yt else ""
        bell = ('<svg id="ctabell" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
                '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>')
        chev = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
        heart = '<svg width="50" height="50" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.3 4.5 6.8 4.5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.5 0 5.8 3.5 4.3 7.2C19.5 16.4 12 21 12 21z" fill="#ff3040"/></svg>'
        bA = ("Subscribe", "#ff0000", "42px") if yt else ("Follow", "#0095f6", "16px")
        bB = (f'{bell}<span>Subscribed</span>', "#e5e5e5") if yt else (f'<span>Following</span>{chev}', "#efefef")
        btxt = "font-size:34px;font-weight:700;letter-spacing:-.01em;white-space:nowrap"
        cmt = esc(cta.get("comment") or "Comment your doubt")
        hearts = "" if yt else "".join(f'<div id="ctaht{k}" style="position:absolute;left:{bx + BW // 2 - 25}px;top:{by - 6}px">{heart}</div>' for k in range(3))
        MT = cta.get("comment_y", 1110)                     # comment pill: chest, above captions
        body.append(
            f'<div id="cta" {clip(c0, TT, 6)} style="position:absolute;left:0;top:0;z-index:30">'
            f'<div id="ctapc" style="position:absolute;left:{CL}px;top:{CT}px;width:{CW}px;height:{CH}px;border-radius:34px;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.35)">'
            f'<div id="ctaring" style="position:absolute;left:28px;top:{(CH - 122) // 2}px;width:122px;height:122px;border-radius:50%;{ring}"></div>'
            f'<img src="assets/ui/avatar.png" alt="" style="position:absolute;left:35px;top:{(CH - 108) // 2}px;width:108px;height:108px;border-radius:50%;border:4px solid #fff;box-sizing:border-box"/>'
            f'<div style="position:absolute;left:172px;top:{CH // 2 - 44}px;width:{bx - CL - 185}px">'
            f'<div style="font-size:42px;font-weight:800;letter-spacing:-.03em;color:#0f0f0f;white-space:nowrap">{esc(cta.get("channel", "DuBuddy"))}</div>'
            f'<div style="margin-top:6px;font-size:25px;font-weight:600;color:#606060;white-space:nowrap">{esc(cta.get("handle", "@dubuddy"))}{"" if cta.get("handle") == cta.get("url", "dubuddy.in") else " · " + esc(cta.get("url", "dubuddy.in"))}</div></div></div>'
            f'<div id="ctabtn" style="position:absolute;left:{bx}px;top:{by}px;width:{BW}px;height:{BH}px;border-radius:{bA[2]};background:{bA[1]}">'
            f'<div id="ctaA" style="position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;{btxt};color:#fff">{bA[0]}</div>'
            f'<div id="ctaB" style="position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:10px;{btxt};color:#0f0f0f">{bB[0]}</div></div>'
            f'{hearts}'
            f'<div id="ctacm" style="position:absolute;left:{CL + 60}px;top:{MT}px;width:{CW - 120}px;height:104px;border-radius:52px;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.35);'
            f'display:flex;align-items:center;gap:18px;padding:0 16px 0 30px;box-sizing:border-box">'
            f'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f26522" stroke-width="2.3" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>'
            f'<div style="position:relative;flex:1;height:104px;display:flex;align-items:center">'
            f'<span style="visibility:hidden;{btxt};font-size:40px;font-weight:800">{cmt}</span>'
            f'<div id="ctacmm" style="position:absolute;left:0;top:0;height:100%;width:0;overflow:hidden;display:flex;align-items:center">'
            f'<span style="{btxt};font-size:40px;font-weight:800;color:#15131c">{cmt}</span></div></div>'
            f'<div id="ctasend" style="flex:0 0 74px;height:74px;border-radius:50%;background:var(--brand);display:flex;align-items:center;justify-content:center">'
            f'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-7-6 16-3-6z"/></svg></div></div>'
            f'<svg id="ctacur" viewBox="0 0 30 36" fill="none" style="position:absolute;left:{bx + BW - 66}px;top:{by + BH - 28}px;width:60px">'
            f'<path d="M4 2 L4 29 L11.2 22.4 L15.6 33.2 L20.4 31.2 L16 20.6 L25.6 20.6 Z" fill="#15131c" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></svg>'
            f'</div>')
        J.extend([
            'tl.set(["#ctapc","#ctabtn","#ctacm","#ctacur","#ctaB"], {autoAlpha: 0}, 0);',
            f'tl.fromTo(["#ctapc","#ctabtn"], {{autoAlpha: 0, y: {-70 if CT < 960 else 70}, scale: .92}}, {{autoAlpha: 1, y: 0, scale: 1, duration: .38, ease: "back.out(1.6)"}}, {r:.3f});',
            f'tl.fromTo("#ctacur", {{autoAlpha: 0, x: 200, y: 170}}, {{autoAlpha: 1, x: 0, y: 0, duration: .3, ease: "power3.out"}}, {r + .3:.3f});',
            f'tl.to("#ctabtn", {{scale: .9, duration: .07, ease: "power2.out"}}, {r + .6:.3f});',
            f'tl.to("#ctabtn", {{scale: 1, backgroundColor: "{bB[1]}", duration: .28, ease: "back.out(3)"}}, {r + .67:.3f});',
            f'tl.to("#ctaA", {{autoAlpha: 0, duration: .1}}, {r + .64:.3f});',
            f'tl.set("#ctaA", {{autoAlpha: 0}}, {r + .74:.3f});',
            f'tl.fromTo("#ctaB", {{autoAlpha: 0, y: 12}}, {{autoAlpha: 1, y: 0, duration: .22, ease: "power2.out"}}, {r + .68:.3f});',
        ] + ([] if cta.get("comment") is False else [      # comment:false → a custom overlay owns the comment pill
            f'tl.fromTo("#ctacm", {{autoAlpha: 0, y: 50}}, {{autoAlpha: 1, y: 0, duration: .35, ease: "back.out(1.6)"}}, {r + .55:.3f});',
            f'tl.fromTo("#ctacmm", {{width: "0%"}}, {{width: "100%", duration: .5, ease: "steps(18)"}}, {r + .75:.3f});',
            f'tl.fromTo("#ctasend", {{scale: .4}}, {{scale: 1, duration: .3, ease: "back.out(3)"}}, {r + 1.22:.3f});',
        ]))
        sfx("whoosh-short", r, 0.22)
        sfx("pop", r + .6, 0.4)          # button tap: pop + chime (user pick, both platforms)
        sfx("chime", r + .69, 0.25)
        if cta.get("comment") is not False:
            sfx("typing", r + .75, 0.16)
        if yt:
            J.extend([
                'tl.set("#ctabell", {transformOrigin: "50% 12%"}, 0);',
                f'tl.to("#ctacur", {{x: {-(BW - 66) + 42}, y: {BH // 2 - 24}, duration: .22, ease: "power2.inOut"}}, {r + .82:.3f});',
                f'tl.to("#ctabell", {{scale: .8, duration: .06}}, {r + .98:.3f});',
                f'tl.to("#ctabell", {{keyframes: [{{scale: 1.15, rotation: 22}}, {{rotation: -20}}, {{rotation: 15}}, {{rotation: -10}}, {{scale: 1, rotation: 0}}], duration: .45, ease: "none"}}, {r + 1.03:.3f});',
            ])
            sfx("click", r + .98, 0.35)     # bell tap (chime already played on Subscribe)
        else:
            J.append(f'tl.fromTo("#ctaring", {{rotation: 0}}, {{rotation: 360, duration: 1.1, ease: "power2.inOut"}}, {r + .1:.3f});')
            for k, (dx, dl) in enumerate(((-40, 0), (10, .08), (45, .16))):
                J.extend([f'tl.set("#ctaht{k}", {{autoAlpha: 0}}, 0);',
                          f'tl.fromTo("#ctaht{k}", {{autoAlpha: 0, scale: .3, y: 0, x: 0}}, {{autoAlpha: 1, scale: {1.1 - k * .15:.2f}, y: -62, x: {dx}, duration: .35, ease: "power2.out"}}, {r + .68 + dl:.3f});',
                          f'tl.to("#ctaht{k}", {{autoAlpha: 0, y: -100, scale: .6, duration: .3, ease: "power1.in"}}, {r + 1.045 + dl:.3f});'])
        J.append(f'tl.to("#ctacur", {{autoAlpha: 0, duration: .2}}, {r + (1.25 if yt else .95):.3f});')

    # ------------------------------------------------------------------ CTA
    if cta.get("url"):
        cd = float(cta.get("dur", 3.0))
        if end_mode:   # branded end card after the speech: ink + glow, CTA centred
            c0 = T
            cy = cta.get("y", 800)
            body.append(f'<div id="endbg" class="panel" {clip(T - .2, TT, 5)} style="height:1920px;z-index:25"><div class="glow" style="left:90px;top:520px"></div></div>')
            J.append('tl.set("#endbg", {autoAlpha: 0}, 0);')
            J.append(f'tl.fromTo("#endbg", {{autoAlpha: 0}}, {{autoAlpha: 1, duration: .35, ease: "power1.out"}}, {T - .2:.3f});')
        else:          # overlay on the last seconds of speech
            c0 = max(0, T - cd)
            cy = cta.get("y", lay["cta_y"])
        if cta.get("style") in ("yt", "ig"):
            platform_end(cta, c0, body, J, sfx, esc)
            cta = {}
        host, _, rest = (cta.get("url") or "").partition(".")
        url_html = f'{esc(host)}<b>.{esc(rest)}</b>' if rest else esc(host)
    if cta.get("url"):
        body.append(
            f'<div id="cta" class="card cta" {clip(c0, TT, 6)} style="top:{cy}px;background:#faf8f4">'
            f'<img class="logo" src="assets/ui/logo.png" alt="Dubuddy"/>'
            f'<span class="ln">{esc(cta.get("line", ""))}</span>'
            f'<div class="row"><div class="pill" id="ctapill"><div class="zone"><span class="url sizer">{url_html}</span>'
            f'<div class="mask" id="ctamask"><span class="url">{url_html}</span></div></div></div>'
            f'<div class="go" id="ctago"><svg width="46" height="46" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>'
            f'<svg class="cursor" id="ctacur" viewBox="0 0 30 36" fill="none"><path d="M4 2 L4 29 L11.2 22.4 L15.6 33.2 L20.4 31.2 L16 20.6 L25.6 20.6 Z" fill="#15131c" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></svg>'
            f'</div>')
        J += [f'tl.set("#cta", {{autoAlpha: 0}}, 0);',
              f'tl.fromTo("#cta", {{autoAlpha: 0, y: 80, scale: .9}}, {{autoAlpha: 1, y: 0, scale: 1, duration: .5, ease: "back.out(1.5)"}}, {c0:.3f});',
              f'tl.fromTo("#ctamask", {{width: "0%"}}, {{width: "100%", duration: .9, ease: "steps({max(4, len(cta["url"]))})"}}, {c0 + .45:.3f});',
              f'tl.fromTo("#ctacur", {{x: 260, y: 120, autoAlpha: 0}}, {{x: 0, y: 0, autoAlpha: 1, duration: .5, ease: "power3.out"}}, {c0 + 1.3:.3f});',
              f'tl.to("#ctapill", {{scale: .94, duration: .08, ease: "power2.out"}}, {c0 + 1.85:.3f});',
              f'tl.to("#ctapill", {{scale: 1, duration: .2, ease: "back.out(3)"}}, {c0 + 1.93:.3f});',
              f'tl.fromTo("#ctago", {{scale: .4}}, {{scale: 1, duration: .45, ease: "back.out(3)"}}, {c0 + 1.95:.3f});']
        sfx("whoosh-short", c0, 0.24)
        sfx("typing", c0 + 0.45, 0.2)
        sfx("click", c0 + 1.85, 0.4)
        sfx("chime", c0 + 1.98, 0.2)

    # ------------------------------------------------------------------ pop captions
    for k, c in enumerate(tl["chunks"]):
        mid = (c["s"] + c["e"]) / 2
        y = lay["split_caption_y"] if any(a <= mid <= b for a, b in split_windows) else cap_y
        spans = "".join(f'<span class="w{" kw" if W[i]["kw"] else ""}" id="c{k}w{j}">{esc(W[i]["text"])}</span>'
                        for j, i in enumerate(c["words"]))
        body.append(f'<div class="cap clip{" deva" if tl.get("script") == "devanagari" else ""}" id="c{k}" data-start="{c["s"]:.3f}" data-duration="{c["e"] - c["s"]:.3f}" '
                    f'data-track-index="7" style="top:{y - 60}px"><div class="plate" id="c{k}p">{spans}</div></div>')
        J.append(f'tl.fromTo("#c{k}p", {{scale: .86, autoAlpha: 0}}, {{scale: 1, autoAlpha: 1, duration: .14, ease: "back.out(2)"}}, {c["s"]:.3f});')
        for j, i in enumerate(c["words"]):
            w = W[i]
            ws, we = w["s"], max(w["e"], w["s"] + 0.2)
            J.append(f'tl.to("#c{k}w{j}", {{keyframes: [{{color: "{ORANGE}", scale: 1.14, duration: .08, ease: "power2.out"}}, '
                     f'{{scale: 1, duration: .18, ease: "power2.out"}}]}}, {ws:.3f});')
            J.append(f'tl.to("#c{k}w{j}", {{color: "{ORANGE if w["kw"] else WHITE}", duration: .08}}, {we:.3f});')

    def wrap(h):
        m = re.search(r' data-wrap="([\d.]+)\|([\d.]+)\|(\d+)"', h)
        if not m:
            return h
        eid = re.search(r'id="([^"]+)"', h).group(1)
        return (f'<div id="{eid}-clip" class="clip layer" data-start="{m.group(1)}" data-duration="{m.group(2)}" '
                f'data-track-index="{m.group(3)}">' + h.replace(m.group(0), "", 1) + '</div>')
    body = [wrap(h) for h in body]

    J.append('window.__timelines["main"] = tl;')
    css = (SKILL / "template/style.css").read_text() + css_extra_frame
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1080, height=1920"/>
<title>{esc(ed.name)}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
{css}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1920" data-duration="{TT}">
{chr(10).join(body)}
{chr(10).join(audio)}
</div>
<script>
{chr(10).join(J).replace('"#aroll-wrap"', '"#aroll-wrap,#fg-wrap"').replace('"#aroll-zoom"', '"#aroll-zoom,#fg-zoom"') if mattes else chr(10).join(J)}
</script>
</body>
</html>
"""
    # protect hand edits made in Studio (razor/trim/keyframes): never overwrite them silently
    import hashlib, time
    idx, stamp = hf / "index.html", hf / ".built_sha"
    # ignore what Studio rewrites on save (data-hf-id attrs, "/>" vs ">", doctype case) — only real edits count
    norm = lambda t: hashlib.sha1(re.sub(r"\s*/>", ">", re.sub(r'\s?data-hf-id="[^"]*"', "", t)).replace("<!DOCTYPE", "<!doctype").encode()).hexdigest()
    if idx.exists() and stamp.exists() and norm(idx.read_text()) != stamp.read_text().strip():
        (ed / "studio_backups").mkdir(exist_ok=True)
        backup = ed / "studio_backups" / f"{hf.name}.studio-{time.strftime('%Y%m%d-%H%M%S')}.html"
        shutil.copy2(idx, backup)
        if "--force" not in sys.argv:
            sys.exit(f"STUDIO EDITS DETECTED — index.html was changed by hand since the last build.\n"
                     f"Backed up to {backup.name}. Not overwritten. Either keep the Studio version (skip build.py; "
                     f"render as-is), or re-run with --force to regenerate from plan.json (Studio edits are lost, backup kept).")
    idx.write_text(page)
    stamp.write_text(norm(page))
    print(hf / "index.html", f"· {len(plan.get('broll', []))} broll · {len(tl['chunks'])} caption chunks · {len(audio) - 1} sfx")


if __name__ == "__main__":
    main()
