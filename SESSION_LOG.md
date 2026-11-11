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

## 2026-11-11 -- Bug fixes approved by George (branch `web-interface`, after the web merge)

Each fix has its own "Fix ..." commit and a regression test that failed before the fix (except 2, a docstring).
1. **Blow Out left an ember flame**: `CandleSim.effective_intensity()` (and the JS `effectiveIntensity()`) now return
   0 when intensity is 0. Nothing is emitted, the remaining flame particles shrink to size 0 and die within 0.9 s,
   and smoke drifts away. The 0.05 flicker floor still applies to a burning candle, and raising the intensity relights
   it. Tests: `tests/test_blow_out.py` and the new case in `flame_engine.test.mjs`. Fixtures were regenerated: the
   "windy" reference run (blown out at step 170) now ends with 0 flame particles, and Python and JS are still
   bit-identical. The About page text was updated. Not changed: the point light and glow quad still use
   `1 + eff * 1.5`, so a blown-out candle keeps a dim warm light (renderer behaviour, same in desktop and web).
2. **`OrbitCamera.zoom` docstring** now says a positive delta moves the camera away (code unchanged);
   `test_zoom_direction` pins the behaviour.
3. **`take_screenshots.py`** now saves to the repo-root `screenshots/` that the README gallery shows, instead of
   `candle/screenshots/`. Existing images are unchanged; the README text was updated. Test:
   `tests/test_take_screenshots.py` (skipped without PyQt5/PyOpenGL). The script was not run, because it opens a window
   and would overwrite the gallery.
4. **numpy pin**: `requirements.txt` changed from `numpy>=1.24,<2.0` to `numpy>=1.24,<3.0`. With numpy 2.5.4 the
   desktop code passes all tests, the offscreen Qt tick works, and PyOpenGL 3.1.10 converts the renderer's arrays.
   Real GL drawing could not be run here (no usable off-screen GL context). Test: `tests/test_requirements.py`.

Checks re-run: `pytest tests` 36 passed (`test_web.py` 15); node 11 + 7 passed; screenshots.py static (6 routes) and
live server (4 routes) all ok with no phone overflow; README shots regenerated. Every file I added is under 500
lines; the existing `jsx/candle_flame.jsx` (979 lines, an unused prototype) was already over the limit.
