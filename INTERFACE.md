# Candle Flame Simulator -- Interface Map

## Project Structure

```
candle_flame/
  run_candle.py            # Quick-start launcher
  pyproject.toml           # Package metadata and dependencies
  requirements.txt         # Pinned dependency versions
  candle/                  # Main package
    __init__.py
    __main__.py            # python -m candle entry point
    app.py                 # QApplication setup + main()
    main_window.py         # QMainWindow container
    canvas.py              # QOpenGLWidget: animation loop, mouse orbit, flicker, emission
    controls.py            # Control panel: sliders for intensity, wind, turbulence, etc.
    renderer.py            # OpenGL rendering: VBO management, draw calls
    shaders.py             # GLSL 1.20 vertex/fragment shader source strings
    particles.py           # FlameSystem, SmokeSystem, FlameParams (particle physics)
    simulation.py          # CandleSim: Qt-free per-frame step (flicker, emission, physics); flicker_mod()
    ui_specs.py            # Qt-free slider specs, CANDLE_COLORS, DEFAULT_AMBIENT (desktop panel + web API)
    noise.py               # 3D value noise + fBm for turbulent flow fields
    camera.py              # OrbitCamera + perspective/look-at matrix helpers
    geometry.py            # Candle mesh generation (body, base, wick)
    take_screenshots.py    # Automated screenshot tool
    web/                   # Web interface (no Qt/OpenGL imports) -- see "Web" below
  screenshots/             # Saved screenshots
  jsx/                     # WebGL/three.js port files (earlier React prototype, not used by candle/web)
  run_web.py               # Web app on http://127.0.0.1:8145
  requirements-web.txt     # Pinned web/test dependencies
  scripts/                 # build_static.py (Pages export), screenshots.py (Playwright smoke test),
                           # make_js_fixtures.py (Python numbers for the JS node tests)
  docs/img/                # Web screenshots used in the README
  .github/workflows/pages.yml  # Test, build and publish the static site on push to main
  tests/
    test_web.py            # API endpoints, static build, defaults from the package, fixture current, node tests
    fixtures/flame_reference.json  # Seeded Python runs, noise, camera, meshes (written by make_js_fixtures.py)
    test_noise.py          # fBm output range + determinism tests
    test_particles.py      # Emission, cooling, FlameParams defaults
    test_camera.py         # Matrix math, rotation, zoom
```

## Key Classes

| Class | File | Purpose |
|-------|------|---------|
| FlameSystem | particles.py | Hot rising particles: emit, update (buoyancy + noise + drag) |
| SmokeSystem | particles.py | Translucent smoke wisps above the flame |
| FlameParams | particles.py | User-adjustable parameters (intensity, wind, turbulence, etc.) |
| OrbitCamera | camera.py | Spherical-coordinate camera with auto-rotate |
| Renderer | renderer.py | OpenGL VBO management and draw calls |
| CandleSim | simulation.py | Qt-free frame step: flicker, emission accumulators, flame + smoke update |
| SliderSpec / SLIDERS | ui_specs.py | Slider label/range/scale; defaults read from FlameParams / OrbitCamera |
| CandleCanvas | canvas.py | QOpenGLWidget: timer tick, particle emission, flicker, mouse orbit |
| ControlPanel | controls.py | Slider panel for all adjustable parameters |
| CandleWindow | main_window.py | QMainWindow: canvas + control panel layout |

## Web: `candle/web/`

| File | Purpose | Key names |
|------|---------|-----------|
| `app.py` | FastAPI app: `static/` + JSON API (`/info`, `/defaults`, `/reference`, `/reference/{name}`) | `app`, `STATIC`, `STATIC_ENDPOINTS` |
| `reference.py` | Seeded runs of `CandleSim` with a mulberry32 RNG (same stream as JS); noise/camera/mesh fixtures | `Mulberry32Rng`, `CASES`, `run_case()`, `fixture()` |
| `static/index.html`, `style.css` (kit), `style_app.css`, `core.js` (kit) | Shell, shared theme, flame accent, router + `api()` | -- |
| `static/main.js`, `static_api.js` | Lazy page registry; static-site API (exported JSON) | `staticApi()` |
| `static/flame_noise.js` | Port of `noise.py` (exact int64 hash) | `fbm`, `smoothNoise`, `hash3` |
| `static/flame_engine.js` | Port of `particles.py` + `simulation.py` (float32 emulated with `Math.fround`) | `FlameSystem`, `SmokeSystem`, `CandleSim`, `DEFAULT_PARAMS` |
| `static/flame_camera.js`, `flame_geometry.js` | Ports of `camera.py`, `geometry.py` | `OrbitCamera`, `perspective`, `buildCandleMeshes` |
| `static/flame_shaders.js`, `flame_gl.js` | GLSL ES versions of `shaders.py`; WebGL port of `renderer.py` | `GLRenderer`, `flameColor` |
| `static/flame_view.js` | Port of `canvas.py`: loop, orbit/zoom input, PNG save, 2-D fallback | `CandleView`, `drawParticles2D` |
| `static/flame_panel.js` | Port of `controls.py` | `buildPanel` |
| `static/flame_reference.js` | Replays a Python reference run in JS and compares | `runCase`, `compare` |
| `static/home.js`, `candle.js`, `verify.js`, `about.js` | Pages `#/`, `#/candle`, `#/verify`, `#/about` | -- |
| `static/*.test.mjs` | Node tests vs `tests/fixtures/flame_reference.json` | -- |

## Dependency Flow (one-directional)

```
app.py → main_window.py → canvas.py → renderer.py → shaders.py
                         → controls.py     ↓
                         canvas.py → simulation.py → particles.py → noise.py
                         controls.py → ui_specs.py
                                      particles.py → noise.py
                                      camera.py
                                      geometry.py
```

Web: run_web.py → candle.web.app → ui_specs, particles, camera, geometry, web.reference (→ simulation)
     browser: candle.js → CandleView (flame_engine.js, flame_camera.js, flame_gl.js) + buildPanel
     scripts/build_static.py → site/ (static/ + api/*.json) → GitHub Pages
