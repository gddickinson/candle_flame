// node flame_engine.test.mjs: the JS noise and particle engine against numbers from the Python package
// (tests/fixtures/flame_reference.json, written by scripts/make_js_fixtures.py from candle/web/reference.py).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rng } from './core.js';
import { fbm } from './flame_noise.js';
import { CandleSim, DEFAULT_PARAMS, FlameSystem, flickerMod } from './flame_engine.js';
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

ok('Blow Out (intensity 0) extinguishes the flame; raising the intensity relights it', () => {
  const sim = new CandleSim({}, { flame: rng(1), smoke: rng(2), flicker: rng(3) });
  const burn = s => { for (let i = 0; i < Math.round(s * 60); i++) sim.step(1 / 60); };
  burn(1); assert.ok(sim.flame.alive() > 50);
  sim.params.intensity = 0;
  assert.equal(sim.effectiveIntensity(), 0);
  burn(1); assert.equal(sim.flame.alive(), 0, 'flame still burning after Blow Out');
  sim.params.intensity = 0.7;
  burn(0.5); assert.ok(sim.flame.alive() > 50, 'did not relight');
  const low = new CandleSim({ intensity: 0.01, flicker: 1 }, { flicker: () => 0 });
  assert.equal(low.effectiveIntensity(), 0.05);
});

ok('light and glow: unchanged while lit, fade to 0 after Blow Out, return on relight', () => {
  const sim = new CandleSim({}, { flame: rng(1), smoke: rng(2), flicker: rng(3) });
  const burn = s => { for (let i = 0; i < Math.round(s * 60); i++) sim.step(1 / 60); };
  burn(0.5);
  let eff = sim.effectiveIntensity();
  assert.equal(sim.lightIntensity(eff), 1.0 + eff * 1.5);
  sim.params.intensity = 0; burn(0.3);
  const mid = sim.lightIntensity(sim.effectiveIntensity());
  assert.ok(mid > 0 && mid < 1, String(mid));
  burn(0.7); assert.equal(sim.lightIntensity(sim.effectiveIntensity()), 0);
  sim.params.intensity = 0.7; burn(1);
  eff = sim.effectiveIntensity();
  assert.equal(sim.lightIntensity(eff), 1.0 + eff * 1.5);
});

console.log(`flame_engine: ${n} tests passed`);
