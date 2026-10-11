/* =====================================================================
   CAMPAIGN SPACE — Fill in Details · Assignment · Calendar · Dashboard
   (Cyberflow team app, tools.dubuddy.in)

   WHAT THIS IS: one sale, one place — built from the team's "Campaign
   Creator" design. A campaign lives inside a Marketing space (index.html,
   type "marketing"; campaigns are type "campaign" with parent = that space).
     * Fill in Details — the offer (name, tagline, code, duration, days,
       messaging, other) + the team's own extra fields, then the list of every
       item that goes out (reel, banner, push, WhatsApp, influencer video…).
     * Assignment & distribution of work — give each item an accountable
       teammate (they get an email + a 🔔), then press its action:
       reels / videos / stories / influencer videos land on the Social Media
       space's Content Process board as high priority; banners and alerts open
       Strapi, WhatsApp opens MSG91, notifications open Firebase.
     * Calendar — grid / list / flowchart, with filters.
     * Dashboard — what's in the campaign (live from the items) and campaign
       success (example numbers until sales data is connected).
   index.html calls CX.render(space, host, opt) when a campaign is open; it is
   drawn inside a shadow root so its styles and the app's never touch.
   Data is saved with the team (team_data "cspaces") through opt.save /
   opt.saveQuiet (quiet = no page redraw, used while typing).
   ===================================================================== */
(function(){
"use strict";

const CSS = `/* Layout: fixed left rail + top chrome, scrolling work surface. Tabs switch panes in place.
   Palette: DU Buddy's warm paper + terracotta, carried into a validated 4-hue chart set. */
:host{display:block;color-scheme:light;
  --bg:#FCFBF8; --surface:#FFFFFF; --surface-2:#F6F4EF; --surface-3:#EEF1F7; --surface-4:#FAF8F3;
  --ink:#1A1815; --ink-2:#56514A; --ink-3:#8C867C;
  --line:#E6E1D8; --line-2:#D2CCC0;
  --accent:#D4541E; --accent-ink:#A83E12; --accent-soft:#FBEBE2;
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
[hidden]{display:none!important}
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

@media (max-width:900px){ .detgrid{grid-template-columns:1fr} }

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

.toast{position:fixed;left:50%;transform:translateX(-50%) translateY(14px);bottom:calc(22px + env(safe-area-inset-bottom,0px));background:var(--ink);color:var(--bg);font-size:12.5px;font-weight:600;padding:10px 16px;border-radius:999px;z-index:95;opacity:0;pointer-events:none;transition:all .18s;max-width:90vw;text-align:center}
.toast.on{opacity:1;transform:translateX(-50%)}

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
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

let HOST=null, R=null, SPACE=null, OPT={};
let CTAB="details", CALVIEW="grid", ASSIGNFILTER="All";
let CALFILTER={ range:"all", anchor:"", type:"all", platform:"all", owner:"all" };
const $ = s => R.querySelector(s);
const $$ = s => R.querySelectorAll(s);

/* ------------------------------------------------------------ registries */
const CORE_FIELDS = [
  { k:"name",      label:"Campaign name", type:"text", ph:"CUET Crash Course — Early Bird" },
  { k:"tagline",   label:"Tagline",       type:"text", ph:"Start before the rush. Save ₹2,000." },
  { k:"code",      label:"Offer code",    type:"text", ph:"EARLY2000" },
  { k:"duration",  label:"Duration",      type:"text", ph:"12 Oct – 18 Oct 2026" },
  { k:"days",      label:"Days",          type:"text", ph:"7" },
  { k:"messaging", label:"Messaging",     type:"area", wide:true, ph:"The one thing every message should say." },
  { k:"other",     label:"Other details", type:"area", wide:true, ph:"Anything else the team should know." }
];
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
const actionFor = it => ACTIONS[it.kind] || ACTIONS.other;

/* sales: has to come from the database one day — the shape, not real numbers */
const SALES_DEMO = {
  code:"EARLY2000", target:500,
  plans:[ { name:"Topper plan",   price:4999, qty:142, c:"var(--c1)" },
          { name:"Aspirant plan", price:2999, qty:245, c:"var(--c2)" } ],
  where:[ { name:"App",     qty:231, c:"var(--c3)" },
          { name:"Website", qty:156, c:"var(--c4)" } ],
  sources:[ { name:"Push notification", qty:118, kind:"notification" },
            { name:"Instagram reel",    qty:94,  kind:"reel" },
            { name:"Influencer video",  qty:71,  kind:"influencer" },
            { name:"WhatsApp message",  qty:58,  kind:"whatsapp" },
            { name:"Long video",        qty:27,  kind:"longvideo" },
            { name:"Direct / organic",  qty:19,  kind:"other" } ],
  spend:45000
};

/* ------------------------------------------------------------ helpers */
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// text from a rich-text box (richtext.js keeps light markdown): shown formatted
const rich = v => window.RT ? RT.html(v) : esc(v);
const isoD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const TODAY = isoD(new Date());
const dmy = s => s ? new Date(s+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : "";
const dowShortC = s => s ? new Date(s+"T00:00:00").toLocaleDateString("en-GB",{weekday:"short"}) : "";
function hue(name){ let h=0; for(const ch of String(name)) h=(h*31+ch.charCodeAt(0))%360; return h; }
function avatar(name){ const n=String(name||"?").trim()||"?";
  return `<span class="av" style="background:hsl(${hue(n)} 48% 46%)">${esc(n.charAt(0).toUpperCase())}</span>`; }
const inr = n => "₹" + Number(n).toLocaleString("en-IN");
const lakh = n => n>=100000 ? `₹${(n/100000).toFixed(2)} L` : inr(n);
function toast(m){ const t=$("#toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove("on"),2600); }
const canEdit = () => !OPT.canEdit || OPT.canEdit();
const sortItems = its => [...its].sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function people(){ return (OPT.people && OPT.people()) || []; }          /* [{id,name,email,role}] */
function ownerName(it){ if(!it.ownerId) return it.owner||""; const p=people().find(x=>x.id===it.ownerId); return p ? p.name : (it.owner||""); }

/* fill in missing pieces on an older / new campaign */
function normalize(c){
  c.details = Object.assign({ name:c.name||"", tagline:"", code:"", duration:"", days:"", messaging:"", other:"" }, c.details||{});
  c.extra = Array.isArray(c.extra) ? c.extra : [];
  c.contentsLabel = c.contentsLabel || "List of contents";
  c.items = Array.isArray(c.items) ? c.items : [];
  c.items.forEach(it=>{ if(!it.id) it.id = uid("ci"); if(!ITEM_KINDS[it.kind]) it.kind = "other"; });
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
  const hidden = f => f.showIf && fields.find(x=>x.k===f.showIf.field)?.value !== f.showIf.equals;
  $("#dlgBody").innerHTML = fields.map(f=>`
    <div class="fbox" id="w-${f.k}" style="background:var(--surface-4);margin-bottom:10px" ${hidden(f)?"hidden":""}>
      <label for="d-${f.k}">${esc(f.label)}</label>${ctl(f)}
    </div>`).join("");
  fields.filter(f=>f.showIf).forEach(f=>{
    const src=$("#d-"+f.showIf.field); if(!src) return;
    src.addEventListener("change",()=>{ const w=$("#w-"+f.k); w.hidden = src.value!==f.showIf.equals; if(!w.hidden) $("#d-"+f.k).focus(); });
  });
  dlgSubmit = ()=>{
    const out={};
    fields.forEach(f=>{ const el=$("#d-"+f.k), off=$("#w-"+f.k)?.hidden; out[f.k] = off ? "" : (el?.value||"").trim(); });
    if(onSave(out) !== false) closeDialog();
  };
  $("#dlgScrim").classList.add("on");
  setTimeout(()=>$("#dlgBody").querySelector("input,textarea,select")?.focus(), 60);
}
function closeDialog(){ $("#dlgScrim").classList.remove("on"); dlgSubmit=null; }

/* ------------------------------------------------------------ mount + draw */
function mount(){
  if(HOST) return;
  HOST = document.createElement("div"); HOST.className="cx-host";
  R = HOST.attachShadow({mode:"open"});
  R.innerHTML = `<style>${CSS}</style><div class="cxroot">
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
function goTab(t){ if(OPT.setTab) OPT.setTab(t); else { CTAB=t; draw(); } }
function draw(){
  const c = SPACE; if(!c) return;
  const B = $("#body");
  B.innerHTML = CTAB==="details" ? detailsPane(c) : CTAB==="assign" ? assignPane(c) : CTAB==="dash" ? dashPane(c) : calendarPane(c);
  B.querySelectorAll("[data-ctab]").forEach(b=>b.onclick=()=>goTab(b.dataset.ctab));
  if(CTAB==="details") wireDetails(c);
  else if(CTAB==="assign") wireAssign(c);
  else if(CTAB==="calendar") wireCalendar(c);
}

/* ============================================================ FILL IN DETAILS */
function detailsPane(c){
  const ro = !canEdit(), dis = ro ? "disabled" : "";
  return `
    ${ro?`<div class="bar2" style="margin-bottom:16px"><span class="ic2">VIEW ONLY</span><p>You can see this campaign but not change it.</p></div>`:""}
    <div class="panel" style="margin-bottom:24px">
      <div class="panel-h">
        <h3>Campaign details</h3>
        <span class="hint">Every box is yours to change · add your own with the +</span>
        ${ro?"":`<button class="plus" id="addField" title="Add your own field">+</button>`}
      </div>
      <div class="fgrid">
        ${CORE_FIELDS.map(f=>`
          <div class="fbox ${f.wide?"wide":""}">
            <label for="f-${f.k}">${esc(f.label)}</label>
            ${f.type==="area"
              ? `<textarea id="f-${f.k}" data-f="${f.k}" placeholder="${esc(f.ph)}" ${dis}>${esc(c.details[f.k]||"")}</textarea>`
              : `<input id="f-${f.k}" data-f="${f.k}" value="${esc(c.details[f.k]||"")}" placeholder="${esc(f.ph)}" ${dis}>`}
          </div>`).join("")}
        ${c.extra.map((x,i)=>`
          <div class="fbox custom ${x.wide?"wide":""}">
            ${ro?"":`<button class="rm" data-rmfield="${i}" title="Remove this field">✕</button>`}
            <label>${esc(x.label)}</label>
            ${x.wide ? `<textarea data-x="${i}" placeholder="…" ${dis}>${esc(x.value||"")}</textarea>`
                     : `<input data-x="${i}" value="${esc(x.value||"")}" placeholder="…" ${dis}>`}
          </div>`).join("")}
        ${ro?"":`<button class="addfield" id="addField2">+ Add your own field</button>`}
      </div>
    </div>

    <div class="sec-h" style="margin-bottom:12px">
      <input class="renameable" id="clabel" value="${esc(c.contentsLabel)}" title="Click to rename this section" ${dis}>
      <span class="hint">${c.items.length} item${c.items.length===1?"":"s"} · these get arranged on the calendar</span>
      ${ro?"":`<button class="btn pri" id="addItem" style="margin-left:auto">+ Add item</button>`}
    </div>

    ${c.items.length ? sortItems(c.items).map(it=>{
      const k = kindOf(it), on = ownerName(it);
      return `<div class="citem" style="border-left:3px solid ${k.c}">
        <span class="ic" style="background:color-mix(in srgb,${k.c} 15%,transparent)">${k.emo}</span>
        <div class="citem-b">
          <h5>${esc(it.name)}</h5>
          <div class="citem-m">
            <span class="tag" style="background:color-mix(in srgb,${k.c} 15%,transparent);color:${k.c}">${esc(kindName(it).toLowerCase())}</span>
            ${it.date?`<span class="dchip">${dmy(it.date)}</span>`:`<span class="badge mute">no date yet</span>`}
            ${it.platform?`<span class="chip">${esc(it.platform)}</span>`:""}
            ${on?`<span class="who">${avatar(on)}${esc(on)}</span>`:`<span class="badge mute">nobody accountable</span>`}
          </div>
          ${it.details?`<p>${rich(it.details)}</p>`:""}
        </div>
        ${ro?"":`<div class="row" style="flex-wrap:nowrap">
          <button class="btn sm" data-edititem="${esc(it.id)}">Edit</button>
          <button class="btn sm danger" data-rmitem="${esc(it.id)}" title="Remove">✕</button></div>`}
      </div>`;
    }).join("")
    : `<div class="empty">
        <h4>Nothing listed yet</h4>
        <p>Add every piece that goes out in this campaign — reels, banners, notifications, WhatsApp messages,
        influencer videos. Give each one a date and someone accountable, and the calendar builds itself.</p>
        ${ro?"":`<button class="btn pri" id="addItemEmpty">+ Add the first item</button>`}
      </div>`}

    ${OPT.canDelete && OPT.canDelete() ? `<div class="row" style="margin-top:26px;padding-top:18px;border-top:1px solid var(--line)">
      <span class="hint">Finished with this campaign, or made it by mistake?</span>
      <button class="btn danger sm" id="delCampaign" style="margin-left:auto">Delete this campaign</button>
    </div>` : ""}`;
}
function wireDetails(c){
  const B = $("#body");
  B.querySelectorAll("[data-f]").forEach(el=>{
    el.oninput=()=>{
      c.details[el.dataset.f] = el.value;
      if(el.dataset.f==="name"){ c.name = el.value.trim() || c.name; }
      if(OPT.onHeader && (el.dataset.f==="name" || el.dataset.f==="tagline")) OPT.onHeader(c);
      saveQuiet();
    };
    if(el.dataset.f==="name") el.onchange=()=>save();     /* the sidebar shows the new name */
  });
  B.querySelectorAll("[data-x]").forEach(el=>el.oninput=()=>{ c.extra[Number(el.dataset.x)].value = el.value; saveQuiet(); });
  B.querySelectorAll("[data-rmfield]").forEach(b=>b.onclick=()=>{ c.extra.splice(Number(b.dataset.rmfield),1); saveQuiet(); draw(); });
  const addField = ()=> openDialog({
    title:"Add your own field", sub:"It becomes a box on this campaign only.",
    fields:[ { k:"label", label:"What is it called?", ph:"Budget, Approver, Landing page…" },
             { k:"wide", label:"How much room does it need", type:"select", value:"no", opts:[["no","One line"],["yes","A paragraph"]] } ],
    onSave:(v)=>{ if(!v.label){ toast("Name the field"); return false; }
      c.extra.push({ label:v.label, value:"", wide:v.wide==="yes" }); saveQuiet(); draw(); toast(`"${v.label}" added`); }
  });
  const af=$("#addField"); if(af) af.onclick=addField;
  const af2=$("#addField2"); if(af2) af2.onclick=addField;
  const cl=$("#clabel"); if(cl) cl.oninput=()=>{ c.contentsLabel=cl.value; saveQuiet(); };
  const ai=$("#addItem"); if(ai) ai.onclick=()=>itemDialog(c,null);
  const aie=$("#addItemEmpty"); if(aie) aie.onclick=()=>itemDialog(c,null);
  const dc=$("#delCampaign"); if(dc) dc.onclick=()=>openDialog({
    title:`Delete "${c.name}"?`,
    sub:`This removes the campaign and all ${c.items.length} item${c.items.length===1?"":"s"} in it. It cannot be undone.`,
    okLabel:"Delete campaign",
    fields:[{ k:"confirm", label:"Type the word delete to confirm", ph:"delete" }],
    onSave:(v)=>{ if(v.confirm.toLowerCase()!=="delete"){ toast("Type delete to confirm"); return false; }
      if(OPT.remove) OPT.remove(c); }
  });
  B.querySelectorAll("[data-edititem]").forEach(b=>b.onclick=()=>itemDialog(c, c.items.findIndex(x=>x.id===b.dataset.edititem)));
  B.querySelectorAll("[data-rmitem]").forEach(b=>b.onclick=()=>{
    const i=c.items.findIndex(x=>x.id===b.dataset.rmitem); if(i<0) return;
    c.items.splice(i,1); save(); toast("Removed"); });
}

/* ---------- the item dialog ---------- */
function itemDialog(c, idx){
  if(!canEdit()) return;
  const it = idx==null||idx<0 ? { name:"", kind:"reel", kindOther:"", date:"", platform:"Instagram", ownerId:"", details:"" } : c.items[idx];
  const ppl = people();
  openDialog({
    title: idx==null ? "Add an item" : "Edit item",
    sub:"Anything that goes out as part of this campaign.",
    fields:[
      { k:"name", label:"Name of the item", ph:"Launch reel", value:it.name },
      { k:"kind", label:"Type", type:"select", value:it.kind, opts:Object.entries(ITEM_KINDS).map(([k,v])=>[k,v.emo+" "+v.label]) },
      { k:"kindOther", label:"If other, what is it?", ph:"Podcast clip, press release…", value:it.kindOther, showIf:{ field:"kind", equals:"other" } },
      { k:"date", label:"Day", type:"date", value:it.date },
      { k:"platform", label:"Platform / Category", type:"select", value:it.platform, opts:PLATFORMS.map(p=>[p,p]) },
      { k:"ownerId", label:"Accountable person", type:"select", value:it.ownerId||"",
        opts:[["","— nobody yet —"]].concat(ppl.map(p=>[p.id, p.name + (p.role?" · "+p.role:"")])) },
      { k:"details", label:"More details", type:"area", value:it.details, ph:"The hook, where it links to — anything the person making it needs." }
    ],
    onSave:(v)=>{
      if(!v.name){ toast("The item needs a name"); return false; }
      const before = idx==null||idx<0 ? "" : (it.ownerId||"");
      let target;
      if(idx==null||idx<0){ target = Object.assign({ id:uid("ci") }, v); c.items.push(target); }
      else target = Object.assign(c.items[idx], v);
      const p = ppl.find(x=>x.id===v.ownerId); target.owner = p ? p.name : "";
      if(v.ownerId && v.ownerId!==before) notifyOwner(c, target);
      save();
      toast(idx==null||idx<0 ? `"${v.name}" added` : "Saved");
    }
  });
}

/* tell someone they own a thing: an email + a 🔔 (index.html → idea-mail "assign") */
function notifyOwner(c, it){
  if(!it.ownerId) return;
  it.notifiedAt = new Date().toISOString();
  if(OPT.notify) OPT.notify(c, it).then(r=>{
    if(r && r.sent) toast(`${it.owner} notified — email sent`);
    else if(r && r.belled) toast(`${it.owner} notified in the app (email didn't go: ${r.reason||"unknown"})`);
    else toast(`Saved — couldn't notify ${it.owner}${r&&r.reason?": "+r.reason:""}`);
  });
}

/* ============================================================ ASSIGNMENT */
function assignPane(c){
  if(!c.items.length) return `<div class="empty">
    <h4>Nothing to hand out yet</h4>
    <p>Add items under Fill in Details, then share them out here by platform.</p>
    <button class="btn pri" data-ctab="details">Go to Fill in Details</button></div>`;
  const ro = !canEdit();
  const plats = [...new Set(c.items.map(i=>i.platform).filter(Boolean))];
  if(ASSIGNFILTER!=="All" && !plats.includes(ASSIGNFILTER)) ASSIGNFILTER="All";
  const rows = ASSIGNFILTER==="All" ? c.items : c.items.filter(i=>i.platform===ASSIGNFILTER);
  const unassigned = c.items.filter(i=>!i.ownerId && !i.owner).length;
  return `
    <div class="bar2">
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
        const k=kindOf(it), a=actionFor(it), on=ownerName(it);
        const done = it.sentCardId && OPT.cardExists && OPT.cardExists(c, it.sentCardId);
        return `<tr>
          <td class="td-idea" style="border-left:3px solid ${k.c}">${esc(it.name)}
            ${done?`<div style="margin-top:5px"><span class="badge good">🔔 in Content Process</span></div>`:""}</td>
          <td><span class="tag" style="background:color-mix(in srgb,${k.c} 15%,transparent);color:${k.c}">${esc(kindName(it).toLowerCase())}</span></td>
          <td>${it.platform?`<span class="chip">${esc(it.platform)}</span>`:"—"}</td>
          <td class="vol" style="white-space:nowrap">${it.date?dmy(it.date):`<span class="miss">not set</span>`}</td>
          <td style="min-width:186px">
            ${on ? `<div class="who">${avatar(on)}${esc(on)}</div>
                 <div class="hint" style="margin-top:3px;font-size:11px">${it.notifiedAt?`✉ notified ${esc(new Date(it.notifiedAt).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))}`:`not notified yet`}</div>`
              : `<span class="miss">nobody</span>`}
            ${ro?"":`<button class="btn sm" data-assign="${esc(it.id)}" style="margin-top:6px">${on?"Reassign":"Assign"}</button>`}
          </td>
          <td style="min-width:200px">
            ${a.mode==="process"
              ? (done ? `<button class="btn sm" data-goprocess="1">View on the board →</button>`
                      : (ro ? `<span class="hint">not sent yet</span>` : `<button class="btn sm pri" data-act="${esc(it.id)}">🔔 ${esc(a.label)}</button>`))
              : a.mode==="link"
                ? `<a class="btn sm go" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.label)} ↗</a>`
                : `<span class="hint">nothing to send</span>`}
          </td></tr>`;
      }).join("")}</tbody>
    </table></div>
    <p class="hint" style="margin:11px 0 0">Reel, long video, story and influencer video land on the Content Process board${OPT.socialName?` of <b>${esc(OPT.socialName(c)||"Social Media")}</b>`:""}.
    Banner and alert open Strapi, WhatsApp opens MSG91, notification opens Firebase.</p>`;
}
function wireAssign(c){
  const B = $("#body");
  B.querySelectorAll("[data-plat]").forEach(b=>b.onclick=()=>{ ASSIGNFILTER=b.dataset.plat; draw(); });
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
    if(!it.ownerId && !it.owner){ toast("Give it an accountable person first"); return; }
    if(!OPT.sendToProcess){ toast("No Social Media space to send it to"); return; }
    const r = OPT.sendToProcess(c, it);
    if(r && r.error){ toast(r.error); return; }
    it.sentCardId = r.cardId; save();
    toast(`"${it.name}" sent to Content Process → To Do, marked high priority`);
  });
  B.querySelectorAll("[data-goprocess]").forEach(b=>b.onclick=()=>{ if(OPT.goProcess) OPT.goProcess(c); });
}

/* ============================================================ DASHBOARD */
function hbars(rows, total, opts={}){
  const max = Math.max(...rows.map(r=>r.v), 1);
  return `<div class="hb">${rows.map(r=>`
    <div class="hbrow">
      <span class="hbl">${r.emo?`<i class="hbe">${r.emo}</i>`:""}${esc(r.label)}</span>
      <span class="hbt"><i style="width:${(r.v/max*100).toFixed(1)}%;background:${r.c||"var(--accent)"}"></i></span>
      <span class="hbv">${opts.money?inr(r.v):r.v}${total?`<small>${Math.round(r.v/total*100)}%</small>`:""}</span>
    </div>`).join("")}</div>`;
}
function campDates(list){ return [...new Set(list.filter(i=>i.date).map(i=>i.date))].sort(); }
function dashPane(c){
  if(!c.items.length) return `<div class="empty">
    <h4>Nothing to summarise yet</h4>
    <p>Add items under Fill in Details and this page fills itself in.</p>
    <button class="btn pri" data-ctab="details">Go to Fill in Details</button></div>`;
  const byKind = Object.entries(ITEM_KINDS)
    .map(([k,v])=>({ label:v.label, emo:v.emo, c:v.c, v:c.items.filter(i=>i.kind===k).length })).filter(r=>r.v).sort((a,b)=>b.v-a.v);
  const plats = [...new Set(c.items.map(i=>i.platform).filter(Boolean))];
  const byPlat = plats.map((p,i)=>({ label:p, v:c.items.filter(x=>x.platform===p).length,
    c:["var(--c1)","var(--c2)","var(--c3)","var(--c4)","var(--good)","var(--warn)"][i%6] })).sort((a,b)=>b.v-a.v);
  const owners = [...new Set(c.items.map(ownerName).filter(Boolean))];
  const byOwner = owners.map(o=>({ label:o, v:c.items.filter(x=>ownerName(x)===o).length, c:`hsl(${hue(o)} 48% 46%)` })).sort((a,b)=>b.v-a.v);
  const unassigned = c.items.filter(i=>!ownerName(i)).length;
  const undated = c.items.filter(i=>!i.date).length;
  const ds = campDates(c.items);
  const busiest = ds.map(d=>({ d, n:c.items.filter(i=>i.date===d).length })).sort((a,b)=>b.n-a.n)[0];
  const pushCount = c.items.filter(i=>i.kind==="notification").length;
  const waCount = c.items.filter(i=>i.kind==="whatsapp").length;
  const S = SALES_DEMO;
  const totalSales = S.plans.reduce((a,p)=>a+p.qty,0);
  const revenue = S.plans.reduce((a,p)=>a+p.qty*p.price,0);
  const pct = Math.round(totalSales/S.target*100);
  const roi = (revenue/S.spend).toFixed(1);
  const srcTotal = S.sources.reduce((a,s)=>a+s.qty,0);
  return `
    <div class="sec-h"><h3>What's in this campaign</h3><span class="hint">Straight from what you entered — no outside data</span></div>
    <div class="tiles" style="margin-bottom:18px">
      <div class="tile"><div class="k"><span class="lbl">Total items</span></div>
        <div class="v">${c.items.length}</div><div class="d">across ${ds.length} day${ds.length===1?"":"s"}</div></div>
      <div class="tile"><div class="k"><span class="lbl">Types used</span></div>
        <div class="v">${byKind.length}</div><div class="d">${esc(byKind[0]?.label||"")} is the most common</div></div>
      <div class="tile"><div class="k"><span class="lbl">Platforms</span></div>
        <div class="v">${plats.length}</div><div class="d">${esc(byPlat[0]?.label||"")} carries the most</div></div>
      <div class="tile"><div class="k"><span class="lbl">Nobody assigned</span>
        ${unassigned?`<span class="badge crit">fix</span>`:`<span class="badge good">clear</span>`}</div>
        <div class="v">${unassigned}</div><div class="d">${undated} also have no date</div></div>
    </div>
    <div class="dashgrid">
      <div class="panel"><div class="panel-h"><h3>By content type</h3><span class="hint">${c.items.length} items</span></div>${hbars(byKind, c.items.length)}</div>
      <div class="panel"><div class="panel-h"><h3>By platform / category</h3><span class="hint">where each one goes out</span></div>${hbars(byPlat, c.items.length)}</div>
      <div class="panel"><div class="panel-h"><h3>Who is carrying what</h3><span class="hint">${owners.length} ${owners.length===1?"person":"people"}</span></div>
        ${byOwner.length ? hbars(byOwner, c.items.length) : `<p class="hint" style="margin:0">Nobody assigned yet.</p>`}
        ${unassigned?`<p class="hint" style="margin:11px 0 0;color:var(--crit)">${unassigned} item${unassigned>1?"s have":" has"} no name on ${unassigned>1?"them":"it"}.</p>`:""}</div>
      <div class="panel"><div class="panel-h"><h3>Message load</h3><span class="hint">what lands on a phone</span></div>
        ${hbars([{ label:"Push notifications", v:pushCount, c:ITEM_KINDS.notification.c, emo:"🔔" },
                 { label:"WhatsApp messages",  v:waCount,   c:ITEM_KINDS.whatsapp.c, emo:"💬" }])}
        <p class="hint" style="margin:11px 0 0">${pushCount>6 || waCount>3
            ? `<b style="color:var(--warn)">Above the comfortable ceiling.</b> Roughly 2 pushes a day and 2–3 WhatsApps a week is where people stop muting you.`
            : `Within a sensible range. Watch it if the campaign gets extended.`}
          ${busiest && busiest.n>2?`<br>Busiest day is ${dmy(busiest.d)} with ${busiest.n} items.`:""}</p></div>
    </div>
    <div class="sec-h" style="margin-top:28px"><h3>Campaign success</h3>
      <span class="hint">Sales against code <span class="code">${esc(c.details.code||S.code)}</span></span>
      <span class="badge warn" style="margin-left:auto">example numbers</span></div>
    <div class="bar2" style="margin-bottom:18px"><span class="ic2">NOT LIVE</span>
      <p><b>These figures are a placeholder for the shape of the page.</b> They have to come from your own database —
      a count of orders carrying the offer code, split by plan and by where the purchase happened. One query, run nightly.</p></div>
    <div class="tiles" style="margin-bottom:18px">
      <div class="tile"><div class="k"><span class="lbl">Sales on this code</span></div>
        <div class="v">${totalSales}</div><div class="d">${pct}% of the ${S.target} target</div>
        <div class="meter" style="margin-top:8px"><i style="width:${Math.min(100,pct)}%;background:var(--good)"></i></div></div>
      <div class="tile"><div class="k"><span class="lbl">Revenue</span></div><div class="v">${lakh(revenue)}</div><div class="d">${inr(Math.round(revenue/totalSales))} average order</div></div>
      <div class="tile"><div class="k"><span class="lbl">Spend</span></div><div class="v">${lakh(S.spend)}</div><div class="d">influencers, boosts</div></div>
      <div class="tile"><div class="k"><span class="lbl">Return on spend</span><span class="badge good">${roi}×</span></div><div class="v">${roi}<small>×</small></div><div class="d">revenue ÷ what it cost</div></div>
    </div>
    <div class="dashgrid">
      <div class="panel"><div class="panel-h"><h3>Which plan sold</h3><span class="hint">${totalSales} sales</span></div>
        ${hbars(S.plans.map(p=>({label:p.name, v:p.qty, c:p.c})), totalSales)}
        <div class="splitrows">${S.plans.map(p=>`<div class="srow"><span>${esc(p.name)}</span><b>${inr(p.qty*p.price)}</b><small>${p.qty} × ${inr(p.price)}</small></div>`).join("")}</div></div>
      <div class="panel"><div class="panel-h"><h3>Bought where</h3><span class="hint">app vs website</span></div>
        ${hbars(S.where.map(w=>({label:w.name, v:w.qty, c:w.c})), totalSales)}
        <p class="hint" style="margin:11px 0 0">${S.where[0].qty > S.where[1].qty ? `The app is doing the selling. Worth checking the website checkout isn't the reason.` : `The website leads — unusual for a push-led campaign, worth a look.`}</p></div>
      <div class="panel wide"><div class="panel-h"><h3>What drove the purchase</h3><span class="hint">last touch before buying · ${srcTotal} attributed</span></div>
        ${hbars(S.sources.map(s=>({ label:s.name, v:s.qty, c:(ITEM_KINDS[s.kind]||ITEM_KINDS.other).c, emo:(ITEM_KINDS[s.kind]||ITEM_KINDS.other).emo })), srcTotal)}
        <p class="hint" style="margin:12px 0 0">This is the number that should decide the next campaign's budget.
        If influencer videos keep outselling the channels you spend most time on, the plan is wrong, not the execution.</p></div>
    </div>`;
}

/* ============================================================ CALENDAR */
function weekOf(d){ const x=new Date(d+"T00:00:00"), off=(x.getDay()+6)%7;
  const s=new Date(x); s.setDate(x.getDate()-off); const e=new Date(s); e.setDate(s.getDate()+6); return [isoD(s), isoD(e)]; }
function passFilter(it){
  const F = CALFILTER;
  if(F.type!=="all" && it.kind!==F.type) return false;
  if(F.platform!=="all" && it.platform!==F.platform) return false;
  if(F.owner!=="all" && ownerName(it)!==F.owner) return false;
  if(F.range!=="all"){
    if(!it.date) return false;
    const a = F.anchor || TODAY;
    if(F.range==="day") return it.date===a;
    if(F.range==="week"){ const [s,e]=weekOf(a); return it.date>=s && it.date<=e; }
    if(F.range==="month") return it.date.slice(0,7)===a.slice(0,7);
  }
  return true;
}
const filterOn = () => CALFILTER.range!=="all" || CALFILTER.type!=="all" || CALFILTER.platform!=="all" || CALFILTER.owner!=="all";
function calendarPane(c){
  if(!c.items.length) return `<div class="empty">
    <h4>Nothing to show yet</h4>
    <p>Add items under Fill in Details and they appear here, arranged by date and coloured by type.</p>
    <button class="btn pri" data-ctab="details">Go to Fill in Details</button></div>`;
  const shown = c.items.filter(passFilter);
  const dated = shown.filter(i=>i.date), undated = shown.filter(i=>!i.date);
  const kinds = [...new Set(c.items.map(i=>i.kind))];
  const plats = [...new Set(c.items.map(i=>i.platform).filter(Boolean))];
  const owners = [...new Set(c.items.map(ownerName).filter(Boolean))];
  const sel = (id,label,value,opts) => `<label class="fsel"><span>${label}</span>
    <select data-cf="${id}">${opts.map(([v,t])=>`<option value="${esc(v)}" ${value===v?"selected":""}>${esc(t)}</option>`).join("")}</select></label>`;
  return `
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
      ${sel("type","Content type", CALFILTER.type, [["all","All types"], ...kinds.map(k=>[k, ITEM_KINDS[k]?.label || k])])}
      ${sel("platform","Platform / Category", CALFILTER.platform, [["all","All platforms"], ...plats.map(p=>[p,p])])}
      ${sel("owner","Accountable person", CALFILTER.owner, [["all","Everyone"], ...owners.map(o=>[o,o])])}
      ${filterOn()?`<button class="btn sm" id="clearFilter">Clear filters</button>`:""}
    </div>
    ${shown.length
      ? (CALVIEW==="flow" ? flowView(c, shown) : CALVIEW==="list" ? listView(c, shown) : gridView(c, shown))
      : `<div class="empty"><h4>Nothing matches these filters</h4><p>Loosen one of them, or clear them all.</p>
          <button class="btn" id="clearFilter2">Clear filters</button></div>`}
    <div class="legend" style="margin-top:16px">
      ${Object.entries(ITEM_KINDS).filter(([k])=>shown.some(i=>i.kind===k)).map(([,v])=>`<span><i style="background:${v.c}"></i>${esc(v.label)}</span>`).join("")}
    </div>`;
}
function monthGrid(y, m, shown, c){
  const start=(new Date(y,m,1).getDay()+6)%7, dim=new Date(y,m+1,0).getDate();
  let cells="";
  for(let i=0;i<start;i++) cells += `<div class="cday pad"></div>`;
  for(let d=1; d<=dim; d++){
    const key = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const its = shown.filter(i=>i.date===key);
    cells += `<div class="cday ${its.length?"has":""} ${key===TODAY?"today":""}">
      <span class="dn">${d}</span>
      ${its.map(it=>{ const k=kindOf(it), on=ownerName(it);
        return `<button class="cevt" style="border-left-color:${k.c};background:color-mix(in srgb,${k.c} 9%,transparent)" data-open="${esc(it.id)}" title="${esc(it.name)}">
          <b>${esc(it.name)}</b><span>${esc(kindName(it))}${on?" · "+esc(on):""}</span></button>`;}).join("")}
    </div>`;
  }
  return `<div class="calhead"><h3>${new Date(y,m,1).toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</h3></div>
    <div style="overflow-x:auto;margin-bottom:18px"><div class="cgrid">
      ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="cdow">${d}</div>`).join("")}${cells}
    </div></div>`;
}
function gridView(c, shown){
  const ds = campDates(shown);
  if(!ds.length) return `<div class="empty"><h4>No dates set yet</h4><p>Open an item and give it a day — the calendar fills in from there.</p></div>`;
  const first=new Date(ds[0]+"T00:00:00"), last=new Date(ds[ds.length-1]+"T00:00:00");
  let html="", y=first.getFullYear(), m=first.getMonth(), n=0;
  while((y<last.getFullYear() || (y===last.getFullYear() && m<=last.getMonth())) && n<12){   /* every month the campaign touches */
    html += monthGrid(y, m, shown, c); m++; if(m>11){ m=0; y++; } n++;
  }
  const undated = shown.filter(i=>!i.date);
  return html + (undated.length?`<div class="undated"><span class="lbl">No date yet</span>
      ${undated.map(it=>{ const k=kindOf(it);
        return `<button class="cevt" style="border-left-color:${k.c}" data-open="${esc(it.id)}"><b>${esc(it.name)}</b><span>${esc(kindName(it))}</span></button>`;}).join("")}
    </div>`:"");
}
function listView(c, shown){
  return `<div class="tw"><table style="min-width:900px">
    <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Platform / Category</th><th>Accountable</th><th>More details</th></tr></thead>
    <tbody>${sortItems(shown).map(it=>{ const k=kindOf(it), on=ownerName(it);
      return `<tr data-open="${esc(it.id)}" style="cursor:pointer">
        <td class="vol" style="white-space:nowrap">${it.date?`${dmy(it.date)}<small>${dowShortC(it.date)}</small>`:`<span class="miss">not set</span>`}</td>
        <td class="td-idea" style="border-left:3px solid ${k.c}">${esc(it.name)}</td>
        <td><span class="tag" style="background:color-mix(in srgb,${k.c} 15%,transparent);color:${k.c}">${esc(kindName(it).toLowerCase())}</span></td>
        <td>${it.platform?`<span class="chip">${esc(it.platform)}</span>`:"—"}</td>
        <td>${on?`<span class="who">${avatar(on)}${esc(on)}</span>`:`<span class="miss">nobody</span>`}</td>
        <td class="td-txt">${it.details?rich(it.details):"—"}</td></tr>`;}).join("")}
    </tbody></table></div>`;
}
function flowView(c, shown){
  const ds = campDates(shown);
  if(!ds.length) return `<div class="empty"><h4>No dates set yet</h4><p>The flowchart lays items out in the order they go out, so each one needs a day first.</p></div>`;
  return `<div class="flowwrap"><div class="flow">
    ${ds.map((d,i)=>{ const its = shown.filter(x=>x.date===d);
      return `<div class="fstage">
        <div class="fdate"><b>${dmy(d)}</b><span>${dowShortC(d)}</span></div>
        <div class="fitems">${its.map(it=>{ const k=kindOf(it), on=ownerName(it);
          return `<button class="fcard" style="border-color:${k.c};background:color-mix(in srgb,${k.c} 8%,transparent)" data-open="${esc(it.id)}">
            <span class="femo">${k.emo}</span><b>${esc(it.name)}</b>
            <span class="fmeta">${esc(kindName(it))}${it.platform?" · "+esc(it.platform):""}</span>
            ${on?`<span class="fwho">${avatar(on)}${esc(on)}</span>`:""}</button>`;}).join("")}</div>
      </div>${i<ds.length-1?`<div class="farrow">→</div>`:""}`; }).join("")}
  </div></div>
  <p class="hint" style="margin:12px 0 0">Reads left to right in the order things go out.${canEdit()?" Click any card to edit it.":""}</p>`;
}
function wireCalendar(c){
  const B = $("#body");
  B.querySelectorAll("[data-cv]").forEach(b=>b.onclick=()=>{ CALVIEW=b.dataset.cv; draw(); });
  B.querySelectorAll("[data-cf]").forEach(el=>el.onchange=()=>{
    const k=el.dataset.cf; CALFILTER[k]=el.value;
    if(k==="range" && el.value!=="all" && !CALFILTER.anchor) CALFILTER.anchor=TODAY;
    draw();
  });
  ["clearFilter","clearFilter2"].forEach(id=>{ const b=$("#"+id); if(b) b.onclick=()=>{ CALFILTER={range:"all",anchor:"",type:"all",platform:"all",owner:"all"}; draw(); }; });
  const g=$("#genFlow"); if(g) g.onclick=()=>{ CALVIEW = CALVIEW==="flow" ? "grid" : "flow"; draw(); };
  B.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>itemDialog(c, c.items.findIndex(x=>x.id===b.dataset.open)));
}

/* ============================================================ API */
window.CX = {
  tabs: [["details","Fill in Details"],["assign","Assignment & distribution of work"],["calendar","Calendar"],["dash","Dashboard"]],
  normalize: normalize,
  kinds: ITEM_KINDS,
  /* opt: { tab, canEdit(), canDelete(), people() → [{id,name,role}], save(space), saveQuiet(space),
            onHeader(space), remove(space), notify(space,item) → Promise<{sent,belled,reason}>,
            sendToProcess(space,item) → {cardId}|{error}, cardExists(space,cardId), goProcess(space),
            socialName(space), setTab(t) } */
  render: function(space, wrap, opt){
    mount();
    OPT = opt || {};
    if(SPACE!==space){ SPACE=space; ASSIGNFILTER="All"; CALFILTER={range:"all",anchor:"",type:"all",platform:"all",owner:"all"}; if(R) closeDialog(); }
    normalize(space);
    CTAB = ["details","assign","calendar","dash"].includes(OPT.tab) ? OPT.tab : "details";
    if(HOST.parentNode!==wrap) wrap.appendChild(HOST);
    draw();
  }
};
})();
