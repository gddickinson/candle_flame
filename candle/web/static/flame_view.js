// Candle viewport (port of canvas.py): animation loop, flicker-modulated light, orbit camera with mouse/touch drag,
// wheel and keyboard zoom, PNG save. Renders with WebGL (flame_gl.js); falls back to a 2-D canvas sketch of the
// particles when WebGL is unavailable.
import { animate, download } from './core.js';
import { CandleSim } from './flame_engine.js';
import { OrbitCamera, perspective, matmul } from './flame_camera.js';
import { buildCandleMeshes } from './flame_geometry.js';
import { GLRenderer } from './flame_gl.js';
import { flameColor } from './flame_shaders.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Project the particles of a system (y + 0.26 wick offset) with a row-major MVP and draw them as soft discs.
export function drawParticles2D(ctx, mvp, sys, { flame = true, w = ctx.canvas.width, h = ctx.canvas.height } = {}) {
  ctx.globalCompositeOperation = flame ? 'lighter' : 'source-over';
  for (let i = 0; i < sys.max_n; i++) {
    const life = sys.life[i];
    if (!(life > 0)) continue;
    const p = [sys.pos[3 * i], sys.pos[3 * i + 1] + 0.26, sys.pos[3 * i + 2], 1];
    const c = mvp.map(r => r[0] * p[0] + r[1] * p[1] + r[2] * p[2] + r[3]);
    if (c[3] <= 0.01) continue;
    const x = (c[0] / c[3] * 0.5 + 0.5) * w, y = (0.5 - c[1] / c[3] * 0.5) * h;
    const r = Math.max(0.5, sys.size[i] * h * (flame ? 0.8 : 1.2) / c[3]) / 2;
    const age = 1 - life / Math.max(sys.max_life[i], 0.001);
    let a, rgb;
    if (flame) {
      a = (age < 0.1 ? age / 0.1 : 1 - Math.min(1, Math.max(0, (age - 0.5) / 0.5))) * 0.85;
      rgb = flameColor(sys.temp[i]).map(v => Math.round(v * 255));
    } else { a = (1 - age) * (1 - age) * 0.12; rgb = [166, 158, 153]; }
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.globalCompositeOperation = 'source-over';
}

export class CandleView {
  // defaults: the /api/defaults payload (params, camera, ambient, candle_color)
  constructor(canvas, defaults, { onFps = null, label = 'Candle flame simulation' } = {}) {
    this.canvas = canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label + ' (drag or arrow keys to orbit, scroll or +/- to zoom)');
    this.sim = new CandleSim(defaults.params);
    this.camera = new OrbitCamera(defaults.camera);
    this.ambient = defaults.ambient;
    this.candleRgb = defaults.candle_color;
    this.paused = false; this.showSmoke = true; this.onFps = onFps;
    this.frames = [];
    try { this.gl = new GLRenderer(canvas, buildCandleMeshes(this.candleRgb)); } catch (e) {
      console.warn('WebGL unavailable, using the 2-D fallback:', e.message);
      this.ctx = canvas.getContext('2d');
    }
    this.bindInput();
  }

  bindInput() {
    const c = this.canvas;
    let last = null;
    c.addEventListener('pointerdown', e => { last = [e.clientX, e.clientY]; this.dragging = true; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      this.camera.rotate(e.clientX - last[0], e.clientY - last[1]); last = [e.clientX, e.clientY];
      if (!this.running) this.draw();
    });
    const up = () => { this.dragging = false; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', e => { e.preventDefault(); this.camera.zoom(e.deltaY); if (!this.running) this.draw(); }, { passive: false });
    c.addEventListener('keydown', e => {
      const k = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[e.key];
      if (k) this.camera.rotate(...k);
      else if (e.key === '+' || e.key === '=') this.camera.zoom(-120);
      else if (e.key === '-') this.camera.zoom(120);
      else return;
      e.preventDefault(); if (!this.running) this.draw();
    });
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  // One animation tick (canvas._tick): camera auto-rotate unless dragging, then the simulation step.
  tick(dt) {
    if (!this.dragging) this.camera.update(dt);
    if (!this.paused) this.sim.step(dt, this.showSmoke);
  }

  // Fast-forward the simulation (no drawing) so a page opens on a burning flame.
  warm(seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) this.sim.step(dt, this.showSmoke); }

  draw() {
    this.resize();
    const { width: w, height: h } = this.canvas;
    const proj = perspective(45, w / h, 0.01, 50.0), view = this.camera.viewMatrix(), eye = this.camera.eye;
    const eff = this.sim.effectiveIntensity();       // paintGL: flicker modulates the point light
    if (this.gl) {
      this.gl.render(view, proj, eye, this.sim.flame, this.sim.smoke, { lightInt: this.sim.lightIntensity(eff),
        ambient: this.ambient, showSmoke: this.showSmoke, candleColor: this.candleRgb });
    } else {
      const ctx = this.ctx, mvp = matmul(proj, view);
      ctx.fillStyle = 'rgb(5,4,3)'; ctx.fillRect(0, 0, w, h);
      drawParticles2D(ctx, mvp, this.sim.flame);
      if (this.showSmoke) drawParticles2D(ctx, mvp, this.sim.smoke, { flame: false });
    }
  }

  start() {
    let last = performance.now();
    this.running = true;
    const stop = animate(now => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      this.frames.push(now); while (this.frames[0] < now - 1000) this.frames.shift();
      if (this.onFps && this.frames.length > 1) this.onFps(this.frames.length);
      this.tick(dt); this.draw();
    });
    this.stop = () => { this.running = false; stop(); };
    return this.stop;
  }

  // Draws the first frame; animates unless the visitor prefers reduced motion.
  show() { this.draw(); if (!reduced()) this.start(); }

  screenshot() {
    this.draw();
    this.canvas.toBlob(b => download('candle_screenshot.png', b), 'image/png');
  }
}
