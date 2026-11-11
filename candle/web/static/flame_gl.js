// WebGL 1 port of candle/renderer.py: Phong-lit candle meshes, additive glow billboard, additive flame point sprites
// and alpha-blended smoke sprites, with the same uniforms, blend modes and the +0.26 wick-tip offset.
import * as S from './flame_shaders.js';
import { matmul, identity, toGL } from './flame_camera.js';

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
    gl.attachShader(p, sh);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {}, a = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
    const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n);
  }
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); i++) {
    const n = gl.getActiveAttrib(p, i).name; a[n] = gl.getAttribLocation(p, n);
  }
  return { p, u, a };
}

export class GLRenderer {
  constructor(canvas, meshes) {
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    this.phong = compile(gl, S.PHONG_V, S.PHONG_F);
    this.flameP = compile(gl, S.FLAME_V, S.FLAME_F);
    this.smokeP = compile(gl, S.SMOKE_V, S.SMOKE_F);
    this.glowP = compile(gl, S.GLOW_V, S.GLOW_F);
    const buf = (data, target = gl.ARRAY_BUFFER) => {
      const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b;
    };
    this.meshes = meshes.map(m => ({ ...m, v: buf(m.vertices), n: buf(m.normals),
      e: buf(m.indices, gl.ELEMENT_ARRAY_BUFFER), count: m.indices.length }));
    this.glow = buf(new Float32Array([-0.09, 0.17, 0, 0.09, 0.17, 0, 0.09, 0.45, 0, -0.09, 0.45, 0]));
    this.dyn = {};
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.02, 0.016, 0.012, 1.0);
  }

  attr(prog, name, buffer, size) {
    const gl = this.gl, loc = prog.a[name];
    if (loc === undefined) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  dynamic(prog, key, name, data, size) {
    const gl = this.gl;
    this.dyn[key] ||= gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dyn[key]);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    this.attr(prog, name, this.dyn[key], size);
  }

  render(view, proj, eye, flame, smoke, { lightInt = 2.0, ambient = 0.15, showSmoke = true, candleColor = null } = {}) {
    const gl = this.gl, c = gl.canvas;
    gl.viewport(0, 0, c.width, c.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const mvp = matmul(proj, view), mvpGL = toGL(mvp);

    // Solid geometry (Phong)
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
    const P = this.phong;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uMVP, false, mvpGL);
    gl.uniformMatrix4fv(P.u.uModel, false, toGL(identity()));
    gl.uniformMatrix3fv(P.u.uNormMat, false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    gl.uniform3f(P.u.uLightPos, 0.0, 0.35, 0.0);
    gl.uniform3f(P.u.uLightCol, 1.0, 0.7, 0.35);
    gl.uniform1f(P.u.uLightInt, lightInt);
    gl.uniform3fv(P.u.uEye, new Float32Array(eye));
    gl.uniform1f(P.u.uAmbient, ambient);
    for (const m of this.meshes) {
      gl.uniform3fv(P.u.uColor, new Float32Array(candleColor && m.is_candle ? candleColor : m.color));
      gl.uniform1f(P.u.uShininess, m.shininess);
      this.attr(P, 'aPos', m.v, 3); this.attr(P, 'aNorm', m.n, 3);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.e);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    }
    for (const n of ['aPos', 'aNorm']) gl.disableVertexAttribArray(P.a[n]);

    // Glow billboard (Y-axis billboard facing the camera)
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
    const G = this.glowP, ang = Math.atan2(eye[0], eye[2]), ca = Math.cos(ang), sa = Math.sin(ang);
    const bb = identity(); bb[0][0] = ca; bb[0][2] = sa; bb[2][0] = -sa; bb[2][2] = ca;
    gl.useProgram(G.p);
    gl.uniformMatrix4fv(G.u.uMVP, false, toGL(matmul(mvp, bb)));
    gl.uniform1f(G.u.uAlpha, Math.min(0.2, lightInt * 0.06));
    gl.uniform3f(G.u.uColor, 1.0, 0.6, 0.2);
    this.attr(G, 'aPos', this.glow, 3);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    gl.disableVertexAttribArray(G.a.aPos);

    this.particles(this.flameP, 'fl', flame, mvpGL, true);
    if (showSmoke) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); this.particles(this.smokeP, 'sm', smoke, mvpGL, false); }
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  particles(prog, key, sys, mvpGL, hasTemp) {
    const gl = this.gl, pos = Float32Array.from(sys.pos);
    for (let i = 1; i < pos.length; i += 3) pos[i] += 0.26;     // offset to wick tip
    gl.useProgram(prog.p);
    if (hasTemp) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.uniformMatrix4fv(prog.u.uMVP, false, mvpGL);
    gl.uniform1f(prog.u.uScreenH, gl.canvas.height);
    this.dynamic(prog, key + 'p', 'aPos', pos, 3);
    this.dynamic(prog, key + 'l', 'aLife', sys.life, 1);
    this.dynamic(prog, key + 'm', 'aMaxLife', sys.max_life, 1);
    if (hasTemp) this.dynamic(prog, key + 't', 'aTemp', sys.temp, 1);
    this.dynamic(prog, key + 's', 'aSize', sys.size, 1);
    gl.drawArrays(gl.POINTS, 0, sys.max_n);
    for (const loc of Object.values(prog.a)) gl.disableVertexAttribArray(loc);
  }
}
