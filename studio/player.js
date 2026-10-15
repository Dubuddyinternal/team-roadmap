/* ▶ Dubuddy live player: plays a HyperFrames composition (hf_yt / hf_ig index.html) straight in the browser,
   without Studio or a render. Added to the page by /pv/... (lib/pipeline/core.js → preview).
   It does what the HyperFrames runtime does for playback: one clock drives the GSAP timeline
   (window.__timelines.main), shows each [data-start] element only inside its window, and keeps every
   <video>/<audio> in sync with the clock. Tap to play / pause, drag the bar to scrub. */
(function () {
  "use strict";
  const root = document.querySelector("[data-composition-id]");
  if (!root) return;
  const W = +root.dataset.width || 1080, H = +root.dataset.height || 1920, T = +root.dataset.duration || 0;
  const num = (el, k, d) => { const v = parseFloat(el.dataset[k]); return isNaN(v) ? d : v; };
  const items = [...root.querySelectorAll("[data-start]")].map(el => ({
    el, s: num(el, "start", 0), e: num(el, "start", 0) + num(el, "duration", T),
    media: el.tagName === "VIDEO" || el.tagName === "AUDIO", ms: num(el, "mediaStart", 0), vol: num(el, "volume", 1),
  }));

  // ---- fit the 1080×1920 frame into the window
  const css = document.createElement("style");
  css.textContent = `html,body{margin:0;background:#000;overflow:hidden;height:100%}
#hfp-stage{position:fixed;left:50%;top:50%;width:${W}px;height:${H}px;transform-origin:0 0}
.hfp-off{display:none!important}
#hfp-ui{position:fixed;left:0;right:0;bottom:0;padding:10px 12px calc(10px + env(safe-area-inset-bottom));display:flex;gap:10px;align-items:center;
  background:linear-gradient(transparent,rgba(0,0,0,.75));font:600 13px/1 system-ui,-apple-system,sans-serif;color:#fff;z-index:2147483647;transition:opacity .3s}
#hfp-ui.hide{opacity:0}#hfp-ui button{all:unset;cursor:pointer;width:34px;height:34px;display:grid;place-items:center;font-size:18px}
#hfp-bar{flex:1;height:22px;position:relative;cursor:pointer;touch-action:none}
#hfp-bar i{position:absolute;left:0;right:0;top:9px;height:4px;border-radius:2px;background:rgba(255,255,255,.3)}
#hfp-bar b{position:absolute;left:0;top:9px;height:4px;border-radius:2px;background:#ff6a2b}
#hfp-big{position:fixed;inset:0;display:grid;place-items:center;z-index:2147483646;pointer-events:none}
#hfp-big span{width:84px;height:84px;border-radius:50%;background:rgba(0,0,0,.55);display:grid;place-items:center;color:#fff;font-size:38px;padding-left:6px;box-sizing:border-box}
#hfp-wait{position:fixed;top:12px;right:12px;font:600 12px system-ui;color:#fff;background:rgba(0,0,0,.55);padding:6px 10px;border-radius:20px;z-index:2147483647}`;
  document.head.appendChild(css);
  const stage = document.createElement("div"); stage.id = "hfp-stage";
  root.parentNode.insertBefore(stage, root); stage.appendChild(root);
  const fit = () => { const k = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${k}) translate(-50%,-50%)`; };
  addEventListener("resize", fit); fit();

  const ui = document.createElement("div"); ui.id = "hfp-ui";
  ui.innerHTML = `<button id="hfp-pp" aria-label="Play">▶</button><div id="hfp-bar"><i></i><b></b></div><span id="hfp-t">0:00 / 0:00</span>`;
  const big = document.createElement("div"); big.id = "hfp-big"; big.innerHTML = "<span>▶</span>";
  const wait = document.createElement("div"); wait.id = "hfp-wait"; wait.textContent = "Loading…"; wait.hidden = true;
  document.body.append(ui, big, wait);
  const $pp = ui.querySelector("#hfp-pp"), $bar = ui.querySelector("#hfp-bar"), $fill = $bar.querySelector("b"), $t = ui.querySelector("#hfp-t");
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // ---- the clock
  let t = 0, playing = false, last = 0, hideTimer = 0, stall = 0;
  const tl = () => (window.__timelines || {}).main;
  function apply(seek) {
    const g = tl(); if (g) { g.pause(); g.seek(Math.min(t, g.duration()), false); }
    let stalled = false;
    for (const it of items) {
      const on = t >= it.s && t < it.e;
      it.el.classList.toggle("hfp-off", !on);
      if (!it.media) continue;
      const m = it.el;
      if (!on) { if (!m.paused) m.pause(); continue; }
      m.volume = Math.max(0, Math.min(1, it.vol));
      const want = t - it.s + it.ms;
      if (seek || Math.abs(m.currentTime - want) > 0.3) { try { m.currentTime = want; } catch (_) {} }
      if (playing) { if (m.paused) m.play().catch(() => {}); if (m.readyState < 3 && !m.error) stalled = true; }
      else if (!m.paused) m.pause();
    }
    return stalled;
  }
  function draw() {
    $fill.style.width = (T ? t / T * 100 : 0) + "%";
    $t.textContent = `${fmt(t)} / ${fmt(T)}`;
    $pp.textContent = playing ? "❚❚" : "▶"; big.style.display = playing ? "none" : "";
  }
  function frame(now) {
    if (playing) {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      // wait for media that is still loading, but never hang: after 3 s the clock moves on regardless
      const stalled = apply(false) && (stall += dt) < 3;
      if (!stalled) stall = 0;
      wait.hidden = !stalled;
      if (!stalled) t += dt;
      if (t >= T) { t = 0; apply(true); }   // loops, like the Short will
      draw();
    }
    requestAnimationFrame(frame);
  }
  function setPlaying(p) {
    playing = p; last = performance.now(); apply(true); draw(); wait.hidden = true;
    clearTimeout(hideTimer); ui.classList.remove("hide");
    if (p) hideTimer = setTimeout(() => ui.classList.add("hide"), 2500);
  }

  // ---- input: tap the video to play/pause, drag the bar to scrub
  $pp.onclick = e => { e.stopPropagation(); setPlaying(!playing); };
  addEventListener("click", e => { if (!ui.contains(e.target)) setPlaying(!playing); });
  addEventListener("mousemove", () => { ui.classList.remove("hide"); clearTimeout(hideTimer); if (playing) hideTimer = setTimeout(() => ui.classList.add("hide"), 2500); });
  addEventListener("keydown", e => { if (e.code === "Space") { e.preventDefault(); setPlaying(!playing); } });
  const scrub = e => { const r = $bar.getBoundingClientRect(); t = Math.max(0, Math.min(T - 0.01, (e.clientX - r.left) / r.width * T)); apply(true); draw(); };
  $bar.addEventListener("pointerdown", e => { e.stopPropagation(); $bar.setPointerCapture(e.pointerId); scrub(e); $bar.onpointermove = scrub; });
  $bar.addEventListener("pointerup", () => { $bar.onpointermove = null; });
  $bar.addEventListener("click", e => e.stopPropagation());

  const start = () => { apply(true); draw(); requestAnimationFrame(frame); };
  if (tl()) start(); else addEventListener("load", start);
})();
