# Shared pieces for Dubuddy custom vector scenes (textures, grain, dust, comment CTA). Import from a clip's scenes.py:
#   import sys; sys.path.insert(0, os.path.expanduser("~/.agents/skills/dubuddy-short/references/scenes")); from common import *
import json, urllib.parse as u
I = '{ID}'
SK = "font-family:'Plus Jakarta Sans',sans-serif"
INK, OR, ORD, TEAL, GRN, RED, YEL = '#15131c', '#f26522', '#c94e15', '#2b6f77', '#2e9d57', '#e0362c', '#ffd34d'
NZ = "url(data:image/svg+xml," + u.quote("<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .25  0 0 0 0 .18  0 0 0 0 .12  0 0 0 -1.4 .5'/></filter><rect width='220' height='220' filter='url(#n)'/></svg>", safe="") + ")"
CARD = f"background:{NZ},linear-gradient(#ffffff,#fbf6ef);background-size:220px 220px,100% 100%;box-shadow:0 18px 44px rgba(0,0,0,.32),0 2px 0 rgba(255,255,255,.6) inset;"


def words(ed):
    """{word index: output start sec} and {index: end sec} from timeline.json"""
    tl = json.load(open(ed + '/timeline.json'))
    return {x['i']: x['s'] for x in tl['words']}, {x['i']: x['e'] for x in tl['words']}, tl


def defs():
    return f'''<defs>
<filter id="{I}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 .08  0 0 0 0 .06  0 0 0 0 .05  0 0 0 -1.6 1.05"/></filter>
<filter id="{I}paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .5  0 0 0 0 .42  0 0 0 0 .32  0 0 0 -2.4 .55" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="t"/><feBlend in="t" in2="SourceGraphic" mode="multiply"/></filter>
<filter id="{I}wood" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .22" numOctaves="3" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .35  0 0 0 0 .18  0 0 0 0 .08  0 0 0 -1.3 .55" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="t"/><feBlend in="t" in2="SourceGraphic" mode="multiply"/></filter>
<filter id="{I}plaster" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="4" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .55  0 0 0 0 .38  0 0 0 0 .25  0 0 0 -1.1 .3" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in" result="t"/><feBlend in="t" in2="SourceGraphic" mode="multiply"/></filter>
<filter id="{I}soft"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="{I}soft4"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="{I}shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#2a1a10" flood-opacity=".3"/></filter>
<filter id="{I}sh2" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#2a1a10" flood-opacity=".28"/></filter>
<pattern id="{I}gridp" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#9fb6d6" stroke-width="1.2" opacity=".55"/></pattern>
<pattern id="{I}lines" width="10" height="34" patternUnits="userSpaceOnUse"><rect y="33" width="10" height="1.6" fill="#9fb6d6" opacity=".8"/></pattern>
<linearGradient id="{I}wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8ead9"/><stop offset="1" stop-color="#efd8bd"/></linearGradient>
<radialGradient id="{I}vig" cx=".5" cy=".45" r=".78"><stop offset=".6" stop-color="#2a1608" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".22"/></radialGradient>
</defs>'''


POST = f'<rect width="1080" height="1920" fill="url(#{I}vig)"/><rect width="1080" height="1920" filter="url(#{I}grain)" opacity=".14" style="mix-blend-mode:multiply"/>'
WALL = f'<rect width="1080" height="1920" fill="url(#{I}wall)" filter="url(#{I}plaster)"/>'
FULLBG = '<div style="position:absolute;inset:0;background:#f6e7d4"></div>'


def svg(body):
    return f'<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;left:0;top:0;{SK}">{defs()}{body}</svg>'


def dust(n, x0, y0, w, h, col="#fff6c8"):
    return '<g>' + "".join(f'<circle id="{I}d{k}" cx="{x0 + (k * 137) % w}" cy="{y0 + (k * 89) % h}" r="{2 + k % 3}" fill="{col}" opacity="0"/>' for k in range(n)) + '</g>'


def dust_js(n):
    return f'for(var k=0;k<{n};k++){{tl.fromTo(I+"d"+k,{{y:0,opacity:0}},{{y:-60-(k%5)*14,opacity:.55,duration:1.7+(k%4)*.2,ease:"sine.out",repeat:Math.ceil({{D}}/1.7),yoyo:true,delay:(k%7)*.2}},{{S}});}}'


def card_rect(x, y, w, h, rx=26, fill="#fffdf7"):
    """paper card with soft shadow + paper texture"""
    return (f'<g filter="url(#{I}shadow)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"/></g>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" filter="url(#{I}paper)"/>')


def comment_cta(start, sfx_extra=(), text="Comment your doubt", end=None):
    """Chest comment pill for the last >=5 s (set plan.cta.comment=false). start/end = output sec (end: pass T + 1 so it
    holds through the tail frame). text: e.g. "Comment: kaunsa course?" (keep <= ~24 chars)."""
    s0 = start
    html = CTA_HTML.replace("Comment your doubt", text)
    js = CTA_JS.replace('tl.to(I+"cur",{x:460', f'tl.to(I+"cur",{{x:{round(460 * len(text) / 18)}')
    return {"display": "float", "kind": "custom", "html": html, "js": js, "start": round(s0, 3), "dur": round(end - s0, 3) if end else 30,
            "sfx": [["whoosh-short", s0, 0.25], ["pop", s0 + .2, 0.35], ["typing", s0 + .5, 0.2], ["bubble", s0 + 1.6, 0.16], ["bubble", s0 + 2.1, 0.14], ["bubble", s0 + 2.6, 0.12], *sfx_extra]}


CTA_HTML = f'''<div style="position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none;{SK}">
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
CTA_JS = '''var I="#{ID}";
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
[0,1,2].forEach(function(k){tl.fromTo(I+"qb"+k,{autoAlpha:0,y:0,scale:.5},{keyframes:[{autoAlpha:1,y:-60,scale:1,duration:.4},{y:-170,duration:.9},{autoAlpha:0,y:-230,duration:.35}],repeat:2,repeatDelay:.3,ease:"sine.out"},{S}+1.4+k*.5);});'''.replace("repeat:11", "repeat:12")


def iphone(idp, x, y, h, content):
    """Realistic iPhone 15 Pro mockup (user rule 2026-10-08: never a plain rounded rectangle).
    Titanium frame, side buttons, Dynamic Island, status bar (9:41, signal, wifi, battery), thin bezel, glass glare,
    home indicator, contact shadow. content(sx, sy, sw, sh) -> svg drawn inside the clipped screen; status bar sits on top
    (keep app content below sy + 0.13*w). Returns (svg, (sx, sy, sw, sh)). Wrap/animate the whole thing via id=I+idp."""
    w = h * 70.6 / 146.6
    br, fr = w * .165, w * .022            # body radius, frame band
    bz = w * .045                          # band + black bezel
    sx, sy, sw, sh = x + bz, y + bz, w - 2 * bz, h - 2 * bz
    sr = br - bz * .8
    P = f"{I}{idp}"
    btn = lambda bx, by, bh: f'<rect x="{bx:.1f}" y="{by:.1f}" width="{w * .02:.1f}" height="{bh:.1f}" rx="{w * .01:.1f}" fill="url(#{P}ti)"/>'
    # iOS status bar: time centred in the left "ear", one tight signal·wifi·battery cluster centred in the right ear,
    # everything vertically centred on the Dynamic Island (never pushed into the rounded screen corner)
    cy = sy + w * .0725                                   # island centre line
    H = w * .03                                           # icon cap height
    ear_l = (sx + w * .07, sx + sw / 2 - w * .145)
    ear_r = (sx + sw / 2 + w * .145, sx + sw - w * .07)
    # Combined status icon (user reference, 2026-10-08): ONE glyph replaces signal+wifi+battery —
    # ring = battery level (black part, rest grey, open at the bottom), wifi (dot + 2 arcs) inside,
    # 4 signal dots in the bottom gap (black = bars). Centred in the right ear, level with the island.
    import math
    R = w * .033
    rs = R * .21                                          # ring stroke
    icx, icy = (ear_r[0] + ear_r[1]) / 2, cy - w * .006
    pt = lambda deg, r: (icx + r * math.sin(math.radians(deg)), icy - r * math.cos(math.radians(deg)))
    def arcp(d0, d1, r):
        (x0_, y0_), (x1_, y1_) = pt(d0, r), pt(d1, r)
        return f"M{x0_:.1f} {y0_:.1f} A{r:.1f} {r:.1f} 0 {1 if d1 - d0 > 180 else 0} 1 {x1_:.1f} {y1_:.1f}"
    level = .8                                            # battery
    split = -128 + 256 * level
    ring = (f'<path d="{arcp(split, 128, R)}" stroke="#111" stroke-opacity=".32" stroke-width="{rs:.1f}" fill="none" stroke-linecap="round"/>'
            f'<path d="{arcp(-128, split, R)}" stroke="#111" stroke-width="{rs:.1f}" fill="none" stroke-linecap="round"/>')
    wcx, wcy = icx, icy + R * .27                         # wifi glyph's vertical middle sits on the ring centre
    wsw = R * .19
    wifi_in = "".join(f'<path d="M{wcx - r * .74:.1f} {wcy - r * .67:.1f} A{r:.1f} {r:.1f} 0 0 1 {wcx + r * .74:.1f} {wcy - r * .67:.1f}" stroke="#111" stroke-width="{wsw:.1f}" fill="none" stroke-linecap="round"/>'
                      for r in (R * .4, R * .72)) + (lambda rw: f'<path d="M{wcx:.1f} {wcy + R * .04:.1f} L{wcx - rw * .74:.1f} {wcy + R * .04 - rw * .67:.1f} A{rw:.1f} {rw:.1f} 0 0 1 {wcx + rw * .74:.1f} {wcy + R * .04 - rw * .67:.1f} Z" fill="#111" stroke="#111" stroke-width="{R * .077:.1f}" stroke-linejoin="round"/>')(R * .2)
    dots = "".join(f'<circle cx="{pt(180 + a_, R * 1.14)[0]:.1f}" cy="{pt(180 + a_, R * 1.14)[1]:.1f}" r="{R * .143:.1f}" fill="#111" fill-opacity="{1 if k < 2 else .32}"/>'
                   for k, a_ in enumerate((31, 10.5, -10.5, -31)))
    bars, wifi, batt = ring + wifi_in + dots, "", ""
    timex, timey = (ear_l[0] + ear_l[1]) / 2, cy + w * .0155
    svg = f'''<g id="{P}">
<defs><linearGradient id="{P}ti" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f5c58"/><stop offset=".08" stop-color="#cfccc6"/><stop offset=".5" stop-color="#9b9893"/><stop offset=".92" stop-color="#d8d5cf"/><stop offset="1" stop-color="#5a5753"/></linearGradient>
<linearGradient id="{P}gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".38" stop-color="#fff" stop-opacity=".05"/><stop offset=".39" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="{P}clip"><rect x="{sx:.1f}" y="{sy:.1f}" width="{sw:.1f}" height="{sh:.1f}" rx="{sr:.1f}"/></clipPath></defs>
<ellipse cx="{x + w / 2:.1f}" cy="{y + h + w * .03:.1f}" rx="{w * .46:.1f}" ry="{w * .05:.1f}" fill="#2a1608" opacity=".28" filter="url(#{I}soft)"/>
{btn(x - w * .012, y + h * .16, h * .045)}{btn(x - w * .012, y + h * .245, h * .075)}{btn(x - w * .012, y + h * .335, h * .075)}{btn(x + w - w * .008, y + h * .27, h * .11)}
<g filter="url(#{I}shadow)"><rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{br:.1f}" fill="url(#{P}ti)"/></g>
<rect x="{x + .8:.1f}" y="{y + .8:.1f}" width="{w - 1.6:.1f}" height="{h - 1.6:.1f}" rx="{br:.1f}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6"/>
<rect x="{x + fr:.1f}" y="{y + fr:.1f}" width="{w - 2 * fr:.1f}" height="{h - 2 * fr:.1f}" rx="{br - fr:.1f}" fill="#0a0a0c"/>
<g clip-path="url(#{P}clip)"><rect x="{sx:.1f}" y="{sy:.1f}" width="{sw:.1f}" height="{sh:.1f}" fill="#fff"/>{content(sx, sy, sw, sh)}
 <rect x="{sx:.1f}" y="{sy:.1f}" width="{sw:.1f}" height="{w * .13:.1f}" fill="#fff"/>
 <text x="{timex:.1f}" y="{timey:.1f}" text-anchor="middle" font-size="{w * .044:.1f}" font-weight="700" letter-spacing="-.3" fill="#111">9:41</text>{bars}{wifi}{batt}
 <rect x="{sx + sw / 2 - w * .17:.1f}" y="{sy + sh - w * .035:.1f}" width="{w * .34:.1f}" height="{w * .012:.1f}" rx="{w * .006:.1f}" fill="#111" opacity=".85"/>
 <rect x="{sx:.1f}" y="{sy:.1f}" width="{sw:.1f}" height="{sh:.1f}" fill="url(#{P}gl)" style="mix-blend-mode:screen"/></g>
<rect x="{sx + sw / 2 - w * .145:.1f}" y="{sy + w * .03:.1f}" width="{w * .29:.1f}" height="{w * .085:.1f}" rx="{w * .0425:.1f}" fill="#000"/>
<circle cx="{sx + sw / 2 + w * .1:.1f}" cy="{sy + w * .0725:.1f}" r="{w * .016:.1f}" fill="#16182a"/><circle cx="{sx + sw / 2 + w * .096:.1f}" cy="{sy + w * .068:.1f}" r="{w * .005:.1f}" fill="#4b5d8f" opacity=".8"/>
</g>'''
    return svg, (sx, sy, sw, sh)


def iphone_screen(x, y, h):
    """Screen geometry of iphone(x, y, h) without drawing it: (sx, sy, sw, sh, w). Content should start below sy + 0.13*w."""
    w = h * 70.6 / 146.6
    bz = w * .045
    return x + bz, y + bz, w - 2 * bz, h - 2 * bz, w


# ---------------------------------------------------------------- shared helpers (2026-10-12, from DJI 0859)
def pill(id_, cx, cy, txt, fs=26, fill=OR, col="#fff", pad=26, mono=True):
    """centred label pill inside an svg (id = I+id_)"""
    w = len(txt) * fs * (.68 if mono else .62) + pad * 2
    ff = "font-family:var(--mono),monospace;letter-spacing:.14em" if mono else "font-weight:900"
    return (f'<g id="{I}{id_}"><rect x="{cx - w / 2:.0f}" y="{cy - fs * .95:.0f}" width="{w:.0f}" height="{fs * 1.9:.0f}" rx="{fs * .95:.0f}" fill="{fill}" filter="url(#{I}sh2)"/>'
            f'<text x="{cx}" y="{cy + fs * .36:.0f}" text-anchor="middle" font-size="{fs}" style="{ff}" font-weight="800" fill="{col}">{txt}</text></g>')


def psvg(body, h=840):
    """split-panel svg (840 tall) with the shared defs"""
    return f'<svg width="1080" height="{h}" viewBox="0 0 1080 {h}" style="position:absolute;left:0;top:0;{SK}">{defs()}{body}</svg>'


def grain(h=1920):
    return f'<rect width="1080" height="{h}" filter="url(#{I}grain)" opacity=".14" style="mix-blend-mode:multiply"/>'


HEART = 'M12 21s-7.5-4.6-9.5-9.3C1 8 3.3 4.5 6.8 4.5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.5 0 5.8 3.5 4.3 7.2C19.5 16.4 12 21 12 21z'
COMMENTS_DEFAULT = [("Riya", "#e0362c", ["B.Com (H)", "chahiye, SRCC", "target hai!"]),
                    ("Aman", TEAL, ["BA Economics,", "Hindu College", "pakka!"]),
                    ("Sneha", "#6a4fc4", ["B.Sc CS ke liye", "kaunsa college", "best hai?"])]


def comment_cards(start, end, comments=COMMENTS_DEFAULT, tag="COMMENT KARO", likes=(128, 96, 74)):
    """DEFAULT comment push (user rule 2026-10-12): square sticker comment cards beside the head (left, right, left —
    never more than two on screen) under a pulsing tag pill, from the "comment mein batao" line until the platform
    Subscribe/Follow card (end = T - 1.25). comments = [(name, colour, [3 short lines ≤ 15 chars])]. Pair with
    comment_cta(...). Returns a float custom item."""
    CW, CH, CY = 294, 310, 236
    xs, rots = [60, 726, 60], [-4, 4, -3]
    cards = ""
    for k, (n, c, lines) in enumerate(comments[:3]):
        x, rot = xs[k], rots[k]
        cx, cy = x + CW / 2, CY + CH / 2
        tx = "".join(f'<text x="{x + 24}" y="{CY + 136 + m * 44}" font-size="35" font-weight="900" letter-spacing="-1" fill="{INK}">{ln}</text>' for m, ln in enumerate(lines))
        cards += (f'<g id="{I}c{k}"><g transform="rotate({rot} {cx} {cy})">'
                  f'<g filter="url(#{I}shadow)"><rect x="{x}" y="{CY}" width="{CW}" height="{CH}" rx="16" fill="#fff"/></g>'
                  f'<rect x="{x}" y="{CY}" width="{CW}" height="{CH}" rx="16" fill="#fff" stroke="{INK}" stroke-width="5"/>'
                  f'<path d="M{x} {CY + 16} a16 16 0 0 1 16 -16 h{CW - 32} a16 16 0 0 1 16 16 v6 h-{CW} z" fill="{OR}"/>'
                  f'<rect x="{x + 22}" y="{CY + 34}" width="56" height="56" rx="10" fill="{c}"/><text x="{x + 50}" y="{CY + 73}" text-anchor="middle" font-size="32" font-weight="900" fill="#fff">{n[0]}</text>'
                  f'<text x="{x + 92}" y="{CY + 58}" font-size="25" font-weight="800" fill="#4a4550">@{n.lower()}</text>'
                  f'<text x="{x + 92}" y="{CY + 86}" font-size="21" font-weight="600" fill="#8b8494">just now</text>{tx}'
                  f'<g id="{I}h{k}"><path transform="translate({x + 40} {CY + CH - 34}) scale(1.25) translate(-12 -12)" d="{HEART}" fill="#ff3040"/>'
                  f'<text x="{x + 64}" y="{CY + CH - 24}" font-size="27" font-weight="900" fill="#ff3040">{likes[k]}</text></g>'
                  f'<text x="{x + CW - 24}" y="{CY + CH - 24}" text-anchor="end" font-size="25" font-weight="800" fill="#8b8494">Reply</text></g></g>')
    html = svg(f'{cards}{pill("gk", 540, 226, tag, 24, fill=OR)}')
    ORG = [f"{xs[k] + CW / 2:.0f} {CY + CH / 2:.0f}" for k in range(3)]
    HO = [f"{xs[k] + 40} {CY + CH - 34}" for k in range(3)]
    js = (f'var ORG={json.dumps(ORG)},HO={json.dumps(HO)};' + '''var I="#{ID}";
tl.set([I+"gk",I+"c0",I+"c1",I+"c2",I+"h0",I+"h1",I+"h2"],{autoAlpha:0},0);
tl.fromTo(I+"gk",{autoAlpha:0,y:-20},{autoAlpha:1,y:0,duration:.3,ease:"back.out(2)"},{S});
tl.to(I+"gk",{scale:1.08,duration:.3,yoyo:true,repeat:7,ease:"sine.inOut",svgOrigin:"540 226"},{S}+.4);
var T0={S}+.15,step=({E}-{S}-.5)/3;
[0,1,2].forEach(function(k){var t=T0+k*step;
 tl.fromTo(I+"c"+k,{autoAlpha:0,scale:.4,rotation:(k==1?14:-14),svgOrigin:ORG[k]},{autoAlpha:1,scale:1,rotation:0,duration:.4,ease:"back.out(2)"},t);
 tl.to(I+"c"+k,{y:-8,duration:.6,yoyo:true,repeat:3,ease:"sine.inOut"},t+.45);
 tl.fromTo(I+"h"+k,{autoAlpha:0,scale:0,svgOrigin:HO[k]},{autoAlpha:1,scale:1,duration:.3,ease:"back.out(3)"},t+.45);
 tl.to(I+"h"+k,{scale:1.3,duration:.16,yoyo:true,repeat:1,svgOrigin:HO[k]},t+.8);});
tl.to(I+"c0",{autoAlpha:0,scale:.6,duration:.22,ease:"power2.in",svgOrigin:ORG[0]},T0+2*step-.25);
tl.to([I+"c1",I+"c2",I+"gk"],{autoAlpha:0,y:-50,duration:.22,ease:"power2.in"},{E}-.22);''')
    st = (end - start - .5) / 3
    return {"display": "float", "kind": "custom", "start": round(start, 3), "dur": round(end - start, 3), "z": 22, "html": html, "js": js,
            "sfx": [["whoosh-short", start, .2]] + [["bubble", start + .15 + k * st, .22] for k in range(3)] + [["ding", start + .6 + k * st, .14] for k in range(3)]}
