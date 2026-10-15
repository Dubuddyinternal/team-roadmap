#!/usr/bin/env python3
"""Free B-roll sourcing for Dubuddy shorts. Commercial-use licences only.

  search:  python3 broll.py search <edit_dir> "<query>" [--src openverse|wikimedia|pexels|pexels-photo] [--n 6]
           → thumbnails in <edit_dir>/broll/cand/<src>_<id>.jpg + a printed table. LOOK at them before picking.
  get:     python3 broll.py get <edit_dir> <src>_<id>
           → full file in <edit_dir>/broll/, licence + credit appended to <edit_dir>/broll/credits.json
  sheet:   python3 broll.py sheet <edit_dir> [prefix]
           → <edit_dir>/broll/cand_sheet.jpg, the latest candidates side by side (numbered in the printed order)
  site:    python3 broll.py site <edit_dir> <url> <name> [--mobile] [--tall]
           → headless-Chrome capture of a public page (dubuddy.in) into <edit_dir>/broll/<name>.png

Pexels needs PEXELS_API_KEY in ~/Developer/video-use/.env (free key from pexels.com/api).
"""
from __future__ import annotations

import glob
import json
import os
import subprocess
import sys
import urllib.parse
from pathlib import Path

UA = "dubuddy-short/1.0 (+https://dubuddy.in)"
ENV = Path.home() / "Developer/video-use/.env"


def key(name):
    if ENV.exists():
        for ln in ENV.read_text().splitlines():
            if ln.strip().startswith(name + "="):
                return ln.split("=", 1)[1].strip().strip("'\"")
    return os.environ.get(name, "")


def fetch(url, headers=None, dest=None):
    # curl, not urllib: python.org builds on macOS ship without CA certs
    cmd = ["curl", "-sfL", "--max-time", "120", "-A", UA]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    if dest:
        subprocess.run(cmd + ["-o", str(dest), url], check=True)
        return dest
    return json.loads(subprocess.run(cmd + [url], check=True, capture_output=True).stdout)


def s_openverse(q, n):
    u = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(
        {"q": q, "page_size": n, "license_type": "commercial,modification", "size": "large", "mature": "false"})
    out = []
    for r in fetch(u)["results"]:
        out.append(dict(id=r["id"], kind="image", w=r.get("width"), h=r.get("height"), thumb=r.get("thumbnail") or r["url"],
                        full=r["url"], license=f'CC {r["license"].upper()} {r.get("license_version","")}'.strip(),
                        credit=r.get("attribution") or f'{r.get("title")} by {r.get("creator")}', page=r.get("foreign_landing_url"),
                        proxy=f'https://api.openverse.org/v1/images/{r["id"]}/thumb/?full_size=true&compressed=false'))
    return out


def s_wikimedia(q, n):
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "generator": "search", "gsrsearch": q + " filetype:bitmap|video", "gsrnamespace": 6, "gsrlimit": n,
        "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 1080, "format": "json"})
    out = []
    for p in (fetch(u).get("query", {}).get("pages", {}) or {}).values():
        ii = p["imageinfo"][0]
        md = ii.get("extmetadata", {})
        lic = md.get("LicenseShortName", {}).get("value", "")
        if "NC" in lic or "ND" in lic or not lic:
            continue
        artist = md.get("Artist", {}).get("value", "")
        import re
        artist = re.sub(r"<[^>]+>", "", artist).strip()
        vid = ii.get("mime", "").startswith("video")
        out.append(dict(id=str(p["pageid"]), kind="video" if vid else "image", w=ii.get("width"), h=ii.get("height"),
                        thumb=ii.get("thumburl") or ii["url"], full=ii["url"] if vid else (ii.get("thumburl") if ii.get("width", 0) > 2400 else ii["url"]),
                        license=lic, credit=f'{p["title"].replace("File:","")} by {artist or "unknown"}, {lic}, via Wikimedia Commons',
                        page=ii.get("descriptionurl")))
    return out


def s_pexels(q, n, photo=False):
    k = key("PEXELS_API_KEY")
    if not k:
        sys.exit("PEXELS_API_KEY missing — add it to ~/Developer/video-use/.env (free at pexels.com/api)")
    if photo:
        d = fetch("https://api.pexels.com/v1/search?" + urllib.parse.urlencode({"query": q, "per_page": n, "orientation": "portrait"}),
                  {"Authorization": k})
        return [dict(id=str(p["id"]), kind="image", w=p["width"], h=p["height"], thumb=p["src"]["medium"], full=p["src"]["large2x"],
                     license="Pexels License", credit=f'Photo by {p["photographer"]} on Pexels', page=p["url"]) for p in d["photos"]]
    d = fetch("https://api.pexels.com/videos/search?" + urllib.parse.urlencode({"query": q, "per_page": n, "orientation": "portrait", "size": "medium"}),
              {"Authorization": k})
    out = []
    for v in d["videos"]:
        files = [f for f in v["video_files"] if f.get("file_type") == "video/mp4" and f.get("height")]
        # prefer ~1080-1920 tall portrait
        files.sort(key=lambda f: (abs(f["height"] - 1920), -f["width"]))
        if not files:
            continue
        f = files[0]
        out.append(dict(id=str(v["id"]), kind="video", w=f["width"], h=f["height"], dur=v.get("duration"), thumb=v["image"], full=f["link"],
                        license="Pexels License", credit=f'Video by {v["user"]["name"]} on Pexels', page=v["url"]))
    return out


def cmd_search(ed, q, src="openverse", n=6):
    cand = ed / "broll" / "cand"
    cand.mkdir(parents=True, exist_ok=True)
    fn = {"openverse": s_openverse, "wikimedia": s_wikimedia, "pexels": s_pexels,
          "pexels-photo": lambda q, n: s_pexels(q, n, True)}[src]
    res = fn(q, n)
    idx_path = cand / "index.json"
    idx = json.loads(idx_path.read_text()) if idx_path.exists() else {}
    tag = src.split("-")[0]
    for r in res:
        cid = f"{tag}_{r['id']}"
        r["src"] = tag
        idx[cid] = r
        for u in (r["thumb"], r["full"]):   # Openverse thumbs sometimes 424 → try the original
            try:
                fetch(u, dest=cand / f"{cid}.jpg")
                break
            except Exception:
                pass
        else:
            print(f"  (no preview for {cid})")
        print(f"{cid:28s} {r['kind']:5s} {r.get('w')}x{r.get('h')} {str(r.get('dur','')):>4s}  {r['license']:18s} {r['credit'][:70]}")
    idx_path.write_text(json.dumps(idx, indent=1, ensure_ascii=False))
    if not res:
        print("no results — try a simpler / more generic query")


def cmd_sheet(ed, prefix=""):
    cand = ed / "broll" / "cand"
    files = sorted((p for p in cand.glob(f"{prefix}*.jpg")), key=lambda p: p.stat().st_mtime)[-8:]
    if not files:
        sys.exit("no candidates — run search first")
    ins = sum([["-i", str(f)] for f in files], [])
    fc = "".join(f"[{i}]scale=150:267:force_original_aspect_ratio=increase,crop=150:267[s{i}];" for i in range(len(files)))
    fc += "".join(f"[s{i}]" for i in range(len(files))) + f"hstack={len(files)}" if len(files) > 1 else "[s0]null"
    out = ed / "broll" / "cand_sheet.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, str(out)], check=True)
    for k, f in enumerate(files, 1):
        print(k, f.stem)
    print(out)


def cmd_get(ed, cid):
    idx = json.loads((ed / "broll/cand/index.json").read_text())
    r = idx[cid]
    ext = ".mp4" if r["kind"] == "video" else os.path.splitext(urllib.parse.urlparse(r["full"]).path)[1].lower() or ".jpg"
    if ext == ".jpeg":
        ext = ".jpg"
    dest = ed / "broll" / f"{cid}{ext}"
    try:
        fetch(r["full"], dest=dest)
    except Exception:
        if not r.get("proxy"):
            raise
        print("  origin blocked the download — using Openverse's copy (max ~960px: split/float only, not full-screen)")
        dest = dest.with_suffix(".jpg")
        fetch(r["proxy"], dest=dest)
    if ext not in (".mp4", ".jpg", ".png", ".webp"):   # tif/gif/webm etc → jpg / mp4
        conv = dest.with_suffix(".jpg" if r["kind"] == "image" else ".mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(dest), str(conv)], check=True)
        dest = conv
    cred_p = ed / "broll" / "credits.json"
    cred = json.loads(cred_p.read_text()) if cred_p.exists() else {}
    cred[dest.name] = {k: r.get(k) for k in ("src", "license", "credit", "page")}
    cred_p.write_text(json.dumps(cred, indent=1, ensure_ascii=False))
    print(dest)


CAPTURE_JS = r"""
const [,, url, out, mobile, tall] = process.argv;
const puppeteer = require(process.env.PPT);
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME, headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const W = mobile === '1' ? 390 : 1280, H = mobile === '1' ? 844 : 800;
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: mobile === '1', hasTouch: mobile === '1' });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  let h = H;
  if (tall === '1') {
    // apps that scroll an inner div: unlock the tallest scroller so the whole page lays out
    h = await p.evaluate(() => {
      let best = document.scrollingElement, bh = best.scrollHeight;
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > bh) { best = el; bh = el.scrollHeight; }
      }
      if (best !== document.scrollingElement) {
        best.style.height = bh + 'px'; best.style.overflow = 'visible';
        for (let a = best.parentElement; a; a = a.parentElement) { a.style.height = 'auto'; a.style.overflow = 'visible'; }
      }
      return Math.min(bh, 6000);
    });
    await p.setViewport({ width: W, height: h, deviceScaleFactor: 2, isMobile: mobile === '1', hasTouch: mobile === '1' });
    await new Promise(r => setTimeout(r, 800));
  }
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: h } });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
"""


def cmd_site(ed, url, name, mobile, tall):
    ppt = sorted(glob.glob(str(Path.home() / ".npm/_npx/*/node_modules/puppeteer-core")))
    chrome = sorted(glob.glob(str(Path.home() / ".cache/hyperframes/chrome/chrome-headless-shell/*/*/chrome-headless-shell")))
    if not ppt or not chrome:
        sys.exit("puppeteer-core / chrome-headless-shell not found — run any `npx hyperframes snapshot` once to install them")
    (ed / "broll").mkdir(parents=True, exist_ok=True)
    js = ed / "broll" / ".capture.cjs"
    js.write_text(CAPTURE_JS)
    out = ed / "broll" / f"{name}.png"
    subprocess.run(["node", str(js), url, str(out), "1" if mobile else "0", "1" if tall else "0"], check=True,
                   env={**os.environ, "PPT": ppt[-1], "CHROME": chrome[-1]})
    cred_p = ed / "broll" / "credits.json"
    cred = json.loads(cred_p.read_text()) if cred_p.exists() else {}
    cred[out.name] = {"src": "site", "license": "Dubuddy (own)", "credit": url, "page": url}
    cred_p.write_text(json.dumps(cred, indent=1))
    print(out)


def main():
    a = sys.argv[1:]
    if len(a) < 2 or (len(a) < 3 and a[0] != "sheet"):
        sys.exit(__doc__)
    cmd, ed = a[0], Path(a[1]).expanduser().resolve()
    opt = lambda f, d=None: a[a.index(f) + 1] if f in a else d
    if cmd == "search":
        cmd_search(ed, a[2], opt("--src", "openverse"), int(opt("--n", 6)))
    elif cmd == "sheet":
        cmd_sheet(ed, a[2] if len(a) > 2 else "")
    elif cmd == "get":
        cmd_get(ed, a[2])
    elif cmd == "site":
        cmd_site(ed, a[2], a[3], "--mobile" in a, "--tall" in a)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
