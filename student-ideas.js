/* ================= Student ideas (team side) + idea emails =================
   Students suggest features at tools.dubuddy.in/ideas (ideas/index.html).
   Here, inside the product space (the one product-pitch.js files pitches into):
     * 🎓 From students tab — new ideas wait for approval. Roles with
       "Review student ideas" (review_student_ideas; Owners always):
         Approve  → the idea shows on the public board and lands in All ideas
                    (🎓, Later · Pending) linked to the student's idea;
         Merge    → into an approved idea (its votes move across);
         Reject   → hidden, with an optional reason the student sees.
     * Status sync — moving a linked idea on the roadmap changes what the
       student (or a team member who pitched it) sees:
         Backlog → In review · Primary / Implementation research → Planned ·
         Ready to implement → In progress ·
         Won't do → Not planned · "✅ Shipped" → Completed
       and emails them when it changes (if we have their email); a teammate
       also gets a 🔔 in their bell. Everyone gets a thank-you email right
       after sending an idea (students only if they left an address).
     * ✉️ in the last column of All ideas — write a message (encouragement,
       "not now, keep them coming"…) and email it; for students it can also
       show as the team's reply on the public board.
     * Administration → 💡 My product ideas — everyone sees the status of the
       ideas they pitched (named, or anonymous ones this browser remembers).
   Emails go out through the idea-mail Edge Function (supabase/functions/idea-mail).
   Data: supabase/stage15a_student_ideas.sql. Uses index.html's globals (SUPA,
   TEAM, db, CSPACES, discView, saveDisc, renderAll, hasPerm, currentUser,
   userDisplayName, toast, editMode) and product-pitch.js (pitchTarget).          */
var SID = { rows: [], loaded: false, busy: false, pending: 0, mailing: {} };
var SID_CATS = { "mock-tests": "📝 Mock tests", "college-predictor": "🎓 College predictor", "admissions": "🏛️ Admissions help",
                 "app": "📱 App", "website": "🌐 Website", "other": "✨ Other" };
var SID_STATUS = { review: "In review", planned: "Planned", progress: "In progress", done: "Completed 🎉", declined: "Not planned",
                   pending: "Waiting for approval", rejected: "Rejected", merged: "Merged", waiting: "Sent — on its way to the product team" };
var SID_BOARD_URL = "https://tools.dubuddy.in/ideas";

(function () {
  var css = ""
  + ".sid-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px}"
  + ".sid-head h2{font-size:20px;margin:0}"
  + ".sid-links{display:flex;gap:8px;flex-wrap:wrap}"
  + ".sid-links a,.sid-links button{border:1px solid var(--line-strong);border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600;background:var(--card);color:var(--ink);text-decoration:none}"
  + ".sid-sec{margin:0 0 22px}"
  + ".sid-sec h3{font-size:15px;margin:0 0 10px}"
  + ".sid-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:10px}"
  + ".sid-card .sc-top{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}"
  + ".sid-card .sc-t{font-weight:700;font-size:15px;word-wrap:break-word}"
  + ".sid-card .sc-d{font-size:14px;color:var(--ink);white-space:pre-wrap;word-wrap:break-word;margin-top:4px}"
  + ".sid-card .sc-m{font-size:12.5px;color:var(--muted);margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}"
  + ".sid-card .sc-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;flex:none}"
  + ".sid-card .sc-acts button{font-size:12.5px;font-weight:600;border:1px solid var(--line-strong);border-radius:8px;padding:6px 10px;background:var(--card)}"
  + ".sid-card .sc-acts .ok{background:#1F7A4D;border-color:#1F7A4D;color:#fff}"
  + ".sid-tag{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--paper);border:1px solid var(--line)}"
  + ".sid-st{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:99px}"
  + ".sid-st.review{background:#EEF1F5;color:#5C6A82}.sid-st.planned{background:#F1EAFB;color:#7048B6}.sid-st.progress{background:#FBF1DC;color:#9A6A12}"
  + ".sid-st.done{background:#E3F2EA;color:#1F7A4D}.sid-st.declined,.sid-st.rejected{background:#FBE7E5;color:#B03A34}.sid-st.pending,.sid-st.waiting,.sid-st.merged{background:var(--paper);color:var(--muted);border:1px solid var(--line)}"
  + ".sid-votes{font-weight:700;color:var(--indigo)}"
  + ".sid-empty{padding:22px;text-align:center;color:var(--muted);border:1px dashed var(--line-strong);border-radius:14px}"
  + ".sid-badge{display:inline-flex;gap:4px;align-items:center;font-size:11.5px;font-weight:700;padding:1px 8px;border-radius:99px;background:var(--indigo-soft);color:var(--indigo);margin-top:4px}"
  + ".sid-mail{border:1px solid var(--line-strong);border-radius:8px;padding:4px 8px;font-size:13px;background:var(--card)}"
  + ".sid-mail:hover{border-color:var(--indigo);color:var(--indigo)}"
  + ".sid-box textarea{width:100%;min-height:120px;border:1px solid var(--line-strong);border-radius:12px;padding:11px 13px;font-size:14.5px;background:var(--paper);resize:vertical;margin-top:8px}"
  + ".sid-tpl{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}"
  + ".sid-tpl button{border:1px solid var(--line-strong);border-radius:99px;padding:5px 11px;font-size:12.5px;background:var(--card)}"
  + ".sid-tpl button:hover{border-color:var(--indigo);color:var(--indigo)}"
  + ".sid-to{font-size:13.5px;margin-top:8px;padding:9px 12px;border-radius:10px;background:var(--paper)}"
  + ".sid-chk{display:flex;gap:8px;align-items:center;font-size:13.5px;margin-top:10px;cursor:pointer}"
  + ".sid-hist{margin-top:12px;font-size:13px}"
  + ".sid-hist div{padding:6px 0;border-top:1px solid var(--line);white-space:pre-wrap}"
  + ".sid-my{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:10px}"
  + ".sid-my .mt{font-weight:600;white-space:pre-wrap;word-wrap:break-word}"
  + ".sid-my .mm{font-size:12.5px;color:var(--muted);margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}"
  + ".sid-my .msg{margin-top:8px;padding:8px 10px;border-radius:9px;background:var(--indigo-soft);font-size:13.5px;white-space:pre-wrap}"
  + "@media (max-width:640px){.sid-card .sc-top{flex-direction:column}}";
  var st = document.createElement("style"); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();
function sidEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function sidWhen(ts) {
  var s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  if (s < 86400 * 14) return Math.floor(s / 86400) + " days ago";
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function sidCanReview() { try { return hasPerm("review_student_ideas"); } catch (_) { return false; } }
function sidCanSee() { return !!SUPA && (sidCanReview() || hasPerm("edit")); }
function sidIsTarget(cs) { return typeof pitchTarget === "function" && pitchTarget() === cs; }

/* what students / the pitcher see, from where the idea sits on the roadmap */
function sidStatusOf(idea) {
  if (idea.shipped) return "done";
  return ({ ready: "progress", implres: "planned", primary: "planned", backlog: "review",
           now: "progress", next: "planned", later: "review", wont: "declined" })[idea.stage] || "review";
}
function sidLinked(idea) { return !!(idea && (idea.student || (idea.pitch && idea.pitch.id && !idea.pitch.anonymous))); }

/* ---------- data ---------- */
async function sidLoad() {
  if (!sidCanSee()) return;
  var r = await SUPA.from("student_ideas").select("*").eq("team_slug", TEAM).order("created_at", { ascending: false }).limit(500);
  if (r.error) return;
  SID.rows = r.data || []; SID.loaded = true;
  SID.pending = SID.rows.filter(function (x) { return x.status === "pending"; }).length;
  /* keep the vote counts on linked product ideas fresh (shown as a badge) */
  (CSPACES.list || []).forEach(function (cs) {
    (cs.ideas || []).forEach(function (i) {
      if (!i.student) return;
      var row = SID.rows.find(function (x) { return x.id === i.student.id; });
      if (row) i.student.votes = row.votes;
    });
  });
}
async function sidBoot() {
  if (!db || !sidCanSee()) return;
  await sidLoad();
  if (SID.pending && sidCanReview()) toast("🎓 " + SID.pending + " new student idea" + (SID.pending > 1 ? "s" : "") + " waiting — Product space → From students");
  try { renderAll(); } catch (_) { }
}

/* ---------- emails (idea-mail Edge Function) ---------- */
async function sidMail(body) {
  try {
    var r = await SUPA.functions.invoke("idea-mail", { body: Object.assign({ team: TEAM }, body) });
    if (r.error) return { sent: false, reason: r.error.message || "couldn't send" };
    return r.data || { sent: false };
  } catch (e) { return { sent: false, reason: (e && e.message) || "couldn't send" }; }
}
function sidTarget(idea) {
  if (idea.student) return { kind: "student", id: idea.student.id };
  if (idea.pitch && idea.pitch.id && !idea.pitch.anonymous) return { kind: "pitch", id: idea.pitch.id };
  return null;
}

/* ---------- status sync (index.html's saveDisc calls this) ---------- */
function ideaStatusSync() {
  if (!SUPA || !db) return;
  (CSPACES.list || []).forEach(function (cs) {
    if (cs.type !== "discovery") return;
    (cs.ideas || []).forEach(function (idea) {
      if (!sidLinked(idea)) return;
      var now = sidStatusOf(idea);
      if (!idea.syncedStatus) { idea.syncedStatus = now; return; }   /* first sight: remember, don't email */
      if (idea.syncedStatus === now) return;
      idea.syncedStatus = now;
      var t = sidTarget(idea);
      if (idea.student) SUPA.rpc("student_idea_set", { p_id: idea.student.id, p_action: "status", p_value: now }).then(function () { });
      sidMail({ action: "status", kind: t.kind, id: t.id, status: now }).then(function (r) {
        if (r && r.sent) toast("✉️ Told " + (idea.student ? "the student" : "them") + " it's now “" + SID_STATUS[now].replace(" 🎉", "") + "”");
      });
    });
  });
}

/* ---------- 🎓 From students tab ---------- */
function sidTabLabel() { return "🎓 From students" + (SID.pending ? " (" + SID.pending + ")" : ""); }
function sidPane(cs) {
  var wrap = document.getElementById("content");
  var block = sidEl("section", "module-block");
  var head = sidEl("div", "sid-head"), left = sidEl("div");
  left.append(sidEl("h2", "", "🎓 From students"),
              sidEl("div", "hint", "Ideas students send from the public board. Nothing shows publicly until it's approved. Approved ideas land in All ideas — move them on the roadmap and students see the status change."));
  var links = sidEl("div", "sid-links");
  var a = sidEl("a", "", "Open the public board ↗"); a.href = SID_BOARD_URL; a.target = "_blank"; a.rel = "noopener";
  var cp = sidEl("button", "", "Copy link"); cp.type = "button";
  cp.onclick = function () { try { navigator.clipboard.writeText(SID_BOARD_URL); toast("Link copied — share it on the app and website"); } catch (_) { toast(SID_BOARD_URL); } };
  links.append(a, cp);
  head.append(left, links); block.appendChild(head);
  var body = sidEl("div", "", "Loading…"); body.className = "hint"; block.appendChild(body);
  wrap.appendChild(block);
  sidLoad().then(function () { sidDrawPane(cs, body); });
}
function sidDrawPane(cs, body) {
  body.className = ""; body.innerHTML = "";
  var rev = sidCanReview();
  var pend = SID.rows.filter(function (x) { return x.status === "pending"; });
  var live = SID.rows.filter(function (x) { return ["review", "planned", "progress", "done", "declined"].indexOf(x.status) >= 0; });
  var gone = SID.rows.filter(function (x) { return x.status === "rejected" || x.status === "merged"; });
  function sec(title) { var s = sidEl("div", "sid-sec"); s.appendChild(sidEl("h3", "", title)); body.appendChild(s); return s; }
  var s1 = sec("Waiting for approval (" + pend.length + ")");
  if (!pend.length) s1.appendChild(sidEl("div", "sid-empty", "All caught up ✨ New ideas from students show up here."));
  if (!rev && pend.length) s1.appendChild(sidEl("div", "hint", "Only people whose role has “Review student ideas” can approve. Ask an owner to tick it for you."));
  pend.forEach(function (x) { s1.appendChild(sidCard(cs, x, rev ? "pending" : "view")); });
  var s2 = sec("On the board (" + live.length + ")");
  if (!live.length) s2.appendChild(sidEl("div", "sid-empty", "Approved ideas show here with their votes."));
  live.sort(function (a, b) { return b.votes - a.votes; }).forEach(function (x) { s2.appendChild(sidCard(cs, x, "live")); });
  if (gone.length) {
    var d = document.createElement("details"); d.className = "sid-sec";
    d.appendChild(sidEl("summary", "", "Rejected or merged (" + gone.length + ")"));
    gone.forEach(function (x) { d.appendChild(sidCard(cs, x, "view")); });
    body.appendChild(d);
  }
}
function sidCard(cs, x, mode) {
  var c = sidEl("div", "sid-card"), top = sidEl("div", "sc-top"), info = sidEl("div");
  info.appendChild(sidEl("div", "sc-t", x.title));
  if (x.details) info.appendChild(sidEl("div", "sc-d", x.details));
  var m = sidEl("div", "sc-m");
  m.append(sidEl("span", "sid-st " + x.status, SID_STATUS[x.status] || x.status), sidEl("span", "sid-tag", SID_CATS[x.category] || x.category));
  if (mode !== "pending") m.appendChild(sidEl("span", "sid-votes", "▲ " + x.votes));
  m.appendChild(sidEl("span", "", (x.name ? x.name : "No name") + (x.email ? " · " + x.email : " · no email") + " · " + sidWhen(x.created_at)));
  info.appendChild(m);
  if (x.reply) { var rp = sidEl("div", "sc-d"); rp.style.cssText = "margin-top:8px;padding:8px 10px;border-radius:9px;background:var(--indigo-soft)"; rp.textContent = "💬 " + x.reply; info.appendChild(rp); }
  var acts = sidEl("div", "sc-acts");
  function btn(t, cls, f) { var b = sidEl("button", cls || "", t); b.type = "button"; b.onclick = f; acts.appendChild(b); return b; }
  if (mode === "pending") {
    btn("✅ Approve", "ok", function () { sidApprove(cs, x); });
    var live = SID.rows.filter(function (y) { return y.id !== x.id && ["review", "planned", "progress", "done", "declined"].indexOf(y.status) >= 0; });
    if (live.length) btn("🔗 Merge into…", "", function () { sidMerge(cs, x, live); });
    btn("✕ Reject", "", function () { sidReject(cs, x); });
  } else if (mode === "live") {
    var idea = (cs.ideas || []).find(function (i) { return i.student && i.student.id === x.id; });
    if (idea) {
      btn("✉️ Message", "", function () { sidCompose(cs, idea); });
      btn("Open in All ideas", "", function () { discView = "ideas"; renderAll(); });
    }
  }
  top.append(info, acts); c.appendChild(top);
  return c;
}
async function sidApprove(cs, x) {
  var idea = { id: "idea-" + Math.random().toString(36).slice(2, 9), title: "🎓 " + x.title,
               note: (x.details ? x.details + "\n\n" : "") + "🎓 Student idea · " + (x.name || "no name") + " · " + (SID_CATS[x.category] || x.category),
               stage: "backlog", state: "Pending", student: { id: x.id, votes: x.votes || 0, hasEmail: !!x.email }, syncedStatus: "review" };
  if (typeof discStatusOf === "function") idea.status = discStatusOf(idea.state);
  var r = await SUPA.rpc("student_idea_set", { p_id: x.id, p_action: "approve", p_space: cs.id, p_ref: idea.id });
  if (r.error) { toast("Couldn't approve: " + r.error.message); return; }
  cs.ideas = cs.ideas || []; cs.ideas.push(idea);
  saveDisc();
  toast("✅ Approved — it's on the public board and in All ideas");
  if (x.email) sidMail({ action: "approved", kind: "student", id: x.id });
}
function sidMerge(cs, x, live) {
  var pickBox = sidModal("🔗 Merge into which idea?", "The student's vote moves to the idea you pick, and their idea is hidden.");
  live.forEach(function (y) {
    var b = sidEl("button", "sid-mail", "▲ " + y.votes + "  " + y.title); b.type = "button";
    b.style.cssText = "display:block;width:100%;text-align:left;margin-top:8px;padding:10px 12px";
    b.onclick = async function () {
      var r = await SUPA.rpc("student_idea_set", { p_id: x.id, p_action: "merge", p_value: y.id });
      if (r.error) { toast(r.error.message); return; }
      pickBox.close(); toast("🔗 Merged"); await sidLoad(); renderAll();
    };
    pickBox.box.insertBefore(b, pickBox.acts);
  });
}
function sidReject(cs, x) {
  var m = sidModal("✕ Reject this idea?", "It stays hidden from the board. You can tell the student why — they see it under “Your ideas”" + (x.email ? " and get it by email." : "."));
  var ta = document.createElement("textarea"); ta.className = ""; ta.placeholder = "Optional, kind reason — e.g. “We already have this in the Mock tests section — try Settings → Topics 🙂”";
  ta.style.cssText = "width:100%;min-height:90px;margin-top:10px;border:1px solid var(--line-strong);border-radius:12px;padding:10px 12px;background:var(--paper)";
  m.box.insertBefore(ta, m.acts);
  var go = sidEl("button", "ntf-btn primary", "Reject"); go.type = "button";
  go.onclick = async function () {
    var r = await SUPA.rpc("student_idea_set", { p_id: x.id, p_action: "reject", p_value: ta.value });
    if (r.error) { toast(r.error.message); return; }
    if (x.email && ta.value.trim()) sidMail({ action: "message", kind: "student", id: x.id, message: ta.value.trim(), status: "declined" });
    m.close(); toast("Rejected"); await sidLoad(); renderAll();
  };
  m.acts.appendChild(go);
}
function sidModal(title, sub) {
  var bg = sidEl("div", "ntf-pop-bg"), box = sidEl("div", "ntf-pop sid-box");
  box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  box.append(sidEl("h3", "", title));
  if (sub) box.appendChild(sidEl("div", "np-b", sub));
  var acts = sidEl("div", "np-a"), cancel = sidEl("button", "ntf-btn", "Cancel"); cancel.type = "button";
  function close() { bg.remove(); }
  cancel.onclick = close; acts.appendChild(cancel); box.appendChild(acts);
  bg.appendChild(box); bg.onclick = function (e) { if (e.target === bg) close(); };
  document.body.appendChild(bg);
  return { box: box, acts: acts, close: close };
}

/* ---------- ✉️ message + email (last column of All ideas) ---------- */
function sidMailButton(cs, idea) {
  if (!sidLinked(idea) && !(idea.pitch && idea.pitch.anonymous)) return null;
  var b = sidEl("button", "sid-mail", "✉️"); b.type = "button";
  b.title = idea.pitch && idea.pitch.anonymous ? "Pitched anonymously — no one to email" : "Write to the person who suggested this";
  if (idea.pitch && idea.pitch.anonymous) b.disabled = true;
  b.onclick = function (e) { e.stopPropagation(); sidCompose(cs, idea); };
  return b;
}
function sidBadge(idea) {
  if (idea.student) return sidEl("span", "sid-badge", "🎓 Student · ▲ " + (idea.student.votes || 0));
  if (idea.pitch) return sidEl("span", "sid-badge", idea.pitch.anonymous ? "💡 Team pitch · anonymous" : "💡 Pitched by " + (idea.pitch.by || "a teammate"));
  return null;
}
async function sidCompose(cs, idea) {
  var t = sidTarget(idea); if (!t) return;
  var m = sidModal("✉️ Write to " + (idea.student ? "the student" : "the teammate"), "Encourage them, tell them what's happening, or that it's not for now — keep them sending ideas.");
  var to = sidEl("div", "sid-to", "Finding their email…"); m.box.insertBefore(to, m.acts);
  var tpl = sidEl("div", "sid-tpl"); m.box.insertBefore(tpl, m.acts);
  var ta = document.createElement("textarea"); m.box.insertBefore(ta, m.acts);
  ta.placeholder = "Write your message…";
  var T = [["🙏 Thanks", "Thank you for this idea! The team loved reading it — we're looking at it now. Keep them coming 🙌"],
           ["⏳ Not now", "Thanks so much for sharing this! It's not on our plan right now, but we've saved it and may come back to it later. Please keep sending ideas — they really help us."],
           ["🗓 Planned", "Great news — your idea is now on our plan! We'll let you know when we start building it."],
           ["🚀 Building", "We've started working on your idea! Thanks for helping make DU Buddy better."],
           ["✅ Shipped", "It's live! Your idea is now part of DU Buddy — thank you for making it better for everyone 🎉"]];
  T.forEach(function (x) { var b = sidEl("button", "", x[0]); b.type = "button"; b.onclick = function () { ta.value = x[1]; ta.focus(); }; tpl.appendChild(b); });
  var pub = null;
  if (idea.student) {
    var l = sidEl("label", "sid-chk"); pub = document.createElement("input"); pub.type = "checkbox"; pub.checked = true;
    l.append(pub, document.createTextNode("Also show it as the team's reply on the public board")); m.box.insertBefore(l, m.acts);
  }
  var shipL = sidEl("label", "sid-chk"), ship = document.createElement("input"); ship.type = "checkbox"; ship.checked = !!idea.shipped;
  shipL.append(ship, document.createTextNode("✅ This idea has shipped (shows “Completed”)")); m.box.insertBefore(shipL, m.acts);
  if ((idea.messages || []).length) {
    var h = sidEl("div", "sid-hist"); h.appendChild(sidEl("b", "", "Sent before"));
    idea.messages.slice().reverse().forEach(function (x) { h.appendChild(sidEl("div", "", sidWhen(x.at) + " · " + (x.by || "") + (x.emailed ? " · ✉️ emailed" : "") + "\n" + x.text)); });
    m.box.insertBefore(h, m.acts);
  }
  var send = sidEl("button", "ntf-btn primary", "Send ✉️"); send.type = "button"; m.acts.appendChild(send);
  var hasEmail = false;
  SUPA.rpc("idea_mail_target", { p_kind: t.kind, p_id: t.id }).then(function (r) {
    var row = (r.data || [])[0];
    hasEmail = !!(row && row.email);
    to.textContent = hasEmail ? "To: " + (row.name || "them") + " · " + row.email : (idea.student ? "This student didn't leave an email — your message can still show as the team's reply on the public board." : "No email found for them.");
    if (!hasEmail && !idea.student) send.disabled = true;
    send.textContent = hasEmail ? "Send ✉️" : "Save reply";
  });
  send.onclick = async function () {
    var text = ta.value.trim();
    if (!text && ship.checked === !!idea.shipped) { ta.focus(); return; }
    send.disabled = true; send.textContent = "Sending…";
    var shippedNow = ship.checked && !idea.shipped;
    idea.shipped = ship.checked;
    var emailed = false;
    if (text) {
      if (idea.student && pub && pub.checked) await SUPA.rpc("student_idea_set", { p_id: t.id, p_action: "reply", p_value: text });
      if (hasEmail) { var r = await sidMail({ action: "message", kind: t.kind, id: t.id, message: text, status: shippedNow ? "done" : sidStatusOf(idea) }); emailed = !!(r && r.sent); if (!emailed) toast("Saved, but the email didn't go: " + ((r && r.reason) || "unknown")); }
      idea.messages = idea.messages || [];
      idea.messages.push({ at: new Date().toISOString(), by: (currentUser() && userDisplayName(currentUser())) || "", text: text, emailed: emailed });
      idea.comments = idea.comments || [];
      idea.comments.push({ id: "c" + Date.now().toString(36), who: ((currentUser() && userDisplayName(currentUser())) || "Team") + (emailed ? " (✉️ emailed)" : ""), text: text, at: Date.now() });
    }
    if (shippedNow && text) idea.syncedStatus = "done";        /* the message already told them */
    m.close();
    saveDisc();
    if (text) toast(emailed ? "✉️ Sent" : "💬 Saved");
  };
  setTimeout(function () { ta.focus(); }, 40);
}

/* ---------- Administration → 💡 My product ideas ---------- */
function sidMyIds() { try { return JSON.parse(localStorage.getItem("dub-my-pitches") || "[]"); } catch (_) { return []; } }
function sidRememberPitch(id) { try { var a = sidMyIds(); a.unshift(id); localStorage.setItem("dub-my-pitches", JSON.stringify(a.slice(0, 100))); } catch (_) { } }
function renderAdminMyIdeas(wrap) {
  var head = sidEl("div", "admin-userhead"), left = sidEl("div");
  var h2 = sidEl("h2", "", "💡 My product ideas"); h2.style.margin = "0";
  var sub = sidEl("div", "hint", "Ideas you pitched to the product team (from Social Media → Ideation). See where each one is — and any message the team sent you.");
  sub.style.marginTop = "4px"; left.append(h2, sub); head.appendChild(left);
  if (typeof pitchOpen === "function") { var nb = sidEl("button", "btn save admin-invite-btn", "💡 Pitch an idea"); nb.onclick = function () { pitchOpen(); }; head.appendChild(nb); }
  wrap.appendChild(head);
  var holder = sidEl("div", "hint", "Loading…"); wrap.appendChild(holder);
  SUPA.rpc("my_pitches", { p_team: TEAM, p_ids: sidMyIds() }).then(function (r) {
    holder.className = ""; holder.innerHTML = "";
    var rows = r.data || [];
    if (r.error) { holder.className = "hint"; holder.textContent = "Couldn't load: " + r.error.message; return; }
    if (!rows.length) { holder.appendChild(sidEl("div", "sid-empty", "No ideas yet. Got one that makes a student's life better? Pitch it! 🚀")); return; }
    rows.forEach(function (p) {
      var idea = null;
      (CSPACES.list || []).forEach(function (cs) { (cs.ideas || []).forEach(function (i) { if (i.id === p.idea_ref || (i.pitch && i.pitch.id === p.id)) idea = i; }); });
      var st = !p.claimed ? "waiting" : idea ? sidStatusOf(idea) : "review";
      var c = sidEl("div", "sid-my");
      c.appendChild(sidEl("div", "mt", p.body));
      var mm = sidEl("div", "mm");
      mm.append(sidEl("span", "sid-st " + st, SID_STATUS[st]), sidEl("span", "", (p.anonymous ? "🤫 Sent anonymously (only you can see this, on this browser)" : "🙋 With your name") + " · " + sidWhen(p.created_at)));
      c.appendChild(mm);
      if (idea && !p.anonymous) (idea.messages || []).forEach(function (x) { c.appendChild(sidEl("div", "msg", "💬 " + x.text)); });
      holder.appendChild(c);
    });
  });
}

/* ---------- Administration → ✉️ Idea emails: the words of every idea email ----------
   One card per moment (thank-you, approved, each status, your ✉️ messages),
   for students and for teammates: switch it on/off, edit subject + text, send
   yourself a test, reset to the default. Saved in idea_email_templates
   (supabase/stage15c_idea_email_templates.sql); the idea-mail function uses
   them when it sends and gives us its built-in defaults.                       */
var SID_MAIL_KEYS = [
  ["thanks",   "🙏 Thank you", "Right after they send an idea"],
  ["approved", "🙌 Approved", "Their idea goes on the public board (students only)"],
  ["review",   "👀 In review", "Idea in the Later column"],
  ["planned",  "🗓 Planned", "Idea moved to Next"],
  ["progress", "🚀 In progress", "Idea moved to Now"],
  ["done",     "🎉 Completed", "Ticked “shipped”"],
  ["declined", "🙏 Not planned", "Idea moved to Won't do"],
  ["message",  "💬 Your messages", "Wraps what you write with ✉️ — keep {message} in it"]
];
var SID_MAILUI = { aud: "student", defaults: null, saved: {} };
async function renderAdminIdeaEmails(wrap) {
  var head = sidEl("div", "admin-userhead"), left = sidEl("div");
  var h2 = sidEl("h2", "", "✉️ Idea emails"); h2.style.margin = "0";
  var sub = sidEl("div", "hint", "What people get by email at each step of their idea. Switch any email off, change the words, and send yourself a test. Placeholders: {name} {idea} {status} {link} {message}. A “See it on the board” / “Open the team app” button is added at the end.");
  sub.style.marginTop = "4px"; left.append(h2, sub); head.appendChild(left); wrap.appendChild(head);
  var seg = sidEl("div", "ntf-seg"), bS = sidEl("button", "", "🎓 Students"), bT = sidEl("button", "", "💡 Teammates");
  bS.type = bT.type = "button"; seg.append(bS, bT);
  var segRow = sidEl("div", "ntf-row"); segRow.appendChild(seg); wrap.appendChild(segRow);
  var holder = sidEl("div", "hint", "Loading…"); wrap.appendChild(holder);
  bS.onclick = function () { SID_MAILUI.aud = "student"; draw(); };
  bT.onclick = function () { SID_MAILUI.aud = "team"; draw(); };
  if (!SID_MAILUI.defaults) {
    try {
      var d = await SUPA.functions.invoke("idea-mail", { body: { action: "defaults" } });
      SID_MAILUI.defaults = (d.data && d.data.defaults) || null;
    } catch (_) { }
  }
  var rs = await SUPA.from("idea_email_templates").select("*").eq("team_slug", TEAM);
  SID_MAILUI.saved = {};
  (rs.data || []).forEach(function (r) { SID_MAILUI.saved[r.audience + ":" + r.key] = r; });
  if (!SID_MAILUI.defaults) { holder.textContent = "Couldn't reach the email service. Reload and try again."; return; }
  draw();
  function draw() {
    bS.className = SID_MAILUI.aud === "student" ? "on" : ""; bT.className = SID_MAILUI.aud === "team" ? "on" : "";
    holder.className = ""; holder.innerHTML = "";
    var aud = SID_MAILUI.aud, D = SID_MAILUI.defaults[aud] || {};
    SID_MAIL_KEYS.forEach(function (k) {
      if (!D[k[0]]) return;                                   /* "approved" is for students only */
      holder.appendChild(sidMailCard(aud, k, D[k[0]], SID_MAILUI.saved[aud + ":" + k[0]]));
    });
  }
}
function sidMailCard(aud, k, def, saved) {
  var cur = saved || { enabled: true, subject: def.subject, body: def.body };
  var c = sidEl("div", "ntf-card"); c.style.marginBottom = "14px";
  var top = sidEl("div", "ntf-row"); top.style.cssText = "justify-content:space-between;margin-bottom:6px";
  var tl = sidEl("div"); tl.append(sidEl("div", "sc-t", k[1]), sidEl("div", "hint", k[2]));
  tl.firstChild.style.cssText = "font-weight:700;font-size:15.5px";
  var tg = sidEl("label", "sid-chk"), on = document.createElement("input"); on.type = "checkbox"; on.checked = cur.enabled !== false;
  tg.style.marginTop = "0"; tg.append(on, document.createTextNode("Send this email"));
  top.append(tl, tg); c.appendChild(top);
  var state = sidEl("span", "sid-tag", saved ? "✏️ Edited" : "Default"); c.appendChild(state);
  var subj = document.createElement("input"); subj.type = "text"; subj.maxLength = 200; subj.value = cur.subject;
  var body = document.createElement("textarea"); body.maxLength = 5000; body.value = cur.body; body.style.minHeight = "150px";
  c.append(sidEl("label", "ntf-lab", "Subject"), subj, sidEl("label", "ntf-lab", "Text"), body);
  function lock() { subj.disabled = body.disabled = !on.checked; }
  on.onchange = lock; lock();
  var msg = sidEl("div", "ntf-err"); c.appendChild(msg);
  var row = sidEl("div", "ntf-row"); row.style.cssText = "justify-content:flex-end;margin:0;gap:8px";
  var reset = sidEl("button", "ntf-btn", "Reset to default"), test = sidEl("button", "ntf-btn", "📨 Send me a test"), save = sidEl("button", "ntf-btn primary", "Save");
  reset.type = test.type = save.type = "button";
  row.append(reset, test, save); c.appendChild(row);
  function check() {
    if (!subj.value.trim() || !body.value.trim()) { msg.textContent = "Subject and text can't be empty."; return false; }
    if (k[0] === "message" && body.value.indexOf("{message}") < 0) { msg.textContent = "Keep {message} in the text — that's where what you write goes."; return false; }
    msg.textContent = ""; return true;
  }
  save.onclick = async function () {
    if (!check()) return;
    save.disabled = true;
    var r = await SUPA.from("idea_email_templates").upsert({ team_slug: TEAM, key: k[0], audience: aud, enabled: on.checked, subject: subj.value.trim(), body: body.value.trim(), updated_at: new Date().toISOString() });
    save.disabled = false;
    if (r.error) { msg.textContent = "Couldn't save: " + r.error.message; return; }
    SID_MAILUI.saved[aud + ":" + k[0]] = { enabled: on.checked, subject: subj.value.trim(), body: body.value.trim() };
    state.textContent = "✏️ Edited"; toast(on.checked ? "✉️ Saved" : "🔕 This email is switched off");
  };
  reset.onclick = function () { subj.value = def.subject; body.value = def.body; on.checked = true; lock(); msg.textContent = "Back to the default words — press Save to keep them."; };
  test.onclick = async function () {
    if (!check()) return;
    test.disabled = true; test.textContent = "Sending…";
    var r;
    try { r = await SUPA.functions.invoke("idea-mail", { body: { action: "test", team: TEAM, audience: aud, subject: subj.value, body: body.value } }); } catch (e) { r = { error: e }; }
    test.disabled = false; test.textContent = "📨 Send me a test";
    var d = r && r.data;
    if (d && d.sent) toast("📨 Test sent to " + d.to);
    else msg.textContent = "Test didn't go: " + ((d && d.reason) || (r && r.error && r.error.message) || "unknown");
  };
  return c;
}
