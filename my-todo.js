/* =====================================================================
   MY TO-DO — one private board per person: To do · In progress · Done.

   * Everything assigned to me on the team's boards shows up by itself:
       Development / scrum cards and bugs  (assignee = my email)
       Product Roadmap ideas               (assignee = my email)
       OKR objectives and key results      (owners include my email)
       Module tasks, Educational Content tasks, Product All in One items
                                           (owner = my name, typed)
       Campaign pieces, Keep an Eye studies, Widen our Horizon topics
                                           (ownerId / checkerId = my user id)
     Its column follows the board (done on the board = Done here). Moving
     a dev card, bug or roadmap / content task here moves it on its board
     too (if I can edit); anything else just remembers where I put it.
   * I can add my own to-dos (title, note, due date) — only I see them.

   Who sees it: anyone with the "My To-do" permission (Owners and supers
   have every permission; others get it per role in Roles & permissions).

   Data: public.my_todos, one row per person per team, readable and
   writable only by that person (supabase/stage20a_my_todos.sql). Until
   that SQL is run, to-dos are kept in this browser only.
   Uses index.html globals (SUPA, TEAM, DEV, BUGS, CSPACES, OKRS, DATA,
   CONTENT, view, renderAll, openDialog, toast, fmtD, todayISO …).
   ===================================================================== */
var TODO = { team: null, loaded: false, loading: false, local: false, items: [], over: {} };
var TODO_COLS = [
  { key: "todo", label: "To do" },
  { key: "progress", label: "In progress" },
  { key: "done", label: "Done" },
];
var TODO_DONE_SHOW = 12;   // the Done column shows the latest few; "Show all" opens the rest
var todoShowAllDone = false;

function todoCan() { try { return !!currentUser() && hasPerm("my_todo"); } catch (_) { return false; } }
function todoEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function todoId() { return "td-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ---------- load / save ---------- */
function todoLocalKey() { var u = currentUser(); return "cf-todo-" + TEAM + "-" + (u ? u.id : "anon"); }
function todoApply(d) {
  d = d || {};
  TODO.items = Array.isArray(d.items) ? d.items.filter(function (x) { return x && x.title; }) : [];
  TODO.items.forEach(function (x) { if (!x.id) x.id = todoId(); if (!TODO_COLS.some(function (c) { return c.key === x.col; })) x.col = "todo"; });
  TODO.over = d.over && typeof d.over === "object" ? d.over : {};
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
    local = true;   // table not there yet (SQL not run) or offline: keep them in this browser
    try { d = JSON.parse(localStorage.getItem(todoLocalKey()) || "null"); } catch (_) { d = null; }
  }
  todoApply(d);
  TODO.local = local; TODO.team = TEAM; TODO.loaded = true; TODO.loading = false;
  renderAll();   // the board and the sidebar count
}
var _todoSaveT = null;
function todoSave() {
  var data = { items: TODO.items, over: TODO.over };
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

/* each entry: { key, src, icon, title, where, col (from the board), due, write(col) | null, open() } */
function todoAssigned() {
  var me = todoMe(), out = [];
  if (!me.email && !me.id) return out;
  var spaces = (CSPACES && CSPACES.list) || [];

  // Development / scrum cards
  ((DEV && DEV.cards) || []).forEach(function (c) {
    if ((c.assignee || "").toLowerCase() !== me.email) return;
    var sp = (DEV.spaces || []).find(function (s) { return s.id === c.space; });
    out.push({ key: "dev:" + c.id, icon: "🛠️", src: "Dev", title: c.title, where: sp ? sp.name : "Development",
      col: todoColFromKcol(c.col), due: c.duedate,
      write: hasPerm("edit") ? function (k) { c.col = k; saveDev(); } : null,
      open: function () { view = "dev"; devSpace = c.space || null; devSprint = c.sprint || null; renderAll(); } });
  });
  // bugs
  (typeof teamBugs === "function" ? teamBugs() : []).forEach(function (t) {
    if ((t.assignee || "").toLowerCase() !== me.email) return;
    var b = t.board ? spaces.find(function (x) { return x.id === t.board; }) : null;
    out.push({ key: "bug:" + t.id, icon: "🐞", src: "Bug", title: t.title, where: b ? b.name : "Bugs",
      col: todoColFromKcol(t.col), due: t.duedate,
      write: hasPerm("edit") ? function (k) { t.col = k; saveBugs(); } : null,
      open: function () { if (b) { view = "cbugs"; activeCspace = b.id; } else view = "bugs"; renderAll(); } });
  });
  spaces.forEach(function (cs) {
    if (!todoCanSee(cs)) return;
    // Product Roadmap ideas
    if (cs.type === "discovery") (cs.ideas || []).forEach(function (i) {
      if ((i.assignee || "").toLowerCase() !== me.email) return;
      var st = (typeof discStages === "function" ? discStages(cs) : []).find(function (x) { return x.key === i.stage; });
      out.push({ key: "idea:" + i.id, icon: "💡", src: "Product Roadmap", title: i.title, where: cs.name + (st ? " · " + st.label : ""),
        col: (i.stage === "done" || i.stage === "wont") ? "done" : ["primary", "implres", "building"].indexOf(i.stage) >= 0 ? "progress" : "todo",
        write: null, open: function () { view = "disc"; activeCspace = cs.id; discView = "roadmap"; renderAll(); } });
    });
    // Product All in One items (owner typed as a name)
    if (cs.type === "pdt") (cs.items || []).forEach(function (it) {
      if (!todoNameIsMe(me, it.owner)) return;
      var done = (it.lane === "bugs" && it.col === "done") || (it.lane === "qa" && it.col === "passed") || (it.lane === "dev" && it.col === "qa");
      out.push({ key: "pdt:" + it.id, icon: "🧩", src: "Product", title: it.title, where: cs.name,
        col: done ? "done" : ["progress", "review", "testing", "verify"].indexOf(it.col) >= 0 ? "progress" : "todo", due: it.due,
        write: null, open: function () { view = "pdt"; activeCspace = cs.id; pdtView = it.lane; renderAll(); } });
    });
    // Campaign pieces
    if (cs.type === "campaign") (cs.items || []).forEach(function (it, n) {
      if (!it.ownerId || it.ownerId !== me.id) return;
      out.push({ key: "camp:" + cs.id + ":" + (it.id || n), icon: "📣", src: "Campaign", title: it.name || "(piece)", where: cs.name,
        col: it.sentCardId ? "done" : "todo", write: null,
        open: function () { view = "campaign"; activeCspace = cs.id; campView = "assign"; renderAll(); } });
    });
    // Keep an Eye studies
    if (cs.type === "watch") (cs.companies || []).forEach(function (co, n) {
      if (!co.ownerId || co.ownerId !== me.id) return;
      out.push({ key: "watch:" + cs.id + ":" + (co.id || n), icon: "👀", src: "Keep an Eye", title: "Study " + (co.name || ""), where: cs.name,
        col: "todo", due: co.due, write: null,
        open: function () { view = "watch"; activeCspace = cs.id; watchView = "fill"; renderAll(); } });
    });
    // Widen our Horizon topics (answering or checking)
    if (cs.type === "horizon") (cs.topics || []).forEach(function (t, n) {
      var mine = t.ownerId && t.ownerId === me.id, check = t.checkerId && t.checkerId === me.id;
      if (!mine && !check) return;
      out.push({ key: "hz:" + cs.id + ":" + (t.id || n) + (mine ? "" : ":chk"), icon: "🔭", src: "Horizon", title: (mine ? "" : "Check: ") + (t.q || "(topic)"), where: cs.name,
        col: "todo", write: null,
        open: function () { view = "horizon"; activeCspace = cs.id; horizonView = mine ? "fill" : "check"; renderAll(); } });
    });
  });
  // OKRs: objectives and key results of the current cycle
  var cyc = OKRS && (OKRS.cycles || []).find(function (c) { return c.key === activeCycle; }) || (OKRS && (OKRS.cycles || [])[0]);
  if (cyc) (cyc.objectives || []).forEach(function (ob) {
    var goOkr = function () { activeCycle = cyc.key; view = "okr"; renderAll(); };
    var owns = (typeof okrOwners === "function" ? okrOwners(ob) : []).map(function (e) { return String(e).toLowerCase(); });
    if (owns.indexOf(me.email) >= 0) {
      var p = typeof objPct === "function" ? objPct(ob) : 0;
      out.push({ key: "okr:" + (ob.id || ob.title), icon: "🎯", src: "Objective", title: ob.title, where: "OKRs · " + (cyc.name || cyc.key) + " · " + p + "%",
        col: p >= 100 ? "done" : p > 0 ? "progress" : "todo", write: null, open: goOkr });
    }
    (ob.krs || []).forEach(function (kr, n) {
      var ko = (typeof krOwners === "function" ? krOwners(kr) : []).map(function (e) { return String(e).toLowerCase(); });
      if (ko.indexOf(me.email) < 0 && !todoNameIsMe(me, kr.owner)) return;
      var q = typeof krPct === "function" ? krPct(kr) : 0;
      out.push({ key: "kr:" + (ob.id || ob.title) + ":" + n, icon: "📈", src: "Key result", title: kr.title, where: (ob.title || "OKR") + " · " + q + "%",
        col: q >= 100 ? "done" : q > 0 ? "progress" : "todo", write: null, open: goOkr });
    });
  });
  // roadmap module tasks (owner typed as a name)
  var walkMod = function (m, path, label) {
    var leaf = function (t, i, trail) {
      if (t.items && t.items.length) { t.items.forEach(function (s, j) { leaf(s, j, trail + "." + j); }); return; }
      if (!todoNameIsMe(me, t.owner)) return;
      out.push({ key: "mod:" + path + ":" + (t.tid || trail), icon: "🗺️", src: "Roadmap", title: t.title, where: label,
        col: todoColFromStatus(t.status), due: t.deadline,
        write: hasPerm("edit") ? function (k) { t.status = k === "todo" ? "planned" : k; saveRoadmap(); } : null,
        open: function () { view = "roadmap"; navTo(path); } });
    };
    (m.items || []).forEach(function (t, i) { leaf(t, i, String(i)); });
    (m.subs || []).forEach(function (s) { walkMod(s, path + "::" + s.key, label + " › " + s.name); });
  };
  ((DATA && DATA.modules) || []).forEach(function (m) { walkMod(m, m.key, m.name); });
  // Educational Content tasks (owner typed as a name)
  ((CONTENT && CONTENT.sections) || []).forEach(function (s) {
    var walk = function (t) {
      if (t.items && t.items.length) { t.items.forEach(walk); return; }
      if (!todoNameIsMe(me, t.owner)) return;
      out.push({ key: "edu:" + (t.tid || t.title), icon: "📚", src: "Content", title: t.title, where: s.name || "Educational Content",
        col: todoColFromStatus(t.status), due: t.deadline,
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
function todoMove(key, toCol) {
  if (key.indexOf("own:") === 0) {
    var it = TODO.items.find(function (x) { return "own:" + x.id === key; });
    if (!it || it.col === toCol) return;
    it.col = toCol;
    if (toCol === "done") it.doneAt = todayISO(); else delete it.doneAt;
    todoSave(); return;
  }
  var e = todoAssigned().find(function (x) { return x.key === key; });
  if (!e || e.col === toCol) return;
  if (e.write) { delete TODO.over[key]; e.write(toCol); todoSave(); return; }
  if (e.boardCol === "done" && toCol !== "done") { toast("Done on its board — open it there to reopen it"); return; }
  if (toCol === e.boardCol) delete TODO.over[key]; else TODO.over[key] = toCol;
  todoSave();
}

/* ---------- my own to-dos ---------- */
function todoEdit(item, col) {
  openDialog(item ? "Edit to-do" : "New to-do", item ? { title: item.title, note: item.note, duedate: item.due } : {}, function (v) {
    if (!v.title) return;
    if (item) { item.title = v.title; item.note = v.note || ""; if (v.duedate) item.due = v.duedate; else delete item.due; }
    else {
      var n = { id: todoId(), title: v.title, note: v.note || "", col: col || "todo", created: todayISO() };
      if (v.duedate) n.due = v.duedate;
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

/* ---------- the board ---------- */
function todoCounts() {
  var c = { todo: 0, progress: 0, done: 0 };
  todoAssigned().forEach(function (e) { c[e.col]++; });
  TODO.items.forEach(function (x) { c[x.col]++; });
  return c;
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
  var due = own ? own.due : entry.due;
  if (due && /^\d{4}-\d{2}-\d{2}$/.test(due)) {
    var d = todoEl("span", "td-due" + (col !== "done" && due < todayISO() ? " late" : ""), "📅 " + fmtD(due));
    meta.appendChild(d);
  }
  card.appendChild(meta);
  var acts = todoEl("div", "td-acts");
  if (own) {
    var ed = todoEl("button", "td-act", "Edit"); ed.onclick = function (ev) { ev.stopPropagation(); todoEdit(own); };
    var dl = todoEl("button", "td-act danger", "Delete"); dl.onclick = function (ev) { ev.stopPropagation(); todoDelete(own); };
    acts.append(ed, dl);
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
function renderContentTodo() {
  var wrap = $("content");
  wrap.innerHTML = "";
  if (!todoCan()) { wrap.appendChild(todoEl("div", "empty", "My To-do isn't switched on for you yet.")); return; }
  if (!TODO.loaded || TODO.team !== TEAM) {
    if (TODO.team !== TEAM) TODO.loaded = false;
    wrap.appendChild(todoEl("div", "empty", "Loading your to-dos…"));
    todoLoad(); return;
  }
  if (TODO.local) {
    var n = todoEl("div", "td-note", "Your own to-dos are saved in this browser only for now. They'll sync everywhere once supabase/stage20a_my_todos.sql has been run.");
    wrap.appendChild(n);
  }
  var assigned = todoAssigned();
  var board = todoEl("div", "kanban td-board");
  TODO_COLS.forEach(function (c) {
    var col = todoEl("div", "kcol td-col tc-" + c.key);
    col.addEventListener("dragover", function (ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; col.classList.add("kover"); });
    col.addEventListener("dragleave", function (ev) { if (ev.target === col) col.classList.remove("kover"); });
    col.addEventListener("drop", function (ev) { ev.preventDefault(); col.classList.remove("kover"); var k = ""; try { k = ev.dataTransfer.getData("text/plain"); } catch (_) { } if (k) todoMove(k, c.key); });
    var mine = TODO.items.filter(function (x) { return x.col === c.key; });
    var theirs = assigned.filter(function (e) { return e.col === c.key; });
    var head = todoEl("div", "kcol-head"); head.innerHTML = "<b></b><span class=\"cnt\"></span>";
    head.querySelector("b").textContent = c.label; head.querySelector(".cnt").textContent = mine.length + theirs.length;
    col.appendChild(head);
    var cards = [];
    if (c.key === "done") {
      mine.slice().sort(function (a, b) { return String(b.doneAt || "").localeCompare(String(a.doneAt || "")); }).forEach(function (x) { cards.push(todoCard(null, x)); });
      theirs.forEach(function (e) { cards.push(todoCard(e)); });
      var total = cards.length;
      if (!todoShowAllDone) cards = cards.slice(0, TODO_DONE_SHOW);
      cards.forEach(function (k) { col.appendChild(k); });
      if (total > TODO_DONE_SHOW) {
        var more = todoEl("button", "addline k-add", todoShowAllDone ? "Show fewer" : "Show all " + total);
        more.onclick = function () { todoShowAllDone = !todoShowAllDone; renderAll(); };
        col.appendChild(more);
      }
    } else {
      mine.forEach(function (x) { col.appendChild(todoCard(null, x)); });
      theirs.sort(function (a, b) { return String(a.due || "9999").localeCompare(String(b.due || "9999")); }).forEach(function (e) { col.appendChild(todoCard(e)); });
      var add = todoEl("button", "addline k-add", "＋ Add to-do");
      add.onclick = function () { todoEdit(null, c.key); };
      col.appendChild(add);
    }
    board.appendChild(col);
  });
  wrap.appendChild(board);
  if (!assigned.length && !TODO.items.length) {
    wrap.appendChild(todoEl("div", "empty", "Nothing assigned to you yet. Add your own to-dos with ＋ Add to-do."));
  }
}
/* the sidebar entry, at the top of Spaces */
function todoSideItem() {
  var b = todoEl("button", "ws-item td-side" + (view === "todo" ? " active" : ""));
  var c = TODO.loaded && TODO.team === TEAM ? todoCounts() : null;
  b.innerHTML = "<span>✅ My To-do</span>" + (c ? "<span class=\"td-side-n\"></span>" : "");
  if (c) { var open = c.todo + c.progress; b.querySelector(".td-side-n").textContent = open; b.title = open + " open · " + c.done + " done"; }
  b.onclick = function () { view = "todo"; renderAll(); };
  if ((!TODO.loaded || TODO.team !== TEAM) && !TODO.loading) todoLoad();
  return b;
}
