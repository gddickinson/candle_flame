// Replays a seeded reference run (candle/web/reference.py) with the JS engine and compares it with the Python
// snapshots. Used by the Verify page and by flame_engine.test.mjs.
import { rng } from './core.js';
import { CandleSim } from './flame_engine.js';

export const FLAME_FIELDS = ['pos', 'vel', 'life', 'max_life', 'temp', 'size'];
export const SMOKE_FIELDS = ['pos', 'vel', 'life', 'max_life', 'size'];

// base64 little-endian float32 -> Float32Array
export function decodeF32(b64) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

export function makeSim(c) {
  const [fs, ss, fl] = c.seeds;
  return new CandleSim(c.params, { flame: rng(fs), smoke: rng(ss), flicker: rng(fl) });
}

const copy = (sys, fields) => Object.fromEntries(fields.map(k => [k, Float32Array.from(sys[k])]));

// Run case c in JS; snapshots hold Float32Array copies of the particle arrays.
export function runCase(c, { steps = c.steps } = {}) {
  const sim = makeSim(c), snapshots = [], eff = [];
  for (let i = 0; i < steps; i++) {
    Object.assign(sim.params, c.changes[String(i)] || {});
    eff.push(sim.step(c.dt, c.show_smoke));
    if ((i + 1) % c.snap_every === 0) {
      snapshots.push({ step: i + 1, time: sim.time, emit_accum: sim.emit_accum, smoke_accum: sim.smoke_accum,
        alive: [sim.flame.alive(), sim.smoke.alive()],
        flame: copy(sim.flame, FLAME_FIELDS), smoke: copy(sim.smoke, SMOKE_FIELDS) });
    }
  }
  return { sim, snapshots, eff };
}

// Compare JS snapshots with the Python ones (base64). Returns max |diff|, the number of float32 values that differ
// at all, the total compared, and whether the alive counts and scalar state agree.
export function compare(ref, js) {
  let maxDiff = 0, differ = 0, total = 0, counts = true, scalars = 0;
  ref.snapshots.forEach((rs, k) => {
    const s = js.snapshots[k];
    counts = counts && s.alive[0] === rs.alive[0] && s.alive[1] === rs.alive[1];
    for (const key of ['time', 'emit_accum', 'smoke_accum']) scalars = Math.max(scalars, Math.abs(s[key] - rs[key]));
    for (const [sys, fields] of [['flame', FLAME_FIELDS], ['smoke', SMOKE_FIELDS]]) {
      for (const fld of fields) {
        const a = decodeF32(rs[sys][fld]), b = s[sys][fld];
        for (let i = 0; i < a.length; i++) {
          const d = Math.abs(a[i] - b[i]);
          if (d > 0) { differ++; if (d > maxDiff) maxDiff = d; }
        }
        total += a.length;
      }
    }
  });
  const effDiff = Math.max(...ref.eff.map((v, i) => Math.abs(v - js.eff[i])));
  return { maxDiff, differ, total, counts, scalars, effDiff, snapshots: ref.snapshots.length };
}
