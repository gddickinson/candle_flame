// JS port of candle/particles.py (FlameSystem, SmokeSystem, FlameParams) and candle/simulation.py (CandleSim).
// The Python state lives in float32 numpy arrays; here Float32Arrays, with Math.fround wherever numpy computes in
// float32 (float32 array op Python scalar -> the scalar is cast to float32 first, NumPy 2 / NEP 50), so a seeded
// run reproduces the Python one (node tests: flame_engine.test.mjs). Comments name the Python expression.
import { fbm } from './flame_noise.js';

const f = Math.fround;
export const DEFAULT_PARAMS = Object.freeze({
  intensity: 0.7, wind_x: 0.0, wind_z: 0.0, turbulence: 0.5, flicker: 0.5,
  max_particles: 800, max_smoke: 120, emit_rate: 12.0, smoke_rate: 1.5,
});
const F02 = f(0.2), F08 = f(0.8), F015 = f(0.15), F097 = f(0.97), F099 = f(0.99);
const F002 = f(0.02), F004 = f(0.04), F001 = f(0.01), F006 = f(0.06);

// n draws of rng.uniform(lo, hi, n): low + (high - low) * random()
const uniform = (rand, lo, hi, n) => Array.from({ length: n }, () => lo + (hi - lo) * rand());

function deadSlots(life, n) {
  const out = [];
  for (let i = 0; i < life.length && out.length < n; i++) if (life[i] <= 0) out.push(i);
  return out;
}

// life -= dt for the alive particles; returns the indices still alive (others set to 0).
function age(life, dt) {
  const fdt = f(dt), idx = [];
  for (let i = 0; i < life.length; i++) {
    if (!(life[i] > 0)) continue;
    life[i] = f(life[i] - fdt);
    if (life[i] > 0) idx.push(i); else life[i] = 0;
  }
  return idx;
}

class Pool {
  constructor(maxN, rand) {
    this.max_n = maxN; this.rand = rand;
    this.pos = new Float32Array(maxN * 3); this.vel = new Float32Array(maxN * 3);
    this.life = new Float32Array(maxN); this.max_life = new Float32Array(maxN); this.size = new Float32Array(maxN);
  }
  alive() { let n = 0; for (const l of this.life) n += l > 0; return n; }
}

export class FlameSystem extends Pool {
  constructor(maxN = 800, rand = Math.random) { super(maxN, rand); this.temp = new Float32Array(maxN); this.time = 0; }

  emit(count, intensity, wx, wz) {
    const idx = deadSlots(this.life, count), n = idx.length, R = this.rand;
    if (!n) return;
    const ang = uniform(R, 0, 2 * Math.PI, n), spr = uniform(R, 0, 0.015, n).map(v => v * intensity);
    const up = uniform(R, 0, 0.6, n).map(v => (0.8 + v) * intensity);
    const vx = uniform(R, -0.04, 0.04, n), vz = uniform(R, -0.04, 0.04, n);
    const lf = uniform(R, 0, 0.5, n), tp = uniform(R, 0, 0.1, n), sz = uniform(R, 0, 0.025, n);
    idx.forEach((i, k) => {
      this.pos[3 * i] = Math.cos(ang[k]) * spr[k]; this.pos[3 * i + 1] = 0; this.pos[3 * i + 2] = Math.sin(ang[k]) * spr[k];
      this.vel[3 * i] = vx[k] + wx * 0.1; this.vel[3 * i + 1] = up[k]; this.vel[3 * i + 2] = vz[k] + wz * 0.1;
      this.life[i] = this.max_life[i] = 0.4 + lf[k];
      this.temp[i] = 0.9 + tp[k];
      this.size[i] = (0.02 + sz[k]) * intensity;
    });
  }

  update(dt, intensity, wx, wz, turbulence) {
    this.time += dt;
    const idx = age(this.life, dt);
    if (!idx.length) return;
    const P = this.pos, V = this.vel, t = this.time, ts = f(3.0 * turbulence), fdt = f(dt);
    const t15 = f(t * 1.5), t13 = f(t * 1.3), t08 = f(t * 0.8), wx3 = f(wx * 0.3), wz3 = f(wz * 0.3);
    const cool = f(dt * 1.2), fint = f(intensity);
    for (const i of idx) {
      const px = P[3 * i], py = P[3 * i + 1], pz = P[3 * i + 2];
      const X = f(px * ts), Y = f(py * ts), Z = f(pz * ts);
      // 3-D turbulent noise
      const nx = fbm(f(X + t15), Y, Z, 3, true) - 0.5;
      const nz = fbm(X, f(Y + t13), f(Z + 7), 3, true) - 0.5;
      const ny = fbm(f(X + 3), f(Y + t08), Z, 3, true) - 0.5;
      const hw = f(1 + f(py * 2.0));                           // wind stronger at height
      V[3 * i] = (nx * 2.5 * turbulence + f(wx3 * hw)) * dt + V[3 * i];
      V[3 * i + 1] = (0.5 * intensity + ny * 0.5 * turbulence) * dt + V[3 * i + 1];
      V[3 * i + 2] = (nz * 2.5 * turbulence + f(wz3 * hw)) * dt + V[3 * i + 2];
      for (let k = 0; k < 3; k++) V[3 * i + k] = V[3 * i + k] * F097;   // drag (Float32Array store rounds)
      if (py < F015) {                                         // base cohesion
        const pull = f(F08 * f(1 - f(py / F015)));
        V[3 * i] = V[3 * i] - f(f(f(px * pull) * fdt) * 10);
        V[3 * i + 2] = V[3 * i + 2] - f(f(f(pz * pull) * fdt) * 10);
      }
      for (let k = 0; k < 3; k++) P[3 * i + k] = P[3 * i + k] + f(V[3 * i + k] * fdt);
      // temperature: cool with age, faster near the edges (old px, pz as in Python)
      const dist = f(Math.sqrt(f(f(px * px) + f(pz * pz))));
      this.temp[i] = Math.max(0, f(this.temp[i] - f(cool * f(1 + f(dist * 8)))));
      // size: grow then shrink
      const a = f(1 - f(this.life[i] / this.max_life[i]));
      const curve = a < F02 ? f(a / F02) : f(1 - f(f(a - F02) / F08));
      this.size[i] = f(f(F002 + f(curve * F004)) * fint);
    }
  }
}

export class SmokeSystem extends Pool {
  emit(count, flameH, wx, wz) {
    const idx = deadSlots(this.life, count), n = idx.length, R = this.rand;
    if (!n) return;
    const ang = uniform(R, 0, 2 * Math.PI, n), r = uniform(R, 0, 0.01, n), py = uniform(R, 0, 0.05, n);
    const vx = uniform(R, -0.025, 0.025, n), vy = uniform(R, 0, 0.1, n), vz = uniform(R, -0.025, 0.025, n);
    const lf = uniform(R, 0, 1.5, n), sz = uniform(R, 0, 0.02, n);
    idx.forEach((i, k) => {
      this.pos[3 * i] = Math.cos(ang[k]) * r[k] + wx * 0.02;
      this.pos[3 * i + 1] = flameH * 0.8 + py[k];
      this.pos[3 * i + 2] = Math.sin(ang[k]) * r[k] + wz * 0.02;
      this.vel[3 * i] = wx * 0.15 + vx[k]; this.vel[3 * i + 1] = 0.15 + vy[k]; this.vel[3 * i + 2] = wz * 0.15 + vz[k];
      this.life[i] = this.max_life[i] = 1.5 + lf[k];
      this.size[i] = 0.01 + sz[k];
    });
  }

  update(dt, wx, wz) {
    const idx = age(this.life, dt);
    if (!idx.length) return;
    const P = this.pos, V = this.vel, fdt = f(dt);
    const ax = f(wx * 0.05 * dt), ay = f(0.02 * dt), az = f(wz * 0.05 * dt);
    for (const i of idx) {
      V[3 * i] = f(V[3 * i] + ax); V[3 * i + 1] = f(V[3 * i + 1] + ay); V[3 * i + 2] = f(V[3 * i + 2] + az);
      for (let k = 0; k < 3; k++) { V[3 * i + k] = V[3 * i + k] * F099; P[3 * i + k] = P[3 * i + k] + f(V[3 * i + k] * fdt); }
      const a = f(1 - f(this.life[i] / this.max_life[i]));
      this.size[i] = f(F001 + f(a * F006));
    }
  }
}

// simulation.flicker_mod
export function flickerMod(tMs, flicker, noise) {
  return 1.0 + (Math.sin(tMs * 0.008) * 0.1 + Math.sin(tMs * 0.019) * 0.07 + Math.sin(tMs * 0.037) * 0.05 +
    (noise - 0.5) * 0.15) * flicker;
}

// simulation.CandleSim: rands = { flame, smoke, flicker } random() functions (seeded for reference runs).
export class CandleSim {
  constructor(params = {}, rands = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.flame = new FlameSystem(this.params.max_particles, rands.flame || Math.random);
    this.smoke = new SmokeSystem(this.params.max_smoke, rands.smoke || Math.random);
    this.random = rands.flicker || Math.random;
    this.time = 0; this.emit_accum = 0; this.smoke_accum = 0;
  }

  effectiveIntensity() {
    const p = this.params;
    return Math.max(0.05, p.intensity * flickerMod(this.time * 1000, p.flicker, this.random()));
  }

  step(dt, showSmoke = true) {
    this.time += dt;
    const p = this.params, eff = this.effectiveIntensity(), wx = p.wind_x, wz = p.wind_z;
    this.emit_accum += p.emit_rate * eff * dt * 30;
    while (this.emit_accum >= 1) { this.flame.emit(1, eff, wx, wz); this.emit_accum -= 1; }
    if (showSmoke) {
      this.smoke_accum += p.smoke_rate * dt * 30;
      while (this.smoke_accum >= 1) { this.smoke.emit(1, 0.25 * eff, wx, wz); this.smoke_accum -= 1; }
    }
    this.flame.update(dt, eff, wx, wz, p.turbulence);
    this.smoke.update(dt, wx, wz);
    return eff;
  }
}
