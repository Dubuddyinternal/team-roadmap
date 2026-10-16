/* =====================================================================
   MY TO-DO — one private board per person, split into four hats:
     👤 Personal · 🧭 As CEO · 🧩 As Product Head · ▶️ Sumit YouTube
   Each hat has
     * fixed things — repeat every day / on chosen weekdays / on a day of
       the month, or a one-off meeting on a date (set up from the hat's ⋯
       menu); the ones due today show as tick boxes at the top of the hat;
     * variable things — a To do · In progress · Done board.

   Everything assigned to me on the team's boards lands by itself, by a
   fixed rule:
     🧩 Product Head — Development / scrum cards, bugs, Product Roadmap
        ideas, roadmap module tasks, Product All in One items
     🧭 CEO          — Educational Content tasks, Campaign pieces, Keep an
        Eye studies, Widen our Horizon topics
     ▶️ Sumit YouTube — nothing pulled in; only what I add myself
   OKRs are not pulled in (they stay on the OKRs page).
   A card's column follows its board (done there = Done here). Moving a dev
   card, bug or roadmap / content task here moves it on its board too (if I
   can edit); anything else just remembers where I put it.

   Personal · New learning: every day I write four things, each with its own
   Save — AI & automation; what's happening in the world; top 3 posts on
   Twitter / LinkedIn; EdTech & education.
   Until all four are written, everything else on My To-do is frozen (greyed
   out, can't be ticked, moved or added to). Past days collect in a log
   with a streak count.

   Personal · Deep thinking and ♟️ Reasoning time (chess, maths, puzzles —
   30 min / 1 h / 2 h): "Start" covers the whole app with a
   countdown (talk to yourself, walk, don't do anything). It survives a
   reload (the end time is saved), can be ended early only after a
   warning, and today's minutes are logged.

   "All to be done" is the backlog: everything still open, hat by hat. From
   there I drag a card (or use its "📅 Day…" button) onto Today, Tomorrow or
   one of the next days. Today's hats then show only what I planned for today
   (or earlier and not finished), plus — for my own to-dos — what is due
   today / overdue and what is in progress. Cards assigned to me on any board
   always land in All to be done first and reach Today only once I plan them; Upcoming shows planned cards on their day. The planned day is
   mine only (TODO.plan, by card key) and never changes the card's board.

   Tomorrow is the same clock view for tomorrow's date, so at the end of the
   day I can lay out tomorrow: the timetable (block and thing times) is the
   same every day, only the cards planned for that day change.

   On Today, 🧭 CEO and 🧩 Product Head show together as one block,
   💼 Dubuddy Work (All to be done keeps them apart). A card in All to be
   done has "→ Today" to move it straight onto Today.

   Today by the clock: each hat block can get a time (🕘 in its header,
   e.g. 09:00–11:00), and any single thing — a card, a fixed thing like
   Running, or the New learning / Deep thinking / Reasoning boxes — can get
   its own time by dragging it onto a gap between blocks (or its 🕘 button).
   A timed thing leaves its block and sits on the day at its time; ✕ puts it
   back. Times are kept (TODO.times) so Running at 18:00 stays there every
   day. If New learning has a time, it sits on the day too and nothing freezes
   (its dot turns red once the time has passed and it isn't written yet).

   🇮🇳 Why do I exist? — my purpose sits above everything in All to be done:
   a ladder of dots from me (Dubuddy + Sumit) up to Self-reliant India, each
   dot something my country should do and isn't doing yet. It also pops up
   the first time I open My To-do each day; ✕ closes it and that's saved
   (TODO.why.seen), so it won't come back until tomorrow. ✏️ edits the words.

   Fixed things are normal cards too (🔁 Fixed): on each day one is due it
   waits in All to be done like any other card, and I move it onto Today /
   Tomorrow / a day (→ Today, 📅 Day…, drag), give it a time and move it To do
   → In progress → Done. Done / in progress is kept per day
   (TODO.fixedDone["id|day"] = 1 | "progress"). The plan is kept per fixed
   thing (TODO.plan["fx:id"]), so once Running is on Today it comes back on
   each of its days until I send it back with ↩ All to be done.

   "Upcoming" lists tomorrow / the next 5 / the next 7 days: fixed things on
   each day plus every to-do and assigned card due that day, and overdue ones.

   Who sees it: anyone with the "My To-do" permission (Owners and supers
   have every permission; others get it per role in Roles & permissions).
   Data: public.my_todos, one row per person per team, readable and writable
   only by that person (supabase/stage20a_my_todos.sql); falls back to this
   browser if the table can't be reached.
   Uses index.html globals (SUPA, TEAM, DEV, BUGS, CSPACES, OKRS, DATA,
   CONTENT, view, renderAll, openDialog, openChoice, toast, fmtD, todayISO …).
   ===================================================================== */
var TODO = { team: null, loaded: false, loading: false, local: false, items: [], over: {}, plan: {}, times: { hats: {}, at: {} }, fixed: [], fixedDone: {}, learn: {}, deep: null, deepLog: {}, reasonLog: {}, settings: null, feeds: [], feedItems: {}, feedSeen: {}, feedAt: 0, sleepLog: {}, why: null };
// the two full-screen timers in Personal
var TODO_TIMERS = {
  deep: { icon: "🧘", title: "Deep thinking", line: "Talk to yourself. Walk. Don't do anything.",
    done: "Welcome back. What came to you? Write it down before it's gone." },
  reason: { icon: "♟️", title: "Reasoning time", line: "Play chess. Solve maths. Crack a puzzle. Stretch your reasoning.",
    done: "Time's up. What did you solve — and where did you get stuck?" },
};
var todoLearnEdit = {};        // which of today's four learning boxes are being edited again
var todoLearnOpen = {};        // which learning boxes are opened from their one-line view
var todoLearnLog = false;      // the past-learnings list is open
var TODO_COLS = [
  { key: "todo", label: "To do" },
  { key: "progress", label: "In progress" },
  { key: "done", label: "Done" },
];
var TODO_HATS = [
  { key: "personal", icon: "👤", label: "Personal" },
  { key: "ceo", icon: "🧭", label: "As CEO" },
  { key: "product", icon: "🧩", label: "As Product Head" },
  { key: "youtube", icon: "▶️", label: "Sumit YouTube" },
];
// Today shows CEO + Product Head as one block, 💼 Dubuddy Work (All to be done keeps them apart for noting things down)
var TODO_DAY_BLOCKS = [
  { key: "personal", icon: "👤", label: "Personal", hats: ["personal"] },
  { key: "work", icon: "💼", label: "Dubuddy Work", hats: ["ceo", "product"] },
  { key: "youtube", icon: "▶️", label: "Sumit YouTube", hats: ["youtube"] },
];
function todoIn(B, hat) { return (B.hats || [B.key]).indexOf(hat) >= 0; }
// a block with more than one hat asks which hat a new thing belongs to
function todoWithHat(B, cb) {
  var hs = B.hats || [B.key];
  if (hs.length === 1) { cb(hs[0]); return; }
  openChoice("Which kind of work is it?", hs.map(function (k) { var h = todoHat(k); return { label: h.icon + " " + h.label, value: k }; }), cb);
}
var TODO_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var TODO_DONE_SHOW = 6;          // each hat's Done column shows the latest few; "Show all" opens the rest
var todoShowAllDone = {};        // hat -> true
var todoMode = "today";          // all | today | upcoming
var todoRange = 1;               // upcoming: 1 (tomorrow) | 5 | 7 days

function todoCan() { try { return !!currentUser() && hasPerm("my_todo"); } catch (_) { return false; } }
function todoEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function todoId() { return "td-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todoHat(k) { return TODO_HATS.find(function (h) { return h.key === k; }) || TODO_HATS[0]; }
function todoAddDays(iso, n) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function todoToday() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }   // local day, not UTC
function todoDayName(iso) { return TODO_DAYS[new Date(iso + "T00:00:00Z").getUTCDay()]; }

/* ---------- load / save ---------- */
function todoLocalKey() { var u = currentUser(); return "cf-todo-" + TEAM + "-" + (u ? u.id : "anon"); }
function todoApply(d) {
  d = d || {};
  TODO.items = Array.isArray(d.items) ? d.items.filter(function (x) { return x && x.title; }) : [];
  TODO.items.forEach(function (x) {
    if (!x.id) x.id = todoId();
    if (!TODO_COLS.some(function (c) { return c.key === x.col; })) x.col = "todo";
    if (!TODO_HATS.some(function (h) { return h.key === x.hat; })) x.hat = "personal";
  });
  TODO.over = d.over && typeof d.over === "object" ? d.over : {};
  TODO.plan = d.plan && typeof d.plan === "object" ? d.plan : {};
  // { hats: { hatKey: { from:"HH:MM", to:"HH:MM" } }, at: { thingKey: "HH:MM" } } — Today by the clock
  var tm = d.times && typeof d.times === "object" ? d.times : {};
  TODO.times = { hats: tm.hats && typeof tm.hats === "object" ? tm.hats : {}, at: tm.at && typeof tm.at === "object" ? tm.at : {} };
  // Dubuddy Work replaced the CEO / Product Head blocks on Today: carry an old block time over once
  if (!TODO.times.hats.work && (TODO.times.hats.product || TODO.times.hats.ceo)) TODO.times.hats.work = TODO.times.hats.product || TODO.times.hats.ceo;   // { cardKey: "YYYY-MM-DD" } — the day I picked for it
  TODO.fixed = Array.isArray(d.fixed) ? d.fixed.filter(function (f) { return f && f.title; }) : [];
  TODO.fixed.forEach(function (f) {
    if (!f.id) f.id = todoId();
    if (!TODO_HATS.some(function (h) { return h.key === f.hat; })) f.hat = "personal";
    if (["daily", "weekly", "monthly", "once"].indexOf(f.freq) < 0) f.freq = "daily";
  });
  TODO.fixedDone = d.fixedDone && typeof d.fixedDone === "object" ? d.fixedDone : {};
  // fixed things became cards: one that already had its own time on the clock stays planned on the day
  TODO.fixed.forEach(function (f) { var k = "fx:" + f.id; if (TODO.times.at[k] && !(k in TODO.plan)) TODO.plan[k] = todoToday(); });
  TODO.learn = d.learn && typeof d.learn === "object" ? d.learn : {};   // { "YYYY-MM-DD": { ai, world, social, edtech } } (older days: a string), kept forever
  TODO.settings = todoSettingsNorm(d.settings);   // ⋯ settings on the Personal cards
  TODO.feeds = Array.isArray(d.feeds) ? d.feeds.filter(function (s) { return s && s.id && s.url; }) : [];   // 📡 what the feed agent follows
  TODO.feedItems = d.feedItems && typeof d.feedItems === "object" ? d.feedItems : {};
  TODO.feedSeen = d.feedSeen && typeof d.feedSeen === "object" ? d.feedSeen : {};
  TODO.feedAt = Number(d.feedAt) || 0;
  TODO.sleepLog = d.sleepLog && typeof d.sleepLog === "object" ? d.sleepLog : {};   // { "YYYY-MM-DD": { wake: "HH:MM", sleep: "HH:MM" } } — when I ticked it
  TODO.why = todoWhyNorm(d.why);   // 🇮🇳 why I exist — { goal, steps:[…], from, line, seen:"YYYY-MM-DD" }
  TODO.deepLog = d.deepLog && typeof d.deepLog === "object" ? d.deepLog : {};       // deep thinking { "YYYY-MM-DD": minutes }
  TODO.reasonLog = d.reasonLog && typeof d.reasonLog === "object" ? d.reasonLog : {}; // reasoning (chess, maths, puzzles)
  // { start, end, kind:"deep"|"reason" } (ms) while a timer runs
  TODO.deep = d.deep && d.deep.end > Date.now() ? d.deep : (d.deep ? todoDeepLog(d.deep, todoTimerLog(d.deep.kind)) : null);
}
function todoTimerLog(kind) { return kind === "reason" ? TODO.reasonLog : TODO.deepLog; }
// a finished block that was never closed (page was shut): count it, then clear it
function todoDeepLog(deep, log) {
  if (!deep || !log || deep.logged) return null;
  var day = new Date(deep.start), k = day.getFullYear() + "-" + String(day.getMonth() + 1).padStart(2, "0") + "-" + String(day.getDate()).padStart(2, "0");
  log[k] = (log[k] || 0) + Math.round((Math.min(deep.end, Date.now()) - deep.start) / 60000);
  return null;
}
async function todoLoad() {
  if (TODO.loading) return;
  TODO.loading = true;
  var d = null, local = false;
  try {
    if (!SUPA) throw new Error("no database");
    var r = await SUPA.from("my_todos").select("data").eq("team_slug", TEAM).maybeSingle();
    if (r.error) throw r.error;
    d = r.data ? r.data.data : null;
  } catch (e) {
    local = true;   // table not reachable or offline: keep them in this browser
    try { d = JSON.parse(localStorage.getItem(todoLocalKey()) || "null"); } catch (_) { d = null; }
  }
  todoApply(d);
  TODO.local = local; TODO.team = TEAM; TODO.loaded = true; TODO.loading = false;
  renderAll();   // the board and the sidebar count
  if (TODO.deep) todoDeepShow();   // a deep-thinking block is still running: back behind the curtain
  todoFeedRun(false);              // the feed agent, if it hasn't run in the last 30 minutes
}
var _todoSaveT = null;
function todoSave() {
  // tick marks older than ~13 months are dropped so the row stays small (the Summary looks back 6 months)
  var cut = todoAddDays(todoToday(), -400);
  Object.keys(TODO.fixedDone).forEach(function (k) { if (k.split("|")[1] < cut) delete TODO.fixedDone[k]; });
  // planned days of cards that are gone or done for a month are dropped
  var live = {}; TODO.items.forEach(function (x) { live["own:" + x.id] = 1; }); try { todoAssigned().forEach(function (e) { live[e.key] = 1; }); } catch (_) { } TODO.fixed.forEach(function (f) { live["fx:" + f.id] = 1; });
  Object.keys(TODO.plan).forEach(function (k) { if (!live[k] && TODO.plan[k] < todoAddDays(todoToday(), -30)) delete TODO.plan[k]; });
  var data = { items: TODO.items, over: TODO.over, plan: TODO.plan, times: TODO.times, fixed: TODO.fixed, fixedDone: TODO.fixedDone, learn: TODO.learn, deep: TODO.deep, deepLog: TODO.deepLog, reasonLog: TODO.reasonLog, settings: TODO.settings,
    feeds: TODO.feeds, feedItems: TODO.feedItems, feedSeen: TODO.feedSeen, feedAt: TODO.feedAt, sleepLog: TODO.sleepLog, why: TODO.why };
  clearTimeout(_todoSaveT);
  _todoSaveT = setTimeout(async function () {
    if (!TODO.local && SUPA) {
      var r = await SUPA.from("my_todos").upsert({ team_slug: TEAM, data: data, updated_at: new Date().toISOString() }, { onConflict: "user_id,team_slug" });
      if (!r.error) return;
      TODO.local = true;
    }
    try { localStorage.setItem(todoLocalKey(), JSON.stringify(data)); } catch (_) { }
  }, 600);
  renderAll();
}

/* ---------- fixed things ---------- */
function todoFixedOn(f, iso) {
  if (f.from && iso < f.from) return false;
  if (f.freq === "daily") return true;
  if (f.freq === "weekly") return (f.days || []).indexOf(new Date(iso + "T00:00:00Z").getUTCDay()) >= 0;
  if (f.freq === "monthly") return Number(iso.slice(8, 10)) === Number(f.dom || 1);
  if (f.freq === "once") return f.date === iso;
  return false;
}
function todoFixedFor(hat, iso) {
  return TODO.fixed.filter(function (f) { return (!hat || f.hat === hat) && todoFixedOn(f, iso); })
    .sort(function (a, b) { return String(a.time || "99").localeCompare(String(b.time || "99")); });
}
function todoFixedIsDone(f, iso) { var v = TODO.fixedDone[f.id + "|" + iso]; return !!v && v !== "progress"; }
function todoFixedToggle(f, iso) { var k = f.id + "|" + iso; if (todoFixedIsDone(f, iso)) delete TODO.fixedDone[k]; else TODO.fixedDone[k] = 1; todoSave(); }
// the column of a fixed thing on one day: todo | progress | done
function todoFixedCol(f, iso) { var v = TODO.fixedDone[f.id + "|" + iso]; return v === "progress" ? "progress" : v ? "done" : "todo"; }
function todoFixedSetCol(f, iso, col) {
  var k = f.id + "|" + iso;
  if (col === "done") TODO.fixedDone[k] = 1; else if (col === "progress") TODO.fixedDone[k] = "progress"; else delete TODO.fixedDone[k];
  todoSave();
}
// the fixed things due on a day, as cards (shaped like the cards assigned to me)
function todoFixedCards(iso) {
  return todoFixedFor(null, iso).map(function (f) {
    return { key: "fx:" + f.id, fixed: f, day: iso, hat: f.hat, icon: "🔁", src: "Fixed", where: todoFixedRule(f), title: f.title,
      col: todoFixedCol(f, iso), boardCol: todoFixedCol(f, iso), write: function (k) { todoFixedSetCol(f, iso, k); },
      open: function () { todoFixedSetup(f.hat); } };
  });
}
function todoFixedRule(f) {
  var t = f.time ? " · " + f.time : "";
  if (f.freq === "daily") return "Every day" + t;
  if (f.freq === "weekly") return "Every " + ((f.days || []).slice().sort().map(function (d) { return TODO_DAYS[d]; }).join(", ") || "—") + t;
  if (f.freq === "monthly") return "Every month on the " + (f.dom || 1) + t;
  return (f.date ? fmtD(f.date) : "One day") + t;
}
function todoFixedChip(f, iso, showHat) {
  var done = todoFixedIsDone(f, iso);
  var b = todoEl("button", "td-fx" + (done ? " done" : ""));
  b.innerHTML = "<span class=\"td-fx-box\"></span><span class=\"td-fx-t\"></span>";
  b.querySelector(".td-fx-box").textContent = done ? "✓" : "";
  b.querySelector(".td-fx-t").textContent = (f.time ? f.time + " · " : "") + f.title + (showHat ? "  " + todoHat(f.hat).icon : "");
  b.title = todoFixedRule(f) + (done ? " — done" : " — click when done");
  b.onclick = function () { todoFixedToggle(f, iso); };
  return b;
}
/* the ⋯ → "Set up fixed things" window for one hat */
function todoFixedSetup(hat) {
  var H = todoHat(hat), editing = null;
  var ov = todoEl("div", "overlay show");
  var dg = todoEl("div", "dialog td-fxdlg"); dg.setAttribute("role", "dialog"); dg.setAttribute("aria-modal", "true");
  ov.appendChild(dg);
  var close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); renderAll(); };
  ov.onclick = function (e) { if (e.target === ov) close(); };
  var draw = function () {
    dg.innerHTML = "";
    dg.appendChild(todoEl("h3", "", H.icon + " " + H.label + " — fixed things"));
    var body = todoEl("div", "dlg-body");
    body.appendChild(todoEl("div", "hint", "Things that come back on their own — daily habits, weekly meetings, a monthly review, or one meeting on a date. They show up as tick boxes on the day."));
    var list = todoEl("div", "td-fxlist");
    var mine = TODO.fixed.filter(function (f) { return f.hat === hat; });
    if (!mine.length) list.appendChild(todoEl("div", "td-empty", "Nothing yet."));
    mine.forEach(function (f) {
      var r = todoEl("div", "td-fxrow");
      var tx = todoEl("div", "td-fxrow-t"); tx.appendChild(todoEl("b", "", f.title)); tx.appendChild(todoEl("span", "", todoFixedRule(f)));
      var ed = todoEl("button", "td-act", "Edit"); ed.onclick = function () { editing = f; draw(); };
      var dl = todoEl("button", "td-act danger", "Remove"); dl.onclick = function () { if (!confirm("Remove “" + f.title + "”?")) return; TODO.fixed.splice(TODO.fixed.indexOf(f), 1); todoSave(); draw(); };
      r.append(tx, ed, dl); list.appendChild(r);
    });
    body.appendChild(list);
    // the form: add new, or edit the one picked
    var F = editing || { freq: "daily", days: [1], dom: 1, date: todayISO() };
    var form = todoEl("div", "td-fxform");
    form.appendChild(todoEl("div", "td-fxform-h", editing ? "Edit “" + editing.title + "”" : "Add a fixed thing"));
    form.innerHTML += '<div class="field"><label>What</label><input class="fx-title" placeholder="e.g. Running, Meditation, Weekly leadership meeting"></div>'
      + '<div class="field-row"><div class="field"><label>Repeats</label><select class="fx-freq">'
      + '<option value="daily">Every day</option><option value="weekly">Every week on…</option><option value="monthly">Every month on day…</option><option value="once">Once, on a date (meeting)</option>'
      + '</select></div><div class="field"><label>Time (optional)</label><input class="fx-time" type="time"></div></div>'
      + '<div class="field fx-w"><label>On</label><div class="td-fxdays"></div></div>'
      + '<div class="field fx-m"><label>Day of the month</label><input class="fx-dom" type="number" min="1" max="31"></div>'
      + '<div class="field fx-o"><label>Date</label><input class="fx-date" type="date"></div>'
      + '<div class="hint err" style="color:var(--blocked);min-height:16px"></div>';
    body.appendChild(form);
    dg.appendChild(body);
    var q = function (s) { return form.querySelector(s); };
    q(".fx-title").value = F.title || ""; q(".fx-freq").value = F.freq; q(".fx-time").value = F.time || "";
    q(".fx-dom").value = F.dom || 1; q(".fx-date").value = F.date || todayISO();
    var days = (F.days || []).slice();
    TODO_DAYS.forEach(function (n, i) {
      var b = todoEl("button", "td-day" + (days.indexOf(i) >= 0 ? " on" : ""), n); b.type = "button";
      b.onclick = function () { var k = days.indexOf(i); if (k >= 0) days.splice(k, 1); else days.push(i); b.classList.toggle("on"); };
      q(".td-fxdays").appendChild(b);
    });
    var showFreq = function () { var v = q(".fx-freq").value; q(".fx-w").style.display = v === "weekly" ? "" : "none"; q(".fx-m").style.display = v === "monthly" ? "" : "none"; q(".fx-o").style.display = v === "once" ? "" : "none"; };
    q(".fx-freq").onchange = showFreq; showFreq();
    var btns = todoEl("div", "btns");
    var cl = todoEl("button", "btn", editing ? "Cancel edit" : "Close"); cl.onclick = function () { if (editing) { editing = null; draw(); } else close(); };
    var sv = todoEl("button", "btn save", editing ? "Save" : "＋ Add");
    sv.onclick = function () {
      var title = q(".fx-title").value.trim(), freq = q(".fx-freq").value, err = q(".err");
      if (!title) { err.textContent = "Give it a name."; return; }
      if (freq === "weekly" && !days.length) { err.textContent = "Pick at least one day."; return; }
      if (freq === "once" && !q(".fx-date").value) { err.textContent = "Pick the date."; return; }
      var f = editing || { id: todoId(), hat: hat, from: todayISO() };
      f.title = title; f.freq = freq; f.time = q(".fx-time").value || "";
      f.days = freq === "weekly" ? days.slice().sort() : undefined;
      f.dom = freq === "monthly" ? Math.max(1, Math.min(31, Number(q(".fx-dom").value) || 1)) : undefined;
      f.date = freq === "once" ? q(".fx-date").value : undefined;
      if (!f.time) delete f.time;
      if (!editing) TODO.fixed.push(f);
      editing = null; todoSave(); draw();
    };
    btns.append(cl, sv); dg.appendChild(btns);
  };
  draw();
  document.body.appendChild(ov);
}

/* ---------- everything assigned to me ---------- */
function todoMe() {
  var u = currentUser() || {};
  var names = [u.name, u.username, typeof userDisplayName === "function" ? userDisplayName(u) : ""]
    .filter(Boolean).map(function (s) { return String(s).trim().toLowerCase(); });
  return { email: (u.email || "").toLowerCase(), id: u.id || "", names: names };
}
function todoNameIsMe(me, s) { return !!s && me.names.indexOf(String(s).trim().toLowerCase()) >= 0; }
function todoColFromKcol(c) { return c === "done" ? "done" : (c === "progress" || c === "review") ? "progress" : "todo"; }
function todoColFromStatus(s) { return s === "done" ? "done" : (s === "progress" || s === "blocked") ? "progress" : "todo"; }
function todoCanSee(cs) { try { return typeof canViewSpace !== "function" || canViewSpace(csRef(cs)); } catch (_) { return true; } }
function todoISO(d) { return d && /^\d{4}-\d{2}-\d{2}/.test(String(d)) ? String(d).slice(0, 10) : ""; }

/* each entry: { key, hat, src, icon, title, where, col (from the board), due, write(col) | null, open() } */
function todoAssigned() {
  var me = todoMe(), out = [];
  if (!me.email && !me.id) return out;
  var spaces = (CSPACES && CSPACES.list) || [];

  // Development / scrum cards
  ((DEV && DEV.cards) || []).forEach(function (c) {
    if ((c.assignee || "").toLowerCase() !== me.email) return;
    var sp = (DEV.spaces || []).find(function (s) { return s.id === c.space; });
    out.push({ key: "dev:" + c.id, hat: "product", icon: "🛠️", src: "Dev", title: c.title, where: sp ? sp.name : "Development",
      col: todoColFromKcol(c.col), due: todoISO(c.duedate),
      write: hasPerm("edit") ? function (k) { c.col = k; saveDev(); } : null,
      open: function () { view = "dev"; devSpace = c.space || null; devSprint = c.sprint || null; renderAll(); } });
  });
  // bugs
  (typeof teamBugs === "function" ? teamBugs() : []).forEach(function (t) {
    if ((t.assignee || "").toLowerCase() !== me.email) return;
    var b = t.board ? spaces.find(function (x) { return x.id === t.board; }) : null;
    out.push({ key: "bug:" + t.id, hat: "product", icon: "🐞", src: "Bug", title: t.title, where: b ? b.name : "Bugs",
      col: todoColFromKcol(t.col), due: todoISO(t.duedate),
      write: hasPerm("edit") ? function (k) { t.col = k; saveBugs(); } : null,
      open: function () { if (b) { view = "cbugs"; activeCspace = b.id; } else view = "bugs"; renderAll(); } });
  });
  spaces.forEach(function (cs) {
    if (!todoCanSee(cs)) return;
    // Product Roadmap ideas — due = the end date of the phase it's in
    if (cs.type === "discovery") (cs.ideas || []).forEach(function (i) {
      if ((i.assignee || "").toLowerCase() !== me.email) return;
      var st = (typeof discStages === "function" ? discStages(cs) : []).find(function (x) { return x.key === i.stage; });
      var ph = (cs.tl && cs.tl.items || []).find(function (t) { return t.tid === i.id && t.phase === i.stage && !t.done; });
      out.push({ key: "idea:" + i.id, hat: "product", icon: "💡", src: "Product Roadmap", title: i.title, where: cs.name + (st ? " · " + st.label : ""),
        col: (i.stage === "done" || i.stage === "wont") ? "done" : ["primary", "implres", "building"].indexOf(i.stage) >= 0 ? "progress" : "todo",
        due: ph ? todoISO(ph.end) : "",
        write: null, open: function () { view = "disc"; activeCspace = cs.id; discView = "roadmap"; renderAll(); } });
    });
    // Product All in One items (owner typed as a name)
    if (cs.type === "pdt") (cs.items || []).forEach(function (it) {
      if (!todoNameIsMe(me, it.owner)) return;
      var done = (it.lane === "bugs" && it.col === "done") || (it.lane === "qa" && it.col === "passed") || (it.lane === "dev" && it.col === "qa");
      out.push({ key: "pdt:" + it.id, hat: "product", icon: "🧩", src: "Product", title: it.title, where: cs.name,
        col: done ? "done" : ["progress", "review", "testing", "verify"].indexOf(it.col) >= 0 ? "progress" : "todo", due: todoISO(it.due),
        write: null, open: function () { view = "pdt"; activeCspace = cs.id; pdtView = it.lane; renderAll(); } });
    });
    // Campaign pieces
    if (cs.type === "campaign") (cs.items || []).forEach(function (it, n) {
      if (!it.ownerId || it.ownerId !== me.id) return;
      out.push({ key: "camp:" + cs.id + ":" + (it.id || n), hat: "ceo", icon: "📣", src: "Campaign", title: it.name || "(piece)", where: cs.name,
        col: it.sentCardId ? "done" : "todo", write: null,
        open: function () { view = "campaign"; activeCspace = cs.id; campView = "assign"; renderAll(); } });
    });
    // Keep an Eye studies
    if (cs.type === "watch") (cs.companies || []).forEach(function (co, n) {
      if (!co.ownerId || co.ownerId !== me.id) return;
      out.push({ key: "watch:" + cs.id + ":" + (co.id || n), hat: "ceo", icon: "👀", src: "Keep an Eye", title: "Study " + (co.name || ""), where: cs.name,
        col: "todo", due: todoISO(co.due), write: null,
        open: function () { view = "watch"; activeCspace = cs.id; watchView = "fill"; renderAll(); } });
    });
    // Widen our Horizon topics (answering or checking)
    if (cs.type === "horizon") (cs.topics || []).forEach(function (t, n) {
      var mine = t.ownerId && t.ownerId === me.id, check = t.checkerId && t.checkerId === me.id;
      if (!mine && !check) return;
      out.push({ key: "hz:" + cs.id + ":" + (t.id || n) + (mine ? "" : ":chk"), hat: "ceo", icon: "🔭", src: "Horizon", title: (mine ? "" : "Check: ") + (t.q || "(topic)"), where: cs.name,
        col: "todo", write: null,
        open: function () { view = "horizon"; activeCspace = cs.id; horizonView = mine ? "fill" : "check"; renderAll(); } });
    });
  });
  // (OKR objectives / key results are left out on purpose — they live on the OKRs page)
  // roadmap module tasks (owner typed as a name) — product work
  var walkMod = function (m, path, label) {
    var leaf = function (t, trail) {
      if (t.items && t.items.length) { t.items.forEach(function (s, j) { leaf(s, trail + "." + j); }); return; }
      if (!todoNameIsMe(me, t.owner)) return;
      out.push({ key: "mod:" + path + ":" + (t.tid || trail), hat: "product", icon: "🗺️", src: "Roadmap", title: t.title, where: label,
        col: todoColFromStatus(t.status), due: todoISO(t.deadline),
        write: hasPerm("edit") ? function (k) { t.status = k === "todo" ? "planned" : k; saveRoadmap(); } : null,
        open: function () { view = "roadmap"; navTo(path); } });
    };
    (m.items || []).forEach(function (t, i) { leaf(t, String(i)); });
    (m.subs || []).forEach(function (s) { walkMod(s, path + "::" + s.key, label + " › " + s.name); });
  };
  ((DATA && DATA.modules) || []).forEach(function (m) { walkMod(m, m.key, m.name); });
  // Educational Content tasks (owner typed as a name)
  ((CONTENT && CONTENT.sections) || []).forEach(function (s) {
    var walk = function (t) {
      if (t.items && t.items.length) { t.items.forEach(walk); return; }
      if (!todoNameIsMe(me, t.owner)) return;
      out.push({ key: "edu:" + (t.tid || t.title), hat: "ceo", icon: "📚", src: "Content", title: t.title, where: s.name || "Educational Content",
        col: todoColFromStatus(t.status), due: todoISO(t.deadline),
        write: hasPerm("edit") ? function (k) { t.status = k === "todo" ? "planned" : k; saveContent(); } : null,
        open: function () { view = "content"; activeSection = s.key; renderAll(); } });
    };
    (s.tasks || []).forEach(walk);
  });
  // where I put each one here (only for items whose board can't take the move); done on the board always wins
  out.forEach(function (e) {
    var o = TODO.over[e.key];
    e.boardCol = e.col;
    if (o && e.col !== "done" && !e.write) e.col = o;
  });
  return out;
}

/* ---------- moving cards ---------- */
function todoMove(key, toCol, toHat) {
  if (key.indexOf("own:") === 0) {
    var it = TODO.items.find(function (x) { return "own:" + x.id === key; });
    if (!it) return;
    var moved = it.col !== toCol || (toHat && it.hat !== toHat);
    if (!moved) return;
    it.col = toCol; if (toHat) it.hat = toHat;
    if (toCol === "done") it.doneAt = it.doneAt || todayISO(); else delete it.doneAt;
    todoSave(); return;
  }
  if (key.indexOf("fx:") === 0) {   // a fixed thing: its column on the day I'm looking at
    var f = TODO.fixed.find(function (z) { return "fx:" + z.id === key; });
    if (f) todoFixedSetCol(f, todoViewDay(), toCol);
    return;
  }
  // assigned cards keep their hat (the fixed rule); only the column changes
  var e = todoAssigned().find(function (x) { return x.key === key; });
  if (!e || e.col === toCol) return;
  if (e.write) { delete TODO.over[key]; e.write(toCol); todoSave(); return; }
  if (e.boardCol === "done" && toCol !== "done") { toast("Done on its board — open it there to reopen it"); return; }
  if (toCol === e.boardCol) delete TODO.over[key]; else TODO.over[key] = toCol;
  todoSave();
}

/* ---------- my own (variable) to-dos ---------- */
function todoEdit(item, col, hat, planDay, toAll) {
  openDialog(item ? "Edit to-do" : "New to-do — " + todoHat(hat).label, item ? { title: item.title, note: item.note, duedate: item.due } : {}, function (v) {
    if (!v.title) return;
    if (item) { item.title = v.title; item.note = v.note || ""; if (v.duedate) item.due = v.duedate; else delete item.due; }
    else {
      var n = { id: todoId(), title: v.title, note: v.note || "", col: col || "todo", hat: hat || "personal", created: todayISO() };
      if (v.duedate) n.due = v.duedate;
      if (n.col === "done") n.doneAt = todayISO();
      TODO.items.push(n);
      if (planDay) TODO.plan["own:" + n.id] = planDay;
      if (toAll && todoMode !== "all") toast("Added to All to be done — drag it onto a day from there");
    }
    todoSave();
  }, { duedate: true, noOwner: true, noteLabel: "Note (optional)" });
}
function todoDelete(item) {
  if (!confirm("Delete the to-do “" + item.title + "”?")) return;
  TODO.items.splice(TODO.items.indexOf(item), 1);
  delete TODO.plan["own:" + item.id];
  todoSave();
}
function todoMoveHat(item) {
  openChoice("Move “" + item.title + "” to which hat?", TODO_HATS.filter(function (h) { return h.key !== item.hat; }).map(function (h) { return { label: h.icon + " " + h.label, value: h.key }; }),
    function (k) { item.hat = k; todoSave(); });
}

/* ---------- planning: which day I'll do a card ---------- */
function todoDayLabel(iso) {
  var t = todoToday();
  return iso === t ? "Today" : iso === todoAddDays(t, 1) ? "Tomorrow" : todoDayName(iso) + " " + fmtD(iso);
}
// the day a card is planned for, or null (no day, or sent back with "-")
function todoPlanned(key) { var p = TODO.plan[key]; return p && p !== "-" ? p : null; }
function todoPlanSet(key, iso) {
  TODO.plan[key] = iso || "-";   // "-" = sent back to All to be done: kept off Today even if due / in progress
  todoSave();
}
function todoPlanPick(key, title) {
  var t = todoToday(), opts = [];
  for (var i = 0; i < 7; i++) { var iso = todoAddDays(t, i); opts.push({ label: "📅 " + todoDayLabel(iso), value: iso }); }
  if (todoPlanned(key)) opts.push({ label: "✕ No day (back to All to be done)", value: "" });
  openChoice("Which day for “" + title + "”?", opts, function (v) { todoPlanSet(key, v); });
}
// on Today's board?
//   my own to-dos: in progress / done, planned for today or earlier, or due today / overdue
//   cards assigned to me on a board: only once I've planned them for today (or earlier) —
//   until then they wait in All to be done, whatever their column or due date
// on a given day's plan? today keeps the rules below; a later day (Tomorrow) shows what's planned for it,
// plus my own to-dos due that day that aren't planned anywhere
function todoForDay(key, col, due, assigned, day) {
  if (!day || day <= todoToday()) return todoForToday(key, col, due, assigned);
  if (col === "done" || TODO.plan[key] === "-") return false;
  var p = todoPlanned(key);
  if (key.indexOf("fx:") === 0) return !!p && p <= day;   // a fixed thing comes back on each of its days once planned
  if (p) return p === day;
  return !assigned && col === "todo" && due === day;
}
// the day the clock view is showing: Today or Tomorrow
function todoViewDay() { return todoMode === "tomorrow" ? todoAddDays(todoToday(), 1) : todoToday(); }
function todoIsDayView() { return todoMode === "today" || todoMode === "tomorrow"; }
function todoForToday(key, col, due, assigned) {
  var t = todoToday(), p = todoPlanned(key);
  if (TODO.plan[key] === "-" && col !== "done") return false;   // I sent it back to All to be done
  if (assigned) return !!p && p <= t;
  if (col !== "todo") return true;
  return (!!p && p <= t) || (!!due && due <= t);
}

/* ---------- Today by the clock ---------- */
function todoHM2m(hm) { var p = String(hm || "").split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); }
function todoM2HM(m) { m = Math.max(0, Math.min(23 * 60 + 59, Math.round(m))); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
function todoTimeSet(key, hm) { if (hm) TODO.times.at[key] = hm; else delete TODO.times.at[key]; todoSave(); }
// a small window asking for one time ("" = no time)
function todoTimeAsk(title, cur, cb) {
  var inp;
  todoDialog(title, function (body) {
    inp = todoEl("input"); inp.type = "time"; inp.value = cur || "";
    body.appendChild(todoField("Time — leave empty to take the time off", inp));
  }, function () { if (inp.value) TODO.times.at[cb] = inp.value; else delete TODO.times.at[cb]; });
}
function todoHatTimeAsk(H) {
  var r = TODO.times.hats[H.key] || {}, a, b;
  todoDialog("🕘 " + H.icon + " " + H.label + " — when do you do it?", function (body) {
    a = todoEl("input"); a.type = "time"; a.value = r.from || "";
    b = todoEl("input"); b.type = "time"; b.value = r.to || "";
    body.appendChild(todoField("From", a)); body.appendChild(todoField("To", b));
    body.appendChild(todoEl("div", "hint", "Leave both empty to take the time off. Things inside this block can still get their own time."));
  }, function () {
    if (!a.value && !b.value) { delete TODO.times.hats[H.key]; return; }
    if (!a.value) return "Pick a start time.";
    if (b.value && b.value <= a.value) return "The end has to be after the start.";
    TODO.times.hats[H.key] = b.value ? { from: a.value, to: b.value } : { from: a.value };
  });
}
// the 🕘 handle on New learning / Deep thinking / Reasoning: drag it onto the day, or click to type a time
function todoBoxTimeBtn(k) { return todoTimeHandle("box:" + k, "🕘 Give a time"); }
function todoTimeHandle(key, emptyLabel) {
  var t = TODO.times.at[key];
  var b = todoEl("button", "td-act td-timebtn", t ? "🕘 " + todoFmtHM(t) : emptyLabel);
  b.title = "Drag onto a gap in Today to place it there, or click to type a time";
  b.draggable = true;
  b.addEventListener("dragstart", function (ev) { try { ev.dataTransfer.setData("text/plain", key); } catch (_) { } ev.dataTransfer.effectAllowed = "move"; });
  b.onclick = function () { todoTimeAsk("🕘 When will you do it?", t, key); };
  return b;
}
// on Today, a New learning box with its own time ("learn:<part>") leaves the big box and sits on the day
function todoLearnPartTimed(P) { return todoIsDayView() && !!TODO.times.at["learn:" + P.key]; }
// Today: timed blocks and things in clock order, gaps between them to drop onto, untimed blocks after
function todoDayPlan(assigned, boxes, day) {
  var wrap = todoEl("div", "td-dayplan");
  var today = day || todoToday(), isToday = today === todoToday(), at = TODO.times.at, now = isToday ? todoNowHM() : "";
  var slotted = {}, timed = [], untimed = [];
  var BOX = { learn: todoLearnBox, deep: todoDeepBox, reason: todoReasonBox };
  // a later day shows the daily boxes as quiet reminders of where they sit (they can only be done on the day)
  var ghost = function (txt) { return function () { return todoEl("div", "td-ghost", txt); }; };
  var NAMES = { learn: "📚 New learning", deep: "🧘 " + todoBoxText("deep").title + " · " + todoFmtLen(TODO.settings.deepMin), reason: "♟️ " + todoBoxText("reason").title };
  if (!isToday) boxes = ["learn", "deep", "reason"].filter(function (k) { return at["box:" + k]; });
  boxes.forEach(function (k) { timed.push({ t: at["box:" + k], key: "box:" + k, H: todoHat("personal"), el: isToday ? BOX[k] : ghost(NAMES[k]) }); });
  todoLearnParts().forEach(function (P) {
    var k = "learn:" + P.key;
    if (at[k]) timed.push({ t: at[k], key: k, H: todoHat("personal"), part: P, el: isToday ? function () { var b = todoLearnPartBox(P, today); b.classList.add("td-lp-solo"); return b; } : ghost((P.icon ? P.icon + " " : "") + P.label) });
  });
  TODO_DAY_BLOCKS.forEach(function (H) {
    var r = TODO.times.hats[H.key];
    if (r && r.from) timed.push({ t: r.from, end: r.to || todoM2HM(todoHM2m(r.from) + 60), hat: H });
    else untimed.push(H);
    TODO.items.forEach(function (x) {
      var k = "own:" + x.id;
      if (todoIn(H, x.hat) && x.col !== "done" && at[k] && todoForDay(k, x.col, x.due, false, today)) { slotted[k] = 1; timed.push({ t: at[k], key: k, H: H, el: function () { return todoCard(null, x); } }); }
    });
    assigned.forEach(function (e) {
      if (todoIn(H, e.hat) && e.col !== "done" && at[e.key] && todoForDay(e.key, e.col, e.due, true, today)) { slotted[e.key] = 1; timed.push({ t: at[e.key], key: e.key, H: H, el: function () { return todoCard(e); } }); }
    });
  });
  timed.sort(function (a, b) { return a.t.localeCompare(b.t) || (a.hat ? -1 : 0) - (b.hat ? -1 : 0); });
  var endOf = function (e) { return e.end || todoM2HM(todoHM2m(e.t) + 30); };
  // each row: a time rail on the left (dot on a line, click the time to change it) and the thing itself
  var row = function (cls, rail, body) {
    var r = todoEl("div", "td-row " + cls);
    r.append(rail, body); wrap.appendChild(r); return r;
  };
  var gap = function (prev, next) {
    var t = prev ? endOf(prev) : next ? todoM2HM(todoHM2m(next.t) - 30) : "09:00";
    if (next && t > next.t) t = next.t;
    var g = todoEl("div", "td-gap" + (prev || next ? "" : " first"));
    g.appendChild(todoEl("span", "", prev || next ? "Drop here · " + todoFmtHM(t) : "Drag anything here (a card, Running, New learning…) or set a time on a block to plan your day by the clock"));
    g.addEventListener("dragover", function (ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; g.classList.add("kover"); });
    g.addEventListener("dragleave", function () { g.classList.remove("kover"); });
    g.addEventListener("drop", function (ev) { ev.preventDefault(); g.classList.remove("kover"); var k = ""; try { k = ev.dataTransfer.getData("text/plain"); } catch (_) { } if (k) todoTimeSet(k, t); });
    row("gaprow", todoEl("div", "td-rail"), g);
  };
  var rail = function (label, sub, onEdit, onClear) {
    var r = todoEl("div", "td-rail");
    var t = todoEl("button", "td-rail-t", label); t.title = "Change the time"; t.onclick = onEdit;
    r.appendChild(t);
    if (sub) r.appendChild(todoEl("span", "td-rail-sub", sub));
    if (onClear) { var x = todoEl("button", "td-rail-x", "✕ no time"); x.title = "Take the time off — back into its block"; x.onclick = onClear; r.appendChild(x); }
    return r;
  };
  if (!timed.length) gap(null, null);
  timed.forEach(function (e, i) {
    if (i === 0) gap(null, e);
    if (e.hat) {
      var H = e.hat, rr = row("hatrow" + (now >= e.t && now < e.end ? " now" : ""),
        rail(todoFmtHM(e.t), "to " + todoFmtHM(e.end), function () { todoHatTimeAsk(H); }), todoHatBlock(H, assigned, slotted, today));
    } else {
      var body = todoEl("div", "td-row-item"); body.appendChild(e.el());
      if (e.H.key !== "personal" || (e.key.indexOf("box:") !== 0 && !e.part)) body.appendChild(todoEl("span", "td-row-hat", e.H.icon + " " + e.H.label));
      var late = isToday && now > e.t && (e.key === "box:learn" ? !todoLearnedToday() : e.part ? !todoLearnPart(today, e.part.key) : false);
      row("itemrow" + (e.key.indexOf("box:") === 0 || e.part ? " boxrow" : "") + (late ? " late" : ""), rail(todoFmtHM(e.t), "", function () { todoTimeAsk("🕘 When?", e.t, e.key); }, function () { todoTimeSet(e.key, ""); }), body);
    }
    gap(e, timed[i + 1] || null);
  });
  untimed.forEach(function (H) {
    row("hatrow anytime", rail("Any time", "set a time", function () { todoHatTimeAsk(H); }), todoHatBlock(H, assigned, slotted, today));
  });
  return wrap;
}

/* ---------- counts (Summary tab, sidebar) ---------- */
function todoCounts() {
  var c = { todo: 0, progress: 0, done: 0 }, t = todoToday();
  todoAssigned().forEach(function (e) { c[e.col]++; });
  TODO.items.forEach(function (x) { c[x.col]++; });
  todoFixedFor(null, t).forEach(function (f) { c[todoFixedIsDone(f, t) ? "done" : "todo"]++; });   // today's fixed things
  return c;
}

/* ---------- cards ---------- */
function todoDueChip(due, col) {
  if (!due) return null;
  var t = todoToday();
  var late = col !== "done" && due < t;
  return todoEl("span", "td-due" + (late ? " late" : due === t ? " today" : ""), "📅 " + (due === t ? "Today" : due === todoAddDays(t, 1) ? "Tomorrow" : fmtD(due)));
}
function todoCard(entry, own) {
  var key = own ? "own:" + own.id : entry.key;
  var col = own ? own.col : entry.col;
  var card = todoEl("div", "kcard td-card" + (col === "done" ? " td-done" : ""));
  card.draggable = true;
  card.addEventListener("dragstart", function (ev) { card.classList.add("kdragging"); try { ev.dataTransfer.setData("text/plain", key); } catch (_) { } ev.dataTransfer.effectAllowed = "move"; });
  card.addEventListener("dragend", function () { card.classList.remove("kdragging"); });
  var t = todoEl("div", "kt", own ? own.title : entry.title || "(untitled)");
  card.appendChild(t);
  if (own && own.note) card.appendChild(todoEl("div", "kn", own.note));
  var meta = todoEl("div", "kcard-meta");
  if (own) meta.appendChild(todoEl("span", "td-src own", "✏️ My to-do"));
  else {
    var s = todoEl("button", "td-src", entry.icon + " " + entry.src + " · " + entry.where);
    s.title = "Open it on its board"; s.onclick = function (ev) { ev.stopPropagation(); entry.open(); };
    meta.appendChild(s);
  }
  var dc = todoDueChip(own ? own.due : entry.due, col); if (dc) meta.appendChild(dc);
  var pl = todoPlanned(key);
  if (pl && col !== "done") {
    var tdy = todoToday();
    meta.appendChild(todoEl("span", "td-plan" + (pl <= tdy ? " now" : ""), "🗓 " + (pl < tdy ? "Today (from " + fmtD(pl) + ")" : todoDayLabel(pl))));
  }
  card.appendChild(meta);
  var acts = todoEl("div", "td-acts");
  if (own) {
    var ed = todoEl("button", "td-act", "Edit"); ed.onclick = function (ev) { ev.stopPropagation(); todoEdit(own); };
    var mh = todoEl("button", "td-act", "Hat…"); mh.title = "Move to another hat"; mh.onclick = function (ev) { ev.stopPropagation(); todoMoveHat(own); };
    var dl = todoEl("button", "td-act danger", "Delete"); dl.onclick = function (ev) { ev.stopPropagation(); todoDelete(own); };
    acts.append(ed, mh, dl);
  } else {
    var op = todoEl("button", "td-act", entry.fixed ? "⚙️ Edit" : "Open ↗"); if (entry.fixed) op.title = "Change its name, days or time"; op.onclick = function (ev) { ev.stopPropagation(); entry.open(); };
    acts.appendChild(op);
  }
  if (col !== "done" && todoIsDayView()) {
    var back = todoEl("button", "td-act", "↩ All to be done"); back.title = "Take it off Today — it waits in All to be done";
    back.onclick = function (ev) { ev.stopPropagation(); todoPlanSet(key, ""); toast("Moved to All to be done"); };
    back.title = "Take it off " + (todoMode === "tomorrow" ? "Tomorrow" : "Today") + " — it waits in All to be done";
    acts.appendChild(back);
  }
  if (col !== "done" && todoIsDayView()) {
    var tt = TODO.times.at[key];
    var tb = todoEl("button", "td-act td-timebtn", tt ? "🕘 " + todoFmtHM(tt) : "🕘 Time…"); tb.title = "Give it its own time on Today (or drag it onto a gap)";
    tb.onclick = function (ev) { ev.stopPropagation(); todoTimeAsk("🕘 When will you do “" + (own ? own.title : entry.title) + "”?", tt, key); };
    acts.appendChild(tb);
  }
  if (col !== "done" && todoMode === "all" && !(todoPlanned(key) && todoPlanned(key) <= todoToday())) {
    var tg = todoEl("button", "td-act td-totoday", "→ Today"); tg.title = "Do it today — it moves onto Today";
    tg.onclick = function (ev) { ev.stopPropagation(); todoPlanSet(key, todoToday()); toast("Moved to Today"); };
    acts.appendChild(tg);
    if (todoPlanned(key) !== todoAddDays(todoToday(), 1)) {
      var tm2 = todoEl("button", "td-act td-totoday", "→ Tomorrow"); tm2.title = "Plan it for tomorrow";
      tm2.onclick = function (ev) { ev.stopPropagation(); todoPlanSet(key, todoAddDays(todoToday(), 1)); toast("Moved to Tomorrow"); };
      acts.appendChild(tm2);
    }
  }
  if (col !== "done") {
    var pd = todoEl("button", "td-act", "📅 Day…"); pd.title = "Pick the day you'll do it";
    pd.onclick = function (ev) { ev.stopPropagation(); todoPlanPick(key, own ? own.title : entry.title || "(untitled)"); };
    acts.appendChild(pd);
  }
  // quick move without dragging (phones)
  TODO_COLS.forEach(function (c) {
    if (c.key === col) return;
    var b = todoEl("button", "td-act", "→ " + c.label);
    b.onclick = function (ev) { ev.stopPropagation(); todoMove(key, c.key); };
    acts.appendChild(b);
  });
  card.appendChild(acts);
  if (own) t.onclick = function () { todoEdit(own); };
  else { t.style.cursor = "pointer"; t.onclick = function () { entry.open(); }; }
  return card;
}

/* ---------- Today: the three hats ---------- */
function todoHatMenu(anchor, hat) {
  var B = typeof hat === "string" ? { key: hat } : hat;   // a hat key, or a Today block (Dubuddy Work = two hats)
  if (typeof openDiscPick === "function") {
    openDiscPick(anchor, { current: null, options: [
      { key: "fixed", label: "⚙️ Set up fixed things" },
      { key: "add", label: "＋ Add a to-do" },
    ], onPick: function (k) { todoWithHat(B, function (h) { if (k === "fixed") todoFixedSetup(h); else if (k === "add") todoEdit(null, "todo", h, null, true); }); } });
  } else todoWithHat(B, todoFixedSetup);
}
function todoHatBlock(H, assigned, slotted, day) {
  slotted = slotted || {};
  var today = day || todoToday();
  var sec = todoEl("section", "td-hat th-" + H.key);
  var head = todoEl("div", "td-hat-h");
  head.appendChild(todoEl("h2", "", H.icon + " " + H.label));
  // To do shows only what's planned / due for today; the rest waits in All to be done
  var allMine = TODO.items.filter(function (x) { return todoIn(H, x.hat); });
  var allTheirs = assigned.filter(function (e) { return todoIn(H, e.hat); });
  var mine = allMine.filter(function (x) { return todoForDay("own:" + x.id, x.col, x.due, false, today) && !slotted["own:" + x.id]; });
  var theirs = allTheirs.filter(function (e) { return todoForDay(e.key, e.col, e.due, true, today) && !slotted[e.key]; });
  var waiting = allMine.filter(function (x) { return x.col !== "done" && !todoForDay("own:" + x.id, x.col, x.due, false, today) && !(todoPlanned("own:" + x.id) && todoPlanned("own:" + x.id) < today); }).length
    + allTheirs.filter(function (e) { return e.col !== "done" && !todoForDay(e.key, e.col, e.due, true, today) && !(todoPlanned(e.key) && todoPlanned(e.key) < today); }).length;   // timed ones sit on the day, not waiting
  var open = mine.concat(theirs).filter(function (x) { return x.col !== "done"; }).length;
  head.appendChild(todoEl("span", "td-hat-n", open + " open"));
  var hr = TODO.times.hats[H.key];
  var tbtn = todoEl("button", "td-act td-timebtn" + (hr ? " on" : ""), hr ? "🕘 " + todoFmtHM(hr.from) + (hr.to ? " – " + todoFmtHM(hr.to) : "") : "🕘 Set time");
  tbtn.title = "When do you do this block?"; tbtn.onclick = function () { todoHatTimeAsk(H); };
  head.appendChild(tbtn);
  var more = todoEl("button", "td-more", "⋯"); more.title = "Set up fixed things · add a to-do";
  more.onclick = function (ev) { ev.stopPropagation(); todoHatMenu(more, H); };
  head.appendChild(more);
  sec.appendChild(head);
  // fixed things are cards on the board below; a hint only until any are set up
  if (!TODO.fixed.some(function (f) { return todoIn(H, f.hat); })) {
    var fxRow = todoEl("div", "td-fxrow-today"), hint = todoEl("button", "td-fx-hint", "＋ Set up fixed things (⋯)");
    hint.onclick = function () { todoWithHat(H, todoFixedSetup); };
    fxRow.appendChild(hint); sec.appendChild(fxRow);
  }
  // variable: To do · In progress · Done
  var board = todoEl("div", "kanban td-board");
  TODO_COLS.forEach(function (c) {
    var col = todoEl("div", "kcol td-col tc-" + c.key);
    col.addEventListener("dragover", function (ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; col.classList.add("kover"); });
    col.addEventListener("dragleave", function (ev) { if (ev.target === col) col.classList.remove("kover"); });
    col.addEventListener("drop", function (ev) { ev.preventDefault(); col.classList.remove("kover"); var k = ""; try { k = ev.dataTransfer.getData("text/plain"); } catch (_) { } if (k) todoMove(k, c.key, (H.hats || [H.key]).length === 1 ? (H.hats || [H.key])[0] : null); });
    var m = mine.filter(function (x) { return x.col === c.key; });
    var th = theirs.filter(function (e) { return e.col === c.key; });
    var hd = todoEl("div", "kcol-head"); hd.innerHTML = "<b></b><span class=\"cnt\"></span>";
    hd.querySelector("b").textContent = c.key === "todo" ? "Variable · To do" : c.label; hd.querySelector(".cnt").textContent = m.length + th.length;
    col.appendChild(hd);
    var byDue = function (a, b) { return String(a.due || "9999").localeCompare(String(b.due || "9999")); };
    if (c.key === "done") {
      var cards = m.slice().sort(function (a, b) { return String(b.doneAt || "").localeCompare(String(a.doneAt || "")); }).map(function (x) { return todoCard(null, x); })
        .concat(th.map(function (e) { return todoCard(e); }));
      var total = cards.length;
      if (!todoShowAllDone[H.key]) cards = cards.slice(0, TODO_DONE_SHOW);
      cards.forEach(function (k) { col.appendChild(k); });
      if (total > TODO_DONE_SHOW) {
        var mb = todoEl("button", "addline k-add", todoShowAllDone[H.key] ? "Show fewer" : "Show all " + total);
        mb.onclick = function () { todoShowAllDone[H.key] = !todoShowAllDone[H.key]; renderAll(); };
        col.appendChild(mb);
      }
    } else {
      m.slice().sort(byDue).forEach(function (x) { col.appendChild(todoCard(null, x)); });
      th.slice().sort(byDue).forEach(function (e) { col.appendChild(todoCard(e)); });
      var add = todoEl("button", "addline k-add", "＋ Add to-do");
      add.onclick = function () { todoWithHat(H, function (h) { todoEdit(null, c.key, h, today); }); };
      col.appendChild(add);
      if (c.key === "todo" && waiting) {
        var wb = todoEl("button", "td-fx-hint", "＋ Pick from " + waiting + " in All to be done");
        wb.onclick = function () { todoMode = "all"; renderAll(); };
        col.appendChild(wb);
      }
    }
    board.appendChild(col);
  });
  sec.appendChild(board);
  return sec;
}

/* ---------- All to be done: every open thing, hat by hat ---------- */
function todoAllOpen(assigned) {
  var wrap = todoEl("div", "td-up");
  var today = todoToday();
  // the days to drop cards on
  var strip = todoEl("div", "td-plan-strip");
  strip.appendChild(todoEl("span", "td-lbl", "Drag onto a day"));
  var openKeys = TODO.items.filter(function (x) { return x.col !== "done"; }).map(function (x) { return "own:" + x.id; })
    .concat(assigned.filter(function (e) { return e.col !== "done"; }).map(function (e) { return e.key; }));
  var slot = function (iso, label) {
    var b = todoEl("div", "td-dayslot" + (iso === "" ? " none" : ""));
    var n = openKeys.filter(function (k) { var p = todoPlanned(k); return iso === today ? !!p && p <= today : p === iso; }).length;
    b.appendChild(todoEl("b", "", label));
    if (iso) b.appendChild(todoEl("span", "", n ? n + " planned" : "—"));
    b.addEventListener("dragover", function (ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; b.classList.add("kover"); });
    b.addEventListener("dragleave", function () { b.classList.remove("kover"); });
    b.addEventListener("drop", function (ev) { ev.preventDefault(); b.classList.remove("kover"); var k = ""; try { k = ev.dataTransfer.getData("text/plain"); } catch (_) { } if (k) todoPlanSet(k, iso); });
    strip.appendChild(b);
  };
  for (var i = 0; i < 7; i++) { var iso = todoAddDays(today, i); slot(iso, todoDayLabel(iso)); }
  slot("", "✕ No day");
  wrap.appendChild(strip);
  // in progress first, then not yet planned (to pick from), then planned by day; due date breaks ties
  var rank = function (k, x) { var p = todoPlanned(k); return (x.col === "progress" ? "0" : p ? "2" + p : "1") + String(x.due || "9999"); };
  TODO_HATS.forEach(function (H) {
    var cards = TODO.items.filter(function (x) { return x.hat === H.key && x.col !== "done"; }).map(function (x) { return { r: rank("own:" + x.id, x), el: function () { return todoCard(null, x); } }; })
      .concat(assigned.filter(function (e) { return e.hat === H.key && e.col !== "done"; }).map(function (e) { return { r: rank(e.key, e), el: function () { return todoCard(e); } }; }))
      .sort(function (a, b) { return a.r.localeCompare(b.r); });
    // every hat shows here, empty or not, so I can write things into it and plan them later
    var sec = todoEl("div", "td-upday");
    var hd = todoEl("div", "td-all-h");
    hd.appendChild(todoEl("h3", "", H.icon + " " + H.label));
    hd.appendChild(todoEl("span", "td-hat-n", cards.length + " to do"));
    var more = todoEl("button", "td-more", "⋯"); more.title = "Set up fixed things · add a to-do";
    more.onclick = function (ev) { ev.stopPropagation(); todoHatMenu(more, H.key); };
    hd.appendChild(more);
    sec.appendChild(hd);
    if (cards.length) {
      var grid = todoEl("div", "td-all-grid");
      cards.forEach(function (c) { grid.appendChild(c.el()); });
      sec.appendChild(grid);
    }
    var add = todoEl("button", "addline k-add td-all-add", "＋ Add to-do — " + H.label);
    add.onclick = function () { todoEdit(null, "todo", H.key); };   // no day yet: it waits here until I pick one
    sec.appendChild(add);
    wrap.appendChild(sec);
  });
  return wrap;
}

/* ---------- Upcoming: tomorrow / next 5 / next 7 days ---------- */
function todoUpcoming(assigned) {
  var wrap = todoEl("div", "td-up");
  var today = todoToday();
  var start = todoAddDays(today, 1), end = todoAddDays(today, todoRange);
  var due = [];
  // a card shows on the day I planned it (from today on), otherwise on its due date
  var dayOf = function (k, d) { if (TODO.plan[k] === "-") return null; var p = todoPlanned(k); return p && p >= today ? p : d; };
  var tag = function (k, src) { var p = todoPlanned(k); return p && p >= today ? src + " · 🗓 planned" : src; };
  TODO.items.forEach(function (x) { var k = "own:" + x.id, d = dayOf(k, x.due); if (d && x.col !== "done") due.push({ due: d, title: x.title, hat: x.hat, src: tag(k, "✏️ My to-do"), open: function () { todoEdit(x); } }); });
  assigned.forEach(function (e) { var d = dayOf(e.key, e.due); if (d && e.col !== "done") due.push({ due: d, title: e.title, hat: e.hat, src: tag(e.key, e.icon + " " + e.src + " · " + e.where), open: e.open }); });
  var row = function (d, sub) {
    var r = todoEl("button", "td-uprow");
    r.appendChild(todoEl("span", "td-uphat", todoHat(d.hat).icon));
    var tx = todoEl("span", "td-uptx"); tx.appendChild(todoEl("b", "", d.title)); tx.appendChild(todoEl("span", "", sub || d.src));
    r.appendChild(tx); r.onclick = d.open; return r;
  };
  // overdue first
  var late = due.filter(function (d) { return d.due < today; }).sort(function (a, b) { return a.due.localeCompare(b.due); });
  if (late.length) {
    var lb = todoEl("div", "td-upday late"); lb.appendChild(todoEl("h3", "", "⚠️ Overdue"));
    late.forEach(function (d) { lb.appendChild(row(d, d.src + " · was due " + fmtD(d.due))); });
    wrap.appendChild(lb);
  }
  for (var iso = start; iso <= end; iso = todoAddDays(iso, 1)) {
    (function (iso) {
      var day = todoEl("div", "td-upday");
      day.appendChild(todoEl("h3", "", (iso === todoAddDays(today, 1) ? "Tomorrow · " : "") + todoDayName(iso) + " " + fmtD(iso)));
      var fx = todoFixedFor(null, iso);
      var dd = due.filter(function (d) { return d.due === iso; });
      if (fx.length) {
        var fr = todoEl("div", "td-upfx");
        fx.forEach(function (f) { fr.appendChild(todoFixedChip(f, iso, true)); });
        day.appendChild(fr);
      }
      dd.forEach(function (d) { day.appendChild(row(d)); });
      if (!fx.length && !dd.length) day.appendChild(todoEl("div", "td-empty", "Nothing planned."));
      wrap.appendChild(day);
    })(iso);
  }
  return wrap;
}

/* ---------- Personal settings (each card's ⋯): learning boxes, how many unlock, timer lengths ---------- */
var TODO_LEARN_DEFAULT = [
  { key: "ai", icon: "🤖", label: "AI & automation", ph: "What did you learn about AI or automation today? A tool, a trick, a model, a workflow…" },
  { key: "world", icon: "🌍", label: "What's happening in the world", ph: "One thing happening in the world (or in AI) and why it matters…" },
  { key: "social", icon: "🐦", label: "Twitter / LinkedIn — top 3 posts", ph: "1. Who — what they said / link\n2. …\n3. …" },
  { key: "edtech", icon: "🎓", label: "EdTech & education", ph: "Something new in EdTech, education or our field — a competitor move, a study, an idea…" },
];
// TODO.settings = { learnParts:[{key,icon,label,ph}], learnNeed:n (0 = never freeze), deepMin, reasonMins:[…] }
function todoSettingsNorm(s) {
  s = s && typeof s === "object" ? s : {};
  // my own words on the Deep thinking / Reasoning cards: { deep: { title, line }, reason: { title, line } }
  var bt = s.boxText && typeof s.boxText === "object" ? s.boxText : {};
  s.boxText = {};
  ["deep", "reason"].forEach(function (k) {
    var v = bt[k] && typeof bt[k] === "object" ? bt[k] : {}, o = {};
    if (typeof v.title === "string" && v.title.trim()) o.title = v.title.trim().slice(0, 80);
    if (typeof v.line === "string" && v.line.trim()) o.line = v.line.trim().slice(0, 400);
    s.boxText[k] = o;
  });
  var parts = Array.isArray(s.learnParts) ? s.learnParts.filter(function (p) { return p && p.key && p.label; }) : [];
  s.learnParts = parts.length ? parts.slice(0, 8) : TODO_LEARN_DEFAULT.map(function (p) { return Object.assign({}, p); });
  s.learnNeed = typeof s.learnNeed === "number" ? Math.max(0, Math.min(s.learnParts.length, Math.round(s.learnNeed))) : s.learnParts.length;
  s.deepMin = Math.max(5, Math.min(600, Math.round(Number(s.deepMin) || 120)));
  var rm = Array.isArray(s.reasonMins) ? s.reasonMins.map(Number).filter(function (n) { return n >= 5 && n <= 600; }).map(Math.round) : [];
  s.reasonMins = rm.length ? rm.slice(0, 4) : [30, 60, 120];
  s.wakeAt = /^\d{2}:\d{2}$/.test(s.wakeAt || "") ? s.wakeAt : "06:00";    // ⏰ first thing in My To-do
  s.sleepAt = /^\d{2}:\d{2}$/.test(s.sleepAt || "") ? s.sleepAt : "21:00";  // 🌙 last thing
  return s;
}
function todoLearnParts() { return TODO.settings.learnParts; }
function todoLearnNeed() { return TODO.settings.learnNeed; }
function todoFmtLen(m) { return m % 60 === 0 ? (m / 60) + (m === 60 ? " hour" : " hours") : m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"; }

/* a small settings window */
function todoDialog(title, build, onSave) {
  var ov = todoEl("div", "overlay show"), dg = todoEl("div", "dialog td-setdlg");
  dg.setAttribute("role", "dialog"); dg.setAttribute("aria-modal", "true"); ov.appendChild(dg);
  dg.appendChild(todoEl("h3", "", title));
  var body = todoEl("div", "dlg-body"); dg.appendChild(body);
  var err = todoEl("div", "hint err"); err.style.cssText = "color:var(--blocked);min-height:16px";
  build(body);
  body.appendChild(err);
  var close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  ov.onclick = function (e) { if (e.target === ov) close(); };
  var btns = todoEl("div", "btns"), cl = todoEl("button", "btn", "Cancel"), sv = todoEl("button", "btn save", "Save");
  cl.onclick = close;
  sv.onclick = function () { var msg = onSave(); if (msg) { err.textContent = msg; return; } close(); todoSave(); };
  btns.append(cl, sv); dg.appendChild(btns);
  document.body.appendChild(ov);
}
function todoField(label, input) { var f = todoEl("div", "field"); f.appendChild(todoEl("label", "", label)); f.appendChild(input); return f; }
function todoMoreBtn(title, fn) { var b = todoEl("button", "td-more", "⋯"); b.title = title; b.onclick = function (e) { e.stopPropagation(); fn(); }; return b; }

function todoLearnSettings() {
  var S = TODO.settings, rows = S.learnParts.map(function (p) { return Object.assign({}, p); }), list, need;
  var draw = function () {
    list.innerHTML = "";
    rows.forEach(function (p, i) {
      var r = todoEl("div", "td-setrow");
      var ic = todoEl("input", "td-set-ic"); ic.value = p.icon || ""; ic.maxLength = 3; ic.title = "Icon (an emoji)"; ic.oninput = function () { p.icon = ic.value.trim(); };
      var nm = todoEl("input", "td-set-nm"); nm.value = p.label; nm.placeholder = "What to learn about"; nm.oninput = function () { p.label = nm.value; };
      var up = todoEl("button", "td-act", "↑"); up.title = "Move up"; up.disabled = i === 0;
      up.onclick = function () { rows.splice(i - 1, 0, rows.splice(i, 1)[0]); draw(); };
      var rm = todoEl("button", "td-act danger", "Remove"); rm.disabled = rows.length <= 1;
      rm.onclick = function () { rows.splice(i, 1); draw(); };
      r.append(ic, nm, up, rm); list.appendChild(r);
    });
    var cur = Number(need.value), n = rows.length;
    need.innerHTML = "";
    for (var k = n; k >= 0; k--) { var o = todoEl("option", "", k === n ? "All " + n + " (strict)" : k === 0 ? "Never freeze" : k + " of " + n); o.value = k; need.appendChild(o); }
    need.value = String(Math.min(isNaN(cur) ? n : cur, n));
  };
  todoDialog("📚 New learning — settings", function (body) {
    body.appendChild(todoEl("div", "hint", "Rename, reorder, add or remove the learning boxes. Old days keep what you wrote."));
    list = todoEl("div", "td-setlist"); body.appendChild(list);
    var add = todoEl("button", "td-act", "＋ Add a box");
    add.onclick = function () { if (rows.length >= 8) return; rows.push({ key: "c" + Date.now().toString(36), icon: "💡", label: "", ph: "" }); draw(); var ins = list.querySelectorAll(".td-set-nm"); ins[ins.length - 1].focus(); };
    body.appendChild(add);
    need = todoEl("select"); need.value = String(S.learnNeed);
    var o0 = todoEl("option", "", ""); o0.value = String(S.learnNeed); need.appendChild(o0);
    body.appendChild(todoField("Unlock the rest of My To-do after", need));
    draw(); need.value = String(Math.min(S.learnNeed, rows.length));
  }, function () {
    var clean = rows.map(function (p) { return { key: p.key, icon: (p.icon || "").trim() || "💡", label: (p.label || "").trim(), ph: p.ph || "" }; });
    if (clean.some(function (p) { return !p.label; })) return "Give every box a name (or remove it).";
    S.learnParts = clean; S.learnNeed = Number(need.value);
    return "";
  });
}
function todoDeepSettings() {
  var S = TODO.settings, h, m;
  todoDialog("🧘 Deep thinking — settings", function (body) {
    body.appendChild(todoEl("div", "hint", "How long one deep-thinking block lasts."));
    var row = todoEl("div", "field-row");
    h = todoEl("input"); h.type = "number"; h.min = 0; h.max = 10; h.value = Math.floor(S.deepMin / 60);
    m = todoEl("input"); m.type = "number"; m.min = 0; m.max = 59; m.step = 5; m.value = S.deepMin % 60;
    row.append(todoField("Hours", h), todoField("Minutes", m)); body.appendChild(row);
  }, function () {
    var t = (Number(h.value) || 0) * 60 + (Number(m.value) || 0);
    if (t < 5 || t > 600) return "Pick between 5 minutes and 10 hours.";
    S.deepMin = Math.round(t); return "";
  });
}
function todoReasonSettings() {
  var S = TODO.settings, ins = [];
  todoDialog("♟️ Reasoning time — settings", function (body) {
    body.appendChild(todoEl("div", "hint", "Up to four buttons, in minutes. Leave a box empty to drop that button."));
    var row = todoEl("div", "td-setmins");
    for (var i = 0; i < 4; i++) { var x = todoEl("input"); x.type = "number"; x.min = 5; x.max = 600; x.step = 5; x.placeholder = "min"; x.value = S.reasonMins[i] || ""; ins.push(x); row.appendChild(x); }
    body.appendChild(todoField("Durations (minutes)", row));
  }, function () {
    var v = ins.map(function (x) { return Math.round(Number(x.value)); }).filter(function (n) { return n; });
    if (!v.length) return "Keep at least one duration.";
    if (v.some(function (n) { return n < 5 || n > 600; })) return "Each must be between 5 and 600 minutes.";
    S.reasonMins = v; return "";
  });
}

/* ---------- Personal · daily new learning (the rest stays frozen until enough boxes are written) ---------- */
// a day's entry: { <part key>: text } (older days may be one plain string — counts as complete)
function todoLearnDay(d) { var v = TODO.learn[d]; return v && typeof v === "object" ? v : (typeof v === "string" && v.trim() ? { _old: v } : {}); }
function todoLearnPart(d, k) { return String(todoLearnDay(d)[k] || "").trim(); }
function todoLearnCount(d) {
  var day = todoLearnDay(d), parts = todoLearnParts();
  if (day._old) return parts.length;
  return parts.filter(function (p) { return String(day[p.key] || "").trim(); }).length;
}
function todoLearnedOn(d) { var n = todoLearnCount(d); return n > 0 && n >= Math.max(1, todoLearnNeed()); }   // a day "counts" for the streak
function todoLearnedToday() { return todoLearnNeed() === 0 || todoLearnCount(todoToday()) >= todoLearnNeed(); }   // unlocked today
function todoLearnStreak() {
  var n = 0, d = todoToday();
  if (!todoLearnedOn(d)) d = todoAddDays(d, -1);   // today not finished yet: count up to yesterday
  while (todoLearnedOn(d)) { n++; d = todoAddDays(d, -1); }
  return n;
}
function todoLearnText(s) {   // saved learnings may carry richtext.js markdown (bold, lists)
  var d = todoEl("div", "td-learn-text");
  if (window.RT && RT.html) d.innerHTML = RT.html(s); else d.textContent = s;
  return d;
}
function todoLearnPartBox(P, today) {
  var val = todoLearnPart(today, P.key), editing = !val || todoLearnEdit[P.key];
  // one line until opened: title, status, a peek at what's saved, ✍️ Write / Open
  if (!todoLearnOpen[P.key] && !todoLearnEdit[P.key]) {
    var m = todoEl("div", "td-lp td-lp-mini" + (val ? " ok" : ""));
    var mh = todoEl("div", "td-lp-h");
    mh.appendChild(todoEl("b", "", (P.icon ? P.icon + " " : "") + P.label));
    mh.appendChild(todoEl("span", "td-lp-st", val ? "✓ Saved" : "To do"));
    if (val) mh.appendChild(todoEl("span", "td-lp-peek", String(val).replace(/\s+/g, " ")));
    else mh.appendChild(todoEl("span", "td-lp-peek"));
    mh.appendChild(todoTimeHandle("learn:" + P.key, "🕘"));
    var go = todoEl("button", val ? "td-act" : "btn save td-lp-go", val ? "Open" : "✍️ Write");
    go.onclick = function () { todoLearnOpen[P.key] = true; renderAll(); };
    mh.appendChild(go);
    m.appendChild(mh);
    return m;
  }
  var b = todoEl("div", "td-lp" + (val ? " ok" : ""));
  var h = todoEl("div", "td-lp-h");
  h.appendChild(todoEl("b", "", (P.icon ? P.icon + " " : "") + P.label));
  h.appendChild(todoEl("span", "td-lp-st", val ? "✓ Saved" : "To do"));
  h.appendChild(todoTimeHandle("learn:" + P.key, "🕘"));
  var cl = todoEl("button", "td-act td-lp-close", "▴"); cl.title = "Fold it back to one line";
  cl.onclick = function () { delete todoLearnOpen[P.key]; delete todoLearnEdit[P.key]; renderAll(); };
  h.appendChild(cl);
  b.appendChild(h);
  var fd = todoFeedBlock(P); if (fd) b.appendChild(fd);   // 📡 what the agent found for this box
  if (!editing) {
    b.appendChild(todoLearnText(val));
    var ed = todoEl("button", "td-act", "Edit"); ed.onclick = function () { todoLearnEdit[P.key] = true; renderAll(); };
    var r0 = todoEl("div", "td-learn-btns"); r0.appendChild(ed); b.appendChild(r0);
    return b;
  }
  var ta = document.createElement("textarea");
  ta.className = "td-learn-in"; ta.rows = 3; ta.value = val; ta.placeholder = P.ph || ("What did you learn about " + P.label.toLowerCase() + " today?");
  b.appendChild(ta);
  var row = todoEl("div", "td-learn-btns"), err = todoEl("span", "td-learn-err");
  if (val) { var cn = todoEl("button", "btn", "Cancel"); cn.onclick = function () { delete todoLearnEdit[P.key]; renderAll(); }; row.appendChild(cn); }
  var sv = todoEl("button", "btn save", "Save");
  sv.onclick = function () {
    var v = ta.value.trim();
    if (v.length < 10) { err.textContent = "Write at least a full sentence."; ta.focus(); return; }
    var wasOpen = todoLearnedToday();
    var day = todoLearnDay(today); if (day._old) day = {};   // today is always in parts
    day[P.key] = v; TODO.learn[today] = day;
    delete todoLearnEdit[P.key]; delete todoLearnOpen[P.key];
    todoSave();
    if (!wasOpen && todoLearnedToday()) toast("🔓 Unlocked — keep the streak going.");
    else toast("✓ Saved — " + todoLearnCount(today) + " of " + todoLearnParts().length + " done");
  };
  row.append(err, sv); b.appendChild(row);
  return b;
}
function todoLearnBox() {
  var today = todoToday(), parts = todoLearnParts(), n = todoLearnCount(today), need = todoLearnNeed(), open = todoLearnedToday();
  var box = todoEl("section", "td-learn" + (open ? " ok" : ""));
  var head = todoEl("div", "td-learn-h");
  head.appendChild(todoEl("h2", "", "👤 Personal · 📚 New learning"));
  head.appendChild(todoEl("span", "td-lp-count" + (n >= parts.length ? " ok" : ""), n + " / " + parts.length));
  var st = todoLearnStreak();
  if (st) head.appendChild(todoEl("span", "td-streak", "🔥 " + st + " day" + (st === 1 ? "" : "s") + " in a row"));
  var logB = todoEl("button", "td-act", todoLearnLog ? "Hide past learnings" : "Past learnings");
  logB.onclick = function () { todoLearnLog = !todoLearnLog; renderAll(); };
  head.appendChild(logB);
  var fb = todoEl("button", "td-act", "📡 Feeds" + (TODO.feeds.length ? " · " + TODO.feeds.length : "")); fb.title = "What the agent follows for these boxes"; fb.onclick = todoFeedsPanel;
  head.appendChild(fb);
  head.appendChild(todoBoxTimeBtn("learn"));
  head.appendChild(todoMoreBtn("Settings — boxes and how many unlock", todoLearnSettings));
  box.appendChild(head);
  var planned = todoIsDayView() && (!!TODO.times.at["box:learn"] || parts.some(todoLearnPartTimed));
  if (!open && !planned) box.appendChild(todoEl("div", "td-learn-q", "🔒 Write " + (need === parts.length ? "all " + need : need + " of " + parts.length) + " for today to unlock the rest of your to-dos."));
  var grid = todoEl("div", "td-lp-grid");
  parts.forEach(function (P) { if (!todoLearnPartTimed(P)) grid.appendChild(todoLearnPartBox(P, today)); });
  if (grid.children.length) box.appendChild(grid);
  else box.appendChild(todoEl("div", "td-empty", "Each box has its own time on Today below."));
  if (todoLearnLog) {
    var log = todoEl("div", "td-learn-log");
    var days = Object.keys(TODO.learn).filter(function (d) { return d !== today && Object.keys(todoLearnDay(d)).length; }).sort().reverse();
    if (!days.length) log.appendChild(todoEl("div", "td-empty", "Nothing yet — your past learnings will collect here."));
    days.forEach(function (d) {
      var r = todoEl("div", "td-learn-row");
      r.appendChild(todoEl("span", "td-learn-d", todoDayName(d) + " " + fmtD(d)));
      var col = todoEl("div", "td-learn-day"), day = todoLearnDay(d);
      if (day._old) col.appendChild(todoLearnText(day._old));
      Object.keys(day).forEach(function (k) {   // every part written that day, even ones since removed
        if (k === "_old" || !String(day[k] || "").trim()) return;
        var P = parts.find(function (p) { return p.key === k; }) || { icon: "💡", label: "Other" };
        var it = todoEl("div", "td-learn-item"); it.appendChild(todoEl("span", "td-learn-k", P.icon + " " + P.label));
        it.appendChild(todoLearnText(day[k])); col.appendChild(it);
      });
      r.appendChild(col); log.appendChild(r);
    });
    box.appendChild(log);
  }
  return box;
}

/* ---------- Personal · full-screen timers: deep thinking, reasoning time (the whole app freezes while one runs) ---------- */
function todoDayKey(ms) { var d = new Date(ms); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function todoFmtMins(m) { return (m >= 60 ? Math.floor(m / 60) + " h " : "") + (m % 60 ? m % 60 + " min" : "") || "0 min"; }
function todoFmtClock(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h + ":" + String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0");
}
var TODO_BOX_TEXT = {
  deep: { title: "Deep thinking", line: "Talk to yourself. Walk. Don't do anything. Everything here freezes until the time is up." },
  reason: { title: "Reasoning time", line: "Grow your reasoning: play chess, solve maths, crack puzzles. Pick how long — everything here freezes till then." },
};
function todoBoxText(kind) { return Object.assign({}, TODO_BOX_TEXT[kind], TODO.settings.boxText[kind] || {}); }
// click a card's title or line to write your own words; Enter (or clicking away) saves, Esc cancels, empty = back to the default
function todoEditable(el, kind, field, multi) {
  el.classList.add("td-editable"); el.title = "Click to write your own";
  el.tabIndex = 0;
  var open = function () {
    var cur = todoBoxText(kind)[field];
    var inp = todoEl(multi ? "textarea" : "input", "td-edit-in"); inp.value = cur; if (multi) inp.rows = 2;
    var done = false, finish = function (save) {
      if (done) return; done = true;
      if (save) {
        var v = inp.value.trim(), o = TODO.settings.boxText[kind];
        if (!v || v === TODO_BOX_TEXT[kind][field]) delete o[field]; else o[field] = v;
        todoSave();
      } else renderAll();
    };
    inp.onkeydown = function (e) { if (e.key === "Enter" && (!multi || !e.shiftKey)) { e.preventDefault(); finish(true); } else if (e.key === "Escape") finish(false); };
    inp.onblur = function () { finish(true); };
    el.replaceWith(inp); inp.focus(); inp.select();
  };
  el.onclick = open;
  el.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); open(); } };
  return el;
}
function todoDeepBox() {
  var len = TODO.settings.deepMin, box = todoEl("section", "td-deepcard");
  var tx = todoEl("div", "td-deep-tx");
  var T = todoBoxText("deep"), h = todoEl("h2", "");
  h.append("🧘 ", todoEditable(todoEl("span", "", T.title), "deep", "title"), " · " + todoFmtLen(len));
  tx.appendChild(h);
  var mins = TODO.deepLog[todoToday()] || 0;
  var sub = todoEl("div", "td-deep-sub");
  sub.appendChild(todoEditable(todoEl("span", "", T.line), "deep", "line", true));
  if (mins) sub.append("  ✅ Today: " + todoFmtMins(mins));
  tx.appendChild(sub);
  var go = todoEl("button", "btn save td-deep-go", "▶ Start " + todoFmtLen(len));
  go.onclick = function () { todoTimerStart("deep", len * 60000, todoFmtLen(len)); };
  box.append(tx, go, todoBoxTimeBtn("deep"), todoMoreBtn("Settings — how long", todoDeepSettings), todoBoxTick("deep"));
  return box;
}
function todoReasonBox() {
  var box = todoEl("section", "td-deepcard td-reasoncard");
  var tx = todoEl("div", "td-deep-tx");
  var T = todoBoxText("reason"), h = todoEl("h2", "");
  h.append("♟️ ", todoEditable(todoEl("span", "", T.title), "reason", "title"));
  tx.appendChild(h);
  var mins = TODO.reasonLog[todoToday()] || 0;
  var sub = todoEl("div", "td-deep-sub");
  sub.appendChild(todoEditable(todoEl("span", "", T.line), "reason", "line", true));
  if (mins) sub.append("  ✅ Today: " + todoFmtMins(mins));
  tx.appendChild(sub);
  var bs = todoEl("div", "td-reason-btns"), list = TODO.settings.reasonMins, mid = list[Math.floor((list.length - 1) / 2)];
  list.forEach(function (m) {
    var b = todoEl("button", "btn" + (m === mid ? " save" : ""), "▶ " + todoFmtLen(m));
    b.onclick = function () { todoTimerStart("reason", m * 60000, todoFmtLen(m)); };
    bs.appendChild(b);
  });
  box.append(tx, bs, todoBoxTimeBtn("reason"), todoMoreBtn("Settings — durations", todoReasonSettings), todoBoxTick("reason"));
  return box;
}
// the small ✓ in the corner: done it without the timer (away from the app) — counts today's time; tick again to clear it
function todoBoxTick(kind) {
  var log = todoTimerLog(kind), today = todoToday(), mins = log[today] || 0, name = todoBoxText(kind).title;
  var b = todoEl("button", "td-tick" + (mins ? " on" : ""), mins ? "✓" : "");
  b.title = mins ? "Done today (" + todoFmtMins(mins) + ") — click to clear" : "Did it without the timer? Tick it";
  b.setAttribute("aria-label", b.title);
  var add = function (m) { log[today] = (log[today] || 0) + m; todoSave(); toast("✅ " + name + " — " + todoFmtMins(m) + " counted for today"); };
  b.onclick = function (e) {
    e.stopPropagation();
    if (mins) { if (confirm("Clear today's " + name.toLowerCase() + " (" + todoFmtMins(mins) + ")?")) { delete log[today]; todoSave(); } return; }
    if (kind === "deep") { add(TODO.settings.deepMin); return; }
    openChoice("How long did you do " + name.toLowerCase() + "?", TODO.settings.reasonMins.map(function (m) { return { label: todoFmtLen(m), value: String(m) }; }), function (v) { add(Number(v)); });
  };
  return b;
}

function todoTimerStart(kind, ms, label) {
  if (TODO.deep) { todoDeepShow(); return; }   // one timer at a time
  var T = TODO_TIMERS[kind];
  var msg = kind === "deep"
    ? "Start " + (label || "2 hours") + " of deep thinking?\n\nThe app will be covered by a timer until it's over. Put the laptop away — talk to yourself, walk, don't do anything."
    : "Start " + (label || "1 hour") + " of reasoning time?\n\nThe app will be covered by a timer until it's over. Play chess, solve maths, crack a puzzle.";
  if (!confirm(msg)) return;
  var now = Date.now();
  TODO.deep = { start: now, end: now + ms, kind: kind };
  todoSave();
  todoDeepShow();
}
var _todoDeepT = null;
function todoDeepFinish(early) {
  var d = TODO.deep; if (!d) return;
  var log = todoTimerLog(d.kind), k = todoDayKey(d.start);
  log[k] = (log[k] || 0) + Math.round((Math.min(d.end, Date.now()) - d.start) / 60000);
  TODO.deep = null;
  clearInterval(_todoDeepT); _todoDeepT = null;
  todoSave();
  var ov = document.getElementById("td-deep");
  if (!ov) return;
  if (early) { ov.remove(); document.body.style.overflow = ""; return; }
  ov.querySelector(".td-deep-clock").textContent = "Done";
  ov.querySelector(".td-deep-line").textContent = (TODO_TIMERS[d.kind] || TODO_TIMERS.deep).done;
  ov.querySelector(".td-deep-bar i").style.width = "100%";
  var end = ov.querySelector(".td-deep-end"); end.textContent = "Back to work"; end.className = "td-deep-back";
  end.onclick = function () { ov.remove(); document.body.style.overflow = ""; };
}
function todoDeepShow() {
  var d = TODO.deep; if (!d) return;
  if (Date.now() >= d.end) { todoDeepFinish(false); return; }
  var T = Object.assign({}, TODO_TIMERS[d.kind] || TODO_TIMERS.deep, TODO.settings.boxText[d.kind === "reason" ? "reason" : "deep"] || {});   // only words I wrote myself
  var ov = document.getElementById("td-deep");
  if (!ov) {
    ov = todoEl("div", "td-deep" + (d.kind === "reason" ? " reason" : "")); ov.id = "td-deep"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = "<div class=\"td-deep-in\"><div class=\"td-deep-ic\"></div><div class=\"td-deep-h\"></div>"
      + "<div class=\"td-deep-line\"></div><div class=\"td-deep-clock\"></div>"
      + "<div class=\"td-deep-bar\"><i></i></div><div class=\"td-deep-until\"></div><button class=\"td-deep-end\">End early</button></div>";
    ov.querySelector(".td-deep-ic").textContent = T.icon;
    ov.querySelector(".td-deep-h").textContent = T.title;
    ov.querySelector(".td-deep-line").textContent = T.line;
    ov.querySelector(".td-deep-end").onclick = function () {
      if (confirm("End " + T.title.toLowerCase() + " early?\n\nThe whole point is to stay with it. Only stop if something truly can't wait.")) todoDeepFinish(true);
    };
    // nothing behind the curtain can be reached by keyboard either
    ov.addEventListener("keydown", function (e) { if (e.key === "Tab") { e.preventDefault(); ov.querySelector("button").focus(); } }, true);
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  var until = new Date(d.end);
  ov.querySelector(".td-deep-until").textContent = "Until " + until.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  var tick = function () {
    if (!TODO.deep) return;
    var left = TODO.deep.end - Date.now();
    if (left <= 0) { todoDeepFinish(false); return; }
    ov.querySelector(".td-deep-clock").textContent = todoFmtClock(left);
    ov.querySelector(".td-deep-bar i").style.width = (100 - left / (TODO.deep.end - TODO.deep.start) * 100).toFixed(2) + "%";
  };
  tick();
  clearInterval(_todoDeepT); _todoDeepT = setInterval(tick, 1000);
}

/* ---------- 📡 Feeds: the agent that follows links for me (supabase/functions/feed-fetch) ----------
   TODO.feeds      [{ id, url, box (learning part key), name, kind, feedUrl (RSS link for X / LinkedIn, or
                     what the agent found), status, title, error, checked }]
   TODO.feedItems  { sourceId: [{ id, title, link, date, author }] } — latest 10 per source
   TODO.feedSeen   { "<sourceId>|<itemId>": "YYYY-MM-DD" } — what I've ticked off (kept ~60 days)
   TODO.feedAt     last time the agent ran (ms); it runs on open if older than 30 min, or on "Check now". */
var TODO_FEED_EVERY = 30 * 60 * 1000;
var todoFeedBusy = false, todoFeedOpen = {};   // box key -> show all new items
function todoFeedKind(url) {
  var h = ""; try { h = new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, ""); } catch (_) { return "bad"; }
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) return "youtube";
  if (/(^|\.)(x|twitter)\.com$/.test(h)) return "x";
  if (/(^|\.)linkedin\.com$/.test(h)) return "linkedin";
  return "web";
}
var TODO_FEED_KINDS = { youtube: "▶️ YouTube", x: "𝕏 Twitter / X", linkedin: "in LinkedIn", web: "🌐 Website" };
function todoFeedName(s) { return s.name || s.title || (function () { try { var u = new URL(s.url); return u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, "") : ""); } catch (_) { return s.url; } })(); }
function todoFeedNew(boxKey) {
  var out = [];
  TODO.feeds.forEach(function (s) {
    if (s.box !== boxKey) return;
    (TODO.feedItems[s.id] || []).forEach(function (it) {
      if (TODO.feedSeen[s.id + "|" + it.id]) return;
      out.push({ src: s, it: it });
    });
  });
  return out.sort(function (a, b) { return String(b.it.date || "").localeCompare(String(a.it.date || "")); });
}
function todoFeedSeen(list) { var t = todoToday(); list.forEach(function (x) { TODO.feedSeen[x.src.id + "|" + x.it.id] = t; }); todoSave(); }
function todoAgo(iso) {
  var t = Date.parse(iso); if (isNaN(t)) return "";
  var m = Math.round((Date.now() - t) / 60000);
  return m < 60 ? Math.max(1, m) + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago";
}
async function todoFeedRun(force) {
  if (todoFeedBusy || !SUPA || !TODO.feeds.length) return;
  if (!force && Date.now() - (TODO.feedAt || 0) < TODO_FEED_EVERY) return;
  todoFeedBusy = true; if (force) renderAll();
  try {
    var r = await SUPA.functions.invoke("feed-fetch", { body: { sources: TODO.feeds.map(function (s) { return { id: s.id, url: s.url, feedUrl: s.feedUrl || "" }; }) } });
    var res = r && r.data && r.data.results;
    if (!res) throw new Error((r && r.error && r.error.message) || "no answer");
    var first = {};
    TODO.feeds.forEach(function (s) {
      var x = res[s.id]; if (!x) return;
      s.status = x.status; s.error = x.error || ""; s.checked = Date.now();
      if (x.feedUrl && s.kind !== "x" && s.kind !== "linkedin") s.feedUrl = x.feedUrl;
      if (x.title && !s.title) s.title = x.title;
      if (x.status === "ok") {
        var had = !!TODO.feedItems[s.id];
        TODO.feedItems[s.id] = (x.items || []).slice(0, 10);
        // the first time a source is checked, everything older than 3 days counts as already seen
        if (!had) { var cut = Date.now() - 3 * 86400000; TODO.feedItems[s.id].forEach(function (it) { if (!it.date || Date.parse(it.date) < cut) first[s.id + "|" + it.id] = todoToday(); }); }
      }
    });
    Object.keys(first).forEach(function (k) { TODO.feedSeen[k] = first[k]; });
    TODO.feedAt = Date.now();
    var cutSeen = todoAddDays(todoToday(), -60);
    Object.keys(TODO.feedSeen).forEach(function (k) { if (TODO.feedSeen[k] < cutSeen) delete TODO.feedSeen[k]; });
    if (force) toast("📡 Feeds checked");
  } catch (e) {
    if (force) toast("Couldn't check the feeds: " + e.message);
  } finally {
    todoFeedBusy = false; todoSave();
  }
}
/* "🆕 New for you" inside a learning box */
function todoFeedBlock(P) {
  var list = todoFeedNew(P.key), mine = TODO.feeds.filter(function (s) { return s.box === P.key; });
  if (!mine.length) return null;
  var wrap = todoEl("div", "td-fd");
  var h = todoEl("div", "td-fd-h");
  h.appendChild(todoEl("span", "td-fd-t", list.length ? "🆕 New for you · " + list.length : "✓ Nothing new from your " + mine.length + " source" + (mine.length === 1 ? "" : "s")));
  if (list.length) { var all = todoEl("button", "td-act", "✓ Mark all seen"); all.onclick = function () { todoFeedSeen(list); }; h.appendChild(all); }
  wrap.appendChild(h);
  var show = todoFeedOpen[P.key] ? list : list.slice(0, 4);
  show.forEach(function (x) {
    var r = todoEl("div", "td-fd-row");
    var a = todoEl("a", "td-fd-a", x.it.title); a.href = x.it.link || x.src.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.onclick = function () { setTimeout(function () { todoFeedSeen([x]); }, 300); };   // opening it counts as seen
    var meta = todoEl("span", "td-fd-m", (TODO_FEED_KINDS[x.src.kind] || "").split(" ")[0] + " " + todoFeedName(x.src) + (x.it.date ? " · " + todoAgo(x.it.date) : ""));
    var ok = todoEl("button", "td-fd-ok", "✓"); ok.title = "Seen"; ok.onclick = function () { todoFeedSeen([x]); };
    var tx = todoEl("div", "td-fd-tx"); tx.append(a, meta);
    r.append(tx, ok); wrap.appendChild(r);
  });
  if (list.length > 4) { var more = todoEl("button", "td-act", todoFeedOpen[P.key] ? "Show fewer" : "Show all " + list.length); more.onclick = function () { todoFeedOpen[P.key] = !todoFeedOpen[P.key]; renderAll(); }; wrap.appendChild(more); }
  return wrap;
}
/* the Feeds panel: what the agent follows, and where each one shows up */
function todoFeedsPanel() {
  var ov = todoEl("div", "overlay show"), dg = todoEl("div", "dialog td-fdpanel");
  dg.setAttribute("role", "dialog"); dg.setAttribute("aria-modal", "true"); ov.appendChild(dg);
  var close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); renderAll(); };
  ov.onclick = function (e) { if (e.target === ov) close(); };
  var parts = todoLearnParts();
  var boxSel = function (cur) { var s = todoEl("select"); parts.forEach(function (p) { var o = todoEl("option", "", p.icon + " " + p.label); o.value = p.key; s.appendChild(o); }); s.value = cur || parts[0].key; return s; };
  var draw = function () {
    dg.innerHTML = "";
    dg.appendChild(todoEl("h3", "", "📡 Feeds — what your agent follows"));
    var body = todoEl("div", "dlg-body");
    body.appendChild(todoEl("div", "hint", "Paste links — YouTube channels, websites and blogs, Twitter / X or LinkedIn accounts — and pick which learning box they show up in. The agent checks them every 30 minutes while My To-do is open and puts anything new under that box."));
    // add
    var add = todoEl("div", "td-fd-add");
    var ta = todoEl("textarea"); ta.rows = 3; ta.placeholder = "One link per line, e.g.\nhttps://www.youtube.com/@AndrejKarpathy\nhttps://simonwillison.net\nhttps://x.com/karpathy";
    ta.setAttribute("data-plain", "");   // plain box (no rich-text editor)
    var row = todoEl("div", "td-fd-addrow"), sel = boxSel(), b = todoEl("button", "btn save", "＋ Add");
    row.append(todoEl("span", "td-dim", "Show in"), sel, b);
    add.append(ta, row); body.appendChild(add);
    var err = todoEl("div", "hint err"); err.style.color = "var(--blocked)"; body.appendChild(err);
    b.onclick = function () {
      var urls = ta.value.split(/[\s,]+/).map(function (u) { u = u.trim(); if (u && !/^https?:\/\//i.test(u)) u = "https://" + u; return u; }).filter(Boolean);
      var bad = urls.filter(function (u) { return todoFeedKind(u) === "bad"; });
      if (!urls.length) { err.textContent = "Paste at least one link."; return; }
      if (bad.length) { err.textContent = "Not a web link: " + bad[0]; return; }
      if (TODO.feeds.length + urls.length > 40) { err.textContent = "Up to 40 sources."; return; }
      urls.forEach(function (u) {
        if (TODO.feeds.some(function (s) { return s.url === u; })) return;
        TODO.feeds.push({ id: "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), url: u, box: sel.value, kind: todoFeedKind(u), status: "new" });
      });
      todoSave(); draw(); todoFeedRun(true).then(draw);
    };
    // list, grouped by box
    var any = false;
    parts.forEach(function (p) {
      var mine = TODO.feeds.filter(function (s) { return s.box === p.key; });
      if (!mine.length) return; any = true;
      var g = todoEl("div", "td-fd-grp"); g.appendChild(todoEl("div", "td-fd-gh", p.icon + " " + p.label + " · " + mine.length));
      mine.forEach(function (s) { g.appendChild(sourceRow(s)); });
      body.appendChild(g);
    });
    var orphan = TODO.feeds.filter(function (s) { return !parts.some(function (p) { return p.key === s.box; }); });
    if (orphan.length) { any = true; var og = todoEl("div", "td-fd-grp"); og.appendChild(todoEl("div", "td-fd-gh", "⚠️ Box removed — pick a new one")); orphan.forEach(function (s) { og.appendChild(sourceRow(s)); }); body.appendChild(og); }
    if (!any) body.appendChild(todoEl("div", "td-empty", "Nothing followed yet."));
    dg.appendChild(body);
    var btns = todoEl("div", "btns");
    var ck = todoEl("button", "btn", todoFeedBusy ? "Checking…" : "↻ Check now"); ck.disabled = todoFeedBusy || !TODO.feeds.length;
    ck.onclick = function () { todoFeedRun(true).then(draw); draw(); };
    var cl = todoEl("button", "btn save", "Done"); cl.onclick = close;
    btns.append(ck, cl); dg.appendChild(btns);
  };
  var sourceRow = function (s) {
    var r = todoEl("div", "td-fd-src");
    var top = todoEl("div", "td-fd-srctop");
    top.appendChild(todoEl("span", "td-fd-kind", TODO_FEED_KINDS[s.kind] || "🌐"));
    var nm = todoEl("input", "td-fd-nm"); nm.value = s.name || ""; nm.placeholder = todoFeedName(s); nm.title = "A short name (optional)";
    nm.onchange = function () { s.name = nm.value.trim(); todoSave(); };
    var sel = boxSel(s.box); sel.onchange = function () { s.box = sel.value; todoSave(); draw(); };
    var rm = todoEl("button", "td-act danger", "Remove");
    rm.onclick = function () { TODO.feeds.splice(TODO.feeds.indexOf(s), 1); delete TODO.feedItems[s.id]; todoSave(); draw(); };
    top.append(nm, sel, rm); r.appendChild(top);
    var link = todoEl("a", "td-fd-url", s.url); link.href = s.url; link.target = "_blank"; link.rel = "noopener noreferrer"; r.appendChild(link);
    var st = s.status, n = (TODO.feedItems[s.id] || []).length;
    var msg = st === "ok" ? "✅ Following · " + n + " recent post" + (n === 1 ? "" : "s") + (s.checked ? " · checked " + todoAgo(new Date(s.checked).toISOString()) : "")
      : st === "needs_bridge" ? "🔗 " + (s.kind === "x" ? "Twitter / X" : "LinkedIn") + " doesn't let apps read posts for free. Make a free RSS link for this account (rss.app or RSSHub) and paste it below."
      : st === "no_feed" ? "⚠️ No feed found on this site. If it has an RSS link, paste it below."
      : st === "error" ? "❌ " + (s.error || "Couldn't read it")
      : "⏳ Not checked yet";
    r.appendChild(todoEl("div", "td-fd-st " + (st || "new"), msg));
    if (st === "needs_bridge" || st === "no_feed" || s.kind === "x" || s.kind === "linkedin" || (st === "error" && s.feedUrl)) {
      var fr = todoEl("div", "td-fd-bridge");
      var fi = todoEl("input"); fi.placeholder = "RSS link, e.g. https://rss.app/feeds/…xml"; fi.value = s.kind === "x" || s.kind === "linkedin" || st === "no_feed" ? (s.feedUrl || "") : "";
      var fs = todoEl("button", "td-act", "Use this feed");
      fs.onclick = function () { var v = fi.value.trim(); if (v && !/^https?:\/\//i.test(v)) v = "https://" + v; s.feedUrl = v; s.status = "new"; todoSave(); todoFeedRun(true).then(draw); draw(); };
      fr.append(fi, fs); r.appendChild(fr);
    }
    return r;
  };
  draw();
  document.body.appendChild(ov);
}

/* ---------- Summary tab: how I've been doing, week by week ---------- */
var todoSumWeeks = 4;   // 4 | 12 | 26
function todoMonday(iso) { var d = new Date(iso + "T00:00:00Z"), w = (d.getUTCDay() + 6) % 7; return todoAddDays(iso, -w); }
function todoPct(a, b) { return b ? Math.round(a / b * 100) : 0; }
function todoSumData() {
  var today = todoToday(), start = todoAddDays(todoMonday(today), -7 * (todoSumWeeks - 1));
  var days = []; for (var d = start; d <= today; d = todoAddDays(d, 1)) days.push(d);
  var weeks = []; for (var w = start; w <= today; w = todoAddDays(w, 7)) weeks.push(w);
  var parts = todoLearnParts().length || 1;
  var learnDays = days.filter(todoLearnedOn).length, best = 0, run = 0;
  days.forEach(function (x) { if (todoLearnedOn(x)) { run++; best = Math.max(best, run); } else run = 0; });
  var sum = function (log) { return days.reduce(function (a, x) { return a + (log[x] || 0); }, 0); };
  var on = function (log) { return days.filter(function (x) { return (log[x] || 0) > 0; }).length; };
  var fixed = TODO.fixed.map(function (f) {
    var due = days.filter(function (x) { return todoFixedOn(f, x); });
    var done = due.filter(function (x) { return todoFixedIsDone(f, x); }).length;
    return { f: f, due: due.length, done: done };
  }).filter(function (r) { return r.due; });
  var fxDue = fixed.reduce(function (a, r) { return a + r.due; }, 0), fxDone = fixed.reduce(function (a, r) { return a + r.done; }, 0);
  var varDone = TODO.items.filter(function (x) { return x.col === "done" && x.doneAt && x.doneAt >= start; }).length;
  var wakeDays = days.filter(function (x) { return (TODO.sleepLog[x] || {}).wake; }).length, sleepDays = days.filter(function (x) { return (TODO.sleepLog[x] || {}).sleep; }).length;
  return { today: today, start: start, days: days, weeks: weeks, parts: parts, learnDays: learnDays, best: best,
    deep: sum(TODO.deepLog), deepDays: on(TODO.deepLog), reason: sum(TODO.reasonLog), reasonDays: on(TODO.reasonLog),
    fixed: fixed, fxDue: fxDue, fxDone: fxDone, varDone: varDone, wakeDays: wakeDays, sleepDays: sleepDays };
}
function todoRenderSummary(pane, show) {
  var old = document.getElementById("td-summary"); if (old) old.remove();
  if (!show || !pane || !TODO.loaded) return;
  var D = todoSumData(), box = todoEl("div", "td-sum"); box.id = "td-summary";
  // range
  var seg = todoEl("div", "td-modes");
  [[4, "Last 4 weeks"], [12, "Last 3 months"], [26, "Last 6 months"]].forEach(function (o) {
    var b = todoEl("button", "td-mode" + (todoSumWeeks === o[0] ? " on" : ""), o[1]);
    b.onclick = function () { todoSumWeeks = o[0]; renderAll(); };
    seg.appendChild(b);
  });
  box.appendChild(seg);
  // headline cards
  var cards = todoEl("div", "td-sum-cards");
  var card = function (ic, title, big, sub, pct) {
    var c = todoEl("div", "td-sum-card");
    c.appendChild(todoEl("div", "td-sum-t", ic + " " + title));
    c.appendChild(todoEl("div", "td-sum-big", big));
    c.appendChild(todoEl("div", "td-sum-sub", sub));
    if (pct != null) { var bar = todoEl("div", "td-sum-bar"), i = todoEl("i"); i.style.width = Math.min(100, pct) + "%"; bar.appendChild(i); c.appendChild(bar); }
    cards.appendChild(c);
  };
  var nd = D.days.length;
  card("⏰", "Wake & sleep", D.wakeDays + " · " + D.sleepDays + " / " + nd, "woke up · went to bed (target " + todoFmtHM(TODO.settings.wakeAt) + " · " + todoFmtHM(TODO.settings.sleepAt) + ")", todoPct(D.wakeDays + D.sleepDays, nd * 2));
  card("📚", "New learning", D.learnDays + " / " + nd + " days", todoPct(D.learnDays, nd) + "% · best streak " + D.best + " · now " + todoLearnStreak(), todoPct(D.learnDays, nd));
  card("🧘", "Deep thinking", todoFmtMins(D.deep), D.deepDays + " day" + (D.deepDays === 1 ? "" : "s") + " · avg " + todoFmtMins(Math.round(D.deep / D.weeks.length)) + " / week", null);
  card("♟️", "Reasoning time", todoFmtMins(D.reason), D.reasonDays + " day" + (D.reasonDays === 1 ? "" : "s") + " · avg " + todoFmtMins(Math.round(D.reason / D.weeks.length)) + " / week", null);
  card("🔁", "Fixed routines", todoPct(D.fxDone, D.fxDue) + "%", D.fxDone + " of " + D.fxDue + " ticked", todoPct(D.fxDone, D.fxDue));
  card("✅", "To-dos finished", String(D.varDone), "your own to-dos moved to Done", null);
  box.appendChild(cards);
  // learning calendar: one column per week, Mon→Sun
  var cal = todoEl("section", "td-sum-sec");
  cal.appendChild(todoEl("h3", "", "📚 Learning, day by day"));
  var grid = todoEl("div", "td-heat");
  var lab = todoEl("div", "td-heat-col td-heat-lab"); ["Mon", "", "Wed", "", "Fri", "", "Sun"].forEach(function (t) { lab.appendChild(todoEl("span", "", t)); }); grid.appendChild(lab);
  D.weeks.forEach(function (w) {
    var col = todoEl("div", "td-heat-col");
    for (var i = 0; i < 7; i++) {
      var x = todoAddDays(w, i), c = todoEl("span", "td-heat-c");
      if (x > D.today) c.classList.add("future");
      else { var n = todoLearnCount(x), lv = n ? Math.max(1, Math.ceil(n / D.parts * 4)) : 0; c.classList.add("l" + lv); c.title = todoDayName(x) + " " + fmtD(x) + " — " + n + " of " + D.parts + " learnings"; }
      col.appendChild(c);
    }
    grid.appendChild(col);
  });
  cal.appendChild(grid);
  box.appendChild(cal);
  // week by week
  var wk = todoEl("section", "td-sum-sec");
  wk.appendChild(todoEl("h3", "", "📅 Week by week"));
  var tbl = todoEl("table", "td-sum-tbl");
  tbl.innerHTML = "<thead><tr><th>Week of</th><th>Learning days</th><th>Deep thinking</th><th>Reasoning</th><th>Routines</th><th>Wake · Sleep</th><th>To-dos done</th></tr></thead>";
  var tb = todoEl("tbody"), maxM = 1;
  var rows = D.weeks.map(function (w) {
    var ds = []; for (var i = 0; i < 7; i++) { var x = todoAddDays(w, i); if (x <= D.today) ds.push(x); }
    var dm = ds.reduce(function (a, x) { return a + (TODO.deepLog[x] || 0); }, 0), rm = ds.reduce(function (a, x) { return a + (TODO.reasonLog[x] || 0); }, 0);
    maxM = Math.max(maxM, dm, rm);
    var due = 0, done = 0; TODO.fixed.forEach(function (f) { ds.forEach(function (x) { if (todoFixedOn(f, x)) { due++; if (todoFixedIsDone(f, x)) done++; } }); });
    var end = todoAddDays(w, 6);
    var vd = TODO.items.filter(function (x) { return x.col === "done" && x.doneAt && x.doneAt >= w && x.doneAt <= end; }).length;
    var wk = ds.filter(function (x) { return (TODO.sleepLog[x] || {}).wake; }).length, sl = ds.filter(function (x) { return (TODO.sleepLog[x] || {}).sleep; }).length;
    return { w: w, n: ds.length, learn: ds.filter(todoLearnedOn).length, dm: dm, rm: rm, due: due, done: done, vd: vd, wk: wk, sl: sl };
  }).reverse();   // newest first
  var minibar = function (m, cls) { return "<span class=\"td-mb " + cls + "\"><i style=\"width:" + Math.round(m / maxM * 100) + "%\"></i></span>" + todoFmtMins(m); };
  rows.forEach(function (r) {
    var tr = todoEl("tr");
    tr.innerHTML = "<td>" + fmtD(r.w) + "</td><td>" + r.learn + " / " + r.n + "</td><td>" + minibar(r.dm, "deep") + "</td><td>" + minibar(r.rm, "reason") + "</td><td>"
      + (r.due ? todoPct(r.done, r.due) + "% <span class=\"td-dim\">(" + r.done + "/" + r.due + ")</span>" : "<span class=\"td-dim\">—</span>") + "</td><td>" + r.wk + " · " + r.sl + " <span class=\"td-dim\">/ " + r.n + "</span></td><td>" + r.vd + "</td>";
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); wk.appendChild(tbl); box.appendChild(wk);
  // each fixed routine
  var fx = todoEl("section", "td-sum-sec");
  fx.appendChild(todoEl("h3", "", "🔁 Fixed routines"));
  if (!D.fixed.length) fx.appendChild(todoEl("div", "td-empty", "No fixed things in this period. Set them up from a hat's ⋯ menu on the Board."));
  D.fixed.sort(function (a, b) { return todoPct(a.done, a.due) - todoPct(b.done, b.due); }).forEach(function (r) {
    var row = todoEl("div", "td-sum-fx"), p = todoPct(r.done, r.due);
    row.appendChild(todoEl("span", "td-sum-fx-n", todoHat(r.f.hat).icon + " " + r.f.title));
    var bar = todoEl("span", "td-sum-bar" + (p < 50 ? " low" : "")), i = todoEl("i"); i.style.width = p + "%"; bar.appendChild(i); row.appendChild(bar);
    row.appendChild(todoEl("span", "td-sum-fx-p", p + "% · " + r.done + "/" + r.due));
    fx.appendChild(row);
  });
  box.appendChild(fx);
  pane.appendChild(box);
}

/* ---------- ⏰ Wake up (first) and 🌙 Sleep (last): a target time I can change, and a daily tick ---------- */
function todoHM(s) { var p = String(s || "").split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); }
function todoFmtHM(s) { var m = todoHM(s), h = Math.floor(m / 60), x = m % 60; return (h % 12 || 12) + ":" + String(x).padStart(2, "0") + (h < 12 ? " am" : " pm"); }
function todoNowHM() { var d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function todoBookend(kind) {
  var S = TODO.settings, wake = kind === "wake", key = wake ? "wakeAt" : "sleepAt", today = todoToday();
  var day = TODO.sleepLog[today] || {}, done = day[kind];
  var box = todoEl("section", "td-bk td-bk-" + kind + (done ? " ok" : ""));
  box.appendChild(todoEl("span", "td-bk-ic", wake ? "⏰" : "🌙"));
  var tx = todoEl("div", "td-bk-tx");
  var h = todoEl("div", "td-bk-h"); h.appendChild(todoEl("b", "", wake ? "Wake up" : "Go to bed"));
  var tm = todoEl("input", "td-bk-time"); tm.type = "time"; tm.value = S[key]; tm.title = "Your target time — change it any time";
  tm.onchange = function () { if (/^\d{2}:\d{2}$/.test(tm.value)) { S[key] = tm.value; todoSave(); } };
  h.appendChild(todoEl("span", "td-dim", "target")); h.appendChild(tm);
  tx.appendChild(h);
  var late = done && todoHM(done) > todoHM(S[key]) + 15;   // 15 minutes' grace
  tx.appendChild(todoEl("div", "td-bk-sub" + (late ? " late" : ""), done
    ? (wake ? "Up at " : "In bed at ") + todoFmtHM(done) + (late ? " — " + (todoHM(done) - todoHM(S[key])) + " min after " + todoFmtHM(S[key]) : " — on time ✅")
    : (wake ? "Tick it when you're up." : "Tick it when you go to bed.")));
  var go = todoEl("button", done ? "btn" : "btn save", done ? "↺ Undo" : (wake ? "✓ I'm up" : "✓ Going to bed"));
  go.onclick = function () {
    var d = TODO.sleepLog[today] = TODO.sleepLog[today] || {};
    if (d[kind]) delete d[kind]; else d[kind] = todoNowHM();
    if (!Object.keys(d).length) delete TODO.sleepLog[today];
    todoSave();
  };
  var n = 0, x = todoToday(); if (!(TODO.sleepLog[x] || {})[kind]) x = todoAddDays(x, -1);
  while ((TODO.sleepLog[x] || {})[kind]) { n++; x = todoAddDays(x, -1); }
  if (n > 1) tx.appendChild(todoEl("span", "td-streak td-bk-streak", "🔥 " + n + " days in a row"));
  box.append(tx, go);
  return box;
}

/* ---------- why do I exist? ---------- */
var TODO_WHY = {
  goal: "Self-reliant India",
  steps: ["AI", "Semiconductors", "Defence", "Phones", "Missiles", "Rockets & space", "Drones & UAVs", "Fighter planes", "Aeroplanes"],
  from: "Dubuddy + Sumit",
  line: "Every dot will be something my country should do and isn't doing yet.",
};
function todoWhyNorm(w) {
  w = w && typeof w === "object" ? w : {};
  return {
    goal: String(w.goal || TODO_WHY.goal),
    steps: Array.isArray(w.steps) ? w.steps.map(String).filter(Boolean) : TODO_WHY.steps.slice(),
    from: String(w.from || TODO_WHY.from),
    line: w.line != null ? String(w.line) : TODO_WHY.line,
    seen: String(w.seen || ""),
  };
}
// the ladder: goal at the top, me at the bottom, the dots in between
function todoWhyCard(inPop) {
  var W = TODO.why, box = todoEl("div", "td-why" + (inPop ? " pop" : ""));
  var hd = todoEl("div", "td-why-hd");
  hd.appendChild(todoEl("b", "", "🇮🇳 Why do I exist?"));
  if (!inPop) { var ed = todoEl("button", "td-act", "✏️ Edit"); ed.onclick = todoWhyEdit; hd.appendChild(ed); }
  box.appendChild(hd);
  var lad = todoEl("ol", "td-why-lad");
  var dot = function (txt, cls) { lad.appendChild(todoEl("li", cls || "", txt)); };
  dot(W.goal, "top");
  W.steps.slice().reverse().forEach(function (t) { dot(t); });
  dot(W.from, "me");
  box.appendChild(lad);
  if (W.line) box.appendChild(todoEl("div", "td-why-line", W.line));
  return box;
}
function todoWhyEdit() {
  var W = TODO.why, goal, steps, from, line;
  todoDialog("🇮🇳 Why do I exist?", function (body) {
    goal = todoEl("input"); goal.value = W.goal;
    steps = todoEl("textarea"); steps.rows = 9; steps.value = W.steps.join("\n"); steps.dataset.plain = "1";   // a plain list, no rich text
    from = todoEl("input"); from.value = W.from;
    line = todoEl("textarea"); line.rows = 2; line.value = W.line; line.dataset.plain = "1";
    body.append(todoField("Where it leads (top dot)", goal), todoField("The dots on the way — one per line", steps),
      todoField("Where it starts (bottom dot)", from), todoField("In my words", line));
  }, function () {
    if (!goal.value.trim()) return "Write where it leads.";
    W.goal = goal.value.trim(); W.from = from.value.trim() || TODO_WHY.from; W.line = line.value.trim();
    W.steps = steps.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
  });
}
// first open of the day: it comes up on its own; ✕ closes it until tomorrow
function todoWhyPop() {
  if (!TODO.why || TODO.why.seen === todoToday() || TODO.deep || document.getElementById("td-why-pop")) return;
  var ov = todoEl("div", "overlay show"); ov.id = "td-why-pop";
  var dg = todoEl("div", "dialog td-why-dlg"); dg.setAttribute("role", "dialog"); dg.setAttribute("aria-modal", "true"); ov.appendChild(dg);
  var x = todoEl("button", "td-why-x", "✕"); x.title = "Close until tomorrow"; x.setAttribute("aria-label", "Close until tomorrow");
  var close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); TODO.why.seen = todoToday(); todoSave(); };
  x.onclick = close;
  dg.append(x, todoEl("div", "td-why-morning", "Good morning. Before all to be done —"), todoWhyCard(true));
  var go = todoEl("button", "btn save", "Let's go"); go.onclick = close;
  var btns = todoEl("div", "btns"); btns.appendChild(go); dg.appendChild(btns);
  document.body.appendChild(ov);
  go.focus();
}

/* ---------- the page ---------- */
function renderContentTodo() {
  var wrap = $("content");
  wrap.innerHTML = "";
  if (!todoCan()) { wrap.appendChild(todoEl("div", "empty", "My To-do isn't switched on for you yet.")); return; }
  if (!TODO.loaded || TODO.team !== TEAM) {
    if (TODO.team !== TEAM) TODO.loaded = false;
    wrap.appendChild(todoEl("div", "empty", "Loading your to-dos…"));
    todoLoad(); return;
  }
  if (TODO.local) wrap.appendChild(todoEl("div", "td-note", "Couldn't reach the database — your to-dos are saved in this browser for now."));
  var page = wrap;                   // the 🌙 Sleep row goes at the very end, outside any freeze
  if (todoMode === "all") wrap.appendChild(todoWhyCard(false));   // 🇮🇳 why I exist comes before all to be done, never frozen
  wrap.appendChild(todoBookend("wake"));   // ⏰ first thing of the day
  // daily new learning next; until today's is written, the rest is frozen —
  // unless I gave it a time: then it's planned on the day like everything else and nothing freezes.
  // On Today, a box with a time sits on the day at that time instead of up here.
  // (on Tomorrow, timed boxes show on tomorrow's timeline as reminders, so they leave the top there too)
  var at = TODO.times.at, onDay = function (k) { return todoIsDayView() && !!at["box:" + k]; };
  var learnLater = onDay("learn") || todoLearnParts().some(todoLearnPartTimed);
  var dayBoxes = [];
  var allPartsTimed = todoLearnParts().every(todoLearnPartTimed);
  if (onDay("learn")) dayBoxes.push("learn"); var learnLast = !onDay("learn") && !allPartsTimed;   // the untimed New learning card goes at the end, after the day's timeline
  if (onDay("deep")) dayBoxes.push("deep"); else wrap.appendChild(todoDeepBox());   // always usable, even before today's learning is written
  if (onDay("reason")) dayBoxes.push("reason"); else wrap.appendChild(todoReasonBox());
  if (!todoLearnedToday() && !learnLater) {
    var fz = todoEl("div", "td-frozen"); fz.setAttribute("aria-disabled", "true"); fz.inert = true;
    var lock = todoEl("div", "td-frozen-msg", "🔒 Frozen until you write today's learnings — New learning is at the bottom ↓");
    wrap.appendChild(lock);
    wrap.appendChild(fz);
    wrap = fz;
  }
  // Today | Upcoming (Tomorrow · 5 days · 7 days)
  var bar = todoEl("div", "td-modes");
  var mk = function (label, on, fn) { var b = todoEl("button", "td-mode" + (on ? " on" : ""), label); b.onclick = fn; bar.appendChild(b); };
  mk("All to be done", todoMode === "all", function () { todoMode = "all"; renderAll(); });
  mk("Today", todoMode === "today", function () { todoMode = "today"; renderAll(); });
  mk("Tomorrow", todoMode === "tomorrow", function () { todoMode = "tomorrow"; renderAll(); });   // the same day-by-the-clock view, for tomorrow
  [[5, "Next 5 days"], [7, "Next 7 days"]].forEach(function (r) {
    mk(r[1], todoMode === "upcoming" && todoRange === r[0], function () { todoMode = "upcoming"; todoRange = r[0]; renderAll(); });
  });
  wrap.appendChild(bar);
  var assigned = todoAssigned();
  var withFixed = function (iso) { return assigned.concat(todoFixedCards(iso)); };   // fixed things due that day, as cards
  if (todoMode === "all") wrap.appendChild(todoAllOpen(withFixed(todoToday())));
  else if (todoMode === "upcoming") wrap.appendChild(todoUpcoming(assigned));
  else if (todoMode === "tomorrow") {
    var tmr = todoAddDays(todoToday(), 1);
    var nh = todoEl("div", "td-daynote");
    nh.appendChild(todoEl("b", "", "Tomorrow · " + todoDayName(tmr) + " " + fmtD(tmr)));
    nh.appendChild(todoEl("span", "", "Same timetable as every day. Pick the work for it from All to be done (→ Tomorrow) or with ＋ Add to-do here."));
    wrap.appendChild(nh);
    wrap.appendChild(todoDayPlan(withFixed(tmr), [], tmr));
  }
  else wrap.appendChild(todoDayPlan(withFixed(todoToday()), dayBoxes));
  if (learnLast) page.appendChild(todoLearnBox());   // outside the freeze, so it can always be written
  page.appendChild(todoBookend("sleep"));   // 🌙 last thing of the day
  todoWhyPop();   // once a day, on the first open
}
/* after sign-in, load once even if the sidebar isn't on screen (e.g. reloaded on OKRs),
   so a running deep-thinking block comes back straight away */
(function () {
  var tries = 0, t = setInterval(function () {
    tries++;
    try {
      if (typeof TEAM !== "undefined" && TEAM && todoCan()) { clearInterval(t); if (!TODO.loaded && !TODO.loading) todoLoad(); }
      else if (tries > 60) clearInterval(t);   // not signed in / no permission within ~30 s
    } catch (_) { if (tries > 60) clearInterval(t); }
  }, 500);
})();
/* the sidebar entry, at the top of Spaces */
function todoSideItem() {
  var b = todoEl("button", "ws-item td-side" + (view === "todo" ? " active" : ""));
  var c = TODO.loaded && TODO.team === TEAM ? todoCounts() : null;
  b.innerHTML = "<span>✅ My To-do</span>" + (c ? "<span class=\"td-side-n\"></span>" : "");
  if (c) { var open = c.todo + c.progress; b.querySelector(".td-side-n").textContent = open; b.title = open + " open · " + c.done + " done"; }
  b.onclick = function () { view = "todo"; renderAll(); };
  // ⋯ : every My To-do setting in one place (same as the ⋯ on the cards and hats)
  if (TODO.loaded && TODO.team === TEAM && typeof openRowMenu === "function") {
    var menu = todoEl("span", "ws-menu-btn", "⋯"); menu.title = "My To-do settings";
    menu.onclick = function (e) {
      e.stopPropagation();
      openRowMenu(menu, [
        { label: "📡 Feeds — what the agent follows", onClick: todoFeedsPanel },
        { label: "📚 New learning — boxes & unlock", onClick: todoLearnSettings },
        { label: "🧘 Deep thinking — how long", onClick: todoDeepSettings },
        { label: "♟️ Reasoning time — durations", onClick: todoReasonSettings },
      ].concat(TODO_HATS.map(function (H) {
        return { label: "⚙️ Fixed things — " + H.icon + " " + H.label, onClick: function () { todoFixedSetup(H.key); } };
      })));
    };
    b.appendChild(menu);
  }
  if ((!TODO.loaded || TODO.team !== TEAM) && !TODO.loading) todoLoad();
  return b;
}
