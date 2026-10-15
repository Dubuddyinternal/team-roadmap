import json, urllib.parse as u
ED='/Users/adi/Downloads/edit/DJI_20260927161806_0748_D'
p=json.load(open(ED+'/plan.json'))
TL=json.load(open(ED+'/timeline.json')); Wt={x['i']:x['s'] for x in TL['words']}
I='{ID}'; SK="font-family:'Plus Jakarta Sans',sans-serif"
NZ="url(data:image/svg+xml,"+u.quote("<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .25  0 0 0 0 .18  0 0 0 0 .12  0 0 0 -1.4 .5'/></filter><rect width='220' height='220' filter='url(#n)'/></svg>",safe="")+")"
CARD=f"background:{NZ},linear-gradient(#ffffff,#fbf6ef);background-size:220px 220px,100% 100%;box-shadow:0 18px 44px rgba(0,0,0,.32),0 2px 0 rgba(255,255,255,.6) inset;"
by=lambda k:[x for x in p['broll'] if x.get('from')==k][0]
def rep(s,pairs):
    for a,b in pairs:
        assert a in s, a[:70]; s=s.replace(a,b,1)
    return s
# ======================= A · scary hook upgrade =======================
A=by(0)
ex="".join(f'<div id="{I}ex{k}" style="position:absolute;inset:0;transform:translate({(k+1)*5}px,{(k+1)*5}px);font-size:172px;font-weight:900;letter-spacing:-.05em;line-height:1;color:{c}">1 SAAL</div>' for k,c in enumerate(("#5a0010","#3a000a","#1c0005")))
cracks='<svg id="{I}cr" width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;left:0;top:0;mix-blend-mode:screen"><g stroke="#ff8a95" stroke-width="2.5" fill="none" stroke-linecap="round" style="filter:drop-shadow(0 0 5px #ff1a2e)">'+"".join(f'<path id="{I}crk{k}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="{d}"/>' for k,d in enumerate(("M180 380 L120 350 L70 390 L20 370","M900 380 L960 350 L1010 395 L1070 372","M260 300 L200 250 L150 270 L80 215","M820 300 L880 252 L930 272 L1000 214","M540 236 L520 180 L560 120 L540 60")))+'</g></svg>'
dust='<svg id="{I}dust" width="1080" height="1920" style="position:absolute;left:0;top:0">'+"".join(f'<circle id="{I}mt{k}" cx="{90+k*85}" cy="{1500+(k%3)*120}" r="{2+(k%3)}" fill="#ffd3d8" opacity=".7"/>' for k in range(12))+'</svg>'
A['html']=rep(A['html'],[('<div id="{ID}big" style="position:relative;margin-top:14px;height:176px">','<div id="{ID}big" style="position:relative;margin-top:14px;height:176px">'+ex),
                         ('<div style="position:absolute;left:60px;right:60px;top:236px;text-align:center">',dust+'<div style="position:absolute;left:60px;right:60px;top:236px;text-align:center">')])
A['js']=rep(A['js'],[('glitch({W4}+.08,7);','''glitch({W4}+.08,7);
for(var k=0;k<12;k++){tl.fromTo(I+"mt"+k,{y:0,opacity:0},{y:-520-k*40,opacity:.75,duration:2.4+k*.1,ease:"none",delay:k*.08},0);}
[0,1,2].forEach(function(k){tl.to(I+"ex"+k,{x:(k+1)*3,y:-(k+1)*2,duration:.9,yoyo:true,repeat:2,ease:"sine.inOut"},{W5}+.2);});'''),
   (' tl.to(I+"bw",{keyframes:{skewX:KF(4,14)},duration:.15,ease:"none"},t);}',' tl.to(I+"bw",{keyframes:{skewX:KF(4,14)},duration:.15,ease:"none"},t);\n [0,1,2].forEach(function(k){tl.to(I+"ex"+k,{keyframes:{x:KF(n,10+k*6)},duration:.03*n,ease:"none"},t);});}'),
   ('tl.to([I+"big",I+"q",I+"k"],{autoAlpha:0,x:60,skewX:30,duration:.14,ease:"power3.in",stagger:.03},{E}-.3);','tl.to([I+"big",I+"q",I+"k",I+"dust"],{autoAlpha:0,x:60,skewX:30,duration:.14,ease:"power3.in",stagger:.03},{E}-.3);')])
# ======================= B · calendar upgrade =======================
B=by(9)
B['html']=rep(B['html'],[('<rect id="{ID}e0"','<g id="{ID}calg"><rect id="{ID}e0"'),
                         ('<!-- counter card -->','</g>'
                          +"".join(f'<circle id="{I}cd{k}" cx="{120+k*95}" cy="{600+(k%3)*60}" r="{2+(k%2)}" fill="#fff" opacity=".6"/>' for k in range(9))+'<!-- counter card -->')])
B['html']=B['html'].replace('<ellipse id="{ID}pool"','<ellipse id="{ID}pool"').replace('<!-- counter card -->\n<rect x="666"','<!-- counter card -->\n<rect x="666"')
B['js']=rep(B['js'],[('var t0={W10};','''var t0={W10};
/* alive: calendar swings on its nail, light pool breathes, dust drifts */
tl.fromTo(I+"calg",{rotation:-.8,svgOrigin:"360 40"},{rotation:.8,duration:1.6,yoyo:true,repeat:Math.ceil({D}/1.6),ease:"sine.inOut"},{S});
for(var k=0;k<9;k++){tl.fromTo(I+"cd"+k,{y:0,opacity:0},{y:-90-k*8,opacity:.6,duration:1.8+k*.12,ease:"sine.out",repeat:Math.ceil({D}/1.8),delay:k*.2},{S});}
'''),
   ('/* KAAFI HAI stamp on "kaafi" */','''/* KAAFI HAI stamp on "kaafi" */''')])
# ======================= C · syllabus notebook — big, behind his head (speaker matte layered above) =======================
rows=""
for k in range(6):
    y=372+k*70
    rows+=(f'<g id="{I}ch{k}"><rect x="150" y="{y}" width="780" height="54" rx="14" fill="#f3ece2"/>'
           f'<text x="178" y="{y+37}" font-size="30" font-weight="800" fill="#4a4652">Chapter {k+1}</text>'
           f'<circle id="{I}tq{k}" cx="890" cy="{y+27}" r="19" fill="#fff" stroke="#c4bccb" stroke-width="3"/>'
           f'<g id="{I}tk{k}"><circle cx="890" cy="{y+27}" r="21" fill="#2e9d57"/><path d="M880 {y+27} l7 7 l13 -14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>')
Chtml=f"""<svg width="1080" height="900" style="position:absolute;left:0;top:0;{SK}"><defs><filter id="{I}soft"><feGaussianBlur stdDeviation="18"/></filter></defs>
<g id="{I}nb">
 <rect x="130" y="250" width="820" height="600" rx="34" fill="#1c1208" opacity=".35" filter="url(#{I}soft)"/>
 <rect x="120" y="226" width="840" height="610" rx="34" fill="#fffdf8"/>
 <path d="M120 260 a34 34 0 0 1 34 -34 h772 a34 34 0 0 1 34 34 v84 h-840 z" fill="#2b6f77"/>
 <text x="160" y="304" font-size="50" font-weight="900" letter-spacing="-1" fill="#fff">Class 12 Syllabus</text>
 {rows}
 {"".join(f'<rect x="104" y="{262+k*92}" width="32" height="14" rx="7" fill="#4a4652"/>' for k in range(6))}
 <g id="{I}rg"><circle cx="880" cy="250" r="70" fill="#15131c" opacity=".18" transform="translate(0 8)"/><circle cx="880" cy="250" r="70" fill="#fff"/>
  <circle cx="880" cy="250" r="54" fill="none" stroke="#efe6da" stroke-width="14"/>
  <circle id="{I}ring" cx="880" cy="250" r="54" fill="none" stroke="#2e9d57" stroke-width="14" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-90 880 250)" stroke-linecap="round"/>
  <text id="{I}pct" x="880" y="262" text-anchor="middle" font-size="34" font-weight="900" fill="#15131c">0%</text></g>
</g></svg>"""
Cjs="""var I="#{ID}";
for(var k=0;k<6;k++){tl.set(I+"tk"+k,{autoAlpha:0,scale:0,transformOrigin:"50% 50%"},0);}
tl.fromTo(I+"nb",{autoAlpha:0,y:-40,scale:.94,svgOrigin:"540 530"},{autoAlpha:1,y:0,scale:1,duration:.5,ease:"power3.out"},{S}+.05);
tl.to(I+"nb",{y:"+=6",duration:1.4,yoyo:true,repeat:3,ease:"sine.inOut"},{S}+.55);
(function(){var o={v:0},el=document.getElementById("{ID}pct");
 [0,1,2,3].forEach(function(k){tl.to(I+"tk"+k,{autoAlpha:1,scale:1,duration:.3,ease:"back.out(2.2)"},{W27}+k*.2);});
 tl.to(I+"ring",{strokeDashoffset:.33,duration:.9,ease:"power2.out"},{W27});
 tl.to(o,{v:67,duration:.9,ease:"power2.out",onUpdate:function(){el.textContent=Math.round(o.v)+"%";}},{W27});
 tl.to(I+"tq4",{attr:{stroke:"#f26522"},duration:.12},{W31});
 tl.fromTo(I+"tq4",{scale:1,transformOrigin:"50% 50%"},{scale:1.2,duration:.18,yoyo:true,repeat:3,ease:"sine.inOut"},{W31});
 [4,5].forEach(function(k,j){tl.to(I+"tk"+k,{autoAlpha:1,scale:1,duration:.3,ease:"back.out(2.2)"},{W33}+j*.18);});
 tl.to(I+"ring",{strokeDashoffset:0,duration:.5,ease:"power2.out"},{W33});
 tl.to(o,{v:100,duration:.5,ease:"power2.out",onUpdate:function(){el.textContent=Math.round(o.v)+"%";}},{W33});
 tl.to(I+"pct",{fill:"#2e9d57",duration:.2},{W33}+.4);})();
tl.to(I+"nb",{autoAlpha:0,y:-30,duration:.3,ease:"power2.in"},{E}-.35);"""
Csfx=[["pop",Wt[24],0.28]]+[["pop",Wt[27]+k*.2,0.18] for k in range(4)]+[["pop",Wt[33],0.2],["pop",Wt[33]+.18,0.2],["chime",Wt[33]+.3,0.28]]
C={"from":24,"to":34,"display":"float","kind":"custom","html":Chtml,"js":Cjs,"sfx":Csfx}
p['mattes']=[{"file":"matte/fg2.webm","start":5.9,"dur":4.4}]
# ======================= E · 3-step road =======================
ROAD="M200 560 L520 720 L360 880 L720 1060 L560 1220 L880 1380"
MS=[(200,560,"#f26522","#c94e15","NCERT","revise"),(720,1060,"#2b6f77","#1f5a62","Mocks","attempt"),(880,1380,"#2e9d57","#237a44","Acche se","analysis")]
def tile(cx,cy,top,side):
    return (f'<ellipse cx="{cx}" cy="{cy+30}" rx="150" ry="52" fill="#2a1608" opacity=".18"/>'
            f'<path d="M{cx-120} {cy-30} L{cx} {cy-90} L{cx+120} {cy-30} L{cx} {cy+30} Z" fill="{top}"/>'
            f'<path d="M{cx-120} {cy-30} L{cx} {cy+30} V{cy+74} L{cx-120} {cy+14} Z" fill="{side}"/>'
            f'<path d="M{cx} {cy+30} L{cx+120} {cy-30} V{cy+14} L{cx} {cy+74} Z" fill="{side}" opacity=".75"/>')
objs=[
 lambda cx,cy: f'<g id="{I}bk" transform="translate({cx-75} {cy-215})"><rect x="0" y="40" width="130" height="96" rx="9" fill="#2b6f77"/><rect x="10" y="30" width="130" height="96" rx="9" fill="#f26522"/><g id="{I}bkc"><rect x="20" y="20" width="130" height="96" rx="9" fill="#fff" stroke="#15131c" stroke-width="4"/><path d="M40 50h90M40 70h90M40 90h54" stroke="#15131c" stroke-width="4" stroke-linecap="round"/></g></g>',
 lambda cx,cy: f'<g transform="translate({cx-66} {cy-250})"><rect x="0" y="0" width="132" height="176" rx="12" fill="#fff" stroke="#15131c" stroke-width="4"/>'+"".join(f'<circle id="{I}mb{r*4+c}" cx="{30+c*24}" cy="{30+r*28}" r="8" fill="#15131c"/><circle cx="{30+c*24}" cy="{30+r*28}" r="8" fill="none" stroke="#8b8494" stroke-width="2"/>' for r in range(4) for c in range(4))+f'<rect x="2" y="134" width="128" height="40" rx="0" fill="#2e9d57"/><text x="66" y="161" text-anchor="middle" font-size="20" font-weight="900" fill="#fff">MOCK <tspan id="{I}mn">0</tspan>/20</text></g>',
 lambda cx,cy: f'<g transform="translate({cx-85} {cy-240})"><rect x="0" y="0" width="170" height="160" rx="14" fill="#fff" stroke="#15131c" stroke-width="4"/><rect id="{I}bar0" x="24" y="96" width="26" height="44" fill="#e0362c"/><rect id="{I}bar1" x="62" y="66" width="26" height="74" fill="#f2b134"/><rect id="{I}bar2" x="100" y="44" width="26" height="96" fill="#2e9d57"/><rect id="{I}bar3" x="138" y="24" width="20" height="116" fill="#2e9d57"/><path id="{I}ln" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="M36 86 L76 56 L112 36 L148 16" stroke="#15131c" stroke-width="4" fill="none" stroke-linecap="round"/></g>']
mil=""
for k,(cx,cy,top,side,w1,w2) in enumerate(MS):
    mil+=(f'<g id="{I}m{k+1}">'+tile(cx,cy,top,side)+f'<g id="{I}ob{k+1}">'+objs[k](cx,cy)+'</g>'+
          f'<circle cx="{cx-150}" cy="{cy-40}" r="28" fill="#15131c"/><text x="{cx-150}" y="{cy-29}" text-anchor="middle" font-size="32" font-weight="900" fill="#fff">{k+1}</text></g>'
          f'<g id="{I}lb{k+1}"><rect x="{cx-215}" y="{cy+96}" width="430" height="80" rx="40" fill="#fff" stroke="{top}" stroke-width="4"/>'f'<text x="{cx}" y="{cy+150}" text-anchor="middle" font-size="44" font-weight="900" fill="#15131c">{w1} <tspan fill="{top}">{w2}</tspan></text></g>')
Ehtml=f"""<div style="position:absolute;inset:0;background:#f6e7d4"></div><svg width="1080" height="1920" style="position:absolute;left:0;top:0;{SK}">
<defs><linearGradient id="{I}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbeedd"/><stop offset="1" stop-color="#f1d9bd"/></linearGradient></defs>
<g id="{I}cam">
 <rect x="-2000" y="-2000" width="5000" height="6000" fill="url(#{I}sky)"/>
 <g id="{I}cl" opacity=".55" fill="#fff"><ellipse cx="60" cy="330" rx="90" ry="24"/><ellipse cx="980" cy="760" rx="80" ry="22"/><ellipse cx="320" cy="1130" rx="90" ry="24"/><ellipse cx="1060" cy="1220" rx="70" ry="20"/></g>
 <path d="{ROAD}" transform="translate(0 16)" stroke="#b98a5e" stroke-width="124" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
 <path d="{ROAD}" stroke="#e2c29a" stroke-width="124" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
 <path id="{I}dash" d="{ROAD}" stroke="#fff" stroke-width="7" stroke-dasharray="30 26" stroke-linejoin="round" fill="none" opacity=".85"/>
 {mil}
</g>
<g id="{I}ttl"><rect x="0" y="0" width="1080" height="330" fill="#f8ead9"/><rect x="0" y="330" width="1080" height="40" fill="url(#{I}sky)" opacity=".6"/>
 <text x="540" y="200" text-anchor="middle" font-size="26" letter-spacing="8" fill="#c94e15" font-family="monospace">ABHI SE PLAN</text><text x="540" y="270" text-anchor="middle" font-size="64" font-weight="900" fill="#15131c">Kaise start karein</text></g>
<g id="{I}rb"><rect x="240" y="1250" width="600" height="92" rx="46" fill="#15131c"/><text x="520" y="1310" text-anchor="middle" font-size="40" font-weight="900" fill="#fff">Kaafi time hai</text><circle cx="770" cy="1296" r="28" fill="#2e9d57"/><path d="M757 1296 l9 9 l17 -19" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>"""
cams=[(round(540-1.5*cx), round(800-1.5*(cy-80))) for cx,cy,*_ in MS]
Ejs="""var I="#{ID}";var F=%s;
tl.set(I+"cam",{scale:1.5,x:F[0][0],y:F[0][1],svgOrigin:"0 0"},0);
[1,2,3].forEach(function(k){tl.set(I+"m"+k,{opacity:.35},0);tl.set(I+"lb"+k,{autoAlpha:0},0);tl.set(I+"ob"+k,{autoAlpha:0},0);});
tl.set(I+"rb",{autoAlpha:0},0);
for(var k=0;k<16;k++){tl.set(I+"mb"+k,{scale:0,transformOrigin:"50%% 50%%"},0);}
[0,1,2,3].forEach(function(k){tl.set(I+"bar"+k,{scaleY:0,transformOrigin:"50%% 100%%"},0);});
/* alive: clouds drift, road dashes crawl, lit milestone hovers */
tl.fromTo(I+"cl",{x:-24},{x:24,duration:{D},ease:"sine.inOut"},{S});
tl.fromTo(I+"dash",{strokeDashoffset:0},{strokeDashoffset:-280,duration:{D},ease:"none"},{S});
function light(k,t){tl.to(I+"m"+k,{opacity:1,duration:.35,ease:"power2.out"},t);tl.fromTo(I+"ob"+k,{autoAlpha:0,y:-40},{autoAlpha:1,y:0,duration:.4,ease:"back.out(1.7)"},t);
 tl.fromTo(I+"lb"+k,{autoAlpha:0,y:20},{autoAlpha:1,y:0,duration:.35,ease:"back.out(1.8)"},t+.1);
 tl.fromTo(I+"m"+k,{y:0},{y:-10,duration:1.1,yoyo:true,repeat:3,ease:"sine.inOut"},t+.35);}
function dim(k,t){tl.to(I+"m"+k,{opacity:.3,duration:.3},t);tl.to(I+"lb"+k,{autoAlpha:0,duration:.2},t);}
light(1,{S}+.35);
tl.fromTo(I+"bkc",{rotation:0},{rotation:-24,svgOrigin:"%d %d",duration:.5,ease:"power2.out"},{S}+.55);
dim(1,{W92}-.55);
tl.to(I+"cam",{x:F[1][0],y:F[1][1],duration:.7,ease:"power2.inOut"},{W92}-.55);
light(2,{W92}+.1);
for(var k=0;k<16;k++){tl.to(I+"mb"+k,{scale:1,duration:.16,ease:"back.out(2)"},{W92}+.25+k*.045);}
(function(){var o={v:0},el=document.getElementById("{ID}mn");tl.to(o,{v:20,duration:1,ease:"power1.in",onUpdate:function(){el.textContent=Math.round(o.v);}},{W92}+.25);})();
dim(2,{W99}-.55);
tl.to(I+"cam",{x:F[2][0],y:F[2][1],duration:.75,ease:"power2.inOut"},{W99}-.55);
light(3,{W100});
[0,1,2,3].forEach(function(k){tl.to(I+"bar"+k,{scaleY:1,duration:.45,ease:"back.out(1.6)"},{W100}+.15+k*.1);});
tl.to(I+"ln",{strokeDashoffset:0,duration:.5,ease:"power2.out"},{W100}+.55);
tl.fromTo(I+"rb",{autoAlpha:0,y:30},{autoAlpha:1,y:0,duration:.4,ease:"back.out(1.8)"},{W105}-.05);""" % (json.dumps(cams), MS[0][0]-55, MS[0][1]-175)
Esfx=[["whoosh-short",Wt[88]-0.1,0.25],["pop",Wt[88]+0.3,0.3],["whoosh-short",Wt[92]-0.55,0.22],["pop",Wt[92]+0.1,0.3],
      ["whoosh-short",Wt[99]-0.55,0.22],["pop",Wt[100],0.3],["sparkle",Wt[100]+0.55,0.22],["pop",Wt[105],0.28]]
E={"from":88,"to":107,"display":"full","kind":"custom","html":Ehtml,"js":Ejs,"sfx":Esfx}
# ======================= G · comment CTA, last 5 s =======================
Ghtml=f'''<div style="position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none;{SK}">
<div id="{I}glow" style="position:absolute;left:120px;top:1070px;width:840px;height:150px;border-radius:75px;background:#f26522;filter:blur(30px);opacity:.5"></div>
<div id="{I}box" style="position:absolute;left:150px;top:1110px;width:780px;height:104px;border-radius:52px;{CARD}display:flex;align-items:center;gap:18px;padding:0 16px 0 30px;box-sizing:border-box">
 <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f26522" stroke-width="2.3" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>
 <div style="position:relative;flex:1;height:104px;display:flex;align-items:center"><span style="visibility:hidden;font-size:40px;font-weight:800;white-space:nowrap">Comment your doubt</span>
  <div id="{I}typ" style="position:absolute;left:0;top:0;height:100%;width:0;overflow:hidden;display:flex;align-items:center;white-space:nowrap"><span style="font-size:40px;font-weight:800;color:#15131c">Comment your doubt</span></div>
  <span id="{I}cur" style="position:absolute;left:0;top:28px;width:4px;height:48px;background:#f26522"></span></div>
 <div style="position:relative;flex:0 0 74px;height:74px"><div id="{I}ring" style="position:absolute;inset:0;border-radius:50%;border:4px solid #f26522"></div>
  <div id="{I}send" style="position:absolute;inset:0;border-radius:50%;background:#f26522;display:flex;align-items:center;justify-content:center"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-7-6 16-3-6z"/></svg></div></div>
</div>
{"".join(f'<div id="{I}qb{k}" style="position:absolute;left:{300+k*180}px;top:1090px;width:{56-k*8}px;height:{56-k*8}px;border-radius:50%;background:#fff;border:4px solid #f26522;display:flex;align-items:center;justify-content:center;font-size:{30-k*4}px;font-weight:900;color:#f26522;box-shadow:0 8px 20px rgba(0,0,0,.25)">?</div>' for k in range(3))}
<svg id="{I}arr" width="90" height="110" viewBox="0 0 90 110" style="position:absolute;left:850px;top:1225px"><g transform="translate(45 100) rotate(-28)"><path d="M0 0 l0 -78 M0 -78 l-24 24 M0 -78 l24 24" stroke="#15131c" stroke-width="14" stroke-linecap="round" fill="none"/><path d="M0 0 l0 -78 M0 -78 l-24 24 M0 -78 l24 24" stroke="#ffd34d" stroke-width="7" stroke-linecap="round" fill="none"/></g></svg>
</div>'''
Gjs='''var I="#{ID}";
tl.set([I+"box",I+"glow",I+"arr",I+"qb0",I+"qb1",I+"qb2"],{autoAlpha:0},0);tl.set(I+"typ",{width:"0%"},0);
tl.fromTo(I+"box",{autoAlpha:0,y:60,scale:.85},{autoAlpha:1,y:0,scale:1,duration:.45,ease:"back.out(1.8)"},{S});
tl.fromTo(I+"glow",{autoAlpha:0},{autoAlpha:.55,duration:.4},{S}+.1);
/* alive: heartbeat glow, blinking cursor, send ring pulse, bouncing arrow, rising ? bubbles */
tl.to(I+"glow",{opacity:.9,scale:1.05,duration:.42,yoyo:true,repeat:11,ease:"sine.inOut"},{S}+.5);
tl.to(I+"box",{scale:1.02,duration:.42,yoyo:true,repeat:11,ease:"sine.inOut"},{S}+.5);
tl.to(I+"typ",{width:"100%",duration:.6,ease:"steps(18)"},{S}+.45);
tl.to(I+"cur",{x:460,duration:.6,ease:"steps(18)"},{S}+.45);
tl.to(I+"cur",{opacity:0,duration:.01,repeat:9,yoyo:true,repeatDelay:.45},{S}+1.1);
tl.fromTo(I+"ring",{scale:1,opacity:1},{scale:1.7,opacity:0,duration:.9,repeat:5,ease:"power1.out"},{S}+1.1);
tl.fromTo(I+"arr",{autoAlpha:0,x:40,y:40},{autoAlpha:1,x:0,y:0,duration:.35,ease:"back.out(2)"},{S}+1.2);
tl.to(I+"arr",{y:-14,x:-8,duration:.4,yoyo:true,repeat:9,ease:"sine.inOut"},{S}+1.55);
[0,1,2].forEach(function(k){tl.fromTo(I+"qb"+k,{autoAlpha:0,y:0,scale:.5},{keyframes:[{autoAlpha:1,y:-60,scale:1,duration:.4},{y:-170,duration:.9},{autoAlpha:0,y:-230,duration:.35}],repeat:2,repeatDelay:.3,ease:"sine.out"},{S}+1.4+k*.5);});'''
Gsfx=[["whoosh-short",Wt[125]-0.15,0.25],["pop",Wt[125]+0.05,0.35],["typing",Wt[125]+0.35,0.2],["pop",Wt[125]+1.5,0.2],["pop",Wt[125]+2.0,0.18],["pop",Wt[125]+2.5,0.16]]
G={"from":125,"to":146,"display":"float","kind":"custom","html":Ghtml,"js":Gjs,"sfx":Gsfx}
# ======================= assemble =======================
p['broll']=[A,by(9),C,by(44),E,by(120),G]
p['cta']['comment']=False
json.dump(p,open(ED+'/plan.json','w'),indent=1,ensure_ascii=False)
print([(b['from'],b['to'],b['display'],b['kind']) for b in p['broll']])
