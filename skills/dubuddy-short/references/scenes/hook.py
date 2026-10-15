import json
f='/Users/adi/Downloads/edit/DJI_20260927161806_0748_D/plan.json'
p=json.load(open(f))
I='{ID}'
GRAIN=f'<filter id="{I}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 .08  0 0 0 0 .06  0 0 0 0 .05  0 0 0 -1.6 1.05"/></filter>'
# ================= SCARY HOOK (float custom, full frame) =================
bars="".join(f'<div id="{I}g{k}" style="position:absolute;left:170px;top:{y}px;width:740px;height:{h}px;background:{c};mix-blend-mode:screen;opacity:0"></div>' for k,(y,h,c) in enumerate([(282,10,"#ff2040"),(336,5,"#00e5ff"),(410,12,"#ff2040"),(468,4,"#ffffff"),(540,8,"#00e5ff"),(598,5,"#ff2040")]))
import urllib.parse as _u
NOISE="url(data:image/svg+xml,"+_u.quote("<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 .9'/></filter><rect width='260' height='260' filter='url(#n)'/></svg>",safe="")+")"
TXT=lambda base: f"background:{NOISE},{base};background-size:260px 260px,100% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;"
hook_html=f'''<div style="position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none">
<div id="{I}dark" style="position:absolute;inset:-120px;background:radial-gradient(ellipse 52% 40% at 50% 46%,rgba(0,0,0,0) 30%,rgba(40,0,4,.72) 72%,rgba(0,0,0,.94) 100%)"></div>
<div id="{I}tint" style="position:absolute;inset:0;background:#7a0010;mix-blend-mode:multiply;opacity:0"></div>
<div id="{I}flash" style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 45% at 50% 45%,rgba(255,26,46,0) 35%,rgba(255,26,46,.9) 100%);opacity:0;mix-blend-mode:screen"></div>
<svg id="{I}grainv" width="1080" height="1920" style="position:absolute;left:0;top:0;opacity:.16;mix-blend-mode:multiply"><defs>{GRAIN}</defs><rect width="1080" height="1920" filter="url(#{I}grain)"/></svg>
<div id="{I}scan" style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 2px,transparent 2px 5px);opacity:.5"></div>
{bars}
<div style="position:absolute;left:60px;right:60px;top:236px;text-align:center">
 <div id="{I}k" style="display:inline-flex;align-items:center;gap:14px;padding:10px 22px;border:3px solid #ff2a3d;border-radius:10px;font-family:var(--mono),monospace;font-size:30px;letter-spacing:.22em;color:#ff4d5e;background:rgba(20,0,0,.55)"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 2 L23 21 H1 Z" fill="#ff2a3d"/><rect x="11" y="8" width="2.4" height="7" fill="#fff"/><rect x="11" y="16.6" width="2.4" height="2.4" fill="#fff"/></svg>CUET WARNING</div>
 <div id="{I}big" style="position:relative;margin-top:14px;height:176px">
  <div id="{I}bc" style="position:absolute;inset:0;font-size:172px;font-weight:900;letter-spacing:-.05em;line-height:1;color:#00e5ff;mix-blend-mode:screen;opacity:.85">1 SAAL</div>
  <div id="{I}br" style="position:absolute;inset:0;font-size:172px;font-weight:900;letter-spacing:-.05em;line-height:1;color:#ff1a2e;mix-blend-mode:screen;opacity:.9">1 SAAL</div>
  <div style="position:absolute;inset:0;font-size:172px;font-weight:900;letter-spacing:-.05em;line-height:1;color:transparent;text-shadow:0 0 40px rgba(255,26,46,.85),0 8px 0 rgba(0,0,0,.5)">1 SAAL</div><div id="{I}bw" style="position:absolute;inset:0;font-size:172px;font-weight:900;letter-spacing:-.05em;line-height:1;{TXT("linear-gradient(#ffffff,#ffe3e3)")}">1 SAAL</div>
 </div>
 <div id="{I}q" style="position:relative;display:inline-block;margin-top:0;font-size:80px;font-weight:900;font-style:italic;letter-spacing:-.03em;filter:drop-shadow(0 6px 18px rgba(0,0,0,.8))"><span style="{TXT("linear-gradient(#ffffff,#f1e6e6)")}">chahiye?</span>
  <svg width="420" height="40" viewBox="0 0 420 40" style="position:absolute;left:-10px;bottom:-26px;overflow:visible"><path id="{I}ul" pathLength="1" d="M6 24 C80 8 160 34 240 18 S380 10 414 22" stroke="#ff2a3d" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/></svg></div>
</div>
</div>'''
hook_js='''var I="#{ID}";var _s=7;function R(a,b){_s=(_s*9301+49297)%233280;return a+(b-a)*_s/233280;}function KF(n,a){var o=[];for(var i=0;i<n;i++)o.push(R(-a,a));o.push(0);return o;}
tl.set([I+"k",I+"big",I+"q"],{autoAlpha:0},0);
tl.fromTo(I+"dark",{autoAlpha:0,scale:1.15},{autoAlpha:1,scale:1,duration:.25,ease:"power2.out"},0);
tl.set("#aroll",{filter:"saturate(.3) contrast(1.25) brightness(.82)"},0);
tl.to(I+"tint",{opacity:.35,duration:.3},0);
/* heartbeat pulses */
[0.05,0.32,0.9,1.17].forEach(function(t){tl.fromTo(I+"dark",{scale:1.06},{scale:1,duration:.22,ease:"power2.out"},t);});
/* warning kicker flickers in on CUET */
tl.fromTo(I+"k",{autoAlpha:0},{autoAlpha:1,duration:.04,repeat:5,yoyo:true,ease:"none"},{W1});
tl.set(I+"k",{autoAlpha:1},{W1}+.24);
/* 1 SAAL slam on "ek" */
tl.fromTo(I+"big",{autoAlpha:0,scale:2.6},{autoAlpha:1,scale:1,duration:.18,ease:"power4.in"},{W4}-.1);
tl.set(I+"flash",{opacity:.55},{W4}+.08);tl.to(I+"flash",{opacity:0,duration:.45,ease:"power2.out"},{W4}+.1);
tl.fromTo("#aroll",{scale:1},{scale:1.1,duration:.12,ease:"power3.out"},{W4}+.08);
tl.to("#aroll-wrap",{keyframes:{x:KF(8,22)},duration:.34,ease:"none"},{W4}+.08);
tl.set("#aroll-wrap",{x:0},{W4}+.42);
function glitch(t,n){
 tl.to(I+"br",{keyframes:{x:KF(n,18),y:KF(n,6)},duration:.03*n,ease:"none"},t);
 tl.to(I+"bc",{keyframes:{x:KF(n,18),y:KF(n,6)},duration:.03*n,ease:"none"},t);
 [0,1,2,3,4,5].forEach(function(k,j){tl.fromTo(I+"g"+k,{opacity:0},{opacity:.85,x:R(-60,60),duration:.03,repeat:3,yoyo:true,ease:"none"},t+j*.02);});
 tl.to(I+"bw",{keyframes:{skewX:KF(4,14)},duration:.15,ease:"none"},t);}
glitch({W4}+.08,7);
/* chahiye? glitch in + underline */
tl.fromTo(I+"q",{autoAlpha:0,x:-30,skewX:-20},{autoAlpha:1,x:0,skewX:0,duration:.16,ease:"power3.out"},{W8}-.05);
tl.to(I+"ul",{strokeDashoffset:0,duration:.25,ease:"power2.out"},{W8}+.1);
glitch({W8}-.05,5);
tl.to(I+"big",{scale:1.06,duration:.5,ease:"sine.inOut"},{W5}+.2);
/* glitch out into the answer */
tl.to([I+"big",I+"q",I+"k"],{autoAlpha:0,x:60,skewX:30,duration:.14,ease:"power3.in",stagger:.03},{E}-.3);
tl.to([I+"dark",I+"tint",I+"grainv",I+"scan"],{opacity:0,duration:.25},{E}-.3);
tl.to("#aroll",{scale:1,duration:.3,ease:"power2.inOut"},{E}-.3);
tl.set("#aroll",{filter:"none"},{E}-.05);'''
w=lambda i: p_W[i]
import json as _j
TL=_j.load(open('/Users/adi/Downloads/edit/DJI_20260927161806_0748_D/timeline.json'))
p_W={x['i']:x['s'] for x in TL['words']}
hook_sfx=[["drone",0.0,0.45],["heartbeat",0.04,0.85],["heartbeat",0.88,0.85],["glitch",p_W[1]-0.04,0.18],
          ["boom",p_W[4]-0.06,0.7],["glitch",p_W[4]+0.04,0.3],["tick",0.6,0.2],["tick",0.75,0.2],["tick",1.0,0.2],
          ["glitch",p_W[8]-0.08,0.32],["riser",p_W[8]+0.02,0.4]]
hook_item={"from":0,"to":8,"display":"float","kind":"custom","html":hook_html,"js":hook_js,"sfx":hook_sfx}

# ================= CALENDAR ANSWER (split custom) =================
X0,X1,Y0=130,590,150
def page(idx,label,sub,band,days=True,cls=""):
    g=f'<g id="{I}p{idx}">'
    g+=f'<rect x="{X0}" y="{Y0}" width="{X1-X0}" height="560" rx="18" fill="#fffdf8"/>'
    g+=f'<path d="M{X0} {Y0+18} a18 18 0 0 1 18 -18 h{X1-X0-36} a18 18 0 0 1 18 18 v128 h-{X1-X0} z" fill="{band}"/>'
    g+=f'<text x="{(X0+X1)//2}" y="{Y0+86}" text-anchor="middle" font-size="62" font-weight="900" letter-spacing="-2" fill="#fff">{label}</text>'
    g+=f'<text x="{(X0+X1)//2}" y="{Y0+126}" text-anchor="middle" font-family="var(--mono),monospace" font-size="22" letter-spacing="5" fill="#fff" opacity=".85">{sub}</text>'
    if days:
        for d in range(35):
            r,c=divmod(d,7); x=X0+24+c*60; y=Y0+168+r*72
            if d<30:
                g+=f'<rect class="d" x="{x}" y="{y}" width="52" height="60" rx="10" fill="#f3ece2"/><text class="n" x="{x+26}" y="{y+39}" text-anchor="middle" font-size="24" font-weight="800" fill="#6f6676">{d+1}</text>'
            else:
                g+=f'<rect x="{x}" y="{y}" width="52" height="60" rx="10" fill="#f8f4ee"/>'
    else:
        g+=f'<text x="{(X0+X1)//2}" y="{Y0+380}" text-anchor="middle" font-size="190" font-weight="900" letter-spacing="-8" fill="#15131c">365</text><text x="{(X0+X1)//2}" y="{Y0+450}" text-anchor="middle" font-family="var(--mono),monospace" font-size="30" letter-spacing="8" fill="#c41d2e">DIN BAAKI</text>'
    return g+'</g>'
def three():
    g=f'<g id="{I}p0"><rect x="{X0}" y="{Y0}" width="{X1-X0}" height="560" rx="18" fill="#fffdf8"/>'
    g+=f'<path d="M{X0} {Y0+18} a18 18 0 0 1 18 -18 h{X1-X0-36} a18 18 0 0 1 18 18 v100 h-{X1-X0} z" fill="#f26522"/>'
    g+=f'<text x="{(X0+X1)//2}" y="{Y0+78}" text-anchor="middle" font-size="56" font-weight="900" letter-spacing="-2" fill="#fff">3 MAHINE</text>'
    g+=f'<text x="{(X0+X1)//2}" y="{Y0+104}" text-anchor="middle" font-family="var(--mono),monospace" font-size="20" letter-spacing="6" fill="#fff" opacity=".85">90 DIN · CUET PREP</text>'
    cols=["#f26522","#2b6f77","#2e9d57"]
    for m in range(3):
        top=Y0+134+m*140
        g+=f'<text x="{X0+22}" y="{top+22}" font-size="22" font-weight="900" letter-spacing="1" fill="{cols[m]}">MAHINA {m+1}</text>'
        g+=f'<g id="{I}ok{m}"><circle cx="{X1-34}" cy="{top+15}" r="15" fill="{cols[m]}"/><path d="M{X1-42} {top+15} l6 6 l11 -12" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
        for d in range(30):
            r,c=divmod(d,15); x=X0+20+c*28.6; y=top+36+r*46
            g+=f'<g class="m{m}"><rect class="d" x="{x:.1f}" y="{y}" width="25" height="40" rx="6" fill="#f3ece2"/><text class="n" x="{x+12.5:.1f}" y="{y+26}" text-anchor="middle" font-size="14" font-weight="800" fill="#6f6676">{d+1}</text></g>'
    return g+'</g>'
pages=three()
tear="".join(page(10+k,f"MAHINA {12-k}","30 DIN","#8b8494") for k in range(8))+page(9,"1 SAAL","CUET PREP","#c41d2e",days=False)
edges="".join(f'<rect id="{I}e{k}" x="{X0+6}" y="{Y0+560+k*4}" width="{X1-X0-12}" height="3" rx="1.5" fill="{"#e4dccf" if k%2 else "#d5cbbd"}"/>' for k in range(11))
rings="".join(f'<rect x="{X0+40+k*56}" y="{Y0-30}" width="12" height="40" rx="6" fill="#4a4652"/><circle cx="{X0+46+k*56}" cy="{Y0+12}" r="6" fill="#d9cfc2"/>' for k in range(8))
cal_html=f'''<div style="position:absolute;inset:0;background:#f6e7d4"></div>
<svg viewBox="0 0 1080 840" width="1080" height="840" style="position:absolute;left:0;top:0;font-family:'Plus Jakarta Sans',sans-serif">
<defs>{GRAIN}
<filter id="{I}plaster" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="4" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .55  0 0 0 0 .38  0 0 0 0 .25  0 0 0 -1.1 .3" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="t"/><feBlend in="t" in2="SourceGraphic" mode="multiply"/></filter>
<filter id="{I}soft"><feGaussianBlur stdDeviation="16"/></filter>
<linearGradient id="{I}wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e7d4"/><stop offset="1" stop-color="#ead2b6"/></linearGradient>
<radialGradient id="{I}vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#2a1608" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".2"/></radialGradient>
</defs>
<rect width="1080" height="840" fill="url(#{I}wall)" filter="url(#{I}plaster)"/>
<path d="M360 40 L{X0+40} {Y0-10} M360 40 L{X1-40} {Y0-10}" stroke="#7a5a44" stroke-width="3"/><circle cx="360" cy="38" r="9" fill="#5a4636"/>
<rect x="{X0+16}" y="{Y0+40}" width="{X1-X0}" height="600" rx="22" fill="#3a2414" opacity=".32" filter="url(#{I}soft)"/>
{edges}{pages}{tear}{rings}
<!-- counter card -->
<rect x="666" y="186" width="360" height="430" rx="30" fill="#3a2414" opacity=".3" filter="url(#{I}soft)"/>
<rect x="656" y="166" width="360" height="430" rx="30" fill="#fff"/>
<text x="836" y="232" text-anchor="middle" font-family="var(--mono),monospace" font-size="24" letter-spacing="6" fill="#8b8494">PREP TIME</text>
<text id="{I}cn" x="836" y="390" text-anchor="middle" font-size="170" font-weight="900" letter-spacing="-8" fill="#15131c">365</text>
<text id="{I}dd" x="836" y="440" text-anchor="middle" font-size="30" font-weight="800" letter-spacing="2" fill="#8b8494">DIN</text>
<g id="{I}eq"><rect x="688" y="468" width="296" height="70" rx="35" fill="#f26522"/><text x="836" y="515" text-anchor="middle" font-size="38" font-weight="900" fill="#fff">= 3 MAHINE</text></g>
<rect x="688" y="556" width="296" height="16" rx="8" fill="#efe7dc"/><rect id="{I}bar" x="688" y="556" width="296" height="16" rx="8" fill="#2e9d57"/>
<!-- stamp -->
<g id="{I}stamp"><rect x="640" y="640" width="392" height="104" rx="18" fill="#fff" opacity=".95"/><rect x="640" y="640" width="392" height="104" rx="18" fill="none" stroke="#2e9d57" stroke-width="7"/>
 <text x="790" y="709" text-anchor="middle" font-size="48" font-weight="900" letter-spacing="1" fill="#2e9d57">KAAFI HAI</text>
 <circle cx="975" cy="692" r="34" fill="#2e9d57"/><path d="M958 693 l12 12 l22 -24" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
<rect width="1080" height="840" fill="url(#{I}vig)"/>
<rect width="1080" height="840" filter="url(#{I}grain)" opacity=".14" style="mix-blend-mode:multiply"/>
</svg>'''
cal_js='''var I="#{ID}";
tl.set([I+"eq",I+"stamp"],{autoAlpha:0},0);tl.set(I+"bar",{scaleX:0,svgOrigin:"688 564"},0);
/* tear off 1 SAAL cover + 8 months */
var t0={W10};
[9,10,11,12,13,14,15,16,17].forEach(function(k,j){var t=t0+j*.05;
 tl.to(I+"p"+k,{x:(j%2?150:-150)+(j%2?j:-j)*8,y:120+j*6,rotation:(j%2?14:-12),autoAlpha:0,svgOrigin:"360 150",duration:.32,ease:"power2.in"},t);});
for(var k=0;k<9;k++){tl.to(I+"e"+(10-k),{autoAlpha:0,duration:.05},t0+k*.05+.1);}
(function(){var o={v:365},el=document.getElementById("{ID}cn");tl.to(o,{v:90,duration:{W13}-t0,ease:"power2.in",onUpdate:function(){el.textContent=Math.round(o.v);}},t0);})();
/* 3 MAHINE lands on "teen" */
tl.fromTo(I+"eq",{autoAlpha:0,scale:1.8,svgOrigin:"836 503"},{autoAlpha:1,scale:1,duration:.2,ease:"power4.in"},{W13}-.05);
tl.fromTo(I+"cn",{fill:"#15131c"},{fill:"#f26522",duration:.15},{W13});
tl.fromTo("#{ID}",{x:0},{x:6,duration:.03,repeat:3,yoyo:true},{W13}+.15);
/* tick off all 90 dates on one page, month by month */
var start={W13}+.05,span=Math.max(1.6,{E}-.75-start),per=span/3,cols=["#f26522","#2b6f77","#2e9d57"];
tl.set(I+"ok0",{autoAlpha:0},0);tl.set(I+"ok1",{autoAlpha:0},0);tl.set(I+"ok2",{autoAlpha:0},0);
[0,1,2].forEach(function(m){var t=start+m*per,st=per*.92/30;
 tl.fromTo(I+"p0 .m"+m+" .d",{scale:1,transformOrigin:"50% 50%"},{keyframes:{scale:[1.25,1]},attr:{fill:cols[m]},duration:.14,stagger:st,ease:"power2.out"},t);
 tl.to(I+"p0 .m"+m+" .n",{attr:{fill:"#ffffff"},duration:.08,stagger:st},t);
 tl.fromTo(I+"ok"+m,{autoAlpha:0,scale:0,transformOrigin:"50% 50%"},{autoAlpha:1,scale:1,duration:.25,ease:"back.out(2.5)"},t+per*.95);});
(function(){var o={v:0},el=document.getElementById("{ID}dd");tl.to(o,{v:90,duration:span,ease:"none",onUpdate:function(){el.textContent="DIN "+Math.round(o.v)+"/90";}},start);})();
tl.to(I+"bar",{scaleX:1,duration:span,ease:"none"},start);
/* KAAFI HAI stamp on "kaafi" */
tl.fromTo(I+"stamp",{autoAlpha:0,scale:2,rotation:-12,svgOrigin:"836 692"},{autoAlpha:1,scale:1,rotation:-4,duration:.24,ease:"power4.in"},{W16}-.05);
tl.to(I+"stamp",{scale:1.04,duration:.4,yoyo:true,repeat:3,ease:"sine.inOut",svgOrigin:"836 692"},{W16}+.3);'''
cal_sfx=[["flip",p_W[10]-0.05+k*0.1,0.5] for k in range(5)]+[["whoosh-short",p_W[13]-0.08,0.3],["pop",p_W[13],0.35],
        ["chime",p_W[16]-0.02,0.4],["sparkle",p_W[16]+0.1,0.25]]
cal_item={"from":9,"to":22,"display":"split","kind":"custom","html":cal_html,"js":cal_js,"sfx":cal_sfx,"shift":360}

# replace: drop old hook card + 3-mahine stat; insert new items
p['hook']={"text":"","kicker":"","accent":"","dur":2.2}
p['broll']=[hook_item,cal_item]+[b for b in p['broll'] if not (b.get('kind')=='stat' and b.get('from')==13)]
json.dump(p,open(f,'w'),indent=1,ensure_ascii=False)
print([ (b['from'],b['to'],b['display'],b['kind']) for b in p['broll']])
