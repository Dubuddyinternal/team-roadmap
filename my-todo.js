/* =====================================================================
   MY TO-DO — a private planner, one per person per team. Plan top-down:

     🗓 Month / Quarter — a Gantt of everything I mean to get done: my own
        tasks, things assigned to me on the team's boards (📥 Assigned to
        me) and anything picked from any board (＋ From boards), in groups
        I name myself. Drag a bar to move it, its right end to stretch it,
        or onto another group to move it there.
     📅 Week — the same plan, only what runs in that week, one column per
        day, to fix the days.
     ✅ Day — the list of what runs on that day (and, on today, what's past
        its end and not done), with tick boxes.

   A group is "Planned" (tasks have start and done-by dates) or an
   "Ongoing log" (g.kind = "log") for things that come up and can't be
   planned — articles I'm reading, questions on my mind, where I'm stuck.
   I jot one down on the day; its bar runs from that day to today and keeps
   growing until I tick it done, then it ends on the day I finished, so the
   Week / Month / Quarter charts show what I actually did.

   🇮🇳 Why do I exist? has its own tab, next to My plan.

   💡 Ideas warehouse (third tab): one private place for every idea,
   imagination, question or note — instead of writing them in a WhatsApp
   group. Type (or speak, with the mic) and press Enter; each is kept with
   its time, newest first, grouped by day, pinned ones on top. Filter by
   kind, search, edit, pin, delete, or "→ Plan it" to put it on My plan.
   Stored in data.ideas: [{ id, text, kind, at (ISO time), pin, task }].

   A task: { id, title, group, start, end, done, note, ref }
     ref = { k:"asg", key } — an "assigned to me" card (todoAssigned keys)
         | { k:"tid", tid } — any item on a board (allTasks registry)
   A linked task shows its board's title and counts as done when it's done
   there (or ticked here). Ticking here never changes the board.

   Who sees it: anyone with the "My To-do" permission. Data: public.my_todos,
   one row per person per team, readable and writable only by that person
   (supabase/stage20a_my_todos.sql); falls back to this browser if the table
   can't be reached. The planner lives in data.planner; anything else in the
   row is kept as it was.
   Uses index.html globals (SUPA, TEAM, DEV, CSPACES, DATA, CONTENT, view,
   renderAll, rmlModal, rmlTreeLines, rmgColResizer, allTasks, effStatus,
   dNum, dISO, fmtD, toast …).
   ===================================================================== */
var TODO = { team: null, loaded: false, loading: false, local: false, why: null, whyMin: false, over: {}, planner: { groups: [], tasks: [] }, ideas: [], rest: {} };
var TODO_IDEA_KINDS = [["idea", "💡", "Idea"], ["imagine", "🌌", "Imagination"], ["question", "❓", "Question"], ["note", "📝", "Note"]];
var todoIdeaKind = "idea";     // the kind picked for the next one I write
var todoIdeaFilter = "";       // "" = all, else a kind
var todoIdeaQ = "";            // search text
var todoIdeaEdit = null;       // id of the idea being edited in place
var todoTab = "plan";          // plan | why — the two tabs at the top
var todoLevel = "quarter";     // quarter | month | week | day
var todoAt = {};               // level -> the ISO day it is looking at (unset = around today)
var todoQuickFocus = null;     // keep the cursor in a group's "＋ Add task…" box across the redraw
var TODO_LEVELS = [["quarter", "Quarter"], ["month", "Month"], ["week", "Week"], ["day", "Day"]];   // top-down: quarter first

function todoCan() { try { return !!currentUser() && hasPerm("my_todo"); } catch (_) { return false; } }
function todoEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function todoId() { return "td-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todoAddDays(iso, n) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function todoToday() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }   // local day, not UTC
function todoMonday(iso) { var w = (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; return todoAddDays(iso, -w); }

/* ---------- load / save ---------- */
function todoLocalKey() { var u = currentUser(); return "cf-todo-" + TEAM + "-" + (u ? u.id : "anon"); }
function todoPlannerNorm(p) {
  p = p && typeof p === "object" ? p : {};
  var groups = Array.isArray(p.groups) ? p.groups.filter(function (g) { return g && g.id && g.name; }) : [];
  if (!groups.length) groups = [{ id: "g-mine", name: "My work" }];
  var t0 = todoToday();
  var tasks = Array.isArray(p.tasks) ? p.tasks.filter(function (t) { return t && t.id && (t.title || t.ref); }) : [];
  tasks.forEach(function (t) {
    if (!groups.some(function (g) { return g.id === t.group; })) t.group = groups[0].id;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.start || "")) t.start = t0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.end || "") || t.end < t.start) t.end = t.start;
  });
  return { groups: groups, tasks: tasks };
}
function todoApply(d) {
  d = d && typeof d === "object" ? d : {};
  TODO.rest = {};
  Object.keys(d).forEach(function (k) { if (["why", "whyMin", "planner", "over", "ideas"].indexOf(k) < 0) TODO.rest[k] = d[k]; });   // older My To-do data: kept untouched
  TODO.why = todoWhyNorm(d.why);
  TODO.whyMin = !!d.whyMin;
  TODO.over = d.over && typeof d.over === "object" ? d.over : {};
  TODO.planner = todoPlannerNorm(d.planner);
  TODO.ideas = Array.isArray(d.ideas) ? d.ideas.filter(function (x) { return x && x.id && x.text; }) : [];
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
  renderAll();   // the page and the sidebar count
}
var _todoSaveT = null;
function todoSave() {
  var data = Object.assign({}, TODO.rest, { why: TODO.why, whyMin: TODO.whyMin, over: TODO.over, planner: TODO.planner, ideas: TODO.ideas });
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

/* ---------- things assigned to me on the team's boards ---------- */
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
// the status a card is waiting in on its own board, in that board's words
function todoKLabel(k) { var c = (typeof KCOLS !== "undefined" ? KCOLS : []).find(function (x) { return x.key === k; }); return c ? c.label : String(k || "To do"); }
function todoCap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
function todoAssigned() {
  var me = todoMe(), out = [];
  if (!me.email && !me.id) return out;
  var spaces = (CSPACES && CSPACES.list) || [];

  // Development / scrum cards
  ((DEV && DEV.cards) || []).forEach(function (c) {
    if ((c.assignee || "").toLowerCase() !== me.email) return;
    var sp = (DEV.spaces || []).find(function (s) { return s.id === c.space; });
    out.push({ key: "dev:" + c.id, hat: "product", icon: "🛠️", src: "Dev", title: c.title, where: sp ? sp.name : "Development",
      board: "Engineering · " + (sp ? sp.name : "Development"), status: todoKLabel(c.col),
      col: todoColFromKcol(c.col), due: todoISO(c.duedate),
      write: hasPerm("edit") ? function (k) { c.col = k; saveDev(); } : null,
      open: function () { view = "dev"; devSpace = c.space || null; devSprint = c.sprint || null; renderAll(); } });
  });
  // dev cards waiting in In Review with me as the reviewer (set automatically when a card reaches review)
  ((DEV && DEV.cards) || []).forEach(function (c) {
    if (c.col !== "review" || (c.assignee || "").toLowerCase() === me.email) return;
    var ep = c.epic ? (DEV.cards || []).find(function (x) { return x.id === c.epic; }) : null;
    if (ep && ep.col === "review") return;   // the whole epic is in review: one card for it, not one per story
    var isEpic = c.type === "epic", kids = isEpic ? (DEV.cards || []).filter(function (x) { return x.epic === c.id; }) : [];
    var rv = c.reviewer || (typeof devReviewerEmail === "function" ? devReviewerEmail() : "");   // cards already in review before the rule: same reviewer
    if (rv.toLowerCase() !== me.email) return;
    var sp = (DEV.spaces || []).find(function (s) { return s.id === c.space; }), key = "devrev:" + c.id;
    out.push({ key: key, hat: "product", icon: isEpic ? "⚡" : "🛠️", src: "Review", title: (isEpic ? "Epic: " : "") + c.title, where: sp ? sp.name : "Development",
      board: "Engineering · " + (sp ? sp.name : "Development"), status: "👀 In review — waiting for you" + (isEpic && kids.length ? " (" + kids.length + " stories)" : ""),
      col: TODO.over[key] || "todo", boardCol: "todo", due: todoISO(c.duedate),
      write: hasPerm("edit") ? function (k) { if (k === "done") { if (isEpic && typeof devEpicSetCol === "function") { delete TODO.over[key]; devEpicSetCol(c, "done"); return; } c.col = "done"; delete TODO.over[key]; saveDev(); } else if (k === "todo") delete TODO.over[key]; else TODO.over[key] = k; } : null,
      open: function () { view = "dev"; devSpace = c.space || null; devSprint = c.sprint || null; renderAll(); } });
  });
  // bugs
  (typeof teamBugs === "function" ? teamBugs() : []).forEach(function (t) {
    if ((t.assignee || "").toLowerCase() !== me.email) return;
    var b = t.board ? spaces.find(function (x) { return x.id === t.board; }) : null;
    out.push({ key: "bug:" + t.id, hat: "product", icon: "🐞", src: "Bug", title: t.title, where: b ? b.name : "Bugs",
      board: b ? b.name : "Bugs", status: todoKLabel(t.col),
      col: todoColFromKcol(t.col), due: todoISO(t.duedate),
      write: hasPerm("edit") ? function (k) { t.col = k; saveBugs(); } : null,
      open: function () { if (b) { view = "cbugs"; activeCspace = b.id; } else view = "bugs"; renderAll(); } });
  });
  spaces.forEach(function (cs) {
    if (!todoCanSee(cs)) return;
    // Product Roadmap ideas — due = the end date of the phase it's in
    if (cs.type === "discovery") (cs.ideas || []).forEach(function (i) {
      if ((i.assignee || "").toLowerCase() !== me.email) return;
      var hand = typeof discWithEng === "function" ? discWithEng(cs, i) : null;
      // with engineering: off my list; in review it comes back as the 👀 dev review card (so only hide it when that card is mine)
      if (hand && (hand.state === "eng" || (hand.card && (hand.email || "").toLowerCase() === me.email))) return;
      var st = (typeof discStages === "function" ? discStages(cs) : []).find(function (x) { return x.key === i.stage; });
      var ph = (cs.tl && cs.tl.items || []).find(function (t) { return t.tid === i.id && t.phase === i.stage && !t.done; });
      out.push({ key: "idea:" + i.id, hat: "product", icon: "💡", src: "Product Roadmap", title: i.title, where: cs.name + (st ? " · " + st.label : ""),
        board: cs.name, status: st ? st.label : todoCap(i.stage),
        col: (i.stage === "done" || i.stage === "wont") ? "done" : ["primary", "implres", "building"].indexOf(i.stage) >= 0 ? "progress" : "todo",
        due: ph ? todoISO(ph.end) : "",
        write: null, open: function () { view = "disc"; activeCspace = cs.id; discView = "roadmap"; renderAll(); } });
    });
    // Product All in One items (owner typed as a name)
    if (cs.type === "pdt") (cs.items || []).forEach(function (it) {
      if (!todoNameIsMe(me, it.owner)) return;
      var done = (it.lane === "bugs" && it.col === "done") || (it.lane === "qa" && it.col === "passed") || (it.lane === "dev" && it.col === "qa");
      out.push({ key: "pdt:" + it.id, hat: "product", icon: "🧩", src: "Product", title: it.title, where: cs.name,
        board: cs.name + (it.lane ? " · " + todoCap(it.lane) : ""), status: todoCap(it.col),
        col: done ? "done" : ["progress", "review", "testing", "verify"].indexOf(it.col) >= 0 ? "progress" : "todo", due: todoISO(it.due),
        write: null, open: function () { view = "pdt"; activeCspace = cs.id; pdtView = it.lane; renderAll(); } });
    });
    // Campaign pieces
    if (cs.type === "campaign") (cs.items || []).forEach(function (it, n) {
      if (!it.ownerId || it.ownerId !== me.id) return;
      out.push({ key: "camp:" + cs.id + ":" + (it.id || n), hat: "ceo", icon: "📣", src: "Campaign", title: it.name || "(piece)", where: cs.name,
        board: cs.name, status: it.sentCardId ? "Sent" : "To make",
        col: it.sentCardId ? "done" : "todo", write: null,
        open: function () { view = "campaign"; activeCspace = cs.id; campView = "assign"; renderAll(); } });
    });
    // Keep an Eye studies
    if (cs.type === "watch") (cs.companies || []).forEach(function (co, n) {
      if (!co.ownerId || co.ownerId !== me.id) return;
      out.push({ key: "watch:" + cs.id + ":" + (co.id || n), hat: "ceo", icon: "👀", src: "Keep an Eye", title: "Study " + (co.name || ""), where: cs.name,
        board: cs.name, status: "To study",
        col: "todo", due: todoISO(co.due), write: null,
        open: function () { view = "watch"; activeCspace = cs.id; watchView = "fill"; renderAll(); } });
    });
    // Widen our Horizon topics (answering or checking)
    if (cs.type === "horizon") (cs.topics || []).forEach(function (t, n) {
      var mine = t.ownerId && t.ownerId === me.id, check = t.checkerId && t.checkerId === me.id;
      if (!mine && !check) return;
      out.push({ key: "hz:" + cs.id + ":" + (t.id || n) + (mine ? "" : ":chk"), hat: "ceo", icon: "🔭", src: "Horizon", title: (mine ? "" : "Check: ") + (t.q || "(topic)"), where: cs.name,
        board: cs.name, status: mine ? "To answer" : "To check",
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
        board: "Roadmap · " + label, status: todoCap(t.status || "planned"),
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
        board: "Content · " + (s.name || "Educational Content"), status: todoCap(t.status || "planned"),
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

/* ---------- tasks: own or linked to a board ---------- */
// everything a linked task needs, built once per draw
function todoSources() {
  var S = { asg: {}, reg: {} };
  try { todoAssigned().forEach(function (e) { S.asg[e.key] = e; }); } catch (_) { }
  try { allTasks().forEach(function (x) { if (x.tid) S.reg[x.tid] = x; }); } catch (_) { }
  return S;
}
function todoInfo(t, S) {
  var r = t.ref, i = { title: t.title || "(untitled)", done: !!t.done, src: "", open: null };
  if (r && r.k === "asg") {
    var e = S.asg[r.key];
    if (e) { i.title = e.title || i.title; i.src = e.icon + " " + (e.board || e.where); i.done = i.done || e.col === "done"; i.open = e.open; }
    else i.src = "📥 no longer assigned to you";
  } else if (r && r.k === "tid") {
    var x = S.reg[r.tid];
    if (x) { i.title = x.task.title || x.task.name || i.title; i.src = "🔗 " + x.path; try { i.done = i.done || effStatus(x.task) === "done"; } catch (_) { } }
    else i.src = "🔗 not on its board any more";
  }
  return i;
}
function todoTasksIn(gid) {
  return TODO.planner.tasks.filter(function (t) { return t.group === gid; })
    .sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : 1; });
}
function todoGroup(gid) { return TODO.planner.groups.find(function (g) { return g.id === gid; }) || null; }
function todoIsLog(gid) { var g = todoGroup(gid); return !!g && g.kind === "log"; }
// the day a task's bar ends: an open log item runs up to today
function todoEnd(t, done) { if (todoIsLog(t.group) && !done) { var td = todoToday(); return td > t.start ? td : t.start; } return t.end; }
// "19 Oct → 25 Oct", or for a log item "since 19 Oct · ongoing" / "19 Oct → 21 Oct ✓"
function todoSpan(t, done) {
  if (todoIsLog(t.group) && !done) return "since " + fmtD(t.start) + " · ongoing";
  return fmtD(t.start) + (t.end !== t.start ? " → " + fmtD(t.end) : "") + (todoIsLog(t.group) ? " ✓" : "");
}
// tick / untick: a log item ends on the day it's finished
function todoSetDone(t, on, day) {
  if (on) { t.done = true; if (todoIsLog(t.group)) { var d = day && day < todoToday() ? day : todoToday(); t.end = d < t.start ? t.start : d; } }
  else { delete t.done; if (todoIsLog(t.group)) t.end = t.start; }
}
function todoGroupColor(gid) { var i = TODO.planner.groups.findIndex(function (g) { return g.id === gid; }); return RMG_COLORS[(i < 0 ? 0 : i) % RMG_COLORS.length]; }
function todoNewTask(title, gid, start, end, ref) {
  var t = { id: todoId(), title: title, group: gid, start: start, end: end || start };
  if (ref) t.ref = ref;
  TODO.planner.tasks.push(t);
  return t;
}
function todoGroupFor(name) {
  var g = TODO.planner.groups.find(function (x) { return x.name === name; });
  if (!g) { g = { id: todoId(), name: name }; TODO.planner.groups.push(g); }
  return g.id;
}
function todoEditTask(t, S) {
  var i = todoInfo(t, S);
  var fields = [];
  if (!t.ref) fields.push({ k: "title", label: "Task", type: "text", value: t.title || "" });
  fields.push(
    { k: "group", label: "Group", type: "select", value: t.group, opts: TODO.planner.groups.map(function (g) { return [g.id, g.name]; }) },
    { k: "start", label: "Starts", type: "date", value: t.start, half: true },
    { k: "end", label: todoIsLog(t.group) ? "Finished on" : "Done by", type: "date", value: t.end, half: true },
    { k: "done", label: "Status", type: "select", value: t.done ? "done" : "open", opts: [["open", "Not done yet"], ["done", "✓ Done"]] },
    { k: "note", label: "Note (optional)", type: "area", value: t.note || "" }
  );
  var extra = [];
  if (i.open) extra.push(["Open ↗", "Open it on its board", function () { i.open(); }]);
  extra.push(["Remove", t.ref ? "Take it off my plan (the card on its board stays)" : "Delete this task", function () {
    if (!confirm((t.ref ? "Take “" + i.title + "” off your plan?" : "Delete “" + i.title + "”?"))) return false;
    TODO.planner.tasks = TODO.planner.tasks.filter(function (x) { return x !== t; });
    todoSave();
  }, true]);
  rmlModal(t.ref ? i.title : "Edit task", fields, function (v) {
    if (!t.ref) { var nm = (v.title || "").trim(); if (!nm) { toast("Give it a name"); return false; } t.title = nm; }
    if (!v.start || !v.end) { toast("Pick both dates"); return false; }
    if (v.end < v.start) { toast("“Done by” is before the start"); return false; }
    var wasDone = !!t.done;
    t.group = v.group; t.start = v.start; t.end = v.end;
    if (v.done === "done") { t.done = true; if (!wasDone && todoIsLog(t.group) && v.end === t.start) todoSetDone(t, true); }
    else { delete t.done; if (todoIsLog(t.group)) t.end = t.start; }
    var n = (v.note || "").trim(); if (n) t.note = n; else delete t.note;
    todoSave();
  }, { sub: i.src || "My own task", extra: extra });
}
function todoEditGroup(g) {
  var fields = [
    { k: "name", label: "Group name", type: "text", value: g ? g.name : "", ph: "e.g. Product, Hiring, Reading, Questions on my mind" },
    { k: "kind", label: "Type", type: "select", value: g && g.kind === "log" ? "log" : "plan", opts: [
      ["plan", "Planned — tasks with start and done-by dates"],
      ["log", "Ongoing log — jot things as they come (reading, questions, stuck); ticking one done draws its bar"]] },
  ];
  var extra = [];
  var gs = TODO.planner.groups, idx = g ? gs.indexOf(g) : -1;
  if (idx > 0) extra.push(["↑ Move up", "Move this group up", function () { gs.splice(idx, 1); gs.splice(idx - 1, 0, g); todoSave(); }]);
  if (g && idx < gs.length - 1) extra.push(["↓ Move down", "Move this group down", function () { gs.splice(idx, 1); gs.splice(idx + 1, 0, g); todoSave(); }]);
  if (g && gs.length > 1) extra.push(["Delete group", "Its tasks move to the first other group", function () {
    var to = gs.find(function (x) { return x !== g; });
    if (!confirm("Delete the group “" + g.name + "”? Its tasks move to “" + to.name + "”.")) return false;
    TODO.planner.tasks.forEach(function (t) { if (t.group === g.id) t.group = to.id; });
    TODO.planner.groups = gs.filter(function (x) { return x !== g; });
    todoSave();
  }, true]);
  rmlModal(g ? "Edit group" : "New group", fields, function (v) {
    var nm = (v.name || "").trim(); if (!nm) { toast("Give the group a name"); return false; }
    if (!g) { g = { id: todoId(), name: nm }; gs.push(g); }
    g.name = nm;
    if (v.kind === "log") g.kind = "log"; else delete g.kind;
    TODO.planner.tasks.forEach(function (t) { if (t.group === g.id && v.kind === "log" && !t.done) t.end = t.start; });
    todoSave();
  }, { extra: extra });
}

/* ---------- pickers: assigned to me · from any board ---------- */
function todoPickDialog(title, sub, rows, onAdd, searchable) {
  var ov = todoEl("div", "overlay show"), dg = todoEl("div", "dialog td-pick");
  dg.setAttribute("role", "dialog"); dg.setAttribute("aria-modal", "true"); ov.appendChild(dg);
  dg.appendChild(todoEl("h3", "", title));
  if (sub) dg.appendChild(todoEl("div", "hint", sub));
  var q = null;
  if (searchable) { q = todoEl("input", "td-pick-q"); q.placeholder = "Search…"; dg.appendChild(q); }
  var list = todoEl("div", "td-pick-list"); dg.appendChild(list);
  var picked = {};
  var draw = function () {
    list.innerHTML = "";
    var s = q ? q.value.trim().toLowerCase() : "";
    var shown = rows.filter(function (r) { return !s || (r.title + " " + r.sub).toLowerCase().indexOf(s) >= 0; }).slice(0, 80);
    if (!shown.length) list.appendChild(todoEl("div", "hint", rows.length ? "Nothing matches." : "Nothing to add — it's all on your plan already."));
    shown.forEach(function (r) {
      var row = todoEl("label", "td-pick-row" + (r.on ? " on" : ""));
      var cb = todoEl("input"); cb.type = "checkbox"; cb.checked = !!picked[r.id]; cb.disabled = !!r.on;
      cb.onchange = function () { if (cb.checked) picked[r.id] = r; else delete picked[r.id]; };
      var tx = todoEl("span", "td-pick-tx");
      tx.appendChild(todoEl("b", "", r.title));
      tx.appendChild(todoEl("small", "", r.sub + (r.on ? " · already on your plan" : "")));
      row.append(cb, tx); list.appendChild(row);
    });
  };
  if (q) q.oninput = draw;
  draw();
  var close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
  var btns = todoEl("div", "btns"), cl = todoEl("button", "btn", "Cancel"), sv = todoEl("button", "btn save", "Place on my plan");
  cl.onclick = close;
  sv.onclick = function () { var ps = Object.keys(picked).map(function (k) { return picked[k]; }); if (!ps.length) { toast("Tick what to add"); return; } close(); onAdd(ps); };
  btns.append(cl, sv); dg.appendChild(btns);
  document.body.appendChild(ov);
  if (q) setTimeout(function () { q.focus(); }, 30);
}
// new linked tasks start on the first day in view that isn't before today, and run to their due date (or a week)
function todoPlaceStart() { var t = todoToday(), w = todoWindow(); return w.from > t ? w.from : t; }
function todoPickAssigned() {
  var on = {}; TODO.planner.tasks.forEach(function (t) { if (t.ref && t.ref.k === "asg") on[t.ref.key] = 1; });
  var rows = todoAssigned().filter(function (e) { return e.col !== "done"; }).map(function (e) {
    return { id: e.key, title: e.title || "(untitled)", sub: e.icon + " " + (e.board || e.where) + (e.status ? " · " + e.status : "") + (e.due ? " · due " + fmtD(e.due) : ""), on: !!on[e.key], e: e };
  });
  todoPickDialog("📥 Assigned to me", "Everything on the team's boards that's yours and not done. Tick and place them on your timeline.", rows, function (ps) {
    var gid = todoGroupFor("Assigned to me"), st = todoPlaceStart();
    ps.forEach(function (p) { var en = p.e.due && p.e.due >= st ? p.e.due : todoAddDays(st, 6); todoNewTask(p.title, gid, st, en, { k: "asg", key: p.id }); });
    todoSave(); toast(ps.length + " placed on your plan — drag them to the right days");
  });
}
function todoPickBoards() {
  var on = {}; TODO.planner.tasks.forEach(function (t) { if (t.ref && t.ref.k === "tid") on[t.ref.tid] = 1; });
  var reg = []; try { reg = allTasks(); } catch (_) { }
  var rows = reg.filter(function (x) { if (!x.tid || !(x.task.title || x.task.name)) return false; try { return effStatus(x.task) !== "done"; } catch (_) { return true; } })
    .map(function (x) { return { id: x.tid, title: x.task.title || x.task.name, sub: x.path, on: !!on[x.tid] }; });
  todoPickDialog("＋ From boards", "Pick anything from any board, roadmap or space to plan it here. The card itself doesn't change.", rows, function (ps) {
    var gid = todoGroupFor("From boards"), st = todoPlaceStart();
    ps.forEach(function (p) { todoNewTask(p.title, gid, st, todoAddDays(st, 6), { k: "tid", tid: p.id }); });
    todoSave(); toast(ps.length + " placed on your plan — drag them to the right days");
  }, true);
}

/* ---------- what the chart covers ---------- */
function todoWindow() {
  var t = todoToday(), at = todoAt[todoLevel] || t, from, to, label;
  if (todoLevel === "month") { from = at.slice(0, 7) + "-01"; to = monthEndISO(at.slice(0, 7)); label = ymShort(at.slice(0, 7)); }
  else if (todoLevel === "quarter") {
    var y = +at.slice(0, 4), q = Math.floor((+at.slice(5, 7) - 1) / 3);
    from = y + "-" + String(q * 3 + 1).padStart(2, "0") + "-01"; to = monthEndISO(y + "-" + String(q * 3 + 3).padStart(2, "0"));
    label = "Q" + (q + 1) + " " + y + " · " + ymShort(from.slice(0, 7)) + " – " + ymShort(to.slice(0, 7));
  }
  else if (todoLevel === "week") { from = todoMonday(at); to = todoAddDays(from, 6); label = "Week of " + fmtD(from); }
  else { from = to = at; label = (at === t ? "Today · " : at === todoAddDays(t, 1) ? "Tomorrow · " : "") + new Date(at + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" }) + " " + fmtD(at); }
  return { from: from, to: to, label: label };
}
function todoStep(dir) {
  var w = todoWindow(), at = w.from;
  if (todoLevel === "month") { var d = new Date(at + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + dir); at = d.toISOString().slice(0, 10); }
  else if (todoLevel === "quarter") { var q = new Date(at + "T00:00:00Z"); q.setUTCMonth(q.getUTCMonth() + 3 * dir); at = q.toISOString().slice(0, 10); }
  else at = todoAddDays(at, todoLevel === "week" ? 7 * dir : dir);
  todoAt[todoLevel] = at; renderAll();
}

/* ---------- the Gantt (month · quarter · week) ---------- */
function todoGantt(S) {
  var W = todoWindow(), today = todoToday();
  var week = todoLevel === "week";
  var d0 = dNum(week ? W.from : todoMonday(W.from)), dEnd = dNum(week ? W.to : todoAddDays(todoMonday(W.to), 6));
  var nD = dEnd - d0 + 1, nW = Math.round(nD / 7), tn = dNum(today);
  var dayOf = function (iso) { return dNum(iso) - d0; };
  var scroll = todoEl("div", "rmg-scroll td-gantt");
  var grid = todoEl("div", "rmg-grid rmg-days");
  var M = { id: "my-todo-" + todoLevel };   // per-level remembered name-column width
  var nameW = rmgNameW(M, 280), colsRest = "repeat(" + nD + ", minmax(" + (week ? 0 : todoLevel === "quarter" ? 9 : 0) + "px, 1fr))", minExtra = week ? 0 : todoLevel === "quarter" ? nD * 9 : 0;
  grid.style.gridTemplateColumns = nameW + "px " + colsRest;
  grid.style.minWidth = (nameW + minExtra) + "px";
  grid.appendChild(todoEl("div", "rmg-corner"));
  // header: days on the week chart, weeks on month / quarter
  if (week) {
    for (var i = 0; i < 7; i++) {
      var iso = dISO(d0 + i), c = todoEl("div", "rmg-wk" + (iso === today ? " now" : ""));
      c.style.gridColumn = String(2 + i);
      c.innerHTML = new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }) + "<small>" + fmtD(iso) + "</small>";
      grid.appendChild(c);
    }
  } else {
    for (var w = 0; w < nW; w++) {
      var wc = todoEl("div", "rmg-wk" + (tn >= d0 + w * 7 && tn < d0 + w * 7 + 7 ? " now" : ""));
      wc.style.gridColumn = (2 + w * 7) + " / span 7";
      wc.innerHTML = "Week " + (w + 1) + "<small>" + fmtD(dISO(d0 + w * 7)) + (nW <= 6 ? " – " + fmtD(dISO(d0 + w * 7 + 6)) : "") + "</small>";
      grid.appendChild(wc);
    }
  }
  var unit = week ? 1 : 7, nU = week ? 7 : nW;
  var cellsRow = function (row, gid, cls) {
    for (var u = 0; u < nU; u++) {
      var b = todoEl("div", "rmg-cell" + (cls ? " " + cls : "") + (tn >= d0 + u * unit && tn < d0 + u * unit + unit ? " now" : ""));
      b.dataset.lane = gid; b.style.gridRow = String(row); b.style.gridColumn = (2 + u * unit) + " / span " + unit;
      grid.appendChild(b);
    }
  };
  var rIdx = 2;
  TODO.planner.groups.forEach(function (g) {
    var log = g.kind === "log";
    var rows = todoTasksIn(g.id).map(function (t) { var I = todoInfo(t, S); return { t: t, I: I, end: todoEnd(t, I.done) }; })
      .filter(function (r) { return !(dayOf(r.end) < 0 || dayOf(r.t.start) > nD - 1); });
    var items = rows.map(function (r) { return r.t; });
    var lab = todoEl("div", "rmg-phase"); lab.style.gridRow = String(rIdx); lab.dataset.lane = g.id;
    lab.appendChild(todoEl("span", "rmg-pname", g.name));
    if (log) { var lg = todoEl("span", "td-logtag", "ongoing log"); lg.title = "Jot things as they come; a bar grows until you tick it done"; lab.appendChild(lg); }
    lab.appendChild(todoEl("span", "rmg-pct", items.length ? String(items.length) : ""));
    var ed = todoEl("button", "rml-mini", "✎"); ed.title = "Rename / move / delete group"; ed.onclick = function () { todoEditGroup(g); };
    lab.appendChild(ed);
    grid.appendChild(lab); cellsRow(rIdx, g.id, "phase");
    if (items.length) {
      var s0 = Math.max(0, Math.min.apply(null, items.map(function (t) { return dayOf(t.start); })));
      var e0 = Math.min(nD - 1, Math.max.apply(null, rows.map(function (r) { return dayOf(r.end); })));
      var sm = todoEl("div", "rmg-sum"); sm.style.gridRow = String(rIdx); sm.style.gridColumn = (s0 + 2) + " / " + (e0 + 3);
      grid.appendChild(sm);
    }
    rIdx++;
    rows.forEach(function (R) {
      var t = R.t, I = R.I, tEnd = R.end, open = log && !I.done;
      var nm = todoEl("div", "rmg-task" + (I.done ? " done" : "")); nm.style.gridRow = String(rIdx); nm.dataset.lane = g.id;
      nm.appendChild(todoEl("span", "rmg-tt", (I.done ? "✓ " : "") + I.title));
      nm.appendChild(todoEl("span", "rmg-td", todoSpan(t, I.done) + (I.src ? " · " + I.src : "")));
      nm.title = I.title + (I.src ? "\n" + I.src : "") + (t.note ? "\n" + t.note : "");
      nm.onclick = function () { todoEditTask(t, S); }; nm.style.cursor = "pointer";
      rmlTreeLines(nm, 1, [], false, 6, 18);
      grid.appendChild(nm); cellsRow(rIdx, g.id, "");
      var s = Math.max(0, dayOf(t.start)), e = Math.min(nD - 1, Math.max(s, dayOf(tEnd)));
      var bar = todoEl("div", "rmg-blk rmg-line" + (I.done ? " done" : "") + (open ? " td-open" : "") + (!I.done && !log && t.end < today ? " td-late" : ""));
      bar.style.gridRow = String(rIdx); bar.style.gridColumn = (s + 2) + " / " + (e + 3);
      bar.style.background = todoGroupColor(g.id);
      bar.title = nm.title + "\n" + todoSpan(t, I.done) + (open ? "\nStill going — tick it done (Day view or click) to end the bar" : "\nDrag to move · drag the right end to stretch");
      if (!open) bar.appendChild(todoEl("i", "td-grip"));
      todoBarDrag(bar, grid, t, function () { todoEditTask(t, S); });
      grid.appendChild(bar);
      rIdx++;
    });
    var add = todoEl("div", "rmg-task rmg-add"); add.style.gridRow = String(rIdx); add.dataset.lane = g.id;
    add.appendChild(todoQuickInput(g.id, function (v) {
      if (log) { todoNewTask(v, g.id, todoToday(), todoToday()); return; }   // a log item starts today and grows
      var st = todoPlaceStart();
      todoNewTask(v, g.id, st, week ? st : todoAddDays(st, 6));
    }, log ? "＋ Jot something…" : null));
    rmlTreeLines(add, 1, [], true, 6, 18);
    grid.appendChild(add); cellsRow(rIdx, g.id, "addrow");
    rIdx++;
  });
  if (tn >= d0 && tn <= dEnd) {
    var tl = todoEl("div", "rms-today"); tl.title = "Today";
    tl.style.gridRow = "1 / " + rIdx; tl.style.gridColumn = String(tn - d0 + 2);
    grid.appendChild(tl);
  }
  rmgColResizer(grid, M, nameW, 280, rIdx, colsRest, minExtra);
  scroll.appendChild(grid);
  return scroll;
}
// drag a bar sideways to move it (by day), its right end to stretch it, or onto another group's row
function todoBarDrag(bar, grid, t, onClick) {
  bar.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    var r0 = bar.getBoundingClientRect(), resize = !bar.classList.contains("td-open") && e.clientX > r0.right - 10;
    var sx = e.clientX, sy = e.clientY, moved = false, target = null;
    var dayPx = function () { var c = grid.querySelector(".rmg-cell"); var span = todoLevel === "week" ? 1 : 7; return c ? c.offsetWidth / span : 20; };
    var mark = function (id) { grid.querySelectorAll(".rmg-drop").forEach(function (x) { x.classList.remove("rmg-drop"); }); if (id) grid.querySelectorAll('[data-lane="' + id + '"]').forEach(function (x) { x.classList.add("rmg-drop"); }); };
    bar.setPointerCapture(e.pointerId);
    var mv = function (ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      moved = true; bar.classList.add("drag");
      if (resize) bar.style.width = Math.max(8, r0.width + dx) + "px";
      else {
        bar.style.transform = "translate(" + dx + "px," + dy + "px)";
        bar.style.visibility = "hidden";
        var under = document.elementFromPoint(ev.clientX, ev.clientY);
        bar.style.visibility = "";
        target = under && under.closest ? under.closest("[data-lane]") : null;
        mark(target && target.dataset.lane);
      }
    };
    var up = function (ev) {
      bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", up);
      mark(null); bar.classList.remove("drag");
      if (!moved) { onClick(); return; }
      var dd = Math.round((ev.clientX - sx) / (dayPx() || 1));
      if (resize) t.end = dISO(Math.max(dNum(t.start), dNum(t.end) + dd));
      else {
        if (dd) { t.start = dISO(dNum(t.start) + dd); t.end = dISO(dNum(t.end) + dd); if (bar.classList.contains("td-open")) t.end = t.start; }
        var lane = target && target.dataset.lane;
        if (lane && lane !== t.group && TODO.planner.groups.some(function (g) { return g.id === lane; })) t.group = lane;
      }
      todoSave();
    };
    bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", up);
  });
}
function todoQuickInput(gid, add, ph) {
  var inp = todoEl("input", "rml-qadd"); inp.type = "text"; inp.placeholder = ph || "＋ Add task…";
  inp.title = "Type a task and press Enter";
  inp.onkeydown = function (ev) {
    if (ev.key === "Escape") { inp.value = ""; inp.blur(); return; }
    if (ev.key !== "Enter") return;
    var v = inp.value.trim(); if (!v) return;
    add(v);
    todoQuickFocus = { key: todoLevel + ":" + gid, until: Date.now() + 2000 };
    todoSave();
  };
  if (todoQuickFocus && todoQuickFocus.key === todoLevel + ":" + gid && Date.now() < todoQuickFocus.until) setTimeout(function () { inp.focus(); }, 0);
  return inp;
}

/* ---------- the day list ---------- */
function todoDayList(S) {
  var day = todoWindow().from, today = todoToday();
  var box = todoEl("div", "td-day");
  var total = 0;
  TODO.planner.groups.forEach(function (g) {
    var log = g.kind === "log";
    var items = todoTasksIn(g.id).filter(function (t) {
      var dn = todoInfo(t, S).done;
      if (t.start <= day && todoEnd(t, dn) >= day) return true;
      return !log && day === today && t.end < today && !dn;   // past its end and not done: still on today
    });
    total += items.length;
    var sec = todoEl("div", "td-day-g");
    var hd = todoEl("div", "td-day-h");
    hd.appendChild(todoEl("b", "", g.name));
    if (log) hd.appendChild(todoEl("span", "td-logtag", "ongoing log"));
    hd.appendChild(todoEl("span", "rmg-pct", items.length ? String(items.length) : ""));
    sec.appendChild(hd);
    items.forEach(function (t) {
      var I = todoInfo(t, S), late = !log && !I.done && t.end < day;
      var row = todoEl("div", "td-day-row" + (I.done ? " done" : ""));
      var cb = todoEl("input"); cb.type = "checkbox"; cb.checked = I.done; cb.title = I.done ? "Mark not done" : "Mark done";
      cb.onchange = function () { todoSetDone(t, cb.checked, day); todoSave(); };
      var tx = todoEl("div", "td-day-tx");
      var nm = todoEl("span", "td-day-t", I.title); nm.onclick = function () { todoEditTask(t, S); };
      tx.appendChild(nm);
      tx.appendChild(todoEl("span", "td-day-m" + (late ? " late" : ""), (late ? "⚠ was due " + fmtD(t.end) : todoSpan(t, I.done)) + (I.src ? " · " + I.src : "")));
      row.append(cb, tx);
      if (I.open) { var op = todoEl("button", "td-day-open", "Open ↗"); op.onclick = function () { I.open(); }; row.appendChild(op); }
      sec.appendChild(row);
    });
    var add = todoEl("div", "td-day-row td-day-addrow");
    add.appendChild(todoQuickInput(g.id, function (v) { todoNewTask(v, g.id, day, day); }, log ? "＋ Jot something — an article, a question, where you're stuck…" : "＋ Add task for this day…"));
    sec.appendChild(add);
    box.appendChild(sec);
  });
  if (!total) box.insertBefore(todoEl("div", "td-day-empty", "Nothing planned for this day yet. Add it below, or plan it on the Month / Week chart."), box.firstChild);
  return box;
}

/* ---------- 💡 ideas warehouse ---------- */
function todoIdeaKindOf(k) { return TODO_IDEA_KINDS.find(function (x) { return x[0] === k; }) || TODO_IDEA_KINDS[0]; }
function todoLocalDay(iso) { var d = new Date(iso); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function todoIdeaTime(iso) { var d = new Date(iso); return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function todoIdeaPlan(x) {
  var groups = TODO.planner.groups;
  var put = function (gid) {
    var title = x.text.split("\n")[0].slice(0, 140), t0 = todoToday();
    var t = todoNewTask(title, gid, t0, todoIsLog(gid) ? t0 : todoAddDays(t0, 6));
    if (x.text.length > title.length) t.note = x.text;
    x.task = t.id; todoSave(); toast("Put on My plan — “" + todoGroup(gid).name + "”");
  };
  if (groups.length === 1) { put(groups[0].id); return; }
  openChoice("Which group on My plan?", groups.map(function (g) { return { label: g.name + (g.kind === "log" ? " (ongoing log)" : ""), value: g.id }; }), put);
}
function todoIdeaItem(x) {
  var K = todoIdeaKindOf(x.kind);
  var row = todoEl("div", "td-idea" + (x.pin ? " pin" : ""));
  row.appendChild(todoEl("span", "td-idea-k", K[1])).title = K[2];
  var body = todoEl("div", "td-idea-b");
  if (todoIdeaEdit === x.id) {
    var ta = todoEl("textarea", "td-idea-in"); ta.dataset.plain = "1"; ta.value = x.text; ta.rows = Math.min(8, x.text.split("\n").length + 1);
    var done = function () { var v = ta.value.trim(); if (v) x.text = v; todoIdeaEdit = null; todoSave(); };
    ta.onkeydown = function (ev) { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); done(); } else if (ev.key === "Escape") { todoIdeaEdit = null; renderAll(); } };
    body.appendChild(ta);
    var bt = todoEl("div", "td-idea-acts on"), sv = todoEl("button", "td-act", "Save"), cn = todoEl("button", "td-act", "Cancel");
    sv.onclick = done; cn.onclick = function () { todoIdeaEdit = null; renderAll(); };
    bt.append(sv, cn); body.appendChild(bt);
    setTimeout(function () { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
    row.appendChild(body); return row;
  }
  body.appendChild(todoEl("div", "td-idea-t", x.text));
  var meta = todoEl("div", "td-idea-m");
  meta.appendChild(todoEl("span", "", todoIdeaTime(x.at)));
  if (x.task && TODO.planner.tasks.some(function (t) { return t.id === x.task; })) meta.appendChild(todoEl("span", "td-idea-on", "🗓 on My plan"));
  body.appendChild(meta);
  var acts = todoEl("div", "td-idea-acts");
  var mk = function (txt, tip, fn, cls) { var b = todoEl("button", "td-act" + (cls ? " " + cls : ""), txt); b.title = tip; b.onclick = function (ev) { ev.stopPropagation(); fn(); }; acts.appendChild(b); };
  mk(x.pin ? "📌 Unpin" : "📌 Pin", x.pin ? "Take it off the top" : "Keep it at the top", function () { if (x.pin) delete x.pin; else x.pin = true; todoSave(); });
  mk("✎ Edit", "Change the words", function () { todoIdeaEdit = x.id; renderAll(); });
  mk("Kind…", "Idea, imagination, question or note", function () {
    openChoice("What kind is it?", TODO_IDEA_KINDS.map(function (k) { return { label: k[1] + " " + k[2], value: k[0] }; }), function (k) { x.kind = k; todoSave(); });
  });
  if (!(x.task && TODO.planner.tasks.some(function (t) { return t.id === x.task; }))) mk("→ Plan it", "Put it on My plan as a task", function () { todoIdeaPlan(x); });
  mk("Delete", "Delete it for good", function () { if (!confirm("Delete this " + K[2].toLowerCase() + "?")) return; TODO.ideas = TODO.ideas.filter(function (y) { return y !== x; }); todoSave(); }, "danger");
  meta.appendChild(acts);   // the buttons sit on the time line, shown on hover
  row.appendChild(body);
  return row;
}
function todoIdeas() {
  var box = todoEl("div", "td-ideas");
  // write box: pick a kind, type (or speak), Enter keeps it
  var cap = todoEl("div", "td-idea-cap");
  var kinds = todoEl("div", "td-idea-kinds");
  TODO_IDEA_KINDS.forEach(function (k) {
    var b = todoEl("button", "td-idea-kind" + (todoIdeaKind === k[0] ? " on" : ""), k[1] + " " + k[2]);
    b.onclick = function () { todoIdeaKind = k[0]; kinds.querySelectorAll(".td-idea-kind").forEach(function (z) { z.classList.toggle("on", z === b); }); inp.focus(); };
    kinds.appendChild(b);
  });
  cap.appendChild(kinds);
  var inp = todoEl("textarea", "td-idea-in"); inp.rows = 2; inp.dataset.plain = "1";   // plain text, no rich-text toolbar
  inp.placeholder = "Write anything that comes to mind… (Enter to keep it, Shift+Enter for a new line)";
  var keep = function () {
    var v = inp.value.trim(); if (!v) return;
    TODO.ideas.unshift({ id: todoId(), text: v, kind: todoIdeaKind, at: new Date().toISOString() });
    todoQuickFocus = { key: "ideas", until: Date.now() + 2000 };
    todoSave();
  };
  inp.onkeydown = function (ev) { if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); keep(); } };
  var row = todoEl("div", "td-idea-caprow"); row.appendChild(inp);
  var go = todoEl("button", "btn save", "Keep it"); go.onclick = keep; row.appendChild(go);
  cap.appendChild(row);
  box.appendChild(cap);
  if (todoQuickFocus && todoQuickFocus.key === "ideas" && Date.now() < todoQuickFocus.until) setTimeout(function () { inp.focus(); }, 0);
  // filter: all / by kind, and search
  var bar = todoEl("div", "td-idea-bar");
  var seg = todoEl("span", "rmg-seg");
  [["", "", "All"]].concat(TODO_IDEA_KINDS).forEach(function (k) {
    var n = TODO.ideas.filter(function (x) { return !k[0] || (x.kind || "idea") === k[0]; }).length;
    var b = todoEl("button", todoIdeaFilter === k[0] ? "on" : "", (k[1] ? k[1] + " " : "") + k[2] + (n ? " " + n : ""));
    b.onclick = function () { todoIdeaFilter = k[0]; renderAll(); };
    seg.appendChild(b);
  });
  bar.appendChild(seg);
  var q = todoEl("input", "td-idea-q"); q.type = "search"; q.placeholder = "Search…"; q.value = todoIdeaQ; q.dataset.nodictate = "1";
  q.oninput = function () { todoIdeaQ = q.value; var pos = q.selectionStart; renderAll(); var q2 = document.querySelector(".td-idea-q"); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (_) { } } };
  bar.appendChild(q);
  box.appendChild(bar);
  // the list: pinned first, then by day, newest first
  var s = todoIdeaQ.trim().toLowerCase();
  var list = TODO.ideas.filter(function (x) { return (!todoIdeaFilter || (x.kind || "idea") === todoIdeaFilter) && (!s || x.text.toLowerCase().indexOf(s) >= 0); })
    .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
  if (!list.length) { box.appendChild(todoEl("div", "td-idea-empty", TODO.ideas.length ? "Nothing matches." : "Nothing here yet. Everything you'd post in the WhatsApp group — write it here instead. Only you see it.")); return box; }
  var sec = function (title, items) {
    if (!items.length) return;
    var g = todoEl("div", "td-idea-day");
    g.appendChild(todoEl("div", "td-idea-dh", title));
    items.forEach(function (x) { g.appendChild(todoIdeaItem(x)); });
    box.appendChild(g);
  };
  sec("📌 Pinned", list.filter(function (x) { return x.pin; }));
  var t0 = todoToday(), y0 = todoAddDays(t0, -1), byDay = {}, order = [];
  list.filter(function (x) { return !x.pin; }).forEach(function (x) { var d = todoLocalDay(x.at); if (!byDay[d]) { byDay[d] = []; order.push(d); } byDay[d].push(x); });
  order.forEach(function (d) { sec(d === t0 ? "Today" : d === y0 ? "Yesterday" : new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }) + " " + fmtD(d), byDay[d]); });
  return box;
}

/* ---------- counts (sidebar and Summary) ---------- */
function todoCounts() {
  var S = todoSources(), t = todoToday(), c = { todo: 0, progress: 0, done: 0 };
  TODO.planner.tasks.forEach(function (x) {
    if (todoInfo(x, S).done) c.done++;
    else if (x.start <= t) c.progress++;   // running (or overdue)
    else c.todo++;
  });
  return c;
}

/* ---------- the page ---------- */
// the tab strip at the top of the page (index.html renderTabs calls this on My To-do)
function todoTabs(strip) {
  [["plan", "🗓 My plan"], ["ideas", "💡 Ideas warehouse"], ["why", "🇮🇳 Why do I exist?"]].forEach(function (T) {
    var b = todoEl("button", "tab" + (todoTab === T[0] ? " active" : ""), T[1]);
    b.onclick = function () { if (todoTab === T[0]) return; todoTab = T[0]; renderAll(); };
    strip.appendChild(b);
  });
}
function renderContentTodo() {
  var wrap = $("content");
  wrap.innerHTML = "";
  if (!todoCan()) { wrap.appendChild(todoEl("div", "empty", "My To-do isn't switched on for you yet.")); return; }
  if (!TODO.loaded || TODO.team !== TEAM) {
    if (TODO.team !== TEAM) TODO.loaded = false;
    wrap.appendChild(todoEl("div", "empty", "Loading your plan…"));
    todoLoad(); return;
  }
  if (TODO.local) wrap.appendChild(todoEl("div", "td-note", "Couldn't reach the database — your plan is saved in this browser for now."));
  if (todoTab === "why") { wrap.appendChild(todoWhyCard(false)); return; }
  if (todoTab === "ideas") { wrap.appendChild(todoIdeas()); return; }
  var S = todoSources();
  // the bar: Month · Quarter · Week · Day, ‹ Today ›, and where things come from
  var head = todoEl("section", "module-block rm-bar");
  var row = todoEl("div", "module-head");
  row.appendChild(todoEl("h2", "", "My plan"));
  var ctl = todoEl("span", "rmg-win"), seg = todoEl("span", "rmg-seg");
  TODO_LEVELS.forEach(function (L) {
    var b = todoEl("button", todoLevel === L[0] ? "on" : "", L[1]);
    b.title = { month: "Plan the month", quarter: "Plan the quarter", week: "Fix the days of this week", day: "The day's task list" }[L[0]];
    b.onclick = function () { if (todoLevel === L[0]) return; todoLevel = L[0]; renderAll(); };
    seg.appendChild(b);
  });
  ctl.appendChild(seg);
  var nb = function (txt, tip, fn) { var x = todoEl("button", "rmg-nav", txt); x.title = tip; x.onclick = fn; ctl.appendChild(x); };
  nb("‹", "Previous", function () { todoStep(-1); });
  nb("Today", "Back to now", function () { delete todoAt[todoLevel]; renderAll(); });
  nb("›", "Next", function () { todoStep(1); });
  ctl.appendChild(todoEl("span", "rmg-wl", todoWindow().label));
  row.appendChild(ctl);
  row.appendChild(todoEl("span", "spacer"));
  var nAsg = 0; try { var onP = {}; TODO.planner.tasks.forEach(function (t) { if (t.ref && t.ref.k === "asg") onP[t.ref.key] = 1; }); nAsg = Object.keys(S.asg).filter(function (k) { return S.asg[k].col !== "done" && !onP[k]; }).length; } catch (_) { }
  var mk = function (txt, tip, fn, cls) { var b = todoEl("button", "tool sm" + (cls ? " " + cls : ""), txt); b.title = tip; b.onclick = fn; row.appendChild(b); };
  mk("📥 Assigned to me" + (nAsg ? " (" + nAsg + ")" : ""), "Cards on the team's boards that are yours — place them on your timeline", todoPickAssigned, "primary");
  mk("＋ From boards", "Pick anything from any board to plan it here", todoPickBoards);
  mk("＋ Group", "Add a group (like a phase)", function () { todoEditGroup(null); });
  head.appendChild(row);
  wrap.appendChild(head);
  wrap.appendChild(todoLevel === "day" ? todoDayList(S) : todoGantt(S));
}
/* the sidebar entry, at the top of Spaces */
function todoSideItem() {
  var b = todoEl("button", "ws-item td-side" + (view === "todo" ? " active" : ""));
  var ok = TODO.loaded && TODO.team === TEAM;
  b.innerHTML = "<span>✅ My To-do</span>" + (ok ? "<span class=\"td-side-n\"></span>" : "");
  if (ok) {
    var c = todoCounts(), n = c.progress;
    b.querySelector(".td-side-n").textContent = n;
    b.title = n + " running now · " + c.todo + " later · " + c.done + " done";
  }
  b.onclick = function () { view = "todo"; renderAll(); };
  if ((!TODO.loaded || TODO.team !== TEAM) && !TODO.loading) todoLoad();
  return b;
}
