/* =====================================================================
   💬 COMMENTS at the bottom of every tab and every card (tools.dubuddy.in)

   CMT.mount(host, place)  draws the thread for one place into `host` (on the
                           page or inside a space's shadow root):
                           place = { key, label, nav } — key "tab:…" / "card:…",
                           label "Social Media → Content Process", nav = the
                           app's "where am I" snapshot (index.html cmtPlace*)
   CMT.focus(id)           scroll to a comment and flash it (links in emails)

   Rich text (richtext.js turns the box into an editor), replies one level
   deep, photos / videos stored in Cloudflare R2 (through /api/pipeline), and
   @ to tag a teammate: they get an email with a link straight back here
   (Supabase function comment-mail) and a 🔔.
   Rows: Supabase table team_comments (supabase/stage19a_team_comments.sql).
   ===================================================================== */
(function(){
"use strict";
if(window.CMT) return;

const STYLE = `
.cmt2{margin:22px 0 8px;border:1px solid var(--line,#E7E1DA);border-radius:14px;background:var(--card,#fff);padding:14px 16px;font-size:14px;color:var(--ink,#1A1614);text-align:left}
.cmt2-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.cmt2-h b{font-size:15px}.cmt2-n{font:600 11px/1 ui-monospace,monospace;background:var(--bg,#F6F1EC);border-radius:20px;padding:4px 7px;color:var(--muted,#8C7F75)}
.cmt2-sub{color:var(--muted,#8C7F75);font-size:12.5px;flex:1;min-width:150px}
.cmt2-btn{border:1px solid var(--line,#E7E1DA);background:var(--card,#fff);color:inherit;border-radius:9px;padding:6px 11px;font:600 12.5px/1.2 inherit;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.cmt2-btn:hover{border-color:var(--accent,#E8622B)}.cmt2-btn:disabled{opacity:.55;cursor:default}
.cmt2-btn.pri{background:var(--accent,#E8622B);border-color:var(--accent,#E8622B);color:#fff}
.cmt2-btn.ghost{border-color:transparent;background:none;padding:4px 6px;color:var(--muted,#8C7F75);font-weight:600}
.cmt2-btn.ghost:hover{color:var(--accent,#E8622B)}
.cmt2-empty{color:var(--muted,#8C7F75);font-size:13px;padding:6px 0 10px}
.cmt2-it{display:flex;gap:10px;padding:10px 0;border-top:1px solid var(--line,#EFE9E3);border-radius:8px;transition:background .6s}
.cmt2-list>.cmt2-it:first-child{border-top:0}
.cmt2-it.flash{background:color-mix(in srgb,var(--accent,#E8622B) 13%,transparent)}
.cmt2-av{width:30px;height:30px;border-radius:50%;flex:0 0 30px;background:color-mix(in srgb,var(--accent,#E8622B) 18%,#fff);color:var(--accent,#E8622B);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;overflow:hidden}
.cmt2-av img{width:100%;height:100%;object-fit:cover}
.cmt2-main{flex:1;min-width:0}
.cmt2-top{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.cmt2-when{color:var(--muted,#8C7F75);font-size:12px}
.cmt2-body{margin-top:3px;line-height:1.5;word-wrap:break-word}.cmt2-body p{margin:0 0 4px}.cmt2-body ul,.cmt2-body ol{margin:2px 0 4px;padding-left:20px}
.cmt2-at{background:color-mix(in srgb,var(--accent,#E8622B) 14%,transparent);color:var(--accent,#E8622B);border-radius:5px;padding:0 3px;font-weight:600}
.cmt2-files{display:flex;flex-wrap:wrap;gap:8px;margin-top:7px}
.cmt2-files img{height:110px;max-width:200px;object-fit:cover;border-radius:9px;border:1px solid var(--line,#E7E1DA);cursor:zoom-in;background:var(--bg,#F6F1EC)}
.cmt2-files video{height:150px;max-width:100%;border-radius:9px;background:#000}
.cmt2-files .cmt2-file{font-size:12.5px;color:var(--muted,#8C7F75)}
.cmt2-acts{display:flex;gap:2px;margin-top:2px;margin-left:-6px}
.cmt2-replies{margin-top:4px;border-left:3px solid color-mix(in srgb,var(--accent,#E8622B) 35%,var(--line,#E7E1DA));padding-left:12px}
.cmt2-replies .cmt2-it{padding:8px 0}.cmt2-replies .cmt2-av{width:24px;height:24px;flex-basis:24px;font-size:11px}
.cmt2-re{font-size:11.5px;color:var(--muted,#8C7F75);margin-bottom:1px}
.cmt2-comp{position:relative;margin-top:10px;border-top:1px solid var(--line,#EFE9E3);padding-top:10px}
.cmt2-replies .cmt2-comp,.cmt2-main>.cmt2-comp{border-top:0;padding-top:4px;margin-top:6px}
.cmt2-comp textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#E7E1DA);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;min-height:62px;resize:vertical;background:var(--card,#fff);color:inherit}
.cmt2-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:7px}
.cmt2-tags{font-size:12px;color:var(--muted,#8C7F75);flex:1;min-width:120px}
.cmt2-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
.cmt2-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#E7E1DA);border-radius:8px;padding:4px 6px 4px 4px;font-size:12px;background:var(--bg,#F6F1EC);max-width:220px}
.cmt2-chip img,.cmt2-chip .ph{width:30px;height:30px;border-radius:6px;object-fit:cover;flex:0 0 30px;display:flex;align-items:center;justify-content:center;background:#000;color:#fff}
.cmt2-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmt2-chip button{border:0;background:none;cursor:pointer;font-size:14px;color:var(--muted,#8C7F75);padding:0 2px}
.cmt2-pop{position:absolute;z-index:50;left:10px;background:var(--card,#fff);border:1px solid var(--line,#E7E1DA);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.14);min-width:220px;max-width:320px;padding:4px;max-height:240px;overflow:auto}
.cmt2-pop button{display:flex;gap:8px;align-items:center;width:100%;border:0;background:none;text-align:left;padding:7px 8px;border-radius:7px;font:inherit;font-size:13.5px;cursor:pointer;color:inherit}
.cmt2-pop button.on,.cmt2-pop button:hover{background:color-mix(in srgb,var(--accent,#E8622B) 12%,transparent)}
.cmt2-pop .cmt2-av{width:24px;height:24px;flex-basis:24px;font-size:11px}
.cmt2-lb{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.cmt2-lb img{max-width:100%;max-height:92vh;border-radius:8px}
`;
const STYLED = new WeakSet();
function styleRoot(root){ if(STYLED.has(root)) return; STYLED.add(root);
  const s = document.createElement("style"); s.textContent = STYLE; (root === document ? document.head : root).appendChild(s); }
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const g = n => typeof window[n] === "function" ? window[n] : null;
const team = () => (typeof TEAM !== "undefined" && TEAM) || "";
const supa = () => (typeof SUPA !== "undefined" && SUPA) || null;
const toastMsg = m => { const t = g("toast"); if(t) t(m); else console.log(m); };
function people(){
  const us = typeof USERS !== "undefined" ? USERS : [], name = g("userDisplayName") || (u => u.name || u.email);
  const mem = g("isMember");
  return us.filter(u => u && u.id && (!mem || mem(u, team()))).map(u => ({ id: u.id, name: String(name(u) || "").trim() || "Someone", photo: (u.profile && u.profile.photo) || "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function me(){
  const cu = g("currentUser") ? currentUser() : null, name = g("userDisplayName");
  const id = (typeof AUTH_UID !== "undefined" && AUTH_UID) || (cu && cu.id) || "";
  return { id, name: (cu && name ? name(cu) : "") || "Me", photo: (cu && cu.profile && cu.profile.photo) || "" };
}
const isAdmin = () => { try{ return typeof can === "function" && can("admin"); }catch(_){ return false; } };
function ago(iso){
  const t = new Date(iso).getTime(), s = Math.floor((Date.now() - t) / 1000);
  if(s < 60) return "just now"; const m = Math.floor(s / 60); if(m < 60) return m + "m ago";
  const h = Math.floor(m / 60); if(h < 24) return h + "h ago"; const d = Math.floor(h / 24); if(d < 7) return d + "d ago";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}
const av = (name, photo) => `<span class="cmt2-av">${photo ? `<img src="${esc(photo)}" alt="">` : esc((name || "?").trim().charAt(0).toUpperCase())}</span>`;

/* ------------------------------------------------------------ server calls */
async function authHeaders(){
  const h = { "content-type": "application/json" };
  try{ const s = supa(); if(!window.LOCAL_MODE && s){ const { data } = await s.auth.getSession(); if(data && data.session) h.authorization = "Bearer " + data.session.access_token; } }catch(_){ }
  return h;
}
async function api(path, body){
  const r = await fetch(path, body ? { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) } : { headers: await authHeaders() });
  const j = await r.json().catch(() => ({ error: "The server didn't answer (" + r.status + ")" }));
  if(j.error) throw new Error(j.error); return j.data;
}
function put(url, file, onPc){
  return new Promise((ok, bad) => { const x = new XMLHttpRequest(); x.open("PUT", url);
    x.upload.onprogress = e => { if(e.lengthComputable && onPc) onPc(e.loaded / e.total); };
    x.onload = () => x.status < 300 ? ok() : bad(new Error("Upload refused (" + x.status + ")"));
    x.onerror = () => bad(new Error("Upload failed — check the connection")); x.send(file); });
}
const LINKS = {};   // file key → { url, at }
async function fileLinks(keys){
  const need = keys.filter(k => !LINKS[k] || Date.now() - LINKS[k].at > 5 * 3600e3);
  if(need.length){ try{ const d = await api("/api/pipeline/storage?team=" + encodeURIComponent(team()) + "&files=" + encodeURIComponent(need.join(",")));
    Object.keys(d || {}).forEach(k => { LINKS[k] = { url: d[k], at: Date.now() }; }); }catch(_){ } }
  const out = {}; keys.forEach(k => { if(LINKS[k]) out[k] = LINKS[k].url; }); return out;
}

/* ------------------------------------------------------------ one thread */
const CACHE = {};            // place key → { rows, at, drafts, replyTo }
const THREADS = new Set();   // mounted threads (to refresh, and to find a comment for CMT.focus)
let FOCUS = null;            // a comment to scroll to once it's drawn

function mount(host, place){
  if(!host || !place || !place.key) return null;
  if(host._cmt && host._cmt.place.key === place.key && host.contains(host._cmt.el)){   // already showing: just keep it fresh
    host._cmt.place = place; if(Date.now() - (host._cmt.at || 0) > 30000) host._cmt.refresh(); return host._cmt; }
  if(host._cmt) host._cmt.destroy();
  const root = host.getRootNode(); styleRoot(root);
  const el = document.createElement("div"); el.className = "cmt2"; host.innerHTML = ""; host.appendChild(el);
  // a card redraws often: what was loaded (and anything half-written) is kept per place, not per drawing
  const C = CACHE[place.key] || (CACHE[place.key] = { rows: [], at: 0, drafts: {}, replyTo: null });
  const T = { el, place, rows: C.rows, loaded: !!C.at, at: C.at, drafts: C.drafts, get replyTo(){ return C.replyTo; }, set replyTo(v){ C.replyTo = v; } };
  host._cmt = T; THREADS.add(T);

  async function load(){
    const s = supa(); if(!s){ T.loaded = true; draw(); return; }
    const { data, error } = await s.from("team_comments").select("*").eq("team_slug", team()).eq("place", T.place.key).order("created_at", { ascending: true });
    if(error){ T.error = /relation|does not exist|schema cache/i.test(error.message) ? "Comments aren't switched on yet (the team_comments table is missing)." : error.message; }
    else { T.error = null; T.rows = C.rows = data || []; }
    T.loaded = true; T.at = C.at = Date.now(); draw();
  }
  T.refresh = () => load();
  T.destroy = () => { THREADS.delete(T); clearInterval(T.timer); el.remove(); };
  T.timer = setInterval(() => { if(!el.isConnected){ T.destroy(); return; } if(!document.hidden && !busy()) load(); }, 60000);
  const busy = () => [...el.querySelectorAll(".cmt2-comp textarea")].some(t => (t.value || "").trim()) || el.querySelector(".cmt2-chip");

  function bodyHtml(row){
    let h = window.RT ? RT.html(row.body || "") : esc(row.body || "").replace(/\n/g, "<br>");
    const names = people().filter(p => (row.mentions || []).includes(p.id)).map(p => p.name).sort((a, b) => b.length - a.length);
    names.forEach(n => { const e = esc("@" + n); h = h.split(e).join(`<span class="cmt2-at">${e}</span>`); });
    return h;
  }
  function filesHtml(row){
    const fs = row.files || []; if(!fs.length) return "";
    return `<div class="cmt2-files">${fs.map(f => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name)
      ? `<video controls preload="metadata" playsinline data-cmtfile="${esc(f.key)}"></video>`
      : `<img alt="${esc(f.name)}" loading="lazy" data-cmtfile="${esc(f.key)}">`).join("")}</div>`;
  }
  function itemHtml(row, reply, parentName){
    const mine = row.author_id === me().id, ppl = people(), p = ppl.find(x => x.id === row.author_id);
    return `<div class="cmt2-it" id="cm-${esc(row.id)}" data-id="${esc(row.id)}">${av(row.author_name, p && p.photo)}
      <div class="cmt2-main">
        ${reply ? `<div class="cmt2-re">↳ reply to ${esc(parentName || "a comment")}</div>` : ""}
        <div class="cmt2-top"><b>${esc(row.author_name || (p && p.name) || "Someone")}</b><span class="cmt2-when" title="${esc(new Date(row.created_at).toLocaleString())}">${esc(ago(row.created_at))}</span></div>
        <div class="cmt2-body">${bodyHtml(row)}</div>${filesHtml(row)}
        <div class="cmt2-acts"><button type="button" class="cmt2-btn ghost" data-reply="${esc(reply ? row.parent_id : row.id)}">↩ Reply</button>
          ${mine || isAdmin() ? `<button type="button" class="cmt2-btn ghost" data-del="${esc(row.id)}">Delete</button>` : ""}</div>
        ${reply ? "" : `<div class="cmt2-replies" ${T.rows.some(r => r.parent_id === row.id) || T.replyTo === row.id ? "" : "hidden"}>
          ${T.rows.filter(r => r.parent_id === row.id).map(r => itemHtml(r, true, row.author_name)).join("")}
          ${T.replyTo === row.id ? `<div data-compfor="${esc(row.id)}"></div>` : ""}</div>`}
      </div></div>`;
  }
  function draw(){
    if(!el.isConnected && !host.isConnected) return;
    const tops = T.rows.filter(r => !r.parent_id);
    el.innerHTML = `<div class="cmt2-h"><b>💬 Comments</b>${T.rows.length ? `<span class="cmt2-n">${T.rows.length}</span>` : ""}
        <span class="cmt2-sub">${esc(T.place.label || "")}${T.place.label ? " · " : ""}type @ to tag a teammate — they get an email</span>
        <button type="button" class="cmt2-btn ghost" data-reload title="Check for new comments">↻</button></div>
      ${T.error ? `<div class="cmt2-empty">${esc(T.error)}</div>`
        : !T.loaded ? `<div class="cmt2-empty">Loading comments…</div>`
        : `<div class="cmt2-list">${tops.length ? tops.map(r => itemHtml(r, false)).join("") : `<div class="cmt2-empty">No comments yet — start the discussion.</div>`}</div>
           <div data-compfor=""></div>`}`;
    el.querySelectorAll("[data-compfor]").forEach(slot => composer(slot, slot.dataset.compfor || null));
    el.querySelector("[data-reload]").onclick = () => load();
    el.querySelectorAll("[data-reply]").forEach(b => b.onclick = () => { T.replyTo = T.replyTo === b.dataset.reply ? null : b.dataset.reply; draw();
      const box = el.querySelector(`[data-compfor="${CSS.escape(b.dataset.reply)}"] textarea`); if(box) setTimeout(() => box.focus(), 30); });
    el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => remove(b.dataset.del));
    // photos / videos: short-lived links
    const keys = [...el.querySelectorAll("[data-cmtfile]")].map(x => x.dataset.cmtfile);
    if(keys.length) fileLinks([...new Set(keys)]).then(L => el.querySelectorAll("[data-cmtfile]").forEach(x => { const u = L[x.dataset.cmtfile]; if(u && x.src !== u){ x.src = u;
      if(x.tagName === "IMG") x.onclick = () => { const o = document.createElement("div"); o.className = "cmt2-lb"; o.innerHTML = `<img src="${esc(u)}" alt="">`; o.onclick = () => o.remove(); (root === document ? document.body : root).appendChild(o); }; } }));
    if(FOCUS) focusNow();
  }

  // the box to write a comment (parent = the comment a reply answers)
  function composer(slot, parent){
    const dk = parent || "", d = T.drafts[dk] || (T.drafts[dk] = { files: [], tags: {} });
    slot.innerHTML = `<div class="cmt2-comp">
        <textarea rows="2" placeholder="${parent ? "Write a reply…" : "Write a comment… type @ to tag someone"}" aria-label="${parent ? "Reply" : "Comment"}"></textarea>
        <div class="cmt2-chips"></div>
        <div class="cmt2-row"><label class="cmt2-btn" title="Attach photos or videos">📎 Photo / video<input type="file" accept="image/*,video/*" multiple hidden></label>
          <span class="cmt2-tags"></span>
          ${parent ? `<button type="button" class="cmt2-btn" data-cancel>Cancel</button>` : ""}
          <button type="button" class="cmt2-btn pri" data-post>${parent ? "Reply" : "Post"}</button></div>
        <div class="cmt2-pop" hidden></div></div>`;
    const comp = slot.firstElementChild, ta = comp.querySelector("textarea"), chips = comp.querySelector(".cmt2-chips"),
      tagsEl = comp.querySelector(".cmt2-tags"), pop = comp.querySelector(".cmt2-pop"), post = comp.querySelector("[data-post]");
    ta.value = d.text || "";
    ta.addEventListener("input", () => { d.text = ta.value; showTags(); });
    if(window.RT && RT.enhance) RT.enhance(ta);
    const ed = ta._rt ? ta._rt.ed : ta, wrap = ta._rt ? ta._rt.wrap : ta;
    const showTags = () => { const t = Object.entries(d.tags).filter(([, n]) => (ta.value || "").includes("@" + n)).map(([, n]) => n);
      tagsEl.textContent = t.length ? "Tagging: " + t.join(", ") + " — they'll get an email" : ""; };
    const drawChips = () => { chips.innerHTML = d.files.map((f, i) => `<span class="cmt2-chip">${/^image\//.test(f.type) ? `<img src="${esc(f.prev || "")}" alt="">` : `<span class="ph">▶</span>`}<span>${esc(f.name)}</span><button type="button" data-rm="${i}" title="Remove">×</button></span>`).join("");
      chips.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const f = d.files.splice(+b.dataset.rm, 1)[0]; if(f && f.prev) URL.revokeObjectURL(f.prev); drawChips(); }); };
    drawChips(); showTags();
    comp.querySelector("input[type=file]").onchange = e => { [...e.target.files].forEach(f => {
        if(!/^(image|video)\//.test(f.type) && !/\.(jpe?g|png|gif|webp|heic|mp4|mov|m4v|webm)$/i.test(f.name)){ toastMsg("Attach photos or videos only"); return; }
        const video = /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
        if(f.size > (video ? 300e6 : 20e6)){ toastMsg(video ? "Videos up to 300 MB" : "Photos up to 20 MB"); return; }
        d.files.push({ file: f, name: f.name, type: f.type || (video ? "video/mp4" : "image/jpeg"), size: f.size, prev: /^image\//.test(f.type) ? URL.createObjectURL(f) : "" }); });
      e.target.value = ""; drawChips(); };
    const cancel = comp.querySelector("[data-cancel]"); if(cancel) cancel.onclick = () => { T.replyTo = null; delete T.drafts[dk]; draw(); };

    // @ → pick a teammate
    const selOf = () => (root.getSelection ? root.getSelection() : null) || document.getSelection();
    let q = null, hits = [], on = 0;
    function caretQuery(){
      const s = selOf(); if(!s || !s.rangeCount || !s.isCollapsed) return null;
      const r = s.getRangeAt(0), n = r.startContainer; if(n.nodeType !== 3 || !ed.contains(n)) return null;
      const before = n.nodeValue.slice(0, r.startOffset), m = /(^|[\s(])@([^\s@]{0,30})$/.exec(before);
      return m ? { node: n, end: r.startOffset, start: r.startOffset - m[2].length - 1, text: m[2].toLowerCase() } : null;
    }
    function drawPop(){
      if(!q){ pop.hidden = true; return; }
      hits = people().filter(p => p.id !== me().id && p.name.toLowerCase().split(/\s+/).concat(p.name.toLowerCase()).some(w => w.startsWith(q.text))).slice(0, 7);
      if(!hits.length){ pop.hidden = true; return; }
      on = Math.min(on, hits.length - 1);
      pop.innerHTML = hits.map((p, i) => `<button type="button" class="${i === on ? "on" : ""}" data-i="${i}">${av(p.name, p.photo)}<span>${esc(p.name)}</span></button>`).join("");
      pop.style.top = (wrap.offsetTop + wrap.offsetHeight + 2) + "px"; pop.hidden = false;
      pop.querySelectorAll("button").forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => pick(hits[+b.dataset.i]); });
    }
    function pick(p){
      const cq = caretQuery() || q; if(!cq || !p) return;
      const s = selOf(), r = document.createRange(); r.setStart(cq.node, cq.start); r.setEnd(cq.node, cq.end);
      s.removeAllRanges(); s.addRange(r); document.execCommand("insertText", false, "@" + p.name + " ");
      d.tags[p.id] = p.name; q = null; drawPop(); ed.dispatchEvent(new Event("input")); showTags();
    }
    ed.addEventListener("keyup", e => { if(["ArrowDown","ArrowUp","Enter","Tab","Escape"].includes(e.key) && !pop.hidden) return; const nq = caretQuery(); if(!nq || !q || nq.text !== q.text) on = 0; q = nq; drawPop(); });
    ed.addEventListener("blur", () => setTimeout(() => { q = null; drawPop(); }, 150));
    wrap.addEventListener("keydown", e => {
      if(pop.hidden) { if((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); e.stopPropagation(); post.click(); } return; }
      if(e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); e.stopPropagation(); on = (on + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length; drawPop(); }
      else if(e.key === "Enter" || e.key === "Tab"){ e.preventDefault(); e.stopPropagation(); pick(hits[on]); }
      else if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); q = null; drawPop(); }
    }, true);

    post.onclick = async () => {
      const text = (ta.value || "").trim();
      if(!text && !d.files.length){ ta.focus(); return; }
      const s = supa(); if(!s){ toastMsg("Sign in first"); return; }
      post.disabled = true; const label = post.textContent;
      try{
        const files = [];
        for(let i = 0; i < d.files.length; i++){ const f = d.files[i];
          post.textContent = `Uploading ${i + 1}/${d.files.length}…`;
          const up = await api("/api/pipeline/upload-url", { team: team(), kind: "comment", name: f.name, size: f.size });
          await put(up.url, f.file, pc => { post.textContent = `Uploading ${i + 1}/${d.files.length}… ${Math.round(pc * 100)}%`; });
          files.push({ key: up.key, name: f.name, type: f.type, size: f.size }); }
        post.textContent = "Posting…";
        const mentions = Object.entries(d.tags).filter(([, n]) => text.includes("@" + n)).map(([id]) => id);
        const m = me(), row = { team_slug: team(), place: T.place.key, place_label: String(T.place.label || "").slice(0, 200), nav: T.place.nav || {},
          parent_id: parent || null, author_id: m.id, author_name: m.name.slice(0, 120), body: text, mentions, files };
        if(window.LOCAL_MODE) row.created_at = new Date().toISOString();
        const { data, error } = await s.from("team_comments").insert(row).select("*").single();
        if(error) throw new Error(error.message);
        d.files.forEach(f => f.prev && URL.revokeObjectURL(f.prev)); delete T.drafts[dk]; if(parent) T.replyTo = null;
        T.rows.push(data || row); C.rows = T.rows; draw();
        if(mentions.length && !window.LOCAL_MODE && data && data.id){
          s.functions.invoke("comment-mail", { body: { team: team(), comment_id: data.id, app_url: location.origin + "/" } })
            .then(r => { const x = r && r.data; if(x && x.sent) toastMsg(`Emailed ${x.sent} teammate${x.sent > 1 ? "s" : ""} ✓`); else if(x && x.errors && x.errors.length) toastMsg("Couldn't send the email: " + x.errors[0]); })
            .catch(() => {});
        }
      }catch(e){ toastMsg("Couldn't post: " + e.message); post.disabled = false; post.textContent = label; }
    };
  }

  async function remove(id){
    const row = T.rows.find(r => r.id === id); if(!row) return;
    const kids = T.rows.filter(r => r.parent_id === id);
    if(!confirm(kids.length ? `Delete this comment and its ${kids.length} repl${kids.length > 1 ? "ies" : "y"}?` : "Delete this comment?")) return;
    const s = supa(); const { error } = await s.from("team_comments").delete().eq("id", id);
    if(error){ toastMsg("Couldn't delete: " + error.message); return; }
    const keys = [row, ...kids].flatMap(r => (r.files || []).map(f => f.key));
    T.rows = C.rows = T.rows.filter(r => r.id !== id && r.parent_id !== id); draw();
    if(keys.length) api("/api/pipeline/storage", { team: team(), op: "comment_files_gone", keys }).catch(() => {});   // its photos / videos leave storage too
  }

  draw(); if(Date.now() - C.at > 30000) load();
  return T;
}

function focusNow(){
  if(!FOCUS) return;
  for(const T of THREADS){ const it = T.el.querySelector("#cm-" + CSS.escape(FOCUS)); if(it){ FOCUS = null;
    it.scrollIntoView({ behavior: "smooth", block: "center" }); it.classList.add("flash"); setTimeout(() => it.classList.remove("flash"), 2600); return; } }
}
window.CMT = {
  mount,
  focus(id){ FOCUS = id; focusNow(); setTimeout(() => { if(FOCUS === id) FOCUS = null; }, 20000); },
  refreshAll(){ THREADS.forEach(T => T.refresh()); },
};
})();
