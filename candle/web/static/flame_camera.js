// JS port of candle/camera.py: spherical orbit camera, perspective and look-at matrices (row-major 4x4 as nested
// arrays, like the numpy code), plus the small matrix helpers the WebGL renderer needs.
const f = Math.fround;

export class OrbitCamera {
  constructor(o = {}) {
    Object.assign(this, { theta: 0.0, phi: Math.PI * 0.35, distance: 1.2, target_y: 0.22, auto_rotate: true,
      auto_speed: 0.15, min_phi: 0.15, max_phi: Math.PI * 0.48, min_dist: 0.4, max_dist: 3.5 }, o);
  }
  rotate(dx, dy) {                                   // mouse drag (pixels)
    this.theta -= dx * 0.008;
    this.phi = Math.max(this.min_phi, Math.min(this.max_phi, this.phi + dy * 0.006));
  }
  zoom(delta) { this.distance = Math.max(this.min_dist, Math.min(this.max_dist, this.distance + delta * 0.001)); }
  update(dt) { if (this.auto_rotate) this.theta += this.auto_speed * dt; }
  get eye() {                                        // float32 like the numpy array
    const r = this.distance, sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    return [r * sp * Math.sin(this.theta), this.target_y + r * cp, r * sp * Math.cos(this.theta)].map(f);
  }
  get target() { return [0, f(this.target_y), 0]; }
  viewMatrix() { return lookAt(this.eye, this.target, [0, 1, 0]); }
}

export function perspective(fovDeg, aspect, near, far) {
  const F = 1.0 / Math.tan((fovDeg * Math.PI / 180) / 2);
  const m = zeros();
  m[0][0] = F / aspect; m[1][1] = F;
  m[2][2] = (far + near) / (near - far); m[2][3] = (2 * far * near) / (near - far); m[3][2] = -1.0;
  return m.map(r => r.map(f));
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) + 1e-10; return a.map(v => v / l); };

export function lookAt(eye, target, up) {
  const fw = norm(sub(target, eye)), s = norm(cross(fw, up)), u = cross(s, fw);
  const m = identity();
  m[0] = [...s, -dot(s, eye)]; m[1] = [...u, -dot(u, eye)]; m[2] = [...fw.map(v => -v), dot(fw, eye)];
  return m.map(r => r.map(f));
}

export const zeros = () => [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
export const identity = () => [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => +(i === j)));
export const matmul = (a, b) => a.map((r, i) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
// Row-major -> column-major Float32Array for WebGL (numpy: mvp.T)
export const toGL = m => new Float32Array([0, 1, 2, 3].flatMap(j => [0, 1, 2, 3].map(i => m[i][j])));
