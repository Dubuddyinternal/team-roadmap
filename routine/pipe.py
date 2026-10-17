#!/usr/bin/env python3
"""Dubuddy pipeline: the run's helper for files and reporting (Python standard library only).

    python3 pipe.py start <fire.json>      read the payload, download this step's inputs, print the folders
    python3 pipe.py progress "<message>"   show a progress line on the card
    python3 pipe.py finish                 upload this step's results and report "done"
    python3 pipe.py fail "<reason>"        report that the step could not be finished

  Chat runs (the edit chat in claude.ai — Claude stays in the session and reports each stage):
    python3 pipe.py busy proposing|building|rendering "<what>"   the card shows Claude is working on it
    python3 pipe.py waiting "<question>"   the card shows Claude is waiting for you in the chat
    python3 pipe.py stage proposal         uploads OUT/proposal.json (+ the edit folder) → card: "Plan ready"
    python3 pipe.py stage built            uploads brief, plan_result, live preview, edit folder → card: ▶ live player
    python3 pipe.py stage rendered         uploads the rendered versions (+ edit folder) → card: the videos
    python3 pipe.py refs                   downloads the "Files for Claude" on the card into <W>/refs
    python3 pipe.py restore                after a pause, if the work folder is gone: downloads raw + edit again

The work folder is $PIPE_WORK (default /tmp/dubuddy/job). It always has the same layout, so files
written by one step are where the next step expects them:
    <W>/payload.json        this run's payload
    <W>/raw/raw.mp4         the raw clip            → the skill's edit folder is <W>/raw/edit/raw  (ED)
    <W>/in/                 other inputs (final_yt.mp4, final_ig.mp4 for posting)
    <W>/out/                step results: plan_result.json, render_result.json, seo.json, post_result.json
"""
import json, os, shutil, subprocess, sys, tarfile, time, urllib.request, zipfile

W = os.environ.get("PIPE_WORK", "/tmp/dubuddy/job")
P = os.path.join(W, "payload.json")


def load():
    with open(P) as f:
        return json.load(f)


def http(method, url, data=None, headers=None, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
            return urllib.request.urlopen(req, timeout=600)
        except Exception as e:  # network blips: try again, then give up loudly
            if i == tries - 1:
                raise RuntimeError(f"{method} failed: {e}")
            time.sleep(3 * (i + 1))


def download(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with http("GET", url) as r, open(dest + ".part", "wb") as f:
        shutil.copyfileobj(r, f, 1 << 20)
    os.replace(dest + ".part", dest)


def upload(url, src):
    size = os.path.getsize(src)
    for i in range(3):
        with open(src, "rb") as f:
            try:
                http("PUT", url, data=f, headers={"Content-Length": str(size)}, tries=1).close()
                return
            except RuntimeError:
                if i == 2:
                    raise
                time.sleep(3 * (i + 1))


def post(body):
    p = load()
    with http("POST", p["callback"], data=json.dumps(body).encode(), headers={"content-type": "application/json"}) as r:
        out = json.loads(r.read() or b"{}")
    d = out.get("data") or {}
    if d.get("ignored"):   # cancelled on the card, or a newer edit took over: say so plainly, don't keep working
        sys.exit("STOP: " + (d.get("why") or "the card no longer listens to this run") + " Tell the owner in the chat.")
    if out.get("error"):
        sys.exit("The website said: " + out["error"])
    return out


def report(event, message="", result=None, uploaded=None):
    return post({"event": event, "message": message, "result": result, "uploaded": uploaded or []})


def links_for(names):
    return (post({"event": "uploads", "names": names}).get("data") or {}).get("links") or {}


def edit_tar():
    """the whole edit folder, so the next step / a later 'Edit again' continues from it (minus things rebuilt anyway)"""
    if not os.path.isdir(os.path.join(W, "raw", "edit")):
        return None
    t = os.path.join(W, "in", "edit-out.tar.gz"); os.makedirs(os.path.dirname(t), exist_ok=True)
    skip = ("/node_modules", "/renders", "/.cache", "studio_backups", "/output/", "/final_", "/final.mp4", "/qc_", ".proxy.mp4")
    with tarfile.open(t, "w:gz") as tf:
        tf.add(os.path.join(W, "raw", "edit"), arcname="edit", filter=lambda i: None if any(s in i.name for s in skip) else i)
    return t


def targets():
    t = load().get("targets") or ["yt", "ig"]
    return [x for x in t if x in ("yt", "ig")] or ["yt", "ig"]


# the skill reads the SFX library where OneDrive keeps it on the Mac, so put it at the same path here
SFX_LIB = os.path.expanduser("~/Library/CloudStorage/OneDrive-Personal/Assests/Sound Effects")


def sfx_library(url):
    if os.path.isdir(SFX_LIB) and os.listdir(SFX_LIB):
        return "already there"
    z = os.path.join(W, "in", "sound-effects.zip")
    try:
        download(url, z)
    except RuntimeError:
        return "not uploaded yet (house sounds only)"
    tmp = SFX_LIB + ".unzip"
    shutil.rmtree(tmp, ignore_errors=True)
    with zipfile.ZipFile(z) as zf:
        zf.extractall(tmp, [m for m in zf.namelist() if "__MACOSX" not in m and ".." not in m])
    os.remove(z)
    root = tmp   # the folder that holds "Editing SFX", else the zip's single top folder
    for d, subs, _ in os.walk(tmp):
        if "Editing SFX" in subs: root = d; break
    else:
        top = [x for x in os.listdir(tmp) if not x.startswith(".")]
        if len(top) == 1 and os.path.isdir(os.path.join(tmp, top[0])): root = os.path.join(tmp, top[0])
    os.makedirs(os.path.dirname(SFX_LIB), exist_ok=True)
    shutil.rmtree(SFX_LIB, ignore_errors=True)
    shutil.move(root, SFX_LIB)
    shutil.rmtree(tmp, ignore_errors=True)
    n = sum(len(f) for _, _, f in os.walk(SFX_LIB))
    return f"{n} files at {SFX_LIB}"


def ed():
    return os.path.join(W, "raw", "edit", "raw")


def start(src):
    os.makedirs(W, exist_ok=True)
    with open(src) as f:
        p = json.load(f)
    if not p.get("callback") or not p.get("step"):
        sys.exit("This isn't a pipeline payload")
    with open(P, "w") as f:
        json.dump(p, f, indent=1)
    got = []
    if p["step"] in ("chat", "propose", "plan") and "edit" not in (p.get("inputs") or {}):
        shutil.rmtree(os.path.join(W, "raw"), ignore_errors=True)   # a fresh edit: nothing left over from an earlier clip
    notes = {}
    for name, url in (p.get("inputs") or {}).items():
        if name == "sfx_library":
            notes["sfx_library"] = sfx_library(url)
            continue
        if name == "raw":
            dest = os.path.join(W, "raw", os.path.basename(p.get("raw_name") or "raw.mp4"))   # raw.mp4 / raw.mov
            download(url, dest)
        elif name == "edit":
            t = os.path.join(W, "in", "edit.tar.gz"); download(url, t)
            with tarfile.open(t) as tf:
                tf.extractall(os.path.join(W, "raw"), filter="data")
        elif name == "plan_result":
            download(url, os.path.join(W, "out", "plan_result.json"))
        elif name == "proposal":   # the plan the owner approved at Check 1
            download(url, os.path.join(W, "out", "proposal.json"))
        elif name in ("yt", "ig"):
            download(url, os.path.join(W, "in", f"final_{name}.mp4"))
        elif name == "clean_audio":
            download(url, os.path.join(W, "in", os.path.basename(p.get("clean_name") or "raw-clean.wav")))
        got.append(name)
    if "clean_audio" in got and "raw" in got:
        notes["clean_audio"] = use_clean_audio(p)
    os.makedirs(os.path.join(W, "out"), exist_ok=True)
    report("progress", f"{p['step']}: inputs ready")
    print(json.dumps({"step": p["step"], "work": W, "edit_folder": ed(), "raw": os.path.join(W, "raw"),
                      "inputs": got, "out": os.path.join(W, "out"), "targets": targets(), "chat": bool(p.get("chat")),
                      "reedit": p.get("reedit"), **notes}, indent=1))


def use_clean_audio(p):
    """The owner's cleaned audio (Adobe Podcast) replaces the camera sound in the raw video, picture untouched, so
    every later step — transcript, cuts, captions, render — hears the clean voice."""
    raw = os.path.join(W, "raw", os.path.basename(p.get("raw_name") or "raw.mp4"))
    clean = os.path.join(W, "in", os.path.basename(p.get("clean_name") or "raw-clean.wav"))
    dur = lambda f: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                         capture_output=True, text=True).stdout.strip() or 0)
    dv, da = dur(raw), dur(clean)
    if abs(dv - da) > 1.5:   # a different recording, or trimmed in Adobe: the words would drift out of sync
        return f"NOT used: the cleaned audio is {da:.1f}s but the video is {dv:.1f}s — upload the cleaned version of this clip's audio"
    tmp = raw + ".clean" + os.path.splitext(raw)[1]
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-i", clean, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-t", f"{dv:.3f}", tmp], capture_output=True, text=True)
    if r.returncode != 0:
        return "NOT used: couldn't put the cleaned audio into the video — " + r.stderr.strip()[-200:]
    os.replace(raw, raw + ".camera-audio" + os.path.splitext(raw)[1]); os.replace(tmp, raw)
    return f"swapped in: the raw video now has the cleaned audio ({da:.1f}s)"


def first(*paths):
    return next((x for x in paths if x and os.path.isfile(x)), None)


def upload_preview(E, variants=None):
    """▶ live player on the card: hf_yt/ and/or hf_ig/ go up file by file (the card plays index.html itself)."""
    skip = ("node_modules", "renders", ".cache", ".built_sha", ".DS_Store")
    names = []
    for hf in ["hf_" + v for v in (variants or ["yt", "ig"])]:
        base = os.path.join(E, hf)
        for d, subs, fs in os.walk(base):
            subs[:] = [x for x in subs if x not in skip]
            names += [os.path.relpath(os.path.join(d, f), E) for f in fs if f not in skip]
    if not names:
        return False
    # smooth on a phone: a light 720p copy of every big .mp4 (the player downloads it before playing); renders keep the originals
    proxied, made = {}, {}
    for n in [x for x in names if x.lower().endswith(".mp4") and ".proxy." not in x and os.path.getsize(os.path.join(E, x)) > 15e6]:
        src = os.path.join(E, n); dst = src[:-4] + ".proxy.mp4"
        try:
            if not (os.path.isfile(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)):
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", "scale=-2:1280", "-c:v", "libx264", "-preset", "veryfast",
                                "-crf", "28", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", dst], check=True, timeout=900)
            made[n] = os.path.relpath(dst, E)
        except Exception as e:
            print("preview copy skipped for", n, e)
    names += [m for m in made.values() if m not in names]
    for hfdir in sorted({n.split("/")[0] for n in names if n.endswith("/index.html")}):
        ix = os.path.join(E, hfdir, "index.html"); html = open(ix, encoding="utf-8").read(); changed = False
        for orig, prox in made.items():
            if not orig.startswith(hfdir + "/"): continue
            rel, prel = orig[len(hfdir) + 1:], prox[len(hfdir) + 1:]
            for q in ('"', "'"):
                k = f"src={q}{rel}{q}"
                if k in html: html = html.replace(k, f"{k} data-proxy={q}{prel}{q}"); changed = True
        if changed:
            tmp = os.path.join(W, "in", f"preview-{hfdir}-index.html"); os.makedirs(os.path.dirname(tmp), exist_ok=True)
            open(tmp, "w", encoding="utf-8").write(html); proxied[f"{hfdir}/index.html"] = tmp
    p = load()
    body = json.dumps({"event": "links", "names": names}).encode()
    with http("POST", p["callback"], data=body, headers={"content-type": "application/json"}) as r:
        links = (json.loads(r.read() or b"{}").get("data") or {}).get("links") or {}
    if not any(f"hf_{v}/index.html" in links for v in (variants or ["yt", "ig"])):
        return False
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda n: upload(links[n], os.path.join(E, n)), [n for n in names if n in links and n not in proxied]))
    for n, tmp in proxied.items():   # index.html with data-proxy pointers (the edit folder's own file is untouched)
        if n in links: upload(links[n], tmp)
    return True


def finish():
    p = load(); step = p["step"]; outs = p.get("outputs") or {}; E = ed(); O = os.path.join(W, "out")
    files = {
        "propose": {"proposal": first(f"{O}/proposal.json")},
        "plan":   {"brief_sheet": first(f"{E}/brief/sheet.jpg"), "brief_md": first(f"{E}/brief/brief.md"),
                   "plan_result": first(f"{O}/plan_result.json")},
        "render": {"yt": first(f"{E}/output/youtube/final_yt.mp4", f"{E}/final_yt.mp4"),
                   "ig": first(f"{E}/output/instagram/final_ig.mp4", f"{E}/final_ig.mp4"),
                   "render_result": first(f"{O}/render_result.json")},
        "seo":    {"seo": first(f"{O}/seo.json")},
        "post":   {"post_result": first(f"{O}/post_result.json")},
        "research": {"research": first(f"{O}/research.json")},
        "script": {"script": first(f"{O}/script.json")},
    }[step]
    if step == "render":   # only the versions asked for (an older render of the other one may still be in the folder)
        for v in ("yt", "ig"):
            if v not in targets(): files[v] = None
    if step in ("propose", "plan", "render") and os.path.isdir(os.path.join(W, "raw", "edit")):
        # the whole edit folder travels to the next step (minus things that are rebuilt anyway)
        t = os.path.join(W, "in", "edit-out.tar.gz"); os.makedirs(os.path.dirname(t), exist_ok=True)
        skip = ("/node_modules", "/renders", "/.cache", "studio_backups", "/output/", "/final_", "/final.mp4", "/qc_", ".proxy.mp4")
        with tarfile.open(t, "w:gz") as tf:
            tf.add(os.path.join(W, "raw", "edit"), arcname="edit", filter=lambda i: None if any(s in i.name for s in skip) else i)
        files["edit"] = t
    uploaded = []
    if step == "plan":
        try:
            report("progress", "uploading the live preview…")
            if upload_preview(E): uploaded.append("preview")
        except Exception as e:  # the brief still counts without the player
            print("live preview upload skipped:", e)
    for name, path in files.items():
        if path and name in outs:
            report("progress", f"uploading {name}…") if name in ("yt", "ig", "edit") else None
            upload(outs[name], path); uploaded.append(name)
    rf = {"propose": "proposal", "plan": "plan_result", "render": "render_result", "seo": "seo", "post": "post_result", "research": "research", "script": "script"}[step]
    result = None
    if files.get(rf):
        with open(files[rf]) as f:
            result = json.load(f)
    r = report("done", f"{step} finished", result, uploaded)
    print(json.dumps({"uploaded": uploaded, "server": r}, indent=1))


def stage(name):
    """chat runs: hand one stage to the card, then carry on chatting"""
    p = load(); E = ed(); O = os.path.join(W, "out"); tv = targets()
    files, result = {}, {}
    if name == "proposal":
        files = {"proposal": first(f"{O}/proposal.json")}
        if not files["proposal"]: sys.exit("Write OUT/proposal.json first")
        result = json.load(open(files["proposal"]))
    elif name == "built":
        files = {"brief_sheet": first(f"{E}/brief/sheet.jpg"), "brief_md": first(f"{E}/brief/brief.md"), "plan_result": first(f"{O}/plan_result.json")}
        if not files["plan_result"]: sys.exit("Write OUT/plan_result.json first")
        result = json.load(open(files["plan_result"]))
        result["variants"] = [v for v in tv if os.path.isfile(os.path.join(E, f"hf_{v}", "index.html"))]
    elif name == "rendered":
        files = {"yt": first(f"{E}/output/youtube/final_yt.mp4", f"{E}/final_yt.mp4") if "yt" in tv else None,
                 "ig": first(f"{E}/output/instagram/final_ig.mp4", f"{E}/final_ig.mp4") if "ig" in tv else None,
                 "render_result": first(f"{O}/render_result.json")}
        if not (files["yt"] or files["ig"]): sys.exit("No rendered video found for " + " / ".join(tv))
        result = json.load(open(files["render_result"])) if files["render_result"] else {}
        result["variants"] = [v for v in ("yt", "ig") if files.get(v)]
    else:
        sys.exit("stage is proposal | built | rendered")
    t = edit_tar()
    if t: files["edit"] = t
    names = [n for n, f in files.items() if f]
    links = links_for(names); uploaded = []
    if name == "built":
        report("progress", "uploading the live preview…")
        try:
            if upload_preview(E, result["variants"]): uploaded.append("preview")
        except Exception as e:
            print("live preview upload skipped:", e)
    for n in names:
        if n in links:
            if n in ("yt", "ig", "edit"): report("progress", f"uploading {n}…")
            upload(links[n], files[n]); uploaded.append(n)
    r = post({"event": "stage", "stage": name, "result": result, "uploaded": uploaded})
    print(json.dumps({"stage": name, "uploaded": uploaded, "server": r}, indent=1))


def downloads():
    return post({"event": "downloads"}).get("data") or {}


def refs():
    d = downloads(); out = []
    for f in d.get("refs") or []:
        dest = os.path.join(W, "refs", f["name"]); download(f["url"], dest); out.append(dest)
    print(json.dumps({"refs": out, "count": len(out)}, indent=1))


def restore():
    """a chat picked up after a pause: the cloud computer may be new, so bring the work folder back from storage"""
    if os.path.isdir(ed()) and os.listdir(ed()):
        print(json.dumps({"restored": False, "edit_folder": ed(), "note": "still here"})); return
    d = downloads(); L = d.get("links") or {}; p = load()
    if "raw" in L: download(L["raw"], os.path.join(W, "raw", os.path.basename(p.get("raw_name") or "raw.mp4")))
    if "edit" in L:
        t = os.path.join(W, "in", "edit.tar.gz"); download(L["edit"], t)
        with tarfile.open(t) as tf: tf.extractall(os.path.join(W, "raw"), filter="data")
    for n in ("proposal", "plan_result"):
        if n in L: download(L[n], os.path.join(W, "out", n + ".json"))
    print(json.dumps({"restored": True, "edit_folder": ed(), "got": sorted(L), "targets": d.get("targets")}, indent=1))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "start" and len(sys.argv) > 2: start(sys.argv[2])
    elif cmd == "progress": report("progress", " ".join(sys.argv[2:])); print("ok")
    elif cmd == "finish": finish()
    elif cmd == "fail": print(report("failed", " ".join(sys.argv[2:]) or "The step failed"))
    elif cmd == "busy" and len(sys.argv) > 2: print(post({"event": "busy", "what": sys.argv[2], "message": " ".join(sys.argv[3:])}))
    elif cmd == "waiting": print(post({"event": "waiting", "message": " ".join(sys.argv[2:])}))
    elif cmd == "stage" and len(sys.argv) > 2: stage(sys.argv[2])
    elif cmd == "refs": refs()
    elif cmd == "restore": restore()
    else: print(__doc__); sys.exit(1)
