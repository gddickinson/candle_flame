// Verify page: replays the seeded Python reference runs (candle/web/reference.py) with the JS engine in this browser
// and compares every float32 particle value; draws the final Python and JS particle states side by side.
import { route, api, app, list, esc } from './core.js';
import { runCase, compare, decodeF32, FLAME_FIELDS, SMOKE_FIELDS } from './flame_reference.js';
import { drawParticles2D } from './flame_view.js';
import { OrbitCamera, perspective, matmul } from './flame_camera.js';

const sysFrom = (snap, fields, n) => ({ max_n: n, ...Object.fromEntries(fields.map(k => [k, snap[k]])) });

function drawPair(canvas, snap, maxN) {
  const ctx = canvas.getContext('2d'), cam = new OrbitCamera({ phi: Math.PI * 0.45, distance: 0.9 });
  ctx.fillStyle = 'rgb(5,4,3)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const mvp = matmul(perspective(45, canvas.width / canvas.height, 0.01, 50), cam.viewMatrix());
  drawParticles2D(ctx, mvp, sysFrom(snap.flame, FLAME_FIELDS, maxN[0]));
  drawParticles2D(ctx, mvp, sysFrom(snap.smoke, SMOKE_FIELDS, maxN[1]), { flame: false });
}

route('verify', async () => {
  const runs = await api('/reference');
  app().innerHTML = `
  <h1 class="glow">Python vs JavaScript</h1>
  <p class="lead">The browser candle is a port of <code>particles.py</code>, <code>noise.py</code> and
  <code>simulation.py</code>. Each reference run below was computed by the Python package with seeded random streams
  (mulberry32, the generator in <code>core.js</code>, swapped in for NumPy's), then replayed here by the JavaScript
  engine with the same seeds. The particle arrays are float32 in both, so they are compared value by value.</p>
  <div id="runs">${list(runs, r => `<section class="panel" id="run-${esc(r.name)}"><h2>${esc(r.name)}</h2>
    <p class="mute">Running ${r.steps} steps...</p></section>`)}</div>`;
  for (const r of runs) {
    const ref = await api('/reference/' + r.name), c = ref.case;
    const t0 = performance.now(), js = runCase(c), ms = performance.now() - t0, d = compare(ref, js);
    const good = d.counts && d.maxDiff < 1e-5;
    const last = ref.snapshots.length - 1, pySnap = ref.snapshots[last], jsSnap = js.snapshots[last];
    const decoded = { flame: Object.fromEntries(FLAME_FIELDS.map(k => [k, decodeF32(pySnap.flame[k])])),
      smoke: Object.fromEntries(SMOKE_FIELDS.map(k => [k, decodeF32(pySnap.smoke[k])])) };
    const changes = Object.entries(c.changes).map(([s, ch]) => `step ${s}: ${Object.entries(ch).map(([k, v]) => `${k} = ${v}`).join(', ')}`);
    document.getElementById('run-' + r.name).innerHTML = `<h2>${esc(c.name)}</h2>
      <div class="vrun">
        <div class="pair">
          <figure><canvas width="300" height="420" id="py-${esc(c.name)}"></canvas><figcaption>Python, step ${pySnap.step}</figcaption></figure>
          <figure><canvas width="300" height="420" id="js-${esc(c.name)}"></canvas><figcaption>JavaScript, step ${jsSnap.step}</figcaption></figure>
        </div>
        <div class="scroll"><table>
          <tr><th>Steps, dt</th><td>${c.steps} × ${c.dt.toFixed(4)} s (snapshots every ${c.snap_every})</td></tr>
          <tr><th>Parameters</th><td class="mono">${esc(JSON.stringify(c.params))}${changes.length ? '<br>' + esc(changes.join('; ')) : ''}</td></tr>
          <tr><th>Seeds (flame, smoke, flicker)</th><td>${c.seeds.join(', ')}</td></tr>
          <tr><th>Alive at the end (flame, smoke)</th><td>Python ${pySnap.alive.join(', ')} · JS ${jsSnap.alive.join(', ')}</td></tr>
          <tr><th>float32 values compared</th><td>${d.total.toLocaleString()}</td></tr>
          <tr><th>Values that differ</th><td>${d.differ}</td></tr>
          <tr><th>Max |JS − Python|</th><td>${d.maxDiff.toExponential(2)}</td></tr>
          <tr><th>Flicker intensity max diff</th><td>${d.effDiff.toExponential(2)}</td></tr>
          <tr><th>JS run time</th><td>${ms.toFixed(0)} ms</td></tr>
          <tr><th>Verdict</th><td class="${good ? 'ok' : 'err'}">${good ? (d.differ ? 'match (within float32 rounding)' : 'identical') : 'DIFFERENT'}</td></tr>
        </table></div>
      </div>`;
    const maxN = [c.params.max_particles || 800, c.params.max_smoke || 120];
    drawPair(document.getElementById('py-' + c.name), decoded, maxN);
    drawPair(document.getElementById('js-' + c.name), jsSnap, maxN);
  }
});
