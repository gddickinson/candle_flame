"""Reference runs of the real Python simulation, for checking the JavaScript port.

``FlameSystem``/``SmokeSystem`` draw random numbers with ``self._rng.uniform(lo, hi, n)`` and ``CandleSim`` draws its
flicker noise from ``self.random()``.  Here those generators are swapped for `Mulberry32Rng`, a Python copy of the
seeded mulberry32 generator in ``static/core.js`` (``rng()``), so the JS engine (``static/flame_engine.js``) given the
same seeds consumes identical random streams.  Everything else (`CandleSim.step`, emission, noise, physics) is the
unmodified package code.  Particle arrays are float32 in Python, so snapshots are sent as base64 little-endian float32.

Used by the web API (``/api/reference``, the Verify page) and ``scripts/make_js_fixtures.py`` (node-test fixtures).
"""
from __future__ import annotations

import base64
import math
from dataclasses import asdict
from typing import Dict, List

import numpy as np

from ..camera import OrbitCamera, perspective
from ..geometry import build_candle_meshes
from ..noise import fbm
from ..particles import FlameParams
from ..simulation import CandleSim, flicker_mod

M32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & M32


class Mulberry32Rng:
    """mulberry32, bit-for-bit the same as ``rng(seed)`` in static/core.js; offers numpy's ``uniform``."""

    def __init__(self, seed: int) -> None:
        self.a = seed & M32

    def random(self) -> float:
        self.a = (self.a + 0x6D2B79F5) & M32
        a = self.a
        t = _imul(a ^ (a >> 15), 1 | a)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296.0

    def uniform(self, lo: float = 0.0, hi: float = 1.0, size=None):
        # numpy Generator.uniform: low + (high - low) * random(), drawn in order
        if size is None:
            return lo + (hi - lo) * self.random()
        return np.array([lo + (hi - lo) * self.random() for _ in range(size)], dtype=np.float64)


# Seeded scenarios: seeds of the flame, smoke and flicker streams; "changes" set FlameParams fields before that step.
CASES: List[dict] = [
    {"name": "default", "seeds": [42, 99, 7], "dt": 1 / 60, "steps": 240, "snap_every": 80,
     "show_smoke": True, "params": {}, "changes": {}},
    {"name": "windy", "seeds": [3, 5, 11], "dt": 0.025, "steps": 240, "snap_every": 80, "show_smoke": True,
     "params": {"intensity": 1.0, "turbulence": 0.85, "flicker": 0.8, "emit_rate": 20.0, "wind_x": 0.8,
                "wind_z": -0.3},
     "changes": {"100": {"wind_x": -0.5, "wind_z": 0.4}, "170": {"intensity": 0.0}}},
]
CASE_BY_NAME: Dict[str, dict] = {c["name"]: c for c in CASES}

FLAME_FIELDS = ("pos", "vel", "life", "max_life", "temp", "size")
SMOKE_FIELDS = ("pos", "vel", "life", "max_life", "size")


def make_sim(case: dict) -> CandleSim:
    params = FlameParams(**case["params"])
    fs, ss, fl = case["seeds"]
    sim = CandleSim(params, random=Mulberry32Rng(fl).random)
    sim.flame._rng = Mulberry32Rng(fs)
    sim.smoke._rng = Mulberry32Rng(ss)
    return sim


def _b64(a: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(a, dtype="<f4").tobytes()).decode("ascii")


def snapshot(sim: CandleSim, step: int) -> dict:
    return {
        "step": step, "time": sim.time, "emit_accum": sim.emit_accum, "smoke_accum": sim.smoke_accum, "light": sim.light,
        "alive": [int(np.sum(sim.flame.life > 0)), int(np.sum(sim.smoke.life > 0))],
        "flame": {k: _b64(getattr(sim.flame, k)) for k in FLAME_FIELDS},
        "smoke": {k: _b64(getattr(sim.smoke, k)) for k in SMOKE_FIELDS},
    }


def run_case(case: dict) -> dict:
    """Run *case* through CandleSim.step; float32 particle snapshots every ``snap_every`` steps."""
    sim = make_sim(case)
    snaps, effs, lights = [], [], []
    for i in range(case["steps"]):
        for k, v in case["changes"].get(str(i), {}).items():
            setattr(sim.params, k, v)
        eff = sim.step(case["dt"], case["show_smoke"])
        effs.append(eff)
        lights.append(sim.light_intensity(eff))
        if (i + 1) % case["snap_every"] == 0:
            snaps.append(snapshot(sim, i + 1))
    return {"case": case, "snapshots": snaps, "eff": effs, "light": lights}


def noise_fixture() -> dict:
    """fbm of the package on float64 and float32 inputs (the particle code feeds float32)."""
    r = Mulberry32Rng(5)
    pts = np.array([[r.uniform(-20, 20) for _ in range(3)] for _ in range(200)])
    out = {"points": pts.tolist()}
    out["f64"] = fbm(pts[:, 0], pts[:, 1], pts[:, 2]).tolist()
    p32 = pts.astype(np.float32)
    out["f32"] = fbm(p32[:, 0], p32[:, 1], p32[:, 2]).tolist()
    out["octaves5"] = fbm(pts[:, 0], pts[:, 1], pts[:, 2], octaves=5).tolist()
    return out


def camera_fixture() -> dict:
    """View/projection matrices of camera.py for a few orbit states, and the scene meshes of geometry.py."""
    states = []
    for theta, phi, dist in [(0.0, math.pi * 0.35, 1.2), (1.3, 0.4, 0.8), (-2.2, 1.4, 3.1)]:
        c = OrbitCamera()
        c.theta, c.phi, c.distance = theta, phi, dist
        states.append({"theta": theta, "phi": phi, "distance": dist, "eye": c.eye.tolist(),
                       "view": c.view_matrix().tolist()})
    cam = OrbitCamera()
    cam.rotate(40, -25)
    cam.zoom(-300)
    cam.update(0.5)
    meshes = [{"vertices": m["vertices"].ravel().tolist(), "normals": m["normals"].ravel().tolist(),
               "indices": m["indices"].tolist(), "color": list(m["color"]), "shininess": m["shininess"],
               "is_candle": m["is_candle"]} for m in build_candle_meshes()]
    return {"states": states, "proj": perspective(45, 1.6, 0.01, 50.0).tolist(),
            "after_input": [cam.theta, cam.phi, cam.distance], "meshes": meshes}


def fixture() -> dict:
    """Everything the node tests compare against (written by scripts/make_js_fixtures.py)."""
    r = Mulberry32Rng(1)
    return {
        "mulberry32_seed1": [r.random() for _ in range(5)],
        "params": asdict(FlameParams()),
        "flicker": [[t, f, n, flicker_mod(t, f, n)] for t, f, n in [(0, 0.5, 0.3), (1234.5, 1.0, 0.9),
                                                                     (98765.0, 0.25, 0.01)]],
        "noise": noise_fixture(),
        "camera": camera_fixture(),
        "cases": [run_case(c) for c in CASES],
    }
