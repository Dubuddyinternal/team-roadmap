/* =====================================================================
   RICH TEXT for every multi-line text box in the app (tools.dubuddy.in)

   Every <textarea> — on the page and inside the spaces' shadow roots — gets
   a small editor on top: Bold, Italic, bullet and numbered lists, links.
   When the text is longer than the box, a "▾ Show all" button opens it up
   ("▴ Show less" folds it back).

   HOW IT STAYS SAFE: the textarea is kept (hidden) and is still the source of
   truth. The editor writes light markdown into it — **bold**, *italic*,
   "- " bullets, "1. " numbers, [text](link) — and fires the same input /
   change / keydown / blur events, so every screen keeps saving exactly as
   before. Code that sets textarea.value (dictation, vidIQ, Claude drafts)
   updates the editor too.
   Boxes that must stay plain are skipped: read-only ones, monospace paste /
   import / code boxes, and anything inside [data-plain] or with data-plain.

   RT.plain(md)  → the text without formatting marks (used when posting)
   RT.html(md)   → safe HTML for showing formatted text
   RT.dictation(editor) → where dictate.js types into an editor
   ===================================================================== */
(function(){
"use strict";
if(window.RT) return;

/* ------------------------------------------------------------ markdown ⇄ html */
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const safeHref = u => /^(https?:\/\/|mailto:)/i.test(u) ? u : (/^www\./i.test(u) ? "https://"+u : "");
function inline(s){
  // s is already escaped
  return s
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m,t,u)=>{ const h=safeHref(u.replace(/&amp;/g,"&")); return h ? `<a href="${esc(h)}" target="_blank" rel="noopener">${t}</a>` : m; })
    .replace(/\*\*([^*\n](?:[^\n]*?[^*\n])?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*\w])\*([^*\s](?:[^*\n]*?[^*\s])?)\*(?![*\w])/g, "$1<i>$2</i>");
}
/* markdown → html (for the editor and for showing text) */
function mdToHtml(md){
  const lines = String(md==null?"":md).replace(/\r\n?/g,"\n").split("\n");
  let out = "", list = null;
  const close = () => { if(list){ out += `</${list}>`; list = null; } };
  lines.forEach(line=>{
    const ul = /^\s*[-•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if(ul || ol){
      const t = ul ? "ul" : "ol";
      if(list !== t){ close(); out += `<${t}>`; list = t; }
      out += `<li>${inline(esc((ul||ol)[1])) || "<br>"}</li>`;
    } else { close(); out += `<div>${inline(esc(line)) || "<br>"}</div>`; }
  });
  close();
  return out;
}
/* html (from the editor) → markdown */
function htmlToMd(root){
  const blocks = [];
  let cur = "";
  const flush = () => { blocks.push(cur); cur = ""; };
  const BLOCK = /^(DIV|P|H[1-6]|BLOCKQUOTE|PRE|SECTION)$/;
  function walk(n, ctx){
    if(n.nodeType === 3){ cur += n.nodeValue.replace(/ /g," ").replace(/\n/g," "); return; }
    if(n.nodeType !== 1) return;
    const tag = n.tagName;
    if(tag === "BR"){ flush(); return; }
    if(tag === "UL" || tag === "OL"){
      if(cur.trim()) flush(); else cur = "";
      let k = 0;
      n.childNodes.forEach(li=>{
        if(li.nodeType !== 1){ return; }
        k++; cur = (tag === "OL" ? k+". " : "- ");
        li.childNodes.forEach(c=>walk(c, ctx));
        flush();
      });
      return;
    }
    if(BLOCK.test(tag)){
      if(cur !== "") flush();
      n.childNodes.forEach(c=>walk(c, ctx));
      // an empty block (<div><br></div>) is one empty line: the <br> already flushed it
      if(cur !== "" || !n.querySelector("br")) flush();
      return;
    }
    const st = n.getAttribute && (n.getAttribute("style") || "");
    const bold = tag === "B" || tag === "STRONG" || /font-weight:\s*(bold|[6-9]00)/i.test(st);
    const ital = tag === "I" || tag === "EM" || /font-style:\s*italic/i.test(st);
    if(tag === "A" && n.getAttribute("href")){
      const t = n.textContent.replace(/\n/g," ");
      cur += `[${t}](${n.getAttribute("href")})`; return;
    }
    let open = "", shut = "";
    if(bold){ open += "**"; shut = "**" + shut; }
    if(ital){ open += "*"; shut = "*" + shut; }
    if(open){
      const start = cur; cur = "";
      n.childNodes.forEach(c=>walk(c, ctx));
      const inner = cur; cur = start;
      // keep the spaces outside the marks so "**word **" never happens
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
      cur += m[2] ? m[1] + open + m[2] + shut + m[3] : inner;
      return;
    }
    n.childNodes.forEach(c=>walk(c, ctx));
  }
  root.childNodes.forEach(c=>walk(c, {}));
  if(cur !== "" || !blocks.length) flush();
  while(blocks.length && blocks[blocks.length-1] === "") blocks.pop();
  return blocks.join("\n");
}
function plain(md){
  return String(md==null?"":md)
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/(^|[^*\w])\*([^*\s](?:[^*\n]*?[^*\s])?)\*(?![*\w])/g, "$1$2");
}

/* ------------------------------------------------------------ styles (page + every shadow root) */
const CSS = `
.rt-wrap{display:block;width:100%;position:relative;min-width:0}
.rt-bar{display:none;gap:2px;align-items:center;flex-wrap:wrap;margin:0 0 4px}
.rt-wrap.focus .rt-bar,.rt-wrap.pinbar .rt-bar{display:flex}
.rt-bar button{border:1px solid transparent;background:none;border-radius:5px;min-width:26px;height:24px;padding:0 6px;
  font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#56514A;cursor:pointer}
.rt-bar button:hover{background:#F1EEE8;border-color:#E2DDD3}
.rt-bar button.on{background:#FBEBE2;color:#A83E12;border-color:#F0CDBB}
.rt-bar .sep{width:1px;height:16px;background:#E2DDD3;margin:0 3px}
.rt-ed{display:block;width:100%;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;outline:none;white-space:normal;
  word-wrap:break-word;overflow-wrap:anywhere;cursor:text;text-align:left}
.rt-ed:focus{outline:2px solid rgba(212,84,30,.35);outline-offset:0}
.rt-ed[contenteditable=false]{cursor:default;opacity:.85}
.rt-ed:empty::before{content:attr(data-ph);color:#A39D93;pointer-events:none}
.rt-ed div{min-height:1em}
.rt-ed ul,.rt-ed ol{margin:2px 0 2px 1.3em;padding:0}
.rt-ed li{margin:1px 0}
.rt-ed a{color:#D4541E;text-decoration:underline}
.rt-more{display:none;margin:4px 0 0 auto;border:1px solid #E2DDD3;background:#FFF;border-radius:999px;padding:2px 10px;
  font:600 11px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#56514A;cursor:pointer}
.rt-more:hover{border-color:#D4541E;color:#D4541E}
.rt-wrap.over .rt-more,.rt-wrap.open .rt-more{display:block}
.rt-foot{display:flex}
.rt-view ul,.rt-view ol{margin:2px 0 2px 1.3em;padding:0}
.rt-view a{color:#D4541E}`;
const STYLED = new WeakSet();
function styleRoot(root){
  if(STYLED.has(root)) return; STYLED.add(root);
  const s = document.createElement("style"); s.textContent = CSS;
  (root === document ? document.head : root).appendChild(s);
}

/* ------------------------------------------------------------ which boxes */
const VALUE = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
const SKIP_ID = /^(okrimp-text|imp-text|mg-html|mg-prompt|s-points)$/;
function skip(ta){
  if(ta._rt || ta.readOnly || ta.hasAttribute("data-plain") || ta.closest("[data-plain]")) return true;
  if(SKIP_ID.test(ta.id || "")) return true;
  const ff = (ta.getAttribute("style") || "") + " " + (ta.className || "");
  if(/monospace|font-family:\s*ui-monospace|code|mono\b/i.test(ff)) return true;
  return false;
}

/* ------------------------------------------------------------ the editor */
const COLLAPSED = 168;   // px: taller text folds and gets "Show all"
function enhance(ta){
  if(skip(ta)) return;
  const root = ta.getRootNode();
  styleRoot(root);
  const cs = getComputedStyle(ta);
  const wrap = document.createElement("div"); wrap.className = "rt-wrap";
  const bar = document.createElement("div"); bar.className = "rt-bar";
  const ed = document.createElement("div"); ed.className = "rt-ed"; ed.setAttribute("role","textbox"); ed.setAttribute("aria-multiline","true");
  const foot = document.createElement("div"); foot.className = "rt-foot";
  const more = document.createElement("button"); more.type = "button"; more.className = "rt-more"; more.textContent = "▾ Show all";
  foot.appendChild(more);
  ["fontFamily","fontSize","lineHeight","color","backgroundColor","borderTop","borderRight","borderBottom","borderLeft","borderRadius",
   "paddingTop","paddingRight","paddingBottom","paddingLeft","letterSpacing"].forEach(k=>{ if(cs[k]) ed.style[k] = cs[k]; });
  const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize)||13) * 1.45;
  const rows = Number(ta.getAttribute("rows")) || 0;
  const minH = Math.max(parseFloat(cs.minHeight) || 0, rows ? rows*lh + (parseFloat(cs.paddingTop)||0) + (parseFloat(cs.paddingBottom)||0) : 0, lh*2.4);
  ed.style.minHeight = Math.round(minH) + "px";
  const fold = Math.max(COLLAPSED, minH);
  if(ta.style.width) wrap.style.width = ta.style.width;
  if(ta.getAttribute("aria-label")) ed.setAttribute("aria-label", ta.getAttribute("aria-label"));
  if(ta.id){ const lab = root.querySelector && root.querySelector(`label[for="${CSS_esc(ta.id)}"]`);
    if(lab){ lab.addEventListener("click", e=>{ e.preventDefault(); ed.focus(); }); ed.setAttribute("aria-label", lab.textContent.trim()); } }
  ed.dataset.ph = ta.getAttribute("placeholder") || "";

  const B = (label, title, fn) => { const b = document.createElement("button"); b.type = "button"; b.innerHTML = label; b.title = title;
    b.addEventListener("mousedown", e=>e.preventDefault()); b.addEventListener("click", e=>{ e.preventDefault(); e.stopPropagation(); fn(); ed.focus(); sync(true); state(); }); bar.appendChild(b); return b; };
  const cmd = (c, v) => { try{ document.execCommand("styleWithCSS", false, false); }catch(_){ } document.execCommand(c, false, v); };
  const bB = B("<b>B</b>", "Bold (Ctrl+B)", ()=>cmd("bold"));
  const bI = B("<i>I</i>", "Italic (Ctrl+I)", ()=>cmd("italic"));
  const sep = () => { const s = document.createElement("span"); s.className = "sep"; bar.appendChild(s); };
  sep();
  const bU = B("• List", "Bullet list", ()=>cmd("insertUnorderedList"));
  const bO = B("1. List", "Numbered list", ()=>cmd("insertOrderedList"));
  sep();
  B("🔗 Link", "Add a link", ()=>{
    const sel = selOf(); const had = sel && String(sel).trim();
    const u = prompt("Link address (https://…)"); if(!u) return;
    const h = safeHref(u.trim()); if(!h){ alert("Use a full address that starts with https://"); return; }
    if(had) cmd("createLink", h); else cmd("insertHTML", `<a href="${esc(h)}">${esc(h)}</a>&nbsp;`);
  });
  B("Clear", "Remove formatting", ()=>{ cmd("removeFormat"); cmd("unlink"); });
  const selOf = () => (root.getSelection ? root.getSelection() : null) || document.getSelection();
  function state(){
    const q = c => { try{ return document.queryCommandState(c); }catch(_){ return false; } };
    bB.classList.toggle("on", q("bold")); bI.classList.toggle("on", q("italic"));
    bU.classList.toggle("on", q("insertUnorderedList")); bO.classList.toggle("on", q("insertOrderedList"));
  }

  let last = VALUE.get.call(ta), writing = false, startVal = last;
  const render = v => { ed.innerHTML = v ? mdToHtml(v) : ""; measure(); };
  function sync(fire){
    const md = ed.textContent.trim() || ed.querySelector("li,a") ? htmlToMd(ed) : "";
    if(md === last) return;
    last = md; writing = true; VALUE.set.call(ta, md); writing = false;
    if(fire) ta.dispatchEvent(new Event("input", { bubbles:true, composed:true }));
    measure();
  }
  let open = false;
  function measure(){
    if(open){ ed.style.maxHeight = "none"; wrap.classList.remove("over"); wrap.classList.add("open"); more.textContent = "▴ Show less"; return; }
    ed.style.maxHeight = fold + "px"; wrap.classList.remove("open");
    wrap.classList.toggle("over", ed.scrollHeight > ed.clientHeight + 4); more.textContent = "▾ Show all";
  }
  more.addEventListener("mousedown", e=>e.preventDefault());
  more.addEventListener("click", e=>{ e.preventDefault(); e.stopPropagation(); open = !open; measure(); });

  // the textarea's value: reads give the markdown, writes (from any code) redraw the editor
  Object.defineProperty(ta, "value", { configurable:true,
    get(){ return VALUE.get.call(this); },
    set(v){ VALUE.set.call(this, v); if(!writing){ last = String(v==null?"":v); render(last); } } });
  ta.focus = () => ed.focus();
  ta.select = () => { ed.focus(); const s = selOf(); if(s){ const r = document.createRange(); r.selectNodeContents(ed); s.removeAllRanges(); s.addRange(r); } };
  ta.setSelectionRange = () => {};
  const syncDisabled = () => { ed.contentEditable = ta.disabled || ta.readOnly ? "false" : "true"; };
  syncDisabled();
  new MutationObserver(()=>{ syncDisabled(); ed.dataset.ph = ta.getAttribute("placeholder") || ""; }).observe(ta, { attributes:true, attributeFilter:["disabled","readonly","placeholder"] });

  ed.addEventListener("input", ()=>{ sync(true); state(); });
  ed.addEventListener("focus", ()=>{ wrap.classList.add("focus"); startVal = last; ta.dispatchEvent(new FocusEvent("focus")); ta.dispatchEvent(new FocusEvent("focusin", { bubbles:true, composed:true })); });
  ed.addEventListener("blur", ()=>{
    setTimeout(()=>{ if(!wrap.contains((root.activeElement)||null)) wrap.classList.remove("focus"); }, 150);
    sync(false);
    if(last !== startVal) ta.dispatchEvent(new Event("change", { bubbles:true, composed:true }));
    ta.dispatchEvent(new FocusEvent("blur")); ta.dispatchEvent(new FocusEvent("focusout", { bubbles:true, composed:true }));
  });
  ed.addEventListener("keyup", state); ed.addEventListener("mouseup", state);
  ed.addEventListener("keydown", e=>{
    const k = e.key.toLowerCase();
    if((e.ctrlKey || e.metaKey) && !e.altKey && (k === "b" || k === "i")){ e.preventDefault(); e.stopPropagation(); cmd(k === "b" ? "bold" : "italic"); sync(true); state(); return; }
    // hand the key to the textarea, so its own shortcuts (Enter to post, Esc to cancel…) still work
    e.stopPropagation();
    const f = new KeyboardEvent("keydown", { key:e.key, code:e.code, ctrlKey:e.ctrlKey, metaKey:e.metaKey, shiftKey:e.shiftKey, altKey:e.altKey,
      repeat:e.repeat, bubbles:true, cancelable:true, composed:true });
    sync(false);
    ta.dispatchEvent(f);
    if(f.defaultPrevented) e.preventDefault();
  });
  // paste as plain text, so formatting from other sites never sneaks in
  ed.addEventListener("paste", e=>{
    const t = e.clipboardData && e.clipboardData.getData("text/plain"); if(t == null) return;
    e.preventDefault(); document.execCommand("insertText", false, t);
  });
  ed.addEventListener("click", e=>{ const a = e.target.closest && e.target.closest("a"); if(a && (e.ctrlKey || e.metaKey)) window.open(a.href, "_blank", "noopener"); });

  ta._rt = { ed, wrap };
  ed._rtTa = ta;
  ta._rtDisplay = ta.style.display;
  ta.style.display = "none";
  wrap.append(bar, ed, foot);
  ta.after(wrap);
  render(last);
  // re-measure once it's on screen (it may have been drawn into a hidden pane)
  requestAnimationFrame(measure); setTimeout(measure, 300);
  if(typeof ResizeObserver === "function") new ResizeObserver(()=>measure()).observe(ed);
}
const CSS_esc = s => (window.CSS && window.CSS.escape) ? window.CSS.escape(s) : String(s).replace(/"/g,'\\"');

/* ------------------------------------------------------------ watch the page and every shadow root */
const WATCHED = new WeakSet();
function scan(node){
  if(node.nodeType !== 1 && node.nodeType !== 11) return;
  if(node.tagName === "TEXTAREA") return enhance(node);
  if(node.querySelectorAll) node.querySelectorAll("textarea").forEach(enhance);
}
function watch(root){
  if(WATCHED.has(root)) return; WATCHED.add(root);
  scan(root === document ? document.body : root);
  new MutationObserver(ms=>{ ms.forEach(m=>m.addedNodes.forEach(scan)); }).observe(root === document ? document.body : root, { childList:true, subtree:true });
}
const _attach = Element.prototype.attachShadow;
Element.prototype.attachShadow = function(init){ const r = _attach.call(this, init); if(init && init.mode === "open") setTimeout(()=>watch(r), 0); return r; };
document.querySelectorAll("*").forEach(el=>{ if(el.shadowRoot) watch(el.shadowRoot); });
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", ()=>watch(document)); else watch(document);

/* ------------------------------------------------------------ dictation into an editor */
/* dictate.js calls this when the focused field is an editor: words go where the cursor was */
function dictation(ed){
  const root = ed.getRootNode();
  const sel = (root.getSelection ? root.getSelection() : null) || document.getSelection();
  const spot = document.createElement("span");
  let range = sel && sel.rangeCount && ed.contains(sel.getRangeAt(0).startContainer) ? sel.getRangeAt(0) : null;
  if(range){ range.deleteContents(); range.insertNode(spot); }
  else { const last = ed.lastElementChild && /^(DIV|P)$/.test(ed.lastElementChild.tagName) ? ed.lastElementChild : ed; last.appendChild(spot); }
  const ta = ed._rtTa;
  return {
    write(text, final){
      if(!spot.isConnected) return;
      const prev = spot.previousSibling, before = prev && prev.nodeType === 3 ? prev.nodeValue : "";
      spot.textContent = (text && before && !/\s$/.test(before) ? " " : "") + (text || "");
      ed.dispatchEvent(new Event("input"));
      if(final){
        const t = document.createTextNode(spot.textContent + (text ? " " : "")); spot.replaceWith(t);
        ed.focus();
        try{ const r = document.createRange(); r.setStartAfter(t); r.collapse(true); const s = (root.getSelection ? root.getSelection() : null) || document.getSelection(); s.removeAllRanges(); s.addRange(r); }catch(_){ }
        ed.dispatchEvent(new Event("input"));
        if(ta) ta.dispatchEvent(new Event("change", { bubbles:true, composed:true }));
      }
    }
  };
}

/* ------------------------------------------------------------ showing formatted text elsewhere */
function html(md){ return `<span class="rt-view">${mdToHtml(md).replace(/<div>/g,"<span style=\"display:block\">").replace(/<\/div>/g,"</span>")}</span>`; }

window.RT = { plain, html, mdToHtml, htmlToMd, dictation, enhance, watch, css: CSS };
})();
