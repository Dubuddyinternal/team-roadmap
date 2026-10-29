/* =====================================================================
   Monthly feedback + the suggestion box  (database: supabase/stage16a_monthly_feedback.sql)

   · Administration → 📝 My monthly feedback — everyone: this month's form
     (save a draft, then send it), past months, and the notes from their
     review meeting.
   · My Team → Monthly feedback — who has sent theirs. Super-admins see
     everyone; everyone else sees the people below them in the org chart
     (boxes linked to logins). Seniors read it and write the meeting notes.
     Owners set the day the form opens.
   · Administration → 📮 Send to Sumit — anyone: a suggestion, improvement,
     complaint… with their name or anonymously.
   · Administration → 📮 Suggestion box — super-admins only: what came in.

   The form opens on the team's open day (default the 25th, India time), is
   due on the last day of the month, and can be sent late until the 10th.
   Reminders (🔔 + a daily pop-up) come from the database every morning until
   the person sends it — see feedback_remind(). On top of that (stage 22a):
   emails (feedback_mail_tick → feedback-remind), a strip at the top of every
   page and a "pending" mark on the account menu (fbNudgeCheck).
   ===================================================================== */

var FB = { settings: null, month: null, open: null };

var FB_Q = [
  { k: "mood", type: "scale", req: true, label: "How was your month, overall?", opts: ["😣", "😕", "😐", "🙂", "🤩"], names: ["Rough", "Meh", "Okay", "Good", "Great"] },
  { k: "wins", type: "area", req: true, label: "Your biggest wins this month", hint: "What are you proud of? Numbers help — reels shipped, leads, bugs closed, students helped…" },
  { k: "missed", type: "area", req: true, label: "What didn't go to plan — and why?", hint: "Honest is more useful than perfect. Nobody gets marked down for this." },
  { k: "blockers", type: "area", label: "What slowed you down or blocked you?", hint: "People, tools, process, unclear priorities, too many meetings…" },
  { k: "workload", type: "choice", req: true, label: "Your workload this month", opts: ["Too light", "Just right", "A bit much", "Too much"] },
  { k: "support", type: "scale", label: "How supported did you feel by your senior?", opts: ["1", "2", "3", "4", "5"], names: ["Not at all", "A little", "Somewhat", "Well", "Fully"] },
  { k: "need", type: "area", label: "What do you need from your senior or the team?", hint: "Decisions, help, training, tools, time…" },
  { k: "learned", type: "area", label: "What did you learn — and what do you want to learn next?" },
  { k: "shoutout", type: "area", label: "Shout-out 🙌 — who helped you this month, and how?" },
  { k: "goals", type: "area", req: true, label: "Your top 3 goals for next month" },
  { k: "discuss", type: "area", label: "Anything you want to talk about in your review meeting?" }
];
/* step 2 — personality: tick the traits you have (positive and negative) */
var FB_TRAITS_POS = ["Adventurous", "Affectionate", "Ambitious", "Authentic", "Brave", "Calm", "Caring", "Charismatic", "Cheerful", "Clever",
  "Confident", "Considerate", "Courageous", "Creative", "Curious", "Decisive", "Dependable", "Determined", "Diligent", "Diplomatic",
  "Disciplined", "Easygoing", "Efficient", "Empathetic", "Encouraging", "Energetic", "Enthusiastic", "Expressive", "Fair", "Faithful",
  "Flexible", "Forgiving", "Friendly", "Generous", "Genuine", "Gracious"];
var FB_TRAITS_NEG = ["Aggressive", "Arrogant", "Critical", "Cynical", "Dishonest", "Disrespectful", "Envious", "Flaky", "Greedy", "Harsh",
  "Hostile", "Impatient", "Inconsiderate", "Inflexible", "Insensitive", "Intolerant", "Irrational", "Irresponsible", "Judgmental", "Lazy",
  "Manipulative", "Moody", "Needy", "Negative", "Nervous", "Obnoxious", "Overbearing", "Pessimistic", "Possessive", "Rude",
  "Self-centered", "Selfish", "Stubborn", "Superficial", "Suspicious", "Thoughtless"];
/* step 3 — self-awareness */
var FB_SA = [
  { k: "sa_me", type: "area", req: true, label: "What do I think of myself?", hint: "Honestly — your strengths, your weak spots, how you work." },
  { k: "sa_parents", type: "area", req: true, label: "What do my parents think of me?" },
  { k: "sa_seniors", type: "area", req: true, label: "What do my seniors think of me?" },
  { k: "sa_peers", type: "area", req: true, label: "What do my colleagues think of me?" },
  { k: "sa_juniors", type: "area", label: "What do my juniors think of me?", hint: "Skip it if nobody reports to you." },
  { k: "sa_3yrs", type: "area", req: true, label: "Where do I see myself in 3 years?" }
];
var FB_STEPS = [["1", "Monthly feedback"], ["2", "Personality"], ["3", "Self-awareness"]];
/* what each trait means, with a work example: "if you've done this, you have it" */
var FB_TRAIT_INFO = {
  Adventurous: ["Happy to try new and unfamiliar things.", "You volunteered for a project nobody had done before, or tried a new tool or format just to see if it works."],
  Affectionate: ["Openly warm and caring towards people.", "You check in on a teammate who seems low, or show you're glad when someone joins or does well."],
  Ambitious: ["Wants to grow and achieve big goals.", "You set yourself targets higher than what was asked, or you're working towards a bigger role."],
  Authentic: ["True to yourself; you don't pretend.", "You say \"I don't know\" when you don't, instead of faking it in a meeting."],
  Brave: ["Does the right thing even when it's scary.", "You told your senior about a mistake you made before anyone found out."],
  Calm: ["Stays steady under pressure.", "The site went down or a deadline moved up, and you kept working through it without panicking."],
  Caring: ["Looks out for others' wellbeing.", "You covered for a sick colleague or asked a new joiner if they needed help."],
  Charismatic: ["Draws people in; people like listening to you.", "People naturally gather around your ideas, or your presentations get the room excited."],
  Cheerful: ["Usually in a good mood and lifts others.", "You keep the team's spirits up on a bad day with a joke or a positive word."],
  Clever: ["Quick to understand and solve problems.", "You found a smart shortcut or fix that others hadn't thought of."],
  Confident: ["Believes in your own ability.", "You share your opinion in meetings, even with seniors, without needing someone to push you."],
  Considerate: ["Thinks about how your actions affect others.", "You don't message people late at night unless it's urgent, and you keep shared spaces tidy."],
  Courageous: ["Faces hard situations head-on.", "You had a difficult conversation with someone instead of avoiding it."],
  Creative: ["Comes up with original ideas.", "You suggested a new content idea, design or way of doing something that the team used."],
  Curious: ["Wants to learn how and why things work.", "You asked questions or read up on something outside your job just to understand it."],
  Decisive: ["Makes clear decisions without dragging.", "When the team was stuck between options, you picked one, explained why, and moved on."],
  Dependable: ["People can count on you.", "When you say \"I'll do it by Friday\", it's done by Friday, without reminders."],
  Determined: ["Keeps going until the goal is reached.", "Your first few attempts failed, and you kept trying different ways until it worked."],
  Diligent: ["Careful and hard-working; does things properly.", "You double-check your work before sending it, so others rarely find mistakes."],
  Diplomatic: ["Handles disagreements tactfully.", "You helped two people who disagreed find a middle ground without anyone feeling insulted."],
  Disciplined: ["Sticks to routines and plans.", "You start on time, follow your daily plan, and finish tasks even when you don't feel like it."],
  Easygoing: ["Relaxed and easy to work with.", "Plans changed last minute and you adjusted without fuss."],
  Efficient: ["Gets results without wasting time.", "You finished a task in half the expected time by organising it well or automating part of it."],
  Empathetic: ["Understands how others feel.", "You noticed a colleague was stressed and changed how you spoke to them."],
  Encouraging: ["Helps others believe in themselves.", "You told a junior \"you can do this\" and helped them get started."],
  Energetic: ["Brings lots of energy to work.", "You're the one keeping the pace up in long sessions or busy weeks."],
  Enthusiastic: ["Genuinely excited about the work.", "You jump on new projects with interest and get others excited too."],
  Expressive: ["Shows thoughts and feelings clearly.", "People always know where you stand because you explain your view clearly."],
  Fair: ["Treats everyone equally and justly.", "You gave credit to the person who actually did the work, even when it wasn't your friend."],
  Faithful: ["Loyal to people and commitments.", "You stood by the team and its decisions during a tough period."],
  Flexible: ["Adapts easily to change.", "Your priorities changed mid-week and you switched without complaining."],
  Forgiving: ["Lets go of others' mistakes.", "A colleague's mistake cost you time, and you moved on without holding a grudge."],
  Friendly: ["Kind and easy to approach.", "New people feel comfortable coming to you with questions."],
  Generous: ["Gives time, help or credit freely.", "You spent your own time helping someone finish their work."],
  Genuine: ["Sincere; what you say is what you mean.", "Your praise and your concerns are real, not just said to please people."],
  Gracious: ["Polite and kind, even when things go wrong.", "You lost an argument or didn't get your way, and still thanked everyone and supported the decision."],
  Aggressive: ["Pushes too hard; can come across as hostile.", "You raised your voice, or pressured someone until they gave in."],
  Arrogant: ["Thinks you're better than others.", "You dismissed someone's idea because you assumed yours was better, without really listening."],
  Critical: ["Often finds fault in others.", "Your first reaction to someone's work is to point out what's wrong, before anything good."],
  Cynical: ["Expects the worst of people or plans.", "When a new plan is announced, you assume it won't work or that there's a hidden motive."],
  Dishonest: ["Not always truthful.", "You said a task was done when it wasn't, or hid a mistake."],
  Disrespectful: ["Doesn't treat others with respect.", "You interrupted people, ignored messages, or spoke rudely about someone behind their back."],
  Envious: ["Resents others' success.", "You felt upset or annoyed when a colleague got praise or a promotion."],
  Flaky: ["Unreliable; doesn't follow through.", "You agreed to something and then didn't do it or didn't show up, without telling anyone."],
  Greedy: ["Wants more than your fair share.", "You took credit or rewards that should have been shared with the team."],
  Harsh: ["Too blunt or severe.", "Your feedback left someone feeling hurt rather than helped."],
  Hostile: ["Unfriendly or confrontational.", "You reacted angrily or defensively when someone asked a simple question."],
  Impatient: ["Gets frustrated with waiting or slowness.", "You got irritated when someone took time to understand, or pushed for answers immediately."],
  Inconsiderate: ["Doesn't think about how actions affect others.", "You left work for others to clean up, or made plans that ignored others' time."],
  Inflexible: ["Struggles to change your mind or plans.", "You insisted on doing it your way even after better options were shown."],
  Insensitive: ["Doesn't notice or care how others feel.", "You made a joke or comment that upset someone, and didn't realise it."],
  Intolerant: ["Doesn't accept views or ways different from yours.", "You got annoyed when someone did a task differently from how you would."],
  Irrational: ["Acts on emotion rather than facts.", "You made a decision in anger or panic that didn't make sense later."],
  Irresponsible: ["Doesn't take ownership.", "Something went wrong on your task and you blamed others or circumstances."],
  Judgmental: ["Quick to form negative opinions about people.", "You decided someone was lazy or useless after one bad day."],
  Lazy: ["Avoids effort.", "You put off tasks until the last minute or did the minimum when you could do more."],
  Manipulative: ["Influences people unfairly for your own gain.", "You told different people different stories to get what you wanted."],
  Moody: ["Mood changes a lot and affects others.", "People had to check what mood you were in before talking to you."],
  Needy: ["Needs a lot of attention or reassurance.", "You needed constant check-ins or approval before you could move on with work."],
  Negative: ["Tends to focus on the bad side.", "You often complain or say why something won't work, more than suggesting what could."],
  Nervous: ["Easily anxious or worried.", "You avoided speaking up or taking a task because you worried about getting it wrong."],
  Obnoxious: ["Annoying or offensive to be around.", "You were loud, showed off, or made others uncomfortable in a meeting."],
  Overbearing: ["Tries to control others too much.", "You took over someone else's task or kept telling them exactly how to do it."],
  Pessimistic: ["Expects things to go badly.", "Before starting a project you were already sure it would fail."],
  Possessive: ["Doesn't like sharing work, people or credit.", "You got upset when someone else worked on \"your\" project or client."],
  Rude: ["Impolite.", "You didn't greet people, ignored messages, or spoke sharply."],
  "Self-centered": ["Thinks mostly about yourself.", "In team discussions you mostly talk about your own work and needs, rarely others'."],
  Selfish: ["Puts your own interests first.", "You picked the easy tasks and left the hard ones for others."],
  Stubborn: ["Refuses to change position.", "You kept arguing for your idea even after the team agreed on another one."],
  Superficial: ["Cares about appearances more than substance.", "You focused on making work look good rather than making it actually work."],
  Suspicious: ["Doesn't trust others easily.", "You assumed a colleague had bad intentions behind a simple request."],
  Thoughtless: ["Acts without thinking about consequences.", "You sent a message or made a change without thinking how it would affect others."]
};
var FB_KINDS = [
  ["suggestion", "💡 Suggestion"], ["improvement", "🛠 Improvement"], ["complaint", "😤 Complaint"],
  ["appreciation", "💛 Appreciation"], ["other", "💬 Something else"]
];

/* ---------- small helpers ---------- */
function fbEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function fbIST() {
  var o = {};
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).forEach(function (x) { o[x.type] = x.value; });
  return { y: +o.year, m: +o.month, d: +o.day };
}
function fbKey(y, m) { return y + "-" + String(m).padStart(2, "0"); }
function fbCur() { var n = fbIST(); return fbKey(n.y, n.m); }
function fbPrev() { var n = fbIST(); return n.m === 1 ? fbKey(n.y - 1, 12) : fbKey(n.y, n.m - 1); }
function fbShift(k, by) { var a = k.split("-"), d = new Date(+a[0], +a[1] - 1 + by, 1); return fbKey(d.getFullYear(), d.getMonth() + 1); }
function fbLabel(k, short) { var a = k.split("-"); return new Date(+a[0], +a[1] - 1, 1).toLocaleDateString("en-GB", short ? { month: "long" } : { month: "long", year: "numeric" }); }
function fbLastDay(k) { var a = k.split("-"); return new Date(+a[0], +a[1], 0).getDate(); }
function fbDate(iso) { return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""; }
function fbOpenDay() { return (FB.settings && FB.settings.open_day) || 25; }
function fbEnabled() { return !FB.settings || FB.settings.enabled !== false; }
/* same rule as feedback_window() in the database */
function fbWindow(k) {
  if (!fbEnabled()) return "closed";
  var n = fbIST();
  if (k === fbCur() && n.d >= fbOpenDay()) return "open";
  if (k === fbPrev() && n.d <= 10) return "late";
  return "closed";
}
/* the month someone should be filling in now, or null */
function fbTargetMonth() { return fbWindow(fbCur()) === "open" ? fbCur() : fbWindow(fbPrev()) === "late" ? fbPrev() : null; }
function fbUser(id) { return (typeof USERS !== "undefined" ? USERS : []).find(function (u) { return u.id === id; }) || null; }
function fbName(id) { var u = fbUser(id); return u ? userDisplayName(u) : "Someone"; }
function fbIsOwner() { var u = currentUser(); return !!u && (u.super || roleOf(u, TEAM) === "owner"); }
function fbBoss() { var s = (typeof USERS !== "undefined" ? USERS : []).find(function (u) { return u.super; }); return s ? userDisplayName(s).split(" ")[0] : "Sumit"; }
/* the chain of org-chart boxes above someone's linked box: ["Mannat", "Sumit"] (nearest first) */
function fbLineAbove(uid) {
  var found = null;
  (function walk(n, path) {
    if (!n || found) return;
    if (n.uid === uid) { found = path.slice().reverse(); return; }
    (n.children || []).forEach(function (c) { walk(c, path.concat([n])); });
  })(typeof TEAMORG !== "undefined" ? TEAMORG : null, []);
  return found;
}
function fbOrgRole(uid) {
  var r = "";
  (function walk(n) { if (!n || r) return; if (n.uid === uid) { r = n.role || ""; return; } (n.children || []).forEach(walk); })(typeof TEAMORG !== "undefined" ? TEAMORG : null);
  return r;
}
async function fbLoadSettings() {
  if (!SUPA) return;
  var r = await SUPA.from("feedback_settings").select("*").eq("team_slug", TEAM).maybeSingle();
  FB.settings = r.data || { enabled: true, open_day: 25 };
}
function fbErr(e) { return (e && (e.message || e.error_description)) || String(e || "unknown"); }

/* ---------- styles ---------- */
(function () {
  var css = ""
    + ".fb-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:0 0 14px}"
    + ".fb-hero{background:linear-gradient(135deg,var(--indigo-soft),#FFF8F2);border-color:#F5CDB6}"
    + ".fb-hero h3{font-size:18px;margin:0 0 4px}.fb-hero p{color:var(--muted);font-size:13.5px;margin:0}"
    + ".fb-q{margin:0 0 18px}.fb-q label.fb-l{display:block;font-weight:650;font-size:14.5px;margin-bottom:3px}"
    + ".fb-q .fb-h{color:var(--muted);font-size:12.5px;margin-bottom:7px}"
    + ".fb-q .req{color:var(--indigo);margin-left:3px}"
    + ".fb-q textarea{width:100%;min-height:84px;border:1px solid var(--line-strong);border-radius:10px;padding:10px 12px;font-size:14px;background:#fff;resize:vertical}"
    + ".fb-q textarea:focus{outline:none;border-color:var(--indigo);box-shadow:0 0 0 3px var(--indigo-soft)}"
    + ".fb-q.miss textarea,.fb-q.miss .fb-opts{box-shadow:0 0 0 2px #F3B3AE;border-radius:10px}"
    + ".fb-opts{display:flex;gap:8px;flex-wrap:wrap}"
    + ".fb-opt{border:1.5px solid var(--line-strong);background:#fff;border-radius:12px;padding:8px 13px;font-size:13.5px;display:flex;flex-direction:column;align-items:center;min-width:64px;gap:2px}"
    + ".fb-opt .e{font-size:22px;line-height:1}.fb-opt .n{font-size:11px;color:var(--muted)}"
    + ".fb-opt:hover{border-color:var(--indigo)}.fb-opt.on{border-color:var(--indigo);background:var(--indigo-soft);color:var(--indigo);font-weight:650}"
    + ".fb-bar{position:sticky;bottom:0;background:linear-gradient(transparent,var(--paper) 30%);padding:16px 0 6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}"
    + ".fb-bar .st{color:var(--muted);font-size:12.5px;margin-right:auto}"
    + ".fb-ans{margin:0 0 14px}.fb-ans .q{font-size:12px;font-family:var(--mono);letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}"
    + ".fb-ans .a{white-space:pre-wrap;font-size:14px}.fb-ans .a.none{color:var(--muted);font-style:italic}"
    + ".fb-chip{display:inline-block;font-size:11.5px;font-weight:650;border-radius:99px;padding:3px 10px;white-space:nowrap}"
    + ".fb-chip.none{background:var(--blocked-bg);color:var(--blocked)}.fb-chip.draft{background:var(--progress-bg);color:var(--progress)}"
    + ".fb-chip.submitted{background:var(--done-bg);color:var(--done)}.fb-chip.late{background:#FFF1E6;color:#B4541A}.fb-chip.talk{background:#EEF1F5;color:#475569}"
    + ".fb-meet{background:#F4F7FB;border:1px solid #DCE5F0;border-radius:12px;padding:14px 16px;margin-top:10px}"
    + ".fb-meet h4{margin:0 0 6px;font-size:14px}.fb-meet .w{color:var(--muted);font-size:12px;margin-top:6px}"
    + ".fb-hist{border:1px solid var(--line);border-radius:12px;background:#fff;margin:0 0 10px}"
    + ".fb-hist summary{cursor:pointer;list-style:none;padding:12px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}"
    + ".fb-hist summary::-webkit-details-marker{display:none}.fb-hist summary b{margin-right:auto}"
    + ".fb-hist .body{padding:4px 16px 14px;border-top:1px solid var(--line)}"
    + ".fb-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 16px}"
    + ".fb-stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}"
    + ".fb-stat .n{font-size:24px;font-weight:750}.fb-stat .l{font-size:12px;color:var(--muted)}"
    + ".fb-row{display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(140px,1fr) 150px 120px 110px;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid var(--line)}"
    + ".fb-row.head{border-top:none;font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding-top:8px;padding-bottom:8px}"
    + ".fb-who{display:flex;gap:10px;align-items:center;min-width:0}.fb-who .av{width:32px;height:32px;border-radius:50%;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none;font-size:13px;background-size:cover;background-position:center}"
    + ".fb-who .nm{font-weight:650}.fb-who .rl{font-size:12px;color:var(--muted)}"
    + ".fb-line{font-size:12.5px;color:var(--muted)}"
    + ".fb-table{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}"
    + ".fb-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}"
    + ".fb-tools select{border:1px solid var(--line-strong);border-radius:99px;padding:7px 12px;background:#fff;font:inherit;font-size:13px}"
    + ".fb-read-bg{position:fixed;inset:0;background:rgba(26,22,20,.42);z-index:470;display:flex;justify-content:flex-end}"
    + ".fb-read{background:var(--paper);width:min(640px,100%);height:100%;overflow-y:auto;padding:24px 26px 40px;box-shadow:-10px 0 40px rgba(0,0,0,.15)}"
    + ".fb-read h2{margin:0 0 2px;font-size:20px}.fb-read .x{float:right;font-size:20px;color:var(--muted)}"
    + ".fb-read textarea{width:100%;min-height:110px;border:1px solid var(--line-strong);border-radius:10px;padding:10px 12px;font-size:14px;background:#fff}"
    + ".fb-kinds{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}"
    + ".fb-anon{display:flex;gap:8px;margin:12px 0}.fb-anon .fb-opt{flex-direction:row;gap:8px;min-width:0;text-align:left}"
    + ".fb-box{border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px 16px;margin:0 0 10px}"
    + ".fb-box.new{border-color:#F5CDB6;box-shadow:0 0 0 3px var(--indigo-soft)}"
    + ".fb-box .top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:12.5px;color:var(--muted)}"
    + ".fb-box .msg{white-space:pre-wrap;font-size:14.5px}.fb-box .acts{display:flex;gap:8px;margin-top:10px}"
    + ".fb-steps{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}"
    + ".fb-step{display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--line-strong);background:#fff;border-radius:99px;padding:7px 14px 7px 7px;font-size:13.5px;font-weight:600;cursor:pointer;color:var(--ink)}"
    + ".fb-step .n{width:24px;height:24px;border-radius:50%;background:var(--paper);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}"
    + ".fb-step.done .n{background:var(--done-bg,#E3F4EA);color:var(--done,#2E9466)}"
    + ".fb-step.on{border-color:var(--indigo);color:var(--indigo)}.fb-step.on .n{background:var(--indigo);color:#fff}"
    + ".fb-stepintro{color:var(--muted);font-size:13.5px;margin:0 0 14px}"
    + ".fb-traits{display:grid;grid-template-columns:1fr 1fr;gap:14px}"
    + ".fb-tcol{border:2px solid #2F6DB5;border-radius:12px;overflow:hidden}.fb-tcol.neg{border-color:#D9443A}"
    + ".fb-thead{background:#2F6DB5;color:#fff;font-weight:750;font-size:13.5px;text-transform:uppercase;letter-spacing:.03em;padding:9px 12px;display:flex;align-items:center;gap:8px}"
    + ".fb-tcol.neg .fb-thead{background:#D9443A}.fb-tcount{margin-left:auto;font-size:11px;font-weight:600;text-transform:none;opacity:.9}"
    + ".fb-tlist{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;padding:8px 10px}"
    + ".fb-tr{display:flex;align-items:center;gap:6px;font-size:13.5px;padding:5px 6px;border-radius:8px;cursor:pointer;user-select:none}"
    + ".fb-tr input{width:16px;height:16px;accent-color:#2F6DB5;margin:0}.fb-tr.neg input{accent-color:#D9443A}"
    + ".fb-tr.on.pos{background:#E8F0FB;color:#1F4E8C;font-weight:600}.fb-tr.on.neg{background:#FDECEA;color:#9B2A22;font-weight:600}"
    + ".fb-ti{margin-left:auto;flex:none;width:18px;height:18px;border-radius:50%;border:1px solid var(--line-strong);background:#fff;color:var(--muted);font:italic 700 11px Georgia,serif;line-height:16px;text-align:center;padding:0;cursor:pointer}"
    + ".fb-ti:hover{border-color:#2F6DB5;color:#2F6DB5}.fb-tr.neg .fb-ti:hover{border-color:#D9443A;color:#D9443A}"
    + ".fb-tpop{position:fixed;z-index:600;background:#fff;border:1px solid var(--line);border-top:3px solid #2F6DB5;border-radius:12px;padding:12px 14px;box-shadow:0 12px 32px rgba(0,0,0,.14);font-size:13.5px;line-height:1.5}"
    + ".fb-tpop.neg{border-top-color:#D9443A}.fb-tpop b{font-size:14.5px}.fb-tpop .m{margin:3px 0 7px}.fb-tpop .ex{color:var(--muted);font-size:13px}"
    + ".fb-q.miss .fb-traits{box-shadow:0 0 0 2px #F3B3AE;border-radius:12px}"
    + ".fb-trview{display:flex;flex-wrap:wrap;gap:6px}.fb-trview .fb-tr{cursor:default;padding:3px 10px;border-radius:99px;font-size:12.5px}"
    + "@media(max-width:700px){.fb-traits{grid-template-columns:1fr}}"
    + ".fb-mr{background:#FFF8F2;border:1px solid #F5CDB6;border-radius:12px;padding:14px 16px;margin:16px 0}"
    + ".fb-mr h4{margin:0 0 4px;font-size:15px}.fb-mr .fb-q{margin:12px 0}.fb-mr textarea{min-height:64px}"
    + ".fb-mr.view{background:#F7F5FF;border-color:#D9D2F5}"
    + ".fb-mrate{display:flex;align-items:baseline;gap:8px;margin:6px 0 10px}.fb-mrate b{font-size:22px;color:var(--indigo)}.fb-mrate span{font-weight:600}"
    + ".fb-mrq{font-size:12px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.03em;color:var(--muted);margin:10px 0 4px}"
    + ".fb-tr.mute.on{background:#EEF1F5;color:#475569}"
    + ".fb-empty{text-align:center;color:var(--muted);padding:28px 16px;border:1.5px dashed var(--line-strong);border-radius:14px}"
    + "@media(max-width:760px){.fb-stats{grid-template-columns:repeat(2,1fr)}.fb-row{grid-template-columns:1fr auto}.fb-row .hide-s{display:none}.fb-row.head{display:none}}";
  var st = document.createElement("style"); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();

/* ---------- reading answers ---------- */
function fbAnswersView(answers) {
  var w = fbEl("div");
  var a0 = answers || {};
  var qs = FB_Q.slice();
  var hasSa = FB_SA.some(function (q) { return a0[q.k]; }), hasTr = Array.isArray(a0.traits_pos) || Array.isArray(a0.traits_neg);
  if (hasTr) {
    var tb = fbEl("div", "fb-ans");
    tb.appendChild(fbEl("div", "q", "Personality — traits they ticked"));
    var tw = fbEl("div", "fb-trview");
    (a0.traits_pos || []).forEach(function (t) { tw.appendChild(fbEl("span", "fb-tr pos on", t)); });
    (a0.traits_neg || []).forEach(function (t) { tw.appendChild(fbEl("span", "fb-tr neg on", t)); });
    if (!tw.children.length) tw.appendChild(fbEl("span", "a none", "—"));
    tb.appendChild(tw);
  }
  if (hasSa) qs = qs.concat(FB_SA);
  qs.forEach(function (q) {
    var v = (answers || {})[q.k];
    var b = fbEl("div", "fb-ans");
    b.appendChild(fbEl("div", "q", q.label));
    var txt = v == null || v === "" ? "—" : q.type === "scale" ? (q.opts[+v - 1] || v) + " " + (q.names ? q.names[+v - 1] : "") : String(v);
    b.appendChild(fbEl("div", "a" + (v == null || v === "" ? " none" : ""), txt));
    w.appendChild(b);
    if (q.k === FB_Q[FB_Q.length - 1].k && tb) w.appendChild(tb);
  });
  if (tb && !w.contains(tb)) w.appendChild(tb);
  return w;
}
function fbMeetingView(row) {
  if (!row.discussed_at && !row.meeting_notes) return null;
  var m = fbEl("div", "fb-meet");
  m.appendChild(fbEl("h4", "", "🤝 From your review meeting"));
  if (row.meeting_notes) m.appendChild(fbEl("div", "", row.meeting_notes)).style.whiteSpace = "pre-wrap";
  if (row.discussed_at) m.appendChild(fbEl("div", "w", "Discussed " + fbDate(row.discussed_at) + (row.discussed_by ? " with " + fbName(row.discussed_by) : "")));
  return m;
}

/* =====================================================================
   Administration → 📝 My monthly feedback
   ===================================================================== */
function renderAdminMyFeedback(wrap) {
  var head = fbEl("div", "admin-userhead"), left = fbEl("div");
  var h2 = fbEl("h2", "", "📝 My monthly feedback"); h2.style.margin = "0";
  var sub = fbEl("div", "hint", "Once a month, look back at your month. Your answers are private until you send them — then only the people above you in the reporting line (and " + fbBoss() + ") can read them, before your review meeting.");
  sub.style.marginTop = "4px"; left.append(h2, sub); head.appendChild(left); wrap.appendChild(head);
  var holder = fbEl("div", "hint", "Loading…"); wrap.appendChild(holder);
  var me = currentUser();
  Promise.all([
    fbLoadSettings(),
    SUPA.from("monthly_feedback").select("*").eq("team_slug", TEAM).eq("user_id", me.id).order("month", { ascending: false })
  ]).then(function (res) {
    holder.className = ""; holder.innerHTML = "";
    if (res[1].error) { holder.className = "hint"; holder.textContent = "Couldn't load: " + res[1].error.message; return; }
    var rows = res[1].data || [];
    var target = fbTargetMonth();
    /* 🎯 month end: the OKR check-in sits on top of the feedback form */
    var okrBox = fbEl("div"); holder.appendChild(okrBox);
    SUPA.rpc("okr_me", { p_team: TEAM }).then(function (o) { if (!o.error && o.data && o.data.pending && o.data.kind === "end") okrCheckinCard(okrBox, o.data, true); });
    var cur = target ? rows.find(function (r) { return r.month === target; }) : null;
    if (target && !(cur && cur.status === "submitted")) holder.appendChild(fbForm(target, cur, function () { holder.innerHTML = ""; renderAdminMyFeedbackInto(wrap); }));
    else if (target) {
      var done = fbEl("div", "fb-card fb-hero");
      done.appendChild(fbEl("h3", "", "✅ Your " + fbLabel(target, true) + " feedback is sent"));
      done.appendChild(fbEl("p", "", "Sent " + fbDate(cur.submitted_at) + (cur.late ? " (late)" : "") + ". It'll be discussed in your review meeting — the notes will show up below."));
      holder.appendChild(done);
    } else {
      var wait = fbEl("div", "fb-card fb-hero");
      if (!fbEnabled()) {
        wait.appendChild(fbEl("h3", "", "Monthly feedback is switched off"));
        wait.appendChild(fbEl("p", "", "An owner can switch it on in My Team → Monthly feedback."));
      } else {
        var next = fbIST().d >= fbOpenDay() ? fbShift(fbCur(), 1) : fbCur();
        wait.appendChild(fbEl("h3", "", "🗓 The " + fbLabel(next, true) + " form opens on " + fbOpenDay() + " " + fbLabel(next, true)));
        wait.appendChild(fbEl("p", "", "You'll get a 🔔 and a pop-up that day. Please send it by " + fbLastDay(next) + " " + fbLabel(next, true) + " — you can save a draft and finish it later."));
      }
      holder.appendChild(wait);
    }
    var past = rows.filter(function (r) { return r.status === "submitted"; });
    if (past.length) {
      holder.appendChild(fbEl("h3", "", "Your past months")).style.margin = "22px 0 10px";
      past.forEach(function (r) {
        var d = fbEl("details", "fb-hist");
        var s = fbEl("summary");
        s.appendChild(fbEl("b", "", fbLabel(r.month)));
        if (r.late) s.appendChild(fbEl("span", "fb-chip late", "late"));
        s.appendChild(fbEl("span", "fb-chip " + (r.discussed_at ? "submitted" : "talk"), r.discussed_at ? "🤝 discussed" : "waiting for the meeting"));
        s.appendChild(fbEl("span", "hint", "sent " + fbDate(r.submitted_at)));
        d.appendChild(s);
        var b = fbEl("div", "body");
        var mrv = fbManagerView(r); if (mrv) { b.appendChild(mrv); mrv.style.margin = "12px 0 16px"; }
        var mv = fbMeetingView(r); if (mv) { b.appendChild(mv); mv.style.margin = "12px 0 16px"; }
        b.appendChild(fbAnswersView(r.answers));
        d.appendChild(b);
        holder.appendChild(d);
      });
      var first = holder.querySelector("details.fb-hist"); if (first && (first.querySelector(".fb-meet"))) first.open = true;
    }
  }).catch(function (e) { holder.className = "hint"; holder.textContent = "Couldn't load: " + fbErr(e); });
}
function renderAdminMyFeedbackInto(wrap) { wrap.innerHTML = ""; renderAdminMyFeedback(wrap); }

/* the form itself: draft saves on its own a few seconds after you stop typing */
function fbForm(month, row, onSent) {
  var ans = Object.assign({}, (row && row.answers) || {});
  var card = fbEl("div");
  var hero = fbEl("div", "fb-card fb-hero");
  var late = fbWindow(month) === "late";
  hero.appendChild(fbEl("h3", "", (late ? "⏰ " : "✍️ ") + "Your " + fbLabel(month, true) + " feedback"));
  hero.appendChild(fbEl("p", "", late
    ? "This was due on " + fbLastDay(month) + " " + fbLabel(month, true) + " — you can still send it until the 10th. It'll be marked late."
    : "Due by " + fbLastDay(month) + " " + fbLabel(month, true) + ". 3 steps, about 15 minutes. Starred questions are needed to send it; your draft saves itself."));
  card.appendChild(hero);
  var qEls = {};
  var timer = null, dirty = false, st;
  function changed() { dirty = true; st.textContent = "Unsaved changes…"; clearTimeout(timer); timer = setTimeout(function () { save(false, true); }, 3500); }
  function qBlock(q, parent) {
    var b = fbEl("div", "fb-q"); qEls[q.k] = b;
    var l = fbEl("label", "fb-l", q.label); if (q.req) l.appendChild(fbEl("span", "req", "*"));
    b.appendChild(l);
    if (q.hint) b.appendChild(fbEl("div", "fb-h", q.hint));
    if (q.type === "area") {
      var t = fbEl("textarea"); t.value = ans[q.k] || ""; t.maxLength = q.k.indexOf("sa_") === 0 ? 1500 : 3000;
      t.oninput = function () { ans[q.k] = t.value; b.classList.remove("miss"); changed(); };
      b.appendChild(t);
    } else {
      var opts = fbEl("div", "fb-opts");
      q.opts.forEach(function (o, i) {
        var val = q.type === "scale" ? String(i + 1) : o;
        var btn = fbEl("button", "fb-opt" + (String(ans[q.k]) === val ? " on" : "")); btn.type = "button";
        if (q.type === "scale") { btn.appendChild(fbEl("span", "e", o)); if (q.names) btn.appendChild(fbEl("span", "n", q.names[i])); }
        else btn.textContent = o;
        btn.onclick = function () {
          ans[q.k] = val; b.classList.remove("miss");
          [].forEach.call(opts.children, function (x) { x.classList.remove("on"); }); btn.classList.add("on"); changed();
        };
        opts.appendChild(btn);
      });
      b.appendChild(opts);
    }
    parent.appendChild(b);
  }
  /* the three steps */
  var step = 0;
  var tabs = fbEl("div", "fb-steps");
  var panes = [fbEl("div", "fb-card"), fbEl("div", "fb-card"), fbEl("div", "fb-card")];
  FB_Q.forEach(function (q) { qBlock(q, panes[0]); });
  /* 2 · personality: tick what you have */
  panes[1].appendChild(fbEl("div", "fb-stepintro", "Tick every trait you have — positive and negative. Leave the ones you don't have. Be honest: nobody is marked down for this."));
  ans.traits_pos = Array.isArray(ans.traits_pos) ? ans.traits_pos : [];
  ans.traits_neg = Array.isArray(ans.traits_neg) ? ans.traits_neg : [];
  var trBox = fbEl("div", "fb-q"); qEls.traits = trBox;
  var cols = fbEl("div", "fb-traits");
  [["pos", "Positive personality traits", FB_TRAITS_POS], ["neg", "Negative personality traits", FB_TRAITS_NEG]].forEach(function (g) {
    var col = fbEl("div", "fb-tcol " + g[0]);
    var hd = fbEl("div", "fb-thead", g[1]); col.appendChild(hd);
    var cnt = fbEl("span", "fb-tcount"); hd.appendChild(cnt);
    var key = "traits_" + g[0];
    var upd = function () { cnt.textContent = ans[key].length ? ans[key].length + " ticked" : ""; };
    var list = fbEl("div", "fb-tlist");
    g[2].forEach(function (t) {
      var lb = fbEl("label", "fb-tr " + g[0] + (ans[key].indexOf(t) >= 0 ? " on" : ""));
      var cb = fbEl("input"); cb.type = "checkbox"; cb.checked = ans[key].indexOf(t) >= 0;
      cb.onchange = function () {
        var i = ans[key].indexOf(t);
        if (cb.checked && i < 0) ans[key].push(t); else if (!cb.checked && i >= 0) ans[key].splice(i, 1);
        lb.classList.toggle("on", cb.checked); trBox.classList.remove("miss"); upd(); changed();
      };
      lb.append(cb, document.createTextNode(" " + t));
      if (FB_TRAIT_INFO[t]) {
        var ib = fbEl("button", "fb-ti", "i"); ib.type = "button"; ib.title = FB_TRAIT_INFO[t][0];
        ib.setAttribute("aria-label", "What does " + t + " mean?");
        ib.onclick = function (e) { e.preventDefault(); e.stopPropagation(); fbTraitInfo(ib, t, g[0]); };
        lb.appendChild(ib);
      }
      list.appendChild(lb);
    });
    upd(); col.appendChild(list); cols.appendChild(col);
  });
  trBox.appendChild(cols); panes[1].appendChild(trBox);
  /* 3 · self-awareness */
  panes[2].appendChild(fbEl("div", "fb-stepintro", "How do you see yourself — and how do the people around you see you? A few honest lines each."));
  FB_SA.forEach(function (q) { qBlock(q, panes[2]); });
  var stepOf = function (k) { return FB_Q.some(function (q) { return q.k === k; }) ? 0 : k === "traits" ? 1 : 2; };
  var missing = function () {
    var m = FB_Q.concat(FB_SA).filter(function (q) { return q.req && !String(ans[q.k] || "").trim(); }).map(function (q) { return q.k; });
    if (!ans.traits_pos.length && !ans.traits_neg.length) m.push("traits");
    return m;
  };
  var bodyEl = fbEl("div");
  var back, next, send;
  function show(i) {
    step = i;
    tabs.innerHTML = "";
    var miss = missing();
    FB_STEPS.forEach(function (x, j) {
      var done = !miss.some(function (k) { return stepOf(k) === j; });
      var b = fbEl("button", "fb-step" + (j === i ? " on" : "") + (done ? " done" : "")); b.type = "button";
      b.append(fbEl("span", "n", done && j !== i ? "✓" : x[0]), document.createTextNode(" " + x[1]));
      b.onclick = function () { show(j); };
      tabs.appendChild(b);
    });
    bodyEl.innerHTML = ""; bodyEl.appendChild(panes[i]);
    back.style.display = i ? "" : "none";
    next.style.display = i < 2 ? "" : "none";
    send.style.display = i === 2 ? "" : "none";
  }
  card.append(tabs, bodyEl);
  var bar = fbEl("div", "fb-bar");
  st = fbEl("span", "st", row && row.updated_at ? "Draft saved " + new Date(row.updated_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not saved yet");
  var draft = fbEl("button", "btn", "Save draft"); draft.onclick = function () { save(false); };
  back = fbEl("button", "btn", "← Back"); back.onclick = function () { show(step - 1); window.scrollTo(0, 0); };
  next = fbEl("button", "btn save", "Next →"); next.onclick = function () { if (dirty) save(false, true); show(step + 1); card.scrollIntoView({ behavior: "smooth", block: "start" }); };
  send = fbEl("button", "btn save", "Send it ✓");
  send.onclick = function () {
    var miss = missing();
    if (miss.length) {
      var s0 = stepOf(miss[0]); show(s0);
      miss.forEach(function (k) { if (qEls[k]) qEls[k].classList.add("miss"); });
      setTimeout(function () { qEls[miss[0]].scrollIntoView({ behavior: "smooth", block: "center" }); }, 30);
      toast(miss[0] === "traits" ? "Please tick the traits you have first" : "Please answer the starred questions first (step " + (s0 + 1) + ")"); return;
    }
    if (!confirm("Send your " + fbLabel(month, true) + " feedback? You can't change it after sending.")) return;
    save(true);
  };
  bar.append(st, draft, back, next, send);
  card.appendChild(bar);
  show(0);
  var busy = false;
  async function save(submit, quiet) {
    if (busy) { if (submit) setTimeout(function () { save(submit, quiet); }, 400); return; }
    clearTimeout(timer); busy = true;
    if (!quiet) { draft.disabled = send.disabled = true; }
    st.textContent = submit ? "Sending…" : "Saving…";
    var r = await SUPA.rpc("feedback_save", { p_team: TEAM, p_month: month, p_answers: ans, p_submit: !!submit });
    busy = false; draft.disabled = send.disabled = false;
    if (r.error) { st.textContent = "Couldn't save: " + r.error.message; if (!quiet) toast("Couldn't save: " + r.error.message); return; }
    dirty = false;
    if (submit) { toast("Sent — thank you! 🙌"); fbNudgeCheck(); if (onSent) onSent(); return; }
    st.textContent = "Draft saved " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (!quiet) toast("Draft saved");
  }
  /* leaving with unsaved typing: save it */
  card._flush = function () { if (dirty) save(false, true); };
  window.addEventListener("beforeunload", card._flush);
  return card;
}

/* the ⓘ next to a trait: what it means, and an example */
function fbTraitInfo(anchor, t, kind) {
  var old = document.getElementById("fb-tpop"); if (old) { var same = old.dataset.t === t; old.remove(); if (same) return; }
  var x = FB_TRAIT_INFO[t]; if (!x) return;
  var pop = fbEl("div", "fb-tpop " + kind); pop.id = "fb-tpop"; pop.dataset.t = t;
  pop.append(fbEl("b", null, t), fbEl("div", "m", x[0]), fbEl("div", "ex", "Example: " + x[1] + (kind === "neg" ? " If that sounds like you, you may be " : " If that's you, you're ") + t.toLowerCase() + "."));
  document.body.appendChild(pop);
  var r = anchor.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 24);
  pop.style.width = w + "px";
  pop.style.left = Math.max(12, Math.min(r.left - w / 2, window.innerWidth - w - 12)) + "px";
  var top = r.bottom + 8; if (top + pop.offsetHeight > window.innerHeight - 8) top = r.top - pop.offsetHeight - 8;
  pop.style.top = Math.max(8, top) + "px";
  setTimeout(function () {
    var off = function (e) { if (!pop.contains(e.target) && e.target !== anchor) { pop.remove(); document.removeEventListener("mousedown", off, true); window.removeEventListener("scroll", off2, true); } };
    var off2 = function () { pop.remove(); document.removeEventListener("mousedown", off, true); window.removeEventListener("scroll", off2, true); };
    document.addEventListener("mousedown", off, true); window.addEventListener("scroll", off2, true);
  }, 0);
}

/* =====================================================================
   My Team → Monthly feedback
   ===================================================================== */
function fbRenderTeamView() {
  var tools = $("mt-tools"), canvas = $("mt-canvas");
  if ($("mt-title-h")) $("mt-title-h").textContent = ((typeof TEAMS !== "undefined" && TEAMS[TEAM] && TEAMS[TEAM].name) || TEAM) + " — Monthly feedback";
  if (!FB.month) FB.month = fbTargetMonth() || fbPrev();
  tools.innerHTML = "";
  var tw = fbEl("div", "fb-tools");
  var sel = fbEl("select");
  for (var i = -1; i < 12; i++) {
    var k = fbShift(fbCur(), -i);
    if (i === -1) continue;
    var o = fbEl("option", "", fbLabel(k)); o.value = k; if (k === FB.month) o.selected = true; sel.appendChild(o);
  }
  sel.onchange = function () { FB.month = sel.value; fbRenderTeamView(); };
  tw.appendChild(sel);
  var mine = fbEl("button", "mt-btn", "✍️ My feedback"); mine.onclick = function () { closeTeam(); openAdmin("myfeedback"); };
  tw.appendChild(mine);
  if (fbIsOwner()) { var set = fbEl("button", "mt-btn", "⚙️ Settings"); set.onclick = fbSettingsDialog; tw.appendChild(set); }
  tools.appendChild(tw);
  canvas.innerHTML = "";
  var holder = fbEl("div", "hint", "Loading…"); canvas.appendChild(holder);
  var month = FB.month, me = currentUser();
  Promise.all([fbLoadSettings(), SUPA.rpc("feedback_overview", { p_team: TEAM, p_month: month })]).then(function (res) {
    if (month !== FB.month) return;
    holder.className = ""; holder.innerHTML = "";
    if (res[1].error) { holder.className = "hint"; holder.textContent = "Couldn't load: " + res[1].error.message; return; }
    var rows = (res[1].data || []).filter(function (r) { return !(me.super && r.user_id === me.id); });
    var others = rows.filter(function (r) { return r.user_id !== me.id; });
    /* the window for this month */
    var w = fbWindow(month), info = fbEl("div", "fb-card fb-hero");
    info.appendChild(fbEl("h3", "", fbLabel(month) + (w === "open" ? " — open now" : w === "late" ? " — overdue, late sends until the 10th" : "")));
    info.appendChild(fbEl("p", "", !fbEnabled() ? "Monthly feedback is switched off." :
      "Opens " + fbOpenDay() + " " + fbLabel(month, true) + ", due " + fbLastDay(month) + " " + fbLabel(month, true) + ". Everyone who hasn't sent theirs gets a 🔔 and a pop-up every morning until they do."));
    holder.appendChild(info);
    if (!others.length) {
      var e = fbEl("div", "fb-empty");
      e.appendChild(fbEl("div", "", me.super ? "Nobody in this team yet." : "Nobody reports to you in the org chart — so there's no one's feedback for you to read here."));
      var tip = fbEl("div", "", fbIsOwner() ? "Tip: in Reporting lines, edit each box (✎) and pick its Linked login. Seniors then see the people below them here." : "Your own feedback is in ✍️ My feedback.");
      tip.style.marginTop = "6px"; tip.style.fontSize = "13px"; e.appendChild(tip);
      holder.appendChild(e);
      return;
    }
    var cnt = { submitted: 0, draft: 0, none: 0, talk: 0 };
    others.forEach(function (r) { cnt[r.status] = (cnt[r.status] || 0) + 1; if (r.discussed_at) cnt.talk++; });
    var stats = fbEl("div", "fb-stats");
    [[cnt.submitted + " / " + others.length, "sent"], [cnt.draft, "started, not sent"], [cnt.none, "not started"], [cnt.talk, "discussed in a meeting"]].forEach(function (x) {
      var s = fbEl("div", "fb-stat"); s.append(fbEl("div", "n", String(x[0])), fbEl("div", "l", x[1])); stats.appendChild(s);
    });
    holder.appendChild(stats);
    var tbl = fbEl("div", "fb-table");
    var hr = fbEl("div", "fb-row head");
    ["Person", "Reports to", "Status", "Meeting", ""].forEach(function (t, i) { hr.appendChild(fbEl("div", i === 1 || i === 3 ? "hide-s" : "", t)); });
    tbl.appendChild(hr);
    var order = { submitted: 0, draft: 1, none: 2 };
    others.sort(function (a, b) { return (order[a.status] - order[b.status]) || fbName(a.user_id).localeCompare(fbName(b.user_id)); });
    others.forEach(function (r) {
      var u = fbUser(r.user_id), row = fbEl("div", "fb-row");
      var who = fbEl("div", "fb-who"), av = fbEl("div", "av");
      if (u && u.profile && u.profile.photo) av.style.backgroundImage = "url(" + u.profile.photo + ")";
      else { av.style.background = u ? userAvatarColor(u) : "#999"; av.textContent = fbName(r.user_id).charAt(0).toUpperCase(); }
      var nm = fbEl("div"); nm.append(fbEl("div", "nm", fbName(r.user_id)), fbEl("div", "rl", fbOrgRole(r.user_id) || (u && u.profile && u.profile.title) || ""));
      who.append(av, nm);
      var line = fbLineAbove(r.user_id);
      var ln = fbEl("div", "fb-line hide-s", line ? (line.length ? line.map(function (n) { return n.name; }).join(" → ") : "top of the chart") : "not linked in the chart");
      var stc = fbEl("div");
      stc.appendChild(fbEl("span", "fb-chip " + r.status, r.status === "submitted" ? "✓ Sent " + fbDate(r.submitted_at) : r.status === "draft" ? "✎ Draft" : "Not started"));
      if (r.late) { stc.appendChild(document.createTextNode(" ")); stc.appendChild(fbEl("span", "fb-chip late", "late")); }
      var mt = fbEl("div", "hide-s");
      mt.appendChild(r.discussed_at ? fbEl("span", "fb-chip submitted", "🤝 " + fbDate(r.discussed_at)) : fbEl("span", "hint", r.status === "submitted" ? "to discuss" : "—"));
      var act = fbEl("div");
      if (r.status === "submitted" && r.feedback_id) { var rb = fbEl("button", "btn save", "Read →"); rb.style.padding = "6px 12px"; rb.onclick = function () { fbOpenReader(r.feedback_id); }; act.appendChild(rb); }
      row.append(who, ln, stc, mt, act);
      tbl.appendChild(row);
    });
    holder.appendChild(tbl);
  }).catch(function (e) { holder.className = "hint"; holder.textContent = "Couldn't load: " + fbErr(e); });
}

/* one person's feedback + the meeting notes (seniors and super-admins) */
async function fbOpenReader(id) {
  var r = await SUPA.from("monthly_feedback").select("*").eq("id", id).maybeSingle();
  if (r.error || !r.data) { toast("Couldn't open it: " + (r.error ? r.error.message : "not allowed")); return; }
  var f = r.data, me = currentUser();
  var bg = fbEl("div", "fb-read-bg"), p = fbEl("div", "fb-read");
  bg.setAttribute("role", "dialog"); bg.setAttribute("aria-modal", "true");
  function close() { bg.remove(); document.removeEventListener("keydown", esc); }
  function esc(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", esc);
  var x = fbEl("button", "x", "✕"); x.onclick = close; x.setAttribute("aria-label", "Close"); p.appendChild(x);
  p.appendChild(fbEl("h2", "", fbName(f.user_id)));
  var line = fbLineAbove(f.user_id);
  p.appendChild(fbEl("div", "hint", fbLabel(f.month) + " · sent " + fbDate(f.submitted_at) + (f.late ? " (late)" : "") + (line && line.length ? " · reports to " + line[0].name : "")));
  var meet = fbEl("div", "fb-meet"); meet.style.margin = "16px 0 20px";
  meet.appendChild(fbEl("h4", "", "🤝 Review meeting"));
  if (f.user_id !== me.id) {
    meet.appendChild(fbEl("div", "hint", "Notes and action points from your conversation. " + fbName(f.user_id).split(" ")[0] + " sees them in their own feedback page.")).style.marginBottom = "8px";
    var ta = fbEl("textarea"); ta.value = f.meeting_notes || ""; ta.placeholder = "What you agreed — action points, who does what, by when."; ta.maxLength = 8000;
    var lab = fbEl("label"); lab.style.cssText = "display:flex;gap:8px;align-items:center;margin:10px 0;font-size:14px";
    var cb = fbEl("input"); cb.type = "checkbox"; cb.checked = !!f.discussed_at; lab.append(cb, document.createTextNode("We've had the meeting (" + fbName(f.user_id).split(" ")[0] + " gets a 🔔 with the notes)"));
    var sv = fbEl("button", "btn save", "Save notes");
    sv.onclick = async function () {
      sv.disabled = true;
      var q = await SUPA.rpc("feedback_meeting", { p_id: f.id, p_notes: ta.value, p_discussed: cb.checked });
      sv.disabled = false;
      if (q.error) { toast("Couldn't save: " + q.error.message); return; }
      toast(cb.checked ? "Saved — " + fbName(f.user_id).split(" ")[0] + " can see the notes" : "Notes saved");
      close(); if (typeof mtView !== "undefined" && mtView === "feedback") fbRenderTeamView();
      else if (typeof mtView !== "undefined" && mtView === "org" && typeof renderTeamPage === "function") { var tp = document.getElementById("team-page"); if (tp && tp.style.display !== "none") renderTeamPage(); }
    };
    meet.append(ta, lab, sv);
    if (f.discussed_at) meet.appendChild(fbEl("div", "w", "Discussed " + fbDate(f.discussed_at) + (f.discussed_by ? " · " + fbName(f.discussed_by) : "")));
  } else {
    var mv = fbMeetingView(f); meet = mv || fbEl("div", "hint", "Not discussed yet.");
  }
  if (f.user_id !== me.id) p.appendChild(fbManagerForm(f, close));
  else { var mrv = fbManagerView(f); if (mrv) p.appendChild(mrv); }
  p.appendChild(meet);
  p.appendChild(fbAnswersView(f.answers));
  bg.appendChild(p);
  bg.onclick = function (e) { if (e.target === bg) close(); };
  document.body.appendChild(bg);
}

/* ---------- 📋 the senior's feedback on a month (stage 22d: monthly_feedback.manager_review) ---------- */
var FB_RATING = [["1", "Needs improvement"], ["2", "Below expectations"], ["3", "Meets expectations"], ["4", "Exceeds expectations"], ["5", "Outstanding"]];
var FB_MR = [
  { k: "well", label: "What went well", ph: "Specific things they did well this month" },
  { k: "improve", label: "What to improve", ph: "One or two things to work on, with an example" },
  { k: "focus", label: "Focus for next month", ph: "What matters most for them next month" },
  { k: "support", label: "How you'll support them", ph: "What you'll do to help — time, decisions, training…" }
];
function fbManagerForm(f, onDone) {
  var rv = Object.assign({ traits_pos: [], traits_neg: [] }, f.manager_review || {});
  var first = fbName(f.user_id).split(" ")[0];
  var box = fbEl("div", "fb-mr");
  box.appendChild(fbEl("h4", "", "📋 Your feedback for " + first + (rv.shared ? " · shared " + fbDate(rv.shared_at) : "")));
  box.appendChild(fbEl("div", "hint", "Based on their feedback below. It stays a draft until you share it; then " + first + " sees it and gets a 🔔."));
  var q = fbEl("div", "fb-q"); q.appendChild(fbEl("label", "fb-l", "Overall, this month"));
  var opts = fbEl("div", "fb-opts");
  FB_RATING.forEach(function (o) {
    var b = fbEl("button", "fb-opt" + (String(rv.rating) === o[0] ? " on" : "")); b.type = "button";
    b.append(fbEl("span", "e", o[0]), fbEl("span", "n", o[1]));
    b.onclick = function () { rv.rating = o[0]; [].forEach.call(opts.children, function (x) { x.classList.remove("on"); }); b.classList.add("on"); };
    opts.appendChild(b);
  });
  q.appendChild(opts); box.appendChild(q);
  FB_MR.forEach(function (m) {
    var qq = fbEl("div", "fb-q"); qq.appendChild(fbEl("label", "fb-l", m.label));
    var t = fbEl("textarea"); t.value = rv[m.k] || ""; t.placeholder = m.ph; t.maxLength = 3000; t.oninput = function () { rv[m.k] = t.value; };
    qq.appendChild(t); box.appendChild(qq);
  });
  /* how you see them: tick the traits — compared with what they ticked themselves */
  var tq = fbEl("div", "fb-q"); tq.appendChild(fbEl("label", "fb-l", "How you see " + first + " — tick the traits"));
  tq.appendChild(fbEl("div", "fb-h", "They'll see where you agree with their own ticks and where you differ."));
  var cols = fbEl("div", "fb-traits");
  [["pos", "Positive", FB_TRAITS_POS], ["neg", "Negative", FB_TRAITS_NEG]].forEach(function (g) {
    var key = "traits_" + g[0], col = fbEl("div", "fb-tcol " + g[0]);
    col.appendChild(fbEl("div", "fb-thead", g[1] + " traits"));
    var list = fbEl("div", "fb-tlist");
    g[2].forEach(function (t) {
      var lb = fbEl("label", "fb-tr " + g[0] + (rv[key].indexOf(t) >= 0 ? " on" : "")), cb = fbEl("input"); cb.type = "checkbox"; cb.checked = rv[key].indexOf(t) >= 0;
      cb.onchange = function () { var i = rv[key].indexOf(t); if (cb.checked && i < 0) rv[key].push(t); else if (!cb.checked && i >= 0) rv[key].splice(i, 1); lb.classList.toggle("on", cb.checked); };
      lb.append(cb, document.createTextNode(" " + t)); list.appendChild(lb);
    });
    col.appendChild(list); cols.appendChild(col);
  });
  tq.appendChild(cols); box.appendChild(tq);
  var bar = fbEl("div"); bar.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:8px";
  var save = async function (share) {
    if (share && !rv.rating) { toast("Pick an overall rating first"); return; }
    var out = { rating: rv.rating || null, traits_pos: rv.traits_pos, traits_neg: rv.traits_neg };
    FB_MR.forEach(function (m) { out[m.k] = (rv[m.k] || "").trim(); });
    var r = await SUPA.rpc("feedback_manager_review", { p_id: f.id, p_review: out, p_share: !!share });
    if (r.error) { toast("Couldn't save: " + r.error.message); return; }
    f.manager_review = r.data && r.data.manager_review;
    toast(share ? "Shared — " + first + " can see it now" : "Draft saved");
    if (share && onDone) onDone();
  };
  var d = fbEl("button", "btn", "Save draft"); d.onclick = function () { save(false); };
  var sh = fbEl("button", "btn save", rv.shared ? "Update ✓" : "Share with " + first + " ✓"); sh.onclick = function () { save(true); };
  bar.append(d, sh); box.appendChild(bar);
  return box;
}
/* what the person sees, once it's shared */
function fbManagerView(row) {
  var rv = row && row.manager_review;
  if (!rv || !rv.shared) return null;
  var m = fbEl("div", "fb-mr view");
  m.appendChild(fbEl("h4", "", "📋 Senior's feedback" + (rv.by ? " · " + fbName(rv.by) : "")));
  if (rv.rating) { var rt = FB_RATING[+rv.rating - 1]; var b = fbEl("div", "fb-mrate"); b.append(fbEl("b", "", rv.rating + "/5"), fbEl("span", "", rt ? rt[1] : "")); m.appendChild(b); }
  FB_MR.forEach(function (q) { if (!rv[q.k]) return; var a = fbEl("div", "fb-ans"); a.append(fbEl("div", "q", q.k === "support" ? "How your senior will support you" : q.label), fbEl("div", "a", rv[q.k])); m.appendChild(a); });
  /* their view of the traits against the person's own */
  var own = (row.answers || {}), oP = own.traits_pos || [], oN = own.traits_neg || [], mP = rv.traits_pos || [], mN = rv.traits_neg || [];
  if (mP.length || mN.length) {
    var tg = function (title, list, cls) { if (!list.length) return; m.appendChild(fbEl("div", "q fb-mrq", title)); var w = fbEl("div", "fb-trview"); list.forEach(function (t) { w.appendChild(fbEl("span", "fb-tr " + (cls === "auto" ? (FB_TRAITS_NEG.indexOf(t) >= 0 ? "neg" : "pos") : cls) + " on", t)); }); m.appendChild(w); };
    tg("You both see", mP.filter(function (t) { return oP.indexOf(t) >= 0; }).concat(mN.filter(function (t) { return oN.indexOf(t) >= 0; })), "auto");
    tg("Your senior sees — you didn't tick", mP.filter(function (t) { return oP.indexOf(t) < 0; }), "pos");
    tg("Your senior sees to work on — you didn't tick", mN.filter(function (t) { return oN.indexOf(t) < 0; }), "neg");
    tg("You ticked — your senior didn't", oP.filter(function (t) { return mP.indexOf(t) < 0; }).concat(oN.filter(function (t) { return mN.indexOf(t) < 0; })), "mute");
  }
  if (rv.shared_at) m.appendChild(fbEl("div", "w", "Shared " + fbDate(rv.shared_at)));
  return m;
}

function fbSettingsDialog() {
  var bg = fbEl("div", "overlay show"), dlg = fbEl("div", "dialog"); dlg.style.maxWidth = "460px"; bg.style.zIndex = "460";   /* above the My Team page (390) */
  dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true");
  dlg.appendChild(fbEl("h3", "", "Monthly feedback settings"));
  var body = fbEl("div", "dlg-body");
  var on = fbEl("label"); on.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:14px";
  var cb = fbEl("input"); cb.type = "checkbox"; cb.checked = fbEnabled(); on.append(cb, document.createTextNode("Ask everyone for feedback every month"));
  var f = fbEl("div", "field"); var l = fbEl("label", "", "The form opens on day"); var s = fbEl("select");
  for (var d = 15; d <= 28; d++) { var o = fbEl("option", "", d + " of the month"); o.value = d; if (d === fbOpenDay()) o.selected = true; s.appendChild(o); }
  f.append(l, s);
  var h = fbEl("div", "hint", "From that day, everyone who hasn't sent theirs gets a 🔔 and a pop-up every morning (9:30) until they do. It's due on the last day of the month; late sends are allowed until the 10th of the next month.");
  h.style.marginTop = "10px";
  var fe = fbEl("div", "field"); fe.style.marginTop = "14px";
  var le = fbEl("label", "", "Reminder emails a day"); var se = fbEl("select");
  var curE = FB.settings && FB.settings.emails_per_day != null ? FB.settings.emails_per_day : 1;
  [[0, "No emails"], [1, "1 a day"], [2, "2 a day"], [3, "3 a day"]].forEach(function (x) { var o = fbEl("option", "", x[1]); o.value = x[0]; if (x[0] === curE) o.selected = true; se.appendChild(o); });
  fe.append(le, se);
  var stl = fbEl("label"); stl.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:12px";
  var stc = fbEl("input"); stc.type = "checkbox"; stc.checked = !FB.settings || FB.settings.strip !== false;
  stl.append(stc, document.createTextNode("Show a “feedback pending” strip at the top of every page"));
  var h2 = fbEl("div", "hint", "Until someone sends theirs they also get emails, the strip, and a “pending” mark on their account menu. Super-admins are left out.");
  h2.style.marginTop = "8px";
  var okl = fbEl("label"); okl.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:16px";
  var okc = fbEl("input"); okc.type = "checkbox"; okc.checked = !FB.settings || FB.settings.okr_on !== false;
  okl.append(okc, document.createTextNode("🎯 OKR check-in twice a month"));
  var fm = fbEl("div", "field"); fm.style.marginTop = "8px";
  var lm = fbEl("label", "", "Mid-month check-in on day"); var sm = fbEl("select");
  var curM = (FB.settings && FB.settings.okr_mid_day) || 15;
  for (var md = 5; md <= 25; md++) { var om = fbEl("option", "", md + " of the month"); om.value = md; if (md === curM) om.selected = true; sm.appendChild(om); }
  fm.append(lm, sm);
  var h3 = fbEl("div", "hint", "Everyone who owns an objective or key result updates their numbers on that day, and again at month end together with their feedback. Same reminders as the feedback until it's done.");
  h3.style.marginTop = "6px";
  body.append(on, f, h, fe, stl, h2, okl, fm, h3);
  var btns = fbEl("div", "btns");
  var c = fbEl("button", "btn", "Cancel"), sv = fbEl("button", "btn save", "Save");
  c.onclick = function () { bg.remove(); };
  sv.onclick = async function () {
    sv.disabled = true;
    var r = await SUPA.rpc("feedback_set_settings", { p_team: TEAM, p_enabled: cb.checked, p_open_day: +s.value });
    if (!r.error) {
      var r2 = await SUPA.rpc("feedback_set_nudges", { p_team: TEAM, p_emails: +se.value, p_strip: stc.checked });
      if (r2.error) { sv.disabled = false; toast("Couldn't save the reminders: " + r2.error.message); return; }
      r = r2;
      var r3 = await SUPA.rpc("okr_set_checkin", { p_team: TEAM, p_on: okc.checked, p_mid_day: +sm.value });
      if (r3.error) { sv.disabled = false; toast("Couldn't save the OKR check-in: " + r3.error.message); return; }
      r = r3;
    }
    sv.disabled = false;
    if (r.error) { toast("Couldn't save: " + r.error.message); return; }
    FB.settings = r.data; bg.remove(); toast("Saved"); fbRenderTeamView(); fbNudgeCheck();
  };
  btns.append(c, sv); dlg.append(body, btns); bg.appendChild(dlg);
  bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
  document.body.appendChild(bg);
}

/* =====================================================================
   Administration → 📮 Send to Sumit (everyone)
   ===================================================================== */
function renderAdminSendBox(wrap) {
  var boss = fbBoss();
  var head = fbEl("div", "admin-userhead"), left = fbEl("div");
  var h2 = fbEl("h2", "", "📮 Send to " + boss); h2.style.margin = "0";
  var sub = fbEl("div", "hint", "A suggestion, something to improve, a complaint, or a thank-you — it goes straight to " + boss + " and nobody else. Send it with your name, or anonymously.");
  sub.style.marginTop = "4px"; left.append(h2, sub); head.appendChild(left); wrap.appendChild(head);
  var card = fbEl("div", "fb-card");
  var kind = "suggestion", anon = true;
  card.appendChild(fbEl("div", "fb-l", "What is it?")).style.cssText = "font-weight:650;margin-bottom:8px";
  var kinds = fbEl("div", "fb-kinds");
  FB_KINDS.forEach(function (k) {
    var b = fbEl("button", "fb-opt" + (k[0] === kind ? " on" : ""), k[1]); b.type = "button";
    b.onclick = function () { kind = k[0]; [].forEach.call(kinds.children, function (x) { x.classList.remove("on"); }); b.classList.add("on"); };
    kinds.appendChild(b);
  });
  card.appendChild(kinds);
  var ta = fbEl("textarea"); ta.maxLength = 5000; ta.placeholder = "Say it the way you'd say it to " + boss + " over chai.";
  ta.style.cssText = "width:100%;min-height:130px;border:1px solid var(--line-strong);border-radius:10px;padding:10px 12px;font-size:14px";
  card.appendChild(ta);
  var who = fbEl("div", "fb-anon");
  var a1 = fbEl("button", "fb-opt on"), a2 = fbEl("button", "fb-opt");
  a1.type = a2.type = "button";
  a1.innerHTML = "<span class='e'>🤫</span><span><b>Anonymously</b><br><span class='n'>We don't save who sent it — not even the time, only the day.</span></span>";
  a2.innerHTML = "<span class='e'>🙋</span><span><b>With my name</b><br><span class='n'>" + boss + " sees it's from you and can follow up.</span></span>";
  a1.onclick = function () { anon = true; a1.classList.add("on"); a2.classList.remove("on"); };
  a2.onclick = function () { anon = false; a2.classList.add("on"); a1.classList.remove("on"); };
  who.append(a1, a2); card.appendChild(who);
  var send = fbEl("button", "btn save", "Send to " + boss + " →");
  send.onclick = async function () {
    if (ta.value.trim().length < 3) { ta.focus(); toast("Write a little more"); return; }
    send.disabled = true;
    var r = await SUPA.rpc("suggestion_send", { p_team: TEAM, p_kind: kind, p_body: ta.value, p_anonymous: anon });
    send.disabled = false;
    if (r.error) { toast("Couldn't send: " + r.error.message); return; }
    ta.value = ""; toast(anon ? "Sent anonymously — thank you 💛" : "Sent — thank you 💛");
    loadMine();
  };
  card.appendChild(send);
  wrap.appendChild(card);
  var minel = fbEl("div"); wrap.appendChild(minel);
  function loadMine() {
    SUPA.from("suggestion_box").select("id,kind,body,created_at,status").eq("team_slug", TEAM).eq("from_user", currentUser().id).order("created_at", { ascending: false }).limit(30).then(function (r) {
      minel.innerHTML = "";
      var rows = r.data || []; if (!rows.length) return;
      minel.appendChild(fbEl("h3", "", "Sent with your name")).style.margin = "20px 0 10px";
      rows.forEach(function (x) {
        var b = fbEl("div", "fb-box"), top = fbEl("div", "top");
        top.append(fbEl("span", "fb-chip talk", (FB_KINDS.find(function (k) { return k[0] === x.kind; }) || ["", x.kind])[1]),
          fbEl("span", "", fbDate(x.created_at)), fbEl("span", "fb-chip " + (x.status === "new" ? "draft" : "submitted"), x.status === "new" ? "not read yet" : x.status === "read" ? "read by " + boss : "✓ done"));
        b.append(top, fbEl("div", "msg", x.body)); minel.appendChild(b);
      });
      minel.appendChild(fbEl("div", "hint", "Anonymous ones don't show here — they aren't linked to you anywhere.")).style.marginTop = "6px";
    });
  }
  loadMine();
}

/* =====================================================================
   Administration → 📮 Suggestion box (super-admins)
   ===================================================================== */
var FB_BOX_FILTER = "new";
function renderAdminSuggestionBox(wrap) {
  var head = fbEl("div", "admin-userhead"), left = fbEl("div");
  var h2 = fbEl("h2", "", "📮 Suggestion box"); h2.style.margin = "0";
  var sub = fbEl("div", "hint", "What the team sent you — only you can read this. Anonymous ones carry no name and only the day they came in.");
  sub.style.marginTop = "4px"; left.append(h2, sub); head.appendChild(left); wrap.appendChild(head);
  var tabs = fbEl("div", "fb-kinds");
  [["new", "New"], ["read", "Read"], ["done", "Done"], ["all", "All"]].forEach(function (t) {
    var b = fbEl("button", "fb-opt" + (FB_BOX_FILTER === t[0] ? " on" : ""), t[1]); b.type = "button";
    b.onclick = function () { FB_BOX_FILTER = t[0]; wrap.innerHTML = ""; renderAdminSuggestionBox(wrap); };
    tabs.appendChild(b);
  });
  wrap.appendChild(tabs);
  var list = fbEl("div", "hint", "Loading…"); wrap.appendChild(list);
  var q = SUPA.from("suggestion_box").select("*").eq("team_slug", TEAM).order("created_on", { ascending: false }).order("created_at", { ascending: false, nullsFirst: false }).limit(300);
  if (FB_BOX_FILTER !== "all") q = q.eq("status", FB_BOX_FILTER);
  q.then(function (r) {
    list.className = ""; list.innerHTML = "";
    if (r.error) { list.className = "hint"; list.textContent = "Couldn't load: " + r.error.message; return; }
    var rows = r.data || [];
    if (!rows.length) { list.appendChild(fbEl("div", "fb-empty", FB_BOX_FILTER === "new" ? "Nothing new. 📭" : "Nothing here.")); return; }
    rows.forEach(function (x) {
      var b = fbEl("div", "fb-box" + (x.status === "new" ? " new" : "")), top = fbEl("div", "top");
      top.append(fbEl("span", "fb-chip talk", (FB_KINDS.find(function (k) { return k[0] === x.kind; }) || ["", x.kind])[1]),
        fbEl("b", "", x.from_user ? "🙋 " + fbName(x.from_user) : "🤫 Anonymous"),
        fbEl("span", "", x.created_at ? new Date(x.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : new Date(x.created_on + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })));
      b.append(top, fbEl("div", "msg", x.body));
      var acts = fbEl("div", "acts");
      [["read", "Mark read"], ["done", "✓ Done"], ["new", "Back to new"]].forEach(function (s) {
        if (s[0] === x.status) return;
        var btn = fbEl("button", "btn", s[1]); btn.style.padding = "5px 11px"; btn.style.fontSize = "12.5px";
        btn.onclick = async function () {
          var u = await SUPA.from("suggestion_box").update({ status: s[0] }).eq("id", x.id);
          if (u.error) { toast("Couldn't update: " + u.error.message); return; }
          wrap.innerHTML = ""; renderAdminSuggestionBox(wrap);
        };
        acts.appendChild(btn);
      });
      b.appendChild(acts);
      list.appendChild(b);
    });
  });
}

/* =====================================================================
   Feedback pending: strip at the top, a mark on the account menu, a nudge
   once a day (stage 22a, feedback_me). Checked on load, every 10 minutes,
   and right after sending. ?fb=1 (the reminder email's button) opens the form.
   ===================================================================== */
var FBN = { me: null, timer: null };
function fbOpenForm() {
  if (typeof closePerformance === "function") closePerformance();
  if (typeof hrClosePage === "function") { var hp = document.getElementById("hr-page"); if (hp && hp.style.display !== "none") hrClosePage(); }
  if (typeof closeTeam === "function") closeTeam();
  if (typeof openAdmin === "function") openAdmin("myfeedback");
}
function fbDueText(s) {
  var d = function (iso) { var a = String(iso).split("-"); return new Date(+a[0], +a[1] - 1, +a[2]).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
  return s.late ? "It was due " + d(s.due) + " — send it by " + d(s.late_until) + "." : "Please send it by " + d(s.due) + ".";
}
async function fbNudgeCheck() {
  if (!SUPA || typeof TEAM === "undefined" || !TEAM || !currentUser()) return;
  var res = await Promise.all([SUPA.rpc("feedback_me", { p_team: TEAM }), SUPA.rpc("okr_me", { p_team: TEAM })]);
  var r = res[0], ro = res[1];
  var s = (!r.error && r.data) || { pending: false };
  var o = (!ro.error && ro.data) || { pending: false };   /* stage 22a / 22b not run yet: stay quiet */
  FBN.me = s; FBN.okr = o;
  fbNudgeStrip(s.pending && s.strip ? s : null, o.pending && o.strip !== false ? o : null);
  fbNudgeMark(s.pending ? s : null);
  okrNudgeMark(o.pending ? o : null);
  var day = new Date().toISOString().slice(0, 10);
  if (s.pending) {
    var key = "fb-nudge-" + s.month + "-" + day;
    try { if (!localStorage.getItem(key)) { localStorage.setItem(key, "1"); toast("📝 Your " + fbLabel(s.month, true) + " feedback is pending: Administration → My monthly feedback"); } } catch (_) { }
  } else if (o.pending) {
    var key2 = "okr-nudge-" + o.period + "-" + day;
    try { if (!localStorage.getItem(key2)) { localStorage.setItem(key2, "1"); toast("🎯 Your OKR check-in is waiting: Administration → My OKR check-in"); } } catch (_) { }
  }
}
function fbNudgeStrip(s, o) {
  var bar = document.getElementById("fb-strip");
  document.documentElement.classList.toggle("fb-strip-on", !!(s || o));
  if (!s && !o) { if (bar) bar.remove(); return; }
  if (!bar) { bar = fbEl("div"); bar.id = "fb-strip"; document.body.appendChild(bar); }
  bar.innerHTML = "";
  var txt, label, open;
  if (s && o) { txt = "📝 Your " + fbLabel(s.month, true) + " feedback and 🎯 OKR check-in are " + (s.late ? "overdue" : "waiting") + ". " + fbDueText(s); label = "Fill it now →"; open = fbOpenForm; }
  else if (s) { txt = "📝 Your " + fbLabel(s.month, true) + " feedback is " + (s.late ? "overdue" : "pending") + ". " + fbDueText(s); label = s.draft ? "Finish it →" : "Fill it now →"; open = fbOpenForm; }
  else { txt = "🎯 " + (o.kind === "mid" ? "Your mid-month OKR check-in is waiting." : "Your " + fbLabel(o.period.slice(0, 7), true) + " OKR check-in is waiting.") + " Update the numbers on your key results."; label = "Update my OKRs →"; open = okrOpenCheckin; }
  var t = fbEl("span", "t", txt);
  var go = fbEl("button", null, label); go.type = "button"; go.onclick = open;
  bar.append(t, go);
  bar.classList.toggle("urgent", !!(s && s.late));
}
function okrOpenCheckin() {
  if (typeof closePerformance === "function") closePerformance();
  if (typeof hrClosePage === "function") { var hp = document.getElementById("hr-page"); if (hp && hp.style.display !== "none") hrClosePage(); }
  if (typeof closeTeam === "function") closeTeam();
  if (typeof openAdmin === "function") openAdmin("okrcheckin");
}
function okrNudgeMark(o) {
  var nav = document.getElementById("nav-account");
  if (nav) nav.classList.toggle("okr-pending", !!o);
  var item = document.getElementById("acct-okr");
  if (!o) { if (item) item.remove(); return; }
  if (!item) {
    var after = document.getElementById("acct-fb") || document.getElementById("acct-hr") || document.getElementById("acct-profile");
    if (!after) return;
    item = fbEl("button", "acct-item"); item.id = "acct-okr";
    item.onclick = function () { var ov = document.getElementById("account-overlay"); if (ov) ov.classList.remove("show"); okrOpenCheckin(); };
    after.parentNode.insertBefore(item, after.nextSibling);
  }
  item.innerHTML = "";
  item.append(document.createTextNode("🎯 OKR check-in "), fbEl("span", "fb-pend", "Pending"));
}
function fbNudgeMark(s) {
  var nav = document.getElementById("nav-account");
  if (nav) { nav.classList.toggle("fb-pending", !!s); if (s) nav.title = "Your account — your " + fbLabel(s.month, true) + " feedback is pending"; }
  var item = document.getElementById("acct-fb");
  if (!s) { if (item) item.remove(); return; }
  if (!item) {
    var after = document.getElementById("acct-hr") || document.getElementById("acct-profile");
    if (!after) return;
    item = fbEl("button", "acct-item"); item.id = "acct-fb";
    item.onclick = function () { var o = document.getElementById("account-overlay"); if (o) o.classList.remove("show"); fbOpenForm(); };
    after.parentNode.insertBefore(item, after.nextSibling);
  }
  item.innerHTML = "";
  item.append(document.createTextNode("📝 Monthly feedback "), fbEl("span", "fb-pend", s.late ? "Overdue" : "Pending"));
}
(function () {
  var css = "#fb-strip{position:fixed;top:0;left:0;right:0;z-index:394;height:44px;display:flex;align-items:center;justify-content:center;gap:14px;padding:0 16px;"
    + "background:#EEF2FF;border-bottom:1px solid #C7D2FE;color:#312E81;font:600 13.5px var(--sans,system-ui);box-shadow:0 1px 6px rgba(0,0,0,.05)}"
    + "#fb-strip.urgent{background:#FDE8E6;border-color:#F3B9B2;color:#8E1F14}"
    + "#fb-strip .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}"
    + "#fb-strip button{flex:none;border:0;border-radius:99px;background:#E8622B;color:#fff;font:700 12.5px var(--sans,system-ui);padding:7px 14px;cursor:pointer}"
    + "html.fb-strip-on body{padding-top:44px}"
    + "html.fb-strip-on .admin-page,html.fb-strip-on .product-page,html.fb-strip-on .team-page,html.fb-strip-on .docs-page,html.fb-strip-on .hr-page{top:44px}"
    /* both strips: HR's on top, this one under it */
    + "html.fb-strip-on.hr-strip-on #fb-strip{top:44px}"
    + "html.fb-strip-on.hr-strip-on body{padding-top:88px}"
    + "html.fb-strip-on.hr-strip-on .admin-page,html.fb-strip-on.hr-strip-on .product-page,html.fb-strip-on.hr-strip-on .team-page,html.fb-strip-on.hr-strip-on .docs-page,html.fb-strip-on.hr-strip-on .hr-page{top:88px}"
    + "#nav-account.fb-pending,#nav-account.okr-pending{position:relative}"
    + "#nav-account.fb-pending::after,#nav-account.okr-pending::after{content:'';position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;background:#E5484D;box-shadow:0 0 0 2px var(--card,#fff)}"
    + ".fb-pend{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;border-radius:99px;padding:2px 8px;background:#FDE8E6;color:#B42318}"
    + "@media(max-width:640px){#fb-strip{height:auto;min-height:44px;padding:6px 12px;font-size:12.5px}#fb-strip .t{white-space:normal}}";
  var st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st);
})();
(function () {
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (tries > 240) { clearInterval(t); return; }
    if (typeof SUPA === "undefined" || !SUPA || typeof currentUser !== "function" || !currentUser() || typeof TEAM === "undefined" || !TEAM) return;
    clearInterval(t);
    fbNudgeCheck(); clearInterval(FBN.timer); FBN.timer = setInterval(function () { if (!document.hidden) fbNudgeCheck(); }, 10 * 60000);
    var q = null; try { q = new URL(location.href).searchParams; } catch (_) { }
    if (q && q.get("fb") === "1") setTimeout(fbOpenForm, 300);
    else if (q && q.get("okr") === "1") setTimeout(okrOpenCheckin, 300);
  }, 500);
})();

/* =====================================================================
   🎯 OKR check-in (stage 22b): twice a month — on the mid-month day and at
   month end with the feedback — everyone updates the numbers on the key
   results they own (all key results of objectives they own). Saved through
   okr_checkin_save(), which writes the numbers into the team's OKRs and
   records the check-in, so the reminders stop.
   ===================================================================== */
function okrMyItems() {
  var me = currentUser(); if (!me || typeof OKRS === "undefined" || !OKRS || !(OKRS.cycles || []).length) return { cyc: null, list: [] };
  var cyc = OKRS.cycles[OKRS.cycles.length - 1], em = String(me.email || "").toLowerCase(), list = [];
  var has = function (arr) { return (arr || []).some(function (e) { return String(e || "").toLowerCase() === em; }); };
  (cyc.objectives || []).forEach(function (ob) {
    var ownObj = has(okrOwners(ob));
    (ob.krs || []).forEach(function (k, i) { if (ownObj || has(krOwners(k))) list.push({ ob: ob, kr: k, k: i }); });
  });
  return { cyc: cyc, list: list };
}
function okrCheckinCard(box, info, inFeedback) {
  box.innerHTML = "";
  var my = okrMyItems();
  var card = fbEl("div", "fb-card okr-ci");
  var h = fbEl("h3", "", info && info.pending ? (info.kind === "mid" ? "🎯 Mid-month OKR check-in" : "🎯 " + fbLabel(info.period.slice(0, 7), true) + " OKR check-in")
    : "🎯 Update your OKRs");
  card.appendChild(h);
  var p = fbEl("p", "hint", (inFeedback ? "Before your feedback, update" : "Update") + " the current number on each of your key results" + (my.cyc ? " in " + (my.cyc.name || my.cyc.key) : "") + ". Leave a number as it is if it hasn't moved.");
  card.appendChild(p);
  if (!my.list.length) { card.appendChild(fbEl("div", "fb-empty", "You don't own any key results in the current cycle.")); box.appendChild(card); return; }
  var rows = [], lastOb = null;
  my.list.forEach(function (x) {
    if (x.ob !== lastOb) { lastOb = x.ob; card.appendChild(fbEl("div", "okr-ci-ob", x.ob.title || "Objective")); }
    var row = fbEl("div", "okr-ci-row");
    var t = fbEl("div", "okr-ci-t", x.kr.title || "Key result");
    var inp = fbEl("input"); inp.type = "number"; inp.step = "any"; inp.value = x.kr.current != null ? x.kr.current : 0;
    var of = fbEl("span", "okr-ci-of", "/ " + fmt(x.kr.target) + (x.kr.unit ? " " + x.kr.unit : ""));
    var pc = fbEl("span", "okr-ci-pct", krPct(x.kr) + "%");
    inp.oninput = function () { var tmp = Object.assign({}, x.kr, { current: Number(inp.value) || 0 }); pc.textContent = krPct(tmp) + "%"; };
    var r = fbEl("div", "okr-ci-in"); r.append(inp, of, pc);
    row.append(t, r); card.appendChild(row);
    rows.push({ x: x, inp: inp });
  });
  var note = fbEl("textarea"); note.placeholder = "Anything to add? (optional) — what moved, what's stuck"; note.maxLength = 4000;
  note.style.cssText = "width:100%;min-height:60px;border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;font-size:13.5px;margin-top:12px";
  card.appendChild(note);
  var bar = fbEl("div"); bar.style.cssText = "display:flex;gap:10px;align-items:center;margin-top:12px";
  var st = fbEl("span", "hint", ""); st.style.marginRight = "auto";
  var sv = fbEl("button", "btn save", info && info.pending ? "Save check-in ✓" : "Save numbers");
  sv.onclick = async function () {
    var ups = rows.map(function (r) { return { oid: r.x.ob.id, k: r.x.k, current: Number(r.inp.value) || 0 }; });
    sv.disabled = true; st.textContent = "Saving…";
    var res = await SUPA.rpc("okr_checkin_save", { p_team: TEAM, p_period: info && info.pending ? info.period : null, p_updates: ups, p_note: note.value });
    sv.disabled = false;
    if (res.error) { st.textContent = "Couldn't save: " + res.error.message; toast("Couldn't save: " + res.error.message); return; }
    rows.forEach(function (r, i) { r.x.kr.current = ups[i].current; r.x.kr.checkedAt = new Date().toISOString(); });
    toast(info && info.pending ? "🎯 Check-in saved — thank you!" : "Saved");
    fbNudgeCheck();
    if (info && info.pending) { box.innerHTML = ""; var ok = fbEl("div", "fb-card fb-hero"); ok.appendChild(fbEl("h3", "", "✅ OKR check-in done")); ok.appendChild(fbEl("p", "", "Your numbers are updated on the OKRs.")); box.appendChild(ok); }
    else st.textContent = "Saved";
  };
  bar.append(st, sv); card.appendChild(bar);
  box.appendChild(card);
}
/* Administration → 🎯 My OKR check-in */
function renderAdminOkrCheckin(wrap) {
  var head = fbEl("div", "admin-userhead"), left = fbEl("div");
  var h2 = fbEl("h2", "", "🎯 My OKR check-in"); h2.style.margin = "0";
  var sub = fbEl("div", "hint", "Twice a month — mid-month and at month end with your feedback — update the numbers on your key results. You can update them here any time.");
  sub.style.marginTop = "4px"; left.append(h2, sub); head.appendChild(left); wrap.appendChild(head);
  var box = fbEl("div", "hint", "Loading…"); wrap.appendChild(box);
  SUPA.rpc("okr_me", { p_team: TEAM }).then(function (o) {
    box.className = "";
    okrCheckinCard(box, (!o.error && o.data) || { pending: false }, false);
  });
}
(function () {
  var css = ".okr-ci h3{margin:0 0 4px;font-size:17px}.okr-ci>.hint{margin:0 0 10px}"
    + ".okr-ci-ob{font-weight:700;font-size:13.5px;margin:14px 0 4px;color:var(--ink)}"
    + ".okr-ci-row{display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px dashed var(--line)}"
    + ".okr-ci-t{flex:1;min-width:0;font-size:13.5px}"
    + ".okr-ci-in{display:flex;align-items:center;gap:8px;flex:none}"
    + ".okr-ci-in input{width:96px;border:1px solid var(--line-strong);border-radius:8px;padding:6px 8px;font:inherit;font-size:14px;background:#fff}"
    + ".okr-ci-of{font-family:var(--mono);font-size:12px;color:var(--muted);white-space:nowrap;min-width:64px}"
    + ".okr-ci-pct{font-family:var(--mono);font-size:12px;font-weight:700;width:42px;text-align:right}"
    + "@media(max-width:640px){.okr-ci-row{flex-direction:column;align-items:stretch}}";
  var st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st);
})();

/* =====================================================================
   My Team → Reporting lines: each box below you shows that person's
   monthly feedback for the month being filled now (or last month once the
   window has closed): sent → "Review →" opens it to read and write the
   review; reviewed; or not sent yet. Same visibility as the Monthly
   feedback tab (feedback_overview): you see the people below you.
   ===================================================================== */
async function fbOrgChips(canvas) {
  if (!SUPA || !currentUser()) return;
  await fbLoadSettings();
  var month = fbTargetMonth() || fbPrev();
  var r = await SUPA.rpc("feedback_overview", { p_team: TEAM, p_month: month });
  if (r.error || !r.data) return;
  var me = currentUser().id, by = {}, shared = {};
  r.data.forEach(function (x) { by[x.user_id] = x; });
  /* has the senior's feedback been shared yet? (you can read the sent feedback of the people below you) */
  try {
    var mr = await SUPA.from("monthly_feedback").select("user_id,manager_review").eq("team_slug", TEAM).eq("month", month).eq("status", "submitted");
    (mr.data || []).forEach(function (x) { shared[x.user_id] = !!(x.manager_review && x.manager_review.shared); });
  } catch (_) { }
  var mon = fbLabel(month, true).slice(0, 3);
  var isSuper = !!(currentUser() && currentUser().super);
  canvas.querySelectorAll(".mt-node[data-uid]").forEach(function (node) {
    var x = by[node.getAttribute("data-uid")];
    if (!x || x.user_id === me || node.querySelector(".mt-fb")) return;
    var c = fbEl("span", "mt-fb");
    if (x.status === "submitted" && x.feedback_id) {
      /* their direct senior (the nearest linked box above them) writes the feedback; others above can read it */
      var dm = (fbLineAbove(x.user_id) || []).find(function (n) { return n.uid; }), direct = isSuper || (dm && dm.uid === me);
      if (shared[x.user_id]) { c.classList.add("done"); c.textContent = "✓ " + mon + " feedback given" + (x.discussed_at ? " · met" : ""); }
      else if (direct) { c.classList.add("todo"); c.textContent = "📋 Write your " + mon + " feedback →"; }
      else { c.classList.add("done"); c.textContent = "📝 " + mon + " feedback sent · Read"; }
      c.title = direct && !shared[x.user_id] ? "Read " + fbName(x.user_id) + "’s " + fbLabel(month, true) + " feedback and write yours for them" : "Read " + fbName(x.user_id) + "’s " + fbLabel(month, true) + " feedback";
      c.onclick = function (e) { e.stopPropagation(); fbOpenReader(x.feedback_id); };
    } else {
      c.classList.add("wait"); c.textContent = "📝 " + mon + " feedback not sent yet";
      c.title = "Nothing to review until they send it";
    }
    node.appendChild(c);
  });
}
(function () {
  var css = ".mt-fb{margin-top:7px;display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:650;border-radius:99px;padding:4px 10px;white-space:nowrap}"
    + ".mt-fb.todo{background:#E8622B;color:#fff;cursor:pointer}.mt-fb.todo:hover{background:#C94F1C}"
    + ".mt-fb.done{background:var(--done-bg,#E3F4EA);color:var(--done,#2E9466);cursor:pointer}"
    + ".mt-fb.wait{background:#EEF1F5;color:#64748B}";
  var st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st);
})();
