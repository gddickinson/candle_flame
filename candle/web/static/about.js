// About page: what the simulator is, the physics and rendering (from the README and the code), how to run both apps.
import { route, api, app, esc } from './core.js';

route('about', async () => {
  const [info, d] = await Promise.all([api('/info'), api('/defaults')]);
  const p = d.params;
  app().innerHTML = `
  <h1 class="glow">About</h1>
  <p class="lead">${esc(info.summary)} Version ${esc(info.version)}. A desktop app (Python, PyQt5, PyOpenGL, NumPy) and
  this web version, which runs a JavaScript port of the same particle code and a WebGL port of the same shaders.</p>

  <h2>The particle physics</h2>
  <p>The flame is a pool of ${p.max_particles} particles in flat float32 arrays (position, velocity, life, temperature,
  size); smoke is a second pool of ${p.max_smoke}. Each frame:</p>
  <ul>
    <li><b>Emit</b>: dead slots are recycled at a rate of emit rate (${p.emit_rate}) × flickered intensity × 30 per
      second. New particles start at the wick with a small radial spread, upward speed scaled by intensity and a
      temperature near 1.</li>
    <li><b>Turbulence</b>: a 3-D fractional Brownian motion field (${info.noise_octaves} octaves of hashed value noise,
      amplitude ×0.5 and frequency ×2.1 per octave) scrolls over time and perturbs the velocities.</li>
    <li><b>Wind</b>: a lateral force that grows with height (taller particles feel more wind).</li>
    <li><b>Cohesion</b>: particles below y = 0.15 are pulled towards the axis, giving the tapered flame base.</li>
    <li><b>Drag and cooling</b>: velocities decay by 3% a step; temperature falls with age, faster away from the axis.</li>
    <li><b>Size curve</b>: particles grow over the first 20% of their life, then shrink.</li>
    <li><b>Smoke</b> spawns above the flame tip, drifts up with the wind and grows as it fades.</li>
  </ul>
  <p><b>Flicker</b> is a sum of three sine waves plus a random term, scaled by the Flicker slider:</p>
  <p class="eq">1 + (sin(0.008t)·0.1 + sin(0.019t)·0.07 + sin(0.037t)·0.05 + (rand − 0.5)·0.15) × flicker</p>
  <p>It modulates both the emission rate and the point light on the candle. While the candle burns, flicker never takes
  the effective intensity below 0.05; <b>Blow Out</b> (intensity 0) stops emission: the flame vanishes and its
  light and glow fade out over 0.9 s (the longest particle life), leaving the smoke to drift away. Raise the intensity
  to relight it.</p>

  <h2>The rendering</h2>
  <p>Four shader programs, ported from GLSL 1.20 to WebGL: <b>Phong</b> for the candle body, melted wax rim, wick and
  table (lit by a warm point light just above the wick); an additive <b>glow</b> billboard; <b>flame</b> point sprites
  with additive blending and a temperature ramp (blue-white core, yellow, orange, dark red tip); and alpha-blended grey
  <b>smoke</b> sprites. The orbit camera circles a target at y = ${d.camera.target_y} (distance
  ${d.camera.min_dist} to ${d.camera.max_dist}).</p>

  <h2>Run the desktop app</h2>
  <pre>pip install PyQt5 PyOpenGL numpy
python -m candle            # or: python run_candle.py</pre>

  <h2>Run the web app</h2>
  <pre>pip install -r requirements-web.txt
python run_web.py           # http://127.0.0.1:8145</pre>
  <p>The local server serves this front end and a small JSON API read from the Python package: the defaults, sliders
  and wax colours shared with the desktop panel (<code>/api/defaults</code>) and seeded reference runs of the Python
  simulation (<code>/api/reference</code>). The GitHub Pages site is the same front end with those answers exported to
  JSON by <code>scripts/build_static.py</code>, so it works without a server.</p>

  <h2>Credits</h2>
  <p>By George Dickinson, MIT licence. Built with AI assistance from <a href="https://claude.com/" rel="noopener">Claude
  (Anthropic)</a>. Source: <a href="https://github.com/gddickinson/candle_flame">github.com/gddickinson/candle_flame</a>.</p>`;
});
