// node flame_camera.test.mjs: camera matrices and scene meshes against camera.py / geometry.py
// (tests/fixtures/flame_reference.json).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OrbitCamera, perspective, matmul, identity, toGL } from './flame_camera.js';
import { buildCandleMeshes } from './flame_geometry.js';

const F = JSON.parse(readFileSync(new URL('../../../tests/fixtures/flame_reference.json', import.meta.url))).camera;
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok  ', name); };
const maxAbs = (a, b) => Math.max(...a.flat(9).map((v, i) => Math.abs(v - b.flat(9)[i])));

ok('perspective() equals camera.perspective', () => assert.ok(maxAbs(perspective(45, 1.6, 0.01, 50), F.proj) === 0));
for (const s of F.states) {
  ok(`eye and view matrix at theta=${s.theta}, phi=${s.phi.toFixed(3)}, d=${s.distance}`, () => {
    const c = new OrbitCamera({ theta: s.theta, phi: s.phi, distance: s.distance });
    assert.ok(maxAbs(c.eye, s.eye) === 0, 'eye');
    const d = maxAbs(c.viewMatrix(), s.view);
    assert.ok(d < 1e-6, `view differs by ${d}`);       // numpy does the look-at in float32
  });
}
ok('rotate / zoom / update clamp and advance like OrbitCamera', () => {
  const c = new OrbitCamera();
  c.rotate(40, -25); c.zoom(-300); c.update(0.5);
  assert.ok(maxAbs([c.theta, c.phi, c.distance], F.after_input) < 1e-15);
});
ok('matmul / toGL', () => {
  const m = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]];
  assert.deepEqual(matmul(m, identity()), m);
  assert.deepEqual([...toGL(m)].slice(0, 4), [1, 5, 9, 13]);
});
ok('candle meshes identical to geometry.build_candle_meshes', () => {
  const js = buildCandleMeshes();
  assert.equal(js.length, F.meshes.length);
  js.forEach((m, k) => {
    const p = F.meshes[k];
    for (const key of ['vertices', 'normals', 'indices']) assert.deepEqual([...m[key]], p[key], key);
    assert.deepEqual([m.color, m.shininess, m.is_candle], [p.color, p.shininess, p.is_candle]);
  });
});
console.log(`flame_camera: ${n} tests passed`);
