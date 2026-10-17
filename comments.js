/* =====================================================================
   💬 ACTIVITY at the bottom of every Social Media card and idea (tools.dubuddy.in)
   Comments + History, like a Jira issue: "Show: All · Comments · History",
   newest or oldest first, "Add a comment…" that opens into a rich-text box
   with a ＋ for photos, videos and files, Reply · Edit · Delete, and @ to tag
   a teammate (they get an email + 🔔 with a link straight back here).

   CMT.mount(host, place)  draws it into `host` (on the page or inside a
                           space's shadow root). place = { key, label, nav,
                           history? } — key "tab:…" / "card:…", label for
                           people ("Social Media → Content Process"), nav =
                           the app's "where am I" snapshot (for email links),
                           history = { place } | { scope } which 🕘 rows to show
   CMT.log(events)         record changes for 🕘 History (social-space.js)
   CMT.focus(id)           scroll to a comment and flash it (links in emails)
   Press M anywhere (not while typing) to start a comment.

   Tables: team_comments (stage19a) and team_activity (stage19b). Files go to
   Cloudflare R2 through /api/pipeline. Emails: Supabase function comment-mail.
   ===================================================================== */
(function(){
"use strict";
if(window.CMT) return;

const STYLE = `
.cmt2{margin:22px 0 8px;border:1px solid var(--line,#E7E1DA);border-radius:14px;background:var(--card,#fff);padding:16px 18px;font-size:14px;color:var(--ink,#1A1614);text-align:left}
.cmt2-title{font-size:16px;font-weight:800;margin:0 0 10px}
.cmt2-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px}
.cmt2-bar .cmt2-lbl{color:var(--muted,#6F655D);font-size:13.5px;margin-right:2px}
.cmt2-chipf{border:0;background:var(--bg,#F3EEE9);color:inherit;border-radius:6px;padding:6px 10px;font:600 13px/1.1 inherit;cursor:pointer}
.cmt2-chipf:hover{background:color-mix(in srgb,var(--accent,#E8622B) 10%,var(--bg,#F3EEE9))}
.cmt2-chipf.on{background:color-mix(in srgb,var(--accent,#E8622B) 15%,#fff);color:var(--accent,#E8622B)}
.cmt2-sp{flex:1}
.cmt2-sub{color:var(--muted,#8C7F75);font-size:12px;margin:2px 0 12px}
.cmt2-btn{border:1px solid var(--line,#E7E1DA);background:var(--card,#fff);color:inherit;border-radius:8px;padding:6px 12px;font:600 13px/1.2 inherit;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.cmt2-btn:hover{border-color:var(--accent,#E8622B)}.cmt2-btn:disabled{opacity:.55;cursor:default}
.cmt2-btn.pri{background:var(--accent,#E8622B);border-color:var(--accent,#E8622B);color:#fff}
.cmt2-btn.plain{border-color:transparent;background:none}
.cmt2-btn.plain:hover{background:var(--bg,#F3EEE9)}
.cmt2-plus{width:32px;height:32px;padding:0;justify-content:center;font-size:19px;font-weight:500;border-radius:50%}
.cmt2-new{display:flex;gap:12px;align-items:flex-start}
.cmt2-fake{flex:1;text-align:left;border:1px solid var(--line,#D9D2CB);border-radius:6px;background:var(--card,#fff);padding:11px 14px;color:var(--muted,#8C7F75);font:inherit;font-size:14px;cursor:text}
.cmt2-fake:hover{border-color:color-mix(in srgb,var(--accent,#E8622B) 50%,var(--line,#D9D2CB))}
.cmt2-tip{margin:6px 0 4px 44px;color:var(--muted,#8C7F75);font-size:12.5px}
.cmt2-tip kbd{font:600 11px ui-monospace,monospace;background:var(--bg,#F3EEE9);border:1px solid var(--line,#E7E1DA);border-radius:4px;padding:1px 5px;color:var(--ink,#1A1614)}
.cmt2-empty{color:var(--muted,#8C7F75);font-size:13px;padding:10px 0 4px 44px}
.cmt2-list{margin-top:8px}
.cmt2-it{display:flex;gap:12px;padding:12px 0 6px;border-radius:8px;transition:background .6s}
.cmt2-it.flash{background:color-mix(in srgb,var(--accent,#E8622B) 13%,transparent)}
.cmt2-av{width:32px;height:32px;border-radius:50%;flex:0 0 32px;background:color-mix(in srgb,var(--accent,#E8622B) 18%,#fff);color:var(--accent,#E8622B);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;overflow:hidden}
.cmt2-av img{width:100%;height:100%;object-fit:cover}
.cmt2-av.sys{background:var(--bg,#F3EEE9);color:var(--muted,#8C7F75);font-size:14px}
.cmt2-main{flex:1;min-width:0}
.cmt2-top{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.cmt2-top b{font-weight:700}
.cmt2-when{color:var(--muted,#8C7F75);font-size:12.5px}
.cmt2-body{margin-top:4px;line-height:1.55;word-wrap:break-word}.cmt2-body p{margin:0 0 4px}.cmt2-body ul,.cmt2-body ol{margin:2px 0 4px;padding-left:20px}
.cmt2-at{background:color-mix(in srgb,var(--accent,#E8622B) 14%,transparent);color:var(--accent,#E8622B);border-radius:5px;padding:0 3px;font-weight:600}
.cmt2-files{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.cmt2-files img{height:110px;max-width:200px;object-fit:cover;border-radius:8px;border:1px solid var(--line,#E7E1DA);cursor:zoom-in;background:var(--bg,#F3EEE9)}
.cmt2-files video{height:160px;max-width:100%;border-radius:8px;background:#000}
.cmt2-doc{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line,#E7E1DA);border-radius:8px;padding:8px 11px;font-size:13px;color:inherit;text-decoration:none;max-width:280px;background:var(--card,#fff)}
.cmt2-doc:hover{border-color:var(--accent,#E8622B)}.cmt2-doc span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cmt2-doc small{color:var(--muted,#8C7F75);flex:0 0 auto}
.cmt2-acts{display:flex;align-items:center;gap:2px;margin-top:4px;color:var(--muted,#8C7F75);font-size:13px}
.cmt2-acts button{border:0;background:none;padding:2px 3px;font:600 13px inherit;color:var(--muted,#6F655D);cursor:pointer;border-radius:4px}
.cmt2-acts button:hover{color:var(--accent,#E8622B);text-decoration:underline}
.cmt2-acts i{font-style:normal;padding:0 2px}
.cmt2-replies{margin:6px 0 0;border-left:3px solid color-mix(in srgb,var(--accent,#E8622B) 35%,var(--line,#E7E1DA));padding-left:14px}
.cmt2-replies .cmt2-it{padding:8px 0 4px}.cmt2-replies .cmt2-av{width:26px;height:26px;flex-basis:26px;font-size:11px}
.cmt2-re{font-size:12px;color:var(--muted,#8C7F75);margin-bottom:2px}
.cmt2-chg{margin-top:5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13.5px}
.cmt2-chg .old{color:var(--muted,#8C7F75);text-decoration:line-through;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmt2-chg .new{max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmt2-chg .tag{background:var(--bg,#F3EEE9);border-radius:4px;padding:2px 7px;font:600 11.5px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.3px;text-decoration:none}
.cmt2-chg .old.tag{text-decoration:line-through}
.cmt2-comp{position:relative;flex:1;min-width:0}
.cmt2-comp textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#E7E1DA);border-radius:6px;padding:9px 11px;font:inherit;font-size:14px;min-height:74px;resize:vertical;background:var(--card,#fff);color:inherit}
.cmt2-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}
.cmt2-tags{font-size:12px;color:var(--muted,#8C7F75);flex:1;min-width:120px}
.cmt2-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.cmt2-chips:empty{display:none}
.cmt2-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#E7E1DA);border-radius:8px;padding:4px 6px 4px 4px;font-size:12px;background:var(--bg,#F3EEE9);max-width:240px}
.cmt2-chip img,.cmt2-chip .ph{width:30px;height:30px;border-radius:6px;object-fit:cover;flex:0 0 30px;display:flex;align-items:center;justify-content:center;background:#fff;font-size:15px}
.cmt2-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmt2-chip button{border:0;background:none;cursor:pointer;font-size:14px;color:var(--muted,#8C7F75);padding:0 2px}
.cmt2-menu{position:absolute;z-index:60;background:var(--card,#fff);border:1px solid var(--line,#E7E1DA);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.14);padding:4px;min-width:230px}
.cmt2-menu button,.cmt2-pop button{display:flex;gap:9px;align-items:center;width:100%;border:0;background:none;text-align:left;padding:8px 9px;border-radius:7px;font:inherit;font-size:13.5px;cursor:pointer;color:inherit}
.cmt2-menu button:hover,.cmt2-pop button.on,.cmt2-pop button:hover{background:color-mix(in srgb,var(--accent,#E8622B) 12%,transparent)}
.cmt2-menu small{display:block;color:var(--muted,#8C7F75);font-size:11.5px}
.cmt2-pop{position:absolute;z-index:60;left:10px;background:var(--card,#fff);border:1px solid var(--line,#E7E1DA);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.14);min-width:220px;max-width:320px;padding:4px;max-height:240px;overflow:auto}
.cmt2-pop .cmt2-av{width:24px;height:24px;flex-basis:24px;font-size:11px}
.cmt2-lb{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.cmt2-lb img{max-width:100%;max-height:92vh;border-radius:8px}
@media (max-width:600px){ .cmt2{padding:14px 12px} .cmt2-tip,.cmt2-empty{margin-left:0;padding-left:0} .cmt2-new{gap:8px} }
`;
const STYLED = new WeakSet();
function styleRoot(root){ if(STYLED.has(root)) return; STYLED.add(root);
  const s = document.createElement("style"); s.textContent = STYLE; (root === document ? document.head : root).appendChild(s); }
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const g = n => typeof window[n] === "function" ? window[n] : null;
const team = () => (typeof TEAM !== "undefined" && TEAM) || "";
const supa = () => (typeof SUPA !== "undefined" && SUPA) || null;
const toastMsg = m => { const t = g("toast"); if(t) t(m); else console.log(m); };
const pref = (k, d) => { try{ return localStorage.getItem("cmt-" + k) || d; }catch(_){ return d; } };
const setPref = (k, v) => { try{ localStorage.setItem("cmt-" + k, v); }catch(_){ } };
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
  if(s < 45) return s < 10 ? "just now" : s + " seconds ago"; const m = Math.floor(s / 60);
  if(m < 60) return m <= 1 ? "a minute ago" : m + " minutes ago";
  const h = Math.floor(m / 60); if(h < 24) return h === 1 ? "an hour ago" : h + " hours ago";
  const d = Math.floor(h / 24); if(d < 7) return d === 1 ? "yesterday" : d + " days ago";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}
const av = (name, photo) => `<span class="cmt2-av">${photo ? `<img src="${esc(photo)}" alt="">` : esc((name || "?").trim().charAt(0).toUpperCase())}</span>`;
const photoOf = id => { const p = people().find(x => x.id === id); return p ? p.photo : ""; };
const kb = n => n >= 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB";
const isImg = f => /^image\//.test(f.type || "") || /\.(jpe?g|png|gif|webp|heic)$/i.test(f.name || "");
const isVid = f => /^video\//.test(f.type || "") || /\.(mp4|mov|m4v|webm)$/i.test(f.name || "");
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|key|pages|numbers|psd|ai|fig|srt)$/i;
const fileIcon = n => /\.pdf$/i.test(n) ? "📕" : /\.(xlsx?|csv|numbers)$/i.test(n) ? "📗" : /\.(pptx?|key)$/i.test(n) ? "📙" : /\.zip$/i.test(n) ? "🗜️" : "📄";
const LIMIT = f => isVid(f) ? 300e6 : isImg(f) ? 20e6 : 50e6;

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
async function uploadAll(list, onStep){
  const out = [];
  for(let i = 0; i < list.length; i++){ const f = list[i];
    if(f.key){ out.push({ key: f.key, name: f.name, type: f.type, size: f.size }); continue; }   // already stored (editing)
    onStep(`Uploading ${i + 1}/${list.length}…`);
    const up = await api("/api/pipeline/upload-url", { team: team(), kind: "comment", name: f.name, size: f.size });
    await put(up.url, f.file, pc => onStep(`Uploading ${i + 1}/${list.length}… ${Math.round(pc * 100)}%`));
    out.push({ key: up.key, name: f.name, type: f.type, size: f.size }); }
  return out;
}
const filesGone = keys => { if(keys.length) api("/api/pipeline/storage", { team: team(), op: "comment_files_gone", keys }).catch(() => {}); };

/* ------------------------------------------------------------ one Activity box */
const CACHE = {};            // place key → { rows, hist, at, drafts, open, replyTo, editing }
const THREADS = new Set();   // mounted boxes (to refresh, and to find a comment for CMT.focus / the M key)
let FOCUS = null;            // a comment to scroll to once it's drawn

function mount(host, place){
  if(!host || !place || !place.key) return null;
  if(host._cmt && host._cmt.place.key === place.key && host.contains(host._cmt.el)){   // already showing: just keep it fresh
    host._cmt.place = place; if(Date.now() - (host._cmt.C.at || 0) > 30000) host._cmt.refresh(); return host._cmt; }
  if(host._cmt) host._cmt.destroy();
  const root = host.getRootNode(); styleRoot(root);
  const el = document.createElement("div"); el.className = "cmt2"; host.innerHTML = ""; host.appendChild(el);
  // a card redraws often: what was loaded (and anything half-written) is kept per place, not per drawing
  const C = CACHE[place.key] || (CACHE[place.key] = { rows: [], hist: [], at: 0, drafts: {}, open: false, replyTo: null, editing: null });
  const T = { el, place, C };
  host._cmt = T; THREADS.add(T);

  async function load(){
    const s = supa(); if(!s){ C.at = Date.now(); draw(); return; }
    const hq = T.place.history, H = hq && (hq.place || hq.scope);
    const [cm, hi] = await Promise.all([
      s.from("team_comments").select("*").eq("team_slug", team()).eq("place", T.place.key).order("created_at", { ascending: true }),
      H ? s.from("team_activity").select("*").eq("team_slug", team()).eq(hq.place ? "place" : "scope", H).order("created_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [] }) ]);
    if(cm.error){ C.error = /relation|does not exist|schema cache/i.test(cm.error.message) ? "Comments aren't switched on yet (the team_comments table is missing)." : cm.error.message; }
    else { C.error = null; C.rows = cm.data || []; }
    C.hist = hi && !hi.error ? (hi.data || []) : [];
    C.at = Date.now(); draw();
  }
  T.refresh = () => load();
  T.destroy = () => { THREADS.delete(T); clearInterval(T.timer); el.remove(); };
  T.openComposer = () => { C.open = true; draw(); const ta = el.querySelector('[data-compfor=""] textarea'); if(ta){ el.scrollIntoView({ block: "nearest" }); setTimeout(() => ta.focus(), 30); } };
  T.timer = setInterval(() => { if(!el.isConnected){ T.destroy(); return; } if(!document.hidden && !busy()) load(); }, 60000);
  const busy = () => C.open || C.replyTo || C.editing;

  function bodyHtml(row){
    let h = window.RT ? RT.html(row.body || "") : esc(row.body || "").replace(/\n/g, "<br>");
    const names = people().filter(p => (row.mentions || []).includes(p.id)).map(p => p.name).sort((a, b) => b.length - a.length);
    names.forEach(n => { const e = esc("@" + n); h = h.split(e).join(`<span class="cmt2-at">${e}</span>`); });
    return h;
  }
  function filesHtml(fs){
    if(!fs || !fs.length) return "";
    return `<div class="cmt2-files">${fs.map(f => isVid(f) ? `<video controls preload="metadata" playsinline data-cmtfile="${esc(f.key)}"></video>`
      : isImg(f) ? `<img alt="${esc(f.name)}" loading="lazy" data-cmtfile="${esc(f.key)}">`
      : `<a class="cmt2-doc" data-cmtfile="${esc(f.key)}" target="_blank" rel="noopener">${fileIcon(f.name)} <span>${esc(f.name)}</span> <small>${kb(f.size || 0)}</small></a>`).join("")}</div>`;
  }
  function commentHtml(row, reply, parentName){
    const mine = row.author_id === me().id;
    if(C.editing === row.id) return `<div class="cmt2-it" id="cm-${esc(row.id)}">${av(row.author_name, photoOf(row.author_id))}<div class="cmt2-main" data-compfor="edit:${esc(row.id)}"></div></div>`;
    const acts = [`<button type="button" data-reply="${esc(reply ? row.parent_id : row.id)}">Reply</button>`];
    if(mine) acts.push(`<button type="button" data-edit="${esc(row.id)}">Edit</button>`);
    if(mine || isAdmin()) acts.push(`<button type="button" data-del="${esc(row.id)}">Delete</button>`);
    const kids = reply ? [] : C.rows.filter(r => r.parent_id === row.id);
    return `<div class="cmt2-it" id="cm-${esc(row.id)}">${av(row.author_name, photoOf(row.author_id))}
      <div class="cmt2-main">
        ${reply ? `<div class="cmt2-re">↳ reply to ${esc(parentName || "a comment")}</div>` : ""}
        <div class="cmt2-top"><b>${esc(row.author_name || "Someone")}</b><span class="cmt2-when" title="${esc(new Date(row.created_at).toLocaleString())}">${esc(ago(row.created_at))}${row.edited_at ? " · edited" : ""}</span></div>
        <div class="cmt2-body">${bodyHtml(row)}</div>${filesHtml(row.files)}
        <div class="cmt2-acts">${acts.join("<i>·</i>")}</div>
        ${reply || (!kids.length && C.replyTo !== row.id) ? "" : `<div class="cmt2-replies">
          ${kids.map(r => commentHtml(r, true, row.author_name)).join("")}
          ${C.replyTo === row.id ? `<div class="cmt2-it">${av(me().name, me().photo)}<div class="cmt2-main" data-compfor="${esc(row.id)}"></div></div>` : ""}</div>`}
      </div></div>`;
  }
  function histHtml(h){
    const short = v => String(v || "").replace(/\s+/g, " ").trim();
    const on = T.place.history && T.place.history.scope ? ` on the ${esc(h.place_label || "card")}` : "";
    let what, chg = "";
    if(h.field === "created") what = `created the ${esc(h.place_label || "card")}`;
    else if(h.field === "deleted") what = `deleted the ${esc(h.place_label || "card")}`;
    else {
      what = `changed the <b>${esc(h.field)}</b>${on}`;
      const o = short(h.old_val), n = short(h.new_val), tag = /^(Status|Post on|Video type)$/.test(h.field) ? " tag" : "";
      chg = `<div class="cmt2-chg">${o ? `<span class="old${tag}" title="${esc(o)}">${esc(o)}</span>` : `<span class="old" style="text-decoration:none">None</span>`}
        <span aria-hidden="true">→</span>${n ? `<span class="new${tag}" title="${esc(n)}">${esc(n)}</span>` : `<span class="new" style="color:var(--muted,#8C7F75)">None</span>`}</div>`;
    }
    return `<div class="cmt2-it">${av(h.actor_name, photoOf(h.actor_id))}<div class="cmt2-main">
      <div class="cmt2-top"><span><b>${esc(h.actor_name || "Someone")}</b> ${what}</span><span class="cmt2-when" title="${esc(new Date(h.created_at).toLocaleString())}">${esc(ago(h.created_at))}</span></div>${chg}</div></div>`;
  }
  function draw(){
    if(!host.isConnected && !el.isConnected) return;
    const show = pref("show", "comments"), newest = pref("order", "newest") === "newest", m = me();
    const hasHist = !!T.place.history;
    let items = [];
    if(show !== "history") items = items.concat(C.rows.filter(r => !r.parent_id).map(r => ({ at: r.created_at, html: () => commentHtml(r, false) })));
    if(show !== "comments" && hasHist) items = items.concat(C.hist.map(h => ({ at: h.created_at, html: () => histHtml(h) })));
    items.sort((a, b) => newest ? (a.at < b.at ? 1 : -1) : (a.at > b.at ? 1 : -1));
    const nC = C.rows.length;
    const empty = show === "history" ? (hasHist ? "No changes recorded yet." : "No history kept here.")
      : show === "comments" ? "No comments yet." : "Nothing here yet.";
    el.innerHTML = `<div class="cmt2-title">Activity</div>
      <div class="cmt2-bar"><span class="cmt2-lbl">Show:</span>
        ${[["all","All"],["comments","Comments" + (nC ? " " + nC : "")],["history","History"]].map(([k, l]) => `<button type="button" class="cmt2-chipf ${show === k ? "on" : ""}" data-show="${k}">${l}</button>`).join("")}
        <span class="cmt2-sp"></span>
        <button type="button" class="cmt2-chipf" data-order title="Change the order">${newest ? "Newest first ↓" : "Oldest first ↑"}</button>
        <button type="button" class="cmt2-btn plain" data-reload title="Check for new activity">↻</button></div>
      <div class="cmt2-sub">${esc(T.place.label || "")}${T.place.label ? " · " : ""}type @ to tag a teammate — they get an email</div>
      ${C.error ? `<div class="cmt2-empty">${esc(C.error)}</div>` : `
      ${show === "history" ? "" : `<div class="cmt2-new">${av(m.name, m.photo)}${C.open ? `<div class="cmt2-main" data-compfor=""></div>`
          : `<button type="button" class="cmt2-fake" data-start>Add a comment…</button>`}</div>
        ${C.open ? "" : `<div class="cmt2-tip"><b>Pro tip:</b> press <kbd>M</kbd> to comment</div>`}`}
      <div class="cmt2-list">${!C.at ? `<div class="cmt2-empty">Loading…</div>` : items.length ? items.map(x => x.html()).join("") : `<div class="cmt2-empty">${esc(empty)}</div>`}</div>`}`;
    el.querySelectorAll("[data-compfor]").forEach(slot => composer(slot, slot.dataset.compfor));
    el.querySelectorAll("[data-show]").forEach(b => b.onclick = () => { setPref("show", b.dataset.show); THREADS.forEach(t => t.redraw()); });
    const ob = el.querySelector("[data-order]"); if(ob) ob.onclick = () => { setPref("order", newest ? "oldest" : "newest"); THREADS.forEach(t => t.redraw()); };
    const rl = el.querySelector("[data-reload]"); if(rl) rl.onclick = () => load();
    const st = el.querySelector("[data-start]"); if(st) st.onclick = () => T.openComposer();
    el.querySelectorAll("[data-reply]").forEach(b => b.onclick = () => { C.replyTo = C.replyTo === b.dataset.reply ? null : b.dataset.reply; draw();
      const box = el.querySelector(`[data-compfor="${CSS.escape(b.dataset.reply)}"] textarea`); if(box) setTimeout(() => box.focus(), 30); });
    el.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { C.editing = b.dataset.edit; delete C.drafts["edit:" + b.dataset.edit]; draw();
      const box = el.querySelector(`[data-compfor="edit:${CSS.escape(b.dataset.edit)}"] textarea`); if(box) setTimeout(() => box.focus(), 30); });
    el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => remove(b.dataset.del));
    // photos / videos / files: short-lived links
    const keys = [...el.querySelectorAll("[data-cmtfile]")].map(x => x.dataset.cmtfile);
    if(keys.length) fileLinks([...new Set(keys)]).then(L => el.querySelectorAll("[data-cmtfile]").forEach(x => { const u = L[x.dataset.cmtfile]; if(!u) return;
      if(x.tagName === "A"){ x.href = u; return; }
      if(x.src !== u) x.src = u;
      if(x.tagName === "IMG") x.onclick = () => { const o = document.createElement("div"); o.className = "cmt2-lb"; o.innerHTML = `<img src="${esc(u)}" alt="">`; o.onclick = () => o.remove(); (root === document ? document.body : root).appendChild(o); }; }));
    if(FOCUS) focusNow();
  }
  T.redraw = draw;

  // the box to write in: "" = a new comment, <id> = a reply to that comment, "edit:<id>" = editing your comment
  function composer(slot, mode){
    const editId = mode.startsWith("edit:") ? mode.slice(5) : null, parent = !editId && mode ? mode : null;
    const row = editId ? C.rows.find(r => r.id === editId) : null;
    const d = C.drafts[mode] || (C.drafts[mode] = row ? { text: row.body, files: (row.files || []).map(f => Object.assign({}, f)), tags: Object.fromEntries(people().filter(p => (row.mentions || []).includes(p.id)).map(p => [p.id, p.name])) } : { files: [], tags: {} });
    slot.innerHTML = `<div class="cmt2-comp">
        <textarea rows="3" placeholder="${parent ? "Write a reply…" : "Add a comment… type @ to tag someone"}" aria-label="${parent ? "Reply" : "Comment"}"></textarea>
        <div class="cmt2-chips"></div>
        <div class="cmt2-row">
          <button type="button" class="cmt2-btn cmt2-plus" data-plus title="Add photos, videos or files" aria-label="Add photos, videos or files">＋</button>
          <input type="file" data-pick="media" accept="image/*,video/*" multiple hidden>
          <input type="file" data-pick="file" multiple hidden>
          <span class="cmt2-tags"></span>
          <button type="button" class="cmt2-btn pri" data-post>${editId ? "Save" : parent ? "Reply" : "Save"}</button>
          <button type="button" class="cmt2-btn plain" data-cancel>Cancel</button></div>
        <div class="cmt2-menu" hidden>
          <button type="button" data-add="media">🖼️ <span>Photo or video<small>JPG, PNG, MP4, MOV — videos up to 300 MB</small></span></button>
          <button type="button" data-add="file">📎 <span>File<small>PDF, Word, Excel, PowerPoint, ZIP… up to 50 MB</small></span></button></div>
        <div class="cmt2-pop" hidden></div></div>`;
    const comp = slot.firstElementChild, ta = comp.querySelector("textarea"), chips = comp.querySelector(".cmt2-chips"),
      tagsEl = comp.querySelector(".cmt2-tags"), pop = comp.querySelector(".cmt2-pop"), post = comp.querySelector("[data-post]"),
      plus = comp.querySelector("[data-plus]"), menu = comp.querySelector(".cmt2-menu");
    ta.value = d.text || "";
    ta.addEventListener("input", () => { d.text = ta.value; showTags(); });
    if(window.RT && RT.enhance) RT.enhance(ta);
    const ed = ta._rt ? ta._rt.ed : ta, wrap = ta._rt ? ta._rt.wrap : ta;
    const showTags = () => { const t = Object.entries(d.tags).filter(([, n]) => (ta.value || "").includes("@" + n)).map(([, n]) => n);
      tagsEl.textContent = t.length ? "Tagging " + t.join(", ") + " — they'll get an email" : ""; };
    const drawChips = () => { chips.innerHTML = d.files.map((f, i) => `<span class="cmt2-chip">${isImg(f) && f.prev ? `<img src="${esc(f.prev)}" alt="">` : `<span class="ph">${isImg(f) ? "🖼️" : isVid(f) ? "▶" : fileIcon(f.name)}</span>`}<span>${esc(f.name)}</span><button type="button" data-rm="${i}" title="Remove">×</button></span>`).join("");
      chips.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const f = d.files.splice(+b.dataset.rm, 1)[0]; if(f && f.prev) URL.revokeObjectURL(f.prev); drawChips(); }); };
    drawChips(); showTags();
    // ＋ → photo / video, or any file
    plus.onclick = e => { e.stopPropagation(); menu.style.left = plus.offsetLeft + "px"; menu.style.top = (plus.offsetTop + plus.offsetHeight + 4) + "px"; menu.hidden = !menu.hidden; };
    comp.addEventListener("click", e => { if(!menu.hidden && !e.target.closest(".cmt2-menu,[data-plus]")) menu.hidden = true; });
    menu.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { menu.hidden = true; comp.querySelector(`[data-pick="${b.dataset.add}"]`).click(); });
    comp.querySelectorAll("[data-pick]").forEach(inp => inp.onchange = e => { [...e.target.files].forEach(f => {
        const okType = isImg(f) || isVid(f) || DOC_EXT.test(f.name);
        if(!okType){ toastMsg(`“${f.name}” can't be attached — use a photo, video, PDF, Word, Excel, PowerPoint, text or ZIP file`); return; }
        if(f.size > LIMIT(f)){ toastMsg(`“${f.name}” is too big (${isVid(f) ? "videos up to 300 MB" : isImg(f) ? "photos up to 20 MB" : "files up to 50 MB"})`); return; }
        d.files.push({ file: f, name: f.name, type: f.type || "", size: f.size, prev: isImg(f) ? URL.createObjectURL(f) : "" }); });
      e.target.value = ""; drawChips(); });
    comp.querySelector("[data-cancel]").onclick = () => {
      d.files.forEach(f => f.prev && URL.revokeObjectURL(f.prev)); delete C.drafts[mode];
      if(editId) C.editing = null; else if(parent) C.replyTo = null; else C.open = false; draw(); };

    // @ → pick a teammate
    const selOf = () => (root.getSelection ? root.getSelection() : null) || document.getSelection();
    let q = null, hits = [], on = 0;
    function caretQuery(){
      const s = selOf(); if(!s || !s.rangeCount || !s.isCollapsed) return null;
      const r = s.getRangeAt(0), n = r.startContainer; if(n.nodeType !== 3 || !ed.contains(n)) return null;
      const before = n.nodeValue.slice(0, r.startOffset), mm = /(^|[\s(])@([^\s@]{0,30})$/.exec(before);
      return mm ? { node: n, end: r.startOffset, start: r.startOffset - mm[2].length - 1, text: mm[2].toLowerCase() } : null;
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
      if(pop.hidden){
        if((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); e.stopPropagation(); post.click(); }
        else if(e.key === "Escape" && !(ta.value || "").trim() && !d.files.length){ e.preventDefault(); e.stopPropagation(); comp.querySelector("[data-cancel]").click(); }
        return; }
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
        const files = await uploadAll(d.files, m2 => { post.textContent = m2; });
        post.textContent = "Saving…";
        const mentions = Object.entries(d.tags).filter(([, n]) => text.includes("@" + n)).map(([id]) => id);
        if(editId){   // your own comment, changed
          const patch = { body: text, mentions, files, edited_at: new Date().toISOString() };
          const { error } = await s.from("team_comments").update(patch).eq("id", editId);
          if(error) throw new Error(error.message);
          const gone = (row.files || []).map(f => f.key).filter(k => !files.some(f => f.key === k));
          Object.assign(row, patch); C.editing = null; delete C.drafts[mode]; draw(); filesGone(gone); return;
        }
        const mm = me(), rec = { team_slug: team(), place: T.place.key, place_label: String(T.place.label || "").slice(0, 200), nav: T.place.nav || {},
          parent_id: parent || null, author_id: mm.id, author_name: mm.name.slice(0, 120), body: text, mentions, files };
        if(window.LOCAL_MODE) rec.created_at = new Date().toISOString();
        const { data, error } = await s.from("team_comments").insert(rec).select("*").single();
        if(error) throw new Error(error.message);
        d.files.forEach(f => f.prev && URL.revokeObjectURL(f.prev)); delete C.drafts[mode];
        if(parent) C.replyTo = null; else C.open = false;
        C.rows.push(data || rec); draw();
        if(mentions.length && !window.LOCAL_MODE && data && data.id){
          s.functions.invoke("comment-mail", { body: { team: team(), comment_id: data.id, app_url: location.origin + "/" } })
            .then(r => { const x = r && r.data; if(x && x.sent) toastMsg(`Emailed ${x.sent} teammate${x.sent > 1 ? "s" : ""} ✓`); else if(x && x.errors && x.errors.length) toastMsg("Couldn't send the email: " + x.errors[0]); })
            .catch(() => {});
        }
      }catch(e){ toastMsg("Couldn't save: " + e.message); post.disabled = false; post.textContent = label; }
    };
  }

  async function remove(id){
    const row = C.rows.find(r => r.id === id); if(!row) return;
    const kids = C.rows.filter(r => r.parent_id === id);
    if(!confirm(kids.length ? `Delete this comment and its ${kids.length} repl${kids.length > 1 ? "ies" : "y"}?` : "Delete this comment?")) return;
    const s = supa(); const { error } = await s.from("team_comments").delete().eq("id", id);
    if(error){ toastMsg("Couldn't delete: " + error.message); return; }
    C.rows = C.rows.filter(r => r.id !== id && r.parent_id !== id); draw();
    filesGone([row, ...kids].flatMap(r => (r.files || []).map(f => f.key)));   // its photos / videos / files leave storage too
  }

  draw(); if(Date.now() - C.at > 30000) load();
  return T;
}

function focusNow(){
  if(!FOCUS) return;
  for(const T of THREADS){ const it = T.el.querySelector("#cm-" + CSS.escape(FOCUS)); if(it){ FOCUS = null;
    it.scrollIntoView({ behavior: "smooth", block: "center" }); it.classList.add("flash"); setTimeout(() => it.classList.remove("flash"), 2600); return; } }
}
// 🕘 changes to record: [{ place, scope, place_label, field, old_val, new_val }]
async function log(events){
  const s = supa(); if(!s || !events || !events.length) return;
  const m = me(), now = new Date().toISOString();
  const rows = events.map(e => Object.assign({ team_slug: team(), actor_id: m.id, actor_name: m.name.slice(0, 120),
    place: e.place, scope: e.scope || "", place_label: String(e.place_label || "").slice(0, 200), field: String(e.field).slice(0, 80),
    old_val: String(e.old_val || "").slice(0, 2000), new_val: String(e.new_val || "").slice(0, 2000) }, window.LOCAL_MODE ? { created_at: now } : {}));
  const { error } = await s.from("team_activity").insert(rows);
  if(error){ console.warn("history", error.message); return; }
  // boxes showing these places pick the change up now
  THREADS.forEach(T => { const h = T.place.history; if(h && rows.some(r => (h.place && r.place === h.place) || (h.scope && r.scope === h.scope))) T.refresh(); });
}
// M = start a comment (the open card's box first, else the page's)
document.addEventListener("keydown", e => {
  if((e.key !== "m" && e.key !== "M") || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = (e.composedPath && e.composedPath()[0]) || e.target;
  if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""))) return;
  const vis = [...THREADS].filter(T => T.el.isConnected && T.el.getClientRects().length);
  const T = vis.find(x => x.el.getRootNode() !== document) || vis[0];
  if(T){ e.preventDefault(); T.openComposer(); }
});
window.CMT = {
  mount, log,
  focus(id){ FOCUS = id; focusNow(); setTimeout(() => { if(FOCUS === id) FOCUS = null; }, 20000); },
  refreshAll(){ THREADS.forEach(T => T.refresh()); },
};
})();
