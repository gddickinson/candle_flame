"""The candle's point light and glow follow the flame: unchanged while lit, fading to 0 after Blow Out, back on relight."""
import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from candle.particles import FlameParams  # noqa: E402
from candle.simulation import CandleSim  # noqa: E402


def _burn(sim, seconds, dt=1 / 60):
    for _ in range(int(round(seconds / dt))):
        sim.step(dt)


def test_lit_light_unchanged():
    """While burning, light intensity is the old 1 + eff * 1.5."""
    sim = CandleSim(FlameParams(), random=np.random.default_rng(0).random)
    _burn(sim, 0.5)
    eff = sim.effective_intensity()
    assert sim.light_intensity(eff) == 1.0 + eff * 1.5


def test_light_fades_out_and_returns():
    sim = CandleSim(FlameParams(), random=np.random.default_rng(0).random)
    _burn(sim, 0.5)
    sim.params.intensity = 0.0
    _burn(sim, 0.3)
    mid = sim.light_intensity(sim.effective_intensity())
    assert 0.0 < mid < 1.0, mid                      # fading, not switched off
    _burn(sim, 0.7)
    assert sim.light_intensity(sim.effective_intensity()) == 0.0
    sim.params.intensity = 0.7
    _burn(sim, 1.0)
    eff = sim.effective_intensity()
    assert sim.light_intensity(eff) == 1.0 + eff * 1.5


def test_desktop_canvas_passes_faded_light():
    """CandleCanvas.paintGL hands the renderer light 0 once the candle is blown out (renderer stubbed, no GL)."""
    pytest.importorskip("PyQt5")
    pytest.importorskip("OpenGL")
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    from PyQt5.QtWidgets import QApplication
    from candle.canvas import CandleCanvas
    app = QApplication.instance() or QApplication([])  # noqa: F841
    c = CandleCanvas()
    c._timer.stop()
    c.resize(400, 400)
    seen = {}

    class Stub:
        def render(self, *a, **kw):
            seen.update(kw)
    c._renderer = Stub()
    c.params.intensity = 0.0
    for _ in range(90):
        c.sim.step(1 / 60)
    c.paintGL()
    assert seen["light_int"] == 0.0
