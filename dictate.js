/* =====================================================================
   🎤 DICTATION for every text box: click into a field, press the mic at
   its right edge, speak (Hindi, Hinglish or English), press again — the
   words are typed in where the cursor is. Esc cancels.

   Hinglish mode (default): Scribe listens for Hindi, and hinglish.js turns
   the Devanagari into Roman Hinglish (the dubuddy-short glossary + a
   letter-by-letter fallback). The small "Hinglish / English" switch next to
   the mic flips to plain English. The choice is remembered on this browser.
   LIVE: the words appear as you speak. The site's server gives the browser a
   one-time token (lib/voice.js, the ElevenLabs key never leaves the server) and
   the mic streams straight to ElevenLabs Scribe Realtime, billed by how long
   you talk. If the live connection can't open, the clip is sent once when you
   stop (Scribe batch) instead. Brave blocks the browser's own speech recognition.
   index.html attaches it to the page; social-space.js attaches it inside
   the Social Media space (which lives in its own shadow root).
   ===================================================================== */
(function(){
"use strict";

const ROOTS = new WeakSet();
const MAX_SECONDS = 180;
const ok = el => el && !el.disabled && !el.readOnly && !el.closest("[data-nodictate]") &&
  (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|url|email|)$/i.test(el.getAttribute("type") || "")));

const CSS = `
.dict-mic{position:fixed;z-index:99999;width:26px;height:26px;border-radius:50%;border:1px solid #D2CCC0;background:#fff;color:#56514A;
  display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:0}
.dict-mic:hover{border-color:#D4541E;color:#D4541E}
.dict-mic.rec{background:#D4541E;border-color:#D4541E;color:#fff;width:auto;padding:0 9px 0 7px;border-radius:99px;gap:5px;font:600 11px/1 ui-monospace,Menlo,monospace}
.dict-mic.rec::before{content:"";width:7px;height:7px;border-radius:50%;background:#fff;animation:dictpulse 1s ease-in-out infinite}
.dict-mic.busy{width:auto;padding:0 9px;border-radius:99px;font:600 11px/1 system-ui,sans-serif;cursor:progress}
@keyframes dictpulse{50%{opacity:.25}}
.dict-mic[hidden],.dict-lang[hidden],.dict-tip[hidden]{display:none!important}
.dict-lang{position:fixed;z-index:99999;height:20px;padding:0 7px;border-radius:99px;border:1px solid #D2CCC0;background:#fff;color:#8C867C;
  font:600 10px/18px system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.dict-lang:hover{color:#D4541E;border-color:#D4541E}
.dict-tip{position:fixed;z-index:99999;background:#1A1815;color:#fff;font:12px/1.4 system-ui,sans-serif;padding:6px 9px;border-radius:7px;max-width:280px;pointer-events:none}`;

// ---- speech → text on the server (lib/voice.js: ElevenLabs Scribe) ----
let LANG = (() => { try{ return localStorage.getItem("dictLang") || "hi"; }catch(_){ return "hi"; } })();   // hi = Hinglish, en = English
function setLang(l){ LANG = l; try{ localStorage.setItem("dictLang", l); }catch(_){ } }
async function authHeaders(type){
  const h = { "content-type": type };
  try{ if(!window.LOCAL_MODE && typeof SUPA !== "undefined" && SUPA){ const { data } = await SUPA.auth.getSession();
    if(data && data.session) h.authorization = "Bearer " + data.session.access_token; } }catch(_){ }
  return h;
}
const team = () => (typeof TEAM !== "undefined" && TEAM) || new URLSearchParams(location.search).get("team") || "";
let QUEUE = Promise.resolve();   // one clip at a time
function speechToText(blob){ const run = QUEUE.then(() => readClip(blob)); QUEUE = run.catch(() => {}); return run; }
async function readClip(blob){
  const res = await fetch(`/api/transcribe?team=${encodeURIComponent(team())}&lang=${LANG}`, { method: "POST", headers: await authHeaders(blob.type || "audio/webm"), body: blob });
  const j = await res.json().catch(() => ({ error: "No answer from the server (" + res.status + ")" }));
  if(j.error) throw new Error(j.error);
  const text = String(j.data.text || "").trim();
  return LANG === "hi" && window.HINGLISH ? HINGLISH.toHinglish(text) : text;
}

function attach(root){
  if(!root || ROOTS.has(root)) return;
  ROOTS.add(root);
  const host = root === document ? document.body : root;
  const style = document.createElement("style"); style.textContent = CSS; host.appendChild(style);
  const mic = document.createElement("button"); mic.type = "button"; mic.className = "dict-mic"; mic.title = "Dictate — speak instead of typing";
  mic.textContent = "🎤"; mic.hidden = true; host.appendChild(mic);
  const tip = document.createElement("div"); tip.className = "dict-tip"; tip.hidden = true; host.appendChild(tip);
  const lang = document.createElement("button"); lang.type = "button"; lang.className = "dict-lang"; lang.hidden = true; host.appendChild(lang);
  const langLabel = () => { lang.textContent = LANG === "en" ? "English" : "Hinglish"; lang.title = "Speaking " + lang.textContent + " — click to switch"; };
  langLabel();
  lang.addEventListener("mousedown", e => e.preventDefault());
  lang.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); setLang(LANG === "en" ? "hi" : "en"); langLabel();
    say(LANG === "en" ? "English: words come out as you say them." : "Hinglish: Hindi comes out in Roman letters (kya, hai, CUET…)."); });

  let target = null, rec = null, chunks = [], stream = null, timer = null, started = 0, state = "idle", heard = "";

  // the field is really on screen (not inside a closed / faded-out window, not scrolled away)
  const visible = el => el && el.isConnected && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }))
    && !el.closest(".drawer:not(.on)") && el.getBoundingClientRect().width > 0;
  let watch = null;
  const place = () => {
    if(!visible(target)){ if(state === "idle") hide(); else mic.style.visibility = "hidden"; return; }
    const r = target.getBoundingClientRect();
    if(r.bottom < 0 || r.top > innerHeight){ mic.style.visibility = "hidden"; lang.hidden = true; return; }
    mic.style.visibility = "";
    const h = mic.offsetHeight || 26, w = mic.offsetWidth || 26;
    const top = target.tagName === "TEXTAREA" ? r.top + 6 : r.top + (r.height - h) / 2;
    mic.style.left = Math.round(r.right - w - 6) + "px"; mic.style.top = Math.round(top) + "px";
    lang.hidden = mic.hidden || state !== "idle";
    if(!lang.hidden){ lang.style.left = Math.round(r.right - (lang.offsetWidth || 56)) + "px"; lang.style.top = Math.round(r.top > 30 ? r.top - 23 : r.bottom + 3) + "px"; }
  };
  const show = el => { target = el; mic.hidden = false; place(); clearInterval(watch); watch = setInterval(place, 400); };   // re-checked while shown
  const hide = () => { mic.hidden = true; lang.hidden = true; tip.hidden = true; target = null; clearInterval(watch); watch = null; };
  const say = (msg, ms = 3200) => {
    tip.textContent = msg; tip.hidden = false;
    const r = mic.getBoundingClientRect(); tip.style.left = Math.max(8, r.right - 280) + "px"; tip.style.top = (r.bottom + 6) + "px";
    clearTimeout(tip._t); tip._t = setTimeout(() => { tip.hidden = true; }, ms);
  };
  const setState = s => {
    state = s; mic.classList.toggle("rec", s === "rec"); mic.classList.toggle("busy", s === "busy");
    mic.textContent = s === "rec" ? "0:00" : s === "busy" ? "Writing…" : "🎤";
    mic.title = s === "rec" ? "Press to stop · Esc to cancel" : "Dictate — speak instead of typing";
    place();
  };

  // where the spoken words go: the text before and after the cursor when recording started
  let spot = null;
  function markSpot(){
    const el = target, v = el.value, a = el.selectionStart ?? v.length, b = el.selectionEnd ?? v.length;
    spot = { el, before: v.slice(0, a), after: v.slice(b) };
  }
  function write(text, final){
    if(!spot || !spot.el.isConnected) return;
    const { el, before, after } = spot, t = text || "";
    const pre = t && before && !/\s$/.test(before) ? " " : "", post = t && after && !/^\s/.test(after) ? " " : "";
    el.value = before + pre + t + post + after;
    const pos = (before + pre + t).length;
    try{ el.setSelectionRange(pos, pos); }catch(_){ }
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    if(final){ el.focus(); el.dispatchEvent(new Event("change", { bubbles: true, composed: true })); }
  }

  // ---- live: the mic streams to Scribe Realtime and the words appear as you speak ----
  let mode = "", ws = null, actx = null, tap = null, committed = [], partial = "", flushLive = null;
  const sofar = () => { const t = committed.concat(partial ? [partial] : []).join(" ").replace(/\s+/g, " ").trim();
    return LANG === "hi" && window.HINGLISH ? HINGLISH.toHinglish(t) : t; };
  const b64 = int16 => { const u = new Uint8Array(int16.buffer); let s = ""; for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  async function openLive(){
    const h = await authHeaders("application/json"); delete h["content-type"];
    const r = await fetch(`/api/transcribe-token?team=${encodeURIComponent(team())}`, { headers: h });
    const j = await r.json().catch(() => ({ error: "No answer (" + r.status + ")" }));
    if(j.error) throw new Error(j.error);
    ws = new WebSocket("wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000&commit_strategy=vad"
      + `&language_code=${LANG === "en" ? "en" : "hi"}&token=${encodeURIComponent(j.data.token)}`);
    await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = () => bad(new Error("couldn't connect")); setTimeout(() => bad(new Error("took too long to connect")), 7000); });
    ws.onmessage = e => { let m; try{ m = JSON.parse(e.data); }catch(_){ return; }
      if(m.message_type === "partial_transcript"){ partial = m.text || ""; }
      else if(m.message_type === "committed_transcript"){ if(m.text) committed.push(m.text); partial = ""; if(ws && ws._done) ws._done(); }
      else return;
      if(state === "rec"){ heard = sofar(); write(heard + " …"); } };
    // mic → 16 kHz mono → 16-bit PCM chunks of ~100 ms
    actx = new AudioContext({ sampleRate: 16000 });
    const code = 'class T extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("pcm-tap",T)';
    await actx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
    tap = new AudioWorkletNode(actx, "pcm-tap");
    let frames = [], n = 0;
    flushLive = commit => {
      const pcm = new Int16Array(n); let o = 0;
      frames.forEach(f => { for(let k = 0; k < f.length; k++){ const v = Math.max(-1, Math.min(1, f[k])); pcm[o++] = v < 0 ? v * 0x8000 : v * 0x7fff; } });
      frames = []; n = 0;
      if(ws && ws.readyState === 1) ws.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: b64(pcm), commit: !!commit, sample_rate: 16000 }));
    };
    tap.port.onmessage = e => { frames.push(e.data); n += e.data.length; if(n >= 1600) flushLive(false); };
    const sink = actx.createGain(); sink.gain.value = 0;
    actx.createMediaStreamSource(stream).connect(tap); tap.connect(sink); sink.connect(actx.destination);
  }
  function closeLive(){
    try{ if(tap) tap.disconnect(); }catch(_){ } try{ if(actx) actx.close(); }catch(_){ } try{ if(ws) ws.close(); }catch(_){ }
    tap = actx = ws = flushLive = null;
  }

  async function start(){
    if(!navigator.mediaDevices){ say("This browser can't record audio."); return; }
    try{ stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch(e){ say("Allow the microphone for this site (the icon in the address bar), then try again.", 5000); return; }
    markSpot(); heard = ""; committed = []; partial = "";
    setState("busy"); mic.textContent = "Starting…";
    try{ await openLive(); mode = "live"; }
    catch(e){ closeLive(); mode = "clip";                         // no live connection: record the clip and send it once at the end
      if(!window.MediaRecorder){ stream.getTracks().forEach(t => t.stop()); setState("idle"); say("Couldn't start dictation: " + e.message, 5000); return; }
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t)) || "";
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); chunks = [];
      rec.ondataavailable = ev => { if(ev.data && ev.data.size) chunks.push(ev.data); };
      rec.onstop = finish; rec.start(250); }
    started = Date.now(); setState("rec");
    timer = setInterval(() => { const s = Math.floor((Date.now() - started) / 1000);
      mic.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); place();
      if(s >= MAX_SECONDS) stop(); }, 250);
  }
  async function stop(cancel){
    clearInterval(timer);
    if(stream) stream.getTracks().forEach(t => t.stop());
    if(mode === "live"){
      if(cancel){ closeLive(); write(""); spot = null; stream = null; setState("idle"); return; }   // Esc: put the box back as it was
      setState("busy");
      // send what's left and ask Scribe to finish the last sentence (give it up to 4 s)
      await new Promise(ok => { if(!ws || !flushLive) return ok(); ws._done = ok; flushLive(true); setTimeout(ok, 4000); });
      const text = sofar(); closeLive(); stream = null;
      if(!text) say("Didn't catch any words — try again a little closer to the mic.");
      write(text, true); spot = null; setState("idle"); return;
    }
    if(rec && rec.state !== "inactive"){ rec._cancel = !!cancel; rec.stop(); }
  }
  async function finish(){
    const r = rec; rec = null; stream = null;
    if(r._cancel){ write(""); spot = null; setState("idle"); return; }   // Esc: put the box back as it was
    const blob = new Blob(chunks, { type: (r.mimeType || "audio/webm").split(";")[0] });
    if(blob.size < 1500){ write(""); spot = null; setState("idle"); say("Didn't catch anything — press, speak, then press again."); return; }
    setState("busy");
    try{
      const text = await speechToText(blob);
      if(!text) say("Didn't catch any words — try again a little closer to the mic.");
      write(text, true);
    }catch(e){ write("", true); say("Couldn't turn that into text: " + (e && e.message || e), 6000); }
    spot = null;
    setState("idle");
  }

  mic.addEventListener("mousedown", e => e.preventDefault());   // keep the cursor in the field
  mic.addEventListener("click", e => { e.preventDefault(); e.stopPropagation();
    if(state === "idle") start(); else if(state === "rec") stop(); });
  root.addEventListener("focusin", e => { const el = e.composedPath ? e.composedPath()[0] : e.target;
    const own = el && el.getRootNode && el.getRootNode();
    if(own && own !== root && ROOTS.has(own)) return;   // a field inside a space with its own mic (one mic per field)
    if(ok(el) && state === "idle") show(el); });
  root.addEventListener("focusout", () => { setTimeout(() => {
    const a = root.activeElement; if(state === "idle" && !(a && ok(a))) hide(); }, 120); });
  root.addEventListener("keydown", e => { if(e.key === "Escape" && state === "rec"){ e.stopPropagation(); stop(true); } }, true);
  addEventListener("scroll", () => { if(!mic.hidden) place(); }, true);
  addEventListener("resize", () => { if(!mic.hidden) place(); });
}

window.DICTATE = { attach, speechToText };
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => attach(document)); else attach(document);
})();
