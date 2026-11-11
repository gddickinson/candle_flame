// Home page: hero with a live candle, counts from the Python package, entry cards, wax presets and the colour ramp.
import { route, api, app, list, esc } from './core.js';
import { CandleView } from './flame_view.js';
import { flameColor } from './flame_shaders.js';

const DOORS = [
  ['#/candle', 'The candle', 'The full simulator: intensity, flicker, turbulence, emit rate, wind, wax colours, smoke, orbit camera.', 'a'],
  ['#/verify', 'Python vs JavaScript', 'Seeded runs of the Python particle code replayed by the browser port, compared value by value.', 'c'],
  ['#/about', 'About', 'How the flame works: emission, turbulent noise, wind, cohesion, cooling, the colour ramp and the renderer.', 'b'],
];
const css = rgb => `rgb(${rgb.map(v => Math.round(v * 255)).join(',')})`;

route('home', async () => {
  const [info, D] = await Promise.all([api('/info'), api('/defaults')]);
  const stops = Array.from({ length: 11 }, (_, i) => `${css(flameColor(i / 10))} ${i * 10}%`).join(',');
  app().innerHTML = `
  <section class="hero home-hero">
    <div>
      <p class="kicker">Particles · Turbulence · Point sprites</p>
      <h1 class="glow">Candle Flame Simulator</h1>
      <p class="lead">A real-time particle-based candle flame. Hot particles rise from the wick, pushed around by a 3-D
      turbulent noise field and the wind, cooling from white-yellow to red as they age. The same particle physics as
      the Python desktop app, running live in your browser with WebGL.</p>
      <a class="btn" href="#/candle">Light the candle</a><a class="btn alt" href="#/about">How it works</a>
    </div>
    <div class="hero-candle"><canvas id="mini"></canvas></div>
  </section>
  <div class="tiles">
    <div class="tile"><b>${info.max_particles}</b><span>flame particles</span></div>
    <div class="tile"><b>${info.max_smoke}</b><span>smoke particles</span></div>
    <div class="tile"><b>${info.noise_octaves}</b><span>noise octaves (fBm)</span></div>
    <div class="tile"><b>${info.wax_colors}</b><span>wax colours</span></div>
    <div class="tile"><b>${info.sliders}</b><span>control sliders</span></div>
  </div>
  <div class="grid wide">${list(DOORS, ([href, t, d, c]) => `<a class="card door ${c}" href="${href}"><b>${t}</b><span>${d}</span></a>`)}</div>
  <h2>Pick a wax colour</h2>
  <div class="chips">${list(D.colors, c => `<a class="chip" href="#/candle?wax=${encodeURIComponent(c.name)}">
    <span class="dot" style="background:${css(c.rgb)}"></span>${esc(c.name)}</a>`)}</div>
  <h2>Temperature colour ramp</h2>
  <p class="small mute">The flame shader colours each particle by its temperature, from the fading tip to the hot core.</p>
  <div class="ramp" style="background:linear-gradient(90deg,${stops})" role="img"
    aria-label="Colour ramp from dark red at temperature 0 through orange and yellow to blue-white at 1"></div>
  <div class="ramp-scale"><span>0 · cool tip</span><span>0.5</span><span>1 · hot core</span></div>`;
  const view = new CandleView(document.getElementById('mini'), D, { label: 'Live candle flame' });
  view.camera.distance = 1.0;
  view.warm(2);
  view.show();
});
