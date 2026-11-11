"""Blowing the candle out (intensity 0) extinguishes the flame; raising the intensity relights it."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from candle.particles import FlameParams  # noqa: E402
from candle.simulation import CandleSim  # noqa: E402


def _burn(sim, seconds, dt=1 / 60):
    for _ in range(int(round(seconds / dt))):
        sim.step(dt)


def test_blow_out_extinguishes_flame():
    sim = CandleSim(FlameParams(), random=np.random.default_rng(0).random)
    _burn(sim, 1.0)
    assert np.sum(sim.flame.life > 0) > 50
    sim.params.intensity = 0.0
    assert sim.effective_intensity() == 0.0
    _burn(sim, 1.0)  # longer than the longest flame-particle life (0.9 s)
    assert np.sum(sim.flame.life > 0) == 0, "flame still burning after Blow Out"


def test_relight_after_blow_out():
    sim = CandleSim(FlameParams(intensity=0.0), random=np.random.default_rng(0).random)
    _burn(sim, 0.5)
    assert np.sum(sim.flame.life > 0) == 0
    sim.params.intensity = 0.7
    _burn(sim, 0.5)
    assert np.sum(sim.flame.life > 0) > 50


def test_low_intensity_keeps_flicker_floor():
    """A nonzero intensity still never flickers below the 0.05 floor."""
    sim = CandleSim(FlameParams(intensity=0.01, flicker=1.0), random=lambda: 0.0)
    assert sim.effective_intensity() == 0.05
