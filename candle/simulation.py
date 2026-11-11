"""
Qt-free animation step of the candle: flicker, particle emission and physics.

Factored out of ``canvas.py`` so the desktop canvas and the web reference runs
(``candle/web/reference.py``) share one implementation.  ``CandleSim.step`` is
what ``CandleCanvas._tick`` does each frame when not paused.
"""
from __future__ import annotations
import math
from typing import Callable, Optional

import numpy as np

from .particles import FlameParams, FlameSystem, SmokeSystem


def flicker_mod(t_ms: float, flicker: float, noise: float) -> float:
    """Multi-frequency flicker multiplier; *noise* is a uniform draw in [0, 1)."""
    return 1.0 + (
        math.sin(t_ms * 0.008) * 0.1 +
        math.sin(t_ms * 0.019) * 0.07 +
        math.sin(t_ms * 0.037) * 0.05 +
        (noise - 0.5) * 0.15
    ) * flicker


class CandleSim:
    """Flame + smoke particle systems driven by :class:`FlameParams`.

    *random* supplies the flicker noise (default ``np.random.random``, as in
    the desktop app); the reference runs swap in a seeded generator.
    """

    def __init__(self, params: FlameParams | None = None,
                 random: Optional[Callable[[], float]] = None):
        self.params = params or FlameParams()
        self.flame = FlameSystem(self.params.max_particles)
        self.smoke = SmokeSystem(self.params.max_smoke)
        self.random = random or np.random.random
        self.time = 0.0
        self.emit_accum = 0.0
        self.smoke_accum = 0.0

    def effective_intensity(self) -> float:
        """Intensity modulated by flicker (draws one random number)."""
        p = self.params
        mod = flicker_mod(self.time * 1000, p.flicker, self.random())
        return max(0.05, p.intensity * mod)

    def step(self, dt: float, show_smoke: bool = True) -> float:
        """Advance the simulation by *dt* seconds; returns the effective intensity."""
        self.time += dt
        p = self.params
        eff = self.effective_intensity()
        wx, wz, turb = p.wind_x, p.wind_z, p.turbulence

        # Emit flame particles
        self.emit_accum += p.emit_rate * eff * dt * 30
        while self.emit_accum >= 1:
            self.flame.emit(1, eff, wx, wz)
            self.emit_accum -= 1

        # Emit smoke
        if show_smoke:
            self.smoke_accum += p.smoke_rate * dt * 30
            while self.smoke_accum >= 1:
                self.smoke.emit(1, 0.25 * eff, wx, wz)
                self.smoke_accum -= 1

        # Step physics
        self.flame.update(dt, eff, wx, wz, turb)
        self.smoke.update(dt, wx, wz)
        return eff
