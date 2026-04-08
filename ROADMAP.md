# Candle Flame Simulator -- Roadmap

## Current State
A polished 3D particle-based candle flame simulator using OpenGL and PyQt5. Well-structured with clean separation: pure logic (`noise.py`, `particles.py`, `camera.py`) vs. rendering (`renderer.py`, `shaders.py`) vs. UI (`canvas.py`, `controls.py`). 13 modules in the `candle/` package with one-directional dependency flow. Good documentation and screenshot tooling.

## Short-term Improvements
- [ ] Add type hints throughout (`particles.py`, `renderer.py`, `canvas.py` lack full annotations)
- [x] Add unit tests for pure-logic modules: `noise.py` (fBm output range), `particles.py` (emission/cooling), `camera.py` (matrix math)
- [x] Add `requirements.txt` or `pyproject.toml` for reproducible installs (added both)
- [ ] Validate slider inputs in `controls.py` -- guard against divide-by-zero in emit rate
- [ ] Add docstrings to `renderer.py` draw methods and `canvas.py` update loop
- [ ] Handle OpenGL context creation failure gracefully in `app.py`

## Feature Enhancements
- [ ] Add flame colour ramp presets (blue flame, green chemical flame) in `shaders.py`
- [ ] Support multiple candles on the same scene (instanced rendering)
- [ ] Add dripping wax animation using mesh deformation in `geometry.py`
- [ ] Implement FPS counter overlay on the canvas
- [ ] Add keyboard shortcuts for common controls (intensity, pause, screenshot)
- [ ] Export flame animation as GIF/MP4 sequence from `canvas.py`
- [ ] Add environment mapping or background scene options

## Long-term Vision
- [ ] Port to modern OpenGL (3.3+ core profile) with compute shaders for particle physics
- [ ] GPU-based particle simulation via SSBO for 10k+ particles at 60fps
- [ ] WebGL/three.js port for browser-based demos using the JSX files in `jsx/`
- [ ] Add physically-based combustion model (temperature-dependent buoyancy, soot formation)
- [ ] VR mode with head tracking for immersive flame viewing

## Technical Debt
- [ ] `canvas.py` handles both rendering loop and flicker logic -- extract flicker to its own module
- [ ] `renderer.py` manually manages VBOs; consider a thin abstraction layer for GL resources
- [ ] GLSL 1.20 shaders limit portability; upgrade to 3.30 with fallback path
- [ ] `take_screenshots.py` should be moved to a `tools/` directory rather than sitting in the package
- [x] No `.gitignore` for `__pycache__/` and generated outputs
- [ ] No CI/CD pipeline -- add GitHub Actions for linting and basic import tests
