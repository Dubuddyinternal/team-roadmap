/* =====================================================================
   WIKI DOCUMENTS — write documents right inside Our Wiki, instead of
   linking out to Google Docs every time.

   A wiki document is a DOCLIB link with kind:"page": it has everything a
   link has (title, section, department, owner, "why", Official, access,
   review date, Start-here reading order) plus the document itself:
     html      the content (cleaned by WD.clean before it is stored or shown)
     text      plain text, for search
     updated   YYYY-MM-DD, editedBy = email of the last person to save it

   The editor works like a light Google Docs: undo / redo, paragraph styles
   (headings, quote, code), bold / italic / underline / strike, text colour
   and highlight, links, alignment, bullet / numbered / check lists, indent,
   tables, images (uploaded or pasted, shrunk to fit), dividers, clear
   formatting, an outline of the headings, word count, autosave, and
   print / save as PDF. Pasting from Google Docs or Word keeps the
   formatting but drops anything unsafe.

   Who can edit: the same people who can edit the link (its creator, its
   owner, admins). Everyone it is shared with can read it.
   Saved with the rest of the wiki (team_data section "doclib").
   Uses index.html globals: DOCLIB, dlCanEdit, dlCanSee, dlSave, dlToday,
   dlOpenDialog, renderDocLib, openDocLib, ppMemName, mtEsc, toast, TEAM.
   ===================================================================== */
(function () {
"use strict";

/* ---------------------------------------------------------- templates */
var TEMPLATES = [
  { id: "blank", name: "Blank document", html: "<p><br></p>" },
  { id: "meeting", name: "Meeting notes (MoM)", html:
    "<p><b>Date:</b> &nbsp;·&nbsp; <b>Attendees:</b> </p><h2>Agenda</h2><ol><li><br></li></ol><h2>Notes</h2><p><br></p>" +
    "<h2>Decisions</h2><ul><li><br></li></ul><h2>Action items</h2>" +
    "<ul class=\"wd-tasks\"><li><input type=\"checkbox\" class=\"wd-tk\"> Who · what · by when</li></ul>" },
  { id: "playbook", name: "Playbook / SOP", html:
    "<h2>Purpose</h2><p>Why this process exists, in one or two lines.</p><h2>When to use it</h2><p><br></p>" +
    "<h2>Steps</h2><ol><li><br></li></ol><h2>Who owns it</h2><p><br></p><h2>Common questions</h2><p><br></p>" },
  { id: "decision", name: "Decision record", html:
    "<h2>Context</h2><p>What's happening and why we need to decide.</p><h2>Options we looked at</h2><ol><li><br></li></ol>" +
    "<h2>Decision</h2><p><br></p><h2>Why</h2><p><br></p><h2>What we chose not to do</h2><p><br></p><h2>Follow-ups</h2>" +
    "<ul class=\"wd-tasks\"><li><input type=\"checkbox\" class=\"wd-tk\"> <br></li></ul>" },
  { id: "brief", name: "Project brief / PRD", html:
    "<h2>Problem</h2><p><br></p><h2>Goal and how we'll measure it</h2><p><br></p><h2>Scope</h2><p><b>In:</b> </p><p><b>Out:</b> </p>" +
    "<h2>Plan and milestones</h2><table class=\"wd-tbl\"><tbody><tr><th>Milestone</th><th>Owner</th><th>Date</th></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table>" +
    "<h2>Risks</h2><ul><li><br></li></ul><h2>Open questions</h2><ul><li><br></li></ul>" },
];
var SECTION_TEMPLATE = { meet: "meeting", decide: "decision", how: "playbook", plan: "brief" };

/* ---------------------------------------------------------- cleaning */
var ALLOWED = { P:1, BR:1, H1:1, H2:1, H3:1, H4:1, B:1, STRONG:1, I:1, EM:1, U:1, S:1, STRIKE:1, DEL:1, SUB:1, SUP:1, A:1,
  UL:1, OL:1, LI:1, BLOCKQUOTE:1, PRE:1, CODE:1, HR:1, TABLE:1, THEAD:1, TBODY:1, TR:1, TH:1, TD:1, IMG:1, SPAN:1, DIV:1, INPUT:1 };
var DROP = { SCRIPT:1, STYLE:1, IFRAME:1, OBJECT:1, EMBED:1, FORM:1, SVG:1, MATH:1, LINK:1, META:1, TITLE:1, HEAD:1, NOSCRIPT:1, TEMPLATE:1, BUTTON:1, SELECT:1, TEXTAREA:1, VIDEO:1, AUDIO:1 };
var CLASSES = { "wd-tasks":1, "wd-tk":1, "wd-tbl":1 };
var STYLE_OK = { "color":1, "background-color":1, "text-align":1, "margin-left":1, "padding-left":1, "font-weight":1, "font-style":1, "text-decoration":1, "text-decoration-line":1 };
function safeStyle(s) {
  var out = [];
  String(s || "").split(";").forEach(function (part) {
    var i = part.indexOf(":"); if (i < 0) return;
    var k = part.slice(0, i).trim().toLowerCase(), v = part.slice(i + 1).trim();
    if (!STYLE_OK[k]) return;
    if (/url\s*\(|expression|javascript:|[<>"\\]/i.test(v)) return;
    if (!/^[#\w\s.,%()-]+$/.test(v)) return;
    if ((k === "background-color" || k === "color") && /^(transparent|initial|inherit|rgba?\(0,\s*0,\s*0,\s*0\))$/i.test(v)) return;
    out.push(k + ":" + v);
  });
  return out.join(";");
}
function safeUrl(u, img) {
  u = String(u || "").trim();
  if (img) return /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(u) || /^https:\/\//i.test(u) ? u : "";
  return /^(https?:|mailto:|#)/i.test(u) ? u : (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u) ? "https://" + u : "");
}
function cleanNode(node, doc) {
  Array.prototype.slice.call(node.childNodes).forEach(function (c) {
    if (c.nodeType === 3) return;                                   // text
    if (c.nodeType !== 1) { c.parentNode.removeChild(c); return; }  // comments etc.
    var tag = c.nodeName.toUpperCase();
    if (DROP[tag]) { c.parentNode.removeChild(c); return; }
    if (!ALLOWED[tag]) {                                            // unknown wrapper (FONT, SECTION…): keep its contents
      cleanNode(c, doc);
      while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c);
      c.parentNode.removeChild(c); return;
    }
    if (tag === "INPUT" && (c.getAttribute("type") || "").toLowerCase() !== "checkbox") { c.parentNode.removeChild(c); return; }
    Array.prototype.slice.call(c.attributes).forEach(function (a) {
      var n = a.name.toLowerCase(), v = a.value, keep = null;
      if (n === "style") keep = safeStyle(v) || null;
      else if (n === "class") keep = v.split(/\s+/).filter(function (x) { return CLASSES[x]; }).join(" ") || null;
      else if (tag === "A" && n === "href") keep = safeUrl(v) || null;
      else if (tag === "IMG" && n === "src") keep = safeUrl(v, true) || null;
      else if (tag === "IMG" && (n === "alt" || n === "width")) keep = n === "width" ? (/^\d{1,4}$/.test(v) ? v : null) : v.slice(0, 200);
      else if ((tag === "TD" || tag === "TH") && (n === "colspan" || n === "rowspan")) keep = /^\d{1,2}$/.test(v) ? v : null;
      else if (tag === "INPUT" && (n === "type" || n === "checked")) keep = n === "type" ? "checkbox" : "checked";
      else if (tag === "OL" && n === "start") keep = /^\d{1,4}$/.test(v) ? v : null;
      if (keep == null) c.removeAttribute(a.name); else if (keep !== v) c.setAttribute(a.name, keep);
    });
    if (tag === "A") { if (!c.getAttribute("href")) { while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c); c.parentNode.removeChild(c); return; } c.setAttribute("target", "_blank"); c.setAttribute("rel", "noopener noreferrer"); }
    if (tag === "IMG" && !c.getAttribute("src")) { c.parentNode.removeChild(c); return; }
    cleanNode(c, doc);
  });
}
function clean(html) {
  var doc = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
  cleanNode(doc.body, doc);
  return doc.body.innerHTML;
}
function plainText(html) {
  html = String(html || "").replace(/<\/(p|h\d|li|div|tr|td|th|blockquote|pre)>/gi, "$& ").replace(/<br\s*\/?>/gi, " ");   // keep words of separate blocks apart
  var d = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
  return (d.body.textContent || "").replace(/\s+/g, " ").trim();
}

/* ---------------------------------------------------------- helpers */
function $id(id) { return document.getElementById(id); }
function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function rec(id) { return (DOCLIB.links || []).find(function (l) { return l.id === id && l.kind === "page"; }) || null; }
function me() { return (typeof SESSION !== "undefined" && SESSION && SESSION.email) || ""; }
function who(email) { if (!email) return ""; if (email === me()) return "you"; try { return ppMemName(email); } catch (_) { return email; } }
function docLink(id) { return location.origin + location.pathname + "?team=" + encodeURIComponent(TEAM) + "#wiki=" + encodeURIComponent(id); }

/* ---------------------------------------------------------- styles */
var CSS = "\
#wd-page{position:fixed;inset:0;z-index:450;background:#F1F3F4;display:flex;flex-direction:column;font-family:var(--sans)}\
.wd-top{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--card);border-bottom:1px solid var(--line)}\
.wd-back{border:1px solid var(--line);background:none;border-radius:8px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}\
.wd-titlein{flex:1;min-width:0;border:1px solid transparent;border-radius:6px;padding:5px 8px;font:inherit;font-size:18px;font-weight:600;background:none;color:var(--ink)}\
.wd-titlein:hover,.wd-titlein:focus{border-color:var(--line);outline:none}\
.wd-status{font-size:12px;color:var(--muted);white-space:nowrap}\
.wd-tbtn{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}\
.wd-tbtn.pri{background:var(--indigo);border-color:var(--indigo);color:#fff}\
.wd-bar{display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:6px 12px;background:var(--card);border-bottom:1px solid var(--line)}\
.wd-b{min-width:30px;height:30px;border:none;background:none;border-radius:6px;font:inherit;font-size:14px;cursor:pointer;color:#3c4043;padding:0 7px;display:inline-flex;align-items:center;justify-content:center}\
.wd-b:hover{background:#F1F3F4}.wd-b.on{background:#E8F0FE;color:#1A73E8}\
.wd-sep{width:1px;height:20px;background:var(--line);margin:0 5px}\
.wd-sel{height:30px;border:none;background:none;border-radius:6px;font:inherit;font-size:13px;cursor:pointer;padding:0 6px}\
.wd-sel:hover{background:#F1F3F4}\
.wd-body{flex:1;display:flex;overflow:hidden}\
.wd-outline{width:220px;flex:none;overflow:auto;padding:18px 10px 18px 16px;font-size:13px}\
.wd-outline h4{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}\
.wd-oi{display:block;width:100%;text-align:left;border:none;background:none;padding:4px 6px;border-radius:6px;font:inherit;font-size:13px;color:#3c4043;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.wd-oi:hover{background:#E8EAED}.wd-oi.l2{padding-left:16px}.wd-oi.l3{padding-left:26px;color:var(--muted)}\
.wd-scroll{flex:1;overflow:auto;padding:24px 16px 80px}\
.wd-sheet{max-width:816px;margin:0 auto;background:#fff;box-shadow:0 1px 3px rgba(60,64,67,.3),0 4px 8px rgba(60,64,67,.15);border-radius:2px;padding:72px 84px;min-height:1000px;box-sizing:border-box}\
.wd-meta{font-size:12px;color:var(--muted);margin-bottom:18px}\
.wd-area{outline:none;font-size:15px;line-height:1.65;color:#202124;min-height:600px;word-wrap:break-word}\
.wd-area:empty:before{content:attr(data-ph);color:#9AA0A6}\
.wd-area h1{font-size:28px;margin:22px 0 10px;line-height:1.25}.wd-area h2{font-size:21px;margin:20px 0 8px;line-height:1.3}\
.wd-area h3{font-size:17px;margin:16px 0 6px}.wd-area h4{font-size:15px;margin:14px 0 6px}\
.wd-area p{margin:0 0 10px}.wd-area ul,.wd-area ol{margin:0 0 10px;padding-left:28px}\
.wd-area blockquote{border-left:3px solid #DADCE0;margin:8px 0;padding:2px 14px;color:#5F6368}\
.wd-area pre{background:#F8F9FA;border:1px solid #E8EAED;border-radius:6px;padding:10px 12px;font-family:var(--mono);font-size:13px;white-space:pre-wrap}\
.wd-area code{font-family:var(--mono);font-size:.92em;background:#F1F3F4;border-radius:4px;padding:1px 4px}\
.wd-area a{color:#1A73E8}.wd-area hr{border:none;border-top:1px solid #DADCE0;margin:18px 0}\
.wd-area img{max-width:100%;height:auto;border-radius:4px}\
.wd-area table{border-collapse:collapse;width:100%;margin:8px 0 14px}.wd-area th,.wd-area td{border:1px solid #DADCE0;padding:6px 9px;vertical-align:top;min-width:40px}\
.wd-area th{background:#F8F9FA;font-weight:600;text-align:left}\
.wd-area ul.wd-tasks{list-style:none;padding-left:4px}.wd-area ul.wd-tasks li{display:flex;gap:8px;align-items:flex-start}\
.wd-area input.wd-tk{margin-top:6px;width:15px;height:15px;flex:none}\
.wd-foot{position:fixed;right:18px;bottom:12px;font-size:12px;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:99px;padding:4px 12px}\
.wd-pop{position:fixed;z-index:460;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);padding:8px}\
.wd-sw{display:grid;grid-template-columns:repeat(8,22px);gap:4px}.wd-sw button{width:22px;height:22px;border-radius:50%;border:1px solid rgba(0,0,0,.12);cursor:pointer}\
.wd-grid{display:grid;grid-template-columns:repeat(8,18px);gap:3px}.wd-grid span{width:18px;height:18px;border:1px solid var(--line);border-radius:3px;cursor:pointer}.wd-grid span.hot{background:#D2E3FC;border-color:#1A73E8}\
.wd-gl{font-size:12px;color:var(--muted);text-align:center;margin-top:6px}\
.wd-menu{display:flex;flex-direction:column;min-width:220px}.wd-menu button{text-align:left;border:none;background:none;padding:9px 10px;border-radius:7px;font:inherit;font-size:14px;cursor:pointer}.wd-menu button:hover{background:var(--paper)}\
.wd-menu small{display:block;color:var(--muted);font-size:12px}\
@media(max-width:900px){.wd-outline{display:none}.wd-sheet{padding:28px 20px}.wd-scroll{padding:10px 6px 80px}}\
@media print{body>*:not(#wd-print){display:none!important}}";
function injectCss() { if ($id("wd-css")) return; var s = el("style"); s.id = "wd-css"; s.textContent = CSS; document.head.appendChild(s); }

/* ---------------------------------------------------------- the editor page */
var cur = null, area = null, editable = false, saveT = null, pop = null;
function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener("mousedown", popOutside, true); } }
function popOutside(e) { if (pop && !pop.contains(e.target)) closePop(); }
function openPop(anchor, node) {
  closePop(); pop = el("div", "wd-pop"); pop.appendChild(node); document.body.appendChild(pop);
  var r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + "px"; pop.style.top = (r.bottom + 6) + "px";
  setTimeout(function () { document.addEventListener("mousedown", popOutside, true); }, 0);
}
function cmd(c, v) { area.focus(); try { document.execCommand("styleWithCSS", false, c === "foreColor" || c === "hiliteColor"); } catch (_) { } document.execCommand(c, false, v == null ? null : v); changed(); }
function block(tag) { area.focus(); document.execCommand("formatBlock", false, "<" + tag + ">"); changed(); }
function insertHTML(h) { area.focus(); document.execCommand("insertHTML", false, h); changed(); }

function setStatus(t) { var s = $id("wd-status"); if (s) s.textContent = t; }
function changed() {
  if (!editable || !cur) return;
  setStatus("Saving\u2026");
  clearTimeout(saveT);
  saveT = setTimeout(save, 900);
  outline(); counts();
}
function save() {
  if (!cur || !area) return;
  var html = clean(area.innerHTML);
  cur.html = html;
  cur.text = plainText(html).slice(0, 4000);
  cur.updated = dlToday(); cur.editedBy = me();
  cur.reviewed = dlToday(); cur.reviewedBy = me();     // editing it counts as a review
  var size = html.length;
  dlSave();
  setStatus(size > 1500000 ? "Saved \u2014 this document is very large; use fewer or smaller images" : "All changes saved");
}
function counts() {
  var f = $id("wd-foot"); if (!f || !area) return;
  var w = (area.innerText || "").trim().split(/\s+/).filter(Boolean).length;
  f.textContent = w + " word" + (w === 1 ? "" : "s");
}
function outline() {
  var o = $id("wd-outline-list"); if (!o || !area) return;
  o.innerHTML = "";
  var hs = area.querySelectorAll("h1,h2,h3");
  if (!hs.length) { o.appendChild(el("div", "wd-oi l3", "Headings you add will appear here.")); return; }
  Array.prototype.forEach.call(hs, function (h) {
    var b = el("button", "wd-oi l" + h.nodeName.slice(1), h.textContent.trim() || "(empty heading)");
    b.onclick = function () { h.scrollIntoView({ behavior: "smooth", block: "start" }); };
    o.appendChild(b);
  });
}
var COLORS = ["#000000", "#434343", "#666666", "#999999", "#B7B7B7", "#D9D9D9", "#EFEFEF", "#FFFFFF",
  "#980000", "#FF0000", "#FF9900", "#FFFF00", "#00FF00", "#00FFFF", "#4A86E8", "#0000FF",
  "#9900FF", "#FF00FF", "#E6B8AF", "#F4CCCC", "#FCE5CD", "#FFF2CC", "#D9EAD3", "#D0E0E3",
  "#C9DAF8", "#CFE2F3", "#D9D2E9", "#EAD1DC", "#CC4125", "#E69138", "#6AA84F", "#3C78D8"];
function colorPop(anchor, which) {
  var saved = saveSel();
  var g = el("div", "wd-sw");
  COLORS.forEach(function (c) {
    var b = el("button"); b.style.background = c; b.title = c;
    b.onmousedown = function (e) { e.preventDefault(); };
    b.onclick = function () { closePop(); restoreSel(saved); cmd(which, c); };
    g.appendChild(b);
  });
  var wrap = el("div"); wrap.appendChild(g);
  var none = el("button", "wd-b", which === "hiliteColor" ? "No highlight" : "Default colour"); none.style.width = "100%"; none.style.marginTop = "6px";
  none.onmousedown = function (e) { e.preventDefault(); };
  none.onclick = function () { closePop(); restoreSel(saved); cmd(which, which === "hiliteColor" ? "transparent" : "#202124"); };
  wrap.appendChild(none);
  openPop(anchor, wrap);
}
function saveSel() { var s = window.getSelection(); return s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null; }
function restoreSel(r) { if (!r) return; area.focus(); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
function tablePop(anchor) {
  var saved = saveSel();
  var g = el("div", "wd-grid"), lbl = el("div", "wd-gl", "Pick a size");
  for (var r = 1; r <= 8; r++) for (var c = 1; c <= 8; c++) (function (r, c) {
    var s = el("span");
    s.onmouseover = function () { Array.prototype.forEach.call(g.children, function (x, i) { x.classList.toggle("hot", Math.floor(i / 8) < r && i % 8 < c); }); lbl.textContent = c + " \u00d7 " + r; };
    s.onmousedown = function (e) { e.preventDefault(); };
    s.onclick = function () {
      closePop(); restoreSel(saved);
      var rows = ""; for (var i = 0; i < r; i++) { var cells = ""; for (var j = 0; j < c; j++) cells += i === 0 ? "<th><br></th>" : "<td><br></td>"; rows += "<tr>" + cells + "</tr>"; }
      insertHTML("<table class=\"wd-tbl\"><tbody>" + rows + "</tbody></table><p><br></p>");
    };
    g.appendChild(s);
  })(r, c);
  var w = el("div"); w.append(g, lbl); openPop(anchor, w);
}
function addLink() {
  var saved = saveSel();
  var u = window.prompt("Link to (paste a URL):", "https://");
  if (!u) return;
  var url = safeUrl(u); if (!url) { toast("That doesn't look like a web link"); return; }
  restoreSel(saved);
  var s = window.getSelection();
  if (s && !s.isCollapsed) cmd("createLink", url);
  else insertHTML("<a href=\"" + url.replace(/"/g, "&quot;") + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + mtEsc(url) + "</a>&nbsp;");
}
// images: shrink to at most 1200px wide, as JPEG/PNG, so the wiki stays light
function imageToData(file, cb) {
  if (!file || !/^image\//.test(file.type)) return;
  var fr = new FileReader();
  fr.onload = function () {
    var img = new Image();
    img.onload = function () {
      var max = 1200, w = img.width, h = img.height;
      if (w > max) { h = Math.round(h * max / w); w = max; }
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
      var png = /png|gif/.test(file.type) && w * h < 400000;
      cb(cv.toDataURL(png ? "image/png" : "image/jpeg", 0.82));
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function pickImage() {
  var saved = saveSel();
  var inp = el("input"); inp.type = "file"; inp.accept = "image/*";
  inp.onchange = function () { imageToData(inp.files[0], function (d) { restoreSel(saved); insertHTML("<img src=\"" + d + "\" alt=\"\"><p><br></p>"); }); };
  inp.click();
}
function taskList() {
  area.focus();
  document.execCommand("insertUnorderedList");
  var s = window.getSelection(), n = s && s.anchorNode;
  while (n && n !== area && n.nodeName !== "UL") n = n.parentNode;
  if (n && n.nodeName === "UL") {
    n.classList.add("wd-tasks");
    Array.prototype.forEach.call(n.children, function (li) {
      if (li.nodeName === "LI" && !li.querySelector("input.wd-tk")) { var cb = document.createElement("input"); cb.type = "checkbox"; cb.className = "wd-tk"; li.insertBefore(cb, li.firstChild); li.insertBefore(document.createTextNode(" "), cb.nextSibling); }
    });
  }
  changed();
}
function printDoc() {
  var w = window.open("", "_blank");
  if (!w) { toast("Allow pop-ups to print"); return; }
  w.document.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>" + mtEsc(cur.title) + "</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;color:#202124;line-height:1.6}img{max-width:100%}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px}blockquote{border-left:3px solid #ccc;margin:8px 0;padding:2px 14px;color:#555}pre{background:#f5f5f5;padding:10px;white-space:pre-wrap}ul.wd-tasks{list-style:none;padding-left:4px}</style></head><body><h1>" + mtEsc(cur.title) + "</h1>" + clean(cur.html || "") + "</body></html>");
  w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300);
}

function toolbar() {
  var bar = el("div", "wd-bar");
  var B = function (label, title, fn, html) {
    var b = el("button", "wd-b"); if (html) b.innerHTML = label; else b.textContent = label; b.title = title; b.type = "button";
    b.onmousedown = function (e) { e.preventDefault(); };
    b.onclick = function (e) { fn(e.currentTarget); };
    bar.appendChild(b); return b;
  };
  var sep = function () { bar.appendChild(el("span", "wd-sep")); };
  B("\u21B6", "Undo (Ctrl+Z)", function () { cmd("undo"); });
  B("\u21B7", "Redo (Ctrl+Y)", function () { cmd("redo"); });
  sep();
  var st = el("select", "wd-sel"); st.title = "Paragraph style";
  [["p", "Normal text"], ["h1", "Heading 1"], ["h2", "Heading 2"], ["h3", "Heading 3"], ["blockquote", "Quote"], ["pre", "Code block"]].forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; st.appendChild(op); });
  st.onchange = function () { block(st.value); st.value = "p"; };
  bar.appendChild(st);
  sep();
  B("<b>B</b>", "Bold (Ctrl+B)", function () { cmd("bold"); }, true);
  B("<i>I</i>", "Italic (Ctrl+I)", function () { cmd("italic"); }, true);
  B("<u>U</u>", "Underline (Ctrl+U)", function () { cmd("underline"); }, true);
  B("<s>S</s>", "Strikethrough", function () { cmd("strikeThrough"); }, true);
  B("<span style=\"border-bottom:3px solid #E8622B;line-height:1\">A</span>", "Text colour", function (b) { colorPop(b, "foreColor"); }, true);
  B("<span style=\"background:#FFF2CC;padding:0 3px\">A</span>", "Highlight", function (b) { colorPop(b, "hiliteColor"); }, true);
  B("\uD83D\uDD17", "Link (Ctrl+K)", addLink);
  sep();
  B("\u2261", "Align left", function () { cmd("justifyLeft"); });
  B("\u2263", "Centre", function () { cmd("justifyCenter"); });
  B("\u2262", "Align right", function () { cmd("justifyRight"); });
  sep();
  B("\u2022 \u2014", "Bulleted list", function () { cmd("insertUnorderedList"); });
  B("1.", "Numbered list", function () { cmd("insertOrderedList"); });
  B("\u2611", "Checklist", taskList);
  B("\u21E4", "Decrease indent", function () { cmd("outdent"); });
  B("\u21E5", "Increase indent", function () { cmd("indent"); });
  sep();
  B("\u25A6", "Insert table", function (b) { tablePop(b); });
  B("\uD83D\uDDBC", "Insert image", pickImage);
  B("\u2015", "Divider line", function () { cmd("insertHorizontalRule"); });
  B("T\u0338", "Clear formatting", function () { cmd("removeFormat"); cmd("unlink"); });
  return bar;
}

function open(id) {
  var r = rec(id);
  if (!r) { toast("That document isn't in the wiki any more"); return; }
  if (!dlCanSee(r)) { toast("You don't have access to that document"); return; }
  injectCss();
  close(true);
  cur = r; editable = dlCanEdit(r);
  var pg = el("div"); pg.id = "wd-page";
  // top bar
  var top = el("div", "wd-top");
  var back = el("button", "wd-back", "\u2190 Wiki"); back.onclick = function () { close(); };
  var ti = el("input", "wd-titlein"); ti.value = r.title || ""; ti.placeholder = "Untitled document";
  if (editable) ti.oninput = function () { r.title = ti.value.trim() || "Untitled document"; changed(); };
  else ti.readOnly = true;
  var stt = el("span", "wd-status", editable ? "All changes saved" : "View only"); stt.id = "wd-status";
  top.append(back, ti, stt);
  var cp = el("button", "wd-tbtn", "\uD83D\uDD17 Copy link"); cp.title = "A link that opens this document in the wiki";
  cp.onclick = function () { var u = docLink(r.id); try { navigator.clipboard.writeText(u); toast("Link copied"); } catch (_) { window.prompt("Copy this link:", u); } };
  var pr = el("button", "wd-tbtn", "\uD83D\uDDA8 Print / PDF"); pr.onclick = printDoc;
  top.append(cp, pr);
  if (editable) { var dt = el("button", "wd-tbtn pri", "Details & sharing"); dt.onclick = function () { save(); dlOpenDialog(r.id); }; top.appendChild(dt); }
  pg.appendChild(top);
  if (editable) pg.appendChild(toolbar());
  // body: outline + sheet
  var body = el("div", "wd-body");
  var ol = el("aside", "wd-outline"); ol.appendChild(el("h4", "", "Outline")); var oll = el("div"); oll.id = "wd-outline-list"; ol.appendChild(oll);
  var sc = el("div", "wd-scroll"), sheet = el("div", "wd-sheet");
  var meta = el("div", "wd-meta", (r.updated ? "Last edited " + r.updated + (r.editedBy ? " by " + who(r.editedBy) : "") : "New document") + " \u00b7 Owner: " + who(r.owner || r.by) + (r.why ? " \u00b7 Why: " + r.why : ""));
  area = el("div", "wd-area"); area.setAttribute("data-ph", editable ? "Start writing\u2026" : "This document is empty.");
  area.innerHTML = clean(r.html || "");
  if (!area.innerHTML.replace(/<p><br><\/p>/g, "").trim()) area.innerHTML = editable ? "<p><br></p>" : "";
  if (editable) {
    area.contentEditable = "true"; area.spellcheck = true;
    area.addEventListener("input", changed);
    area.addEventListener("change", function (e) { var t = e.target; if (t && t.classList && t.classList.contains("wd-tk")) { if (t.checked) t.setAttribute("checked", "checked"); else t.removeAttribute("checked"); changed(); } });
    area.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); addLink(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); clearTimeout(saveT); save(); }
    });
    area.addEventListener("paste", function (e) {
      var cd = e.clipboardData; if (!cd) return;
      var file = Array.prototype.find.call(cd.files || [], function (f) { return /^image\//.test(f.type); });
      if (file) { e.preventDefault(); imageToData(file, function (d) { insertHTML("<img src=\"" + d + "\" alt=\"\">"); }); return; }
      var h = cd.getData("text/html");
      if (h) { e.preventDefault(); insertHTML(clean(h)); }
    });
    area.addEventListener("drop", function (e) {
      var f = e.dataTransfer && Array.prototype.find.call(e.dataTransfer.files || [], function (x) { return /^image\//.test(x.type); });
      if (f) { e.preventDefault(); imageToData(f, function (d) { insertHTML("<img src=\"" + d + "\" alt=\"\">"); }); }
    });
  } else {
    Array.prototype.forEach.call(area.querySelectorAll("input.wd-tk"), function (c) { c.disabled = true; });
  }
  sheet.append(meta, area); sc.appendChild(sheet);
  body.append(ol, sc); pg.appendChild(body);
  var ft = el("div", "wd-foot"); ft.id = "wd-foot"; pg.appendChild(ft);
  document.body.appendChild(pg);
  document.body.style.overflow = "hidden";
  outline(); counts();
  if (editable) setTimeout(function () { if (!r.text && (r.title === "Untitled document")) { ti.focus(); ti.select(); } else area.focus(); }, 50);
  try { history.replaceState(null, "", location.pathname + location.search + "#wiki=" + encodeURIComponent(r.id)); } catch (_) { }
}
function close(quiet) {
  closePop();
  if (cur && editable && saveT) { clearTimeout(saveT); save(); }
  saveT = null;
  var pg = $id("wd-page"); if (pg) pg.remove();
  document.body.style.overflow = "";
  cur = null; area = null;
  try { if (/^#wiki=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search); } catch (_) { }
  if (!quiet && typeof renderDocLib === "function" && $id("dl-page") && $id("dl-page").style.display === "block") renderDocLib();
}

/* ---------------------------------------------------------- the ＋ Add menu */
function addMenu(anchor) {
  injectCss();
  var m = el("div", "wd-menu");
  var a = el("button"); a.innerHTML = "\uD83D\uDCDD New document<small>Write it right here \u2014 headings, lists, tables, images</small>";
  a.onclick = function () { closePop(); dlOpenDialog(null, true); };
  var b = el("button"); b.innerHTML = "\uD83D\uDD17 Add a link<small>Google Doc, Sheet, Loom, YouTube, Notion\u2026</small>";
  b.onclick = function () { closePop(); dlOpenDialog(null, false); };
  m.append(a, b);
  openPop(anchor, m);
}

/* ---------------------------------------------------------- deep links (…#wiki=<id>) */
function openFromHash() {
  var m = /^#wiki=([\w-]+)/.exec(location.hash || ""); if (!m) return;
  var id = decodeURIComponent(m[1]), tries = 0;
  var t = setInterval(function () {
    tries++;
    if (typeof DOCLIB !== "undefined" && me() && rec(id)) {
      clearInterval(t);
      if (typeof openDocLib === "function") openDocLib();
      open(id);
    } else if (tries > 40) clearInterval(t);   // ~20 s: not loaded, signed out, or no longer there
  }, 500);
}
window.addEventListener("load", openFromHash);
window.addEventListener("hashchange", openFromHash);

window.WD = { open: open, close: close, clean: clean, plainText: plainText, addMenu: addMenu, templates: TEMPLATES, sectionTemplate: SECTION_TEMPLATE, link: docLink };
})();
