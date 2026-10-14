/* =====================================================================
   CAMPAIGN SPACE — Fill in Details · Assignment · Calendar · Dashboard
   (Cyberflow team app, tools.dubuddy.in)

   WHAT THIS IS: one sale, one place — the team's "Campaign Creator" design
   (claude.ai artifact "Campaign Creator"), same layout, fonts and colours.
   A campaign lives inside a Marketing space (index.html, type "marketing";
   campaigns are type "campaign" with parent = that space).
     * Fill in Details — a hero (icon, name, tagline, offer code, live
       countdown), the details form built from tap-to-pick fields (campaign
       type, offer type, duration, plus channels / audience / goal / budget /
       messaging / your own, dragged in from the field library), a target box
       per department, and every content piece that goes out.
     * Assignment & distribution of work — give each item an accountable
       teammate (they get an email + a 🔔), then press its action:
       reels / videos / stories / influencer videos land on the Social Media
       space's Content Process board as high priority; banners and alerts open
       Strapi, WhatsApp opens MSG91, notifications open Firebase.
     * Calendar — month grid (drag a card to another day), list, flowchart,
       with filters.
     * Dashboard — counts read straight off the campaign.
   Only admins edit (index.html decides through opt.canEdit); everyone else
   sees Fill in Details read-only.
   index.html calls CX.render(space, host, opt) when a campaign is open; it is
   drawn inside a shadow root so its styles and the app's never touch.
   Data is saved with the team (team_data "cspaces") through opt.save
   (redraws the page) / opt.saveQuiet (no redraw, used while typing).
   ===================================================================== */
(function(){
"use strict";

const CSS = `:host{display:block;color-scheme:light;
  --bg:#FCFBF8; --surface:#FFFFFF; --surface-2:#F6F4EF; --surface-3:#EEF1F7; --surface-4:#FAF8F3;
  --ink:#1A1815; --ink-2:#56514A; --ink-3:#8C867C;
  --line:#E6E1D8; --line-2:#D2CCC0;
  --accent:#D4541E; --accent-ink:#A83E12; --accent-soft:#FBEBE2;
  --saffron:#F0A32B; --marigold:#E07B16; --saffron-soft:#FDF1DB;
  --good:#17784F; --good-soft:#E4F2EA; --warn:#8F5E00; --warn-soft:#FBF0DA; --crit:#AE2318; --crit-soft:#FBE8E5;
  --c1:#C8511B; --c2:#0094A6; --c3:#6246D4; --c4:#9A7C00;
  --note:#FBF0C4; --note-line:#E8D98A; --note-ink:#4A3A10; --note-lbl:#8A6E1E;
  --sans:"Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --hand:"Caveat","Bradley Hand",cursive;
  --r:10px; --r-s:7px;
}
*{box-sizing:border-box}
.cxroot{color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;text-align:left}
h1,h2,h3,h4,h5{margin:0;text-wrap:balance;font-weight:700;letter-spacing:-.018em}
button{font:inherit;color:inherit;cursor:pointer;background:none;border:none}
input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.lbl{font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);font-weight:500}
.num{font-variant-numeric:tabular-nums}

.topbar{display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--surface-4);flex-wrap:wrap;position:sticky;top:env(safe-area-inset-top,0px);z-index:40}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:19px;letter-spacing:-.03em}
.brand .mark{width:26px;height:26px;border-radius:8px;background:var(--accent);display:grid;place-items:center;color:#fff;font-size:13px;font-weight:800}
.brand .b2{color:var(--accent)}
.navpills{display:flex;gap:7px;margin-left:auto;flex-wrap:wrap;align-items:center}
.pill{border:1px solid var(--line-2);border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:600;color:var(--ink-2);background:var(--surface);white-space:nowrap}
.pill.on{background:var(--accent);border-color:var(--accent);color:#fff}
.pill.ghost{border-color:var(--accent);color:var(--accent)}
.themesw{display:flex;border:1px solid var(--line-2);border-radius:999px;overflow:hidden;background:var(--surface)}
.themesw button{padding:5px 11px;font-size:11.5px;font-family:var(--mono);color:var(--ink-3);display:flex;align-items:center;gap:4px}
.themesw button.on{background:var(--ink);color:var(--bg)}

.shell{display:grid;grid-template-columns:236px minmax(0,1fr);min-height:60vh}
.rail{border-right:1px solid var(--line);padding:18px 14px;background:var(--surface-4);display:flex;flex-direction:column;gap:7px}
.rail .lbl{margin:10px 0 2px}
.dashed{border:1px dashed var(--line-2);border-radius:var(--r);padding:9px;text-align:center;color:var(--ink-3);font-size:12.5px;font-family:var(--mono)}
.space{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:var(--r);padding:9px 11px;font-size:13px;font-weight:600;background:var(--surface);width:100%;text-align:left}
.space.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.space .dot{width:7px;height:7px;border-radius:50%;background:var(--good);flex-shrink:0}
.space .dots{margin-left:auto;color:var(--ink-3);font-size:14px;letter-spacing:1px}
.space.parent{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);color:var(--accent-ink)}
.space .chev{font-size:9px;color:var(--ink-3);width:9px;flex-shrink:0;transition:transform .14s}
.space.parent:not(.open) .chev{transform:rotate(-90deg)}
.kids{display:flex;flex-direction:column;gap:4px;padding-left:9px;margin:4px 0 2px;
  border-left:1.5px solid var(--line);margin-left:11px}
.kids[hidden]{display:none}
.subspace{padding:6px 10px;font-size:12.5px;color:var(--ink-2);border-radius:var(--r-s);text-align:left;width:100%;font-weight:500}
.subspace:hover{background:var(--surface-2)}
.subspace.on{background:var(--accent-soft);color:var(--accent-ink);font-weight:600}
.sections{display:flex;flex-direction:column;gap:2px;padding-left:10px;margin:2px 0 4px;
  border-left:1.5px solid var(--line);margin-left:10px}
.section{padding:5px 10px;font-size:12px;color:var(--ink-3);border-radius:var(--r-s);text-align:left;width:100%}
.section:hover{background:var(--surface-2);color:var(--ink-2)}
.section.on{background:var(--accent-soft);color:var(--accent-ink);font-weight:600}
.addsub{padding:7px;font-size:11.5px;margin-top:2px}
.addsub:hover{border-color:var(--accent);color:var(--accent)}

/* --- space templates modal --- */
.mscrim{position:fixed;inset:0;background:rgba(10,8,5,.44);z-index:80;opacity:0;pointer-events:none;transition:opacity .16s;
  display:grid;place-items:center;padding:24px}
.mscrim.on{opacity:1;pointer-events:auto}
.modal{background:var(--surface);border:1px solid var(--line);border-radius:14px;width:min(660px,100%);
  max-height:min(86vh,760px);display:flex;flex-direction:column;overflow:hidden;
  box-shadow:0 18px 50px rgba(10,8,5,.22);transform:translateY(10px);transition:transform .18s}
.mscrim.on .modal{transform:none}
.mhead{padding:22px 24px 4px}
.mhead h3{font-size:19px;letter-spacing:-.024em;margin-bottom:9px}
.mhead p{margin:0;font-size:13px;color:var(--ink-2);line-height:1.55;max-width:56ch}
.mbody{overflow-y:auto;padding:18px 24px 8px;display:grid;grid-template-columns:1fr 1fr;gap:13px;align-content:start}
.tpl{border:1px solid var(--line);border-radius:var(--r);padding:16px 17px;background:var(--surface);text-align:left;
  display:flex;flex-direction:column;gap:8px;min-width:0}
.tpl:hover{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);background:var(--surface-4)}
.tpl .emo{font-size:23px;line-height:1}
.tpl h4{font-size:15px;letter-spacing:-.018em}
.tpl p{margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.5}
.tpl .meta{font-family:var(--mono);font-size:11px;color:var(--accent);margin-top:auto;padding-top:3px}
.tpl.new{border-style:dashed}
.tpl.new h4,.tpl.new .meta{color:var(--ink-3)}
.mfoot{padding:14px 24px calc(18px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);
  display:flex;justify-content:flex-end;gap:9px;background:var(--surface-4)}
.modal.sm{width:min(460px,100%)}
.mbody.form{display:block;padding:18px 24px 20px}

/* --- campaign: fill in details --- */
.roleswitch{display:flex;align-items:center;gap:9px;margin-bottom:18px;flex-wrap:wrap}
.lockbar{display:flex;gap:10px;align-items:flex-start;background:var(--surface-3);border:1px solid var(--line-2);
  border-radius:var(--r);padding:11px 14px;margin-bottom:20px}
.lockbar p{margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.55}
.lockbar b{color:var(--ink)}
.detgrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start;margin-bottom:26px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:17px 18px}
.panel-h{display:flex;align-items:center;gap:9px;margin-bottom:14px;flex-wrap:wrap}
.panel-h h3{font-size:15px}
.fbox{border:1px solid var(--line);border-radius:var(--r-s);padding:11px 13px;background:var(--surface-4);margin-bottom:10px}
.fbox:last-of-type{margin-bottom:0}
.fbox label{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-3);margin-bottom:5px;font-weight:500}
.fbox input,.fbox textarea{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:5px;
  padding:7px 9px;font-size:13px}
.fbox textarea{resize:vertical;min-height:54px;font-family:inherit}
.fbox input:disabled,.fbox textarea:disabled{background:var(--surface-2);color:var(--ink-2);cursor:default}
.fbox.custom{border-style:dashed;border-color:var(--line-2)}
.fbox .rm{float:right;font-family:var(--mono);font-size:11px;color:var(--ink-3);padding:0 3px}
.fbox .rm:hover{color:var(--crit)}
.addfield{width:100%;border:1px dashed var(--line-2);border-radius:var(--r-s);padding:10px;
  font-size:12.5px;font-weight:600;color:var(--ink-3);margin-top:10px}
.addfield:hover{border-color:var(--accent);color:var(--accent)}
.plus{width:23px;height:23px;border-radius:50%;border:1px solid var(--line-2);display:grid;place-items:center;
  font-size:15px;color:var(--ink-3);line-height:1;margin-left:auto;flex-shrink:0}
.plus:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.renameable{border:none;background:transparent;font:inherit;font-size:15px;font-weight:700;letter-spacing:-.018em;
  color:var(--ink);padding:2px 5px;border-radius:5px;min-width:60px}
.renameable:hover,.renameable:focus{background:var(--surface-2);outline:none}

/* --- contents list --- */
.citem{display:flex;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r-s);
  background:var(--surface);margin-bottom:8px;align-items:flex-start}
.citem .ic{width:30px;height:30px;border-radius:7px;display:grid;place-items:center;font-size:15px;flex-shrink:0;
  background:var(--surface-2)}
.citem-b{flex:1;min-width:0}
.citem-b h5{font-size:13.5px;font-weight:600;margin-bottom:4px}
.citem-m{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.citem p{margin:6px 0 0;font-size:12px;color:var(--ink-2);line-height:1.5}
.dchip{font-family:var(--mono);font-size:10.5px;background:var(--accent-soft);color:var(--accent-ink);
  padding:2.5px 8px;border-radius:5px;font-weight:600;white-space:nowrap}
.empty{border:1px dashed var(--line-2);border-radius:var(--r);padding:28px 20px;text-align:center;color:var(--ink-3)}
.empty h4{font-size:14px;color:var(--ink-2);margin-bottom:5px}
.empty p{margin:0 0 14px;font-size:12.5px;max-width:46ch;margin-inline:auto;line-height:1.55}

.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:11px;align-items:start}
.fbox.wide{grid-column:1/-1}
.fbox{margin-bottom:0}
.fbox select{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:5px;padding:7px 9px;font-size:13px}
.addfield{margin-top:0;align-self:stretch;min-height:74px}

/* --- assignment --- */
.bar2{display:flex;gap:11px;align-items:flex-start;background:var(--surface-3);border:1px solid var(--line-2);
  border-radius:var(--r);padding:12px 14px;margin-bottom:18px}
.bar2 .ic2{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--ink-2);border:1.5px solid var(--line-2);
  border-radius:5px;padding:2px 7px;flex-shrink:0;margin-top:1px;white-space:nowrap}
.bar2 p{margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.55}
.bar2 b{color:var(--ink)}
.subnav{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:16px;overflow-x:auto;padding-bottom:0}
.snav{padding:8px 13px;font-size:13px;font-weight:600;color:var(--ink-3);border-bottom:2px solid transparent;
  margin-bottom:-1px;white-space:nowrap;display:flex;align-items:center;gap:6px}
.snav:hover{color:var(--ink-2)}
.snav.on{color:var(--accent);border-bottom-color:var(--accent)}
.snav .cnt{font-family:var(--mono);font-size:10.5px;background:var(--surface-2);color:var(--ink-3);
  border-radius:999px;padding:1px 6px}
.snav.on .cnt{background:var(--accent-soft);color:var(--accent-ink)}
.kcard.hot{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.hotbar{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;background:var(--accent-soft);color:var(--accent-ink);
  border-radius:4px;padding:3px 7px;margin-bottom:8px;font-weight:600;display:block;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* --- dashboard --- */
.dashgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;align-items:start}
.panel.wide{grid-column:1/-1}
.hb{display:flex;flex-direction:column;gap:9px}
.hbrow{display:grid;grid-template-columns:minmax(96px,1.1fr) minmax(0,2fr) 68px;gap:11px;align-items:center}
.hbl{font-size:12.5px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;gap:6px;align-items:center}
.hbe{font-style:normal;font-size:13px}
.hbt{height:9px;background:var(--surface-2);border-radius:999px;overflow:hidden;display:block;border:1px solid var(--line)}
.hbt i{display:block;height:100%;border-radius:999px}
.hbv{font-family:var(--mono);font-size:12.5px;font-variant-numeric:tabular-nums;text-align:right;color:var(--ink)}
.hbv small{display:block;font-size:10px;color:var(--ink-3)}
.splitrows{margin-top:13px;padding-top:12px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.srow{display:flex;align-items:baseline;gap:9px;font-size:12.5px;color:var(--ink-2)}
.srow b{margin-left:auto;font-family:var(--mono);font-size:13px;color:var(--ink);font-variant-numeric:tabular-nums}
.srow small{font-family:var(--mono);font-size:10.5px;color:var(--ink-3);min-width:96px;text-align:right}

/* --- calendar --- */
.calbar{display:flex;gap:11px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
.filterbar{display:flex;gap:11px;align-items:flex-end;flex-wrap:wrap;background:var(--surface-4);
  border:1px solid var(--line);border-radius:var(--r);padding:12px 14px;margin-bottom:16px}
.fsel{display:flex;flex-direction:column;gap:5px;min-width:0}
.fsel span{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:500}
.fsel select,.fsel input{background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r-s);
  padding:7px 9px;font-size:12.5px;min-width:144px}
.calhead{display:flex;align-items:baseline;gap:11px;margin-bottom:11px;flex-wrap:wrap}
.calhead h3{font-size:16px}
.cgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;min-width:700px}
.cdow{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);text-align:center;padding:5px 0}
.cday{border:1px solid var(--line);border-radius:var(--r-s);min-height:104px;padding:7px;background:var(--surface);
  display:flex;flex-direction:column;gap:4px}
.cday.pad{background:transparent;border-color:transparent}
.cday.has{background:var(--surface-4)}
.cday.today{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.cday .dn{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.cevt{border:1px solid var(--line);border-left:3px solid var(--line-2);border-radius:5px;padding:5px 7px;
  text-align:left;width:100%;display:block;background:var(--surface)}
.cevt:hover{border-color:var(--ink-3)}
.cevt b{display:block;font-size:11px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cevt span{font-size:10px;color:var(--ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
.undated{border:1px dashed var(--line-2);border-radius:var(--r);padding:13px 15px;margin-top:14px;
  display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.undated .cevt{width:auto;min-width:170px}

/* --- flowchart --- */
.flowwrap{overflow-x:auto;padding-bottom:10px}
.flow{display:flex;align-items:stretch;gap:0;min-width:min-content}
.fstage{display:flex;flex-direction:column;gap:9px;min-width:188px;flex-shrink:0}
.fdate{background:var(--ink);color:var(--bg);border-radius:var(--r-s);padding:7px 11px;text-align:center}
.fdate b{display:block;font-size:12.5px;letter-spacing:-.01em}
.fdate span{font-family:var(--mono);font-size:9.5px;opacity:.72;letter-spacing:.06em;text-transform:uppercase}
.fitems{display:flex;flex-direction:column;gap:8px}
.fcard{border:1.5px solid var(--line-2);border-radius:var(--r-s);padding:10px 11px;text-align:left;
  display:flex;flex-direction:column;gap:4px;background:var(--surface)}
.fcard:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(10,8,5,.09)}
.femo{font-size:16px;line-height:1}
.fcard b{font-size:12.5px;font-weight:600;line-height:1.35}
.fmeta{font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.fwho{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--ink-2);margin-top:2px}
.farrow{display:flex;align-items:center;padding:0 11px;color:var(--ink-3);font-size:17px;flex-shrink:0}

/* --- campaign hero --- */
.hero{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:15px;margin-bottom:22px;
  padding:20px 22px;background:
    radial-gradient(circle at 92% -30%, color-mix(in srgb,var(--saffron) 42%,transparent), transparent 56%),
    radial-gradient(circle at 6% 125%, color-mix(in srgb,var(--marigold) 34%,transparent), transparent 52%),
    linear-gradient(135deg, color-mix(in srgb,var(--accent) 11%,var(--surface)), color-mix(in srgb,var(--saffron) 13%,var(--surface)))}
.hero::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;
  background:repeating-linear-gradient(90deg,var(--accent) 0 15px,var(--saffron) 15px 30px,var(--c4) 30px 45px)}
.hero-in{position:relative;display:flex;gap:15px;align-items:flex-start;flex-wrap:wrap}
.hero-emo{font-size:30px;line-height:1;width:54px;height:54px;border-radius:14px;flex-shrink:0;
  background:var(--surface);border:1px solid var(--line-2);display:grid;place-items:center;
  box-shadow:0 2px 10px rgba(10,8,5,.08)}
.hero-emo:hover{border-color:var(--accent);transform:rotate(-5deg) scale(1.05)}
.hero-txt{flex:1;min-width:230px}
.hero-name{display:block;width:100%;border:none;background:transparent;font-family:var(--sans);font-weight:800;
  font-size:28px;letter-spacing:-.034em;color:var(--ink);padding:1px 5px;margin-left:-5px;border-radius:7px;line-height:1.14}
.hero-tag{display:block;width:100%;border:none;background:transparent;font-size:14px;color:var(--ink-2);
  padding:3px 5px;margin-left:-5px;border-radius:6px;font-weight:500}
.hero-name:hover,.hero-tag:hover,.hero-name:focus,.hero-tag:focus{background:color-mix(in srgb,var(--surface) 70%,transparent);outline:none}
.hero-meta{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:9px}
.codewrap{display:inline-flex;align-items:center;gap:5px;background:var(--ink);color:var(--bg);
  border-radius:999px;padding:4px 12px 4px 10px}
.codewrap i{font-style:normal;font-size:12px;opacity:.8}
.codein{border:none;background:transparent;color:var(--bg);font-family:var(--mono);font-size:11.5px;
  font-weight:600;letter-spacing:.09em;text-transform:uppercase;width:11ch;padding:0}
.codein::placeholder{color:color-mix(in srgb,var(--bg) 55%,transparent)}
.codein:focus{outline:none}
.hmeta{font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;background:var(--surface);
  border:1px solid var(--line-2);color:var(--ink-2);border-radius:999px;padding:4px 10px;white-space:nowrap}
.hero-cd{background:var(--surface);border:1px solid var(--line-2);border-radius:13px;padding:11px 17px;
  text-align:center;min-width:104px;box-shadow:0 2px 10px rgba(10,8,5,.07)}
.hero-cd b{display:block;font-size:31px;font-weight:800;letter-spacing:-.04em;line-height:1.05;
  font-variant-numeric:tabular-nums;color:var(--accent)}
.hero-cd span{font-family:var(--mono);font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}

/* --- tap-to-pick --- */
.pick{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.pkw{display:inline-flex;align-items:center;border:1.5px solid var(--ink);border-radius:999px;
  background:var(--surface);color:var(--ink);overflow:hidden;transition:transform .1s,box-shadow .1s}
.pkw:hover{transform:translateY(-1px);box-shadow:0 3px 9px rgba(10,8,5,.14)}
.pkw.on{background:linear-gradient(135deg,var(--accent),var(--marigold));border-color:transparent;color:#fff;
  box-shadow:0 3px 10px color-mix(in srgb,var(--accent) 40%,transparent)}
.pkw .pk{display:inline-flex;align-items:center;gap:6px;padding:7px 8px 7px 14px;font-size:12.5px;
  font-weight:600;color:inherit;background:none;border:none}
.pkw .pkx{padding:7px 11px 7px 3px;font-size:10px;line-height:1;color:inherit;opacity:.38;background:none;border:none}
.pkw .pkx:hover{opacity:1;color:var(--crit)}
.pkw.on .pkx{opacity:.72}
.pkw.on .pkx:hover{opacity:1;color:#fff}
.pk i{font-style:normal;font-size:14px;line-height:1}
.pk.solo{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--ink);border-radius:999px;
  padding:7px 14px;font-size:12.5px;font-weight:600;background:var(--surface);color:var(--ink)}
.pk.solo:hover{transform:translateY(-1px);box-shadow:0 3px 9px rgba(10,8,5,.14)}
.pk.solo.on{background:linear-gradient(135deg,var(--accent),var(--marigold));border-color:transparent;color:#fff;
  box-shadow:0 3px 10px color-mix(in srgb,var(--accent) 40%,transparent)}
.pk.add{border:1.5px dashed var(--line-2);border-radius:999px;padding:7px 14px;font-size:12.5px;
  font-weight:600;color:var(--ink-3);background:none}
.pk.add:hover{border-color:var(--accent);color:var(--accent);border-style:solid}

/* --- the details form and its field library --- */
.detwrap{display:grid;grid-template-columns:minmax(0,1fr) 224px;gap:16px;align-items:start}
.fgridwrap{min-width:0;border-radius:14px;transition:box-shadow .12s,background .12s}
.fgridwrap.over{box-shadow:0 0 0 2.5px var(--accent);background:color-mix(in srgb,var(--saffron) 13%,transparent)}
.fgrid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(272px,1fr));gap:13px;align-items:start}
.fblock{border:1.5px solid var(--ink);border-left:5px solid var(--fc);border-radius:12px;padding:13px 15px 15px;
  background:var(--surface);min-width:0}
.fblock.wide{grid-column:1/-1}
.fblock-h{display:flex;align-items:center;gap:7px;margin-bottom:11px}
.fdot{font-size:14px;line-height:1}
.flabel{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  font-weight:600;color:var(--fc)}
.fx{margin-left:auto;font-size:11px;line-height:1;color:var(--ink-3);padding:3px 5px;border-radius:5px}
.fx:hover{color:var(--crit);background:var(--crit-soft)}
.fblock input,.fblock textarea{width:100%;background:var(--surface);border:1.5px solid var(--line-2);
  border-radius:8px;padding:8px 10px;font-size:13px}
.fblock input:focus,.fblock textarea:focus{border-color:var(--fc);outline:none}
.fblock textarea{resize:vertical;min-height:62px;font-family:inherit}
.durrow{display:flex;gap:11px;flex-wrap:wrap;align-items:flex-end}
.durrow .fsel input{border:1.5px solid var(--line-2);border-radius:8px;background:var(--surface)}
.inline-in{margin-top:11px;display:flex;flex-direction:column;gap:5px}
.inline-in label{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.inline-in input{max-width:230px}
.fsel input.daysin{min-width:0;width:76px}

.fnav{position:sticky;top:78px;border:1.5px solid var(--ink);border-radius:14px;padding:13px;
  background:linear-gradient(170deg,color-mix(in srgb,var(--saffron) 15%,var(--surface)),var(--surface) 62%)}
.fnav-h{font-weight:800;font-size:13.5px;letter-spacing:-.016em}
.fnav-p{margin:3px 0 11px;font-size:11.5px;color:var(--ink-2);line-height:1.45}
.fnav-list{display:flex;flex-direction:column;gap:7px}
.fnavi{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:1.5px solid var(--ink);
  border-left:4px solid var(--fc);border-radius:9px;padding:8px 10px;background:var(--surface);
  touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none}
.fnavi:hover{transform:translateX(2px);box-shadow:0 3px 9px rgba(10,8,5,.14)}
.fnavi.dragging{opacity:.3}
.fnavi .e{font-size:14px;line-height:1}
.fnavi b{font-size:12px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fnavi .grip{margin-left:auto;color:var(--ink-3);font-size:12px;letter-spacing:-1px}
.fnav-empty{margin:0;font-size:11.5px;color:var(--ink-3);line-height:1.5}
.fnav-add{width:100%;margin-top:11px;border:1.5px dashed var(--line-2);border-radius:9px;padding:9px;
  font-size:12px;font-weight:600;color:var(--ink-2);background:var(--surface)}
.fnav-add:hover{border-color:var(--accent);color:var(--accent);border-style:solid}

/* --- section headings --- */
.sec-h.secbig{align-items:center;gap:11px;margin-bottom:13px;padding-bottom:9px;
  border-bottom:2px solid var(--ink)}
.sec-h.secbig h3{font-size:18px;letter-spacing:-.026em}
.empty.bold{border:1.5px dashed var(--ink);border-radius:12px;background:var(--surface)}

/* --- target boxes --- */
.tgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(222px,1fr));gap:13px}
.tcard{position:relative;border-radius:14px;padding:16px 17px 15px;color:#fff;overflow:hidden;
  background:linear-gradient(145deg,var(--tc),color-mix(in srgb,var(--tc) 62%,var(--ink)));
  box-shadow:0 5px 16px color-mix(in srgb,var(--tc) 32%,transparent)}
.tcard::after{content:"";position:absolute;right:-26px;top:-34px;width:104px;height:104px;border-radius:50%;
  background:rgba(255,255,255,.13)}
.tdept{position:relative;font-family:var(--mono);font-size:10px;letter-spacing:.11em;text-transform:uppercase;
  opacity:.85;font-weight:600}
.tval{position:relative;font-size:25px;font-weight:800;letter-spacing:-.032em;line-height:1.14;margin-top:5px}
.tnote{position:relative;margin:7px 0 0;font-size:11.5px;line-height:1.45;opacity:.88}
.tx{position:absolute;top:9px;right:9px;z-index:2;font-size:11px;color:#fff;opacity:.6;padding:3px 5px;border-radius:5px}
.tx:hover{opacity:1;background:rgba(0,0,0,.22)}
.tedit{position:relative;margin-top:11px;font-family:var(--mono);font-size:10px;letter-spacing:.07em;
  text-transform:uppercase;font-weight:600;color:#fff;border:1px solid rgba(255,255,255,.5);
  border-radius:999px;padding:3px 11px}
.tedit:hover{background:rgba(255,255,255,.18)}

/* --- content type tiles --- */
.ktiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(102px,1fr));gap:9px;margin-bottom:15px}
.ktile{position:relative;border:1.5px solid var(--ink);border-radius:12px;padding:12px 8px 10px;
  background:linear-gradient(170deg,color-mix(in srgb,var(--kc) 17%,var(--surface)),var(--surface) 72%);
  display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;min-width:0;
  transition:transform .1s,box-shadow .1s}
.ktile:hover{transform:translateY(-2px);box-shadow:0 6px 16px color-mix(in srgb,var(--kc) 34%,transparent)}
.ktile .e{font-size:21px;line-height:1}
.ktile b{font-size:11.5px;font-weight:600;line-height:1.25}
.ktile .n{display:grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;
  font-family:var(--mono);font-size:10.5px;font-weight:600;background:var(--surface-2);color:var(--ink-3)}
.ktile.has .n{background:var(--kc);color:#fff}

/* --- content piece cards --- */
.igrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(256px,1fr));gap:12px}
.icard{display:flex;flex-direction:column;border:1.5px solid var(--ink);border-radius:13px;overflow:hidden;
  background:var(--surface);transition:transform .1s,box-shadow .1s}
.icard:hover{transform:translateY(-2px);box-shadow:0 7px 18px color-mix(in srgb,var(--ic) 32%,transparent)}
.icard-h{display:flex;align-items:center;gap:7px;padding:8px 12px;background:var(--ic);color:#fff}
.icard-h .e{font-size:14px;line-height:1}
.icard-h .t{font-size:11.5px;font-weight:700;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.icard-h .d{margin-left:auto;font-family:var(--mono);font-size:10px;letter-spacing:.04em;
  background:rgba(0,0,0,.22);border-radius:999px;padding:2px 8px;white-space:nowrap}
.icard-b{padding:11px 13px 9px;flex:1;min-width:0}
.icard-b h5{font-size:13.5px;font-weight:700;line-height:1.35;letter-spacing:-.012em}
.icard-b p{margin:6px 0 0;font-size:11.5px;color:var(--ink-2);line-height:1.5;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.icard-f{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:9px 12px 11px;
  border-top:1px solid var(--line);background:color-mix(in srgb,var(--ic) 7%,transparent)}
.ichip{font-family:var(--mono);font-size:10px;letter-spacing:.05em;border:1.5px solid var(--ink);
  border-radius:999px;padding:2px 9px;background:var(--surface);white-space:nowrap}
.ichip.none{border-style:dashed;border-color:var(--crit);color:var(--crit)}
.icard-f .who{min-width:0;font-size:11.5px}
.iacts{margin-left:auto;display:flex;gap:5px}
.ibtn{font-size:11px;font-weight:600;border:1.5px solid var(--ink);border-radius:7px;padding:3px 10px;
  background:var(--surface)}
.ibtn:hover{background:var(--ink);color:var(--bg)}
.ibtn.x{padding:3px 8px;color:var(--crit);border-color:color-mix(in srgb,var(--crit) 55%,var(--line-2))}
.ibtn.x:hover{background:var(--crit);color:#fff;border-color:var(--crit)}

/* --- calendar drag and drop --- */
.cevt{touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none}
.cevt.dragging{opacity:.3}
.dragghost{cursor:grabbing!important;border-color:var(--accent)!important}
.dragmode{cursor:grabbing}
.cday[data-drop].over{background:color-mix(in srgb,var(--saffron) 26%,var(--surface));
  border-color:var(--accent);box-shadow:inset 0 0 0 2px var(--accent)}
.undated{transition:background .12s,border-color .12s}
.undated.over{background:color-mix(in srgb,var(--saffron) 22%,var(--surface));border-color:var(--accent);border-style:solid}
.calnav{display:flex;align-items:center;gap:7px}
.navbtn{width:29px;height:29px;border:1px solid var(--line-2);border-radius:8px;display:grid;place-items:center;
  background:var(--surface);font-size:15px;color:var(--ink-2);line-height:1}
.navbtn:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.tundo{font-family:var(--mono);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--bg);
  border:1px solid color-mix(in srgb,var(--bg) 42%,transparent);border-radius:999px;padding:3px 11px;font-weight:600;flex-shrink:0}
.tundo:hover{background:color-mix(in srgb,var(--bg) 20%,transparent)}

/* --- colour swatches inside a dialog --- */
.swatches{display:flex;flex-wrap:wrap;gap:8px}
.sw{width:31px;height:31px;border-radius:10px;border:2px solid var(--line-2);background:var(--sw);
  display:grid;place-items:center;padding:0;line-height:0;transition:transform .1s,box-shadow .1s}
.sw.auto{background:linear-gradient(135deg,var(--accent) 0 25%,var(--c2) 25% 50%,
  var(--c3) 50% 75%,var(--good) 75% 100%)}
.sw:hover{transform:translateY(-1px);box-shadow:0 3px 8px rgba(10,8,5,.18)}
.sw.on{border-color:var(--ink)}
.sw span{display:block;width:9px;height:9px;border-radius:50%;background:#fff;opacity:0;
  box-shadow:0 0 0 1.5px rgba(0,0,0,.28)}
.sw.on span{opacity:1}

/* --- image upload inside a dialog --- */
.imgpick{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
.imgpick input[type=file]{display:none}
.imgprev{display:block;width:54px;height:54px;border-radius:14px;overflow:hidden;flex-shrink:0;
  border:1px solid var(--line-2);background:var(--surface-2)}
.imgprev img{width:100%;height:100%;object-fit:cover;display:block}
.imghint{flex-basis:100%;margin:0;font-size:11.5px;color:var(--ink-3);line-height:1.45}
.hero-emo.hasimg{padding:0;overflow:hidden}
.hero-emo img{width:100%;height:100%;object-fit:cover;display:block}
img.sicon{width:16px;height:16px;border-radius:5px;object-fit:cover;display:inline-block;vertical-align:-3px}
.h-title img.sicon{width:31px;height:31px;border-radius:9px;vertical-align:-5px}

/* --- dashboard big tile --- */
.bigtile{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:15px;padding:22px 24px;margin-bottom:16px;
  background:radial-gradient(circle at 88% -40%, color-mix(in srgb,var(--saffron) 38%,transparent), transparent 58%),
    linear-gradient(135deg, color-mix(in srgb,var(--accent) 10%,var(--surface)), color-mix(in srgb,var(--marigold) 11%,var(--surface)))}
.bigtile .n{font-size:62px;font-weight:800;letter-spacing:-.052em;line-height:1;font-variant-numeric:tabular-nums;
  margin-top:7px;color:var(--ink)}
.bigtile .t{font-size:15px;font-weight:700;margin-top:6px;letter-spacing:-.018em}
.bigtile .s{font-size:12.5px;color:var(--ink-2);margin-top:2px}
.redline{margin:12px 0 0;padding-left:10px;border-left:3px solid var(--crit);color:var(--crit);
  font-size:12.5px;font-weight:600;line-height:1.45}

@media (max-width:900px){ .detgrid{grid-template-columns:1fr} }
@media (max-width:1000px){
  .detwrap{grid-template-columns:1fr}
  .fnav{position:static}
  .fnav-list{flex-direction:row;flex-wrap:wrap}
  .fnavi{width:auto}
}
@media (max-width:560px){
  .hero{padding:17px 16px}
  .hero-name{font-size:23px}
  .hero-cd{min-width:0;flex:1;display:flex;align-items:baseline;gap:8px;justify-content:center;text-align:left}
  .hero-cd b{font-size:25px}
  .bigtile .n{font-size:50px}
}

.main{padding:22px 24px 72px;min-width:0}
.crumb{font-family:var(--mono);font-size:10.5px;letter-spacing:.11em;color:var(--ink-3);text-transform:uppercase}
.h-title{font-size:31px;margin:5px 0 7px;letter-spacing:-.032em}
.h-sub{color:var(--ink-2);max-width:62ch;margin:0 0 18px}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:22px;overflow-x:auto}
.tab{padding:10px 14px;font-size:14px;font-weight:600;color:var(--ink-3);border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
.tab.on{color:var(--accent);border-bottom-color:var(--accent)}

.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.sec{margin-bottom:26px}
.sec-h{display:flex;align-items:baseline;gap:10px;margin-bottom:11px;flex-wrap:wrap}
.sec-h h3{font-size:16px}
.hint{font-size:12px;color:var(--ink-3)}
.chip{font-family:var(--mono);font-size:11px;border:1px solid var(--line-2);border-radius:999px;padding:4px 10px;color:var(--ink-2);background:var(--surface)}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.tag{font-family:var(--mono);font-size:10.5px;padding:2.5px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink);font-weight:500;white-space:nowrap}
.tag.c2{background:color-mix(in srgb,var(--c2) 15%,transparent);color:var(--c2)}
.tag.c3{background:color-mix(in srgb,var(--c3) 15%,transparent);color:var(--c3)}
.tag.c4{background:color-mix(in srgb,var(--c4) 17%,transparent);color:var(--c4)}
.plat{font-family:var(--mono);font-size:10.5px;font-weight:600;padding:2.5px 7px;border-radius:5px;white-space:nowrap}
.badge{font-family:var(--mono);font-size:10px;letter-spacing:.05em;padding:3px 8px;border-radius:5px;font-weight:600;display:inline-flex;align-items:center;gap:4px}
.badge.good{background:var(--good-soft);color:var(--good)} .badge.warn{background:var(--warn-soft);color:var(--warn)}
.badge.crit{background:var(--crit-soft);color:var(--crit)} .badge.mute{background:var(--surface-2);color:var(--ink-3)}
.btn{border:1px solid var(--line-2);background:var(--surface);border-radius:var(--r-s);padding:7px 13px;font-size:12.5px;font-weight:600;color:var(--ink-2)}
.btn:hover{border-color:var(--ink-3)}
.btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.pri:disabled{opacity:.42;cursor:not-allowed}
.btn.sm{padding:4px 9px;font-size:11.5px}
.btn.danger{color:var(--crit);border-color:color-mix(in srgb,var(--crit) 40%,var(--line-2))}

.apibar{display:flex;gap:11px;align-items:flex-start;background:var(--warn-soft);border:1px solid color-mix(in srgb,var(--warn) 32%,transparent);border-radius:var(--r);padding:12px 14px;margin-bottom:20px}
.apibar .ic{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--warn);border:1.5px solid var(--warn);border-radius:5px;padding:2px 6px;flex-shrink:0;margin-top:1px}
.apibar p{margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.55}
.apibar b{color:var(--ink)}

.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:11px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:13px 14px;min-width:0}
.tile .k{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:7px}
.tile .v{font-size:27px;font-weight:700;letter-spacing:-.035em;line-height:1.08;font-variant-numeric:tabular-nums}
.tile .v small{font-size:14px;font-weight:600;color:var(--ink-3);letter-spacing:0}
.tile .d{font-size:11.5px;color:var(--ink-3);margin-top:5px;line-height:1.4}

.okrs{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:13px}
.okr{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:15px 16px}
.okr-top{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:10px}
.okr-v{font-size:25px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.okr-t{font-size:12px;color:var(--ink-3);font-family:var(--mono)}
.meter{height:9px;background:var(--surface-2);border-radius:999px;overflow:hidden;border:1px solid var(--line)}
.meter i{display:block;height:100%;border-radius:999px}
.okr-foot{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:11.5px;color:var(--ink-3);flex-wrap:wrap}

.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:13px}
.chart-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:15px 16px;min-width:0}
.chart-head{display:flex;justify-content:space-between;align-items:center;gap:9px;margin-bottom:3px;flex-wrap:wrap}
.chart-head h4{font-size:13.5px}
.chart-sub{font-size:11.5px;color:var(--ink-3);margin:0 0 11px}
.seg{display:flex;border:1px solid var(--line-2);border-radius:999px;overflow:hidden}
.seg button{padding:3px 10px;font-size:11px;font-family:var(--mono);color:var(--ink-3)}
.seg button.on{background:var(--ink);color:var(--bg)}
svg{display:block;max-width:100%}
.legend{display:flex;gap:13px;flex-wrap:wrap;margin-top:10px}
.legend span{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink-2)}
.legend i{width:9px;height:9px;border-radius:3px;display:block}
.tt{position:fixed;z-index:90;background:var(--ink);color:var(--bg);font-size:11.5px;font-family:var(--mono);padding:6px 9px;border-radius:6px;pointer-events:none;opacity:0;transition:opacity .1s;white-space:pre;line-height:1.5}

.tw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
table{border-collapse:collapse;width:100%;min-width:1800px}
th{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);font-weight:500;white-space:nowrap;background:var(--surface-4)}
td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top;font-size:13px}
tr:last-child td{border-bottom:none}
tbody tr:hover{background:var(--surface-4)}
.td-idea{font-weight:600;min-width:218px;max-width:270px}
.td-txt{color:var(--ink-2);font-size:12px;min-width:160px;max-width:230px;line-height:1.45}
.td-kw{min-width:200px}
.kwrow{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:1.5px 0}
.kwrow .k{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kwrow.pri .k{font-weight:600;color:var(--ink)}
.kwrow.sec{color:var(--ink-3);font-size:11.5px}
.kwrow .v{font-family:var(--mono);font-variant-numeric:tabular-nums;flex-shrink:0;color:var(--ink-2)}
.vol{font-variant-numeric:tabular-nums;font-family:var(--mono);font-size:12px}
.vol small{display:block;color:var(--ink-3);font-size:10px}
.miss{color:var(--crit);font-family:var(--mono);font-size:11px}
.who{display:flex;align-items:center;gap:6px;font-size:12px;min-width:110px}
.av{width:21px;height:21px;border-radius:50%;display:grid;place-items:center;font-size:9.5px;font-weight:700;color:#fff;flex-shrink:0}
.cbtn{border:1px solid var(--line-2);border-radius:var(--r-s);padding:3px 8px;font-size:11px;font-family:var(--mono);color:var(--ink-3);display:inline-flex;gap:4px;align-items:center}
.cbtn.has{border-color:var(--accent);color:var(--accent)}
.hook{font-family:var(--hand);font-size:16.5px;line-height:1.3;color:var(--ink);min-width:150px;max-width:210px;display:block}
.cta{font-size:12px;color:var(--ink-2);min-width:120px;max-width:170px}
.stsel{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.04em;border:1px solid transparent;border-radius:5px;padding:4px 6px;min-width:112px;cursor:pointer;background:var(--surface-2);color:var(--ink-3)}
.stsel.good{background:var(--good-soft);color:var(--good)} .stsel.warn{background:var(--warn-soft);color:var(--warn)}
.stsel.crit{background:var(--crit-soft);color:var(--crit)}

.board{display:grid;grid-auto-flow:column;grid-auto-columns:258px;gap:11px;overflow-x:auto;padding-bottom:12px}
.col{background:var(--surface-3);border-radius:var(--r);padding:11px;min-width:0;transition:background .12s,box-shadow .12s}
.col.over{background:var(--accent-soft);box-shadow:inset 0 0 0 2px var(--accent)}
.col.no{box-shadow:inset 0 0 0 2px var(--crit)}
.col-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:6px}
.col-h h4{font-size:12.5px}
.count{font-family:var(--mono);font-size:11px;color:var(--ink-3);background:var(--surface);border-radius:999px;padding:1px 7px;border:1px solid var(--line)}
.kcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-s);padding:11px;margin-bottom:8px;text-align:left;width:100%;display:block;cursor:grab}
.kcard:hover{border-color:var(--ink-3)}
.kcard.dragging{opacity:.4;cursor:grabbing}
.kcard h5{font-size:12.5px;font-weight:600;margin:0 0 7px;line-height:1.38}
.kcard .meta{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
.gates{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}
.gchip{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;padding:2px 6px;border-radius:4px;background:var(--surface-2);color:var(--ink-3);display:inline-flex;gap:3px;align-items:center}
.gchip.ok{background:var(--good-soft);color:var(--good)}
.gchip.no{background:var(--crit-soft);color:var(--crit)}

.scrim{position:fixed;inset:0;background:rgba(10,8,5,.42);z-index:60;opacity:0;pointer-events:none;transition:opacity .16s}
.scrim.on{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100%);background:var(--bg);border-left:1px solid var(--line);z-index:70;transform:translateX(100%);transition:transform .2s ease;overflow-y:auto;padding:20px 22px calc(40px + env(safe-area-inset-bottom,0px));padding-top:calc(20px + env(safe-area-inset-top,0px))}
.drawer.on{transform:none}
.dr-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.dr-h h3{font-size:18px;letter-spacing:-.025em}
.fld{margin-bottom:12px}
.fld label{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-bottom:5px;font-weight:500}
.fld input,.fld select,.fld textarea{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r-s);padding:8px 10px;font-size:13px}
.fld textarea{resize:vertical;min-height:62px;font-family:inherit}
.fld.bad input,.fld.bad select,.fld.bad textarea{border-color:var(--crit)}
.fld .req{color:var(--crit);font-family:var(--mono);font-size:10px;margin-left:4px;letter-spacing:0}
.fld .hookin{font-family:var(--hand);font-size:17px}
.otherin{margin-top:6px;border-style:dashed!important}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.block{border:1px solid var(--line);border-radius:var(--r);padding:14px;margin-bottom:14px;background:var(--surface-4)}
.block-h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:11px;flex-wrap:wrap}
.block-h h4{font-size:13px}
.cmt{border-top:1px solid var(--line);padding:9px 0;font-size:12.5px}
.cmt p{margin:0;color:var(--ink-2)}

.kwed{display:grid;grid-template-columns:1fr 92px 96px 30px;gap:7px;margin-bottom:7px;align-items:center}
.kwed input,.kwed select{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r-s);padding:7px 9px;font-size:12.5px}
.kwed .x{border:1px solid var(--line-2);border-radius:var(--r-s);padding:6px 0;text-align:center;color:var(--ink-3);font-size:13px}
.kwhead{display:grid;grid-template-columns:1fr 92px 96px 30px;gap:7px;margin-bottom:5px}
.kwhead span{font-family:var(--mono);font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}

.drop{border:1.5px dashed var(--line-2);border-radius:var(--r-s);padding:14px;text-align:center;background:var(--surface);margin-bottom:10px}
.drop.has{border-style:solid;border-color:color-mix(in srgb,var(--good) 45%,var(--line-2));text-align:left;display:flex;gap:11px;align-items:center}
.drop .nm{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drop .sz{font-family:var(--mono);font-size:10.5px;color:var(--ink-3)}
.drop .lbl{margin-bottom:5px}
.drop img{width:62px;height:35px;object-fit:cover;border-radius:5px;flex-shrink:0;border:1px solid var(--line)}
.drop input[type=file]{display:none}
.filebtn{display:inline-block;border:1px solid var(--line-2);border-radius:var(--r-s);padding:6px 12px;font-size:12px;font-weight:600;color:var(--ink-2);cursor:pointer;background:var(--surface-2)}

.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;min-width:660px}
.cal .dow{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);text-align:center;padding:5px 0}
.day{border:1px solid var(--line);border-radius:var(--r-s);min-height:92px;padding:7px;background:var(--surface);display:flex;flex-direction:column;gap:4px}
.day.pad{background:transparent;border-color:transparent}
.day.today{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.day .dn{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.evt{font-size:10.5px;border-radius:4px;padding:4px 6px;line-height:1.3;border-left:2.5px solid;background:var(--surface-2);color:var(--ink-2);text-align:left;width:100%;display:block}
.evt b{display:block;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.weekgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;min-width:760px}
.wday{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:10px;min-height:190px;display:flex;flex-direction:column;gap:6px}
.wday.today{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.wday .wh{display:flex;justify-content:space-between;align-items:baseline;gap:6px;padding-bottom:7px;border-bottom:1px solid var(--line);margin-bottom:2px}
.wday .wh b{font-size:17px;letter-spacing:-.02em}
.wevt{border:1px solid var(--line);border-left:3px solid;border-radius:var(--r-s);padding:8px;text-align:left;width:100%;background:var(--surface-4)}
.wevt h6{margin:0 0 5px;font-size:11.5px;font-weight:600;line-height:1.35}
.wevt .meta{display:flex;gap:4px;flex-wrap:wrap}

.note{background:var(--note);border:1px solid var(--note-line);border-radius:var(--r);padding:16px 18px;font-family:var(--hand);font-size:19px;color:var(--note-ink);line-height:1.42}
.note .lbl{color:var(--note-lbl);margin-bottom:7px}
.note b{font-weight:700}
.note em{font-style:normal;text-decoration:underline;text-decoration-color:var(--note-lbl);text-underline-offset:3px}

.toast{position:fixed;left:50%;transform:translateX(-50%) translateY(14px);bottom:calc(22px + env(safe-area-inset-bottom,0px));background:var(--ink);color:var(--bg);font-size:12.5px;font-weight:600;padding:10px 16px;border-radius:999px;z-index:95;opacity:0;pointer-events:none;transition:all .18s;max-width:90vw;text-align:center;display:flex;align-items:center;gap:12px;justify-content:center}
.toast.on{opacity:1;transform:translateX(-50%)}
.toast.act{pointer-events:auto}

@media (max-width:680px){ .mbody{grid-template-columns:1fr} }
@media (max-width:860px){
  .shell{grid-template-columns:1fr}
  .rail{border-right:none;border-bottom:1px solid var(--line);flex-direction:row;flex-wrap:wrap;align-items:center}
  .rail .lbl,.rail > .dashed{display:none}
  .space{width:auto}
  .kids{flex-direction:row;flex-wrap:wrap;border-left:none;margin-left:0;padding-left:0;align-items:center}
  .sections{flex-direction:row;flex-wrap:wrap;border-left:none;margin-left:0;padding-left:0}
  .addsub{display:block;width:auto}
  .main{padding:18px 16px 70px}
  .h-title{font-size:25px}
  .grid2{grid-template-columns:1fr}
  .kwed,.kwhead{grid-template-columns:1fr 80px 84px 28px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
[hidden]{display:none!important}
p{margin:0}
/* read-only (not an admin): what's chosen shows, the knobs don't */
/* --- content list: day strip + groups --- */
.daystrip{align-items:flex-end;gap:2px;margin-bottom:18px;padding-top:2px}
.dtab-w{position:relative;display:inline-flex;flex-shrink:0}
.dtab{flex-direction:column;align-items:center;gap:1px;min-width:62px;padding:7px 12px 8px}
.dtab b{font-size:19px;font-weight:800;letter-spacing:-.03em;line-height:1.05;color:inherit}
.dtab span:not(.cnt){font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase}
.dtab .cnt{margin-top:3px}
.dtab.out{opacity:.82}
.dtab.out b::after{content:"•";color:var(--saffron);font-size:12px;vertical-align:super;margin-left:1px}
.dtab-x{position:absolute;top:1px;right:1px;font-size:9px;line-height:1;color:var(--ink-3);padding:3px 4px;border-radius:4px}
.dtab-x:hover{color:var(--crit);background:var(--crit-soft)}
.dtab-add{flex-shrink:0;align-self:center;margin-left:6px;border:1.5px dashed var(--line-2);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;color:var(--ink-3);white-space:nowrap}
.dtab-add:hover{border-color:var(--accent);color:var(--accent);border-style:solid}
.cgroup{margin-bottom:20px}
.cgroup-h{display:flex;align-items:center;gap:8px;padding:0 0 8px 10px;margin-bottom:11px;border-left:4px solid var(--ic);border-bottom:1px solid var(--line)}
.cgroup-h h4{font-size:15px;letter-spacing:-.018em;color:var(--ic)}
.cg-ic{font-size:16px;line-height:1}
.cgroup-h .cnt{font-family:var(--mono);font-size:10.5px;background:color-mix(in srgb,var(--ic) 14%,transparent);color:var(--ic);border-radius:999px;padding:1px 8px;font-weight:600}
.cg-add{margin-left:auto}
/* --- bulk create rows --- */
.bhead,.brow{display:grid;grid-template-columns:minmax(0,1fr) 84px 32px;gap:8px;align-items:center}
.bhead{margin-bottom:6px}
.bhead span{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.brow{margin-bottom:8px}
.brow select,.brow input{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r-s);padding:8px 10px;font-size:13px}
.brow .bother{grid-column:1/-1;border-style:dashed}
.bx{border:1px solid var(--line-2);border-radius:var(--r-s);padding:7px 0;text-align:center;color:var(--ink-3);font-size:12px}
.bx:hover{color:var(--crit);border-color:var(--crit)}

.ro .pkx,.ro .pk.add,.ro .fx,.ro .tx,.ro .tedit,.ro .iacts,.ro .fnav{display:none}
.ro .detwrap{grid-template-columns:minmax(0,1fr)}
.ro .pkw:not(.on),.ro .pk.solo:not(.on){display:none}
.ro .pkw .pk{padding-right:14px}
.ro .pk,.ro .hero-emo{cursor:default}
.ro .pkw:hover,.ro .pk.solo:hover,.ro .hero-emo:hover{transform:none;box-shadow:none}
.ro .pick:not(:has(.on)):not(:has(input))::after{content:"Not set yet";font-size:12.5px;color:var(--ink-3)}
.ro input:disabled,.ro textarea:disabled{color:var(--ink);-webkit-text-fill-color:var(--ink);opacity:1}
.ro .fblock input:disabled,.ro .fblock textarea:disabled{background:var(--surface-4)}
.ro .hero-name:disabled,.ro .hero-tag:disabled{background:transparent}
.ro .codein:disabled{color:var(--bg);-webkit-text-fill-color:var(--bg)}
`;

let HOST=null, R=null, SPACE=null, OPT={};
let CTAB="details", CALVIEW="grid", ASSIGNFILTER="All", CALMONTH="";
let CALFILTER={ range:"all", anchor:"", type:"all", platform:"all", owner:"all" };
const $ = s => R.querySelector(s);

/* ------------------------------------------------------------ helpers */
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isoD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const TODAY = isoD(new Date());
const dmy = s => s ? new Date(s+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : "—";
const dowShortC = s => s ? new Date(s+"T00:00:00").toLocaleDateString("en-GB",{weekday:"short"}) : "";
const days = (a,b) => Math.round((new Date(b)-new Date(a))/86400000);
const slug = s => "x_"+String(s).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,28);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function hue(name){ let h=0; for(const ch of String(name)) h=(h*31+ch.charCodeAt(0))%360; return h; }
function avatar(name){ const n=String(name||"?").trim()||"?";
  return `<span class="av" style="background:hsl(${hue(n)} 48% 42%)">${esc(n.charAt(0).toUpperCase())}</span>`; }
const canEdit = () => !OPT.canEdit || OPT.canEdit();
/* a Team Manager (or admin): moves pieces on the calendar, works the Assignment tab */
const canPlan = () => canEdit() || !!(OPT.canPlan && OPT.canPlan());
/* the line a Team Member sees on every tab */
const memberBar = () => `<div class="bar2"><span class="ic2">VIEW ONLY</span><p><b>This campaign is the plan — you can see all of it.</b>
  Your own work happens on your board (Content Process, or wherever a piece was handed to you): open it there to change its status or add to it.</p></div>`;
function people(){ return (OPT.people && OPT.people()) || []; }          /* [{id,name,role}] */
function ownerName(it){ if(!it.ownerId) return it.owner||""; const p=people().find(x=>x.id===it.ownerId); return p ? p.name : (it.owner||""); }
/* save and redraw (index.html's save redraws the whole page, which calls CX.render again) */
function save(){ if(OPT.save) OPT.save(SPACE); else draw(); }
/* save without a redraw — while someone is typing */
function saveQuiet(){ (OPT.saveQuiet || OPT.save || function(){})(SPACE); }
function goTab(t){ if(OPT.setTab) OPT.setTab(t); else { CTAB=t; draw(); } }

function toast(m){ const t=$("#toast"); if(!t) return; t.classList.remove("act"); t.textContent=m; t.classList.add("on");
  clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove("on"),2600); }
/* a toast that offers one way back out */
function toastUndo(m, undo){
  const t=$("#toast"); if(!t) return;
  t.innerHTML = `<span>${esc(m)}</span><button class="tundo" type="button">Undo</button>`;
  t.classList.add("on","act");
  t.querySelector(".tundo").onclick = ()=>{ clearTimeout(t._x); t.classList.remove("on","act"); undo(); };
  clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove("on","act"),5200);
}

/* ---------- what you tap instead of typing ---------- */
const CAMP_TYPES = [
  { k:"festival", emo:"🪔", label:"Festival sale" },
  { k:"course",   emo:"🚀", label:"Course launch" },
  { k:"webinar",  emo:"🎥", label:"Webinar" },
  { k:"giveaway", emo:"🎁", label:"Giveaway" },
  { k:"exam",     emo:"⏰", label:"Exam alert" }
];
const OFFER_TYPES = [
  { k:"flat",   emo:"₹", label:"Flat ₹ off", vlabel:"How much off",    ph:"2000" },
  { k:"pct",    emo:"%", label:"% off",      vlabel:"What percentage", ph:"25" },
  { k:"trial",  emo:"🎟", label:"Free trial", vlabel:"How long",        ph:"7 days" },
  { k:"bundle", emo:"🎒", label:"Bundle",     vlabel:"What's bundled",  ph:"2 courses for the price of 1" }
];
const DUR_PRESETS = [3,7,10,14];
const BUDGETS = [10000,25000,45000,75000,100000];
const EMOJIS = ["📣","🪔","🎯","🚀","🎉","🎁","⏰","🔥","🎓","💥","✨","🎈"];

/* Everything that can live on the Details tab. Only the first three are there
   to begin with; the rest wait in the field library until someone drags one in. */
const FIELD_LIB = {
  type:      { label:"Campaign type", emo:"🪔", kind:"chips" },
  offerType: { label:"Offer type",    emo:"🏷", kind:"offer" },
  duration:  { label:"Duration",      emo:"📅", kind:"duration", wide:true },
  channels:  { label:"Channels",      emo:"📡", kind:"chips", multi:true, wide:true },
  audience:  { label:"Audience",      emo:"👥", kind:"chips", multi:true },
  goal:      { label:"Goal",          emo:"🎯", kind:"chips" },
  budget:    { label:"Budget",        emo:"💰", kind:"budget", wide:true },
  messaging: { label:"Messaging",     emo:"✍️", kind:"text", wide:true },
  other:     { label:"Other details", emo:"📋", kind:"text", wide:true }
};
const DEFAULT_FIELDS = ["type","offerType","duration"];
const SUGGEST = {
  channels:"Instagram, YouTube, App, Website, WhatsApp, Email…",
  audience:"Class 12, Droppers, CUET, NEET, existing buyers…",
  goal:"Enrolments, app installs, leads, awareness…",
  type:"Flash sale, referral drive…", offerType:"Buy one get one, cashback…"
};
const FIELD_COLORS = ["var(--accent)","var(--saffron)","var(--c2)","var(--c3)","var(--c4)","var(--good)","var(--marigold)"];
const fieldColor = k => FIELD_COLORS[hue(k) % FIELD_COLORS.length];
const TCOLORS = ["var(--accent)","var(--c2)","var(--c3)","var(--good)","var(--c4)","var(--marigold)"];
const BOX_COLORS = [
  ["var(--accent)","Terracotta"], ["var(--marigold)","Marigold"], ["var(--saffron)","Saffron"],
  ["var(--c4)","Ochre"],          ["var(--good)","Green"],        ["var(--c2)","Teal"],
  ["var(--c3)","Indigo"],         ["var(--crit)","Red"]
];
const bLabel = n => n>=100000 ? `₹${n/100000} L` : `₹${n/1000}k`;
const findOpt = (c,f,k) => ((c.opts||{})[f]||[]).find(o=>o.k===k) || null;
const fieldDef = (c,k) => FIELD_LIB[k] || Object.assign({ label:k, emo:"➕", custom:true }, (c.custom||{})[k] || {});
const fixEmo = s => typeof s === "string"
  ? s.replace(/\\?U([0-9A-Fa-f]{8})/g, (m,h)=>{ try { return String.fromCodePoint(parseInt(h,16)); } catch(e){ return ""; } })
  : s;

const ITEM_KINDS = {
  reel:        { emo:"🎬", label:"Reel",             c:"var(--c1)" },
  longvideo:   { emo:"📹", label:"Long video",       c:"var(--c2)" },
  story:       { emo:"⭕", label:"Story",            c:"var(--crit)" },
  influencer:  { emo:"🤝", label:"Influencer video", c:"var(--warn)" },
  banner:      { emo:"🖼", label:"Banner",           c:"var(--c3)" },
  alert:       { emo:"📢", label:"Alert message",    c:"var(--c3)" },
  notification:{ emo:"🔔", label:"Notification",     c:"var(--c4)" },
  whatsapp:    { emo:"💬", label:"WhatsApp message", c:"var(--good)" },
  other:       { emo:"📌", label:"Other",            c:"var(--ink-3)" }
};
const PLATFORMS = ["Instagram","YouTube","App","Website","WhatsApp","Email","Other"];
const kindOf = it => ITEM_KINDS[it.kind] || ITEM_KINDS.other;
const kindName = it => it.kind==="other" && it.kindOther ? it.kindOther : kindOf(it).label;

/* what the Action button does, by item type */
const STRAPI_URL = "https://strapi.dubuddy.in/admin";
const MSG91_URL  = "https://control.msg91.com/";
const FCM_URL    = "https://console.firebase.google.com/u/0/project/cyberflow-84423/notification/compose";
const ACTIONS = {
  reel:        { label:"Send to Content Process", mode:"process" },
  longvideo:   { label:"Send to Content Process", mode:"process" },
  story:       { label:"Send to Content Process", mode:"process" },
  influencer:  { label:"Send to Content Process", mode:"process" },
  banner:      { label:"Open Strapi",       mode:"link", url:STRAPI_URL },
  alert:       { label:"Open Strapi",       mode:"link", url:STRAPI_URL },
  whatsapp:    { label:"Open MSG91",        mode:"link", url:MSG91_URL },
  notification:{ label:"Push Notification", mode:"link", url:FCM_URL },
  other:       { label:"",                  mode:"none" }
};
/* YouTube and Instagram pieces always go to Content Process; otherwise a button set on the piece
   (its own label + link) wins over the type's default */
const PROCESS_PLATFORMS = ["YouTube","Instagram"];
const safeUrl = u => { u = String(u||"").trim(); if(!u) return ""; if(!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u; return /^https?:\/\//i.test(u) ? u : ""; };
const actionFor = it => {
  if(PROCESS_PLATFORMS.includes(it.platform)) return ACTIONS.reel;
  const url = safeUrl(it.actionUrl);
  if(url) return { label: (it.actionLabel||"").trim() || "Open link", mode:"link", url };
  return ACTIONS[it.kind] || ACTIONS.other;
};
const sortItems = its => [...its].sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));

/* ------------------------------------------------------------ data shape */
/* Older campaigns were a fixed set of boxes. Carry everything that was already
   typed into the new shape without dropping any of it. */
function normalize(c){
  const d = c.details || (c.details = {});
  if(d.name==null) d.name = c.name || "";
  ["tagline","code","days","messaging","other"].forEach(k=>{ if(d[k]==null) d[k] = ""; });
  d.emoji = fixEmo(d.emoji);
  if(!d.emoji)           d.emoji = "📣";
  if(d.icon==null)       d.icon = "";
  if(d.type==null)       d.type = "";
  if(d.offerType==null)  d.offerType = "";
  if(d.offerValue==null) d.offerValue = "";
  if(d.start==null)      d.start = "";
  if(d.end==null)        d.end   = "";
  if(d.goal==null)       d.goal  = "";
  if(d.budget==null)     d.budget= "";
  if(!Array.isArray(d.channels)) d.channels = [];
  if(!Array.isArray(d.audience)) d.audience = [];
  if(!Array.isArray(c.items))    c.items = [];
  if(!Array.isArray(c.targets))  c.targets = [];
  if(!c.custom) c.custom = {};
  c.contentsLabel = c.contentsLabel || "List of contents";
  c.items.forEach(it=>{ if(!it.id) it.id = uid("ci"); if(!ITEM_KINDS[it.kind]) it.kind = "other"; });

  /* the options behind each chip field — yours to add to and delete from */
  const o = c.opts || (c.opts = {});
  if(!o.type)      o.type      = CAMP_TYPES.map(x=>({...x}));
  if(!o.offerType) o.offerType = OFFER_TYPES.map(x=>({...x}));
  ["channels","audience","goal"].forEach(k=>{ if(!o[k]) o[k] = []; });
  Object.values(o).forEach(list=>(list||[]).forEach(x=>{ if(x) x.emo = fixEmo(x.emo); }));

  /* which fields are on the form, and in what order */
  if(!Array.isArray(c.fields)){
    c.fields = [...DEFAULT_FIELDS];
    ["channels","audience","goal","budget","messaging","other"].forEach(k=>{
      const v = d[k];
      if(Array.isArray(v) ? v.length : (v!=null && v!=="")) c.fields.push(k);
    });
    /* the old free-text duration becomes a custom box, so nothing typed is lost */
    if(d.duration){ const key="xdur"; c.custom[key]={ label:"Duration (as typed before)", kind:"line" }; d[key]=d.duration; c.fields.push(key); }
    /* old "add your own field" boxes become custom fields */
    (c.extra||[]).forEach((x,n)=>{
      if(!x || !x.label) return;
      const key = "x" + Date.now() + "_" + n;
      c.custom[key] = { label:x.label, kind:x.wide?"text":"line", wide:!!x.wide };
      d[key] = x.value || "";
      c.fields.push(key);
    });
    c.extra = [];
  }
  ["channels","audience"].forEach(k=>{ d[k] = (d[k]||[]).filter(v=>findOpt(c,k,v)); });
  return c;
}
const addDays = (s,n)=>{ const x=new Date(s+"T00:00:00"); x.setDate(x.getDate()+n); return isoD(x); };
/* start + days ⇄ end, kept consistent whichever one you touched */
function syncDuration(d, from){
  if(from==="end"){
    if(d.start && d.end && d.end>=d.start) d.days = String(days(d.start,d.end)+1);
    return;
  }
  const n = parseInt(d.days,10);
  if(d.start && n>0) d.end = addDays(d.start, n-1);
  else if(d.start && d.end && d.end>=d.start) d.days = String(days(d.start,d.end)+1);
}
/* the live "X days to go" in the hero */
function countdown(d){
  const t = isoD(new Date());
  if(!d.start) return { big:"—", small:"set a start date" };
  const e = d.end || d.start;
  if(t < d.start){ const n = days(t,d.start); return { big:n, small:n===1?"day to launch":"days to launch" }; }
  if(t > e) return { big:"✓", small:"campaign ended" };
  const n = days(t,e);
  return n===0 ? { big:"Last", small:"day — today" } : { big:n, small:n===1?"day to go":"days to go" };
}
const cdHTML = cd => `<b>${esc(String(cd.big))}</b><span>${esc(cd.small)}</span>`;
function offerLine(c){
  const d = c.details, o = findOpt(c,"offerType",d.offerType);
  if(!o) return "";
  const v = String(d.offerValue||"").trim();
  if(!v) return o.label;
  return o.k==="flat" ? `₹${v} off` : o.k==="pct" ? `${v}% off` : o.k==="trial" ? `${v} free` : v;
}

/* shrink an uploaded picture to a small square so it can be saved with the campaign */
function iconFromFile(file, cb){
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = ()=>{
    const S = 128, cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const s = Math.min(img.width, img.height);
    cv.getContext("2d").drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, S, S);
    let out = "";
    try{
      out = cv.toDataURL("image/png");
      if(out.length > 60000){ const j = cv.toDataURL("image/jpeg",0.8); if(j.length < out.length) out = j; }
    }catch(e){}
    URL.revokeObjectURL(url); cb(out);
  };
  img.onerror = ()=>{ URL.revokeObjectURL(url); cb(""); };
  img.src = url;
}

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
    : f.type==="swatch"
      ? `<input type="hidden" id="d-${f.k}" value="${esc(f.value||"")}">
         <div class="swatches" data-sw="${esc(f.k)}">
           <button type="button" class="sw auto ${f.value?"":"on"}" data-c="" title="Automatic — follows the order on screen"><span></span></button>
           ${BOX_COLORS.map(([c,n])=>`<button type="button" class="sw ${f.value===c?"on":""}" data-c="${esc(c)}" style="--sw:${c}" title="${esc(n)}"><span></span></button>`).join("")}
         </div>`
    : f.type==="image"
      ? `<input type="hidden" id="d-${f.k}" value="${esc(f.value||"")}">
         <div class="imgpick" data-ip="${esc(f.k)}">
           <span class="imgprev" ${f.value?"":"hidden"}><img src="${esc(f.value||"")}" alt=""></span>
           <label class="filebtn">Choose an image<input type="file" accept="image/*"></label>
           <button type="button" class="btn sm" data-ipclear ${f.value?"":"hidden"}>Remove</button>
           <p class="imghint">A square one works best — it is cropped to a square and kept with the campaign.</p>
         </div>`
      : `<input id="d-${f.k}" value="${esc(f.value||"")}" placeholder="${esc(f.ph||"")}">`;
  const shows = (f, v) => f.showIf.notIn ? !f.showIf.notIn.includes(v) : v === f.showIf.equals;
  const hidden = f => f.showIf && !shows(f, fields.find(x=>x.k===f.showIf.field)?.value);
  $("#dlgBody").innerHTML = fields.map(f=>`
    <div class="fbox" id="w-${f.k}" style="background:var(--surface-4);margin-bottom:10px" ${hidden(f)?"hidden":""}>
      <label for="d-${f.k}">${esc(f.label)}</label>${ctl(f)}
    </div>`).join("");
  fields.filter(f=>f.showIf).forEach(f=>{
    const src=$("#d-"+f.showIf.field); if(!src) return;
    src.addEventListener("change",()=>{ const w=$("#w-"+f.k), was=w.hidden; w.hidden = !shows(f, src.value); if(was && !w.hidden && !f.showIf.notIn) $("#d-"+f.k).focus(); });
  });
  $("#dlgBody").querySelectorAll("[data-sw]").forEach(wrap=>{
    const hid = $("#d-"+wrap.dataset.sw);
    wrap.querySelectorAll("button[data-c]").forEach(b=>b.onclick=()=>{
      hid.value = b.dataset.c;
      wrap.querySelectorAll("button[data-c]").forEach(x=>x.classList.toggle("on", x===b));
    });
  });
  $("#dlgBody").querySelectorAll("[data-ip]").forEach(wrap=>{
    const hid = $("#d-"+wrap.dataset.ip);
    const prev = wrap.querySelector(".imgprev"), img = prev.querySelector("img");
    const clear = wrap.querySelector("[data-ipclear]");
    const show = v=>{ hid.value = v; img.src = v; prev.hidden = !v; clear.hidden = !v; };
    wrap.querySelector("input[type=file]").onchange = e=>{
      const f = e.target.files[0]; if(!f) return;
      iconFromFile(f, v=> v ? show(v) : toast("That image could not be read"));
    };
    clear.onclick = ()=>show("");
  });
  dlgSubmit = ()=>{
    const out={};
    fields.forEach(f=>{ const el=$("#d-"+f.k), off=$("#w-"+f.k)?.hidden; out[f.k] = off ? "" : (el?.value||"").trim(); });
    if(onSave(out) !== false) closeDialog();
  };
  $("#dlgScrim").classList.add("on");
  setTimeout(()=>$("#dlgBody").querySelector("input:not([type=hidden]):not([type=file]),textarea,select")?.focus(), 60);
}
function closeDialog(){ $("#dlgScrim").classList.remove("on"); dlgSubmit=null; }

/* ------------------------------------------------------------ mount + draw */
function mount(){
  if(HOST) return;
  HOST = document.createElement("div"); HOST.className="cx-host";
  R = HOST.attachShadow({mode:"open"});
  R.innerHTML = `<style>${CSS}</style><div class="cxroot" id="root">
    <section id="body"></section>
    <div class="mscrim" id="dlgScrim">
      <div class="modal sm" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
        <div class="mhead"><h3 id="dlgTitle"></h3><p id="dlgSub"></p></div>
        <div class="mbody form" id="dlgBody"></div>
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
function draw(){
  const c = SPACE; if(!c) return;
  const B = $("#body");
  B.innerHTML = CTAB==="details" ? detailsPane(c) : CTAB==="assign" ? assignPane(c) : CTAB==="dash" ? dashPane(c) : calendarPane(c);
  B.querySelectorAll("[data-ctab]").forEach(b=>b.onclick=()=>goTab(b.dataset.ctab));
  if(CTAB==="details"){ wireDetails(c); tickCountdown(); }
  else if(CTAB==="assign") wireAssign(c);
  else if(CTAB==="calendar") wireCalendar(c);
}
/* keep "X days to go" honest while the tab sits open overnight */
let CDTIMER = null;
function tickCountdown(){
  clearInterval(CDTIMER);
  CDTIMER = setInterval(()=>{
    const el = R && R.querySelector("#cdown");
    if(!el || !SPACE || !HOST.isConnected){ clearInterval(CDTIMER); return; }
    el.innerHTML = cdHTML(countdown(SPACE.details));
  }, 30000);
}

/* tell someone they own a thing: an email + a 🔔 (index.html → idea-mail "assign") */
function notifyOwner(c, it){
  if(!it.ownerId) return;
  it.notifiedAt = new Date().toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  if(OPT.notify) OPT.notify(c, it).then(r=>{
    if(r && r.sent) toast(`${it.owner} notified — email sent`);
    else if(r && r.belled) toast(`${it.owner} notified in the app (email didn't go: ${r.reason||"unknown"})`);
    else toast(`Saved — couldn't notify ${it.owner}${r&&r.reason?": "+r.reason:""}`);
  });
}

/* ============================================================ FILL IN DETAILS */
function heroHTML(c, ro){
  const d = c.details, t = findOpt(c,"type",d.type), ol = offerLine(c), dis = ro ? "disabled" : "";
  return `
    <div class="hero">
      <div class="hero-in">
        <button class="hero-emo ${d.icon?"hasimg":""}" id="heroEmo" title="${ro?"":"Change the icon"}" ${dis}>${
          d.icon ? `<img src="${esc(d.icon)}" alt="">` : esc(d.emoji||"📣")}</button>
        <div class="hero-txt">
          <input class="hero-name" data-f="name" value="${esc(d.name||c.name)}" placeholder="Campaign name" ${dis}>
          <input class="hero-tag" data-f="tagline" value="${esc(d.tagline||"")}" placeholder="${ro?"":"One line that sells it"}" ${dis}>
          <div class="hero-meta">
            ${ro && !d.code ? "" : `<span class="codewrap"><i>🎟</i><input class="codein" data-f="code"
              value="${esc(d.code||"")}" placeholder="OFFER CODE" spellcheck="false" ${dis}></span>`}
            ${t?`<span class="hmeta">${t.emo||""} ${esc(t.label)}</span>`:""}
            ${ol?`<span class="hmeta">${esc(ol)}</span>`:""}
            ${d.start?`<span class="hmeta">${dmy(d.start)}${d.end?` → ${dmy(d.end)}`:""}</span>`:""}
          </div>
        </div>
        <div class="hero-cd" id="cdown">${cdHTML(countdown(d))}</div>
      </div>
    </div>`;
}
/* one row of chips, each removable, with an add button */
function chipEditor(c, key, def){
  const d = c.details, opts = (c.opts[key]||[]), multi = !!def.multi;
  const sel = multi ? (d[key]||[]) : d[key];
  return `<div class="pick">
    ${opts.map(o=>{
      const on = multi ? sel.includes(o.k) : String(sel)===String(o.k);
      return `<span class="pkw ${on?"on":""}">
        <button class="pk" type="button" data-pick="${esc(key)}" data-val="${esc(o.k)}">
          ${o.emo?`<i>${esc(o.emo)}</i>`:""}${esc(o.label)}</button>
        <button class="pkx" type="button" data-rmopt="${esc(key)}" data-val="${esc(o.k)}" title="Remove this option">✕</button></span>`;}).join("")}
    <button class="pk add" type="button" data-addopt="${esc(key)}">＋ Add</button></div>`;
}
function offerEditor(c, ro){
  const d = c.details, o = findOpt(c,"offerType",d.offerType);
  return chipEditor(c,"offerType",FIELD_LIB.offerType) + (o
    ? `<div class="inline-in"><label for="f-offerValue">${esc(o.vlabel||"Value")}</label>
         <input id="f-offerValue" data-f="offerValue" value="${esc(d.offerValue||"")}" placeholder="${esc(o.ph||"")}" ${ro?"disabled":""}></div>` : "");
}
function durationEditor(c, ro){
  const d = c.details, dis = ro ? "disabled" : "";
  return `<div class="durrow">
    <label class="fsel"><span>Starts</span><input type="date" data-f="start" value="${esc(d.start||"")}" ${dis}></label>
    <label class="fsel"><span>Ends</span><input type="date" data-f="end" value="${esc(d.end||"")}" ${dis}></label>
    <label class="fsel"><span>Days</span><input class="daysin" data-f="days" inputmode="numeric" value="${esc(d.days||"")}" ${dis}></label>
    <div class="pick" style="margin-left:auto">
      ${DUR_PRESETS.map(n=>`<button class="pk solo ${String(d.days)===String(n)?"on":""}" type="button" data-dur="${n}">${n} days</button>`).join("")}
    </div></div>`;
}
function budgetEditor(c, ro){
  const d = c.details;
  return `<div class="durrow">
    <div class="pick">${BUDGETS.map(b=>`<button class="pk solo ${String(d.budget)===String(b)?"on":""}" type="button"
      data-pick="budget" data-val="${b}">${bLabel(b)}</button>`).join("")}</div>
    <label class="fsel" style="margin-left:auto"><span>Or type an amount</span>
      <input data-f="budget" inputmode="numeric" value="${esc(d.budget||"")}" placeholder="45000" ${ro?"disabled":""}></label></div>`;
}
/* one block on the form */
function fieldBlock(c, key, ro){
  const def = fieldDef(c, key), d = c.details, dis = ro ? "disabled" : "";
  const kind = def.kind || "line";
  const body =
      kind==="chips"    ? chipEditor(c,key,def)
    : kind==="offer"    ? offerEditor(c, ro)
    : kind==="duration" ? durationEditor(c, ro)
    : kind==="budget"   ? budgetEditor(c, ro)
    : kind==="text"     ? `<textarea data-f="${esc(key)}" placeholder="${ro?"":esc(def.ph||"…")}" ${dis}>${esc(d[key]||"")}</textarea>`
    :                     `<input data-f="${esc(key)}" value="${esc(d[key]||"")}" placeholder="${ro?"":esc(def.ph||"…")}" ${dis}>`;
  return `<div class="fblock ${def.wide?"wide":""}" style="--fc:${fieldColor(key)}" data-fkey="${esc(key)}">
    <div class="fblock-h"><span class="fdot">${esc(def.emo||"")}</span>
      <span class="flabel">${esc(def.label)}</span>
      <button class="fx" type="button" data-rmfield="${esc(key)}" title="Take this field off the form">✕</button></div>
    ${body}</div>`;
}
/* the library down the right-hand side */
function fieldNav(c){
  const used = new Set(c.fields);
  const avail = Object.entries(FIELD_LIB).filter(([k])=>!used.has(k));
  return `<aside class="fnav">
    <div class="fnav-h">Field library</div>
    <p class="fnav-p">Drag one onto the form, or just tap it.</p>
    <div class="fnav-list">
      ${avail.length ? avail.map(([k,v])=>`
        <button class="fnavi" type="button" data-fdrag="${esc(k)}" style="--fc:${fieldColor(k)}">
          <span class="e">${v.emo}</span><b>${esc(v.label)}</b><span class="grip">∷</span></button>`).join("")
      : `<p class="fnav-empty">Every built-in field is already on the form.</p>`}
    </div>
    <button class="fnav-add" type="button" id="addCustomField">＋ Custom field</button>
  </aside>`;
}
/* targets, one coloured box per department */
function targetSection(c, ro){
  return `
    <div class="sec-h secbig" style="margin-top:30px">
      <h3>🎯 Target</h3>
      <span class="hint">What each department is carrying</span>
      ${ro?"":`<button class="btn pri" id="addDept" style="margin-left:auto">＋ Add department</button>`}
    </div>
    ${c.targets.length ? `<div class="tgrid">
      ${c.targets.map((t,i)=>`
        <div class="tcard" style="--tc:${t.color || TCOLORS[i % TCOLORS.length]}">
          <button class="tx" type="button" data-rmdept="${i}" title="Remove">✕</button>
          <span class="tdept">${esc(t.dept)}</span>
          <div class="tval">${esc(t.target)}</div>
          ${t.note?`<p class="tnote">${esc(t.note)}</p>`:""}
          <button class="tedit" type="button" data-editdept="${i}">Edit</button>
        </div>`).join("")}
    </div>` : `<div class="empty bold">
      <h4>No targets set</h4>
      <p>${ro ? "Nobody has set a target for this campaign yet."
        : "Add a department and the number it is carrying — enrolments, installs, leads, whatever that team is on the hook for."}</p>
    </div>`}`;
}
/* the content pieces */
/* ---------- the content list: one tab per day, pieces grouped by type ---------- */
let DAYSEL = null;                 /* the day open in the strip: "YYYY-MM-DD", "none", or null = pick one */
const PLATFORM_GUESS = { longvideo:"YouTube", notification:"App", whatsapp:"WhatsApp", banner:"Website", alert:"Website",
                         story:"Instagram", reel:"Instagram", influencer:"Instagram", other:"Other" };
/* "Story" → "Stories", "Long video" → "Long videos", "Press release" → "Press releases" */
const plural = (w, n) => n===1 ? w : /[^aeiou]y$/i.test(w) ? w.slice(0,-1)+"ies" : /(s|x|ch|sh)$/i.test(w) ? w+"es" : w+"s";
/* the days on the strip: the campaign's duration, any day added by hand, and any day that already has a piece — in order */
function stripDays(c){
  const set = new Set();
  const d = c.details;
  if(d.start){
    const end = d.end && d.end >= d.start ? d.end : d.start;
    for(let x = d.start, n = 0; x <= end && n < 120; x = addDays(x,1), n++) set.add(x);
  }
  (c.extraDays||[]).forEach(x=>set.add(x));
  c.items.forEach(it=>{ if(it.date) set.add(it.date); });
  return [...set].sort();
}
/* a day added by hand that has nothing on it and sits outside the duration can be taken off again */
function dayRemovable(c, day){
  const d = c.details, inRange = d.start && day >= d.start && day <= (d.end && d.end>=d.start ? d.end : d.start);
  return (c.extraDays||[]).includes(day) && !inRange && !c.items.some(it=>it.date===day);
}
function pickDay(c){
  const days = stripDays(c), hasNone = c.items.some(it=>!it.date);
  if(DAYSEL==="none" && hasNone) return "none";
  if(DAYSEL && days.includes(DAYSEL)) return DAYSEL;
  return days.find(x=>c.items.some(it=>it.date===x)) || (days.includes(TODAY) ? TODAY : days[0]) || (hasNone ? "none" : null);
}
/* the group a piece sits in: its type, and for "Other" the name typed for it */
const groupKey = it => it.kind==="other" ? "other:" + (it.kindOther||"").trim().toLowerCase() : it.kind;
function itemCard(it, ro){
  const k = kindOf(it), who = ownerName(it);
  return `<article class="icard" style="--ic:${k.c}">
    <header class="icard-h">
      <span class="e">${k.emo}</span>
      <span class="t">${esc(kindName(it))}</span>
      <span class="d">${it.date?dmy(it.date):"no date"}</span>
    </header>
    <div class="icard-b">
      <h5>${esc(it.name)}</h5>
      ${it.details?`<p>${esc(it.details)}</p>`:""}
    </div>
    <footer class="icard-f">
      ${it.platform?`<span class="ichip">${esc(it.platform)}</span>`:""}
      ${who ? `<span class="who">${avatar(who)}${esc(who)}</span>` : `<span class="ichip none">nobody yet</span>`}
      ${ro ? "" : `<span class="iacts">
        <button class="ibtn" type="button" data-edititem="${esc(it.id)}">Edit</button>
        <button class="ibtn x" type="button" data-rmitem="${esc(it.id)}" title="Remove">✕</button>
      </span>`}
    </footer>
  </article>`;
}
function itemsSection(c, ro){
  const days = stripDays(c), sel = pickDay(c), undated = c.items.filter(it=>!it.date);
  const strip = days.length || undated.length || !ro ? `<div class="subnav daystrip">
      ${days.map(x=>{
        const n = c.items.filter(it=>it.date===x).length, dt = new Date(x+"T00:00:00");
        const out = c.details.start && (x < c.details.start || x > (c.details.end||c.details.start));
        return `<span class="dtab-w"><button class="snav dtab ${sel===x?"on":""} ${out?"out":""}" type="button" data-day="${x}" title="${esc(dt.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}))}${out?" — outside the campaign's dates":""}">
          <b>${dt.getDate()}</b><span>${dt.toLocaleDateString("en-GB",{month:"short"})}</span><span class="cnt">${n}</span></button>${
          !ro && dayRemovable(c,x) ? `<button class="dtab-x" type="button" data-rmday="${x}" title="Take this day off the strip">✕</button>` : ""}</span>`;
      }).join("")}
      ${undated.length ? `<button class="snav dtab ${sel==="none"?"on":""}" type="button" data-day="none"><b>—</b><span>No date</span><span class="cnt">${undated.length}</span></button>` : ""}
      ${ro ? "" : `<button class="dtab-add" type="button" id="addDay" title="Add another day">＋ Day</button>`}
    </div>` : "";
  let body;
  if(!sel){
    body = `<div class="empty bold"><h4>No days yet</h4>
      <p>${ro ? "No content pieces have been planned for this campaign yet."
        : "Set the campaign's duration above and its days appear here — or press <b>＋ Day</b>, then <b>Create content piece</b>."}</p></div>`;
  } else {
    const list = c.items.filter(it => sel==="none" ? !it.date : it.date===sel);
    if(!list.length){
      body = `<div class="empty bold"><h4>Nothing on ${sel==="none"?"this tab":esc(new Date(sel+"T00:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}))} yet</h4>
        <p>${ro ? "Nothing goes out on this day." : "Press <b>Create content piece</b> to add everything that goes out on this day in one go."}</p></div>`;
    } else {
      /* groups in the order of the type list, "Other" groups after, by their typed name */
      const groups = [];
      list.forEach(it=>{ const g = groupKey(it); let G = groups.find(x=>x.key===g);
        if(!G){ G = { key:g, kind:it.kind, other:it.kind==="other" ? (it.kindOther||"").trim() : "", items:[] }; groups.push(G); }
        G.items.push(it); });
      const order = Object.keys(ITEM_KINDS);
      groups.sort((a,b)=> order.indexOf(a.kind)-order.indexOf(b.kind) || a.other.localeCompare(b.other));
      body = groups.map(G=>{
        const k = ITEM_KINDS[G.kind] || ITEM_KINDS.other, name = G.kind==="other" ? (G.other || "Other") : k.label;
        const its = [...G.items].sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true}));
        return `<section class="cgroup" style="--ic:${k.c}">
          <div class="cgroup-h">
            <span class="cg-ic">${k.emo}</span><h4>${esc(plural(name, its.length))}</h4><span class="cnt">${its.length}</span>
            ${ro ? "" : `<button class="btn sm cg-add" type="button" data-addone="${esc(G.kind)}" data-other="${esc(G.other)}">＋ Add one</button>`}
          </div>
          <div class="igrid">${its.map(it=>itemCard(it, ro)).join("")}</div>
        </section>`;
      }).join("");
    }
  }
  return `
    <div class="sec-h secbig" style="margin-top:30px">
      ${ro ? `<h3>${esc(c.contentsLabel)}</h3>`
           : `<input class="renameable" id="clabel" value="${esc(c.contentsLabel)}" title="Click to rename this section">`}
      <span class="hint">${c.items.length} piece${c.items.length===1?"":"s"} across ${new Set(c.items.map(i=>i.date||"none")).size} day${new Set(c.items.map(i=>i.date||"none")).size===1?"":"s"}</span>
      ${ro ? "" : `<button class="btn pri" id="bulkCreate" style="margin-left:auto">＋ Create content piece</button>`}
    </div>
    ${strip}
    <div class="daybody">${body}</div>`;
}
function detailsPane(c){
  const ro = !canEdit();
  return `<div class="${ro?"ro":""}">
    ${!ro ? "" : canPlan() ? `<div class="bar2"><span class="ic2">MANAGER</span><p><b>Only admins change the details.</b> You can assign pieces in <b>Assignment</b> and move them between days on the <b>Calendar</b>.</p></div>` : memberBar()}
    ${heroHTML(c, ro)}
    <div class="sec-h secbig">
      <h3>📝 Campaign details</h3>
      <span class="hint">${ro?"Set by the campaign's admins":"Tap to pick · drag a field in from the right"}</span>
    </div>
    <div class="detwrap">
      <div class="fgridwrap" data-fdrop="1">
        ${c.fields.length
          ? `<div class="fgrid2">${c.fields.map(k=>fieldBlock(c,k,ro)).join("")}</div>`
          : `<div class="empty bold"><h4>No fields on the form</h4>
             <p>${ro?"Nothing filled in yet.":"Drag one across from the field library, or add your own."}</p></div>`}
      </div>
      ${ro ? "" : fieldNav(c)}
    </div>
    ${targetSection(c, ro)}
    ${itemsSection(c, ro)}
    ${!ro && OPT.canDelete && OPT.canDelete() ? `<div class="row" style="margin-top:30px;padding-top:18px;border-top:1.5px solid var(--line-2)">
      <span class="hint">Finished with this campaign, or made it by mistake?</span>
      <button class="btn danger sm" id="delCampaign" style="margin-left:auto">Delete this campaign</button>
    </div>` : ""}
  </div>`;
}

function wireDetails(c){
  const W = $("#body");
  /* the day strip works for everyone */
  W.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{ DAYSEL = b.dataset.day; draw(); });
  if(!canEdit()) return;
  const d = c.details;

  /* plain inputs */
  W.querySelectorAll("[data-f]").forEach(el=>{
    const k = el.dataset.f;
    const dateish = k==="start" || k==="end" || k==="days";
    el.addEventListener("input", ()=>{
      d[k] = el.value;
      if(k === "name"){ c.name = el.value || c.name; }
      if((k==="name" || k==="tagline") && OPT.onHeader) OPT.onHeader(c);
      saveQuiet();
    });
    if(dateish || k==="offerValue" || k==="name") el.addEventListener("change", ()=>{
      d[k] = el.value;
      if(dateish){
        if(k==="days" && !d.start) d.start = isoD(new Date());
        syncDuration(d, k);
      }
      save();
    });
  });

  /* picking a chip */
  W.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{
    const f = b.dataset.pick, v = b.dataset.val;
    const def = fieldDef(c,f);
    if(def.multi){
      const arr = d[f] = d[f] || [];
      const i = arr.indexOf(v); i<0 ? arr.push(v) : arr.splice(i,1);
    } else {
      d[f] = d[f] === v ? "" : v;                  /* tap again to clear */
      if(f==="type" && d.type){ const t = findOpt(c,"type",d.type); if(t && t.emo) d.emoji = t.emo; }
      if(f==="offerType") d.offerValue = "";
    }
    save();
  });

  /* adding and removing the options behind a chip field */
  W.querySelectorAll("[data-addopt]").forEach(b=>b.onclick=()=>{
    const f = b.dataset.addopt;
    openDialog({
      title:`Add to ${fieldDef(c,f).label.toLowerCase()}`,
      sub:"It becomes a button on this campaign.",
      fields:[
        { k:"label", label:"What is it called?", ph:SUGGEST[f]||"" },
        { k:"emo",   label:"An emoji for it (optional)", ph:"🌟" }
      ],
      onSave:(v)=>{
        if(!v.label){ toast("Give it a name"); return false; }
        const list = c.opts[f] || (c.opts[f] = []);
        if(list.some(o=>o.label.toLowerCase()===v.label.toLowerCase())){ toast("That one already exists"); return false; }
        const o = { k:slug(v.label) + "_" + list.length, label:v.label, emo:[...(v.emo||"")][0] || "" };
        if(f==="offerType"){ o.vlabel = "Value"; o.ph = ""; }
        list.push(o); save(); toast(`"${v.label}" added`);
      }
    });
  });
  W.querySelectorAll("[data-rmopt]").forEach(b=>b.onclick=()=>{
    const f = b.dataset.rmopt, v = b.dataset.val;
    c.opts[f] = (c.opts[f]||[]).filter(o=>o.k!==v);
    if(Array.isArray(d[f])) d[f] = d[f].filter(x=>x!==v);
    else if(d[f]===v) d[f] = "";
    save();
  });

  /* duration presets */
  W.querySelectorAll("[data-dur]").forEach(b=>b.onclick=()=>{
    if(!d.start) d.start = isoD(new Date());
    d.days = b.dataset.dur;
    syncDuration(d, "days");
    save();
    toast(`${d.days} days — ends ${dmy(d.end)}`);
  });

  /* the field library: drag one over, or tap it */
  const addField = key=>{
    if(c.fields.includes(key)) return;
    c.fields.push(key); save();
    toast(`${fieldDef(c,key).label} added`);
  };
  W.querySelectorAll("[data-fdrag]").forEach(el=>{
    pointerDrag(el, {
      zone:"[data-fdrop]",
      onTap:()=>addField(el.dataset.fdrag),
      onDrop:()=>addField(el.dataset.fdrag),
      onMiss:()=>toast("Drop it on the form to add it")
    });
  });
  W.querySelectorAll("[data-rmfield]").forEach(b=>b.onclick=()=>{
    const key = b.dataset.rmfield;
    c.fields = c.fields.filter(k=>k!==key);
    save();
    toast(FIELD_LIB[key] ? `${FIELD_LIB[key].label} moved back to the library` : "Field removed");
  });
  const acf = $("#addCustomField");
  if(acf) acf.onclick = ()=>openDialog({
    title:"Add your own field", sub:"It becomes a box on this campaign only.",
    fields:[
      { k:"label", label:"What is it called?", ph:"Approver, landing page, hashtag…" },
      { k:"wide",  label:"How much room does it need", type:"select", value:"no", opts:[["no","One line"],["yes","A paragraph"]] }
    ],
    onSave:(v)=>{
      if(!v.label){ toast("Name the field"); return false; }
      const key = "x" + Date.now();
      c.custom[key] = { label:v.label, kind:v.wide==="yes"?"text":"line", wide:v.wide==="yes", emo:"✎" };
      c.details[key] = "";
      c.fields.push(key); save(); toast(`"${v.label}" added`);
    }
  });

  /* targets */
  const deptDialog = (idx)=>{
    const t = idx==null ? { dept:"", target:"", note:"" } : c.targets[idx];
    openDialog({
      title: idx==null ? "Add a department target" : "Edit target",
      sub:"Who is carrying it, and how much.",
      okLabel: idx==null ? "Add target" : "Save",
      fields:[
        { k:"dept",   label:"Department", ph:"Social media, Sales, App…", value:t.dept },
        { k:"target", label:"Target",     ph:"500 enrolments", value:t.target },
        { k:"color",  label:"Box colour", type:"swatch", value:t.color||"" },
        { k:"note",   label:"Note (optional)", type:"area", ph:"How it is counted, or by when.", value:t.note }
      ],
      onSave:(v)=>{
        if(!v.dept){ toast("Name the department"); return false; }
        if(!v.target){ toast("Give it a target"); return false; }
        if(idx==null) c.targets.push(v); else c.targets[idx] = Object.assign(c.targets[idx], v);
        save(); toast(idx==null ? `${v.dept} target added` : "Saved");
      }
    });
  };
  const ad = $("#addDept"); if(ad) ad.onclick = ()=>deptDialog(null);
  W.querySelectorAll("[data-editdept]").forEach(b=>b.onclick=()=>deptDialog(Number(b.dataset.editdept)));
  W.querySelectorAll("[data-rmdept]").forEach(b=>b.onclick=()=>{
    const i = Number(b.dataset.rmdept), gone = c.targets[i];
    c.targets.splice(i,1); save();
    toastUndo(`${gone.dept} target removed`, ()=>{ c.targets.splice(i,0,gone); save(); });
  });

  /* the hero icon */
  const he = $("#heroEmo");
  if(he) he.onclick = ()=>openDialog({
    title:"Campaign icon", sub:"An emoji or your own image. It sits at the top of the campaign.",
    fields:[
      { k:"emoji", label:`Type one, or copy from: ${EMOJIS.join(" ")}`, value:d.emoji||"📣" },
      { k:"icon",  label:"Or upload an image", type:"image", value:d.icon||"" }
    ],
    onSave:(v)=>{
      d.icon  = v.icon || "";                       /* an image wins; remove it and the emoji returns */
      d.emoji = [...(v.emoji||"📣").trim()][0] || "📣";
      save();
    }
  });

  /* content pieces */
  const cl = $("#clabel"); if(cl) cl.oninput = ()=>{ c.contentsLabel = cl.value; saveQuiet(); };
  const bc = $("#bulkCreate"); if(bc) bc.onclick = ()=>bulkDialog(c);
  W.querySelectorAll("[data-addone]").forEach(b=>b.onclick=()=>{
    const day = pickDay(c);
    itemDialog(c, null, { kind:b.dataset.addone, kindOther:b.dataset.other||"", date: day && day!=="none" ? day : "" });
  });
  const adDay = $("#addDay"); if(adDay) adDay.onclick = ()=>openDialog({
    title:"Add a day", sub:"Any date — it slots into the strip in date order, even before the campaign starts.",
    okLabel:"Add day",
    fields:[{ k:"day", label:"Which day", type:"date", value:"" }],
    onSave:(v)=>{
      if(!v.day){ toast("Pick a date"); return false; }
      c.extraDays = c.extraDays || [];
      if(!stripDays(c).includes(v.day)) c.extraDays.push(v.day);
      DAYSEL = v.day; save(); toast(`${dmy(v.day)} added`);
    }
  });
  W.querySelectorAll("[data-rmday]").forEach(b=>b.onclick=()=>{
    const x = b.dataset.rmday;
    c.extraDays = (c.extraDays||[]).filter(y=>y!==x);
    if(DAYSEL===x) DAYSEL = null;
    save(); toast(`${dmy(x)} taken off`);
  });
  W.querySelectorAll("[data-edititem]").forEach(b=>b.onclick=()=>itemDialog(c, c.items.findIndex(x=>x.id===b.dataset.edititem)));
  W.querySelectorAll("[data-rmitem]").forEach(b=>b.onclick=()=>{
    const i = c.items.findIndex(x=>x.id===b.dataset.rmitem); if(i<0) return;
    const gone = c.items[i];
    c.items.splice(i,1); save();
    toastUndo(`"${gone.name}" removed`, ()=>{ c.items.splice(i,0,gone); save(); });
  });

  const dc = $("#delCampaign"); if(dc) dc.onclick = ()=>openDialog({
    title:`Delete "${c.name}"?`,
    sub:`This removes the campaign and all ${c.items.length} item${c.items.length===1?"":"s"} in it. It cannot be undone.`,
    okLabel:"Delete campaign",
    fields:[{ k:"confirm", label:"Type the word delete to confirm", ph:"delete" }],
    onSave:(v)=>{
      if(v.confirm.toLowerCase() !== "delete"){ toast("Type delete to confirm"); return false; }
      if(OPT.remove) OPT.remove(c);
    }
  });
}

/* ---------- "Create content piece": many pieces for one day in one go ---------- */
function bulkDialog(c){
  if(!canEdit()) return;
  const sel = pickDay(c);
  const day0 = sel && sel!=="none" ? sel : (c.details.start || TODAY);
  const kindOpts = Object.entries(ITEM_KINDS).map(([k,v])=>`<option value="${k}">${v.emo} ${esc(v.label)}</option>`).join("");
  const rowHTML = () => `<div class="brow">
      <select class="bkind">${kindOpts}</select>
      <input class="bqty" type="number" min="1" max="50" value="1" inputmode="numeric" title="How many">
      <button class="bx" type="button" title="Remove this row">✕</button>
      <input class="bother" placeholder="What is it? e.g. YT Community Post, Press release" hidden>
    </div>`;
  $("#dlgTitle").textContent = "Create content pieces";
  $("#dlgSub").textContent = "Pick the day, then how many of each type go out on it. Each piece gets a card you can fill in afterwards.";
  $("#dlgSub").hidden = false;
  $("#dlgOk").textContent = "Add them";
  $("#dlgBody").innerHTML = `
    <div class="fbox" style="background:var(--surface-4);margin-bottom:12px">
      <label for="b-day">Which day these go out on</label><input id="b-day" type="date" value="${esc(day0)}">
    </div>
    <div class="bhead"><span>Content type</span><span>How many</span><span></span></div>
    <div id="brows">${rowHTML()}</div>
    <button class="addfield" type="button" id="baddrow" style="min-height:0;margin-top:8px">＋ Add another type</button>`;
  const rows = $("#brows");
  const wireRow = r=>{
    const k = r.querySelector(".bkind"), o = r.querySelector(".bother");
    k.onchange = ()=>{ o.hidden = k.value!=="other"; if(!o.hidden) o.focus(); };
    r.querySelector(".bx").onclick = ()=>{ if(rows.children.length>1) r.remove(); else { k.value="reel"; o.hidden=true; r.querySelector(".bqty").value=1; } };
  };
  rows.querySelectorAll(".brow").forEach(wireRow);
  $("#baddrow").onclick = ()=>{
    rows.insertAdjacentHTML("beforeend", rowHTML());
    const r = rows.lastElementChild;
    /* start the new row on a type not picked yet */
    const used = [...rows.querySelectorAll(".bkind")].map(x=>x.value);
    const next = Object.keys(ITEM_KINDS).find(k=>k!=="other" && !used.includes(k));
    if(next) r.querySelector(".bkind").value = next;
    wireRow(r); r.querySelector(".bkind").focus();
  };
  dlgSubmit = ()=>{
    const day = $("#b-day").value;
    if(!day){ toast("Pick the day"); return; }
    const want = [];
    for(const r of rows.querySelectorAll(".brow")){
      const kind = r.querySelector(".bkind").value;
      const n = Math.max(0, Math.min(50, parseInt(r.querySelector(".bqty").value,10) || 0));
      const other = r.querySelector(".bother").value.trim();
      if(!n) continue;
      if(kind==="other" && !other){ toast("Say what the “Other” pieces are"); r.querySelector(".bother").focus(); return; }
      want.push({ kind, n, other });
    }
    if(!want.length){ toast("Add at least one piece"); return; }
    let made = 0;
    want.forEach(w=>{
      const base = w.kind==="other" ? w.other : ITEM_KINDS[w.kind].label;
      /* carry on from the highest number already used for this type on this day, so names never repeat */
      const re = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + " (\\d+)$", "i");
      let top = 0;
      c.items.forEach(it=>{ if(it.date===day && groupKey(it)===(w.kind==="other" ? "other:"+w.other.toLowerCase() : w.kind)){
        const m = re.exec(it.name||""); top = Math.max(top, m ? Number(m[1]) : 0); } });
      top = Math.max(top, c.items.filter(it=>it.date===day && groupKey(it)===(w.kind==="other" ? "other:"+w.other.toLowerCase() : w.kind) && !re.test(it.name||"")).length);
      for(let i=1;i<=w.n;i++){
        c.items.push({ id:uid("ci"), name:`${base} ${top+i}`, kind:w.kind, kindOther:w.kind==="other" ? w.other : "",
          date:day, platform:PLATFORM_GUESS[w.kind]||"Other", ownerId:"", owner:"", details:"" });
        made++;
      }
    });
    if(!stripDays(c).includes(day)) (c.extraDays = c.extraDays || []).push(day);
    DAYSEL = day;
    closeDialog(); save();
    toast(`${made} piece${made===1?"":"s"} added to ${dmy(day)}`);
  };
  $("#dlgScrim").classList.add("on");
  setTimeout(()=>rows.querySelector(".bkind").focus(), 60);
}

/* ---------- the item dialog ---------- */
function itemDialog(c, idx, pre){
  if(!canEdit()) return;
  const isNew = idx==null || idx<0;
  pre = typeof pre==="string" ? { kind:pre } : (pre || {});
  const preKind = pre.kind;
  const guess = { longvideo:"YouTube", notification:"App", whatsapp:"WhatsApp", banner:"Website", alert:"Website",
                  story:"Instagram", reel:"Instagram", influencer:"Instagram" };
  const it = isNew
    ? { name:"", kind:preKind||"reel", kindOther:pre.kindOther||"", date: pre.date!=null ? pre.date : (c.details.start||""), platform:guess[preKind||"reel"]||(preKind==="other"?"Other":"Instagram"), ownerId:"", details:"" }
    : c.items[idx];
  const ppl = people();
  openDialog({
    title: isNew ? `Add a ${kindOf(it).label.toLowerCase()}` : "Edit item",
    sub:"Anything that goes out as part of this campaign.",
    fields:[
      { k:"name", label:"Name of the item", ph:"Launch reel", value:it.name },
      { k:"kind", label:"Type", type:"select", value:it.kind, opts:Object.entries(ITEM_KINDS).map(([k,v])=>[k,v.emo+" "+v.label]) },
      { k:"kindOther", label:"If other, what is it?", ph:"Podcast clip, press release…", value:it.kindOther, showIf:{ field:"kind", equals:"other" } },
      { k:"date", label:"Day", type:"date", value:it.date },
      { k:"platform", label:"Platform / Category", type:"select", value:it.platform, opts:PLATFORMS.map(p=>[p,p]) },
      { k:"ownerId", label:"Accountable person", type:"select", value:it.ownerId||"",
        opts:[["","— nobody yet —"]].concat(ppl.map(p=>[p.id, p.name + (p.role?" · "+p.role:"")])) },
      { k:"details", label:"More details", type:"area", value:it.details, ph:"The hook, where it links to — anything the person making it needs." },
      { k:"actionLabel", label:"Action — what the button says (YouTube and Instagram pieces always send to Content Process)",
        ph:(ACTIONS[it.kind]||{}).label || "Open Canva", value:it.actionLabel||"", showIf:{ field:"platform", notIn:PROCESS_PLATFORMS } },
      { k:"actionUrl", label:"URL — where the button takes them", ph:"https://…", value:it.actionUrl||"", showIf:{ field:"platform", notIn:PROCESS_PLATFORMS } }
    ],
    onSave:(v)=>{
      if(!v.name){ toast("The item needs a name"); return false; }
      if(v.actionUrl && !safeUrl(v.actionUrl)){ toast("The URL has to be a web link (https://…)"); return false; }
      if(v.actionUrl) v.actionUrl = safeUrl(v.actionUrl);
      if(v.actionLabel && !v.actionUrl && !PROCESS_PLATFORMS.includes(v.platform)){ toast("Add the URL the button opens"); return false; }
      const before = isNew ? "" : (it.ownerId||"");
      let target;
      if(isNew){ target = Object.assign({ id:uid("ci") }, v); c.items.push(target); }
      else target = Object.assign(c.items[idx], v);
      const p = ppl.find(x=>x.id===v.ownerId); target.owner = p ? p.name : "";
      if(v.ownerId && v.ownerId!==before) notifyOwner(c, target);
      DAYSEL = target.date || "none";
      save();
      toast(isNew ? `"${v.name}" added` : "Saved");
    }
  });
}

/* ============================================================ ASSIGNMENT */
function assignPane(c){
  if(!c.items.length) return `<div class="empty">
    <h4>Nothing to hand out yet</h4>
    <p>Add items under Fill in Details, then share them out here by platform.</p>
    <button class="btn pri" data-ctab="details">Go to Fill in Details</button></div>`;
  const ro = !canPlan();
  const plats = [...new Set(c.items.map(i=>i.platform).filter(Boolean))];
  if(ASSIGNFILTER!=="All" && !plats.includes(ASSIGNFILTER)) ASSIGNFILTER="All";
  const rows = ASSIGNFILTER==="All" ? c.items : c.items.filter(i=>i.platform===ASSIGNFILTER);
  const unassigned = c.items.filter(i=>!ownerName(i)).length;
  return `${ro ? memberBar() : ""}
    <div class="bar2" ${ro?"hidden":""}>
      <span class="ic2">HAND-OFF</span>
      <p><b>Give every item a name, then press its action.</b> Whoever you put in Accountable gets an email and a 🔔 the moment
      you save. Reels and videos go straight to the Content Process board as high priority; the rest open the tool that
      actually sends them.${unassigned?` <b style="color:var(--crit)">${unassigned} item${unassigned>1?"s have":" has"} nobody on it.</b>`:""}</p>
    </div>
    <div class="subnav">
      <button class="snav ${ASSIGNFILTER==="All"?"on":""}" data-plat="All">All <span class="cnt">${c.items.length}</span></button>
      ${plats.map(p=>`<button class="snav ${ASSIGNFILTER===p?"on":""}" data-plat="${esc(p)}">${esc(p)}
        <span class="cnt">${c.items.filter(i=>i.platform===p).length}</span></button>`).join("")}
    </div>
    <div class="tw"><table style="min-width:1020px">
      <thead><tr><th>Item</th><th>Type</th><th>Platform / Category</th><th>Date</th><th>Accountable</th><th>Action</th></tr></thead>
      <tbody>${sortItems(rows).map(it=>{
        const k = kindOf(it), a = actionFor(it), who = ownerName(it);
        const done = it.sentCardId && OPT.cardExists && OPT.cardExists(c, it.sentCardId);
        return `<tr>
          <td class="td-idea" style="border-left:3px solid ${k.c}">${esc(it.name)}
            ${done?`<div style="margin-top:5px"><span class="badge good">🔔 in Content Process</span></div>`:""}</td>
          <td><span class="tag" style="background:color-mix(in srgb,${k.c} 15%,transparent);color:${k.c}">${esc(kindName(it).toLowerCase())}</span></td>
          <td>${it.platform?`<span class="chip">${esc(it.platform)}</span>`:"—"}</td>
          <td class="vol" style="white-space:nowrap">${it.date?dmy(it.date):`<span class="miss">not set</span>`}</td>
          <td style="min-width:186px">
            ${who
              ? `<div class="who">${avatar(who)}${esc(who)}</div>
                 <div class="hint" style="margin-top:3px;font-size:11px">${it.notifiedAt?`✉ notified ${esc(/T/.test(it.notifiedAt)?new Date(it.notifiedAt).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):it.notifiedAt)}`:`not notified yet`}</div>`
              : `<span class="miss">nobody</span>`}
            ${ro?"":`<button class="btn sm" data-assign="${esc(it.id)}" style="margin-top:6px">${who?"Reassign":"Assign"}</button>`}
          </td>
          <td style="min-width:200px">
            ${a.mode==="process"
              ? (done
                ? `<button class="btn sm" data-goprocess="1">View on the board →</button>`
                : ro ? `<span class="hint">not sent yet</span>` : `<button class="btn sm pri" data-act="${esc(it.id)}">🔔 ${esc(a.label)}</button>`)
              : a.mode==="link"
                ? ro ? `<span class="hint">${esc(a.label.replace(/^Open /,""))}</span>` : `<a class="btn sm go" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.label)} ↗</a>`
                : `<span class="hint">nothing to send</span>`}
          </td></tr>`;
      }).join("")}</tbody>
    </table></div>
    <p class="hint" style="margin:11px 0 0">Every YouTube and Instagram piece lands on the Content Process board${OPT.socialName?` of <b>${esc(OPT.socialName(c)||"Social Media")}</b>`:""}.
    Anything else opens its own button if one is set on the piece (Edit → Action + URL); otherwise banners and alerts open Strapi, WhatsApp opens MSG91, and notifications open Firebase.</p>`;
}
function wireAssign(c){
  const B = $("#body");
  B.querySelectorAll("[data-plat]").forEach(b=>b.onclick=()=>{ ASSIGNFILTER=b.dataset.plat; draw(); });
  B.querySelectorAll("[data-goprocess]").forEach(b=>b.onclick=()=>{ if(OPT.goProcess) OPT.goProcess(c); });
  if(!canPlan()) return;
  B.querySelectorAll("[data-assign]").forEach(b=>b.onclick=()=>{
    const it = c.items.find(x=>x.id===b.dataset.assign); if(!it) return;
    const ppl = people();
    openDialog({
      title:`Who is accountable for "${it.name}"?`,
      sub:"They get an email and a 🔔 as soon as you save, with the item, the date and the details.",
      okLabel:"Save and notify",
      fields:[{ k:"ownerId", label:"Accountable person", type:"select", value:it.ownerId||"",
        opts:[["","— choose —"]].concat(ppl.map(p=>[p.id, p.name + (p.role?" · "+p.role:"")])) }],
      onSave:(v)=>{
        if(!v.ownerId){ toast("Pick someone"); return false; }
        const p = ppl.find(x=>x.id===v.ownerId);
        it.ownerId = v.ownerId; it.owner = p ? p.name : "";
        notifyOwner(c, it); save();
      }
    });
  });
  B.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{
    const it = c.items.find(x=>x.id===b.dataset.act); if(!it) return;
    if(!ownerName(it)){ toast("Give it an accountable person first"); return; }
    if(!OPT.sendToProcess){ toast("No Social Media space to send it to"); return; }
    const r = OPT.sendToProcess(c, it);
    if(r && r.error){ toast(r.error); return; }
    it.sentCardId = r.cardId; save();
    toast(`"${it.name}" sent to Content Process → To Do, marked high priority`);
  });
}

/* ============================================================ DASHBOARD */
/* a plain horizontal bar list — long labels, small counts */
function hbars(rows, total){
  const max = Math.max(...rows.map(r=>r.v), 1);
  return `<div class="hb">${rows.map(r=>`
    <div class="hbrow">
      <span class="hbl">${r.emo?`<i class="hbe">${r.emo}</i>`:""}${esc(r.label)}</span>
      <span class="hbt"><i style="width:${(r.v/max*100).toFixed(1)}%;background:${r.c||"var(--accent)"}"></i></span>
      <span class="hbv">${r.v}${total?`<small>${Math.round(r.v/total*100)}%</small>`:""}</span>
    </div>`).join("")}</div>`;
}
function campDates(list){ return [...new Set(list.filter(i=>i.date).map(i=>i.date))].sort(); }
function dashPane(c){
  if(!c.items.length) return `<div class="empty">
    <h4>Nothing to summarise yet</h4>
    <p>Add items under Fill in Details and this page fills itself in.</p>
    <button class="btn pri" data-ctab="details">Go to Fill in Details</button></div>`;
  const n = c.items.length;
  const ds = campDates(c.items);
  const byKind = Object.entries(ITEM_KINDS)
    .map(([k,v])=>({ label:v.label, emo:v.emo, c:v.c, v:c.items.filter(i=>i.kind===k).length }))
    .filter(r=>r.v).sort((a,b)=>b.v-a.v);
  const plats = [...new Set(c.items.map(i=>i.platform).filter(Boolean))];
  const byPlat = plats.map((p,i)=>({ label:p, v:c.items.filter(x=>x.platform===p).length,
    c:["var(--accent)","var(--saffron)","var(--c2)","var(--c3)","var(--c4)","var(--good)"][i%6] })).sort((a,b)=>b.v-a.v);
  const owners = [...new Set(c.items.map(ownerName).filter(Boolean))];
  const byOwner = owners.map(o=>({ label:o, v:c.items.filter(x=>ownerName(x)===o).length, c:`hsl(${hue(o)} 52% 46%)` })).sort((a,b)=>b.v-a.v);
  const unassigned = c.items.filter(i=>!ownerName(i)).length;
  return `${canPlan() ? "" : memberBar()}
    <div class="bigtile">
      <span class="lbl">Total content pieces</span>
      <div class="n">${n}</div>
      <div class="s">across ${ds.length} day${ds.length===1?"":"s"}</div>
    </div>
    <div class="dashgrid">
      <div class="panel"><div class="panel-h"><h3>By content type</h3>
        <span class="hint">${byKind.length} type${byKind.length===1?"":"s"}</span></div>
        ${hbars(byKind, n)}</div>
      <div class="panel"><div class="panel-h"><h3>By platform</h3>
        <span class="hint">${plats.length} platform${plats.length===1?"":"s"}</span></div>
        ${byPlat.length ? hbars(byPlat, n) : `<p class="hint" style="margin:0">No platforms set yet.</p>`}</div>
      <div class="panel wide"><div class="panel-h"><h3>By assignee</h3>
        <span class="hint">${owners.length} ${owners.length===1?"person":"people"}</span></div>
        ${byOwner.length ? hbars(byOwner, n) : `<p class="hint" style="margin:0">Nobody assigned yet.</p>`}
        ${unassigned?`<p class="redline">${unassigned} item${unassigned>1?"s have":" has"} nobody assigned.</p>`:""}</div>
    </div>`;
}

/* ============================================================ CALENDAR */
function weekOf(d){ const x=new Date(d+"T00:00:00"), off=(x.getDay()+6)%7;
  const s=new Date(x); s.setDate(x.getDate()-off); const e=new Date(s); e.setDate(s.getDate()+6);
  return [isoD(s), isoD(e)]; }
function passFilter(it){
  const F = CALFILTER;
  if(F.type !== "all" && it.kind !== F.type) return false;
  if(F.platform !== "all" && it.platform !== F.platform) return false;
  if(F.owner !== "all" && ownerName(it) !== F.owner) return false;
  if(F.range !== "all"){
    if(!it.date) return false;
    const a = F.anchor || TODAY;
    if(F.range === "day")   return it.date === a;
    if(F.range === "week"){ const [s,e] = weekOf(a); return it.date >= s && it.date <= e; }
    if(F.range === "month") return it.date.slice(0,7) === a.slice(0,7);
  }
  return true;
}
const filtered = c => c.items.filter(passFilter);
const filterOn = () => CALFILTER.range!=="all" || CALFILTER.type!=="all" || CALFILTER.platform!=="all" || CALFILTER.owner!=="all";

function calendarPane(c){
  if(!c.items.length) return `<div class="empty">
    <h4>Nothing to show yet</h4>
    <p>Add items under Fill in Details and they appear here, arranged by date and coloured by type.</p>
    <button class="btn pri" data-ctab="details">Go to Fill in Details</button></div>`;
  const shown = filtered(c);
  const dated = shown.filter(i=>i.date), undated = shown.filter(i=>!i.date);
  const kinds = [...new Set(c.items.map(i=>i.kind))];
  const plats = [...new Set(c.items.map(i=>i.platform).filter(Boolean))];
  const owners = [...new Set(c.items.map(ownerName).filter(Boolean))];
  const sel = (id,label,value,opts) => `<label class="fsel"><span>${label}</span>
    <select data-cf="${id}">${opts.map(([v,t])=>`<option value="${esc(v)}" ${value===v?"selected":""}>${esc(t)}</option>`).join("")}</select></label>`;
  return `${canPlan() ? "" : memberBar()}
    <div class="calbar">
      <div class="seg">
        <button data-cv="grid" class="${CALVIEW==="grid"?"on":""}">Grid</button>
        <button data-cv="list" class="${CALVIEW==="list"?"on":""}">List</button>
      </div>
      <span class="hint">${dated.length} dated${undated.length?` · ${undated.length} with no date`:""}${filterOn()?` <b style="color:var(--accent)">of ${c.items.length}</b>`:""}</span>
      <button class="btn pri" id="genFlow" style="margin-left:auto">${CALVIEW==="flow"?"← Back to calendar":"⚡ Generate flowchart"}</button>
    </div>
    <div class="filterbar">
      ${sel("range","Show", CALFILTER.range, [["all","All dates"],["day","A single day"],["week","A week"],["month","A month"]])}
      ${CALFILTER.range!=="all" ? `<label class="fsel"><span>${CALFILTER.range==="day"?"Which day":CALFILTER.range==="week"?"Week containing":"Month containing"}</span>
        <input type="date" data-cf="anchor" value="${esc(CALFILTER.anchor||TODAY)}"></label>` : ""}
      ${sel("type","Content type", CALFILTER.type, [["all","All types"], ...kinds.map(k=>[k, (ITEM_KINDS[k]||{}).label || k])])}
      ${sel("platform","Platform / Category", CALFILTER.platform, [["all","All platforms"], ...plats.map(p=>[p,p])])}
      ${sel("owner","Accountable person", CALFILTER.owner, [["all","Everyone"], ...owners.map(o=>[o,o])])}
      ${filterOn()?`<button class="btn sm" id="clearFilter">Clear filters</button>`:""}
    </div>
    ${shown.length
      ? (CALVIEW==="flow" ? flowView(c, shown) : CALVIEW==="list" ? listView(c, shown) : gridView(c, shown))
      : `<div class="empty"><h4>Nothing matches these filters</h4>
          <p>Loosen one of them, or clear them all.</p>
          <button class="btn" id="clearFilter2">Clear filters</button></div>`}
    <div class="legend" style="margin-top:16px">
      ${Object.entries(ITEM_KINDS).filter(([k])=>shown.some(i=>i.kind===k)).map(([,v])=>`<span><i style="background:${v.c}"></i>${esc(v.label)}</span>`).join("")}
    </div>`;
}
function monthShown(c, shown){
  if(CALMONTH) return CALMONTH;
  const ds = campDates(shown.length ? shown : c.items);
  return (ds[0] || c.details.start || isoD(new Date())).slice(0,7);
}
function shiftMonth(ym, n){
  const d = new Date(Number(ym.slice(0,4)), Number(ym.slice(5,7))-1+n, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
/* a card you can pick up */
function evtHTML(c, it){
  const k = kindOf(it), who = ownerName(it);
  return `<button class="cevt" data-drag="${esc(it.id)}" title="${esc(it.name)}${canPlan()?" — drag to move":""}"
    style="border-left-color:${k.c};background:color-mix(in srgb,${k.c} 9%,transparent)">
    <b>${k.emo} ${esc(it.name)}</b>
    <span>${esc(kindName(it))}${who?" · "+esc(who):""}</span></button>`;
}
function gridView(c, shown){
  const ym = monthShown(c, shown);
  const y = Number(ym.slice(0,4)), m = Number(ym.slice(5,7))-1;
  const start = (new Date(y,m,1).getDay()+6)%7, dim = new Date(y,m+1,0).getDate();
  const today = isoD(new Date());
  let cells="";
  for(let i=0;i<start;i++) cells += `<div class="cday pad"></div>`;
  for(let d=1; d<=dim; d++){
    const key = `${ym}-${String(d).padStart(2,"0")}`;
    const its = shown.filter(i=>i.date===key);
    cells += `<div class="cday ${its.length?"has":""} ${key===today?"today":""}" data-drop="${key}">
      <span class="dn">${d}</span>${its.map(it=>evtHTML(c,it)).join("")}</div>`;
  }
  const undated = shown.filter(i=>!i.date);
  const here = shown.filter(i=>i.date && i.date.slice(0,7)===ym).length;
  const away = shown.filter(i=>i.date && i.date.slice(0,7)!==ym).length;
  return `
    <div class="calhead">
      <div class="calnav">
        <button class="navbtn" data-mv="-1" title="Previous month">‹</button>
        <h3>${new Date(y,m,1).toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</h3>
        <button class="navbtn" data-mv="1" title="Next month">›</button>
      </div>
      <span class="hint">${here} here${away?` · ${away} in another month — use the arrows`:""}</span>
      ${canPlan()?`<span class="hint" style="margin-left:auto">✋ Drag a card onto another day to move it</span>`:""}
    </div>
    <div style="overflow-x:auto"><div class="cgrid">
      ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="cdow">${d}</div>`).join("")}
      ${cells}
    </div></div>
    <div class="undated" data-drop="none">
      <span class="lbl">No date yet</span>
      ${undated.length ? undated.map(it=>evtHTML(c,it)).join("")
        : `<span class="hint">${canPlan()?"Drag a card here to take its date off again.":"Everything has a date."}</span>`}
    </div>`;
}
function listView(c, shown){
  return `<div class="tw"><table style="min-width:900px">
    <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Platform / Category</th><th>Accountable</th><th>More details</th></tr></thead>
    <tbody>${sortItems(shown).map(it=>{ const k=kindOf(it), who=ownerName(it);
      return `<tr data-open="${esc(it.id)}" style="cursor:pointer">
        <td class="vol" style="white-space:nowrap">${it.date?`${dmy(it.date)}<small>${dowShortC(it.date)}</small>`:`<span class="miss">not set</span>`}</td>
        <td class="td-idea" style="border-left:3px solid ${k.c}">${esc(it.name)}</td>
        <td><span class="tag" style="background:color-mix(in srgb,${k.c} 15%,transparent);color:${k.c}">${esc(kindName(it).toLowerCase())}</span></td>
        <td>${it.platform?`<span class="chip">${esc(it.platform)}</span>`:"—"}</td>
        <td>${who?`<span class="who">${avatar(who)}${esc(who)}</span>`:`<span class="miss">nobody</span>`}</td>
        <td class="td-txt">${it.details?esc(it.details):"—"}</td></tr>`;}).join("")}
    </tbody></table></div>`;
}
function flowView(c, shown){
  const ds = campDates(shown);
  if(!ds.length) return `<div class="empty"><h4>No dates set yet</h4>
    <p>The flowchart lays items out in the order they go out, so each one needs a day first.</p></div>`;
  return `<div class="flowwrap"><div class="flow">
    ${ds.map((d,i)=>{
      const its = shown.filter(x=>x.date===d);
      return `<div class="fstage">
        <div class="fdate"><b>${dmy(d)}</b><span>${dowShortC(d)}</span></div>
        <div class="fitems">
          ${its.map(it=>{ const k=kindOf(it), who=ownerName(it);
            return `<button class="fcard" style="border-color:${k.c};background:color-mix(in srgb,${k.c} 8%,transparent)" data-open="${esc(it.id)}">
              <span class="femo">${k.emo}</span>
              <b>${esc(it.name)}</b>
              <span class="fmeta">${esc(kindName(it))}${it.platform?" · "+esc(it.platform):""}</span>
              ${who?`<span class="fwho">${avatar(who)}${esc(who)}</span>`:""}
            </button>`;}).join("")}
        </div>
      </div>${i<ds.length-1?`<div class="farrow">→</div>`:""}`;
    }).join("")}
  </div></div>
  <p class="hint" style="margin:12px 0 0">Reads left to right in the order things go out.${canEdit()?" Click any card to edit it.":canPlan()?" Click any card to change its day.":""}</p>`;
}

/* drag and drop on pointer events, so a finger works like a mouse.
   A press that never moves is a tap; past a few pixels it becomes a drag. */
function dropOnto(c, id, target){
  const it = c.items.find(x=>x.id===id); if(!it) return;
  const was = it.date || "";
  const now = target === "none" ? "" : target;
  if(was === now) return;
  it.date = now;
  save();
  toastUndo(now ? `"${it.name}" moved to ${dmy(now)}` : `"${it.name}" has no date now`,
    ()=>{ it.date = was; save(); toast("Put back"); });
}
function pointerDrag(el, opts){
  el.addEventListener("pointerdown", e=>{
    if(e.button) return;
    const x0 = e.clientX, y0 = e.clientY;
    let live = false, ghost = null, over = null, ox = 0, oy = 0;
    const root = $("#root");
    const setOver = z=>{ if(z===over) return;
      if(over) over.classList.remove("over"); over = z; if(over) over.classList.add("over"); };
    const move = ev=>{
      if(!live){
        if(Math.hypot(ev.clientX-x0, ev.clientY-y0) < 7) return;
        live = true;
        const r = el.getBoundingClientRect();
        ox = r.left - x0; oy = r.top - y0;
        ghost = el.cloneNode(true);
        ghost.classList.add("dragghost");
        ghost.style.cssText += `;position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;
          margin:0;z-index:120;pointer-events:none;opacity:.95;transform:rotate(-1.5deg) scale(1.04);
          box-shadow:0 12px 28px rgba(10,8,5,.3)`;
        root.appendChild(ghost);                /* inside the shadow root, so it keeps its styles */
        el.classList.add("dragging");
        root.classList.add("dragmode");
      }
      ev.preventDefault();
      ghost.style.left = (ev.clientX + ox) + "px";
      ghost.style.top  = (ev.clientY + oy) + "px";
      if(ev.clientY < 86) window.scrollBy(0,-15);
      else if(ev.clientY > window.innerHeight-86) window.scrollBy(0,15);
      const under = R.elementFromPoint ? R.elementFromPoint(ev.clientX, ev.clientY) : null;
      setOver(under && under.closest ? under.closest(opts.zone) : null);
    };
    const end = ()=>{
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", done);
      el.removeEventListener("pointercancel", cancel);
    };
    const done = ()=>{
      end();
      if(!live){ opts.onTap && opts.onTap(); return; }
      ghost && ghost.remove();
      el.classList.remove("dragging"); root.classList.remove("dragmode");
      const zone = over; setOver(null);
      if(zone) opts.onDrop(zone); else if(opts.onMiss) opts.onMiss();
    };
    const cancel = ()=>{
      end();
      ghost && ghost.remove(); setOver(null);
      el.classList.remove("dragging"); root.classList.remove("dragmode");
    };
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", done);
    el.addEventListener("pointercancel", cancel);
  });
}
function wireCalendar(c){
  const W = $("#body");
  if(canPlan()) W.querySelectorAll("[data-drag]").forEach(el=>{
    const id = el.dataset.drag;
    pointerDrag(el, {
      zone:"[data-drop]",
      onTap: ()=>openPiece(c, id),
      onDrop: z=>dropOnto(c, id, z.dataset.drop),
      onMiss: ()=>toast("Dropped outside the calendar — nothing changed")
    });
  });
  W.querySelectorAll("[data-mv]").forEach(b=>b.onclick=()=>{ CALMONTH = shiftMonth(monthShown(c, filtered(c)), Number(b.dataset.mv)); draw(); });
  W.querySelectorAll("[data-cv]").forEach(b=>b.onclick=()=>{ CALVIEW=b.dataset.cv; draw(); });
  W.querySelectorAll("[data-cf]").forEach(el=>el.onchange=()=>{
    const k = el.dataset.cf;
    CALFILTER[k] = el.value;
    if(k==="range" && el.value!=="all" && !CALFILTER.anchor) CALFILTER.anchor = TODAY;
    draw();
  });
  ["clearFilter","clearFilter2"].forEach(id=>{ const b=$("#"+id);
    if(b) b.onclick=()=>{ CALFILTER={range:"all",anchor:"",type:"all",platform:"all",owner:"all"}; draw(); }; });
  const g = $("#genFlow"); if(g) g.onclick=()=>{ CALVIEW = CALVIEW==="flow" ? "grid" : "flow"; draw(); };
  if(canPlan()) W.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openPiece(c, b.dataset.open));
  else W.querySelectorAll("[data-open]").forEach(b=>{ b.style.cursor="default"; });
}
/* tapping a piece: an admin gets the whole item, a Team Manager just its day */
function openPiece(c, id){
  const i = c.items.findIndex(x=>x.id===id); if(i<0) return;
  if(canEdit()) return itemDialog(c, i);
  if(!canPlan()) return;
  const it = c.items[i];
  openDialog({
    title:`Move "${it.name}"`, sub:"Pick the day it goes out on, or clear it to take its date off.", okLabel:"Move",
    fields:[{ k:"date", label:"Day", type:"date", value:it.date||"" }],
    onSave:(v)=>{ if((it.date||"")===v.date) return; dropOnto(c, id, v.date || "none"); }
  });
}

/* ============================================================ API */
window.CX = {
  tabs: [["details","Fill in Details"],["assign","Assignment & distribution of work"],["calendar","Calendar"],["dash","Dashboard"]],
  normalize: normalize,
  kinds: ITEM_KINDS,
  /* opt: { tab, canEdit() (admin: everything), canPlan() (Team Manager: calendar + assignment), canDelete(), people() → [{id,name,role}], save(space), saveQuiet(space),
            onHeader(space), remove(space), notify(space,item) → Promise<{sent,belled,reason}>,
            sendToProcess(space,item) → {cardId}|{error}, cardExists(space,cardId), goProcess(space),
            socialName(space), setTab(t) } */
  render: function(space, wrap, opt){
    mount();
    OPT = opt || {};
    if(SPACE!==space){ SPACE=space; ASSIGNFILTER="All"; CALMONTH=""; DAYSEL=null; CALFILTER={range:"all",anchor:"",type:"all",platform:"all",owner:"all"}; if(R) closeDialog(); }
    normalize(space);
    CTAB = ["details","assign","calendar","dash"].includes(OPT.tab) ? OPT.tab : "details";
    if(HOST.parentNode!==wrap) wrap.appendChild(HOST);
    draw();
  }
};
})();
