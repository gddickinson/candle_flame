"""
Orbit camera for 3D viewport.

Uses spherical coordinates (theta, phi, distance) to circle
around a look-at target.  Produces 4×4 view and projection
matrices in row-major numpy layout; the renderer transposes
them for OpenGL column-major upload.
"""
from __future__ import annotations
import math
import numpy as np


class OrbitCamera:
    """Spherical-coordinate orbit camera."""

    def __init__(self):
        self.theta    = 0.0             # horizontal angle (radians)
        self.phi      = math.pi * 0.35  # vertical angle from top
        self.distance = 1.2
        self.target_y = 0.22            # look-at height

        self.auto_rotate = True
        self.auto_speed  = 0.15         # radians / sec

        self.min_phi  = 0.15
        self.max_phi  = math.pi * 0.48
        self.min_dist = 0.4
        self.max_dist = 3.5

    def rotate(self, dx: float, dy: float):
        """Mouse-drag rotation (dx, dy in pixels)."""
        self.theta -= dx * 0.008
        self.phi = max(self.min_phi,
                       min(self.max_phi, self.phi + dy * 0.006))

    def zoom(self, delta: float):
        """Scroll-wheel zoom (positive = closer)."""
        self.distance = max(self.min_dist,
                            min(self.max_dist, self.distance + delta * 0.001))

    def update(self, dt: float):
        """Advance auto-rotation."""
        if self.auto_rotate:
            self.theta += self.auto_speed * dt

    @property
    def eye(self) -> np.ndarray:
        """Camera position in world space."""
        r = self.distance
        sp = math.sin(self.phi)
        cp = math.cos(self.phi)
        st = math.sin(self.theta)
        ct = math.cos(self.theta)
        return np.array([r*sp*st, self.target_y + r*cp, r*sp*ct],
                        dtype=np.float32)

    @property
    def target(self) -> np.ndarray:
        return np.array([0.0, self.target_y, 0.0], dtype=np.float32)

    def view_matrix(self) -> np.ndarray:
        """4×4 look-at view matrix (row-major numpy)."""
        return _look_at(self.eye, self.target,
                        np.array([0, 1, 0], dtype=np.float32))


def perspective(fov_deg: float, aspect: float,
                near: float, far: float) -> np.ndarray:
    """4×4 perspective projection matrix (row-major numpy)."""
    f = 1.0 / math.tan(math.radians(fov_deg) / 2)
    m = np.zeros((4, 4), dtype=np.float32)
    m[0, 0] = f / aspect
    m[1, 1] = f
    m[2, 2] = (far + near) / (near - far)
    m[2, 3] = (2 * far * near) / (near - far)
    m[3, 2] = -1.0
    return m


def _look_at(eye, target, up):
    """Standard look-at view matrix (row-major)."""
    f = target - eye
    f = f / (np.linalg.norm(f) + 1e-10)
    s = np.cross(f, up)
    s = s / (np.linalg.norm(s) + 1e-10)
    u = np.cross(s, f)
    m = np.eye(4, dtype=np.float32)
    m[0, :3] = s
    m[1, :3] = u
    m[2, :3] = -f
    m[0, 3] = -np.dot(s, eye)
    m[1, 3] = -np.dot(u, eye)
    m[2, 3] = np.dot(f, eye)
    return m
