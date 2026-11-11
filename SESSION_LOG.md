# Session log

## 2026-11-11 -- Web interface and GitHub Pages site (branch `web-interface`)

- Added `candle/web/` (FastAPI app + plain ES-module front end, shared dark neon kit with a flame palette),
  `run_web.py` (port 8145), `scripts/build_static.py`, `scripts/screenshots.py`, `scripts/make_js_fixtures.py`,
  `.github/workflows/pages.yml`, `requirements-web.txt`, `tests/test_web.py`, README section, INTERFACE.md update.
- The static site is the working candle: JS ports of `particles.py`, `noise.py`, `simulation.py`, `camera.py`,
  `geometry.py`, and a WebGL port of `renderer.py`/`shaders.py` (GLSL 1.20 → GLSL ES 1.00, bodies unchanged). All
  desktop controls are on the Candle page. A 2-D canvas fallback draws the particles if WebGL is unavailable.
- Refactor (Qt-free, GUI behaviour unchanged): the per-frame flicker/emission/physics step moved from
  `CandleCanvas._tick` to `candle/simulation.py` (`CandleSim`); `CANDLE_COLORS` and the slider specs moved from
  `controls.py` to `candle/ui_specs.py` (re-exported by `controls.py`). Verified offscreen (`QT_QPA_PLATFORM=offscreen`):
  window builds, particles emit and update, sliders keep their old defaults (70/50/50/12/0/0/15/15) and still set the
  params. The OpenGL drawing itself could not be exercised offscreen.
- JS vs Python: seeded runs (mulberry32 swapped in for NumPy's generator) are **bit-identical**: 0 of 27,240 float32
  values differ in each of the two cases; fbm identical on 200 points; camera matrices within 1e-6, meshes identical.
  NumPy 2 (NEP 50) float32 arithmetic is reproduced with `Math.fround`; the int64 noise hash overflow is emulated.
- Tests: `pytest tests` 30 passed (15 existing + 15 web); node tests 10 + 7 passed; screenshots.py static and live
  server: all routes ok, no phone overflow.
- Observations (not changed): Blow Out sets intensity 0 but `max(0.05, ...)` keeps a tiny ember flame emitting;
  `OrbitCamera.zoom` docstring says "positive = closer" but positive delta moves the camera away (the canvas negates
  the wheel delta, so scrolling works); `take_screenshots.py` writes to `candle/screenshots/` while the README
  gallery shows the repo-root `screenshots/`, so regenerated images do not replace the gallery ones.
