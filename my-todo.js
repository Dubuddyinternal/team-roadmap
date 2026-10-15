/* =====================================================================
   MY TO-DO — one private board per person, split into three hats:
     👤 Personal · 🧭 As CEO · 🧩 As Product Head
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
var TODO = { team: null, loaded: false, loading: false, local: false, items: [], over: {}, fixed: [], fixedDone: {}, learn: {}, deep: null, deepLog: {}, reasonLog: {}, settings: null };
// the two full-screen timers in Personal
var TODO_TIMERS = {
  deep: { icon: "🧘", title: "Deep thinking", line: "Talk to yourself. Walk. Don't do anything.",
    done: "Welcome back. What came to you? Write it down before it's gone." },
  reason: { icon: "♟️", title: "Reasoning time", line: "Play chess. Solve maths. Crack a puzzle. Stretch your reasoning.",
    done: "Time's up. What did you solve — and where did you get stuck?" },
};
var todoLearnEdit = {};        // which of today's four learning boxes are being edited again
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
];
var TODO_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var TODO_DONE_SHOW = 6;          // each hat's Done column shows the latest few; "Show all" opens the rest
var todoShowAllDone = {};        // hat -> true
var todoMode = "today";          // today | upcoming
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
  TODO.fixed = Array.isArray(d.fixed) ? d.fixed.filter(function (f) { return f && f.title; }) : [];
  TODO.fixed.forEach(function (f) {
    if (!f.id) f.id = todoId();
    if (!TODO_HATS.some(function (h) { return h.key === f.hat; })) f.hat = "personal";
    if (["daily", "weekly", "monthly", "once"].indexOf(f.freq) < 0) f.freq = "daily";
  });
  TODO.fixedDone = d.fixedDone && typeof d.fixedDone === "object" ? d.fixedDone : {};
  TODO.learn = d.learn && typeof d.learn === "object" ? d.learn : {};   // { "YYYY-MM-DD": { ai, world, social, edtech } } (older days: a string), kept forever
  TODO.settings = todoSettingsNorm(d.settings);   // ⋯ settings on the Personal cards
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
}
var _todoSaveT = null;
function todoSave() {
  // tick marks older than ~13 months are dropped so the row stays small (the Summary looks back 6 months)
  var cut = todoAddDays(todoToday(), -400);
  Object.keys(TODO.fixedDone).forEach(function (k) { if (k.split("|")[1] < cut) delete TODO.fixedDone[k]; });
  var data = { items: TODO.items, over: TODO.over, fixed: TODO.fixed, fixedDone: TODO.fixedDone, learn: TODO.learn, deep: TODO.deep, deepLog: TODO.deepLog, reasonLog: TODO.reasonLog, settings: TODO.settings };
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
function todoFixedIsDone(f, iso) { return !!TODO.fixedDone[f.id + "|" + iso]; }
function todoFixedToggle(f, iso) { var k = f.id + "|" + iso; if (TODO.fixedDone[k]) delete TODO.fixedDone[k]; else TODO.fixedDone[k] = 1; todoSave(); }
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
  // assigned cards keep their hat (the fixed rule); only the column changes
  var e = todoAssigned().find(function (x) { return x.key === key; });
  if (!e || e.col === toCol) return;
  if (e.write) { delete TODO.over[key]; e.write(toCol); todoSave(); return; }
  if (e.boardCol === "done" && toCol !== "done") { toast("Done on its board — open it there to reopen it"); return; }
  if (toCol === e.boardCol) delete TODO.over[key]; else TODO.over[key] = toCol;
  todoSave();
}

/* ---------- my own (variable) to-dos ---------- */
function todoEdit(item, col, hat) {
  openDialog(item ? "Edit to-do" : "New to-do — " + todoHat(hat).label, item ? { title: item.title, note: item.note, duedate: item.due } : {}, function (v) {
    if (!v.title) return;
    if (item) { item.title = v.title; item.note = v.note || ""; if (v.duedate) item.due = v.duedate; else delete item.due; }
    else {
      var n = { id: todoId(), title: v.title, note: v.note || "", col: col || "todo", hat: hat || "personal", created: todayISO() };
      if (v.duedate) n.due = v.duedate;
      if (n.col === "done") n.doneAt = todayISO();
      TODO.items.push(n);
    }
    todoSave();
  }, { duedate: true, noOwner: true, noteLabel: "Note (optional)" });
}
function todoDelete(item) {
  if (!confirm("Delete the to-do “" + item.title + "”?")) return;
  TODO.items.splice(TODO.items.indexOf(item), 1);
  todoSave();
}
function todoMoveHat(item) {
  openChoice("Move “" + item.title + "” to which hat?", TODO_HATS.filter(function (h) { return h.key !== item.hat; }).map(function (h) { return { label: h.icon + " " + h.label, value: h.key }; }),
    function (k) { item.hat = k; todoSave(); });
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
  card.appendChild(meta);
  var acts = todoEl("div", "td-acts");
  if (own) {
    var ed = todoEl("button", "td-act", "Edit"); ed.onclick = function (ev) { ev.stopPropagation(); todoEdit(own); };
    var mh = todoEl("button", "td-act", "Hat…"); mh.title = "Move to another hat"; mh.onclick = function (ev) { ev.stopPropagation(); todoMoveHat(own); };
    var dl = todoEl("button", "td-act danger", "Delete"); dl.onclick = function (ev) { ev.stopPropagation(); todoDelete(own); };
    acts.append(ed, mh, dl);
  } else {
    var op = todoEl("button", "td-act", "Open ↗"); op.onclick = function (ev) { ev.stopPropagation(); entry.open(); };
    acts.appendChild(op);
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
  if (typeof openDiscPick === "function") {
    openDiscPick(anchor, { current: null, options: [
      { key: "fixed", label: "⚙️ Set up fixed things" },
      { key: "add", label: "＋ Add a to-do" },
    ], onPick: function (k) { if (k === "fixed") todoFixedSetup(hat); else if (k === "add") todoEdit(null, "todo", hat); } });
  } else todoFixedSetup(hat);
}
function todoHatBlock(H, assigned) {
  var today = todoToday();
  var sec = todoEl("section", "td-hat th-" + H.key);
  var head = todoEl("div", "td-hat-h");
  head.appendChild(todoEl("h2", "", H.icon + " " + H.label));
  var mine = TODO.items.filter(function (x) { return x.hat === H.key; });
  var theirs = assigned.filter(function (e) { return e.hat === H.key; });
  var open = mine.concat(theirs).filter(function (x) { return x.col !== "done"; }).length;
  head.appendChild(todoEl("span", "td-hat-n", open + " open"));
  var more = todoEl("button", "td-more", "⋯"); more.title = "Set up fixed things · add a to-do";
  more.onclick = function (ev) { ev.stopPropagation(); todoHatMenu(more, H.key); };
  head.appendChild(more);
  sec.appendChild(head);
  // fixed things due today
  var fx = todoFixedFor(H.key, today);
  var fxRow = todoEl("div", "td-fxrow-today");
  fxRow.appendChild(todoEl("span", "td-lbl", "Fixed today"));
  if (fx.length) fx.forEach(function (f) { fxRow.appendChild(todoFixedChip(f, today)); });
  else {
    var hint = todoEl("button", "td-fx-hint", TODO.fixed.some(function (f) { return f.hat === H.key; }) ? "Nothing fixed today" : "＋ Set up fixed things (⋯)");
    hint.onclick = function () { todoFixedSetup(H.key); };
    fxRow.appendChild(hint);
  }
  sec.appendChild(fxRow);
  // variable: To do · In progress · Done
  var board = todoEl("div", "kanban td-board");
  TODO_COLS.forEach(function (c) {
    var col = todoEl("div", "kcol td-col tc-" + c.key);
    col.addEventListener("dragover", function (ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; col.classList.add("kover"); });
    col.addEventListener("dragleave", function (ev) { if (ev.target === col) col.classList.remove("kover"); });
    col.addEventListener("drop", function (ev) { ev.preventDefault(); col.classList.remove("kover"); var k = ""; try { k = ev.dataTransfer.getData("text/plain"); } catch (_) { } if (k) todoMove(k, c.key, H.key); });
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
      add.onclick = function () { todoEdit(null, c.key, H.key); };
      col.appendChild(add);
    }
    board.appendChild(col);
  });
  sec.appendChild(board);
  return sec;
}

/* ---------- Upcoming: tomorrow / next 5 / next 7 days ---------- */
function todoUpcoming(assigned) {
  var wrap = todoEl("div", "td-up");
  var today = todoToday();
  var start = todoAddDays(today, 1), end = todoAddDays(today, todoRange);
  var due = [];
  TODO.items.forEach(function (x) { if (x.due && x.col !== "done") due.push({ due: x.due, title: x.title, hat: x.hat, src: "✏️ My to-do", open: function () { todoEdit(x); } }); });
  assigned.forEach(function (e) { if (e.due && e.col !== "done") due.push({ due: e.due, title: e.title, hat: e.hat, src: e.icon + " " + e.src + " · " + e.where, open: e.open }); });
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
  var parts = Array.isArray(s.learnParts) ? s.learnParts.filter(function (p) { return p && p.key && p.label; }) : [];
  s.learnParts = parts.length ? parts.slice(0, 8) : TODO_LEARN_DEFAULT.map(function (p) { return Object.assign({}, p); });
  s.learnNeed = typeof s.learnNeed === "number" ? Math.max(0, Math.min(s.learnParts.length, Math.round(s.learnNeed))) : s.learnParts.length;
  s.deepMin = Math.max(5, Math.min(600, Math.round(Number(s.deepMin) || 120)));
  var rm = Array.isArray(s.reasonMins) ? s.reasonMins.map(Number).filter(function (n) { return n >= 5 && n <= 600; }).map(Math.round) : [];
  s.reasonMins = rm.length ? rm.slice(0, 4) : [30, 60, 120];
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
  var b = todoEl("div", "td-lp" + (val ? " ok" : ""));
  var h = todoEl("div", "td-lp-h");
  h.appendChild(todoEl("b", "", (P.icon ? P.icon + " " : "") + P.label));
  h.appendChild(todoEl("span", "td-lp-st", val ? "✓ Saved" : "To do"));
  b.appendChild(h);
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
    delete todoLearnEdit[P.key];
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
  head.appendChild(todoMoreBtn("Settings — boxes and how many unlock", todoLearnSettings));
  box.appendChild(head);
  if (!open) box.appendChild(todoEl("div", "td-learn-q", "🔒 Write " + (need === parts.length ? "all " + need : need + " of " + parts.length) + " for today to unlock the rest of your to-dos."));
  var grid = todoEl("div", "td-lp-grid");
  parts.forEach(function (P) { grid.appendChild(todoLearnPartBox(P, today)); });
  box.appendChild(grid);
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
function todoDeepBox() {
  var len = TODO.settings.deepMin, box = todoEl("section", "td-deepcard");
  var tx = todoEl("div", "td-deep-tx");
  tx.appendChild(todoEl("h2", "", "🧘 Deep thinking · " + todoFmtLen(len)));
  var mins = TODO.deepLog[todoToday()] || 0;
  tx.appendChild(todoEl("div", "td-deep-sub", "Talk to yourself. Walk. Don't do anything. Everything here freezes until the time is up."
    + (mins ? "  ✅ Today: " + todoFmtMins(mins) : "")));
  var go = todoEl("button", "btn save td-deep-go", "▶ Start " + todoFmtLen(len));
  go.onclick = function () { todoTimerStart("deep", len * 60000, todoFmtLen(len)); };
  box.append(tx, go, todoMoreBtn("Settings — how long", todoDeepSettings));
  return box;
}
function todoReasonBox() {
  var box = todoEl("section", "td-deepcard td-reasoncard");
  var tx = todoEl("div", "td-deep-tx");
  tx.appendChild(todoEl("h2", "", "♟️ Reasoning time"));
  var mins = TODO.reasonLog[todoToday()] || 0;
  tx.appendChild(todoEl("div", "td-deep-sub", "Grow your reasoning: play chess, solve maths, crack puzzles. Pick how long — everything here freezes till then."
    + (mins ? "  ✅ Today: " + todoFmtMins(mins) : "")));
  var bs = todoEl("div", "td-reason-btns"), list = TODO.settings.reasonMins, mid = list[Math.floor((list.length - 1) / 2)];
  list.forEach(function (m) {
    var b = todoEl("button", "btn" + (m === mid ? " save" : ""), "▶ " + todoFmtLen(m));
    b.onclick = function () { todoTimerStart("reason", m * 60000, todoFmtLen(m)); };
    bs.appendChild(b);
  });
  box.append(tx, bs, todoMoreBtn("Settings — durations", todoReasonSettings));
  return box;
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
  var T = TODO_TIMERS[d.kind] || TODO_TIMERS.deep;
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
  return { today: today, start: start, days: days, weeks: weeks, parts: parts, learnDays: learnDays, best: best,
    deep: sum(TODO.deepLog), deepDays: on(TODO.deepLog), reason: sum(TODO.reasonLog), reasonDays: on(TODO.reasonLog),
    fixed: fixed, fxDue: fxDue, fxDone: fxDone, varDone: varDone };
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
  tbl.innerHTML = "<thead><tr><th>Week of</th><th>Learning days</th><th>Deep thinking</th><th>Reasoning</th><th>Routines</th><th>To-dos done</th></tr></thead>";
  var tb = todoEl("tbody"), maxM = 1;
  var rows = D.weeks.map(function (w) {
    var ds = []; for (var i = 0; i < 7; i++) { var x = todoAddDays(w, i); if (x <= D.today) ds.push(x); }
    var dm = ds.reduce(function (a, x) { return a + (TODO.deepLog[x] || 0); }, 0), rm = ds.reduce(function (a, x) { return a + (TODO.reasonLog[x] || 0); }, 0);
    maxM = Math.max(maxM, dm, rm);
    var due = 0, done = 0; TODO.fixed.forEach(function (f) { ds.forEach(function (x) { if (todoFixedOn(f, x)) { due++; if (todoFixedIsDone(f, x)) done++; } }); });
    var end = todoAddDays(w, 6);
    var vd = TODO.items.filter(function (x) { return x.col === "done" && x.doneAt && x.doneAt >= w && x.doneAt <= end; }).length;
    return { w: w, n: ds.length, learn: ds.filter(todoLearnedOn).length, dm: dm, rm: rm, due: due, done: done, vd: vd };
  }).reverse();   // newest first
  var minibar = function (m, cls) { return "<span class=\"td-mb " + cls + "\"><i style=\"width:" + Math.round(m / maxM * 100) + "%\"></i></span>" + todoFmtMins(m); };
  rows.forEach(function (r) {
    var tr = todoEl("tr");
    tr.innerHTML = "<td>" + fmtD(r.w) + "</td><td>" + r.learn + " / " + r.n + "</td><td>" + minibar(r.dm, "deep") + "</td><td>" + minibar(r.rm, "reason") + "</td><td>"
      + (r.due ? todoPct(r.done, r.due) + "% <span class=\"td-dim\">(" + r.done + "/" + r.due + ")</span>" : "<span class=\"td-dim\">—</span>") + "</td><td>" + r.vd + "</td>";
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
  // daily new learning first; until today's is written, the rest is frozen
  wrap.appendChild(todoLearnBox());
  wrap.appendChild(todoDeepBox());   // always usable, even before today's learning is written
  wrap.appendChild(todoReasonBox());
  if (!todoLearnedToday()) {
    var fz = todoEl("div", "td-frozen"); fz.setAttribute("aria-disabled", "true"); fz.inert = true;
    var lock = todoEl("div", "td-frozen-msg", "🔒 Frozen until you write all four of today's learnings above");
    wrap.appendChild(lock);
    wrap.appendChild(fz);
    wrap = fz;
  }
  // Today | Upcoming (Tomorrow · 5 days · 7 days)
  var bar = todoEl("div", "td-modes");
  var mk = function (label, on, fn) { var b = todoEl("button", "td-mode" + (on ? " on" : ""), label); b.onclick = fn; bar.appendChild(b); };
  mk("Today", todoMode === "today", function () { todoMode = "today"; renderAll(); });
  [[1, "Tomorrow"], [5, "Next 5 days"], [7, "Next 7 days"]].forEach(function (r) {
    mk(r[1], todoMode === "upcoming" && todoRange === r[0], function () { todoMode = "upcoming"; todoRange = r[0]; renderAll(); });
  });
  wrap.appendChild(bar);
  var assigned = todoAssigned();
  if (todoMode === "upcoming") { wrap.appendChild(todoUpcoming(assigned)); return; }
  TODO_HATS.forEach(function (H) { wrap.appendChild(todoHatBlock(H, assigned)); });
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
