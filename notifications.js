/* ================= Notifications: 🔔 bell + pop-ups =================
   People whose role has "Send notifications" (send_notifications; Owners
   always) send a message to the whole team or to chosen people from
   Administration → Notifications, or with the 🔔 button on a user's row.
     * Every message shows in the 🔔 bell at the top for the people it's for.
     * It can also POP UP, with a rule:
         once        — pop up one time
         times       — pop up N times
         until_ack   — keep popping up until they press "Got it"
       A message can carry a YouTube video (video_id): it plays inside the
       pop-up, and from the bell.
     * It can also be PINNED as a banner at the top of one page (place, e.g.
       "social:<space id>:ideation" = Social Media → Ideation, above "All
       ideas") until place_until — it disappears by itself. Each person can
       hide it for themselves. index.html calls ntfBannerSlot(wrap, key)
       where a page can carry banners. bell=false keeps it out of the bell.
       at most once per app visit, or once per day, and optionally only
       until a date.
   The database decides who sees what (supabase/stage11a_notifications.sql);
   receipts (popped up / read / got it) are written only through
   mark_notification(), so senders can see who has seen each message.
   Loaded before index.html's main script; uses its globals at call time
   (SUPA, TEAM, currentUser, hasPerm, adminMembers, userDisplayName,
   userAvatarColor, findUser, toast, openAdmin, renderAdminPage).            */
var NTF = { list: [], receipts: {}, loaded: false, timer: null, popped: {}, queue: [], showing: false, open: false, hiddenLocal: {}, bannerSeen: {} };
var NTF_UI = { to: [], audience: "team", edit: null };   /* composer state, kept between redraws; edit = the sent message being changed */

function ntfEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function ntfCanSend() { try { return !!SUPA && hasPerm("send_notifications"); } catch (_) { return false; } }
function ntfWhen(ts) {
  var d = new Date(ts), s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  if (s < 7 * 86400) return Math.floor(s / 86400) + " d ago";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}
function ntfSender(n) {
  var u = (typeof USERS !== "undefined" ? USERS : []).find(function (x) { return x.id === n.created_by; });
  return u ? userDisplayName(u) : "";                      /* teammates may not see the sender's profile */
}
function ntfForMe(n) {
  var me = currentUser(); if (!me || n.created_by === me.id) return false;   /* never your own */
  if (!ntfStarted(n)) return false;                         /* scheduled for later (LMS drops) */
  return n.audience === "team" || (n.recipients || []).indexOf(me.id) >= 0;
}
/* a YouTube link (watch, youtu.be, shorts, live, embed) or a bare id -> the 11-character id, or "" */
function ntfYouTubeId(s) {
  s = String(s || "").trim(); if (!s) return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  var m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}
function ntfVideo(id) {
  var w = ntfEl("div", "ntf-vid"), f = document.createElement("iframe");
  f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?rel=0&modestbranding=1";
  f.title = "YouTube video"; f.loading = "lazy";
  f.setAttribute("allow", "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen");
  f.setAttribute("allowfullscreen", "");
  f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  w.appendChild(f);
  return w;
}
function ntfThumb(id) {
  var t = ntfEl("span", "ntf-thumb"), img = document.createElement("img");
  img.src = "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/mqdefault.jpg"; img.alt = "";
  t.append(img, ntfEl("span", "ntf-play", "▶"));
  return t;
}
function ntfStarted(n) { return !n.starts_at || new Date(n.starts_at).getTime() <= Date.now(); }
/* an LMS drop delivered by this message, once lms.js has loaded it (else null) */
function ntfDrop(n) { return (n.drop_id && window.LMS && LMS.drops[n.drop_id]) || null; }
function ntfMine() { return NTF.list.filter(function (n) { return ntfForMe(n) && n.bell !== false; }); }   /* the bell's list */
function ntfUnread() { return ntfMine().filter(function (n) { var r = NTF.receipts[n.id]; return !(r && r.read_at); }).length; }

/* ---------- styles ---------- */
(function () {
  var css = ""
  + ".corner-bell{position:relative;padding:8px 12px!important;font-size:15px!important;line-height:1}"
  + ".corner-bell .nb-dot{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#B03A34;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid var(--card)}"
  + ".ntf-panel{position:fixed;z-index:9000;width:min(380px,calc(100vw - 24px));max-height:min(520px,calc(100vh - 90px));display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line-strong);border-radius:14px;box-shadow:0 14px 40px rgba(26,22,20,.18);overflow:hidden}"
  + ".ntf-ph{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);font-weight:700}"
  + ".ntf-ph button{font-size:12.5px;font-weight:600;color:var(--indigo)}"
  + ".ntf-list{overflow:auto}"
  + ".ntf-item{display:block;width:100%;text-align:left;padding:12px 16px;border-bottom:1px solid var(--line);position:relative}"
  + ".ntf-item:hover{background:var(--paper)}"
  + ".ntf-item.unread{background:var(--indigo-soft)}"
  + ".ntf-item.unread::before{content:'';position:absolute;left:6px;top:18px;width:6px;height:6px;border-radius:50%;background:var(--indigo)}"
  + ".ntf-t{font-weight:600;font-size:14px}"
  + ".ntf-b{font-size:13.5px;color:var(--ink);white-space:pre-wrap;word-wrap:break-word;margin-top:3px}"
  + ".ntf-item:not(.expanded) .ntf-b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}"
  + ".ntf-m{font-size:12px;color:var(--muted);margin-top:4px}"
  + ".ntf-go{float:right;color:var(--indigo,#E8622B);font-weight:600}"
  + ".ntf-empty{padding:28px 16px;text-align:center;color:var(--muted);font-size:14px}"
  + ".ntf-pf{padding:10px 16px;border-top:1px solid var(--line);text-align:center}"
  + ".ntf-pf button{font-size:13px;font-weight:600;color:var(--indigo)}"
  + ".ntf-pop-bg{position:fixed;inset:0;z-index:9500;background:rgba(26,22,20,.45);display:flex;align-items:center;justify-content:center;padding:16px}"
  + ".ntf-pop{background:var(--card);border-radius:16px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:24px;max-height:calc(100vh - 32px);overflow:auto}"
  + ".ntf-pop .np-k{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;color:var(--indigo);text-transform:uppercase}"
  + ".ntf-pop h3{font-size:20px;margin:6px 0 10px}"
  + ".ntf-pop .np-b{white-space:pre-wrap;word-wrap:break-word;font-size:15px;line-height:1.55}"
  + ".ntf-pop .np-m{font-size:12.5px;color:var(--muted);margin-top:14px}"
  + ".ntf-pop .np-a{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}"
  + ".ntf-btn{border:1px solid var(--line-strong);border-radius:10px;padding:9px 16px;font-weight:600;font-size:14px;background:var(--card)}"
  + ".ntf-btn.primary{background:var(--indigo);border-color:var(--indigo);color:#fff}"
  + ".ntf-btn:disabled{opacity:.55;cursor:default}"
  + ".ntf-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:22px}"
  + ".ntf-card h3{font-size:16px;margin-bottom:12px}"
  + ".ntf-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}"
  + ".ntf-lab{font-size:12.5px;font-weight:600;color:var(--muted);margin:4px 0 6px;display:block}"
  + ".ntf-card textarea,.ntf-card input[type=text],.ntf-card input[type=number],.ntf-card input[type=datetime-local],.ntf-card select{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:14px;background:var(--paper);color:var(--ink)}"
  + ".ntf-card textarea{width:100%;min-height:96px;resize:vertical}"
  + ".ntf-card input[type=text]{width:100%}"
  + ".ntf-seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:10px;overflow:hidden}"
  + ".ntf-seg button{padding:8px 14px;font-size:13.5px;font-weight:600;border-right:1px solid var(--line-strong)}"
  + ".ntf-seg button:last-child{border-right:none}"
  + ".ntf-seg button.on{background:var(--indigo);color:#fff}"
  + ".ntf-people{display:flex;flex-wrap:wrap;gap:6px;max-height:180px;overflow:auto;padding:2px}"
  + ".ntf-chip{border:1px solid var(--line-strong);border-radius:99px;padding:6px 12px;font-size:13px;background:var(--card)}"
  + ".ntf-chip.on{background:var(--indigo-soft);border-color:var(--indigo);color:var(--indigo);font-weight:600}"
  + ".ntf-opt{display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer;margin:6px 0}"
  + ".ntf-sub{margin:4px 0 4px 26px;padding:12px 14px;border-left:3px solid var(--indigo-soft);display:flex;flex-direction:column;gap:6px}"
  + ".ntf-err{color:#B03A34;font-size:13px;min-height:18px}"
  + ".ntf-sent{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px;background:var(--card)}"
  + ".ntf-sent .ns-top{display:flex;gap:10px;justify-content:space-between;align-items:flex-start}"
  + ".ntf-sent .ns-acts{display:flex;gap:6px;flex:none}"
  + ".ntf-sent .ns-acts button{font-size:12.5px;font-weight:600;border:1px solid var(--line-strong);border-radius:8px;padding:5px 10px}"
  + ".ntf-tag{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--paper);border:1px solid var(--line);margin-right:6px;margin-top:6px}"
  + ".ntf-tag.live{background:#E3F2EA;border-color:#BFE0CC;color:#1F7A4D}"
  + ".ntf-tag.off{background:#EEF1F5;color:#5C6A82}"
  + ".ntf-who{margin-top:10px;font-size:13px;display:none}"
  + ".ntf-who.show{display:block}"
  + ".ntf-who table{border-collapse:collapse;width:100%}"
  + ".ntf-who td{padding:5px 6px;border-top:1px solid var(--line)}"
  + ".ntf-pop.has-vid{max-width:680px}"
  + ".ntf-vid{position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000;margin-top:14px}"
  + ".ntf-vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}"
  + ".ntf-thumb{position:relative;display:block;width:160px;max-width:100%;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:#000;margin-top:8px}"
  + ".ntf-thumb img{width:100%;height:100%;object-fit:cover;display:block}"
  + ".ntf-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;text-shadow:0 1px 6px rgba(0,0,0,.6);background:rgba(0,0,0,.18)}"
  + ".ntf-vprev{display:flex;gap:10px;align-items:center;font-size:13px;color:var(--muted);min-height:20px;margin-top:6px}"
  + ".ntf-vprev .ntf-thumb{width:120px;margin:0}"
  + ".ntf-spot{position:relative;display:flex;gap:18px;align-items:center;margin:0 0 22px;padding:16px 46px 16px 16px;border-radius:16px;border:1px solid #F3C3A6;background:linear-gradient(120deg,#FFF6EF 0%,#FDE6D6 55%,#FBD9C4 100%);box-shadow:0 6px 22px rgba(232,98,43,.14);overflow:hidden;font-family:var(--sans)}"
  + ".ntf-spot::after{content:'';position:absolute;right:-60px;top:-60px;width:180px;height:180px;border-radius:50%;background:rgba(232,98,43,.08);pointer-events:none}"
  + ".ntf-spot .sp-media{flex:none;width:300px;max-width:100%;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000;position:relative;z-index:1;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18)}"
  + ".ntf-spot.playing .sp-media{width:min(560px,55%);cursor:default}"
  + ".ntf-spot .sp-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}"
  + ".ntf-spot .sp-media:hover img{transform:scale(1.04)}"
  + ".ntf-spot .sp-media iframe{position:absolute;inset:0;width:100%;height:100%;border:0}"
  + ".ntf-spot .sp-play{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px 0 0 -31px;border-radius:50%;background:var(--indigo);color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;padding-left:4px;box-shadow:0 0 0 0 rgba(232,98,43,.6);animation:ntfPulse 1.8s infinite}"
  + ".ntf-spot .sp-dur{position:absolute;left:10px;bottom:8px;font-size:11.5px;font-weight:700;color:#fff;background:rgba(0,0,0,.55);padding:2px 8px;border-radius:99px}"
  + "@keyframes ntfPulse{0%{box-shadow:0 0 0 0 rgba(232,98,43,.6)}70%{box-shadow:0 0 0 18px rgba(232,98,43,0)}100%{box-shadow:0 0 0 0 rgba(232,98,43,0)}}"
  + "@media (prefers-reduced-motion:reduce){.ntf-spot .sp-play{animation:none}}"
  + ".ntf-spot .sp-txt{min-width:0;flex:1;position:relative;z-index:1}"
  + ".ntf-spot .sp-k{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#B8461A;font-weight:600}"
  + ".ntf-spot .sp-t{font-size:21px;font-weight:700;line-height:1.25;margin:5px 0 6px;color:var(--ink);letter-spacing:-.01em}"
  + ".ntf-spot .sp-b{font-size:14.5px;line-height:1.5;color:#3F3833;white-space:pre-wrap;word-wrap:break-word}"
  + ".ntf-spot .sp-m{font-size:12.5px;color:#7A6A5E;margin-top:8px}"
  + ".ntf-spot .sp-cta{margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:var(--indigo);color:#fff;font-weight:600;font-size:13.5px;border-radius:99px;padding:7px 14px}"
  + ".ntf-spot .sp-x{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;font-size:18px;color:#7A6A5E;background:rgba(255,255,255,.85);z-index:3;display:flex;align-items:center;justify-content:center}"
  + ".ntf-spot .sp-x:hover,.ntf-spot .sp-mn:hover{background:#fff;color:var(--ink)}"
  + ".ntf-spot .sp-mn{position:absolute;top:10px;right:46px;width:30px;height:30px;border-radius:50%;font-size:15px;font-weight:700;color:#7A6A5E;background:rgba(255,255,255,.85);z-index:3;display:flex;align-items:center;justify-content:center}"
  + ".ntf-spot.min{padding:8px 88px 8px 10px;gap:12px;cursor:pointer;margin-bottom:16px;box-shadow:0 2px 8px rgba(232,98,43,.10)}"
  + ".ntf-spot.min .sp-media{width:72px;border-radius:7px;box-shadow:none;pointer-events:none}"
  + ".ntf-spot.min .sp-play{width:26px;height:26px;margin:-13px 0 0 -13px;font-size:11px;padding-left:2px;animation:none}"
  + ".ntf-spot.min .sp-dur,.ntf-spot.min .sp-b,.ntf-spot.min .sp-cta,.ntf-spot.min .sp-own,.ntf-spot.min::after{display:none}"
  + ".ntf-spot.min .sp-t{font-size:15px;margin:0}"
  + ".ntf-spot.min .sp-x,.ntf-spot.min .sp-mn{top:50%;margin-top:-15px}"
  + ".ntf-spot .sp-own{display:inline-block;font-size:11px;font-weight:600;background:rgba(255,255,255,.7);border:1px solid #F3C3A6;border-radius:99px;padding:1px 8px;color:#7A6A5E}"
  + "@media (max-width:760px){.ntf-spot:not(.min){flex-direction:column;align-items:stretch;padding:14px}.ntf-spot .sp-media,.ntf-spot.playing .sp-media{width:100%}.ntf-spot .sp-txt{padding-right:24px}.ntf-spot .sp-t{font-size:18px}}"
  + "@media (max-width:640px){.ntf-sent .ns-top{flex-direction:column}}";
  var st = document.createElement("style"); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();

/* ---------- data ---------- */
async function ntfLoad() {
  if (!SUPA || !currentUser() || typeof TEAM === "undefined" || !TEAM) return;
  var since = new Date(Date.now() - 90 * 86400000).toISOString();
  var res = await Promise.all([
    SUPA.from("team_notifications").select("*").eq("team_slug", TEAM).gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    SUPA.from("notification_receipts").select("*").eq("user_id", currentUser().id)
  ]);
  if (res[0].error) throw new Error(res[0].error.message);
  NTF.list = res[0].data || [];
  NTF.receipts = {};
  (res[1].data || []).forEach(function (r) { NTF.receipts[r.notification_id] = r; });
  NTF.loaded = true;
}
async function ntfMark(n, what) {
  var r = NTF.receipts[n.id] || (NTF.receipts[n.id] = { notification_id: n.id, shown_count: 0 });
  var now = new Date().toISOString();
  if (what === "shown") { r.shown_count = (r.shown_count || 0) + 1; r.last_shown_at = now; }
  if (what === "read" || what === "ack") r.read_at = r.read_at || now;
  if (what === "ack") r.acked_at = r.acked_at || now;
  try { await SUPA.rpc("mark_notification", { n_id: n.id, what: what }); } catch (_) { }
}

/* ---------- pop-ups ---------- */
function ntfShouldPop(n) {
  if (!n.popup || n.stopped || !ntfForMe(n)) return false;
  if (n.show_until && new Date(n.show_until).getTime() < Date.now()) return false;
  if (NTF.popped[n.id]) return false;                       /* once per visit at most */
  var r = NTF.receipts[n.id] || {};
  if (r.acked_at) return false;
  var shown = r.shown_count || 0;
  if (n.popup_rule === "once" && shown >= 1) return false;
  if (n.popup_rule === "times" && shown >= (n.popup_times || 1)) return false;
  if (n.popup_gap === "day" && r.last_shown_at && new Date(r.last_shown_at).toDateString() === new Date().toDateString()) return false;
  return true;
}
function ntfCheckPopups() {
  NTF.list.filter(ntfForMe).reverse().forEach(function (n) {    /* oldest first */
    if (ntfShouldPop(n) && NTF.queue.indexOf(n) < 0) NTF.queue.push(n);
  });
  ntfNextPopup();
}
function ntfNextPopup() {
  if (NTF.showing) return;
  var n = NTF.queue.shift(); if (!n) return;
  if (!ntfShouldPop(n)) { ntfNextPopup(); return; }
  NTF.popped[n.id] = 1;
  ntfMark(n, "shown").then(ntfRenderBell);
  ntfShowBox(n, true);
}
/* the message in a box: as a pop-up (asPopup, follows its rule) or opened from the bell */
function ntfShowBox(n, asPopup) {
  NTF.showing = true;
  var drop = ntfDrop(n);
  var bg = ntfEl("div", "ntf-pop-bg"), box = ntfEl("div", "ntf-pop" + (n.video_id || drop ? " has-vid" : ""));
  box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  if (drop) lmsRenderDrop(box, drop, { preview: !ntfForMe(n), n: n });   /* LMS drop: content + questions (lms.js) */
  else {
    box.appendChild(ntfEl("div", "np-k", n.audience === "team" ? "📣 Message for the team" : "📩 Message for you"));
    box.appendChild(ntfEl("h3", "", n.title));
    if (n.body) box.appendChild(ntfEl("div", "np-b", n.body));
    if (n.video_id) box.appendChild(ntfVideo(n.video_id));
    box.appendChild(ntfEl("div", "np-m", (ntfSender(n) ? "From " + ntfSender(n) + " · " : "") + ntfWhen(n.created_at)));
  }
  var acts = ntfEl("div", "np-a");
  function close() { bg.remove(); NTF.showing = false; setTimeout(ntfNextPopup, 250); }   /* removing the box stops the video */
  var mine = ntfForMe(n);                                  /* false: the sender previewing it */
  var ack = mine && n.popup && n.popup_rule === "until_ack" && !(NTF.receipts[n.id] || {}).acked_at;
  if (asPopup && ack) {
    var later = ntfEl("button", "ntf-btn", "Remind me later");
    later.onclick = function () { ntfMark(n, "read"); close(); };
    acts.appendChild(later);
  }
  /* monthly feedback reminder (monthly-feedback.js): straight to the form */
  var fill = mine && !n.stopped && n.ref && /^feedback:/.test(n.ref) && typeof openAdmin === "function";
  var ok = ntfEl("button", "ntf-btn" + (drop || fill ? "" : " primary"), ack ? "Got it ✓" : drop ? "Close" : fill && asPopup ? "Later" : asPopup ? "OK" : "Close");
  ok.onclick = function () { if (mine) ntfMark(n, ack ? "ack" : "read").then(ntfRenderBell); close(); };
  acts.appendChild(ok);
  var route = !fill && !drop && mine ? ntfRoute(n) : null;
  if (route) {
    var op = ntfEl("button", "ntf-btn primary", "Open →");
    op.onclick = function () { ntfMark(n, "read").then(ntfRenderBell); close(); route(); };
    acts.appendChild(op);
    ok.className = "ntf-btn"; if (asPopup && !ack) ok.textContent = "Later";
  }
  if (fill) {
    var go = ntfEl("button", "ntf-btn primary", "✍️ Fill it now");
    go.onclick = function () { ntfMark(n, "read").then(ntfRenderBell); close(); if (typeof closeTeam === "function") closeTeam(); openAdmin("myfeedback"); };
    acts.appendChild(go);
  }
  box.appendChild(acts);
  bg.appendChild(box);
  if (!(asPopup && ack)) bg.onclick = function (e) { if (e.target === bg) ok.onclick(); };
  document.body.appendChild(bg);
  setTimeout(function () { ok.focus(); }, 30);
}

/* ---------- clicking a notification takes you where it's about ----------
   From n.ref when it has one, otherwise from the wording (every automatic
   bell names its place, e.g. "My HR file → Equipment"), so older
   notifications work too. Returns a function that goes there, or null. */
function ntfRoute(n) {
  var t = (n.title || "") + "\n" + (n.body || ""), ref = n.ref || "";
  var has = function (f) { return typeof window[f] === "function"; };
  var leave = function () {   // close whatever full page is open first
    if (has("hrClosePage")) { var hp = document.getElementById("hr-page"); if (hp && hp.style.display !== "none") hrClosePage(); }
    if (has("closeTeam")) closeTeam();
  };
  var admin = function (k, after) { return has("openAdmin") ? function () { leave(); if (after) after(); openAdmin(k); } : null; };
  var myhr = function (step) { return has("openMyHrFile") ? function () { leave(); if (has("closeAdmin")) closeAdmin(); openMyHrFile(step && has("hrStepIx") ? hrStepIx(step) : undefined); } : null; };
  var hrPerson = function () { return admin("hr", function () { if (typeof HRA !== "undefined" && n.created_by) { HRA.open = n.created_by; HRA.rows = null; } }); };
  var isHr = has("hrIsAdmin") && hrIsAdmin();
  if (/^feedback:/.test(ref)) return admin("myfeedback");
  if (/^hr:/.test(ref)) { var st = ref.split(":")[1] || ""; return myhr(has("hrStepIx") && hrStepIx(st) >= 0 ? st : null); }
  if (/^admin:/.test(ref)) return admin(ref.slice(6));
  // HR
  if (/^🎒/.test(n.title || "")) return /My HR file/.test(t) || !isHr ? myhr("equipment") : admin("hrequipment");
  if (/My HR file → Offer letter|offer letter is in your email|offer letter is waiting/i.test(t)) return myhr("contract");
  if (/My HR file/.test(t) || /^(🗂️|✅|✏️) (HR |Your HR file)/.test(n.title || "")) return myhr(null);
  if (/Employees \(HR\)/.test(t)) return hrPerson();
  // feedback, suggestions, ideas
  if (/My monthly feedback/.test(t)) return admin("myfeedback");
  if (/My Team → Monthly feedback/.test(t) && has("openTeam")) return function () { leave(); if (has("closeAdmin")) closeAdmin(); openTeam(); if (has("mtSetView")) mtSetView("feedback"); };
  if (/Suggestion box/.test(t)) return admin("suggestbox");
  if (/your idea/i.test(n.title || "")) return admin("myideas");
  return null;
}

/* ---------- banners pinned on a page ---------- */
/* the pages a banner can go on: [key, label] — each Social Media space's tabs */
function ntfPlaces() {
  var out = [];
  try {
    (CSPACES.list || []).filter(function (x) { return x.type === "social"; }).forEach(function (cs) {
      (window.SX && SX.tabs || []).forEach(function (t) { out.push(["social:" + cs.id + ":" + t[0], (cs.name || "Social Media") + " › " + t[1]]); });
    });
  } catch (_) { }
  return out;
}
function ntfPlaceLabel(key) {
  var f = ntfPlaces().find(function (x) { return x[0] === key; });
  return f ? f[1] : "a page that no longer exists";
}
function ntfBannerLive(n) {
  return !!n.place && !n.stopped && ntfStarted(n) && !!n.place_until && new Date(n.place_until).getTime() > Date.now();
}
function ntfBannersFor(key) {
  var me = currentUser(); if (!me) return [];
  return NTF.list.filter(function (n) {
    if (n.place !== key || !ntfBannerLive(n) || NTF.hiddenLocal[n.id]) return false;
    if (n.created_by === me.id) return true;                  /* the sender sees it too, to check it */
    return ntfForMe(n) && !(NTF.receipts[n.id] || {}).hidden_at;
  });
}
function ntfUntilText(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
/* put the banners for page `key` at the top of `wrap` (called by index.html on each draw) */
function ntfBannerSlot(wrap, key) {
  if (!wrap) return;
  var slot = ntfEl("div", "ntf-spot-slot"); slot.dataset.key = key;
  wrap.insertBefore(slot, wrap.firstChild);
  ntfFillSlot(slot);
}
function ntfFillSlot(slot) {
  slot.innerHTML = "";
  ntfBannersFor(slot.dataset.key).forEach(function (n) {
    var own = n.created_by === (currentUser() || {}).id;
    var mini = ntfMinGet(n.id);                              /* this person shrank it to a strip */
    var b = ntfEl("div", "ntf-spot" + (mini ? " min" : ""));
    b.setAttribute("role", "region"); b.setAttribute("aria-label", "Pinned message: " + n.title);
    if (n.video_id) {
      var m = ntfEl("div", "sp-media"), img = document.createElement("img");
      img.src = "https://i.ytimg.com/vi/" + encodeURIComponent(n.video_id) + "/hqdefault.jpg"; img.alt = "";
      var play = ntfEl("span", "sp-play", "▶");
      m.append(img, play, ntfEl("span", "sp-dur", "▶ Watch"));
      m.tabIndex = 0; m.setAttribute("role", "button"); m.setAttribute("aria-label", "Play the video");
      function start() {
        if (b.classList.contains("playing")) return;
        b.classList.add("playing");
        var v = ntfVideo(n.video_id), f = v.querySelector("iframe");
        f.src += "&autoplay=1"; f.setAttribute("allow", f.getAttribute("allow") + "; autoplay");
        m.innerHTML = ""; m.appendChild(f);
        if (cta) cta.remove();
        if (!own) ntfMark(n, "read");
      }
      m.onclick = start;
      m.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); } };
      b.appendChild(m);
    }
    var t = ntfEl("div", "sp-txt");                           /* just the message: no sender, no dates */
    if (own) t.appendChild(ntfEl("span", "sp-own", "Only you see this note · banner ends " + ntfUntilText(n.place_until)));
    t.appendChild(ntfEl("div", "sp-t", n.title));
    if (n.body) t.appendChild(ntfEl("div", "sp-b", n.body));
    var cta = null;
    var drop = ntfDrop(n);
    if (drop) {                                               /* LMS drop: open it to watch / read / answer */
      var nq = (drop.questions || []).length, done = window.LMS && LMS.mine[drop.id];
      cta = ntfEl("button", "sp-cta", done ? "✅ Answered · see what the team said" : nq ? "✨ Open · " + nq + " quick question" + (nq > 1 ? "s" : "") : drop.url ? "📰 Read it" : "▶ Watch");
      cta.type = "button"; cta.onclick = function (e) { e.stopPropagation(); ntfShowBox(n, false); }; t.appendChild(cta);
    } else if (n.video_id) { cta = ntfEl("button", "sp-cta", "▶ Play video"); cta.type = "button"; cta.onclick = function () { b.querySelector(".sp-media").click(); }; t.appendChild(cta); }
    b.appendChild(t);
    var mn = ntfEl("button", "sp-mn", mini ? "▾" : "—"); mn.type = "button";
    mn.title = mini ? "Show it again" : "Minimize"; mn.setAttribute("aria-label", mn.title);
    mn.onclick = function (e) { e.stopPropagation(); ntfMinSet(n.id, !mini); ntfFillSlot(slot); };   /* redraw also stops a playing video */
    b.appendChild(mn);
    if (mini) { b.title = "Show it again"; b.onclick = function (e) { if (e.target === x || e.target === mn) return; ntfMinSet(n.id, false); ntfFillSlot(slot); }; }
    var x = ntfEl("button", "sp-x", "×"); x.type = "button"; x.title = own ? "Hide it here for now (the team still sees it)" : "Hide this for me";
    x.setAttribute("aria-label", x.title);
    x.onclick = function () { NTF.hiddenLocal[n.id] = 1; if (!own) ntfMark(n, "hide"); b.remove(); };
    b.appendChild(x);
    slot.appendChild(b);
    if (!own && !(NTF.receipts[n.id] || {}).read_at && !NTF.bannerSeen[n.id]) { NTF.bannerSeen[n.id] = 1; ntfMark(n, "read").then(ntfRenderBell); }
  });
}
/* minimized banners: remembered on this device only (a viewer's own convenience) */
function ntfMinGet(id) { try { return localStorage.getItem("ntf-min-" + id) === "1"; } catch (_) { return false; } }
function ntfMinSet(id, on) { try { if (on) localStorage.setItem("ntf-min-" + id, "1"); else localStorage.removeItem("ntf-min-" + id); } catch (_) { } }
function ntfRefreshSlots() {
  document.querySelectorAll(".ntf-spot-slot").forEach(function (sl) { if (!sl.querySelector(".ntf-spot.playing")) ntfFillSlot(sl); });
}

/* ---------- the bell ---------- */
function ntfBellBtn() {
  var b = document.getElementById("nav-bell");
  if (b) return b;
  var acc = document.getElementById("nav-account"); if (!acc) return null;
  b = ntfEl("button", "corner-nav ghost corner-bell");
  b.id = "nav-bell"; b.type = "button"; b.title = "Notifications";
  b.onclick = function (e) { e.stopPropagation(); NTF.open ? ntfClosePanel() : ntfOpenPanel(); };
  acc.parentNode.insertBefore(b, acc);
  return b;
}
function ntfRenderBell() {
  var b = ntfBellBtn(); if (!b) return;
  if (!currentUser() || !NTF.loaded) { b.style.display = "none"; return; }
  b.style.display = "";
  var n = ntfUnread();
  b.innerHTML = "";
  b.appendChild(document.createTextNode("🔔"));
  if (n) b.appendChild(ntfEl("span", "nb-dot", n > 99 ? "99+" : String(n)));
  b.setAttribute("aria-label", n ? "Notifications, " + n + " unread" : "Notifications");
  if (NTF.open) ntfDrawPanel();
}
function ntfPanelEl() { return document.getElementById("ntf-panel"); }
function ntfOpenPanel() {
  NTF.open = true;
  var p = ntfPanelEl();
  if (!p) { p = ntfEl("div", "ntf-panel"); p.id = "ntf-panel"; p.onclick = function (e) { e.stopPropagation(); }; document.body.appendChild(p); }
  var r = document.getElementById("nav-bell").getBoundingClientRect();
  p.style.top = (r.bottom + 8) + "px";
  var w = Math.min(380, window.innerWidth - 24);              /* keep it on screen on phones */
  p.style.right = Math.min(Math.max(12, window.innerWidth - r.right), window.innerWidth - w - 12) + "px";
  ntfDrawPanel();
}
function ntfClosePanel() { NTF.open = false; var p = ntfPanelEl(); if (p) p.remove(); }
document.addEventListener("click", function () { if (NTF.open) ntfClosePanel(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && NTF.open) ntfClosePanel(); });
window.addEventListener("resize", function () { if (NTF.open) ntfClosePanel(); });

function ntfDrawPanel() {
  var p = ntfPanelEl(); if (!p) return;
  p.innerHTML = "";
  var mine = ntfMine();
  var head = ntfEl("div", "ntf-ph");
  head.appendChild(ntfEl("span", "", "Notifications"));
  if (ntfUnread()) {
    var all = ntfEl("button", "", "Mark all as read");
    all.onclick = function () {
      mine.forEach(function (n) { var r = NTF.receipts[n.id]; if (!(r && r.read_at)) ntfMark(n, "read"); });
      ntfRenderBell();
    };
    head.appendChild(all);
  }
  p.appendChild(head);
  var list = ntfEl("div", "ntf-list");
  if (!mine.length) list.appendChild(ntfEl("div", "ntf-empty", "No notifications yet."));
  mine.forEach(function (n) {
    var r = NTF.receipts[n.id], unread = !(r && r.read_at);
    var it = ntfEl("button", "ntf-item" + (unread ? " unread" : ""));
    it.type = "button";
    it.appendChild(ntfEl("div", "ntf-t", n.title));
    if (n.body) it.appendChild(ntfEl("div", "ntf-b", n.body));
    if (n.video_id) it.appendChild(ntfThumb(n.video_id));
    var go = ntfRoute(n);
    var meta = ntfEl("div", "ntf-m", (ntfSender(n) ? ntfSender(n) + " · " : "") + ntfWhen(n.created_at) + (n.audience === "team" ? " · whole team" : " · just you"));
    if (go) meta.appendChild(ntfEl("span", "ntf-go", "Open →"));
    it.appendChild(meta);
    it.onclick = function () {
      if (n.video_id || ntfDrop(n)) { ntfClosePanel(); ntfShowBox(n, false); return; }   /* open it big, to watch / answer */
      if (go) {   /* straight to the page it's about */
        if (unread) ntfMark(n, "read").then(ntfRenderBell);
        ntfClosePanel(); go(); return;
      }
      it.classList.toggle("expanded");
      if (!unread) return;
      unread = false; it.classList.remove("unread");
      ntfMark(n, "read");                                     /* marks it locally at once */
      var d = document.querySelector("#nav-bell .nb-dot"), c = ntfUnread();
      if (d) { if (c) d.textContent = c > 99 ? "99+" : String(c); else d.remove(); }
    };
    list.appendChild(it);
  });
  p.appendChild(list);
  if (ntfCanSend()) {
    var f = ntfEl("div", "ntf-pf"), s = ntfEl("button", "", "📣 Send a notification");
    s.onclick = function () { ntfClosePanel(); ntfOpenComposer(null); };
    f.appendChild(s); p.appendChild(f);
  }
}

/* ---------- start-up and refresh ---------- */
async function ntfRefresh() {
  try { await ntfLoad(); } catch (_) { return; }
  if (window.lmsAfterLoad) { try { await lmsAfterLoad(); } catch (_) { } }   /* the drops these messages carry */
  ntfRenderBell();
  ntfRefreshSlots();
  ntfCheckPopups();
}
function notifBoot() {
  if (!SUPA || !currentUser()) return;
  ntfRefresh();
  if (NTF.timer) clearInterval(NTF.timer);
  NTF.timer = setInterval(function () { if (!document.hidden) ntfRefresh(); }, 3 * 60000);
  if (!NTF.visHooked) {
    NTF.visHooked = true;
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Date.now() - (NTF.lastVis || 0) > 60000) { NTF.lastVis = Date.now(); ntfRefresh(); }
    });
  }
}

/* ---------- sending: Administration → Notifications ---------- */
function ntfOpenComposer(user) {
  NTF_UI.audience = user ? "people" : "team";
  NTF_UI.to = user ? [user.id] : [];
  NTF_UI.edit = null;
  NTF_UI.focus = true;
  openAdmin("notifications");
}
function ntfRuleText(n) {
  if (!n.popup) return "🔔 Bell only";   /* (older messages: bell is always on) */
  var t = n.popup_rule === "once" ? "Pop-up once" : n.popup_rule === "times" ? "Pop-up " + n.popup_times + " times" : "Pop-up until “Got it”";
  t += n.popup_gap === "day" ? " · once a day" : " · once per visit";
  if (n.show_until) t += " · until " + new Date(n.show_until).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return t;
}
function renderAdminNotifications(wrap) {
  var head = ntfEl("div", "admin-userhead"), left = ntfEl("div");
  var h2 = ntfEl("h2", "", "Notifications"); h2.style.margin = "0";
  var sub = ntfEl("div", "hint", "Send a message to the whole team or to chosen people. It can wait in their 🔔 bell, pop up on their screen, or be pinned as a banner on a page — with a YouTube video if you like.");
  sub.style.marginTop = "4px";
  left.append(h2, sub); head.appendChild(left); wrap.appendChild(head);

  var members = adminMembers().filter(function (u) { return u.id !== currentUser().id; })
    .sort(function (a, b) { return userDisplayName(a).localeCompare(userDisplayName(b)); });

  /* --- composer --- */
  var E = NTF_UI.edit;                                       /* editing a sent message, or null */
  var card = ntfEl("div", "ntf-card");
  card.appendChild(ntfEl("h3", "", E ? "✏️ Edit notification" : "📣 New notification"));
  if (E) {
    var eh = ntfEl("div", "hint", "Changes show for everyone straight away. People who already read it, pressed “Got it” or hid the banner aren't asked again.");
    eh.style.margin = "-6px 0 12px"; card.appendChild(eh);
  }

  card.appendChild(ntfEl("label", "ntf-lab", "Send to"));
  var seg = ntfEl("div", "ntf-seg"), bTeam = ntfEl("button", "", "Whole team"), bPeople = ntfEl("button", "", "Choose people");
  bTeam.type = bPeople.type = "button";
  seg.append(bTeam, bPeople);
  var segRow = ntfEl("div", "ntf-row"); segRow.appendChild(seg); card.appendChild(segRow);
  var people = ntfEl("div", "ntf-people");
  card.appendChild(people);
  function drawPeople() {
    bTeam.className = NTF_UI.audience === "team" ? "on" : "";
    bPeople.className = NTF_UI.audience === "people" ? "on" : "";
    people.style.display = NTF_UI.audience === "people" ? "" : "none";
    people.innerHTML = "";
    members.forEach(function (u) {
      var on = NTF_UI.to.indexOf(u.id) >= 0;
      var c = ntfEl("button", "ntf-chip" + (on ? " on" : ""), (on ? "✓ " : "") + userDisplayName(u));
      c.type = "button"; c.title = u.email;
      c.onclick = function () { if (on) NTF_UI.to = NTF_UI.to.filter(function (x) { return x !== u.id; }); else NTF_UI.to.push(u.id); drawPeople(); };
      people.appendChild(c);
    });
    if (!members.length) people.appendChild(ntfEl("span", "hint", "Nobody else is in this team yet."));
  }
  bTeam.onclick = function () { NTF_UI.audience = "team"; drawPeople(); };
  bPeople.onclick = function () { NTF_UI.audience = "people"; drawPeople(); };
  drawPeople();

  card.appendChild(ntfEl("label", "ntf-lab", "Title"));
  var title = document.createElement("input"); title.type = "text"; title.maxLength = 140; title.placeholder = "e.g. Team meeting moved to 4 PM";
  card.appendChild(title);
  card.appendChild(ntfEl("label", "ntf-lab", "Message (optional)"));
  var body = document.createElement("textarea"); body.maxLength = 4000; body.placeholder = "Write the details here…";
  card.appendChild(body);
  card.appendChild(ntfEl("label", "ntf-lab", "YouTube video (optional)"));
  var vid = document.createElement("input"); vid.type = "text"; vid.placeholder = "Paste a YouTube link, e.g. https://youtu.be/…";
  var vprev = ntfEl("div", "ntf-vprev");
  vid.oninput = function () {
    vprev.innerHTML = "";
    var v = vid.value.trim(); if (!v) return;
    var id = ntfYouTubeId(v);
    if (!id) { vprev.appendChild(ntfEl("span", "", "⚠️ That doesn't look like a YouTube link.")); return; }
    vprev.append(ntfThumb(id), ntfEl("span", "", "✓ This video will play inside the message."));
  };
  card.append(vid, vprev);

  card.appendChild(ntfEl("label", "ntf-lab", "How should they see it?"));
  function radio(name, val, label, checked) {
    var l = ntfEl("label", "ntf-opt"), r = document.createElement("input");
    r.type = "radio"; r.name = name; r.value = val; r.checked = !!checked;
    l.append(r, document.createTextNode(label));
    return { l: l, r: r };
  }
  function check(label, on) {
    var l = ntfEl("label", "ntf-opt"), c = document.createElement("input");
    c.type = "checkbox"; c.checked = !!on;
    l.append(c, document.createTextNode(label));
    return { l: l, r: c };
  }
  var mBell = check("🔔 Put it in their bell (it waits there at the top)", true);
  var mPop = check("💬 Pop it up on their screen");
  var mPin = check("📌 Pin it as a banner on a page (great with a video)");
  card.appendChild(mBell.l);
  card.appendChild(mPop.l);
  var popBox = ntfEl("div", "ntf-sub");
  var rOnce = radio("ntf-rule", "once", "Show the pop-up once", true);
  var rTimes = radio("ntf-rule", "times", "Show it ");
  var times = document.createElement("input"); times.type = "number"; times.min = 1; times.max = 20; times.value = 3; times.style.width = "70px";
  rTimes.l.append(times, document.createTextNode(" times"));
  var rAck = radio("ntf-rule", "until_ack", "Keep showing it until they press “Got it”");
  var gapRow = ntfEl("div", "ntf-row"); gapRow.style.margin = "6px 0 0";
  var gap = document.createElement("select");
  [["visit", "At most once each time they open the app"], ["day", "At most once a day"]].forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; gap.appendChild(op); });
  gapRow.appendChild(gap);
  var untilRow = ntfEl("label", "ntf-opt"), untilChk = document.createElement("input"), until = document.createElement("input");
  untilChk.type = "checkbox"; until.type = "datetime-local"; until.disabled = true;
  untilRow.append(untilChk, document.createTextNode("Stop popping up after "), until);
  untilChk.onchange = function () { until.disabled = !untilChk.checked; if (untilChk.checked && !until.value) { var d = new Date(Date.now() + 7 * 86400000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); until.value = d.toISOString().slice(0, 16); } };
  popBox.append(rOnce.l, rTimes.l, rAck.l, gapRow, untilRow);
  card.appendChild(popBox);
  card.appendChild(mPin.l);
  var pinBox = ntfEl("div", "ntf-sub");
  var places = ntfPlaces();
  var place = document.createElement("select");
  places.forEach(function (pl) { var op = document.createElement("option"); op.value = pl[0]; op.textContent = pl[1]; place.appendChild(op); });
  var ideation = places.find(function (pl) { return /:ideation$/.test(pl[0]); });
  if (ideation) place.value = ideation[0];
  var placeRow = ntfEl("label", "ntf-opt"); placeRow.append(document.createTextNode("Page: "), place);
  var daysRow = ntfEl("label", "ntf-opt"), days = document.createElement("input");
  days.type = "number"; days.min = 1; days.max = 60; days.value = 7; days.style.width = "70px";
  daysRow.append(document.createTextNode("Show it for "), days, document.createTextNode(E ? " days from when it was sent, then it disappears by itself" : " days, then it disappears by itself"));
  pinBox.append(placeRow, daysRow, ntfEl("div", "hint", "It sits at the top of that page, above everything else. Each person can hide it for themselves."));
  if (!places.length) { mPin.r.disabled = true; mPin.l.title = "No page can carry a banner yet (add a Social Media space first)"; }
  card.appendChild(pinBox);
  function drawMode() { popBox.style.display = mPop.r.checked ? "" : "none"; pinBox.style.display = mPin.r.checked ? "" : "none"; }
  mBell.r.onchange = mPop.r.onchange = mPin.r.onchange = drawMode;
  if (E) {                                                    /* fill the form from the sent message */
    title.value = E.title || ""; body.value = E.body || "";
    vid.value = E.video_id ? "https://youtu.be/" + E.video_id : ""; vid.oninput();
    mBell.r.checked = E.bell !== false; mPop.r.checked = !!E.popup; mPin.r.checked = !!E.place;
    rOnce.r.checked = E.popup_rule === "once"; rTimes.r.checked = E.popup_rule === "times"; rAck.r.checked = E.popup_rule === "until_ack";
    times.value = E.popup_times || 3; gap.value = E.popup_gap || "visit";
    if (E.show_until) {
      var su = new Date(E.show_until); su.setMinutes(su.getMinutes() - su.getTimezoneOffset());
      untilChk.checked = true; until.disabled = false; until.value = su.toISOString().slice(0, 16);
    }
    if (E.place) {
      if (!places.some(function (pl) { return pl[0] === E.place; })) { var op = document.createElement("option"); op.value = E.place; op.textContent = ntfPlaceLabel(E.place); place.appendChild(op); }
      place.value = E.place;
      days.value = Math.max(1, Math.round((new Date(E.place_until) - new Date(E.created_at)) / 86400000));
    }
  }
  drawMode();

  var err = ntfEl("div", "ntf-err"); card.appendChild(err);
  var sendLabel = E ? "Save changes" : "Send notification";
  var send = ntfEl("button", "ntf-btn primary", sendLabel); send.type = "button";
  var sendRow = ntfEl("div", "ntf-row"); sendRow.style.justifyContent = "flex-end"; sendRow.style.margin = "0";
  if (E) {
    var cancel = ntfEl("button", "ntf-btn", "Cancel"); cancel.type = "button";
    cancel.onclick = function () { NTF_UI.edit = null; NTF_UI.to = []; NTF_UI.audience = "team"; renderAdminPage(); };
    sendRow.appendChild(cancel);
  }
  sendRow.appendChild(send);
  card.appendChild(sendRow);
  send.onclick = async function () {
    err.textContent = "";
    var t = title.value.trim();
    if (!t) { err.textContent = "Add a title."; title.focus(); return; }
    if (NTF_UI.audience === "people" && !NTF_UI.to.length) { err.textContent = "Choose at least one person."; return; }
    var videoId = ntfYouTubeId(vid.value);
    if (vid.value.trim() && !videoId) { err.textContent = "The video link isn't a YouTube link. Fix it or clear it."; vid.focus(); return; }
    if (!mBell.r.checked && !mPop.r.checked && !mPin.r.checked) { err.textContent = "Pick at least one: bell, pop-up or banner."; return; }
    var rule = rTimes.r.checked ? "times" : rAck.r.checked ? "until_ack" : "once";
    var nDays = Math.max(1, Math.min(60, parseInt(days.value, 10) || 7));
    var n = Math.max(1, Math.min(20, parseInt(times.value, 10) || 1));
    var row = {
      team_slug: TEAM, title: t, body: body.value.trim(), video_id: videoId || null,
      audience: NTF_UI.audience, recipients: NTF_UI.audience === "people" ? NTF_UI.to.slice() : [],
      popup: mPop.r.checked, popup_rule: rule, popup_times: rule === "times" ? n : 1, popup_gap: gap.value,
      show_until: (mPop.r.checked && untilChk.checked && until.value) ? new Date(until.value).toISOString() : null,
      bell: mBell.r.checked,
      place: mPin.r.checked ? place.value : null,
      place_until: mPin.r.checked ? new Date((E ? new Date(E.created_at).getTime() : Date.now()) + nDays * 86400000).toISOString() : null,
      created_by: currentUser().id
    };
    if (E && row.place_until && new Date(row.place_until).getTime() <= Date.now()) { err.textContent = "With " + nDays + " day" + (nDays > 1 ? "s" : "") + " from when it was sent, the banner has already ended. Make the number bigger."; return; }
    if (row.show_until && new Date(row.show_until).getTime() <= Date.now()) { err.textContent = "The “stop after” time is already past."; return; }
    send.disabled = true; send.textContent = E ? "Saving…" : "Sending…";
    var res;
    if (E) {                                                  /* team, sender and time stay as they were */
      delete row.team_slug; delete row.created_by;
      row.stopped = false;                                    /* saving puts it live again, as set here */
      res = await SUPA.from("team_notifications").update(row).eq("id", E.id);
    } else res = await SUPA.from("team_notifications").insert(row);
    send.disabled = false; send.textContent = sendLabel;
    if (res.error) { err.textContent = (E ? "Couldn't save: " : "Couldn't send: ") + res.error.message; return; }
    if (E) {
      toast("✏️ Changes saved");
      NTF_UI.edit = null; NTF_UI.to = []; NTF_UI.audience = "team";
      await ntfRefresh(); renderAdminPage(); return;
    }
    var who = row.audience === "team" ? "the whole team" : row.recipients.length === 1 ? userDisplayName(members.find(function (u) { return u.id === row.recipients[0]; }) || { email: "1 person" }) : row.recipients.length + " people";
    toast("📣 Sent to " + who);
    NTF_UI.to = []; NTF_UI.audience = "team";
    await ntfRefresh();
    renderAdminPage();
  };
  wrap.appendChild(card);
  if (NTF_UI.focus) { NTF_UI.focus = false; setTimeout(function () { title.focus(); }, 60); }

  /* --- sent list --- */
  var listCard = ntfEl("div", "ntf-card");
  listCard.appendChild(ntfEl("h3", "", "Sent (last 90 days)"));
  var holder = ntfEl("div", "", "Loading…"); holder.className = "hint";
  listCard.appendChild(holder);
  wrap.appendChild(listCard);
  ntfDrawSent(holder);
}
async function ntfDrawSent(holder) {
  try { await ntfLoad(); } catch (e) { holder.textContent = "Couldn't load: " + e.message; return; }
  var ids = NTF.list.map(function (n) { return n.id; });
  var rec = {};
  if (ids.length) {
    var res = await SUPA.from("notification_receipts").select("*").in("notification_id", ids);
    (res.data || []).forEach(function (r) { (rec[r.notification_id] = rec[r.notification_id] || {})[r.user_id] = r; });
  }
  holder.className = ""; holder.innerHTML = "";
  var sent = NTF.list.filter(function (n) { return !n.drop_id; });   /* LMS drops are managed in Administration → LMS */
  if (!sent.length) { holder.className = "hint"; holder.textContent = "Nothing sent yet."; return; }
  var team = adminMembers();
  sent.forEach(function (n) {
    var targets = n.audience === "team" ? team.filter(function (u) { return u.id !== n.created_by; })
      : n.recipients.map(function (id) { return team.find(function (u) { return u.id === id; }) || { id: id, email: "(left the team)", name: "(left the team)" }; });
    var rs = rec[n.id] || {};
    var read = targets.filter(function (u) { return rs[u.id] && rs[u.id].read_at; }).length;
    var acked = targets.filter(function (u) { return rs[u.id] && rs[u.id].acked_at; }).length;
    var popLive = n.popup && !n.stopped && !(n.show_until && new Date(n.show_until).getTime() < Date.now());
    var banLive = ntfBannerLive(n), live = popLive || banLive;

    var box = ntfEl("div", "ntf-sent"), top = ntfEl("div", "ns-top"), info = ntfEl("div");
    info.appendChild(ntfEl("div", "ntf-t", n.title));
    if (n.body) info.appendChild(ntfEl("div", "ntf-b", n.body));
    if (n.video_id) { var th = ntfThumb(n.video_id); th.style.cursor = "pointer"; th.title = "Preview"; th.onclick = function () { ntfShowBox(n, false); }; info.appendChild(th); }
    info.appendChild(ntfEl("div", "ntf-m", (ntfSender(n) ? "By " + ntfSender(n) + " · " : "") + ntfWhen(n.created_at) + " · to " +
      (n.audience === "team" ? "the whole team" : targets.map(function (u) { return userDisplayName(u); }).join(", "))));
    var tags = ntfEl("div");
    if (n.bell !== false) tags.appendChild(ntfEl("span", "ntf-tag", "🔔 Bell"));
    if (n.popup) tags.appendChild(ntfEl("span", "ntf-tag" + (popLive ? " live" : " off"), ntfRuleText(n) + (!popLive ? (n.stopped ? " · stopped" : " · ended") : "")));
    if (n.place) {
      var bt = ntfEl("span", "ntf-tag" + (banLive ? " live" : " off"), "📌 Banner on " + ntfPlaceLabel(n.place) + (banLive ? " · till " + ntfUntilText(n.place_until) : n.stopped ? " · removed" : " · ended"));
      tags.appendChild(bt);
      var hid = targets.filter(function (u) { return rs[u.id] && rs[u.id].hidden_at; }).length;
      if (hid) tags.appendChild(ntfEl("span", "ntf-tag", "🙈 Hidden by " + hid));
    }
    tags.appendChild(ntfEl("span", "ntf-tag", "👀 Read " + read + "/" + targets.length));
    if (n.popup && n.popup_rule === "until_ack") tags.appendChild(ntfEl("span", "ntf-tag", "✓ Got it " + acked + "/" + targets.length));
    info.appendChild(tags);
    var acts = ntfEl("div", "ns-acts");
    var whoBtn = ntfEl("button", "", "Who saw it"); whoBtn.type = "button";
    var edit = ntfEl("button", "", "✏️ Edit"); edit.type = "button"; edit.title = "Change the text, video, who it's for, or how it shows";
    edit.onclick = function () {
      NTF_UI.edit = n; NTF_UI.audience = n.audience; NTF_UI.to = (n.recipients || []).slice(); NTF_UI.focus = true;
      renderAdminPage();
      var m = document.getElementById("admin-main"); (m || document.documentElement).scrollIntoView({ block: "start", behavior: "smooth" });
    };
    acts.append(edit, whoBtn);
    if (live) {
      var stop = ntfEl("button", "", banLive && popLive ? "Stop pop-up & banner" : banLive ? "Remove banner" : "Stop pop-up"); stop.type = "button"; stop.title = "Stop it for everyone now (it stays in the bell)";
      stop.onclick = async function () {
        stop.disabled = true;
        var r = await SUPA.from("team_notifications").update({ stopped: true }).eq("id", n.id);
        if (r.error) { toast("Couldn't stop: " + r.error.message); stop.disabled = false; return; }
        toast(banLive ? "Removed" : "Pop-up stopped"); await ntfRefresh(); ntfDrawSent(holder);
      };
      acts.appendChild(stop);
    }
    var del = ntfEl("button", "", "Delete"); del.type = "button"; del.title = "Delete it for everyone";
    del.onclick = async function () {
      if (!confirm("Delete “" + n.title + "”? It disappears from everyone's bell.")) return;
      var r = await SUPA.from("team_notifications").delete().eq("id", n.id);
      if (r.error) { toast("Couldn't delete: " + r.error.message); return; }
      toast("Deleted"); await ntfRefresh(); ntfDrawSent(holder);
    };
    acts.appendChild(del);
    top.append(info, acts); box.appendChild(top);

    var who = ntfEl("div", "ntf-who"), tb = document.createElement("table");
    targets.forEach(function (u) {
      var r = rs[u.id] || {}, tr = document.createElement("tr");
      var st = r.hidden_at ? "🙈 Hid the banner " + ntfWhen(r.hidden_at) : r.acked_at ? "✓ Got it " + ntfWhen(r.acked_at) : r.read_at ? "👀 Read " + ntfWhen(r.read_at) : r.shown_count ? "Popped up, not read yet" : "Not seen yet";
      [userDisplayName(u), st, n.popup ? "Popped up " + (r.shown_count || 0) + "×" : ""].forEach(function (x) { tr.appendChild(ntfEl("td", "", x)); });
      tb.appendChild(tr);
    });
    who.appendChild(tb);
    whoBtn.onclick = function () { who.classList.toggle("show"); };
    box.appendChild(who);
    holder.appendChild(box);
  });
}
