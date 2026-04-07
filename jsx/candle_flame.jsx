import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

const MAX_PARTICLES = 800;
const MAX_SMOKE = 120;
const EMIT_RATE = 12; // particles per frame
const SMOKE_RATE = 1.5;

// ═══════════════════════════════════════════════════════════════════════
// SIMPLE NOISE (for flame turbulence)
// ═══════════════════════════════════════════════════════════════════════

function hash(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 1274126177;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h ^ (h >> 16)) / 2147483648;
}

function smoothNoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);

  const n000 = hash(ix, iy, iz), n100 = hash(ix + 1, iy, iz);
  const n010 = hash(ix, iy + 1, iz), n110 = hash(ix + 1, iy + 1, iz);
  const n001 = hash(ix, iy, iz + 1), n101 = hash(ix + 1, iy, iz + 1);
  const n011 = hash(ix, iy + 1, iz + 1), n111 = hash(ix + 1, iy + 1, iz + 1);

  return (
    n000 * (1-sx)*(1-sy)*(1-sz) + n100 * sx*(1-sy)*(1-sz) +
    n010 * (1-sx)*sy*(1-sz) + n110 * sx*sy*(1-sz) +
    n001 * (1-sx)*(1-sy)*sz + n101 * sx*(1-sy)*sz +
    n011 * (1-sx)*sy*sz + n111 * sx*sy*sz
  );
}

function fbm(x, y, z, octaves = 3) {
  let val = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq, z * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / total;
}

// ═══════════════════════════════════════════════════════════════════════
// FLAME PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════════════════

class FlameSystem {
  constructor() {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = new Float32Array(MAX_PARTICLES * 3);
    this.lifetimes = new Float32Array(MAX_PARTICLES);   // 0 = dead
    this.maxLifes = new Float32Array(MAX_PARTICLES);
    this.temps = new Float32Array(MAX_PARTICLES);       // 1 = hottest
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.count = 0;
    this.time = 0;
  }

  emit(count, intensity, windX, windZ) {
    for (let i = 0; i < count; i++) {
      let idx = -1;
      for (let j = 0; j < MAX_PARTICLES; j++) {
        if (this.lifetimes[j] <= 0) { idx = j; break; }
      }
      if (idx < 0) break;

      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * 0.015 * intensity;
      const j3 = idx * 3;

      this.positions[j3] = Math.cos(angle) * spread;
      this.positions[j3 + 1] = 0;
      this.positions[j3 + 2] = Math.sin(angle) * spread;

      const upSpeed = (0.8 + Math.random() * 0.6) * intensity;
      this.velocities[j3] = (Math.random() - 0.5) * 0.08 + windX * 0.1;
      this.velocities[j3 + 1] = upSpeed;
      this.velocities[j3 + 2] = (Math.random() - 0.5) * 0.08 + windZ * 0.1;

      const life = 0.4 + Math.random() * 0.5;
      this.lifetimes[idx] = life;
      this.maxLifes[idx] = life;
      this.temps[idx] = 0.9 + Math.random() * 0.1;
      this.sizes[idx] = (0.02 + Math.random() * 0.025) * intensity;
      this.count = Math.max(this.count, idx + 1);
    }
  }

  update(dt, intensity, windX, windZ, turbulence) {
    this.time += dt;
    const t = this.time;

    for (let i = 0; i < this.count; i++) {
      if (this.lifetimes[i] <= 0) continue;

      this.lifetimes[i] -= dt;
      if (this.lifetimes[i] <= 0) { this.lifetimes[i] = 0; continue; }

      const i3 = i * 3;
      const lifeFrac = this.lifetimes[i] / this.maxLifes[i];
      const age = 1 - lifeFrac;
      const px = this.positions[i3];
      const py = this.positions[i3 + 1];
      const pz = this.positions[i3 + 2];

      // Turbulence from noise field
      const turbScale = 3.0 * turbulence;
      const nx = fbm(px * turbScale + t * 1.5, py * turbScale, pz * turbScale) - 0.5;
      const nz = fbm(px * turbScale, py * turbScale + t * 1.3, pz * turbScale + 7) - 0.5;
      const ny = fbm(px * turbScale + 3, py * turbScale + t * 0.8, pz * turbScale) - 0.5;

      // Wind increases with height
      const heightWind = 1 + py * 2.0;

      this.velocities[i3] += (nx * 2.5 * turbulence + windX * 0.3 * heightWind) * dt;
      this.velocities[i3 + 1] += (0.5 * intensity + ny * 0.5 * turbulence) * dt;
      this.velocities[i3 + 2] += (nz * 2.5 * turbulence + windZ * 0.3 * heightWind) * dt;

      // Drag
      const drag = 0.97;
      this.velocities[i3] *= drag;
      this.velocities[i3 + 1] *= drag;
      this.velocities[i3 + 2] *= drag;

      // Converge toward center in lower portion (flame cohesion)
      if (py < 0.15) {
        const pullStr = 0.8 * (1 - py / 0.15);
        this.velocities[i3] -= px * pullStr * dt * 10;
        this.velocities[i3 + 2] -= pz * pullStr * dt * 10;
      }

      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      // Temperature cools with age, faster at edges
      const dist = Math.sqrt(px * px + pz * pz);
      const edgeCool = 1 + dist * 8;
      this.temps[i] = Math.max(0, this.temps[i] - dt * 1.2 * edgeCool);

      // Size: grows then shrinks
      const sizeCurve = age < 0.2 ? age / 0.2 : 1 - (age - 0.2) / 0.8;
      this.sizes[i] = (0.02 + sizeCurve * 0.04) * intensity;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SMOKE PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════════════════

class SmokeSystem {
  constructor() {
    this.positions = new Float32Array(MAX_SMOKE * 3);
    this.velocities = new Float32Array(MAX_SMOKE * 3);
    this.lifetimes = new Float32Array(MAX_SMOKE);
    this.maxLifes = new Float32Array(MAX_SMOKE);
    this.sizes = new Float32Array(MAX_SMOKE);
    this.count = 0;
    this.time = 0;
  }

  emit(count, flameHeight, windX, windZ) {
    for (let i = 0; i < count; i++) {
      let idx = -1;
      for (let j = 0; j < MAX_SMOKE; j++) {
        if (this.lifetimes[j] <= 0) { idx = j; break; }
      }
      if (idx < 0) break;
      const j3 = idx * 3;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.01;
      this.positions[j3] = Math.cos(angle) * r + windX * 0.02;
      this.positions[j3 + 1] = flameHeight * 0.8 + Math.random() * 0.05;
      this.positions[j3 + 2] = Math.sin(angle) * r + windZ * 0.02;
      this.velocities[j3] = windX * 0.15 + (Math.random() - 0.5) * 0.05;
      this.velocities[j3 + 1] = 0.15 + Math.random() * 0.1;
      this.velocities[j3 + 2] = windZ * 0.15 + (Math.random() - 0.5) * 0.05;
      const life = 1.5 + Math.random() * 1.5;
      this.lifetimes[idx] = life;
      this.maxLifes[idx] = life;
      this.sizes[idx] = 0.01 + Math.random() * 0.02;
      this.count = Math.max(this.count, idx + 1);
    }
  }

  update(dt, windX, windZ) {
    this.time += dt;
    for (let i = 0; i < this.count; i++) {
      if (this.lifetimes[i] <= 0) continue;
      this.lifetimes[i] -= dt;
      if (this.lifetimes[i] <= 0) continue;
      const i3 = i * 3;
      const age = 1 - this.lifetimes[i] / this.maxLifes[i];
      this.velocities[i3] += windX * 0.05 * dt;
      this.velocities[i3 + 1] += 0.02 * dt;
      this.velocities[i3 + 2] += windZ * 0.05 * dt;
      this.velocities[i3] *= 0.99;
      this.velocities[i3 + 1] *= 0.99;
      this.velocities[i3 + 2] *= 0.99;
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;
      this.sizes[i] = (0.01 + age * 0.06);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SHADER CODE
// ═══════════════════════════════════════════════════════════════════════

const flameVertexShader = `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aTemp;
  attribute float aSize;
  varying float vLife;
  varying float vTemp;
  varying float vAge;

  void main() {
    vLife = aLife;
    vTemp = aTemp;
    vAge = 1.0 - aLife / max(aMaxLife, 0.001);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Size attenuation
    gl_PointSize = aSize * 800.0 / -mvPosition.z;
    gl_PointSize = max(gl_PointSize, 1.0);
  }
`;

const flameFragmentShader = `
  varying float vLife;
  varying float vTemp;
  varying float vAge;

  void main() {
    if (vLife <= 0.0) discard;

    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv) * 2.0;
    if (dist > 1.0) discard;

    // Soft circular falloff
    float alpha = 1.0 - dist * dist;
    alpha *= alpha;

    // Flame color based on temperature
    // Hot: white/blue core → yellow → orange → red → fade
    vec3 color;
    if (vTemp > 0.8) {
      // White-blue core
      float t = (vTemp - 0.8) / 0.2;
      color = mix(vec3(1.0, 0.95, 0.5), vec3(0.9, 0.92, 1.0), t);
    } else if (vTemp > 0.5) {
      // Yellow
      float t = (vTemp - 0.5) / 0.3;
      color = mix(vec3(1.0, 0.6, 0.05), vec3(1.0, 0.95, 0.5), t);
    } else if (vTemp > 0.2) {
      // Orange to yellow
      float t = (vTemp - 0.2) / 0.3;
      color = mix(vec3(0.8, 0.2, 0.02), vec3(1.0, 0.6, 0.05), t);
    } else {
      // Red fade
      float t = vTemp / 0.2;
      color = mix(vec3(0.3, 0.02, 0.0), vec3(0.8, 0.2, 0.02), t);
    }

    // Brighten core particles
    color += vec3(0.15, 0.1, 0.05) * vTemp * vTemp;

    // Fade with age
    float ageFade = vAge < 0.1 ? vAge / 0.1 : 1.0 - smoothstep(0.5, 1.0, vAge);
    alpha *= ageFade * 0.85;

    gl_FragColor = vec4(color, alpha);
  }
`;

const smokeVertexShader = `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aSize;
  varying float vAlpha;

  void main() {
    float age = 1.0 - aLife / max(aMaxLife, 0.001);
    vAlpha = aLife > 0.0 ? (1.0 - age) * (1.0 - age) * 0.12 : 0.0;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * 1200.0 / -mvPosition.z;
    gl_PointSize = max(gl_PointSize, 1.0);
  }
`;

const smokeFragmentShader = `
  varying float vAlpha;
  void main() {
    if (vAlpha <= 0.001) discard;
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv) * 2.0;
    if (dist > 1.0) discard;
    float a = (1.0 - dist * dist) * vAlpha;
    gl_FragColor = vec4(0.65, 0.62, 0.6, a);
  }
`;

// ═══════════════════════════════════════════════════════════════════════
// ORBIT CAMERA
// ═══════════════════════════════════════════════════════════════════════

class OrbitCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.el = domElement;
    this.theta = 0;       // horizontal angle
    this.phi = Math.PI * 0.35; // vertical angle
    this.distance = 1.2;
    this.targetY = 0.22;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.autoRotate = true;
    this.autoSpeed = 0.15;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    this.el.addEventListener("mousedown", this._onDown);
    this.el.addEventListener("mousemove", this._onMove);
    this.el.addEventListener("mouseup", this._onUp);
    this.el.addEventListener("mouseleave", this._onUp);
    this.el.addEventListener("wheel", this._onWheel, { passive: false });
    this.el.addEventListener("touchstart", this._onTouchStart, { passive: false });
    this.el.addEventListener("touchmove", this._onTouchMove, { passive: false });
    this.el.addEventListener("touchend", this._onTouchEnd);

    this.update(0);
  }

  _onDown(e) { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; }
  _onMove(e) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
    this.theta -= dx * 0.008;
    this.phi = Math.max(0.15, Math.min(Math.PI * 0.48, this.phi + dy * 0.006));
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }
  _onUp() { this.dragging = false; }
  _onWheel(e) {
    e.preventDefault();
    this.distance = Math.max(0.4, Math.min(3.5, this.distance + e.deltaY * 0.001));
  }
  _onTouchStart(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      this.dragging = true;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }
  }
  _onTouchMove(e) {
    if (!this.dragging || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - this.lastX;
    const dy = e.touches[0].clientY - this.lastY;
    this.theta -= dx * 0.008;
    this.phi = Math.max(0.15, Math.min(Math.PI * 0.48, this.phi + dy * 0.006));
    this.lastX = e.touches[0].clientX;
    this.lastY = e.touches[0].clientY;
  }
  _onTouchEnd() { this.dragging = false; }

  update(dt) {
    if (this.autoRotate && !this.dragging) {
      this.theta += this.autoSpeed * dt;
    }
    const r = this.distance;
    this.camera.position.set(
      r * Math.sin(this.phi) * Math.sin(this.theta),
      this.targetY + r * Math.cos(this.phi),
      r * Math.sin(this.phi) * Math.cos(this.theta)
    );
    this.camera.lookAt(0, this.targetY, 0);
  }

  dispose() {
    this.el.removeEventListener("mousedown", this._onDown);
    this.el.removeEventListener("mousemove", this._onMove);
    this.el.removeEventListener("mouseup", this._onUp);
    this.el.removeEventListener("mouseleave", this._onUp);
    this.el.removeEventListener("wheel", this._onWheel);
    this.el.removeEventListener("touchstart", this._onTouchStart);
    this.el.removeEventListener("touchmove", this._onTouchMove);
    this.el.removeEventListener("touchend", this._onTouchEnd);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// BUILD CANDLE SCENE
// ═══════════════════════════════════════════════════════════════════════

function buildScene(scene, params) {
  // ── Candle body ──
  const waxGeo = new THREE.CylinderGeometry(0.08, 0.085, 0.45, 24);
  const waxMat = new THREE.MeshPhongMaterial({
    color: params.candleColor,
    shininess: 30,
    specular: 0x222222,
  });
  const wax = new THREE.Mesh(waxGeo, waxMat);
  wax.position.y = -0.02;
  wax.name = "candle";
  scene.add(wax);

  // Melted rim at top
  const rimGeo = new THREE.TorusGeometry(0.075, 0.012, 8, 24);
  const rimMat = new THREE.MeshPhongMaterial({
    color: params.candleColor,
    shininess: 60,
    specular: 0x333333,
    transparent: true,
    opacity: 0.85,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.2;
  rim.rotation.x = Math.PI / 2;
  rim.name = "rim";
  scene.add(rim);

  // Wax pool (concave top)
  const poolGeo = new THREE.CircleGeometry(0.072, 24);
  const poolMat = new THREE.MeshPhongMaterial({
    color: params.candleColor,
    shininess: 80,
    specular: 0x444444,
    transparent: true,
    opacity: 0.7,
  });
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.position.y = 0.199;
  pool.rotation.x = -Math.PI / 2;
  pool.name = "pool";
  scene.add(pool);

  // ── Wick ──
  const wickGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.06, 6);
  const wickMat = new THREE.MeshBasicMaterial({ color: 0x1a1008 });
  const wick = new THREE.Mesh(wickGeo, wickMat);
  wick.position.y = 0.23;
  scene.add(wick);

  // ── Table surface ──
  const tableGeo = new THREE.PlaneGeometry(3, 3);
  const tableMat = new THREE.MeshPhongMaterial({
    color: 0x1a1510,
    shininess: 20,
    specular: 0x111111,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.245;
  scene.add(table);

  // ── Flame light (main illumination from flame) ──
  const flameLight = new THREE.PointLight(0xffaa44, 1.5, 3.0, 2);
  flameLight.position.set(0, 0.35, 0);
  flameLight.name = "flameLight";
  scene.add(flameLight);

  // Secondary fill light (subtle warm)
  const fillLight = new THREE.PointLight(0xff8833, 0.3, 2.0, 2);
  fillLight.position.set(0, 0.28, 0);
  scene.add(fillLight);

  // Very dim ambient
  const ambient = new THREE.AmbientLight(0x0a0806, 0.3);
  ambient.name = "ambient";
  scene.add(ambient);

  // ── Inner glow core ──
  const glowGeo = new THREE.SphereGeometry(0.018, 12, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffeedd,
    transparent: true,
    opacity: 0.9,
  });
  const glowCore = new THREE.Mesh(glowGeo, glowMat);
  glowCore.position.y = 0.27;
  glowCore.name = "glowCore";
  scene.add(glowCore);

  // Outer glow halo (billboard sprite approach)
  const haloGeo = new THREE.PlaneGeometry(0.18, 0.25);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xff9933,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.y = 0.32;
  halo.name = "halo";
  scene.add(halo);
}

function buildParticles(scene) {
  // ── Flame particles ──
  const flameGeo = new THREE.BufferGeometry();
  flameGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
  flameGeo.setAttribute("aLife", new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
  flameGeo.setAttribute("aMaxLife", new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
  flameGeo.setAttribute("aTemp", new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
  flameGeo.setAttribute("aSize", new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES), 1));

  const flameMat = new THREE.ShaderMaterial({
    vertexShader: flameVertexShader,
    fragmentShader: flameFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const flamePoints = new THREE.Points(flameGeo, flameMat);
  flamePoints.position.y = 0.26; // base at wick tip
  flamePoints.name = "flameParticles";
  flamePoints.frustumCulled = false;
  scene.add(flamePoints);

  // ── Smoke particles ──
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(MAX_SMOKE * 3), 3));
  smokeGeo.setAttribute("aLife", new THREE.Float32BufferAttribute(new Float32Array(MAX_SMOKE), 1));
  smokeGeo.setAttribute("aMaxLife", new THREE.Float32BufferAttribute(new Float32Array(MAX_SMOKE), 1));
  smokeGeo.setAttribute("aSize", new THREE.Float32BufferAttribute(new Float32Array(MAX_SMOKE), 1));

  const smokeMat = new THREE.ShaderMaterial({
    vertexShader: smokeVertexShader,
    fragmentShader: smokeFragmentShader,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });

  const smokePoints = new THREE.Points(smokeGeo, smokeMat);
  smokePoints.position.y = 0.26;
  smokePoints.name = "smokeParticles";
  smokePoints.frustumCulled = false;
  scene.add(smokePoints);

  return { flameGeo, smokeGeo };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

const CANDLE_COLORS = {
  "Ivory": "#F5F0E0",
  "Warm White": "#EEDCC0",
  "Honey": "#D4A540",
  "Burgundy": "#6B1520",
  "Forest": "#1A3A1A",
  "Navy": "#1A1A3A",
  "Lavender": "#9080B0",
  "Terracotta": "#B05530",
  "Black": "#151515",
  "Rose": "#C07080",
};

export default function CandleFlame() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  const [intensity, setIntensity] = useState(70);
  const [windX, setWindX] = useState(0);
  const [windZ, setWindZ] = useState(0);
  const [turbulence, setTurbulence] = useState(50);
  const [candleColor, setCandleColor] = useState("Ivory");
  const [autoRotate, setAutoRotate] = useState(true);
  const [showSmoke, setShowSmoke] = useState(true);
  const [ambientLevel, setAmbientLevel] = useState(15);
  const [flicker, setFlicker] = useState(50);
  const [paused, setPaused] = useState(false);

  // ── Initialize Three.js ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050403);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    canvasRef.current = renderer.domElement;
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 50);
    const orbit = new OrbitCamera(camera, renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050403, 0.8);

    const initialParams = { candleColor: CANDLE_COLORS["Ivory"] };
    buildScene(scene, initialParams);
    const { flameGeo, smokeGeo } = buildParticles(scene);

    const flameSys = new FlameSystem();
    const smokeSys = new SmokeSystem();
    let emitAccum = 0;
    let smokeAccum = 0;

    stateRef.current = {
      renderer, camera, scene, orbit,
      flameGeo, smokeGeo,
      flameSys, smokeSys,
      emitAccum, smokeAccum,
      lastTime: performance.now(),
      animId: 0,
    };

    // Handle resize
    const onResize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      orbit.dispose();
      cancelAnimationFrame(stateRef.current?.animId);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── Animation loop ──
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    let running = true;

    const animate = () => {
      if (!running) return;
      s.animId = requestAnimationFrame(animate);

      const now = performance.now();
      let dt = (now - s.lastTime) / 1000;
      s.lastTime = now;
      dt = Math.min(dt, 0.05);

      if (paused) {
        s.orbit.autoRotate = autoRotate;
        s.orbit.update(dt);
        s.renderer.render(s.scene, s.camera);
        return;
      }

      const intens = intensity / 100;
      const wx = windX / 50;
      const wz = windZ / 50;
      const turb = turbulence / 100;
      const flickerAmt = flicker / 100;

      // Flicker: modulate intensity
      const flickerMod = 1 + (Math.sin(now * 0.008) * 0.1 +
        Math.sin(now * 0.019) * 0.07 +
        Math.sin(now * 0.037) * 0.05 +
        (Math.random() - 0.5) * 0.15) * flickerAmt;
      const effIntensity = Math.max(0.05, intens * flickerMod);

      // Emit flame particles
      s.emitAccum += EMIT_RATE * effIntensity;
      while (s.emitAccum >= 1) {
        s.flameSys.emit(1, effIntensity, wx, wz);
        s.emitAccum -= 1;
      }

      // Emit smoke
      if (showSmoke) {
        s.smokeAccum += SMOKE_RATE;
        while (s.smokeAccum >= 1) {
          s.smokeSys.emit(1, 0.25 * effIntensity, wx, wz);
          s.smokeAccum -= 1;
        }
      }

      // Update systems
      s.flameSys.update(dt, effIntensity, wx, wz, turb);
      s.smokeSys.update(dt, wx, wz);

      // Push to GPU
      const fp = s.flameGeo.attributes.position;
      fp.array.set(s.flameSys.positions);
      fp.needsUpdate = true;
      s.flameGeo.attributes.aLife.array.set(s.flameSys.lifetimes);
      s.flameGeo.attributes.aLife.needsUpdate = true;
      s.flameGeo.attributes.aMaxLife.array.set(s.flameSys.maxLifes);
      s.flameGeo.attributes.aMaxLife.needsUpdate = true;
      s.flameGeo.attributes.aTemp.array.set(s.flameSys.temps);
      s.flameGeo.attributes.aTemp.needsUpdate = true;
      s.flameGeo.attributes.aSize.array.set(s.flameSys.sizes);
      s.flameGeo.attributes.aSize.needsUpdate = true;

      const sp = s.smokeGeo.attributes.position;
      sp.array.set(s.smokeSys.positions);
      sp.needsUpdate = true;
      s.smokeGeo.attributes.aLife.array.set(s.smokeSys.lifetimes);
      s.smokeGeo.attributes.aLife.needsUpdate = true;
      s.smokeGeo.attributes.aMaxLife.array.set(s.smokeSys.maxLifes);
      s.smokeGeo.attributes.aMaxLife.needsUpdate = true;
      s.smokeGeo.attributes.aSize.array.set(s.smokeSys.sizes);
      s.smokeGeo.attributes.aSize.needsUpdate = true;

      // Update scene objects
      const flameLight = s.scene.getObjectByName("flameLight");
      if (flameLight) {
        flameLight.intensity = 1.0 + effIntensity * 1.5;
        flameLight.color.setHSL(0.08, 0.9, 0.5 + effIntensity * 0.2);
      }

      const ambient = s.scene.getObjectByName("ambient");
      if (ambient) ambient.intensity = ambientLevel / 100;

      const glowCore = s.scene.getObjectByName("glowCore");
      if (glowCore) {
        glowCore.scale.setScalar(0.8 + effIntensity * 0.5);
        glowCore.material.opacity = 0.6 + effIntensity * 0.3;
      }

      const halo = s.scene.getObjectByName("halo");
      if (halo) {
        halo.lookAt(s.camera.position);
        halo.material.opacity = 0.08 + effIntensity * 0.12;
        halo.scale.set(1 + effIntensity * 0.3, 1 + effIntensity * 0.4, 1);
      }

      // Smoke visibility
      const smokeObj = s.scene.getObjectByName("smokeParticles");
      if (smokeObj) smokeObj.visible = showSmoke;

      // Candle color
      const candle = s.scene.getObjectByName("candle");
      if (candle) candle.material.color.set(CANDLE_COLORS[candleColor] || "#F5F0E0");
      const rim = s.scene.getObjectByName("rim");
      if (rim) rim.material.color.set(CANDLE_COLORS[candleColor] || "#F5F0E0");
      const pool = s.scene.getObjectByName("pool");
      if (pool) pool.material.color.set(CANDLE_COLORS[candleColor] || "#F5F0E0");

      s.orbit.autoRotate = autoRotate;
      s.orbit.update(dt);
      s.renderer.render(s.scene, s.camera);
    };

    animate();
    return () => { running = false; };
  }, [intensity, windX, windZ, turbulence, candleColor, autoRotate, showSmoke, ambientLevel, flicker, paused]);

  // ── Slider component ──
  const Slider = ({ label, value, onChange, min = 0, max = 100, unit = "" }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "#b8a080", letterSpacing: "0.04em" }}>{label}</span>
        <span style={{ fontSize: 11, color: "#8a7560", fontVariantNumeric: "tabular-nums" }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: "#c47830", height: 4, cursor: "pointer" }}
      />
    </div>
  );

  return (
    <div style={{
      width: "100%", height: "100vh", display: "flex",
      background: "#050403", fontFamily: "'Cormorant Garamond', Georgia, serif",
      overflow: "hidden", position: "relative",
    }}>
      {/* 3D Viewport */}
      <div
        ref={containerRef}
        style={{
          flex: 1, height: "100%", cursor: "grab", minWidth: 0,
          touchAction: "none",
        }}
      />

      {/* Control Panel */}
      <div style={{
        width: 240, flexShrink: 0, height: "100%", overflowY: "auto",
        background: "linear-gradient(180deg, #0e0c09 0%, #0a0806 100%)",
        borderLeft: "1px solid #1f1a14",
        padding: "16px 14px",
        boxSizing: "border-box",
      }}>
        {/* Title */}
        <div style={{
          textAlign: "center", marginBottom: 20, paddingBottom: 14,
          borderBottom: "1px solid #1a1510",
        }}>
          <div style={{
            fontSize: 18, color: "#d4a860", letterSpacing: "0.12em",
            fontWeight: 300, marginBottom: 4,
          }}>
            🕯️ CANDLE
          </div>
          <div style={{ fontSize: 10, color: "#5a4a38", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            3D Flame Simulation
          </div>
        </div>

        {/* Flame section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, color: "#6a5a48", letterSpacing: "0.15em",
            textTransform: "uppercase", marginBottom: 10,
            borderBottom: "1px solid #1a1510", paddingBottom: 5,
          }}>Flame</div>
          <Slider label="Intensity" value={intensity} onChange={setIntensity} unit="%" />
          <Slider label="Flicker" value={flicker} onChange={setFlicker} unit="%" />
          <Slider label="Turbulence" value={turbulence} onChange={setTurbulence} unit="%" />
        </div>

        {/* Wind section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, color: "#6a5a48", letterSpacing: "0.15em",
            textTransform: "uppercase", marginBottom: 10,
            borderBottom: "1px solid #1a1510", paddingBottom: 5,
          }}>Wind</div>
          <Slider label="East ↔ West" value={windX} onChange={setWindX} min={-50} max={50} />
          <Slider label="North ↔ South" value={windZ} onChange={setWindZ} min={-50} max={50} />
        </div>

        {/* Candle section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, color: "#6a5a48", letterSpacing: "0.15em",
            textTransform: "uppercase", marginBottom: 10,
            borderBottom: "1px solid #1a1510", paddingBottom: 5,
          }}>Candle</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#b8a080", marginBottom: 6, letterSpacing: "0.04em" }}>
              Wax Colour
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {Object.entries(CANDLE_COLORS).map(([name, hex]) => (
                <button
                  key={name}
                  onClick={() => setCandleColor(name)}
                  title={name}
                  style={{
                    width: 22, height: 22, borderRadius: "50%",
                    border: candleColor === name ? "2px solid #c47830" : "2px solid #2a2218",
                    background: hex, cursor: "pointer",
                    transition: "border-color 0.2s",
                    boxShadow: candleColor === name ? "0 0 6px #c4783066" : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Scene section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, color: "#6a5a48", letterSpacing: "0.15em",
            textTransform: "uppercase", marginBottom: 10,
            borderBottom: "1px solid #1a1510", paddingBottom: 5,
          }}>Scene</div>
          <Slider label="Ambient Light" value={ambientLevel} onChange={setAmbientLevel} unit="%" />

          {[
            { label: "Auto-Rotate", checked: autoRotate, set: setAutoRotate },
            { label: "Show Smoke", checked: showSmoke, set: setShowSmoke },
          ].map(({ label, checked, set }) => (
            <label key={label} style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 8, cursor: "pointer",
              fontSize: 11, color: "#b8a080",
            }}>
              <div
                onClick={() => set(!checked)}
                style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: "1px solid #3a3025",
                  background: checked ? "#c47830" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                  fontSize: 10, color: "#fff",
                }}
              >
                {checked && "✓"}
              </div>
              <span onClick={() => set(!checked)}>{label}</span>
            </label>
          ))}
        </div>

        {/* Pause / Blow Out */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setPaused(p => !p)}
            style={{
              flex: 1, padding: "8px 0", fontSize: 11,
              background: paused ? "#3a2a18" : "#1a1510",
              color: "#b8a080", border: "1px solid #2a2218",
              borderRadius: 4, cursor: "pointer",
              letterSpacing: "0.08em",
            }}
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button
            onClick={() => setIntensity(0)}
            style={{
              flex: 1, padding: "8px 0", fontSize: 11,
              background: "#1a1510", color: "#b8a080",
              border: "1px solid #2a2218", borderRadius: 4,
              cursor: "pointer", letterSpacing: "0.08em",
            }}
          >
            💨 Blow Out
          </button>
        </div>

        {/* Controls hint */}
        <div style={{
          fontSize: 9, color: "#3a3025", lineHeight: 1.5,
          borderTop: "1px solid #1a1510", paddingTop: 10,
        }}>
          <div style={{ color: "#5a4a38", marginBottom: 4 }}>Controls</div>
          Drag to orbit · Scroll to zoom<br />
          Particle simulation with turbulent<br />
          noise field, temperature-mapped<br />
          colour, and additive blending
        </div>
      </div>
    </div>
  );
}
