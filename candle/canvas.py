"""
QOpenGLWidget canvas for the 3D candle flame.

Owns the animation timer, orbit-camera mouse handling, particle
emission/update cycle, and per-frame flicker modulation.
All rendering is delegated to :class:`renderer.Renderer`.
"""
from __future__ import annotations
import logging
import math
import os
import time as _time

import numpy as np
from PyQt5.QtCore import Qt, QTimer, pyqtSignal
from PyQt5.QtWidgets import QOpenGLWidget, QFileDialog

from .camera import OrbitCamera, perspective
from .geometry import build_candle_meshes
from .particles import FlameSystem, SmokeSystem, FlameParams
from .renderer import Renderer

log = logging.getLogger(__name__)


class CandleCanvas(QOpenGLWidget):
    """Animated 3D candle flame viewport."""

    fps_changed = pyqtSignal(float)

    def __init__(self, params: FlameParams | None = None, parent=None):
        super().__init__(parent)
        self.params = params or FlameParams()
        self.camera = OrbitCamera()
        self._renderer = Renderer()
        self.flame = FlameSystem(self.params.max_particles)
        self.smoke = SmokeSystem(self.params.max_smoke)

        # Public state  (controls.py reads/writes these directly)
        self.paused = False
        self.show_smoke = True
        self.ambient = 0.15
        self.candle_rgb: tuple[float, float, float] = (0.96, 0.94, 0.88)

        # Internal
        self._time = 0.0
        self._emit_accum = 0.0
        self._smoke_accum = 0.0
        self._frame_times: list[float] = []
        self._last_time = _time.perf_counter()
        self._dragging = False
        self._last_mx = 0
        self._last_my = 0

        # ~60 fps target
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.start(16)

        self.setMinimumSize(400, 400)
        self.setMouseTracking(False)

    # ── OpenGL lifecycle ──────────────────────────────────────────────

    def initializeGL(self):
        meshes = build_candle_meshes(self.candle_rgb)
        self._renderer.init_gl(meshes)

    def resizeGL(self, w, h):
        from OpenGL.GL import glViewport
        glViewport(0, 0, w, h)

    def paintGL(self):
        w, h = self.width(), self.height()
        if w < 1 or h < 1:
            return

        proj = perspective(45, w / h, 0.01, 50.0)
        view = self.camera.view_matrix()
        eye  = self.camera.eye

        # Flicker modulates the point-light intensity
        p = self.params
        t_ms = self._time * 1000
        flicker_mod = 1.0 + (
            math.sin(t_ms * 0.008) * 0.1 +
            math.sin(t_ms * 0.019) * 0.07 +
            math.sin(t_ms * 0.037) * 0.05 +
            (np.random.random() - 0.5) * 0.15
        ) * p.flicker
        eff = max(0.05, p.intensity * flicker_mod)

        self._renderer.render(
            view, proj, eye,
            self.flame, self.smoke,
            light_int=1.0 + eff * 1.5,
            ambient=self.ambient,
            show_smoke=self.show_smoke,
            screen_h=float(h),
            candle_color=self.candle_rgb,
        )

    # ── animation tick ────────────────────────────────────────────────

    def _tick(self):
        now = _time.perf_counter()
        dt = min(now - self._last_time, 0.05)
        self._last_time = now

        # FPS
        self._frame_times.append(now)
        self._frame_times = [t for t in self._frame_times if t > now - 1.0]
        if len(self._frame_times) > 1:
            self.fps_changed.emit(float(len(self._frame_times)))

        # Camera auto-rotate (always, even when paused)
        if not self._dragging:
            self.camera.update(dt)

        if self.paused:
            self.update()
            return

        self._time += dt
        p = self.params

        # Flicker
        t_ms = self._time * 1000
        flicker_mod = 1.0 + (
            math.sin(t_ms * 0.008) * 0.1 +
            math.sin(t_ms * 0.019) * 0.07 +
            math.sin(t_ms * 0.037) * 0.05 +
            (np.random.random() - 0.5) * 0.15
        ) * p.flicker
        eff = max(0.05, p.intensity * flicker_mod)
        wx, wz, turb = p.wind_x, p.wind_z, p.turbulence

        # Emit flame particles
        self._emit_accum += p.emit_rate * eff * dt * 30
        while self._emit_accum >= 1:
            self.flame.emit(1, eff, wx, wz)
            self._emit_accum -= 1

        # Emit smoke
        if self.show_smoke:
            self._smoke_accum += p.smoke_rate * dt * 30
            while self._smoke_accum >= 1:
                self.smoke.emit(1, 0.25 * eff, wx, wz)
                self._smoke_accum -= 1

        # Step physics
        self.flame.update(dt, eff, wx, wz, turb)
        self.smoke.update(dt, wx, wz)

        self.update()  # trigger paintGL

    # ── mouse orbit ───────────────────────────────────────────────────

    def mousePressEvent(self, e):
        if e.button() == Qt.LeftButton:
            self._dragging = True
            self._last_mx = e.x()
            self._last_my = e.y()
            self.setCursor(Qt.ClosedHandCursor)

    def mouseMoveEvent(self, e):
        if self._dragging:
            dx = e.x() - self._last_mx
            dy = e.y() - self._last_my
            self.camera.rotate(dx, dy)
            self._last_mx = e.x()
            self._last_my = e.y()

    def mouseReleaseEvent(self, e):
        if e.button() == Qt.LeftButton:
            self._dragging = False
            self.setCursor(Qt.OpenHandCursor)

    def wheelEvent(self, e):
        self.camera.zoom(e.angleDelta().y() * -1)

    def enterEvent(self, e):
        self.setCursor(Qt.OpenHandCursor)

    # ── public API ────────────────────────────────────────────────────

    def set_candle_color(self, r: float, g: float, b: float):
        """Set the candle wax colour (0–1 floats)."""
        self.candle_rgb = (r, g, b)

    def screenshot(self, path: str | None = None) -> str | None:
        """Capture the current frame and save as PNG.

        If *path* is ``None`` a file dialog is shown.
        Returns the saved path, or ``None`` if cancelled.
        """
        if path is None:
            path, _ = QFileDialog.getSaveFileName(
                self, "Save Screenshot", "candle_screenshot.png",
                "PNG Image (*.png);;JPEG Image (*.jpg)")
        if not path:
            return None
        img = self.grabFramebuffer()
        img.save(path)
        return path
