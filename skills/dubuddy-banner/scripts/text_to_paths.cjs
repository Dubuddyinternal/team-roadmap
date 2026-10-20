// Converts text to Lottie bezier shapes from the font's glyph outlines.
// usage: node text_to_paths.cjs '<json request>'
//   request: {font, size, text, tracking (1/1000 em), j (0 left, 1 right, 2 center)}
// prints: [{v, i, o, c}, ...] in coordinates relative to the baseline origin.
const path = require('path');
// opentype.js is installed in the banner project by setup_project.sh; also look next to this script
const opentype = require(require.resolve('opentype.js', { paths: [process.cwd(), path.join(process.cwd(), 'tools'), __dirname] }));
const req = JSON.parse(process.argv[2]);

const font = opentype.loadSync(req.font);
const scale = req.size / font.unitsPerEm;
const glyphs = [...req.text].map(ch => font.charToGlyph(ch));
const track = (req.tracking || 0) / 1000 * req.size;
const total = glyphs.reduce((a, g) => a + g.advanceWidth * scale, 0) + track * (glyphs.length - 1);
let x = req.j === 1 ? -total : req.j === 2 ? -total / 2 : 0;

const r = n => Math.round(n * 100) / 100;
const shapes = [];
for (const g of glyphs) {
  let cur = null, prev = null;
  const add = (pt, inT) => { cur.v.push(pt); cur.i.push(inT); cur.o.push([0, 0]); prev = pt; };
  const close = () => {
    if (!cur) return;
    const n = cur.v.length, a = cur.v[0], b = cur.v[n - 1];
    if (n > 1 && Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3) {
      cur.i[0] = cur.i[n - 1]; cur.v.pop(); cur.i.pop(); cur.o.pop();
    }
    if (cur.v.length > 1) shapes.push({ c: true, v: cur.v.map(q => q.map(r)), i: cur.i.map(q => q.map(r)), o: cur.o.map(q => q.map(r)) });
    cur = null;
  };
  const curve = (c1, c2, pt) => {
    cur.o[cur.o.length - 1] = [c1[0] - prev[0], c1[1] - prev[1]];
    add(pt, [c2[0] - pt[0], c2[1] - pt[1]]);
  };
  for (const c of g.getPath(x, 0, req.size).commands) {
    if (c.type === 'M') { close(); cur = { v: [], i: [], o: [] }; add([c.x, c.y], [0, 0]); }
    else if (c.type === 'L') add([c.x, c.y], [0, 0]);
    else if (c.type === 'Q') {
      const q = [c.x1, c.y1], pt = [c.x, c.y];
      curve([prev[0] + 2 / 3 * (q[0] - prev[0]), prev[1] + 2 / 3 * (q[1] - prev[1])],
            [pt[0] + 2 / 3 * (q[0] - pt[0]), pt[1] + 2 / 3 * (q[1] - pt[1])], pt);
    } else if (c.type === 'C') curve([c.x1, c.y1], [c.x2, c.y2], [c.x, c.y]);
    else if (c.type === 'Z') close();
  }
  close();
  x += g.advanceWidth * scale + track;
}
process.stdout.write(JSON.stringify(shapes));
