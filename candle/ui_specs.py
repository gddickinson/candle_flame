"""
Qt-free control specs shared by the desktop panel (``controls.py``) and the
web app (``candle/web/app.py``): slider ranges/defaults, wax colour presets
and scene defaults.

A slider value ``v`` maps to the model value ``v / scale``; defaults are read
from :class:`FlameParams` and :class:`OrbitCamera` so they cannot drift.
"""
from __future__ import annotations
from dataclasses import asdict, dataclass

from .camera import OrbitCamera
from .particles import FlameParams

# ── colour presets ────────────────────────────────────────────────────

CANDLE_COLORS: dict[str, tuple[float, float, float]] = {
    "Ivory":      (0.96, 0.94, 0.88),
    "Warm White": (0.93, 0.86, 0.75),
    "Honey":      (0.83, 0.65, 0.25),
    "Burgundy":   (0.42, 0.08, 0.12),
    "Forest":     (0.10, 0.23, 0.10),
    "Navy":       (0.10, 0.10, 0.23),
    "Lavender":   (0.56, 0.50, 0.69),
    "Terracotta": (0.69, 0.33, 0.19),
    "Black":      (0.08, 0.08, 0.08),
    "Rose":       (0.75, 0.44, 0.50),
}
DEFAULT_CANDLE_COLOR = CANDLE_COLORS["Ivory"]
DEFAULT_AMBIENT = 0.15      # scene base illumination (canvas.ambient)


@dataclass(frozen=True)
class SliderSpec:
    key: str        # attribute name on *target*
    target: str     # "params" (FlameParams), "canvas" or "camera"
    group: str
    label: str
    lo: int
    hi: int
    scale: float    # model value = slider value / scale
    unit: str = ""

    @property
    def default(self) -> int:
        src = {"params": FlameParams(), "camera": OrbitCamera()}.get(self.target)
        val = DEFAULT_AMBIENT if src is None else getattr(src, self.key)
        return int(round(val * self.scale))


SLIDERS: list[SliderSpec] = [
    SliderSpec("intensity",  "params", "Flame", "Intensity",     0, 100, 100, "%"),
    SliderSpec("flicker",    "params", "Flame", "Flicker",       0, 100, 100, "%"),
    SliderSpec("turbulence", "params", "Flame", "Turbulence",    0, 100, 100, "%"),
    SliderSpec("emit_rate",  "params", "Flame", "Emit Rate",     2, 30, 1),
    SliderSpec("wind_x",     "params", "Wind",  "East ↔ West",  -50, 50, 50),
    SliderSpec("wind_z",     "params", "Wind",  "North ↔ South", -50, 50, 50),
    SliderSpec("ambient",    "canvas", "Scene", "Ambient Light", 0, 50, 100, "%"),
    SliderSpec("auto_speed", "camera", "Scene", "Rotate Speed",  5, 100, 100),
]
SLIDER_BY_KEY = {s.key: s for s in SLIDERS}


def slider_args(key: str) -> tuple:
    """(label, lo, hi, default, unit) for ``controls.LSlider``."""
    s = SLIDER_BY_KEY[key]
    return s.label, s.lo, s.hi, s.default, s.unit


def specs_as_dicts() -> list[dict]:
    return [{**asdict(s), "default": s.default} for s in SLIDERS]
