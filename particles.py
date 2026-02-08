"""
Particle systems for the candle flame.

FlameSystem:  Hot particles emitted at the wick tip, rising with buoyancy,
              perturbed by a 3D turbulent noise field, cooled over time.
              Temperature drives the colour ramp (white → yellow → orange → red).

SmokeSystem:  Faint grey wisps that spawn above the flame tip and drift
              upward with the wind.

All state lives in flat numpy arrays for efficient vectorized updates
and direct GPU upload.
"""
from __future__ import annotations
import numpy as np
from dataclasses import dataclass
from .noise import fbm


@dataclass
class FlameParams:
    """User-adjustable flame & scene parameters."""
    intensity:      float = 0.7     # 0–1: overall vigour
    wind_x:         float = 0.0     # lateral wind
    wind_z:         float = 0.0
    turbulence:     float = 0.5     # noise-field strength
    flicker:        float = 0.5     # brightness variation amount
    max_particles:  int   = 800
    max_smoke:      int   = 120
    emit_rate:      float = 12.0    # base flame particles / frame
    smoke_rate:     float = 1.5


class FlameSystem:
    """Hot rising flame particles."""

    def __init__(self, max_n: int = 800):
        self.max_n = max_n
        self.pos      = np.zeros((max_n, 3), dtype=np.float32)
        self.vel      = np.zeros((max_n, 3), dtype=np.float32)
        self.life     = np.zeros(max_n, dtype=np.float32)
        self.max_life = np.zeros(max_n, dtype=np.float32)
        self.temp     = np.zeros(max_n, dtype=np.float32)   # 1 = hottest
        self.size     = np.zeros(max_n, dtype=np.float32)
        self.time     = 0.0
        self._rng     = np.random.default_rng(42)

    def emit(self, count: int, intensity: float, wx: float, wz: float):
        """Spawn *count* particles at the wick origin."""
        dead = np.where(self.life <= 0)[0]
        n = min(count, len(dead))
        if n == 0:
            return
        idx = dead[:n]
        rng = self._rng

        ang = rng.uniform(0, 2 * np.pi, n)
        spr = rng.uniform(0, 0.015, n) * intensity
        self.pos[idx, 0] = np.cos(ang) * spr
        self.pos[idx, 1] = 0.0
        self.pos[idx, 2] = np.sin(ang) * spr

        up = (0.8 + rng.uniform(0, 0.6, n)) * intensity
        self.vel[idx, 0] = rng.uniform(-0.04, 0.04, n) + wx * 0.1
        self.vel[idx, 1] = up
        self.vel[idx, 2] = rng.uniform(-0.04, 0.04, n) + wz * 0.1

        lf = 0.4 + rng.uniform(0, 0.5, n)
        self.life[idx]     = lf
        self.max_life[idx] = lf
        self.temp[idx]     = 0.9 + rng.uniform(0, 0.1, n)
        self.size[idx]     = (0.02 + rng.uniform(0, 0.025, n)) * intensity

    def update(self, dt: float, intensity: float,
               wx: float, wz: float, turbulence: float):
        self.time += dt
        alive_mask = self.life > 0
        if not np.any(alive_mask):
            return

        idx = np.where(alive_mask)[0]
        self.life[idx] -= dt
        still = self.life[idx] > 0
        self.life[idx[~still]] = 0
        idx = idx[still]
        if len(idx) == 0:
            return

        t  = self.time
        px = self.pos[idx, 0]
        py = self.pos[idx, 1]
        pz = self.pos[idx, 2]

        # 3D turbulent noise
        ts = 3.0 * turbulence
        nx = fbm(px * ts + t * 1.5, py * ts,          pz * ts    ) - 0.5
        nz = fbm(px * ts,           py * ts + t * 1.3, pz * ts + 7) - 0.5
        ny = fbm(px * ts + 3,       py * ts + t * 0.8, pz * ts    ) - 0.5

        # Wind stronger at height
        hw = 1 + py * 2.0

        self.vel[idx, 0] += (nx * 2.5 * turbulence + wx * 0.3 * hw) * dt
        self.vel[idx, 1] += (0.5 * intensity + ny * 0.5 * turbulence) * dt
        self.vel[idx, 2] += (nz * 2.5 * turbulence + wz * 0.3 * hw) * dt

        # Drag
        self.vel[idx] *= 0.97

        # Base cohesion: pull toward centre in the lowest portion
        low_mask = py < 0.15
        low_idx = idx[low_mask]
        if len(low_idx):
            pull = 0.8 * (1 - self.pos[low_idx, 1] / 0.15)
            self.vel[low_idx, 0] -= self.pos[low_idx, 0] * pull * dt * 10
            self.vel[low_idx, 2] -= self.pos[low_idx, 2] * pull * dt * 10

        self.pos[idx] += self.vel[idx] * dt

        # Temperature: cool with age, faster near edges
        dist = np.sqrt(px * px + pz * pz)
        self.temp[idx] = np.maximum(0, self.temp[idx] - dt * 1.2 * (1 + dist * 8))

        # Size: grow then shrink
        age = 1 - self.life[idx] / self.max_life[idx]
        curve = np.where(age < 0.2, age / 0.2, 1 - (age - 0.2) / 0.8)
        self.size[idx] = (0.02 + curve * 0.04) * intensity


class SmokeSystem:
    """Translucent smoke wisps above the flame."""

    def __init__(self, max_n: int = 120):
        self.max_n    = max_n
        self.pos      = np.zeros((max_n, 3), dtype=np.float32)
        self.vel      = np.zeros((max_n, 3), dtype=np.float32)
        self.life     = np.zeros(max_n, dtype=np.float32)
        self.max_life = np.zeros(max_n, dtype=np.float32)
        self.size     = np.zeros(max_n, dtype=np.float32)
        self._rng     = np.random.default_rng(99)

    def emit(self, count: int, flame_h: float, wx: float, wz: float):
        dead = np.where(self.life <= 0)[0]
        n = min(count, len(dead))
        if n == 0:
            return
        idx = dead[:n]
        rng = self._rng

        ang = rng.uniform(0, 2 * np.pi, n)
        r   = rng.uniform(0, 0.01, n)
        self.pos[idx, 0] = np.cos(ang) * r + wx * 0.02
        self.pos[idx, 1] = flame_h * 0.8 + rng.uniform(0, 0.05, n)
        self.pos[idx, 2] = np.sin(ang) * r + wz * 0.02

        self.vel[idx, 0] = wx * 0.15 + rng.uniform(-0.025, 0.025, n)
        self.vel[idx, 1] = 0.15 + rng.uniform(0, 0.1, n)
        self.vel[idx, 2] = wz * 0.15 + rng.uniform(-0.025, 0.025, n)

        lf = 1.5 + rng.uniform(0, 1.5, n)
        self.life[idx]     = lf
        self.max_life[idx] = lf
        self.size[idx]     = 0.01 + rng.uniform(0, 0.02, n)

    def update(self, dt: float, wx: float, wz: float):
        alive = self.life > 0
        if not np.any(alive):
            return
        idx = np.where(alive)[0]
        self.life[idx] -= dt
        still = self.life[idx] > 0
        self.life[idx[~still]] = 0
        idx = idx[still]
        if len(idx) == 0:
            return

        self.vel[idx, 0] += wx * 0.05 * dt
        self.vel[idx, 1] += 0.02 * dt
        self.vel[idx, 2] += wz * 0.05 * dt
        self.vel[idx] *= 0.99
        self.pos[idx] += self.vel[idx] * dt

        age = 1 - self.life[idx] / self.max_life[idx]
        self.size[idx] = 0.01 + age * 0.06
