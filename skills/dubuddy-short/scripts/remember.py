#!/usr/bin/env python3
"""Save (or drop) one of the owner's standing rules in this skill and push it to GitHub `main`, so every copy of the
skill gets it: the cloud edits (they start from main) and the Mac (its copy pulls main at every Claude Code start).

    python3 remember.py add "<rule>"       add the rule to "Your rules" at the end of SKILL.md
    python3 remember.py remove "<rule>"    take it out again

Only for what the owner explicitly asked to remember for EVERY video — never for one video's brief or card boxes.
Prints one JSON line: {"ok": true, "commit": "<sha>"} / {"ok": true, "note": "already there"} / {"ok": false, "error": "…"}.
The SKILL.md this script sits next to is changed too, so the rule applies right away in this session.
"""
import json, os, re, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))   # the skill folder
HEAD = "## Your rules (saved with “remember this”)"
INTRO = "Standing rules the owner asked to remember for every video. Newest last; a rule here beats anything above it."


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"\s*_\(\d{4}-\d{2}-\d{2}\)_\s*$", "", s)).strip().lower()


def edit(path, add=None, remove=None):
    """change the rules section of one SKILL.md; True if it changed"""
    with open(path) as f:
        text = f.read()
    if HEAD not in text:
        if remove:
            return False
        text = text.rstrip("\n") + f"\n\n{HEAD}\n{INTRO}\n"
    before, after = text.split(HEAD, 1)
    lines = after.split("\n")
    rules = [l for l in lines if l.startswith("- ")]
    if add:
        if any(norm(l[2:]) == norm(add) for l in rules):
            return False
        new = after.rstrip("\n") + f"\n- {add.strip()} _({time.strftime('%Y-%m-%d')})_\n"
    else:
        keep = [l for l in lines if not (l.startswith("- ") and norm(l[2:]) == norm(remove))]
        if len(keep) == len(lines):
            return False
        new = "\n".join(keep)
    with open(path, "w") as f:
        f.write(before + HEAD + new)
    return True


def git(args, cwd, check=True):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip()[-300:] or f"git {args[0]} failed")
    return r.stdout.strip()


def push(add=None, remove=None):
    try:
        root = git(["rev-parse", "--show-toplevel"], HERE)
    except RuntimeError:
        return {"ok": False, "error": "this skill folder isn't a git checkout, so it can't push (changed here only)"}
    rel = os.path.relpath(os.path.join(HERE, "SKILL.md"), root)
    for attempt in range(3):
        tmp = tempfile.mkdtemp(prefix="skill-main-")
        try:
            git(["fetch", "-q", "origin", "main"], root)
            git(["worktree", "add", "-q", "--detach", tmp, "FETCH_HEAD"], root)
            if not os.path.isfile(os.path.join(tmp, rel)):   # a sparse checkout: bring the skill file in
                git(["sparse-checkout", "add", os.path.dirname(rel)], tmp, check=False)
                git(["checkout", "-q", "FETCH_HEAD", "--", rel], tmp, check=False)
            if not edit(os.path.join(tmp, rel), add, remove):
                return {"ok": True, "note": "already there" if add else "not in the skill"}
            msg = ("Skill rule: " + add if add else "Skill rule removed: " + remove).strip()[:120]
            git(["add", rel], tmp)
            git(["-c", "user.name=Dubuddy Claude", "-c", "user.email=noreply@anthropic.com", "commit", "-q", "-m", msg], tmp)
            r = subprocess.run(["git", "push", "-q", "origin", "HEAD:main"], cwd=tmp, capture_output=True, text=True)
            if r.returncode == 0:
                return {"ok": True, "commit": git(["rev-parse", "--short", "HEAD"], tmp)}
            err = (r.stderr or "").strip()[-300:]
            if attempt == 2 or not re.search(r"rejected|fetch first|non-fast-forward", err):
                return {"ok": False, "error": "push to main failed: " + err}
        except RuntimeError as e:
            if attempt == 2:
                return {"ok": False, "error": str(e)}
        finally:
            subprocess.run(["git", "worktree", "remove", "--force", tmp], cwd=root, capture_output=True)
            shutil.rmtree(tmp, ignore_errors=True)
        time.sleep(2 * (attempt + 1))   # someone pushed meanwhile: start again from the new main
    return {"ok": False, "error": "push to main kept failing"}


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in ("add", "remove") or not " ".join(sys.argv[2:]).strip():
        print(__doc__); sys.exit(1)
    rule = " ".join(sys.argv[2:]).strip()
    add, remove = (rule, None) if sys.argv[1] == "add" else (None, rule)
    res = push(add, remove)
    # this copy too, so it applies now: a checkout of main (the Mac's) pulls the commit; any other copy is edited in place
    on_main = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=HERE, capture_output=True, text=True).stdout.strip() == "main"
    if not (res.get("ok") and on_main and subprocess.run(["git", "pull", "-q", "--ff-only", "origin", "main"], cwd=HERE, capture_output=True).returncode == 0):
        edit(os.path.join(HERE, "SKILL.md"), add, remove)
    print(json.dumps(res, ensure_ascii=False))
