/* =====================================================================
   MAVERICK ADMIN — All videos · Review queue · Publish to verify · Payouts
   (Cyberflow team app, tools.dubuddy.in)

   WHAT THIS IS: the team desk for the Maverick creator programme
   (maverick.dubuddy.in, repo Dubuddyinternal/maverick). Creators sign up
   there, send a Google Drive link, publish once approved, and add the
   published link. Everything they do lands here, live:
     * All videos — every submission, newest first, with a full record
       (open it from the S. No.) where any status can be changed.
     * Review queue — Approve, or Reject with a reason the creator sees.
     * Publish to verify — the creator says it is live: Approve (base pay
       becomes due 7 days after publishing) or send it back with a reason.
     * Payouts — Base pay and Bonuses (enter the 30-day views, the slab
       picks the amount). Only the payout head releases money.
     * 👥 Creators — everyone who logged in (name, number, email, videos,
       pay), an Open view per creator with a shareable dashboard link
       (?mx=<id>), and a CSV download with the columns you pick.
     * ✉️ Emails — every email creators got from maverick@dubuddy.in (each
       step above sends one through the maverick-mail Edge Function, in
       Dubuddyinternal/maverick), and a link to open that mailbox.
   It is its own space in the sidebar (index.html, type "maverick", added
   from Administration → Spaces). index.html calls MX.render(space, host, opt)
   when the space is open and MX.boot(opt) once after sign-in; it is drawn
   inside a shadow root so its styles and the app's never touch.

   DATA: Supabase tables maverick_creators, maverick_submissions and
   maverick_payouts (Dubuddyinternal/maverick → supabase/maverick_schema.sql),
   read and written straight from here; the database's policies decide who
   may do what. Permissions on the dubuddy team (Administration → Roles):
     review_maverick — approve / reject, verify links, enter views
     pay_maverick    — release base pay and bonuses (the payout head)
   Owners have both. Nothing about Maverick is saved in team_data.
   ===================================================================== */
(function(){
"use strict";

/* ============================================================ CONFIG
   Every number lives here; keep it in step with the creator site's
   lib/config.js (Dubuddyinternal/maverick).                           */
const CFG = {
  currency:"₹",
  base:50,
  basePayDays:7,        // base pay is due this many days after the publishing date
  bonusWindow:30,       // the bonus queue opens this many days after the publishing date
  reviewDays:"2 to 4 days",
  remindBefore:3,       // flag base pay this many days before it is due
  viewFloor:1500,
  mailbox:"https://mail.zoho.in/zm/",   // maverick@dubuddy.in, where creators' replies land
  slabs:[
    {min:1500,   max:5000,   bonus:50,   label:"1,500 to 5,000"},
    {min:5000,   max:15000,  bonus:150,  label:"5,000 to 15,000"},
    {min:15000,  max:30000,  bonus:300,  label:"15,000 to 30,000"},
    {min:30000,  max:100000, bonus:500,  label:"30,000 and above"},
    {min:100000, max:null,   bonus:1000, label:"1,00,000 and above"}
  ],
  rejectReasons:[
    "Dubuddy is never said or shown",
    "The keyword CUET 2027 is missing",
    "The Drive link does not open for us",
    "The video is not yours",
    "The score shown could not be verified",
    "It reads like an ad, not like your own prep"
  ],
  verifyReasons:[
    "The required mentions are missing",
    "The published link does not open",
    "This is not the video we approved",
    "It is on a different channel",
    "The tracking link is missing from the description"
  ]
};
function money(n){ return CFG.currency + Number(n||0).toLocaleString("en-IN"); }
function slabFor(v){
  if(v===null || v===undefined || v==="") return null;
  v = Number(v);
  if(v < CFG.viewFloor) return null;
  for(let i=CFG.slabs.length-1;i>=0;i--){ if(v>=CFG.slabs[i].min) return CFG.slabs[i]; }
  return null;
}
function bonusFor(v){ const s=slabFor(v); return s?s.bonus:0; }

/* ============================================================ STATUS
   The database keeps the review state on the submission; "base pay
   released" and "bonus released" come from maverick_payouts.          */
const STATUS = {
  under_review  : {label:"Under review",               chip:"amber",  creator:"Under review"},
  needs_info    : {label:"Needs info",                 chip:"amber",  creator:"Needs info"},
  approved      : {label:"Approved, ready to publish", chip:"green",  creator:"Approved, ready to publish"},
  rejected      : {label:"Rejected",                   chip:"red",    creator:"Rejected"},
  published     : {label:"Published, to verify",       chip:"blue",   creator:"Published"},
  verified      : {label:"Verified, base pay due",     chip:"coral",  creator:"Published"},
  base_released : {label:"Base pay released",          chip:"green",  creator:"Base pay released"},
  bonus_released: {label:"Bonus released",             chip:"purple", creator:"Bonus released"}
};
const DB_OF = { under_review:"in_review", needs_info:"needs_info", approved:"approved", rejected:"rejected", published:"published", verified:"verified" };
const KEY_OF = { in_review:"under_review", needs_info:"needs_info", approved:"approved", rejected:"rejected", published:"published", verified:"verified" };
const PLATFORM = { instagram:"Instagram", youtube:"YouTube", other:"Other" };

const CSS = `
:host{display:block;color-scheme:light;
  /* the team app's own palette (index.html :root), so this space looks like the rest of tools.dubuddy.in */
  --paper:#FBF6F1; --card:#FFFFFF; --soft:#FAF6F2; --ink:#1A1614; --muted:#6B6058; --mut2:#9A8F87;
  --line:#EDE4DC; --line-2:#DCCEC2;
  --accent:#E8622B; --accent-soft:#FDEDE4; --accent-ink:#B8461A;
  --good:#1F7A4D; --good-soft:#E3F2EA; --warn:#9A6A12; --warn-soft:#FBF1DC;
  --crit:#B03A34; --crit-soft:#FBE7E5; --blue:#3B6FD4; --blue-soft:#E8EFFC; --star:#6246D4; --star-soft:#ECE8FB;
  --r:10px; --r-s:7px;
}
*{box-sizing:border-box;margin:0;padding:0}
[hidden]{display:none!important}
.mxroot{font-family:var(--sans,"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif);color:var(--ink);
  font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;text-align:left;padding:4px 0 40px}
button,input,select,textarea{font:inherit;color:inherit}
button{background:none;border:0;cursor:pointer}
a{color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.hand{font-style:italic;color:var(--mut2);font-size:13px}
.ico{fill:none;stroke:currentColor;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}

/* header: tabs on the left; refresh, bell and the "waiting" count on the right */
.top{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
.top .right{margin-left:auto;display:flex;align-items:center;gap:8px;position:relative;padding-bottom:8px}
.tabs{display:flex;gap:2px;flex-wrap:wrap}
.tab{padding:11px 14px;font-weight:600;font-size:14px;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;align-items:center;gap:7px}
.tab:hover{color:var(--ink)}
.tab.on{color:var(--accent);border-bottom-color:var(--accent)}
.tab .cnt{font-size:11px;font-weight:700;background:var(--soft);border:1px solid var(--line);color:var(--muted);border-radius:99px;padding:0 7px;line-height:18px}
.tab.on .cnt{background:var(--accent-soft);border-color:transparent;color:var(--accent-ink)}
.sticker{display:flex;align-items:center;gap:6px;border:1px solid var(--line-2);border-radius:99px;padding:5px 12px;background:var(--card);font-size:12.5px;color:var(--muted)}
.sticker b{font-size:14px;color:var(--ink)}
.refresh{border:1px solid var(--line-2);background:var(--card);border-radius:var(--r-s);padding:6px 11px;font-size:12.5px;font-weight:600;color:var(--muted)}
.refresh:hover{border-color:var(--muted);color:var(--ink)}
.bell{position:relative;width:34px;height:34px;border-radius:var(--r-s);border:1px solid var(--line-2);background:var(--card);display:grid;place-items:center;color:var(--muted)}
.bell:hover{border-color:var(--muted);color:var(--ink)}
.bell i{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border-radius:99px;background:var(--accent);color:#fff;font-style:normal;font-size:10.5px;font-weight:700;display:grid;place-items:center;padding:0 5px}
.bellpanel{position:absolute;right:0;top:46px;width:360px;max-width:86vw;background:var(--card);border:1px solid var(--line);border-radius:12px;
  box-shadow:0 18px 50px rgba(10,8,5,.18);padding:14px;z-index:60}
.bellpanel h5{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut2);font-weight:700;margin-bottom:10px}
.nrow{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-radius:8px;margin-bottom:6px;background:var(--soft)}
.nrow.hot{background:var(--accent-soft)} .nrow.due{background:var(--warn-soft)}
.nrow svg{width:18px;height:18px;flex:none;margin-top:2px}
.nrow b{display:block;font-size:13.5px}
.nrow p{font-size:12.5px;color:var(--muted);margin-top:1px}

/* sub-tabs (Payouts → Base pay / Bonuses) */
.subtabs{display:inline-flex;border:1px solid var(--line-2);border-radius:99px;overflow:hidden;margin:20px 0 0;background:var(--card)}
.stab{padding:6px 14px;font-size:12.5px;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:7px}
.stab.on{background:var(--ink);color:#fff}
.stab .cnt{font-size:11px;font-weight:700;background:var(--soft);color:var(--muted);border-radius:99px;padding:0 6px;line-height:17px}
.stab.on .cnt{background:var(--accent);color:#fff}

/* numbers */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;position:relative}
.kpi h6{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--mut2);font-weight:700}
.kpi b{display:block;font-size:24px;font-weight:700;letter-spacing:-.02em;margin-top:6px;line-height:1.1}
.kpi p{font-size:12.5px;color:var(--muted);margin-top:4px}
.kpi svg.bg{display:none}
.kpi::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:var(--line-2)}
.kpi.c1::before{background:var(--accent)} .kpi.c2::before{background:var(--blue)} .kpi.c3::before{background:var(--good)} .kpi.c4::before{background:var(--warn)}

/* tables */
.panel{background:var(--card);border:1px solid var(--line);border-radius:var(--r);margin-top:16px;overflow:hidden}
.phead{display:flex;align-items:center;gap:10px;padding:14px 16px;flex-wrap:wrap}
.phead h3{font-size:16px;font-weight:700;letter-spacing:-.01em}
.phead .n{font-size:12.5px;color:var(--muted)}
.phead .right{margin-left:auto;display:flex;gap:8px;align-items:center}
.srch{border:1px solid var(--line-2);border-radius:var(--r-s);padding:7px 11px;font-size:13px;width:240px;max-width:100%;background:var(--card)}
.srch:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.tblwrap{overflow-x:auto;border-top:1px solid var(--line)}
table{width:100%;border-collapse:collapse}
th{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--mut2);font-weight:700;text-align:left;padding:9px 12px;background:var(--soft);border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:middle;font-size:13px;white-space:nowrap}
tr:last-child td{border-bottom:0}
tbody tr:hover{background:#FDFAF7}
td .meta{font-size:12px;color:var(--muted);margin-top:1px}
td b{font-weight:600}
.tnum{font-variant-numeric:tabular-nums}
.mut{color:var(--mut2)}
.lnk{color:var(--accent);font-weight:600;text-decoration:none;cursor:pointer}
.lnk:hover{text-decoration:underline}
.sn{min-width:30px;height:26px;padding:0 7px;border-radius:6px;border:1px solid var(--line-2);background:var(--card);font-weight:700;font-size:12.5px;font-variant-numeric:tabular-nums}
.sn:hover{border-color:var(--accent);color:var(--accent)}
.acts{display:flex;gap:6px;justify-content:flex-end}
.panel.stickylast th:last-child,.panel.stickylast td:last-child{position:sticky;right:0;z-index:3;box-shadow:-1px 0 0 var(--line)}
.panel.stickylast td:last-child{background:var(--card)}
.panel.stickylast th:last-child{background:var(--soft)}
.panel.stickylast tbody tr:hover td:last-child{background:#FDFAF7}

/* status badges */
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:600;white-space:nowrap;background:var(--soft);color:var(--muted)}
.chip .d{width:6px;height:6px;border-radius:50%;background:currentColor}
.chip.amber{background:var(--warn-soft);color:var(--warn)}
.chip.green{background:var(--good-soft);color:var(--good)}
.chip.red{background:var(--crit-soft);color:var(--crit)}
.chip.blue{background:var(--blue-soft);color:var(--blue)}
.chip.purple{background:var(--star-soft);color:var(--star)}
.chip.coral{background:var(--accent-soft);color:var(--accent-ink)}
.due{font-weight:600;font-size:12.5px}
.due.soon{color:var(--warn)} .due.late{color:var(--crit)} .due.ok{color:var(--muted)}

/* buttons */
.btn{background:var(--accent);color:#fff;border:1px solid var(--accent);border-radius:var(--r-s);padding:8px 14px;font-weight:600;font-size:13px}
.btn:hover{filter:brightness(.96)}
.btn[disabled]{opacity:.55;cursor:progress}
.btn.g{background:var(--card);color:var(--ink);border-color:var(--line-2)}
.btn.g:hover{border-color:var(--muted)}
.btn.ok{background:var(--good);border-color:var(--good)}
.btn.no{background:var(--card);color:var(--crit);border-color:color-mix(in srgb,var(--crit) 40%,var(--line-2))}
.btn.sm{padding:5px 10px;font-size:12px}
.btn.lock{background:var(--soft);color:var(--mut2);border-color:var(--line);cursor:not-allowed}
.btn.lock:hover{filter:none}

.empty{padding:40px 20px;text-align:center}
.empty b{display:block;font-size:15px;margin-bottom:4px}
.empty p{color:var(--muted);font-size:13px}
.empty .hand{margin-top:6px}
.notice{margin-top:20px;background:var(--card);border:1px dashed var(--line-2);border-radius:var(--r);padding:32px 20px;text-align:center}
.notice b{display:block;font-size:15px;margin-bottom:4px}
.notice p{color:var(--muted);max-width:560px;margin:0 auto;font-size:13px}
.viewin{width:104px;border:1px solid var(--line-2);border-radius:6px;padding:5px 9px;font-weight:600;background:var(--card);font-variant-numeric:tabular-nums}
.viewin:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}

/* dialogs */
.scrim{position:fixed;inset:0;background:rgba(10,8,5,.44);opacity:0;pointer-events:none;transition:opacity .16s;z-index:80}
.scrim.on{opacity:1;pointer-events:auto}
.modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-48%);opacity:0;pointer-events:none;
  width:720px;max-width:94vw;max-height:88vh;background:var(--card);border:1px solid var(--line);border-radius:14px;
  box-shadow:0 18px 50px rgba(10,8,5,.22);z-index:90;display:flex;flex-direction:column;transition:.18s;
  font-family:var(--sans,"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif);color:var(--ink);font-size:14px;line-height:1.5}
.modal.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%)}
.mhead{padding:20px 22px 14px;border-bottom:1px solid var(--line);display:flex;gap:12px;align-items:flex-start}
.mhead h2{font-size:19px;font-weight:700;letter-spacing:-.02em}
.mhead .x{margin-left:auto;width:30px;height:30px;border-radius:var(--r-s);border:1px solid var(--line-2);display:grid;place-items:center;font-weight:700;flex:none;color:var(--muted)}
.mhead .x:hover{color:var(--ink);border-color:var(--muted)}
.mbody{padding:18px 22px;overflow-y:auto}
.mfoot{padding:14px 22px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center;background:var(--soft);border-radius:0 0 14px 14px;flex-wrap:wrap}
.mfoot .sp{margin-left:auto;font-size:12.5px;color:var(--muted)}
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fbox{background:var(--soft);border:1px solid var(--line);border-radius:var(--r-s);padding:10px 12px;min-width:0}
.fbox.w{grid-column:1/-1}
.fbox label{display:block;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--mut2);font-weight:700;margin-bottom:3px}
.fbox .v{font-weight:500;font-size:14px;word-break:break-all}
.fbox select{width:100%;border:1px solid var(--line-2);border-radius:6px;padding:7px 9px;font-weight:500;background:var(--card)}
.fbox textarea{width:100%;border:1px solid var(--line-2);border-radius:6px;padding:8px 10px;background:var(--card);resize:vertical;min-height:70px;margin-top:6px}
.pre{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.pre button{border:1px solid var(--line-2);border-radius:99px;padding:5px 11px;font-size:12.5px;background:var(--card);color:var(--muted)}
.pre button:hover{border-color:var(--crit);color:var(--crit)}
textarea.rsn{width:100%;border:1px solid var(--line-2);border-radius:var(--r-s);padding:10px 12px;font-size:14px;resize:vertical;min-height:100px;background:var(--card)}
textarea.rsn:focus{outline:none;border-color:var(--crit);box-shadow:0 0 0 1px var(--crit)}
.csvcols{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}
.csvcols label{display:flex;align-items:center;gap:8px;font-size:13.5px;padding:7px 10px;border:1px solid var(--line);border-radius:var(--r-s);cursor:pointer}
.csvcols label:hover{border-color:var(--line-2)}
.csvcols input{accent-color:var(--accent);width:15px;height:15px}
.mailnote{display:flex;gap:10px;align-items:flex-start;background:var(--blue-soft);border-radius:var(--r-s);padding:11px 13px;margin-top:14px}
.mailnote svg{width:18px;height:18px;flex:none;color:var(--blue);margin-top:2px}
.mailnote b{display:block;font-size:13.5px}
.mailnote p{font-size:12.5px;color:var(--muted);margin-top:1px}

.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,14px);background:var(--ink);color:#fff;border-radius:999px;padding:10px 18px;
  font-weight:600;font-size:13px;opacity:0;pointer-events:none;transition:.18s;z-index:120;display:flex;align-items:center;gap:9px;max-width:90vw;
  font-family:var(--sans,"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif)}
.toast.on{opacity:1;transform:translate(-50%,0)}
.toast .d{width:7px;height:7px;border-radius:50%;background:var(--accent);flex:none}

@media(max-width:1100px){.kpis{grid-template-columns:1fr 1fr}}
@media(max-width:680px){.kpis,.fgrid{grid-template-columns:1fr}.top .right{margin-left:0}.tab{padding:10px 10px;font-size:13.5px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const ICONS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <g id="i-check"><path class="ico" d="M20 54l20 20 42-50"/></g>
  <g id="i-film"><rect class="ico" x="12" y="24" width="76" height="54" rx="8"/><path class="ico" d="M12 40h76M30 24v16M70 24v16"/></g>
  <g id="i-coin"><circle class="ico" cx="50" cy="50" r="30"/><path class="ico" d="M38 38h22M38 50h22M44 38c10 0 10 12 0 12l16 16"/></g>
  <g id="i-clock"><circle class="ico" cx="50" cy="52" r="30"/><path class="ico" d="M50 32v20l14 10M36 16l-12 8M64 16l12 8"/></g>
  <g id="i-bell"><path class="ico" d="M30 44a20 20 0 0140 0c0 18 8 22 8 26H22c0-4 8-8 8-26zM42 80a9 9 0 0016 0"/></g>
  <g id="i-mail"><rect class="ico" x="12" y="24" width="76" height="52" rx="8"/><path class="ico" d="M14 30l36 26 36-26"/></g>
  <g id="i-flag"><path class="ico" d="M26 86V16c20-8 34 8 52 0v40c-18 8-32-8-52 0"/></g>
  <g id="i-link"><path class="ico" d="M42 58l16-16M38 34l8-8a16 16 0 0123 23l-8 8M62 66l-8 8a16 16 0 01-23-23l8-8"/></g>
  <g id="i-eye"><path class="ico" d="M8 50s16-24 42-24 42 24 42 24-16 24-42 24S8 50 8 50z"/><circle class="ico" cx="50" cy="50" r="11"/></g>
  <g id="i-wall"><path class="ico" d="M14 30h62a10 10 0 0110 10v34a10 10 0 01-10 10H24a10 10 0 01-10-10V30zM14 30c0-8 6-12 14-12h40"/><circle class="ico" cx="72" cy="56" r="5"/></g>
</defs></svg>`;
function ic(name, style){ return '<svg class="ico'+(style==="bg"?" bg":"")+'" viewBox="0 0 100 100"'+(style&&style!=="bg"?' style="'+style+'"':"")+'><use href="#'+name+'"/></svg>'; }

/* ============================================================ STATE */
let HOST=null, R=null, OPT={}, SPACE=null;
let TAB="all", PAYTAB="base", SEARCH="";
let VIDEOS=[], LOADED=false, LOADING=null, ERR="", LAST_LOAD=0;
let CH=null, RELOAD_T=null, BUSY=false, BELL_OPEN=false;
let EMAILS=[], EMAILS_ERR="";
let PEOPLE=[], PEOPLE_ERR="", CSV_PICK=null;

function esc(s){ return String(s===null||s===undefined?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
/* only ever link out to http(s); a bare "drive.google.com/…" gets https:// */
function safeUrl(u){
  u = String(u||"").trim();
  if(/^https?:\/\/[^\s]+$/i.test(u)) return u;
  if(/^[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(u)) return "https://"+u;
  return null;
}
function ext(u, label){
  const h = safeUrl(u);
  return h ? '<a class="lnk" href="'+esc(h)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>' : (u ? esc(label) : dash());
}
function dash(){ return '<span class="mut">—</span>'; }
function chip(st){ const s=STATUS[st]||STATUS.under_review; return '<span class="chip '+s.chip+'"><span class="d"></span>'+esc(s.label)+'</span>'; }

/* ============================================================ DATES */
function today(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function day(ts){ if(!ts) return null; const d=new Date(ts); d.setHours(0,0,0,0); return d; }
function fmt(dt){ return dt ? dt.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : null; }
function addDays(dt,n){ const x=new Date(dt); x.setDate(x.getDate()+n); return x; }
function daysBetween(a,b){ return Math.round((b-a)/86400000); }
function ymd(dt){ return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0"); }
function windowEnd(v){ return v.published ? addDays(v.published, CFG.bonusWindow) : null; }
function baseDue(v){ return v.published ? addDays(v.published, CFG.basePayDays) : null; }
function dueText(v){
  const left = daysBetween(today(), baseDue(v));
  return { cls: left < 0 ? "late" : (left <= CFG.remindBefore ? "soon" : "ok"),
           txt: left < 0 ? Math.abs(left)+" days overdue" : (left===0 ? "due today" : "in "+left+" days") };
}

/* ============================================================ ACCESS */
function supa(){ return OPT.supa || null; }
function canReview(){ try{ return !!(OPT.canReview && OPT.canReview()); }catch(_){ return false; } }
function canPay(){ try{ return !!(OPT.canPay && OPT.canPay()); }catch(_){ return false; } }
function isStaff(){ return canReview() || canPay(); }
function meId(){ try{ const m = OPT.me && OPT.me(); return (m && m.id) || null; }catch(_){ return null; } }

/* ============================================================ DATA */
function toV(r, pays){
  const c = r.creator || {};
  const base = pays[r.id+":base"] || null, bonus = pays[r.id+":bonus"] || null;
  let st = KEY_OF[r.status] || "under_review";
  if(base && base.status==="paid") st = "base_released";
  if(bonus && bonus.status==="paid") st = "bonus_released";
  const handle = r.platform==="youtube" ? c.youtube_handle : r.platform==="instagram" ? c.instagram_handle : (c.instagram_handle || c.youtube_handle);
  return {
    id:r.id, sn:r.sn, creatorId:r.creator_id, title:r.title||"",
    submitted:day(r.created_at), drive:r.drive_link,
    name:c.full_name||"(no name yet)", email:c.email||"", phone:c.phone||"",
    channel: handle ? (String(handle).charAt(0)==="@" ? handle : "@"+handle) : (r.channel_link || ""),
    channelLink:r.channel_link,
    platform: r.platform==="other" && r.platform_name ? "Other · "+r.platform_name : (PLATFORM[r.platform]||r.platform||""),   /* "Other" shows the name the creator typed */
    upi:c.upi_id||"", link:r.published_link, published:day(r.published_at),
    views:(r.views_30d===null || r.views_30d===undefined) ? null : r.views_30d,
    db:r.status, status:st, reason:r.reviewer_note||"", reply:r.creator_reply||"",
    reviewedAt:day(r.reviewed_at), base:base, bonus:bonus
  };
}
async function load(){
  const sb = supa();
  if(!sb){ ERR = "Not connected to the database."; LOADED = true; return; }
  if(LOADING) return LOADING;
  LOADING = (async ()=>{
    const [s, p] = await Promise.all([
      sb.from("maverick_submissions")
        .select("*, creator:maverick_creators(full_name,email,phone,upi_id,youtube_handle,instagram_handle)")
        .order("sn", { ascending:false }).limit(5000),
      sb.from("maverick_payouts").select("*").limit(10000)
    ]);
    if(s.error || p.error){
      const e = (s.error || p.error).message || "unknown error";
      ERR = /does not exist|schema cache/i.test(e) ? "The Maverick tables aren't in the database yet (supabase/maverick_schema.sql in Dubuddyinternal/maverick)." : "Couldn't load: " + e;
    } else {
      const pays = {};
      (p.data||[]).forEach(x=>{ pays[x.submission_id+":"+x.kind] = x; });
      VIDEOS = (s.data||[]).map(r=> toV(r, pays));
      ERR = "";
    }
    /* the email log is read on its own, so a missing table never hides the videos */
    const em = await sb.from("maverick_emails").select("*").order("created_at", { ascending:false }).limit(300);
    EMAILS = em.error ? [] : (em.data || []);
    EMAILS_ERR = em.error ? (em.error.message || "couldn't load") : "";
    /* everyone who has logged in with a phone, with their profile if they made one (maverick_people(): team only) */
    const pp = await sb.rpc("maverick_people");
    PEOPLE = pp.error ? [] : (pp.data || []);
    PEOPLE_ERR = pp.error ? (pp.error.message || "couldn't load") : "";
    LOADED = true; LAST_LOAD = Date.now();
  })();
  try{ await LOADING; } finally { LOADING = null; }
}
function reloadSoon(){
  clearTimeout(RELOAD_T);
  RELOAD_T = setTimeout(async ()=>{ await load(); if(HOST && HOST.isConnected) draw(); }, 400);
}

/* live: a new video or a new published link shows up without a reload */
function subscribe(){
  const sb = supa();
  if(CH || !sb || typeof sb.channel !== "function" || !isStaff()) return;
  CH = sb.channel("maverick-admin")
    .on("postgres_changes", { event:"*", schema:"public", table:"maverick_submissions" }, payload=>{
      const n = payload.new || {};
      const before = VIDEOS.find(v=> v.id===n.id);
      if(payload.eventType==="INSERT") note("🎬 New Maverick video #"+n.sn+" just came in, it's in the Review queue.");
      else if(payload.eventType==="UPDATE" && n.status==="published" && (!before || before.db!=="published"))
        note("🔗 A creator published video #"+n.sn+" and added the link, it's in Publish to verify.");
      else if(payload.eventType==="UPDATE" && n.status==="in_review" && before && before.db==="needs_info")
        note("💬 A creator replied on video #"+n.sn+".");
      reloadSoon();
    })
    .on("postgres_changes", { event:"*", schema:"public", table:"maverick_payouts" }, ()=> reloadSoon())
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"maverick_emails" }, ()=> reloadSoon())
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"maverick_creators" }, payload=>{
      note("🙋 New Maverick creator: " + ((payload.new && payload.new.full_name) || "someone") + " just signed up.");
      reloadSoon();
    })
    .subscribe();
}
/* a message inside the space if it's open, else the app's own toast */
function note(msg){
  if(HOST && HOST.isConnected && R) toast(msg);
  else if(OPT.toast) OPT.toast(msg);
}

function by(st){ return VIDEOS.filter(v=> v.status===st); }
function vid(id){ return VIDEOS.find(v=> v.id===id); }
function basePayQueue(){ return by("verified"); }
function bonusQueue(){
  return VIDEOS.filter(v=> v.status==="base_released" && v.published && daysBetween(v.published, today()) >= CFG.bonusWindow);
}
function paidSoFar(){
  return VIDEOS.reduce((s,v)=> s + (v.base && v.base.status==="paid" ? Number(v.base.amount) : 0) + (v.bonus && v.bonus.status==="paid" ? Number(v.bonus.amount) : 0), 0);
}
function matches(v){
  if(!SEARCH) return true;
  const q = SEARCH.toLowerCase();
  return [v.name, v.email, v.channel, v.phone, String(v.sn)].some(x=> String(x||"").toLowerCase().indexOf(q) >= 0);
}

/* ============================================================ WRITES */
async function act(fn, okMsg){
  if(BUSY) return false;
  BUSY = true;
  try{
    const err = await fn();
    if(err){ toast("Couldn't save: " + (err.message || err)); return false; }
    if(okMsg) toast(okMsg);
    return true;
  } catch(e){ toast("Couldn't save: " + ((e && e.message) || e)); return false; }
  finally { BUSY = false; await load(); draw(); }
}
async function setSub(v, patch){
  const r = await supa().from("maverick_submissions").update(patch).eq("id", v.id).select("id");
  if(r.error) return r.error;
  if(!r.data || !r.data.length) return { message:"you don't have permission for this (Review Maverick videos)" };
  return null;
}
/* the base pay row the creator sees as "pending" once a video is verified */
async function addPendingBase(v){
  if(!v.published) return null;
  const r = await supa().from("maverick_payouts").upsert({
    submission_id:v.id, creator_id:v.creatorId, kind:"base", amount:CFG.base, status:"pending",
    due_on: ymd(baseDue(v)), upi_id: v.upi || null
  }, { onConflict:"submission_id,kind", ignoreDuplicates:true });
  return r.error || null;
}
/* email the creator about what just happened (maverick-mail Edge Function, from maverick@dubuddy.in).
   The function checks the video really is in that state and logs every email (✉️ Emails tab). */
async function notify(id, event){
  const sb = supa();
  if(!sb || !sb.functions || typeof sb.functions.invoke !== "function") return;
  let msg = "";
  try{
    const r = await sb.functions.invoke("maverick-mail", { body:{ submission_id:id, event:event } });
    const d = r && r.data;
    if(d && d.sent) msg = "✉️ Email sent to " + d.to + ".";
    else if(d && d.reason) msg = "Saved, but no email went: " + d.reason + ".";
    else if(r && r.error){
      let why = r.error.message || "unknown error";
      try{ const j = await r.error.context.json(); if(j && (j.reason || j.error)) why = j.reason || j.error; }catch(_){ }
      msg = "Saved, but no email went: " + why + ".";
    }
  } catch(e){ msg = "Saved, but no email went: " + ((e && e.message) || e) + "."; }
  if(msg) setTimeout(()=> toast(msg), 1600);   /* after the "saved" message has been read */
  reloadSoon();
}
async function release(v, kind){
  const amount = kind==="base" ? CFG.base : bonusFor(v.views);
  const r = await supa().from("maverick_payouts").upsert({
    submission_id:v.id, creator_id:v.creatorId, kind:kind, amount:amount, status:"paid",
    due_on: kind==="base" ? ymd(baseDue(v)) : ymd(windowEnd(v)),
    upi_id: v.upi || null, paid_at: new Date().toISOString(), paid_by: meId()
  }, { onConflict:"submission_id,kind" }).select("id");
  if(r.error) return r.error;
  if(!r.data || !r.data.length) return { message:"only the payout head can release payouts (Release Maverick payouts)" };
  return null;
}

/* ============================================================ RENDER */
function counts(){
  return {
    all: VIDEOS.length,
    review: by("under_review").length,
    verify: by("published").length,
    payouts: basePayQueue().length + bonusQueue().length
  };
}
function bellHtml(c){
  const bp = basePayQueue(), bn = bonusQueue();
  const soon = bp.filter(v=> daysBetween(today(), baseDue(v)) <= CFG.remindBefore);
  const n = c.review + c.verify + bp.length + bn.length;
  let h = '<h5>Team notifications</h5>';
  if(c.review) h += '<div class="nrow hot">'+ic("i-film","color:var(--coral)")+'<div><b>'+c.review+' new video(s) submitted</b><p>Waiting in the Review queue. We promise '+esc(CFG.reviewDays)+'.</p></div></div>';
  if(c.verify) h += '<div class="nrow">'+ic("i-link","color:var(--blue)")+'<div><b>'+c.verify+' creator(s) published and attached the link</b><p>Needs verification before base pay can start.</p></div></div>';
  if(bp.length) h += '<div class="nrow due">'+ic("i-coin","color:var(--amber)")+'<div><b>Base pay due on '+bp.length+' video(s)</b><p>'+money(bp.length*CFG.base)+' to release. Only the payout head can release it.</p></div></div>';
  if(soon.length) h += '<div class="nrow due">'+ic("i-clock","color:var(--no)")+'<div><b>Reminder for the payout head</b><p>'+soon.length+' base payout(s) hit the '+CFG.basePayDays+'-day deadline within '+CFG.remindBefore+' days.</p></div></div>';
  if(bn.length) h += '<div class="nrow due">'+ic("i-eye","color:var(--purple)")+'<div><b>'+bn.length+' bonus window(s) complete</b><p>Enter the views, then release the bonus.</p></div></div>';
  if(n===0) h += '<div class="nrow">'+ic("i-check","color:var(--yes)")+'<div><b>All clear</b><p>Nothing is waiting on the team.</p></div></div>';
  return { html:h, n:n };
}
function panel(title, note, head, body, actions, cls){
  return '<div class="panel '+(cls||'')+'"><div class="phead"><h3>'+title+'</h3><span class="n">'+note+'</span>'+
    '<div class="right">'+(actions||'')+'<input class="srch" data-search="1" placeholder="Search creator, email or S. No." value="'+esc(SEARCH)+'"></div></div>'+
    '<div class="tblwrap"><table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div></div>';
}
function emptyRow(span, big, small, hand){
  return '<tr><td colspan="'+span+'"><div class="empty"><b>'+big+'</b><p>'+small+'</p>'+(hand?'<p class="hand">'+hand+'</p>':'')+'</div></td></tr>';
}
function snBtn(v){ return '<button class="sn" data-rec="'+esc(v.id)+'" title="Open the full record">'+esc(v.sn)+'</button>'; }
function reviewBtns(okAttr, noAttr, v){
  if(!canReview()) return '<button class="btn sm lock" data-locked="review">🔒 Approve</button><button class="btn sm lock" data-locked="review">🔒 Reject</button>';
  return '<button class="btn sm ok" '+okAttr+'="'+esc(v.id)+'">Approve</button><button class="btn sm no" '+noAttr+'="'+esc(v.id)+'">Reject</button>';
}
function payBtn(label, action){
  return canPay()
    ? '<button class="btn sm ok" data-pay="'+esc(action)+'">'+label+'</button>'
    : '<button class="btn sm lock" data-locked="pay">🔒 '+label+'</button>';
}

/* ---------- TAB 1: ALL VIDEOS ---------- */
function viewAll(c){
  const list = VIDEOS.filter(matches);
  const rows = list.length ? list.map(v=>{
    const we = windowEnd(v);
    return '<tr>'+
      '<td>'+snBtn(v)+'</td>'+
      '<td class="tnum">'+fmt(v.submitted)+'</td>'+
      '<td>'+ext(v.drive, "Drive link")+'</td>'+
      '<td><b>'+esc(v.name)+'</b>'+(v.title?'<div class="meta">'+esc(v.title)+'</div>':'')+'</td>'+
      '<td>'+(v.email?esc(v.email):dash())+'</td>'+
      '<td>'+(v.channel?esc(v.channel):dash())+'</td>'+
      '<td>'+esc(v.platform)+'</td>'+
      '<td>'+(v.link ? ext(v.link, "Published link") : dash())+'</td>'+
      '<td class="tnum">'+(v.published ? fmt(v.published) : dash())+'</td>'+
      '<td class="tnum">'+(we ? fmt(we) : dash())+'</td>'+
      '<td>'+chip(v.status)+'</td>'+
    '</tr>';
  }).join('') : emptyRow(11, SEARCH ? 'Nothing matches “'+esc(SEARCH)+'”.' : 'No videos yet.',
      SEARCH ? 'Try a name, an email or a serial number.' : 'Videos land here the moment a creator sends a Drive link from maverick.dubuddy.in.', SEARCH ? '' : 'first one soon');
  return '<div class="kpis">'+
      '<div class="kpi c1"><h6>Submitted in all</h6><b>'+VIDEOS.length+'</b><p>Every video since the programme opened</p>'+ic("i-film","bg")+'</div>'+
      '<div class="kpi c2"><h6>Live on channels</h6><b>'+VIDEOS.filter(v=>v.published).length+'</b><p>Published and running</p>'+ic("i-eye","bg")+'</div>'+
      '<div class="kpi c3"><h6>Paid out so far</h6><b>'+money(paidSoFar())+'</b><p>Base pay plus bonuses</p>'+ic("i-coin","bg")+'</div>'+
      '<div class="kpi c4"><h6>Waiting on us</h6><b>'+(c.review + c.verify + c.payouts)+'</b><p>Reviews, verifications and payouts</p>'+ic("i-clock","bg")+'</div>'+
    '</div>'+
    panel('All videos','every submission, newest first. Click a serial number to open the full record.',
      '<th>S. No.</th><th>Date submitted</th><th>Drive link</th><th>Creator name</th><th>Creator email</th><th>Channel name</th><th>Platform</th><th>Published link</th><th>Published date</th><th>'+CFG.bonusWindow+'-day window ends</th><th>Status</th>',
      rows, '', 'stickylast');
}

/* ---------- TAB 2: REVIEW QUEUE ---------- */
function viewReview(){
  const all = by("under_review").slice().sort((a,b)=> a.submitted-b.submitted);
  const list = all.filter(matches);
  const rows = list.length ? list.map(v=>
    '<tr>'+
      '<td>'+snBtn(v)+'</td>'+
      '<td><b>'+esc(v.name)+'</b>'+(v.reply?'<div class="meta">💬 replied: '+esc(v.reply.length>50?v.reply.slice(0,48)+"…":v.reply)+'</div>':'')+'</td>'+
      '<td>'+(v.email?esc(v.email):dash())+'</td>'+
      '<td>'+ext(v.drive, "Watch the video")+'</td>'+
      '<td>'+(v.channel?esc(v.channel):dash())+'</td>'+
      '<td>'+esc(v.platform)+'</td>'+
      '<td class="tnum">'+fmt(v.submitted)+'</td>'+
      '<td><div class="acts">'+reviewBtns("data-approve","data-reject",v)+'</div></td>'+
    '</tr>').join('') : emptyRow(8, SEARCH && all.length ? 'Nothing matches “'+esc(SEARCH)+'”.' : 'Queue is clear.', 'Nothing is waiting to be reviewed right now.', 'nice work');
  return '<div class="kpis">'+
      '<div class="kpi c1"><h6>Waiting to review</h6><b>'+all.length+'</b><p>Oldest first</p>'+ic("i-film","bg")+'</div>'+
      '<div class="kpi c3"><h6>Approved, awaiting publish</h6><b>'+by("approved").length+'</b><p>Creator sees it in their dashboard</p>'+ic("i-check","bg")+'</div>'+
      '<div class="kpi c4"><h6>Rejected in all</h6><b>'+by("rejected").length+'</b><p>Reason shared with the creator</p>'+ic("i-flag","bg")+'</div>'+
      '<div class="kpi c2"><h6>Our promise</h6><b>'+esc(CFG.reviewDays.replace(" days",""))+'</b><p>Days to a decision, as told to creators</p>'+ic("i-clock","bg")+'</div>'+
    '</div>'+
    panel('Uploaded videos to review', all.length+' waiting',
      '<th>S. No.</th><th>Creator name</th><th>Creator email</th><th>Drive link</th><th>Channel</th><th>Platform</th><th>Date submitted</th><th style="text-align:right">Action</th>',
      rows, '', 'stickylast');
}

/* ---------- TAB 3: PUBLISH TO VERIFY ---------- */
function viewVerify(){
  const all = by("published").slice().sort((a,b)=> a.published-b.published);
  const list = all.filter(matches);
  const rows = list.length ? list.map(v=>{
    const d = dueText(v);
    return '<tr>'+
      '<td>'+snBtn(v)+'</td>'+
      '<td><b>'+esc(v.name)+'</b></td>'+
      '<td>'+(v.email?esc(v.email):dash())+'</td>'+
      '<td>'+ext(v.link, "Published link")+'</td>'+
      '<td>'+(v.channelLink ? ext(v.channelLink, v.channel || "Channel") : (v.channel?esc(v.channel):dash()))+'</td>'+
      '<td>'+esc(v.platform)+'</td>'+
      '<td class="tnum">'+fmt(v.published)+'</td>'+
      '<td>'+ext(v.drive, "Drive link")+'</td>'+
      '<td><span class="due '+d.cls+'">'+d.txt+'</span><div class="meta">'+fmt(baseDue(v))+'</div></td>'+
      '<td><div class="acts">'+reviewBtns("data-verify","data-vreject",v)+'</div></td>'+
    '</tr>';
  }).join('') : emptyRow(10, SEARCH && all.length ? 'Nothing matches “'+esc(SEARCH)+'”.' : 'Nothing to verify.', 'Published links land here as creators attach them in their dashboard.', 'all caught up');
  return '<div class="kpis">'+
      '<div class="kpi c2"><h6>Awaiting verification</h6><b>'+all.length+'</b><p>Creator says it is live</p>'+ic("i-link","bg")+'</div>'+
      '<div class="kpi c1"><h6>Base pay clock</h6><b>'+CFG.basePayDays+' days</b><p>From the publishing date</p>'+ic("i-clock","bg")+'</div>'+
      '<div class="kpi c3"><h6>Verified, base pay due</h6><b>'+basePayQueue().length+'</b><p>Sitting in Payouts</p>'+ic("i-coin","bg")+'</div>'+
      '<div class="kpi c4"><h6>Bonus window</h6><b>'+CFG.bonusWindow+' days</b><p>Then we count the views</p>'+ic("i-eye","bg")+'</div>'+
    '</div>'+
    panel('Published videos to verify', all.length+' submitted by creators',
      '<th>S. No.</th><th>Creator name</th><th>Creator email</th><th>Published link</th><th>Channel link</th><th>Platform</th><th>Published date</th><th>Drive link</th><th>Base pay due</th><th style="text-align:right">Action</th>',
      rows, '', 'stickylast');
}

/* ---------- TAB 4: PAYOUTS ---------- */
function viewPayouts(){
  const bp = basePayQueue(), bn = bonusQueue();
  const bpTotal = bp.length * CFG.base;
  const bnTotal = bn.reduce((s,v)=> s + bonusFor(v.views), 0);
  const head =
    '<div class="kpis">'+
      '<div class="kpi c1"><h6>Base pay to release</h6><b>'+money(bpTotal)+'</b><p>'+bp.length+' video(s) at '+money(CFG.base)+'</p>'+ic("i-coin","bg")+'</div>'+
      '<div class="kpi c2"><h6>Bonus to release</h6><b>'+money(bnTotal)+'</b><p>'+bn.length+' window(s) open, enter the views</p>'+ic("i-eye","bg")+'</div>'+
      '<div class="kpi c3"><h6>Released so far</h6><b>'+money(paidSoFar())+'</b><p>Shows in each creator\'s payment history</p>'+ic("i-check","bg")+'</div>'+
      '<div class="kpi c4"><h6>Release rights</h6><b style="font-size:24px">'+(canPay()?'You have them':'Locked')+'</b><p>'+(canPay()?'You can release payouts':'Only the payout head can release')+'</p>'+ic("i-wall","bg")+'</div>'+
    '</div>'+
    '<div class="subtabs">'+
      '<button class="stab'+(PAYTAB==='base'?' on':'')+'" data-pt="base">Base pay <span class="cnt">'+bp.length+'</span></button>'+
      '<button class="stab'+(PAYTAB==='bonus'?' on':'')+'" data-pt="bonus">Bonuses <span class="cnt">'+bn.length+'</span></button>'+
    '</div>';

  if(PAYTAB === "base"){
    const list = bp.filter(matches).sort((a,b)=> baseDue(a)-baseDue(b));
    const rows = list.length ? list.map(v=>{
      const d = dueText(v);
      return '<tr>'+
        '<td>'+snBtn(v)+'</td>'+
        '<td><b>'+esc(v.name)+'</b></td>'+
        '<td>'+(v.email?esc(v.email):dash())+'</td>'+
        '<td>'+(v.upi ? '<b>'+esc(v.upi)+'</b><div class="meta">saved by the creator</div>' : '<span class="due late">No UPI ID yet</span>')+'</td>'+
        '<td>'+ext(v.link, "Video link")+'</td>'+
        '<td class="tnum">'+fmt(v.published)+'</td>'+
        '<td class="tnum">'+fmt(baseDue(v))+'<div class="meta"><span class="due '+d.cls+'">'+d.txt+'</span></div></td>'+
        '<td><b class="tnum">'+money(CFG.base)+'</b></td>'+
        '<td>'+chip(v.status)+'</td>'+
        '<td><div class="acts">'+payBtn('Release payout','base:'+v.id)+'</div></td>'+
      '</tr>';
    }).join('') : emptyRow(10,'No base pay due.','Videos land here the moment they are approved in Publish to verify.','nothing pending');
    return head + panel('Base pay', money(bpTotal)+' across '+bp.length+' video(s)',
      '<th>S. No.</th><th>Creator name</th><th>Creator email</th><th>UPI ID</th><th>Video link</th><th>Published date</th><th>Due date</th><th>Base amount</th><th>Status</th><th style="text-align:right">Action</th>',
      rows, canPay() && bp.length ? '<button class="btn g sm" data-pay="all:base">Release all</button>' : '', 'stickylast');
  }

  const list2 = bn.filter(matches);
  const rows2 = list2.length ? list2.map(v=>{
    const has = v.views !== null && v.views !== undefined && v.views !== "";
    const cells = bonusCells(v);
    return '<tr>'+
      '<td>'+snBtn(v)+'</td>'+
      '<td><b>'+esc(v.name)+'</b></td>'+
      '<td>'+(v.email?esc(v.email):dash())+'</td>'+
      '<td>'+(v.upi ? '<b>'+esc(v.upi)+'</b>' : '<span class="due late">No UPI ID yet</span>')+'</td>'+
      '<td>'+ext(v.link, "Video link")+'</td>'+
      '<td class="tnum">'+fmt(v.published)+'</td>'+
      '<td class="tnum">'+fmt(windowEnd(v))+'</td>'+
      '<td><input class="viewin" type="number" min="0" step="1" placeholder="enter views" value="'+(has?esc(v.views):'')+'" data-views="'+esc(v.id)+'"'+(isStaff()?'':' disabled')+'><div class="meta">checked by us, organic only</div></td>'+
      '<td data-cell="slab">'+cells.slab+'</td>'+
      '<td data-cell="amt">'+cells.amt+'</td>'+
      '<td>'+chip(v.status)+'</td>'+
      '<td data-cell="act">'+cells.act+'</td>'+
    '</tr>';
  }).join('') : emptyRow(12,'No bonus due.','A video reaches this queue '+CFG.bonusWindow+' days after its publishing date, once base pay is already released.','check back later');

  const slabNote = '<div style="padding:0 24px 22px;display:flex;gap:9px;flex-wrap:wrap;align-items:center">'+
    '<span class="n" style="font-weight:700;font-size:13.5px;color:var(--mut)">Slabs:</span>'+
    CFG.slabs.map(s=> '<span class="chip">'+esc(s.label)+' · '+money(s.bonus)+'</span>').join('')+
    '<span class="chip red"><span class="d"></span>Under '+Number(CFG.viewFloor).toLocaleString('en-IN')+' · no bonus</span></div>';
  return head + panel('Bonuses', money(bnTotal)+' across '+bn.length+' window(s)',
    '<th>S. No.</th><th>Creator name</th><th>Creator email</th><th>UPI ID</th><th>Video link</th><th>Published date</th><th>'+CFG.bonusWindow+'-day window ends</th><th>Views</th><th>Slab</th><th>Bonus amount</th><th>Status</th><th style="text-align:right">Action</th>',
    rows2, '', 'stickylast').replace(/<\/div><\/div>$/, '</div>'+slabNote+'</div>');
}

/* ---------- TAB 5: EMAILS ---------- */
const MAIL_KIND = { approved:"Approved", rejected:"Rejected", needs_info:"Question", sent_back:"Link sent back",
                    verified:"Verified, base pay due", base_paid:"Base pay released", bonus_paid:"Bonus released" };
function viewEmails(){
  const bySub = {}; VIDEOS.forEach(v=>{ bySub[v.id] = v; });
  const q = SEARCH.toLowerCase();
  const list = EMAILS.filter(e=>{
    if(!q) return true;
    const v = bySub[e.submission_id];
    return [e.to_email, e.subject, v && v.name, v && String(v.sn)].some(x=> String(x||"").toLowerCase().indexOf(q) >= 0);
  });
  const sent = EMAILS.filter(e=> e.status==="sent").length, failed = EMAILS.filter(e=> e.status==="failed").length;
  const rows = list.length ? list.map(e=>{
    const v = bySub[e.submission_id];
    const when = new Date(e.created_at);
    const st = e.status==="sent" ? '<span class="chip green"><span class="d"></span>Sent</span>'
      : e.status==="failed" ? '<span class="chip red"><span class="d"></span>Failed</span>' : '<span class="chip"><span class="d"></span>Not sent</span>';
    return '<tr>'+
      '<td class="tnum">'+fmt(when)+'<div class="meta">'+when.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})+'</div></td>'+
      '<td>'+(v ? snBtn(v) : dash())+'</td>'+
      '<td><b>'+(v ? esc(v.name) : dash())+'</b><div class="meta">'+(e.to_email ? esc(e.to_email) : "no email")+'</div></td>'+
      '<td>'+esc(MAIL_KIND[e.kind] || e.kind)+'</td>'+
      '<td style="white-space:normal;min-width:260px">'+esc(e.subject || "")+'</td>'+
      '<td>'+st+(e.error ? '<div class="meta" style="white-space:normal;max-width:260px">'+esc(e.error)+'</div>' : '')+'</td>'+
    '</tr>';
  }).join('') : emptyRow(6, EMAILS_ERR ? 'The email log isn’t set up yet.' : 'No emails yet.',
      EMAILS_ERR ? esc(EMAILS_ERR) : 'Creators get an email from maverick@dubuddy.in each time you approve, reject, verify or release a payout. Every one shows here.', '');
  return '<div class="kpis">'+
      '<div class="kpi c3"><h6>Emails sent</h6><b>'+sent+'</b><p>From maverick@dubuddy.in</p>'+ic("i-mail","bg")+'</div>'+
      '<div class="kpi c1"><h6>Didn’t go</h6><b>'+failed+'</b><p>Shown with the reason below</p>'+ic("i-flag","bg")+'</div>'+
      '<div class="kpi c2"><h6>Replies</h6><b style="font-size:24px">In the mailbox</b><p>Creators reply to maverick@dubuddy.in</p>'+ic("i-link","bg")+'</div>'+
      '<div class="kpi c4"><h6>When</h6><b style="font-size:24px">Every step</b><p>Approve, reject, question, verify, payouts</p>'+ic("i-clock","bg")+'</div>'+
    '</div>'+
    panel('Emails to creators', 'newest first, the last 300',
      '<th>Sent</th><th>S. No.</th><th>Creator</th><th>Email</th><th>Subject</th><th>Status</th>', rows,
      '<a class="btn g sm" href="'+esc(CFG.mailbox)+'" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Open the Maverick mailbox ↗</a>');
}

/* ---------- TAB 6: CREATORS ---------- */
/* everyone who logged in on maverick.dubuddy.in: name, number, email, their videos and pay */
function phoneTxt(p){ p = String(p||"").replace(/\D/g,""); return p ? "+"+p : ""; }
function personStats(id){
  const vs = VIDEOS.filter(v=> v.creatorId===id);
  const paid = vs.reduce((t,v)=> t + (v.base && v.base.status==="paid" ? Number(v.base.amount) : 0) + (v.bonus && v.bonus.status==="paid" ? Number(v.bonus.amount) : 0), 0);
  return { videos: vs, live: vs.filter(v=> v.published).length, paid: paid };
}
function profileDone(p){ return !!(p.has_profile && String(p.full_name||"").trim() && /^\S+@\S+\.\S+$/.test(String(p.email||"").trim())); }
/* opens this space on that creator: tools.dubuddy.in/?team=dubuddy&mx=<id> */
function dashLink(id){ return location.origin + location.pathname + "?team=dubuddy&mx=" + encodeURIComponent(id); }
function people(){
  const q = SEARCH.toLowerCase();
  return PEOPLE.filter(p=> !q || [p.full_name, p.email, phoneTxt(p.phone), p.upi_id].some(x=> String(x||"").toLowerCase().indexOf(q) >= 0));
}
function viewCreators(){
  const list = people();
  const done = PEOPLE.filter(profileDone).length;
  const sent = PEOPLE.filter(p=> personStats(p.id).videos.length).length;
  const rows = list.length ? list.map((p,i)=>{
    const st = personStats(p.id);
    return '<tr>'+
      '<td class="tnum mut">'+(i+1)+'</td>'+
      '<td>'+(p.full_name ? '<b>'+esc(p.full_name)+'</b>' : '<span class="mut">No name yet</span>')+
        (profileDone(p) ? '' : '<div class="meta"><span class="due soon">'+(p.has_profile ? 'Profile incomplete' : 'Logged in, not signed up')+'</span></div>')+'</td>'+
      '<td class="tnum">'+(p.phone ? esc(phoneTxt(p.phone)) : dash())+'</td>'+
      '<td>'+(p.email ? esc(p.email) : dash())+'</td>'+
      '<td class="tnum">'+fmt(day(p.joined_at))+'</td>'+
      '<td class="tnum">'+(p.last_login_at ? fmt(day(p.last_login_at)) : dash())+'</td>'+
      '<td class="tnum">'+st.videos.length+(st.live ? '<div class="meta">'+st.live+' live</div>' : '')+'</td>'+
      '<td class="tnum"><b>'+money(st.paid)+'</b></td>'+
      '<td><div class="acts"><button class="btn g sm" data-person="'+esc(p.id)+'">Open</button></div></td>'+
    '</tr>';
  }).join('') : emptyRow(9, PEOPLE_ERR ? 'The creator list isn’t set up yet.' : (SEARCH ? 'Nothing matches “'+esc(SEARCH)+'”.' : 'No creators yet.'),
      PEOPLE_ERR ? esc(PEOPLE_ERR) : 'Everyone who logs in on maverick.dubuddy.in shows up here.', '');
  return '<div class="kpis">'+
      '<div class="kpi c1"><h6>Creators</h6><b>'+PEOPLE.length+'</b><p>Everyone who logged in</p></div>'+
      '<div class="kpi c3"><h6>Profile complete</h6><b>'+done+'</b><p>Name and email added</p></div>'+
      '<div class="kpi c2"><h6>Sent a video</h6><b>'+sent+'</b><p>At least one submission</p></div>'+
      '<div class="kpi c4"><h6>Paid out</h6><b>'+money(paidSoFar())+'</b><p>Base pay plus bonuses</p></div>'+
    '</div>'+
    panel('Creators', list.length+(SEARCH ? ' of '+PEOPLE.length : '')+' · newest first',
      '<th>#</th><th>Name</th><th>Number</th><th>Email</th><th>Joined</th><th>Last login</th><th>Videos</th><th>Paid</th><th style="text-align:right">Dashboard</th>',
      rows, PEOPLE.length ? '<button class="btn g sm" data-csv="1">⬇ Download CSV</button>' : '', 'stickylast');
}

/* one creator's own dashboard, inside the admin space */
function openCreator(id){
  const p = PEOPLE.find(x=> x.id===id);
  if(!p){ toast("That creator isn't in the list."); return; }
  const st = personStats(id);
  const vids = st.videos.length ? '<div class="tblwrap" style="border:1px solid var(--line);border-radius:var(--r-s);margin-top:6px"><table><thead><tr><th>S. No.</th><th>Title</th><th>Platform</th><th>Submitted</th><th>Status</th></tr></thead><tbody>'+
      st.videos.map(v=> '<tr><td>'+snBtn(v)+'</td><td>'+esc(v.title)+'</td><td>'+esc(v.platform)+'</td><td class="tnum">'+fmt(v.submitted)+'</td><td>'+chip(v.status)+'</td></tr>').join('')+
      '</tbody></table></div>' : '<p class="mut" style="margin-top:4px">No videos yet.</p>';
  openModal(
    '<div class="mhead"><div><h2>'+(p.full_name ? esc(p.full_name) : 'No name yet')+'</h2>'+
      '<div style="margin-top:7px">'+(profileDone(p) ? '<span class="chip green"><span class="d"></span>Profile complete</span>' : '<span class="chip amber"><span class="d"></span>'+(p.has_profile ? 'Profile incomplete' : 'Logged in, not signed up')+'</span>')+'</div></div>'+
      '<button class="x" data-close="1" aria-label="Close">✕</button></div>'+
    '<div class="mbody"><div class="fgrid">'+
      fbox('Number', esc(phoneTxt(p.phone)))+
      fbox('Email', esc(p.email))+
      fbox('UPI ID', esc(p.upi_id))+
      fbox('Joined', fmt(day(p.joined_at)))+
      fbox('YouTube', p.youtube_handle ? esc('@'+String(p.youtube_handle).replace(/^@/,'')) : null)+
      fbox('Instagram', p.instagram_handle ? esc('@'+String(p.instagram_handle).replace(/^@/,'')) : null)+
      fbox('Last login', p.last_login_at ? fmt(day(p.last_login_at)) : null)+
      fbox('Paid so far', money(st.paid))+
    '</div>'+
    '<h3 style="font-size:15px;margin:18px 0 2px">Videos · '+st.videos.length+'</h3>'+vids+
    '</div>'+
    '<div class="mfoot"><button class="btn g" data-copylink="'+esc(p.id)+'">🔗 Copy dashboard link</button><button class="btn g" data-close="1">Close</button>'+
      '<span class="sp">The link opens this view for anyone on the Maverick team.</span></div>'
  );
}

/* CSV: pick the columns, download the creators shown (the search applies) */
const CSV_COLS = [
  ["name","Name", p=> p.full_name||""],
  ["number","Number", p=> phoneTxt(p.phone)],
  ["email","Email", p=> p.email||""],
  ["link","Dashboard link", p=> dashLink(p.id)],
  ["upi","UPI ID", p=> p.upi_id||""],
  ["youtube","YouTube", p=> p.youtube_handle||""],
  ["instagram","Instagram", p=> p.instagram_handle||""],
  ["joined","Joined", p=> p.joined_at ? ymd(new Date(p.joined_at)) : ""],
  ["login","Last login", p=> p.last_login_at ? ymd(new Date(p.last_login_at)) : ""],
  ["profile","Profile", p=> profileDone(p) ? "Complete" : (p.has_profile ? "Incomplete" : "Not signed up")],
  ["videos","Videos", p=> String(personStats(p.id).videos.length)],
  ["live","Live videos", p=> String(personStats(p.id).live)],
  ["paid","Paid (₹)", p=> String(personStats(p.id).paid)]
];
function openCsv(){
  if(!CSV_PICK) CSV_PICK = { name:1, number:1, email:1, link:1 };
  const n = people().length;
  openModal(
    '<div class="mhead"><div><h2>Download creators</h2><p style="color:var(--muted);margin-top:4px;font-size:13px">Tick the columns you want. '+n+' creator(s)'+(SEARCH ? ' matching “'+esc(SEARCH)+'”' : '')+'.</p></div>'+
      '<button class="x" data-close="1" aria-label="Close">✕</button></div>'+
    '<div class="mbody"><div class="csvcols">'+
      CSV_COLS.map(c=> '<label><input type="checkbox" data-col="'+c[0]+'"'+(CSV_PICK[c[0]]?' checked':'')+'> '+esc(c[1])+'</label>').join('')+
    '</div></div>'+
    '<div class="mfoot"><button class="btn" data-csvgo="1">⬇ Download CSV</button><button class="btn g" data-csvall="1">Select all</button><button class="btn g" data-close="1">Cancel</button></div>'
  );
}
function csvCell(v){
  v = String(v==null ? "" : v);
  if(/^[=+\-@\t\r]/.test(v) && !/^\+\d+$/.test(v)) v = "'" + v;   /* never let a spreadsheet run a cell as a formula */
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
}
function downloadCsv(){
  const cols = CSV_COLS.filter(c=> CSV_PICK[c[0]]);
  if(!cols.length){ toast("Tick at least one column."); return; }
  const lines = [cols.map(c=> csvCell(c[1])).join(",")].concat(people().map(p=> cols.map(c=> csvCell(c[2](p))).join(",")));
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "maverick-creators-" + ymd(new Date()) + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
  closeModal(); toast("Downloaded " + (lines.length-1) + " creator(s).");
}

/* the parts of a bonus row that follow the views typed in */
function bonusCells(v){
  const s = slabFor(v.views), amt = bonusFor(v.views);
  const has = v.views !== null && v.views !== undefined && v.views !== "";
  return {
    slab: has ? (s ? '<span class="chip">'+esc(s.label)+'</span>' : '<span class="chip red"><span class="d"></span>Below '+Number(CFG.viewFloor).toLocaleString('en-IN')+'</span>') : dash(),
    amt: '<b class="tnum">'+(has ? money(amt) : dash())+'</b>',
    act: '<div class="acts">'+(has && amt>0 ? payBtn('Release payout','bonus:'+v.id)
          : (has ? '<button class="btn sm lock">No bonus due</button>' : '<button class="btn sm lock">Enter views first</button>'))+'</div>'
  };
}

const VIEWS = { all:viewAll, review:viewReview, verify:viewVerify, payouts:viewPayouts, emails:viewEmails, creators:viewCreators };

function draw(){
  if(!R) return;
  const page = R.getElementById("page");
  const keepFocus = R.activeElement && R.activeElement.matches && R.activeElement.matches("[data-search]") ? R.activeElement.selectionStart : null;
  const c = counts();
  const b = bellHtml(c);
  const tabs = [["all","All videos",c.all],["review","Review queue",c.review],["verify","Publish to verify",c.verify],["payouts","Payouts",c.payouts],["emails","✉️ Emails",EMAILS.length],["creators","👥 Creators",PEOPLE.length]];
  let body;
  if(!isStaff()) body = '<div class="notice"><b>This desk is for the Maverick team.</b><p>To review videos you need “Review Maverick videos”, and to release payouts “Release Maverick payouts”. An owner can tick them for your role in Administration → Roles.</p></div>';
  else if(!LOADED) body = '<div class="notice"><b>Loading…</b><p>Fetching every Maverick video.</p></div>';
  else if(ERR) body = '<div class="notice"><b>Something is off.</b><p>'+esc(ERR)+'</p></div>';
  else body = VIEWS[TAB](c);
  page.innerHTML =
    '<div class="top">'+
      '<nav class="tabs">'+tabs.map(t=> '<button class="tab'+(TAB===t[0]?' on':'')+'" data-tab="'+t[0]+'">'+t[1]+' <span class="cnt">'+t[2]+'</span></button>').join('')+'</nav>'+
      '<div class="right">'+
        '<button class="refresh" data-refresh="1" title="Reload from the database">↻ Refresh</button>'+
        '<button class="bell" data-bell="1" aria-label="What is waiting on us">'+ic("i-bell","width:21px;height:21px")+'<i>'+b.n+'</i></button>'+
        '<div class="sticker"><b>'+(c.review + c.verify + c.payouts)+'</b><span>waiting on us</span></div>'+
        '<div class="bellpanel" id="bellPanel"'+(BELL_OPEN?'':' hidden')+'>'+b.html+'</div>'+
      '</div>'+
    '</div>'+ body;
  if(keepFocus !== null){
    const s = R.querySelector("[data-search]");
    if(s){ s.focus(); try{ s.setSelectionRange(keepFocus, keepFocus); }catch(_){ } }
  }
  if(OPT.onCount) try{ OPT.onCount(c.review + c.verify + c.payouts); }catch(_){ }
}

/* ============================================================ DIALOGS */
function openModal(html){
  const m = R.getElementById("modal");
  m.innerHTML = html; m.classList.add("on"); R.getElementById("scrim").classList.add("on"); m.setAttribute("aria-hidden","false");
}
function closeModal(){
  if(!R) return;
  const m = R.getElementById("modal");
  m.classList.remove("on"); R.getElementById("scrim").classList.remove("on"); m.setAttribute("aria-hidden","true");
}
function fbox(label, value, wide){
  return '<div class="fbox'+(wide?' w':'')+'"><label>'+label+'</label><div class="v">'+(value===null||value===undefined||value===''?'<span class="mut">Not yet</span>':value)+'</div></div>';
}

/* full record, opened from a serial number */
function openRecord(id){
  const v = vid(id); if(!v) return;
  const paidOut = v.status==="base_released" || v.status==="bonus_released";
  const cur = DB_OF[v.status] ? v.status : "verified";
  const opts = Object.keys(DB_OF).map(k=> '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+esc(STATUS[k].label)+'</option>').join('');
  const edit = canReview() && !paidOut;
  openModal(
    '<div class="mhead"><div><h2>Video #'+esc(v.sn)+'</h2><div style="margin-top:9px">'+chip(v.status)+'</div></div><button class="x" data-close="1" aria-label="Close">✕</button></div>'+
    '<div class="mbody"><div class="fgrid">'+
      fbox('Serial number', esc(v.sn))+
      fbox('Date submitted', fmt(v.submitted))+
      fbox('Title', esc(v.title), true)+
      fbox('Drive link', v.drive ? ext(v.drive, v.drive) : null, true)+
      fbox('Creator name', esc(v.name))+
      fbox('Creator email', esc(v.email))+
      fbox('Phone', esc(v.phone))+
      fbox('UPI ID', esc(v.upi))+
      fbox('Channel name', v.channelLink ? ext(v.channelLink, v.channel || v.channelLink) : esc(v.channel))+
      fbox('Platform', esc(v.platform))+
      fbox('Published link', v.link ? ext(v.link, v.link) : null, true)+
      fbox('Published date', fmt(v.published))+
      fbox(CFG.bonusWindow+'-day window ends', fmt(windowEnd(v)))+
      (v.reply ? fbox('Creator replied', esc(v.reply), true) : '')+
      (v.base && v.base.status==="paid" ? fbox('Base pay released', fmt(day(v.base.paid_at))+' · '+money(v.base.amount)+' to '+esc(v.base.upi_id||v.upi)) : '')+
      (v.bonus && v.bonus.status==="paid" ? fbox('Bonus released', fmt(day(v.bonus.paid_at))+' · '+money(v.bonus.amount)+' to '+esc(v.bonus.upi_id||v.upi)) : '')+
      (edit
        ? '<div class="fbox w"><label>Status, change it here</label><select id="stSel">'+opts+'</select>'+
            '<label style="margin-top:12px">Note the creator sees (reason, question or tip)</label><textarea id="stNote" maxlength="1000">'+esc(v.reason)+'</textarea>'+
            '<p style="font-size:13px;color:var(--mut);margin-top:8px">The creator sees this as <b>'+esc(STATUS[v.status].creator)+'</b> in their dashboard. Pick “Needs info” to ask them a question; their reply puts it back in the Review queue.</p></div>'
        : (v.reason ? fbox('Note to the creator', esc(v.reason), true) : '') +
          '<div class="fbox w"><label>Status</label><div class="v">'+esc(STATUS[v.status].label)+'</div>'+
            '<p style="font-size:13px;color:var(--mut);margin-top:8px">'+(paidOut ? 'Money has been released on this video, so its status stays as it is.' : 'You need “Review Maverick videos” to change it.')+'</p></div>')+
    '</div></div>'+
    '<div class="mfoot">'+(edit?'<button class="btn" id="saveSt">Save status</button>':'')+'<button class="btn g" data-close="1">Close</button>'+
      '<span class="sp">The row updates in place, it stays on line '+esc(v.sn)+'</span></div>'
  );
  if(!edit) return;
  R.getElementById("saveSt").onclick = async function(){
    const key = R.getElementById("stSel").value, txt = R.getElementById("stNote").value.trim();
    if((key==="rejected" || key==="needs_info") && !txt){ toast(key==="rejected" ? "A rejection needs a reason the creator can act on." : "Write the question for the creator."); return; }
    if((key==="published" || key==="verified") && !v.link){ toast("This video has no published link yet. The creator adds it once it is approved."); return; }
    this.disabled = true;
    const patch = { status: DB_OF[key], reviewer_note: txt || null };
    if(key==="approved" && v.db==="published" || key==="approved" && v.db==="verified"){ patch.published_link = null; patch.channel_link = null; patch.published_at = null; }
    if(key==="in_review" || key==="approved") patch.creator_reply = null;
    const ok = await act(async ()=>{
      const e = await setSub(v, patch); if(e) return e;
      if(key==="verified") return await addPendingBase(v);
      return null;
    }, "Video #"+v.sn+" moved to "+STATUS[key].label+".");
    if(ok){
      closeModal();
      const ev = key==="rejected" ? "rejected" : key==="needs_info" ? "needs_info" : key==="verified" ? "verified"
        : key==="approved" ? ((v.db==="published" || v.db==="verified") && txt ? "sent_back" : "approved") : null;
      if(ev && DB_OF[key] !== v.db) notify(v.id, ev);
    } else this.disabled = false;
  };
}

/* rejection dialog, used by both review and verification */
function openReject(id, kind){
  const v = vid(id); if(!v) return;
  const presets = kind==="verify" ? CFG.verifyReasons : CFG.rejectReasons;
  openModal(
    '<div class="mhead"><div><h2>'+(kind==="verify"?"Send it back":"Reject this video")+'</h2>'+
      '<p style="color:var(--mut);margin-top:6px;font-weight:600">#'+esc(v.sn)+' · '+esc(v.name)+(v.email?' · '+esc(v.email):'')+'</p></div><button class="x" data-close="1" aria-label="Close">✕</button></div>'+
    '<div class="mbody">'+
      '<p style="font-weight:700;margin-bottom:12px">Pick a reason or write your own. The creator sees exactly this.</p>'+
      '<div class="pre">'+presets.map(r=> '<button data-reason="'+esc(r)+'">'+esc(r)+'</button>').join('')+'</div>'+
      '<textarea class="rsn" id="rsnText" maxlength="1000" placeholder="Write the reason in plain words"></textarea>'+
      '<div class="mailnote">'+ic("i-mail")+
        '<div><b>'+(kind==="verify" ? 'It goes back to “Approved, ready to publish”' : 'It shows on their dashboard')+'</b><p>'+(kind==="verify"
          ? 'The published link is cleared and the reason shows on the info button beside the status. They can fix it, publish again and attach the new link.'
          : 'The reason is saved on the video and shown on the info button beside the status in their dashboard. They can make the change and submit it again as a fresh submission.')+'</p></div></div>'+
    '</div>'+
    '<div class="mfoot"><button class="btn no" id="doReject" style="background:var(--no);color:#fff">'+(kind==="verify"?"Send it back":"Reject")+'</button>'+
      '<button class="btn g" data-close="1">Cancel</button></div>'
  );
  R.getElementById("modal").querySelector(".pre").addEventListener("click", e=>{
    const b = e.target.closest("[data-reason]"); if(!b) return;
    R.getElementById("rsnText").value = b.dataset.reason;
  });
  R.getElementById("doReject").onclick = async function(){
    const txt = R.getElementById("rsnText").value.trim();
    if(!txt){ toast("A rejection needs a reason the creator can act on."); return; }
    this.disabled = true;
    const patch = kind==="verify"
      ? { status:"approved", reviewer_note:txt, published_link:null, channel_link:null, published_at:null }
      : { status:"rejected", reviewer_note:txt };
    const ok = await act(()=> setSub(v, patch),
      kind==="verify" ? "Sent back to "+v.name+". They can publish again and reattach the link." : "Rejected. "+v.name+" sees the reason in their dashboard.");
    if(ok){ closeModal(); notify(v.id, kind==="verify" ? "sent_back" : "rejected"); } else this.disabled = false;
  };
}

/* ============================================================ EVENTS */
function wire(){
  R.addEventListener("click", async e=>{
    const t = e.target;
    if(t.closest("[data-close]") || t.id==="scrim"){ closeModal(); return; }
    const bp = R.getElementById("bellPanel");
    if(t.closest("[data-bell]")){ BELL_OPEN = !BELL_OPEN; if(bp) bp.hidden = !BELL_OPEN; return; }
    if(BELL_OPEN && !t.closest("#bellPanel")){ BELL_OPEN = false; if(bp) bp.hidden = true; }

    const tb = t.closest("[data-tab]");
    if(tb){ TAB = tb.dataset.tab; if(OPT.setTab) OPT.setTab(TAB); draw(); return; }
    const st = t.closest("[data-pt]");
    if(st){ PAYTAB = st.dataset.pt; draw(); return; }
    if(t.closest("[data-refresh]")){ LOADED = false; draw(); await load(); draw(); toast("Up to date."); return; }

    const pr = t.closest("[data-person]");
    if(pr){ openCreator(pr.dataset.person); return; }
    if(t.closest("[data-csv]")){ openCsv(); return; }
    if(t.closest("[data-csvgo]")){ downloadCsv(); return; }
    if(t.closest("[data-csvall]")){ CSV_COLS.forEach(c=> CSV_PICK[c[0]] = 1); R.querySelectorAll("[data-col]").forEach(x=> x.checked = true); return; }
    const cl = t.closest("[data-copylink]");
    if(cl){
      const link = dashLink(cl.dataset.copylink);
      try{ await navigator.clipboard.writeText(link); toast("Dashboard link copied."); }catch(_){ toast(link); }
      return;
    }
    const rec = t.closest("[data-rec]");
    if(rec){ openRecord(rec.dataset.rec); return; }

    const ap = t.closest("[data-approve]");
    if(ap){
      const v = vid(ap.dataset.approve); if(!v) return;
      act(()=> setSub(v, { status:"approved", reviewer_note:null, creator_reply:null }),
        "Approved. "+v.name+" now sees it as approved: publish it and attach the published link in their dashboard.")
        .then(ok=>{ if(ok) notify(v.id, "approved"); });
      return;
    }
    const rj = t.closest("[data-reject]");
    if(rj){ openReject(rj.dataset.reject, "review"); return; }

    const vf = t.closest("[data-verify]");
    if(vf){
      const v = vid(vf.dataset.verify); if(!v) return;
      const left = daysBetween(today(), baseDue(v));
      act(async ()=>{ const e1 = await setSub(v, { status:"verified", reviewer_note:null }); if(e1) return e1; return await addPendingBase(v); },
        "Verified. It has moved to Payouts, base pay "+(left<=0?"due now":"due in "+left+" days")+".")
        .then(ok=>{ if(ok) notify(v.id, "verified"); });
      return;
    }
    const vr = t.closest("[data-vreject]");
    if(vr){ openReject(vr.dataset.vreject, "verify"); return; }

    const lk = t.closest("[data-locked]");
    if(lk){
      toast(lk.dataset.locked==="pay"
        ? "Only the payout head can release a payout (Release Maverick payouts)."
        : "You need “Review Maverick videos” to do this. An owner can tick it for your role.");
      return;
    }

    const p = t.closest("[data-pay]");
    if(p){
      if(!canPay()){ toast("Only the payout head can release a payout."); return; }
      const parts = p.dataset.pay.split(":"), kind = parts[0], id = parts.slice(1).join(":");
      if(kind==="all"){
        const set = basePayQueue();
        if(!set.length){ toast("Nothing due right now."); return; }
        if(!confirm("Release "+money(set.length*CFG.base)+" base pay to "+set.length+" creator(s)? Do this once the UPI transfers are done.")) return;
        act(async ()=>{ for(const v of set){ const e1 = await release(v, "base"); if(e1) return e1; } return null; },
          money(set.length*CFG.base)+" released to "+set.length+" creator(s). It shows in each payment history with the date, UPI ID and amount.")
          .then(async ok=>{ if(ok) for(const v of set) await notify(v.id, "base_paid"); });
        return;
      }
      const v = vid(id); if(!v) return;
      const amt = kind==="base" ? CFG.base : bonusFor(v.views);
      if(!confirm("Release "+money(amt)+(kind==="base"?" base pay":" bonus")+" to "+v.name+(v.upi?" ("+v.upi+")":"")+"? Do this once the UPI transfer is done.")) return;
      act(()=> release(v, kind), money(amt)+(kind==="base"?" base pay":" bonus")+" released to "+v.name+(v.upi?" on "+v.upi:"")+". Their payment history now shows it.")
        .then(ok=>{ if(ok) notify(v.id, kind==="base" ? "base_paid" : "bonus_paid"); });
    }
  });

  R.addEventListener("change", e=>{
    const c = e.target.closest("[data-col]");
    if(c && CSV_PICK) CSV_PICK[c.dataset.col] = c.checked ? 1 : 0;
  });
  R.addEventListener("input", e=>{
    const s = e.target.closest("[data-search]");
    if(s){ SEARCH = s.value.trim(); draw(); return; }
    const i = e.target.closest("[data-views]");
    if(i){
      /* only this row's slab, amount and button follow the typing; the box itself is left alone */
      const v = vid(i.dataset.views); if(!v) return;
      v.views = i.value === "" ? null : Math.max(0, Math.floor(Number(i.value)));
      const tr = i.closest("tr"), cells = bonusCells(v);
      ["slab","amt","act"].forEach(k=>{ const td = tr.querySelector('[data-cell="'+k+'"]'); if(td) td.innerHTML = cells[k]; });
    }
  });
  /* views are saved when the box is left (or Enter) */
  R.addEventListener("change", async e=>{
    const i = e.target.closest("[data-views]"); if(!i) return;
    const v = vid(i.dataset.views); if(!v) return;
    const r = await supa().from("maverick_submissions").update({ views_30d: v.views }).eq("id", v.id).select("id");
    if(r.error || !r.data || !r.data.length) toast("Couldn't save the views: " + ((r.error && r.error.message) || "no permission"));
    else draw();   /* totals at the top follow */
  });
  R.addEventListener("keydown", e=>{
    if(e.key==="Escape") closeModal();
  });
}

function toast(msg){
  if(!R) return;
  const el = R.getElementById("toast");
  R.getElementById("toastTxt").textContent = msg; el.classList.add("on");
  clearTimeout(el._t); el._t = setTimeout(()=> el.classList.remove("on"), 4200);
}

function mount(){
  if(HOST) return;
  HOST = document.createElement("div");
  R = HOST.attachShadow({mode:"open"});
  /* data-plain: reasons and notes reach creators as plain text, so richtext.js leaves these boxes alone */
  R.innerHTML = '<style>'+CSS+'</style>'+ICONS+
    '<div class="mxroot"><div id="page"></div></div>'+
    '<div class="scrim" id="scrim"></div><div class="modal" id="modal" role="dialog" aria-modal="true" aria-hidden="true" data-plain></div>'+
    '<div class="toast" id="toast" role="status"><span class="d"></span><span id="toastTxt"></span></div>';
  wire();
}

/* ============================================================ API */
window.MX = {
  tabs: [["all","All videos"],["review","Review queue"],["verify","Publish to verify"],["payouts","Payouts"],["emails","✉️ Emails"],["creators","👥 Creators"]],
  normalize: function(space){ /* nothing is stored on the space itself: all data lives in the maverick_* tables */ return space; },
  /* opt: { supa, tab, canReview(), canPay(), me() → {id,name}, setTab(t), toast(msg) } */
  render: function(space, wrap, opt){
    mount();
    OPT = opt || {};
    if(SPACE !== space){ SPACE = space; SEARCH = ""; closeModal(); }
    TAB = ["all","review","verify","payouts","emails","creators"].includes(OPT.tab) ? OPT.tab : "all";
    if(HOST.parentNode !== wrap) wrap.appendChild(HOST);
    subscribe();
    draw();
    if(!LOADED || Date.now() - LAST_LOAD > 60000) load().then(draw);
  },
  /* once after sign-in: listen for new videos and links, and say what's waiting */
  boot: async function(opt){
    OPT = Object.assign({}, OPT, opt || {});
    if(!isStaff() || !supa()) return;
    subscribe();
    await load();
    /* a creator's dashboard link (?mx=<id>): open this space on them */
    const want = new URLSearchParams(location.search).get("mx");
    if(want){
      try{ const u = new URL(location.href); u.searchParams.delete("mx"); history.replaceState(history.state, "", u.toString()); }catch(_){ }
      if(OPT.openSpace && OPT.openSpace("creators")) setTimeout(()=> openCreator(want), 300);
      return;
    }
    if(ERR) return;
    const c = counts(), n = c.review + c.verify;
    if(n && OPT.toast) OPT.toast("🎬 Maverick: " + (c.review ? c.review + " video(s) to review" : "") + (c.review && c.verify ? " and " : "") + (c.verify ? c.verify + " published link(s) to verify" : ""));
  }
};
})();
