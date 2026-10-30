/* =====================================================================
   MY TO-DO / OUR TO-DO — a planner, one per person per team (everyone in
   the team has one), that a person can share with chosen teammates (👥 Our To-do, further down:
   a co-founder and I can each open and change the other's plan, one shared ideas
   warehouse). Plan top-down:

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

   🗺 From roadmaps: every task on the team's roadmap charts (Gantt,
   Swimlane, Lanes…), listed by roadmap › phase with owner and dates, mine
   first; placed with the chart's dates in a group named after the roadmap,
   linked (ref.map) so it shows "🗺 Roadmap › Phase" and its done state.

   A task can have subtasks (t.parent = the task's id, one level): "＋ Sub"
   on a task adds them; they sit indented under it, follow it to another
   group and go when it's removed. ▾ / ▸ folds them (t.fold).

   The Day view is the day's list next to an hour-by-hour timeline (from
   the wake-up target to bedtime): 🕘 on a task, or dragging it onto the
   timeline, gives it a time on that day (t.slots[day] = { at, dur });
   drag a block up / down to move it, its bottom edge to make it longer,
   click an empty time to write a new task there. A red line marks now.

   Task types (t.type) say what a task needs from me, so I can plan the
   right kind of time for it: 🔁 Follow-up, ✅ Approval, ⚖️ Decision,
   🔍 Research, 👀 Review, 👥 Meeting, 🛠 Do it, 📚 Learn. A small tag on
   each task (click to change), a line on the Day view adding up what the
   day needs, and a type's usual length when it goes on the timeline.

   The Day view starts with ⏰ Wake up and ends with 🌙 Go to bed: two small
   clocks with a target time (click to change), "I'm up" / "Going to bed"
   to log now (or ✎ to type the time), how early / late that was, hours
   slept, and live "awake for…" / "…till bed". TODO.clock = { wake, sleep }
   targets; TODO.sleepLog = { "YYYY-MM-DD": { wake, sleep } } (a bedtime
   after midnight counts for the evening before).

   🧭 Why I do what I do has its own tab, next to My plan: point 1 is 🇮🇳 Why do I exist?
   (the ladder), then my own points — a question and the answer (TODO.why.points).

   💭 Thoughts warehouse (second tab, was "Ideas warehouse"): one place for
   every idea, imagination, question, note, ⚖️ contention (a disagreement to
   settle) or 🔁 recurring issue (a problem that keeps coming back) — instead
   of writing them in a WhatsApp group. A recurring issue has "🔁 Again" to
   log each time it comes up (x.again: ISO times); both those kinds can be
   marked "✔ Solved" (x.solved: ISO time). Type (or speak, with the mic) and press Enter; each is kept with
   its time, newest first, grouped by day, pinned ones on top. Filter by
   kind, search, edit, pin, delete, or "→ Plan it" to put it on My plan.
   Stored in data.ideas: [{ id, text, kind, at (ISO time), pin, task, again, solved }].

   A task: { id, title, group, start, end, done, note, ref }
     📥 Assigned to me also lists every row on a space's own 🗓 Timeline whose
   👤 Owner is me (Product Roadmap, process, marketing, Engineering…), with
   the row's dates — the owner, not the space's admins.

   ref = { k:"asg", key } — an "assigned to me" card (todoAssigned keys)
         | { k:"tid", tid } — any item on a board (allTasks registry)
   A linked task shows its board's title and counts as done when it's done
   there (or ticked here). Ticking here never changes the board.

   Who sees it: everyone in the team — "✅ My To-do" (their own plan, with
   everything assigned to them and every 💬 comment they're @-tagged in), or
   "✅ Our To-do" for people in a circle (below).
   Data: public.my_todos, one row per person per team, written only by that
   person and read by them and the teammates in their Our To-do circle
   (supabase/stage20a_my_todos.sql, stage20b_our_todos.sql); falls back to
   this browser if the table can't be reached. The planner lives in data.planner; anything else in the
   row is kept as it was.
   Uses index.html globals (SUPA, TEAM, DEV, CSPACES, DATA, CONTENT, view,
   renderAll, rmlModal, rmlTreeLines, rmgColResizer, allTasks, effStatus,
   dNum, dISO, fmtD, toast …).
   ===================================================================== */
var TODO = { team: null, loaded: false, loading: false, local: false, why: null, whyMin: false, over: {}, planner: { groups: [], tasks: [] }, ideas: [], clock: { wake: "06:00", sleep: "22:00" }, sleepLog: {}, phase: null, temple: [], prayLog: {}, rest: {} };
var TODO_IDEA_KINDS = [["idea", "💡", "Idea"], ["imagine", "🌌", "Imagination"], ["question", "❓", "Question"], ["note", "📝", "Note"], ["contention", "⚖️", "Contention"], ["recurring", "🔁", "Recurring issue"]];
var TODO_IDEA_SOLVABLE = ["contention", "recurring"];   // these two can be marked ✔ Solved
var todoIdeaKind = "idea";     // the kind picked for the next one I write
var todoIdeaFilter = "";       // "" = all, else a kind
var todoIdeaQ = "";            // search text
var todoIdeaEdit = null;       // id of the idea being edited in place
var todoTab = "plan";          // plan | why — the two tabs at the top
var todoLevel = "quarter";     // quarter | month | week | day
var todoAt = {};               // level -> the ISO day it is looking at (unset = around today)
var todoQuickFocus = null;     // keep the cursor in a group's "＋ Add task…" box across the redraw
var todoSubAdd = null;         // id of the task whose "＋ Add subtask…" box is open
var todoAddIn = null;          // id of the group whose "＋ Add task…" box is open (opened by its ＋)
var TODO_LEVELS = [["quarter", "Quarter"], ["month", "Month"], ["week", "Week"], ["day", "Day"]];   // top-down: quarter first

// everyone in the team has their own My To-do; the "My To-do" permission or an Our To-do circle also opens it
function todoCan() {
  try {
    var u = currentUser();
    if (!u) return false;
    if (u.super || (typeof isMember === "function" && isMember(u, TEAM)) || hasPerm("my_todo")) return true;
    if (OUR.team !== TEAM && !OUR.loading) todoCircleLoad();
    return OUR.team === TEAM && !!OUR.circle;
  } catch (_) { return false; }
}
function todoEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function todoId() { return "td-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todoAddDays(iso, n) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function todoToday() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }   // local day, not UTC
function todoMonday(iso) { var w = (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; return todoAddDays(iso, -w); }

/* ---------- load / save ---------- */
// whose To-do is open: mine, or the teammate's I share Our To-do with (todoPeek) — both fully editable
function todoOwnerId() { return todoPeek || (currentUser() || {}).id || ""; }
function todoLocalKey() { return "cf-todo-" + TEAM + "-" + (todoOwnerId() || "anon"); }
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
  Object.keys(d).forEach(function (k) { if (["why", "whyMin", "planner", "over", "ideas", "clock", "sleepLog", "phase", "temple", "prayLog"].indexOf(k) < 0) TODO.rest[k] = d[k]; });   // older My To-do data: kept untouched
  TODO.why = todoWhyNorm(d.why);
  TODO.whyMin = !!d.whyMin;
  TODO.over = d.over && typeof d.over === "object" ? d.over : {};
  TODO.planner = todoPlannerNorm(d.planner);
  Object.assign(TODO, todoDayNorm(d));
  TODO.temple = todoTempleNorm(d.temple);
  TODO.prayLog = d.prayLog && typeof d.prayLog === "object" ? d.prayLog : {};
  TODO.ideas = Array.isArray(d.ideas) ? d.ideas.filter(function (x) { return x && x.id && x.text; }) : [];
}
// the parts of a plan the Day view draws besides tasks: wake / sleep targets and log, the phase banner
function todoDayNorm(d) {
  // wake / sleep: targets (older My To-do kept them in settings) and the log, which carries over
  var hm = function (v) { return /^\d{2}:\d{2}$/.test(v || "") ? v : ""; }, os = d.settings || {}, ck = d.clock || {};
  var ph = d.phase && typeof d.phase === "object" ? d.phase : null;
  return {
    clock: { wake: hm(ck.wake) || hm(os.wakeAt) || "06:00", sleep: hm(ck.sleep) || hm(os.sleepAt) || "22:00" },
    sleepLog: d.sleepLog && typeof d.sleepLog === "object" ? d.sleepLog : {},
    phase: ph && ph.text ? { text: String(ph.text), note: String(ph.note || ""), until: todoISO(ph.until) } : null,
  };
}
async function todoLoad() {
  if (TODO.loading) return;
  TODO.loading = true;
  TAGS.who = null;   // pick up new @-tags too
  var who = todoOwnerId(), d = null, local = false;
  try {
    if (!SUPA) throw new Error("no database");
    var r = await SUPA.from("my_todos").select("data,user_id").eq("team_slug", TEAM);
    if (r.error) throw r.error;
    // the rows I can read: mine and the people I share Our To-do with — take the one that's open
    var rows = r.data || [], row = rows.find(function (x) { return x.user_id === who; }) || (!todoPeek ? rows.find(function (x) { return !x.user_id; }) : null);
    d = row ? row.data : null;
  } catch (e) {
    local = true;   // table not reachable or offline: keep them in this browser
    try { d = JSON.parse(localStorage.getItem(todoLocalKey()) || "null"); } catch (_) { d = null; }
  }
  TODO.loading = false;
  if (who !== todoOwnerId()) { todoLoad(); return; }   // switched to the other person meanwhile
  todoApply(d);
  TODO.local = local; TODO.team = TEAM; TODO.loaded = true;
  renderAll();   // the page and the sidebar count
  if (!OUR.loaded || OUR.team !== TEAM) todoCircleLoad();   // who I share Our To-do with, shared ideas
}
// saves wait 600ms (typing, dragging); one timer per person, so switching never mixes two plans
var _todoSaveT = {}, _todoSaveRun = {};
function todoSave() {
  var who = todoOwnerId(), key = todoLocalKey();
  var data = Object.assign({}, TODO.rest, { why: TODO.why, whyMin: TODO.whyMin, over: TODO.over, planner: TODO.planner, ideas: TODO.ideas, clock: TODO.clock, sleepLog: TODO.sleepLog, phase: TODO.phase, temple: TODO.temple, prayLog: TODO.prayLog });
  clearTimeout(_todoSaveT[who]);
  var run = _todoSaveRun[who] = async function () {
    if (_todoSaveRun[who] !== run) return;
    delete _todoSaveRun[who]; delete _todoSaveT[who];
    if (!TODO.local && SUPA) {
      var r = await SUPA.from("my_todos").upsert({ user_id: who, team_slug: TEAM, data: data, updated_at: new Date().toISOString() }, { onConflict: "user_id,team_slug" });
      if (!r.error) return;
      TODO.local = true;
    }
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) { }
  };
  _todoSaveT[who] = setTimeout(run, 600);
  renderAll();
}
function todoSaving() { return Object.keys(_todoSaveT).length > 0; }
async function todoFlush() {
  var runs = Object.keys(_todoSaveRun).map(function (k) { clearTimeout(_todoSaveT[k]); return _todoSaveRun[k]; });
  for (var i = 0; i < runs.length; i++) await runs[i]();
}

/* ---------- things assigned to me on the team's boards ---------- */
function todoMe() {   // the person whose To-do is open
  var u = (todoPeek ? todoPerson(todoPeek) : currentUser()) || {};
  var names = [u.name, u.username, typeof userDisplayName === "function" ? userDisplayName(u) : ""]
    .filter(Boolean).map(function (s) { return String(s).trim().toLowerCase(); });
  return { email: (u.email || "").toLowerCase(), id: u.id || "", names: names };
}
function todoNameIsMe(me, s) { return !!s && me.names.indexOf(String(s).trim().toLowerCase()) >= 0; }
// an owner field can name a few people ("Sumit, Shivam" / "Sumit & Shivam")
function todoOwners(s) { return String(s || "").split(/\s*(?:,|&|\/|\+|\band\b)\s*/i).map(function (x) { return x.trim(); }).filter(Boolean); }
function todoOwnerIsMe(me, s) { return todoOwners(s).some(function (n) { return todoNameIsMe(me, n); }); }
function todoOwnedByOther(me, s) { return todoOwners(s).length > 0 && !todoOwnerIsMe(me, s); }
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
  // sprints I own (Engineering → the sprint's 👤 owner): one bar for the whole sprint, its dates
  ((DEV && DEV.sprints) || []).forEach(function (sp) {
    if (!sp.owner || String(sp.owner).toLowerCase() !== me.email) return;
    var cards = (DEV.cards || []).filter(function (c) { return c.sprint === sp.id && (typeof devWork !== "function" || devWork(c)); });
    var done = cards.filter(function (c) { return c.col === "done"; }).length;
    var team = (DEV.spaces || []).find(function (x) { return x.id === sp.space; }), r = typeof devSprintRange === "function" ? devSprintRange(sp) : null;
    out.push({ key: "sprint:" + sp.id, hat: "product", icon: "🏃", src: "Sprint", title: "Sprint: " + sp.name, where: team ? team.name : "Development",
      board: "Engineering · " + (team ? team.name : "Development"), status: sp.completed ? "Completed" : "Sprint owner · " + done + "/" + cards.length + " done",
      col: sp.completed ? "done" : done ? "progress" : "todo", start: r ? r.start : "", due: r ? r.end : "", write: null,
      open: function () { view = "dev"; devSpace = sp.space; devSprint = sp.id; devView = "board"; renderAll(); } });
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
      if (!todoOwnerIsMe(me, it.owner)) return;
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
      if (!todoOwnerIsMe(me, t.owner)) return;
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
  // roadmap charts (Gantt) — the task's Owner is picked from the team's members
  var reg = {}; try { allTasks().forEach(function (x) { if (x.tid) reg[x.tid] = x; }); } catch (_) { }
  ((typeof RMAPS !== "undefined" && RMAPS.maps) || []).forEach(function (m) {
    (m.items || []).forEach(function (it) {
      if (!todoOwnerIsMe(me, it.owner)) return;
      var x = reg[it.tid], rm = todoRoadmapItem(m.id, it.tid); if (!x || !rm) return;
      var st = ""; try { st = effStatus(x.task); } catch (_) { }
      out.push({ key: "rmap:" + m.id + ":" + it.tid, hat: "product", icon: "🗺", src: "Roadmap", title: x.task.title || x.task.name || "(untitled)", where: rm.where,
        board: rm.where, status: todoCap(st || "planned"),
        col: todoColFromStatus(st), due: todoISO(it.end), write: null, open: rm.open });
    });
  });
  // every space's own Timeline (Product Roadmap, process, marketing, Engineering…) — the row's 👤 Owner, not the space's admins
  var have = {}; out.forEach(function (e) { have[e.key] = 1; });
  var tlSpaces = ((typeof DEV !== "undefined" && DEV.tlHost && DEV.tlHost.gantt) ? [DEV.tlHost] : []).concat(spaces);
  tlSpaces.forEach(function (cs) {
    if (!cs.gantt || (cs.id && !todoCanSee(cs))) return;
    (cs.gantt.items || []).forEach(function (it) {
      if (!it.tid || !todoOwnerIsMe(me, it.owner)) return;
      var x = reg[it.tid]; if (!x || !x.task) return;
      if (have["idea:" + it.tid]) {   // already on the list as my Product Roadmap idea: give it the row's dates
        var ie = out.find(function (e) { return e.key === "idea:" + it.tid; });
        if (ie && !ie.due && it.end) { ie.start = todoISO(it.start); ie.due = todoISO(it.end); }
        return;
      }
      var key = "tl:" + (cs.id || "eng") + ":" + it.tid; if (have[key]) return; have[key] = 1;
      var st = ""; try { st = effStatus(x.task); } catch (_) { }
      var done = it.done || st === "done" || x.task.stage === "done" || x.task.col === "done";
      var name = cs.name || "Engineering";
      out.push({ key: key, hat: "product", icon: "🗓", src: "Timeline", title: x.task.title || x.task.name || "(untitled)", where: name + " · Timeline",
        board: name + " · Timeline", status: done ? "Done" : todoCap(st || "planned"),
        col: done ? "done" : todoColFromStatus(st), start: todoISO(it.start), due: todoISO(it.end), write: null,
        open: function () { if (cs.id && typeof goSpace === "function") goSpace(cs, "timeline"); else { view = "dev"; renderAll(); } } });
    });
  });
  // Educational Content tasks (owner typed as a name)
  ((CONTENT && CONTENT.sections) || []).forEach(function (s) {
    var walk = function (t) {
      if (t.items && t.items.length) { t.items.forEach(walk); return; }
      if (!todoOwnerIsMe(me, t.owner)) return;
      out.push({ key: "edu:" + (t.tid || t.title), hat: "ceo", icon: "📚", src: "Content", title: t.title, where: s.name || "Educational Content",
        board: "Content · " + (s.name || "Educational Content"), status: todoCap(t.status || "planned"),
        col: todoColFromStatus(t.status), due: todoISO(t.deadline),
        write: hasPerm("edit") ? function (k) { t.status = k === "todo" ? "planned" : k; saveContent(); } : null,
        open: function () { view = "content"; activeSection = s.key; renderAll(); } });
    };
    (s.tasks || []).forEach(walk);
  });
  // 💬 comments I'm @-tagged in (last 30 days) — a thing to answer or do; ticking it here only changes my plan
  if (TAGS.who === me.id && TAGS.team === TEAM) TAGS.rows.forEach(function (c) {
    var snip = String(c.body || "").replace(/[*_`#>\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 90);
    out.push({ key: "tag:" + c.id, hat: "ceo", icon: "🏷", src: "Tagged", title: (c.author_name || "A teammate") + ": " + (snip || "(a photo or file)"),
      where: c.place_label || "a comment", board: c.place_label || "Comments", status: "@ tagged you", col: "todo", due: "", write: null,
      open: function () { try { var b = btoa(unescape(encodeURIComponent(JSON.stringify(c.nav || {})))); if (window.cmtGo && c.nav && c.nav.view) window.cmtGo(b, c.id); else toast("Couldn't open that comment"); } catch (_) { toast("Couldn't open that comment"); } } });
  });
  else if (me.id && !TAGS.loading) todoTagsLoad(me.id);
  // where I put each one here (only for items whose board can't take the move); done on the board always wins
  out.forEach(function (e) {
    var o = TODO.over[e.key];
    e.boardCol = e.col;
    if (o && e.col !== "done" && !e.write) e.col = o;
  });
  return out;
}

// the 💬 comments that @-tag the person whose To-do is open (team_comments, stage19a); none if it can't be read
var TAGS = { who: null, team: null, loading: false, rows: [] };
async function todoTagsLoad(who) {
  if (TAGS.loading || !SUPA) return;
  TAGS.loading = true;
  var rows = [];
  try {
    var since = new Date(Date.now() - 30 * 864e5).toISOString();
    var r = await SUPA.from("team_comments").select("id,place_label,nav,author_id,author_name,body,created_at")
      .eq("team_slug", TEAM).contains("mentions", [who]).gte("created_at", since).order("created_at", { ascending: false }).limit(100);
    if (!r.error) rows = (r.data || []).filter(function (c) { return c.author_id !== who; });
  } catch (_) { }
  TAGS.who = who; TAGS.team = TEAM; TAGS.rows = rows; TAGS.loading = false;
  if (rows.length && typeof view !== "undefined" && view === "todo") renderAll();
}

/* a sprint someone is made owner of lands on their plan by itself (in "Sprints", with the sprint's dates) —
   once: if it's taken off, it stays off (TODO.over["auto:<key>"] remembers) */
function todoAutoPlace() {
  var on = todoOnPlan(), added = 0;
  todoAssigned().forEach(function (e) {
    if (e.key.indexOf("sprint:") !== 0 || e.col === "done" || on[e.key] || TODO.over["auto:" + e.key]) return;
    var st = e.start || todoToday(), en = e.due && e.due >= st ? e.due : todoAddDays(st, 13);
    todoNewTask(e.title, todoGroupFor("Sprints"), st, en, { k: "asg", key: e.key });
    TODO.over["auto:" + e.key] = 1; added++;
  });
  return added;
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
// Sumit's own ladder: what plans got before each person wrote their own — now only used to spot
// those copies (saved as-is in others' rows) and clear them; everyone starts empty and writes theirs
var TODO_WHY = {
  goal: "Self-reliant India",
  steps: ["AI", "Semiconductors", "Defence", "Phones", "Missiles", "Rockets & space", "Drones & UAVs", "Fighter planes", "Aeroplanes"],
  from: "Dubuddy + Sumit",
  line: "Every dot will be something my country should do and isn't doing yet.",
};
function todoWhyIsCopy(w) {
  return String(w.goal || "") === TODO_WHY.goal && String(w.from || "") === TODO_WHY.from && String(w.line || "") === TODO_WHY.line
    && Array.isArray(w.steps) && w.steps.join("\n") === TODO_WHY.steps.join("\n");
}
function todoWhyNorm(w) {
  w = w && typeof w === "object" ? w : {};
  var mine = !todoWhyIsCopy(w);   // an untouched copy of Sumit's ladder → empty, for them to fill in
  return {
    goal: mine ? String(w.goal || "") : "",
    steps: mine && Array.isArray(w.steps) ? w.steps.map(String).filter(Boolean) : [],
    from: mine ? String(w.from || "") : "",
    line: mine && w.line != null ? String(w.line) : "",
    seen: String(w.seen || ""),
    // the other points under "Why I do what I do": a question and my answer
    points: Array.isArray(w.points) ? w.points.filter(function (x) { return x && x.id && x.q; }).map(function (x) { return { id: String(x.id), q: String(x.q), a: String(x.a || "") }; }) : [],
  };
}
// the ladder: goal at the top, me at the bottom, the dots in between
function todoWhyCard(inPop) {
  var W = TODO.why, box = todoEl("div", "td-why" + (inPop ? " pop" : ""));
  var hd = todoEl("div", "td-why-hd");
  hd.appendChild(todoEl("b", "", inPop ? "🇮🇳 Why do I exist?" : "1 · 🇮🇳 Why do I exist?"));
  if (!inPop) { var ed = todoEl("button", "td-act", "✏️ Edit"); ed.onclick = todoWhyEdit; hd.appendChild(ed); }
  box.appendChild(hd);
  if (!W.goal) {   // not written yet: their own answer, not anyone else's
    var e = todoEl("div", "td-whypt-a none", "Not written yet. Where does your work lead — the big thing you want to help happen? And what are the steps from you to there? ✏️ Edit to write your answer.");
    e.style.cursor = "pointer"; e.onclick = todoWhyEdit;
    box.appendChild(e);
    return box;
  }
  var lad = todoEl("ol", "td-why-lad");
  var dot = function (txt, cls) { lad.appendChild(todoEl("li", cls || "", txt)); };
  dot(W.goal, "top");
  W.steps.slice().reverse().forEach(function (t) { dot(t); });
  dot(W.from || todoFirstName(todoOwnerId()), "me");
  box.appendChild(lad);
  if (W.line) box.appendChild(todoEl("div", "td-why-line", W.line));
  return box;
}
function todoWhyEdit() {
  var W = TODO.why, goal, steps, from, line;
  todoDialog("🇮🇳 Why do I exist?", function (body) {
    goal = todoEl("input"); goal.value = W.goal; goal.placeholder = "e.g. Self-reliant India";
    steps = todoEl("textarea"); steps.rows = 9; steps.value = W.steps.join("\n"); steps.dataset.plain = "1";   // a plain list, no rich text
    from = todoEl("input"); from.value = W.from; from.placeholder = "e.g. Dubuddy + " + todoFirstName(todoOwnerId());
    line = todoEl("textarea"); line.rows = 2; line.value = W.line; line.dataset.plain = "1";
    body.append(todoField("Where it leads (top dot)", goal), todoField("The dots on the way — one per line", steps),
      todoField("Where it starts (bottom dot)", from), todoField("In my words", line));
  }, function () {
    if (!goal.value.trim()) return "Write where it leads.";
    W.goal = goal.value.trim(); W.from = from.value.trim(); W.line = line.value.trim();
    W.steps = steps.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
  });
}

/* the "Why I do what I do" tab: point 1 is Why do I exist? (the ladder), then my own points — a question and its answer */
function todoWhyPointEdit(x) {
  var q, a;
  todoDialog("✏️ Edit point", function (body) {
    q = todoEl("input"); q.value = x.q;
    a = todoEl("textarea"); a.rows = 5; a.value = x.a; a.dataset.plain = "1";
    body.append(todoField("Question", q), todoField("Answer", a));
  }, function () {
    var v = q.value.trim(); if (!v) return "Write the question.";
    x.q = v; x.a = a.value.trim();
  });
}
function todoWhyPage() {
  var W = TODO.why, box = todoEl("div", "td-whypage");
  box.appendChild(todoEl("h2", "td-whypage-h", "🧭 Why I do what I do"));
  box.appendChild(todoWhyCard(false));
  W.points.forEach(function (x, i) {
    var c = todoEl("section", "td-why td-whypt");
    var hd = todoEl("div", "td-why-hd");
    hd.appendChild(todoEl("b", "", (i + 2) + " · " + x.q));
    var acts = todoEl("span", "td-whypt-acts");
    var ed = todoEl("button", "td-act", "✏️ Edit"); ed.onclick = function () { todoWhyPointEdit(x); };
    var rm = todoEl("button", "td-act danger", "Remove");
    rm.onclick = function () { if (!confirm("Remove “" + x.q + "”?")) return; W.points = W.points.filter(function (y) { return y !== x; }); todoSave(); };
    acts.append(ed, rm); hd.appendChild(acts);
    c.appendChild(hd);
    c.appendChild(todoEl("div", "td-whypt-a" + (x.a ? "" : " none"), x.a || "No answer yet — ✏️ Edit to write it."));
    box.appendChild(c);
  });
  // ＋ another point: a question, and the answer in my words
  var add = todoEl("section", "td-why-add");
  add.appendChild(todoEl("b", "", "＋ Add a point"));
  var q = todoEl("input", "td-why-q"); q.placeholder = "A question — e.g. Why did I start Dubuddy?";
  var a = todoEl("textarea", "td-why-a"); a.rows = 3; a.dataset.plain = "1"; a.placeholder = "Your answer…";
  var go = todoEl("button", "btn save", "Add point");
  go.onclick = function () {
    var v = q.value.trim(); if (!v) { toast("Write the question"); q.focus(); return; }
    W.points.push({ id: todoId(), q: v, a: a.value.trim() }); todoSave();
  };
  add.append(q, a, go);
  box.appendChild(add);
  return box;
}

/* ---------- tasks: own or linked to a board ---------- */
// everything a linked task needs, built once per draw
function todoSources() {
  var S = { asg: {}, reg: {} };
  try { todoAssigned().forEach(function (e) { S.asg[e.key] = e; }); } catch (_) { }
  try { allTasks().forEach(function (x) { if (x.tid) S.reg[x.tid] = x; }); } catch (_) { }
  S.me = todoMe();
  return S;
}
// a task linked from a board or roadmap that's now someone else's (or no longer assigned to me) stays off My plan —
// kept in the data, so it comes back if it's handed back
function todoGone(t, S) {
  var r = t.ref;
  if (t.parent) { var p = todoGroupTask(t.parent); if (p && p !== t && todoGone(p, S)) return true; }
  if (!r) return false;
  if (r.k === "asg") return !S.asg[r.key];
  if (r.k === "tid") {
    var rm = r.map && todoRoadmapItem(r.map, r.tid);
    if (rm) return todoOwnedByOther(S.me, rm.it.owner);
    var x = S.reg[r.tid];
    return !!(x && x.task) && todoOwnedByOther(S.me, x.task.owner);
  }
  return false;
}
// already on My plan, whichever way it was added
function todoOnPlan() {
  var on = {};
  TODO.planner.tasks.forEach(function (t) { var r = t.ref; if (!r) return; if (r.k === "asg") on[r.key] = 1; else if (r.k === "tid") { on["tid:" + r.tid] = 1; if (r.map) on["rmap:" + r.map + ":" + r.tid] = 1; } });
  return on;
}
function todoInfo(t, S) {
  var r = t.ref, i = { title: t.title || "(untitled)", done: !!t.done, src: "", open: null };
  if (r && r.k === "asg") {
    var e = S.asg[r.key];
    if (e) { i.title = e.title || i.title; i.src = e.icon + " " + (e.board || e.where); i.done = i.done || e.col === "done"; i.open = e.open; }
    else i.src = "📥 no longer assigned";
  } else if (r && r.k === "tid") {
    var x = S.reg[r.tid];
    if (x) { i.title = x.task.title || x.task.name || i.title; i.src = "🔗 " + x.path; try { i.done = i.done || effStatus(x.task) === "done"; } catch (_) { } }
    var rm = r.map && todoRoadmapItem(r.map, r.tid);
    if (rm) { i.src = "🗺 " + rm.where; i.open = rm.open; }
    else i.src = "🔗 not on its board any more";
  }
  return i;
}
function todoTasksIn(gid, S) {
  return TODO.planner.tasks.filter(function (t) { return t.group === gid && !(S && todoGone(t, S)); })
    .sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : 1; });
}
// a group's tasks in order, each followed by its subtasks: [{ t, depth, kids }]
function todoTree(list) {
  var ids = {}; list.forEach(function (t) { ids[t.id] = 1; });
  var out = [];
  list.filter(function (t) { return !t.parent || !ids[t.parent]; }).forEach(function (t) {
    var kids = list.filter(function (k) { return k.parent === t.id; });
    out.push({ t: t, depth: 0, kids: kids });
    if (!t.fold) kids.forEach(function (k) { out.push({ t: k, depth: 1, kids: [] }); });
  });
  return out;
}
function todoGroupTask(id) { return TODO.planner.tasks.find(function (x) { return x.id === id; }); }
function todoKids(t) { return TODO.planner.tasks.filter(function (k) { return k.parent === t.id; }); }
function todoKidsDone(t, S) { var ks = todoKids(t); return ks.length ? ks.filter(function (k) { return todoInfo(k, S).done; }).length + "/" + ks.length + " subtasks done" : ""; }
function todoNewSub(p, title) {
  var log = todoIsLog(p.group), st = log ? todoToday() : p.start;
  var k = todoNewTask(title, p.group, st, log ? st : (todoLevel === "week" || todoLevel === "day" ? st : p.end));
  k.parent = p.id; delete p.fold;
  return k;
}
function todoOpenSub(t) { todoSubAdd = t.id; delete t.fold; todoQuickFocus = { key: todoLevel + ":sub:" + t.id, until: Date.now() + 2000 }; renderAll(); }
// an add box that's only there once its ＋ is clicked: Esc, or leaving it empty, closes it
function todoClosable(inp, close) {
  var prev = inp.onkeydown;
  inp.onkeydown = function (ev) { if (ev.key === "Escape") { close(); renderAll(); return; } prev(ev); };
  inp.addEventListener("blur", function () { setTimeout(function () { if (inp.isConnected && !inp.value.trim() && document.activeElement !== inp) { close(); renderAll(); } }, 200); });
  return inp;
}
// the "＋ Add subtask…" box under a task
function todoSubInput(t) {
  return todoClosable(todoQuickInput("sub:" + t.id, function (v) { todoNewSub(t, v); }, "＋ Add subtask to “" + (t.title || "").slice(0, 40) + "”…"), function () { todoSubAdd = null; });
}
// ▾ / ▸ in front of a group's name: fold its tasks away (g.fold), the summary line stays
function todoGroupFold(g) {
  var b = todoEl("button", "td-fold td-gfold", g.fold ? "▸" : "▾"); b.title = g.fold ? "Show this group's tasks" : "Minimise this group";
  b.onclick = function (ev) { ev.stopPropagation(); if (g.fold) delete g.fold; else { g.fold = true; if (todoAddIn === g.id) todoAddIn = null; } todoSave(); };
  return b;
}
// the small ＋ in front of a group's name: opens its "＋ Add task…" box
function todoAddBtn(g) {
  var b = todoEl("button", "td-gadd", "＋"); b.title = g.kind === "log" ? "Jot something in “" + g.name + "”" : "Add a task to “" + g.name + "”";
  b.onclick = function (ev) { ev.stopPropagation(); todoAddIn = g.id; delete g.fold; todoQuickFocus = { key: todoLevel + ":" + g.id, until: Date.now() + 2000 }; renderAll(); };
  return b;
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
    { k: "group", label: "Group", type: "select", value: t.group, opts: TODO.planner.groups.map(function (g) { return [g.id, g.name]; }), show: function () { return !t.parent; } },
    { k: "start", label: "Starts", type: "date", value: t.start, half: true },
    { k: "end", label: todoIsLog(t.group) ? "Finished on" : "Done by", type: "date", value: t.end, half: true },
    { k: "type", label: "Type — what it needs from you", type: "select", value: t.type || "", opts: [["", "— no type —"]].concat(TODO_TYPES.map(function (y) { return [y.k, y.i + " " + y.l + " — " + y.need]; })) },
    { k: "done", label: "Status", type: "select", value: t.done ? "done" : "open", opts: [["open", "Not done yet"], ["done", "✓ Done"]] },
    { k: "note", label: "Note (optional)", type: "area", value: t.note || "" }
  );
  var extra = [];
  if (i.open) extra.push(["Open ↗", "Open it on its board", function () { i.open(); }]);
  if (!t.parent) extra.push(["＋ Subtask", "Add subtasks under it", function () { todoOpenSub(t); }]);
  extra.push(["Remove", t.ref ? "Take it off my plan (the card on its board stays)" : "Delete this task", function () {
    var nk = todoKids(t).length;
    if (!confirm((t.ref ? "Take “" + i.title + "” off your plan?" : "Delete “" + i.title + "”?") + (nk ? " Its " + nk + " subtask(s) go too." : ""))) return false;
    TODO.planner.tasks = TODO.planner.tasks.filter(function (x) { return x !== t && x.parent !== t.id; });
    todoSave();
  }, true]);
  rmlModal(t.ref ? i.title : "Edit task", fields, function (v) {
    if (!t.ref) { var nm = (v.title || "").trim(); if (!nm) { toast("Give it a name"); return false; } t.title = nm; }
    if (!v.start || !v.end) { toast("Pick both dates"); return false; }
    if (v.end < v.start) { toast("“Done by” is before the start"); return false; }
    var wasDone = !!t.done;
    if (!t.parent && v.group) { t.group = v.group; todoKids(t).forEach(function (k) { k.group = t.group; }); }
    t.start = v.start; t.end = v.end;
    if (v.type) t.type = v.type; else delete t.type;
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
function todoPickDialog(title, sub, rows, onAdd, searchable, words) {
  words = words || {};   // { btn, on, none } — the dialog's words when it isn't placing tasks
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
    if (!shown.length) list.appendChild(todoEl("div", "hint", rows.length ? "Nothing matches." : words.none || "Nothing to add — it's all on your plan already."));
    shown.forEach(function (r) {
      var row = todoEl("label", "td-pick-row" + (r.on ? " on" : ""));
      var cb = todoEl("input"); cb.type = "checkbox"; cb.checked = !!picked[r.id]; cb.disabled = !!r.on;
      cb.onchange = function () { if (cb.checked) picked[r.id] = r; else delete picked[r.id]; };
      var tx = todoEl("span", "td-pick-tx");
      tx.appendChild(todoEl("b", "", r.title));
      tx.appendChild(todoEl("small", "", r.sub + (r.on ? " · " + (r.onWhy || words.on || "already on your plan") : "")));
      row.append(cb, tx); list.appendChild(row);
    });
  };
  if (q) q.oninput = draw;
  draw();
  var close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
  var btns = todoEl("div", "btns"), cl = todoEl("button", "btn", "Cancel"), sv = todoEl("button", "btn save", words.btn || "Place on my plan");
  cl.onclick = close;
  sv.onclick = function () { var ps = Object.keys(picked).map(function (k) { return picked[k]; }); if (!ps.length) { toast("Tick what to add"); return; } close(); onAdd(ps); };
  btns.append(cl, sv); dg.appendChild(btns);
  document.body.appendChild(ov);
  if (q) setTimeout(function () { q.focus(); }, 30);
}
// new linked tasks start on the first day in view that isn't before today, and run to their due date (or a week)
function todoPlaceStart() { var t = todoToday(), w = todoWindow(); return w.from > t ? w.from : t; }
function todoPickAssigned() {
  var on = todoOnPlan();
  var rows = todoAssigned().filter(function (e) { return e.col !== "done"; }).map(function (e) {
    return { id: e.key, title: e.title || "(untitled)", sub: e.icon + " " + (e.board || e.where) + (e.status ? " · " + e.status : "") + (e.due ? " · due " + fmtD(e.due) : ""), on: !!on[e.key], e: e };
  });
  todoPickDialog("📥 Assigned to me", "Everything on the team's boards that's yours and not done. Tick and place them on your timeline.", rows, function (ps) {
    var st = todoPlaceStart();
    ps.forEach(function (p) {
      var a = p.e.start || st, en = p.e.due && p.e.due >= a ? p.e.due : todoAddDays(a, 6);   // a timeline row keeps its own dates
      todoNewTask(p.title, todoGroupFor(todoAsgSpace(p.e)), a, en, { k: "asg", key: p.id });   // in a group named after its space
    });
    todoSave(); toast(ps.length + " placed on your plan — drag them to the right days");
  });
}
// a task on a roadmap chart: where it sits (roadmap › phase) and how to open the chart
function todoRoadmapItem(mapId, tid) {
  var m = ((typeof RMAPS !== "undefined" && RMAPS.maps) || []).find(function (x) { return x.id === mapId; });
  var it = m && (m.items || []).find(function (x) { return x.tid === tid; });
  if (!it) return null;
  var ln = (m.lanes || []).find(function (l) { return l.id === it.lane; }) || (m.lanes || [])[0];
  var ph = ln ? (typeof rmwLanePath === "function" ? rmwLanePath(m, ln) : ln.name) : "";
  return { m: m, it: it, where: m.name + (ph ? " › " + ph : ""), open: function () { view = "rmap"; activeRmap = m.id; renderAll(); } };
}
function todoPickRoadmaps() {
  var on = todoOnPlan();
  var reg = {}; try { allTasks().forEach(function (x) { if (x.tid) reg[x.tid] = x; }); } catch (_) { }
  var me = todoMe(), rows = [];
  ((typeof RMAPS !== "undefined" && RMAPS.maps) || []).forEach(function (m) {
    (m.items || []).forEach(function (it) {
      var x = reg[it.tid]; if (!x) return;
      try { if (effStatus(x.task) === "done") return; } catch (_) { }
      if (!todoOwnerIsMe(me, it.owner)) return;   // only the tasks you're the Owner of
      var rm = todoRoadmapItem(m.id, it.tid);
      rows.push({ id: it.tid, title: x.task.title || x.task.name || "(untitled)",
        sub: rm.where + (it.start ? " · " + fmtD(it.start) + (it.end && it.end !== it.start ? " → " + fmtD(it.end) : "") : "") + " · 👤 " + it.owner,
        on: !!(on["tid:" + it.tid] || on["rmap:" + m.id + ":" + it.tid]), m: m, it: it });
    });
  });
  todoPickDialog("🗺 From roadmaps", "Tasks on the team's roadmap charts where you're the Owner. They keep the chart's dates; search by name or phase.", rows, function (ps) {
    var st = todoPlaceStart();
    ps.forEach(function (p) {
      var gid = todoGroupFor(p.m.name), a = p.it.start || st, b = p.it.end && p.it.end >= a ? p.it.end : a;
      todoNewTask(p.title, gid, a, b, { k: "tid", tid: p.id, map: p.m.id });
    });
    todoSave(); toast(ps.length + " placed on your plan with their roadmap dates");
  }, true);
}
function todoPickBoards() {
  var on = {}; TODO.planner.tasks.forEach(function (t) { if (t.ref && t.ref.k === "tid") on[t.ref.tid] = 1; });
  var reg = []; try { reg = allTasks(); } catch (_) { }
  var me = todoMe();
  var rows = reg.filter(function (x) { if (!x.tid || !(x.task.title || x.task.name)) return false; if (todoOwnedByOther(me, x.task.owner)) return false; try { return effStatus(x.task) !== "done"; } catch (_) { return true; } })
    .map(function (x) { return { id: x.tid, title: x.task.title || x.task.name, sub: x.path, on: !!on[x.tid] }; });
  todoPickDialog("＋ From boards", "Pick from any board, roadmap or space — yours or nobody's yet (tasks with someone else as Owner aren't listed). The card itself doesn't change.", rows, function (ps) {
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
    var inView = function (t, end) { return !(dayOf(end) < 0 || dayOf(t.start) > nD - 1); };
    var rows = todoTree(todoTasksIn(g.id, S)).map(function (n) { var I = todoInfo(n.t, S), end = todoEnd(n.t, I.done); return { t: n.t, I: I, end: end, depth: n.depth, kids: n.kids, show: inView(n.t, end) }; });
    // a task stays when any of its subtasks is in view
    rows.forEach(function (r) { if (!r.show && !r.depth) r.show = r.kids.some(function (k) { return inView(k, todoEnd(k, todoInfo(k, S).done)); }); });
    rows = rows.filter(function (r) { return r.show; });
    var items = rows.map(function (r) { return r.t; });
    var lab = todoEl("div", "rmg-phase"); lab.style.gridRow = String(rIdx); lab.dataset.lane = g.id;
    lab.appendChild(todoGroupFold(g));
    lab.appendChild(todoAddBtn(g));
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
    var subRow = function (p) {   // "＋ Add subtask…" under a task
      var a = todoEl("div", "rmg-task rmg-add"); a.style.gridRow = String(rIdx); a.dataset.lane = g.id; a.style.paddingLeft = "44px";
      a.appendChild(todoSubInput(p)); rmlTreeLines(a, 2, [rows.slice(rows.indexOf(rows.filter(function (r) { return r.t === p || r.t.parent === p.id; }).pop()) + 1).some(function (r) { return !r.depth; }) || todoAddIn === g.id], true, 6, 18);
      grid.appendChild(a); cellsRow(rIdx, g.id, "addrow"); rIdx++;
    };
    if (g.fold) return;   // minimised: just the header and its summary line
    rows.forEach(function (R, ri) {
      var t = R.t, I = R.I, tEnd = R.end, open = log && !I.done, dep = R.depth;
      var nm = todoEl("div", "rmg-task" + (I.done ? " done" : "") + (dep ? " td-sub" : "")); nm.style.gridRow = String(rIdx); nm.dataset.lane = g.id;
      var tt = todoEl("span", "rmg-tt");
      if (!dep && R.kids.length) {
        var fo = todoEl("button", "td-fold", t.fold ? "▸" : "▾"); fo.title = t.fold ? "Show its subtasks" : "Hide its subtasks";
        fo.onclick = function (ev) { ev.stopPropagation(); if (t.fold) delete t.fold; else t.fold = true; todoSave(); };
        tt.appendChild(fo);
      }
      var ty = todoType(t);
      tt.appendChild(document.createTextNode((I.done ? "✓ " : "") + (ty ? ty.i + " " : "") + I.title));
      nm.appendChild(tt);
      var kd = !dep ? todoKidsDone(t, S) : "";
      nm.appendChild(todoEl("span", "rmg-td", todoSpan(t, I.done) + (kd ? " · " + kd : "") + (I.src ? " · " + I.src : "")));
      nm.title = I.title + (I.src ? "\n" + I.src : "") + (t.note ? "\n" + t.note : "");
      nm.onclick = function () { todoEditTask(t, S); }; nm.style.cursor = "pointer";
      if (!dep) { var sb = todoEl("button", "td-gadd td-subbtn", "＋"); sb.title = "Add a subtask"; sb.onclick = function (ev) { ev.stopPropagation(); todoOpenSub(t); }; nm.appendChild(sb); }
      if (dep) nm.style.paddingLeft = "44px";
      var moreTop = rows.slice(ri + 1).some(function (r) { return !r.depth; }) || todoAddIn === g.id;
      var lastKid = dep && !(rows[ri + 1] && rows[ri + 1].depth) && todoSubAdd !== t.parent;
      rmlTreeLines(nm, dep + 1, dep ? [moreTop] : [], dep ? lastKid : !moreTop && !(R.kids.length && !t.fold) && todoSubAdd !== t.id, 6, 18);
      grid.appendChild(nm); cellsRow(rIdx, g.id, "");
      var s = Math.max(0, dayOf(t.start)), e = Math.min(nD - 1, Math.max(s, dayOf(tEnd)));
      var bar = todoEl("div", "rmg-blk rmg-line" + (I.done ? " done" : "") + (open ? " td-open" : "") + (!I.done && !log && t.end < today ? " td-late" : ""));
      bar.style.gridRow = String(rIdx); bar.style.gridColumn = (s + 2) + " / " + (e + 3);
      bar.style.background = todoGroupColor(g.id);
      bar.title = nm.title + "\n" + todoSpan(t, I.done) + (open ? "\nStill going — tick it done (Day view or click) to end the bar" : "\nDrag to move · drag the right end to stretch");
      if (!open) bar.appendChild(todoEl("i", "td-grip"));
      if (dep) bar.classList.add("td-subbar");
      todoBarDrag(bar, grid, t, function () { todoEditTask(t, S); });
      grid.appendChild(bar);
      rIdx++;
      // after a task's last subtask: its "＋ Add subtask…" box, if open
      var nx = rows[ri + 1], pid = dep ? t.parent : t.id;
      if (todoSubAdd === pid && !(nx && nx.depth && nx.t.parent === pid)) subRow(dep ? todoGroupTask(pid) : t);
    });
    if (todoAddIn !== g.id) return;
    var add = todoEl("div", "rmg-task rmg-add"); add.style.gridRow = String(rIdx); add.dataset.lane = g.id;
    add.appendChild(todoClosable(todoQuickInput(g.id, function (v) {
      if (log) { todoNewTask(v, g.id, todoToday(), todoToday()); return; }   // a log item starts today and grows
      var st = todoPlaceStart();
      todoNewTask(v, g.id, st, week ? st : todoAddDays(st, 6));
    }, log ? "＋ Jot something…" : null), function () { todoAddIn = null; }));
    rmlTreeLines(add, 1, [], true, 6, 18);
    grid.appendChild(add); cellsRow(rIdx, g.id, "addrow");
    rIdx++;
  });
  rIdx = todoAsgRows(grid, rIdx, dayOf, nD, cellsRow, S);   // 📥 mine on the boards, not on my plan yet
  rIdx = todoHeadRows(grid, rIdx, dayOf, nD, cellsRow);   // 👑 the spaces I head, read-only, below my own groups
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
        if (lane && lane !== t.group && !t.parent && TODO.planner.groups.some(function (g) { return g.id === lane; })) { t.group = lane; todoKids(t).forEach(function (k) { k.group = lane; }); }
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
function todoDayTasks(S, day) {
  var today = todoToday();
  return TODO.planner.tasks.filter(function (t) {
    if (todoGone(t, S)) return false;
    var dn = todoInfo(t, S).done;
    if (t.start <= day && todoEnd(t, dn) >= day) return true;
    if (todoIsLog(t.group) && !dn && t.start <= day) return true;
    if (todoSlot(t, day)) return true;
    return !todoIsLog(t.group) && day === today && t.end < today && !dn;
  });
}
function todoDayList(S) {
  var day = todoWindow().from, today = todoToday();
  var box = todoEl("div", "td-day");
  var nd = todoNeeds(todoDayTasks(S, day), S, day); if (nd) box.appendChild(nd);
  var total = 0;
  TODO.planner.groups.forEach(function (g) {
    var log = g.kind === "log";
    var onDay = function (t) {
      var dn = todoInfo(t, S).done;
      if (t.start <= day && todoEnd(t, dn) >= day) return true;
      if (log && !dn && t.start <= day) return true;   // an ongoing log carries on into the coming days
      return !log && day === today && t.end < today && !dn;   // past its end and not done: still on today
    };
    var tree = todoTree(todoTasksIn(g.id, S));
    var keep = {}; tree.forEach(function (n) { if (onDay(n.t)) { keep[n.t.id] = 1; if (n.t.parent) keep[n.t.parent] = 1; } });
    if (todoSubAdd) keep[todoSubAdd] = keep[todoSubAdd] || tree.some(function (n) { return n.t.id === todoSubAdd; }) ? 1 : 0;
    var nodes = tree.filter(function (n) { return keep[n.t.id]; });
    var items = nodes.map(function (n) { return n.t; });
    total += items.length;
    var sec = todoEl("div", "td-day-g");
    var hd = todoEl("div", "td-day-h");
    hd.appendChild(todoGroupFold(g));
    hd.appendChild(todoAddBtn(g));
    hd.appendChild(todoEl("b", "", g.name));
    if (log) hd.appendChild(todoEl("span", "td-logtag", "ongoing log"));
    hd.appendChild(todoEl("span", "rmg-pct", items.length ? String(items.length) : ""));
    sec.appendChild(hd);
    if (g.fold) { box.appendChild(sec); return; }   // minimised: just the header
    nodes.forEach(function (n, ni) {
      var t = n.t, dep = n.depth;
      var I = todoInfo(t, S), late = !log && !I.done && t.end < day;
      var row = todoEl("div", "td-day-row" + (I.done ? " done" : "") + (dep ? " sub" : ""));
      var cb = todoEl("input"); cb.type = "checkbox"; cb.checked = I.done; cb.title = I.done ? "Mark not done" : "Mark done";
      cb.onchange = function () { todoSetDone(t, cb.checked, day); todoSave(); };
      var tx = todoEl("div", "td-day-tx");
      var tl1 = todoEl("div", "td-day-tl");
      var nm = todoEl("span", "td-day-t", I.title); nm.onclick = function () { todoEditTask(t, S); };
      tl1.append(nm, todoTypeChip(t));
      tx.appendChild(tl1);
      var kd = !dep ? todoKidsDone(t, S) : "";
      tx.appendChild(todoEl("span", "td-day-m" + (late ? " late" : ""), (late ? "⚠ was due " + fmtD(t.end) : todoSpan(t, I.done)) + (kd ? " · " + kd : "") + (I.src ? " · " + I.src : "")));
      row.append(cb, tx);
      var sl = todoSlot(t, day);
      var tb = todoEl("button", "td-timechip" + (sl ? " on" : ""), sl ? "🕘 " + todoHM12(sl.at) : "🕘");
      tb.title = sl ? "On the timeline at " + todoHM12(sl.at) + " for " + todoMins(sl.dur) + " — change" : "Give it a time on the timeline (or drag it there)";
      tb.onclick = function () { todoSlotDialog(t, day); };
      row.appendChild(tb);
      row.draggable = true;
      row.addEventListener("dragstart", function (ev) { try { ev.dataTransfer.setData("text/plain", "todo-task:" + t.id); ev.dataTransfer.effectAllowed = "move"; } catch (_) { } row.classList.add("dragging"); });
      row.addEventListener("dragend", function () { row.classList.remove("dragging"); });
      if (!dep) { var sb = todoEl("button", "td-gadd td-subbtn", "＋"); sb.title = "Add a subtask"; sb.onclick = function () { todoOpenSub(t); }; row.appendChild(sb); }
      if (I.open) { var op = todoEl("button", "td-day-open", "Open ↗"); op.onclick = function () { I.open(); }; row.appendChild(op); }
      sec.appendChild(row);
      var nx = nodes[ni + 1], pid = dep ? t.parent : t.id;
      if (todoSubAdd === pid && !(nx && nx.depth && nx.t.parent === pid)) {
        var sr = todoEl("div", "td-day-row td-day-addrow sub");
        sr.appendChild(todoSubInput(dep ? todoGroupTask(pid) : t));
        sec.appendChild(sr);
      }
    });
    if (!nodes.length && todoAddIn !== g.id) {
      var em = todoEl("div", "td-day-row td-day-none", "Nothing here on this day — ＋ to add");
      em.onclick = function () { todoAddIn = g.id; todoQuickFocus = { key: todoLevel + ":" + g.id, until: Date.now() + 2000 }; renderAll(); };
      sec.appendChild(em);
    }
    if (todoAddIn === g.id) {
      var add = todoEl("div", "td-day-row td-day-addrow");
      add.appendChild(todoClosable(todoQuickInput(g.id, function (v) { todoNewTask(v, g.id, day, day); }, log ? "＋ Jot something — an article, a question, where you're stuck…" : "＋ Add task for this day…"), function () { todoAddIn = null; }));
      sec.appendChild(add);
    }
    box.appendChild(sec);
  });
  if (!total) box.insertBefore(todoEl("div", "td-day-empty", "Nothing planned for this day yet. Click ＋ next to a group to add something, or plan it on the Week / Month chart."), box.firstChild);
  return box;
}

/* ---------- task types: what a task needs from me ---------- */
var TODO_TYPES = [
  { k: "followup", i: "🔁", l: "Follow-up", need: "a quick nudge — a message or a call", m: 15, c: "#0E7490", bg: "#E0F2F7" },
  { k: "approval", i: "✅", l: "Approval", need: "a yes / no from you — read and sign off", m: 15, c: "#047857", bg: "#DCFCE7" },
  { k: "decision", i: "⚖️", l: "Decision", need: "quiet thinking time and the facts in front of you", m: 45, c: "#B45309", bg: "#FEF3C7" },
  { k: "research", i: "🔍", l: "Research", need: "a focused block — reading, digging, no interruptions", m: 90, c: "#6D28D9", bg: "#EDE9FE" },
  { k: "review", i: "👀", l: "Review", need: "a careful read and your feedback", m: 30, c: "#1D4ED8", bg: "#DBEAFE" },
  { k: "meeting", i: "👥", l: "Meeting", need: "a fixed time with people", m: 60, c: "#BE185D", bg: "#FCE7F3" },
  { k: "doing", i: "🛠", l: "Do it", need: "a work block where you make it yourself", m: 60, c: "#374151", bg: "#F3F4F6" },
  { k: "learning", i: "📚", l: "Learn", need: "time to read, watch or practise", m: 45, c: "#9A3412", bg: "#FFEDD5" },
];
function todoType(t) { return t && TODO_TYPES.find(function (y) { return y.k === t.type; }) || null; }
// the small tag on a task; click to pick a type
function todoTypeChip(t) {
  var y = todoType(t), b = todoEl("button", "td-type" + (y ? "" : " none"), y ? y.i + " " + y.l : "＋ type");
  if (y) { b.style.color = y.c; b.style.background = y.bg; b.title = y.l + " — needs " + y.need + " (click to change)"; }
  else b.title = "What kind of task is it? Follow-up, approval, decision, research…";
  b.onclick = function (ev) {
    ev.stopPropagation();
    openChoice("What does “" + (t.title || "this task").slice(0, 50) + "” need?", TODO_TYPES.map(function (x) { return { label: x.i + " " + x.l + " — " + x.need, value: x.k }; }).concat([{ label: "No type", value: "" }]),
      function (k) { if (k) t.type = k; else delete t.type; todoSave(); });
  };
  return b;
}
// what the day needs, added up by type
function todoNeeds(tasks, S, day) {
  var open = tasks.filter(function (t) { return !todoInfo(t, S).done; });
  var bar = todoEl("div", "td-needs");
  bar.appendChild(todoEl("b", "", "This day needs"));
  var any = false;
  TODO_TYPES.forEach(function (y) {
    var ts = open.filter(function (t) { return t.type === y.k; }); if (!ts.length) return;
    any = true;
    var mins = ts.reduce(function (m, t) { var sl = todoSlot(t, day); return m + (sl ? sl.dur : y.m); }, 0);
    var c = todoEl("span", "td-need", y.i + " " + ts.length + " " + y.l.toLowerCase() + (ts.length > 1 && y.k !== "research" && y.k !== "learning" ? "s" : "") + " · ~" + todoMins(mins));
    c.style.color = y.c; c.style.background = y.bg; c.title = y.l + ": " + y.need + "\n" + ts.map(function (t) { return "• " + (t.title || ""); }).join("\n");
    bar.appendChild(c);
  });
  var un = open.filter(function (t) { return !todoType(t); }).length;
  if (un) bar.appendChild(todoEl("span", "td-need none", un + " without a type"));
  if (!any && !un) return null;
  return bar;
}

/* ---------- the day's timeline (hours) ---------- */
var TODO_PXM = 1;   // pixels per minute: one hour = 60px
function todoSlot(t, day) { var x = t.slots && t.slots[day]; return x && /^\d{2}:\d{2}$/.test(x.at || "") ? { at: x.at, dur: Math.max(15, Number(x.dur) || 60) } : null; }
function todoSetSlot(t, day, at, dur) {
  if (!at) { if (t.slots) { delete t.slots[day]; if (!Object.keys(t.slots).length) delete t.slots; } return; }
  t.slots = t.slots || {}; t.slots[day] = { at: at, dur: Math.max(15, Math.round(dur || 60)) };
}
function todoM2HM(m) { m = Math.max(0, Math.min(24 * 60 - 15, Math.round(m))); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
var TODO_DURS = [[15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "1 hour"], [90, "1.5 hours"], [120, "2 hours"], [180, "3 hours"], [240, "4 hours"]];
function todoSlotDialog(t, day, at) {
  var sl = todoSlot(t, day), cur = sl ? sl.dur : (todoType(t) ? todoType(t).m : 60);
  var opts = TODO_DURS.slice(); if (!opts.some(function (o) { return o[0] === cur; })) opts.push([cur, todoMins(cur)]);
  rmlModal("🕘 When on " + (day === todoToday() ? "today" : fmtD(day)) + "?", [
    { k: "at", label: "Starts at", type: "time", value: at || (sl ? sl.at : todoM2HM(Math.ceil((todoHMm(todoNowHM()) + 1) / 15) * 15)), half: true },
    { k: "dur", label: "For", type: "select", value: String(cur), opts: opts.map(function (o) { return [String(o[0]), o[1]]; }), half: true },
  ], function (v) {
    if (!/^\d{2}:\d{2}$/.test(v.at || "")) { toast("Pick a time"); return false; }
    todoSetSlot(t, day, v.at, Number(v.dur)); todoSave();
  }, { sub: t.title, extra: sl ? [["Take off the timeline", "Keep it on the day without a time", function () { todoSetSlot(t, day, ""); todoSave(); }, true]] : [] });
}
// click an empty time: write a new task there
function todoSlotNew(day, at) {
  var gs = TODO.planner.groups;
  rmlModal("New task at " + todoHM12(at), [
    { k: "title", label: "Task", type: "text", value: "" },
    { k: "group", label: "Group", type: "select", value: gs[0].id, opts: gs.map(function (g) { return [g.id, g.name]; }) },
    { k: "type", label: "Type", type: "select", value: "", opts: [["", "— no type —"]].concat(TODO_TYPES.map(function (y) { return [y.k, y.i + " " + y.l]; })), half: true },
    { k: "dur", label: "For", type: "select", value: "60", opts: TODO_DURS.map(function (o) { return [String(o[0]), o[1]]; }), half: true },
  ], function (v) {
    var nm = (v.title || "").trim(); if (!nm) { toast("Give it a name"); return false; }
    var t = todoNewTask(nm, v.group, day, day); if (v.type) t.type = v.type; todoSetSlot(t, day, at, Number(v.dur)); todoSave();
  }, { sub: day === todoToday() ? "Today" : fmtD(day) });
}
function todoTimeline(S, day, tasks) {
  var today = todoToday();
  var timed = tasks.map(function (t) { var sl = todoSlot(t, day); return sl ? { t: t, at: todoHMm(sl.at), dur: sl.dur, I: todoInfo(t, S) } : null; }).filter(Boolean)
    .sort(function (a, b) { return a.at - b.at || b.dur - a.dur; });
  var from = Math.floor(Math.min(todoHMm(TODO.clock.wake), timed.length ? timed[0].at : 24 * 60) / 60) * 60;
  var to = Math.ceil(Math.max(todoBedM(TODO.clock.sleep), timed.reduce(function (m, x) { return Math.max(m, x.at + x.dur); }, 0)) / 60) * 60;
  if (to <= from) to = from + 60;
  to = Math.min(to, 24 * 60 + 5 * 60);
  var wrap = todoEl("div", "td-tl");
  var hd = todoEl("div", "td-tl-h");
  hd.appendChild(todoEl("b", "", "🕘 Timeline"));
  hd.appendChild(todoEl("span", "", timed.length ? timed.length + " on the clock · click a free time to add · drag to move" : "Drag a task here, use its 🕘, or click a time"));
  wrap.appendChild(hd);
  var body = todoEl("div", "td-tl-b"); body.style.height = ((to - from) * TODO_PXM) + "px";
  for (var m = from; m <= to; m += 60) {
    var ln = todoEl("div", "td-tl-hr"); ln.style.top = ((m - from) * TODO_PXM) + "px";
    var hh = m % (24 * 60), h12 = (Math.floor(hh / 60) % 12 || 12) + (hh < 12 * 60 ? " AM" : " PM");
    ln.appendChild(todoEl("span", "", h12)); body.appendChild(ln);
    if (m + 30 < to) { var hf = todoEl("div", "td-tl-half"); hf.style.top = ((m + 30 - from) * TODO_PXM) + "px"; body.appendChild(hf); }
  }
  // the wake-up and bedtime targets
  [["wake", "⏰ wake up", todoHMm(TODO.clock.wake)], ["sleep", "🌙 bed", todoBedM(TODO.clock.sleep)]].forEach(function (x) {
    if (x[2] < from || x[2] > to) return;
    var mk = todoEl("div", "td-tl-mark " + x[0]); mk.style.top = ((x[2] - from) * TODO_PXM) + "px"; mk.appendChild(todoEl("span", "", x[1])); body.appendChild(mk);
  });
  if (day === today) {
    var nowM = todoHMm(todoNowHM()); if (nowM < 5 * 60 && from > 5 * 60) nowM += 24 * 60;
    if (nowM >= from && nowM <= to) { var nl = todoEl("div", "td-tl-now"); nl.style.top = ((nowM - from) * TODO_PXM) + "px"; body.appendChild(nl); }
  }
  // overlapping blocks share the width
  var cols = [];
  timed.forEach(function (x) { var c = 0; while (cols[c] && cols[c] > x.at) c++; cols[c] = x.at + x.dur; x.col = c; });
  timed.forEach(function (x) { x.n = 1 + Math.max.apply(null, timed.filter(function (y) { return y.at < x.at + x.dur && x.at < y.at + y.dur; }).map(function (y) { return y.col; })); });
  timed.forEach(function (x) {
    var t = x.t, blk = todoEl("div", "td-tl-blk" + (x.I.done ? " done" : "") + (x.dur <= 30 ? " short" : "")), ty = todoType(t);
    blk.style.top = ((x.at - from) * TODO_PXM) + "px"; blk.style.height = Math.max(18, x.dur * TODO_PXM - 2) + "px";
    blk.style.left = "calc(64px + (100% - 72px) * " + (x.col / x.n) + ")"; blk.style.width = "calc((100% - 72px) / " + x.n + " - 3px)";
    blk.style.background = todoGroupColor(t.group);
    blk.appendChild(todoEl("b", "", (x.I.done ? "✓ " : "") + (ty ? ty.i + " " : "") + x.I.title));
    blk.appendChild(todoEl("small", "", todoHM12(todoM2HM(x.at % (24 * 60))) + " – " + todoHM12(todoM2HM((x.at + x.dur) % (24 * 60))) + " · " + todoMins(x.dur)));
    blk.title = x.I.title + "\nDrag to move · drag the bottom edge to change how long · click to change the time";
    blk.appendChild(todoEl("i", "td-tl-grip"));
    todoTlDrag(blk, t, day, x.at, x.dur);
    body.appendChild(blk);
  });
  var yToM = function (ev) { var r = body.getBoundingClientRect(); return from + Math.round((ev.clientY - r.top) / TODO_PXM / 15) * 15; };
  body.addEventListener("click", function (ev) { if (ev.target !== body && !ev.target.classList.contains("td-tl-hr") && !ev.target.classList.contains("td-tl-half")) return; todoSlotNew(day, todoM2HM(yToM(ev) % (24 * 60))); });
  body.addEventListener("dragover", function (ev) { ev.preventDefault(); body.classList.add("over"); });
  body.addEventListener("dragleave", function () { body.classList.remove("over"); });
  body.addEventListener("drop", function (ev) {
    ev.preventDefault(); body.classList.remove("over");
    var k = ""; try { k = ev.dataTransfer.getData("text/plain"); } catch (_) { }
    if (k.indexOf("todo-task:") !== 0) return;
    var t = TODO.planner.tasks.find(function (x) { return x.id === k.slice(10); }); if (!t) return;
    var sl = todoSlot(t, day);
    todoSetSlot(t, day, todoM2HM(yToM(ev) % (24 * 60)), sl ? sl.dur : (todoType(t) ? todoType(t).m : 60)); todoSave();
  });
  wrap.appendChild(body);
  return wrap;
}
// drag a block up / down (15-minute steps), its bottom edge to change how long it takes
function todoTlDrag(blk, t, day, at0, dur0) {
  blk.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var r = blk.getBoundingClientRect(), resize = e.clientY > r.bottom - 8, sy = e.clientY, moved = false, dm = 0;
    blk.setPointerCapture(e.pointerId);
    var mv = function (ev) {
      var dy = ev.clientY - sy; if (!moved && Math.abs(dy) < 4) return;
      moved = true; blk.classList.add("drag");
      dm = Math.round(dy / TODO_PXM / 15) * 15;
      if (resize) blk.style.height = Math.max(13, (dur0 + dm) * TODO_PXM - 2) + "px";
      else blk.style.transform = "translateY(" + (dm * TODO_PXM) + "px)";
    };
    var up = function () {
      blk.removeEventListener("pointermove", mv); blk.removeEventListener("pointerup", up); blk.classList.remove("drag");
      if (!moved) { todoSlotDialog(t, day); return; }
      if (!dm) { renderAll(); return; }
      if (resize) todoSetSlot(t, day, todoM2HM(at0 % (24 * 60)), Math.max(15, dur0 + dm));
      else todoSetSlot(t, day, todoM2HM((at0 + dm) % (24 * 60)), dur0);
      todoSave();
    };
    blk.addEventListener("pointermove", mv); blk.addEventListener("pointerup", up);
  });
}

/* ---------- ⏰ wake up · 🌙 go to bed: the two clocks on the Day view ---------- */
function todoHMm(v) { var p = String(v || "").split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); }
function todoHM12(v) { var m = todoHMm(v), h = Math.floor(m / 60), x = m % 60; return (h % 12 || 12) + ":" + String(x).padStart(2, "0") + (h < 12 ? " AM" : " PM"); }
function todoMins(m) { m = Math.max(0, Math.round(m)); var h = Math.floor(m / 60), x = m % 60; return (h ? h + "h " : "") + (x || !h ? x + "m" : "").trim(); }
function todoNowHM() { var d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
// bedtime minutes on a scale where 1 AM is 25:00, so late nights compare right
function todoBedM(v) { var m = todoHMm(v); return m < 5 * 60 ? m + 24 * 60 : m; }
function todoVs(actual, target, bed) {
  var d = bed ? todoBedM(actual) - todoBedM(target) : todoHMm(actual) - todoHMm(target);
  return Math.abs(d) <= 10 ? { t: "on time ✓", c: "ok" } : d > 0 ? { t: todoMins(d) + " late", c: "late" } : { t: todoMins(-d) + " early", c: "ok" };
}
function todoSlept(day) {   // last night: bedtime logged on the day before → wake-up on this day
  var w = (TODO.sleepLog[day] || {}).wake, b = (TODO.sleepLog[todoAddDays(day, -1)] || {}).sleep;
  if (!w || !b) return "";
  return todoMins(todoHMm(w) + 24 * 60 - todoBedM(b));
}
function todoClockFace(v) {
  var m = todoHMm(v), h = (m / 60) % 12, a1 = h * 30, a2 = (m % 60) * 6;
  var hand = function (a, len, w) { var r = a * Math.PI / 180; return '<line x1="18" y1="18" x2="' + (18 + len * Math.sin(r)).toFixed(1) + '" y2="' + (18 - len * Math.cos(r)).toFixed(1) + '" stroke-width="' + w + '" stroke-linecap="round"/>'; };
  var ticks = ""; for (var i = 0; i < 12; i++) { var r = i * 30 * Math.PI / 180; ticks += '<line x1="' + (18 + 13.5 * Math.sin(r)).toFixed(1) + '" y1="' + (18 - 13.5 * Math.cos(r)).toFixed(1) + '" x2="' + (18 + 15.5 * Math.sin(r)).toFixed(1) + '" y2="' + (18 - 15.5 * Math.cos(r)).toFixed(1) + '" stroke-width="' + (i % 3 ? 0.8 : 1.6) + '"/>'; }
  return '<svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true"><circle cx="18" cy="18" r="17" class="td-clk-dial"/><g class="td-clk-hands">' + ticks + hand(a1, 8, 2.4) + hand(a2, 12, 1.6) + '</g><circle cx="18" cy="18" r="1.6" class="td-clk-pin"/></svg>';
}
// the live line: awake for … / … till bed (kept fresh by a timer while the page is open)
function todoClockLive(el) {
  var now = todoNowHM(), k = el.dataset.k, at = el.dataset.at, m;
  if (k === "awake") { m = todoHMm(now) - todoHMm(at); el.textContent = m >= 0 ? "awake for " + todoMins(m) : ""; return; }
  m = todoBedM(at) - todoBedM(now);
  el.textContent = m >= 0 ? todoMins(m) + " till bed" : "bedtime was " + todoMins(-m) + " ago";
  el.className = "td-clk-live " + (m < 0 ? "late" : m <= 30 ? "soon" : "");
}
setInterval(function () { document.querySelectorAll(".td-clk-live").forEach(todoClockLive); }, 30000);
function todoClock(kind, day) {
  var wake = kind === "wake", today = todoToday(), target = TODO.clock[kind];
  var logDay = day, logged = (TODO.sleepLog[day] || {})[kind];
  var box = todoEl("div", "td-clk " + kind + (logged ? " done" : ""));
  var face = todoEl("div", "td-clk-face"); face.innerHTML = todoClockFace(logged || (day === today && !wake ? todoNowHM() : target));
  box.appendChild(face);
  var mid = todoEl("div", "td-clk-mid");
  var top = todoEl("div", "td-clk-top");
  top.appendChild(todoEl("b", "", wake ? "⏰ Wake up" : "🌙 Go to bed"));
  var tg = todoEl("label", "td-clk-tgt"); tg.appendChild(todoEl("span", "", "target"));
  var ti = todoEl("input"); ti.type = "time"; ti.value = target; ti.title = "Change the target";
  ti.onchange = function () { if (/^\d{2}:\d{2}$/.test(ti.value)) { TODO.clock[kind] = ti.value; todoSave(); } };
  tg.appendChild(ti); top.appendChild(tg);
  mid.appendChild(top);
  var st = todoEl("div", "td-clk-st");
  if (logged) {
    var vs = todoVs(logged, target, !wake);
    st.appendChild(todoEl("span", "", (wake ? "Woke up " : "Went to bed ") + todoHM12(logged)));
    st.appendChild(todoEl("span", "td-clk-vs " + vs.c, vs.t));
    if (wake && todoSlept(day)) st.appendChild(todoEl("span", "", "slept " + todoSlept(day)));
    if (wake && day === today && !(TODO.sleepLog[day] || {}).sleep) { var lv = todoEl("span", "td-clk-live"); lv.dataset.k = "awake"; lv.dataset.at = logged; todoClockLive(lv); st.appendChild(lv); }
  } else if (day === today) {
    if (wake) st.appendChild(todoEl("span", "td-clk-muted", "When did you get up? Log it now or type the time."));
    else { var lb = todoEl("span", "td-clk-live"); lb.dataset.k = "bed"; lb.dataset.at = target; todoClockLive(lb); st.appendChild(lb); }
  } else st.appendChild(todoEl("span", "td-clk-muted", day < today ? "Not logged" : "—"));
  mid.appendChild(st);
  box.appendChild(mid);
  var acts = todoEl("div", "td-clk-acts");
  var put = function (v) {
    var d = logDay;
    if (!wake && v && todoHMm(v) < 5 * 60 && d === today && todoHMm(todoNowHM()) < 5 * 60) d = todoAddDays(d, -1);   // after midnight: last night's bedtime
    var L = TODO.sleepLog[d] = TODO.sleepLog[d] || {};
    if (v) L[kind] = v; else delete L[kind];
    if (!Object.keys(L).length) delete TODO.sleepLog[d];
    todoSave();
  };
  if (!logged && day === today) {
    var now = todoEl("button", "btn save td-clk-now", wake ? "✓ I'm up" : "✓ Going to bed");
    now.onclick = function () { put(todoNowHM()); };
    acts.appendChild(now);
  }
  if (day <= today) {
    var ed = todoEl("button", "td-act", logged ? "✎" : "✎ Time…"); ed.title = logged ? "Change or clear the time" : "Type the time";
    ed.onclick = function () {
      rmlModal(wake ? "⏰ When did you wake up?" : "🌙 When did you go to bed?", [{ k: "t", label: "Time", type: "time", value: logged || todoNowHM() }], function (v) {
        if (!/^\d{2}:\d{2}$/.test(v.t || "")) { toast("Pick a time"); return false; }
        put(v.t);
      }, { sub: day === today ? "Today" : fmtD(day), extra: logged ? [["Clear", "Remove this time", function () { put(""); }, true]] : [] });
    };
    acts.appendChild(ed);
  }
  box.appendChild(acts);
  return box;
}

/* ---------- 💭 thoughts warehouse ---------- */
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
// where the ideas I'm looking at live: my private list (saved with my plan) or Our To-do's shared one
function todoIdeaStore() {
  if (todoIdeaScope === "shared" && OUR.circle) return {
    shared: true, list: OUR.ideas,
    add: todoSharedIdeaAdd, put: todoSharedIdeaPut, del: todoSharedIdeaDel,
    canDel: function (x) { var me = (currentUser() || {}).id; return x.author === me || OUR.circle.owner_id === me; },
  };
  return {
    shared: false, list: TODO.ideas,
    add: function (x) { TODO.ideas.unshift(x); todoSave(); },
    put: function () { todoSave(); },
    del: function (x) { TODO.ideas = TODO.ideas.filter(function (y) { return y !== x; }); todoSave(); },
    canDel: function () { return true; },
  };
}
function todoIdeaItem(x) {
  var K = todoIdeaKindOf(x.kind), ST = todoIdeaStore();
  var row = todoEl("div", "td-idea" + (x.pin ? " pin" : "") + (x.solved ? " solved" : ""));
  row.appendChild(todoEl("span", "td-idea-k", K[1])).title = K[2];
  var body = todoEl("div", "td-idea-b");
  if (todoIdeaEdit === x.id) {
    var ta = todoEl("textarea", "td-idea-in"); ta.dataset.plain = "1"; ta.value = x.text; ta.rows = Math.min(8, x.text.split("\n").length + 1);
    var done = function () { var v = ta.value.trim(); if (v) x.text = v; todoIdeaEdit = null; ST.put(x); };
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
  if (ST.shared) meta.appendChild(todoEl("span", "td-idea-by", "✍ " + todoUserName(x.author)));
  if (x.task && TODO.planner.tasks.some(function (t) { return t.id === x.task; })) meta.appendChild(todoEl("span", "td-idea-on", "🗓 on My plan"));
  var nAgain = (x.again || []).length;
  if (nAgain) meta.appendChild(todoEl("span", "td-idea-again", "🔁 came up " + (nAgain + 1) + " times · last " + fmtD(todoLocalDay(x.again[x.again.length - 1]))));
  if (x.solved) meta.appendChild(todoEl("span", "td-idea-on", "✔ Solved " + fmtD(todoLocalDay(x.solved))));
  body.appendChild(meta);
  var acts = todoEl("div", "td-idea-acts");
  var mk = function (txt, tip, fn, cls) { var b = todoEl("button", "td-act" + (cls ? " " + cls : ""), txt); b.title = tip; b.onclick = function (ev) { ev.stopPropagation(); fn(); }; acts.appendChild(b); };
  mk(x.pin ? "📌 Unpin" : "📌 Pin", x.pin ? "Take it off the top" : "Keep it at the top", function () { if (x.pin) delete x.pin; else x.pin = true; ST.put(x); });
  mk("✎ Edit", "Change the words", function () { todoIdeaEdit = x.id; renderAll(); });
  if (x.kind === "recurring" && !x.solved) mk("🔁 Again", "It came up once more — log today", function () { x.again = (x.again || []).concat(new Date().toISOString()); ST.put(x); toast("Logged — it's come up " + (x.again.length + 1) + " times"); });
  if (TODO_IDEA_SOLVABLE.indexOf(x.kind) >= 0) mk(x.solved ? "↺ Reopen" : "✔ Solved", x.solved ? "It's back — not solved after all" : "It's settled now", function () { if (x.solved) { delete x.solved; if (x.kind === "recurring") x.again = (x.again || []).concat(new Date().toISOString()); } else x.solved = new Date().toISOString(); ST.put(x); });
  mk("Kind…", "Idea, imagination, question, note, contention or recurring issue", function () {
    openChoice("What kind is it?", TODO_IDEA_KINDS.map(function (k) { return { label: k[1] + " " + k[2], value: k[0] }; }), function (k) { x.kind = k; ST.put(x); });
  });
  if (!(x.task && TODO.planner.tasks.some(function (t) { return t.id === x.task; }))) mk("→ Plan it", "Put it on My plan as a task", function () { todoIdeaPlan(x); });
  if (ST.canDel(x)) mk("Delete", "Delete it for good" + (ST.shared ? " — for everyone in Our To-do" : ""), function () { if (!confirm("Delete this " + K[2].toLowerCase() + "?")) return; ST.del(x); }, "danger");
  meta.appendChild(acts);   // the buttons sit on the time line, shown on hover
  row.appendChild(body);
  return row;
}
function todoIdeas() {
  var box = todoEl("div", "td-ideas"), ST = todoIdeaStore();
  // 🔒 only me · 👥 shared with the people in Our To-do
  if (OUR.circle) {
    var sc = todoEl("div", "td-idea-scope"), seg0 = todoEl("span", "rmg-seg");
    [["shared", "👥 Shared — " + todoFirstName((currentUser() || {}).id) + " & " + todoCircleNames()], ["mine", "🔒 Only " + todoFirstName(todoOwnerId())]].forEach(function (k) {
      var b = todoEl("button", todoIdeaScope === k[0] ? "on" : "", k[1]);
      b.onclick = function () { if (todoIdeaScope === k[0]) return; todoIdeaScope = k[0]; todoIdeaFilter = ""; if (k[0] === "shared") todoSharedIdeasLoad(); renderAll(); };
      seg0.appendChild(b);
    });
    sc.appendChild(seg0);
    if (ST.shared) sc.appendChild(todoEl("span", "hint", "The same list in both your Thoughts warehouses — you both see and add to it."));
    box.appendChild(sc);
  }
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
    todoQuickFocus = { key: "ideas", until: Date.now() + 2000 };
    ST.add({ id: todoId(), text: v, kind: todoIdeaKind, at: new Date().toISOString() });
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
    var n = ST.list.filter(function (x) { return !k[0] || (x.kind || "idea") === k[0]; }).length;
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
  var list = ST.list.filter(function (x) { return (!todoIdeaFilter || (x.kind || "idea") === todoIdeaFilter) && (!s || x.text.toLowerCase().indexOf(s) >= 0); })
    .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
  if (!list.length) { box.appendChild(todoEl("div", "td-idea-empty", ST.list.length ? "Nothing matches." : ST.shared ? "Nothing shared yet. Write an idea here and everyone in Our To-do sees it." : "Nothing here yet. Everything you'd post in the WhatsApp group — write it here instead. Only you see it.")); return box; }
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

/* ---------- 🛕 Temple: the gods I pray to, and why — small circles on the plan, each person their own ----------
   Empty until set up ("＋ Set up your temple": the four below, or empty to add your own). Each:
   { id, name, why, photo } in TODO.temple. Hover a circle to read why; click it to change the name, the
   words, upload a photo (kept small, as a data URL, in the row) or remove it; ＋ adds another. */
var TODO_TEMPLE = [
  { id: "krishna", name: "Krishna Ji", sym: "🪈", bg: "linear-gradient(135deg,#1E3A8A,#2563EB)",
    why: "For the wisdom of the Gita — do my work fully and let go of the result." },
  { id: "laxmi", name: "Laxmi Ji", sym: "🪷", bg: "linear-gradient(135deg,#BE123C,#F59E0B)",
    why: "For prosperity earned honestly, and the sense to use it well for my family, team and country." },
  { id: "bajrang", name: "Bajrang Bali", sym: "🚩", bg: "linear-gradient(135deg,#C2410C,#F97316)",
    why: "For strength, courage and selfless service — to stay fearless when things get hard." },
  { id: "saraswati", name: "Saraswati Mata", sym: "🦢", bg: "linear-gradient(135deg,#CA8A04,#FDE68A)",
    why: "For knowledge, clear thinking and the right words — to keep learning every day." },
];
// each person sets up their own temple (empty until they do): any gods, in their own words
function todoTempleNorm(v) {
  return (Array.isArray(v) ? v : []).filter(function (x) { return x && x.id && x.name; }).map(function (x) {
    return { id: String(x.id), name: String(x.name), why: String(x.why || ""), photo: typeof x.photo === "string" && x.photo.indexOf("data:image/") === 0 ? x.photo : "" };
  });
}
function todoTempleDef(id) { return TODO_TEMPLE.find(function (g) { return g.id === id; }) || { sym: "🙏", bg: "linear-gradient(135deg,#B45309,#F59E0B)", name: "" }; }
// a picked photo → a small square JPEG (centre crop), so the row stays light
function todoPhotoSquare(file, size, done) {
  var rd = new FileReader();
  rd.onload = function () {
    var im = new Image();
    im.onload = function () {
      var s = Math.min(im.width, im.height), c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d").drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);
      done(c.toDataURL("image/jpeg", 0.85));
    };
    im.onerror = function () { toast("Couldn't read that image"); };
    im.src = rd.result;
  };
  rd.readAsDataURL(file);
}
function todoTempleFace(x, el) {
  var g = todoTempleDef(x.id);
  el.innerHTML = "";
  if (x.photo) { var im = todoEl("img"); im.src = x.photo; im.alt = x.name; el.appendChild(im); el.style.background = ""; }
  else { el.textContent = g.sym; el.style.background = g.bg; }
}
function todoTempleEdit(x, isNew) {
  var name, why, photo = x.photo, face;
  todoDialog(isNew ? "🛕 Add to my temple" : "🛕 " + x.name, function (body) {
    var pr = todoEl("div", "td-temple-ed");
    face = todoEl("div", "td-temple-c big"); todoTempleFace(x, face); pr.appendChild(face);
    var acts = todoEl("div", "td-temple-edacts");
    var file = todoEl("input"); file.type = "file"; file.accept = "image/*"; file.style.display = "none";
    var up = todoEl("button", "btn", x.photo ? "Change photo" : "Upload photo"); up.type = "button"; up.onclick = function () { file.click(); };
    var rm = todoEl("button", "btn", "Remove photo"); rm.type = "button"; rm.style.display = x.photo ? "" : "none";
    file.onchange = function () { var f = file.files && file.files[0]; if (!f) return; todoPhotoSquare(f, 240, function (url) { photo = url; todoTempleFace({ id: x.id, name: x.name, photo: url }, face); rm.style.display = ""; up.textContent = "Change photo"; }); };
    rm.onclick = function () { photo = ""; todoTempleFace({ id: x.id, name: x.name, photo: "" }, face); rm.style.display = "none"; up.textContent = "Upload photo"; };
    acts.append(up, rm, file); pr.appendChild(acts);
    body.appendChild(pr);
    name = todoEl("input"); name.value = x.name;
    why = todoEl("textarea"); why.rows = 3; why.value = x.why; why.dataset.plain = "1";
    name.placeholder = "e.g. Shiv Ji, Durga Maa, Guru Nanak Dev Ji";
    body.append(todoField("Name", name), todoField("Why I pray to them", why));
    if (!isNew) {
      var del = todoEl("button", "td-act danger", "Remove from my temple"); del.type = "button";
      del.onclick = function () {
        if (!confirm("Remove " + x.name + " from your temple?")) return;
        TODO.temple = TODO.temple.filter(function (y) { return y !== x; });
        var ov = del.closest(".overlay"); if (ov) ov.remove();
        todoSave();
      };
      body.appendChild(del);
    }
  }, function () {
    var nm = name.value.trim(); if (!nm) return "Write a name.";
    x.name = nm; x.why = why.value.trim(); x.photo = photo || "";
    if (isNew) TODO.temple.push(x);
  });
}
// not set up yet: one line to start it — with the four I'd suggest, or empty to add my own
function todoTempleSetup() {
  var a = todoEl("button", "td-phase-add td-temple-add", "🛕 ＋ Set up your temple — the gods you pray to, and why");
  a.onclick = function () {
    openChoice("Set up your temple", [
      { label: "🪈🪷🚩🦢 Start with Krishna Ji, Laxmi Ji, Bajrang Bali and Saraswati Mata", value: "four" },
      { label: "🙏 Start empty — I'll add my own", value: "own" },
    ], function (k) {
      if (k === "four") { TODO.temple = TODO_TEMPLE.map(function (g) { return { id: g.id, name: g.name, why: g.why, photo: "" }; }); todoSave(); }
      else todoTempleEdit({ id: todoId(), name: "", why: "", photo: "" }, true);
    });
  };
  return a;
}
function todoTemple() {
  if (!TODO.temple.length) return todoTempleSetup();
  var box = todoEl("section", "td-temple");
  box.appendChild(todoEl("span", "td-temple-l", "🛕 Temple"));
  TODO.temple.forEach(function (x) {
    var it = todoEl("button", "td-temple-i"); it.type = "button";
    var c = todoEl("span", "td-temple-c"); todoTempleFace(x, c); it.appendChild(c);
    it.appendChild(todoEl("span", "td-temple-n", x.name));
    var tip = todoEl("span", "td-temple-tip");
    tip.appendChild(todoEl("b", "", "🙏 " + x.name));
    tip.appendChild(todoEl("span", "", x.why || "Click to write why you pray to them."));
    it.appendChild(tip);
    it.setAttribute("aria-label", x.name + (x.why ? " — " + x.why : ""));
    it.onclick = function () { todoTempleEdit(x); };
    box.appendChild(it);
  });
  var add = todoEl("button", "td-temple-i td-temple-plus"); add.type = "button"; add.title = "Add to my temple";
  add.append(todoEl("span", "td-temple-c", "＋"), todoEl("span", "td-temple-n", "Add"));
  add.onclick = function () { todoTempleEdit({ id: todoId(), name: "", why: "", photo: "" }, true); };
  box.appendChild(add);
  box.appendChild(todoPrayBtn());
  return box;
}
/* 🪔 prayer time: 10 minutes, a soft bell at the start and the end; the day it's done goes in TODO.prayLog
   ({ "YYYY-MM-DD": minutes }). The end time is kept in this browser, so a reload doesn't stop it. */
var TODO_PRAY_MIN = 10;
function todoPrayKey() { return "cf-pray-" + ((currentUser() || {}).id || "anon"); }
function todoPrayUntil() { try { return Number(localStorage.getItem(todoPrayKey())) || 0; } catch (_) { return 0; } }
function todoPraySet(t) { try { if (t) localStorage.setItem(todoPrayKey(), String(t)); else localStorage.removeItem(todoPrayKey()); } catch (_) { } }
function todoBell() {
  try {
    var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    var ac = new A(), t0 = ac.currentTime;
    [[528, 0], [792, 0.02], [1056, 0.04]].forEach(function (f) {   // a small temple bell: a few tones fading out
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = f[0];
      g.gain.setValueAtTime(0.0001, t0 + f[1]); g.gain.exponentialRampToValueAtTime(0.18, t0 + f[1] + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + f[1] + 3.5);
      o.connect(g); g.connect(ac.destination); o.start(t0 + f[1]); o.stop(t0 + f[1] + 3.6);
    });
    setTimeout(function () { try { ac.close(); } catch (_) { } }, 4000);
  } catch (_) { }
}
function todoPrayLeft() { return Math.max(0, todoPrayUntil() - Date.now()); }
function todoPrayFmt(ms) { var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function todoPrayBtn() {
  var wrap = todoEl("div", "td-pray"), left = todoPrayLeft();
  if (left > 0) {
    wrap.classList.add("on");
    var t = todoEl("span", "td-pray-t", "🪔 " + todoPrayFmt(left));
    t.title = "Prayer time — " + TODO_PRAY_MIN + " minutes";
    var bar = todoEl("span", "td-pray-bar"), fill = todoEl("i"); fill.style.width = (100 - left / (TODO_PRAY_MIN * 600)) + "%"; bar.appendChild(fill);
    var st = todoEl("button", "td-act", "Stop"); st.title = "End prayer time now";
    st.onclick = function () { todoPraySet(0); renderAll(); };
    wrap.append(t, bar, st);
    return wrap;
  }
  var b = todoEl("button", "td-pray-go", "🪔 Start prayer · " + TODO_PRAY_MIN + " min");
  b.title = "Ten quiet minutes — a bell at the start and at the end";
  b.onclick = function () { todoPraySet(Date.now() + TODO_PRAY_MIN * 60000); todoBell(); renderAll(); };
  wrap.appendChild(b);
  if (TODO.prayLog[todoToday()]) wrap.appendChild(todoEl("span", "td-pray-done", "🙏 prayed today"));
  return wrap;
}
setInterval(function () {
  var until = todoPrayUntil(); if (!until) return;
  var left = until - Date.now();
  if (left > 0) {
    var t = document.querySelector(".td-pray-t"); if (t) t.textContent = "🪔 " + todoPrayFmt(left);
    var f = document.querySelector(".td-pray-bar i"); if (f) f.style.width = (100 - left / (TODO_PRAY_MIN * 600)) + "%";
    return;
  }
  todoPraySet(0); todoBell();
  toast("🙏 Prayer time complete");
  if (TODO.loaded && !todoPeek) { var d = todoToday(); TODO.prayLog[d] = (TODO.prayLog[d] || 0) + TODO_PRAY_MIN; todoSave(); }   // todoSave redraws
  else renderAll();
}, 1000);

/* ---------- the phase banner: what this stretch of days is about ("Next 21 days — slow, focused work") ---------- */
function todoPhaseEdit() {
  var P = TODO.phase || {}, txt, note, until;
  todoDialog("🏷 Phase banner", function (body) {
    body.appendChild(todoEl("p", "hint", "A line that sits on top of My plan — the phase you're in and till when."));
    txt = todoEl("input"); txt.value = P.text || ""; txt.placeholder = "e.g. Slow and focused work — Go Slow phase";
    note = todoEl("textarea"); note.rows = 2; note.value = P.note || ""; note.dataset.plain = "1"; note.placeholder = "Anything else to remind yourself (optional)";
    until = todoEl("input"); until.type = "date"; until.value = P.until || todoAddDays(todoToday(), 21);
    body.appendChild(todoField("Banner", txt));
    body.appendChild(todoField("Note", note));
    body.appendChild(todoField("Till", until));
    setTimeout(function () { txt.focus(); }, 30);
  }, function () {
    var t = txt.value.trim();
    if (!t) { TODO.phase = null; renderAll(); return; }   // empty = no banner
    TODO.phase = { text: t, note: note.value.trim(), until: todoISO(until.value) };
    renderAll();
  });
}
function todoPhaseBanner() {
  var P = TODO.phase;
  if (!P) {
    var a = todoEl("button", "td-phase-add", "🏷 ＋ Add a phase banner — e.g. “Next 21 days: slow, focused work”");
    a.onclick = todoPhaseEdit;
    return a;
  }
  var b = todoEl("section", "td-phase"), tx = todoEl("div", "td-phase-tx");
  tx.appendChild(todoEl("div", "td-phase-t", P.text));
  if (P.note) tx.appendChild(todoEl("div", "td-phase-n", P.note));
  b.appendChild(tx);
  if (P.until) {
    var left = dNum(P.until) - dNum(todoToday());
    b.appendChild(todoEl("div", "td-phase-d" + (left < 0 ? " over" : ""),
      left < 0 ? "ended " + fmtD(P.until) : left === 0 ? "last day · today" : left + (left === 1 ? " day" : " days") + " left · till " + fmtD(P.until)));
  }
  var e = todoEl("button", "td-phase-e", "✎"); e.title = "Edit the banner (empty it to remove)"; e.onclick = todoPhaseEdit;
  b.appendChild(e);
  b.ondblclick = todoPhaseEdit;
  return b;
}

/* ---------- 👥 Our To-do: share plans and ideas with chosen teammates ----------
   A circle (supabase/stage20b_our_todos.sql) is a few people in this team
   who share their To-do with each other — e.g. two co-founders. It's set
   up in the database (no invite / remove buttons in the app). Each
   one's chip above the tabs ("Sumit" / "Pancham") opens that person's
   whole To-do, and everything works there as in my own: add, move, tick,
   delete (their row in my_todos, which the database lets circle members
   read and write). Saves go to whoever's To-do was open. And the
   Thoughts warehouse gets a 👥 Shared list everyone in it writes to.
   Everyone else in the team sees the same page as "✅ My To-do" — just their own.
   Without that SQL run, none of this shows and My To-do works as before. */
var OUR = { team: null, loaded: false, loading: false, off: false, circle: null, members: [], ideas: [], people: {} };
var todoPeek = null;          // id of the teammate whose To-do is open (null = mine)
var todoIdeaScope = "shared"; // shared | mine — which thoughts warehouse list (shared when there's an Our To-do)
// a person in my Our To-do: from the team's people, or from the circle itself (todo_circle_people) when I
// can't see their profile — e.g. a super-admin who isn't a member of the team
function todoPerson(id) {
  var u = (typeof USERS !== "undefined" ? USERS : []).find(function (x) { return x.id === id; });
  if (u) return u;
  var p = OUR.people[id];
  return p ? { id: id, name: p.name || p.email || "", email: (p.email || "").toLowerCase(), username: "", profile: p.avatar_color ? { avatarColor: p.avatar_color } : {} } : null;
}
function todoUserName(id) {
  var u = todoPerson(id);
  return u ? userDisplayName(u) : "A teammate";
}
function todoFirstName(id) { return todoUserName(id).split(/\s+/)[0]; }
function todoMates(status) { var me = (currentUser() || {}).id; return OUR.members.filter(function (m) { return m.user_id !== me && (!status || m.status === status); }); }
function todoCircleNames() { var j = todoMates("joined"); return j.length ? j.map(function (m) { return todoFirstName(m.user_id); }).join(", ") : "Our To-do"; }
async function todoCircleLoad() {
  if (OUR.loading) return;
  var me = currentUser();
  if (!SUPA || !me) { OUR.off = true; OUR.loaded = true; OUR.team = TEAM; return; }
  OUR.loading = true;
  try {
    var c = await SUPA.from("todo_circles").select("id,owner_id,name").eq("team_slug", TEAM);
    if (c.error) throw c.error;
    var circles = c.data || [], ids = circles.map(function (x) { return x.id; });
    var m = ids.length ? await SUPA.from("todo_circle_members").select("circle_id,user_id,status,invited_by").in("circle_id", ids) : { data: [] };
    if (m.error) throw m.error;
    var rows = m.data || [], mine = rows.filter(function (x) { return x.user_id === me.id; });
    var j = mine.find(function (x) { return x.status === "joined"; });
    OUR.circle = j ? circles.find(function (x) { return x.id === j.circle_id; }) || null : null;
    OUR.members = OUR.circle ? rows.filter(function (x) { return x.circle_id === OUR.circle.id; }) : [];
    OUR.people = {};
    if (OUR.circle) {   // names / emails of the people in it, even ones whose profile I can't read
      var pp = await SUPA.rpc("todo_circle_people", { c: OUR.circle.id });
      ((pp && pp.data) || []).forEach(function (x) { OUR.people[x.user_id] = x; });
    }
    OUR.off = false;
  } catch (e) { OUR.off = true; OUR.circle = null; OUR.members = []; }   // stage20b not run yet
  OUR.team = TEAM; OUR.loaded = true; OUR.loading = false;
  if (todoPeek && !todoMates("joined").some(function (x) { return x.user_id === todoPeek; })) { todoPeek = null; TODO.loaded = false; }
  if (OUR.circle) await todoSharedIdeasLoad(true);
  renderAll();
}
async function todoSharedIdeasLoad(quiet) {
  if (!OUR.circle || !SUPA) return;
  var q = function (cols) { return SUPA.from("todo_circle_ideas").select(cols).eq("circle_id", OUR.circle.id).order("created_at", { ascending: false }).limit(1000); };
  var r = OUR.noAgain ? { error: true } : await q("id,text,kind,pin,author_id,created_at,again,solved_at");
  if (r.error) { r = await q("id,text,kind,pin,author_id,created_at"); if (!r.error) OUR.noAgain = true; }   // stage20c not run yet
  if (r.error) return;
  OUR.ideas = (r.data || []).map(function (x) {
    var o = { id: x.id, text: x.text, kind: x.kind, at: x.created_at, author: x.author_id };
    if (x.pin) o.pin = true;
    if (Array.isArray(x.again) && x.again.length) o.again = x.again;
    if (x.solved_at) o.solved = x.solved_at;
    return o;
  });
  if (!quiet) renderAll();
}
async function todoSharedIdeaAdd(x) {
  var r = await SUPA.from("todo_circle_ideas").insert({ circle_id: OUR.circle.id, author_id: currentUser().id, text: x.text, kind: x.kind });
  if (r.error) { toast("Couldn't share it: " + r.error.message); return; }
  todoSharedIdeasLoad();
}
async function todoSharedIdeaPut(x) {
  renderAll();
  var up = { text: x.text, kind: x.kind || "idea", pin: !!x.pin, updated_at: new Date().toISOString() };
  if (!OUR.noAgain) { up.again = x.again || []; up.solved_at = x.solved || null; }
  else if ((x.again && x.again.length) || x.solved) toast("Ask an admin to run stage20c_thoughts.sql to keep “Again” / “Solved” on the shared list");
  var r = await SUPA.from("todo_circle_ideas").update(up).eq("id", x.id);
  if (r.error) { toast("Couldn't save it: " + r.error.message); todoSharedIdeasLoad(); }
}
async function todoSharedIdeaDel(x) {
  OUR.ideas = OUR.ideas.filter(function (y) { return y !== x; }); renderAll();
  var r = await SUPA.from("todo_circle_ideas").delete().eq("id", x.id);
  if (r.error) { toast("Couldn't delete it: " + r.error.message); todoSharedIdeasLoad(); }
}
// open my To-do or theirs — everything works the same in both
async function todoSwitch(uid) {
  uid = uid || null;
  if (uid === todoPeek) return;
  await todoFlush();   // anything still waiting to save goes to the right person first
  todoPeek = uid; TODO.loaded = false;
  todoAddIn = todoSubAdd = todoIdeaEdit = null;
  renderAll();
}
// the people row sits above the tab strip: each person, then that person's tabs (Plan · Ideas · Why)
function todoPeopleTop(strip) {
  var old = document.getElementById("td-people-top"); if (old) old.remove();
  if (!strip) return;
  var ppl = todoPeople(); if (!ppl) return;
  ppl.id = "td-people-top";
  strip.parentNode.insertBefore(ppl, strip);
}
// the people: me · them
function todoPeople() {
  if (!OUR.loaded || OUR.off || OUR.team !== TEAM || !todoMates("joined").length) return null;
  var me = currentUser(), bar = todoEl("div", "td-people");
  var chip = function (uid, label, on, fn) {
    var u = todoPerson(uid);
    var b = todoEl("button", "td-person" + (on ? " on" : ""));
    var av = todoEl("span", "td-person-av", (todoUserName(uid) || "?").charAt(0).toUpperCase());
    if (u && typeof userAvatarColor === "function") av.style.background = userAvatarColor(u);
    b.append(av, todoEl("span", "", label));
    b.onclick = fn;
    bar.appendChild(b);
    return b;
  };
  chip(me.id, todoFirstName(me.id), !todoPeek, function () { todoSwitch(null); }).title = "My To-do";
  todoMates("joined").forEach(function (m) {
    chip(m.user_id, todoFirstName(m.user_id), todoPeek === m.user_id, function () { todoSwitch(m.user_id); })
      .title = todoUserName(m.user_id) + "'s To-do — you can change anything here, as they can in yours";
  });
  return bar;
}
// keep Our To-do fresh while it's open: we both edit, so pick up the other one's changes
setInterval(function () {
  if (typeof view === "undefined" || view !== "todo" || !OUR.circle || document.visibilityState !== "visible") return;
  var a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;   // don't redraw under someone typing
  if (todoTab === "ideas" && todoIdeaScope === "shared") todoSharedIdeasLoad();
  else if (!todoSaving() && !todoIdeaEdit && TODO.loaded) todoLoad();
}, 60000);

/* ---------- 🗺 Our Timeline: a private roadmap for the people in Our To-do ----------
   Only what we write ourselves: our own phases (✏️ Write task, ＋ Phase) — nothing is pulled in from roadmaps
   or spaces (the spaces each of us heads, and what's assigned to us, are in 🗓 Timeline). It is an
   ordinary roadmap in RMAPS (saved with the team's roadmaps), access "private" with the circle's people as its
   admins, marked m.ourTodo = circle id so it sits here and not in the sidebar. Team owners / admins can still open
   it, as they can every space. */
function todoOurMap() { return OUR.circle && typeof RMAPS !== "undefined" ? (RMAPS.maps || []).find(function (m) { return m.ourTodo === OUR.circle.id; }) || null : null; }
// while the tab is open, rights on the chart come from that roadmap (index.html currentSpaceRef asks)
function todoOurMapRef() { var m = typeof view !== "undefined" && view === "todo" && todoTab === "timeline" ? todoOurMap() : null; return m ? rmapRef(m) : null; }
function todoOurMapCreate() {
  var members = {}, me = currentUser();
  OUR.members.filter(function (x) { return x.status === "joined"; }).forEach(function (x) { var u = todoPerson(x.user_id); if (u && u.email) members[String(u.email).toLowerCase()] = "admin"; });
  if (me && me.email) members[String(me.email).toLowerCase()] = "admin";
  var nm = { id: "rm-our" + Date.now().toString(36), name: "Our Timeline — " + todoFirstName(me.id) + " & " + todoCircleNames(), view: "gantt",
    items: [], own: [], markers: [], access: "private", members: members, ourTodo: OUR.circle.id };
  rmlEnsureLanes(nm, "gantt");
  RMAPS.maps.push(nm);
  saveRmaps();
  toast("Our Timeline is ready");
}
function todoOurTimeline(wrap) {
  var m = todoOurMap();
  if (!m) {
    var box = todoEl("section", "module-block td-our-setup");
    box.appendChild(todoEl("h2", "", "🗺 Our Timeline"));
    box.appendChild(todoEl("p", "hint", "One chart for " + todoFirstName((currentUser() || {}).id) + " & " + todoCircleNames() + ": your own phases and tasks — in or outside Dubuddy — written here. Only the two of you see it here (team owners and admins can open it, as they can every space)."));
    var go = todoEl("button", "btn save", "＋ Set up our timeline");
    go.onclick = function () { go.disabled = true; todoOurMapCreate(); };
    box.appendChild(go);
    wrap.appendChild(box);
    return;
  }
  var byTid = {};
  allTasks().forEach(function (x) { byTid[x.tid] = x; });
  m.items = (m.items || []).filter(function (it) { return byTid[it.tid]; });
  var C = todoOurChart(m, byTid);
  var hint = todoEl("div", "hint", "Your own timeline — ✏️ Write task and ＋ Phase. What each of you heads and is assigned is in 🗓 Timeline.");
  hint.style.margin = "0 0 8px";
  wrap.appendChild(hint);
  renderRmapGantt(C, wrap, byTid);
}
/* ---------- 👑 the spaces I head, inside 🗓 Timeline ----------
   A head of a space (cs.heads, set in the space's people) sees its whole Timeline there, and every space
   inside it — e.g. the head of Marketing sees Social Media's schedule, each campaign, and any space added
   under Marketing later, even one with a head of its own (who sees it in theirs too). Read-only: rows are
   changed where they live (dragging a bar here moves it there, as on a merged roadmap). Nothing is saved. */
function todoHeadEmail() { var u = (todoPeek ? todoPerson(todoPeek) : currentUser()) || {}; return String(u.email || "").toLowerCase(); }
function todoHeadsCs(cs) { return (Array.isArray(cs.heads) ? cs.heads : []).map(function (e) { return String(e).toLowerCase(); }); }
function todoCsById(id) { return ((CSPACES && CSPACES.list) || []).find(function (x) { return x.id === id; }) || null; }
// the spaces I head, highest first; a space inside one I already head isn't listed again (it's shown inside)
function todoHeadSpaces() {
  var em = todoHeadEmail(); if (!em) return [];
  var list = ((CSPACES && CSPACES.list) || []).filter(function (cs) { return todoHeadsCs(cs).indexOf(em) >= 0 && todoCanSee(cs); });
  var mine = {}; list.forEach(function (cs) { mine[cs.id] = 1; });
  return list.filter(function (cs) {
    var p = cs.parent ? todoCsById(cs.parent) : null, g = 0;
    while (p && g++ < 8) { if (mine[p.id]) return false; p = p.parent ? todoCsById(p.parent) : null; }
    return true;
  });
}
/* Assigned work, drawn inside 🗓 Timeline: everything on the boards that's mine, not done and not on my plan
   yet, on its own dates (a timeline row's, an idea's phase, a card's due date) — under a heading for the space
   it's from (💡 Product Roadmap, 🏃 Engineering Team, a bugs board…), like a space I head. ＋ on a row puts it on
   my plan in a group named after that space; clicking it opens it where it lives. Only drawn here; the plan
   itself changes only through ＋. Returns the next grid row. */
// the space an assigned thing comes from: "Product Roadmap" from "Product Roadmap · Timeline", the team from
// "Engineering · Engineering Team", the roadmap from "Roadmap · …"
function todoAsgSpace(e) {
  var b = String(e.board || e.where || e.src || "Other");
  if (b.indexOf("Engineering · ") === 0) return b.slice(14) || "Engineering";
  return b.split(" · ")[0].split(" › ")[0] || "Other";
}
function todoAsgIcon(name, e) {
  var cs = ((CSPACES && CSPACES.list) || []).find(function (x) { return x.name === name; });
  return cs && typeof csTypeIcon === "function" ? csTypeIcon(cs.type) : (e.icon || "📁");
}
function todoAsgRows(grid, rIdx, dayOf, nD, cellsRow, S) {
  var on = {}; try { on = todoOnPlan(); } catch (_) { }
  var inView = function (e) { if (!e.start && !e.due) return true; var a = e.start || e.due, b = e.due || e.start; return !(dayOf(b) < 0 || dayOf(a) > nD - 1); };
  var list = Object.keys(S.asg || {}).map(function (k) { return S.asg[k]; })
    .filter(function (e) { return e.col !== "done" && !on[e.key] && inView(e); })
    .sort(function (a, b) { return (a.start || a.due || "9") < (b.start || b.due || "9") ? -1 : 1; });
  var groups = [], by = {};
  list.forEach(function (e) { var g = todoAsgSpace(e); if (!by[g]) { by[g] = []; groups.push(g); } by[g].push(e); });
  groups.forEach(function (g) {
    var id = "asg:" + g, items = by[g];
    var lab = todoEl("div", "rmg-phase td-head-sec"); lab.style.gridRow = String(rIdx); lab.dataset.lane = id;
    var fo = todoEl("button", "td-fold", TODO_HFOLD[id] ? "▸" : "▾"); fo.title = TODO_HFOLD[id] ? "Show it" : "Minimise it";
    fo.onclick = function (ev) { ev.stopPropagation(); if (TODO_HFOLD[id]) delete TODO_HFOLD[id]; else TODO_HFOLD[id] = 1; renderAll(); };
    lab.appendChild(fo);
    lab.appendChild(todoEl("span", "rmg-pname", todoAsgIcon(g, items[0]) + " " + g));
    lab.appendChild(todoEl("span", "rmg-pct", String(items.length)));
    lab.title = "Assigned to " + (todoPeek ? todoFirstName(todoPeek) : "you") + " in " + g + ", not on the plan yet — ＋ puts one on it";
    grid.appendChild(lab); cellsRow(rIdx, id, "phase"); rIdx++;
    if (TODO_HFOLD[id]) return;
    items.forEach(function (e) {
      var nm = todoEl("div", "rmg-task"); nm.style.gridRow = String(rIdx); nm.dataset.lane = id; nm.style.paddingLeft = "20px";
      nm.appendChild(todoEl("span", "rmg-tt", (e.icon ? e.icon + " " : "") + (e.title || "(untitled)")));
      var span = e.start || e.due ? (e.start && e.start !== e.due ? fmtD(e.start) + " → " : e.due ? "due " : "") + (e.due ? fmtD(e.due) : "") : "No date";
      nm.appendChild(todoEl("span", "rmg-td", span + (e.status ? " · " + e.status : "")));
      nm.title = (e.title || "") + "\n" + (e.board || e.where || "") + (e.status ? " · " + e.status : "") + "\nClick to open it where it lives · ＋ to put it on your plan";
      nm.style.cursor = "pointer";
      nm.onclick = function () { try { e.open(); } catch (_) { } };
      var pl = todoEl("button", "td-gadd td-subbtn", "＋"); pl.title = "Put it on my plan, on these dates";
      pl.onclick = function (ev) {
        ev.stopPropagation();
        var a = e.start || (e.due && e.due < todoPlaceStart() ? e.due : todoPlaceStart()), b = e.due && e.due >= a ? e.due : todoAddDays(a, 6);
        todoNewTask(e.title || "(untitled)", todoGroupFor(g), a, b, { k: "asg", key: e.key });
        todoSave(); toast("On your plan — “" + g + "”");
      };
      nm.appendChild(pl);
      grid.appendChild(nm); cellsRow(rIdx, id, "");
      if (e.start || e.due) {
        var s = Math.max(0, dayOf(e.start || e.due)), en = Math.min(nD - 1, Math.max(s, dayOf(e.due || e.start)));
        var bar = todoEl("div", "rmg-blk rmg-line"); bar.style.gridRow = String(rIdx); bar.style.gridColumn = (s + 2) + " / " + (en + 3);
        bar.style.background = "#8A93A6"; bar.style.cursor = "pointer"; bar.title = nm.title; bar.onclick = nm.onclick;
        grid.appendChild(bar);
      }
      rIdx++;
    });
  });
  return rIdx;
}
/* the same, drawn inside 🗓 Timeline (the Month / Quarter / Week chart): one ▾ section per space I head, its
   inner spaces and phases as sections under it, its rows with their bars. Read-only — a row opens where it lives.
   Folding is kept for the session (TODO_HFOLD); nothing is saved. Returns the next grid row. */
var TODO_HFOLD = {};
function todoHeadRows(grid, rIdx, dayOf, nD, cellsRow) {
  var spaces; try { spaces = todoHeadSpaces(); } catch (_) { return rIdx; }
  if (!spaces.length) return rIdx;
  var byTid = {}; allTasks().forEach(function (x) { byTid[x.tid] = x; });
  var lanes = [], items = [];
  spaces.forEach(function (cs) {
    var par = cs.parent ? todoCsById(cs.parent) : null;
    try {
      if (MERGE_TYPES.indexOf(cs.type) >= 0) todoTlAddSpace(cs, "hd:", null, lanes, items, byTid);
      else if (par && par.type === "marketing") todoTlAddSpace(par, "hd:", null, lanes, items, byTid, cs);   // e.g. Social Media under Marketing
    } catch (_) { }
  });
  var inView = function (it) { if (!it.start && !it.end) return true; var a = it.start || it.end, b = it.end || it.start; return !(dayOf(b) < 0 || dayOf(a) > nD - 1); };
  var kidsOf = function (id) { return lanes.filter(function (l) { return (l.parent || null) === id; }); };
  var rowsOf = function (l) { return items.filter(function (it) { return it.lane === l.id && inView(it); }); };
  var count = function (l) { return rowsOf(l).length + kidsOf(l.id).reduce(function (n, k) { return n + count(k); }, 0); };
  var draw = function (l, depth) {
    var n = count(l);
    if (depth && !n) return;   // an empty inner section stays out
    var lab = todoEl("div", "rmg-phase td-head-sec"); lab.style.gridRow = String(rIdx); lab.dataset.lane = l.id;
    if (depth) lab.style.paddingLeft = (8 + depth * 16) + "px";
    var fo = todoEl("button", "td-fold", TODO_HFOLD[l.id] ? "▸" : "▾"); fo.title = TODO_HFOLD[l.id] ? "Show it" : "Minimise it";
    fo.onclick = function (ev) { ev.stopPropagation(); if (TODO_HFOLD[l.id]) delete TODO_HFOLD[l.id]; else TODO_HFOLD[l.id] = 1; renderAll(); };
    lab.appendChild(fo);
    lab.appendChild(todoEl("span", "rmg-pname", (depth ? "" : "👑 ") + l.name));
    lab.appendChild(todoEl("span", "rmg-pct", n ? String(n) : ""));
    if (!depth) lab.title = "A space you head — read-only here; open a row to change it where it lives";
    grid.appendChild(lab); cellsRow(rIdx, l.id, "phase"); rIdx++;
    if (TODO_HFOLD[l.id]) return;
    if (!depth && !n) {   // open but nothing in it yet: say so, and name the spaces it covers
      var inner = kidsOf(l.id).map(function (k) { return k.name; }).filter(function (x) { return x && x !== "Planning"; });
      var em = todoEl("div", "rmg-task td-head-empty", "Nothing scheduled here " + (todoLevel === "week" ? "this week" : "in this period") + " yet" + (inner.length ? " — " + inner.join(", ") : "") + ".");
      em.style.gridRow = String(rIdx); em.style.paddingLeft = "20px"; em.style.color = "var(--muted)"; em.style.fontStyle = "italic";
      grid.appendChild(em); cellsRow(rIdx, l.id, ""); rIdx++;
      return;
    }
    rowsOf(l).forEach(function (it) {
      var en = byTid[it.tid] || {}, t = en.task || {}, title = t.title || t.name || "(untitled)";
      var st = ""; try { st = effStatus(t); } catch (_) { }
      var done = it.done || st === "done";
      var nm = todoEl("div", "rmg-task" + (done ? " done" : "")); nm.style.gridRow = String(rIdx); nm.dataset.lane = l.id;
      nm.style.paddingLeft = (20 + depth * 16) + "px";
      nm.appendChild(todoEl("span", "rmg-tt", (done ? "✓ " : "") + title));
      var span = it.start || it.end ? fmtD(it.start || it.end) + (it.end && it.end !== it.start ? " → " + fmtD(it.end) : "") : "No date";
      nm.appendChild(todoEl("span", "rmg-td", span + (it.owner ? " · 👤 " + it.owner : "")));
      nm.title = title + (it._from ? "\n" + it._from : "") + "\nRead-only here — click to open it where it lives";
      nm.style.cursor = "pointer";
      if (typeof it.open === "function") nm.onclick = function () { it.open(); };
      grid.appendChild(nm); cellsRow(rIdx, l.id, "");
      if (it.start || it.end) {
        var s = Math.max(0, dayOf(it.start || it.end)), e = Math.min(nD - 1, Math.max(s, dayOf(it.end || it.start)));
        var bar = todoEl("div", "rmg-blk rmg-line" + (done ? " done" : ""));
        bar.style.gridRow = String(rIdx); bar.style.gridColumn = (s + 2) + " / " + (e + 3);
        bar.style.background = it.color || "#3A9CA8"; bar.title = nm.title;
        if (typeof it.open === "function") { bar.style.cursor = "pointer"; bar.onclick = function () { it.open(); }; }
        grid.appendChild(bar);
      }
      rIdx++;
    });
    kidsOf(l.id).forEach(function (k) { draw(k, depth + 1); });
  };
  kidsOf(null).forEach(function (l) { draw(l, 0); });
  return rIdx;
}
var TODO_OURC = {};   // the chart object per Our Timeline (kept for the session, so its 1/2/3-month choice sticks)
// one space's Timeline into a chart, under `parent`, its ids prefixed with P (as on a roadmap that merges spaces).
// `only` = a Marketing space's child: just that child's rows of its parent's Timeline (social posts, a campaign…)
function todoTlAddSpace(cs, P, parent, lanes, items, byTid, only) {
  var got; try { got = spaceTimelineMap(cs); } catch (e) { return; }
  var sm = got.m, head = { id: P + "mg:" + (only ? only.id : cs.id), name: csTypeIcon((only || cs).type) + " " + (only || cs).name, kind: "project", parent: parent || undefined };
  var sl = sm.lanes || [], si = sm.items || [];
  if (only) {   // the child's own lane ("mv-<id>") and what sits under it
    var inside = {}; inside["mv-" + only.id] = 1;
    var grew = true; while (grew) { grew = false; sl.forEach(function (l) { if (!inside[l.id] && l.parent && inside[l.parent]) { inside[l.id] = 1; grew = true; } }); }
    sl = sl.filter(function (l) { return inside[l.id]; }); si = si.filter(function (it) { return inside[it.lane]; });
    if (!sl.length) return;
  }
  if (!only) lanes.push(head);   // a child's own lane is its heading already
  var top = only ? (parent || undefined) : head.id;
  Object.keys(got.byTid).forEach(function (k) { byTid[k] = got.byTid[k]; });
  var ids = {}; sl.forEach(function (l) { ids[l.id] = 1; });
  sl.forEach(function (ln) {
    lanes.push({ id: P + cs.id + ":" + ln.id, name: sm.laneLabel ? sm.laneLabel(ln) : ln.name, kind: ln.kind || "project", parent: ln.parent && ids[ln.parent] ? P + cs.id + ":" + ln.parent : top });
  });
  si.forEach(function (it) {
    if (!byTid[it.tid]) return;
    var cp = Object.assign({}, it, { rid: P + cs.id + ":" + it.rid, lane: P + cs.id + ":" + it.lane, parent: it.parent ? P + cs.id + ":" + it.parent : undefined, _from: cs.name });
    if (!cp.move && byTid[it.tid].kind !== "virtual") rmgWriteBack(cp, it, cs);   // dragging it here changes it in its space
    if (!cp.open) cp.open = function () { goSpace(cs, "timeline"); };
    items.push(cp);
  });
}
function todoOurChart(m, byTid) {
  var C = TODO_OURC[m.id] || (TODO_OURC[m.id] = { id: "omc-" + m.id, view: "gantt", gWin: m.gWin || 0, spaceOf: "merge" });
  C.name = m.name;
  m.lanes = m.lanes || []; rmlEnsureLanes(m);
  ownLanesFix(m);
  C.lanes = m.lanes.slice(); C.items = m.items.slice();
  C.mapOf = function () { return m; };   // every row is ours: editable here
  C.linkStore = m;
  C.barButtons = function (row) {   // write our own — no ＋ From spaces, no ⚙ Merge
    var spx = todoEl("span", "spacer"); row.appendChild(spx);
    var mk = function (txt, tip, fn) { var b = todoEl("button", "tool sm", txt); b.title = tip; b.onclick = fn; row.appendChild(b); };
    mk("✏️ Write task", "Write a new task on our timeline", function () { rmlNewOwn(m, rmlEnsureLanes(m)[0].id); });
    mk("＋ Phase", "Add a phase", function () { rmlEditLane(m, null); });
  };
  return C;
}

/* ---------- counts (sidebar and Summary) ---------- */
function todoCounts() {
  var S = todoSources(), t = todoToday(), c = { todo: 0, progress: 0, done: 0 };
  TODO.planner.tasks.forEach(function (x) {
    if (todoGone(x, S)) return;
    if (todoInfo(x, S).done) c.done++;
    else if (x.start <= t) c.progress++;   // running (or overdue)
    else c.todo++;
  });
  return c;
}

/* ---------- the page ---------- */
// the tab strip at the top of the page (index.html renderTabs calls this on My To-do)
function todoTabs(strip) {
  todoPeopleTop(strip);
  var tabs = [["plan", "🗓 Timeline"], ["ideas", "💭 Thoughts warehouse"], ["why", "🧭 Why I do what I do"]];
  if (OUR.circle && OUR.team === TEAM) tabs.splice(1, 0, ["timeline", "🗺 Our Timeline"]);   // only for the people in Our To-do
  else if (todoTab === "timeline") todoTab = "plan";
  if (todoTab === "headtl") todoTab = "plan";   // the spaces I head now sit inside 🗓 Timeline (todoHeadRows)
  if (typeof accSalesGlance === "function" && typeof accCan === "function" && accCan()) tabs.push(["sales", "💳 Sales"]);   // accounts.js: owners + super-admins
  else if (todoTab === "sales") todoTab = "plan";
  tabs.forEach(function (T) {
    var b = todoEl("button", "tab" + (todoTab === T[0] ? " active" : ""), T[1]);
    b.onclick = function () { if (todoTab === T[0]) return; todoTab = T[0]; renderAll(); };
    strip.appendChild(b);
  });
}
function renderContentTodo() {
  var wrap = $("content");
  wrap.innerHTML = "";
  if (!todoCan()) { wrap.appendChild(todoEl("div", "empty", "My To-do opens once you're a member of this team.")); return; }
  if (!TODO.loaded || TODO.team !== TEAM) {
    if (TODO.team !== TEAM) { TODO.loaded = false; OUR.loaded = false; todoPeek = null; }
    wrap.appendChild(todoEl("div", "empty", todoPeek ? "Loading " + todoUserName(todoPeek) + "'s To-do…" : "Loading your plan…"));
    todoLoad(); return;
  }
  if (TODO.local) wrap.appendChild(todoEl("div", "td-note", "Couldn't reach the database — your plan is saved in this browser for now."));
  if (todoTab === "why") { wrap.appendChild(todoWhyPage()); return; }
  if (todoTab === "ideas") { wrap.appendChild(todoIdeas()); return; }
  if (todoTab === "sales") { wrap.appendChild(accSalesGlance()); return; }
  if (todoTab === "timeline") { todoOurTimeline(wrap); return; }
  try { if (todoAutoPlace()) setTimeout(todoSave, 0); } catch (_) { }   // sprints I've been made owner of
  todoPlanBar(wrap);
  wrap.appendChild(todoPhaseBanner());
  wrap.appendChild(todoTemple());   // 🛕 each person's own (set up when they want, like the banner)
  todoPlanBody(wrap);
}
// the bar: Month · Quarter · Week · Day, ‹ Today ›, and where things come from (only on my own plan)
function todoPlanBar(wrap) {
  var S = todoSources();
  var head = todoEl("section", "module-block rm-bar");
  var row = todoEl("div", "module-head");
  row.appendChild(todoEl("h2", "", todoPeek ? todoFirstName(todoPeek) + "'s timeline" : "My timeline"));
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
  // plan the next day the night before — jumps straight to tomorrow's day view
  var tmr = todoAddDays(todoToday(), 1), onTmr = todoLevel === "day" && todoWindow().from === tmr;
  var tb = todoEl("button", "rmg-nav rmg-tmr" + (onTmr ? " on" : ""), "🌙 Tomorrow");
  tb.title = onTmr ? "Looking at tomorrow" : "Tomorrow's day";
  tb.onclick = function () { if (onTmr) return; todoLevel = "day"; todoAt.day = tmr; renderAll(); };
  ctl.appendChild(tb);
  row.appendChild(ctl);
  row.appendChild(todoEl("span", "spacer"));
  var mk = function (txt, tip, fn, cls) { var b = todoEl("button", "tool sm" + (cls ? " " + cls : ""), txt); b.title = tip; b.onclick = fn; row.appendChild(b); };
  var nAsg = 0; try { var onP = todoOnPlan(); nAsg = Object.keys(S.asg).filter(function (k) { return S.asg[k].col !== "done" && !onP[k]; }).length; } catch (_) { }
  mk("📥 Assigned to " + (todoPeek ? todoFirstName(todoPeek) : "me") + (nAsg ? " (" + nAsg + ")" : ""), "Cards on the team's boards that are yours — place them on your timeline", todoPickAssigned, "primary");
  mk("🗺 From roadmaps", "Pick tasks from the team's roadmap charts (Gantt etc.) — with their phase, owner and dates", todoPickRoadmaps);
  mk("＋ From boards", "Pick anything from any board to plan it here", todoPickBoards);
  mk("＋ Group", "Add a group (like a phase)", function () { todoEditGroup(null); });
  head.appendChild(row);
  wrap.appendChild(head);
}
// the chart (or the day's list and timeline) for whatever plan TODO holds right now
function todoPlanBody(wrap) {
  var S = todoSources();
  if (todoLevel === "day") {   // the day starts with waking up and ends with going to bed
    var dd = todoWindow().from;
    wrap.appendChild(todoClock("wake", dd));
    var two = todoEl("div", "td-dayx");
    var lst = todoDayList(S);
    two.appendChild(lst);
    two.appendChild(todoTimeline(S, dd, todoDayTasks(S, dd)));
    wrap.appendChild(two);
    wrap.appendChild(todoClock("sleep", dd));
  } else wrap.appendChild(todoGantt(S));
}
// "Our To-do" when I share it with teammates, else "My To-do"
function todoTitle() { return OUR.circle && OUR.team === TEAM ? "Our To-do" : "My To-do"; }
/* the sidebar entry, at the top of Spaces */
function todoSideItem() {
  var b = todoEl("button", "ws-item td-side" + (view === "todo" ? " active" : ""));
  var ok = TODO.loaded && TODO.team === TEAM;
  b.innerHTML = "<span>✅ " + todoTitle() + "</span>" + (ok ? "<span class=\"td-side-n\"></span>" : "");
  if (ok) {
    var c = todoCounts(), n = c.progress;
    b.querySelector(".td-side-n").textContent = n;
    b.title = n + " running now · " + c.todo + " later · " + c.done + " done";
  }
  b.onclick = function () { view = "todo"; renderAll(); };
  if ((!TODO.loaded || TODO.team !== TEAM) && !TODO.loading) todoLoad();
  return b;
}
