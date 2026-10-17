/* =====================================================================
   CLAUDE PIPELINE PANEL: the "🤖 Claude edit & post" block in a Content
   Process card (Social Media space).

   Raw video → Claude plans the edit (dubuddy-short) → ✋ CHECK 1: approve
   the brief or ask for changes → Claude renders YouTube + Instagram
   versions → vidIQ SEO → ✋ CHECK 2: edit / approve the title,
   description, tags and caption → Post (only on an owner's click).

   Talks to the website functions in api/pipeline/ (lib/pipeline/core.js):
     GET  /api/pipeline/jobs?team=     every job of the team + file links
     POST /api/pipeline/upload-url     a one-file upload link for the raw clip
     POST /api/pipeline/action         start / approve / changes / post / …
   Each step runs as a Claude Code routine in the cloud (or on the Mac when
   testing locally). social-space.js calls:
     PIPE.attach(root)            once per render, for the board badges
     PIPE.mount(host, card, h)    when a card drawer opens
   ===================================================================== */
(function(){
"use strict";

const S = { jobs:{}, mode:null, me:null, root:null, hooks:{}, mounted:null, timer:null, err:"" };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ago = iso => { if(!iso) return ""; const s=Math.round((Date.now()-new Date(iso))/1000);
  return s<60?s+"s":s<3600?Math.round(s/60)+" min":Math.round(s/3600*10)/10+" h"; };
const team = () => (typeof TEAM!=="undefined" && TEAM) || new URLSearchParams(location.search).get("team") || "";

const LABEL = {
  proposing:["Claude is watching the video","warn","👀"], proposal_ready:["Plan ready — answer in the chat","accent","✋"],
  planning:["Claude is building the edit","warn","🧠"], brief_ready:["Edit built — watch it","accent","✋"],
  chat_open:["Waiting for you in the edit chat","accent","💬"],
  rendering:["Rendering YT + IG","warn","🎬"], seo_running:["vidIQ SEO running","warn","🔎"],
  final_review:["Videos ready","good","🎬"], scheduled:["Scheduled","good","🗓"], posting:["Posting","warn","🚀"], posted:["Posted","good","✅"],
  paused:["Paused — free limit reached","warn","⏸"], post_failed:["Posting needs a look","crit","⚠️"], failed:["Stopped — needs a look","crit","⚠️"], cancelled:["Cancelled","mute","⏹"],
};
const BUSY = ["proposing","planning","rendering","seo_running","posting","researching","scripting"];
const MODE = { fire:["☁️ Cloud routine","good"], local:["💻 This Mac","warn"], fake:["🧪 Test mode (nothing real)","mute"], off:["Not set up yet","mute"] };

/* ------------------------------------------------------------ server */
async function headers(){
  const h = { "content-type":"application/json" };
  try{ if(!window.LOCAL_MODE && typeof SUPA!=="undefined" && SUPA){ const { data } = await SUPA.auth.getSession();
    if(data && data.session) h.authorization = "Bearer " + data.session.access_token; } }catch(_){ }
  return h;
}
async function call(path, body, tries){
  let r;
  try{ r = await fetch(path, body ? { method:"POST", headers: await headers(), body: JSON.stringify(body) } : { headers: await headers(), cache:"no-store" }); }
  catch(e){
    // the network dropped (or the preview's sign-in expired): reads are safe to try again once
    if(!body && !tries){ await new Promise(ok=>setTimeout(ok,1200)); return call(path, body, 1); }
    throw new Error("Couldn't reach the server — check the connection" + (location.hostname.endsWith(".vercel.app") ? ", or reload the page (the preview's sign-in may have expired)" : "") + " and try again");
  }
  const t = await r.text();
  let j; try{ j = JSON.parse(t); }catch(_){ j = { error: `The server answered ${r.status}${r.status===504?" (it took too long)":""}${t&&!/^\s*</.test(t)?": "+t.slice(0,140):""} — try again` }; }
  if(j.error) throw new Error(j.error);
  return j;
}
async function action(card, act, extra){
  const j = await call("/api/pipeline/action", Object.assign({ team: team(), job: card, action: act }, extra||{}));
  S.jobs[card] = Object.assign({}, S.jobs[card], j.data); S.sent = j.sent || ""; kick(); return j.data;
}
// the raw clip: a one-file upload link, then the file goes straight to storage (also used by the card's Raw video box)
async function uploadRaw(cardId, f, onProgress){
  const { data } = await call("/api/pipeline/upload-url", { team: team(), job: cardId, name: f.name, size: f.size });
  await new Promise((ok, bad) => {
    const x = new XMLHttpRequest(); x.open("PUT", data.url);
    x.upload.onprogress = e => { if(e.lengthComputable && onProgress) onProgress(Math.round(e.loaded/e.total*100)); };
    x.onload = () => x.status < 300 ? ok() : bad(new Error("Upload refused (" + x.status + ")"));
    x.onerror = () => bad(new Error("The upload to storage was cut off — check the connection and try again"));
    x.ontimeout = () => bad(new Error("The upload to storage timed out — try again"));
    x.send(f);
  });
  // a replacement with another file type (raw.mov → raw.mp4) must not leave the old one behind in storage
  await call("/api/pipeline/storage", { team: team(), job: cardId, op: "delete_raw", keep: data.file }).catch(() => {});
  return { file: data.file, name: f.name, size: f.size };
}
function putFile(url, blob, onProgress){
  return new Promise((ok, bad) => {
    const x = new XMLHttpRequest(); x.open("PUT", url);
    x.upload.onprogress = e => { if(e.lengthComputable && onProgress) onProgress(Math.round(e.loaded/e.total*100)); };
    x.onload = () => x.status < 300 ? ok() : bad(new Error("Upload refused (" + x.status + ")"));
    x.onerror = () => bad(new Error("Upload failed — check the connection"));
    x.send(blob);
  });
}
// 🎵 the raw video's sound as a WAV (16-bit PCM, 48 kHz, original channels), made in the browser — no server work
async function videoToWav(src){
  const buf = src instanceof Blob ? await src.arrayBuffer() : src;
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 48000);
  const a = await new Promise((ok, bad) => { const p = ctx.decodeAudioData(buf, ok, bad); if(p && p.then) p.then(ok, bad); });
  const ch = a.numberOfChannels, n = a.length, data = [...Array(ch)].map((_, i) => a.getChannelData(i));
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2)), str = (o, t) => { for(let i=0;i<t.length;i++) out.setUint8(o+i, t.charCodeAt(i)); };
  str(0,"RIFF"); out.setUint32(4, 36 + n*ch*2, true); str(8,"WAVE"); str(12,"fmt "); out.setUint32(16,16,true); out.setUint16(20,1,true);
  out.setUint16(22,ch,true); out.setUint32(24,a.sampleRate,true); out.setUint32(28,a.sampleRate*ch*2,true); out.setUint16(32,ch*2,true);
  out.setUint16(34,16,true); str(36,"data"); out.setUint32(40, n*ch*2, true);
  for(let i=0, o=44; i<n; i++) for(let c=0; c<ch; c++, o+=2){ const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v*0x8000 : v*0x7fff, true); }
  return { blob: new Blob([out], { type: "audio/wav" }), seconds: a.duration };
}
// pull the audio out of the video (the file just picked, or the one already in storage) and store it next to it
async function makeAudio(cardId, src, onStep){
  if(src instanceof Blob && src.size > 700e6) throw new Error("This video is too big to pull the audio in the browser (over 700 MB)");
  if(!(src instanceof Blob)){   // the stored video: download it first
    onStep && onStep("Downloading the video…");
    const r = await fetch(src); if(!r.ok) throw new Error("Couldn't download the video (" + r.status + ")");
    src = await r.blob();
  }
  onStep && onStep("Pulling out the audio…");
  let w; try{ w = await videoToWav(src); }catch(_){ throw new Error("This browser couldn't read the video's sound — try Chrome or Safari on a computer"); }
  const { data } = await call("/api/pipeline/upload-url", { team: team(), job: cardId, kind: "audio" });
  await putFile(data.url, w.blob, pc => onStep && onStep("Uploading the audio… " + pc + "%"));
  return { file: data.file, size: w.blob.size, seconds: Math.round(w.seconds) };
}
// first frame + length of a local video file, for the upload preview (best effort)
function preview(f){
  return new Promise(ok => {
    const v = document.createElement("video"), url = URL.createObjectURL(f), done = o => { URL.revokeObjectURL(url); ok(o); };
    v.muted = true; v.preload = "metadata"; v.src = url;
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration||2)/2); };
    v.onseeked = () => { let thumb = null;
      try{ const cv = document.createElement("canvas"), sc = 120 / (v.videoHeight||120); cv.width = Math.round((v.videoWidth||68)*sc); cv.height = 120;
        cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height); thumb = cv.toDataURL("image/jpeg", .7); }catch(_){ }
      done({ duration: v.duration || null, thumb }); };
    v.onerror = () => done({});
    setTimeout(() => done({}), 8000);
  });
}
const sigOf = job => [S.mode, S.me&&S.me.role, S.err?1:0].join("/") + "|" + (job ? [job.status, job.brief&&job.brief.at, job.proposal&&job.proposal.at, job.rendered&&job.rendered.at,
  job.seo?1:0, job.error||"", job.status==="chat_open"?job.progress:"", (job.files&&job.files.preview&&job.files.preview.at)||"", Object.keys(job.media||{}).join()].join("|") : "none");
async function poll(){
  try{ const j = await call("/api/pipeline/jobs?team=" + encodeURIComponent(team()));
    S.jobs = j.data || {}; S.mode = j.mode; S.me = j.me; S.err = "";
    if(S.hooks.onJobs) S.hooks.onJobs(S.jobs); }
  catch(e){ S.err = e.message; }
  paintBadges();
  const m = S.mounted;
  if(!m || !m.host.isConnected) return;
  const job = S.jobs[m.card.id];
  paintChat(job);
  const rj = S.jobs[m.card.id + "__r"], sj = S.jobs[m.card.id + "__s"];
  const rsig = (rj ? rj.status + (rj.research ? rj.research.at : "") : "") + "/" + (sj ? sj.status + (sj.script ? sj.script.at : "") : "");
  if(rsig !== (m.rsig || "")){ m.rsig = rsig; if(m.h.onJob && m.h.onJob(job) !== false) return; }
  if(sigOf(job) !== m.sig){
    // don't redraw under someone's typing; the next poll catches up
    const a = m.host.getRootNode().activeElement;
    if(a && m.host.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) return;
    const prev = m.sig.split("|")[1];
    // the job moved to another step: let the card redraw itself (its layout depends on the step)
    if(m.h.onJob && prev !== (job ? job.status : "none") && m.h.onJob(job) !== false) return;
    render();
  } else { const pr = m.host.querySelector("[data-pp-progress]"); if(pr && job) pr.textContent = progressLine(job); }
}
// every 3 s while a card is open on a running job, every 30 s otherwise, never while the tab is hidden
// (each check is one function call on Vercel)
// something was just started: check again soon instead of waiting out a slow interval
function kick(){ if(S.tick){ clearTimeout(S.timer); S.timer = setTimeout(S.tick, 2500); } }
function ensurePolling(){
  if(S.timer) return;
  const tick = S.tick = async () => {
    if(!document.hidden) await poll();
    const m = S.mounted, open = m && m.host.isConnected, busy = open && [m.card.id, m.card.id + "__r", m.card.id + "__s"].some(id => S.jobs[id] && BUSY.includes(S.jobs[id].status));
    const anyBusy = Object.values(S.jobs).some(j => BUSY.includes(j.status));   // e.g. research on an Ideation row
    S.timer = setTimeout(tick, busy ? 3000 : anyBusy ? 5000 : open ? 8000 : 30000);
  };
  S.timer = setTimeout(tick, 0);
  document.addEventListener("visibilitychange", () => { if(!document.hidden && S.timer){ clearTimeout(S.timer); S.timer = setTimeout(tick, 0); } });
}

/* ------------------------------------------------------------ board badges */
function badgeHtml(job){
  if(!job) return "";
  const [l,cls,ic] = LABEL[job.status] || [job.status,"mute","•"];
  return `<span class="badge ${cls==="accent"?"warn":cls}" title="Claude pipeline: ${esc(l)}">${ic} ${esc(l.split(" — ")[0])}</span>`;
}
function paintBadges(){
  if(S.root) S.root.querySelectorAll("[data-pipe-badge]").forEach(el=>{ el.innerHTML = badgeHtml(S.jobs[el.dataset.pipeBadge]); });
}

/* ------------------------------------------------------------ pieces */
function modePill(){ const [t,c] = MODE[S.mode] || ["…","mute"]; return `<span class="badge ${c}">${t}</span>`; }
function progressLine(job){
  const t = job.run && job.run.started_at ? " · running " + ago(job.run.started_at) : "";
  return (job.progress || (LABEL[job.status]||[job.status])[0]) + t;
}
const watchLink = job => job.run && job.run.session_url
  ? `<a class="pp-link" href="${esc(job.run.session_url)}" target="_blank" rel="noopener">Watch Claude work ↗</a>` : "";
// 💬 the edit chat: the claude.ai session where Claude is working — you talk to it there (signed in as the routine's account)
// (the same conversation as the 💬 chat on the card — this just opens Claude's session itself)
const chatBtn = job => job && job.run && job.run.chat && job.run.session_url
  ? `<a class="pp-link" href="${esc(job.run.session_url)}" target="_blank" rel="noopener">Open in claude.ai ↗</a>` : "";
const VNAME = { yt:"YouTube Short", ig:"Instagram Reel" };
function copyBlock(cmd){ return `<div class="pp-copy"><code>${esc(cmd)}</code><button class="btn sm" data-copy="${esc(cmd)}">Copy</button></div>`; }
function macLoginHelp(){
  return `<div class="pp-note crit"><b>Claude isn't signed in on this Mac yet.</b> One-time setup — run these in Terminal, one at a time:
    <div class="pp-step">1. Install Claude Code</div>${copyBlock("curl -fsSL https://claude.ai/install.sh | bash")}
    <div class="pp-step">2. Sign in (pick your Claude account in the browser), then type /exit</div>${copyBlock("claude")}
    <div class="pp-step">3. Check it can see vidIQ</div>${copyBlock("node ~/Claud/dubuddy-tools-site/local/runner.mjs --doctor")}
    <div class="pp-step">Then press <b>Retry</b>.</div></div>`;
}
// rich-text boxes keep light markdown (richtext.js); what goes to Claude and to YouTube / Instagram is plain text
const P = v => window.RT ? RT.plain(v||"") : (v||"");
function cardInfo(c, h){
  const idea = h.idea && h.idea(c);
  return { id:c.id, idea:c.idea, title:P(c.pre.title), description:P(c.pre.desc), hashtags:c.pre.hashtags,
    keywords:(c.pre.keywords||[]).map(k=>k.kw||k.keyword||k.term||k.text||k).filter(x=>typeof x==="string"),
    why:P(c.pre.why), platform:c.platform, platforms:(c.platforms&&c.platforms.length?c.platforms:[c.platform]),
    video_type:c.vtype, scheduled:c.scheduled, time:c.time||null,
    hook: (c.shoot && c.shoot.hook) || (idea ? P(idea.hook) : ""), cta: (c.shoot && c.shoot.cta) || (idea ? P(idea.cta) : ""),
    talking_points: c.shoot ? P(c.shoot.points||"") : "", shooting_notes: c.shoot ? P(c.shoot.tips||"") : "" };
}
// the skill's hook markup: *word* = orange, | = new line
const hookHtml = t => esc(t).replace(/\*([^*]+)\*/g, '<span class="pp-em">$1</span>').replace(/\s*\|\s*/g, " / ");

const CSS = `<style>
.pp{border:1.5px solid color-mix(in srgb,var(--accent) 35%,var(--line));background:linear-gradient(180deg,var(--accent-soft),var(--surface) 90px)}
.pp .pp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pp .filebtn input[type=file]{display:none}
.pp .filebtn:has(input:disabled){opacity:.5;cursor:not-allowed}
.pp .pp-note{padding:10px 12px;border-radius:var(--r-s);background:var(--surface-2);font-size:12.5px;line-height:1.5;margin:10px 0}
.pp .pp-note.crit{background:var(--crit-soft);color:var(--ink)}
.pp .pp-step{margin:9px 0 4px;font-weight:600}
.pp .pp-copy{display:flex;gap:6px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:5px 6px 5px 9px}
.pp .pp-copy code{flex:1;font-family:var(--mono);font-size:11.5px;overflow-x:auto;white-space:nowrap}
.pp .pp-prog{display:flex;gap:10px;align-items:center;padding:10px 0}
.pp .pp-spin{width:16px;height:16px;border-radius:50%;border:2.5px solid var(--line-2);border-top-color:var(--accent);animation:ppspin .8s linear infinite;flex:none}
@keyframes ppspin{to{transform:rotate(360deg)}}
.pp .pp-ready{display:flex;flex-wrap:wrap;gap:6px}
.pp .gchip{font-family:var(--mono);font-size:10.5px;padding:3px 8px;border-radius:99px;border:1px solid var(--line)}
.pp .gchip.ok{color:var(--good);background:var(--good-soft);border-color:color-mix(in srgb,var(--good) 30%,var(--line))}
.pp .gchip.no{color:var(--crit);background:var(--crit-soft);border-color:color-mix(in srgb,var(--crit) 25%,var(--line))}
.pp .pp-rawline{margin:0 0 12px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--surface);font-size:13px}
.pp .pp-refs{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
.pp .pp-refs summary{cursor:pointer;font-weight:600;font-size:13px}
.pp .pp-refdrop{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;padding:10px;border:1.5px dashed var(--line-2);border-radius:10px}
.pp .pp-refdrop.over{border-color:var(--accent);background:var(--accent-soft)}
.pp .pp-reflist{list-style:none;margin:8px 0 0;padding:0;font-size:13px}.pp .pp-reflist li{display:flex;gap:8px;align-items:center;padding:4px 0}
.pp .pp-reflist a{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp .pp-drop{display:flex;gap:12px;align-items:center;border:1.5px dashed var(--line-2);border-radius:10px;padding:12px;background:var(--surface);transition:border-color .15s,background .15s}
.pp .pp-drop.over{border-color:var(--accent);background:var(--accent-soft)}
.pp .pp-drop.has{border-style:solid;border-color:color-mix(in srgb,var(--good) 35%,var(--line))}
.pp .pp-dropic{font-size:26px;width:54px;text-align:center}
.pp .pp-thumb{width:54px;height:96px;object-fit:cover;border-radius:6px;background:#000;flex:none}
.pp .pp-bar{height:6px;border-radius:3px;background:var(--line);overflow:hidden;margin-top:6px}
.pp .pp-bar i{display:block;height:100%;background:var(--accent);width:0;transition:width .2s}
.pp .pp-sheet{width:100%;border-radius:8px;border:1px solid var(--line);cursor:zoom-in;display:block;margin:6px 0 10px}
.pp .pp-vids{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,300px));justify-content:center;gap:14px;margin:6px 0 12px}
.pp .pp-vids video{width:100%;aspect-ratio:9/16;background:#000;border-radius:8px;display:block}
.pp .pp-vids .lbl{margin-bottom:4px}
.pp table{width:100%;min-width:0;border-collapse:collapse;font-size:12px;margin:4px 0 10px;table-layout:fixed}
.pp table.pp-at th:first-child,.pp table.pp-at td:first-child{width:44px}
.pp th,.pp td{text-align:left;padding:5px 6px;border-bottom:1px solid var(--line);vertical-align:top}
.pp th{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);font-weight:500;white-space:normal;background:none}
.pp td{overflow-wrap:anywhere}
.pp .pp-em{color:var(--accent);font-weight:700}
.pp details{margin:6px 0;font-size:12.5px}.pp summary{cursor:pointer;font-weight:600;padding:4px 0}
.pp .pp-title{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border:1px solid var(--line);border-radius:7px;margin-bottom:5px;cursor:pointer;font-size:12.5px;background:var(--surface)}
.pp .pp-title.on{border-color:var(--accent);background:var(--accent-soft)}
.pp .pp-score{margin-left:auto;font-family:var(--mono);font-weight:600;white-space:nowrap}
.pp .pp-count{font-family:var(--mono);font-size:10.5px;color:var(--ink-3);float:right}
.pp .pp-count.over{color:var(--crit)}
.pp .pp-live{margin:10px 0}
.pp .pp-seg{display:inline-flex;gap:4px}.pp .pp-seg .btn.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.pp .pp-frame{width:100%;max-width:340px;aspect-ratio:9/16;border-radius:12px;overflow:hidden;background:#000;margin:0 auto}
.pp .pp-frame iframe{width:100%;height:100%;border:0;display:block}
.pp .pp-studio{margin:10px 0;padding:8px 12px;border:1px solid var(--line);border-radius:var(--r-s)}
.pp .pp-studio summary{cursor:pointer;font-size:13px;font-weight:600}
.pp .pp-link{font-size:12px;color:var(--accent-ink)}
.pp ul{margin:4px 0 8px 18px;padding:0;font-size:12.5px}
.pp .pp-chat{margin:12px 0 4px;border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden}
.pp .pp-chat.over{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.pp .pp-chat-h{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line);font-size:13px}
.pp .pp-dot{width:8px;height:8px;border-radius:50%;background:var(--ink-3);flex:none}.pp .pp-dot.on{background:var(--good);box-shadow:0 0 0 3px var(--good-soft)}
.pp .pp-thread{max-height:340px;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.pp .pp-msg{max-width:86%;padding:7px 10px;border-radius:12px;font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.pp .pp-msg.you{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:4px}
.pp .pp-msg.claude{align-self:flex-start;background:var(--surface-2);border-bottom-left-radius:4px}
.pp .pp-msg.stage{align-self:center;background:var(--accent-soft);color:var(--ink);font-size:12px;border-radius:99px;padding:4px 12px}
.pp .pp-msg .meta{display:block;font-size:10.5px;opacity:.75;margin-top:3px;white-space:normal}
.pp .pp-msg img{display:block;max-width:180px;max-height:160px;border-radius:8px;margin:4px 0}
.pp .pp-msg a{color:inherit;text-decoration:underline}
.pp .pp-compose{border-top:1px solid var(--line);padding:8px}
.pp .pp-compose textarea{width:100%;min-height:42px;max-height:160px;resize:vertical;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;background:var(--surface);color:var(--ink);box-sizing:border-box}
.pp .pp-att{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px}
.pp .pp-att span{font-size:11.5px;padding:3px 8px;border-radius:99px;background:var(--surface-2);border:1px solid var(--line)}
.pp .pp-att button{border:0;background:none;cursor:pointer;color:var(--ink-3);padding:0 0 0 4px}
.pp .pp-quick{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
</style>`;

/* ------------------------------------------------------------ panel */
// what Claude uses from the card, and whether it's there
function readiness(c){
  return [["Title", !!c.pre.title], ["Description", !!c.pre.desc], ["Hashtags", !!c.pre.hashtags]];
}
const mmss = s => s ? Math.floor(s/60) + ":" + String(Math.round(s%60)).padStart(2,"0") : "";
function startView(c, canRun, m){
  const ready = readiness(c), missing = ready.filter(x=>!x[1]).map(x=>x[0].toLowerCase());
  const r = m.raw;
  const tv = (c.platforms&&c.platforms.length?c.platforms:[c.platform]).filter(x=>x==="yt"||x==="ig");
  return `<p class="hint" style="margin:0 0 10px">Start, then talk to Claude in the <b>chat on this card</b>: ① it watches the clip and tells you what it will do,
      ② after your OK it builds the edit — watch it here without rendering — and changes whatever you say, ③ it renders only when you say <b>render</b>.
      Versions: <b>${esc((tv.length?tv:["yt","ig"]).map(x=>VNAME[x]).join(" + "))}</b> (from “Post on”).</p>
    <div class="pp-ready">${ready.map(([l,ok])=>`<span class="gchip ${ok?"ok":"no"}">${ok?"✓":"✗"} ${l}</span>`).join("")}</div>
    ${missing.length?`<p class="hint" style="margin:6px 0 12px">Claude can start without the ${esc(missing.join(", "))}, but the hook and SEO get weaker — fill ${missing.length>1?"them":"it"} in on the left first if you can.</p>`:`<div style="height:10px"></div>`}
    <div class="pp-rawline">${r?`🎞️ <b>${esc(r.name)}</b> <span class="hint">${(r.size/1e6).toFixed(0)} MB · the raw video in the step above</span>`
      :`<span class="hint">Add the raw video in the <b>Raw video</b> step above first — then Claude can start.</span>`}</div>
    <div class="pp-row"><button class="btn pri" data-pp="start" ${canRun&&r?"":"disabled"}>🤖 Edit with Claude</button>
      ${canRun?"":`<span class="hint">Your role can view this, not run it.</span>`}</div>`;
}

function render(){
  const m = S.mounted; if(!m) return;
  const { host, card:c } = m;
  const job = S.jobs[c.id], me = S.me || {}, st = job ? job.status : null;
  m.sig = sigOf(job);
  const [lbl,cls,ic] = st ? (LABEL[st]||[st,"mute","•"]) : ["Not started","mute","○"];
  let body = "";

  if(S.mode==="off") body = `<div class="pp-note">Claude edit isn't switched on for this site yet. An owner sets it up once (storage, the jobs table and the cloud routine — see <b>routine/SETUP.md</b>), then this panel starts working. You can still edit this card by hand.</div>`;
  else if(S.err && !S.me) body = `<div class="pp-note crit">${esc(S.err)}</div>`;
  else if(!job) body = startView(c, me.canRun, m);
  else if(BUSY.includes(st)){
    body = `<div class="pp-prog"><div class="pp-spin"></div><div><b>${esc(lbl)}</b><div class="hint" data-pp-progress>${esc(progressLine(job))}</div></div></div>
      ${st==="rendering"&&S.mode==="local"?`<div class="pp-note">Rendering uses the whole Mac — keep it plugged in and awake.</div>`:""}
      ${st==="posting"?`<div class="pp-note">Posting exactly what was approved to ${esc((job.post_request&&job.post_request.targets||[]).map(t=>t==="yt"?"YouTube":"Instagram").join(" + "))}.</div>`:""}
      ${job.media&&(job.media.preview_yt||job.media.preview_ig)&&st!=="proposing"?`<details style="margin:0 0 10px"><summary>▶ The edit so far</summary>${livePlayer(job.media)}</details>`:""}
      <div class="pp-row">${job.run&&job.run.chat?"":watchLink(job)}${st!=="posting"&&me.canRun?`<button class="btn sm" data-pp="cancel" style="margin-left:auto">Cancel</button>`:""}</div>`;
  }
  else if(st==="proposal_ready") body = proposalView(job, me);
  else if(st==="chat_open") body = `<div class="pp-note"><b>💬 Claude is waiting for you — answer in the chat below.</b>${job.progress?` <span class="hint">“${esc(job.progress)}”</span>`:""}</div>
      ${job.error?`<div class="pp-note crit"><b>Something went wrong:</b> ${esc(job.error)} <span class="hint">— Claude is still in the chat to fix it.</span></div>`:""}
      ${job.media&&(job.media.preview_yt||job.media.preview_ig)?livePlayer(job.media):""}
      <div class="pp-row">${chatBtn(job)}${me.canRun?`<button class="btn sm" data-pp="cancel" style="margin-left:auto">Cancel job</button>`:""}</div>`;
  else if(st==="brief_ready") body = briefView(job, me);
  else if(st==="final_review") body = finalView(job, c, me);
  else if(st==="paused"){ const pz = job.paused || {};   // stopped so the free plan is never exceeded; starts again by itself
    body = `<div class="pp-note crit"><b>⏸ Paused to stay on the free plan.</b> ${esc(pz.why||"")}</div>
      <p class="hint" style="margin:0 0 10px">The ${esc(pz.step||"edit")} step starts again by itself ${pz.resumes && /\d/.test(pz.resumes) ? "on " + esc(pz.resumes) + " (checked every 5 minutes)" : esc(pz.resumes||"when there's room") + " (checked every 5 minutes)"}. Nothing is charged meanwhile.</p>
      <div class="pp-row">${me.canRun?`<button class="btn sm" data-pp="retry">Check again now</button><button class="btn sm" data-pp="cancel" style="margin-left:auto">Cancel job</button>`:""}</div>`; }
  else if(st==="scheduled") body = scheduledView(job, me);
  else if(st==="posted") body = postedView(job);
  else if(st==="post_failed") body = postFailedView(job, c, me);
  else if(st==="failed" || st==="cancelled"){
    const mac = S.mode==="local" && /signed in|installed/i.test(job.error||"");
    body = `${st==="failed"?(mac?macLoginHelp():`<div class="pp-note crit"><b>Stopped:</b> ${esc(job.error||"unknown error")}</div>`):""}
      <div class="pp-row">${me.canRun?`<button class="btn pri" data-pp="retry">↻ ${st==="cancelled"?"Resume":"Retry"} from “${esc(job.last_step||"plan")}”</button>`:""}${watchLink(job)}</div>
      <details style="margin-top:12px"><summary>Or start over with a new clip</summary>${startView(c, me.canRun, m)}</details>`;
  }

  host.innerHTML = CSS + `<div class="block pp">
    <div class="block-h"><h4>🤖 Claude edit</h4><span class="badge ${cls==="accent"?"warn":cls}">${ic} ${esc(lbl)}</span>
      <span style="margin-left:auto">${modePill()}</span></div>
    ${body}
    ${S.mode==="off"||(S.err&&!S.me)?"":showChat(job)?chatBox(job, me):!job||["failed","cancelled"].includes(st)?refsBox(c, me):""}
    ${job&&(job.history||[]).length?`<details style="margin-top:10px"><summary>History (${job.history.length})</summary><table>
      ${job.history.slice().reverse().map(x=>`<tr><td style="width:90px" class="hint">${esc(new Date(x.at).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))}</td><td>${esc(x.msg||x.status)}</td></tr>`).join("")}</table></details>`:""}
  </div>`;
  wire();
}

function briefView(job, me){
  const b = job.brief || {}, md = job.media || {}, list = a => (a&&a.length)?`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:"";
  const vs = (job.variants&&job.variants.length) ? job.variants : ["yt","ig"].filter(v=>md["preview_"+v]);
  return `<div class="pp-note"><b>✋ The edit is built — watch it below</b> (the real edit, not a render). Tell Claude what to change in the chat; it renders only when you say <b>render</b> or press Render.</div>
    ${livePlayer(md)}
    ${b.summary?`<p style="margin:0 0 8px;font-size:13px">${esc(b.summary)}</p>`:""}
    ${md.brief_sheet?`<details><summary>Preview stills</summary><a href="${esc(md.brief_sheet)}" target="_blank"><img class="pp-sheet" src="${esc(md.brief_sheet)}" alt="Preview stills of every graphic"></a></details>`:""}
    ${(b.storyboard||[]).length?`<details><summary>Storyboard (${b.storyboard.length})</summary><table class="pp-at"><tr><th>At</th><th>Said</th><th>Scene</th><th>Display</th></tr>
      ${b.storyboard.map(x=>`<tr><td>${esc(x.at)}</td><td>${esc(x.said)}</td><td>${esc(x.scene)}</td><td>${esc(x.display)}</td></tr>`).join("")}</table></details>`:""}
    ${b.captions?`<details><summary>Full captions</summary><p style="margin:4px 0;white-space:pre-wrap">${esc(b.captions)}</p></details>`:""}
    ${(b.questions||[]).length?`<div class="pp-note"><b>Claude decided these — change any in the chat:</b>${list(b.questions)}</div>`:""}
    ${(b.warnings||[]).length?`<div class="pp-note crit"><b>Warnings</b>${list(b.warnings)}</div>`:""}
    <div class="pp-row">${chatBtn(job)}
      <button class="btn pri" data-pp="render" data-vs="${esc(vs.join(","))}" ${me.canApprove?"":"disabled"} title="Or say “render” in the chat">🎬 Render ${esc(vs.map(v=>v==="yt"?"YouTube":"Instagram").join(" + "))}</button>
      ${me.canRun?`<button class="btn sm" data-pp="cancel" style="margin-left:auto">Cancel job</button>`:""}</div>
    ${me.canApprove?"":`<p class="hint" style="margin:8px 0 0">Only an owner or admin can render.</p>`}`;
}

// ✋ Check 1: what Claude will do with the clip — nothing is built yet
function proposalView(job, me){
  const p = job.proposal || {}, list = a => (a&&a.length)?`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:"";
  const hook = p.hook && typeof p.hook === "object" ? p.hook : { text: p.hook };
  const tbl = (rows, cols) => `<table class="pp-at"><tr>${cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c[0]]||"")}</td>`).join("")}</tr>`).join("")}</table>`;
  return `<div class="pp-note"><b>✋ What Claude will do.</b> Nothing is built yet.</div>
    ${p.summary?`<p style="margin:0 0 8px;font-size:13px">${esc(p.summary)}</p>`:""}
    ${hook.text?`<p style="margin:0 0 4px;font-size:13px"><b>Hook:</b> ${hookHtml(hook.text)}</p>${hook.why?`<p class="hint" style="margin:0 0 8px">${esc(hook.why)}</p>`:""}`:""}
    ${p.length?`<p style="margin:0 0 8px;font-size:13px"><b>Length:</b> ${esc(p.length)}</p>`:""}
    ${(p.scenes||[]).length?`<details open><summary>Scenes — the animations (${p.scenes.length})</summary>${tbl(p.scenes,[["at","At"],["said","Said"],["scene","Scene"],["display","Display"]])}</details>`:""}
    ${(p.cuts||[]).length?`<details open><summary>Cuts (${p.cuts.length})</summary><ul style="margin:6px 0;padding-left:18px">${p.cuts.map(x=>typeof x==="string"?`<li>${esc(x)}</li>`:`<li><b>${esc(x.what||"")}</b>${x.why?` <span class="hint">— ${esc(x.why)}</span>`:""}</li>`).join("")}</ul></details>`:""}
    ${(p.broll||[]).length?`<details><summary>B-roll (${p.broll.length})</summary>${tbl(p.broll,[["at","At"],["what","What"],["display","Display"],["source","Source"]])}</details>`:""}
    ${p.captions?`<details><summary>Captions</summary><p style="margin:4px 0">${esc(p.captions)}</p></details>`:""}
    ${p.cta?`<details><summary>Ending / CTA</summary><p style="margin:4px 0">${esc(p.cta)}</p></details>`:""}
    ${p.audio?`<details><summary>Audio</summary><p style="margin:4px 0">${esc(p.audio)}</p></details>`:""}
    ${(p.questions||[]).length?`<div class="pp-note"><b>Claude decided these — change any you like:</b>${list(p.questions)}</div>`:""}
    ${(p.warnings||[]).length?`<div class="pp-note crit"><b>Warnings</b>${list(p.warnings)}</div>`:""}
    <div class="pp-note"><b>Say OK or what to change in the chat below.</b> Paste or drop screenshots and files right into it.</div>
    <div class="pp-row">${chatBtn(job)}${me.canRun?`<button class="btn sm" data-pp="cancel" style="margin-left:auto">Cancel job</button>`:""}</div>`;
}

// ▶ live player: the edit itself, played in the browser (phone too) — no render, no Studio
function livePlayer(md){
  if(!md.preview_yt && !md.preview_ig) return "";
  const m = S.mounted || {}, v = (m.pv === "ig" && md.preview_ig) || !md.preview_yt ? "ig" : "yt", src = v === "ig" ? md.preview_ig : md.preview_yt;
  return `<div class="pp-live">
    <div class="pp-row" style="margin:0 0 8px"><b style="font-size:13px">▶ Watch the edit</b>
      ${md.preview_yt&&md.preview_ig?`<span class="pp-seg"><button class="btn sm${v==="yt"?" on":""}" data-pp-pv="yt">YouTube</button><button class="btn sm${v==="ig"?" on":""}" data-pp-pv="ig">Instagram</button></span>`
        :`<span class="hint">${v==="yt"?"YouTube Short":"Instagram Reel"}</span>`}
      <a class="pp-link" href="${esc(src)}" target="_blank" rel="noopener" style="margin-left:auto">Full screen ↗</a></div>
    <div class="pp-frame"><iframe src="${esc(src)}" title="Live preview" allow="autoplay; fullscreen" loading="lazy"></iframe></div>
    <p class="hint" style="margin:6px 0 0">The real edit, not a render: it downloads first, then plays smoothly. Tap to play, drag the bar to jump.</p>
  </div>`;
}

// after the render: both finished videos to watch and download (posting is off for now — upload them yourself)
function finalView(job, c, me){
  const md = job.media || {}, made = ["yt","ig"].filter(v=>md[v]);
  const vid = v => `<div><div class="lbl">${VNAME[v]}</div><video controls playsinline preload="metadata" src="${esc(md[v])}"></video>
      <a class="pp-link" href="${esc(md[v])}" target="_blank" rel="noopener" download="final_${v}.mp4">⬇ Download</a></div>`;
  const cardV = ((c.platforms&&c.platforms.length?c.platforms:[c.platform])||[]).filter(x=>x==="yt"||x==="ig");
  const choose = [...new Set([...made, ...cardV])];
  return `<div class="pp-note"><b>🎬 ${made.length>1?"Both videos are":"The video is"} ready.</b> Watch ${made.length>1?"them":"it"} here, download, and post. Want a change later? Say it in the chat or use <b>Edit again</b> — the new render replaces the old file.</div>
    <div class="pp-vids">${made.map(vid).join("")}</div>
    ${job.outputs&&job.outputs.qc?`<p class="hint" style="margin:-4px 0 10px">QC: ${esc(job.outputs.qc)}</p>`:""}
    <details class="pp-again"><summary>✏️ Edit again</summary>
      <div class="pp-row" style="margin:8px 0">${choose.map(v=>`<label class="pp-chk"><input type="checkbox" data-again="${v}" checked> ${VNAME[v]}</label>`).join("")}</div>
      <div class="fld"><label>What should change? (optional — you can also just say it in the chat)</label><textarea data-pp-notes placeholder="e.g. cut the last 3 seconds · bigger captions · swap the second scene"></textarea></div>
      <div class="pp-row"><button class="btn pri" data-pp="edit_again" ${me.canRun?"":"disabled"}>✏️ Edit again</button></div>
      <p class="hint" style="margin:6px 0 0">Claude picks up the last edit and everything decided so far. Only the ticked versions are re-rendered; their old files are replaced.</p>
    </details>`;
}

function scheduledView(job, me){
  const at = job.post_at ? new Date(job.post_at) : null, pr = job.post_request || {};
  const where = (pr.targets||[]).map(t=>t==="yt"?"YouTube":"Instagram").join(" + ");
  return `<div class="pp-note"><b>🗓 Goes live ${at?esc(at.toLocaleString("en-GB",{weekday:"long",day:"numeric",month:"short",hour:"numeric",minute:"2-digit",hour12:true})):""}</b>
      on ${esc(where)}, with exactly the text approved by ${esc(pr.approved_by||"the owner")}. Nothing else to do.</div>
    ${pr.yt?`<p style="margin:0 0 4px;font-size:13px"><b>YouTube title:</b> ${esc(pr.yt.title)}</p>`:""}
    ${pr.ig?`<p class="hint" style="margin:0 0 10px;white-space:pre-wrap">${esc((pr.ig.caption||"").slice(0,160))}${(pr.ig.caption||"").length>160?"…":""}</p>`:""}
    <div class="pp-row"><button class="btn" data-pp="post_now" ${me.canApprove?"":"disabled"}>🚀 Post now instead</button>
      <button class="btn" data-pp="unschedule" ${me.canApprove?"":"disabled"}>↩ Unschedule — back to the final check</button>
      ${me.canRun?`<button class="btn sm" data-pp="cancel" style="margin-left:auto">Cancel job</button>`:""}</div>`;
}
function resultRows(job){
  const p = job.posted || {};
  return ["yt","ig"].filter(t=>p[t] && p[t].status && p[t].status!=="skipped").map(t=>{ const r=p[t];
    return `<tr><td>${t==="yt"?"YouTube":"Instagram"}</td><td><span class="badge ${r.status==="posted"?"good":"crit"}">${esc(r.status)}</span></td>
      <td>${r.url?`<a class="pp-link" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>`:esc(r.error||"")}</td></tr>`; }).join("");
}
// the links themselves are listed in the card's Post-production block
function postedView(job){
  const p = job.posted || {}, live = ["yt","ig"].filter(t=>p[t] && p[t].status==="posted").map(t=>t==="yt"?"YouTube":"Instagram");
  return `<p style="margin:0;font-size:13px">✅ Live on <b>${esc(live.join(" + ")||"—")}</b>${job.post_request&&job.post_request.approved_by?` · approved by ${esc(job.post_request.approved_by)}`:""}.</p>
    <p class="hint" style="margin:4px 0 0">${job.linked?"The links are on this card under Post-production → Published.":"Saving the links on this card…"}</p>`;
}
function postFailedView(job, c, me){
  return `<div class="pp-note crit"><b>Posting didn't fully go through.</b> ${esc(job.error||"")}
      <br><b>Check YouTube Studio / Instagram first</b> — if a post is already live there, don't post it again.</div>
    ${job.posted?`<table><tr><th>Platform</th><th>Status</th><th>Link / error</th></tr>${resultRows(job)}</table>`:""}
    ${watchLink(job)}
    ${finalView(job, c, me)}`;
}

// 💬 the chat with Claude, right on the card. Your messages go to the cloud session doing the edit (it checks every few
// seconds while it waits for you); if that session has gone to sleep, a message starts a fresh one with this whole chat.
// Screenshots / files: paste, drop or 📎 — they go to the card's refs folder and Claude downloads them with the message.
const showChat = job => !!job && ((job.run && job.run.chat) || (job.chat||[]).length > 0) && !["posted","scheduled","posting"].includes(job.status);
const chatSig = job => job ? (job.chat||[]).length + "/" + ((job.chat||[]).slice(-1)[0]||{}).id + "/" + (job.chat||[]).filter(x=>x.seen).length + "/" + !!job.chat_live + "/" + job.status : "";
function chatState(job){
  if(job.chat_live) return [true, BUSY.includes(job.status) ? "Claude is working — it reads new messages between steps" : "Claude is here — it reads your message within seconds"];
  return [false, "Claude is resting — a message wakes it up with this whole chat (1–3 min to get going)"];
}
const isImg = f => /\.(jpe?g|png|gif|webp)$/i.test(f);
function msgHtml(m){
  const t = d => d ? new Date(d).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "";
  if(m.stage) return `<div class="pp-msg stage">${esc(m.text)}</div>`;
  const body = esc(m.text||"").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const files = (m.files||[]).map(f => { const n = (f.name||f).replace(/^[a-z0-9]+-/, ""), u = f.url;
    return u && isImg(f.name) ? `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="${esc(n)}" loading="lazy"></a>`
      : u ? `<div>📄 <a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></div>` : `<div>📄 ${esc(n)}</div>`; }).join("");
  const you = m.from === "you";
  const meta = you ? `${esc(m.by||"You")} · ${t(m.at)} · ${m.pending ? "sending…" : m.seen ? "✓ read by Claude" : "⏳ waiting for Claude"}` : `Claude · ${t(m.at)}`;
  return `<div class="pp-msg ${you?"you":"claude"}">${body}${files}<span class="meta">${meta}</span></div>`;
}
function threadHtml(job){
  const msgs = job.chat || [];
  return msgs.length ? msgs.map(msgHtml).join("")
    : `<p class="hint" style="margin:auto;text-align:center">Claude writes here as it works. Say anything, any time — add screenshots, videos or files for inspiration.</p>`;
}
function attHtml(){
  const m = S.mounted || {}, fs = m.chatFiles || [];
  return fs.map((f, i) => `<span>${isImg(f.name)?"🖼️":/\.(mp4|mov|m4v|webm)$/i.test(f.name)?"🎞️":"📄"} ${esc(f.name)}${f.err?` — ${esc(f.err)}`:f.file?"":` ${f.pct||0}%`}<button data-att-x="${i}" title="Remove">✕</button></span>`).join("");
}
function chatBox(job, me){
  const [on, txt] = chatState(job), m = S.mounted || {};
  const quick = me.canRun && job.status === "proposal_ready" ? `<div class="pp-quick"><button class="btn sm" data-say="OK — build it">👍 OK — build it</button></div>` : "";
  return `<div class="pp-chat" data-pp-chat>
    <div class="pp-chat-h"><b>💬 Chat with Claude</b><span class="pp-dot${on?" on":""}" data-chat-dot></span><span class="hint" data-chat-state>${esc(txt)}</span>
      <span style="margin-left:auto">${chatBtn(job)}</span></div>
    <div class="pp-thread" data-pp-thread>${threadHtml(job)}</div>
    ${me.canRun?`<div class="pp-compose">
      <div class="pp-att" data-pp-att>${attHtml()}</div>
      <textarea data-chat-in data-plain placeholder="Tell Claude what to change, ask anything, or paste a screenshot… (Enter sends, Shift+Enter for a new line)">${esc(m.chatDraft||"")}</textarea>
      <div class="pp-row" style="margin:6px 0 0"><label class="btn sm" style="cursor:pointer" title="Screenshots, videos, files">📎 Add files<input type="file" multiple data-chat-file hidden></label>
        <span class="hint">or drop / paste them</span><button class="btn pri sm" data-chat-send style="margin-left:auto">Send</button></div>
      ${quick}</div>`:`<p class="hint" style="margin:8px 12px">Only editors can talk to Claude here.</p>`}
  </div>`;
}
function paintChat(job){
  const m = S.mounted; if(!m || !job) return;
  const sig = chatSig(job); if(sig === m.csig) return; m.csig = sig;
  const th = m.host.querySelector("[data-pp-thread]"); if(!th) return;
  const atEnd = th.scrollHeight - th.scrollTop - th.clientHeight < 40;
  th.innerHTML = threadHtml(job); if(atEnd) th.scrollTop = th.scrollHeight;
  const [on, txt] = chatState(job), d = m.host.querySelector("[data-chat-dot]"), st = m.host.querySelector("[data-chat-state]");
  if(d) d.classList.toggle("on", on); if(st) st.textContent = txt;
}

// 📎 Files for Claude: screenshots, reference videos and docs the edit chat can fetch (pipe.py refs)
S.refs = {};
function refsBox(c, me){
  const r = S.refs[c.id];
  if(!r){ S.refs[c.id] = { list: null }; call("/api/pipeline/storage?team=" + encodeURIComponent(team()) + "&job=" + encodeURIComponent(c.id) + "&refs=1")
    .then(j => { S.refs[c.id] = { list: j.data || [] }; if(S.mounted && S.mounted.card.id === c.id) render(); }).catch(() => { S.refs[c.id] = { list: [] }; }); }
  const list = (r && r.list) || [], up = r && r.up;
  const kb = n => n >= 1e6 ? (n/1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n/1e3)) + " KB";
  const ic = f => /\.(jpe?g|png|gif|webp|heic)$/i.test(f) ? "🖼️" : /\.(mp4|mov|m4v|webm)$/i.test(f) ? "🎞️" : "📄";
  return `<details class="pp-refs" ${list.length||up?"open":""}><summary>📎 Files for Claude${list.length?` (${list.length})`:""} <span class="hint">— inspiration, screenshots, reference videos</span></summary>
    <div class="pp-refdrop" data-refdrop>${me.canRun?`<label class="btn sm" style="cursor:pointer">Add files<input type="file" multiple data-reffile hidden></label>
      <span class="hint">or drop them here. Then tell Claude in the chat — it fetches them.</span>`:`<span class="hint">Only editors can add files.</span>`}</div>
    ${up?`<div class="hint" style="margin:6px 0">${esc(up)}</div>`:""}
    ${list.length?`<ul class="pp-reflist">${list.map(f=>`<li>${ic(f.file)} <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.file.replace(/^[a-z0-9]+-/,""))}</a> <span class="hint">${kb(f.size)}</span>
      ${me.canRun?`<button class="linkbtn" data-refdel="${esc(f.file)}">remove</button>`:""}</li>`).join("")}</ul>`:""}
  </details>`;
}

/* ------------------------------------------------------------ events */
function wire(){
  const m = S.mounted, { host, card:c, h } = m, job = S.jobs[c.id];
  const q = s => host.querySelector(s);
  const toast = msg => h.toast ? h.toast(msg) : alert(msg);
  const notes = () => { const t=q("[data-pp-notes]"); return t ? t.value.trim() : ""; };
  const run = async (b, act, extra) => {
    b.disabled = true; const label = b.textContent; b.textContent = "…";
    try{ await action(c.id, act, Object.assign({ card_info: cardInfo(c, h) }, extra||{})); m.draft = null; if(act==="start") m.raw = null;
      if(S.sent === "chat") toast("Sent to Claude in the chat ✓"); render(); poll(); }
    catch(e){ b.disabled = false; b.textContent = label; toast(e.message); }
  };

  host.querySelectorAll("[data-pp-pv]").forEach(b=>b.onclick=()=>{ m.pv = b.dataset.ppPv; render(); });
  // 💬 the chat
  const th = q("[data-pp-thread]"); if(th){ th.scrollTop = th.scrollHeight; m.csig = chatSig(job); }
  const att = () => { const a = q("[data-pp-att]"); if(a){ a.innerHTML = attHtml(); a.querySelectorAll("[data-att-x]").forEach(x=>x.onclick=()=>{ m.chatFiles.splice(+x.dataset.attX, 1); att(); }); } };
  att();
  const addFiles = async files => {
    m.chatFiles = m.chatFiles || [];
    for(const f of files){
      const e = { name: f.name || "screenshot.png", pct: 0 }; m.chatFiles.push(e); att();
      try{ const { data } = await call("/api/pipeline/upload-url", { team: team(), job: c.id, kind: "ref", name: e.name, size: f.size });
        await putFile(data.url, f, pc => { e.pct = pc; att(); }); e.file = data.file; }
      catch(err){ e.err = err.message; }
      att();
    }
  };
  const ci = q("[data-chat-in]"), box = q("[data-pp-chat]");
  const say = async text => {
    const fs = m.chatFiles || [];
    if(fs.some(f => !f.file && !f.err)) return toast("Wait a moment — the files are still uploading");
    const files = fs.filter(f => f.file).map(f => f.file);
    text = String(text || "").trim();
    if(!text && !files.length) return;
    const sb = q("[data-chat-send]"); if(sb) sb.disabled = true;
    const local = { from: "you", by: "You", text, at: new Date().toISOString(), files: files.map(n => ({ name: n })), pending: true, id: "local" };
    try{
      await action(c.id, "say", { text, files, card_info: cardInfo(c, h) });
      m.chatDraft = ""; m.chatFiles = [];
      const j = S.jobs[c.id]; if(j) j.chat = (j.chat||[]).concat(local);
      if(S.sent === "woke") toast("Claude is starting up again — it has the whole chat. Give it a minute or two.");
      render(); poll();
    }catch(e){ toast(e.message); if(sb) sb.disabled = false; }
  };
  if(ci){
    ci.oninput = () => { m.chatDraft = ci.value; };
    ci.onkeydown = e => { if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); say(ci.value); } };
    ci.onpaste = e => { const fs = [...((e.clipboardData && e.clipboardData.files) || [])]; if(fs.length){ e.preventDefault(); addFiles(fs); } };
  }
  const cs = q("[data-chat-send]"); if(cs) cs.onclick = () => say(ci ? ci.value : "");
  const cf = q("[data-chat-file]"); if(cf) cf.onchange = () => { if(cf.files.length) addFiles([...cf.files]); cf.value = ""; };
  host.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(b.dataset.say));
  if(box && (S.me||{}).canRun){
    box.ondragover = e => { e.preventDefault(); e.stopPropagation(); box.classList.add("over"); };
    box.ondragleave = e => { if(!box.contains(e.relatedTarget)) box.classList.remove("over"); };
    box.ondrop = e => { e.preventDefault(); e.stopPropagation(); box.classList.remove("over"); const fs = [...(e.dataTransfer.files||[])]; if(fs.length) addFiles(fs); };
  }
  // 📎 Files for Claude
  const refUp = async files => {
    const box = S.refs[c.id] = S.refs[c.id] || { list: [] };
    for(const f of files){
      try{ box.up = `Uploading ${f.name}…`; render();
        const { data } = await call("/api/pipeline/upload-url", { team: team(), job: c.id, kind: "ref", name: f.name, size: f.size });
        await putFile(data.url, f, pc => { const el = host.querySelector(".pp-refs .hint[style]"); if(el) el.textContent = `Uploading ${f.name}… ${pc}%`; });
      }catch(e){ toast(`“${f.name}”: ${e.message}`); }
    }
    box.up = ""; S.refs[c.id] = null; render();
  };
  const rf = q("[data-reffile]"); if(rf) rf.onchange = () => { if(rf.files.length) refUp([...rf.files]); };
  const rd = q("[data-refdrop]");
  if(rd && (S.me||{}).canRun){
    rd.ondragover = e => { e.preventDefault(); e.stopPropagation(); rd.classList.add("over"); };
    rd.ondragleave = () => rd.classList.remove("over");
    rd.ondrop = e => { e.preventDefault(); e.stopPropagation(); rd.classList.remove("over"); const fs = [...(e.dataTransfer.files||[])]; if(fs.length) refUp(fs); };
  }
  host.querySelectorAll("[data-refdel]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Remove this file from the card's Files for Claude?")) return;
    try{ await call("/api/pipeline/storage", { team: team(), job: c.id, op: "delete_ref", file: b.dataset.refdel }); S.refs[c.id] = null; render(); }
    catch(e){ toast(e.message); } });
  host.querySelectorAll("[data-copy]").forEach(b=>b.onclick=async()=>{
    try{ await navigator.clipboard.writeText(b.dataset.copy); b.textContent="Copied"; setTimeout(()=>b.textContent="Copy",1400); }catch(_){ }
  });

  // raw clip: ask for a one-file upload link, then send the file straight to storage
  const fileIn = q("[data-pp-file]"), drop = q("[data-pp-drop]");
  if(fileIn) fileIn.onchange = () => { if(fileIn.files[0]) upload(fileIn.files[0]); };
  if(drop && (S.me||{}).canRun){
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over");
      const f = [...(e.dataTransfer.files||[])].find(x=>/^video\//.test(x.type) || /\.(mp4|mov|m4v|mkv)$/i.test(x.name));
      if(f) upload(f); else toast("Drop a video file (.mp4 / .mov)"); };
  }
  async function upload(f){
    const st = q("[data-pp-up]"), bar = q("[data-pp-bar]"), go = q('[data-pp="start"]');
    const meta = preview(f);
    if(go) go.disabled = true; bar.hidden = false; st.textContent = `Getting an upload link…`;
    try{
      const up = await uploadRaw(c.id, f, pc => { bar.firstChild.style.width = pc+"%"; st.textContent = `Uploading ${f.name}… ${pc}%`; });
      m.raw = Object.assign(up, await meta);
      if(h.onRaw) h.onRaw(up, f);            // the card keeps it too (its Raw video box)
      render();
    }catch(e){ st.textContent = e.message; bar.hidden = true; }
  }

  host.querySelectorAll("[data-pp-f]").forEach(el=>el.oninput=()=>{ m.draft[el.dataset.ppF] = el.value;
    if(el.dataset.ppF==="yt_title"){ const n=q("[data-pp-cnt]"); n.textContent=el.value.length+"/100"; n.classList.toggle("over", el.value.length>100); } });
  host.querySelectorAll("[data-pp-t]").forEach(el=>el.onchange=()=>{ m.draft.targets[el.dataset.ppT] = el.checked; });
  host.querySelectorAll("[data-pp-pick]").forEach(el=>el.onclick=()=>{ m.draft.yt_title = el.dataset.ppPick; render(); });

  host.querySelectorAll("[data-pp]").forEach(b=>b.onclick=()=>{
    const act = b.dataset.pp;
    if(act==="start"){
      if(!m.raw) return toast("Upload the raw video first");
      if(h.beforeStart) h.beforeStart();     // keeps the card's typed changes
      return run(b, "start", { raw_file: m.raw.file, raw_name: m.raw.name });
    }
    if(act==="approve_plan") return run(b, act, { notes: notes() });
    if(act==="render"){
      const vs = (b.dataset.vs||"").split(",").filter(Boolean);
      return run(b, "approve_edit", { targets: vs });
    }
    if(act==="edit_again"){
      const vs = [...host.querySelectorAll("[data-again]:checked")].map(x=>x.dataset.again);
      if(!vs.length) return toast("Tick at least one version");
      return run(b, "edit_again", { targets: vs, notes: notes() });
    }
    if(act==="request_changes" || act==="back_to_edit" || act==="change_plan"){
      if(!notes()) return toast("Write what should change first");
      return run(b, act, { notes: notes() });
    }
    if(act==="redo_seo") return run(b, act, { notes: notes() });
    if(act==="cancel"){ if(!confirm("Stop this job? A cloud run that's already going may finish on its own; its results will be ignored.")) return; return run(b, "cancel"); }
    if(act==="post_now"){
      if(!confirm("Post it now instead of waiting for the slot? It goes live publicly.")) return;
      return run(b, "post", { targets: (job.post_request && job.post_request.targets) || [] });
    }
    if(act==="post" || act==="schedule"){
      const d = m.draft, t = Object.keys(d.targets).filter(k=>d.targets[k]);
      if(!t.length) return toast("Tick YouTube, Instagram or both");
      if(t.includes("yt") && !d.yt_title.trim()) return toast("The YouTube title is empty");
      const where = t.map(x=>x==="yt"?"YouTube":"Instagram").join(" and ");
      const sl = act==="schedule" && h.slot && h.slot();
      if(!confirm(act==="schedule" ? `Schedule this for ${where} at ${sl.label}?\n\n${t.includes("yt")?"YouTube title: "+d.yt_title+"\n":""}It goes live by itself at that time.`
        : `Post this to ${where} now?\n\n${t.includes("yt")?"YouTube title: "+d.yt_title+"\n":""}This goes live publicly.`)) return;
      return run(b, act, { targets: t, post_at: sl ? sl.iso : undefined,
        yt: { title: P(d.yt_title).trim(), description: P(d.yt_desc), tags: d.yt_tags.split(",").map(s=>s.trim()).filter(Boolean) },
        ig: { caption: P(d.ig_caption) } });
    }
    run(b, act);
  });

  // posted: put the link on the card and move it to Published (the card itself is saved by the app)
  if(job && job.status==="posted" && !job.linked && h.onPosted && !m.linking){
    const p = job.posted || {}, url = (p[c.platform] && p[c.platform].url) || (p.yt && p.yt.url) || (p.ig && p.ig.url) || "";
    m.linking = true;
    const links = {}; ["yt","ig"].forEach(t=>{ if(p[t] && p[t].url) links[t] = p[t].url; });
    if(h.onPosted(url, links)) action(c.id, "mark_linked").then(()=>render()).catch(()=>{}).finally(()=>{ m.linking = false; });
  }
}

window.PIPE = {
  attach(root, hooks){ S.root = root; if(hooks) S.hooks = hooks; ensurePolling(); paintBadges(); },
  job(cardId){ return S.jobs[cardId] || null; },
  busy(cardId){ const j = S.jobs[cardId]; return !!j && BUSY.includes(j.status); },
  cancel(cardId){ return action(cardId, "cancel"); },
  mode(){ return S.mode; },                                    // "off" until the pipeline is set up on this site
  uploadRaw(cardId, file, onProgress){ return uploadRaw(cardId, file, onProgress); },
  // 🎵 WAV of the raw video's sound (src: the picked File, or the stored video's link)
  makeAudio(cardId, src, onStep){ return makeAudio(cardId, src, onStep); },
  // ✨ the cleaned audio back from Adobe Podcast → raw-clean.<ext> next to the video (Claude's edit uses it)
  async uploadClean(cardId, f, onProgress){
    const { data } = await call("/api/pipeline/upload-url", { team: team(), job: cardId, kind: "clean", name: f.name });
    await call("/api/pipeline/storage", { team: team(), job: cardId, op: "delete_clean" }).catch(() => {});   // an older one, maybe another type
    await putFile(data.url, f, onProgress);
    return { file: data.file, name: f.name, size: f.size };
  },
  // 🔗 copy the raw video from a Google Drive / OneDrive / Dropbox link: the videos the link holds, then the copy itself
  async linkFiles(cardId, link){ return (await call("/api/pipeline/import", { team: team(), job: cardId, op: "list", link })).data.files; },
  async importLink(cardId, pick, onProgress, isCancelled){
    let r = (await call("/api/pipeline/import", { team: team(), job: cardId, op: "start", pick })).data;
    while(!r.file){
      if(isCancelled && isCancelled()){ await call("/api/pipeline/import", { team: team(), job: cardId, op: "cancel", state: r.state }).catch(()=>{}); throw new Error("Copy stopped"); }
      onProgress && onProgress(r.done, r.size);
      let tries = 0;
      for(;;){ try{ r = (await call("/api/pipeline/import", { team: team(), job: cardId, op: "step", state: r.state })).data; break; }
        catch(e){ if(++tries >= 3 || /expired|free plan|Wrong card|isn't open/.test(e.message)) throw e; await new Promise(ok => setTimeout(ok, 3000)); } }
    }
    onProgress && onProgress(r.size, r.size);
    await call("/api/pipeline/storage", { team: team(), job: cardId, op: "delete_raw", keep: r.file }).catch(() => {});   // e.g. an older raw.mov
    return { file: r.file, name: r.name, size: r.size };
  },
  async deleteClean(cardId){ return (await call("/api/pipeline/storage", { team: team(), job: cardId, op: "delete_clean" })).data; },
  // play / download links for the card's raw video and audio: { video?, audio?, clean? }
  async rawLinks(cardId){ return (await call("/api/pipeline/storage?team=" + encodeURIComponent(team()) + "&job=" + encodeURIComponent(cardId))).data; },
  // delete the raw video + audio from storage; the answer says what is gone and what (if anything) is still there
  // 🗑 Delete on the card: the raw video + audio go to the bin for an hour (restorable), then leave storage
  async binRaw(cardId){ return (await call("/api/pipeline/storage", { team: team(), job: cardId, op: "bin_raw" })).data; },
  async restoreRaw(cardId){ return (await call("/api/pipeline/storage", { team: team(), job: cardId, op: "restore_raw" })).data; },
  async deleteRaw(cardId){ return (await call("/api/pipeline/storage", { team: team(), job: cardId, op: "delete_raw" })).data; },
  // a deleted card: all its files and Claude jobs
  async purge(cardId){ return (await call("/api/pipeline/storage", { team: team(), job: cardId, op: "purge" })).data; },
  async storageStats(){ return (await call("/api/pipeline/storage?stats=1&team=" + encodeURIComponent(team()))).data; },
  // a scheduled post follows its card to a new day / time (iso = the new posting moment)
  reschedule(cardId, iso){ return action(cardId, "reschedule", { post_at: iso }); },
  // "✍️ Draft hook & talking points": a helper job of its own (<card>__s)
  async script(card, h){ await action(card.id + "__s", "script", { card_info: cardInfo(card, h||{}) }); poll(); },
  // "🔎 Fill with vidIQ": a small research job of its own (<card>__r)
  async research(card, h){ await action(card.id + "__r", "research", { card_info: cardInfo(card, h||{}) }); poll(); },
  badge(cardId){ return `<span data-pipe-badge="${esc(cardId)}">${badgeHtml(S.jobs[cardId])}</span>`; },
  mount(host, card, helpers){
    if(!host) return;
    const keep = S.mounted && S.mounted.card.id===card.id ? S.mounted : {};
    // a raw video already uploaded in the card's Raw video box is the one Claude edits
    const cr = helpers && helpers.raw && helpers.raw();
    // always the card's own raw file (it can change in the card's Raw video step); keep the preview thumb if it's the same file
    const raw = cr && cr.kind === "file" && cr.file ? Object.assign({}, keep.raw && keep.raw.file === cr.file ? keep.raw : {}, { file: cr.file, name: cr.name, size: cr.size }) : undefined;
    S.mounted = { host, card, h: helpers||{}, raw, draft: keep.draft, rsig: keep.rsig, pv: keep.pv, chatDraft: keep.chatDraft, chatFiles: keep.chatFiles };
    ensurePolling(); render(); poll();     // fresh status as soon as a card opens
  },
};
})();
