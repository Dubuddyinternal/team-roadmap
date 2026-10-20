/* ================= LMS: little learning "drops" =================
   Administration → 🎓 LMS (permission manage_learning, "Run LMS"; Owners
   always). The planner makes a DROP — a video, an article, a quick poll or a
   mini quiz, each with a friendly intro line and optional questions — and
   decides who gets it, when it goes out (now or scheduled) and where it
   shows: a banner on the page they work on, a pop-up, and/or the 🔔 bell.
   Teammates answer right inside the card and then see their score or what
   the team picked, so it feels like a game, not homework. The planner sees
   every answer here.
   Data (supabase/stage12a_lms.sql):
     learning_drops     the content + questions
     team_notifications one row per delivery (drop_id, starts_at)
     learning_answers   one set of answers per person, written only through
                        submit_learning() (which scores quiz questions);
                        learning_results() gives the team's picks.
   Uses notifications.js for delivery (NTF, ntfShowBox, banners) and
   index.html's globals (SUPA, TEAM, currentUser, hasPerm, adminMembers,
   userDisplayName, toast, renderAdminPage).                                  */
var LMS = { drops: {}, mine: {}, results: {}, ui: { edit: null, open: {} } };

var LMS_KINDS = {
  video:   { ico: "🎬", label: "Video",      kicker: "🎬 Worth a watch",  verb: "Watch" },
  article: { ico: "📰", label: "Article",    kicker: "📰 A good read",    verb: "Read" },
  poll:    { ico: "🗳", label: "Quick poll", kicker: "🗳 Quick one",       verb: "Vote" },
  quiz:    { ico: "🧠", label: "Mini quiz",  kicker: "🧠 Mini quiz",       verb: "Play" }
};
var LMS_INTROS = {
  video: ["Found a little gem 🎬 — worth it, promise.", "Got 5 minutes and a chai? This one's good ☕", "Watched this and thought of us 👀",
          "This changed how I think about our videos. Curious what you think 🤔"],
  article: ["Stumbled on this and thought of you 👀", "A 4-minute read that's actually worth it 📖", "Bookmarked this one for the team ✨",
            "Read this with your morning chai ☕ — then tell me what you think"],
  poll: ["Quick one — no right answer, just curious 🤔", "Settle a debate for us 👇", "Gut feeling, 5 seconds, go ⚡",
         "Team vote! Let's see where everyone lands 🗳"],
  quiz: ["Think you know this? 30 seconds ⚡", "Pop quiz — no pressure, just bragging rights 🏆", "Bet you'll get these 😏",
         "Tiny challenge for your coffee break ☕"]
};

/* ---------- styles ---------- */
(function () {
  var css = ""
  + ".lms-k{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--indigo);font-weight:600}"
  + ".lms-h{font-size:21px;font-weight:700;margin:6px 0 6px;line-height:1.25}"
  + ".lms-intro{font-size:15px;line-height:1.55;color:#3F3833;white-space:pre-wrap;word-wrap:break-word}"
  + ".lms-art{display:flex;gap:12px;align-items:center;margin-top:14px;padding:14px 16px;border:1px solid var(--line-strong);border-radius:12px;background:var(--paper);text-decoration:none;color:var(--ink)}"
  + ".lms-art:hover{border-color:var(--indigo);background:var(--indigo-soft)}"
  + ".lms-art .la-i{font-size:26px;flex:none}"
  + ".lms-art .la-d{font-size:12.5px;color:var(--muted)}"
  + ".lms-art .la-t{font-weight:600;font-size:14.5px;word-break:break-word}"
  + ".lms-art .la-go{margin-left:auto;font-weight:700;color:var(--indigo);white-space:nowrap}"
  + ".lms-note{margin-top:10px;font-size:14px;color:#3F3833;white-space:pre-wrap;padding:10px 12px;border-left:3px solid var(--indigo-soft)}"
  + ".lms-qs{margin-top:18px;padding-top:16px;border-top:1px dashed var(--line-strong)}"
  + ".lms-qh{font-weight:700;font-size:15px;margin-bottom:10px}"
  + ".lms-q{margin-bottom:14px}"
  + ".lms-qt{font-weight:600;font-size:14.5px;margin-bottom:8px}"
  + ".lms-opts{display:flex;flex-wrap:wrap;gap:8px}"
  + ".lms-opt{border:1.5px solid var(--line-strong);border-radius:12px;padding:9px 14px;font-size:14px;background:var(--card);transition:.12s;text-align:left}"
  + ".lms-opt:hover{border-color:var(--indigo)}"
  + ".lms-opt.on{border-color:var(--indigo);background:var(--indigo);color:#fff;font-weight:600}"
  + ".lms-q textarea{width:100%;min-height:70px;border:1px solid var(--line-strong);border-radius:10px;padding:10px 12px;font-size:14px;background:var(--paper);resize:vertical}"
  + ".lms-send{margin-top:4px}"
  + ".lms-done{margin-top:18px;padding:16px;border-radius:14px;background:linear-gradient(120deg,#FFF6EF,#FDE6D6)}"
  + ".lms-done .ld-big{font-size:20px;font-weight:700}"
  + ".lms-done .ld-sub{font-size:13.5px;color:#5C4E44;margin-top:2px}"
  + ".lms-res{margin-top:12px}"
  + ".lms-res .lr-q{font-weight:600;font-size:14px;margin:12px 0 6px}"
  + ".lms-bar{position:relative;display:flex;justify-content:space-between;gap:10px;padding:7px 10px;border-radius:9px;background:rgba(255,255,255,.7);margin-bottom:5px;font-size:13.5px;overflow:hidden}"
  + ".lms-bar .lb-f{position:absolute;left:0;top:0;bottom:0;background:rgba(232,98,43,.18);border-radius:9px}"
  + ".lms-bar.me .lb-f{background:rgba(232,98,43,.38)}"
  + ".lms-bar span{position:relative}"
  + ".lms-bar .lb-n{font-weight:700;white-space:nowrap}"
  + ".lms-mytext{font-size:13.5px;color:#3F3833;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.7);white-space:pre-wrap}"
  + ".lms-prev{margin-top:14px;font-size:12.5px;color:var(--muted);padding:8px 10px;border:1px dashed var(--line-strong);border-radius:9px}"
  /* planner */
  + ".lms-kinds{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}"
  + ".lms-kind{border:1.5px solid var(--line-strong);border-radius:14px;padding:12px;text-align:left;background:var(--card)}"
  + ".lms-kind .lk-i{font-size:24px}"
  + ".lms-kind .lk-t{font-weight:700;font-size:14px;margin-top:4px}"
  + ".lms-kind .lk-d{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.35}"
  + ".lms-kind.on{border-color:var(--indigo);background:var(--indigo-soft)}"
  + ".lms-introrow{display:flex;gap:8px;align-items:flex-start}"
  + ".lms-introrow textarea{flex:1;min-height:56px!important}"
  + ".lms-dice{flex:none;border:1px solid var(--line-strong);border-radius:10px;padding:9px 12px;font-size:13px;font-weight:600;background:var(--card)}"
  + ".lms-qb{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px;background:var(--paper)}"
  + ".lms-qb .qb-top{display:flex;gap:8px;align-items:center}"
  + ".lms-qb .qb-top input{flex:1}"
  + ".lms-qb .qb-x{border:1px solid var(--line-strong);border-radius:8px;padding:6px 10px;font-size:13px;background:var(--card)}"
  + ".lms-qb .qb-opt{display:flex;gap:8px;align-items:center;margin-top:7px}"
  + ".lms-qb .qb-opt input[type=text]{flex:1;padding:8px 10px!important}"
  + ".lms-qb .qb-ok{font-size:12px;color:var(--muted);display:flex;gap:4px;align-items:center;white-space:nowrap;cursor:pointer}"
  + ".lms-qb .qb-ok.on{color:#1F7A4D;font-weight:700}"
  + ".lms-qb .qb-add{margin-top:8px;font-size:13px;font-weight:600;color:var(--indigo)}"
  + ".lms-addq{display:flex;gap:8px;flex-wrap:wrap}"
  + ".lms-addq button{border:1px dashed var(--line-strong);border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600;background:var(--card)}"
  + ".lms-drop{border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:12px;background:var(--card)}"
  + ".lms-drop .ldr-top{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}"
  + ".lms-drop .ldr-i{font-size:26px;flex:none;width:44px;height:44px;border-radius:12px;background:var(--indigo-soft);display:flex;align-items:center;justify-content:center}"
  + ".lms-drop .ldr-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}"
  + ".lms-drop .ldr-acts button{font-size:12.5px;font-weight:600;border:1px solid var(--line-strong);border-radius:8px;padding:5px 10px;background:var(--card)}"
  + ".lms-pane{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}"
  + ".lms-pane table{width:100%;border-collapse:collapse;font-size:13px}"
  + ".lms-pane td{padding:6px;border-top:1px solid var(--line);vertical-align:top}"
  + ".lms-who{font-size:12px;color:var(--muted);margin:-2px 0 6px 10px}"
  + ".lms-empty{padding:26px;text-align:center;color:var(--muted);border:1px dashed var(--line-strong);border-radius:14px}"
  + "@media (max-width:760px){.lms-kinds{grid-template-columns:repeat(2,minmax(0,1fr))}.lms-drop .ldr-top{flex-direction:column}}";
  var st = document.createElement("style"); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();

function lmsEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function lmsQid() { return "q" + Math.random().toString(36).slice(2, 8); }
function lmsDomain(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return ""; } }
function lmsSafeUrl(u) { u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : ""; }

/* ---------- data ---------- */
/* after notifications load: fetch the drops they carry, and my answers */
async function lmsAfterLoad() {
  if (!SUPA || !currentUser()) return;
  var ids = [];
  NTF.list.forEach(function (n) { if (n.drop_id && ids.indexOf(n.drop_id) < 0) ids.push(n.drop_id); });
  if (!ids.length) return;
  var res = await Promise.all([
    SUPA.from("learning_drops").select("*").in("id", ids),
    SUPA.from("learning_answers").select("*").eq("user_id", currentUser().id).in("drop_id", ids)
  ]);
  (res[0].data || []).forEach(function (d) { LMS.drops[d.id] = d; });
  (res[1].data || []).forEach(function (a) { LMS.mine[a.drop_id] = a; });
}
async function lmsResults(id) {
  var r = await SUPA.rpc("learning_results", { d_id: id });
  if (!r.error) LMS.results[id] = r.data || {};
  return LMS.results[id] || null;
}

/* ---------- what a teammate sees (inside the pop-up / opened from bell or banner) ---------- */
function lmsRenderDrop(box, d, opt) {
  opt = opt || {};
  var K = LMS_KINDS[d.kind] || LMS_KINDS.video;
  box.appendChild(lmsEl("div", "lms-k", K.kicker));
  box.appendChild(lmsEl("div", "lms-h", d.title));
  if (d.intro) box.appendChild(lmsEl("div", "lms-intro", d.intro));
  if (d.video_id) box.appendChild(ntfVideo(d.video_id));
  var url = lmsSafeUrl(d.url);
  if (url) {
    var a = lmsEl("a", "lms-art"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    var mid = lmsEl("div"); mid.append(lmsEl("div", "la-d", lmsDomain(url) || "link"), lmsEl("div", "la-t", d.kind === "article" ? "Open the article" : "Open the link"));
    a.append(lmsEl("span", "la-i", "📰"), mid, lmsEl("span", "la-go", "Read it ↗"));
    box.appendChild(a);
  }
  if (d.note) box.appendChild(lmsEl("div", "lms-note", d.note));
  var qs = d.questions || [];
  if (!qs.length) return;
  var wrap = lmsEl("div", "lms-qs"); box.appendChild(wrap);
  if (opt.preview) {
    lmsDrawForm(wrap, d, true);
    wrap.appendChild(lmsEl("div", "lms-prev", "👀 Preview — this is what your team sees. You can't answer your own drop."));
    return;
  }
  if (LMS.mine[d.id]) lmsDrawDone(wrap, d, LMS.mine[d.id], opt.n);
  else lmsDrawForm(wrap, d, false, opt.n);
}
function lmsDrawForm(wrap, d, preview, n) {
  wrap.innerHTML = "";
  var qs = d.questions || [], picks = {};
  var lead = d.kind === "poll" ? "Your pick 👇" : d.kind === "quiz" ? "Let's see what you've got 👇"
           : "Got a minute? " + (qs.length === 1 ? "One quick question" : qs.length + " quick questions") + " 👇";
  wrap.appendChild(lmsEl("div", "lms-qh", lead));
  var send = lmsEl("button", "ntf-btn primary lms-send", d.kind === "quiz" ? "Check my answers ⚡" : "Send ✨");
  send.type = "button";
  function ready() { return qs.every(function (q) { return q.type !== "choice" || picks[q.id] != null; }); }
  qs.forEach(function (q) {
    var qd = lmsEl("div", "lms-q");
    qd.appendChild(lmsEl("div", "lms-qt", q.q));
    if (q.type === "choice") {
      var row = lmsEl("div", "lms-opts");
      (q.options || []).forEach(function (o, i) {
        var b = lmsEl("button", "lms-opt", o); b.type = "button";
        b.onclick = function () {
          picks[q.id] = i;
          row.querySelectorAll(".lms-opt").forEach(function (x, j) { x.classList.toggle("on", j === i); });
          send.disabled = preview || !ready();
        };
        row.appendChild(b);
      });
      qd.appendChild(row);
    } else {
      var t = document.createElement("textarea"); t.placeholder = "Type your thoughts… (optional)"; t.maxLength = 2000;
      t.oninput = function () { picks[q.id] = t.value; };
      if (preview) t.disabled = true;
      qd.appendChild(t);
    }
    wrap.appendChild(qd);
  });
  send.disabled = preview || !ready();
  send.onclick = async function () {
    var ans = {};
    qs.forEach(function (q) {
      if (q.type === "choice" && picks[q.id] != null) ans[q.id] = picks[q.id];
      if (q.type !== "choice" && String(picks[q.id] || "").trim()) ans[q.id] = String(picks[q.id]).trim();
    });
    send.disabled = true; send.textContent = "Sending…";
    var r = await SUPA.rpc("submit_learning", { d_id: d.id, p_answers: ans });
    if (r.error) { send.disabled = false; send.textContent = "Try again"; toast(r.error.message); return; }
    var mine = { drop_id: d.id, answers: ans, score: r.data && r.data.total ? r.data.score : null, total: r.data && r.data.total ? r.data.total : null };
    LMS.mine[d.id] = mine;
    if (n) { ntfMinSet(n.id, true); ntfMark(n, "ack").then(function () { ntfRenderBell(); ntfRefreshSlots(); }); }   /* done: its banner shrinks to a strip */
    lmsDrawDone(wrap, d, mine, n);
  };
  if (!preview) wrap.appendChild(send);
}
function lmsCheer(score, total) {
  if (!total) return "🙌 Thanks — that's in!";
  var r = score / total;
  if (r === 1) return "🏆 Perfect! " + score + "/" + total;
  if (r >= 0.6) return "🔥 " + score + "/" + total + " — so close!";
  if (r > 0) return "🌱 " + score + "/" + total + " — and now you know the rest!";
  return "😅 0/" + total + " — the answers are below, no one's watching 😉";
}
async function lmsDrawDone(wrap, d, mine, n) {
  wrap.innerHTML = "";
  var done = lmsEl("div", "lms-done");
  done.appendChild(lmsEl("div", "ld-big", lmsCheer(mine.score || 0, mine.total || 0)));
  var hasChoice = (d.questions || []).some(function (q) { return q.type === "choice"; });
  done.appendChild(lmsEl("div", "ld-sub", hasChoice ? "Here's how the team answered so far:" : "Your answer is saved. Thanks for taking a minute!"));
  var res = lmsEl("div", "lms-res", hasChoice ? "Loading…" : null);
  done.appendChild(res);
  wrap.appendChild(done);
  var counts = hasChoice ? await lmsResults(d.id) : {};
  res.innerHTML = "";
  (d.questions || []).forEach(function (q) {
    res.appendChild(lmsEl("div", "lr-q", q.q));
    var mineA = (mine.answers || {})[q.id];
    if (q.type === "choice") {
      var c = (counts && counts[q.id]) || [], tot = c.reduce(function (a, b) { return a + b; }, 0) || 1;
      (q.options || []).forEach(function (o, i) {
        var bar = lmsEl("div", "lms-bar" + (mineA === i ? " me" : ""));
        var f = lmsEl("span", "lb-f"); f.style.width = Math.round(100 * (c[i] || 0) / tot) + "%";
        var right = typeof q.correct === "number" && q.correct === i;
        bar.append(f, lmsEl("span", "", (right ? "✅ " : "") + o + (mineA === i ? "  ← you" : "")), lmsEl("span", "lb-n", Math.round(100 * (c[i] || 0) / tot) + "%"));
        res.appendChild(bar);
      });
    } else {
      res.appendChild(lmsEl("div", "lms-mytext", mineA ? "✍️ " + mineA : "— you skipped this one"));
    }
  });
}

/* ---------- Administration → 🎓 LMS ---------- */
function lmsBlankDraft(kind) {
  var q = function (type, opts) { return { id: lmsQid(), type: type, q: "", options: opts || [], correct: null }; };
  var d = { kind: kind, title: "", intro: LMS_INTROS[kind][0], video: "", url: "", note: "", questions: [],
            audience: "team", to: [], when: "now", at: "", bell: true, banner: true, popup: false, place: "", days: 7 };
  if (kind === "poll") d.questions = [q("choice", ["", "", ""])];
  if (kind === "quiz") { d.questions = [q("choice", ["", ""])]; d.questions[0].correct = 0; }
  if (kind === "video" || kind === "article") d.questions = [q("choice", ["", ""]), q("text")];
  return d;
}
function lmsDraftFrom(drop, n) {
  var d = lmsBlankDraft(drop.kind);
  d.id = drop.id; d.nid = n ? n.id : null; d.sentAt = n ? n.starts_at : null;
  d.title = drop.title; d.intro = drop.intro || ""; d.video = drop.video_id ? "https://youtu.be/" + drop.video_id : "";
  d.url = drop.url || ""; d.note = drop.note || "";
  d.questions = JSON.parse(JSON.stringify(drop.questions || []));
  if (n) {
    d.audience = n.audience; d.to = (n.recipients || []).slice();
    d.bell = n.bell !== false; d.popup = !!n.popup; d.banner = !!n.place; d.place = n.place || "";
    if (n.place_until) d.days = Math.max(1, Math.round((new Date(n.place_until) - new Date(n.starts_at || n.created_at)) / 86400000));
    if (new Date(n.starts_at).getTime() > Date.now()) {
      var s = new Date(n.starts_at); s.setMinutes(s.getMinutes() - s.getTimezoneOffset());
      d.when = "later"; d.at = s.toISOString().slice(0, 16);
    }
  }
  return d;
}
function renderAdminLms(wrap) {
  var head = lmsEl("div", "admin-userhead"), left = lmsEl("div");
  var h2 = lmsEl("h2", "", "🎓 LMS"); h2.style.margin = "0";
  var sub = lmsEl("div", "hint", "Plan little learning drops — a video, an article, a quick poll or a mini quiz. They land where the team already works, with a friendly line, so it feels like sharing, not homework. Answers and scores show up here.");
  sub.style.marginTop = "4px";
  left.append(h2, sub); head.appendChild(left);
  if (!LMS.ui.edit) {
    var nb = lmsEl("button", "btn save admin-invite-btn", "＋ New drop");
    nb.onclick = function () { LMS.ui.edit = lmsBlankDraft("video"); renderAdminPage(); };
    head.appendChild(nb);
  }
  wrap.appendChild(head);
  if (LMS.ui.edit) lmsComposer(wrap, LMS.ui.edit);
  if (typeof lmsSubsAdminCard === "function") lmsSubsAdminCard(wrap);   /* sent from the spaces (index.html) */
  var list = lmsEl("div", "ntf-card");
  list.appendChild(lmsEl("h3", "", "Your drops"));
  var holder = lmsEl("div", "hint", "Loading…"); list.appendChild(holder);
  wrap.appendChild(list);
  lmsDrawList(holder);
}

function lmsComposer(wrap, D) {
  var card = lmsEl("div", "ntf-card");
  card.appendChild(lmsEl("h3", "", D.id ? "✏️ Edit drop" : "✨ New drop"));
  var members = adminMembers().filter(function (u) { return u.id !== currentUser().id; })
    .sort(function (a, b) { return userDisplayName(a).localeCompare(userDisplayName(b)); });
  function lab(t) { card.appendChild(lmsEl("label", "ntf-lab", t)); }
  function redraw() { renderAdminPage(); }

  /* kind */
  var kinds = lmsEl("div", "lms-kinds");
  [["video", "A video worth watching, plus a question or two"], ["article", "An article you liked, plus a few questions"],
   ["poll", "One quick question, no right answer"], ["quiz", "A few questions with right answers"]].forEach(function (k) {
    var K = LMS_KINDS[k[0]], b = lmsEl("button", "lms-kind" + (D.kind === k[0] ? " on" : "")); b.type = "button";
    b.append(lmsEl("div", "lk-i", K.ico), lmsEl("div", "lk-t", K.label), lmsEl("div", "lk-d", k[1]));
    b.onclick = function () {
      if (D.kind === k[0]) return;
      var fresh = lmsBlankDraft(k[0]);
      var untouched = !D.questions.some(function (q) { return q.q || (q.options || []).some(Boolean); });
      if (LMS_INTROS[D.kind].indexOf(D.intro) >= 0 || !D.intro) D.intro = fresh.intro;
      if (untouched) D.questions = fresh.questions;
      D.kind = k[0]; redraw();
    };
    kinds.appendChild(b);
  });
  if (D.id) kinds.style.display = "none";
  card.appendChild(kinds);

  lab("Headline");
  var title = document.createElement("input"); title.type = "text"; title.maxLength = 140; title.value = D.title;
  title.placeholder = D.kind === "poll" ? "e.g. Camera, editing or knowledge — what matters most?" : D.kind === "quiz" ? "e.g. How well do you know our audience?" : D.kind === "article" ? "e.g. Why the first 3 seconds decide everything" : "e.g. The hook trick that doubled their views";
  title.oninput = function () { D.title = title.value; };
  card.appendChild(title);

  lab("The friendly line they see first");
  var ir = lmsEl("div", "lms-introrow"), intro = document.createElement("textarea");
  intro.maxLength = 1000; intro.value = D.intro; intro.oninput = function () { D.intro = intro.value; };
  var dice = lmsEl("button", "lms-dice", "🎲 Another"); dice.type = "button"; dice.title = "Try another friendly line";
  dice.onclick = function () { var L = LMS_INTROS[D.kind], i = (L.indexOf(intro.value) + 1) % L.length; intro.value = D.intro = L[i]; };
  ir.append(intro, dice); card.appendChild(ir);

  /* attachments */
  var showVid = D.kind === "video" || D.video, showArt = D.kind === "article" || D.url;
  lab("YouTube video" + (D.kind === "video" ? "" : " (optional)"));
  var vid = document.createElement("input"); vid.type = "text"; vid.value = D.video; vid.placeholder = "Paste a YouTube link";
  var vprev = lmsEl("div", "ntf-vprev");
  vid.oninput = function () {
    D.video = vid.value; vprev.innerHTML = "";
    if (!vid.value.trim()) return;
    var id = ntfYouTubeId(vid.value);
    if (id) vprev.append(ntfThumb(id), lmsEl("span", "", "✓ It plays right inside the card."));
    else vprev.appendChild(lmsEl("span", "", "⚠️ That doesn't look like a YouTube link."));
  };
  vid.oninput();
  card.append(vid, vprev);
  if (!showVid) { vid.previousSibling.style.display = "none"; vid.style.display = "none"; }
  lab("Article link" + (D.kind === "article" ? "" : " (optional)"));
  var url = document.createElement("input"); url.type = "text"; url.value = D.url; url.placeholder = "https://…";
  url.oninput = function () { D.url = url.value; };
  card.appendChild(url);
  lab("Your note (optional)");
  var note = document.createElement("textarea"); note.maxLength = 4000; note.value = D.note;
  note.placeholder = D.kind === "article" ? "e.g. Read the bit about thumbnails — that's exactly our problem." : "Anything you want to add";
  note.oninput = function () { D.note = note.value; };
  card.appendChild(note);
  if (!showArt) {
    var urlLab = url.previousSibling, noteLab = note.previousSibling;
    [urlLab, url, noteLab, note].forEach(function (e) { e.style.display = "none"; });
    if (!showVid) {
      var more = lmsEl("button", "qb-add", "📎 Add a video or article link"); more.type = "button";
      more.style.cssText = "margin:10px 0 0;font-size:13px;font-weight:600;color:var(--indigo)";
      more.onclick = function () { [vid.previousSibling, vid, urlLab, url, noteLab, note].forEach(function (e) { e.style.display = ""; }); more.remove(); };
      card.appendChild(more);
    }
  }

  /* questions */
  lab(D.kind === "poll" ? "Your question" : "Questions at the end" + (D.kind === "quiz" ? "" : " (optional)"));
  var qwrap = lmsEl("div"); card.appendChild(qwrap);
  function drawQs() {
    qwrap.innerHTML = "";
    D.questions.forEach(function (q, qi) {
      var qb = lmsEl("div", "lms-qb"), top = lmsEl("div", "qb-top");
      var qt = document.createElement("input"); qt.type = "text"; qt.maxLength = 300; qt.value = q.q;
      qt.placeholder = q.type === "choice" ? (D.kind === "poll" ? "e.g. What makes a video great?" : "Question " + (qi + 1)) : "e.g. What's one thing you'll try this week?";
      qt.oninput = function () { q.q = qt.value; };
      var x = lmsEl("button", "qb-x", "Remove"); x.type = "button";
      x.onclick = function () { D.questions.splice(qi, 1); drawQs(); };
      top.append(lmsEl("span", "", q.type === "choice" ? "🔘" : "✍️"), qt, x);
      qb.appendChild(top);
      if (q.type === "choice") {
        q.options.forEach(function (o, oi) {
          var row = lmsEl("div", "qb-opt"), oinp = document.createElement("input"); oinp.type = "text"; oinp.maxLength = 140; oinp.value = o;
          oinp.placeholder = D.kind === "poll" && qi === 0 ? ["e.g. A good camera", "e.g. Great editing", "e.g. Real knowledge"][oi] || "Another choice" : "Choice " + (oi + 1);
          oinp.oninput = function () { q.options[oi] = oinp.value; };
          row.appendChild(oinp);
          if (D.kind !== "poll") {
            var ok = lmsEl("label", "qb-ok" + (q.correct === oi ? " on" : "")), r = document.createElement("input");
            r.type = "radio"; r.name = "ok-" + q.id; r.checked = q.correct === oi;
            r.onchange = function () { q.correct = oi; drawQs(); };
            ok.append(r, document.createTextNode(q.correct === oi ? "right answer" : "right?"));
            row.appendChild(ok);
          }
          if (q.options.length > 2) {
            var ox = lmsEl("button", "qb-x", "×"); ox.type = "button"; ox.title = "Remove this choice";
            ox.onclick = function () { q.options.splice(oi, 1); if (q.correct === oi) q.correct = null; else if (q.correct > oi) q.correct--; drawQs(); };
            row.appendChild(ox);
          }
          qb.appendChild(row);
        });
        var foot = lmsEl("div", "ntf-row"); foot.style.margin = "8px 0 0";
        if (q.options.length < 6) {
          var ao = lmsEl("button", "qb-add", "+ Add a choice"); ao.type = "button";
          ao.onclick = function () { q.options.push(""); drawQs(); };
          foot.appendChild(ao);
        }
        if (D.kind !== "poll" && q.correct != null) {
          var nr = lmsEl("button", "qb-add", "No right answer (just opinion)"); nr.type = "button"; nr.style.color = "var(--muted)";
          nr.onclick = function () { q.correct = null; drawQs(); };
          foot.appendChild(nr);
        }
        qb.appendChild(foot);
      }
      qwrap.appendChild(qb);
    });
    if (D.questions.length < 10) {
      var add = lmsEl("div", "lms-addq");
      var a1 = lmsEl("button", "", "🔘 + Pick-one question"); a1.type = "button";
      a1.onclick = function () { D.questions.push({ id: lmsQid(), type: "choice", q: "", options: ["", ""], correct: D.kind === "quiz" ? 0 : null }); drawQs(); };
      var a2 = lmsEl("button", "", "✍️ + Written answer"); a2.type = "button";
      a2.onclick = function () { D.questions.push({ id: lmsQid(), type: "text", q: "", options: [], correct: null }); drawQs(); };
      add.append(a1, a2); qwrap.appendChild(add);
    }
  }
  drawQs();
  if (D.id) { var w = lmsEl("div", "hint", "If people already answered, changing choices can mix up their results — fix typos freely."); w.style.marginTop = "6px"; card.appendChild(w); }

  /* who */
  lab("Who gets it");
  var seg = lmsEl("div", "ntf-seg"), bTeam = lmsEl("button", "", "Whole team"), bPeople = lmsEl("button", "", "Choose people");
  bTeam.type = bPeople.type = "button"; seg.append(bTeam, bPeople);
  var segRow = lmsEl("div", "ntf-row"); segRow.appendChild(seg); card.appendChild(segRow);
  var people = lmsEl("div", "ntf-people"); card.appendChild(people);
  function drawPeople() {
    bTeam.className = D.audience === "team" ? "on" : ""; bPeople.className = D.audience === "people" ? "on" : "";
    people.style.display = D.audience === "people" ? "" : "none"; people.innerHTML = "";
    members.forEach(function (u) {
      var on = D.to.indexOf(u.id) >= 0, c = lmsEl("button", "ntf-chip" + (on ? " on" : ""), (on ? "✓ " : "") + userDisplayName(u));
      c.type = "button"; c.onclick = function () { if (on) D.to = D.to.filter(function (x) { return x !== u.id; }); else D.to.push(u.id); drawPeople(); };
      people.appendChild(c);
    });
  }
  bTeam.onclick = function () { D.audience = "team"; drawPeople(); };
  bPeople.onclick = function () { D.audience = "people"; drawPeople(); };
  drawPeople();

  /* when */
  lab("When does it go out?");
  var wseg = lmsEl("div", "ntf-seg"), wNow = lmsEl("button", "", "Right now"), wLater = lmsEl("button", "", "⏰ Schedule it");
  wNow.type = wLater.type = "button"; wseg.append(wNow, wLater);
  var at = document.createElement("input"); at.type = "datetime-local"; at.value = D.at; at.style.marginLeft = "10px";
  at.oninput = function () { D.at = at.value; };
  var wRow = lmsEl("div", "ntf-row"); wRow.append(wseg, at); card.appendChild(wRow);
  function drawWhen() {
    wNow.className = D.when === "now" ? "on" : ""; wLater.className = D.when === "later" ? "on" : "";
    at.style.display = D.when === "later" ? "" : "none";
    if (D.when === "later" && !at.value) { var t = new Date(Date.now() + 86400000); t.setHours(10, 0, 0, 0); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); at.value = D.at = t.toISOString().slice(0, 16); }
    sendBtn.textContent = D.id ? "Save changes" : D.when === "later" ? "⏰ Schedule it" : "🚀 Send it";
  }
  wNow.onclick = function () { D.when = "now"; drawWhen(); };
  wLater.onclick = function () { D.when = "later"; drawWhen(); };

  /* where */
  lab("Where do they see it?");
  function chk(label, key) {
    var l = lmsEl("label", "ntf-opt"), c = document.createElement("input"); c.type = "checkbox"; c.checked = !!D[key];
    c.onchange = function () { D[key] = c.checked; pinBox.style.display = D.banner ? "" : "none"; };
    l.append(c, document.createTextNode(label)); card.appendChild(l); return c;
  }
  chk("📌 As a banner on the page they work on (feels like a poster on the wall)", "banner");
  var pinBox = lmsEl("div", "ntf-sub"), places = ntfPlaces(), place = document.createElement("select");
  places.forEach(function (pl) { var op = document.createElement("option"); op.value = pl[0]; op.textContent = pl[1]; place.appendChild(op); });
  if (D.place && !places.some(function (pl) { return pl[0] === D.place; })) { var op = document.createElement("option"); op.value = D.place; op.textContent = ntfPlaceLabel(D.place); place.appendChild(op); }
  if (!D.place) { var idea = places.find(function (pl) { return /:ideation$/.test(pl[0]); }); D.place = idea ? idea[0] : (places[0] || [""])[0]; }
  place.value = D.place; place.onchange = function () { D.place = place.value; };
  var pr = lmsEl("label", "ntf-opt"); pr.append(document.createTextNode("Page: "), place);
  var days = document.createElement("input"); days.type = "number"; days.min = 1; days.max = 60; days.value = D.days; days.style.width = "70px";
  days.oninput = function () { D.days = days.value; };
  var dr = lmsEl("label", "ntf-opt"); dr.append(document.createTextNode("Keep it up for "), days, document.createTextNode(" days"));
  pinBox.append(pr, dr); card.appendChild(pinBox);
  pinBox.style.display = D.banner ? "" : "none";
  if (!places.length) { D.banner = false; pinBox.style.display = "none"; }
  chk("💬 Pop it up once when they open the app", "popup");
  chk("🔔 Put it in their bell", "bell");

  var err = lmsEl("div", "ntf-err"); card.appendChild(err);
  var row = lmsEl("div", "ntf-row"); row.style.justifyContent = "flex-end"; row.style.margin = "0";
  var cancel = lmsEl("button", "ntf-btn", "Cancel"); cancel.type = "button";
  cancel.onclick = function () { LMS.ui.edit = null; renderAdminPage(); };
  var sendBtn = lmsEl("button", "ntf-btn primary", ""); sendBtn.type = "button";
  row.append(cancel, sendBtn); card.appendChild(row);
  drawWhen();
  sendBtn.onclick = function () { lmsSave(D, err, sendBtn, members); };
  wrap.appendChild(card);
  setTimeout(function () { if (!D.id) title.focus(); }, 60);
}

async function lmsSave(D, err, btn, members) {
  err.textContent = "";
  var t = (D.title || "").trim();
  if (!t) { err.textContent = "Give it a headline."; return; }
  var videoId = ntfYouTubeId(D.video);
  if ((D.video || "").trim() && !videoId) { err.textContent = "The video link isn't a YouTube link."; return; }
  if (D.kind === "video" && !videoId) { err.textContent = "Paste the YouTube link for this video drop."; return; }
  var url = (D.url || "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  if (D.kind === "article" && !url) { err.textContent = "Paste the article link."; return; }
  var qs = [];
  for (var i = 0; i < D.questions.length; i++) {
    var q = D.questions[i], text = (q.q || "").trim();
    var opts = (q.options || []).map(function (o) { return String(o || "").trim(); });
    var blankQ = !text && !opts.some(Boolean);
    if (blankQ) continue;                                     /* an untouched question is just dropped */
    if (!text) { err.textContent = "Question " + (i + 1) + " needs its question."; return; }
    if (q.type === "choice") {
      var kept = [], correct = null;
      opts.forEach(function (o, oi) { if (o) { if (q.correct === oi) correct = kept.length; kept.push(o); } });
      if (kept.length < 2) { err.textContent = "“" + text + "” needs at least two choices."; return; }
      if (D.kind === "quiz" && correct == null) { err.textContent = "Mark the right answer for “" + text + "”."; return; }
      qs.push({ id: q.id, type: "choice", q: text, options: kept, correct: D.kind === "poll" ? null : correct });
    } else qs.push({ id: q.id, type: "text", q: text, options: [], correct: null });
  }
  if ((D.kind === "poll" || D.kind === "quiz") && !qs.length) { err.textContent = "Add at least one question."; return; }
  if (D.audience === "people" && !D.to.length) { err.textContent = "Choose at least one person."; return; }
  if (!D.banner && !D.popup && !D.bell) { err.textContent = "Pick at least one place: banner, pop-up or bell."; return; }
  var starts = D.when === "later" && D.at ? new Date(D.at)
             : D.sentAt && new Date(D.sentAt).getTime() <= Date.now() ? new Date(D.sentAt)   /* already out: keep when it went */
             : new Date();
  if (D.when === "later" && !D.id && starts.getTime() < Date.now() - 60000) { err.textContent = "That time is already past."; return; }
  var nDays = Math.max(1, Math.min(60, parseInt(D.days, 10) || 7));

  var drop = { kind: D.kind, title: t, intro: (D.intro || "").trim(), video_id: videoId || null, url: url || null, note: (D.note || "").trim(), questions: qs };
  var note = {
    title: t, body: drop.intro, video_id: drop.video_id,
    audience: D.audience, recipients: D.audience === "people" ? D.to.slice() : [],
    bell: !!D.bell, popup: !!D.popup, popup_rule: "once", popup_times: 1, popup_gap: "visit", show_until: null,
    place: D.banner ? D.place : null,
    place_until: D.banner ? new Date(starts.getTime() + nDays * 86400000).toISOString() : null,
    starts_at: starts.toISOString(), stopped: false
  };
  btn.disabled = true; var was = btn.textContent; btn.textContent = "Saving…";
  try {
    var dropId = D.id;
    if (dropId) {
      var u = await SUPA.from("learning_drops").update(drop).eq("id", dropId);
      if (u.error) throw u.error;
    } else {
      drop.team_slug = TEAM; drop.created_by = currentUser().id;
      var ins = await SUPA.from("learning_drops").insert(drop).select("id").single();
      if (ins.error) throw ins.error;
      dropId = ins.data.id;
    }
    var r;
    if (D.nid) r = await SUPA.from("team_notifications").update(note).eq("id", D.nid);
    else {
      note.team_slug = TEAM; note.drop_id = dropId; note.created_by = currentUser().id;
      r = await SUPA.from("team_notifications").insert(note);
    }
    if (r.error) throw r.error;
  } catch (e) {
    btn.disabled = false; btn.textContent = was;
    err.textContent = "Couldn't save: " + (e.message || e); return;
  }
  toast(D.id ? "✏️ Drop updated" : D.when === "later" ? "⏰ Scheduled for " + starts.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "🚀 Drop sent");
  LMS.ui.edit = null;
  await ntfRefresh();
  renderAdminPage();
}

async function lmsDrawList(holder) {
  var dr = await SUPA.from("learning_drops").select("*").eq("team_slug", TEAM).order("created_at", { ascending: false }).limit(100);
  if (dr.error) { holder.textContent = "Couldn't load: " + dr.error.message; return; }
  var drops = dr.data || [], ids = drops.map(function (d) { return d.id; });
  var nts = [], ans = [];
  if (ids.length) {
    var res = await Promise.all([
      SUPA.from("team_notifications").select("*").in("drop_id", ids).order("created_at", { ascending: true }),
      SUPA.from("learning_answers").select("*").in("drop_id", ids)
    ]);
    nts = res[0].data || []; ans = res[1].data || [];
  }
  drops.forEach(function (d) { LMS.drops[d.id] = d; });
  holder.className = ""; holder.innerHTML = "";
  if (!drops.length) {
    var e = lmsEl("div", "lms-empty");
    e.append(lmsEl("div", "", "Nothing yet. Press ＋ New drop — try a quick poll like"), lmsEl("div", "", "“Camera, editing or knowledge — what matters most?” 🗳"));
    e.lastChild.style.cssText = "font-weight:700;color:var(--ink);margin-top:6px";
    holder.appendChild(e); return;
  }
  var team = adminMembers();
  function nameOf(id) { var u = team.find(function (x) { return x.id === id; }); return u ? userDisplayName(u) : "Someone who left"; }
  drops.forEach(function (d) {
    var K = LMS_KINDS[d.kind] || LMS_KINDS.video, n = nts.filter(function (x) { return x.drop_id === d.id; })[0];
    var a = ans.filter(function (x) { return x.drop_id === d.id; });
    var targets = !n ? [] : n.audience === "team" ? team.filter(function (u) { return u.id !== n.created_by; }).map(function (u) { return u.id; }) : n.recipients;
    var box = lmsEl("div", "lms-drop"), top = lmsEl("div", "ldr-top"), info = lmsEl("div");
    var row = lmsEl("div", "ntf-row"); row.style.cssText = "margin:0;align-items:flex-start;flex-wrap:nowrap";
    row.append(lmsEl("div", "ldr-i", K.ico), info);
    info.appendChild(lmsEl("div", "ntf-t", d.title));
    if (d.intro) info.appendChild(lmsEl("div", "ntf-m", d.intro));
    var tags = lmsEl("div");
    var sched = n && new Date(n.starts_at).getTime() > Date.now();
    tags.appendChild(lmsEl("span", "ntf-tag" + (sched ? "" : " live"), !n ? "Not sent" : sched ? "⏰ Goes out " + new Date(n.starts_at).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Sent " + ntfWhen(n.starts_at)));
    if (n) tags.appendChild(lmsEl("span", "ntf-tag", "👥 " + (n.audience === "team" ? "Whole team" : targets.map(nameOf).join(", "))));
    if (n && n.place) tags.appendChild(lmsEl("span", "ntf-tag", "📌 " + ntfPlaceLabel(n.place) + (ntfBannerLive(n) ? " · till " + ntfUntilText(n.place_until) : sched ? "" : " · ended")));
    if ((d.questions || []).length) tags.appendChild(lmsEl("span", "ntf-tag", "✍️ Answered " + a.length + "/" + targets.length));
    var quizA = a.filter(function (x) { return x.total; });
    if (quizA.length) {
      var avg = quizA.reduce(function (s, x) { return s + x.score / x.total; }, 0) / quizA.length;
      tags.appendChild(lmsEl("span", "ntf-tag", "🎯 Avg " + Math.round(avg * 100) + "%"));
    }
    info.appendChild(tags);
    var acts = lmsEl("div", "ldr-acts");
    function btn(t, f) { var b = lmsEl("button", "", t); b.type = "button"; b.onclick = f; acts.appendChild(b); return b; }
    var pane = lmsEl("div", "lms-pane"); pane.style.display = LMS.ui.open[d.id] ? "" : "none";
    if ((d.questions || []).length) btn("📊 Answers", function () { LMS.ui.open[d.id] = !LMS.ui.open[d.id]; pane.style.display = LMS.ui.open[d.id] ? "" : "none"; });
    if (n) btn("👀 Preview", function () { ntfShowBox(n, false); });
    btn("✏️ Edit", function () { LMS.ui.edit = lmsDraftFrom(d, n); renderAdminPage(); var m = document.getElementById("admin-main"); if (m) m.scrollIntoView({ block: "start", behavior: "smooth" }); });
    btn("Delete", async function () {
      if (!confirm("Delete “" + d.title + "”? It disappears for everyone, with its answers.")) return;
      var r = await SUPA.from("learning_drops").delete().eq("id", d.id);
      if (r.error) { toast("Couldn't delete: " + r.error.message); return; }
      delete LMS.drops[d.id]; toast("Deleted"); await ntfRefresh(); renderAdminPage();
    });
    top.append(row, acts); box.appendChild(top);

    /* answers */
    (d.questions || []).forEach(function (q) {
      pane.appendChild(lmsEl("div", "lr-q", q.q)).style.cssText = "font-weight:600;font-size:14px;margin:10px 0 6px";
      if (q.type === "choice") {
        q.options.forEach(function (o, i) {
          var who = a.filter(function (x) { return (x.answers || {})[q.id] === i; });
          var bar = lmsEl("div", "lms-bar"); bar.style.background = "var(--paper)";
          var f = lmsEl("span", "lb-f"); f.style.width = (a.length ? Math.round(100 * who.length / a.length) : 0) + "%";
          bar.append(f, lmsEl("span", "", (q.correct === i ? "✅ " : "") + o), lmsEl("span", "lb-n", who.length + (a.length ? " · " + Math.round(100 * who.length / a.length) + "%" : "")));
          pane.appendChild(bar);
          if (who.length) pane.appendChild(lmsEl("div", "lms-who", who.map(function (x) { return nameOf(x.user_id); }).join(", ")));
        });
      } else {
        var tb = document.createElement("table");
        a.filter(function (x) { return (x.answers || {})[q.id]; }).forEach(function (x) {
          var tr = document.createElement("tr");
          tr.append(lmsEl("td", "", nameOf(x.user_id)), lmsEl("td", "", x.answers[q.id]));
          tr.firstChild.style.cssText = "white-space:nowrap;font-weight:600;width:1%";
          tb.appendChild(tr);
        });
        if (tb.childNodes.length) pane.appendChild(tb); else pane.appendChild(lmsEl("div", "hint", "No written answers yet."));
      }
    });
    if ((d.questions || []).length) {
      pane.appendChild(lmsEl("div", "lr-q", "Who answered")).style.cssText = "font-weight:600;font-size:14px;margin:14px 0 6px";
      var tb2 = document.createElement("table");
      targets.forEach(function (uid) {
        var x = a.find(function (y) { return y.user_id === uid; }), tr = document.createElement("tr");
        tr.append(lmsEl("td", "", nameOf(uid)),
                  lmsEl("td", "", x ? "✅ " + ntfWhen(x.submitted_at) : "—"),
                  lmsEl("td", "", x && x.total ? "🎯 " + x.score + "/" + x.total : ""));
        tb2.appendChild(tr);
      });
      pane.appendChild(tb2);
      box.appendChild(pane);
    }
    holder.appendChild(box);
  });
}
