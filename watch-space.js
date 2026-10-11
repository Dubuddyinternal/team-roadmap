/* =====================================================================
   KEEP AN EYE — Companies · Fill the template · What changed · Compare
   (Cyberflow team app, tools.dubuddy.in)

   WHAT THIS IS: a fixed template for studying another company — one we
   want to be like (🌟 role model) or one that takes our students
   (⚔️ competitor). It lives inside a Marketing space (index.html, type
   "watch" with parent = that space). The template is the same for every
   company, so an intern always knows what to fill and in what order:
     * Companies — every company we watch, who is studying it, by when,
       and how much of the template is filled.
     * Fill the template — five numbered sections (basics, what they sell,
       how they market, what students say, our take). Every box says what
       to write and shows an example. "Must fill" boxes count towards done.
     * What changed — a dated log of things spotted later (new offer,
       price change, viral post, new feature…), so the study stays fresh.
     * Compare — the key boxes of every company side by side.
   index.html calls WX.render(space, host, opt) when the space is open; it
   is drawn inside a shadow root so its styles and the app's never touch.
   Data is saved with the team (team_data "cspaces") through opt.save /
   opt.saveQuiet (quiet = no page redraw, used while typing).
   ===================================================================== */
(function(){
"use strict";

const CSS = `
:host{display:block;color-scheme:light;
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
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

let HOST=null, R=null, SPACE=null, OPT={};
let WTAB="companies", UPDFILTER="all";
const $ = s => R.querySelector(s);

/* ------------------------------------------------------------ the fixed template */
/* every company gets the same boxes, in the same order. ask = what to write; ph = an example. */
const SECTIONS = [
  { k:"basics", title:"The basics", sub:"Who they are, in one look.", fields:[
    { k:"website",  label:"Website",               ask:"Their main website.", ph:"https://www.example.com", link:true, must:true },
    { k:"app",      label:"App link",              ask:"Play Store or App Store link. Write “no app” if there isn't one.", ph:"https://play.google.com/store/apps/details?id=…", link:true },
    { k:"founded",  label:"Founded · Based in",    ask:"Year they started and their city.", ph:"2016 · Bengaluru" },
    { k:"size",     label:"How big are they",      ask:"Team size, funding or downloads, whatever you can find. Say where you found it.", ph:"~800 people · 10M+ downloads (Play Store) · raised $50M (Tracxn)" },
    { k:"oneLine",  label:"What they do, in one line", wide:true, must:true, ask:"Write it so a new teammate gets it in five seconds.", ph:"Live and recorded CUET coaching with a free doubt-solving app." },
    { k:"whyWatch", label:"Why we're watching them", wide:true, must:true, ask:"Role model: what do we want to learn from them? Competitor: where do they take our students?", ph:"Their Instagram grows 10k a month on short exam tips. We want to learn how they pick topics." }
  ]},
  { k:"product", title:"What they sell", sub:"Courses, prices, and what a student actually gets.", fields:[
    { k:"courses",  label:"Courses / exams covered", wide:true, must:true, ask:"List what they sell. Mark the ones that clash with ours.", ph:"CUET UG (full course, crash course), NEET, JEE, Class 11–12 boards" },
    { k:"pricing",  label:"Pricing", wide:true, must:true, ask:"Every plan with its price and what's in it. Note any discount running and the date you checked.", ph:"Basic ₹2,999 (recorded only) · Pro ₹5,999 (live + tests) · 20% off till 31 Oct (checked 12 Oct)" },
    { k:"free",     label:"What's free",           ask:"What can a student use without paying?", ph:"10 free mock tests, daily quiz, doubt app" },
    { k:"bestFeature", label:"Their best feature", must:true, ask:"The one thing students would miss most if it went away.", ph:"Rank predictor after every mock test" },
    { k:"firstVisit", label:"First 5 minutes as a student", wide:true, ask:"Sign up yourself and write down each step. Where did they ask for your number? What did they push you to buy?", ph:"Download → OTP → pick exam → free test pops up → after the test a ₹499 offer…" }
  ]},
  { k:"marketing", title:"How they market", sub:"Where they show up and what works for them.", fields:[
    { k:"instagram", label:"Instagram",            ask:"Handle and follower count.", ph:"@examplehq · 412k" },
    { k:"youtube",   label:"YouTube",              ask:"Channel name and subscribers.", ph:"Example Academy · 1.2M" },
    { k:"otherCh",   label:"Other channels",       ask:"Telegram, WhatsApp, LinkedIn, X, Google ads, and how big each one is.", ph:"Telegram 90k · WhatsApp channel 30k" },
    { k:"frequency", label:"How often they post",  ask:"Count the last 2 weeks.", ph:"IG 2 reels a day · YT 1 long video a week" },
    { k:"topContent", label:"Their 3 best posts this month", wide:true, must:true, ask:"Paste each link, then say in one line why it worked (hook, topic, format).", ph:"1. instagram.com/reel/… · 1.1M views · “3 mistakes toppers never make”: list + face to camera" },
    { k:"tone",      label:"Tone and hooks",       wide:true, ask:"How do they talk? Copy 2–3 hooks word for word.", ph:"Big-brother tone, Hinglish. “Stop doing this if you want 700+”" },
    { k:"ads",       label:"Ads running now",      wide:true, ask:"Search them on the Meta Ad Library and say what the ads push.", ph:"6 ads live, all for the ₹999 crash course, 3 use student testimonials", lib:true },
    { k:"offers",    label:"Offers and codes",     ask:"Any coupon, sale or referral running right now?", ph:"Code TOPPER30 · refer a friend, get ₹200" }
  ]},
  { k:"students", title:"What students say", sub:"Read the reviews and comments. Quote, don't guess.", fields:[
    { k:"rating",  label:"Rating · Downloads",     must:true, ask:"Play Store rating, number of ratings and downloads.", ph:"4.3★ · 85k ratings · 5M+ downloads" },
    { k:"love",    label:"What students love",      wide:true, must:true, ask:"Quote 2–3 real reviews or comments.", ph:"“Mock tests feel exactly like the real exam” (Play Store, Sep)" },
    { k:"hate",    label:"What students complain about", wide:true, must:true, ask:"Quote 2–3 real complaints. These are our openings.", ph:"“Doubts take 2 days to get answered” (Play Store, Oct)" }
  ]},
  { k:"take", title:"Our take", sub:"What this means for us. This is the part that matters most.", fields:[
    { k:"better",   label:"What they do better than us", wide:true, must:true, ask:"Be honest and specific.", ph:"Their free mock test gets students in the door; ours is behind sign-up." },
    { k:"weBetter", label:"What we do better",          wide:true, must:true, ask:"Where would a student pick us over them?", ph:"Our mentors reply the same day; our price is half." },
    { k:"steal",    label:"Ideas we should try",        wide:true, must:true, ask:"What, where, and who on our team would do it.", ph:"A rank predictor after every mock (Product). A weekly “mistakes” reel series (Social)." },
    { k:"avoid",    label:"What we should NOT copy",    wide:true, ask:"Things that work for them but don't fit us, or that students hate.", ph:"Calling students 5 times after sign-up." },
    { k:"verdict",  label:"One-line verdict",           wide:true, must:true, ask:"If someone reads only this line, what should they know?", ph:"Strong on content, weak on support. Beat them on doubts and mentoring." }
  ]}
];
const ALL_FIELDS = SECTIONS.flatMap(s=>s.fields);
const MUST = ALL_FIELDS.filter(f=>f.must);
const KINDS = {
  rolemodel:  { emo:"🌟", label:"Want to be like", cls:"star" },
  competitor: { emo:"⚔️", label:"Competitor",      cls:"comp" }
};
const UPD_KINDS = {
  offer:   { emo:"🏷", label:"New offer / sale" },
  price:   { emo:"💰", label:"Price change" },
  feature: { emo:"✨", label:"New feature / course" },
  post:    { emo:"🔥", label:"Post that blew up" },
  ad:      { emo:"📢", label:"New ad / campaign" },
  news:    { emo:"📰", label:"News (funding, hiring, launch)" },
  other:   { emo:"📌", label:"Something else" }
};
/* rows on the Compare tab */
const COMPARE = ["oneLine","pricing","bestFeature","instagram","youtube","rating","better","weBetter","steal","verdict"];
const AD_LIBRARY = "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=IN&q=";

/* ------------------------------------------------------------ helpers */
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const isoD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today = () => isoD(new Date());
const dmy = s => s ? new Date(s+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "";
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const safeUrl = u => /^https?:\/\//i.test(String(u||"").trim()) ? String(u).trim() : "";
function hue(name){ let h=0; for(const ch of String(name)) h=(h*31+ch.charCodeAt(0))%360; return h; }
function avatar(name){ const n=String(name||"?").trim()||"?";
  return `<span class="av" style="background:hsl(${hue(n)} 48% 46%)">${esc(n.charAt(0).toUpperCase())}</span>`; }
function toast(m){ const t=$("#toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove("on"),2600); }
const canEdit = () => !OPT.canEdit || OPT.canEdit();
function people(){ return (OPT.people && OPT.people()) || []; }          /* [{id,name,role}] */
function ownerName(co){ if(!co.ownerId) return co.owner||""; const p=people().find(x=>x.id===co.ownerId); return p ? p.name : (co.owner||""); }
const filled = (co, k) => !!String((co.f||{})[k]||"").trim();
function progress(co){ const n = MUST.filter(f=>filled(co,f.k)).length; return { n, of:MUST.length, pct:Math.round(100*n/MUST.length) }; }
const activeCo = c => c.companies.find(x=>x.id===c.activeCo) || c.companies[0] || null;

function normalize(c){
  c.companies = Array.isArray(c.companies) ? c.companies : [];
  c.companies.forEach(co=>{
    if(!co.id) co.id = uid("co");
    if(!KINDS[co.kind]) co.kind = "competitor";
    co.f = co.f && typeof co.f==="object" ? co.f : {};
    co.extra = Array.isArray(co.extra) ? co.extra : [];
    co.updates = Array.isArray(co.updates) ? co.updates : [];
    co.updates.forEach(u=>{ if(!u.id) u.id = uid("up"); if(!UPD_KINDS[u.kind]) u.kind = "other"; });
  });
  return c;
}
function saveQuiet(){ (OPT.saveQuiet || OPT.save || function(){})(SPACE); }
function save(){ (OPT.save || function(){})(SPACE); }

/* ------------------------------------------------------------ small dialog */
let dlgSubmit=null;
function openDialog({ title, sub, fields, okLabel="Save", onSave }){
  $("#dlgTitle").textContent = title;
  $("#dlgSub").textContent = sub || ""; $("#dlgSub").hidden = !sub;
  $("#dlgOk").textContent = okLabel;
  const ctl = f => f.type==="area"
      ? `<textarea id="d-${f.k}" placeholder="${esc(f.ph||"")}">${esc(f.value||"")}</textarea>`
    : f.type==="select"
      ? `<select id="d-${f.k}">${f.opts.map(([k,v])=>`<option value="${esc(k)}" ${f.value===k?"selected":""}>${esc(v)}</option>`).join("")}</select>`
    : f.type==="date"
      ? `<input id="d-${f.k}" type="date" value="${esc(f.value||"")}">`
      : `<input id="d-${f.k}" value="${esc(f.value||"")}" placeholder="${esc(f.ph||"")}">`;
  $("#dlgBody").innerHTML = fields.map(f=>`
    <div class="fbox"><div class="lh"><label for="d-${f.k}">${esc(f.label)}</label></div>${ctl(f)}</div>`).join("");
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
  HOST = document.createElement("div"); HOST.className="wx-host";
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
function goTab(t){ if(OPT.setTab) OPT.setTab(t); else { WTAB=t; draw(); } }
function draw(){
  const c = SPACE; if(!c) return;
  const B = $("#body");
  B.innerHTML = WTAB==="fill" ? fillPane(c) : WTAB==="updates" ? updatesPane(c) : WTAB==="compare" ? comparePane(c) : companiesPane(c);
  B.querySelectorAll("[data-wtab]").forEach(b=>b.onclick=()=>goTab(b.dataset.wtab));
  B.querySelectorAll("[data-addco]").forEach(b=>b.onclick=()=>addCompany(c));
  if(WTAB==="fill") wireFill(c);
  else if(WTAB==="updates") wireUpdates(c);
  else if(WTAB==="compare") B.querySelectorAll("[data-openco]").forEach(b=>b.onclick=()=>openCo(c, b.dataset.openco));
  else wireCompanies(c);
}
function openCo(c, id){ c.activeCo = id; saveQuiet(); goTab("fill"); }

function addCompany(c){
  if(!canEdit()) return;
  const ppl = people();
  openDialog({
    title:"Watch a new company",
    sub:"You'll fill the same template for it as for every other company.",
    fields:[
      { k:"name", label:"Company name", ph:"Physics Wallah, Unacademy, Duolingo…" },
      { k:"kind", label:"Why are we watching it", type:"select", value:"competitor",
        opts:Object.entries(KINDS).map(([k,v])=>[k, v.emo+" "+v.label]) },
      { k:"ownerId", label:"Who will study it", type:"select", value:"",
        opts:[["","— decide later —"]].concat(ppl.map(p=>[p.id, p.name + (p.role?" · "+p.role:"")])) },
      { k:"due", label:"Fill it by", type:"date", value:"" }
    ],
    okLabel:"Add company",
    onSave:(v)=>{
      if(!v.name){ toast("Give the company a name"); return false; }
      const p = ppl.find(x=>x.id===v.ownerId);
      const co = { id:uid("co"), name:v.name, kind:v.kind, ownerId:v.ownerId, owner:p?p.name:"", due:v.due,
                   f:{}, extra:[], updates:[], created:today() };
      c.companies.push(co); c.activeCo = co.id;
      if(co.ownerId) notifyOwner(c, co);
      save(); goTab("fill");
    }
  });
}
/* the person studying it gets an email + a 🔔 (index.html → idea-mail "assign") */
function notifyOwner(c, co){
  if(!co.ownerId || !OPT.notify) return;
  OPT.notify(c, co).then(r=>{
    if(r && r.sent) toast(`${co.owner} notified — email sent`);
    else if(r && r.belled) toast(`${co.owner} notified in the app (email didn't go: ${r.reason||"unknown"})`);
    else toast(`Saved — couldn't notify ${co.owner}${r&&r.reason?": "+r.reason:""}`);
  });
}

const guideHtml = () => `
  <div class="guide">
    <h4>👋 New here? How to study a company</h4>
    <div class="steps">
      <div class="step"><span class="n">1</span><span><b>Open your company</b> below, or add one with <b>+ Watch a company</b>.</span></div>
      <div class="step"><span class="n">2</span><span><b>Fill the template top to bottom.</b> Every box tells you what to write and shows an example. Red <b>MUST FILL</b> boxes count towards done.</span></div>
      <div class="step"><span class="n">3</span><span><b>Use links and quotes, not opinions.</b> Paste the post, the review, the price page.</span></div>
      <div class="step"><span class="n">4</span><span><b>Spotted something new later?</b> Add it under <b>What changed</b> so the team sees it.</span></div>
    </div>
  </div>`;

/* ============================================================ COMPANIES */
function companiesPane(c){
  const ro = !canEdit();
  const card = co => {
    const k = KINDS[co.kind], pg = progress(co), on = ownerName(co);
    const late = co.due && co.due < today() && pg.n < pg.of;
    const last = co.updates.map(u=>u.date||"").sort().pop();
    return `<button class="co ${k.cls}" data-openco="${esc(co.id)}">
      <div class="row" style="justify-content:space-between"><h4>${esc(co.name)}</h4><span class="badge ${k.cls}">${k.emo} ${esc(k.label)}</span></div>
      <p>${filled(co,"oneLine") ? esc(co.f.oneLine) : `<span style="color:var(--ink-3)">Not filled yet. Open it to start.</span>`}</p>
      <div class="meter ${pg.n===pg.of?"done":""}"><i style="width:${pg.pct}%"></i></div>
      <div class="foot">
        <span>${pg.n===pg.of ? "✓ template done" : `${pg.n} of ${pg.of} must-fill boxes`}</span>
        ${late ? `<span class="badge crit">late · due ${esc(dmy(co.due))}</span>` : co.due ? `<span>due ${esc(dmy(co.due))}</span>` : ""}
      </div>
      <div class="foot">
        ${on ? `<span class="who">${avatar(on)}${esc(on)}</span>` : `<span class="badge mute">nobody studying it</span>`}
        <span>${co.updates.length ? `${co.updates.length} update${co.updates.length===1?"":"s"} · last ${esc(dmy(last))}` : "no updates yet"}</span>
      </div>
    </button>`;
  };
  const group = (kind, title, sub) => {
    const L = c.companies.filter(x=>x.kind===kind);
    if(!L.length) return "";
    return `<div class="sec-h" style="margin-top:6px"><h3>${KINDS[kind].emo} ${title}</h3><span class="hint">${sub}</span></div>
      <div class="cos" style="margin-bottom:24px">${L.map(card).join("")}</div>`;
  };
  return `
    ${ro?`<div class="bar2"><span class="ic2">VIEW ONLY</span><p>You can read these studies but not change them.</p></div>`:""}
    ${guideHtml()}
    <div class="sec-h">
      <h3>Companies we keep an eye on</h3>
      <span class="hint">${c.companies.length} compan${c.companies.length===1?"y":"ies"}</span>
      ${ro?"":`<button class="btn pri" data-addco style="margin-left:auto">+ Watch a company</button>`}
    </div>
    ${c.companies.length
      ? group("rolemodel","Companies we want to be like","what to learn from") + group("competitor","Competitors","where they take our students")
      : `<div class="empty"><h4>No companies yet</h4>
          <p>Add a company we admire or one we compete with. Pick someone to study it; they'll get the same fixed template to fill.</p>
          ${ro?"":`<button class="btn pri" data-addco>+ Watch the first company</button>`}</div>`}`;
}
function wireCompanies(c){
  $("#body").querySelectorAll("[data-openco]").forEach(b=>b.onclick=()=>openCo(c, b.dataset.openco));
}

/* ============================================================ FILL THE TEMPLATE */
function fillPane(c){
  const co = activeCo(c), ro = !canEdit(), dis = ro ? "disabled" : "";
  if(!co) return `${guideHtml()}<div class="empty"><h4>Pick a company first</h4>
    <p>The template opens for one company at a time.</p>
    ${ro?"":`<button class="btn pri" data-addco>+ Watch a company</button>`}</div>`;
  const pg = progress(co), ppl = people();
  const box = f => {
    const v = (co.f||{})[f.k] || "", has = !!String(v).trim();
    const url = f.link ? safeUrl(v) : "";
    const extraLink = url ? `<a class="go" href="${esc(url)}" target="_blank" rel="noopener">open ↗</a>`
      : f.lib ? `<a class="go" href="${esc(AD_LIBRARY + encodeURIComponent(co.name))}" target="_blank" rel="noopener">Ad Library ↗</a>` : "";
    return `<div class="fbox ${f.wide?"wide":""} ${has?"filled":""}" data-box="${f.k}">
      <div class="lh"><label for="f-${f.k}">${esc(f.label)}</label>${f.must?`<span class="must">${has?"✓ ":""}MUST FILL</span>`:""}${extraLink}</div>
      <p class="ask">${esc(f.ask)}</p>
      ${f.wide ? `<textarea id="f-${f.k}" data-f="${f.k}" placeholder="e.g. ${esc(f.ph)}" ${dis}>${esc(v)}</textarea>`
               : `<input id="f-${f.k}" data-f="${f.k}" value="${esc(v)}" placeholder="e.g. ${esc(f.ph)}" ${dis}>`}
    </div>`;
  };
  const secCount = s => { const m = s.fields.filter(f=>f.must); return { n:m.filter(f=>filled(co,f.k)).length, of:m.length }; };
  return `
    ${ro?`<div class="bar2"><span class="ic2">VIEW ONLY</span><p>You can read this study but not change it.</p></div>`:""}
    <div class="pick">
      <span class="hint">Studying:</span>
      ${c.companies.map(x=>`<button class="chip ${x.id===co.id?"on":""}" data-pick="${esc(x.id)}">${KINDS[x.kind].emo} ${esc(x.name)}</button>`).join("")}
      ${ro?"":`<button class="chip" data-addco>+ add</button>`}
    </div>

    <div class="cohead">
      <div>
        <input class="nm" id="coName" value="${esc(co.name)}" ${dis} aria-label="Company name">
        <div class="seg">${Object.entries(KINDS).map(([k,v])=>`<button class="${k===co.kind?"on "+v.cls:""}" data-kind="${k}" ${dis}>${v.emo} ${esc(v.label)}</button>`).join("")}</div>
      </div>
      <div class="meta3">
        <div class="mini"><label for="coOwner">Studied by</label>
          <select id="coOwner" ${dis}>${[["","— nobody yet —"]].concat(ppl.map(p=>[p.id,p.name])).map(([k,v])=>`<option value="${esc(k)}" ${(co.ownerId||"")===k?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="mini"><label for="coDue">Fill it by</label><input id="coDue" type="date" value="${esc(co.due||"")}" ${dis}></div>
      </div>
      <div class="prog"><div class="meter ${pg.n===pg.of?"done":""}"><i style="width:${pg.pct}%"></i></div>
        <span id="progTxt">${pg.n===pg.of ? "✓ All must-fill boxes done" : `${pg.n} of ${pg.of} must-fill boxes done`}</span></div>
    </div>

    <nav class="toc">${SECTIONS.map((s,i)=>{ const sc=secCount(s);
      return `<button data-jump="${s.k}" class="${sc.n===sc.of?"ok":""}">${i+1}. ${esc(s.title)} <i>${sc.n}/${sc.of}</i></button>`; }).join("")}
      ${co.extra.length||!ro ? `<button data-jump="own">${SECTIONS.length+1}. Your own notes</button>` : ""}</nav>

    ${SECTIONS.map((s,i)=>{ const sc=secCount(s); return `
      <div class="panel" id="sec-${s.k}">
        <div class="panel-h"><span class="n">${i+1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.sub)}</p></div>
          <span class="cnt" data-cnt="${s.k}">${sc.n}/${sc.of} must-fill</span></div>
        <div class="fgrid">${s.fields.map(box).join("")}</div>
      </div>`; }).join("")}

    ${co.extra.length||!ro ? `<div class="panel" id="sec-own">
      <div class="panel-h"><span class="n">${SECTIONS.length+1}</span><div><h3>Your own notes</h3>
        <p>Found something the template doesn't ask for? Add a box for it here.</p></div></div>
      <div class="fgrid">
        ${co.extra.map((x,i)=>`<div class="fbox custom ${x.wide?"wide":""}">
          <div class="lh"><label>${esc(x.label)}</label>${ro?"":`<button class="rm" data-rmfield="${i}" title="Remove this box">✕</button>`}</div>
          ${x.wide ? `<textarea data-x="${i}" ${dis}>${esc(x.value||"")}</textarea>` : `<input data-x="${i}" value="${esc(x.value||"")}" ${dis}>`}
        </div>`).join("")}
        ${ro?"":`<button class="addfield" id="addField">+ Add a box</button>`}
      </div></div>` : ""}

    <div class="row" style="margin-top:22px;padding-top:16px;border-top:1px solid var(--line)">
      <button class="btn" data-wtab="updates">👀 ${co.updates.length ? `See ${co.updates.length} update${co.updates.length===1?"":"s"}` : "Log something that changed"}</button>
      ${ro?"":`<button class="btn danger sm" id="delCo" style="margin-left:auto">Stop watching ${esc(co.name)}</button>`}
    </div>`;
}
function wireFill(c){
  const B = $("#body"), co = activeCo(c); if(!co) return;
  B.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{ c.activeCo=b.dataset.pick; saveQuiet(); draw(); });
  B.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>{ const el=$("#sec-"+b.dataset.jump); if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); });
  /* typing: save quietly and refresh only the counters, so the cursor stays put */
  const refresh = ()=>{
    const pg = progress(co);
    const t = $("#progTxt"); if(t) t.textContent = pg.n===pg.of ? "✓ All must-fill boxes done" : `${pg.n} of ${pg.of} must-fill boxes done`;
    const m = B.querySelector(".prog .meter"); if(m){ m.classList.toggle("done", pg.n===pg.of); m.firstElementChild.style.width = pg.pct+"%"; }
    SECTIONS.forEach(s=>{ const ms=s.fields.filter(f=>f.must), n=ms.filter(f=>filled(co,f.k)).length;
      const el=B.querySelector(`[data-cnt="${s.k}"]`); if(el) el.textContent = `${n}/${ms.length} must-fill`;
      const tb=B.querySelector(`[data-jump="${s.k}"]`); if(tb){ tb.classList.toggle("ok", n===ms.length); tb.querySelector("i").textContent=`${n}/${ms.length}`; } });
  };
  B.querySelectorAll("[data-f]").forEach(el=>el.oninput=()=>{
    co.f[el.dataset.f] = el.value;
    const bx = el.closest(".fbox"), has = !!el.value.trim();
    bx.classList.toggle("filled", has);
    const m = bx.querySelector(".must"); if(m) m.textContent = (has?"✓ ":"") + "MUST FILL";
    co.updated = today(); saveQuiet(); refresh();
  });
  /* link boxes: keep the "open ↗" next to the label in step with what's typed, without a redraw */
  B.querySelectorAll("[data-f]").forEach(el=>{
    if(!ALL_FIELDS.find(f=>f.k===el.dataset.f && f.link)) return;
    el.addEventListener("input", ()=>{
      const lh = el.closest(".fbox").querySelector(".lh"), url = safeUrl(el.value);
      let a = lh.querySelector("a.go");
      if(!url){ if(a) a.remove(); return; }
      if(!a){ a = document.createElement("a"); a.className = "go"; a.target = "_blank"; a.rel = "noopener"; a.textContent = "open ↗"; lh.appendChild(a); }
      a.href = url;
    });
  });
  const nm=$("#coName"); if(nm){ nm.oninput=()=>{ co.name = nm.value.trim() || co.name; saveQuiet(); };
    nm.onchange=()=>{ if(!nm.value.trim()) nm.value = co.name; draw(); }; }
  B.querySelectorAll("[data-kind]").forEach(b=>b.onclick=()=>{ co.kind=b.dataset.kind; saveQuiet(); draw(); });
  const ow=$("#coOwner"); if(ow) ow.onchange=()=>{
    const p = people().find(x=>x.id===ow.value);
    co.ownerId = ow.value; co.owner = p ? p.name : "";
    saveQuiet(); if(co.ownerId) notifyOwner(c, co);
  };
  const du=$("#coDue"); if(du) du.onchange=()=>{ co.due = du.value; saveQuiet(); };
  B.querySelectorAll("[data-x]").forEach(el=>el.oninput=()=>{ co.extra[Number(el.dataset.x)].value = el.value; saveQuiet(); });
  B.querySelectorAll("[data-rmfield]").forEach(b=>b.onclick=()=>{ co.extra.splice(Number(b.dataset.rmfield),1); saveQuiet(); draw(); });
  const af=$("#addField"); if(af) af.onclick=()=>openDialog({
    title:"Add a box", sub:`It's added to ${co.name} only.`,
    fields:[ { k:"label", label:"What is it called?", ph:"Hiring, Partnerships, Website SEO…" },
             { k:"wide", label:"How much room does it need", type:"select", value:"yes", opts:[["no","One line"],["yes","A paragraph"]] } ],
    onSave:(v)=>{ if(!v.label){ toast("Name the box"); return false; }
      co.extra.push({ label:v.label, value:"", wide:v.wide==="yes" }); saveQuiet(); draw(); }
  });
  const dc=$("#delCo"); if(dc) dc.onclick=()=>openDialog({
    title:`Stop watching ${co.name}?`,
    sub:"This deletes its filled template and all its updates. It cannot be undone.",
    okLabel:"Delete", fields:[{ k:"confirm", label:"Type the word delete to confirm", ph:"delete" }],
    onSave:(v)=>{ if(v.confirm.toLowerCase()!=="delete"){ toast("Type delete to confirm"); return false; }
      c.companies.splice(c.companies.indexOf(co),1); c.activeCo = null; save(); goTab("companies"); }
  });
}

/* ============================================================ WHAT CHANGED */
function updatesPane(c){
  const ro = !canEdit();
  if(!c.companies.length) return `<div class="empty"><h4>Nothing to log yet</h4>
    <p>Add a company first, then write down anything new you spot about it here.</p>
    ${ro?"":`<button class="btn pri" data-addco>+ Watch a company</button>`}</div>`;
  if(UPDFILTER!=="all" && !c.companies.some(x=>x.id===UPDFILTER)) UPDFILTER="all";
  const all = c.companies.flatMap(co=>co.updates.map(u=>({u, co})))
    .filter(x=>UPDFILTER==="all" || x.co.id===UPDFILTER)
    .sort((a,b)=>(b.u.date||"").localeCompare(a.u.date||""));
  let lastDay = null;
  return `
    <div class="bar2"><span class="ic2">HOW</span><p>Every time you notice something new (a sale, a price change, a post that blew up, a new feature),
      add it here with a link. Newest is on top, so anyone can catch up in a minute.</p></div>
    <div class="filterbar">
      <button class="chip ${UPDFILTER==="all"?"on":""}" data-uf="all">All companies</button>
      ${c.companies.map(co=>`<button class="chip ${UPDFILTER===co.id?"on":""}" data-uf="${esc(co.id)}">${KINDS[co.kind].emo} ${esc(co.name)} · ${co.updates.length}</button>`).join("")}
      ${ro?"":`<button class="btn pri" id="addUpd" style="margin-left:auto">+ Log what changed</button>`}
    </div>
    ${all.length ? all.map(({u,co})=>{
      const k = UPD_KINDS[u.kind], link = safeUrl(u.link);
      const head = u.date!==lastDay ? `<div class="dayh">${esc(dmy(u.date)||"No date")}</div>` : ""; lastDay = u.date;
      return `${head}<div class="upd">
        <span class="ic">${k.emo}</span>
        <div class="upd-b">
          <h5>${esc(u.text)}</h5>
          <div class="row" style="gap:6px"><span class="badge ${KINDS[co.kind].cls}">${esc(co.name)}</span><span class="dchip">${esc(k.label)}</span>
            ${u.by?`<span class="who">${avatar(u.by)}${esc(u.by)}</span>`:""}</div>
          ${link?`<p><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a></p>`:""}
          ${u.why?`<p><b>What it means for us:</b> ${esc(u.why)}</p>`:""}
        </div>
        ${ro?"":`<button class="btn sm danger" data-rmupd="${esc(co.id)}|${esc(u.id)}" title="Remove">✕</button>`}
      </div>`; }).join("")
    : `<div class="empty"><h4>No updates yet</h4><p>When you spot something new, log it here.</p></div>`}`;
}
function wireUpdates(c){
  const B = $("#body");
  B.querySelectorAll("[data-uf]").forEach(b=>b.onclick=()=>{ UPDFILTER=b.dataset.uf; draw(); });
  B.querySelectorAll("[data-rmupd]").forEach(b=>b.onclick=()=>{
    const [cid, id] = b.dataset.rmupd.split("|"); const co = c.companies.find(x=>x.id===cid); if(!co) return;
    co.updates = co.updates.filter(u=>u.id!==id); save(); });
  const a=$("#addUpd"); if(a) a.onclick=()=>openDialog({
    title:"Log what changed", sub:"Short and with a link, so others can check it.",
    fields:[
      { k:"co", label:"Which company", type:"select", value: UPDFILTER!=="all" ? UPDFILTER : ((activeCo(c)||{}).id||""),
        opts:c.companies.map(x=>[x.id, KINDS[x.kind].emo+" "+x.name]) },
      { k:"kind", label:"What kind of change", type:"select", value:"offer", opts:Object.entries(UPD_KINDS).map(([k,v])=>[k,v.emo+" "+v.label]) },
      { k:"text", label:"What happened", ph:"Launched a ₹499 CUET crash course with 3 free mocks" },
      { k:"date", label:"When you spotted it", type:"date", value:today() },
      { k:"link", label:"Link (post, page, ad)", ph:"https://…" },
      { k:"why",  label:"What it means for us (optional)", type:"area", ph:"Our crash course is ₹999 — should we answer before 20 Oct?" }
    ],
    okLabel:"Add",
    onSave:(v)=>{
      if(!v.text){ toast("Say what happened"); return false; }
      const co = c.companies.find(x=>x.id===v.co); if(!co){ toast("Pick a company"); return false; }
      co.updates.push({ id:uid("up"), kind:v.kind, text:v.text, date:v.date||today(), link:v.link, why:v.why, by:(OPT.me && OPT.me()) || "" });
      save(); toast("Logged");
    }
  });
}

/* ============================================================ COMPARE */
function comparePane(c){
  if(c.companies.length < 1) return `<div class="empty"><h4>Nothing to compare yet</h4>
    <p>Fill the template for two or more companies and they appear here side by side.</p>
    ${canEdit()?`<button class="btn pri" data-addco>+ Watch a company</button>`:""}</div>`;
  const cos = [...c.companies].sort((a,b)=>a.kind===b.kind ? 0 : a.kind==="rolemodel" ? -1 : 1);
  const rows = COMPARE.map(k=>ALL_FIELDS.find(f=>f.k===k)).filter(Boolean);
  return `
    <div class="bar2"><span class="ic2">TIP</span><p>The key boxes from every company's template, side by side. A red <b>not filled</b> means that box is still empty. Click a company name to open its template.</p></div>
    <div class="tw"><table>
      <thead><tr><th class="rowh"></th>${cos.map(co=>{ const k=KINDS[co.kind], pg=progress(co);
        return `<th><button data-openco="${esc(co.id)}" style="font-weight:700;font-size:14px;text-align:left">${esc(co.name)}</button>
          <div class="row" style="gap:6px;margin-top:5px"><span class="badge ${k.cls}">${k.emo} ${esc(k.label)}</span><span class="hint">${pg.pct}% filled</span></div></th>`; }).join("")}</tr></thead>
      <tbody>${rows.map(f=>`<tr><td class="rowh">${esc(f.label)}</td>${cos.map(co=>`<td>${filled(co,f.k)?esc(co.f[f.k]):`<span class="blank">not filled</span>`}</td>`).join("")}</tr>`).join("")}
        <tr><td class="rowh">Last update</td>${cos.map(co=>{ const u=[...co.updates].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
          return `<td>${u?`${esc(dmy(u.date))}: ${esc(u.text)}`:`<span class="hint">none</span>`}</td>`; }).join("")}</tr>
      </tbody>
    </table></div>`;
}

/* ============================================================ API */
window.WX = {
  tabs: [["companies","Companies"],["fill","Fill the template"],["updates","What changed"],["compare","Compare"]],
  normalize: normalize,
  /* opt: { tab, canEdit(), me() → name, people() → [{id,name,role}], save(space), saveQuiet(space),
            notify(space, company) → Promise<{sent,belled,reason}>, setTab(t) } */
  render: function(space, wrap, opt){
    mount();
    OPT = opt || {};
    if(SPACE!==space){ SPACE=space; UPDFILTER="all"; if(R) closeDialog(); }
    normalize(space);
    WTAB = ["companies","fill","updates","compare"].includes(OPT.tab) ? OPT.tab : "companies";
    if(HOST.parentNode!==wrap) wrap.appendChild(HOST);
    draw();
  }
};
})();
