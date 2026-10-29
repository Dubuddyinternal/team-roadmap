/* =====================================================================
   📈 My Performance — a page next to Workspace (top bar)

   One place for how someone is doing:
   · 🎯 OKRs — the objectives they own (alone or jointly) or hold a key
     result in, in the current cycle, with progress
   · 📝 Monthly feedback — their own feedback month by month, and the
     manager's review (the review-meeting notes) on it
   · 📈 OKR check-ins — the twice-a-month updates (stage 22b)
   · 🤝 Agreements — for the Marketing spaces they are part of: each target
     in 🤝 Our agreement, period by period, kept or missed (their own count
     for "each person" targets like LMS drops), and Social Media's weekly
     content agreement, week by week
   Everyone sees their own. Seniors (above someone in My Team → Reporting
   lines) and super-admins can switch to the people they can see, using the
   same rule as monthly feedback (feedback_overview).
   ===================================================================== */

var PERF = { who: null, people: null };
/* My Performance starts counting here: earlier months and periods aren't shown or counted */
var PERF_START = "2026-10-01";

function perfEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function perfUser(id) { return (typeof USERS !== "undefined" ? USERS : []).find(function (u) { return u.id === id; }) || null; }
function perfISO(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function perfShort(iso) { var a = String(iso).split("-"); return new Date(+a[0], +a[1] - 1, +a[2]).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }

function openPerformance() {
  var pg = document.getElementById("perf-page");
  if (!pg) {
    pg = perfEl("div", "team-page"); pg.id = "perf-page"; pg.style.display = "none";
    document.body.appendChild(pg);
  }
  if (typeof closeTeam === "function") closeTeam();
  var me = currentUser(); if (!me) return;
  if (!PERF.who) PERF.who = me.id;
  pg.style.display = "block"; window.scrollTo(0, 0);
  renderPerformance();
}
function closePerformance() { var pg = document.getElementById("perf-page"); if (pg) pg.style.display = "none"; }

/* the people I may look at: me, the people below me in the reporting lines; super-admins: everyone */
async function perfLoadPeople() {
  var me = currentUser();
  if (PERF.people) return PERF.people;
  var ids = [me.id];
  try {
    var k = typeof fbCur === "function" ? fbCur() : new Date().toISOString().slice(0, 7);
    var r = await SUPA.rpc("feedback_overview", { p_team: TEAM, p_month: k });
    if (!r.error && r.data) r.data.forEach(function (x) { if (ids.indexOf(x.user_id) < 0) ids.push(x.user_id); });
  } catch (_) { }
  PERF.people = ids.map(perfUser).filter(Boolean);
  return PERF.people;
}

async function renderPerformance() {
  var pg = document.getElementById("perf-page"); if (!pg) return;
  var me = currentUser(); if (!me) return;
  pg.innerHTML = "";
  var shell = perfEl("div", "mt-shell"); pg.appendChild(shell);
  var top = perfEl("div", "mt-top");
  var brand = perfEl("div", "mt-brand"); brand.append(perfEl("span", "mt-bi", "📈"), document.createTextNode(" My Performance"));
  top.appendChild(brand);
  var pickBox = perfEl("span"); top.appendChild(pickBox);
  var back = perfEl("button", "mt-back", "← Back to workspace"); back.onclick = closePerformance; back.style.marginLeft = "auto";
  top.appendChild(back);
  shell.appendChild(top);

  var people = SUPA ? await perfLoadPeople() : [me];
  if (people.length > 1) {
    var sel = perfEl("select", "perf-pick");
    people.slice().sort(function (a, b) { return (a.id === me.id ? -1 : b.id === me.id ? 1 : userDisplayName(a).localeCompare(userDisplayName(b))); })
      .forEach(function (u) { var o = perfEl("option", null, u.id === me.id ? userDisplayName(u) + " (me)" : userDisplayName(u)); o.value = u.id; sel.appendChild(o); });
    sel.value = PERF.who;
    sel.onchange = function () { PERF.who = sel.value; renderPerformance(); };
    pickBox.appendChild(sel);
  }
  var who = perfUser(PERF.who) || me, mine = who.id === me.id;
  var head = perfEl("div", "mt-head"), hl = perfEl("div");
  hl.append(perfEl("h1", null, mine ? "My performance" : userDisplayName(who) + "’s performance"),
    perfEl("div", "mt-sub", "OKRs, monthly feedback and the manager's review, the personality profile, and OKR check-ins."));
  head.appendChild(hl); shell.appendChild(head);

  var tiles = perfEl("div", "perf-tiles"); shell.appendChild(tiles);
  var body = perfEl("div", "perf-body"); shell.appendChild(body);
  var tile = function (n, l, sub) { var t = perfEl("div", "perf-tile"); t.append(perfEl("div", "n", n), perfEl("div", "l", l)); if (sub) t.appendChild(perfEl("div", "s", sub)); tiles.appendChild(t); return t; };

  /* 🎯 OKRs */
  var okrs = perfOkrs(who);
  var okrAvg = okrs.list.length ? Math.round(okrs.list.reduce(function (a, x) { return a + objPct(x.ob); }, 0) / okrs.list.length) : null;
  var okrTile = tile(okrAvg == null ? "—" : okrAvg + "%", "OKR progress", okrs.list.length ? okrs.list.length + " objective" + (okrs.list.length === 1 ? "" : "s") + (okrs.cyc ? " · " + (okrs.cyc.name || okrs.cyc.key) : "") : "no OKRs this cycle");
  okrTile.classList.add("go"); okrTile.title = "Go to the OKRs below";
  okrTile.onclick = function () { var e = document.getElementById("perf-okrs"); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); };
  var fbTile = tile("…", "Feedback sent");
  var ciTile = tile("…", "OKR check-ins");

  var mSec = perfSection("📅 Month by month"); body.appendChild(mSec.el);
  mSec.body.appendChild(perfEl("div", "hint", "Loading…"));
  var pSec = perfSection("🧠 Personality profile"); body.appendChild(pSec.el);
  var okrEl = perfOkrSection(okrs, who, mine); body.appendChild(okrEl);
  var fbSec = perfSection("📝 Monthly feedback & manager's review"); body.appendChild(fbSec.el);
  var ciSec = perfSection("📈 OKR check-ins"); body.appendChild(ciSec.el);

  /* agreements are worked out in the browser */
  var ag = perfAgreements(who);
  /* 🤝 agreements kept: switched off for now (the tile, the month column and the section) */

  if (!SUPA) { mSec.body.innerHTML = ""; perfMonthly(mSec.body, [], [], ag, okrs, mine); return; }
  var res = await Promise.all([
    SUPA.from("monthly_feedback").select("*").eq("team_slug", TEAM).eq("user_id", who.id).order("month", { ascending: false }),   /* RLS: yours, or sent ones of people below you */
    SUPA.from("okr_checkins").select("period,done_at,note,updates").eq("team_slug", TEAM).eq("user_id", who.id).order("done_at", { ascending: false }).limit(48),
    typeof fbLoadSettings === "function" ? fbLoadSettings() : null   /* the open day decides which month can be filled now */
  ]);
  /* 📝 feedback */
  var fbRows = (res[0] && res[0].data) || [];
  var sent = fbRows.filter(function (x) { return x.status === "submitted"; });
  fbTile.querySelector(".n").textContent = String(sent.length);
  fbTile.appendChild(perfEl("div", "s", sent.length ? sent.filter(function (x) { return !x.late; }).length + " on time · " + sent.filter(function (x) { return x.discussed_at; }).length + " reviewed" : "nothing sent yet"));
  perfFeedbackView(fbSec.body, fbRows, mine);
  perfPersonality(pSec.body, fbRows, mine);
  /* 📈 check-ins */
  var ciRows = [];
  if (res[1].error) { ciTile.querySelector(".n").textContent = "—"; ciSec.body.appendChild(perfEl("div", "hint", "OKR check-ins aren't set up yet.")); }
  else {
    ciRows = res[1].data || [];
    ciTile.querySelector(".n").textContent = String(ciRows.length);
    ciTile.appendChild(perfEl("div", "s", ciRows.length ? "last " + perfShort(ciRows[0].done_at.slice(0, 10)) : "none yet"));
    perfCheckinView(ciSec.body, ciRows);
  }
  /* 📅 month by month, with the average */
  mSec.body.innerHTML = "";
  perfMonthly(mSec.body, fbRows, ciRows, ag, okrs, mine);
}
/* ---------- 🧠 personality profile, from the traits they ticked in their monthly feedback ---------- */
var PERF_THEMES = [
  { k: "rel", name: "Reliability", type: "The Steady Achiever", line: "gets things done properly and can be counted on",
    pos: ["Dependable", "Diligent", "Disciplined", "Efficient", "Determined"], neg: ["Flaky", "Irresponsible", "Lazy", "Thoughtless"] },
  { k: "warm", name: "Warmth", type: "The Supportive Team-player", line: "looks after people and makes the team feel good",
    pos: ["Affectionate", "Caring", "Empathetic", "Friendly", "Considerate", "Generous", "Forgiving", "Gracious", "Encouraging", "Cheerful"],
    neg: ["Insensitive", "Inconsiderate", "Rude", "Hostile", "Harsh", "Selfish", "Self-centered", "Envious"] },
  { k: "drive", name: "Drive & energy", type: "The Go-getter", line: "brings energy and pushes for big results",
    pos: ["Ambitious", "Energetic", "Enthusiastic", "Adventurous"], neg: ["Negative", "Pessimistic", "Cynical", "Needy"] },
  { k: "calm", name: "Composure", type: "The Calm Anchor", line: "stays steady and easy to work with under pressure",
    pos: ["Calm", "Easygoing", "Flexible"], neg: ["Moody", "Nervous", "Impatient", "Irrational", "Aggressive", "Suspicious"] },
  { k: "open", name: "Openness", type: "The Explorer", line: "is curious, creative and open to new ways",
    pos: ["Curious", "Creative", "Clever"], neg: ["Inflexible", "Stubborn", "Intolerant", "Judgmental", "Critical"] },
  { k: "int", name: "Integrity", type: "The Principled One", line: "is honest, fair and true to their word",
    pos: ["Authentic", "Genuine", "Fair", "Faithful"], neg: ["Dishonest", "Manipulative", "Greedy", "Superficial"] },
  { k: "lead", name: "Leadership & influence", type: "The Natural Leader", line: "speaks up, decides and brings people along",
    pos: ["Charismatic", "Confident", "Decisive", "Diplomatic", "Expressive", "Brave", "Courageous"],
    neg: ["Overbearing", "Arrogant", "Possessive", "Obnoxious", "Disrespectful"] }
];
function perfTraitsOf(r) { var a = (r && r.answers) || {}; return { pos: Array.isArray(a.traits_pos) ? a.traits_pos : [], neg: Array.isArray(a.traits_neg) ? a.traits_neg : [] }; }
function perfPersonality(box, rows, mine) {
  box.innerHTML = "";
  var withT = rows.filter(function (r) { var t = perfTraitsOf(r); return t.pos.length || t.neg.length; });
  if (!withT.length) {
    box.appendChild(perfEl("div", "perf-empty", (mine ? "Tick your traits in step 2 of your monthly feedback" : "Once they tick their traits in step 2 of their monthly feedback") + " and a personality profile shows here."));
    return;
  }
  var r = withT[0], t = perfTraitsOf(r), prev = withT[1] ? perfTraitsOf(withT[1]) : null;
  var scores = PERF_THEMES.map(function (th) {
    var p = th.pos.filter(function (x) { return t.pos.indexOf(x) >= 0; }), n = th.neg.filter(function (x) { return t.neg.indexOf(x) >= 0; });
    return { th: th, p: p, n: n, score: p.length / th.pos.length - n.length / th.neg.length * 0.8 };
  });
  var ranked = scores.slice().sort(function (a, b) { return b.score - a.score || b.p.length - a.p.length; });
  var top = ranked[0], second = ranked[1];
  var card = perfEl("div", "perf-pcard");
  var head = perfEl("div", "perf-ptop");
  var left = perfEl("div");
  left.appendChild(perfEl("div", "perf-plabel", (mine ? "You see yourself as" : "They see themselves as")));
  left.appendChild(perfEl("div", "perf-ptype", top.p.length ? top.th.type : "Still finding their style"));
  left.appendChild(perfEl("div", "perf-pline", top.p.length
    ? "Someone who " + top.th.line + (second && second.p.length && second.score > 0 ? ", and " + second.th.line + "." : ".")
    : "Few positive traits ticked so far — worth a conversation in the review meeting."));
  var src = (typeof fbLabel === "function" ? fbLabel(r.month) : r.month) + (r.status !== "submitted" ? " (draft)" : "");
  left.appendChild(perfEl("div", "hint", "From the traits ticked in " + src + "."));
  head.appendChild(left);
  /* positive vs negative balance */
  var bal = perfEl("div", "perf-pbal");
  var tot = t.pos.length + t.neg.length, pp = tot ? Math.round(t.pos.length / tot * 100) : 0;
  bal.appendChild(perfEl("div", "n", t.pos.length + " : " + t.neg.length));
  bal.appendChild(perfEl("div", "l", "positive : negative"));
  var bar = perfEl("div", "perf-pbar"), bp = perfEl("i", "p"), bn = perfEl("i", "n");
  bp.style.width = pp + "%"; bn.style.width = (100 - pp) + "%"; bar.append(bp, bn); bal.appendChild(bar);
  head.appendChild(bal);
  card.appendChild(head);
  /* the seven areas */
  var grid = perfEl("div", "perf-pgrid");
  scores.forEach(function (x) {
    var c = perfEl("div", "perf-parea");
    var pct = Math.max(0, Math.min(100, Math.round(50 + x.score * 50)));
    var hd = perfEl("div", "hd"); hd.append(perfEl("b", null, x.th.name), perfEl("span", "sc", x.p.length + "+ / " + x.n.length + "−"));
    var br = perfEl("div", "perf-bar"), fi = perfEl("i"); fi.style.width = (x.p.length || x.n.length ? pct : 0) + "%"; fi.style.background = pct >= 60 ? "#2E9466" : pct >= 40 ? "#D9A030" : "#D9443A"; br.appendChild(fi);
    c.append(hd, br);
    var tags = perfEl("div", "tags");
    x.p.forEach(function (n) { tags.appendChild(perfEl("span", "fb-tr pos on", n)); });
    x.n.forEach(function (n) { tags.appendChild(perfEl("span", "fb-tr neg on", n)); });
    if (!tags.children.length) tags.appendChild(perfEl("span", "hint", "nothing ticked here"));
    c.appendChild(tags);
    grid.appendChild(c);
  });
  card.appendChild(grid);
  /* strengths and things to work on */
  var two = perfEl("div", "perf-ptwo");
  var st = perfEl("div", "perf-pbox pos"); st.appendChild(perfEl("h4", null, "💪 Strengths"));
  var stList = ranked.filter(function (x) { return x.p.length; }).slice(0, 3);
  if (stList.length) stList.forEach(function (x) { st.appendChild(perfEl("div", null, "• " + x.th.name + ": " + x.p.join(", "))); });
  else st.appendChild(perfEl("div", "hint", "None ticked yet."));
  var wk = perfEl("div", "perf-pbox neg"); wk.appendChild(perfEl("h4", null, "🌱 To work on"));
  if (t.neg.length) t.neg.forEach(function (n) {
    var info = typeof FB_TRAIT_INFO !== "undefined" && FB_TRAIT_INFO[n];
    wk.appendChild(perfEl("div", null, "• " + n + (info ? " — " + info[0].charAt(0).toLowerCase() + info[0].slice(1) : "")));
  });
  else wk.appendChild(perfEl("div", "hint", "No negative traits ticked."));
  two.append(st, wk); card.appendChild(two);
  /* what changed since the month before */
  if (prev) {
    var add = t.pos.filter(function (x) { return prev.pos.indexOf(x) < 0; }), lost = prev.pos.filter(function (x) { return t.pos.indexOf(x) < 0; });
    var newNeg = t.neg.filter(function (x) { return prev.neg.indexOf(x) < 0; }), goneNeg = prev.neg.filter(function (x) { return t.neg.indexOf(x) < 0; });
    var ch = perfEl("div", "perf-pchange");
    ch.appendChild(perfEl("b", null, "Since " + (typeof fbLabel === "function" ? fbLabel(withT[1].month, true) : withT[1].month) + ": "));
    var bits = [];
    if (add.length) bits.push("➕ " + add.join(", "));
    if (goneNeg.length) bits.push("✅ no longer " + goneNeg.join(", "));
    if (newNeg.length) bits.push("⚠️ new: " + newNeg.join(", "));
    if (lost.length) bits.push("➖ dropped " + lost.join(", "));
    ch.appendChild(document.createTextNode(bits.length ? bits.join(" · ") : "the same traits as before."));
    card.appendChild(ch);
  }
  box.appendChild(card);
  box.appendChild(perfEl("div", "hint", "A simple self-view, not a psychological test: each area counts the positive traits ticked against the negative ones in it.")).style.marginTop = "8px";
}

/* ---------- 📅 month by month: the last 6 months and their average ---------- */
function perfMonthKeys(n) {
  var d = new Date(), out = [];
  for (var i = 0; i < n; i++) { var x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")); }
  return out;
}
/* OKR progress as of a check-in: the key results it updated, scored against their targets */
function perfCheckinPct(ci, okrs) {
  if (!okrs.cyc) return null;
  var ps = (ci.updates || []).map(function (u) {
    var ob = (okrs.cyc.objectives || []).find(function (o) { return o.id === u.oid; }), kr = ob && (ob.krs || [])[u.k];
    return kr ? krPct(Object.assign({}, kr, { current: Number(u.current) || 0 })) : null;
  }).filter(function (x) { return x != null; });
  return ps.length ? Math.round(ps.reduce(function (a, b) { return a + b; }, 0) / ps.length) : null;
}
function perfMonthly(box, fbRows, ciRows, ag, okrs, mine) {
  var cur = perfMonthKeys(1)[0];
  var liveOkr = okrs.list.length ? Math.round(okrs.list.reduce(function (a, x) { return a + objPct(x.ob); }, 0) / okrs.list.length) : null;
  /* months before their first feedback / first check-in don't count (it didn't exist for them yet) */
  var fbStart = fbRows.map(function (r) { return r.month; }).sort()[0] || cur;
  var ciStart = ciRows.map(function (c) { return String(c.period).slice(0, 7); }).sort()[0] || cur;
  var months = perfMonthKeys(6).filter(function (k) { return k >= PERF_START.slice(0, 7); }).map(function (k) {
    var fb = fbRows.find(function (r) { return r.month === k; }), sentFb = fb && fb.status === "submitted" ? fb : null;
    var cis = ciRows.filter(function (c) { return String(c.period).slice(0, 7) === k; });
    var last = cis.slice().sort(function (a, b) { return String(b.done_at).localeCompare(String(a.done_at)); })[0];
    var okr = last ? perfCheckinPct(last, okrs) : (k === cur ? liveOkr : null);
    var kept = 0, judged = 0;
    ag.groups.forEach(function (g) { g.rows.forEach(function (row) { row.cells.forEach(function (c) {
      if (c.p.now || c.ok == null || c.p.from.slice(0, 7) !== k) return;
      judged++; if (c.ok) kept++;
    }); }); });
    var mood = sentFb && sentFb.answers && +sentFb.answers.mood ? +sentFb.answers.mood : null;
    var support = sentFb && sentFb.answers && +sentFb.answers.support ? +sentFb.answers.support : null;
    return { k: k, now: k === cur, fb: fb, fbOn: k >= fbStart, ciOn: k >= ciStart, sent: !!sentFb, late: !!(sentFb && sentFb.late), reviewed: !!(sentFb && sentFb.discussed_at),
      mood: mood, support: support, ci: cis.length, okr: okr, kept: kept, judged: judged, ag: judged ? Math.round(kept / judged * 100) : null };
  });
  var t = perfEl("div", "perf-mtab");
  var hdr = ["Month", "Feedback", "Mood", "Manager support", "Reviewed", "OKR check-ins", "OKR progress"];
  var hr = perfEl("div", "perf-mrow head"); hdr.forEach(function (h) { hr.appendChild(perfEl("span", null, h)); }); t.appendChild(hr);
  var MOOD = (typeof FB_Q !== "undefined" ? (FB_Q.find(function (q) { return q.k === "mood"; }) || {}).opts : null) || ["1", "2", "3", "4", "5"];
  var pctCell = function (v) { var e = perfEl("span", "pc", v == null ? "—" : v + "%"); if (v != null) e.style.color = scoreColor(v); return e; };
  months.forEach(function (m) {
    var r = perfEl("div", "perf-mrow" + (m.now ? " now" : ""));
    var a = m.k.split("-");
    r.appendChild(perfEl("b", null, new Date(+a[0], +a[1] - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) + (m.now ? " · now" : "")));
    var fbc = perfEl("span", "fbs " + (m.sent ? (m.late ? "late" : "ok") : m.fb ? "draft" : m.fbOn ? "none" : "draft"), m.sent ? (m.late ? "✓ late" : "✓ sent") : m.fb ? "draft" : m.now ? "not yet" : m.fbOn ? "✕ not sent" : "—");
    /* your own month that's open to fill (or still in the late window): a way straight to the form */
    if (mine && !m.sent && typeof fbTargetMonth === "function" && fbTargetMonth() === m.k && typeof fbOpenForm === "function") {
      var go = perfEl("button", "perf-fill", m.fb ? "Finish it →" : "Fill it now →"); go.type = "button"; go.onclick = fbOpenForm;
      fbc.append(document.createTextNode(" "), go);
    }
    r.appendChild(fbc);
    r.appendChild(perfEl("span", "mood", m.mood ? MOOD[m.mood - 1] + " " + m.mood + "/5" : "—"));
    r.appendChild(perfEl("span", null, m.support ? m.support + "/5" : "—"));
    r.appendChild(perfEl("span", null, m.sent ? (m.reviewed ? "✓" : "waiting") : "—"));
    r.appendChild(perfEl("span", null, m.ciOn ? m.ci + " of 2" : "—"));
    r.appendChild(pctCell(m.okr));
    t.appendChild(r);
  });
  /* the average over the months that have something to count (the running month only once it has data) */
  var avg = function (xs) { xs = xs.filter(function (x) { return x != null; }); return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : null; };
  var past = months.filter(function (m) { return !m.now; });
  var fbPast = past.filter(function (m) { return m.fbOn; });
  var sentRate = fbPast.length ? Math.round(fbPast.filter(function (m) { return m.sent; }).length / fbPast.length * 100) : null;
  var onTime = months.filter(function (m) { return m.sent; });
  var moodA = avg(months.map(function (m) { return m.mood; })), supA = avg(months.map(function (m) { return m.support; }));
  var revRate = onTime.length ? Math.round(onTime.filter(function (m) { return m.reviewed; }).length / onTime.length * 100) : null;
  var ciA = avg(past.filter(function (m) { return m.ciOn; }).map(function (m) { return m.ci; }));
  var okrA = avg(months.map(function (m) { return m.okr; }));
  var ar = perfEl("div", "perf-mrow avg");
  ar.appendChild(perfEl("b", null, "Average"));
  ar.appendChild(perfEl("span", null, sentRate == null ? "—" : sentRate + "% sent" + (onTime.length ? " · " + onTime.filter(function (m) { return !m.late; }).length + " on time" : "")));
  ar.appendChild(perfEl("span", "mood", moodA == null ? "—" : MOOD[Math.round(moodA) - 1] + " " + moodA.toFixed(1) + "/5"));
  ar.appendChild(perfEl("span", null, supA == null ? "—" : supA.toFixed(1) + "/5"));
  ar.appendChild(perfEl("span", null, revRate == null ? "—" : revRate + "%"));
  ar.appendChild(perfEl("span", null, ciA == null ? "—" : ciA.toFixed(1) + " of 2"));
  ar.appendChild(pctCell(okrA == null ? null : Math.round(okrA)));
  t.appendChild(ar);
  var wrap = perfEl("div", "perf-mscroll"); wrap.appendChild(t); box.appendChild(wrap);
}
function perfSection(title) {
  var el = perfEl("section", "perf-sec"), h = perfEl("h2", null, title), body = perfEl("div");
  el.append(h, body); return { el: el, body: body };
}

/* ---------- 🎯 OKRs (current cycle) ---------- */
function perfOkrs(u) {
  var cs = (typeof OKRS !== "undefined" && OKRS && OKRS.cycles) || [];
  var cyc = cs.find(function (c) { return c.key === activeCycle; }) || cs[cs.length - 1] || null;
  var em = String(u.email || "").toLowerCase(), list = [];
  var has = function (arr) { return (arr || []).some(function (e) { return String(e || "").toLowerCase() === em; }); };
  if (cyc) (cyc.objectives || []).forEach(function (ob) {
    var own = has(okrOwners(ob)), krs = (ob.krs || []).filter(function (k) { return has(krOwners(k)); });
    if (own || krs.length) list.push({ ob: ob, own: own, krs: krs });
  });
  return { cyc: cyc, list: list };
}
function perfOkrSection(okrs, u, mine) {
  var s = perfSection("🎯 OKRs" + (okrs.cyc ? " · " + (okrs.cyc.name || okrs.cyc.key) : ""));
  /* go to the OKRs, or update your own numbers (the OKR check-in) */
  var acts = perfEl("div", "perf-okracts");
  var see = perfEl("button", "btn", "🎯 See in OKRs →"); see.type = "button";
  see.title = "Open this cycle on the OKRs page" + (mine ? ", filtered to My OKRs" : "");
  see.onclick = function () { closePerformance(); if (okrs.cyc) activeCycle = okrs.cyc.key; if (mine && typeof okrBoardMine !== "undefined") okrBoardMine = true; view = "okr"; renderAll(); window.scrollTo(0, 0); };
  acts.appendChild(see);
  if (mine && typeof okrOpenCheckin === "function") {
    var up = perfEl("button", "btn save", "✏️ Update my OKRs"); up.type = "button";
    up.title = "Type in the current numbers on your key results";
    up.onclick = function () { closePerformance(); okrOpenCheckin(); };
    acts.appendChild(up);
  }
  s.el.querySelector("h2").after(acts);
  s.el.id = "perf-okrs";
  if (!okrs.list.length) { s.body.appendChild(perfEl("div", "perf-empty", "No objectives or key results in this cycle.")); return s.el; }
  var em = String(u.email || "").toLowerCase();
  okrs.list.forEach(function (x) {
    var ob = x.ob, pct = objPct(ob);
    var c = perfEl("div", "perf-card");
    var t = perfEl("div", "perf-row");
    if ((ob.level || "").trim()) t.appendChild(perfEl("span", "perf-lv", ob.level));
    var others = okrOwners(ob).filter(function (e) { return String(e).toLowerCase() !== em; });
    t.appendChild(perfEl("span", "perf-how", x.own ? (others.length ? "Joint owner with " + others.map(okrOwnerName).join(", ") : "Owner") : "Key result owner"));
    var p = perfEl("span", "perf-pct", pct + "%"); p.style.color = scoreColor(pct); t.appendChild(p);
    c.appendChild(t);
    c.appendChild(perfEl("div", "perf-title", ob.title || "Untitled objective"));
    var bar = perfEl("div", "perf-bar"), fi = perfEl("i"); fi.style.width = pct + "%"; fi.style.background = scoreColor(pct); bar.appendChild(fi); c.appendChild(bar);
    var krs = x.own ? (ob.krs || []) : x.krs;
    if (krs.length) {
      var ul = perfEl("ul", "perf-krs");
      krs.forEach(function (k) {
        var kp = krPct(k), li = perfEl("li");
        var v = perfEl("span", "v", fmt(k.current) + " / " + fmt(k.target) + (k.unit ? " " + k.unit : "") + " · " + kp + "%"); v.style.color = scoreColor(kp);
        li.append(perfEl("span", "t", k.title || "Key result"), v); ul.appendChild(li);
      });
      c.appendChild(ul);
    }
    s.body.appendChild(c);
  });
  return s.el;
}

/* ---------- 📝 feedback + the manager's review ---------- */
function perfFeedbackView(box, rows, mine) {
  if (!rows.length) { box.appendChild(perfEl("div", "perf-empty", mine ? "You haven't sent any monthly feedback yet." : "No feedback sent yet (drafts stay private).")); return; }
  rows.forEach(function (r, i) {
    var d = perfEl("details", "fb-hist"), s = perfEl("summary");
    s.appendChild(perfEl("b", null, typeof fbLabel === "function" ? fbLabel(r.month) : r.month));
    if (r.status !== "submitted") s.appendChild(perfEl("span", "fb-chip draft", "draft — not sent"));
    else {
      if (r.late) s.appendChild(perfEl("span", "fb-chip late", "late"));
      s.appendChild(perfEl("span", "fb-chip " + (r.discussed_at ? "submitted" : "talk"), r.discussed_at ? "🤝 reviewed" : "waiting for the review"));
      s.appendChild(perfEl("span", "hint", "sent " + (typeof fbDate === "function" ? fbDate(r.submitted_at) : r.submitted_at)));
    }
    d.appendChild(s);
    var b = perfEl("div", "body");
    if (r.status === "submitted") {
      var mv = typeof fbMeetingView === "function" ? fbMeetingView(r) : null;
      if (mv) { var mh = perfEl("div", "perf-sub", "Manager's review"); b.append(mh, mv); mv.style.margin = "6px 0 16px"; }
      else b.appendChild(perfEl("div", "hint", "No review notes yet.")).style.margin = "10px 0";
    }
    b.appendChild(perfEl("div", "perf-sub", mine ? "Your feedback" : "Their feedback"));
    if (typeof fbAnswersView === "function") b.appendChild(fbAnswersView(r.answers || {}));
    d.appendChild(b);
    if (i === 0) d.open = true;
    box.appendChild(d);
  });
}

/* ---------- 📈 OKR check-ins ---------- */
function perfCheckinView(box, rows) {
  if (!rows.length) { box.appendChild(perfEl("div", "perf-empty", "No check-ins yet. They happen mid-month and at month end.")); return; }
  var t = perfEl("div", "perf-table");
  rows.forEach(function (r) {
    var a = String(r.period).split("-"), mon = new Date(+a[0], +a[1] - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    var row = perfEl("div", "perf-trow");
    row.append(perfEl("b", null, (a[2] === "mid" ? "Mid-" : "End of ") + mon),
      perfEl("span", "hint", "done " + perfShort(r.done_at.slice(0, 10)) + " · " + ((r.updates || []).length) + " key result" + ((r.updates || []).length === 1 ? "" : "s")),
      perfEl("span", "perf-note", r.note || ""));
    t.appendChild(row);
  });
  box.appendChild(t);
}

/* ---------- 🤝 agreements ---------- */
/* is this person part of a space: a member (not just a viewer) or one of its 👑 heads */
function perfInSpace(cs, email) {
  if (!cs || !email) return false;
  var m = cs.members || {};
  if (m[email] && m[email] !== "viewer") return true;
  return (typeof spaceHeadsOf === "function" ? spaceHeadsOf(cs) : []).indexOf(email) >= 0;
}
/* the last N periods that have ended, plus the one running now: [{from, to, now}] (oldest first) */
function perfPeriods(period, n) {
  var out = [], d = new Date(); d.setHours(0, 0, 0, 0);
  var start = function (x) {
    var s = new Date(x);
    if (period === "week") s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    else if (period === "month") s.setDate(1);
    else { s.setDate(1); s.setMonth(Math.floor(s.getMonth() / 3) * 3); }
    return s;
  };
  var cur = start(d);
  for (var i = 0; i <= n; i++) {
    var a = new Date(cur), b = new Date(cur);
    if (period === "week") { a.setDate(a.getDate() - 7 * i); b = new Date(a); b.setDate(b.getDate() + 6); }
    else if (period === "month") { a.setMonth(a.getMonth() - i); b = new Date(a); b.setMonth(b.getMonth() + 1); b.setDate(0); }
    else { a.setMonth(a.getMonth() - 3 * i); b = new Date(a); b.setMonth(b.getMonth() + 3); b.setDate(0); }
    out.unshift({ from: perfISO(a), to: perfISO(b), now: i === 0 });
  }
  out = out.filter(function (p) { return p.now || p.from >= PERF_START; });   /* nothing before the start */
  return out;
}
/* a target's value for one period (null = not known, e.g. Cashfree sales nobody has looked at for that period) */
function perfGoalValue(mk, g, from, to, email) {
  var inP = function (x) { return !!x && x >= from && x <= to; };
  var kids = (CSPACES.list || []).filter(function (x) { return x.parent === mk.id; });
  if (g.source === "hand") { var v = mktAgreement(mk).manual[g.id + ":" + from]; return v == null ? null : Number(v); }
  if (g.source === "cashfree") { var c = mktAgreement(mk).cache["cf:" + from + ":" + to]; return c ? Number(c.v) : null; }
  if (g.source === "proc_out" || g.source === "proc_sent") {
    return kids.filter(function (x) { return x.type === "procdept"; }).flatMap(procEntries)
      .filter(function (i) { return g.source === "proc_sent" ? inP(i.created) : inP(i.stageAt && i.stageAt.rolledout); }).length;
  }
  if (g.source === "posts") {
    return kids.filter(function (x) { return x.type === "social"; }).reduce(function (n, x) {
      var S = (window.SX && SX.normalize) ? SX.normalize(x) : x.sx;
      return n + ((S && S.cards) || []).filter(function (c) { return inP(c.published) || (c.stage === "published" && !c.published && inP(c.scheduled)); }).length;
    }, 0);
  }
  if (g.source === "campaigns") return kids.filter(function (x) { return x.type === "campaign" && x.details && inP(x.details.start); }).length;
  if (g.source === "lms") {   /* "each person": this person's own approved drops */
    return (CSPACES.list || []).reduce(function (n, cs) {
      return n + (cs.lmsSubs || []).filter(function (x) { var d = (x.finalAt || x.at || "").slice(0, 10); return x.status === "approved" && x.by && x.by.email === email && inP(d); }).length;
    }, 0);
  }
  if (g.source === "games") return typeof gameSubsApproved === "function" ? gameSubsApproved(from, to) : null;
  return null;
}
function perfAgreements(u) {
  var email = u.email, groups = [], kept = 0, total = 0;
  var N = { week: 26, month: 6, quarter: 2 };   /* about 6 months, for 📅 Month by month */
  if (typeof mktLoadSnaps === "function") mktLoadSnaps();
  (CSPACES.list || []).filter(function (x) { return x.type === "marketing"; }).forEach(function (mk) {
    var kids = (CSPACES.list || []).filter(function (x) { return x.parent === mk.id; });
    /* who an agreement is on: the 👥 People set on it in Our agreement; a target without any falls back to
       everyone in Marketing (members / 👑 heads of it or the spaces inside it) */
    var A = mktAgreement(mk), rows = [], SO = A.socialOwners || {};
    var inMk = perfInSpace(mk, email) || kids.some(function (k) { return perfInSpace(k, email); });
    var onIt = function (owners) { return owners && owners.length ? owners.indexOf(email) >= 0 : inMk; };
    A.goals.filter(function (g) { return Number(g.target) > 0 && onIt(g.owners); }).forEach(function (g) {
      var cells = perfPeriods(g.period || "month", N[g.period] || 3).map(function (p) {
        var v = perfGoalValue(mk, g, p.from, p.to, email), ok = v == null ? null : v >= Number(g.target);
        if (!p.now && ok != null) { total++; if (ok) kept++; }
        return { p: p, v: v, ok: ok };
      });
      rows.push({ name: g.name + (g.source === "lms" ? " (their own)" : ""), target: g, cells: cells });
    });
    /* Social Media's weekly content agreement, for the social spaces they're in */
    kids.filter(function (x) { return x.type === "social"; }).forEach(function (x) {
      if (typeof mktSlaGaps !== "function") return;
      /* the space's own 🤝 Our agreement says who's on each platform: ⭐ main accountable (judged on every line of
         that platform) or 👥 ticked on some lines (judged on those) */
      var T = (typeof SOCIAL_TARGETS !== "undefined" && SOCIAL_TARGETS[x.id]) || {}, lead = T.lead || {}, who = T.who || {};
      var setUp = ["yt", "ig"].some(function (pl) { return lead[pl] || Object.keys(who).some(function (k) { return k.indexOf(pl + ":") === 0 && (who[k] || []).length; }); });
      if (setUp) {
        [["yt", "YouTube", "subscribers"], ["ig", "Instagram", "followers"]].forEach(function (P) {
          var pl = P[0], main = lead[pl] === email;
          var mine = Object.keys(who).filter(function (k) { return k.indexOf(pl + ":") === 0 && (who[k] || []).indexOf(email) >= 0; }).map(function (k) { return k.slice(pl.length + 1); });
          if (!main && !mine.length) return;
          var labels = mine.map(function (m) { return m === "total" ? P[2] : m === "time" ? "posting time" : ((typeof MKT_SLA_MATCH !== "undefined" && MKT_SLA_MATCH[m]) ? MKT_SLA_MATCH[m].label : m); });
          var mineGap = function (gp) {
            if (gp.indexOf(P[1] + ":") !== 0) return false;
            if (main) return true;
            return labels.some(function (lb) { return lb !== "posting time" && gp.indexOf(" " + lb) >= 0; });
          };
          var cells = perfPeriods("week", 26).map(function (p) {
            var gaps = mktSlaGaps(x, p.from).filter(mineGap), ok = p.now ? (gaps.length ? null : true) : !gaps.length;
            if (!p.now) { total++; if (ok) kept++; }
            return { p: p, gaps: gaps, ok: ok };
          });
          rows.push({ name: x.name + " · " + P[1] + " — " + (main ? "⭐ main accountable" : "👥 " + labels.join(", ")), social: true, cells: cells });
        });
        return;
      }
      if (!(SO[x.id] && SO[x.id].length ? SO[x.id].indexOf(email) >= 0 : perfInSpace(x, email))) return;
      var cells = perfPeriods("week", 26).map(function (p) {
        var gaps = mktSlaGaps(x, p.from), ok = p.now ? (gaps.length ? null : true) : !gaps.length;
        if (!p.now) { total++; if (ok) kept++; }
        return { p: p, gaps: gaps, ok: ok };
      });
      rows.push({ name: x.name + " — weekly content agreement", social: true, cells: cells });
    });
    if (rows.length) groups.push({ mk: mk, rows: rows });
  });
  return { groups: groups, kept: kept, total: total };
}
function perfAgreementView(box, ag, mine) {
  if (!ag.groups.length) { box.appendChild(perfEl("div", "perf-empty", (mine ? "You're" : "They're") + " not part of a Marketing space with an agreement yet.")); return; }
  ag.groups.forEach(function (g) {
    box.appendChild(perfEl("div", "perf-sub", g.mk.name + " → 🤝 Our agreement"));
    var t = perfEl("div", "perf-ag");
    g.rows.forEach(function (row) {
      var r = perfEl("div", "perf-agrow");
      var nm = perfEl("div", "nm", row.name);
      var keptN = row.cells.filter(function (c) { return !c.p.now && c.ok === true; }).length, doneN = row.cells.filter(function (c) { return !c.p.now && c.ok != null; }).length;
      nm.appendChild(perfEl("small", null, doneN ? keptN + " of " + doneN + " kept in the last 6 months" + (row.target ? " · target " + fmt(row.target.target) + " a " + (row.target.period || "month") : "") : "no past periods to judge yet"));
      var cs = perfEl("div", "cells");
      row.cells.slice(-9).forEach(function (c) {
        var dot = perfEl("span", "perf-dot " + (c.p.now ? "now" : c.ok === true ? "ok" : c.ok === false ? "miss" : "unk"));
        dot.textContent = c.p.now ? "…" : c.ok === true ? "✓" : c.ok === false ? "✕" : "?";
        var tip = perfShort(c.p.from) + " – " + perfShort(c.p.to) + (c.p.now ? " (running now)" : "") + ": ";
        if (row.social) tip += c.gaps.length ? c.gaps.join(" · ") : (c.p.now ? "on track so far" : "kept");
        else tip += c.v == null ? "not known" : fmt(c.v) + " of " + fmt(row.target.target) + (c.ok ? " — kept" : c.p.now ? "" : " — missed");
        dot.title = tip;
        cs.appendChild(dot);
      });
      r.append(nm, cs); t.appendChild(r);
    });
    box.appendChild(t);
  });
  box.appendChild(perfEl("div", "hint", "✓ kept · ✕ missed · ? not known · … running now. Hover a mark for the numbers.")).style.marginTop = "8px";
}

/* ---------- top bar button: right of Workspace ---------- */
(function () {
  var tries = 0;
  var t = setInterval(function () {
    tries++; if (tries > 240) { clearInterval(t); return; }
    var ws = document.getElementById("nav-a"); if (!ws) return;
    clearInterval(t);
    if (document.getElementById("nav-perf")) return;
    var b = perfEl("button", "corner-nav ghost", "📈 My Performance"); b.id = "nav-perf";
    b.onclick = openPerformance;
    ws.parentNode.insertBefore(b, ws.nextSibling);
    /* show it only once signed in, like the other buttons */
    setInterval(function () { b.style.display = (typeof currentUser === "function" && currentUser() && ws.style.display !== "none") ? "" : "none"; }, 1000);
  }, 300);
})();

(function () {
  var css = ".perf-pick{border:1px solid var(--line-strong);border-radius:99px;padding:7px 12px;background:var(--card);font:inherit;font-size:13px}"
    + ".perf-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0 8px}"
    + ".perf-tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}"
    + ".perf-tile .n{font-size:26px;font-weight:750;font-family:var(--disp)}.perf-tile .l{font-size:13px;font-weight:600}.perf-tile .s{font-size:12px;color:var(--muted);margin-top:2px}"
    + ".perf-sec{margin:26px 0 0}.perf-sec h2{font-family:var(--disp);font-size:19px;margin:0 0 12px}"
    + ".perf-sub{font-family:var(--mono);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin:12px 0 6px}"
    + ".perf-empty{color:var(--muted);padding:18px;border:1.5px dashed var(--line-strong);border-radius:14px;text-align:center}"
    + ".perf-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 10px}"
    + ".perf-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}"
    + ".perf-lv{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#B4541A;background:#FFF1E8;border-radius:99px;padding:2px 8px}"
    + ".perf-how{color:var(--muted)}.perf-pct{margin-left:auto;font-family:var(--mono);font-weight:700}"
    + ".perf-title{font-weight:700;font-size:14.5px;margin:6px 0 8px}"
    + ".perf-bar{height:6px;border-radius:99px;background:var(--line);overflow:hidden}.perf-bar i{display:block;height:100%}"
    + ".perf-krs{list-style:none;margin:10px 0 0;padding:0}.perf-krs li{display:flex;gap:10px;justify-content:space-between;font-size:13px;padding:5px 0;border-top:1px dashed var(--line)}"
    + ".perf-krs .v{flex:none;font-family:var(--mono);font-size:11.5px;font-weight:600}"
    + ".perf-table{background:var(--card);border:1px solid var(--line);border-radius:12px}"
    + ".perf-trow{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--line)}.perf-trow:first-child{border-top:0}"
    + ".perf-note{color:var(--muted);font-size:13px;flex-basis:100%}.perf-note:empty{display:none}"
    + ".perf-ag{background:var(--card);border:1px solid var(--line);border-radius:12px}"
    + ".perf-agrow{display:flex;align-items:center;gap:14px;padding:10px 14px;border-top:1px solid var(--line);flex-wrap:wrap}.perf-agrow:first-child{border-top:0}"
    + ".perf-agrow .nm{flex:1;min-width:200px;font-weight:600;font-size:13.5px}.perf-agrow .nm small{display:block;font-weight:500;color:var(--muted);font-size:12px}"
    + ".perf-agrow .cells{display:flex;gap:5px;flex-wrap:wrap}"
    + ".perf-dot{width:24px;height:24px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;cursor:help}"
    + ".perf-dot.ok{background:var(--done-bg,#E3F4EA);color:var(--done,#2E9466)}.perf-dot.miss{background:#FDE8E6;color:#B42318}"
    + ".perf-dot.unk{background:#EEF1F5;color:#64748B}.perf-dot.now{background:var(--indigo-soft);color:var(--indigo);border:1px dashed var(--indigo)}"
    + ".perf-mscroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}"
    + ".perf-mtab{min-width:860px}"
    + ".perf-mrow{display:grid;grid-template-columns:1.3fr 1.1fr 1fr 1fr .9fr 1fr 1fr;gap:10px;align-items:center;padding:10px 14px;border-top:1px solid var(--line);font-size:13.5px}"
    + ".perf-mrow.head{border-top:0;font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}"
    + ".perf-mrow.now{background:color-mix(in srgb,var(--indigo) 5%,transparent)}"
    + ".perf-mrow.avg{background:var(--paper);font-weight:700;border-top:2px solid var(--line-strong)}"
    + ".perf-pcard{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px}"
    + ".perf-ptop{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;justify-content:space-between}"
    + ".perf-plabel{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}"
    + ".perf-ptype{font-family:var(--disp);font-size:26px;font-weight:750;margin:2px 0 4px;color:var(--indigo)}"
    + ".perf-pline{font-size:15px;max-width:640px;margin-bottom:4px}"
    + ".perf-pbal{min-width:190px;text-align:right}.perf-pbal .n{font-size:24px;font-weight:750;font-family:var(--disp)}.perf-pbal .l{font-size:12px;color:var(--muted);margin-bottom:6px}"
    + ".perf-pbar{display:flex;height:8px;border-radius:99px;overflow:hidden;background:var(--line)}.perf-pbar .p{background:#2F6DB5}.perf-pbar .n{background:#D9443A}"
    + ".perf-pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin:16px 0}"
    + ".perf-parea{border:1px solid var(--line);border-radius:12px;padding:10px 12px}.perf-parea .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:13.5px}"
    + ".perf-parea .sc{font-family:var(--mono);font-size:11.5px;color:var(--muted)}.perf-parea .tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}"
    + ".perf-parea .fb-tr{padding:2px 8px;border-radius:99px;font-size:11.5px;cursor:default}"
    + ".perf-ptwo{display:grid;grid-template-columns:1fr 1fr;gap:12px}.perf-pbox{border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.6}"
    + ".perf-pbox h4{margin:0 0 6px;font-size:14px}.perf-pbox.pos{background:#EEF4FC}.perf-pbox.neg{background:#FDF1EF}"
    + ".perf-pchange{margin-top:12px;font-size:13.5px;color:var(--ink)}"
    + "@media(max-width:700px){.perf-ptwo{grid-template-columns:1fr}.perf-pbal{text-align:left}}"
    + ".perf-sec h2+.perf-okracts{display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 12px}"
    + ".perf-tile.go{cursor:pointer}.perf-tile.go:hover{border-color:var(--indigo)}"
    + ".perf-fill{border:0;border-radius:99px;background:#E8622B;color:#fff;font:700 11.5px var(--sans,system-ui);padding:4px 10px;cursor:pointer;margin-left:4px;white-space:nowrap}"
    + ".perf-mrow .pc{font-family:var(--mono);font-weight:700}"
    + ".perf-mrow .fbs.ok{color:var(--done,#2E9466)}.perf-mrow .fbs.late{color:#B4541A}.perf-mrow .fbs.none{color:#B42318}.perf-mrow .fbs.draft{color:var(--muted)}"
    + "#nav-perf.on{background:var(--indigo);color:#fff}"
    + "@media(max-width:760px){.perf-tiles{grid-template-columns:repeat(2,1fr)}}";
  var st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st);
})();
