import json, urllib.parse as u
f='/Users/adi/Downloads/edit/DJI_20260927161806_0748_D/plan.json'
p=json.load(open(f))
TL=json.load(open('/Users/adi/Downloads/edit/DJI_20260927161806_0748_D/timeline.json'))
Wt={x['i']:x['s'] for x in TL['words']}
I='{ID}'
NZ="url(data:image/svg+xml,"+u.quote("<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .25  0 0 0 0 .18  0 0 0 0 .12  0 0 0 -1.4 .5'/></filter><rect width='220' height='220' filter='url(#n)'/></svg>",safe="")+")"
CARD=f"background:{NZ},linear-gradient(#ffffff,#fbf6ef);background-size:220px 220px,100% 100%;border-radius:30px;box-shadow:0 18px 44px rgba(0,0,0,.32),0 2px 0 rgba(255,255,255,.6) inset;"
book='<svg width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="14" width="40" height="40" rx="5" fill="#2b6f77"/><rect x="14" y="10" width="40" height="40" rx="5" fill="#f26522"/><rect x="18" y="6" width="38" height="40" rx="5" fill="#fff" stroke="#15131c" stroke-width="3"/><path d="M25 16h22M25 23h22M25 30h14" stroke="#15131c" stroke-width="3" stroke-linecap="round"/></svg>'
paper='<svg width="64" height="64" viewBox="0 0 64 64"><rect x="12" y="6" width="40" height="52" rx="6" fill="#fff" stroke="#15131c" stroke-width="3"/><path d="M20 18h24M20 26h24M20 34h16" stroke="#15131c" stroke-width="3" stroke-linecap="round"/><circle cx="42" cy="46" r="11" fill="#2e9d57"/><path d="M37 46l4 4 7-8" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
html=f'''<div style="position:absolute;left:0;top:0;width:1080px;height:640px;pointer-events:none">
<div id="{I}c1" style="position:absolute;left:50%;top:236px;transform:translateX(-50%);width:760px;height:118px;{CARD}display:flex;align-items:center;gap:22px;padding:0 30px;box-sizing:border-box">
 <div id="{I}i1" style="flex:0 0 64px">{book}</div>
 <div style="flex:1;position:relative;height:118px">
  <div id="{I}t1a" style="position:absolute;left:0;top:18px;font-size:42px;font-weight:900;letter-spacing:-.03em;color:#15131c">NCERT <span style="color:#f26522">revise</span></div>
  <div id="{I}t1b" style="position:absolute;left:0;top:18px;font-size:42px;font-weight:900;letter-spacing:-.03em;color:#15131c">NCERT <span style="color:#2e9d57">complete</span></div>
  <div style="position:absolute;left:0;right:0;top:78px;height:16px;border-radius:8px;background:#efe6da;overflow:hidden"><div id="{I}bar" style="width:100%;height:100%;border-radius:8px;background:linear-gradient(90deg,#f26522,#ff9a52);transform-origin:left center"></div></div>
 </div>
 <div id="{I}pc" style="flex:0 0 96px;text-align:right;font-size:34px;font-weight:900;color:#f26522;letter-spacing:-.02em">0%</div>
 <svg id="{I}ck1" width="58" height="58" viewBox="0 0 58 58" style="position:absolute;right:-20px;top:-20px"><circle cx="29" cy="29" r="27" fill="#2e9d57" stroke="#fff" stroke-width="4"/><path id="{I}ck1p" pathLength="1" d="M17 30l8 8 16-17" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
</div>
<div id="{I}ph" style="position:absolute;left:50%;top:150px;transform:translateX(-50%) translateX(300px) rotate(8deg);width:200px;height:400px;border-radius:34px;background:#15131c;box-shadow:0 24px 50px rgba(0,0,0,.4);padding:10px;box-sizing:border-box">
 <div style="width:100%;height:100%;border-radius:26px;background:linear-gradient(#fff,#fbf3ea);overflow:hidden;position:relative">
  <div style="height:54px;background:#f26522;display:flex;align-items:center;justify-content:center;font-family:var(--mono),monospace;font-size:16px;letter-spacing:.1em;color:#fff;font-weight:700">dubuddy.in</div>
  <div style="margin:12px 10px 0;font-size:15px;font-weight:800;color:#15131c">CUET PYQs</div>
  {"".join(f'<div id="{I}pp{k}" style="margin:8px 10px 0;height:44px;border-radius:10px;background:#fff;box-shadow:0 3px 10px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:space-between;padding:0 10px;box-sizing:border-box"><span style="font-size:12px;font-weight:700;color:#15131c">{y} · Shift {k+1}</span><span style="font-size:10px;font-weight:800;color:#fff;background:#f26522;padding:4px 8px;border-radius:999px">Start</span></div>' for k,y in enumerate(("2025","2025","2024","2024","2023")))}
  <div id="{I}phg" style="position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.55),transparent 60%);mix-blend-mode:screen"></div>
 </div></div>
<div id="{I}c2" style="position:absolute;left:50%;top:236px;transform:translateX(-50%);width:760px;height:118px;{CARD}display:flex;align-items:center;gap:22px;padding:0 30px;box-sizing:border-box">
 <div style="flex:0 0 64px">{paper}</div>
 <div style="flex:1;font-size:46px;font-weight:900;letter-spacing:-.03em;color:#15131c;white-space:nowrap"><span id="{I}hl" style="position:relative;display:inline-block;padding:0 8px"><span id="{I}hlb" style="position:absolute;inset:4px 0 2px 0;background:#ffd34d;border-radius:8px;transform-origin:left center;z-index:-1"></span>PYQs</span> practice karo</div>
 <svg id="{I}ck2" width="58" height="58" viewBox="0 0 58 58" style="position:absolute;right:-20px;top:-20px"><circle cx="29" cy="29" r="27" fill="#2e9d57" stroke="#fff" stroke-width="4"/><path id="{I}ck2p" pathLength="1" d="M17 30l8 8 16-17" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
</div>
<div id="{I}chip" style="position:absolute;left:50%;top:374px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:12px 26px;border-radius:999px;background:{NZ},linear-gradient(#f26522,#e85a17);background-size:220px 220px,100% 100%;box-shadow:0 12px 30px rgba(0,0,0,.3);white-space:nowrap">
 <span style="font-family:var(--mono),monospace;font-size:28px;letter-spacing:.08em;color:#fff;font-weight:700">dubuddy.in</span><span style="font-size:26px;font-weight:800;color:#ffe6d6">pe available</span>
 <svg id="{I}cur" width="40" height="48" viewBox="0 0 30 36" style="position:absolute;right:-26px;bottom:-30px"><path d="M4 2 L4 29 L11.2 22.4 L15.6 33.2 L20.4 31.2 L16 20.6 L25.6 20.6 Z" fill="#15131c" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></svg>
</div>
</div>'''
js='''var I="#{ID}";
tl.set([I+"c1",I+"c2",I+"chip",I+"t1b",I+"ck1",I+"ck2",I+"ph"],{autoAlpha:0},0);
/* alive: cards hover + tilt, phone glow breathes */
tl.to(I+"c1",{y:"+=8",rotation:1.2,duration:1.4,yoyo:true,repeat:5,ease:"sine.inOut"},{W122});
tl.to(I+"c2",{y:"+=8",rotation:-1.2,duration:1.5,yoyo:true,repeat:5,ease:"sine.inOut"},{W128});
tl.to(I+"phg",{opacity:.4,duration:1,yoyo:true,repeat:5,ease:"sine.inOut"},{W128});tl.set(I+"bar",{scaleX:0},0);tl.set(I+"hlb",{scaleX:0},0);
/* card 1: NCERT revise -> complete */
tl.fromTo(I+"c1",{autoAlpha:0,y:-40,scale:.9},{autoAlpha:1,y:0,scale:1,duration:.4,ease:"back.out(1.7)"},{W122}-.1);
tl.fromTo(I+"i1",{rotation:-20,scale:.6},{rotation:0,scale:1,duration:.45,ease:"back.out(2.4)"},{W122});
(function(){var o={v:0},el=document.getElementById("{ID}pc"),d=Math.max(.7,{W126}-{W122});tl.to(o,{v:100,duration:d,ease:"power1.inOut",onUpdate:function(){el.textContent=Math.round(o.v)+"%";}},{W122}+.15);
 tl.to(I+"bar",{scaleX:1,duration:d,ease:"power1.inOut"},{W122}+.15);
 tl.to(I+"t1a",{autoAlpha:0,y:-16,duration:.14},{W122}+.15+d);tl.fromTo(I+"t1b",{autoAlpha:0,y:16},{autoAlpha:1,y:0,duration:.2,ease:"back.out(1.6)"},{W122}+.3+d);
 tl.fromTo(I+"ck1",{autoAlpha:0,scale:0},{autoAlpha:1,scale:1,duration:.25,ease:"back.out(2.6)"},{W122}+.15+d);
 tl.to(I+"ck1p",{strokeDashoffset:0,duration:.22},{W122}+.3+d);
 tl.to(I+"bar",{background:"linear-gradient(90deg,#2e9d57,#5cc97f)",duration:.2},{W122}+.15+d);
 tl.to(I+"pc",{color:"#2e9d57",duration:.2},{W122}+.15+d);})();
/* phone slides in behind, PYQ rows fan out */
tl.fromTo(I+"ph",{autoAlpha:0,y:80,rotation:20},{autoAlpha:1,y:0,rotation:8,duration:.5,ease:"back.out(1.4)"},{W128}-.15);
[0,1,2,3,4].forEach(function(k){tl.fromTo(I+"pp"+k,{x:-120,autoAlpha:0},{x:0,autoAlpha:1,duration:.35,ease:"power3.out"},{W128}+.15+k*.09);});
tl.to(I+"ph",{y:"-=6",duration:1.3,yoyo:true,repeat:4,ease:"sine.inOut"},{W128}+.6);
/* swap to card 2 on "previous year papers" */
tl.to(I+"c1",{autoAlpha:0,y:-60,scale:.92,duration:.3,ease:"power2.in"},{W128}-.25);
tl.fromTo(I+"c2",{autoAlpha:0,y:50,scale:.9},{autoAlpha:1,y:0,scale:1,duration:.4,ease:"back.out(1.7)"},{W128}-.05);
tl.to(I+"hlb",{scaleX:1,duration:.35,ease:"power2.out"},{W128}+.25);
/* dubuddy.in chip on "practice" */
tl.fromTo(I+"chip",{autoAlpha:0,scale:.5,y:-10},{autoAlpha:1,scale:1,y:0,duration:.35,ease:"back.out(2.4)"},{W132}-.05);
tl.fromTo(I+"cur",{x:60,y:40,autoAlpha:0},{x:0,y:0,autoAlpha:1,duration:.35,ease:"power2.out"},{W132}+.25);
tl.to(I+"chip",{scale:.93,duration:.08,yoyo:true,repeat:1},{W132}+.62);
tl.to(I+"cur",{scale:.85,duration:.08,yoyo:true,repeat:1},{W132}+.62);
/* analysis -> check */
tl.fromTo(I+"ck2",{autoAlpha:0,scale:0},{autoAlpha:1,scale:1,duration:.25,ease:"back.out(2.6)"},{W137});
tl.to(I+"ck2p",{strokeDashoffset:0,duration:.22},{W137}+.15);
/* exit */
tl.to([I+"c2",I+"chip",I+"ph"],{autoAlpha:0,y:-30,duration:.25,ease:"power2.in",stagger:.05},{E}-.3);'''
sfx=[["pop",Wt[122]-0.1,0.3],["pop",Wt[126]+0.1,0.3],["chime",Wt[126]+0.2,0.22],["whoosh-short",Wt[128]-0.3,0.25],["pop",Wt[128],0.28],["flip",Wt[128]+0.2,0.4],["flip",Wt[128]+0.38,0.4],
     ["pop",Wt[132]-0.05,0.3],["click",Wt[132]+0.62,0.4],["pop",Wt[137],0.28]]
item={"from":120,"to":137,"display":"float","kind":"custom","html":html,"js":js,"sfx":sfx}
p['broll']=[b for b in p['broll'] if b.get('from')!=120]+[item]
json.dump(p,open(f,'w'),indent=1,ensure_ascii=False)
print([(b['from'],b['to'],b['display'],b['kind']) for b in p['broll']])
