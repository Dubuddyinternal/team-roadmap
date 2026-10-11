/* =====================================================================
   SOCIAL MEDIA SPACE — Summary · Ideation · Content Process · Schedule
   (Cyberflow team app, tools.dubuddy.in)

   WHAT THIS IS: the whole Social Media space, built from the team's
   "Dubuddy Social Media Space" template (same layout, fonts and colours).
   index.html calls SX.render(space, host) whenever a Social Media space is
   open; everything is drawn inside a shadow root so the template's styles
   and the app's styles never touch each other.

   WHERE THE DATA LIVES:
     * ideas, cards, dropdown lists, Instagram counts, targets, culture line
       -> space.sx, saved with the rest of the team (team_data "cspaces").
     * YouTube subscribers + every video's numbers -> read live from the
       social_snapshots / social_posts tables, which the "sync-social" Edge
       Function fills every morning (supabase/stage7a_social_sync.sql).
     * Instagram is not connected yet: its follower count and post numbers
       are typed in by hand and marked "manual".
   ===================================================================== */
(function(){
"use strict";

/* ------------------------------------------------------------ styles */
const CSS = `
:host{display:block;
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
  color-scheme:light;
}
*{box-sizing:border-box}
[hidden]{display:none!important}
.kcard.hot{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.hotbar{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;background:var(--accent-soft);color:var(--accent-ink);border-radius:4px;padding:3px 7px;margin-bottom:8px;font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sxroot{color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;text-align:left}
h1,h2,h3,h4,h5,h6{margin:0;text-wrap:balance;font-weight:700;letter-spacing:-.018em}
p{margin:0}
button{font:inherit;color:inherit;cursor:pointer;background:none;border:none;padding:0}
input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
a{color:inherit}
.lbl{font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);font-weight:500}
.num{font-variant-numeric:tabular-nums}

.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.sec{margin-bottom:26px}
.sec-h{display:flex;align-items:baseline;gap:10px;margin-bottom:11px;flex-wrap:wrap}
.sec-h h3{font-size:16px}
.hint{font-size:12px;color:var(--ink-3)}
.chip{font-family:var(--mono);font-size:11px;border:1px solid var(--line-2);border-radius:999px;padding:4px 10px;color:var(--ink-2);background:var(--surface)}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.tag{font-family:var(--mono);font-size:10.5px;padding:2.5px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink);font-weight:500;white-space:nowrap}
.plat{font-family:var(--mono);font-size:10.5px;font-weight:600;padding:2.5px 7px;border-radius:5px;white-space:nowrap}
.badge{font-family:var(--mono);font-size:10px;letter-spacing:.05em;padding:3px 8px;border-radius:5px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.badge.good{background:var(--good-soft);color:var(--good)} .badge.warn{background:var(--warn-soft);color:var(--warn)}
.badge.crit{background:var(--crit-soft);color:var(--crit)} .badge.mute{background:var(--surface-2);color:var(--ink-3)}
.btn{border:1px solid var(--line-2);background:var(--surface);border-radius:var(--r-s);padding:7px 13px;font-size:12.5px;font-weight:600;color:var(--ink-2)}
.btn:hover{border-color:var(--ink-3)}
.btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.btn:disabled{opacity:.42;cursor:not-allowed}
.btn.sm{padding:4px 9px;font-size:11.5px}
.btn.danger{color:var(--crit);border-color:color-mix(in srgb,var(--crit) 40%,var(--line-2))}

.apibar{display:flex;gap:11px;align-items:flex-start;background:var(--warn-soft);border:1px solid color-mix(in srgb,var(--warn) 32%,transparent);border-radius:var(--r);padding:12px 14px;margin-bottom:20px}
.apibar .ic{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--warn);border:1.5px solid var(--warn);border-radius:5px;padding:2px 6px;flex-shrink:0;margin-top:1px}
.apibar p{margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.55;flex:1;min-width:0}
.apibar b{color:var(--ink)}
.apibar.live{background:var(--good-soft);border-color:color-mix(in srgb,var(--good) 30%,transparent)}
.apibar.live .ic{color:var(--good);border-color:var(--good)}
.apibar.bad{background:var(--crit-soft);border-color:color-mix(in srgb,var(--crit) 30%,transparent)}
.apibar.bad .ic{color:var(--crit);border-color:var(--crit)}

.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:11px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:13px 14px;min-width:0}
.tile .k{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:7px}
.tile .v{font-size:27px;font-weight:700;letter-spacing:-.035em;line-height:1.08;font-variant-numeric:tabular-nums}
.tile .v small{font-size:14px;font-weight:600;color:var(--ink-3);letter-spacing:0}
.tile .d{font-size:11.5px;color:var(--ink-3);margin-top:5px;line-height:1.4}
.tile[data-tile]{cursor:pointer;transition:border-color .12s,box-shadow .12s}
.tile[data-tile]:hover{border-color:var(--ink-3)}
.tile.open{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.tile .more{font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:var(--ink-3);margin-top:8px;text-transform:uppercase}
.tile.open .more{color:var(--accent)}
.tdetail{grid-column:1/-1;background:var(--surface);border:1px solid var(--accent);box-shadow:0 0 0 1px var(--accent);border-radius:var(--r);padding:16px 18px}
.tdetail .dh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.tdetail .dh h4{font-size:15px}
.dstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:9px;margin-bottom:16px}
.dstats div{background:var(--surface-4);border:1px solid var(--line);border-radius:var(--r-s);padding:9px 11px;min-width:0}
.dstats b{display:block;font-size:19px;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.2;margin-top:2px}
.dstats small{display:block;font-size:11px;color:var(--ink-3);line-height:1.35}
.dgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:18px;margin-bottom:16px}
.dblock .lbl{display:block;margin-bottom:7px}
.hbar{display:grid;grid-template-columns:minmax(70px,120px) 1fr auto;gap:9px;align-items:center;font-size:12px;padding:3px 0}
.hbar .hl{color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hbar .ht{height:10px;background:var(--surface-2);border-radius:999px;overflow:hidden}
.hbar .ht i{display:block;height:100%;border-radius:999px;min-width:2px}
.hbar .hv{font-family:var(--mono);font-size:11.5px;color:var(--ink-2);white-space:nowrap}
table.mini{min-width:640px}
table.mini td{padding:8px 10px;font-size:12.5px}
table.mini th{padding:8px 10px}

.okrs{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:13px}
.okr{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:15px 16px}
.okr-top{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:10px}
.okr-v{font-size:25px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.okr-t{font-size:12px;color:var(--ink-3);font-family:var(--mono)}
.meter{height:9px;background:var(--surface-2);border-radius:999px;overflow:hidden;border:1px solid var(--line)}
.meter i{display:block;height:100%;border-radius:999px}
.okr-foot{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:11.5px;color:var(--ink-3);flex-wrap:wrap}
.okr-v small{font-size:15px;font-weight:600;color:var(--ink-3);letter-spacing:-.01em}
.okr-more{margin-top:12px;border-top:1px solid var(--line);padding-top:9px}
.okr-more>button{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);display:flex;gap:6px;align-items:center;width:100%}
.okr-more>button:hover,.okr-more.open>button{color:var(--accent)}
.goal{padding:9px 0 2px}
.goal+.goal{border-top:1px dashed var(--line)}
.goal .gt{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;margin-bottom:5px;align-items:baseline}
.goal .gt b{font-variant-numeric:tabular-nums}
.goal .gt span{color:var(--ink-2)}
.goal .meter{height:7px}
.goal .gf{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--ink-3);margin-top:4px}
.cpair{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;width:100%;text-align:left;font-size:12px;padding:7px 8px;border:1px solid var(--line);border-radius:var(--r-s);background:var(--surface);margin-bottom:6px;align-items:center}
.cpair:hover{border-color:var(--accent)}
.cpair span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmpt td.win{color:var(--good);font-weight:700}
.geo-bar{cursor:pointer;border-radius:8px;padding:3px 6px;margin:0 -6px}
.geo-bar:hover{background:var(--surface-2)}
.geo-bar.on{background:var(--surface-2);outline:1px solid var(--line-2)}
.geo-bar.on .hl{color:var(--ink);font-weight:600}
.geo-note{font-size:12px;color:var(--ink-3);margin:10px 0 0;line-height:1.5}
.platsw{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.platsw button{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line-2);background:var(--surface);border-radius:999px;padding:8px 16px;font-size:13.5px;font-weight:600;color:var(--ink-2)}
.platsw button.on{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.platsw .hint{margin-left:8px}
.fpanel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;margin-bottom:12px}
.fhead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;font-size:12.5px;color:var(--ink-2)}
.fhead select,.frow select,.frow input,.fsaved select{background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r-s);padding:6px 9px;font-size:12.5px}
.frow{display:grid;grid-template-columns:24px minmax(170px,1.2fr) minmax(150px,1fr) minmax(220px,2fr) 30px;gap:8px;align-items:center;margin-bottom:7px;max-width:1100px}
.frow .fj{font-family:var(--mono);font-size:10px;color:var(--ink-3);text-transform:uppercase;text-align:right}
.frow .fv{display:flex;gap:6px;align-items:center}
.frow .fv input,.frow .fv select{flex:1;min-width:0;width:100%}
.frow .x{border:1px solid var(--line-2);border-radius:var(--r-s);padding:5px 0;text-align:center;color:var(--ink-3)}
.fpresets{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}
.fsaved{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
th.sortable{cursor:pointer;user-select:none}
.ck{width:16px;height:16px;accent-color:var(--accent);cursor:pointer;vertical-align:middle}
tr.picked td{background:var(--accent-soft)}
.bulkbar{position:sticky;top:0;z-index:5;display:flex;gap:9px;align-items:center;flex-wrap:wrap;background:var(--ink);color:var(--bg);border-radius:var(--r);padding:10px 14px;margin-bottom:10px;font-size:12.5px}
.bulkbar input{background:var(--surface);color:var(--ink);border:none;border-radius:var(--r-s);padding:6px 9px;font-size:12.5px;width:150px}
.bulkbar .btn{background:transparent;color:var(--bg);border-color:color-mix(in srgb,var(--bg) 40%,transparent)}
.bulkbar .btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.ptag{font-family:var(--mono);font-size:10.5px;padding:2px 7px;border-radius:999px;background:var(--surface-2);color:var(--ink-2);white-space:nowrap;display:inline-block;margin:1px 2px 1px 0}
.ptag b{font-weight:600;color:var(--ink)}
th.sortable:hover,th.sorted{color:var(--accent)}
.fcount{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:999px;background:var(--accent);color:#fff;font-size:10.5px;font-family:var(--mono);padding:0 5px}
.slacard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);margin-bottom:18px;overflow:hidden}
.slah{display:flex;align-items:center;gap:10px;padding:14px 18px;background:var(--surface-4);border-bottom:1px solid var(--line)}
.slah h4{font-size:15px}
.sdot{width:10px;height:10px;border-radius:3px;display:block}
.slab{padding:18px}
.tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:18px 16px}
.tf label{display:block;font-size:12.5px;color:var(--ink-2);margin-bottom:6px;font-weight:500}
.tf .req{color:var(--crit);margin-left:2px}
.tin{display:flex;border:1px solid var(--line-2);border-radius:var(--r-s);background:var(--surface);overflow:hidden}
.tin:focus-within{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.tin input,.tin select{border:none;background:transparent;padding:9px 11px;font-size:13.5px;min-width:0;outline:none}
.tin input{flex:1 1 50%;width:50%}
.tin select{flex:1 1 50%;border-left:1px solid var(--line-2);cursor:pointer}
.tin .tunit{flex:1 1 50%;border-left:1px solid var(--line-2);padding:9px 11px;font-size:13px;color:var(--ink-3);background:var(--surface-4)}
.tin input:disabled,.tin select:disabled{color:var(--ink-2);cursor:default}
.tcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px}
.tchips{display:flex;gap:7px;flex-wrap:wrap}
.tchip{font-size:12px;border:1px solid var(--line);background:var(--surface-4);border-radius:999px;padding:4px 11px;color:var(--ink-2);white-space:nowrap}
.tchip b{color:var(--ink);font-variant-numeric:tabular-nums}
.trow{max-width:720px;display:grid;grid-template-columns:minmax(160px,1.4fr) 140px 140px 30px;gap:8px;align-items:center;margin-bottom:8px}
.trow select,.trow input{width:100%;background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r-s);padding:7px 9px;font-size:12.5px}
.trow .x{border:1px solid var(--line-2);border-radius:var(--r-s);padding:6px 0;text-align:center;color:var(--ink-3)}
.trow.head span{font-family:var(--mono);font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}
@media (max-width:860px){ .trow{grid-template-columns:1fr 1fr} .trow.head{display:none} }

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
.tt{position:fixed;z-index:9990;background:var(--ink);color:var(--bg);font-size:11.5px;font-family:var(--mono);padding:6px 9px;border-radius:6px;pointer-events:none;opacity:0;transition:opacity .1s;white-space:pre;line-height:1.5}

.tw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
table{border-collapse:collapse;width:100%;min-width:1800px}
th{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);font-weight:500;white-space:nowrap;background:var(--surface-4)}
td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top;font-size:13px}
tr:last-child td{border-bottom:none}
tbody tr:hover{background:var(--surface-4)}
.td-idea{font-weight:600;min-width:218px;max-width:300px}
.td-idea a{text-decoration:none}
.td-idea a:hover{text-decoration:underline}
.td-txt{color:var(--ink-2);font-size:12px;min-width:160px;max-width:230px;line-height:1.45}
.td-kw{min-width:200px}
.kwrow{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:1.5px 0}
.kwrow .k{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kwrow.pri .k{font-weight:600;color:var(--ink)}
.kwrow.sec{color:var(--ink-3);font-size:11.5px}
.kwrow .v{font-family:var(--mono);font-variant-numeric:tabular-nums;flex-shrink:0;color:var(--ink-2)}
.vol{font-variant-numeric:tabular-nums;font-family:var(--mono);font-size:12px;white-space:nowrap}
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
.thumb{width:64px;height:36px;object-fit:cover;border-radius:5px;border:1px solid var(--line);flex-shrink:0;display:block}

.board{display:grid;grid-auto-flow:column;grid-auto-columns:258px;gap:11px;overflow-x:auto;padding-bottom:12px}
.col{background:var(--surface-3);border-radius:var(--r);padding:11px;min-width:0;transition:background .12s,box-shadow .12s}
.col.over{background:var(--accent-soft);box-shadow:inset 0 0 0 2px var(--accent)}
.col.no{box-shadow:inset 0 0 0 2px var(--crit)}
.col-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:6px}
.col-h h4{font-size:12.5px}
.count{font-family:var(--mono);font-size:11px;color:var(--ink-3);background:var(--surface);border-radius:999px;padding:1px 7px;border:1px solid var(--line)}
.kcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-s);padding:11px;margin-bottom:8px;text-align:left;width:100%;display:block;cursor:grab}
.kcard.ro{cursor:pointer}
.kcard:hover{border-color:var(--ink-3)}
.kcard.dragging{opacity:.4;cursor:grabbing}
.kcard h5{font-size:12.5px;font-weight:600;margin:0 0 7px;line-height:1.38}
.kcard .meta{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
.gates{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}
.gchip{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;padding:2px 6px;border-radius:4px;background:var(--surface-2);color:var(--ink-3);display:inline-flex;gap:3px;align-items:center}
.gchip.ok{background:var(--good-soft);color:var(--good)}
.gchip.no{background:var(--crit-soft);color:var(--crit)}
.dashed{border:1px dashed var(--line-2);border-radius:var(--r);padding:9px;text-align:center;color:var(--ink-3);font-size:12.5px;font-family:var(--mono)}

.scrim{position:fixed;inset:0;background:rgba(10,8,5,.42);z-index:9960;opacity:0;pointer-events:none;transition:opacity .16s}
.scrim.on{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100%);background:var(--bg);border-left:1px solid var(--line);z-index:9970;transform:translateX(100%);transition:transform .2s ease;overflow-y:auto;padding:20px 22px calc(40px + env(safe-area-inset-bottom,0px));padding-top:calc(20px + env(safe-area-inset-top,0px));font-family:var(--sans);font-size:14px;line-height:1.5;color:var(--ink)}
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
.livegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.livegrid div{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-s);padding:8px 10px}
.livegrid b{display:block;font-size:17px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}

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

.rvgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.rvcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:15px 16px;display:flex;flex-direction:column;gap:10px}
.rvcard h4{font-size:15px;margin:0}
.rvcard a.chip{text-decoration:none}
.rvtry{background:var(--accent-soft);border-radius:var(--r-s);padding:9px 11px}
.rvtry p{margin:3px 0 8px;font-size:12.5px;color:var(--ink);line-height:1.45}
.rvtab{min-width:860px}
.rvtab tr.us td{background:var(--good-soft)}
.rvname{font-weight:600;text-align:left;color:var(--ink)}
.rvname:hover{color:var(--accent)}
.note{background:var(--note);border:1px solid var(--note-line);border-radius:var(--r);padding:16px 18px;font-family:var(--hand);font-size:19px;color:var(--note-ink);line-height:1.42}
.note .lbl{color:var(--note-lbl);margin-bottom:7px}
.note b{font-weight:700}
.note em{font-style:normal;text-decoration:underline;text-decoration-color:var(--note-lbl);text-underline-offset:3px}

.toast{position:fixed;left:50%;transform:translateX(-50%) translateY(14px);bottom:calc(22px + env(safe-area-inset-bottom,0px));background:var(--ink);color:var(--bg);font-size:12.5px;font-weight:600;padding:10px 16px;border-radius:999px;z-index:9995;opacity:0;pointer-events:none;transition:all .18s;max-width:90vw;text-align:center;font-family:var(--sans)}
.toast.on{opacity:1;transform:translateX(-50%)}

@media (max-width:860px){
  .grid2{grid-template-columns:1fr}
  .kwed,.kwhead{grid-template-columns:1fr 80px 84px 28px}
  .livegrid{grid-template-columns:1fr 1fr}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

/* ------------------------------------------------------------ fixed lists */
const DEFAULT_REG = {
  platform: { ig:"Instagram", yt:"YouTube" },
  vtype:    { reel:"Reel", long:"Long video", short:"Short", carousel:"Carousel", live:"Live", image:"Image" },
  source:   { keyword:"Keyword research", comment:"Student comment", trend:"Trend", product:"Product" },
  tool:     { vidiq:"vidIQ", trends:"Google Trends", suggest:"YouTube suggest", ahrefs:"Ahrefs", manual:"Manual / none" }
};
const STAGES = [
  {id:"todo",label:"To Do"},{id:"draft",label:"Draft"},{id:"inprogress",label:"In Progress"},
  {id:"inreview",label:"In Review"},{id:"approved",label:"Approved"},{id:"published",label:"Published"}
];
const OLD_COL = { todo:"todo", draft:"draft", progress:"inprogress", review:"inreview", approved:"approved", published:"published" };
const REJECT_REASONS = ["Keyword too broad","Search volume too low","Already covered","Off-brand for Dubuddy","Wrong format for the topic","Not enough to say","Timing is wrong"];
const STATUS_UI = { new:{label:"New",cls:""}, under_review:{label:"Under review",cls:"warn"},
  accepted:{label:"Accepted",cls:"good"}, rejected:{label:"Rejected",cls:"crit"}, parked:{label:"Parked",cls:""} };

/* ------------------------------------------------------------ data shape */
// space.sx = { ideas, cards, reg, igFollowers:[{d,v}], targets:{yt,ig}, culture }
function normalize(space){
  let s = space.sx;
  if(!s || typeof s!=="object"){
    s = { ideas:[], cards:[] };
    // carry over anything typed into the older Social Media board
    (space.ideas||[]).forEach(o=>{ if(!o || !o.title) return;
      s.ideas.push(blankIdea({ id:o.id||uid("i"), idea:String(o.title), why:String(o.note||"") })); });
    (space.cards||[]).forEach(o=>{ if(!o || !o.title) return;
      const c = blankCard({ id:o.id||uid("c"), idea:String(o.title), stage:OLD_COL[o.col]||"todo" });
      if(o.fromIdea && s.ideas.some(i=>i.id===o.fromIdea)){ c.ideaId=o.fromIdea; const i=s.ideas.find(x=>x.id===o.fromIdea); i.status="accepted"; }
      s.cards.push(c); });
  }
  s.ideas = Array.isArray(s.ideas) ? s.ideas : [];
  s.cards = Array.isArray(s.cards) ? s.cards : [];
  s.reg = s.reg && typeof s.reg==="object" ? s.reg : {};
  Object.keys(DEFAULT_REG).forEach(k=>{ s.reg[k] = Object.assign({}, DEFAULT_REG[k], s.reg[k]||{}); });
  s.igFollowers = Array.isArray(s.igFollowers) ? s.igFollowers.filter(f=>f && f.d && f.v!=null) : [];
  s.targets = Object.assign({ yt:80000, ig:20000 }, s.targets||{});
  // other targets: [{id, platform:"yt"|"ig", metric, period:"week"|"month"|"quarter", target}]
  s.goals = Array.isArray(s.goals) ? s.goals.filter(g=>g && GOAL_METRICS[g.metric]) : [];
  s.culture = typeof s.culture==="string" ? s.culture : "";
  // Keep an Eye on 2nd Love: competitor accounts [{id, name, ig, yt, readings:[{d,ig,yt,igPosts,ytPosts,topViews}], f:{…}, ideaId}]
  s.rivals = Array.isArray(s.rivals) ? s.rivals.filter(r=>r && r.name) : [];
  s.rivals.forEach(r=>{ if(!r.id) r.id=uid("rv"); r.f = r.f && typeof r.f==="object" ? r.f : {}; r.readings = Array.isArray(r.readings) ? r.readings.filter(x=>x && x.d) : []; });
  s.manual = s.manual && typeof s.manual==="object" ? s.manual : {};   // typed-in counts: "yt:webinars:2026-10-06" -> n
  s.postTags = s.postTags && typeof s.postTags==="object" ? s.postTags : {};
  // Reels' new followers, typed in from Instagram Insights (Meta's API won't give them): post key -> n
  s.typedFollows = s.typedFollows && typeof s.typedFollows==="object" ? s.typedFollows : {};   // post key -> {tag name: value}
  s.views = Array.isArray(s.views) ? s.views.filter(v=>v && Array.isArray(v.rules)) : [];   // saved post filters
  // any field missing on an older record gets its default, so nothing below can trip on it
  const fill=(o,d)=>{ Object.keys(d).forEach(k=>{ if(o[k]===undefined || o[k]===null && typeof d[k]==="string") o[k]=d[k]; }); return o; };
  s.ideas.forEach(i=>{ fill(i, blankIdea({ id:i.id||uid("i"), created:i.created||today() }));
    i.comments = Array.isArray(i.comments) ? i.comments : []; i.keywords = Array.isArray(i.keywords) ? i.keywords : [];
    if(!STATUS_UI[i.status]) i.status="new"; });
  s.cards.forEach(c=>{ fill(c, blankCard({ id:c.id||uid("c") })); c.pre = c.pre || {}; c.pre.keywords = Array.isArray(c.pre.keywords) ? c.pre.keywords : [];
    c.post = c.post || {reel:null,thumb:null,postUrl:""}; if(!STAGES.some(x=>x.id===c.stage)) c.stage="todo"; });
  space.sx = s;
  return s;
}
function uid(p){ return p + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function blankIdea(o){ return Object.assign({ id:uid("i"), idea:"", by:"", created:today(), hook:"", cta:"", platform:"ig", vtype:"reel",
  source:"", tool:"", keywords:[], title:"", desc:"", hashtags:"", why:"", studentWhy:"", status:"new", comments:[] }, o||{}); }
function blankCard(o){ return Object.assign({ id:uid("c"), ideaId:null, idea:"", platform:"ig", vtype:"reel", stage:"todo",
  pre:{source:"",tool:"",keywords:[],why:"",title:"",desc:"",hashtags:""},
  post:{reel:null,thumb:null,postUrl:""}, scheduled:null, published:null, acceptedOn:today(), metrics:null, override:null }, o||{}); }

/* ------------------------------------------------------------ module state */
let SPACE=null, S=null, IDEAS=[], CARDS=[], REG=DEFAULT_REG, HOST=null, R=null, OPT={};
let TAB="summary", CHARTMODE="bar";
const FILTERS = { period:"month", vtypes:null, platforms:null };
const SCHED = { view:"month", cursor:null, vtypes:null, platforms:null };
const LIVE = { team:null, status:"idle", posts:[], snaps:[], geo:[], lastAt:null, err:"", syncing:false };

/* ------------------------------------------------------------ helpers */
const $ = s => R.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => n==null ? "—" : Number(n).toLocaleString("en-IN");
const kfmt = n => n==null ? "—" : n>=1000 ? (n/1000).toFixed(n>=10000?0:1)+"k" : String(n);
const mb = b => b==null ? "" : b>=1e9 ? (b/1e9).toFixed(1)+" GB" : (b/1e6).toFixed(0)+" MB";
const dmy = s => s ? new Date(s+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : "—";
const dow = s => s ? new Date(s+"T00:00:00").toLocaleDateString("en-GB",{weekday:"long"}) : "";
const days = (a,b) => Math.round((new Date(b)-new Date(a))/86400000);
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function today(){ return iso(new Date()); }
function addDays(s,n){ const d=new Date(s+"T00:00:00"); d.setDate(d.getDate()+n); return iso(d); }
const mmss = s => s==null ? "—" : Math.floor(s/60)+":"+String(Math.round(s%60)).padStart(2,"0");
function ago(t){ if(!t) return "never"; const m=Math.round((Date.now()-new Date(t).getTime())/60000);
  return m<2 ? "just now" : m<60 ? m+" min ago" : m<1440 ? Math.round(m/60)+" h ago" : Math.round(m/1440)+" days ago"; }
function canEdit(){ return !!(OPT.canEdit && OPT.canEdit()); }
function meName(){ try{ return (OPT.me && OPT.me()) || ""; }catch(_){ return ""; } }

function hue(name){ let h=0; for(const ch of String(name)) h=(h*31+ch.charCodeAt(0))%360; return h; }
function avatar(name){ const n=String(name||"?").trim()||"?";
  return `<span class="av" style="background:hsl(${hue(n)} 48% 42%)">${esc(n[0].toUpperCase())}</span>`; }
const who = n => `<span class="who">${avatar(n)}${esc(n||"—")}</span>`;
const VBASE = {reel:"var(--c1)",long:"var(--c2)",short:"var(--c3)",carousel:"var(--c4)",live:"var(--crit)",image:"var(--good)"};
function vtypeColor(k){ return VBASE[k] || ["var(--c2)","var(--c4)","var(--c1)","var(--c3)"][hue(k)%4]; }
const regLabel = (kind,k) => REG[kind][k] || "";
const vtypeLabel = k => regLabel("vtype",k) || k;
const vtag = v => `<span class="tag" style="background:color-mix(in srgb,${vtypeColor(v)} 15%,transparent);color:${vtypeColor(v)}">${esc(vtypeLabel(v).toLowerCase())}</span>`;
function platColor(k){ return k==="yt"?"var(--c1)":k==="ig"?"var(--c3)":(hue(k)%2?"var(--c2)":"var(--c4)"); }
function platShort(k){ const l=regLabel("platform",k)||k; return k==="yt"?"YT":k==="ig"?"INSTA":l.toUpperCase().slice(0,7); }
const ptag = k => `<span class="plat" style="background:color-mix(in srgb,${platColor(k)} 15%,transparent);color:${platColor(k)}">${esc(platShort(k))}</span>`;
function toast(m){ const t=$("#toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove("on"),m.length>80?6000:2600); }

// every change goes through here: the app re-draws and saves for the team
function save(){
  if(!canEdit()){ toast("You can view this space but not edit it"); return false; }
  if(OPT.save) OPT.save();
  return true;
}
const slug = s => "x_"+String(s).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,28);
function regAdd(kind,label){
  label=String(label).trim(); if(!label) return "";
  const hit=Object.entries(REG[kind]).find(([,v])=>v.toLowerCase()===label.toLowerCase());
  if(hit) return hit[0];
  const k=slug(label)||("x_"+Date.now()); REG[kind][k]=label;
  if(kind==="platform"){ if(!FILTERS.platforms.includes(k)) FILTERS.platforms.push(k); if(!SCHED.platforms.includes(k)) SCHED.platforms.push(k); }
  if(kind==="vtype"){ if(!FILTERS.vtypes.includes(k)) FILTERS.vtypes.push(k); if(!SCHED.vtypes.includes(k)) SCHED.vtypes.push(k); }
  return k;
}

/* --- gates --- */
function gResearch(p){ const k=p.keywords||[]; const prim=k.find(x=>x.rank==="primary")||k[0];
  return !!(p.source && p.tool && prim && prim.kw && prim.vol!=null && p.why); }
function gCopy(p){ return !!(p.title && p.desc && p.hashtags); }
function gAssets(c){ return !!(c.post?.reel && c.post?.postUrl && (c.platform!=="yt" || c.post?.thumb)); }
function gateFor(f){ return f==="todo"?"research":f==="inprogress"?"copy":f==="approved"?"assets":null; }
function gatePass(c,g){ if(g==="research") return gResearch(c.pre)||!!c.override;
  if(g==="copy") return gCopy(c.pre); if(g==="assets") return gAssets(c); return true; }
const GATE_MSG = { research:"Research block incomplete — needs idea source, research tool, a primary keyword with its volume, and why this idea.",
  copy:"Title, description and hashtags must be confirmed before review.",
  assets:"Post-production incomplete — needs the edited file, the post link, and a thumbnail for YouTube." };
function canMove(c,to){ const fi=STAGES.findIndex(s=>s.id===c.stage), ti=STAGES.findIndex(s=>s.id===to);
  if(ti<=fi) return {ok:true};
  for(let i=fi;i<ti;i++){ const g=gateFor(STAGES[i].id); if(g&&!gatePass(c,g)) return {ok:false,msg:GATE_MSG[g]}; }
  return {ok:true}; }
function moveCard(c,to){ if(!canEdit()){ toast("You can view this space but not edit it"); return false; }
  const v=canMove(c,to); if(!v.ok){ toast(v.msg); return false; }
  if(to==="published"&&!c.published){ c.published=today();
    if(!c.metrics) c.metrics={views:null,likes:null,comments:null,shares:null,watch:null,ctr:null}; }
  c.stage=to; save(); return true; }

function periodStart(){ return addDays(today(), -(FILTERS.period==="week"?7:FILTERS.period==="month"?30:90)); }
function toggle(a,v){ const i=a.indexOf(v); if(i<0)a.push(v); else if(a.length>1)a.splice(i,1); }

/* --- growable select --- */
function regSelect(kind,id,val,placeholder,allowBlank=true){
  return `<select id="${id}">
    ${allowBlank?`<option value="">— choose —</option>`:""}
    ${Object.entries(REG[kind]).map(([k,v])=>`<option value="${k}" ${val===k?"selected":""}>${esc(v)}</option>`).join("")}
    <option value="__other">+ Write another…</option></select>
   <input id="${id}-other" class="otherin" placeholder="${esc(placeholder)}" hidden>`;
}
function wireReg(id){ const s=$("#"+id), o=$("#"+id+"-other"); if(!s||!o) return;
  s.addEventListener("change",()=>{ o.hidden = s.value!=="__other"; if(!o.hidden) o.focus(); }); }
function readReg(kind,id,fallback=""){ const s=$("#"+id); if(!s) return fallback;
  if(s.value==="__other"){ const t=$("#"+id+"-other").value.trim(); return t?regAdd(kind,t):fallback; }
  return s.value; }

/* ------------------------------------------------------------ live numbers */
function ytId(url){
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(url||""));
  return m ? m[1] : null;
}
// Instagram links: /p/<code>/, /reel/<code>/, /reels/<code>/, /tv/<code>/
function igCode(url){ const m=/instagram\.com\/(?:[^/]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/.exec(String(url||"")); return m?m[1]:null; }
function livePost(c){ if(!c) return null; const u=c.post&&c.post.postUrl;
  if(c.platform==="yt"){ const id=ytId(u); return id ? LIVE.posts.find(p=>p.platform==="youtube"&&p.external_id===id) || null : null; }
  if(c.platform==="ig"){ const k=igCode(u); return k ? LIVE.posts.find(p=>p.platform==="instagram"&&igCode(p.url)===k) || null : null; }
  return null; }
function cardForVideo(id){ return CARDS.find(c=>c.platform==="yt" && ytId(c.post&&c.post.postUrl)===id) || null; }
function cardForIg(url){ const k=igCode(url); return k ? CARDS.find(c=>c.platform==="ig" && igCode(c.post&&c.post.postUrl)===k) || null : null; }
// Instagram counts as connected once the sync has brought anything back
function igLive(){ return LIVE.snaps.some(r=>r.platform==="instagram") || LIVE.posts.some(p=>p.platform==="instagram"); }

async function loadLive(force){
  const team = OPT.team || "";
  if(!OPT.supa || !team){ LIVE.status="error"; LIVE.err="Not signed in"; return; }
  if(!force && LIVE.team===team && (LIVE.status==="ok" || LIVE.status==="loading")) return;
  LIVE.team=team; LIVE.status="loading";
  try{
    const since = addDays(today(), -130);
    const [p, s] = await Promise.all([
      OPT.supa.from("social_posts").select("platform,external_id,title,url,thumbnail,post_type,published_at,duration_s,views,likes,comments,shares,watch_minutes,avg_view_s,avg_view_pct,impressions,followers_gained,updated_at")
        .eq("team_slug", team).order("published_at", {ascending:false}).limit(2000),
      OPT.supa.from("social_snapshots").select("platform,day,followers,updated_at")
        .eq("team_slug", team).gte("day", since).order("day", {ascending:true}).limit(2000)
    ]);
    if(p.error) throw p.error; if(s.error) throw s.error;
    LIVE.posts = p.data || []; LIVE.snaps = s.data || [];
    // where the audience is (stage 9a); missing table = no location charts, nothing else breaks
    const g = await OPT.supa.from("social_geo").select("platform,kind,level,name,state,value,period,updated_at").eq("team_slug", team).limit(3000);
    LIVE.geo = g.error ? [] : (g.data || []);
    LIVE.lastAt = LIVE.snaps.reduce((m,r)=>!m||r.updated_at>m?r.updated_at:m, null);
    LIVE.status="ok"; LIVE.err="";
  }catch(e){ LIVE.status="error"; LIVE.err=(e && e.message) || "Could not load"; }
  if(HOST && HOST.isConnected) refresh();
}
async function syncNow(){
  if(LIVE.syncing) return;
  LIVE.syncing=true; refresh(); toast("Syncing with YouTube — this takes about a minute");
  try{
    const { data, error } = await OPT.supa.functions.invoke("sync-social", { body:{} });
    if(error) throw error;
    if(data && data.skipped) toast("Synced "+ago(data.last_sync)+" — numbers are already fresh");
    else if(data && data.youtube && data.youtube.error) toast("YouTube: "+data.youtube.error);
    else toast("YouTube numbers updated");
  }catch(e){ toast("Sync failed: "+((e && e.message)||"try again")); }
  LIVE.syncing=false;
  await loadLive(true);
}
function ytSeries(){ return LIVE.snaps.filter(r=>r.platform==="youtube" && r.followers!=null).map(r=>({d:r.day, v:Number(r.followers)})); }
function igSeries(){ if(igLive()) return LIVE.snaps.filter(r=>r.platform==="instagram" && r.followers!=null).map(r=>({d:r.day, v:Number(r.followers)}));
  return [...S.igFollowers].sort((a,b)=>a.d.localeCompare(b.d)).map(f=>({d:f.d, v:Number(f.v)})); }
// value on (or just before) a date
function valueAt(series, d){ let v=null; for(const p of series){ if(p.d<=d) v=p.v; else break; } return v; }
function weekly(series, weeks){
  if(!series.length) return [];
  const end = series[series.length-1].d, out=[];
  for(let w=weeks-1; w>=0; w--){ const d=addDays(end, -7*w); const v=valueAt(series, d); if(v!=null) out.push({d, v}); }
  return out;
}

// every published post, from YouTube (live) and from cards (manual), in one shape
function postRows(){
  const rows = [];
  LIVE.posts.forEach(p=>{
    const plat = p.platform==="youtube" ? "yt" : p.platform==="instagram" ? "ig" : p.platform;
    const vt = {"Short":"short","Long video":"long","Live":"live","Reel":"reel","Carousel":"carousel","Image":"image"}[p.post_type] || "long";
    const c = plat==="yt" ? cardForVideo(p.external_id) : plat==="ig" ? cardForIg(p.url) : null;
    rows.push({ key:"v:"+p.external_id, live:true, platform:plat, vtype:vt, title:p.title, url:p.url, thumb:p.thumbnail,
      date:p.published_at ? iso(new Date(p.published_at)) : null, views:p.views, likes:p.likes, comments:p.comments, shares:p.shares,
      watch:p.avg_view_s!=null ? mmss(p.avg_view_s) : null, viewed:p.avg_view_pct, card:c,
      watchMin:p.watch_minutes, dur:p.duration_s, at:p.published_at, avgS:p.avg_view_s, reach:p.impressions,
      gained: p.followers_gained!=null ? p.followers_gained : ((S.typedFollows||{})["v:"+p.external_id] ?? null),
      gainedTyped: p.followers_gained==null && (S.typedFollows||{})["v:"+p.external_id]!=null });
  });
  CARDS.filter(c=>c.stage==="published").forEach(c=>{
    if(livePost(c)) return;                          // already listed from the synced posts
    rows.push({ key:"c:"+c.id, live:false, platform:c.platform, vtype:c.vtype, title:c.pre.title||c.idea, url:c.post.postUrl||"",
      thumb:null, date:c.published, views:c.metrics?.views, likes:c.metrics?.likes, comments:c.metrics?.comments,
      shares:c.metrics?.shares, watch:c.metrics?.watch||null, viewed:null, ctr:c.metrics?.ctr, card:c,
      avgS:parseDur(c.metrics?.watch), dur:null, at:null, watchMin:null, gained:null, reach:null });
  });
  return rows;
}
// Summary platform switch: "all" | "yt" | "ig" — scopes the whole Summary
let PLATVIEW = "all";
const platOK = x => PLATVIEW==="all" || x.platform===PLATVIEW;
const TYPE_PLAT = { long:"yt", short:"yt", live:"yt", reel:"ig", carousel:"ig", image:"ig" };
const typeVisible = k => PLATVIEW==="all" || !TYPE_PLAT[k] || TYPE_PLAT[k]===PLATVIEW;
const inF = r => FILTERS.vtypes.includes(r.vtype) && FILTERS.platforms.includes(r.platform) && platOK(r);
function publishedInPeriod(){ const from=periodStart(); return postRows().filter(r=>r.date && r.date>=from && inF(r)).sort((a,b)=>b.date.localeCompare(a.date)); }

/* ------------------------------------------------------------ charts */
function activateTips(root){ const tt=$("#tt"); root.querySelectorAll("[data-tip]").forEach(el=>{ const t=el.getAttribute("data-tip");
  el.addEventListener("pointerenter",()=>{ tt.textContent=t; tt.style.opacity="1"; });
  el.addEventListener("pointermove",e=>{ tt.style.left=(e.clientX+13)+"px"; tt.style.top=(e.clientY-10)+"px"; });
  el.addEventListener("pointerleave",()=>{ tt.style.opacity="0"; }); }); }

function barChart(rows,w=330,h=180){
  if(!rows.some(r=>r.v)) return `<p class="hint">No posts match these filters.</p>`;
  const max=Math.max(...rows.map(r=>r.v),1),padL=14,padB=30,padT=16,gap=14;
  const bw=(w-padL*2-gap*(rows.length-1))/rows.length, ch=h-padB-padT;
  const grid=[0,.5,1].map(t=>{const y=padT+ch-t*ch;return `<line x1="${padL}" y1="${y}" x2="${w-padL}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`;}).join("");
  const bars=rows.map((r,i)=>{const bh=r.v?Math.max(r.v/max*ch,3):0,x=padL+i*(bw+gap),y=padT+ch-bh;
    return `<g data-tip="${esc(r.label)}\n${r.v} ${r.v===1?"post":"posts"}">
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${r.color}"/>
      <rect x="${x}" y="${padT}" width="${bw}" height="${ch}" fill="transparent"/>
      <text x="${x+bw/2}" y="${y-5}" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--ink-2)">${r.v}</text>
      <text x="${x+bw/2}" y="${h-11}" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--ink-3)">${esc(r.short)}</text></g>`;}).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Posts by video type">${grid}${bars}</svg>`;
}
function donutChart(rows,w=330,h=180,center="POSTS",vf=String){
  const total=rows.reduce((s,r)=>s+r.v,0); if(!total) return `<p class="hint">No posts match these filters.</p>`;
  const cx=90,cy=h/2,R0=62,r0=38; let a0=-Math.PI/2,paths=""; const live=rows.filter(r=>r.v>0);
  live.forEach(r=>{ let a1=a0+(r.v/total)*Math.PI*2; if(live.length===1) a1-=0.0001; const big=(a1-a0)>Math.PI?1:0;
    const p=(a,rad)=>[cx+Math.cos(a)*rad,cy+Math.sin(a)*rad];
    const [x1,y1]=p(a0,R0),[x2,y2]=p(a1,R0),[x3,y3]=p(a1,r0),[x4,y4]=p(a0,r0);
    paths+=`<path d="M${x1} ${y1} A${R0} ${R0} 0 ${big} 1 ${x2} ${y2} L${x3} ${y3} A${r0} ${r0} 0 ${big} 0 ${x4} ${y4} Z"
      fill="${r.color}" stroke="var(--surface)" stroke-width="2" data-tip="${esc(r.label)}\n${vf(r.v)} of ${vf(total)} (${Math.round(r.v/total*100)}%)"/>`; a0=a1; });
  const keys=live.map((r,i)=>`<g transform="translate(176 ${cy-((live.length-1)*20)/2-5+i*20})">
    <rect width="9" height="9" rx="3" fill="${r.color}"/>
    <text x="16" y="9" font-size="11.5" fill="var(--ink-2)" font-family="var(--sans)">${esc(r.label.length>17?r.label.slice(0,16)+"…":r.label)}</text>
    <text x="140" y="9" text-anchor="end" font-size="11.5" font-family="var(--mono)" fill="var(--ink-3)">${vf(r.v)}</text></g>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Share of posts by video type">${paths}
    <text x="${cx}" y="${cy+1}" text-anchor="middle" font-size="19" font-weight="700" fill="var(--ink)" font-family="var(--sans)">${vf(total)}</text>
    <text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="9.5" font-family="var(--mono)" fill="var(--ink-3)">${center}</text>${keys}</svg>`;
}
function lineChart(series,color,label,w=320,h=168){
  if(series.length<2) return `<p class="hint" style="padding:40px 0;text-align:center">${series.length?"One reading so far — the trend appears from the second week.":"No readings yet."}</p>`;
  const padL=44,padR=14,padT=16,padB=26,cw=w-padL-padR,ch=h-padT-padB;
  const vals=series.map(p=>p.v),lo=Math.min(...vals),hi=Math.max(...vals),pd=(hi-lo)*0.22||hi*0.05||10;
  const step = hi>20000?500:hi>2000?100:10;
  const min=Math.max(0,Math.floor((lo-pd)/step)*step),max=Math.max(min+step,Math.ceil((hi+pd)/step)*step);
  const X=i=>padL+(i/(series.length-1))*cw, Y=v=>padT+ch-((v-min)/(max-min))*ch;
  const grid=[min,Math.round((min+max)/2/step)*step,max].map(t=>
    `<line x1="${padL}" y1="${Y(t)}" x2="${w-padR}" y2="${Y(t)}" stroke="var(--line)" stroke-width="1"/>
     <text x="${padL-7}" y="${Y(t)+3.5}" text-anchor="end" font-size="9.5" font-family="var(--mono)" fill="var(--ink-3)">${kfmt(t)}</text>`).join("");
  const d=series.map((p,i)=>`${i?"L":"M"}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const last=series[series.length-1];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="${esc(label)} audience trend">${grid}
    <path d="${d} L${X(series.length-1).toFixed(1)} ${padT+ch} L${padL} ${padT+ch} Z" fill="${color}" opacity="0.1"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(series.length-1).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/>
    ${series.map((p,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="9" fill="transparent" data-tip="${esc(label)} · ${dmy(p.d)}\n${fmt(p.v)} ${label==="YouTube"?"subscribers":"followers"}"/>`).join("")}
    <text x="${padL}" y="${h-8}" font-size="9.5" font-family="var(--mono)" fill="var(--ink-3)">${dmy(series[0].d)}</text>
    <text x="${w-padR}" y="${h-8}" text-anchor="end" font-size="9.5" font-family="var(--mono)" fill="var(--ink-3)">${dmy(last.d)}</text></svg>`;
}
function funnelChart(steps,w=330,h=180){
  const max=steps[0].v||1,padL=96,padR=42,bh=20,gap=12,top=14,cw=w-padL-padR;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Idea funnel">${
    steps.map((s,i)=>{const bw=Math.max(s.v/max*cw,3),y=top+i*(bh+gap);
      return `<g data-tip="${esc(s.label)}\n${s.v} ideas (${Math.round(s.v/max*100)}% of all logged)">
        <text x="${padL-9}" y="${y+14}" text-anchor="end" font-size="11" fill="var(--ink-2)" font-family="var(--sans)">${esc(s.label)}</text>
        <rect x="${padL}" y="${y}" width="${cw}" height="${bh}" rx="4" fill="var(--surface-2)"/>
        <rect x="${padL}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${s.color}"/>
        <text x="${padL+cw+7}" y="${y+14}" font-size="11" font-family="var(--mono)" fill="var(--ink-2)">${s.v}</text></g>`;}).join("")}</svg>`;
}

/* ------------------------------------------------------------ TARGETS
   Laid out like an SLA screen: one card per platform, one field per target
   (number + "per week/month…"), plus posting time and any extra targets.
   Stored apart from the rest of the space (team_data "socialTargets"), and the
   database only lets people whose role has "Edit social targets" save it. */
const GOAL_METRICS = {
  posts:    { label:"Posts published", calc:r=>r.length },
  longs:    { label:"Long videos", only:"yt", calc:r=>r.filter(x=>x.vtype==="long").length },
  shorts:   { label:"Shorts", only:"yt", calc:r=>r.filter(x=>x.vtype==="short").length },
  lives:    { label:"Live sessions", only:"yt", calc:r=>r.filter(x=>x.vtype==="live").length },
  webinars: { label:"Webinars", only:"yt", untracked:true },
  community:{ label:"Community posts", only:"yt", untracked:true },
  reels:    { label:"Reels", only:"ig", calc:r=>r.filter(x=>x.vtype==="reel").length },
  carousels:{ label:"Carousels", only:"ig", calc:r=>r.filter(x=>x.vtype==="carousel").length },
  images:   { label:"Single-image posts", only:"ig", calc:r=>r.filter(x=>x.vtype==="image").length },
  stories:  { label:"Stories", only:"ig", untracked:true },
  iglives:  { label:"Live sessions", only:"ig", untracked:true },
  views:    { label:"Views", calc:r=>sum(r,x=>x.views) },
  likes:    { label:"Likes", calc:r=>sum(r,x=>x.likes) },
  comments: { label:"Comments", calc:r=>sum(r,x=>x.comments) },
  shares:   { label:"Shares", calc:r=>sum(r,x=>x.shares) },
  watchh:   { label:"Watch hours", only:"yt", calc:r=>Math.round(sum(r,x=>x.watchMin)/60) },
  avgviews: { label:"Average views per post", noRate:true, calc:r=>r.length?Math.round(sum(r,x=>x.views)/r.length):0 },
  viewedpct:{ label:"Average % viewed", only:"yt", pct:true, noRate:true, calc:r=>{ const a=avg(r,x=>x.viewed); return a==null?0:Math.round(a); } },
  engage:   { label:"Engagement rate", pct:true, noRate:true, calc:r=>{ const v=sum(r,x=>x.views); return v?Math.round((sum(r,x=>x.likes)+sum(r,x=>x.comments)+sum(r,x=>x.shares))/v*1000)/10:0; } },
};
// the fields every platform card always shows, in order
const FIXED = { yt:["longs","shorts","lives","webinars","community","views"], ig:["reels","carousels","images","stories","iglives","views"] };
const GOAL_PERIODS = { day:"per day", week:"per week", month:"per month", quarter:"per quarter" };
const PERIOD_NOW = { day:"today", week:"this week", month:"this month", quarter:"this quarter" };
const POST_DAYS = { all:"Every day", weekdays:"Weekdays", weekends:"Weekends" };
const PLAT_NAME = { yt:"YouTube", ig:"Instagram" };
function calStart(period){ const d=new Date(); d.setHours(0,0,0,0);
  if(period==="week") d.setDate(d.getDate()-((d.getDay()+6)%7));
  else if(period==="month") d.setDate(1);
  else if(period==="quarter"){ d.setDate(1); d.setMonth(Math.floor(d.getMonth()/3)*3); }
  return iso(d); }
function calEnd(period){ const d=new Date(calStart(period)+"T00:00:00");
  if(period==="week") d.setDate(d.getDate()+6); else if(period==="month"){ d.setMonth(d.getMonth()+1); d.setDate(0); }
  else if(period==="quarter"){ d.setMonth(d.getMonth()+3); d.setDate(0); } return iso(d); }
function platRows(pl, from){ return postRows().filter(r=>r.platform===pl && r.date && r.date>=from); }

let TG = { targets:{yt:80000, ig:20000}, goals:[], plan:{yt:{time:"",days:"all"}, ig:{time:"",days:"all"}} };
function normTargets(o){
  o = o && typeof o==="object" ? JSON.parse(JSON.stringify(o)) : {};
  const t = { targets:Object.assign({yt:80000, ig:20000}, o.targets||{}),
    goals:(Array.isArray(o.goals)?o.goals:[]).filter(g=>g && GOAL_METRICS[g.metric] && GOAL_PERIODS[g.period] && (g.platform==="yt"||g.platform==="ig")),
    plan:{ yt:Object.assign({time:"",days:"all"}, (o.plan||{}).yt||{}), ig:Object.assign({time:"",days:"all"}, (o.plan||{}).ig||{}) } };
  t.goals.forEach(g=>{ if(!g.id) g.id=uid("g"); });
  return t;
}
function canEditTargets(){ return !!(OPT.canEditTargets && OPT.canEditTargets()); }

const manualKey=g=>`${g.platform}:${g.metric}:${calStart(g.period)}`;
function goalValue(g){ const m=GOAL_METRICS[g.metric];
  if(m.untracked){ const v=S.manual[manualKey(g)]; return v==null?0:Number(v); }
  return m.calc(platRows(g.platform, calStart(g.period))); }
function goalHTML(g,col){
  const m=GOAL_METRICS[g.metric], cur=goalValue(g), tgt=Number(g.target)||0, unit=m.pct?"%":"";
  const name=`${esc(m.label)} · ${fmt(tgt)}${unit} ${GOAL_PERIODS[g.period]}`;
  const pc=tgt?Math.min(100,cur/tgt*100):0, left=days(today(),calEnd(g.period))+1;
  return `<div class="goal"><div class="gt"><span>${name}</span><b>${fmt(cur)}${unit} / ${fmt(tgt)}${unit} ${PERIOD_NOW[g.period]}</b></div>
    <div class="meter"><i style="width:${pc}%;background:${cur>=tgt&&tgt?"var(--good)":col}"></i></div>
    ${m.untracked?`<div class="gf" style="margin-top:6px"><span>typed in by hand</span>${canEdit()?`<span>Done ${PERIOD_NOW[g.period]}:
      <input type="number" min="0" data-manual="${esc(manualKey(g))}" value="${cur}" style="width:64px;padding:2px 6px;border:1px solid var(--line-2);border-radius:5px;font:inherit;font-size:11.5px">
      <button class="btn sm" data-manualsave="${esc(manualKey(g))}" style="padding:2px 8px">Save</button></span>`:""}</div>`:""}
    <div class="gf"><span>${Math.round(pc)}%</span><span>${cur>=tgt&&tgt?"reached 🎉":m.noRate?`${left} day${left===1?"":"s"} left`:`${fmt(Math.max(0,tgt-cur))} to go · ${left} day${left===1?"":"s"} left`}</span></div></div>`;
}
// how many of this week's posts went out within an hour of the planned time
function postingTimeHTML(pl,col){
  const pt=TG.plan[pl]; if(!pt||!pt.time) return "";
  const [hh,mm]=pt.time.split(":").map(Number), want=hh*60+mm;
  const rows=platRows(pl, calStart("week")).filter(r=>r.at);
  const ok=rows.filter(r=>{ const d=new Date(r.at), m=d.getHours()*60+d.getMinutes(); return Math.abs(m-want)<=60; }).length;
  const label=new Date(2000,0,1,hh,mm).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"});
  return `<div class="goal"><div class="gt"><span>Posting time · ${esc(label)} · ${POST_DAYS[pt.days]||""}</span>
      <b>${rows.length?`${ok} of ${rows.length} on time`:"no posts yet this week"}</b></div>
    ${rows.length?`<div class="meter"><i style="width:${ok/rows.length*100}%;background:${col}"></i></div>
    <div class="gf"><span>${Math.round(ok/rows.length*100)}%</span><span>within an hour of ${esc(label)}, this week</span></div>`:""}</div>`;
}

let OKR_OPEN={}, TDRAFT=null, TG_KEY="";
function renderTargets(){
  const ro=!canEditTargets();
  if(!TDRAFT) TDRAFT=normTargets(TG);
  const D=TDRAFT;
  const unitSel=(attrs,val)=>`<select ${attrs}>${Object.entries(GOAL_PERIODS).map(([k,l])=>`<option value="${k}" ${val===k?"selected":""}>${l.replace("per ","Per ")}</option>`).join("")}</select>`;
  const field=(pl,metric)=>{ const g=D.goals.find(x=>x.platform===pl&&x.metric===metric)||{}; const m=GOAL_METRICS[metric];
    return `<div class="tf"><label>${esc(m.label)}${m.untracked?` <span class="hint" title="Not available from the ${PLAT_NAME[pl]} API — the team types in how many were done, on the Summary">· filled in by hand</span>`:""}</label>
      <div class="tin"><input type="number" min="0" step="any" data-fx="${pl}:${metric}" value="${g.target??""}" placeholder="—">
      ${unitSel(`data-fxp="${pl}:${metric}"`, g.period||"week")}</div></div>`; };
  const card=(pl,col,dot)=>{ const extra=D.goals.map((g,i)=>({g,i})).filter(x=>x.g.platform===pl && !FIXED[pl].includes(x.g.metric));
    const set=D.goals.filter(g=>g.platform===pl&&g.target>0).length+(D.plan[pl].time?1:0)+1;
    return `<div class="slacard">
      <div class="slah"><span class="sdot" style="background:${dot}"></span><h4>${PLAT_NAME[pl]}</h4>
        <span class="hint" style="margin-left:auto">${set} target${set===1?"":"s"} set</span></div>
      <div class="slab">
        <div class="tgrid">
          <div class="tf"><label>${pl==="yt"?"Subscribers":"Followers"} (total)<span class="req">*</span></label>
            <div class="tin"><input type="number" min="1" data-fol="${pl}" value="${D.targets[pl]}"><span class="tunit">in total</span></div></div>
          <div class="tf"><label>Posting time</label>
            <div class="tin"><input type="time" data-pt="${pl}" value="${esc(D.plan[pl].time)}">
            <select data-pd="${pl}">${Object.entries(POST_DAYS).map(([k,l])=>`<option value="${k}" ${D.plan[pl].days===k?"selected":""}>${l}</option>`).join("")}</select></div></div>
          ${FIXED[pl].map(m=>field(pl,m)).join("")}
        </div>
        ${extra.length?`<div class="lbl" style="margin:16px 0 8px">More targets</div>`+extra.map(({g,i})=>`<div class="trow" data-gi="${i}">
          <select data-gk="metric">${Object.entries(GOAL_METRICS).filter(([k,m])=>(!m.only||m.only===pl)&&!FIXED[pl].includes(k)).map(([k,m])=>`<option value="${k}" ${k===g.metric?"selected":""}>${esc(m.label)}</option>`).join("")}</select>
          <input data-gk="target" type="number" min="0" step="any" value="${g.target??""}" placeholder="target">
          ${unitSel('data-gk="period"', g.period)}
          <button class="x" data-gdel="${i}" title="Remove">×</button></div>`).join(""):""}
        ${ro?"":`<button class="btn sm" data-tadd="${pl}" style="margin-top:12px">+ Add another target</button>`}
      </div></div>`; };

  $("#pane-targets").innerHTML=`
    ${ro?`<div class="apibar"><span class="ic">VIEW ONLY</span><p><b>Only people allowed to edit targets can change these.</b>
      An owner can give a role the <b>Edit social targets</b> permission in Administration → Roles &amp; permissions.</p></div>`
      :`<div class="apibar live"><span class="ic">TARGETS</span><p><b>Set what the team is aiming for.</b> Progress shows on the Summary,
      under each platform's card (<b>Other targets ▾</b>). Counts come from posts published in the chosen period — weeks start Monday.
      Leave a field empty for no target.</p></div>`}
    <div class="sec">${card("yt","var(--c1)","var(--c1)")}${card("ig","var(--c3)","var(--c3)")}</div>
    ${ro?"":`<div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" id="tReset">Undo changes</button><button class="btn pri" id="tSave">Save targets</button></div>`}`;

  const P=$("#pane-targets");
  if(ro){ P.querySelectorAll("input,select").forEach(e=>e.disabled=true); return; }
  P.querySelectorAll("[data-tadd]").forEach(b=>b.onclick=()=>{ readTargets(); const pl=b.dataset.tadd;
    const free=Object.entries(GOAL_METRICS).find(([k,m])=>(!m.only||m.only===pl)&&!FIXED[pl].includes(k)&&!TDRAFT.goals.some(g=>g.platform===pl&&g.metric===k));
    TDRAFT.goals.push({id:uid("g"),platform:pl,metric:free?free[0]:"posts",period:"month",target:null}); renderTargets(); });
  P.querySelectorAll("[data-gdel]").forEach(b=>b.onclick=()=>{ readTargets(); TDRAFT.goals.splice(Number(b.dataset.gdel),1); renderTargets(); });
  $("#tReset").onclick=()=>{ TDRAFT=null; renderTargets(); toast("Changes undone"); };
  $("#tSave").onclick=()=>{ readTargets();
    if(!(TDRAFT.targets.yt>0)||!(TDRAFT.targets.ig>0)){ toast("Subscriber and follower targets must be numbers above zero"); return; }
    TDRAFT.goals=TDRAFT.goals.filter(g=>g.target>0);
    TG=normTargets(TDRAFT); TDRAFT=null;
    if(OPT.saveTargets){ OPT.saveTargets(SPACE, normTargets(TG)); toast("Targets saved"); } };
}
function readTargets(){ const P=$("#pane-targets"); if(!TDRAFT||!P) return;
  P.querySelectorAll("[data-fol]").forEach(e=>TDRAFT.targets[e.dataset.fol]=Number(e.value));
  P.querySelectorAll("[data-pt]").forEach(e=>TDRAFT.plan[e.dataset.pt].time=e.value);
  P.querySelectorAll("[data-pd]").forEach(e=>TDRAFT.plan[e.dataset.pd].days=e.value);
  P.querySelectorAll("[data-fx]").forEach(e=>{ const [pl,metric]=e.dataset.fx.split(":"), per=P.querySelector(`[data-fxp="${pl}:${metric}"]`).value;
    let g=TDRAFT.goals.find(x=>x.platform===pl&&x.metric===metric);
    if(!g){ g={id:uid("g"),platform:pl,metric,period:per,target:null}; TDRAFT.goals.push(g); }
    g.target=e.value===""?null:Number(e.value); g.period=per; });
  P.querySelectorAll(".trow[data-gi]").forEach(row=>{ const o=TDRAFT.goals[Number(row.dataset.gi)];
    row.querySelectorAll("[data-gk]").forEach(e=>{ o[e.dataset.gk]= e.dataset.gk==="target" ? (e.value===""?null:Number(e.value)) : e.value; }); });
}

/* ------------------------------------------------------------ KEYWORD PERFORMANCE
   Every published post that has a card with a primary keyword, grouped by that
   keyword: how its videos did against how many people search for it. */
const KW_COLORS=["var(--c1)","var(--c2)","var(--c3)","var(--c4)","var(--good)","var(--crit)","var(--ink-3)"];
let KW_SCOPE="all", KW_SORT="views", KW_CHART="views";
function keywordStats(){
  const from=KW_SCOPE==="period"?periodStart():"";
  const map={};
  postRows().filter(r=>r.card && r.date && r.date>=from && inF(r)).forEach(r=>{
    const ks=r.card.pre.keywords||[], p=ks.find(k=>k.rank==="primary")||ks[0]; if(!p||!p.kw) return;
    const key=p.kw.trim().toLowerCase();
    const g=map[key]||(map[key]={kw:p.kw.trim(),vol:null,rows:[],secondary:new Set()});
    if(p.vol!=null) g.vol=Math.max(g.vol||0,Number(p.vol));
    ks.filter(k=>k!==p&&k.kw).forEach(k=>g.secondary.add(k.kw));
    g.rows.push(r);
  });
  const list=Object.values(map).map(g=>{ const v=sum(g.rows,x=>x.views), eng=sum(g.rows,x=>x.likes)+sum(g.rows,x=>x.comments)+sum(g.rows,x=>x.shares);
    return { kw:g.kw, vol:g.vol, posts:g.rows.length, views:v, avgViews:Math.round(v/g.rows.length), eng:v?eng/v*100:null,
      viewed:avg(g.rows,x=>x.viewed), perK:g.vol?v/g.vol*1000:null, rows:g.rows, secondary:[...g.secondary] }; });
  const med=median(list.map(x=>x.avgViews))||0;
  list.forEach(x=>{ x.verdict = list.length<2 ? null : x.avgViews>=med*1.5 ? "strong" : x.avgViews<=med*0.6 ? "weak" : "average"; });
  return list;
}
function keywordSection(){
  const list=keywordStats();
  const sorted=[...list].sort((a,b)=>KW_SORT==="vol"?(b.vol||0)-(a.vol||0):KW_SORT==="avg"?b.avgViews-a.avgViews:KW_SORT==="eng"?(b.eng||0)-(a.eng||0):KW_SORT==="perk"?(b.perK||0)-(a.perK||0):b.views-a.views);
  const unlinked=postRows().filter(r=>!r.card && r.date && r.date>=(KW_SCOPE==="period"?periodStart():"") && inF(r)).length;
  const head=`<div class="sec-h"><h3>Keyword performance</h3>
    <span class="hint">Primary keyword of each published video, from its card — which searches bring the views</span>
    <div class="seg" style="margin-left:auto"><button data-kwscope="all" class="${KW_SCOPE==="all"?"on":""}">All time</button><button data-kwscope="period" class="${KW_SCOPE==="period"?"on":""}">Selected period</button></div></div>`;
  if(!list.length) return `<div class="sec">${head}<div class="card"><p class="hint" style="margin:0;max-width:80ch">
    No published video is linked to a card with a primary keyword yet. A video shows up here once its card in Content Process has a
    <b>primary keyword</b> (Research block) and its <b>Final post link</b> is the YouTube or Instagram link — accepted ideas carry their keyword over automatically.
    ${unlinked?`<br>${unlinked} published post${unlinked===1?" is":"s are"} not linked to a card yet.`:""}</p></div></div>`;
  const top=[...list].sort((a,b)=>(KW_CHART==="vol"?(b.vol||0)-(a.vol||0):b.views-a.views));
  const pie=top.slice(0,6).map((x,i)=>({label:x.kw,v:KW_CHART==="vol"?(x.vol||0):x.views,color:KW_COLORS[i]}));
  const rest=top.slice(6).reduce((t,x)=>t+(KW_CHART==="vol"?(x.vol||0):x.views),0); if(rest) pie.push({label:"Other keywords",v:rest,color:KW_COLORS[6]});
  const best=[...list].sort((a,b)=>b.avgViews-a.avgViews)[0], eff=[...list].filter(x=>x.perK!=null).sort((a,b)=>b.perK-a.perK)[0];
  const vb=v=>v==="strong"?`<span class="badge good">strong</span>`:v==="weak"?`<span class="badge crit">weak</span>`:v?`<span class="badge mute">average</span>`:"—";
  const th=(k,l)=>`<th><button data-kwsort="${k}" style="font:inherit;letter-spacing:inherit;text-transform:inherit;color:${KW_SORT===k?"var(--accent)":"inherit"}">${l}${KW_SORT===k?" ▾":""}</button></th>`;
  return `<div class="sec">${head}
    ${dstats([["Keywords tracked",list.length,`${sum(list,x=>x.posts)} linked video${sum(list,x=>x.posts)===1?"":"s"}`],
      ["Best performer",esc(best.kw.length>22?best.kw.slice(0,21)+"…":best.kw),`${fmt(best.avgViews)} views per video`],
      ["Best return on search",eff?esc(eff.kw.length>22?eff.kw.slice(0,21)+"…":eff.kw):"—",eff?`${fmt(Math.round(eff.perK))} views per 1,000 monthly searches`:"add search volumes"],
      ["Search volume covered",fmt(sum(list,x=>x.vol||0)),"monthly searches, all keywords"],
      ["Not linked yet",unlinked,"published posts with no card"]])}
    <div class="charts" style="margin-bottom:13px">
      <div class="chart-card"><div class="chart-head"><h4>${KW_CHART==="vol"?"Search volume by keyword":"Views by keyword"}</h4>
        <div class="seg"><button data-kwchart="views" class="${KW_CHART==="views"?"on":""}">Views</button><button data-kwchart="vol" class="${KW_CHART==="vol"?"on":""}">Search volume</button></div></div>
        <p class="chart-sub">${KW_CHART==="vol"?"Monthly searches for the keywords we targeted":"Share of views from videos targeting each keyword"}</p>
        ${donutChart(pie,330,180,KW_CHART==="vol"?"SEARCHES":"VIEWS",kfmt)}</div>
      <div class="chart-card"><div class="chart-head"><h4>Views per video vs search volume</h4></div>
        <p class="chart-sub">Bar = average views per video · grey figure = monthly searches</p>
        ${hbars("",[...list].sort((a,b)=>b.avgViews-a.avgViews).slice(0,8).map((x,i)=>({label:x.kw,v:x.avgViews,color:KW_COLORS[i%6],
          text:`${kfmt(x.avgViews)} · ${x.vol!=null?kfmt(x.vol)+" srch":"no vol"}`,tip:`${fmt(x.avgViews)} views per video · ${x.vol!=null?fmt(x.vol)+" monthly searches":"no search volume"}`})))}</div></div>
    <div class="tw"><table class="mini" style="min-width:1000px"><thead><tr><th>Primary keyword</th>${th("vol","Search vol / mo")}<th>Videos</th>${th("views","Total views")}${th("avg","Views / video")}
      ${th("perk","Views per 1k searches")}${th("eng","Engagement")}<th>Avg viewed</th><th>Verdict</th></tr></thead>
      <tbody>${sorted.map((x,i)=>`<tr data-kwrow="${i}" style="cursor:pointer"><td class="td-idea">${esc(x.kw)}${x.secondary.length?`<div class="hint" style="font-weight:400;margin-top:3px">also: ${esc(x.secondary.slice(0,3).join(", "))}</div>`:""}</td>
        <td class="vol">${x.vol!=null?fmt(x.vol):"—"}</td><td class="vol">${x.posts}</td><td class="vol">${fmt(x.views)}</td><td class="vol">${fmt(x.avgViews)}</td>
        <td class="vol">${x.perK!=null?fmt(Math.round(x.perK)):"—"}</td><td class="vol">${x.eng!=null?r1(x.eng)+"%":"—"}</td>
        <td class="vol">${x.viewed!=null?Math.round(x.viewed)+"%":"—"}</td><td>${vb(x.verdict)}</td></tr>`).join("")}</tbody></table></div>
    <p class="hint" style="margin-top:8px">Verdict compares views per video with the middle keyword: <b>strong</b> = 1.5× or more, <b>weak</b> = 0.6× or less.
      "Views per 1k searches" shows which keywords turn search demand into views best. Click a keyword to see its videos.</p></div>`;
}
function wireKeywords(P){
  P.querySelectorAll("[data-kwscope]").forEach(b=>b.onclick=()=>{ KW_SCOPE=b.dataset.kwscope; renderSummary(); });
  P.querySelectorAll("[data-kwsort]").forEach(b=>b.onclick=()=>{ KW_SORT=b.dataset.kwsort; renderSummary(); });
  P.querySelectorAll("[data-kwchart]").forEach(b=>b.onclick=()=>{ KW_CHART=b.dataset.kwchart; renderSummary(); });
  const list=keywordStats(), sorted=[...list].sort((a,b)=>KW_SORT==="vol"?(b.vol||0)-(a.vol||0):KW_SORT==="avg"?b.avgViews-a.avgViews:KW_SORT==="eng"?(b.eng||0)-(a.eng||0):KW_SORT==="perk"?(b.perK||0)-(a.perK||0):b.views-a.views);
  P.querySelectorAll("tr[data-kwrow]").forEach(tr=>tr.onclick=()=>{
    const x=sorted[Number(tr.dataset.kwrow)], open=tr.nextElementSibling&&tr.nextElementSibling.classList.contains("kwvids");
    P.querySelectorAll("tr.kwvids").forEach(e=>e.remove()); if(open) return;
    const row=document.createElement("tr"); row.className="kwvids";
    row.innerHTML=`<td colspan="9" style="background:var(--surface-4)">${x.rows.sort((a,b)=>(b.views||0)-(a.views||0)).map(r=>`<div class="row" style="gap:10px;padding:4px 0;flex-wrap:nowrap">
      ${vtag(r.vtype)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>`:esc(r.title)}</span>
      <span class="vol">${dmy(r.date)}</span><span class="vol">${fmt(r.views)} views</span><span class="vol">${r.viewed!=null?Math.round(r.viewed)+"% viewed":""}</span>
      <button class="btn sm" data-kwcard="${r.card.id}">Card</button></div>`).join("")}</td>`;
    tr.after(row); row.querySelectorAll("[data-kwcard]").forEach(b=>b.onclick=e=>{ e.stopPropagation(); openCard(b.dataset.kwcard); });
  });
}

/* ------------------------------------------------------------ POST FILTERS
   Zoho-style: any number of conditions (field · operator · value), matched all
   or any, sortable columns, saved filters (kept with the space) and CSV export. */
function parseDur(v){ if(v==null||v==="") return null; if(typeof v==="number") return v;
  const t=String(v).trim(); if(/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const p=t.split(":").map(Number); if(p.some(isNaN)) return null; return p.reduce((a,x)=>a*60+x,0); }
const kwOf=r=>{ const ks=r.card?(r.card.pre.keywords||[]):[]; return ks.find(k=>k.rank==="primary")||ks[0]||null; };
const engOf=r=>r.views?((Number(r.likes)||0)+(Number(r.comments)||0)+(Number(r.shares)||0))/r.views*100:null;
const WEEKDAYS={mon:"Monday",tue:"Tuesday",wed:"Wednesday",thu:"Thursday",fri:"Friday",sat:"Saturday",sun:"Sunday"};
const PFIELDS = {
  title:   {label:"Title", type:"text", get:r=>r.title||""},
  keyword: {label:"Primary keyword", type:"text", get:r=>(kwOf(r)||{}).kw||""},
  platform:{label:"Platform", type:"enum", opts:()=>REG.platform, get:r=>r.platform},
  vtype:   {label:"Video type", type:"enum", opts:()=>REG.vtype, get:r=>r.vtype},
  research:{label:"Research", type:"enum", opts:()=>({full:"Full",skipped:"Skipped",nocard:"No card"}), get:r=>r.card?(gResearch(r.card.pre)?"full":"skipped"):"nocard"},
  date:    {label:"Published date", type:"date", get:r=>r.date},
  weekday: {label:"Day of the week", type:"enum", opts:()=>WEEKDAYS, get:r=>r.date?Object.keys(WEEKDAYS)[(new Date(r.date+"T00:00:00").getDay()+6)%7]:null},
  hour:    {label:"Posting hour (0–23)", type:"num", get:r=>r.at?new Date(r.at).getHours():null},
  length:  {label:"Video length", type:"dur", get:r=>r.dur},
  views:   {label:"Views", type:"num", get:r=>r.views},
  likes:   {label:"Likes", type:"num", get:r=>r.likes},
  comments:{label:"Comments", type:"num", get:r=>r.comments},
  shares:  {label:"Shares", type:"num", get:r=>r.shares},
  avgwatch:{label:"Average watch time", type:"dur", get:r=>r.avgS},
  viewed:  {label:"Average % viewed", type:"num", get:r=>r.viewed},
  watchh:  {label:"Watch hours", type:"num", get:r=>r.watchMin!=null?Math.round(r.watchMin/6)/10:null},
  eng:     {label:"Engagement %", type:"num", get:engOf},
  likerate:{label:"Likes per 1,000 views", type:"num", get:r=>r.views?(Number(r.likes)||0)/r.views*1000:null},
  gained:  {label:"New followers / subscribers", type:"num", get:r=>r.gained},
  gainrate:{label:"New followers / subscribers per 1,000 views", type:"num", get:r=>r.views&&r.gained!=null?r.gained/r.views*1000:null},
  reach:   {label:"Reach (Instagram)", type:"num", get:r=>r.reach},
  kwvol:   {label:"Keyword search volume", type:"num", get:r=>{ const k=kwOf(r); return k&&k.vol!=null?Number(k.vol):null; }},
};
// post tags: S.postTags = { postKey: { "Creator":"Sivam", ... } } — any tag name, any value
const tagsOf=r=>(S.postTags||{})[r.key]||{};
function tagNames(){ const n=new Set(); Object.values(S.postTags||{}).forEach(t=>Object.keys(t).forEach(k=>n.add(k))); return [...n].sort((a,b)=>a.localeCompare(b)); }
function tagValues(name){ const v=new Set(); Object.values(S.postTags||{}).forEach(t=>{ if(t[name]) v.add(t[name]); }); return [...v].sort((a,b)=>a.localeCompare(b)); }
function FD(k){ if(PFIELDS[k]) return PFIELDS[k];
  if(typeof k==="string" && k.startsWith("tag:")){ const name=k.slice(4);
    return { label:"Tag · "+name, type:"enum", tag:true, opts:()=>{ const o={"":"(not tagged)"}; tagValues(name).forEach(v=>o[v]=v); return o; }, get:r=>tagsOf(r)[name]||"" }; }
  return null; }
function allFields(){ const o=Object.assign({}, PFIELDS); tagNames().forEach(n=>o["tag:"+n]=FD("tag:"+n)); return o; }
const POPS = {
  text:[["contains","contains"],["ncontains","doesn't contain"],["is","is"],["isnt","isn't"],["starts","starts with"],["ends","ends with"],["empty","is empty"],["nempty","is not empty"]],
  num: [["eq","="],["neq","≠"],["lt","<"],["lte","≤"],["gt",">"],["gte","≥"],["between","between"],["empty","is empty"],["nempty","is not empty"]],
  dur: [["lt","shorter than"],["lte","at most"],["gt","longer than"],["gte","at least"],["between","between"],["eq","exactly"],["empty","is empty"],["nempty","is not empty"]],
  date:[["on","on"],["before","before"],["after","after"],["between","between"],["lastn","in the last … days"],["empty","is empty"]],
  enum:[["in","is any of"],["nin","is none of"]],
};
// a condition only counts once it has something to compare with
const ruleActive=r=>{ const F=FD(r.f); if(!F) return false; if(r.op==="empty"||r.op==="nempty") return true;
  return Array.isArray(r.v) ? r.v.length>0 : (r.v!=null && String(r.v).trim()!==""); };
let SEL = new Set(), TAGBY = "";
let PF = { scope:"period", match:"all", rules:[], sort:{k:"date",dir:-1}, limit:50, open:false, saved:"" };
function ruleTest(rule, r){
  const F=FD(rule.f); if(!F) return true; const op=rule.op, raw=F.get(r);
  if(op==="empty") return raw==null||raw==="";
  if(op==="nempty") return !(raw==null||raw==="");
  if(F.type==="text"){ const a=String(raw||"").toLowerCase(), b=String(rule.v||"").toLowerCase().trim(); if(!b) return true;
    return op==="contains"?a.includes(b):op==="ncontains"?!a.includes(b):op==="is"?a===b:op==="isnt"?a!==b:op==="starts"?a.startsWith(b):op==="ends"?a.endsWith(b):true; }
  if(F.type==="enum"){ const set=Array.isArray(rule.v)?rule.v:(rule.v?[rule.v]:[]); if(!set.length) return true;
    return op==="nin"?!set.includes(raw):set.includes(raw); }
  if(F.type==="date"){ if(!raw) return false; if(op==="lastn"){ const n=Number(rule.v); return !n||raw>=addDays(today(),-n); }
    const a=rule.v||"", b=rule.v2||""; if(!a) return true;
    return op==="on"?raw===a:op==="before"?raw<a:op==="after"?raw>a:op==="between"?raw>=a&&(!b||raw<=b):true; }
  // num / dur
  const conv=F.type==="dur"?parseDur:(x=>x===""||x==null?null:Number(x));
  const a=conv(rule.v), b=conv(rule.v2); if(a==null||isNaN(a)) return true; if(raw==null) return false; const x=Number(raw);
  return op==="eq"?x===a:op==="neq"?x!==a:op==="lt"?x<a:op==="lte"?x<=a:op==="gt"?x>a:op==="gte"?x>=a:op==="between"?x>=a&&(b==null||isNaN(b)||x<=b):true;
}
function filteredPosts(){
  const base = PF.scope==="all" ? postRows().filter(r=>r.date && platOK(r)).sort((a,b)=>b.date.localeCompare(a.date)) : publishedInPeriod();
  const act=PF.rules.filter(ruleActive);
  let out = act.length ? base.filter(r=> PF.match==="any" ? act.some(x=>ruleTest(x,r)) : act.every(x=>ruleTest(x,r))) : base;
  const k=PF.sort.k, dir=PF.sort.dir, F=FD(k);
  if(F) out=[...out].sort((a,b)=>{ let x=F.get(a), y=F.get(b);
    if(x==null&&y==null) return 0; if(x==null) return 1; if(y==null) return -1;
    if(typeof x==="string") return dir*x.localeCompare(y); return dir*(x-y); });
  return out;
}
const PRESETS = [
  {name:"Shorts under 30 sec", rules:[{f:"vtype",op:"in",v:["short"]},{f:"length",op:"lt",v:"0:30"}]},
  {name:"Long videos over 10k views", rules:[{f:"vtype",op:"in",v:["long"]},{f:"views",op:"gt",v:"10000"}]},
  {name:"Low retention (< 30% viewed)", rules:[{f:"viewed",op:"lt",v:"30"}]},
  {name:"High engagement (> 5%)", rules:[{f:"eng",op:"gt",v:"5"}]},
  {name:"Posted after 6 PM", rules:[{f:"hour",op:"gte",v:"18"}]},
  {name:"No card linked", rules:[{f:"research",op:"in",v:["nocard"]}]},
];
function ruleValueHTML(rule,i){
  const F=FD(rule.f)||PFIELDS.title, op=rule.op;
  if(op==="empty"||op==="nempty") return `<span class="hint">—</span>`;
  if(F.type==="enum"){ const sel=Array.isArray(rule.v)?rule.v:[];
    return `<div class="row" style="gap:5px">${Object.entries(F.opts()).map(([k,l])=>`<button class="chip ${sel.includes(k)?"on":""}" data-fenum="${i}" data-k="${esc(k)}">${esc(l)}</button>`).join("")}</div>`; }
  const t=F.type==="date"?(op==="lastn"?"number":"date"):F.type==="text"?"text":F.type==="dur"?"text":"number";
  const ph=F.type==="dur"?"m:ss":op==="lastn"?"days":F.type==="text"?"value":"number";
  return `<input data-fv="${i}" type="${t}" value="${esc(rule.v??"")}" placeholder="${ph}" ${t==="number"?'step="any"':""}>`
    + (op==="between"?`<span class="hint">and</span><input data-fv2="${i}" type="${t}" value="${esc(rule.v2??"")}" placeholder="${ph}" ${t==="number"?'step="any"':""}>`:"");
}
function postsSection(){
  const rows=filteredPosts(), act=PF.rules.filter(ruleActive).length, shown=rows.slice(0,PF.limit);
  const fieldOpts=sel=>Object.entries(allFields()).map(([k,f])=>`<option value="${k}" ${k===sel?"selected":""}>${esc(f.label)}</option>`).join("");
  const th=(k,l)=>`<th class="sortable ${PF.sort.k===k?"sorted":""}" data-psort="${k}">${l}${PF.sort.k===k?(PF.sort.dir<0?" ▾":" ▴"):""}</th>`;
  const ed=canEdit(); [...SEL].forEach(k=>{ if(!rows.some(r=>r.key===k)) SEL.delete(k); });
  const allOn=rows.length>0 && rows.every(r=>SEL.has(r.key));
  const names=tagNames();
  const bulk = ed && SEL.size ? `<div class="bulkbar"><b>${SEL.size} selected</b>
      <span style="opacity:.7">Tag</span><input id="tgName" list="tgNames" value="${esc(names[0]||"Creator")}" placeholder="e.g. Creator">
      <datalist id="tgNames">${["Creator",...names].filter((v,i,a)=>a.indexOf(v)===i).map(n=>`<option value="${esc(n)}">`).join("")}</datalist>
      <span style="opacity:.7">=</span><input id="tgVal" list="tgVals" placeholder="e.g. Sivam">
      <datalist id="tgVals">${tagValues(names[0]||"Creator").map(v=>`<option value="${esc(v)}">`).join("")}</datalist>
      <button class="btn sm pri" id="tgApply">Apply tag</button><button class="btn sm" id="tgRemove">Remove this tag</button>
      <span style="flex:1"></span><button class="btn sm" id="tgClear">Clear selection</button></div>` : "";
  const panel = !PF.open ? "" : `<div class="fpanel">
    <div class="fhead">Show posts that match
      <select id="pfMatch"><option value="all" ${PF.match==="all"?"selected":""}>all</option><option value="any" ${PF.match==="any"?"selected":""}>any</option></select>
      of these conditions, from
      <div class="seg"><button data-pscope="period" class="${PF.scope==="period"?"on":""}">the period &amp; chips above</button><button data-pscope="all" class="${PF.scope==="all"?"on":""}">all posts</button></div>
      <span style="flex:1"></span>
      <div class="fsaved"><select id="pfSaved"><option value="">Saved filters…</option>${S.views.map(v=>`<option value="${v.id}" ${PF.saved===v.id?"selected":""}>${esc(v.name)}</option>`).join("")}</select>
        ${canEdit()?`<button class="btn sm" id="pfSave">Save as…</button>${PF.saved?`<button class="btn sm danger" id="pfDelSaved">Delete</button>`:""}`:""}</div></div>
    ${PF.rules.map((r,i)=>{ const F=FD(r.f)||PFIELDS.title; return `<div class="frow" data-fi="${i}">
      <span class="fj">${i===0?"if":PF.match==="any"?"or":"and"}</span>
      <select data-ff="${i}">${fieldOpts(r.f)}</select>
      <select data-fo="${i}">${POPS[F.type].map(([k,l])=>`<option value="${k}" ${r.op===k?"selected":""}>${l}</option>`).join("")}</select>
      <div class="fv">${ruleValueHTML(r,i)}</div>
      <button class="x" data-fdel="${i}" title="Remove">×</button></div>`; }).join("")||`<p class="hint" style="margin:0 0 8px">No conditions yet — every post shows.</p>`}
    <div class="row" style="gap:8px"><button class="btn sm" id="pfAdd">+ Add condition</button>${act?`<button class="btn sm" id="pfClear">Clear all</button>`:""}</div>
    <div class="fpresets"><span class="lbl" style="align-self:center">Quick filters</span>${PRESETS.map((p,i)=>`<button class="chip" data-preset="${i}">${esc(p.name)}</button>`).join("")}</div></div>`;
  return `<div class="sec-h"><h3>Published posts</h3><span class="badge good">YouTube live</span>${igLive()?`<span class="badge good">Instagram live</span>`:`<span class="badge mute">Instagram manual</span>`}
      <span class="hint">${rows.length} post${rows.length===1?"":"s"} ${act?"match":PF.scope==="all"?"in total":"in this period"} · click a column to sort, a row to open its card</span>
      <span style="flex:1"></span>
      <button class="btn sm" id="pfToggle">${PF.open?"Hide filters":"Filters"} ${act?`<span class="fcount">${act}</span>`:""}</button>
      <button class="btn sm" id="pfCsv">Download CSV</button></div>
    ${panel}
    ${bulk}
    <div class="tw"><table style="min-width:1400px">
      <thead><tr>${ed?`<th style="width:34px"><input type="checkbox" class="ck" id="selAll" ${allOn?"checked":""} title="Select all ${rows.length} matching posts"></th>`:""}${th("title","Post")}${th("platform","Platform")}${th("vtype","Type")}${th("keyword","Primary keyword")}${th("date","Date")}${th("length","Length")}
        ${th("views","Views")}${th("likes","Likes")}${th("comments","Comments")}${th("shares","Shares")}${th("eng","Engagement")}${th("gained","New "+(PLATVIEW==="yt"?"subscribers":PLATVIEW==="ig"?"followers":"followers / subs"))}${th("avgwatch","Avg watch")}${th("viewed","Avg viewed")}${th("research","Research")}<th>Tags</th></tr></thead>
      <tbody>${shown.length?shown.map(r=>{const c=r.card, p=kwOf(r), e=engOf(r);
       return `<tr class="${SEL.has(r.key)?"picked":""}" ${c?`data-card="${c.id}" style="cursor:pointer"`:""}>
        ${ed?`<td><input type="checkbox" class="ck" data-sel="${esc(r.key)}" ${SEL.has(r.key)?"checked":""}></td>`:""}
        <td class="td-idea"><div class="row" style="gap:9px;flex-wrap:nowrap">${r.thumb?`<img class="thumb" src="${esc(r.thumb)}" alt="" loading="lazy">`:""}
          <span>${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener" data-ext="1">${esc(r.title)}</a>`:esc(r.title)}</span></div></td>
        <td>${ptag(r.platform)}</td><td>${vtag(r.vtype)}</td>
        <td class="vol">${p?esc(p.kw):"—"}${p&&p.vol!=null?`<small>${fmt(p.vol)}/mo</small>`:""}</td>
        <td class="vol">${dmy(r.date)}${r.at?`<small>${new Date(r.at).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})}</small>`:""}</td>
        <td class="vol">${r.dur!=null?mmss(r.dur):"—"}</td>
        <td class="vol">${fmt(r.views)}</td><td class="vol">${fmt(r.likes)}</td>
        <td class="vol">${fmt(r.comments)}</td><td class="vol">${fmt(r.shares)}</td>
        <td class="vol">${e!=null?r1(e)+"%":"—"}</td>
        <td class="vol">${(()=>{ const typable = r.live && r.platform==="ig" && r.vtype==="reel" && (r.gainedTyped || r.gained==null);
          const shown = r.gained!=null ? `<b>+${fmt(r.gained)}</b>${r.gainedTyped?` <span title="Typed in from Instagram Insights">✎</span>`:""}` : "—";
          return typable && canEdit() ? `<button class="cbtn ${r.gained!=null?"has":""}" data-typefollow="${esc(r.key)}" title="Instagram doesn't share Reels' follows — type the number from Insights → Follows">${r.gained!=null?shown:"+ add"}</button>` : shown; })()}</td>
        <td class="vol">${r.watch||"—"}</td>
        <td class="vol">${r.viewed!=null?Math.round(r.viewed)+"%":`<span style="color:var(--ink-3)">${r.live?"pending":"n/a"}</span>`}</td>
        <td>${c?(gResearch(c.pre)?`<span class="badge good">full</span>`:`<span class="badge crit">skipped</span>`):`<span class="badge mute">no card</span>`}</td>
        <td style="min-width:120px">${Object.entries(tagsOf(r)).map(([k,v])=>`<span class="ptag">${esc(k)}: <b>${esc(v)}</b></span>`).join("")||`<span class="hint">—</span>`}</td></tr>`;}).join("")
       :`<tr><td colspan="17" style="color:var(--ink-3)">${LIVE.status==="loading"?"Loading…":"No posts match these filters."}</td></tr>`}</tbody></table></div>
    ${rows.length>shown.length?`<div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm" id="pfMore">Show ${Math.min(50,rows.length-shown.length)} more (${rows.length-shown.length} left)</button></div>`:""}
    <p class="hint" style="margin-top:8px">A video joins its card when the card's <b>Final post link</b> is its YouTube or Instagram link — then the keyword and research columns fill in too.
      New videos show "pending" for a day or two while YouTube finishes counting. Length and average watch time take minutes:seconds, like 1:30.
      ${ed?"Tick posts to tag them in bulk (e.g. Creator = Sivam).":""}</p>
    ${tagCompare(rows)}`;
}
// how each tag value performs, over the posts currently in the table
function tagCompare(rows){
  const names=tagNames(); if(!names.length) return "";
  if(!names.includes(TAGBY)) TAGBY=names[0];
  const groups={}; rows.forEach(r=>{ const v=tagsOf(r)[TAGBY]||"(not tagged)"; (groups[v]=groups[v]||[]).push(r); });
  const list=Object.entries(groups).map(([v,rs])=>({v,rs,views:sum(rs,x=>x.views),avg:Math.round(sum(rs,x=>x.views)/rs.length),
    eng:(()=>{ const vv=sum(rs,x=>x.views); return vv?(sum(rs,x=>x.likes)+sum(rs,x=>x.comments)+sum(rs,x=>x.shares))/vv*100:null; })(),
    viewed:avg(rs,x=>x.viewed), watch:avg(rs,x=>x.avgS)})).sort((a,b)=>b.avg-a.avg);
  return `<div class="card" style="margin-top:14px"><div class="chart-head" style="margin-bottom:10px"><h4>Performance by tag</h4>
      <div class="row" style="gap:6px"><span class="hint">Compare by</span><select id="tagBy" style="background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r-s);padding:5px 8px;font-size:12.5px">
      ${names.map(n=>`<option ${n===TAGBY?"selected":""}>${esc(n)}</option>`).join("")}</select></div></div>
    <p class="chart-sub">Over the ${rows.length} post${rows.length===1?"":"s"} in the table above — change the period or filters to compare a different set.</p>
    <div class="dgrid">${hbars("Views per post",list.map((x,i)=>({label:x.v,v:x.avg,color:x.v==="(not tagged)"?"var(--ink-3)":KW_COLORS[i%6],text:`${kfmt(x.avg)} · ${x.rs.length} post${x.rs.length===1?"":"s"}`})))}
      ${hbars("Average % viewed",list.map((x,i)=>({label:x.v,v:x.viewed||0,color:x.v==="(not tagged)"?"var(--ink-3)":KW_COLORS[i%6],text:x.viewed!=null?Math.round(x.viewed)+"%":"—"})))}</div>
    <div class="tw"><table class="mini"><thead><tr><th>${esc(TAGBY)}</th><th>Posts</th><th>Total views</th><th>Views / post</th><th>Engagement</th><th>Avg watch</th><th>Avg viewed</th></tr></thead>
      <tbody>${list.map(x=>`<tr><td class="td-idea">${esc(x.v)}</td><td class="vol">${x.rs.length}</td><td class="vol">${fmt(x.views)}</td><td class="vol">${fmt(x.avg)}</td>
        <td class="vol">${x.eng!=null?r1(x.eng)+"%":"—"}</td><td class="vol">${x.watch!=null?mmss(x.watch):"—"}</td><td class="vol">${x.viewed!=null?Math.round(x.viewed)+"%":"—"}</td></tr>`).join("")}</tbody></table></div></div>`;
}
function rerenderPosts(){ const box=$("#postsSec"); if(!box) return; box.innerHTML=postsSection(); wirePosts(box); }
function readRules(box){
  box.querySelectorAll("[data-fv]").forEach(e=>{ const r=PF.rules[Number(e.dataset.fv)]; if(!r) return;
    r.v = e.value; });
  box.querySelectorAll("[data-fv2]").forEach(e=>{ const r=PF.rules[Number(e.dataset.fv2)]; if(r) r.v2=e.value; });
}
function wirePosts(box){
  const on=(id,f)=>{ const e=box.querySelector("#"+id); if(e) e.onclick=f; };
  on("pfToggle",()=>{ PF.open=!PF.open; if(PF.open&&!PF.rules.length) PF.rules.push({f:"views",op:"gt",v:""}); rerenderPosts(); });
  on("pfAdd",()=>{ readRules(box); PF.rules.push({f:"title",op:"contains",v:""}); PF.saved=""; rerenderPosts(); });
  on("pfClear",()=>{ PF.rules=[]; PF.saved=""; PF.limit=50; rerenderPosts(); });
  on("pfMore",()=>{ PF.limit+=50; rerenderPosts(); });
  on("pfCsv",()=>{ const rows=filteredPosts(), cols=["title","platform","vtype","keyword","kwvol","date","hour","length","views","likes","comments","shares","eng","gained","gainrate","reach","avgwatch","viewed","watchh","research"];
    const q=v=>{ const t=v==null?"":String(v); return /[",\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t; };
    tagNames().forEach(n=>cols.push("tag:"+n));
    const lines=[cols.map(k=>q(FD(k).label)).join(","), ...rows.map(r=>cols.map(k=>{ let v=FD(k).get(r);
      if(k==="platform") v=regLabel("platform",v); if(k==="vtype") v=vtypeLabel(v); if((k==="eng"||k==="viewed")&&v!=null) v=Math.round(v*10)/10; return q(v); }).join(","))];
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["﻿"+lines.join("\n")],{type:"text/csv"}));
    a.download="published-posts-"+today()+".csv"; box.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); toast(rows.length+" posts downloaded"); });
  const m=box.querySelector("#pfMatch"); if(m) m.onchange=()=>{ readRules(box); PF.match=m.value; rerenderPosts(); };
  box.querySelectorAll("[data-pscope]").forEach(b=>b.onclick=()=>{ readRules(box); PF.scope=b.dataset.pscope; PF.limit=50; rerenderPosts(); });
  box.querySelectorAll("[data-ff]").forEach(e=>e.onchange=()=>{ readRules(box); const r=PF.rules[Number(e.dataset.ff)]; r.f=e.value; r.op=POPS[FD(r.f).type][0][0]; r.v=FD(r.f).type==="enum"?[]:""; r.v2=""; PF.saved=""; rerenderPosts(); });
  box.querySelectorAll("[data-fo]").forEach(e=>e.onchange=()=>{ readRules(box); PF.rules[Number(e.dataset.fo)].op=e.value; PF.saved=""; rerenderPosts(); });
  box.querySelectorAll("[data-fv],[data-fv2]").forEach(e=>{ e.onchange=()=>{ readRules(box); PF.saved=""; PF.limit=50; rerenderPosts(); };
    if(e.tagName==="INPUT") e.onkeydown=ev=>{ if(ev.key==="Enter"){ ev.preventDefault(); e.onchange(); } }; });
  box.querySelectorAll("[data-fenum]").forEach(b=>b.onclick=()=>{ readRules(box); const r=PF.rules[Number(b.dataset.fenum)];
    const set=Array.isArray(r.v)?r.v:[]; const k=b.dataset.k; r.v=set.includes(k)?set.filter(x=>x!==k):[...set,k]; PF.saved=""; PF.limit=50; rerenderPosts(); });
  box.querySelectorAll("[data-fdel]").forEach(b=>b.onclick=()=>{ readRules(box); PF.rules.splice(Number(b.dataset.fdel),1); PF.saved=""; rerenderPosts(); });
  box.querySelectorAll("[data-preset]").forEach(b=>b.onclick=()=>{ const p=PRESETS[Number(b.dataset.preset)]; PF.rules=JSON.parse(JSON.stringify(p.rules)); PF.match="all"; PF.saved=""; PF.limit=50; rerenderPosts(); });
  box.querySelectorAll("[data-psort]").forEach(t=>t.onclick=()=>{ const k=t.dataset.psort; PF.sort = PF.sort.k===k ? {k, dir:-PF.sort.dir} : {k, dir:(FD(k).type==="text"||FD(k).type==="enum")?1:-1}; rerenderPosts(); });
  const sv=box.querySelector("#pfSaved"); if(sv) sv.onchange=()=>{ const v=S.views.find(x=>x.id===sv.value); PF.saved=sv.value;
    if(v){ PF.rules=JSON.parse(JSON.stringify(v.rules)); PF.match=v.match||"all"; PF.scope=v.scope||"period"; PF.limit=50; } rerenderPosts(); };
  on("pfSave",()=>{ readRules(box); if(!PF.rules.length){ toast("Add a condition first"); return; }
    const name=(prompt("Name this filter (e.g. \"Shorts that flopped\")")||"").trim(); if(!name) return;
    const v={id:uid("v"),name,match:PF.match,scope:PF.scope,rules:JSON.parse(JSON.stringify(PF.rules))};
    S.views.push(v); PF.saved=v.id; if(save()) toast("Filter saved for the team"); });
  on("pfDelSaved",()=>{ const i=S.views.findIndex(x=>x.id===PF.saved); if(i<0) return; if(!confirm("Delete the saved filter \""+S.views[i].name+"\"?")) return;
    S.views.splice(i,1); PF.saved=""; if(save()) toast("Saved filter deleted"); });
  box.querySelectorAll("tr[data-card]").forEach(r=>r.onclick=e=>{ if(e.target.closest("[data-ext]")||e.target.closest(".ck")) return; openCard(r.dataset.card); });
  box.querySelectorAll("[data-typefollow]").forEach(b=>b.onclick=e=>{ e.stopPropagation(); const k=b.dataset.typefollow, cur=S.typedFollows[k];
    const v=prompt("New followers from this Reel\n(open the Reel on Instagram → View insights → Follows)", cur!=null?String(cur):""); if(v===null) return;
    const t=v.trim(); if(t===""){ delete S.typedFollows[k]; if(save()) toast("Cleared"); return; }
    const n=Number(t); if(!(n>=0)||!Number.isFinite(n)){ toast("Type a number, e.g. 3"); return; }
    S.typedFollows[k]=Math.round(n); if(save()) toast("Saved — counts in “Which posts brought followers”"); });
  box.querySelectorAll("[data-sel]").forEach(c=>{ c.onclick=e=>e.stopPropagation(); c.onchange=()=>{ c.checked?SEL.add(c.dataset.sel):SEL.delete(c.dataset.sel); rerenderPosts(); }; });
  const sa=box.querySelector("#selAll"); if(sa) sa.onchange=()=>{ const rows=filteredPosts(); if(sa.checked) rows.forEach(r=>SEL.add(r.key)); else SEL.clear(); rerenderPosts(); };
  const tb=box.querySelector("#tagBy"); if(tb) tb.onchange=()=>{ TAGBY=tb.value; rerenderPosts(); };
  const tn=box.querySelector("#tgName"); if(tn) tn.onchange=()=>{ const dl=box.querySelector("#tgVals"); dl.innerHTML=tagValues(tn.value.trim()).map(v=>`<option value="${esc(v)}">`).join(""); };
  on("tgClear",()=>{ SEL.clear(); rerenderPosts(); });
  on("tgApply",()=>{ const name=box.querySelector("#tgName").value.trim(), val=box.querySelector("#tgVal").value.trim();
    if(!name||!val){ toast("Type a tag name and a value, e.g. Creator = Sivam"); return; }
    SEL.forEach(k=>{ S.postTags[k]=Object.assign({}, S.postTags[k], {[name]:val}); });
    const n=SEL.size; TAGBY=name; SEL.clear(); if(save()) toast(`Tagged ${n} post${n===1?"":"s"} ${name} = ${val}`); });
  on("tgRemove",()=>{ const name=box.querySelector("#tgName").value.trim(); if(!name) return; let n=0;
    SEL.forEach(k=>{ const t=S.postTags[k]; if(t&&t[name]!=null){ delete t[name]; n++; if(!Object.keys(t).length) delete S.postTags[k]; } });
    SEL.clear(); if(save()) toast(`Removed "${name}" from ${n} post${n===1?"":"s"}`); });
}

// YouTube says "subscribers", Instagram says "followers"
const AUD = pl => pl==="yt" ? "subscribers" : "followers";
const AUDV = () => PLATVIEW==="yt" ? "subscribers" : PLATVIEW==="ig" ? "followers" : "followers & subscribers";
const cap = t => t.charAt(0).toUpperCase()+t.slice(1);

/* ------------------------------------------------------------ AUDIENCE LOCATION
   Where viewers and followers/subscribers are, from social_geo (filled by
   sync-social). Platforms share cities, not districts; YouTube shares
   subscribers by country only; Instagram shares its top cities only. */
const GEO = { plat:"yt", kind:"viewers", state:null };
const METROS = new Set(["delhi","new delhi","mumbai","kolkata","chennai","bengaluru","bangalore","hyderabad","pune","ahmedabad",
  "gurugram","gurgaon","noida","greater noida","ghaziabad","faridabad","thane","navi mumbai","secunderabad","pimpri-chinchwad","howrah"]);
const COUNTRY = { IN:"India", US:"United States", AE:"UAE", GB:"United Kingdom", CA:"Canada", AU:"Australia", NP:"Nepal", BD:"Bangladesh",
  SA:"Saudi Arabia", QA:"Qatar", KW:"Kuwait", OM:"Oman", SG:"Singapore", PK:"Pakistan", DE:"Germany", MY:"Malaysia", BH:"Bahrain", LK:"Sri Lanka", NZ:"New Zealand", FR:"France" };
const cityOnly = n => { const i=String(n).lastIndexOf(", "); return i<0?String(n):String(n).slice(0,i); };
function geoSection(){
  const pl = PLATVIEW==="all" ? GEO.plat : PLATVIEW, plat = pl==="yt"?"youtube":"instagram";
  const aud = AUD(pl), kinds = [["viewers",pl==="yt"?"Viewers":"Reached accounts"],[pl==="yt"?"subscribers":"followers",cap(aud)]];
  if(!kinds.some(k=>k[0]===GEO.kind)) GEO.kind="viewers";
  const rows = (LIVE.geo||[]).filter(r=>r.platform===plat && r.kind===GEO.kind);
  const period = (rows[0]||{}).period || "";
  const head = `<div class="sec-h"><h3>Where your audience is</h3>
    <span class="hint">${PLAT_NAME[pl]} · ${esc(kinds.find(k=>k[0]===GEO.kind)[1].toLowerCase())}${period?" · "+esc(period):""}</span></div>
    <div class="row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">
      ${PLATVIEW==="all"?`<div class="seg"><button data-geoplat="yt" class="${pl==="yt"?"on":""}">YouTube</button><button data-geoplat="ig" class="${pl==="ig"?"on":""}">Instagram</button></div>`:""}
      <div class="seg">${kinds.map(([k,l])=>`<button data-geokind="${k}" class="${GEO.kind===k?"on":""}">${l}</button>`).join("")}</div></div>`;
  if(!(LIVE.geo||[]).length) return head+`<div class="card"><p class="hint" style="margin:0">No location numbers yet — they arrive with the next sync (every morning at 8:00 AM, or press <b>Sync now</b> above).</p></div>`;
  const countries = rows.filter(r=>r.level==="country").sort((a,b)=>b.value-a.value);
  const ctyBars = countries.slice(0,10).map(r=>({label:COUNTRY[r.name]||r.name,v:Number(r.value)||0,color:pl==="yt"?"var(--c1)":"var(--c3)"}));
  // YouTube subscribers: countries only
  if(pl==="yt" && GEO.kind==="subscribers") return head+`<div class="charts"><div class="chart-card">
      ${hbars("New subscribers by country ("+esc(period||"last 90 days")+")",ctyBars)}
      <p class="geo-note">YouTube doesn't share subscribers by state or city — only by country. For state and city, switch to <b>Viewers</b>: that's where the people watching you are.</p></div></div>`;
  const cities = rows.filter(r=>r.level==="city").map(r=>({name:cityOnly(r.name),state:r.state||"Not matched to a state",v:Number(r.value)||0})).filter(c=>c.v>0).sort((a,b)=>b.v-a.v);
  const india = Number((countries.find(r=>r.name==="IN")||{}).value)||0;
  const stMap = new Map(); cities.forEach(c=>stMap.set(c.state,(stMap.get(c.state)||0)+c.v));
  const states = [...stMap].map(([k,v])=>({k,v})).sort((a,b)=>(a.k==="Not matched to a state")-(b.k==="Not matched to a state")||b.v-a.v);
  if(GEO.state && !stMap.has(GEO.state)) GEO.state=null;
  const max = Math.max(1,...states.map(s=>s.v)), col = pl==="yt"?"var(--c1)":"var(--c3)";
  const stBars = states.map(s=>`<div class="hbar geo-bar ${GEO.state===s.k?"on":""}" data-geostate="${esc(s.k)}" role="button" tabindex="0" data-tip="${esc(s.k)}\n${fmt(s.v)} · click for its cities">
    <span class="hl">${esc(s.k)}</span><span class="ht"><i style="width:${s.v/max*100}%;background:${col}"></i></span><span class="hv">${fmt(s.v)}</span></div>`).join("");
  const inState = GEO.state ? cities.filter(c=>c.state===GEO.state) : cities.slice(0,15);
  const cityTitle = GEO.state ? `Cities in ${esc(GEO.state)}` : "Top cities (click a state to see its cities)";
  const metro = sum(cities.filter(c=>METROS.has(c.name.toLowerCase())),c=>c.v), other = sum(cities,c=>c.v)-metro;
  const rest = india ? Math.max(0, india-metro-other) : 0;
  const split = [{label:"Metros",v:metro,color:"var(--c1)"},{label:"Other cities",v:other,color:"var(--c2)"},
    ...(rest?[{label:"Towns & rural",v:rest,color:"var(--c3)"}]:[])];
  const unit = GEO.kind==="viewers" ? (pl==="yt"?"VIEWS":"REACHED") : "FOLLOWERS";
  return head+`<div class="charts">
    <div class="chart-card"><div class="dblock" style="margin:0"><span class="lbl">By state${pl==="ig"?" (top cities only)":""}</span>
      ${states.length?stBars:`<p class="hint">Nothing here yet.</p>`}</div>
      <p class="geo-note">${pl==="yt"?"YouTube gives cities, not states — each city is placed in its state here. ":"Instagram shares only your top cities, so smaller places aren't in these totals. "}Neither platform gives districts; cities are the closest.</p></div>
    <div class="chart-card">${hbars(cityTitle,inState.map(c=>({label:c.name,v:c.v,color:col,tip:fmt(c.v)+(GEO.state?"":" · "+c.state)})))}
      ${GEO.state?`<button class="btn sm" data-geostate="" style="margin-top:8px">← All states</button>`:""}</div>
    <div class="chart-card"><div class="chart-head"><h4>Metros vs other cities vs towns &amp; rural</h4></div>
      ${donutChart(split,330,180,unit,fmt)}
      <p class="geo-note">Metros = Delhi NCR, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune, Ahmedabad.
      ${rest?`"Towns & rural" (smaller towns and villages) is everything in India outside the top cities the platform lists (${fmt(india)} in India in total) — the platforms don't label urban or rural, so this is the closest honest split.`
        :`The platform didn't share an India total, so places outside its top cities can't be shown.`}
      ${india&&countries.length?` India is ${pct(india,sum(countries,r=>r.value))}% of the total.`:""}</p></div>
  </div>`;
}
function wireGeo(){
  const P=$("#geoSec"); if(!P) return;
  activateTips(P);
  P.querySelectorAll("[data-geoplat]").forEach(b=>b.onclick=()=>{ GEO.plat=b.dataset.geoplat; GEO.state=null; P.innerHTML=geoSection(); wireGeo(); });
  P.querySelectorAll("[data-geokind]").forEach(b=>b.onclick=()=>{ GEO.kind=b.dataset.geokind; GEO.state=null; P.innerHTML=geoSection(); wireGeo(); });
  P.querySelectorAll("[data-geostate]").forEach(b=>{ const go=()=>{ const k=b.dataset.geostate; GEO.state = !k||GEO.state===k ? null : k; P.innerHTML=geoSection(); wireGeo(); };
    b.onclick=go; b.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } }; });
}

/* ------------------------------------------------------------ FOLLOWER DRIVERS
   Which posts brought the new followers: YouTube "subscribers gained" per video,
   Instagram "follows" per post (both lifetime, as the platforms count them). */
function netGain(pl){ const ser=pl==="yt"?ytSeries():igSeries(); if(!ser.length) return null;
  const last=ser[ser.length-1], first=valueAt(ser, periodStart()); return first==null?null:last.v-first; }
function driversSection(){
  const pub=publishedInPeriod(), withG=pub.filter(r=>r.gained!=null);
  const head=`<div class="sec-h"><h3>Which posts brought ${AUDV()}</h3>
    <span class="hint">New ${AUDV()} each post brought in — posts from the ${periodName()}, as ${PLATVIEW==="all"?"YouTube and Instagram count":PLAT_NAME[PLATVIEW]+" counts"} them</span></div>`;
  if(!withG.length) return `<div class="sec">${head}<div class="card"><p class="hint" style="margin:0">No ${AUDV()} numbers for these posts yet —
    they arrive with the next sync (YouTube a day or two after posting).</p></div></div>`;
  const total=sum(withG,r=>r.gained), top=[...withG].sort((a,b)=>(b.gained||0)-(a.gained||0)).slice(0,10);
  const plats=PLATVIEW==="all"?["yt","ig"]:[PLATVIEW];
  const net=plats.map(pl=>({pl, net:netGain(pl), posts:sum(withG.filter(r=>r.platform===pl),r=>r.gained)}));
  const types=Object.keys(REG.vtype).filter(typeVisible).map(k=>{ const rs=withG.filter(r=>r.vtype===k); return {k,rs,g:sum(rs,r=>r.gained),v:sum(rs,r=>r.views)}; }).filter(x=>x.rs.length);
  return `<div class="sec">${head}
    ${dstats([["From these posts","+"+fmt(total),`${withG.length} post${withG.length===1?"":"s"} · ${r1(total/(withG.length||1))} per post`],
      ...net.map(x=>[PLAT_NAME[x.pl]+" change",x.net==null?"—":(x.net>=0?"+":"−")+fmt(Math.abs(x.net)),
        x.net==null?`no ${AUD(x.pl)} history yet`:`whole account, ${periodName()} · ${fmt(x.posts)} credited to these posts`]),
      [`Best ${PLATVIEW==="yt"?"subscriber":PLATVIEW==="ig"?"follower":"follower / subscriber"} driver`,esc((top[0].title||"").slice(0,24))+((top[0].title||"").length>24?"…":""),`+${fmt(top[0].gained)} · ${regLabel("platform",top[0].platform)} ${vtypeLabel(top[0].vtype).toLowerCase()}`]])}
    <div class="dgrid">
      ${hbars("Top posts by new "+AUDV(),top.map(r=>({label:r.title,v:r.gained,color:platColor(r.platform),
        text:`+${fmt(r.gained)} · ${total?Math.round(r.gained/total*100):0}%`,tip:`${r.title}\n+${fmt(r.gained)} ${AUD(r.platform)} · ${fmt(r.views)} views · ${dmy(r.date)}`})))}
      ${hbars(cap(AUDV())+" per 1,000 views, by type",types.map(x=>({label:(PLATVIEW==="all"?platShort(TYPE_PLAT[x.k]||"")+" ":"")+vtypeLabel(x.k),v:x.v?x.g/x.v*1000:0,color:vtypeColor(x.k),
        text:`${x.v?r1(x.g/x.v*1000):"—"} · +${fmt(x.g)} from ${x.rs.length}`})))}
    </div>
    <p class="hint" style="margin:0">"Change" is the whole account's ${AUDV()} count over the period (it includes people who found you any other way, minus ${PLATVIEW==="yt"?"unsubscribes":"unfollows"}).
      Per-post numbers are what each platform credits to that post. Sort the Published posts table by <b>New ${PLATVIEW==="yt"?"subscribers":PLATVIEW==="ig"?"followers":"followers / subs"}</b> for the full list.
      ${PLATVIEW!=="yt"?"<br>Meta doesn't share Reels' follows with other apps (only images and carousels), so for Reels type the number from Instagram Insights → <b>Follows</b> in the <b>New followers</b> column of Published posts — typed numbers show ✎.":""}</p></div>`;
}

/* ------------------------------------------------------------ COMPARE
   Put an Instagram post next to a YouTube video (same reel posted twice, or any two)
   and see which did better on each measure. */
let CMP={ig:"", yt:""};
const cmpRows=()=>postRows().filter(r=>r.live && r.date).sort((a,b)=>b.date.localeCompare(a.date));
const words=t=>new Set(String(t||"").toLowerCase().replace(/#\S+/g," ").match(/[a-z0-9ऀ-ॿ]{3,}/g)||[]);
function suggestPairs(rows){
  const ig=rows.filter(r=>r.platform==="ig").slice(0,120), yt=rows.filter(r=>r.platform==="yt").slice(0,200), out=[];
  ig.forEach(a=>{ const wa=words(a.title); let best=null;
    yt.forEach(b=>{ const dd=Math.abs(days(a.date,b.date)); if(dd>3) return;
      const wb=words(b.title); let n=0; wa.forEach(w=>{ if(wb.has(w)) n++; });
      const sc=(wa.size+wb.size?n/Math.min(wa.size||1,wb.size||1):0) - dd*0.05;
      if(n>=2 && (!best||sc>best.sc)) best={a,b,sc}; });
    if(best) out.push(best); });
  return out.sort((x,y)=>y.sc-x.sc).slice(0,8);
}
function openCompare(){
  const rows=cmpRows(), ig=rows.filter(r=>r.platform==="ig"), yt=rows.filter(r=>r.platform==="yt");
  if(!CMP.ig && ig[0]) CMP.ig=ig[0].key; if(!CMP.yt && yt[0]) CMP.yt=yt[0].key;
  const A=rows.find(r=>r.key===CMP.ig), B=rows.find(r=>r.key===CMP.yt), pairs=suggestPairs(rows);
  const opt=(list,sel)=>list.map(r=>`<option value="${esc(r.key)}" ${r.key===sel?"selected":""}>${esc(dmy(r.date))} · ${esc(vtypeLabel(r.vtype))} · ${esc((r.title||"").slice(0,60))}</option>`).join("");
  const M=[["Views",r=>r.views,1],["Likes",r=>r.likes,1],["Comments",r=>r.comments,1],["Shares",r=>r.shares,1],
    ["Engagement %",engOf,1,"pct"],["New followers / subscribers",r=>r.gained,1],["New followers / subscribers per 1,000 views",r=>r.views&&r.gained!=null?r.gained/r.views*1000:null,1,"r1"],
    ["Likes per 1,000 views",r=>r.views?(r.likes||0)/r.views*1000:null,1,"r1"],["Average watch time",r=>r.avgS,1,"dur"],["Reach (Instagram only)",r=>r.reach,0],["Average % viewed (YouTube only)",r=>r.viewed,0,"pct"]];
  const show=(v,f)=>v==null?"—":f==="pct"?r1(v)+"%":f==="dur"?mmss(v):f==="r1"?r1(v):fmt(v);
  let wa=0, wb=0;
  const table = A&&B ? M.map(([l,g,cmp,f])=>{ const x=g(A), y=g(B); let ca="", cb="";
      if(cmp && x!=null && y!=null && x!==y){ if(x>y){ ca="good"; wa++; } else { cb="good"; wb++; } }
      return `<tr><td>${l}</td><td class="vol ${ca?"win":""}">${show(x,f)}${ca?" ✓":""}</td><td class="vol ${cb?"win":""}">${show(y,f)}${cb?" ✓":""}</td></tr>`; }).join("") : "";
  openDrawer(`<div class="dr-h"><div><div class="lbl">Compare</div><h3 style="margin-top:4px">Instagram vs YouTube</h3></div><button class="btn sm" id="xClose">Close</button></div>
    <p class="hint" style="margin:0 0 14px">Pick any Instagram post and any YouTube video — usually the same reel posted on both. Every number is lifetime, as each platform counts it.
      Meta doesn't share new followers for Reels — type them in the Published posts table (New followers column) and they show here.</p>
    ${pairs.length?`<div class="block"><div class="block-h"><h4>Same content on both?</h4><span class="hint">Matched by title words, posted within 3 days</span></div>
      ${pairs.map((p,i)=>`<button class="cpair" data-pair="${i}"><span>${ptag("ig")} ${esc((p.a.title||"").slice(0,48))}</span><span>${ptag("yt")} ${esc((p.b.title||"").slice(0,48))}</span><span class="hint">${dmy(p.a.date)}</span></button>`).join("")}</div>`:""}
    <div class="fld"><label>Instagram post</label><select id="cmpIg">${opt(ig,CMP.ig)||`<option>No Instagram posts synced yet</option>`}</select></div>
    <div class="fld"><label>YouTube video</label><select id="cmpYt">${opt(yt,CMP.yt)||`<option>No YouTube videos synced yet</option>`}</select></div>
    ${A&&B?`<div class="block" style="padding:0;overflow:hidden"><table class="mini cmpt" style="min-width:0"><thead><tr><th></th>
        <th>${ptag("ig")} ${vtag(A.vtype)}<div class="hint" style="text-transform:none;letter-spacing:0;margin-top:4px">${dmy(A.date)}${A.url?` · <a href="${esc(A.url)}" target="_blank" rel="noopener">open</a>`:""}</div></th>
        <th>${ptag("yt")} ${vtag(B.vtype)}<div class="hint" style="text-transform:none;letter-spacing:0;margin-top:4px">${dmy(B.date)}${B.url?` · <a href="${esc(B.url)}" target="_blank" rel="noopener">open</a>`:""}</div></th></tr></thead>
      <tbody>${table}</tbody></table></div>
      <div class="note" style="font-size:17px"><div class="lbl">Verdict</div>${wa===wb?`Even — each platform wins ${wa} measure${wa===1?"":"s"}.`
        :`<b>${wa>wb?"Instagram":"YouTube"}</b> did better on <b>${Math.max(wa,wb)} of ${wa+wb}</b> measures.`}
        ${A.views&&B.views?`<br>Views: ${A.views>B.views?"Instagram":"YouTube"} got ${r1(Math.max(A.views,B.views)/Math.max(1,Math.min(A.views,B.views)))}× more.`:""}</div>`:""}`);
  $("#xClose").onclick=closeDrawer;
  $("#cmpIg") && ($("#cmpIg").onchange=e=>{ CMP.ig=e.target.value; openCompare(); });
  $("#cmpYt") && ($("#cmpYt").onchange=e=>{ CMP.yt=e.target.value; openCompare(); });
  $("#drawer").querySelectorAll("[data-pair]").forEach(b=>b.onclick=()=>{ const p=pairs[Number(b.dataset.pair)]; CMP={ig:p.a.key, yt:p.b.key}; openCompare(); });
}

/* ------------------------------------------------------------ SUMMARY */
function liveBar(){
  const sync = canEdit() || (OPT.isMember && OPT.isMember());
  const btn = `<button class="btn sm" id="syncNow" ${LIVE.syncing?"disabled":""} style="flex-shrink:0">${LIVE.syncing?"Syncing…":"Sync now"}</button>`;
  if(LIVE.status==="loading" || LIVE.status==="idle") return `<div class="apibar live"><span class="ic">LIVE</span><p>Loading the latest YouTube numbers…</p></div>`;
  if(LIVE.status==="error") return `<div class="apibar bad"><span class="ic">OFFLINE</span>
    <p><b>Couldn't load the YouTube numbers</b> (${esc(LIVE.err)}). Everything computed from this space below is still correct.</p>${sync?btn:""}</div>`;
  if(!LIVE.lastAt) return `<div class="apibar"><span class="ic">NOT SYNCED</span>
    <p><b>YouTube hasn't synced yet.</b> It runs every morning at 8:00 AM, or press Sync now.</p>${sync?btn:""}</div>`;
  return `<div class="apibar live"><span class="ic">LIVE</span>
    <p><b>YouTube is connected</b> — subscribers and every video's views, likes, comments, shares and watch time fill in by
    themselves every morning at 8:00 AM. Last synced <b>${esc(ago(LIVE.lastAt))}</b>.
    ${igLive()?`<b>Instagram is connected too</b> — followers and every post's views, reach, likes, comments, shares and saves.`
      :`Instagram isn't connected yet, so its numbers are typed in by hand and marked <span class="badge mute">manual</span>.`}
    Thumbnail CTR stays in YouTube Studio — Google doesn't share it.</p>${sync?btn:""}</div>`;
}

function renderSummary(){
  const vI=IDEAS.filter(platOK), vC=CARDS.filter(platOK);   // Summary platform switch
  const pub=publishedInPeriod(), from=periodStart();
  const ideasP=vI.filter(i=>i.created>=from);
  const accepted=vI.filter(i=>i.status==="accepted");
  const decided=vI.filter(i=>["accepted","rejected"].includes(i.status));
  const acceptRate=decided.length?Math.round(accepted.length/decided.length*100):0;
  const allPub=vC.filter(c=>c.stage==="published");
  const conv=vI.length?Math.round(allPub.filter(c=>c.ideaId).length/vI.length*100):0;
  const cyc=allPub.filter(c=>c.acceptedOn&&c.published).map(c=>days(c.acceptedOn,c.published));
  const cycle=cyc.length?Math.round(cyc.reduce((a,b)=>a+b,0)/cyc.length):0;
  const onTime=allPub.length?Math.round(allPub.filter(c=>c.scheduled===c.published).length/allPub.length*100):0;
  const comp=allPub.length?Math.round(allPub.filter(c=>gResearch(c.pre)).length/allPub.length*100):0;
  const backlog=vC.filter(c=>c.stage==="todo").length;
  const counts=Object.keys(REG.vtype).filter(typeVisible).map(k=>({label:vtypeLabel(k),short:vtypeLabel(k).split(" ")[0],
    v:pub.filter(r=>r.vtype===k).length,color:vtypeColor(k)}));
  const byPerson={}; ideasP.forEach(i=>{ const n=i.by||"unnamed"; byPerson[n]=(byPerson[n]||0)+1; });
  const views=pub.reduce((s,r)=>s+(Number(r.views)||0),0);

  const yt=ytSeries(), ig=igSeries();
  const more=(k,col)=>{ const gs=TG.goals.filter(g=>g.platform===k&&g.target>0), n=gs.length+(TG.plan[k].time?1:0), open=!!OKR_OPEN[k];
    return `<div class="okr-more ${open?"open":""}"><button data-okrmore="${k}">${open?"▴":"▾"} Other targets (${n})</button>
      ${open?(n?postingTimeHTML(k,col)+gs.map(g=>goalHTML(g,col)).join(""):`<p class="hint" style="margin:8px 0 0">No other targets for ${PLAT_NAME[k]} yet — set them in the <b>Our agreement</b> tab.</p>`):""}</div>`; };
  const okr=(k,n,col,series,isLive)=>{
    const tgt=TG.targets[k];
    if(!series.length) return `<div class="okr"><div class="okr-top"><div><div class="lbl" style="margin-bottom:4px">${n} ${AUD(k)}</div>
        <div class="okr-v" style="color:var(--ink-3)">—</div></div>
        <div style="text-align:right"><div class="okr-t">target ${fmt(tgt)}</div></div></div>
        <div class="meter"><i style="width:0"></i></div>
        <div class="okr-foot"><span>${isLive?"Waiting for the first sync":"No count entered yet"}</span>
        ${isLive?"":`<button class="btn sm" data-updf="1">Add the first count</button>`}</div>${more(k,col)}</div>`;
    const last=series[series.length-1], wk=valueAt(series, addDays(last.d,-7));
    const cur=last.v, pct=Math.min(100,cur/tgt*100), delta=wk!=null?cur-wk:null;
    return `<div class="okr"><div class="okr-top">
      <div><div class="lbl" style="margin-bottom:4px">${n} ${AUD(k)} ${isLive?`<span class="badge good" style="margin-left:4px">live</span>`:`<span class="badge mute" style="margin-left:4px">manual</span>`}</div><div class="okr-v">${fmt(cur)} <small>/ ${fmt(tgt)}</small></div></div>
      <div style="text-align:right">
        ${delta!=null?`<div class="okr-t" style="color:${delta>=0?"var(--good)":"var(--crit)"}">${delta>=0?"+":"−"}${fmt(Math.abs(delta))} this week</div>`:`<div class="okr-t">as of ${dmy(last.d)}</div>`}</div></div>
      <div class="meter"><i style="width:${pct}%;background:${col}"></i></div>
      <div class="okr-foot"><span>${pct.toFixed(1)}% of target</span>
        <span class="num">${cur>=tgt?"target reached 🎉":`${fmt(tgt-cur)} to go · needs +${fmt(Math.ceil((tgt-cur)/12))}/wk for 12 weeks`}</span></div>${more(k,col)}</div>`; };

  $("#pane-summary").innerHTML=`
   <div class="platsw">${[["all","Both platforms"],["yt","YouTube only"],["ig","Instagram only"]].map(([k,l])=>
     `<button data-pview="${k}" class="${PLATVIEW===k?"on":""}">${k==="yt"?`<span class="sdot" style="background:var(--c1)"></span>`:k==="ig"?`<span class="sdot" style="background:var(--c3)"></span>`:""}${l}</button>`).join("")}
     <span class="hint">${PLATVIEW==="all"?"Everything below covers YouTube and Instagram together":`Everything below — targets, ideas, cards, posts, keywords — is ${PLATVIEW==="yt"?"YouTube":"Instagram"} only`}</span>
     <button class="btn pri" id="cmpOpen" style="margin-left:auto">⇄ Compare Instagram vs YouTube</button></div>
   ${liveBar()}

   <div class="sec"><div class="row" style="margin-bottom:14px">
     <span class="lbl">Period</span>
     ${["week","month","quarter"].map(p=>`<button class="chip ${FILTERS.period===p?"on":""}" data-period="${p}">${p==="week"?"Last 7 days":p==="month"?"Last 30 days":"Last 90 days"}</button>`).join("")}
     <span style="width:8px"></span><span class="lbl">Type</span>
     ${Object.keys(REG.vtype).filter(typeVisible).map(k=>`<button class="chip ${FILTERS.vtypes.includes(k)?"on":""}" data-vt="${k}">${esc(vtypeLabel(k))}</button>`).join("")}
   </div></div>

   <div class="sec"><div class="sec-h"><h3>OKR progress</h3>
     <span class="hint">Two separate goals, never a combined audience number</span>
     ${igLive()?"":`<button class="btn sm" data-updf="1" style="margin-left:auto">Update Instagram count</button>`}</div>
     <div class="okrs">${PLATVIEW!=="ig"?okr("yt","YouTube","var(--c1)",yt,true):""}${PLATVIEW!=="yt"?okr("ig","Instagram","var(--c3)",ig,igLive()):""}</div></div>

   ${driversSection()}

   <div class="sec"><div class="sec-h"><h3>Process health</h3><span class="hint">Live from this space and the synced posts</span></div>
     <div class="tiles" id="tiles">
       ${tile("published","Published","",pub.length,"Posts in the selected period and filters")}
       ${tile("views","Views","",kfmt(views),"On those posts, all-time so far")}
       ${tile("ideas","Ideas logged","",ideasP.length,Object.entries(byPerson).map(([n,c])=>`${c} ${esc(n)}`).join(" · ")||"In the selected period")}
       ${tile("conv","Idea → published","",conv+"<small>%</small>","Of every idea ever logged")}
       ${tile("accept","Acceptance rate","",acceptRate+"<small>%</small>",`${accepted.length} accepted of ${decided.length} decided`)}
       ${tile("cycle","Cycle time","",cycle+"<small> days</small>","Accepted → published, average")}
       ${tile("ontime","On-time publish","",onTime+"<small>%</small>","Shipped on the scheduled date")}
       ${tile("research","Research compliance",comp<100&&allPub.length?`<span class="badge warn">${allPub.length-allPub.filter(c=>gResearch(c.pre)).length} skipped</span>`:"",comp+"<small>%</small>","Published cards with a full research block")}
       ${tile("backlog","Backlog",backlog<3?`<span class="badge crit">thin</span>`:backlog>20?`<span class="badge warn">hoarding</span>`:`<span class="badge good">healthy</span>`,backlog,"Accepted ideas waiting in To Do")}</div></div>

   <div class="sec"><div class="sec-h"><h3>Output and pipeline</h3></div><div class="charts">
     <div class="chart-card"><div class="chart-head"><h4>Posts by video type</h4>
       <div class="seg"><button data-cm="bar" class="${CHARTMODE==="bar"?"on":""}">Bar</button><button data-cm="donut" class="${CHARTMODE==="donut"?"on":""}">Donut</button></div></div>
       <p class="chart-sub">Published in the selected period</p>${CHARTMODE==="bar"?barChart(counts):donutChart(counts)}</div>
     <div class="chart-card"><div class="chart-head"><h4>Idea funnel</h4></div>
       <p class="chart-sub">Every idea ever logged, and where it got to</p>
       ${vI.length?funnelChart([{label:"Logged",v:vI.length,color:"var(--c3)"},
         {label:"Reviewed",v:decided.length+vI.filter(i=>i.status==="under_review").length,color:"var(--c2)"},
         {label:"Accepted",v:accepted.length,color:"var(--c1)"},
         {label:"Published",v:allPub.filter(c=>c.ideaId).length,color:"var(--good)"}])
         :`<p class="hint">No ideas logged yet — start in Ideation.</p>`}</div></div></div>

   ${keywordSection()}

   <div class="sec"><div class="sec-h"><h3>${PLATVIEW==="yt"?"Subscriber growth":PLATVIEW==="ig"?"Follower growth":"Subscriber & follower growth"}</h3>
     <span class="hint">${PLATVIEW==="all"?"Two charts, two scales. A combined number would be meaningless.":"Weekly, last 12 weeks"}</span></div>
     <div class="charts">
       ${PLATVIEW==="ig"?"":`<div class="chart-card"><div class="chart-head"><h4>YouTube subscribers <span class="badge good" style="margin-left:4px">live</span></h4><span class="chip">target ${fmt(TG.targets.yt)}</span></div>
         <p class="chart-sub">Weekly, last 12 weeks</p>${lineChart(weekly(yt,12),"var(--c1)","YouTube")}</div>`}
       ${PLATVIEW==="yt"?"":`<div class="chart-card"><div class="chart-head"><h4>Instagram followers ${igLive()?`<span class="badge good" style="margin-left:4px">live</span>`:`<span class="badge mute" style="margin-left:4px">manual</span>`}</h4><span class="chip">target ${fmt(TG.targets.ig)}</span></div>
         <p class="chart-sub">Weekly, last 12 weeks</p>${lineChart(weekly(ig,12),"var(--c3)","Instagram")}</div>`}</div></div>

   <div class="sec" id="geoSec">${geoSection()}</div>

   <div class="sec" id="postsSec">${postsSection()}</div>`;

  const P=$("#pane-summary"); activateTips(P);
  P.querySelectorAll("[data-period]").forEach(b=>b.onclick=()=>{FILTERS.period=b.dataset.period;renderSummary();});
  const co=$("#cmpOpen"); if(co) co.onclick=openCompare;
  P.querySelectorAll("[data-pview]").forEach(b=>b.onclick=()=>{ PLATVIEW=b.dataset.pview; OPEN_TILE=null; PF.limit=50; SEL.clear(); renderSummary(); });
  P.querySelectorAll("[data-plat]").forEach(b=>b.onclick=()=>{toggle(FILTERS.platforms,b.dataset.plat);renderSummary();});
  P.querySelectorAll("[data-vt]").forEach(b=>b.onclick=()=>{toggle(FILTERS.vtypes,b.dataset.vt);renderSummary();});
  P.querySelectorAll("[data-cm]").forEach(b=>b.onclick=()=>{CHARTMODE=b.dataset.cm;renderSummary();});
  wireKeywords(P);
  P.querySelectorAll("tr[data-card]").forEach(r=>r.onclick=e=>{ if(e.target.closest("[data-ext]")) return; openCard(r.dataset.card); });
  wirePosts($("#postsSec"));
  wireGeo();
  P.querySelectorAll("[data-updf]").forEach(b=>b.onclick=openFollowers);
  const sn=$("#syncNow"); if(sn) sn.onclick=syncNow;
  P.querySelectorAll("[data-okrmore]").forEach(b=>b.onclick=()=>{ OKR_OPEN[b.dataset.okrmore]=!OKR_OPEN[b.dataset.okrmore]; renderSummary(); });
  P.querySelectorAll("[data-manualsave]").forEach(b=>b.onclick=()=>{ const k=b.dataset.manualsave, inp=P.querySelector(`[data-manual="${k}"]`);
    const v=inp.value===""?null:Math.max(0,Number(inp.value)); if(v==null||isNaN(v)){ toast("Type a number"); return; }
    S.manual[k]=v; if(save()) toast("Saved"); });
  P.querySelectorAll("[data-tile]").forEach(t=>{
    const go=()=>{ OPEN_TILE = OPEN_TILE===t.dataset.tile ? null : t.dataset.tile; placeDetail(); };
    t.onclick=go; t.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } };
  });
  placeDetail();
}

/* ------------------------------------------------------------ TILE DETAILS
   Clicking a Process health box opens its breakdown right under that box's
   row, full width; clicking it again (or ×) closes it. */
let OPEN_TILE=null;
function tile(key,label,badge,value,desc){
  return `<div class="tile ${OPEN_TILE===key?"open":""}" data-tile="${key}" role="button" tabindex="0" aria-expanded="${OPEN_TILE===key}">
    <div class="k"><span class="lbl">${label}</span>${badge}</div><div class="v">${value}</div><div class="d">${desc}</div>
    <div class="more">${OPEN_TILE===key?"Hide details ▴":"Details ▾"}</div></div>`;
}
function placeDetail(){
  const grid=$("#tiles"); if(!grid) return;
  grid.querySelectorAll(".tdetail").forEach(e=>e.remove());
  grid.querySelectorAll("[data-tile]").forEach(t=>{ const on=t.dataset.tile===OPEN_TILE;
    t.classList.toggle("open",on); t.setAttribute("aria-expanded",on); t.querySelector(".more").textContent=on?"Hide details ▴":"Details ▾"; });
  if(!OPEN_TILE) return;
  const tiles=[...grid.querySelectorAll("[data-tile]")], me=tiles.find(t=>t.dataset.tile===OPEN_TILE); if(!me) return;
  // the last box on the same row as the clicked one
  const rowEnd=tiles.filter(t=>Math.abs(t.offsetTop-me.offsetTop)<4).pop()||me;
  const d=document.createElement("div"); d.className="tdetail"; d.innerHTML=detailHTML(OPEN_TILE);
  rowEnd.after(d);
  d.querySelector("[data-dclose]").onclick=()=>{ OPEN_TILE=null; placeDetail(); };
  d.querySelectorAll("tr[data-card]").forEach(r=>r.onclick=e=>{ if(e.target.closest("[data-ext]")) return; openCard(r.dataset.card); });
  activateTips(d);
}
const sum=(a,f)=>a.reduce((t,x)=>t+(Number(f(x))||0),0);
const avg=(a,f)=>{ const v=a.map(f).filter(x=>x!=null&&!isNaN(x)).map(Number); return v.length?v.reduce((t,x)=>t+x,0)/v.length:null; };
const median=a=>{ const v=a.filter(x=>x!=null).map(Number).sort((x,y)=>x-y); if(!v.length) return null; const m=Math.floor(v.length/2); return v.length%2?v[m]:(v[m-1]+v[m])/2; };
const pct=(a,b)=>b?Math.round(a/b*100):0;
const r1=n=>n==null?"—":(Math.round(n*10)/10).toLocaleString("en-IN");
function dstats(items){ return `<div class="dstats">${items.map(([k,v,d])=>`<div><span class="lbl">${k}</span><b>${v}</b>${d?`<small>${d}</small>`:""}</div>`).join("")}</div>`; }
function hbars(title,rows){ const max=Math.max(1,...rows.map(r=>Number(r.v)||0));
  return `<div class="dblock"><span class="lbl">${title}</span>${rows.length?rows.map(r=>`<div class="hbar" data-tip="${esc(r.label)}\n${esc(String(r.tip??r.text??fmt(r.v)))}">
    <span class="hl">${esc(r.label)}</span><span class="ht"><i style="width:${(Number(r.v)||0)/max*100}%;background:${r.color||"var(--c2)"}"></i></span>
    <span class="hv">${r.text??fmt(r.v)}</span></div>`).join(""):`<p class="hint">Nothing here yet.</p>`}</div>`; }
function dtable(title,head,rows,empty){
  return `<div class="dblock"><span class="lbl">${title}</span>${rows.length?`<div class="tw"><table class="mini"><thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody></table></div>`:`<p class="hint">${empty||"Nothing here yet."}</p>`}</div>`; }
const titleCell=r=>`<td class="td-idea" style="min-width:200px">${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener" data-ext="1">${esc(r.title)}</a>`:esc(r.title)}</td>`;
const cardTitle=c=>esc(c.pre.title||c.idea||"Untitled");
const TYPES=()=>Object.keys(REG.vtype), PLATS=()=>Object.keys(REG.platform);
const periodName=()=>FILTERS.period==="week"?"last 7 days":FILTERS.period==="month"?"last 30 days":"last 90 days";

function detailHTML(key){
  const vI=IDEAS.filter(platOK), vC=CARDS.filter(platOK);   // Summary platform switch
  const pub=publishedInPeriod(), from=periodStart(), allPub=vC.filter(c=>c.stage==="published");
  const head=(t,sub)=>`<div class="dh"><div><h4>${t}</h4><span class="hint">${sub}</span></div><button class="btn sm" data-dclose="1">Close ×</button></div>`;
  const byType=rows=>TYPES().map(k=>({k,label:vtypeLabel(k),rows:rows.filter(r=>r.vtype===k),color:vtypeColor(k)})).filter(g=>g.rows.length);

  if(key==="published"){
    const n=pub.length, spanDays=FILTERS.period==="week"?7:FILTERS.period==="month"?30:90;
    const g=byType(pub), wd=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const byDay=wd.map((d,i)=>({label:d,v:pub.filter(r=>((new Date(r.date+"T00:00:00").getDay()+6)%7)===i).length,color:"var(--c4)"}));
    const lenAvg=k=>avg(pub.filter(r=>r.vtype===k&&r.dur),r=>r.dur);
    return head(`${n} post${n===1?"":"s"} published`,`${periodName()} · ${FILTERS.platforms.map(k=>regLabel("platform",k)).join(" + ")}`)
      + dstats([["Posts",n,`${r1(n/spanDays*7)} a week`],
          ...g.map(x=>[x.label,x.rows.length,`${pct(x.rows.length,n)}% of posts${lenAvg(x.k)?` · avg ${mmss(lenAvg(x.k))} long`:""}`]),
          ...PLATS().map(k=>[regLabel("platform",k),pub.filter(r=>r.platform===k).length,k==="yt"?"synced":"from cards"]),
          ["Linked to a card",pub.filter(r=>r.card).length,"the rest have no idea/card behind them"]])
      + `<div class="dgrid">${hbars("By video type",g.map(x=>({label:x.label,v:x.rows.length,color:x.color})))}
         ${hbars("By day of the week",byDay)}</div>`
      + dtable("Every post in this period",["Post","Type","Date","Length","Views","Avg viewed"],
          pub.map(r=>`<tr ${r.card?`data-card="${r.card.id}" style="cursor:pointer"`:""}>${titleCell(r)}<td>${ptag(r.platform)} ${vtag(r.vtype)}</td>
            <td class="vol">${dmy(r.date)}</td><td class="vol">${r.dur?mmss(r.dur):"—"}</td><td class="vol">${fmt(r.views)}</td>
            <td class="vol">${r.viewed!=null?Math.round(r.viewed)+"%":"—"}</td></tr>`),"No posts in this period.");
  }

  if(key==="views"){
    const v=sum(pub,r=>r.views), likes=sum(pub,r=>r.likes), com=sum(pub,r=>r.comments), sh=sum(pub,r=>r.shares);
    const wm=sum(pub,r=>r.watchMin), g=byType(pub), top=[...pub].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,8);
    return head(`${fmt(v)} views`,`on the ${pub.length} posts from the ${periodName()} — counted all-time, so older posts have had longer to collect`)
      + dstats([["Views",fmt(v),`${fmt(Math.round(v/(pub.length||1)))} per post`],["Median post",fmt(median(pub.map(r=>r.views))),"half the posts got more, half less"],
          ["Likes",fmt(likes),`${r1(likes/(v||1)*100)}% of views`],["Comments",fmt(com),`${r1(com/(v||1)*100)}% of views`],
          ["Shares",fmt(sh),`${r1(sh/(v||1)*100)}% of views`],["Engagement",r1((likes+com+sh)/(v||1)*100)+"%","likes + comments + shares ÷ views"],
          ["Watch time",fmt(Math.round(wm/60))+" h",`${fmt(Math.round(wm))} minutes`],
          ["Avg viewed",avg(pub,r=>r.viewed)!=null?Math.round(avg(pub,r=>r.viewed))+"%":"—","of each video, on average"]])
      + `<div class="dgrid">${hbars("Views by video type",g.map(x=>({label:x.label,v:sum(x.rows,r=>r.views),color:x.color,
            text:`${kfmt(sum(x.rows,r=>r.views))} · ${kfmt(Math.round(sum(x.rows,r=>r.views)/x.rows.length))}/post`})))}
         ${hbars("Average % viewed by type",g.map(x=>({label:x.label,v:avg(x.rows,r=>r.viewed)||0,color:x.color,
            text:avg(x.rows,r=>r.viewed)!=null?Math.round(avg(x.rows,r=>r.viewed))+"%":"—"})))}</div>`
      + dtable("Top posts by views",["Post","Type","Views","Likes","Comments","Shares","Avg watch","Avg viewed"],
          top.map(r=>`<tr ${r.card?`data-card="${r.card.id}" style="cursor:pointer"`:""}>${titleCell(r)}<td>${vtag(r.vtype)}</td><td class="vol">${fmt(r.views)}</td>
            <td class="vol">${fmt(r.likes)}</td><td class="vol">${fmt(r.comments)}</td><td class="vol">${fmt(r.shares)}</td>
            <td class="vol">${r.watch||"—"}</td><td class="vol">${r.viewed!=null?Math.round(r.viewed)+"%":"—"}</td></tr>`),"No posts in this period.");
  }

  const ideasP=vI.filter(i=>i.created>=from);
  const stBars=list=>Object.entries(STATUS_UI).map(([k,u])=>({label:u.label,v:list.filter(i=>i.status===k).length,
    color:k==="accepted"?"var(--good)":k==="rejected"?"var(--crit)":k==="under_review"?"var(--warn)":"var(--ink-3)"}));
  const ideaRow=i=>{ const c=vC.find(x=>x.ideaId===i.id);
    return `<tr ${c?`data-card="${c.id}" style="cursor:pointer"`:""}><td class="td-idea">${esc(i.idea)}</td><td>${who(i.by)}</td><td class="vol">${dmy(i.created)}</td>
      <td>${ptag(i.platform)} ${vtag(i.vtype)}</td><td><span class="badge ${STATUS_UI[i.status].cls||"mute"}">${STATUS_UI[i.status].label}</span></td>
      <td>${c?`<span class="badge mute">${esc(STAGES.find(s=>s.id===c.stage).label)}</span>`:"—"}</td></tr>`; };

  if(key==="ideas"){
    const people={}; ideasP.forEach(i=>{ const n=i.by||"unnamed"; people[n]=(people[n]||0)+1; });
    return head(`${ideasP.length} idea${ideasP.length===1?"":"s"} logged`,periodName())
      + dstats([["Logged",ideasP.length,`${vI.length} ever`],...Object.entries(STATUS_UI).map(([k,u])=>[u.label,ideasP.filter(i=>i.status===k).length,""]),
          ["With research",ideasP.filter(i=>gResearch(i)).length,"source, tool, keyword, volume, why"]])
      + `<div class="dgrid">${hbars("By person",Object.entries(people).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({label:n,v:c,color:"var(--c3)"})))}
         ${hbars("By status",stBars(ideasP))}
         ${hbars("By video type",TYPES().map(k=>({label:vtypeLabel(k),v:ideasP.filter(i=>i.vtype===k).length,color:vtypeColor(k)})).filter(x=>x.v))}</div>`
      + dtable("Ideas in this period",["Idea","By","On","Platform","Status","Card"],[...ideasP].sort((a,b)=>b.created.localeCompare(a.created)).map(ideaRow),"No ideas logged in this period.");
  }

  if(key==="conv"){
    const acc=vI.filter(i=>i.status==="accepted"), pubIdeas=vI.filter(i=>allPub.some(c=>c.ideaId===i.id));
    const inPipe=acc.filter(i=>{ const c=vC.find(x=>x.ideaId===i.id); return c&&c.stage!=="published"; });
    return head(`${pct(pubIdeas.length,vI.length)}% of ideas became posts`,"every idea ever logged")
      + dstats([["Logged",vI.length,""],["Accepted",acc.length,`${pct(acc.length,vI.length)}%`],["In the pipeline",inPipe.length,"accepted, not out yet"],
          ["Published",pubIdeas.length,`${pct(pubIdeas.length,vI.length)}%`],["Published without an idea",allPub.filter(c=>!c.ideaId).length,"cards made directly"]])
      + `<div class="dgrid">${hbars("Where accepted ideas are now",STAGES.map(st=>({label:st.label,v:vC.filter(c=>c.ideaId&&c.stage===st.id).length,color:st.id==="published"?"var(--good)":"var(--c1)"})))}
         ${hbars("Every idea by status",stBars(vI))}</div>`
      + dtable("Accepted ideas and their cards",["Idea","By","On","Platform","Status","Card"],acc.map(ideaRow),"No accepted ideas yet.");
  }

  if(key==="accept"){
    const dec=vI.filter(i=>["accepted","rejected"].includes(i.status)), rej=vI.filter(i=>i.status==="rejected");
    const reasons={}; rej.forEach(i=>{ const r=i.rejectReason||"No reason"; reasons[r]=(reasons[r]||0)+1; });
    const people={}; dec.forEach(i=>{ const n=i.by||"unnamed"; people[n]=people[n]||{a:0,d:0}; people[n].d++; if(i.status==="accepted") people[n].a++; });
    return head(`${pct(dec.length-rej.length,dec.length)}% accepted`,"of every idea the head has decided on")
      + dstats(Object.entries(STATUS_UI).map(([k,u])=>[u.label,vI.filter(i=>i.status===k).length,k==="new"?"waiting for a decision":""]))
      + `<div class="dgrid">${hbars("Why ideas were rejected",Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([r,c])=>({label:r,v:c,color:"var(--crit)"})))}
         ${hbars("Acceptance by person",Object.entries(people).map(([n,o])=>({label:n,v:pct(o.a,o.d),color:"var(--good)",text:`${pct(o.a,o.d)}% · ${o.a}/${o.d}`})))}</div>`
      + dtable("Rejected ideas",["Idea","By","Reason","Note"],rej.map(i=>`<tr><td class="td-idea">${esc(i.idea)}</td><td>${who(i.by)}</td>
          <td><span class="badge crit">${esc(i.rejectReason||"—")}</span></td><td class="td-txt">${esc(i.rejectNote||"")}</td></tr>`),"Nothing rejected yet.");
  }

  if(key==="cycle"){
    const done=allPub.filter(c=>c.acceptedOn&&c.published).map(c=>({c,d:days(c.acceptedOn,c.published)})).sort((a,b)=>b.d-a.d);
    const g=TYPES().map(k=>({k,label:vtypeLabel(k),list:done.filter(x=>x.c.vtype===k),color:vtypeColor(k)})).filter(x=>x.list.length);
    return head(`${done.length?Math.round(avg(done,x=>x.d)):0} days from accepted to published`,`average over ${done.length} published card${done.length===1?"":"s"}`)
      + dstats([["Average",done.length?r1(avg(done,x=>x.d))+" d":"—",""],["Median",done.length?r1(median(done.map(x=>x.d)))+" d":"—",""],
          ["Fastest",done.length?done[done.length-1].d+" d":"—",done.length?cardTitle(done[done.length-1].c):""],["Slowest",done.length?done[0].d+" d":"—",done.length?cardTitle(done[0].c):""]])
      + `<div class="dgrid">${hbars("Average days by video type",g.map(x=>({label:x.label,v:avg(x.list,y=>y.d),color:x.color,text:r1(avg(x.list,y=>y.d))+" d"})))}</div>`
      + dtable("Each published card",["Card","Type","Accepted","Published","Days"],done.map(x=>`<tr data-card="${x.c.id}" style="cursor:pointer"><td class="td-idea">${cardTitle(x.c)}</td>
          <td>${ptag(x.c.platform)} ${vtag(x.c.vtype)}</td><td class="vol">${dmy(x.c.acceptedOn)}</td><td class="vol">${dmy(x.c.published)}</td><td class="vol">${x.d}</td></tr>`),
          "No published cards yet. Cards count here once they are moved to Published.");
  }

  if(key==="ontime"){
    const rows=allPub.map(c=>({c,diff:c.scheduled&&c.published?days(c.scheduled,c.published):null}));
    const on=rows.filter(x=>x.diff===0).length, late=rows.filter(x=>x.diff>0).length, early=rows.filter(x=>x.diff<0).length, none=rows.filter(x=>x.diff==null).length;
    return head(`${pct(on,rows.length)}% shipped on the scheduled date`,`${rows.length} published card${rows.length===1?"":"s"}`)
      + dstats([["On time",on,""],["Late",late,late?`avg ${r1(avg(rows.filter(x=>x.diff>0),x=>x.diff))} days late`:""],["Early",early,""],["No date set",none,"never scheduled"]])
      + dtable("Scheduled vs published",["Card","Type","Scheduled","Published","Result"],rows.sort((a,b)=>(b.diff??-99)-(a.diff??-99)).map(x=>`<tr data-card="${x.c.id}" style="cursor:pointer">
          <td class="td-idea">${cardTitle(x.c)}</td><td>${ptag(x.c.platform)} ${vtag(x.c.vtype)}</td><td class="vol">${dmy(x.c.scheduled)}</td><td class="vol">${dmy(x.c.published)}</td>
          <td>${x.diff==null?`<span class="badge mute">no date</span>`:x.diff===0?`<span class="badge good">on time</span>`:x.diff>0?`<span class="badge crit">${x.diff} d late</span>`:`<span class="badge warn">${-x.diff} d early</span>`}</td></tr>`),
          "No published cards yet.");
  }

  if(key==="research"){
    const miss=c=>{ const p=c.pre, k=(p.keywords||[]), prim=k.find(x=>x.rank==="primary")||k[0], out=[];
      if(!p.source) out.push("Idea source"); if(!p.tool) out.push("Research tool"); if(!prim||!prim.kw) out.push("Primary keyword");
      else if(prim.vol==null) out.push("Keyword volume"); if(!p.why) out.push("Why this idea"); return out; };
    const skipped=allPub.filter(c=>!gResearch(c.pre)), counts={};
    skipped.forEach(c=>miss(c).forEach(m=>counts[m]=(counts[m]||0)+1));
    return head(`${pct(allPub.length-skipped.length,allPub.length)}% published with full research`,`${allPub.length} published card${allPub.length===1?"":"s"}`)
      + dstats([["Full research",allPub.length-skipped.length,""],["Skipped",skipped.length,""],["Overridden",allPub.filter(c=>c.override).length,"head let it through with a reason"],
          ["Cards in progress missing it",vC.filter(c=>c.stage!=="published"&&!gResearch(c.pre)).length,"will be blocked at To Do"]])
      + `<div class="dgrid">${hbars("What was missing most",Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([m,c])=>({label:m,v:c,color:"var(--crit)"})))}</div>`
      + dtable("Published without full research",["Card","Missing","Override"],skipped.map(c=>`<tr data-card="${c.id}" style="cursor:pointer"><td class="td-idea">${cardTitle(c)}</td>
          <td class="td-txt">${miss(c).join(", ")}</td><td class="td-txt">${c.override?`${esc(c.override.by)}: ${esc(c.override.reason)}`:"—"}</td></tr>`),"Every published card had its research done.");
  }

  if(key==="backlog"){
    const todo=vC.filter(c=>c.stage==="todo").map(c=>({c,age:c.acceptedOn?days(c.acceptedOn,today()):null})).sort((a,b)=>(b.age??0)-(a.age??0));
    return head(`${todo.length} card${todo.length===1?"":"s"} waiting in To Do`,"accepted, not started yet")
      + dstats([["In To Do",todo.length,todo.length<3?"thin — log and accept more ideas":todo.length>20?"hoarding — too many waiting":"healthy"],
          ["Oldest",todo.length&&todo[0].age!=null?todo[0].age+" d":"—","since it was accepted"],
          ["Blocked by research",todo.filter(x=>!gatePass(x.c,"research")).length,"can't leave To Do yet"],
          ...STAGES.filter(st=>st.id!=="todo"&&st.id!=="published").map(st=>[st.label,vC.filter(c=>c.stage===st.id).length,"further along"])])
      + `<div class="dgrid">${hbars("Waiting, by video type",TYPES().map(k=>({label:vtypeLabel(k),v:todo.filter(x=>x.c.vtype===k).length,color:vtypeColor(k)})).filter(x=>x.v))}
         ${hbars("Waiting, by platform",PLATS().map(k=>({label:regLabel("platform",k),v:todo.filter(x=>x.c.platform===k).length,color:platColor(k)})).filter(x=>x.v))}</div>`
      + dtable("Cards in To Do",["Card","Type","Waiting","Research gate"],todo.map(x=>`<tr data-card="${x.c.id}" style="cursor:pointer"><td class="td-idea">${cardTitle(x.c)}</td>
          <td>${ptag(x.c.platform)} ${vtag(x.c.vtype)}</td><td class="vol">${x.age!=null?x.age+" days":"—"}</td>
          <td>${gatePass(x.c,"research")?`<span class="badge good">ready</span>`:`<span class="badge crit">blocked</span>`}</td></tr>`),"Nothing waiting.");
  }
  return head("Details","")+`<p class="hint">No details for this box.</p>`;
}

/* ------------------------------------------------------------ IDEATION */
function kwCell(list){
  if(!list||!list.length) return `<span class="miss">not set</span>`;
  const p=list.filter(k=>k.rank==="primary"), s=list.filter(k=>k.rank!=="primary");
  const tot=list.reduce((a,k)=>a+(k.vol||0),0);
  return [...p,...s].map(k=>`<div class="kwrow ${k.rank==="primary"?"pri":"sec"}">
      <span class="k">${k.rank==="primary"?"◆ ":"· "}${esc(k.kw)}</span><span class="v">${fmt(k.vol)}</span></div>`).join("")
    + (list.length>1?`<div class="kwrow" style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px">
      <span class="k" style="color:var(--ink-3);font-size:11px">combined</span><span class="v">${fmt(tot)}</span></div>`:"");
}

function setStatus(i,st){
  if(!canEdit()){ toast("You can view this space but not edit it"); refresh(); return; }
  if(st==="rejected"){ openReject(i); return; }
  i.status=st;
  if(st==="accepted"&&!CARDS.find(c=>c.ideaId===i.id)){
    CARDS.push(blankCard({ ideaId:i.id, idea:i.idea, platform:i.platform, vtype:i.vtype, stage:"todo",
      pre:{ source:i.source, tool:i.tool, keywords:(i.keywords||[]).map(k=>({...k})),
            why:i.why, title:i.title, desc:i.desc, hashtags:i.hashtags } }));
    toast("Accepted — card created in To Do with everything copied across");
  } else toast(`Status set to ${STATUS_UI[st].label.toLowerCase()}`);
  save();
}

function renderIdeation(){
  const ro=!canEdit();
  const rows=IDEAS.map(i=>{ const card=CARDS.find(c=>c.ideaId===i.id);
    return `<tr>
      <td class="td-idea">${esc(i.idea)}
        ${i.status==="rejected"&&i.rejectReason?`<div style="margin-top:5px"><span class="badge crit">${esc(i.rejectReason)}</span></div>`:""}
        ${card?`<div style="margin-top:5px"><span class="badge mute">→ ${esc(STAGES.find(s=>s.id===card.stage).label)}</span></div>`:""}</td>
      <td>${who(i.by)}</td>
      <td class="vol">${dmy(i.created)}<small>${i.created?new Date(i.created+"T00:00:00").getFullYear():""}</small></td>
      <td><span class="hook">${i.hook?esc(i.hook):`<span class="miss" style="font-family:var(--mono)">not set</span>`}</span></td>
      <td class="cta">${i.cta?esc(i.cta):`<span class="miss">not set</span>`}</td>
      <td>${ptag(i.platform)}</td>
      <td>${vtag(i.vtype)}</td>
      <td><span class="chip">${i.source?esc(regLabel("source",i.source)):"—"}</span></td>
      <td class="vol">${i.tool?esc(regLabel("tool",i.tool)):"—"}</td>
      <td class="td-kw">${kwCell(i.keywords)}</td>
      <td class="td-txt" style="color:var(--ink);font-weight:600">${i.title?esc(i.title):`<span class="miss">not set</span>`}</td>
      <td class="td-txt">${i.desc?esc(i.desc):`<span class="miss">not set</span>`}</td>
      <td class="td-txt" style="font-family:var(--mono);font-size:11.5px">${i.hashtags?esc(i.hashtags):`<span class="miss">not set</span>`}</td>
      <td class="td-txt">${i.studentWhy?esc(i.studentWhy):`<span class="miss">not set</span>`}</td>
      <td class="td-txt">${i.why?esc(i.why):`<span class="miss">not set</span>`}</td>
      <td><select class="stsel ${STATUS_UI[i.status].cls}" data-stidea="${i.id}" ${ro?"disabled":""}>
        ${Object.entries(STATUS_UI).map(([k,v])=>`<option value="${k}" ${i.status===k?"selected":""}>${v.label}</option>`).join("")}</select></td>
      <td><button class="cbtn ${i.comments.length?"has":""}" data-cmt="${i.id}">💬 ${i.comments.length||""}</button></td>
      <td><button class="btn sm" data-edit="${i.id}">Open</button></td></tr>`; }).join("");

  $("#pane-ideation").innerHTML=`
    <div class="sec"><div class="sec-h"><h3>All ideas</h3>
      <span class="hint">${IDEAS.length} idea${IDEAS.length===1?"":"s"} · the creator writes the whole post here; the head sets the status afterwards</span>
      ${ro?"":`<button class="btn pri" id="newIdea" style="margin-left:auto">+ New idea</button>`}</div>
      <div class="tw"><table><thead><tr>
        <th>Idea</th><th>Reported by</th><th>Reported on</th><th>Hook</th><th>CTA</th><th>Platform</th><th>Video type</th>
        <th>Idea source</th><th>Research tool</th><th>Target keyword(s) &amp; volume</th>
        <th>Title</th><th>Description</th><th>Hashtags</th><th>Why students should watch</th><th>Why this idea</th><th>Status</th><th>💬</th><th></th>
      </tr></thead><tbody>${rows||`<tr><td colspan="18" style="color:var(--ink-3)">No ideas yet.${ro?"":" Press <b>+ New idea</b> to log the first one."}</td></tr>`}</tbody></table></div></div>

    <div class="sec"><div class="card" style="background:var(--surface-4)">
      <div class="lbl" style="margin-bottom:7px">How this table works</div>
      <p class="hint" style="margin:0;max-width:78ch">
      The creator owns every column here — research, hook, CTA, title, description and hashtags are written once, at idea stage.
      A new idea arrives with no status; the head sets it from the dropdown in this table, or from inside the idea.
      <b style="color:var(--ink)">Accepted</b> builds a card in Content Process → To Do with everything copied across, so nothing is
      typed twice. <b style="color:var(--ink)">Rejected</b> asks for a reason from a fixed list, which is what makes rejections
      countable. <b style="color:var(--ink)">Parked</b> keeps a good idea for a better moment. Nothing is ever deleted — the idea
      stays here after acceptance so the funnel keeps its denominator.</p></div></div>`;

  const ni=$("#newIdea"); if(ni) ni.onclick=()=>openIdea(null);
  const P=$("#pane-ideation");
  P.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openIdea(b.dataset.edit));
  P.querySelectorAll("[data-cmt]").forEach(b=>b.onclick=()=>openIdea(b.dataset.cmt,true));
  P.querySelectorAll("[data-stidea]").forEach(s=>s.onchange=()=>{
    const i=IDEAS.find(x=>x.id===s.dataset.stidea); setStatus(i,s.value); });
}

/* ------------------------------------------------------------ CONTENT PROCESS */
let DRAG=null;
function gateChips(c){ const r=gResearch(c.pre)||!!c.override, cp=gCopy(c.pre), a=gAssets(c);
  return `<div class="gates">
    <span class="gchip ${r?"ok":"no"}">${r?"✓":"×"} research${c.override&&!gResearch(c.pre)?" (ovr)":""}</span>
    <span class="gchip ${cp?"ok":"no"}">${cp?"✓":"×"} copy</span>
    <span class="gchip ${a?"ok":""}">${a?"✓":"·"} assets</span></div>`; }

function renderProcess(){
  const ro=!canEdit();
  const cols=STAGES.map(s=>{ const items=CARDS.filter(c=>c.stage===s.id);
    return `<div class="col" data-stage="${s.id}">
      <div class="col-h"><h4>${s.label}</h4><span class="count">${items.length}</span></div>
      ${items.map(c=>{ const lp=livePost(c); return `<div class="kcard ${ro?"ro":""} ${c.priority==="high"?"hot":""}" draggable="${ro?"false":"true"}" data-card="${c.id}">
        ${c.priority==="high"?`<div class="hotbar">🔔 High priority${c.fromCampaign?` · from ${esc(c.fromCampaign)}`:""}</div>`:""}
        <h5>${esc(c.pre.title||c.idea)}</h5>
        <div class="meta">${ptag(c.platform)}${vtag(c.vtype)}
          ${c.override?`<span class="badge crit">override</span>`:""}
          ${c.scheduled?`<span class="chip">${dmy(c.scheduled)}</span>`:""}
          ${lp?`<span class="badge good">${kfmt(lp.views)} views</span>`:""}</div>
        ${gateChips(c)}
        ${s.id==="todo"&&!gatePass(c,"research")?`<div class="hint" style="margin-top:7px;color:var(--crit);font-size:11px">Fill the research block to move it on</div>`:""}</div>`; }).join("")||`<div class="dashed" style="margin:0">${ro?"empty":"drop here"}</div>`}
      </div>`;}).join("");

  const blocked=CARDS.filter(c=>c.stage==="todo"&&!gatePass(c,"research")).length;
  $("#pane-process").innerHTML=`
    <div class="apibar" style="background:var(--accent-soft);border-color:color-mix(in srgb,var(--accent) 30%,transparent)">
      <span class="ic" style="color:var(--accent);border-color:var(--accent)">GATES</span>
      <p><b>Three gates, each blocking one move.</b> A card leaves <b>To Do</b> only with its research block complete;
      leaves <b>In Progress</b> only with title, description and hashtags confirmed; and leaves <b>Approved</b> only with the
      edited file, the post link, and a thumbnail if it is going to YouTube. The head can override the research gate with a written
      reason, which is recorded on the card.
      ${blocked?`<br><span style="color:var(--accent-ink);font-weight:600">${blocked} card${blocked>1?"s":""} currently blocked in To Do.</span>`:""}</p></div>
    <div class="sec"><div class="sec-h"><h3>Content Process</h3>
      <span class="hint">${CARDS.length} card${CARDS.length===1?"":"s"} · ${ro?"click a card to open it":"drag cards between columns, or click one to open it"}</span>
      ${ro?"":`<button class="btn pri" id="newCard" style="margin-left:auto">+ New card</button>`}</div>
      <div class="board">${cols}</div></div>`;

  const nc=$("#newCard"); if(nc) nc.onclick=()=>openCard(null);
  const P=$("#pane-process");
  P.querySelectorAll(".kcard").forEach(el=>{
    el.addEventListener("click",()=>{ if(!DRAG) openCard(el.dataset.card); });
    if(ro) return;
    el.addEventListener("dragstart",e=>{ DRAG=el.dataset.card; el.classList.add("dragging");
      e.dataTransfer.effectAllowed="move"; try{e.dataTransfer.setData("text/plain",DRAG);}catch(x){} });
    el.addEventListener("dragend",()=>{ el.classList.remove("dragging"); setTimeout(()=>DRAG=null,30);
      P.querySelectorAll(".col").forEach(c=>c.classList.remove("over","no")); });
  });
  if(ro) return;
  P.querySelectorAll(".col").forEach(col=>{
    // a blocked column still accepts the drop, so we can say why and open the card
    col.addEventListener("dragover",e=>{ if(!DRAG) return; e.preventDefault();
      const c=CARDS.find(x=>x.id===DRAG); const ok=canMove(c,col.dataset.stage).ok;
      e.dataTransfer.dropEffect="move";
      col.classList.toggle("over",ok); col.classList.toggle("no",!ok); });
    col.addEventListener("dragleave",()=>col.classList.remove("over","no"));
    col.addEventListener("drop",e=>{ e.preventDefault(); col.classList.remove("over","no");
      const id=DRAG||e.dataTransfer.getData("text/plain"); const c=CARDS.find(x=>x.id===id); if(!c) return;
      const to=col.dataset.stage; if(c.stage===to) return;
      const v=canMove(c,to);
      if(!v.ok){ openCard(c.id,true); toast("Can't move yet — "+v.msg.charAt(0).toLowerCase()+v.msg.slice(1)); return; }
      if(moveCard(c,to)) toast(`Moved to ${STAGES.find(s=>s.id===to).label}`); });
  });
}

/* ------------------------------------------------------------ SCHEDULE */
const schedCards=()=>CARDS.filter(c=>c.scheduled&&SCHED.vtypes.includes(c.vtype)&&SCHED.platforms.includes(c.platform));
function weekRange(cur){ const d=new Date(cur+"T00:00:00"), off=(d.getDay()+6)%7;
  const s=new Date(d); s.setDate(d.getDate()-off); const e=new Date(s); e.setDate(s.getDate()+6); return [s,e]; }

function schedSummary(){
  const all=schedCards(), TODAY=today(); let list,label;
  if(SCHED.view==="week"){ const [s,e]=weekRange(SCHED.cursor), a=iso(s), b=iso(e);
    list=all.filter(c=>c.scheduled>=a&&c.scheduled<=b);
    label=`the week of ${s.toLocaleDateString("en-GB",{day:"numeric",month:"long"})}`;
  } else { const d=new Date(SCHED.cursor+"T00:00:00"), mm=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    list=all.filter(c=>c.scheduled.startsWith(mm)); label=d.toLocaleDateString("en-GB",{month:"long",year:"numeric"}); }

  if(!list.length) return `<div class="note"><div class="lbl">Scheduled content</div>
    Nothing on the calendar for ${label} with these filters. <em>A thin week is a planning problem, not a calendar problem.</em></div>`;

  const byType={}; list.forEach(c=>byType[c.vtype]=(byType[c.vtype]||0)+1);
  const typeStr=Object.entries(byType).map(([k,n])=>`<b>${n} ${esc(vtypeLabel(k).toLowerCase())}${n>1?"s":""}</b>`).join(", ");
  const byPlat={}; list.forEach(c=>byPlat[c.platform]=(byPlat[c.platform]||0)+1);
  const platStr=Object.entries(byPlat).map(([k,n])=>`<b>${n} on ${esc(regLabel("platform",k)||k)}</b>`).join(", ");
  const sorted=[...list].sort((a,b)=>a.scheduled.localeCompare(b.scheduled));
  const next=sorted.find(c=>c.scheduled>=TODAY);
  const dayNames=[...new Set(sorted.map(c=>dow(c.scheduled)))];
  const notReady=list.filter(c=>c.stage!=="published"&&!gAssets(c)).length;
  const unsched=CARDS.filter(c=>!c.scheduled&&c.stage!=="published").length;

  return `<div class="note"><div class="lbl">Scheduled content · ${label}</div>
    ${typeStr} going out across ${dayNames.length} day${dayNames.length>1?"s":""} — ${platStr},
    running ${dmy(sorted[0].scheduled)} to ${dmy(sorted[sorted.length-1].scheduled)}.
    ${next?`Next up is <em>${esc(next.pre.title||next.idea)}</em> on ${dow(next.scheduled)} ${dmy(next.scheduled)}.`:`Everything here has already gone out.`}
    ${notReady?`<br>${notReady} of them still ${notReady>1?"have":"has"} no final file or post link.`:``}
    ${unsched?`<br>${unsched} card${unsched>1?"s are":" is"} in the process with no date at all.`:``}</div>`;
}

function renderSchedule(){
  const all=schedCards(), TODAY=today(); const cur=new Date(SCHED.cursor+"T00:00:00");
  let grid="",heading="";
  if(SCHED.view==="week"){
    const [s]=weekRange(SCHED.cursor);
    heading=`Week of ${s.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}`;
    let cells="";
    for(let i=0;i<7;i++){ const d=new Date(s); d.setDate(s.getDate()+i); const key=iso(d);
      const evts=all.filter(c=>c.scheduled===key);
      cells+=`<div class="wday ${key===TODAY?"today":""}">
        <div class="wh"><span class="lbl">${d.toLocaleDateString("en-GB",{weekday:"short"})}</span><b>${d.getDate()}</b></div>
        ${evts.map(c=>`<button class="wevt" style="border-left-color:${vtypeColor(c.vtype)}" data-card="${c.id}">
          <h6>${esc(c.pre.title||c.idea)}</h6><div class="meta">${ptag(c.platform)}${vtag(c.vtype)}</div></button>`).join("")
          ||`<span class="hint" style="font-size:11px">—</span>`}</div>`; }
    grid=`<div style="overflow-x:auto"><div class="weekgrid">${cells}</div></div>`;
  } else {
    heading=cur.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
    const y=cur.getFullYear(), m=cur.getMonth();
    const start=(new Date(y,m,1).getDay()+6)%7, dim=new Date(y,m+1,0).getDate();
    let cells=""; for(let i=0;i<start;i++) cells+=`<div class="day pad"></div>`;
    for(let dd=1;dd<=dim;dd++){ const key=iso(new Date(y,m,dd)); const evts=all.filter(c=>c.scheduled===key);
      cells+=`<div class="day ${key===TODAY?"today":""}"><span class="dn">${dd}</span>
        ${evts.map(c=>`<button class="evt" style="border-left-color:${vtypeColor(c.vtype)}" data-card="${c.id}">
          <b>${esc(c.pre.title||c.idea)}</b>${esc(platShort(c.platform))} · ${esc(vtypeLabel(c.vtype))}</button>`).join("")}</div>`; }
    grid=`<div style="overflow-x:auto"><div class="cal">
      ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="dow">${d}</div>`).join("")}${cells}</div></div>`;
  }

  $("#pane-schedule").innerHTML=`
    <div class="sec"><div class="row" style="margin-bottom:14px">
      <span class="lbl">View</span>
      <div class="seg"><button data-sv="week" class="${SCHED.view==="week"?"on":""}">Week</button>
        <button data-sv="month" class="${SCHED.view==="month"?"on":""}">Month</button></div>
      <span style="width:8px"></span><span class="lbl">Platform</span>
      ${Object.keys(REG.platform).map(k=>`<button class="chip ${SCHED.platforms.includes(k)?"on":""}" data-splat="${k}">${esc(regLabel("platform",k))}</button>`).join("")}
      <span style="width:8px"></span><span class="lbl">Type</span>
      ${Object.keys(REG.vtype).map(k=>`<button class="chip ${SCHED.vtypes.includes(k)?"on":""}" data-svt="${k}">${esc(vtypeLabel(k))}</button>`).join("")}
    </div></div>

    <div class="sec" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;align-items:start">
      ${schedSummary()}
      <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:9px"><span class="lbl">Content culture</span>
        ${canEdit()?`<button class="btn sm" id="editCulture">Edit</button>`:""}</div>
        <p style="margin:0;font-family:var(--hand);font-size:19px;line-height:1.4">${S.culture?esc(S.culture):`<span style="color:var(--ink-3)">Not set yet — e.g. 2 long videos a week, 4 reels, post at 7 PM.</span>`}</p>
        <p class="hint" style="margin:10px 0 0">The rhythm the schedule is measured against. Change it here and the summary beside it
        starts telling you when a week falls short.</p></div></div>

    <div class="sec"><div class="sec-h">
      <button class="btn sm" id="prev">←</button><h3>${heading}</h3><button class="btn sm" id="next">→</button>
      <button class="btn sm" id="todayBtn">Today</button>
      <span class="hint" style="margin-left:auto">${all.length} scheduled card${all.length===1?"":"s"} match these filters</span></div>
      ${grid}
      <div class="legend" style="margin-top:14px">
        ${Object.keys(REG.vtype).map(k=>`<span><i style="background:${vtypeColor(k)}"></i>${esc(vtypeLabel(k))}</span>`).join("")}</div></div>`;

  const P=$("#pane-schedule");
  P.querySelectorAll("[data-sv]").forEach(b=>b.onclick=()=>{SCHED.view=b.dataset.sv;renderSchedule();});
  P.querySelectorAll("[data-splat]").forEach(b=>b.onclick=()=>{toggle(SCHED.platforms,b.dataset.splat);renderSchedule();});
  P.querySelectorAll("[data-svt]").forEach(b=>b.onclick=()=>{toggle(SCHED.vtypes,b.dataset.svt);renderSchedule();});
  P.querySelectorAll("[data-card]").forEach(b=>b.onclick=()=>openCard(b.dataset.card));
  const step=n=>{ const d=new Date(SCHED.cursor+"T00:00:00");
    if(SCHED.view==="week") d.setDate(d.getDate()+7*n); else { d.setDate(1); d.setMonth(d.getMonth()+n); }
    SCHED.cursor=iso(d); renderSchedule(); };
  $("#prev").onclick=()=>step(-1); $("#next").onclick=()=>step(1);
  $("#todayBtn").onclick=()=>{SCHED.cursor=today();renderSchedule();};
  const ec=$("#editCulture"); if(ec) ec.onclick=openCulture;
}

/* ------------------------------------------------------------ DRAWERS */
function closeDrawer(){ $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); }
function openDrawer(h){ const d=$("#drawer"); d.innerHTML=h; d.classList.add("on"); $("#scrim").classList.add("on"); d.scrollTop=0; }
// the team's members, from the app's user list (profiles + memberships)
function teamNames(){ let l=[]; try{ l=(OPT.people && OPT.people()) || []; }catch(_){ }
  return [...new Set(l.filter(Boolean))].sort((a,b)=>a.localeCompare(b)); }
// a dropdown of team members; a name saved earlier that is no longer on the team stays selectable
function peopleSelect(id,val){
  const names=teamNames(); if(val && !names.includes(val)) names.unshift(val);
  return `<select id="${id}"><option value="">— choose a team member —</option>
    ${names.map(n=>`<option value="${esc(n)}" ${n===val?"selected":""}>${esc(n)}</option>`).join("")}</select>`;
}

function kwEditor(list,prefix){
  const rows=(list.length?list:[{kw:"",vol:null,rank:"primary"}]).map((k,i)=>`
    <div class="kwed"><input data-kk="kw" value="${esc(k.kw)}" placeholder="keyword">
      <input data-kk="vol" type="number" value="${k.vol??""}" placeholder="volume">
      <select data-kk="rank"><option value="primary" ${k.rank==="primary"?"selected":""}>Primary</option>
        <option value="secondary" ${k.rank!=="primary"?"selected":""}>Secondary</option></select>
      <button class="x" data-kwdel="${i}" title="Remove">×</button></div>`).join("");
  return `<div class="kwhead"><span>Keyword</span><span>Vol / month</span><span>Rank</span><span></span></div>
    <div id="${prefix}kwlist">${rows}</div>
    <button class="btn sm" id="${prefix}kwadd" style="margin-top:4px">+ Add keyword</button>`;
}
function readKw(prefix){
  const out=[];
  $("#drawer").querySelectorAll(`#${prefix}kwlist .kwed`).forEach(row=>{
    const g=k=>row.querySelector(`[data-kk="${k}"]`).value;
    const t=g("kw").trim(); if(!t) return;
    const v=g("vol"); out.push({kw:t,vol:v===""?null:Number(v),rank:g("rank"),on:today()});
  });
  if(out.length&&!out.some(k=>k.rank==="primary")) out[0].rank="primary";
  const pi=out.findIndex(k=>k.rank==="primary"); out.forEach((k,i)=>{ if(i!==pi) k.rank="secondary"; });
  return out;
}
function wireKw(prefix,cb){
  const add=$("#"+prefix+"kwadd");
  if(add) add.onclick=()=>{ const l=readKw(prefix); l.push({kw:"",vol:null,rank:l.length?"secondary":"primary"}); cb(l); };
  $("#drawer").querySelectorAll("[data-kwdel]").forEach(b=>b.onclick=()=>{ const l=readKw(prefix); l.splice(Number(b.dataset.kwdel),1); cb(l); });
}
// viewers see the drawers but not the buttons that change anything
function lockDrawer(){ if(canEdit()) return;
  $("#drawer").querySelectorAll("input,select,textarea").forEach(e=>e.disabled=true);
  $("#drawer").querySelectorAll("[data-w]").forEach(e=>e.remove()); }

/* ---- idea drawer ---- */
function openIdea(id,focusComments){
  const isNew=!id;
  const i=isNew ? blankIdea({ by:meName() }) : IDEAS.find(x=>x.id===id);
  if(!i) return;

  const draw=(kwList)=>{
    openDrawer(`
    <div class="dr-h"><div><div class="lbl">${isNew?"New idea":"Idea"}</div>
      <h3 style="margin-top:4px">${isNew?"Log an idea":esc(i.idea)}</h3></div>
      <button class="btn sm" id="xClose">Close</button></div>

    <div class="fld"><label for="i-idea">Idea</label>
      <input id="i-idea" value="${esc(i.idea)}" placeholder="What is the video, in one line?"></div>
    <div class="fld"><label for="i-studentwhy">Why should students watch this video?</label>
      <textarea id="i-studentwhy" placeholder="Would you suggest this video to your little brother or cousin? Why?">${esc(i.studentWhy||"")}</textarea></div>
    <div class="grid2">
      <div class="fld"><label for="i-by">Reported by</label>
        ${peopleSelect("i-by",i.by)}</div>
      <div class="fld"><label for="i-created">Reported on</label>
        <input id="i-created" type="date" value="${esc(i.created||today())}"></div>
      <div class="fld"><label for="i-vtype">Video type</label>
        ${regSelect("vtype","i-vtype",i.vtype,"e.g. Podcast clip, Story, Live",false)}</div>
    </div>
    <div class="fld"><label for="i-platform">Platform</label>
      ${regSelect("platform","i-platform",i.platform,"e.g. LinkedIn, X, WhatsApp channel",false)}</div>

    <div class="block">
      <div class="block-h"><h4>Hook &amp; CTA</h4><span class="hint">The first three seconds and the ask</span></div>
      <div class="fld"><label for="i-hook">Hook</label>
        <textarea id="i-hook" class="hookin" placeholder="What stops the scroll?">${esc(i.hook)}</textarea></div>
      <div class="fld" style="margin-bottom:0"><label for="i-cta">CTA</label>
        <input id="i-cta" value="${esc(i.cta)}" placeholder="What do they do next?"></div></div>

    <div class="block">
      <div class="block-h"><h4>Research</h4><span class="hint">Fill these and the card clears its first gate on day one</span></div>
      <div class="grid2">
        <div class="fld"><label for="i-source">Idea source</label>
          ${regSelect("source","i-source",i.source,"e.g. college WhatsApp group, a parent's email")}</div>
        <div class="fld"><label for="i-tool">Research tool</label>
          ${regSelect("tool","i-tool",i.tool,"e.g. Semrush, TubeBuddy, Meta Insights")}</div></div>
      <div class="fld"><label>Target keyword(s) &amp; search volume</label>${kwEditor(kwList,"i-")}</div>
      <p class="hint" style="margin:-2px 0 10px">One primary, as many secondaries as you like. Volumes are typed by hand and go
        stale — saving stamps today's date against each one.</p>
      <div class="fld" style="margin-bottom:0"><label for="i-why">Why this idea</label>
        <textarea id="i-why" placeholder="One line. What does this win us?">${esc(i.why)}</textarea></div></div>

    <div class="block">
      <div class="block-h"><h4>The post itself</h4><span class="hint">Written once, here — the card inherits it</span></div>
      <div class="fld"><label for="i-title">Title</label>
        <input id="i-title" value="${esc(i.title)}" placeholder="The title as it will appear"></div>
      <div class="fld"><label for="i-desc">Description</label>
        <textarea id="i-desc" placeholder="The description / caption as it will be posted">${esc(i.desc)}</textarea></div>
      <div class="fld" style="margin-bottom:0"><label for="i-hashtags">Hashtags</label>
        <input id="i-hashtags" value="${esc(i.hashtags)}" placeholder="#delhiuniversity #csas …"></div></div>

    ${isNew?`<p class="hint" style="margin:0 0 14px;padding:11px 13px;background:var(--surface-2);border-radius:var(--r)">
      A new idea is logged with no status. The head sets it to accepted, rejected or parked afterwards, from the
      status column in the table or from this panel once the idea exists.</p>`
    :`<div class="block">
      <div class="block-h"><h4>Status</h4><span class="badge ${STATUS_UI[i.status].cls||"mute"}">${STATUS_UI[i.status].label}</span></div>
      ${i.status==="rejected"&&i.rejectReason?`<p class="hint" style="margin:0 0 10px">
        <b style="color:var(--crit)">${esc(i.rejectReason)}</b> — ${esc(i.rejectNote||"")}</p>`:""}
      <div class="row" data-w="1">
        <button class="btn" data-st="new">New</button><button class="btn" data-st="under_review">Under review</button>
        <button class="btn pri" data-st="accepted">Accept</button><button class="btn danger" data-st="rejected">Reject</button>
        <button class="btn" data-st="parked">Park</button></div>
      <p class="hint" style="margin:10px 0 0">Accepting creates a card in Content Process → To Do and copies everything above into it.
        The idea stays here either way.</p></div>`}

    <div class="block" id="cmtBlock">
      <div class="block-h"><h4>Comments</h4><span class="hint">${i.comments.length} on this idea</span></div>
      ${i.comments.map(c=>`<div class="cmt">${who(c.by)}<p style="margin-top:3px">${esc(c.text)}</p></div>`).join("")||`<p class="hint" style="margin:0">No comments yet.</p>`}
      <div data-w="1"><div class="grid2" style="margin-top:12px">
        <div class="fld" style="margin-bottom:0"><label for="i-cmtby">Comment as</label>
          ${peopleSelect("i-cmtby",meName())}</div></div>
      <div class="fld" style="margin-top:10px"><label for="i-newcmt">Add a comment</label>
        <textarea id="i-newcmt" placeholder="Write a note…"></textarea></div>
      <button class="btn sm" id="addCmt">Post comment</button></div></div>

    <div class="row" style="margin-top:18px">
      <button class="btn pri" id="saveIdea" data-w="1">${isNew?"Log idea":"Save changes"}</button>
      <button class="btn" id="xClose2">${canEdit()?"Cancel":"Close"}</button></div>`);

    const read=()=>{
      i.idea=$("#i-idea").value.trim(); i.studentWhy=$("#i-studentwhy").value.trim(); i.by=$("#i-by").value.trim(); i.created=$("#i-created").value||today();
      i.platform=readReg("platform","i-platform",i.platform)||"ig"; i.vtype=readReg("vtype","i-vtype",i.vtype)||"reel";
      i.hook=$("#i-hook").value.trim(); i.cta=$("#i-cta").value.trim();
      i.source=readReg("source","i-source"); i.tool=readReg("tool","i-tool"); i.keywords=readKw("i-");
      i.title=$("#i-title").value.trim(); i.desc=$("#i-desc").value.trim();
      i.hashtags=$("#i-hashtags").value.trim(); i.why=$("#i-why").value.trim();
    };
    const exists=()=>!!IDEAS.find(x=>x.id===i.id);
    const persist=()=>{ if(!exists()) IDEAS.unshift(i); };

    $("#xClose").onclick=$("#xClose2").onclick=closeDrawer;
    ["i-platform","i-vtype","i-source","i-tool"].forEach(wireReg);
    wireKw("i-", l=>{ read(); draw(l); });
    const ac=$("#addCmt"); if(ac) ac.onclick=()=>{ const t=$("#i-newcmt").value.trim(); if(!t) return;
      const n=$("#i-cmtby").value.trim()||meName()||"Someone";
      read(); if(!i.idea){ toast("Give the idea a one-line summary first"); return; }
      persist(); i.comments.push({by:n,text:t,on:today()}); if(save()) openIdea(i.id,true); };
    const si=$("#saveIdea"); if(si) si.onclick=()=>{ read(); if(!i.idea){toast("An idea needs a one-line summary");return;}
      if(!i.by){toast("Add who is reporting this idea");return;}
      persist(); if(save()){ closeDrawer(); toast(isNew?"Idea logged — the head sets its status":"Saved"); } };
    $("#drawer").querySelectorAll("[data-st]").forEach(b=>b.onclick=()=>{
      read(); if(!i.idea){toast("An idea needs a one-line summary");return;}
      persist(); closeDrawer(); setStatus(i,b.dataset.st); });
    lockDrawer();
    if(focusComments) setTimeout(()=>{ const cb=$("#cmtBlock"); if(cb) cb.scrollIntoView({block:"center"}); },60);
  };
  draw(i.keywords||[]);
}

function openReject(i){
  openDrawer(`<div class="dr-h"><div><div class="lbl">Reject idea</div>
      <h3 style="margin-top:4px">${esc(i.idea)}</h3></div></div>
    <p class="hint" style="margin-bottom:16px">A rejection needs a reason from the list. The list is what makes rejections
      countable — if a third of them say "keyword too broad", that is a brief for the creator, not a statistic.</p>
    <div class="fld"><label for="r-reason">Reason</label><select id="r-reason">
      ${REJECT_REASONS.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select></div>
    <div class="fld"><label for="r-note">Note to ${esc(i.by||"the creator")}</label>
      <textarea id="r-note" placeholder="What would make this work instead?"></textarea></div>
    <div class="row" style="margin-top:14px"><button class="btn danger" id="doReject">Reject idea</button>
      <button class="btn" id="cancelReject">Back</button></div>`);
  $("#cancelReject").onclick=()=>{ closeDrawer(); refresh(); };
  $("#doReject").onclick=()=>{ i.status="rejected"; i.rejectReason=$("#r-reason").value; i.rejectNote=$("#r-note").value.trim();
    if(save()){ closeDrawer(); toast("Rejected with a reason on record"); } };
}

/* ---- card drawer ---- */
function openCard(id,showGate){
  const isNew=!id;
  const c=isNew ? blankCard() : CARDS.find(x=>x.id===id);
  if(!c) return;

  const draw=(kwList)=>{
    const rOk=gResearch(c.pre)||!!c.override, cOk=gCopy(c.pre), aOk=gAssets(c);
    const idx=STAGES.findIndex(s=>s.id===c.stage);
    const srcIdea=c.ideaId?IDEAS.find(x=>x.id===c.ideaId):null;
    const lp=livePost(c);
    const fileSlot=(key,label,accept,note)=>{ const f=c.post[key];
      return `<div class="drop ${f?"has":""}">
        ${f?`${f.preview?`<img src="${f.preview}" alt="">`:`<span style="font-size:22px">${key==="reel"?"🎬":"🖼"}</span>`}
            <div style="flex:1;min-width:0"><div class="lbl" style="margin:0 0 2px">${label}</div>
              <div class="nm">${esc(f.name)}</div><div class="sz">${mb(f.size)}</div></div>
            <button class="btn sm" data-clear="${key}" data-w="1">Replace</button>`
          :`<div class="lbl">${label}</div>
            <label class="filebtn" data-w="1">Choose file<input type="file" accept="${accept}" data-file="${key}"></label>
            <div class="hint" style="margin-top:7px">${note}</div>`}</div>`; };

    openDrawer(`
    <div class="dr-h"><div><div class="lbl">${STAGES[idx].label}${srcIdea?" · from Ideation":""}</div>
      <h3 style="margin-top:4px">${isNew?"New card":esc(c.pre.title||c.idea)}</h3></div>
      <button class="btn sm" id="xClose">Close</button></div>

    <div class="fld"><label for="c-idea">Idea</label>
      <input id="c-idea" value="${esc(c.idea)}" placeholder="What is this video, in one line?"></div>
    <div class="grid2">
      <div class="fld"><label for="c-platform">Platform</label>
        ${regSelect("platform","c-platform",c.platform,"e.g. LinkedIn, X, WhatsApp channel",false)}</div>
      <div class="fld"><label for="c-vtype">Video type</label>
        ${regSelect("vtype","c-vtype",c.vtype,"e.g. Podcast clip, Story, Live",false)}</div></div>
    <div class="fld"><label for="c-sched">Scheduled date</label><input id="c-sched" type="date" value="${c.scheduled||""}"></div>

    <div class="block" data-gate="pre" style="border-color:${rOk&&cOk?"color-mix(in srgb,var(--good) 40%,var(--line))":"color-mix(in srgb,var(--crit) 35%,var(--line))"}">
      <div class="block-h"><h4>Pre-production</h4>
        <span class="badge ${rOk?"good":"crit"}">${rOk?"research ✓":"research ×"}</span>
        <span class="badge ${cOk?"good":"crit"}">${cOk?"copy ✓":"copy ×"}</span></div>
      ${srcIdea?`<p class="hint" style="margin:-3px 0 11px;padding:8px 10px;background:var(--surface-2);border-radius:var(--r-s)">
        Copied from the idea when it was accepted. Edit freely here — the original idea is left untouched.
        <button class="btn sm" id="repull" style="margin-left:6px" data-w="1">Re-pull from idea</button></p>`:""}
      <div class="grid2">
        <div class="fld ${c.pre.source?"":"bad"}"><label for="r-source">Idea source<span class="req">required</span></label>
          ${regSelect("source","r-source",c.pre.source,"e.g. college WhatsApp group")}</div>
        <div class="fld ${c.pre.tool?"":"bad"}"><label for="r-tool">Research tool<span class="req">required</span></label>
          ${regSelect("tool","r-tool",c.pre.tool,"e.g. Semrush, TubeBuddy")}</div></div>
      <div class="fld"><label>Target keyword(s) &amp; search volume<span class="req">primary required</span></label>${kwEditor(kwList,"c-")}</div>
      <div class="fld ${c.pre.why?"":"bad"}"><label for="r-why">Why this idea<span class="req">required</span></label>
        <textarea id="r-why" placeholder="One line.">${esc(c.pre.why)}</textarea></div>
      <div class="fld ${c.pre.title?"":"bad"}"><label for="r-title">Title<span class="req">required</span></label>
        <input id="r-title" value="${esc(c.pre.title)}"></div>
      <div class="fld ${c.pre.desc?"":"bad"}"><label for="r-desc">Description<span class="req">required</span></label>
        <textarea id="r-desc">${esc(c.pre.desc)}</textarea></div>
      <div class="fld ${c.pre.hashtags?"":"bad"}" style="margin-bottom:0"><label for="r-hashtags">Hashtags<span class="req">required</span></label>
        <input id="r-hashtags" value="${esc(c.pre.hashtags)}"></div>
      ${c.override?`<p class="hint" style="margin:12px 0 0;padding:9px;background:var(--crit-soft);border-radius:var(--r-s);color:var(--crit)">
        <b>Research gate overridden</b> by ${esc(c.override.by)} on ${dmy(c.override.on)} — ${esc(c.override.reason)}</p>`:""}</div>

    <div class="block" style="border-color:${aOk?"color-mix(in srgb,var(--good) 40%,var(--line))":"var(--line)"}">
      <div class="block-h"><h4>Post-production</h4><span class="badge ${aOk?"good":"mute"}">${aOk?"ready to publish":"incomplete"}</span></div>
      ${fileSlot("reel", c.vtype==="long"?"Edited video":"Edited reel","video/*","Pick the final cut — its name and size are recorded on the card (the file itself stays with you).")}
      ${c.platform==="yt"
        ? fileSlot("thumb","Thumbnail","image/*","Required for YouTube. A small preview is kept on the card.")
        : `<div class="drop" style="opacity:.55;text-align:left"><div class="lbl" style="margin:0 0 3px">Thumbnail</div>
           <div class="hint">Not required on ${esc(regLabel("platform",c.platform)||c.platform)} — attach one anyway by switching the platform to YouTube.</div></div>`}
      <div class="fld" style="margin-bottom:6px"><label for="p-url">Final post link</label>
        <input id="p-url" value="${esc(c.post.postUrl)}" placeholder="https://…"></div>
      <p class="hint" style="margin:0">${c.platform==="yt"
        ? (lp?`<b style="color:var(--good)">Linked to YouTube</b> — “${esc(lp.title)}”. Its numbers fill in below by themselves.`
             :`The post link is the join key. Paste the YouTube link and this card's numbers fill in from the next sync.`)
        : c.platform==="ig" ? (lp?`<b style="color:var(--good)">Linked to Instagram</b> — “${esc(lp.title)}”. Its numbers fill in below by themselves.`
             :`The post link is the join key. Paste the Instagram link and this card's numbers fill in from the next sync.`)
        : `The post link is the join key.`}</p></div>

    ${lp?`
    <div class="block"><div class="block-h"><h4>Performance</h4><span class="badge good">live from ${c.platform==="ig"?"Instagram":"YouTube"}</span></div>
      <div class="livegrid">
        <div><span class="lbl">Views</span><b>${fmt(lp.views)}</b></div>
        <div><span class="lbl">Likes</span><b>${fmt(lp.likes)}</b></div>
        <div><span class="lbl">Comments</span><b>${fmt(lp.comments)}</b></div>
        <div><span class="lbl">Shares</span><b>${fmt(lp.shares)}</b></div>
        <div><span class="lbl">Avg watch</span><b>${mmss(lp.avg_view_s)}</b></div>
        <div><span class="lbl">Avg viewed</span><b>${lp.avg_view_pct!=null?Math.round(lp.avg_view_pct)+"%":"—"}</b></div></div>
      <p class="hint" style="margin:10px 0 0">Updated ${esc(ago(lp.updated_at))}. YouTube figures settle 48–72 hours after publishing. Thumbnail CTR: see YouTube Studio.</p></div>`
    : c.stage==="published"?`
    <div class="block"><div class="block-h"><h4>Performance</h4><span class="badge mute">manual entry</span></div>
      <div class="grid2">
        <div class="fld"><label for="m-views">Views</label><input id="m-views" type="number" value="${c.metrics?.views??""}"></div>
        <div class="fld"><label for="m-likes">Likes</label><input id="m-likes" type="number" value="${c.metrics?.likes??""}"></div></div>
      <div class="grid2">
        <div class="fld"><label for="m-comments">Comments</label><input id="m-comments" type="number" value="${c.metrics?.comments??""}"></div>
        <div class="fld"><label for="m-shares">Shares</label><input id="m-shares" type="number" value="${c.metrics?.shares??""}"></div></div>
      <div class="grid2">
        <div class="fld"><label for="m-watch">Avg watch time</label><input id="m-watch" value="${esc(c.metrics?.watch??"")}" placeholder="0:24"></div>
        <div class="fld"><label for="m-ctr">Thumbnail CTR %${c.platform!=="yt"?" (YouTube only)":""}</label>
          <input id="m-ctr" type="number" step="0.1" value="${c.metrics?.ctr??""}" ${c.platform!=="yt"?"disabled":""}></div></div>
      <p class="hint" style="margin:0">${c.platform==="yt"?"Paste the video's YouTube link above and these fill in by themselves.":"Read these off Instagram once a week until it is connected."}</p></div>`:""}

    <div class="block" data-w="1"><div class="block-h"><h4>Move card</h4><span class="hint">Or drag it on the board</span></div>
      <div class="row">
        ${idx>0?`<button class="btn" data-move="${STAGES[idx-1].id}">← ${STAGES[idx-1].label}</button>`:""}
        ${idx<STAGES.length-1?`<button class="btn pri" data-move="${STAGES[idx+1].id}" ${canMove(c,STAGES[idx+1].id).ok?"":"disabled"}>${STAGES[idx+1].label} →</button>`:""}</div>
      ${idx<STAGES.length-1&&!canMove(c,STAGES[idx+1].id).ok?`<p class="hint" style="margin:10px 0 0;color:var(--crit)">${esc(canMove(c,STAGES[idx+1].id).msg)}</p>`:""}
      ${c.stage==="todo"&&!rOk?`<button class="btn danger sm" id="override" style="margin-top:8px">Override research gate (head only)</button>`:""}</div>

    <div class="row" style="margin-top:18px">
      <button class="btn pri" id="saveCard" data-w="1">${isNew?"Create card":"Save changes"}</button>
      <button class="btn" id="xClose2">${canEdit()?"Cancel":"Close"}</button>
      ${!isNew?`<button class="btn danger" id="delCard" style="margin-left:auto" data-w="1">Delete</button>`:""}</div>`);

    const read=()=>{
      c.idea=$("#c-idea").value.trim(); c.platform=readReg("platform","c-platform",c.platform)||"ig"; c.vtype=readReg("vtype","c-vtype",c.vtype)||"reel";
      c.scheduled=$("#c-sched").value||null;
      c.pre.source=readReg("source","r-source"); c.pre.tool=readReg("tool","r-tool"); c.pre.keywords=readKw("c-");
      c.pre.why=$("#r-why").value.trim(); c.pre.title=$("#r-title").value.trim();
      c.pre.desc=$("#r-desc").value.trim(); c.pre.hashtags=$("#r-hashtags").value.trim();
      c.post.postUrl=$("#p-url").value.trim();
      if(c.stage==="published" && $("#m-views")){ const n=s=>{const e=$(s); return !e||e.value===""?null:Number(e.value);};
        c.metrics={ views:n("#m-views"), likes:n("#m-likes"), comments:n("#m-comments"),
          shares:n("#m-shares"), watch:($("#m-watch")&&$("#m-watch").value.trim())||null, ctr:n("#m-ctr") }; }
    };
    const persist=()=>{ if(!CARDS.find(x=>x.id===c.id)) CARDS.push(c); };

    $("#xClose").onclick=$("#xClose2").onclick=closeDrawer;
    ["c-platform","c-vtype","r-source","r-tool"].forEach(wireReg);
    wireKw("c-", l=>{ read(); draw(l); });
    ["c-platform","c-vtype"].forEach(id=>$("#"+id).addEventListener("change",()=>{
      if($("#"+id).value!=="__other"){ read(); draw(c.pre.keywords); } }));
    $("#p-url").addEventListener("change",()=>{ read(); draw(c.pre.keywords); });

    const rp=$("#repull"); if(rp) rp.onclick=()=>{ const s=IDEAS.find(x=>x.id===c.ideaId);
      if(!s){toast("The source idea is gone");return;}
      c.pre={ source:s.source, tool:s.tool, keywords:(s.keywords||[]).map(k=>({...k})),
        why:s.why, title:s.title, desc:s.desc, hashtags:s.hashtags };
      draw(c.pre.keywords); toast("Re-pulled from the idea — press Save to keep it"); };

    $("#drawer").querySelectorAll("[data-file]").forEach(inp=>inp.onchange=e=>{
      const f=e.target.files[0]; if(!f) return; const key=inp.dataset.file; read();
      if(f.type.startsWith("image/")){
        const img=new Image(), url=URL.createObjectURL(f);
        img.onload=()=>{ const cv=document.createElement("canvas"), sc=Math.min(1,220/img.width);
          cv.width=img.width*sc; cv.height=img.height*sc; cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
          let prev=null; try{ prev=cv.toDataURL("image/jpeg",0.7); }catch(x){}
          URL.revokeObjectURL(url); c.post[key]={name:f.name,size:f.size,preview:prev};
          draw(c.pre.keywords); toast(`${f.name} attached — press Save to keep it`); };
        img.onerror=()=>{ URL.revokeObjectURL(url); c.post[key]={name:f.name,size:f.size,preview:null}; draw(c.pre.keywords); };
        img.src=url;
      } else { c.post[key]={name:f.name,size:f.size,preview:null}; draw(c.pre.keywords); toast(`${f.name} attached — press Save to keep it`); }
    });
    $("#drawer").querySelectorAll("[data-clear]").forEach(b=>b.onclick=()=>{ read(); c.post[b.dataset.clear]=null; draw(c.pre.keywords); });

    const sc=$("#saveCard"); if(sc) sc.onclick=()=>{ read(); if(!c.idea&&!c.pre.title){toast("A card needs an idea or a title");return;}
      persist(); if(save()){ closeDrawer(); toast(isNew?"Card created":"Saved"); } };
    const del=$("#delCard"); if(del) del.onclick=()=>{ if(!confirm("Delete this card? The idea it came from stays in Ideation.")) return;
      const k=CARDS.findIndex(x=>x.id===c.id); if(k>=0) CARDS.splice(k,1); if(save()){ closeDrawer(); toast("Card deleted"); } };
    const ov=$("#override"); if(ov) ov.onclick=()=>{ read(); persist(); openOverride(c); };
    $("#drawer").querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{
      read(); if(!c.idea&&!c.pre.title){toast("A card needs an idea or a title");return;}
      persist(); const to=b.dataset.move; if(moveCard(c,to)){ closeDrawer(); toast(`Moved to ${STAGES.find(s=>s.id===to).label}`); } });
    lockDrawer();
  };
  draw(c.pre.keywords||[]);
  if(showGate) setTimeout(()=>{ const b=$("#drawer").querySelector('[data-gate="pre"]'); if(b) b.scrollIntoView({block:"start",behavior:"smooth"}); },80);
}

function openOverride(c){
  openDrawer(`<div class="dr-h"><div><div class="lbl">Override the research gate</div>
      <h3 style="margin-top:4px">${esc(c.pre.title||c.idea)}</h3></div></div>
    <p class="hint" style="margin-bottom:16px">This lets the card move without a complete research block. The reason is recorded
      against the card and shows on the board and in the summary. That is the point — a gate nobody can bypass just gets filled
      with "n/a".</p>
    <div class="fld"><label for="o-by">Your name</label>
      ${peopleSelect("o-by",meName())}</div>
    <div class="fld"><label for="o-reason">Why is this going ahead without research?</label>
      <textarea id="o-reason" placeholder="e.g. trend window closes in 48h"></textarea></div>
    <div class="row"><button class="btn danger" id="doOverride">Override and log it</button>
      <button class="btn" id="cancelOv">Back</button></div>`);
  $("#cancelOv").onclick=()=>openCard(c.id);
  $("#doOverride").onclick=()=>{ const r=$("#o-reason").value.trim(); if(!r){toast("An override needs a reason");return;}
    const n=$("#o-by").value.trim()||meName()||"Someone";
    c.override={by:n,reason:r,on:today()}; if(save()){ closeDrawer(); toast("Override logged"); } };
}

/* Instagram count (manual until connected) + the two targets */
function openFollowers(){
  const ig=igSeries(), last=ig[ig.length-1], yt=ytSeries(), ytLast=yt[yt.length-1];
  openDrawer(`<div class="dr-h"><div><div class="lbl">Follower counts</div>
      <h3 style="margin-top:4px">Instagram count</h3></div><button class="btn sm" id="xClose">Close</button></div>
    <div class="block"><div class="block-h"><h4>YouTube</h4><span class="badge good">live</span></div>
      <p class="hint" style="margin:0">${ytLast?`<b style="color:var(--ink)">${fmt(ytLast.v)}</b> subscribers on ${dmy(ytLast.d)} — `:""}filled in by itself every morning. Nothing to type.</p></div>
    <div class="block"><div class="block-h"><h4>Instagram</h4><span class="badge mute">manual</span></div>
      <p class="hint" style="margin:0 0 12px">Until Instagram is connected, someone reads the follower count off the profile once a
        week. Every reading is kept — the trend is built from the history, not from the latest number.</p>
      <div class="grid2" data-w="1">
        <div class="fld"><label for="f-date">Date</label><input id="f-date" type="date" value="${today()}"></div>
        <div class="fld"><label for="f-ig">Instagram followers</label><input id="f-ig" type="number" value="${last?last.v:""}"></div></div>
      <button class="btn pri sm" id="saveF" data-w="1">Save reading</button>
      ${ig.length?`<div style="margin-top:12px">${[...ig].reverse().slice(0,6).map(f=>`<div class="cmt" style="display:flex;justify-content:space-between;gap:10px">
        <span>${dmy(f.d)}</span><span style="font-family:var(--mono);font-size:12px;color:var(--ink-2)">${fmt(f.v)}</span></div>`).join("")}</div>`:""}</div>
    <p class="hint">Targets are set in the <b>Targets</b> card on the Summary.</p>`);
  $("#xClose").onclick=closeDrawer;
  const sf=$("#saveF"); if(sf) sf.onclick=()=>{ const d=$("#f-date").value, v=Number($("#f-ig").value);
    if(!d||!v){toast("Fill in the date and the count");return;}
    const e=S.igFollowers.findIndex(f=>f.d===d); if(e>=0) S.igFollowers[e]={d,v}; else S.igFollowers.push({d,v});
    if(save()){ toast("Instagram reading saved"); openFollowers(); } };

  lockDrawer();
}

function openCulture(){
  openDrawer(`<div class="dr-h"><div><div class="lbl">Schedule</div>
      <h3 style="margin-top:4px">Content culture</h3></div><button class="btn sm" id="xClose">Close</button></div>
    <div class="fld"><label for="cu">The rhythm, in one line</label>
      <textarea id="cu" class="hookin" style="font-family:var(--hand);font-size:19px" placeholder="2 long videos a week, 4 reels, post at 7 PM.">${esc(S.culture)}</textarea></div>
    <div class="row"><button class="btn pri" id="saveCu">Save</button><button class="btn" id="xClose2">Cancel</button></div>`);
  $("#xClose").onclick=$("#xClose2").onclick=closeDrawer;
  $("#saveCu").onclick=()=>{ S.culture=$("#cu").value.trim(); if(save()){ closeDrawer(); toast("Saved"); } };
}

/* ------------------------------------------------------------ Keep an Eye on 2nd Love */
/* 1st love is our users, 2nd love is our competitors: their accounts, their numbers week
   by week, a fixed study of what works for them, and "Try this" straight into Ideation. */
const RIVAL_FIELDS = [
  { k:"formats", label:"What they post", must:true, ask:"Their mix of formats over the last 2 weeks: reels, long videos, shorts, carousels, lives.", ph:"IG: 2 reels a day, 1 carousel a week · YT: 3 long videos + daily shorts" },
  { k:"timing",  label:"When they post", ask:"Days and times. Look at the timestamps of the last 10 posts.", ph:"Reels at 7 PM every day · long videos Tue & Fri 6 PM" },
  { k:"best",    label:"Their best post this week", must:true, ask:"Link, views, and in one line why it worked.", ph:"instagram.com/reel/… · 820k views · a topper's routine in 30 seconds, face to camera" },
  { k:"hooks",   label:"Hooks they use", must:true, ask:"Copy 3 opening lines word for word.", ph:"“Stop doing this if you want 700+ in CUET”" },
  { k:"visual",  label:"Look and feel", ask:"Thumbnails, captions on screen, faces, colours, editing pace.", ph:"Big yellow text, same teacher's face on every thumbnail, fast cuts" },
  { k:"cta",     label:"What they ask viewers to do", ask:"Follow, comment a word, link in bio, join Telegram, buy a course…", ph:"“Comment NOTES and we'll DM you the PDF”" },
  { k:"comments",label:"What students say in their comments", ask:"Read the top comments. What do students love, ask for or complain about?", ph:"Lots of “please make one for Economics”" },
  { k:"try",     label:"What we'll try from this", must:true, ask:"One thing we'll make or change, so our users get something better.", ph:"A 30-second “topper's routine” reel series for CUET, posted at 7 PM" }
];
const RIVAL_MUST = RIVAL_FIELDS.filter(f=>f.must);
const rivalFilled = r => RIVAL_MUST.filter(f=>String((r.f||{})[f.k]||"").trim()).length;
const lastReading = r => [...(r.readings||[])].sort((a,b)=>a.d.localeCompare(b.d)).slice(-2);
function delta(now, before){ if(now==null || before==null) return ""; const d=now-before; if(!d) return `<small class="hint">±0</small>`;
  return `<small style="color:${d>0?"var(--good)":"var(--crit)"};font-family:var(--mono);font-size:10.5px">${d>0?"+":""}${kfmt(d)}</small>`; }
const handleUrl = (pl, h) => { h=String(h||"").trim(); if(!h) return ""; if(/^https?:\/\//i.test(h)) return h;
  h=h.replace(/^@/,""); return pl==="ig" ? "https://www.instagram.com/"+encodeURIComponent(h)+"/" : "https://www.youtube.com/@"+encodeURIComponent(h); };

function renderRivals(){
  const P=$("#pane-rivals"), ro=!canEdit(), rivals=S.rivals;
  const igL=igSeries(), ytL=ytSeries(), igU=igL[igL.length-1], ytU=ytL[ytL.length-1];
  const num = (v, prev) => v==null||v==="" ? `<span class="hint">—</span>` : `<b class="num">${fmt(v)}</b> ${delta(v, prev)}`;
  const rows = rivals.map(r=>{ const [a,b] = lastReading(r).length===2 ? lastReading(r) : [null, lastReading(r)[0]];
    return { r, now:b||{}, prev:a||{} }; });
  P.innerHTML = `
    <div class="note" style="margin-bottom:18px">
      <div class="lbl">Keep an eye on 2nd love</div>
      <b>1st love is our users.</b> <b>2nd love is our competitors.</b><br>
      We watch what they post, how fast they grow and what works for them, then make something <em>better for our users</em>.
    </div>

    <div class="sec-h"><h3>Us vs them</h3><span class="hint">latest numbers · the small number is the change since the reading before</span>
      ${ro?"":`<button class="btn pri" id="rvAdd" style="margin-left:auto">+ Add a competitor</button>`}</div>
    ${rivals.length ? `<div class="tw" style="margin-bottom:24px"><table class="mini rvtab">
      <thead><tr><th>Account</th><th>Instagram followers</th><th>YouTube subscribers</th><th>IG posts / week</th><th>YT videos / week</th><th>Top post views</th><th>Last checked</th></tr></thead>
      <tbody>
        <tr class="us"><td><b>Dubuddy (us)</b></td><td>${igU?num(igU.v):`<span class="hint">—</span>`}</td><td>${ytU?num(ytU.v):`<span class="hint">—</span>`}</td>
          <td><span class="hint">see Summary</span></td><td><span class="hint">see Summary</span></td><td><span class="hint">see Summary</span></td><td class="hint">${igU||ytU?dmy((ytU||igU).d):"—"}</td></tr>
        ${rows.map(({r,now,prev})=>`<tr><td><button class="rvname" data-rvopen="${esc(r.id)}">${esc(r.name)}</button></td>
          <td>${num(now.ig, prev.ig)}</td><td>${num(now.yt, prev.yt)}</td><td>${num(now.igPosts)}</td><td>${num(now.ytPosts)}</td><td>${num(now.topViews)}</td>
          <td class="hint">${now.d?dmy(now.d):"never"}${ro?"":` <button class="btn sm" data-rvlog="${esc(r.id)}" style="margin-left:6px">Log numbers</button>`}</td></tr>`).join("")}
      </tbody></table></div>` : ""}

    ${rivals.length ? `<div class="sec-h"><h3>Their study</h3><span class="hint">the same boxes for every competitor · ${RIVAL_MUST.length} must fill</span></div>
    <div class="rvgrid">${rivals.map(r=>{ const n=rivalFilled(r), ig=handleUrl("ig",r.ig), yt=handleUrl("yt",r.yt), tr=String((r.f||{}).try||"").trim();
      return `<div class="rvcard">
        <div class="row" style="justify-content:space-between"><h4>${esc(r.name)}</h4>
          <span class="badge ${n===RIVAL_MUST.length?"good":"warn"}">${n===RIVAL_MUST.length?"✓ study done":`${n} of ${RIVAL_MUST.length} must-fill`}</span></div>
        <div class="row" style="gap:6px">${ig?`<a class="chip" href="${esc(ig)}" target="_blank" rel="noopener">Instagram ↗</a>`:""}${yt?`<a class="chip" href="${esc(yt)}" target="_blank" rel="noopener">YouTube ↗</a>`:""}</div>
        ${tr?`<div class="rvtry"><span class="lbl">We'll try</span><p>${esc(tr)}</p>
          ${ro?"":r.ideaId && IDEAS.some(i=>i.id===r.ideaId)?`<span class="badge good">in Ideation ✓</span>`:`<button class="btn sm pri" data-rvidea="${esc(r.id)}">→ Send to Ideation</button>`}</div>`
          :`<p class="hint" style="margin:0">Not studied yet. Open it and fill the boxes.</p>`}
        <div class="row" style="margin-top:auto"><button class="btn sm" data-rvopen="${esc(r.id)}">${ro?"Read the study":"Open study"}</button>
          ${ro?"":`<button class="btn sm" data-rvlog="${esc(r.id)}">Log numbers</button>`}</div>
      </div>`; }).join("")}</div>`
    : `<div class="empty" style="border:1px dashed var(--line-2);border-radius:var(--r);padding:28px 20px;text-align:center;color:var(--ink-3)">
        <h4 style="color:var(--ink-2);margin-bottom:5px">No competitors yet</h4>
        <p style="margin:0 auto 14px;max-width:52ch;font-size:12.5px">Add the accounts students also follow. Log their numbers every week and fill one short study for each.</p>
        ${ro?"":`<button class="btn pri" id="rvAdd2">+ Add the first competitor</button>`}</div>`}`;
  [$("#rvAdd"),$("#rvAdd2")].forEach(b=>{ if(b) b.onclick=()=>openRival(null); });
  P.querySelectorAll("[data-rvopen]").forEach(b=>b.onclick=()=>openRival(b.dataset.rvopen));
  P.querySelectorAll("[data-rvlog]").forEach(b=>b.onclick=()=>openRivalLog(b.dataset.rvlog));
  P.querySelectorAll("[data-rvidea]").forEach(b=>b.onclick=()=>{
    const r=rivals.find(x=>x.id===b.dataset.rvidea); if(!r) return;
    const i=blankIdea({ idea:String(r.f.try).trim().slice(0,140), by:meName(), why:"Seen at "+r.name+(r.f.best?": "+r.f.best:""), source:"Competitor: "+r.name });
    IDEAS.unshift(i); r.ideaId=i.id;
    if(save()) toast("Sent to Ideation");
  });
}
/* the study of one competitor (or a new one), in the drawer */
function openRival(id){
  const r = id ? S.rivals.find(x=>x.id===id) : null;
  openDrawer(`<div class="dr-h"><div><div class="lbl">Keep an eye on 2nd love</div>
      <h3 style="margin-top:4px">${r?esc(r.name):"New competitor"}</h3></div><button class="btn sm" id="xClose">Close</button></div>
    <div class="fld"><label for="rv-name">Name<span class="req">*</span></label><input id="rv-name" value="${esc(r?r.name:"")}" placeholder="Physics Wallah, Unacademy CUET…"></div>
    <div class="grid2">
      <div class="fld"><label for="rv-ig">Instagram handle</label><input id="rv-ig" value="${esc(r?r.ig:"")}" placeholder="@handle"></div>
      <div class="fld"><label for="rv-yt">YouTube handle</label><input id="rv-yt" value="${esc(r?r.yt:"")}" placeholder="@channel"></div></div>
    <div class="lbl" style="margin:8px 0 10px">The study · same boxes for every competitor</div>
    ${RIVAL_FIELDS.map(f=>`<div class="fld"><label for="rv-${f.k}">${esc(f.label)}${f.must?`<span class="req">must fill</span>`:""}</label>
      <p class="hint" style="margin:0 0 5px">${esc(f.ask)}</p>
      <textarea id="rv-${f.k}" placeholder="e.g. ${esc(f.ph)}">${esc(r?(r.f[f.k]||""):"")}</textarea></div>`).join("")}
    <div class="row" data-w="1"><button class="btn pri" id="rvSave">Save</button>
      ${r?`<button class="btn danger sm" id="rvDel" style="margin-left:auto">Remove ${esc(r.name)}</button>`:""}</div>`);
  $("#xClose").onclick=closeDrawer;
  const sv=$("#rvSave"); if(sv) sv.onclick=()=>{
    const name=$("#rv-name").value.trim(); if(!name){ toast("Give the competitor a name"); return; }
    const t = r || { id:uid("rv"), readings:[], f:{}, created:today() };
    t.name=name; t.ig=$("#rv-ig").value.trim(); t.yt=$("#rv-yt").value.trim();
    RIVAL_FIELDS.forEach(f=>{ t.f[f.k]=$("#rv-"+f.k).value.trim(); });
    t.updated=today(); t.by=meName();
    if(!r) S.rivals.push(t);
    if(save()){ closeDrawer(); toast(r?"Saved":"“"+name+"” added"); }
  };
  const dl=$("#rvDel"); if(dl) dl.onclick=()=>{ if(!confirm("Remove "+r.name+" and its numbers?")) return;
    S.rivals.splice(S.rivals.indexOf(r),1); if(save()){ closeDrawer(); toast("Removed"); } };
  lockDrawer();
}
/* this week's numbers for one competitor */
function openRivalLog(id){
  const r=S.rivals.find(x=>x.id===id); if(!r) return;
  const last=lastReading(r).pop()||{};
  openDrawer(`<div class="dr-h"><div><div class="lbl">Log numbers</div><h3 style="margin-top:4px">${esc(r.name)}</h3></div>
      <button class="btn sm" id="xClose">Close</button></div>
    <p class="hint" style="margin:0 0 12px">Read these off their profiles once a week. Every reading is kept, so we can see who's growing faster.</p>
    <div class="fld"><label for="rl-d">Date</label><input id="rl-d" type="date" value="${today()}"></div>
    <div class="grid2">
      <div class="fld"><label for="rl-ig">Instagram followers</label><input id="rl-ig" type="number" min="0" placeholder="${last.ig??""}"></div>
      <div class="fld"><label for="rl-yt">YouTube subscribers</label><input id="rl-yt" type="number" min="0" placeholder="${last.yt??""}"></div>
      <div class="fld"><label for="rl-igp">IG posts in the last 7 days</label><input id="rl-igp" type="number" min="0"></div>
      <div class="fld"><label for="rl-ytp">YT videos in the last 7 days</label><input id="rl-ytp" type="number" min="0"></div>
      <div class="fld"><label for="rl-tv">Views on their top post this week</label><input id="rl-tv" type="number" min="0"></div></div>
    <div class="row" data-w="1"><button class="btn pri" id="rlSave">Save reading</button></div>
    ${(r.readings||[]).length?`<div style="margin-top:14px">${[...r.readings].sort((a,b)=>b.d.localeCompare(a.d)).slice(0,8).map(x=>`<div class="cmt" style="display:flex;justify-content:space-between;gap:10px">
      <span>${dmy(x.d)}</span><span style="font-family:var(--mono);font-size:12px;color:var(--ink-2)">IG ${fmt(x.ig)} · YT ${fmt(x.yt)}</span></div>`).join("")}</div>`:""}`);
  $("#xClose").onclick=closeDrawer;
  const n = id => { const v=$("#"+id).value; return v==="" ? null : Number(v); };
  const sv=$("#rlSave"); if(sv) sv.onclick=()=>{
    const d=$("#rl-d").value; if(!d){ toast("Pick a date"); return; }
    const x={ d, ig:n("rl-ig"), yt:n("rl-yt"), igPosts:n("rl-igp"), ytPosts:n("rl-ytp"), topViews:n("rl-tv") };
    if([x.ig,x.yt,x.igPosts,x.ytPosts,x.topViews].every(v=>v==null)){ toast("Fill in at least one number"); return; }
    r.readings = (r.readings||[]).filter(y=>y.d!==d); r.readings.push(x);
    if(save()){ closeDrawer(); toast("Reading saved"); }
  };
  lockDrawer();
}

/* ------------------------------------------------------------ mount */
const PANES=["targets","summary","ideation","process","schedule","rivals"];
function refresh(){
  if(!R || !S) return;
  PANES.forEach(p=>{ const el=$("#pane-"+p); if(el) el.hidden = p!==TAB; });
  ({targets:renderTargets,summary:renderSummary,ideation:renderIdeation,process:renderProcess,schedule:renderSchedule,rivals:renderRivals})[TAB]();
}
function mount(){
  if(HOST) return;
  HOST=document.createElement("div"); HOST.className="sx-host";
  R=HOST.attachShadow({mode:"open"});
  R.innerHTML=`<style>${CSS}</style><div class="sxroot">
    ${PANES.map(p=>`<section id="pane-${p}" hidden></section>`).join("")}
    <div class="scrim" id="scrim"></div><aside class="drawer" id="drawer"></aside>
    <div class="tt" id="tt"></div><div class="toast" id="toast"></div></div>`;
  $("#scrim").onclick=closeDrawer;
  document.addEventListener("keydown",e=>{ if(e.key==="Escape" && HOST.isConnected) closeDrawer(); });
}

window.SX = {
  normalize: normalize,
  tabs: [["targets","Our agreement"],["summary","Summary"],["ideation","Ideation"],["process","Content Process"],["schedule","Schedule"],["rivals","Keep an Eye on 2nd Love"]],
  /* draw the space. opt: {tab, team, supa, canEdit(), isMember(), me(), people(), save(),
       targets(space), canEditTargets(), saveTargets(space, obj)} */
  render: function(space, wrap, opt){
    mount();
    OPT = opt || {};
    if(SPACE!==space){ SPACE=space; if(R) closeDrawer(); }
    S = normalize(space); IDEAS=S.ideas; CARDS=S.cards; REG=S.reg;
    // targets: their own saved copy, or (before anyone has saved one) what the space held
    const tRaw = (OPT.targets && OPT.targets(space)) || { targets:S.targets, goals:S.goals };
    const tKey = JSON.stringify(tRaw);
    if(tKey!==TG_KEY){ TG_KEY=tKey; TG=normTargets(tRaw); TDRAFT=null; }
    if(!FILTERS.vtypes){ FILTERS.vtypes=Object.keys(REG.vtype); FILTERS.platforms=Object.keys(REG.platform); }
    if(!SCHED.vtypes){ SCHED.vtypes=Object.keys(REG.vtype); SCHED.platforms=Object.keys(REG.platform); SCHED.cursor=today(); }
    Object.keys(REG.vtype).forEach(k=>{ if(!FILTERS.vtypes.includes(k)) FILTERS.vtypes.push(k); if(!SCHED.vtypes.includes(k)) SCHED.vtypes.push(k); });
    Object.keys(REG.platform).forEach(k=>{ if(!FILTERS.platforms.includes(k)) FILTERS.platforms.push(k); if(!SCHED.platforms.includes(k)) SCHED.platforms.push(k); });
    TAB = PANES.includes(OPT.tab) ? OPT.tab : "summary";
    if(HOST.parentNode!==wrap) wrap.appendChild(HOST);
    if(LIVE.team!==OPT.team || LIVE.status==="idle") loadLive(false);
    refresh();
  },
  // board counts for the team dashboard: {stageId: n}
  stageCounts: function(space){ const out={}; STAGES.forEach(x=>out[x.id]=0);
    const cards = space.sx && Array.isArray(space.sx.cards) ? space.sx.cards
      : (space.cards||[]).map(o=>({stage:OLD_COL[o && o.col]||"todo"}));   // not opened since the update
    cards.forEach(c=>{ if(out[c.stage]!==undefined) out[c.stage]++; }); return { stages:STAGES, counts:out, total:cards.length }; }
};
})();
