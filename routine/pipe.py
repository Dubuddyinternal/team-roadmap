#!/usr/bin/env python3
"""Dubuddy pipeline: the run's helper for files and reporting (Python standard library only).

    python3 pipe.py start <fire.json>      read the payload, download this step's inputs, print the folders
    python3 pipe.py progress "<message>"   show a progress line on the card
    python3 pipe.py finish                 upload this step's results and report "done"
    python3 pipe.py fail "<reason>"        report that the step could not be finished

The work folder is $PIPE_WORK (default /tmp/dubuddy/job). It always has the same layout, so files
written by one step are where the next step expects them:
    <W>/payload.json        this run's payload
    <W>/raw/raw.mp4         the raw clip            → the skill's edit folder is <W>/raw/edit/raw  (ED)
    <W>/in/                 other inputs (final_yt.mp4, final_ig.mp4 for posting)
    <W>/out/                step results: plan_result.json, render_result.json, seo.json, post_result.json
"""
import json, os, shutil, subprocess, sys, tarfile, time, urllib.request

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


def report(event, message="", result=None, uploaded=None):
    p = load()
    body = json.dumps({"event": event, "message": message, "result": result, "uploaded": uploaded or []}).encode()
    with http("POST", p["callback"], data=body, headers={"content-type": "application/json"}) as r:
        return json.loads(r.read() or b"{}")


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
    if p["step"] == "plan" and "edit" not in (p.get("inputs") or {}):
        shutil.rmtree(os.path.join(W, "raw"), ignore_errors=True)   # a fresh edit: nothing left over from an earlier clip
    for name, url in (p.get("inputs") or {}).items():
        if name == "raw":
            dest = os.path.join(W, "raw", os.path.basename(p.get("raw_name") or "raw.mp4"))   # raw.mp4 / raw.mov
            download(url, dest)
        elif name == "edit":
            t = os.path.join(W, "in", "edit.tar.gz"); download(url, t)
            with tarfile.open(t) as tf:
                tf.extractall(os.path.join(W, "raw"), filter="data")
        elif name == "plan_result":
            download(url, os.path.join(W, "out", "plan_result.json"))
        elif name in ("yt", "ig"):
            download(url, os.path.join(W, "in", f"final_{name}.mp4"))
        got.append(name)
    os.makedirs(os.path.join(W, "out"), exist_ok=True)
    report("progress", f"{p['step']}: inputs ready")
    print(json.dumps({"step": p["step"], "work": W, "edit_folder": ed(), "raw": os.path.join(W, "raw"),
                      "inputs": got, "out": os.path.join(W, "out")}, indent=1))


def first(*paths):
    return next((x for x in paths if x and os.path.isfile(x)), None)


def finish():
    p = load(); step = p["step"]; outs = p.get("outputs") or {}; E = ed(); O = os.path.join(W, "out")
    files = {
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
    if step in ("plan", "render") and os.path.isdir(os.path.join(W, "raw", "edit")):
        # the whole edit folder travels to the next step (minus things that are rebuilt anyway)
        t = os.path.join(W, "in", "edit-out.tar.gz"); os.makedirs(os.path.dirname(t), exist_ok=True)
        skip = ("/node_modules", "/renders", "/.cache", "studio_backups")
        with tarfile.open(t, "w:gz") as tf:
            tf.add(os.path.join(W, "raw", "edit"), arcname="edit", filter=lambda i: None if any(s in i.name for s in skip) else i)
        files["edit"] = t
    uploaded = []
    for name, path in files.items():
        if path and name in outs:
            report("progress", f"uploading {name}…") if name in ("yt", "ig", "edit") else None
            upload(outs[name], path); uploaded.append(name)
    rf = {"plan": "plan_result", "render": "render_result", "seo": "seo", "post": "post_result", "research": "research", "script": "script"}[step]
    result = None
    if files.get(rf):
        with open(files[rf]) as f:
            result = json.load(f)
    r = report("done", f"{step} finished", result, uploaded)
    print(json.dumps({"uploaded": uploaded, "server": r}, indent=1))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "start" and len(sys.argv) > 2: start(sys.argv[2])
    elif cmd == "progress": report("progress", " ".join(sys.argv[2:])); print("ok")
    elif cmd == "finish": finish()
    elif cmd == "fail": print(report("failed", " ".join(sys.argv[2:]) or "The step failed"))
    else: print(__doc__); sys.exit(1)
