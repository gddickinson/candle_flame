"""FastAPI web app for the Candle Flame Simulator: serves the front end in static/ and the JSON API under /api.

Run with `python run_web.py` (http://127.0.0.1:8145, local only). `scripts/build_static.py` exports every path in
STATIC_ENDPOINTS to JSON for the GitHub Pages site, so keep that list in step with the GET routes below.

Everything served is read from the Python package (FlameParams, ui_specs sliders and wax colours, OrbitCamera,
seeded runs of CandleSim), so the web candle and the desktop app share one set of defaults.
"""
import inspect
from dataclasses import asdict
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .. import __doc__ as PKG_DOC
from .. import __version__
from .. import ui_specs as U
from ..camera import OrbitCamera
from ..geometry import build_candle_meshes
from ..noise import fbm
from ..particles import FlameParams
from .reference import CASE_BY_NAME, CASES, run_case

STATIC = Path(__file__).resolve().parent / "static"

app = FastAPI(title="Candle Flame Simulator")
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/info")
def info():
    """Project summary and counts for the home page."""
    p = FlameParams()
    return {
        "title": "Candle Flame Simulator", "version": __version__, "summary": (PKG_DOC or "").strip(),
        "max_particles": p.max_particles, "max_smoke": p.max_smoke, "wax_colors": len(U.CANDLE_COLORS),
        "sliders": len(U.SLIDERS), "meshes": len(build_candle_meshes()), "noise_octaves": inspect.signature(fbm).parameters["octaves"].default,
    }


@app.get("/api/defaults")
def defaults():
    """FlameParams defaults, the control sliders (shared with the desktop panel), wax colours, camera and scene."""
    cam = OrbitCamera()
    return {
        "params": asdict(FlameParams()),
        "sliders": U.specs_as_dicts(),
        "colors": [{"name": k, "rgb": list(v)} for k, v in U.CANDLE_COLORS.items()],
        "candle_color": list(U.DEFAULT_CANDLE_COLOR), "ambient": U.DEFAULT_AMBIENT,
        "camera": {k: getattr(cam, k) for k in ("theta", "phi", "distance", "target_y", "auto_rotate", "auto_speed",
                                                "min_phi", "max_phi", "min_dist", "max_dist")},
    }


@app.get("/api/reference")
def reference_list():
    """Names of the seeded reference runs."""
    return [{"name": c["name"], "steps": c["steps"], "dt": c["dt"], "params": c["params"]} for c in CASES]


@app.get("/api/reference/{name}")
def reference(name: str):
    """A seeded run of the Python CandleSim (float32 particle snapshots) for the Verify page."""
    if name not in CASE_BY_NAME:
        raise HTTPException(404, f"unknown reference run {name!r}")
    return run_case(CASE_BY_NAME[name])


# GET paths (without the /api prefix) written to the static site as api/<path>.json.
STATIC_ENDPOINTS = ["/info", "/defaults", "/reference"] + [f"/reference/{c['name']}" for c in CASES]
