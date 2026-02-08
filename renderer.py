"""
OpenGL renderer for the candle scene.

Four shader programs (sourced from shaders.py):
  1. Phong — lit candle body, wick, and table
  2. Flame — additive-blend temperature-mapped point sprites
  3. Smoke — alpha-blend fading point sprites
  4. Glow  — camera-facing billboard quad behind the flame

Matrices arrive in numpy row-major and are transposed for GL upload.
"""
from __future__ import annotations
import math
import logging
import numpy as np
from OpenGL.GL import *
from OpenGL.GL import shaders as _shaders

from .shaders import (
    PHONG_V, PHONG_F,
    FLAME_V, FLAME_F,
    SMOKE_V, SMOKE_F,
    GLOW_V,  GLOW_F,
)

log = logging.getLogger(__name__)


def _prog(vs, fs):
    return _shaders.compileProgram(
        _shaders.compileShader(vs, GL_VERTEX_SHADER),
        _shaders.compileShader(fs, GL_FRAGMENT_SHADER),
        validate=False)


class Renderer:
    """OpenGL renderer for candle + particles."""

    def __init__(self):
        self._ready = False

    # ── init ──────────────────────────────────────────────────────────

    def init_gl(self, meshes: list):
        """Compile shaders and upload static geometry.  Call once."""
        if self._ready:
            return
        log.info("Compiling shaders…")
        self._phong = _prog(PHONG_V, PHONG_F)
        self._flame = _prog(FLAME_V, FLAME_F)
        self._smoke = _prog(SMOKE_V, SMOKE_F)
        self._glow  = _prog(GLOW_V,  GLOW_F)

        # Upload meshes
        self._meshes = []
        for m in meshes:
            vbo_v = glGenBuffers(1)
            glBindBuffer(GL_ARRAY_BUFFER, vbo_v)
            glBufferData(GL_ARRAY_BUFFER, m['vertices'].nbytes,
                         m['vertices'], GL_STATIC_DRAW)
            vbo_n = glGenBuffers(1)
            glBindBuffer(GL_ARRAY_BUFFER, vbo_n)
            glBufferData(GL_ARRAY_BUFFER, m['normals'].nbytes,
                         m['normals'], GL_STATIC_DRAW)
            ebo = glGenBuffers(1)
            glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo)
            glBufferData(GL_ELEMENT_ARRAY_BUFFER, m['indices'].nbytes,
                         m['indices'], GL_STATIC_DRAW)
            self._meshes.append(dict(
                vbo_v=vbo_v, vbo_n=vbo_n, ebo=ebo,
                count=len(m['indices']),
                color=m['color'], shininess=m['shininess'],
                is_candle=m.get('is_candle', False)))

        # Dynamic VBOs for particles
        self._fl_pos  = glGenBuffers(1)
        self._fl_life = glGenBuffers(1)
        self._fl_mxlf = glGenBuffers(1)
        self._fl_temp = glGenBuffers(1)
        self._fl_size = glGenBuffers(1)

        self._sm_pos  = glGenBuffers(1)
        self._sm_life = glGenBuffers(1)
        self._sm_mxlf = glGenBuffers(1)
        self._sm_size = glGenBuffers(1)

        # Glow quad
        gv = np.array([[-0.09,0.17,0],[0.09,0.17,0],
                        [0.09,0.45,0],[-0.09,0.45,0]], np.float32)
        self._glow_vbo = glGenBuffers(1)
        glBindBuffer(GL_ARRAY_BUFFER, self._glow_vbo)
        glBufferData(GL_ARRAY_BUFFER, gv.nbytes, gv, GL_STATIC_DRAW)

        glBindBuffer(GL_ARRAY_BUFFER, 0)
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0)
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_PROGRAM_POINT_SIZE)
        glClearColor(0.02, 0.016, 0.012, 1.0)
        self._ready = True
        log.info("Renderer ready")

    # ── render frame ──────────────────────────────────────────────────

    def render(self, view, proj, eye,
               flame, smoke, *,
               light_int=2.0, ambient=0.15,
               show_smoke=True, screen_h=600.0,
               candle_color=None):
        """Draw one frame."""
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)

        model = np.eye(4, dtype=np.float32)
        mvp = proj @ view @ model
        mvp_gl   = np.ascontiguousarray(mvp.T, dtype=np.float32)
        model_gl = np.ascontiguousarray(model.T, dtype=np.float32)
        norm3    = np.eye(3, dtype=np.float32)

        lpos = np.array([0.0, 0.35, 0.0], np.float32)
        lcol = np.array([1.0, 0.7, 0.35], np.float32)

        # ── Solid geometry (Phong) ──
        glEnable(GL_DEPTH_TEST)
        glDepthMask(GL_TRUE)
        glDisable(GL_BLEND)
        p = self._phong
        glUseProgram(p)
        glUniformMatrix4fv(glGetUniformLocation(p, "uMVP"),     1, GL_FALSE, mvp_gl)
        glUniformMatrix4fv(glGetUniformLocation(p, "uModel"),   1, GL_FALSE, model_gl)
        glUniformMatrix3fv(glGetUniformLocation(p, "uNormMat"), 1, GL_FALSE, norm3)
        glUniform3fv(glGetUniformLocation(p, "uLightPos"), 1, lpos)
        glUniform3fv(glGetUniformLocation(p, "uLightCol"), 1, lcol)
        glUniform1f(glGetUniformLocation(p, "uLightInt"), light_int)
        glUniform3fv(glGetUniformLocation(p, "uEye"), 1, eye)
        glUniform1f(glGetUniformLocation(p, "uAmbient"), ambient)

        for md in self._meshes:
            col = candle_color if (candle_color and md['is_candle']) else md['color']
            glUniform3f(glGetUniformLocation(p, "uColor"), *col)
            glUniform1f(glGetUniformLocation(p, "uShininess"), md['shininess'])
            lp = glGetAttribLocation(p, "aPos")
            ln = glGetAttribLocation(p, "aNorm")
            glEnableVertexAttribArray(lp)
            glBindBuffer(GL_ARRAY_BUFFER, md['vbo_v'])
            glVertexAttribPointer(lp, 3, GL_FLOAT, GL_FALSE, 0, None)
            glEnableVertexAttribArray(ln)
            glBindBuffer(GL_ARRAY_BUFFER, md['vbo_n'])
            glVertexAttribPointer(ln, 3, GL_FLOAT, GL_FALSE, 0, None)
            glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, md['ebo'])
            glDrawElements(GL_TRIANGLES, md['count'], GL_UNSIGNED_INT, None)
            glDisableVertexAttribArray(lp)
            glDisableVertexAttribArray(ln)

        # ── Glow billboard ──
        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE)
        glDepthMask(GL_FALSE)
        g = self._glow
        glUseProgram(g)
        bb_mvp = self._billboard_mvp(view, proj, eye)
        bb_gl = np.ascontiguousarray(bb_mvp.T, dtype=np.float32)
        glUniformMatrix4fv(glGetUniformLocation(g, "uMVP"), 1, GL_FALSE, bb_gl)
        glUniform1f(glGetUniformLocation(g, "uAlpha"), min(0.2, light_int * 0.06))
        glUniform3f(glGetUniformLocation(g, "uColor"), 1.0, 0.6, 0.2)
        la = glGetAttribLocation(g, "aPos")
        glEnableVertexAttribArray(la)
        glBindBuffer(GL_ARRAY_BUFFER, self._glow_vbo)
        glVertexAttribPointer(la, 3, GL_FLOAT, GL_FALSE, 0, None)
        glDrawArrays(GL_TRIANGLE_FAN, 0, 4)
        glDisableVertexAttribArray(la)

        # ── Flame particles (additive) ──
        self._draw_particles(
            self._flame, mvp_gl, screen_h, flame,
            self._fl_pos, self._fl_life, self._fl_mxlf,
            self._fl_temp, self._fl_size,
            has_temp=True)

        # ── Smoke particles (normal blend) ──
        if show_smoke:
            glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
            self._draw_particles(
                self._smoke, mvp_gl, screen_h, smoke,
                self._sm_pos, self._sm_life, self._sm_mxlf,
                None, self._sm_size,
                has_temp=False)

        glDepthMask(GL_TRUE)
        glDisable(GL_BLEND)
        glBindBuffer(GL_ARRAY_BUFFER, 0)

    # ── helpers ───────────────────────────────────────────────────────

    def _draw_particles(self, prog, mvp_gl, screen_h, sys,
                        vbo_pos, vbo_life, vbo_mxlf,
                        vbo_temp, vbo_size, has_temp=True):
        n = sys.max_n
        pos = sys.pos.copy()
        pos[:, 1] += 0.26  # offset to wick tip

        glUseProgram(prog)
        if has_temp:
            glBlendFunc(GL_SRC_ALPHA, GL_ONE)
        glUniformMatrix4fv(glGetUniformLocation(prog, "uMVP"), 1, GL_FALSE, mvp_gl)
        glUniform1f(glGetUniformLocation(prog, "uScreenH"), screen_h)

        self._buf3(prog, "aPos",     vbo_pos,  pos)
        self._buf1(prog, "aLife",    vbo_life, sys.life)
        self._buf1(prog, "aMaxLife", vbo_mxlf, sys.max_life)
        if has_temp and vbo_temp is not None:
            self._buf1(prog, "aTemp", vbo_temp, sys.temp)
        self._buf1(prog, "aSize", vbo_size, sys.size)

        glDrawArrays(GL_POINTS, 0, n)

        for name in ("aPos", "aLife", "aMaxLife", "aTemp", "aSize"):
            loc = glGetAttribLocation(prog, name)
            if loc >= 0:
                glDisableVertexAttribArray(loc)

    def _buf3(self, prog, name, vbo, data):
        loc = glGetAttribLocation(prog, name)
        if loc < 0: return
        glBindBuffer(GL_ARRAY_BUFFER, vbo)
        glBufferData(GL_ARRAY_BUFFER, data.nbytes, data, GL_DYNAMIC_DRAW)
        glEnableVertexAttribArray(loc)
        glVertexAttribPointer(loc, 3, GL_FLOAT, GL_FALSE, 0, None)

    def _buf1(self, prog, name, vbo, data):
        loc = glGetAttribLocation(prog, name)
        if loc < 0: return
        glBindBuffer(GL_ARRAY_BUFFER, vbo)
        glBufferData(GL_ARRAY_BUFFER, data.nbytes, data, GL_DYNAMIC_DRAW)
        glEnableVertexAttribArray(loc)
        glVertexAttribPointer(loc, 1, GL_FLOAT, GL_FALSE, 0, None)

    def _billboard_mvp(self, view, proj, eye):
        """Model matrix that faces the camera (Y-axis billboard)."""
        angle = math.atan2(float(eye[0]), float(eye[2]))
        ca, sa = math.cos(angle), math.sin(angle)
        m = np.eye(4, dtype=np.float32)
        m[0,0] = ca;  m[0,2] = sa
        m[2,0] = -sa; m[2,2] = ca
        return proj @ view @ m
