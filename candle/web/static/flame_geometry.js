// JS port of candle/geometry.py: procedural candle body, melted rim (torus), wick and table meshes.
// Each mesh: { vertices: Float32Array, normals: Float32Array, indices: Uint16Array, color, shininess, is_candle }.
const TAU = 2 * Math.PI;

export function cylinder(rTop, rBot, height, seg = 24, yOff = 0) {
  const v = [], n = [], idx = [], top = yOff + height / 2, bot = yOff - height / 2;
  for (let i = 0; i <= seg; i++) {                   // side wall
    const a = (i / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    v.push(rBot * ca, bot, rBot * sa); n.push(ca, 0, sa);
    v.push(rTop * ca, top, rTop * sa); n.push(ca, 0, sa);
  }
  for (let i = 0; i < seg; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  const cap = (y, r, ny, flip) => {
    const c = v.length / 3;
    v.push(0, y, 0); n.push(0, ny, 0);
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * TAU; v.push(r * Math.cos(a), y, r * Math.sin(a)); n.push(0, ny, 0); }
    for (let i = 0; i < seg; i++) idx.push(...(flip ? [c, c + 2 + i, c + 1 + i] : [c, c + 1 + i, c + 2 + i]));
  };
  cap(top, rTop, 1, false);                          // top cap
  cap(bot, rBot, -1, true);                          // bottom cap
  return pack(v, n, idx);
}

export function torus(majorR, minorR, majSeg = 24, minSeg = 8, yOff = 0) {
  const v = [], n = [], idx = [];
  for (let i = 0; i <= majSeg; i++) {
    const a = (i / majSeg) * TAU, cx = majorR * Math.cos(a), cz = majorR * Math.sin(a);
    for (let j = 0; j <= minSeg; j++) {
      const b = (j / minSeg) * TAU;
      n.push(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a));
      v.push(cx + minorR * Math.cos(b) * Math.cos(a), yOff + minorR * Math.sin(b), cz + minorR * Math.cos(b) * Math.sin(a));
    }
  }
  const stride = minSeg + 1;
  for (let i = 0; i < majSeg; i++) for (let j = 0; j < minSeg; j++) {
    const a = i * stride + j, b = a + stride;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return pack(v, n, idx);
}

export function plane(w, d, yOff = 0) {
  const hw = w / 2, hd = d / 2;
  return pack([-hw, yOff, -hd, hw, yOff, -hd, hw, yOff, hd, -hw, yOff, hd], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [0, 2, 1, 0, 3, 2]);
}

const pack = (v, n, i) => ({ vertices: new Float32Array(v), normals: new Float32Array(n), indices: new Uint16Array(i) });

export function buildCandleMeshes(color = [0.96, 0.94, 0.88]) {
  return [
    { ...cylinder(0.08, 0.085, 0.45, 24, -0.02), color, shininess: 30.0, is_candle: true },    // body
    { ...torus(0.075, 0.012, 24, 8, 0.2), color, shininess: 60.0, is_candle: true },           // melted rim
    { ...cylinder(0.003, 0.003, 0.06, 6, 0.23), color: [0.10, 0.06, 0.03], shininess: 5.0, is_candle: false }, // wick
    { ...plane(3.0, 3.0, -0.245), color: [0.10, 0.08, 0.06], shininess: 20.0, is_candle: false },              // table
  ];
}
