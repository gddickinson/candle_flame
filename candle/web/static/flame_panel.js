// Control panel (port of controls.py): Flame and Wind sliders, wax colour swatches + custom colour, Scene options,
// Pause / Blow Out / Screenshot, and the fps / particle status line. Slider specs come from /api/defaults
// (candle/ui_specs.py, shared with the desktop panel).
import { slider, esc, list } from './core.js';

const css = rgb => `rgb(${rgb.map(v => Math.round(v * 255)).join(',')})`;
const hex = rgb => '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

export function buildPanel(host, view, D, { wax = null } = {}) {
  const groups = {};
  const group = (name, open = true) => {
    const d = document.createElement('details');
    d.className = 'grp'; d.open = open;
    d.innerHTML = `<summary>${esc(name)}</summary><div class="body"></div>`;
    host.appendChild(d);
    return (groups[name] = d.querySelector('.body'));
  };
  const target = s => (s.target === 'params' ? view.sim.params : s.target === 'camera' ? view.camera : view);
  const inputs = {};
  const add = s => {
    inputs[s.key] = slider(groups[s.group] || group(s.group), { id: s.key, label: s.label, min: s.lo, max: s.hi,
      value: s.default, unit: s.unit }, v => { target(s)[s.key] = v / s.scale; });
  };
  D.sliders.filter(s => s.group !== 'Scene').forEach(add);

  // Candle: wax colour presets and a custom colour
  const cg = group('Candle');
  cg.innerHTML = `<label>Wax colour <b id="wax-name">Ivory</b></label>
    <div class="swatches" role="group" aria-label="Wax colour presets">${list(D.colors, c =>
      `<button class="sw" type="button" title="${esc(c.name)}" aria-label="${esc(c.name)}" data-name="${esc(c.name)}"
        style="background:${css(c.rgb)}"></button>`)}</div>
    <label for="wax-custom">Custom colour</label><input type="color" id="wax-custom" value="${hex(view.candleRgb)}">`;
  const setWax = (rgb, name) => {
    view.candleRgb = rgb;
    cg.querySelector('#wax-name').textContent = name;
    cg.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', b.dataset.name === name));
    cg.querySelector('#wax-custom').value = hex(rgb);
    if (!view.running) view.draw();
  };
  cg.querySelectorAll('.sw').forEach(b => b.addEventListener('click', () =>
    setWax(D.colors.find(c => c.name === b.dataset.name).rgb, b.dataset.name)));
  cg.querySelector('#wax-custom').addEventListener('input', e => {
    const v = e.target.value;
    setWax([1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16) / 255), 'Custom');
  });
  const preset = D.colors.find(c => c.name === wax) || D.colors.find(c => c.rgb.join() === D.candle_color.join());
  if (preset) setWax(preset.rgb, preset.name);

  // Scene: ambient light, auto-rotate + speed, smoke
  const sg = group('Scene');
  add(D.sliders.find(s => s.key === 'ambient'));
  const check = (id, text, on, fn) => {
    const l = document.createElement('label');
    l.className = 'chk';
    l.innerHTML = `<input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${esc(text)}`;
    l.querySelector('input').addEventListener('change', e => fn(e.target.checked));
    sg.appendChild(l);
  };
  check('auto-rot', 'Auto-Rotate', view.camera.auto_rotate, v => { view.camera.auto_rotate = v; });
  add(D.sliders.find(s => s.key === 'auto_speed'));
  check('smoke', 'Show Smoke', view.showSmoke, v => { view.showSmoke = v; });

  // Actions
  const ag = group('Actions');
  ag.innerHTML = `<div class="btns"><button type="button" id="pause">Pause</button>
    <button type="button" class="alt" id="blow">Blow Out</button>
    <button type="button" class="alt" id="snap">Screenshot</button></div>
    <p class="small mute status" id="status" aria-live="off">-</p>`;
  const pause = ag.querySelector('#pause');
  pause.addEventListener('click', () => {
    view.paused = !view.paused;
    pause.textContent = view.paused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-pressed', view.paused);
  });
  ag.querySelector('#blow').addEventListener('click', () => {
    inputs.intensity.value = 0;
    inputs.intensity.dispatchEvent(new Event('input'));
  });
  ag.querySelector('#snap').addEventListener('click', () => view.screenshot());
  const status = ag.querySelector('#status');
  view.onFps = fps => { status.textContent = `${fps} fps · ${view.sim.flame.alive()} flame · ${view.sim.smoke.alive()} smoke`; };
  return inputs;
}
