/* ================= "Pitch a product idea" =================
   A small challenge card at the bottom of Social Media → Ideation:
   "You're full of content ideas — got one that makes a student's life
   better?" Anyone in the team writes it (messy is fine) and sends it
   anonymously or with their name.
     * Sent through submit_product_pitch() (supabase/stage14a_product_pitches.sql).
       Anonymous pitches are stored with no user and no name at all.
     * Whenever someone who can edit opens the app, pitchImport() takes the
       new pitches (claim_product_pitches, each exactly once) and files them
       into the product space's "All ideas" (the first Product roadmap space
       whose name says "product"), credited or marked Anonymous.
   The sender's browser remembers the pitch id (student-ideas.js →
   Administration → My product ideas), so even anonymous pitches can be
   followed by the person who sent them — and nobody else.
   Uses index.html's globals (SUPA, TEAM, db, CSPACES, discoverySpaces,
   saveDisc, hasPerm, currentUser, toast) and notifications.js's pop-up
   styles (.ntf-pop).                                                        */
(function () {
  var css = ""
  + ".pp-card{display:flex;gap:16px;align-items:center;margin:8px 0 24px;padding:18px 20px;border-radius:16px;border:1.5px dashed #E8B89A;background:linear-gradient(120deg,#FFFDF9,#FFF1E6)}"
  + ".pp-card .pp-i{font-size:34px;flex:none}"
  + ".pp-card .pp-t{font-weight:700;font-size:16.5px;line-height:1.3}"
  + ".pp-card .pp-s{font-size:13.5px;color:#6B6058;margin-top:3px;line-height:1.45}"
  + ".pp-card .pp-go{margin-left:auto;flex:none;background:var(--indigo);color:#fff;font-weight:700;font-size:14px;border-radius:99px;padding:10px 18px;box-shadow:0 3px 10px rgba(232,98,43,.25)}"
  + ".pp-card .pp-go:hover{background:#C9501F}"
  + ".pp-box textarea{width:100%;min-height:150px;border:1px solid var(--line-strong);border-radius:12px;padding:12px 14px;font-size:15px;line-height:1.5;background:var(--paper);resize:vertical;margin-top:12px}"
  + ".pp-choices{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}"
  + ".pp-choice{border:1.5px solid var(--line-strong);border-radius:14px;padding:12px 14px;text-align:left;background:var(--card)}"
  + ".pp-choice:hover:not(:disabled){border-color:var(--indigo);background:var(--indigo-soft)}"
  + ".pp-choice:disabled{opacity:.5;cursor:default}"
  + ".pp-choice b{display:block;font-size:14.5px}"
  + ".pp-choice span{display:block;font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.4}"
  + ".pp-done{text-align:center;padding:10px 0 4px}"
  + ".pp-done .pd-big{font-size:42px}"
  + ".pp-done .pd-t{font-size:19px;font-weight:700;margin-top:6px}"
  + ".pp-done .pd-s{font-size:14px;color:var(--muted);margin-top:4px}"
  + "@media (max-width:640px){.pp-card{flex-direction:column;align-items:flex-start}.pp-card .pp-go{margin-left:0}.pp-choices{grid-template-columns:1fr}}";
  var st = document.createElement("style"); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();

function ppEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

/* the product space pitches land in */
function pitchTarget() {
  var ds = (typeof discoverySpaces === "function") ? discoverySpaces() : [];
  return ds.find(function (d) { return /product/i.test(d.name || ""); }) || ds[0] || null;
}

/* the challenge card (index.html adds it under Social Media → Ideation) */
function pitchCard(wrap) {
  if (!wrap || !SUPA || !currentUser() || !pitchTarget()) return;
  var c = ppEl("div", "pp-card");
  var txt = ppEl("div");
  txt.append(ppEl("div", "pp-t", "You're full of content ideas 🔥 Got one for the product too?"),
             ppEl("div", "pp-s", "Something that solves a student's problem for good, or makes our app or website more helpful. Half-baked is welcome — just write it down."));
  var go = ppEl("button", "pp-go", "💡 Pitch an idea"); go.type = "button";
  go.onclick = pitchOpen;
  c.append(ppEl("span", "pp-i", "🚀"), txt, go);
  wrap.appendChild(c);
}

function pitchOpen() {
  var bg = ppEl("div", "ntf-pop-bg"), box = ppEl("div", "ntf-pop pp-box");
  box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
  function close() { bg.remove(); }
  function form() {
    box.innerHTML = "";
    box.appendChild(ppEl("div", "np-k", "💡 For the product team"));
    box.appendChild(ppEl("h3", "", "What would make a student's life better?"));
    box.appendChild(ppEl("div", "np-b", "Don't try to be perfect. A problem you've noticed, a feature, a wild idea — write it however it comes."));
    var ta = document.createElement("textarea"); ta.maxLength = 4000;
    ta.placeholder = "e.g. Students keep asking which colleges they can get with their CUET score… what if the app showed it right after the mock test?";
    box.appendChild(ta);
    var err = ppEl("div", "ntf-err"); box.appendChild(err);
    var ch = ppEl("div", "pp-choices");
    var anon = ppEl("button", "pp-choice"), named = ppEl("button", "pp-choice");
    anon.type = named.type = "button";
    anon.append(ppEl("b", "", "🤫 Send anonymously"), ppEl("span", "", "Pinky promise — it's saved without your name, so even we won't know it was you."));
    named.append(ppEl("b", "", "🙋 Send with my name"), ppEl("span", "", "If it ships, we'll celebrate you in front of the whole team 🎉"));
    ch.append(anon, named); box.appendChild(ch);
    function upd() { anon.disabled = named.disabled = !ta.value.trim(); }
    ta.oninput = upd; upd();
    async function send(isAnon) {
      err.textContent = "";
      anon.disabled = named.disabled = true;
      var r = await SUPA.rpc("pitch_submit", { p_team: TEAM, p_body: ta.value, p_anonymous: isAnon });
      if (r.error) { err.textContent = "Couldn't send: " + r.error.message; upd(); return; }
      if (r.data && typeof sidRememberPitch === "function") sidRememberPitch(r.data);   /* so "My product ideas" can show it, even anonymous */
      if (r.data && !isAnon) { try { SUPA.functions.invoke("idea-mail", { body: { action: "thanks", kind: "pitch", id: r.data, team: TEAM } }); } catch (_) { } }   /* thank-you email */
      done(isAnon);
      if (typeof hasPerm === "function" && hasPerm("edit")) pitchImport();   /* file it straight away if we can */
    }
    anon.onclick = function () { send(true); };
    named.onclick = function () { send(false); };
    var acts = ppEl("div", "np-a"), cancel = ppEl("button", "ntf-btn", "Maybe later"); cancel.type = "button";
    cancel.onclick = close; acts.appendChild(cancel); box.appendChild(acts);
    setTimeout(function () { ta.focus(); }, 30);
  }
  function done(isAnon) {
    box.innerHTML = "";
    var d = ppEl("div", "pp-done");
    d.append(ppEl("div", "pd-big", "🚀"), ppEl("div", "pd-t", "Sent to the product team!"),
             ppEl("div", "pd-s", isAnon ? "No name attached. Thanks for thinking about students 💛" : "With your name on it — a thank-you is on its way to your inbox. Follow it in Administration → 💡 My product ideas 🤞"));
    box.appendChild(d);
    var acts = ppEl("div", "np-a"), more = ppEl("button", "ntf-btn", "I've got another"), ok = ppEl("button", "ntf-btn primary", "Done");
    more.type = ok.type = "button"; more.onclick = form; ok.onclick = close;
    acts.append(more, ok); box.appendChild(acts);
  }
  form();
  bg.appendChild(box);
  bg.onclick = function (e) { if (e.target === bg) close(); };
  document.body.appendChild(bg);
}

/* file new pitches into the product space's ideas (people who can edit; on load) */
var _pitchBusy = false;
async function pitchImport() {
  if (_pitchBusy || !SUPA || !currentUser() || typeof db === "undefined" || !db) return;
  if (!hasPerm("edit")) return;
  var target = pitchTarget(); if (!target) return;           /* nowhere to file them: leave them waiting */
  _pitchBusy = true;
  try {
    var r = await SUPA.rpc("claim_product_pitches", { p_team: TEAM });
    var rows = (r && r.data) || [];
    if (!rows.length) return;
    target.ideas = target.ideas || [];
    rows.forEach(function (p) {
      var text = String(p.body || "").trim(), first = text.split(/\n/)[0];
      var title = first.length > 90 ? first.slice(0, 87).replace(/\s+\S*$/, "") + "…" : first;
      var who = p.by_name ? "🙋 Pitched by " + p.by_name : "🤫 Pitched anonymously";
      var idea = { id: "idea-" + Math.random().toString(36).slice(2, 9), title: "💡 " + title,
                   note: who + " · from Social Media → Ideation\n\n" + text,
                   stage: "backlog", state: "Pending", syncedStatus: "review",
                   pitch: { id: p.id, anonymous: !p.by_name, by: p.by_name || null, at: p.created_at } };
      if (typeof discStatusOf === "function") idea.status = discStatusOf(idea.state);
      target.ideas.push(idea);
      SUPA.rpc("link_pitch", { p_id: p.id, p_space: target.id, p_ref: idea.id }).then(function () { });   /* lets the pitcher follow it */
    });
    saveDisc();
    toast("💡 " + rows.length + " new product idea" + (rows.length > 1 ? "s" : "") + " pitched by the team → " + target.name);
  } catch (_) {
  } finally { _pitchBusy = false; }
}
