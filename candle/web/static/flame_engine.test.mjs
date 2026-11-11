// node flame_engine.test.mjs: the JS noise and particle engine against numbers from the Python package
// (tests/fixtures/flame_reference.json, written by scripts/make_js_fixtures.py from candle/web/reference.py).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rng } from './core.js';
import { fbm } from './flame_noise.js';
import { DEFAULT_PARAMS, FlameSystem, flickerMod } from './flame_engine.js';
import { runCase, compare } from './flame_reference.js';

const F = JSON.parse(readFileSync(new URL('../../../tests/fixtures/flame_reference.json', import.meta.url)));
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok  ', name); };

ok('mulberry32 stream equals reference.Mulberry32Rng', () => {
  const r = rng(1);
  F.mulberry32_seed1.forEach(v => assert.equal(r(), v));
});
ok('DEFAULT_PARAMS equal FlameParams defaults', () => assert.deepEqual({ ...DEFAULT_PARAMS }, F.params));
ok('flicker_mod', () => F.flicker.forEach(([t, fl, nz, v]) => assert.ok(Math.abs(flickerMod(t, fl, nz) - v) < 1e-15)));

const N = F.noise;
for (const [key, opts] of [['f64', [3, false]], ['f32', [3, true]], ['octaves5', [5, false]]]) {
  ok(`fbm (${key}) identical to noise.py on 200 points`, () => {
    let worst = 0;
    N.points.forEach(([x, y, z], i) => {
      const [X, Y, Z] = opts[1] ? [x, y, z].map(Math.fround) : [x, y, z];
      worst = Math.max(worst, Math.abs(fbm(X, Y, Z, ...opts) - N[key][i]));
    });
    assert.equal(worst, 0);
  });
}
ok('fbm stays in [0, 1] far from the origin', () => {
  const r = rng(9);
  for (let i = 0; i < 2000; i++) {
    const v = fbm(r() * 4e4 - 2e4, r() * 4e4 - 2e4, r() * 4e4 - 2e4);
    assert.ok(v >= 0 && v <= 1);
  }
});

for (const ref of F.cases) {
  const c = ref.case;
  ok(`case "${c.name}": ${c.steps} steps of CandleSim.step (dt ${c.dt.toFixed(4)}) match Python`, () => {
    const d = compare(ref, runCase(c));
    console.log(`      ${d.total} float32 values over ${d.snapshots} snapshots: ${d.differ} differ, max |JS - Python| ` +
      `${d.maxDiff.toExponential(2)}; flicker max diff ${d.effDiff.toExponential(2)}`);
    assert.ok(d.counts, 'alive counts differ');
    assert.ok(d.scalars < 1e-12 && d.effDiff < 1e-12, JSON.stringify(d));
    assert.ok(d.maxDiff < 1e-5, `state diverged: ${d.maxDiff}`);
  });
}

ok('emit only fills dead slots; update cools and kills', () => {
  const fs = new FlameSystem(10, rng(2));
  fs.emit(15, 0.7, 0, 0);
  assert.equal(fs.alive(), 10);
  const t0 = Float32Array.from(fs.temp);
  fs.update(0.016, 0.7, 0, 0, 0.5);
  fs.temp.forEach((t, i) => assert.ok(t <= t0[i]));
  for (let i = 0; i < 100; i++) fs.update(0.016, 0.7, 0, 0, 0.5);
  assert.equal(fs.alive(), 0);
});

console.log(`flame_engine: ${n} tests passed`);
