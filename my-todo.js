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
var TODO = { team: null, loaded: false, loading: false, local: false, items: [], over: {}, fixed: [], fixedDone: {} };
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
}
var _todoSaveT = null;
function todoSave() {
  // tick marks older than 60 days are dropped so the row stays small
  var cut = todoAddDays(todoToday(), -60);
  Object.keys(TODO.fixedDone).forEach(function (k) { if (k.split("|")[1] < cut) delete TODO.fixedDone[k]; });
  var data = { items: TODO.items, over: TODO.over, fixed: TODO.fixed, fixedDone: TODO.fixedDone };
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
