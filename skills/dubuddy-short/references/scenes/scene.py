import json
f='/Users/adi/Downloads/edit/DJI_20260927161806_0748_D/plan.json'
p=json.load(open(f))
I='{ID}'
ans=[1,3,0,2,1]
# ---------- defs: textures ----------
defs=f'''<defs>
<filter id="{I}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 .08  0 0 0 0 .06  0 0 0 0 .05  0 0 0 -1.6 1.05"/></filter>
<filter id="{I}wood" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .22" numOctaves="3" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .35  0 0 0 0 .18  0 0 0 0 .08  0 0 0 -1.3 .55" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="t"/><feBlend in="t" in2="SourceGraphic" mode="multiply"/></filter>
<filter id="{I}cork" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" seed="11" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .42  0 0 0 0 .25  0 0 0 0 .1  0 0 0 -2.2 .8" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="t"/><feBlend in="t" in2="SourceGraphic" mode="multiply"/></filter>
<filter id="{I}plaster" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="4" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .55  0 0 0 0 .38  0 0 0 0 .25  0 0 0 -1.1 .3" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="t"/><feBlend in="t" in2="SourceGraphic" mode="multiply"/></filter>
<filter id="{I}graph" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .55  0 0 0 0 .55  0 0 0 0 .6  0 0 0 -2 1.2" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="t"/><feBlend in="t" in2="SourceGraphic" mode="screen"/></filter>
<filter id="{I}soft"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="{I}soft4"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="{I}shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#2a1a10" flood-opacity=".28"/></filter>
<pattern id="{I}hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="3" height="9" fill="#8e2f08" opacity=".22"/></pattern>
<pattern id="{I}lines" width="1" height="14" patternUnits="userSpaceOnUse"><rect y="13" width="1" height="1" fill="#9fb6d6" opacity=".7"/></pattern>
<linearGradient id="{I}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc0ea"/><stop offset="1" stop-color="#f3e2c8"/></linearGradient>
<linearGradient id="{I}wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e7d4"/><stop offset="1" stop-color="#ead2b6"/></linearGradient>
<linearGradient id="{I}beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff8e6" stop-opacity=".75"/><stop offset="1" stop-color="#fff8e6" stop-opacity="0"/></linearGradient>
<radialGradient id="{I}cone" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#fff1a8" stop-opacity=".85"/><stop offset=".7" stop-color="#ffe98a" stop-opacity=".18"/><stop offset="1" stop-color="#ffe98a" stop-opacity="0"/></radialGradient>
<radialGradient id="{I}vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#2a1608" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".2"/></radialGradient>
<radialGradient id="{I}skin" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#e7b38e"/><stop offset="1" stop-color="#c88b63"/></radialGradient>
<linearGradient id="{I}shirt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7a3a"/><stop offset=".55" stop-color="#f26522"/><stop offset="1" stop-color="#c94e15"/></linearGradient>
<clipPath id="{I}shirtclip"><path d="M258 600 C258 540 282 492 360 482 C438 492 462 540 462 600 Z"/></clipPath>
</defs>'''
# ---------- room ----------
room=f'''
<rect width="1080" height="840" fill="url(#{I}wall)" filter="url(#{I}plaster)"/>
<rect y="520" width="1080" height="60" fill="#d9bc9b" opacity=".55"/>
<!-- window -->
<g>
 <rect x="40" y="40" width="220" height="270" rx="8" fill="url(#{I}sky)"/>
 <ellipse cx="110" cy="105" rx="46" ry="15" fill="#fff" opacity=".85"/><ellipse cx="140" cy="96" rx="30" ry="14" fill="#fff" opacity=".85"/>
 <ellipse cx="205" cy="160" rx="34" ry="10" fill="#fff" opacity=".7"/>
 <path d="M40 310 L40 236 L72 236 L72 214 L104 214 L104 250 L140 250 L140 196 L176 196 L176 240 L212 240 L212 222 L260 222 L260 310 Z" fill="#a7b8c9" opacity=".75"/>
 <g fill="#fff6c8" opacity=".9"><rect x="150" y="210" width="8" height="10"/><rect x="162" y="210" width="8" height="10"/><rect x="150" y="226" width="8" height="10"/><rect x="82" y="226" width="8" height="10"/></g>
 <rect x="40" y="40" width="220" height="270" rx="8" fill="none" stroke="#fbf6ef" stroke-width="16"/>
 <path d="M150 40 V310 M40 175 H260" stroke="#fbf6ef" stroke-width="10"/>
 <rect x="26" y="306" width="250" height="16" rx="4" fill="#f4ece2"/><rect x="26" y="320" width="250" height="5" fill="#cdb397"/>
 <path d="M30 30 C60 120 46 220 70 330 L28 330 Z" fill="#2b6f77"/><path d="M40 40 C58 140 48 230 62 326" stroke="#215a61" stroke-width="5" fill="none"/>
 <rect x="20" y="22" width="270" height="10" rx="5" fill="#6b4a33"/>
</g>
<path id="{I}beam" d="M60 60 L260 60 L700 570 L250 570 Z" fill="url(#{I}beam)" opacity=".35" style="mix-blend-mode:screen"/>
<!-- clock -->
<g filter="url(#{I}shadow)"><circle cx="540" cy="125" r="62" fill="#2a2633"/><circle cx="540" cy="125" r="52" fill="#fffaf2"/></g>
<g stroke="#2a2633" stroke-linecap="round">{"".join(f'<line x1="540" y1="{125-46 if k%3==0 else 125-44}" x2="540" y2="{125-38 if k%3==0 else 125-41}" stroke-width="{4 if k%3==0 else 2}" transform="rotate({k*30} 540 125)"/>' for k in range(12))}</g>
<line id="{I}hh" x1="540" y1="125" x2="540" y2="98" stroke="#2a2633" stroke-width="6" stroke-linecap="round"/>
<line id="{I}mh" x1="540" y1="125" x2="540" y2="84" stroke="#f26522" stroke-width="4" stroke-linecap="round"/>
<circle cx="540" cy="125" r="5" fill="#2a2633"/>
<!-- corkboard -->
<g filter="url(#{I}shadow)"><rect x="630" y="36" width="420" height="262" rx="10" fill="#8a5a3a"/></g>
<rect x="630" y="36" width="420" height="262" rx="10" fill="#9b6744" filter="url(#{I}wood)"/>
<rect x="644" y="50" width="392" height="234" rx="4" fill="#c99a68" filter="url(#{I}cork)"/>
<g transform="rotate(-2 800 160)" filter="url(#{I}shadow)">
 <rect x="668" y="66" width="268" height="196" rx="4" fill="#fffdf7"/>
</g>
<g transform="rotate(-2 800 160)">
 <rect x="668" y="66" width="268" height="12" fill="#f26522" opacity=".9"/>
 <text x="802" y="104" text-anchor="middle" font-family="var(--mono),monospace" font-size="20" letter-spacing="4" fill="#c94e15">PER SUBJECT</text>
 <text x="802" y="190" text-anchor="middle" font-size="80" font-weight="800" letter-spacing="-3" fill="#15131c">15–20</text>
 <text x="802" y="224" text-anchor="middle" font-size="30" font-weight="800" letter-spacing="3" fill="#f26522">MOCKS</text>
 {"".join(f'<rect id="{I}t{k}" x="{682+k*12.2:.1f}" y="238" width="9" height="12" rx="2" fill="#f26522"/><rect x="{682+k*12.2:.1f}" y="238" width="9" height="12" rx="2" fill="none" stroke="#d8cfc4" stroke-width="1.5"/>' for k in range(20))}
 <circle cx="802" cy="74" r="10" fill="#e0362c"/><circle cx="799" cy="71" r="3.5" fill="#fff" opacity=".7"/>
</g>
<g transform="rotate(7 990 110)" filter="url(#{I}shadow)"><rect x="950" y="70" width="80" height="80" fill="#ffe36e"/></g>
<g transform="rotate(7 990 110)"><text x="990" y="105" text-anchor="middle" font-size="18" font-weight="800" fill="#5b4a00">NCERT</text><path d="M975 120 l8 9 l17 -19" stroke="#2e9d57" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="990" cy="76" r="6" fill="#2b6f77"/></g>
<g transform="rotate(-6 990 220)" filter="url(#{I}shadow)"><rect x="952" y="180" width="76" height="76" fill="#ffb3c7"/></g>
<g transform="rotate(-6 990 220)"><text x="990" y="215" text-anchor="middle" font-size="20" font-weight="800" fill="#7a1f3d">PYQ</text><text x="990" y="240" text-anchor="middle" font-size="14" font-weight="700" fill="#7a1f3d">daily</text><circle cx="990" cy="186" r="6" fill="#2b6f77"/></g>
<!-- wall shadow of student -->
<ellipse cx="380" cy="470" rx="150" ry="120" fill="#7a5034" opacity=".18" filter="url(#{I}soft)"/>
'''
# ---------- lamp + desk items behind student ----------
lamp=f'''
<g id="{I}lamp">
 <path d="M118 592 L96 470 L176 386" stroke="#33454d" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
 <circle cx="96" cy="470" r="11" fill="#22333a"/><circle cx="176" cy="386" r="10" fill="#22333a"/>
 <path d="M150 366 L232 340 L270 410 L192 444 Z" fill="#2b6f77"/><path d="M150 366 L232 340 L240 356 L162 386 Z" fill="#3f8f99"/>
 <ellipse cx="231" cy="427" rx="40" ry="14" transform="rotate(-24 231 427)" fill="#fff4c2"/>
</g>
'''
cone=f'<path id="{I}cone" d="M198 436 L262 412 L312 604 L118 608 Z" opacity=".8" fill="url(#{I}cone)" style="mix-blend-mode:screen"/><circle id="{I}glow" cx="232" cy="430" r="46" fill="#fff3b0" opacity=".7" filter="url(#{I}soft)"/>'
# ---------- student ----------
student=f'''
<g id="{I}stu">
 <rect x="244" y="388" width="232" height="230" rx="52" fill="#2f2a3a"/>
 <rect x="262" y="404" width="196" height="200" rx="40" fill="#3d3749"/>
 <rect x="270" y="412" width="180" height="184" rx="34" fill="none" stroke="#2a2533" stroke-width="2" stroke-dasharray="6 6"/>
 <g id="{I}torso">
  <path d="M258 600 C258 540 282 492 360 482 C438 492 462 540 462 600 Z" fill="url(#{I}shirt)"/>
  <g clip-path="url(#{I}shirtclip)"><rect x="405" y="480" width="70" height="130" fill="url(#{I}hatch)"/><path d="M300 560 C320 540 330 520 334 500 M392 520 C398 545 410 560 420 590" stroke="#b9470f" stroke-width="3" fill="none" opacity=".55"/></g>
  <path d="M360 512 V600" stroke="#c94e15" stroke-width="3"/>
  <circle cx="366" cy="528" r="3.5" fill="#fff3ea"/><circle cx="366" cy="556" r="3.5" fill="#fff3ea"/><circle cx="366" cy="584" r="3.5" fill="#fff3ea"/>
  <path d="M296 534 h40 v34 h-40 z" fill="none" stroke="#c94e15" stroke-width="3"/><path d="M318 530 v14" stroke="#ffd34d" stroke-width="5" stroke-linecap="round"/>
 </g>
 <path d="M340 452 h40 v40 q-20 12 -40 0 z" fill="#b97a54"/>
 <path d="M318 486 L360 482 L346 516 Z M402 486 L360 482 L374 516 Z" fill="#fff3ea"/><path d="M346 516 L360 482 L374 516" fill="none" stroke="#d9c9bb" stroke-width="2"/>
 <g id="{I}head">
  <ellipse cx="296" cy="402" rx="13" ry="19" fill="#c88b63"/><ellipse cx="424" cy="402" rx="13" ry="19" fill="#c88b63"/>
  <ellipse cx="360" cy="396" rx="62" ry="72" fill="url(#{I}skin)"/>
  <path d="M312 430 C330 462 390 462 408 430 C400 470 320 470 312 430 Z" fill="#b97a54" opacity=".35"/>
  <path d="M296 400 C282 330 318 308 362 308 C412 308 440 336 428 398 C420 360 402 346 380 344 C360 360 330 362 306 356 C300 368 298 384 296 400 Z" fill="#1c1714"/>
  <path d="M322 330 C340 320 372 318 396 326 M316 344 C336 336 352 338 368 336 M380 336 C396 334 410 340 418 352" stroke="#4a3a30" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M326 382 L350 378 M372 378 L396 382" stroke="#1c1714" stroke-width="5" stroke-linecap="round"/>
  <g id="{I}eyesD"><path d="M328 401 Q339 408 350 401 M372 401 Q383 408 394 401" stroke="#1c1714" stroke-width="4" fill="none" stroke-linecap="round"/></g>
  <g id="{I}eyesR"><ellipse cx="341" cy="400" rx="7" ry="8" fill="#fff"/><ellipse cx="385" cy="400" rx="7" ry="8" fill="#fff"/><circle cx="345" cy="401" r="4.5" fill="#1c1714"/><circle cx="389" cy="401" r="4.5" fill="#1c1714"/></g>
  <g fill="#fff" fill-opacity=".14" stroke="#1c1714" stroke-width="4"><rect x="320" y="386" width="40" height="30" rx="10"/><rect x="364" y="386" width="40" height="30" rx="10"/></g>
  <path d="M360 398 h4 M320 396 L300 392 M404 396 L422 392" stroke="#1c1714" stroke-width="4" stroke-linecap="round"/>
  <path d="M328 392 l8 -4 M372 392 l8 -4" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  <path d="M362 412 Q368 426 358 430" stroke="#a96c47" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path id="{I}mouth" d="M346 444 Q360 452 374 444" stroke="#7a3b2a" stroke-width="4" fill="none" stroke-linecap="round"/>
  <ellipse cx="324" cy="432" rx="12" ry="6" fill="#e07a5f" opacity=".25"/><ellipse cx="398" cy="432" rx="12" ry="6" fill="#e07a5f" opacity=".25"/>
 </g>
</g>
'''
# ---------- desk ----------
desk=f'''
<path d="M20 570 L1060 570 L1080 640 L0 640 Z" fill="#c08355" filter="url(#{I}wood)"/>
<path d="M0 640 H1080 V662 H0 Z" fill="#8d5a37"/>
<rect y="662" width="1080" height="178" fill="#a06a43" filter="url(#{I}wood)"/>
<rect x="120" y="690" width="300" height="110" rx="10" fill="none" stroke="#7e4f2f" stroke-width="5"/><rect x="236" y="736" width="70" height="14" rx="7" fill="#e9c58f"/>
<rect x="660" y="690" width="300" height="110" rx="10" fill="none" stroke="#7e4f2f" stroke-width="5"/><rect x="776" y="736" width="70" height="14" rx="7" fill="#e9c58f"/>
<rect y="662" width="1080" height="14" fill="#5a3520" opacity=".35"/>
'''
# items on desk (front of student)
items=f'''
<ellipse cx="118" cy="598" rx="60" ry="12" fill="#3a2414" opacity=".3" filter="url(#{I}soft4)"/>
<ellipse cx="118" cy="592" rx="56" ry="14" fill="#22333a"/><ellipse cx="118" cy="588" rx="50" ry="11" fill="#33454d"/>
<g><ellipse cx="226" cy="604" rx="34" ry="8" fill="#3a2414" opacity=".3" filter="url(#{I}soft4)"/>
 <path d="M196 548 h58 v46 q0 10 -10 10 h-38 q-10 0 -10 -10 z" fill="#fffaf2"/><path d="M254 560 q22 0 22 18 q0 16 -22 16" stroke="#fffaf2" stroke-width="8" fill="none"/>
 <rect x="196" y="566" width="58" height="12" fill="#f26522"/><ellipse cx="225" cy="548" rx="29" ry="7" fill="#5a3418"/>
 <path id="{I}st0" d="M212 538 q-10 -16 0 -32 q10 -16 0 -32" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
 <path id="{I}st1" d="M232 538 q10 -16 0 -32 q-10 -16 0 -32" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
</g>
<ellipse cx="520" cy="628" rx="110" ry="9" fill="#3a2414" opacity=".25" filter="url(#{I}soft4)"/>
<path d="M432 624 L614 624 L600 580 L444 580 Z" fill="#fffdf7"/>
<path d="M432 624 L614 624 L600 580 L444 580 Z" fill="url(#{I}lines)" opacity=".8"/>
<g fill="none" stroke="#8b8494" stroke-width="1.5">{"".join(f'<circle cx="{462+c*13+r*-1}" cy="{588+r*8}" r="3"/>' for r in range(4) for c in range(4))}</g>
<path id="{I}scrib" pathLength="1" d="M530 590 q6 -4 12 0 t12 0 t12 0 M528 600 q6 -4 12 0 t12 0 t12 0 t12 0 M526 610 q6 -4 12 0 t12 0 t12 0" stroke="#3a3a44" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/>
<g id="{I}stack">{"".join(f'<g id="{I}sh{k}"><rect x="{636+(k%2)*3}" y="{598-k*7}" width="118" height="9" rx="2" fill="{"#fffdf7" if k%2 else "#f4efe6"}" stroke="#d8cfc4" stroke-width="1.5" transform="rotate({(-1.5 if k%2 else 1.2)} 695 {602-k*7})"/></g>' for k in range(7))}</g>
<g id="{I}donetag"><rect x="660" y="534" width="70" height="22" rx="11" fill="#2e9d57"/><text x="695" y="550" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" letter-spacing="1.5">DONE</text></g>
<!-- arms -->
<path d="M290 512 C270 545 262 580 276 606 L410 618" stroke="#e86a2b" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M276 606 L408 618" stroke="#c94e15" stroke-width="10" fill="none" stroke-linecap="round" opacity=".5"/>
<ellipse cx="428" cy="614" rx="22" ry="15" fill="url(#{I}skin)"/><path d="M420 604 q10 -4 18 2" stroke="#b97a54" stroke-width="2.5" fill="none"/>
<path d="M436 508 C470 530 494 560 506 596" stroke="url(#{I}shirt)" stroke-width="42" fill="none" stroke-linecap="round"/>
<g id="{I}fore">
 <path d="M506 598 L552 606" stroke="#f26522" stroke-width="36" stroke-linecap="round"/>
 <rect x="540" y="590" width="14" height="32" rx="5" fill="#fff3ea" transform="rotate(8 547 606)"/>
 <ellipse cx="572" cy="607" rx="21" ry="15" fill="url(#{I}skin)"/>
 <path d="M562 598 q8 -5 18 0 M564 614 q8 4 16 0" stroke="#b97a54" stroke-width="2.5" fill="none"/>
 <g transform="rotate(-38 560 612)"><rect x="560" y="606" width="78" height="11" rx="2" fill="#ffc531"/><rect x="560" y="606" width="78" height="4" fill="#f2a900"/><path d="M560 606 L546 611.5 L560 617 Z" fill="#e9c58f"/><path d="M550 610 L544 611.5 L550 613" fill="#2a2a33"/><rect x="636" y="605.5" width="8" height="12" fill="#b8b8c4"/><rect x="644" y="605.5" width="10" height="12" rx="3" fill="#ff8fa3"/></g>
</g>
'''
# ---------- answer sheet zoom card ----------
rows="";fills="";marks=""
for r in range(5):
    y=436+r*44
    rows+=f'<text x="796" y="{y+7}" font-size="20" font-weight="800" fill="#8b8494">{r+1}</text>'
    for c in range(4):
        x=834+c*38
        rows+=f'<circle cx="{x}" cy="{y}" r="13" fill="#fff" stroke="#c4bccb" stroke-width="2.5"/><text x="{x}" y="{y+4.5}" text-anchor="middle" font-size="11" font-weight="700" fill="#c4bccb">{"ABCD"[c]}</text>'
    fills+=f'<circle id="{I}f{r}" cx="{834+ans[r]*38}" cy="{y}" r="11.5" fill="#2b2b35"/>'
    if r!=2: marks+=f'<path id="{I}m{r}" pathLength="1" d="M992 {y} l8 9 l16 -20" stroke="#e0362c" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1"/>'
    else: marks+=f'<path id="{I}m{r}" pathLength="1" d="M993 {y-9} l18 18 M1011 {y-9} l-18 18" stroke="#e0362c" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/>'
card=f'''
<path id="{I}link" d="M612 584 C680 560 700 500 770 470" stroke="#f26522" stroke-width="4" stroke-dasharray="3 11" stroke-linecap="round" fill="none"/>
<g id="{I}card">
 <rect x="776" y="350" width="282" height="410" rx="26" fill="#2a1a10" opacity=".35" filter="url(#{I}soft)"/><rect x="770" y="330" width="282" height="410" rx="26" fill="#ffffff"/>
 <path d="M770 356 a26 26 0 0 1 26 -26 h230 a26 26 0 0 1 26 26 v34 h-282 z" fill="#15131c"/>
 <text x="911" y="368" text-anchor="middle" font-size="25" font-weight="800" fill="#fff" letter-spacing="2">MOCK <tspan id="{I}n" fill="#f26522">1</tspan>/20</text>
 <rect id="{I}hl" x="784" y="502" width="254" height="40" rx="12" fill="#ffe36e" opacity=".75"/>
 {rows}{fills}{marks}
 <g id="{I}pen"><g transform="rotate(-50)"><rect x="0" y="-5" width="54" height="10" rx="2" fill="#ffc531"/><path d="M0 -5 L-12 0 L0 5 Z" fill="#e9c58f"/><path d="M-8 -1.5 L-12 0 L-8 1.5" fill="#2a2a33"/><rect x="50" y="-5" width="10" height="10" rx="3" fill="#ff8fa3"/></g></g>
 <path id="{I}sc" pathLength="1" d="M846 692 c-40 -2 -46 -38 -4 -42 c40 -3 52 30 12 40 c-14 3 -30 2 -36 -4" stroke="#e0362c" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/>
 <text id="{I}sct" x="842" y="682" text-anchor="middle" font-size="26" font-weight="900" font-style="italic" fill="#e0362c">4/5</text>
 <g id="{I}stamp"><rect x="890" y="648" width="146" height="46" rx="10" fill="none" stroke="#2e9d57" stroke-width="4.5"/><text x="963" y="679" text-anchor="middle" font-size="19" font-weight="900" fill="#2e9d57" letter-spacing="2">ANALYSED</text></g>
 <g id="{I}mag"><circle r="27" fill="#dff3ff" fill-opacity=".35" stroke="#15131c" stroke-width="7"/><path d="M-12 -10 a16 16 0 0 1 14 -8" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M19 19 L44 44" stroke="#15131c" stroke-width="11" stroke-linecap="round"/></g>
</g>
<g id="{I}note"><g filter="url(#{I}shadow)"><rect x="660" y="436" width="104" height="80" fill="#ffe36e" transform="rotate(-6 712 476)"/></g>
 <g transform="rotate(-6 712 476)"><text x="712" y="468" text-anchor="middle" font-size="17" font-weight="800" fill="#5b4a00">Revise</text><text x="712" y="494" text-anchor="middle" font-size="22" font-weight="900" fill="#e0362c">Q3!</text></g></g>
'''
post=f'<rect width="1080" height="840" fill="url(#{I}vig)"/><rect width="1080" height="840" filter="url(#{I}grain)" opacity=".14" style="mix-blend-mode:multiply"/>'
svg=(f'<svg viewBox="0 0 1080 840" width="1080" height="840" style="position:absolute;left:0;top:0;font-family:\'Plus Jakarta Sans\',sans-serif">'
     +defs+'<g id="{ID}L0">'+room+'</g><g id="{ID}L1">'+lamp+student+'</g><g id="{ID}L2">'+desk+cone+items+'</g>'
     +'<g id="{ID}dust">'+"".join(f'<circle id="{I}d{k}" cx="{150+k*22}" cy="{470+(k%4)*30}" r="{2+(k%3)}" fill="#fff6c8" opacity=".55"/>' for k in range(10))+'</g>'
     +post+card+'</svg>')
html='<div style="position:absolute;inset:0;background:#f6e7d4"></div>'+svg
js='''var I="#{ID}";
/* parallax camera drift: back wall moves least, desk most */
for(var k=0;k<10;k++){tl.fromTo(I+"d"+k,{y:0,opacity:0},{y:-70-k*6,opacity:.6,duration:1.6+k*.13,ease:"sine.out",repeat:Math.ceil({D}/1.6),yoyo:true,delay:k*.17},{S});}
tl.set([I+"hl",I+"stamp",I+"mag",I+"link",I+"note",I+"eyesR",I+"sct",I+"pen",I+"donetag"],{autoAlpha:0},0);
for(var k=0;k<20;k++){tl.set(I+"t"+k,{autoAlpha:0},0);}
for(var k=0;k<7;k++){tl.set(I+"sh"+k,{autoAlpha:0},0);}
[0,1,2,3,4].forEach(function(r){tl.set(I+"f"+r,{scale:0,transformOrigin:"50% 50%"},0);});
tl.set(I+"card",{autoAlpha:0},0);
/* ambience */
tl.fromTo(I+"cone",{opacity:0},{opacity:1,duration:.06,repeat:3,yoyo:true},{S}+.35);
tl.fromTo(I+"glow",{opacity:0},{opacity:.7,duration:.06,repeat:3,yoyo:true},{S}+.35);
tl.set([I+"cone",I+"glow"],{opacity:1},{S}+.62);tl.set(I+"glow",{opacity:.7},{S}+.62);
tl.to(I+"mh",{rotation:1440,svgOrigin:"540 125",duration:{D},ease:"none"},{S});
tl.to(I+"hh",{rotation:120,svgOrigin:"540 125",duration:{D},ease:"none"},{S});
tl.to(I+"beam",{opacity:.5,duration:{D}/2,yoyo:true,repeat:1,ease:"sine.inOut"},{S});
[0,1].forEach(function(s){tl.fromTo(I+"st"+s,{y:10,opacity:0},{y:-26,opacity:.7,duration:1.1,ease:"sine.out",repeat:Math.floor({D}/1.1),delay:s*.55},{S});});
tl.to(I+"torso",{scaleY:1.015,svgOrigin:"360 600",duration:1.2,yoyo:true,repeat:Math.floor({D}/1.2),ease:"sine.inOut"},{S});
/* writing */
tl.to(I+"fore",{rotation:-5,x:4,svgOrigin:"506 598",duration:.15,repeat:Math.max(1,Math.floor(({W57}-{W46})/.15)),yoyo:true,ease:"sine.inOut"},{W46});
tl.to(I+"scrib",{strokeDashoffset:0,duration:Math.max(.6,{W57}-{W46}),ease:"none"},{W46});
tl.to(I+"head",{rotation:2,svgOrigin:"360 470",duration:.5,yoyo:true,repeat:3,ease:"sine.inOut"},{W46});
tl.to(I+"eyesD",{scaleY:.2,svgOrigin:"360 403",duration:.07,repeat:1,yoyo:true},{W50});
/* counting mocks */
tl.fromTo(I+"card",{autoAlpha:0,scale:.4,svgOrigin:"690 590"},{autoAlpha:1,scale:1,duration:.55,ease:"back.out(1.5)"},{W47});
tl.fromTo(I+"link",{autoAlpha:0},{autoAlpha:1,duration:.3},{W47}+.25);
(function(){var o={v:1},el=document.getElementById("{ID}n"),span=Math.max(.8,{W53}-{W47});tl.to(o,{v:20,duration:span,ease:"power1.in",onUpdate:function(){el.textContent=Math.round(o.v);}},{W47});
 for(var k=0;k<20;k++){tl.fromTo(I+"t"+k,{autoAlpha:0,scale:0,transformOrigin:"50% 100%"},{autoAlpha:1,scale:1,duration:.12},{W47}+span*Math.pow((k+1)/20,.6)*.98);}
 for(var k=0;k<7;k++){tl.fromTo(I+"sh"+k,{autoAlpha:0,y:-30},{autoAlpha:1,y:0,duration:.18,ease:"power2.out"},{W47}+span*(k+1)/7.4);}
 tl.fromTo(I+"donetag",{autoAlpha:0,y:8},{autoAlpha:1,y:0,duration:.25},{W47}+span);})();
/* attempt: pencil fills bubbles */
tl.set(I+"pen",{autoAlpha:1,x:1010,y:420},{W54}-.25);
[0,1,2,3,4].forEach(function(r,k){var t={W54}+k*.3,ax=[1,3,0,2,1][r];
 tl.to(I+"pen",{x:834+ax*38+6,y:436+r*44+4,duration:.16,ease:"power2.inOut"},t-.16);
 tl.to(I+"pen",{x:"+=4",duration:.04,repeat:3,yoyo:true},t);
 tl.to(I+"f"+r,{scale:1,duration:.18,ease:"power2.out"},t);});
tl.to(I+"pen",{autoAlpha:0,x:1060,y:740,duration:.3},{W54}+1.55);
/* analysis */
tl.set(I+"eyesD",{autoAlpha:0},{W57});tl.set(I+"eyesR",{autoAlpha:1},{W57});
tl.to(I+"head",{rotation:-5,x:6,svgOrigin:"360 470",duration:.45,ease:"power2.out"},{W57});
tl.to(I+"fore",{rotation:0,x:0,duration:.3},{W57});
[0,1,2,3,4].forEach(function(r,k){tl.to(I+"m"+r,{strokeDashoffset:0,duration:.2,ease:"none"},{W58}+k*.16);});
tl.fromTo(I+"mag",{autoAlpha:0,x:1080,y:740},{autoAlpha:1,x:966,y:520,duration:.5,ease:"power2.out"},{W60});
tl.to(I+"mag",{x:840,duration:.6,ease:"sine.inOut"},{W60}+.5);
tl.fromTo(I+"hl",{autoAlpha:0,scaleX:0,svgOrigin:"784 522"},{autoAlpha:.75,scaleX:1,duration:.35},{W60}+.35);
tl.fromTo(I+"note",{autoAlpha:0,scale:.3,svgOrigin:"712 476"},{autoAlpha:1,scale:1,duration:.35,ease:"back.out(2)"},{W60}+.6);
tl.to(I+"sc",{strokeDashoffset:0,duration:.35,ease:"none"},{W61});
tl.fromTo(I+"sct",{autoAlpha:0},{autoAlpha:1,duration:.15},{W61}+.1);
tl.fromTo(I+"stamp",{autoAlpha:0,scale:1.9,rotation:-10,svgOrigin:"963 671"},{autoAlpha:1,scale:1,rotation:-5,duration:.28,ease:"power3.in"},{W61}+.35);
tl.to(I+"card",{x:-4,y:3,duration:.05,repeat:3,yoyo:true},{W61}+.63);
tl.set(I+"mouth",{attr:{d:"M344 442 Q360 458 376 442"}},{W61}+.4);
tl.to(I+"eyesR",{scaleY:.15,svgOrigin:"365 401",duration:.07,repeat:1,yoyo:true},{W61}+.9);'''
b=[x for x in p['broll'] if x.get('from')==44][0]
b.update({"kind":"custom","html":html,"js":js,"sfx":[],"shift":360})
for k in ('chip','title','file'): b.pop(k,None)
json.dump(p,open(f,'w'),indent=1,ensure_ascii=False)
print(len(html))
