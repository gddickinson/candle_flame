"""Web interface tests: every exported endpoint answers, the static build is complete, and the JS engine tests pass.

Run: python -m pytest -q tests/test_web.py
"""
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from candle.web.app import STATIC, STATIC_ENDPOINTS, app  # noqa: E402

client = TestClient(app)


def test_index_served():
    r = client.get("/")
    assert r.status_code == 200 and "static/main.js" in r.text


@pytest.mark.parametrize("path", STATIC_ENDPOINTS)
def test_endpoint(path):
    r = client.get("/api" + path)
    assert r.status_code == 200, r.text
    assert r.json() is not None


def test_static_build(tmp_path):
    sys.path.insert(0, str(ROOT / "scripts"))
    import build_static
    build_static.build(tmp_path / "site")
    assert (tmp_path / "site" / "index.html").read_text().count("APP_STATIC") == 1
    for path in STATIC_ENDPOINTS:
        assert (tmp_path / "site" / "api" / (path.strip("/") + ".json")).exists()


def test_static_assets_referenced_exist():
    html = (STATIC / "index.html").read_text()
    for name in ("style.css", "main.js"):
        assert f"static/{name}" in html and (STATIC / name).exists()


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_js_engine():
    tests = sorted(STATIC.glob("*.test.mjs"))
    for t in tests:
        r = subprocess.run(["node", str(t)], capture_output=True, text=True)
        assert r.returncode == 0, r.stdout + r.stderr


# --- Candle flame specific ----------------------------------------------------------------------------------------
def test_defaults_come_from_python_package():
    from dataclasses import asdict

    from candle.camera import OrbitCamera
    from candle.particles import FlameParams
    from candle.ui_specs import CANDLE_COLORS, SLIDERS
    d = client.get("/api/defaults").json()
    assert d["params"] == asdict(FlameParams())
    assert [s["key"] for s in d["sliders"]] == [s.key for s in SLIDERS]
    assert [c["name"] for c in d["colors"]] == list(CANDLE_COLORS)
    assert d["camera"]["phi"] == OrbitCamera().phi
    for s in d["sliders"]:
        assert s["lo"] <= s["default"] <= s["hi"], s


def test_slider_defaults_match_desktop_panel():
    """The values the desktop panel used before the specs were factored out of controls.py."""
    from candle.ui_specs import SLIDER_BY_KEY
    old = {"intensity": 70, "flicker": 50, "turbulence": 50, "emit_rate": 12, "wind_x": 0, "wind_z": 0,
           "ambient": 15, "auto_speed": 15}
    assert {k: s.default for k, s in SLIDER_BY_KEY.items()} == old


def test_info_counts():
    i = client.get("/api/info").json()
    assert (i["max_particles"], i["max_smoke"], i["wax_colors"], i["noise_octaves"]) == (800, 120, 10, 3)


def test_candle_sim_matches_desktop_tick():
    """CandleSim.step is the old canvas._tick body: same emission and physics for the same random draws."""
    import numpy as np

    from candle.particles import FlameParams, FlameSystem, SmokeSystem
    from candle.simulation import CandleSim, flicker_mod
    sim = CandleSim(FlameParams(), random=np.random.default_rng(1).random)
    noise = np.random.default_rng(1).random
    fl, sm, t, ea, sa, p = FlameSystem(800), SmokeSystem(120), 0.0, 0.0, 0.0, FlameParams()
    for _ in range(120):
        sim.step(1 / 60)
        t += 1 / 60
        eff = max(0.05, p.intensity * flicker_mod(t * 1000, p.flicker, noise()))
        ea += p.emit_rate * eff * (1 / 60) * 30
        while ea >= 1:
            fl.emit(1, eff, 0.0, 0.0)
            ea -= 1
        sa += p.smoke_rate * (1 / 60) * 30
        while sa >= 1:
            sm.emit(1, 0.25 * eff, 0.0, 0.0)
            sa -= 1
        fl.update(1 / 60, eff, 0.0, 0.0, p.turbulence)
        sm.update(1 / 60, 0.0, 0.0)
    assert np.array_equal(sim.flame.pos, fl.pos) and np.array_equal(sim.smoke.size, sm.size)


def test_reference_runs():
    names = [c["name"] for c in client.get("/api/reference").json()]
    r = client.get(f"/api/reference/{names[0]}").json()
    assert len(r["snapshots"]) == 3 and r["snapshots"][-1]["alive"][0] > 50
    assert client.get("/api/reference/nope").status_code == 404


def _close(a, b, path="$"):
    """Recursive comparison allowing last-digit float differences between platforms (libm); float32 arrays are
    compared after decoding, with a small absolute tolerance."""
    import base64

    import numpy as np
    if isinstance(a, dict):
        assert a.keys() == b.keys(), path
        for k in a:
            _close(a[k], b[k], f"{path}.{k}")
    elif isinstance(a, list):
        assert len(a) == len(b), path
        for i, (x, y) in enumerate(zip(a, b)):
            _close(x, y, f"{path}[{i}]")
    elif isinstance(a, str) and len(a) > 64 and path.split(".")[-2] in ("flame", "smoke"):
        x = np.frombuffer(base64.b64decode(a), "<f4")
        y = np.frombuffer(base64.b64decode(b), "<f4")
        assert x.shape == y.shape and np.allclose(x, y, rtol=1e-5, atol=1e-6), path
    elif isinstance(a, float) or isinstance(b, float):
        assert abs(a - b) <= 1e-9 * max(1.0, abs(a)), (path, a, b)
    else:
        assert a == b, (path, a, b)


def test_js_fixture_is_current():
    """tests/fixtures/flame_reference.json must match a fresh run of the Python code (run scripts/make_js_fixtures.py)."""
    import json
    sys.path.insert(0, str(ROOT / "scripts"))
    import make_js_fixtures
    from candle.web.reference import fixture
    _close(json.loads(make_js_fixtures.FIXTURE.read_text()), json.loads(make_js_fixtures.dumps(fixture())))
