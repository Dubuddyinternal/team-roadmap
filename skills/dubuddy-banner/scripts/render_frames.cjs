// Renders Lottie frames to PNG with CanvasKit Skottie (same engine as the official Lottie player).
// usage: node render_frames.cjs <dir containing lottie.json> <outDir> frame [frame...]
// env: SCALE (default 2), PAD (zero-pad width of the frame number in file names)
const fs = require('fs'), path = require('path');
// CanvasKit (full build, includes Skottie) from the banner project, the Lottie player project, or next to this script
const CK_JS = require.resolve('canvaskit-wasm/bin/full/canvaskit.js',
  { paths: [process.cwd(), path.join(process.cwd(), 'lottie-player'), __dirname] });
const CKInit = require(CK_JS);
const [scene, out, ...frames] = process.argv.slice(2);
CKInit({ locateFile: f => path.join(path.dirname(CK_JS), f) }).then(CK => {
  const json = fs.readFileSync(path.join(scene, 'lottie.json'), 'utf8');
  const assets = {};
  for (const f of fs.readdirSync(scene)) if (/\.(ttf|otf|ttc|png|jpg|svg)$/i.test(f)) assets[f] = fs.readFileSync(path.join(scene, f)).buffer;
  const anim = CK.MakeManagedAnimation(json, assets);
  const { w, h } = JSON.parse(json);
  const S = +(process.env.SCALE || 2), surf = CK.MakeSurface(w * S, h * S), cv = surf.getCanvas();
  for (const fr of frames) {
    cv.clear(CK.TRANSPARENT); anim.seekFrame(+fr);
    anim.render(cv, CK.LTRBRect(0, 0, w * S, h * S));
    const img = surf.makeImageSnapshot();
    fs.writeFileSync(path.join(out, `f${String(fr).padStart(process.env.PAD ? +process.env.PAD : (fr >= 1000 ? 4 : 3), '0')}.png`), img.encodeToBytes()); img.delete();
  }
  console.log('rendered', frames.join(' '));
});
