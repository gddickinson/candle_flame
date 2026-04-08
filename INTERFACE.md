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
    noise.py               # 3D value noise + fBm for turbulent flow fields
    camera.py              # OrbitCamera + perspective/look-at matrix helpers
    geometry.py            # Candle mesh generation (body, base, wick)
    take_screenshots.py    # Automated screenshot tool
  screenshots/             # Saved screenshots
  jsx/                     # WebGL/three.js port files
  tests/
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
| CandleCanvas | canvas.py | QOpenGLWidget: timer tick, particle emission, flicker, mouse orbit |
| ControlPanel | controls.py | Slider panel for all adjustable parameters |
| CandleWindow | main_window.py | QMainWindow: canvas + control panel layout |

## Dependency Flow (one-directional)

```
app.py → main_window.py → canvas.py → renderer.py → shaders.py
                         → controls.py     ↓
                                      particles.py → noise.py
                                      camera.py
                                      geometry.py
```
