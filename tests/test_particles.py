"""Smoke tests for particle systems (emission, cooling)."""

import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_flame_system_init():
    from candle.particles import FlameSystem
    fs = FlameSystem(max_n=100)
    assert fs.max_n == 100
    assert fs.pos.shape == (100, 3)
    assert fs.vel.shape == (100, 3)
    assert np.all(fs.life == 0)


def test_flame_emit():
    from candle.particles import FlameSystem
    fs = FlameSystem(max_n=100)
    fs.emit(count=10, intensity=0.7, wx=0.0, wz=0.0)
    alive = np.sum(fs.life > 0)
    assert alive == 10, f"Expected 10 alive particles, got {alive}"


def test_flame_update_cools():
    from candle.particles import FlameSystem
    fs = FlameSystem(max_n=100)
    fs.emit(count=10, intensity=0.7, wx=0.0, wz=0.0)
    initial_temp = fs.temp.copy()
    fs.update(dt=0.016, intensity=0.7, wx=0.0, wz=0.0, turbulence=0.5)
    # Temperature of alive particles should decrease
    alive = fs.life > 0
    if np.any(alive):
        assert np.all(fs.temp[alive] <= initial_temp[alive] + 0.01), "Particles should cool over time"


def test_smoke_system_init():
    from candle.particles import SmokeSystem
    ss = SmokeSystem(max_n=50)
    assert ss.max_n == 50
    assert np.all(ss.life == 0)


def test_smoke_emit():
    from candle.particles import SmokeSystem
    ss = SmokeSystem(max_n=50)
    ss.emit(count=5, flame_h=0.3, wx=0.0, wz=0.0)
    alive = np.sum(ss.life > 0)
    assert alive == 5


def test_flame_params_defaults():
    from candle.particles import FlameParams
    p = FlameParams()
    assert p.intensity == 0.7
    assert p.max_particles == 800
    assert p.emit_rate == 12.0


if __name__ == "__main__":
    test_flame_system_init()
    test_flame_emit()
    test_flame_update_cools()
    test_smoke_system_init()
    test_smoke_emit()
    test_flame_params_defaults()
    print("All particle tests passed.")
