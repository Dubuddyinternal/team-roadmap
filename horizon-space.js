/* =====================================================================
   WIDEN OUR HORIZON — Topics · Fill this week · Weekly check · Learnings
   (Cyberflow team app, tools.dubuddy.in)

   WHAT THIS IS: big questions we want someone to keep reading about,
   every week — "What kind of startups is YC backing?", "What's happening
   in AI and what apps could we build?", "What would a B2B company like
   Zoho take?". It is its own space in the sidebar (index.html, type
   "horizon", added from Administration → Spaces).
     * Topics — each question, who answers it every week, and who checks it.
       Starter topics (YC, AI, B2B like Zoho) fill in the weekly questions.
     * Fill this week — a fixed weekly template: this week in 5 lines, the
       topic's own questions, 3 examples with links, what we can take away,
       something we could build, sources, questions for next week.
       "Submit for check" when every MUST FILL box is done.
     * Weekly check — every topic × the last 6 weeks at a glance, and the
       ones waiting for you: Mark checked, or Ask for more with a note.
     * Learnings — every takeaway and build idea, newest week first.
   index.html calls HX.render(space, host, opt); drawn inside a shadow root.
   Data is saved with the team (team_data "cspaces") through opt.save /
   opt.saveQuiet (quiet = no page redraw, used while typing).
   ===================================================================== */
(function(){
"use strict";

const CSS = `:host{display:block;color-scheme:light;
  --bg:#FCFBF8; --surface:#FFFFFF; --surface-2:#F6F4EF; --surface-3:#EEF1F7; --surface-4:#FAF8F3;
  --ink:#1A1815; --ink-2:#56514A; --ink-3:#8C867C;
  --line:#E6E1D8; --line-2:#D2CCC0;
  --accent:#D4541E; --accent-ink:#A83E12; --accent-soft:#FBEBE2;
  --good:#17784F; --good-soft:#E4F2EA; --warn:#8F5E00; --warn-soft:#FBF0DA; --crit:#AE2318; --crit-soft:#FBE8E5;
  --star:#6246D4; --star-soft:#ECE8FB;
  --sans:"Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --r:10px; --r-s:7px;
}
*{box-sizing:border-box}
.wxroot{color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;text-align:left}
[hidden]{display:none!important}
h3,h4,h5{margin:0;font-weight:700;letter-spacing:-.018em}
button{font:inherit;color:inherit;cursor:pointer;background:none;border:none}
input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.hint{font-size:12px;color:var(--ink-3)}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.btn{border:1px solid var(--line-2);background:var(--surface);border-radius:var(--r-s);padding:7px 13px;font-size:12.5px;font-weight:600;color:var(--ink-2)}
.btn:hover{border-color:var(--ink-3)}
.btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.sm{padding:4px 9px;font-size:11.5px}
.btn.danger{color:var(--crit);border-color:color-mix(in srgb,var(--crit) 40%,var(--line-2))}
.badge{font-family:var(--mono);font-size:10px;letter-spacing:.05em;padding:3px 8px;border-radius:5px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.badge.good{background:var(--good-soft);color:var(--good)} .badge.warn{background:var(--warn-soft);color:var(--warn)}
.badge.crit{background:var(--crit-soft);color:var(--crit)} .badge.mute{background:var(--surface-2);color:var(--ink-3)}
.badge.star{background:var(--star-soft);color:var(--star)} .badge.comp{background:var(--accent-soft);color:var(--accent-ink)}
.chip{font-family:var(--mono);font-size:11px;border:1px solid var(--line-2);border-radius:999px;padding:4px 11px;color:var(--ink-2);background:var(--surface);white-space:nowrap}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.who{display:inline-flex;align-items:center;gap:6px;font-size:12px}
.av{width:21px;height:21px;border-radius:50%;display:grid;place-items:center;font-size:9.5px;font-weight:700;color:#fff;flex-shrink:0}
.meter{height:8px;background:var(--surface-2);border-radius:999px;overflow:hidden;border:1px solid var(--line)}
.meter i{display:block;height:100%;border-radius:999px;background:var(--accent)}
.meter.done i{background:var(--good)}

/* intern guide */
.guide{background:var(--surface-3);border:1px solid var(--line-2);border-radius:var(--r);padding:14px 16px;margin-bottom:20px}
.guide h4{font-size:13.5px;margin-bottom:9px}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.step{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--ink-2);line-height:1.5}
.step b{color:var(--ink)}
.step .n{width:22px;height:22px;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center;
  font-family:var(--mono);font-size:11px;font-weight:600;flex-shrink:0}
.bar2{display:flex;gap:11px;align-items:flex-start;background:var(--surface-3);border:1px solid var(--line-2);border-radius:var(--r);padding:11px 14px;margin-bottom:16px}
.bar2 .ic2{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--ink-2);border:1.5px solid var(--line-2);border-radius:5px;padding:2px 7px;flex-shrink:0;white-space:nowrap}
.bar2 p{margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.55}

/* companies */
.sec-h{display:flex;align-items:baseline;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.sec-h h3{font-size:16px}
.cos{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}
.co{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:15px 16px;display:flex;flex-direction:column;gap:9px;text-align:left;width:100%}
.co:hover{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.co.star{border-top:3px solid var(--star)} .co.comp{border-top:3px solid var(--accent)}
.co h4{font-size:16px}
.co p{margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.co .foot{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;color:var(--ink-3);font-family:var(--mono)}
.empty{border:1px dashed var(--line-2);border-radius:var(--r);padding:28px 20px;text-align:center;color:var(--ink-3)}
.empty h4{font-size:14px;color:var(--ink-2);margin-bottom:5px}
.empty p{margin:0 auto 14px;font-size:12.5px;max-width:52ch;line-height:1.55}

/* fill the template */
.pick{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
.cohead{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px;margin-bottom:16px;display:grid;
  grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:16px;align-items:center}
.cohead .nm{border:none;background:transparent;font:inherit;font-size:22px;font-weight:700;letter-spacing:-.025em;padding:2px 6px;margin-left:-6px;border-radius:6px;width:100%}
.cohead .nm:hover,.cohead .nm:focus{background:var(--surface-2);outline:none}
.seg{display:inline-flex;border:1px solid var(--line-2);border-radius:999px;overflow:hidden;margin-top:6px}
.seg button{padding:5px 12px;font-size:12px;font-weight:600;color:var(--ink-3)}
.seg button.on.star{background:var(--star);color:#fff} .seg button.on.comp{background:var(--accent);color:#fff}
.seg button:disabled{cursor:default}
.meta3{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.mini label{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px}
.mini select,.mini input{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:5px;padding:6px 8px;font-size:12.5px}
.prog{grid-column:1/-1;display:flex;align-items:center;gap:11px}
.prog .meter{flex:1}
.prog span{font-family:var(--mono);font-size:11.5px;color:var(--ink-2);white-space:nowrap}
.toc{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;position:sticky;top:0;z-index:5;background:var(--bg);padding:8px 0}
.toc button{font-size:12px;font-weight:600;color:var(--ink-2);border:1px solid var(--line);border-radius:999px;padding:4px 11px;background:var(--surface);display:flex;gap:6px;align-items:center}
.toc button i{font-style:normal;font-family:var(--mono);font-size:10.5px;color:var(--ink-3)}
.toc button.ok{border-color:color-mix(in srgb,var(--good) 45%,var(--line));color:var(--good)}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:17px 18px;margin-bottom:16px;scroll-margin-top:60px}
.panel-h{display:flex;align-items:flex-start;gap:11px;margin-bottom:14px}
.panel-h .n{width:28px;height:28px;border-radius:8px;background:var(--accent-soft);color:var(--accent-ink);display:grid;place-items:center;font-weight:800;font-size:14px;flex-shrink:0}
.panel-h h3{font-size:15.5px}
.panel-h p{margin:2px 0 0;font-size:12.5px;color:var(--ink-2)}
.panel-h .cnt{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--ink-3);white-space:nowrap;padding-top:4px}
.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:11px;align-items:start}
.fbox{border:1px solid var(--line);border-radius:var(--r-s);padding:11px 13px;background:var(--surface-4);min-width:0}
.fbox.wide{grid-column:1/-1}
.fbox.filled{border-color:color-mix(in srgb,var(--good) 30%,var(--line))}
.fbox .lh{display:flex;align-items:center;gap:7px;margin-bottom:3px;flex-wrap:wrap}
.fbox label{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2);font-weight:600}
.must{font-family:var(--mono);font-size:9px;letter-spacing:.05em;color:var(--crit);background:var(--crit-soft);border-radius:4px;padding:1px 5px;font-weight:600}
.fbox.filled .must{color:var(--good);background:var(--good-soft)}
.fbox .ask{font-size:12px;color:var(--ink-3);line-height:1.45;margin:0 0 7px}
.fbox input,.fbox textarea{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:5px;padding:7px 9px;font-size:13px}
.fbox textarea{resize:vertical;min-height:66px;font-family:inherit}
.fbox input:disabled,.fbox textarea:disabled{background:var(--surface-2);color:var(--ink-2)}
.fbox.custom{border-style:dashed;border-color:var(--line-2)}
.fbox .rm{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--ink-3);padding:0 3px}
.fbox .rm:hover{color:var(--crit)}
.fbox a.go{font-size:11px;font-family:var(--mono);color:var(--accent);text-decoration:none;margin-left:auto}
.addfield{width:100%;border:1px dashed var(--line-2);border-radius:var(--r-s);padding:10px;font-size:12.5px;font-weight:600;color:var(--ink-3);min-height:60px}
.addfield:hover{border-color:var(--accent);color:var(--accent)}

/* what changed */
.filterbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.upd{display:flex;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r-s);background:var(--surface);margin-bottom:8px;align-items:flex-start}
.upd .ic{width:30px;height:30px;border-radius:7px;display:grid;place-items:center;font-size:15px;flex-shrink:0;background:var(--surface-2)}
.upd-b{flex:1;min-width:0}
.upd-b h5{font-size:13.5px;font-weight:600;margin-bottom:4px;line-height:1.4}
.upd-b p{margin:5px 0 0;font-size:12px;color:var(--ink-2)}
.upd-b a{color:var(--accent);font-size:12px;word-break:break-all}
.dchip{font-family:var(--mono);font-size:10.5px;background:var(--surface-2);color:var(--ink-2);padding:2.5px 8px;border-radius:5px;font-weight:600;white-space:nowrap}
.dayh{font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);margin:16px 0 8px}

/* compare */
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
table{border-collapse:collapse;width:100%}
th{font-size:13px;text-align:left;padding:11px 12px;border-bottom:1px solid var(--line);background:var(--surface-4);min-width:220px;vertical-align:bottom}
th.rowh,td.rowh{min-width:170px;max-width:190px;font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);font-weight:500;background:var(--surface-4);position:sticky;left:0;z-index:1}
td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top;font-size:12.5px;color:var(--ink-2);white-space:pre-wrap;line-height:1.5}
tr:last-child td{border-bottom:none}
td .blank{color:var(--crit);font-family:var(--mono);font-size:10.5px}

/* dialog + toast */
.mscrim{position:fixed;inset:0;background:rgba(10,8,5,.44);z-index:80;opacity:0;pointer-events:none;transition:opacity .16s;display:grid;place-items:center;padding:24px}
.mscrim.on{opacity:1;pointer-events:auto}
.modal{background:var(--surface);border:1px solid var(--line);border-radius:14px;width:min(480px,100%);max-height:min(86vh,760px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 18px 50px rgba(10,8,5,.22)}
.mhead{padding:22px 24px 4px}
.mhead h3{font-size:19px;letter-spacing:-.024em;margin-bottom:9px}
.mhead p{margin:0;font-size:13px;color:var(--ink-2);line-height:1.55}
.mbody{overflow-y:auto;padding:16px 24px 18px}
.mbody .fbox{margin-bottom:10px}
.mbody select{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:5px;padding:7px 9px;font-size:13px}
.mfoot{padding:14px 24px calc(18px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:9px;background:var(--surface-4)}
.toast{position:fixed;left:50%;transform:translateX(-50%) translateY(14px);bottom:calc(22px + env(safe-area-inset-bottom,0px));background:var(--ink);color:var(--bg);font-size:12.5px;font-weight:600;padding:10px 16px;border-radius:999px;z-index:95;opacity:0;pointer-events:none;transition:all .18s;max-width:90vw;text-align:center}
.toast.on{opacity:1;transform:translateX(-50%)}

@media (max-width:760px){ .cohead{grid-template-columns:1fr} .meta3{grid-template-columns:1fr} }
@media (prefers-reduced-motion:reduce){*{transition:none!important}}

/* --- horizon extras --- */
.weeks{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
.wk{font-family:var(--mono);font-size:11px;border:1px solid var(--line-2);border-radius:999px;padding:4px 10px;background:var(--surface);color:var(--ink-2);display:inline-flex;gap:6px;align-items:center;white-space:nowrap}
.wk.on{border-color:var(--ink);background:var(--ink);color:var(--bg)}
.dotst{width:8px;height:8px;border-radius:50%;display:inline-block;background:var(--line-2);flex-shrink:0}
.dotst.draft{background:var(--warn)} .dotst.submitted{background:var(--star)} .dotst.checked{background:var(--good)} .dotst.redo{background:var(--crit)}
.st{font-family:var(--mono);font-size:10px;letter-spacing:.04em;padding:3px 8px;border-radius:5px;font-weight:600;white-space:nowrap;display:inline-flex;gap:4px;align-items:center}
.st.none{background:var(--surface-2);color:var(--ink-3)} .st.late{background:var(--crit-soft);color:var(--crit)}
.st.draft{background:var(--warn-soft);color:var(--warn)} .st.submitted{background:var(--star-soft);color:var(--star)}
.st.checked{background:var(--good-soft);color:var(--good)} .st.redo{background:var(--crit-soft);color:var(--crit)}
.review{border:1px solid var(--line-2);border-radius:var(--r);padding:12px 14px;margin-bottom:16px;background:var(--surface)}
.review.redo{border-color:color-mix(in srgb,var(--crit) 40%,var(--line));background:var(--crit-soft)}
.review.checked{border-color:color-mix(in srgb,var(--good) 40%,var(--line));background:var(--good-soft)}
.review p{margin:4px 0 0;font-size:12.5px;color:var(--ink-2);white-space:pre-wrap}
.submitbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--surface-4);border:1px solid var(--line);border-radius:var(--r);padding:13px 16px;margin-top:6px}
.submitbar .btn.pri:disabled{opacity:.42;cursor:not-allowed}
.qlist{margin:8px 0 0;padding-left:18px;font-size:12.5px;color:var(--ink-2)}
.qlist li{margin-bottom:3px}
.co.hz{border-top:3px solid var(--star)}
.grid6 td,.grid6 th{min-width:118px;white-space:nowrap}
.grid6 td{vertical-align:middle}
.grid6 td button{display:inline-flex}
.waiting{display:flex;gap:12px;padding:12px 14px;border:1px solid var(--line);border-left:3px solid var(--star);border-radius:var(--r-s);background:var(--surface);margin-bottom:8px;align-items:center;flex-wrap:wrap}
.waiting .grow{flex:1;min-width:200px}
.waiting h5{font-size:13.5px;margin-bottom:3px}
.learn{border:1px solid var(--line);border-radius:var(--r-s);background:var(--surface);padding:12px 14px;margin-bottom:8px}
.learn h5{font-size:13px;margin-bottom:6px}
.learn .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.learn .two div{font-size:12.5px;color:var(--ink-2);white-space:pre-wrap;line-height:1.5}
.learn .two b{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:500;margin-bottom:3px}
@media (max-width:760px){ .learn .two{grid-template-columns:1fr} }`;

let HOST=null, R=null, SPACE=null, OPT={};
let HTAB="topics", WEEK=null, LFILTER="all";
const $ = s => R.querySelector(s);

/* ------------------------------------------------------------ the fixed weekly template */
/* the topic's own questions go between TOP and BOTTOM. ask = what to write; ph = an example. */
const TOP = [
  { k:"summary", label:"This week in 5 lines", must:true, ask:"If someone reads only this, what should they know about this topic this week?", ph:"1. … 2. … 3. …" }
];
const BOTTOM = [
  { k:"examples", label:"3 examples with links", must:true, ask:"Three real things you found: a company, an app, an article, a post. Name, one line, link.", ph:"1. Acme AI: turns lecture videos into flashcards. https://…" },
  { k:"takeaway", label:"What we can take away", must:true, ask:"What should Dubuddy learn or change because of this? Be specific.", ph:"Most new YC edtech startups sell to schools, not students. We should test a school plan." },
  { k:"build",    label:"Something we could build or try", must:true, ask:"One idea: what it is, who it's for, and how we'd test it in a week.", ph:"An AI doubt-solver on WhatsApp for CUET students. Test: 50 students, 7 days." },
  { k:"sources",  label:"Where I looked", ask:"Links or names of what you read or watched.", ph:"ycombinator.com/companies, Product Hunt, The Ken, X: @…" },
  { k:"next",     label:"Questions for next week", ask:"What do you still want to find out?", ph:"How do these startups find their first 100 customers?" }
];
const PRESETS = [
  { id:"yc", emo:"🚀", q:"What kind of startups is YC backing right now?",
    why:"To see where smart money is going and what we can borrow from them.",
    questions:[
      "Which batch did you look at, and how many companies are in it?",
      "Top 5 categories in that batch (AI agents, devtools, fintech…), with a count for each",
      "3 startups closest to what we do: name, one line, link",
      "Any edtech or India-focused startups? What are they doing?",
      "What problem keeps showing up again and again?"
    ], hint:"Start at ycombinator.com/companies (filter by batch) and Launch YC." },
  { id:"ai", emo:"🤖", q:"What's happening in the AI world, and what AI apps could we build?",
    why:"AI changes every week. We want to catch what matters for students and for our team early.",
    questions:[
      "The 3 biggest AI news this week (model launches, funding, product updates)",
      "New AI apps people are talking about (Product Hunt, X, YouTube): name, what it does, link",
      "AI tools our own team could start using this week, and for what",
      "AI app ideas for students that we could build",
      "Anything that threatens Dubuddy, or helps it?"
    ], hint:"Try Product Hunt (AI), Ben's Bites, The Rundown AI, and X." },
  { id:"b2b", emo:"🏢", q:"What would it take to build a B2B company like Zoho?",
    why:"We're thinking about a B2B product. First we need to understand how companies like Zoho work.",
    questions:[
      "Which Zoho product did you study this week? What does it do, and who buys it?",
      "Its pricing, next to 2 competitors",
      "How do they sell it: self-serve, a sales team, or partners?",
      "Which problem for small Indian businesses is still badly solved?",
      "Rough guess: team and money needed to build a first version"
    ], hint:"zoho.com/pricing, G2 reviews, Zoho's own blog, and interviews with Sridhar Vembu." }
];
const STATUS = {
  before:    { label:"—",                 cls:"none" },
  none:      { label:"not started",       cls:"none" },
  late:      { label:"late",              cls:"late" },
  draft:     { label:"being filled",      cls:"draft" },
  submitted: { label:"waiting for check", cls:"submitted" },
  checked:   { label:"✓ checked",         cls:"checked" },
  redo:      { label:"needs more",        cls:"redo" }
};

/* ------------------------------------------------------------ helpers */
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const isoD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today = () => isoD(new Date());
/* weeks run Monday → Sunday; a week is named by its Monday */
function monday(s){ const d = s ? new Date(s+"T00:00:00") : new Date(); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return isoD(d); }
function addDays(s, n){ const d = new Date(s+"T00:00:00"); d.setDate(d.getDate()+n); return isoD(d); }
const thisWeek = () => monday();
const wkName = s => { const e = addDays(s,6), o = {day:"numeric",month:"short"};
  return new Date(s+"T00:00:00").toLocaleDateString("en-GB",o) + " – " + new Date(e+"T00:00:00").toLocaleDateString("en-GB",o); };
const wkShort = s => s===thisWeek() ? "This week" : s===addDays(thisWeek(),-7) ? "Last week" : "Week of " + new Date(s+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function hue(name){ let h=0; for(const ch of String(name)) h=(h*31+ch.charCodeAt(0))%360; return h; }
function avatar(name){ const n=String(name||"?").trim()||"?";
  return `<span class="av" style="background:hsl(${hue(n)} 48% 46%)">${esc(n.charAt(0).toUpperCase())}</span>`; }
function toast(m){ const t=$("#toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove("on"),2600); }
const canEdit = () => !OPT.canEdit || OPT.canEdit();
const canCheck = () => OPT.canCheck ? OPT.canCheck() : canEdit();
const me = () => (OPT.me && OPT.me()) || null;      /* {id, name} */
function people(){ return (OPT.people && OPT.people()) || []; }   /* [{id,name,role}] */
const nameOf = id => { const p = people().find(x=>x.id===id); return p ? p.name : ""; };

/* a topic's boxes for one week, in order */
const boxesFor = t => TOP.concat(t.questions.map(q=>({ k:"q:"+q.id, label:q.text, must:true, ask:"", ph:"" })), BOTTOM);
const valOf = (e, k) => e ? String((k.startsWith("q:") ? (e.a||{})[k.slice(2)] : (e.f||{})[k]) || "") : "";
function fillCount(t, e){ const m = boxesFor(t).filter(b=>b.must); const n = m.filter(b=>valOf(e,b.k).trim()).length; return { n, of:m.length }; }
const entryOf = (t, wk) => t.weeks.find(x=>x.week===wk) || null;
function statusOf(t, wk){
  const e = entryOf(t, wk);
  if(e && e.status && e.status!=="draft") return e.status;
  if(e && fillCount(t,e).n) return "draft";
  if(t.created && wk < monday(t.created)) return "before";   /* the topic didn't exist yet */
  return wk < thisWeek() ? "late" : "none";       /* a past week with nothing in it is late */
}
const activeTopic = c => c.topics.find(x=>x.id===c.activeTopic) || c.topics[0] || null;

function normalize(c){
  c.topics = Array.isArray(c.topics) ? c.topics : [];
  c.topics.forEach(t=>{
    if(!t.id) t.id = uid("tp");
    t.questions = Array.isArray(t.questions) ? t.questions.map(q=> typeof q==="string" ? { id:uid("q"), text:q } : q) : [];
    t.questions.forEach(q=>{ if(!q.id) q.id = uid("q"); });
    t.weeks = Array.isArray(t.weeks) ? t.weeks : [];
    t.weeks.forEach(e=>{ e.a = e.a || {}; e.f = e.f || {}; if(!e.id) e.id = uid("wk"); if(!STATUS[e.status]) e.status = "draft"; });
  });
  return c;
}
function saveQuiet(){ (OPT.saveQuiet || OPT.save || function(){})(SPACE); }
function save(){ (OPT.save || function(){})(SPACE); }

/* an email + a 🔔 (index.html → idea-mail "assign") */
function notify(c, to, name, date, details){
  if(!to || !OPT.notify) return;
  const m = me(); if(m && m.id===to) return;          /* no need to tell yourself */
  OPT.notify(c, { ownerId:to, name, date, details }).then(r=>{
    const who = nameOf(to) || "They";
    if(r && r.sent) toast(`${who} notified — email sent`);
    else if(r && r.belled) toast(`${who} notified in the app (email didn't go: ${r.reason||"unknown"})`);
    else toast(`Saved — couldn't notify ${who}${r&&r.reason?": "+r.reason:""}`);
  });
}

/* ------------------------------------------------------------ small dialog */
let dlgSubmit=null;
function openDialog({ title, sub, fields, okLabel="Save", onSave }){
  $("#dlgTitle").textContent = title;
  $("#dlgSub").textContent = sub || ""; $("#dlgSub").hidden = !sub;
  $("#dlgOk").textContent = okLabel;
  const ctl = f => f.type==="area"
      ? `<textarea id="d-${f.k}" placeholder="${esc(f.ph||"")}" style="min-height:${f.tall?"150px":"66px"}">${esc(f.value||"")}</textarea>`
    : f.type==="select"
      ? `<select id="d-${f.k}">${f.opts.map(([k,v])=>`<option value="${esc(k)}" ${f.value===k?"selected":""}>${esc(v)}</option>`).join("")}</select>`
      : `<input id="d-${f.k}" value="${esc(f.value||"")}" placeholder="${esc(f.ph||"")}">`;
  $("#dlgBody").innerHTML = fields.map(f=>`
    <div class="fbox"><div class="lh"><label for="d-${f.k}">${esc(f.label)}</label></div>${f.ask?`<p class="ask">${esc(f.ask)}</p>`:""}${ctl(f)}</div>`).join("");
  dlgSubmit = ()=>{
    const out={};
    fields.forEach(f=>{ const el=$("#d-"+f.k); out[f.k] = (el?.value||"").trim(); });
    if(onSave(out) !== false) closeDialog();
  };
  $("#dlgScrim").classList.add("on");
  setTimeout(()=>$("#dlgBody").querySelector("input,textarea,select")?.focus(), 60);
}
function closeDialog(){ $("#dlgScrim").classList.remove("on"); dlgSubmit=null; }

/* ------------------------------------------------------------ mount + draw */
function mount(){
  if(HOST) return;
  HOST = document.createElement("div"); HOST.className="hx-host";
  R = HOST.attachShadow({mode:"open"});
  R.innerHTML = `<style>${CSS}</style><div class="wxroot">
    <section id="body"></section>
    <div class="mscrim" id="dlgScrim">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
        <div class="mhead"><h3 id="dlgTitle"></h3><p id="dlgSub"></p></div>
        <div class="mbody" id="dlgBody"></div>
        <div class="mfoot"><button class="btn" id="dlgCancel">Cancel</button><button class="btn pri" id="dlgOk">Save</button></div>
      </div>
    </div>
    <div class="toast" id="toast" role="status"></div></div>`;
  $("#dlgCancel").onclick = closeDialog;
  $("#dlgOk").onclick = ()=>{ if(dlgSubmit) dlgSubmit(); };
  $("#dlgScrim").onclick = e => { if(e.target === $("#dlgScrim")) closeDialog(); };
  $("#dlgBody").addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.tagName!=="TEXTAREA" && dlgSubmit){ e.preventDefault(); dlgSubmit(); }});
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && HOST.isConnected && R.querySelector("#dlgScrim.on")) closeDialog(); });
}
function goTab(t){ if(OPT.setTab) OPT.setTab(t); else { HTAB=t; draw(); } }
function draw(){
  const c = SPACE; if(!c) return;
  const B = $("#body");
  B.innerHTML = HTAB==="fill" ? fillPane(c) : HTAB==="check" ? checkPane(c) : HTAB==="learn" ? learnPane(c) : topicsPane(c);
  B.querySelectorAll("[data-htab]").forEach(b=>b.onclick=()=>goTab(b.dataset.htab));
  B.querySelectorAll("[data-addtopic]").forEach(b=>b.onclick=()=>addTopic(c));
  B.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{ const [id,wk]=b.dataset.open.split("|"); c.activeTopic=id; WEEK=wk||thisWeek(); saveQuiet(); goTab("fill"); });
  if(HTAB==="fill") wireFill(c);
  else if(HTAB==="check") wireCheck(c);
  else if(HTAB==="learn") B.querySelectorAll("[data-lf]").forEach(b=>b.onclick=()=>{ LFILTER=b.dataset.lf; draw(); });
}

const roView = () => `<div class="bar2"><span class="ic2">VIEW ONLY</span><p>You can read this space but not change it.</p></div>`;
const guideHtml = () => `
  <div class="guide">
    <h4>👋 How this works</h4>
    <div class="steps">
      <div class="step"><span class="n">1</span><span><b>Each topic is one big question</b> we keep reading about, with one person answering it.</span></div>
      <div class="step"><span class="n">2</span><span><b>Every week, open Fill this week</b> and answer the same boxes. Each box says what to write and shows an example.</span></div>
      <div class="step"><span class="n">3</span><span><b>Press Submit for check by Sunday.</b> Red <b>MUST FILL</b> boxes have to be done first.</span></div>
      <div class="step"><span class="n">4</span><span><b>The checker reads it</b> and marks it ✓ checked, or asks for more with a note. Good ideas collect under <b>Learnings</b>.</span></div>
    </div>
  </div>`;

/* ============================================================ TOPICS */
function topicsPane(c){
  const ro = !canEdit(), wk = thisWeek();
  const card = t => {
    const st = statusOf(t, wk), e = entryOf(t, wk), fc = fillCount(t, e);
    const done = t.weeks.filter(x=>x.status==="checked").length;
    return `<button class="co hz" data-open="${esc(t.id)}|${wk}">
      <div class="row" style="justify-content:space-between;flex-wrap:nowrap;align-items:flex-start"><h4>${esc(t.emo||"🔭")} ${esc(t.q)}</h4></div>
      ${t.why?`<p>${esc(t.why)}</p>`:""}
      <div class="foot"><span>This week</span><span class="st ${STATUS[st].cls}">${esc(STATUS[st].label)}</span></div>
      <div class="meter ${fc.n===fc.of?"done":""}"><i style="width:${Math.round(100*fc.n/fc.of)}%"></i></div>
      <div class="foot">
        ${t.ownerId ? `<span class="who">${avatar(nameOf(t.ownerId)||t.owner)}${esc(nameOf(t.ownerId)||t.owner)}</span>` : `<span class="badge mute">nobody answering it</span>`}
        <span>${done} week${done===1?"":"s"} checked</span>
      </div>
    </button>`;
  };
  return `
    ${ro?roView():""}
    ${guideHtml()}
    <div class="sec-h">
      <h3>Topics we keep reading about</h3>
      <span class="hint">${c.topics.length} topic${c.topics.length===1?"":"s"} · this week is ${esc(wkName(wk))}</span>
      ${ro?"":`<button class="btn pri" data-addtopic style="margin-left:auto">+ Add a topic</button>`}
    </div>
    ${c.topics.length ? `<div class="cos">${c.topics.map(card).join("")}</div>`
      : `<div class="empty"><h4>No topics yet</h4>
          <p>Start with a ready-made one (YC startups, the AI world, a B2B company like Zoho) or write your own question.</p>
          ${ro?"":`<button class="btn pri" data-addtopic>+ Add the first topic</button>`}</div>`}`;
}

function addTopic(c){
  if(!canEdit()) return;
  const ppl = people(), m = me();
  openDialog({
    title:"Add a topic",
    sub:"Pick a ready-made topic and its weekly questions come filled in. You can change them any time.",
    fields:[
      { k:"preset", label:"Start from", type:"select", value:"yc",
        opts:PRESETS.map(p=>[p.id, p.emo+" "+p.q]).concat([["own","✏️ Write my own question"]]) },
      { k:"q", label:"Your own question (only if you picked “Write my own”)", ph:"What are the fastest-growing apps in India this month?" },
      { k:"ownerId", label:"Who answers it every week", type:"select", value:"",
        opts:[["","— decide later —"]].concat(ppl.map(p=>[p.id, p.name + (p.role?" · "+p.role:"")])) },
      { k:"checkerId", label:"Who checks it", type:"select", value:(m&&m.id)||"",
        opts:[["","— anyone who can check —"]].concat(ppl.map(p=>[p.id, p.name])) }
    ],
    okLabel:"Add topic",
    onSave:(v)=>{
      const p = PRESETS.find(x=>x.id===v.preset);
      if(!p && !v.q){ toast("Write the question"); return false; }
      const t = p
        ? { id:uid("tp"), emo:p.emo, q:p.q, why:p.why, hint:p.hint, questions:p.questions.map(text=>({ id:uid("q"), text })) }
        : { id:uid("tp"), emo:"🔭", q:v.q, why:"", hint:"", questions:[] };
      Object.assign(t, { ownerId:v.ownerId, owner:nameOf(v.ownerId), checkerId:v.checkerId, weeks:[], created:today() });
      c.topics.push(t); c.activeTopic = t.id; WEEK = thisWeek();
      if(t.ownerId) notify(c, t.ownerId, "Weekly: "+t.q, addDays(thisWeek(),6),
        "Every week, open "+c.name+" → Fill this week, answer every MUST FILL box and press Submit for check by Sunday.");
      save(); goTab("fill");
      if(!p) setTimeout(()=>editTopic(c, t), 120);   /* your own question: add its weekly questions next */
    }
  });
}
function editTopic(c, t){
  const ppl = people();
  openDialog({
    title:"Topic settings",
    sub:"Changing the weekly questions doesn't touch answers already given.",
    fields:[
      { k:"q", label:"The big question", value:t.q },
      { k:"why", label:"Why we're asking", type:"area", value:t.why, ph:"What we hope to learn and why it matters to us." },
      { k:"questions", label:"Questions to answer every week, one per line", type:"area", tall:true,
        value:t.questions.map(q=>q.text).join("\n"), ph:"Which apps grew the most this month?\nWhat do they have in common?" },
      { k:"hint", label:"Where to start looking", value:t.hint, ph:"Sites, newsletters, people to follow" },
      { k:"ownerId", label:"Who answers it every week", type:"select", value:t.ownerId||"",
        opts:[["","— nobody yet —"]].concat(ppl.map(p=>[p.id, p.name])) },
      { k:"checkerId", label:"Who checks it", type:"select", value:t.checkerId||"",
        opts:[["","— anyone who can check —"]].concat(ppl.map(p=>[p.id, p.name])) }
    ],
    onSave:(v)=>{
      if(!v.q){ toast("The topic needs a question"); return false; }
      const before = t.ownerId;
      const lines = v.questions.split("\n").map(s=>s.trim()).filter(Boolean);
      t.questions = lines.map(text=> t.questions.find(q=>q.text===text) || { id:uid("q"), text });   /* same text keeps its answers */
      Object.assign(t, { q:v.q, why:v.why, hint:v.hint, ownerId:v.ownerId, owner:nameOf(v.ownerId), checkerId:v.checkerId });
      if(t.ownerId && t.ownerId!==before) notify(c, t.ownerId, "Weekly: "+t.q, addDays(thisWeek(),6),
        "Every week, open "+c.name+" → Fill this week, answer every MUST FILL box and press Submit for check by Sunday.");
      save();
    }
  });
}

/* ============================================================ FILL THIS WEEK */
function fillPane(c){
  const t = activeTopic(c), ro = !canEdit();
  if(!t) return `${guideHtml()}<div class="empty"><h4>Add a topic first</h4><p>The weekly template opens for one topic at a time.</p>
    ${ro?"":`<button class="btn pri" data-addtopic>+ Add a topic</button>`}</div>`;
  const wk = WEEK || thisWeek();
  const e = entryOf(t, wk), st = statusOf(t, wk), fc = fillCount(t, e);
  const locked = ro || st==="checked";
  const dis = locked ? "disabled" : "";
  /* weeks to pick: this week, last week, and every earlier week with something in it */
  const wks = [...new Set([thisWeek(), addDays(thisWeek(),-7)].concat(t.weeks.map(x=>x.week)))].sort().reverse();
  const box = b => {
    const v = valOf(e, b.k), has = !!v.trim();
    return `<div class="fbox wide ${has?"filled":""}">
      <div class="lh"><label for="h-${esc(b.k)}">${esc(b.label)}</label>${b.must?`<span class="must">${has?"✓ ":""}MUST FILL</span>`:""}</div>
      ${b.ask?`<p class="ask">${esc(b.ask)}</p>`:""}
      <textarea id="h-${esc(b.k)}" data-b="${esc(b.k)}" placeholder="${b.ph?"e.g. "+esc(b.ph):"Your answer…"}" ${dis}>${esc(v)}</textarea>
    </div>`;
  };
  const checker = t.checkerId ? nameOf(t.checkerId) : "";
  return `
    ${ro?roView():""}
    <div class="pick">
      <span class="hint">Topic:</span>
      ${c.topics.map(x=>`<button class="chip ${x.id===t.id?"on":""}" data-pick="${esc(x.id)}">${esc(x.emo||"🔭")} ${esc(x.q.length>46?x.q.slice(0,44)+"…":x.q)}</button>`).join("")}
      ${ro?"":`<button class="chip" data-addtopic>+ add</button>`}
    </div>

    <div class="panel">
      <div class="panel-h" style="margin-bottom:8px"><span class="n">${esc(t.emo||"🔭")}</span>
        <div><h3>${esc(t.q)}</h3>${t.why?`<p>${esc(t.why)}</p>`:""}</div>
        ${ro?"":`<button class="btn sm" id="editTopic" style="margin-left:auto">Topic settings</button>`}</div>
      <div class="row" style="gap:14px;font-size:12.5px;color:var(--ink-2)">
        <span>Answered by ${t.ownerId?`<span class="who">${avatar(nameOf(t.ownerId))}${esc(nameOf(t.ownerId))}</span>`:"<b>nobody yet</b>"}</span>
        <span>Checked by <b>${esc(checker || "anyone who can check")}</b></span>
        ${t.hint?`<span>🔎 ${esc(t.hint)}</span>`:""}
      </div>
    </div>

    <div class="weeks">
      ${wks.map(w=>{ const s=statusOf(t,w); return `<button class="wk ${w===wk?"on":""}" data-week="${w}"><span class="dotst ${s}"></span>${esc(wkShort(w))}</button>`; }).join("")}
    </div>

    <div class="sec-h"><h3>${esc(wkShort(wk))}</h3><span class="hint">${esc(wkName(wk))}</span>
      <span class="st ${STATUS[st].cls}" style="margin-left:auto">${esc(STATUS[st].label)}</span></div>

    ${e && e.status==="redo" ? `<div class="review redo"><b>↩ ${esc(e.checkedBy||"The checker")} asked for more</b>${e.comment?`<p>${esc(e.comment)}</p>`:""}</div>` : ""}
    ${e && e.status==="checked" ? `<div class="review checked"><b>✓ Checked by ${esc(e.checkedBy||"")}${e.checkedAt?" on "+esc(new Date(e.checkedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short"})):""}</b>${e.comment?`<p>${esc(e.comment)}</p>`:""}</div>` : ""}

    <div class="panel"><div class="fgrid">${boxesFor(t).map(box).join("")}</div>
      ${!t.questions.length && !ro ? `<p class="hint" style="margin:10px 0 0">This topic has no weekly questions of its own yet. Add them in <b>Topic settings</b>.</p>` : ""}
    </div>

    <div class="submitbar">
      <span id="fillTxt" style="font-family:var(--mono);font-size:12px;color:var(--ink-2)">${fc.n} of ${fc.of} must-fill boxes done</span>
      ${st==="checked"
        ? (canCheck() ? `<button class="btn" id="reopen" style="margin-left:auto">Reopen this week</button>` : "")
        : ro ? "" : `<button class="btn pri" id="submitWk" style="margin-left:auto" ${fc.n<fc.of?"disabled":""}>${st==="submitted"?"Submitted ✓ (send again)":"Submit for check"}</button>`}
      ${st==="submitted" && canCheck() ? `<button class="btn" data-htab="check">Go to Weekly check →</button>` : ""}
    </div>

    ${ro?"":`<div class="row" style="margin-top:22px;padding-top:16px;border-top:1px solid var(--line)">
      <span class="hint">No longer need this topic?</span>
      <button class="btn danger sm" id="delTopic" style="margin-left:auto">Delete this topic</button></div>`}`;
}
function wireFill(c){
  const B = $("#body"), t = activeTopic(c); if(!t) return;
  const wk = WEEK || thisWeek();
  B.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{ c.activeTopic=b.dataset.pick; WEEK=thisWeek(); saveQuiet(); draw(); });
  B.querySelectorAll("[data-week]").forEach(b=>b.onclick=()=>{ WEEK=b.dataset.week; draw(); });
  const ensure = ()=>{ let e = entryOf(t, wk); if(!e){ e = { id:uid("wk"), week:wk, a:{}, f:{}, status:"draft" }; t.weeks.push(e); } return e; };
  B.querySelectorAll("[data-b]").forEach(el=>el.oninput=()=>{
    const e = ensure(), k = el.dataset.b;
    if(k.startsWith("q:")) e.a[k.slice(2)] = el.value; else e.f[k] = el.value;
    e.by = (me()||{}).name || e.by || ""; e.updatedAt = new Date().toISOString();
    const bx = el.closest(".fbox"), has = !!el.value.trim();
    bx.classList.toggle("filled", has);
    const m = bx.querySelector(".must"); if(m) m.textContent = (has?"✓ ":"") + "MUST FILL";
    const fc = fillCount(t, e);
    $("#fillTxt").textContent = `${fc.n} of ${fc.of} must-fill boxes done`;
    const sb = $("#submitWk"); if(sb) sb.disabled = fc.n < fc.of;
    saveQuiet();
  });
  const sb=$("#submitWk"); if(sb) sb.onclick=()=>{
    const e = ensure(), fc = fillCount(t, e);
    if(fc.n < fc.of){ toast("Fill every MUST FILL box first"); return; }
    e.status = "submitted"; e.submittedAt = new Date().toISOString(); e.by = (me()||{}).name || e.by || "";
    save(); toast("Submitted for check");
    if(t.checkerId) notify(c, t.checkerId, "Check: "+t.q, addDays(wk,6),
      (e.by||"Someone")+" submitted "+wkShort(wk).toLowerCase()+" ("+wkName(wk)+"). Open "+c.name+" → Weekly check.");
  };
  const ro=$("#reopen"); if(ro) ro.onclick=()=>{ const e=entryOf(t,wk); if(e){ e.status="draft"; save(); } };
  const et=$("#editTopic"); if(et) et.onclick=()=>editTopic(c, t);
  const dt=$("#delTopic"); if(dt) dt.onclick=()=>openDialog({
    title:"Delete this topic?", sub:`This deletes “${t.q}” and all ${t.weeks.length} week${t.weeks.length===1?"":"s"} of answers. It cannot be undone.`,
    okLabel:"Delete", fields:[{ k:"confirm", label:"Type the word delete to confirm", ph:"delete" }],
    onSave:(v)=>{ if(v.confirm.toLowerCase()!=="delete"){ toast("Type delete to confirm"); return false; }
      c.topics.splice(c.topics.indexOf(t),1); c.activeTopic=null; save(); goTab("topics"); }
  });
}

/* ============================================================ WEEKLY CHECK */
function checkPane(c){
  if(!c.topics.length) return `<div class="empty"><h4>Nothing to check yet</h4><p>Add a topic, and every week's answers show up here.</p>
    ${canEdit()?`<button class="btn pri" data-addtopic>+ Add a topic</button>`:""}</div>`;
  const m = me(), can = canCheck();
  const waiting = c.topics.flatMap(t=>t.weeks.filter(e=>e.status==="submitted").map(e=>({t,e})))
    .sort((a,b)=>(a.e.submittedAt||"").localeCompare(b.e.submittedAt||""));
  const mine = x => !x.t.checkerId || (m && x.t.checkerId===m.id);
  const wks = [0,1,2,3,4,5].map(i=>addDays(thisWeek(), -7*i));
  return `
    <div class="bar2"><span class="ic2">HOW</span><p>Answers are due every Sunday. Open one, read it, then <b>Mark checked</b> or <b>Ask for more</b> with a note.
      ${can?"":" Only the space's admins can check."}</p></div>
    <div class="sec-h"><h3>Waiting for a check</h3><span class="hint">${waiting.length}</span></div>
    ${waiting.length ? waiting.map(x=>`<div class="waiting">
        <div class="grow"><h5>${esc(x.t.emo||"🔭")} ${esc(x.t.q)}</h5>
          <span class="hint">${esc(wkShort(x.e.week))} · ${esc(wkName(x.e.week))} · by ${esc(x.e.by||"—")}${x.t.checkerId?` · for ${esc(nameOf(x.t.checkerId))}`:""}</span></div>
        <button class="btn sm" data-open="${esc(x.t.id)}|${esc(x.e.week)}">Read it</button>
        ${can && mine(x) ? `<button class="btn sm pri" data-ok="${esc(x.t.id)}|${esc(x.e.week)}">✓ Mark checked</button>
          <button class="btn sm danger" data-redo="${esc(x.t.id)}|${esc(x.e.week)}">Ask for more</button>` : ""}
      </div>`).join("")
      : `<div class="empty" style="padding:18px"><p style="margin:0 auto">Nothing waiting. 🎉</p></div>`}

    <div class="sec-h" style="margin-top:24px"><h3>Last 6 weeks</h3><span class="hint">click any cell to open that week</span></div>
    <div class="tw"><table class="grid6">
      <thead><tr><th class="rowh">Topic</th>${wks.map(w=>`<th>${esc(wkShort(w))}<div class="hint" style="font-weight:400">${esc(wkName(w))}</div></th>`).join("")}</tr></thead>
      <tbody>${c.topics.map(t=>`<tr><td class="rowh" style="white-space:normal;text-transform:none;letter-spacing:0;font-family:var(--sans);font-size:12.5px;color:var(--ink)">${esc(t.emo||"🔭")} ${esc(t.q)}
          <div class="hint">${esc(nameOf(t.ownerId)||"nobody answering")}</div></td>
        ${wks.map(w=>{ const s = statusOf(t,w); return `<td><button data-open="${esc(t.id)}|${w}"><span class="st ${STATUS[s].cls}">${esc(STATUS[s].label)}</span></button></td>`; }).join("")}</tr>`).join("")}
      </tbody>
    </table></div>`;
}
function wireCheck(c){
  const B = $("#body");
  const find = s => { const [id,wk]=s.split("|"); const t=c.topics.find(x=>x.id===id); return t ? { t, e:entryOf(t,wk) } : {}; };
  B.querySelectorAll("[data-ok]").forEach(b=>b.onclick=()=>{
    const { t, e } = find(b.dataset.ok); if(!e) return;
    openDialog({ title:"Mark checked", sub:t.q+" · "+wkName(e.week),
      fields:[{ k:"comment", label:"A note for them (optional)", type:"area", ph:"Great find on the YC edtech list. Dig into #2 next week." }],
      okLabel:"✓ Mark checked",
      onSave:(v)=>{ Object.assign(e, { status:"checked", comment:v.comment, checkedBy:(me()||{}).name||"", checkedAt:new Date().toISOString() });
        save(); toast("Checked ✓"); }
    });
  });
  B.querySelectorAll("[data-redo]").forEach(b=>b.onclick=()=>{
    const { t, e } = find(b.dataset.redo); if(!e) return;
    openDialog({ title:"Ask for more", sub:t.q+" · "+wkName(e.week),
      fields:[{ k:"comment", label:"What's missing?", type:"area", ph:"The examples have no links. And what would we actually build?" }],
      okLabel:"Send back",
      onSave:(v)=>{ if(!v.comment){ toast("Say what's missing"); return false; }
        Object.assign(e, { status:"redo", comment:v.comment, checkedBy:(me()||{}).name||"", checkedAt:new Date().toISOString() });
        save(); toast("Sent back");
        if(t.ownerId) notify(c, t.ownerId, "Needs more: "+t.q, addDays(e.week,6), v.comment); }
    });
  });
}

/* ============================================================ LEARNINGS */
function learnPane(c){
  const rows = c.topics.flatMap(t=>t.weeks.filter(e=>(e.status==="checked"||e.status==="submitted") && ((e.f||{}).takeaway||(e.f||{}).build)).map(e=>({t,e})))
    .filter(x=>LFILTER==="all" || x.t.id===LFILTER)
    .sort((a,b)=>b.e.week.localeCompare(a.e.week));
  return `
    <div class="bar2"><span class="ic2">WHY</span><p>Every week's <b>what we can take away</b> and <b>something we could build</b>, in one place. This is where new ideas for Dubuddy come from.</p></div>
    <div class="filterbar">
      <button class="chip ${LFILTER==="all"?"on":""}" data-lf="all">All topics</button>
      ${c.topics.map(t=>`<button class="chip ${LFILTER===t.id?"on":""}" data-lf="${esc(t.id)}">${esc(t.emo||"🔭")} ${esc(t.q.length>40?t.q.slice(0,38)+"…":t.q)}</button>`).join("")}
    </div>
    ${rows.length ? rows.map(({t,e})=>`<div class="learn">
        <div class="row" style="justify-content:space-between;margin-bottom:6px">
          <h5>${esc(t.emo||"🔭")} ${esc(t.q)}</h5>
          <span class="row" style="gap:6px"><span class="dchip">${esc(wkName(e.week))}</span><span class="st ${STATUS[e.status].cls}">${esc(STATUS[e.status].label)}</span>
            <button class="btn sm" data-open="${esc(t.id)}|${esc(e.week)}">Open</button></span>
        </div>
        <div class="two"><div><b>What we can take away</b>${esc(e.f.takeaway||"—")}</div><div><b>Something we could build</b>${esc(e.f.build||"—")}</div></div>
      </div>`).join("")
    : `<div class="empty"><h4>No learnings yet</h4><p>Once weekly answers are submitted, their takeaways and ideas collect here.</p></div>`}`;
}

/* ============================================================ API */
window.HX = {
  tabs: [["topics","Topics"],["fill","Fill this week"],["check","Weekly check"],["learn","Learnings"]],
  normalize: normalize,
  /* opt: { tab, canEdit(), canCheck(), me() → {id,name}, people() → [{id,name,role}], save(space), saveQuiet(space),
            notify(space, {ownerId,name,date,details}) → Promise<{sent,belled,reason}>, setTab(t) } */
  render: function(space, wrap, opt){
    mount();
    OPT = opt || {};
    if(SPACE!==space){ SPACE=space; WEEK=null; LFILTER="all"; if(R) closeDialog(); }
    normalize(space);
    HTAB = ["topics","fill","check","learn"].includes(OPT.tab) ? OPT.tab : "topics";
    if(HOST.parentNode!==wrap) wrap.appendChild(HOST);
    draw();
  }
};
})();
