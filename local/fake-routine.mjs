// =====================================================================
// FAKE ROUTINE: tests the whole website flow without spending Claude usage.
// Does exactly what a real run does with files and reports (the real
// routine/pipe.py, the real upload links and callback), but the "Claude
// work" is replaced by dummy outputs made with ffmpeg. Nothing is posted.
// Used when PIPELINE_MODE=fake (local/data/pipeline-config.json).
// =====================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PIPE = path.join(HERE, "..", "routine", "pipe.py");
const fire = process.argv[2];
const p = JSON.parse(fs.readFileSync(fire, "utf8"));
const W = path.join(process.env.PIPE_DIR || path.join(os.homedir(), "Dubuddy Pipeline"), "work", p.team, p.job);
const env = { ...process.env, PIPE_WORK: W };
const pipe = (...a) => execFileSync("python3", [PIPE, ...a], { env, encoding: "utf8" });
const FFMPEG = fs.existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg";
const ff = a => execFileSync(FFMPEG, ["-v", "error", "-y", ...a]);
// a tiny HyperFrames-style composition (same shape build.py writes), so the ▶ live player has something to play
function demoComposition(dir, label) {
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  ff(["-f", "lavfi", "-i", "testsrc2=s=540x960:d=6:r=30", "-f", "lavfi", "-i", "sine=f=440:d=6", "-shortest", "-pix_fmt", "yuv420p", path.join(dir, "assets/cut.mp4")]);
  fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html><html><head><meta charset="UTF-8"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>body{margin:0}#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#111}
video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.card{position:absolute;left:140px;top:700px;width:800px;padding:40px;border-radius:30px;background:#fff;font:900 90px system-ui;text-align:center}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1920" data-duration="6">
<video id="aroll" src="assets/cut.mp4" data-start="0" data-duration="6" muted playsinline></video>
<div class="card clip" id="hook" data-start="0.5" data-duration="3">${label} hook</div>
<audio id="aroll-audio" src="assets/cut.mp4" data-start="0" data-duration="6" data-volume="1"></audio>
</div><script>window.__timelines = window.__timelines || {}; const tl = gsap.timeline({ paused: true });
tl.fromTo("#hook", { scale: .5, rotation: -8 }, { scale: 1, rotation: 0, duration: .6, ease: "back.out(2)" }, 0.5);
window.__timelines["main"] = tl;</script></body></html>`);
}
const sleep = s => execFileSync("sleep", [String(s)]);
const json = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };

// ---- chat runs (the edit chat): stay alive, act on what "the owner says". Locally there's no claude.ai chat, so a test
// writes the message to <runs>/<card>.say ("build" / "render" / anything else = change the plan).
if (p.chat) {
  try {
    const info = JSON.parse(pipe("start", fire)); const ED = info.edit_folder, OUT = info.out, tv = info.targets;
    const SAY = path.join(path.dirname(fire), `${p.job}.say`);
    const proposal = notes => { fs.mkdirSync(ED, { recursive: true }); fs.writeFileSync(path.join(ED, "plan.json"), JSON.stringify({ fake: true, draft: true }));
      json(path.join(OUT, "proposal.json"), { summary: (notes ? `[changed: ${notes}] ` : "") + `Fake plan for “${p.card.title || p.card.idea || "card"}” — versions: ${tv.join(" + ")}.`,
        hook: { text: "SRCC cutoff *gira*?", why: "The number is the surprise." }, length: "32 s (from 47 s)", cuts: [{ what: "2 false starts", why: "repeats" }],
        scenes: [{ at: "0:00", said: "SRCC ka cutoff…", scene: "Falling arrow over a college gate", display: "float" }], broll: [], captions: "Hinglish", cta: "Comment cards", audio: "-14 LUFS",
        questions: [], warnings: [] });
      pipe("stage", "proposal"); };
    const build = msg => { pipe("busy", "building", "building (fake)"); sleep(1);
      fs.mkdirSync(path.join(ED, "brief"), { recursive: true });
      ff(["-f", "lavfi", "-i", "testsrc2=s=1200x400:d=1", "-frames:v", "1", path.join(ED, "brief/sheet.jpg")]);
      fs.writeFileSync(path.join(ED, "brief/brief.md"), "# Brief (fake chat run)\n");
      fs.appendFileSync(path.join(ED, "CHAT_NOTES.md"), `- ${new Date().toISOString()}: ${msg}\n`);
      tv.forEach(v => demoComposition(path.join(ED, "hf_" + v), v === "yt" ? "YouTube" : "Instagram"));
      const refs = JSON.parse(pipe("refs")).count;
      json(path.join(OUT, "plan_result.json"), { summary: `Fake build (${msg}) · ${refs} file(s) from “Files for Claude”`, hook: "SRCC cutoff *gira*?", storyboard: [], captions: "…", questions: [], warnings: [] });
      pipe("stage", "built"); };
    const render = () => { pipe("busy", "rendering", "rendering (fake)"); sleep(1);
      const dir = { yt: "youtube", ig: "instagram" };
      tv.forEach(v => { fs.mkdirSync(path.join(ED, "output", dir[v]), { recursive: true });
        ff(["-f", "lavfi", "-i", (v === "yt" ? "testsrc2" : "smptebars") + "=s=540x960:d=4", "-f", "lavfi", "-i", "sine=d=4", "-shortest", "-pix_fmt", "yuv420p", path.join(ED, "output", dir[v], `final_${v}.mp4`)]); });
      json(path.join(OUT, "render_result.json"), { qc: tv.map(v => v + " ok").join(" · ") + " (fake)" });
      pipe("stage", "rendered"); };
    if (p.step === "chat") proposal(""); else pipe("waiting", "What should change? (fake)");
    const end = Date.now() + 15 * 60e3;
    while (Date.now() < end) {
      sleep(1); if (!fs.existsSync(SAY)) continue;
      const msg = fs.readFileSync(SAY, "utf8").trim(); fs.rmSync(SAY, { force: true });
      if (/render/i.test(msg)) render(); else if (/^(ok|go|build)/i.test(msg)) build(msg); else if (/plan/i.test(msg)) proposal(msg); else build(msg);
    }
  } catch (e) { try { pipe("fail", "Fake chat: " + String(e.message).slice(0, 300)); } catch {} }
  process.exit(0);
}

try {
  const info = JSON.parse(pipe("start", fire));
  const ED = info.edit_folder, OUT = info.out;
  sleep(2);
  if (p.step === "propose") {
    pipe("progress", "transcribed (fake)"); sleep(2);
    fs.mkdirSync(ED, { recursive: true }); fs.writeFileSync(path.join(ED, "plan.json"), JSON.stringify({ fake: true, draft: true, notes: p.notes }));
    json(path.join(OUT, "proposal.json"), { summary: (p.notes ? `[changed: ${p.notes}] ` : "") + "Fake plan for “" + (p.card.title || p.card.idea || "card") + "”: a 32 s short that opens on the key number.",
      hook: { text: "SRCC cutoff *gira*?", why: "The number is the surprise — it stops the scroll." }, length: "32 s (from 47 s)",
      cuts: [{ what: "2 false starts and the second take of the intro", why: "repeats" }],
      scenes: [{ at: "0:00", said: "SRCC ka cutoff…", scene: "A falling arrow over a college gate, dust drifting", display: "float" },
               { at: "0:08", said: "2025 me 98.7 tha", scene: "A counter rolling up to 98.7 on a notebook page", display: "split" }],
      broll: [{ at: "0:15", what: "dubuddy.in predictor on a phone", display: "full", source: "dubuddy.in capture" }],
      captions: "Hinglish, every word pops", cta: "Comment cards + Subscribe / Follow", audio: "-14 LUFS, pop on the number",
      questions: ["Kept the teaser at the start"], warnings: [] });
  } else if (p.step === "plan") {
    pipe("progress", "transcribed (fake)"); sleep(2);
    fs.mkdirSync(path.join(ED, "brief"), { recursive: true });
    ff(["-f", "lavfi", "-i", "testsrc2=s=1200x400:d=1", "-frames:v", "1", path.join(ED, "brief/sheet.jpg")]);
    fs.writeFileSync(path.join(ED, "brief/brief.md"), "# Brief (fake run)\n");
    fs.writeFileSync(path.join(ED, "plan.json"), JSON.stringify({ fake: true, notes: p.notes }));
    demoComposition(path.join(ED, "hf_yt"), "YouTube"); demoComposition(path.join(ED, "hf_ig"), "Instagram");
    json(path.join(OUT, "plan_result.json"), { summary: (p.notes ? `[changed: ${p.notes}] ` : "") + "Fake brief for “" + (p.card.title || p.card.idea || "card") + "” — 32s, hook on the key number, 3 graphics.",
      hook: "SRCC cutoff *gira*?", storyboard: [{ at: "0:00", said: "SRCC ka cutoff…", scene: "Hook card, falling arrow", display: "float" }, { at: "0:08", said: "2025 me 98.7 tha", scene: "Stat count-up", display: "split" }],
      cuts: "Removed 2 false starts.", graphics: [{ at: "0:08", display: "split", text: "98.7", source: "HyperFrames" }],
      captions: "SRCC ka cutoff is baar…", audio: "-14 LUFS, pop SFX", questions: ["Kept the teaser at the start"], warnings: [] });
  } else if (p.step === "render") {
    if (!fs.existsSync(path.join(ED, "plan.json"))) throw new Error("edit folder didn't come back from the plan step");
    pipe("progress", "rendering YouTube (fake)"); sleep(2);
    fs.mkdirSync(path.join(ED, "output/youtube"), { recursive: true }); fs.mkdirSync(path.join(ED, "output/instagram"), { recursive: true });
    const tv = p.targets || ["yt", "ig"];   // only the versions asked for
    if (tv.includes("yt")) ff(["-f", "lavfi", "-i", "testsrc2=s=540x960:d=4", "-f", "lavfi", "-i", "sine=d=4", "-shortest", "-pix_fmt", "yuv420p", path.join(ED, "output/youtube/final_yt.mp4")]);
    if (tv.includes("ig")) ff(["-f", "lavfi", "-i", "smptebars=s=540x960:d=4", "-f", "lavfi", "-i", "sine=d=4", "-shortest", "-pix_fmt", "yuv420p", path.join(ED, "output/instagram/final_ig.mp4")]);
    json(path.join(OUT, "render_result.json"), { qc: "yt ok · ig ok (fake)", duration_s: 4 });
  } else if (p.step === "seo") {
    if (!fs.existsSync(path.join(OUT, "plan_result.json"))) throw new Error("plan_result.json didn't arrive");
    json(path.join(OUT, "seo.json"), { keywords: [{ keyword: "srcc cutoff 2026", volume: "12K", competition: "low", score: 71 }, { keyword: "cuet cutoff", volume: "40K", competition: "high", score: 48 }],
      original_title: { title: p.card.title || "", score: 52 }, titles: [{ title: "SRCC Cutoff 2026: Kitna Girega? 😱", score: 78, why: "keyword first + curiosity" }, { title: "SRCC Cutoff 2026 Explained in 30s", score: 69, why: "clear promise" }],
      yt: { title: "SRCC Cutoff 2026: Kitna Girega? 😱", description: "SRCC cutoff 2026 ka sach 👇\nPichle saal 98.7 tha…\n\nMore on dubuddy.in\n#shorts #cuet #du", tags: ["srcc cutoff", "cuet 2026"] },
      ig: { caption: "SRCC cutoff 2026 gira ya nahi? 👀\nComment your doubt 👇\n#cuet #du" }, notes: "FAKE run — no vidIQ calls were made." + (p.notes ? " Notes: " + p.notes : "") });
  } else if (p.step === "script") {
    json(path.join(OUT, "script.json"), { hook: "Ek galti aur CUET seat gayi? 😳", points: ["Galti 1: wrong subject combination", "Galti 2: photo/signature size", "Galti 3: last-day submission"],
      cta: "Comment your doubt 👇 aur follow karo DU updates ke liye", tips: ["Show the CUET form on screen at point 1"] });
  } else if (p.step === "research") {
    json(path.join(OUT, "research.json"), { primary: "cuet form mistakes", why: "Fake: form season, high intent searches.",
      keywords: [{ keyword: "cuet form mistakes", volume: 14000, competition: "low", score: 74 }, { keyword: "cuet form fill up 2026", volume: 33000, competition: "medium", score: 61 },
        { keyword: "cuet form correction", volume: 9000, competition: "low", score: 58 }],
      titles: [{ title: "3 CUET Form Mistakes That Can Cost Your Seat 😳", score: 79 }, { title: "CUET Form 2026: Don't Make These Mistakes", score: 72 }],
      hashtags: "#cuet #cuet2026 #cuetform #du #delhiuniversity" });
  } else if (p.step === "post") {
    const t = p.post.targets, has = n => fs.existsSync(path.join(W, "in", `final_${n}.mp4`));
    json(path.join(OUT, "post_result.json"), {
      yt: t.includes("yt") ? (has("yt") ? { status: "posted", url: "https://youtube.com/shorts/FAKE-" + p.run, id: "FAKE" } : { status: "failed", error: "video missing" }) : { status: "skipped" },
      ig: t.includes("ig") ? (has("ig") ? { status: "posted", url: "https://instagram.com/reel/FAKE-" + p.run } : { status: "failed", error: "video missing" }) : { status: "skipped" } });
  }
  pipe("finish");
} catch (e) {
  try { pipe("fail", "Fake run: " + String(e.message).slice(0, 300)); } catch {}
}
