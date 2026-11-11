// The candle page (#/candle?wax=Name): live viewport plus the full control panel of the desktop app.
import { route, api, app } from './core.js';
import { CandleView } from './flame_view.js';
import { buildPanel } from './flame_panel.js';

route('candle', async (args, query) => {
  const D = await api('/defaults');
  app().innerHTML = `
  <div class="candle-page">
    <div class="candle-col">
      <div class="candle-stage"><canvas id="stage"></canvas></div>
      <p class="small mute">Drag (or arrow keys) to orbit, scroll (or +/-) to zoom.</p>
    </div>
    <aside class="panel candle-panel" id="panel" aria-label="Candle controls"></aside>
  </div>`;
  const view = new CandleView(document.getElementById('stage'), D);
  buildPanel(document.getElementById('panel'), view, D, { wax: query.wax });
  view.warm(1);
  view.show();
});
