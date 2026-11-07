import { TaskPanel } from './panel.js';
import { Runner } from './runner.js';
import { route } from './site.js';

const panel = new TaskPanel(action => dispatch(action).catch(error => panel.log(error.message, 'error')));
const runner = new Runner(panel);

async function dispatch(action) {
  switch (action) {
    case 'start': return runner.start();
    case 'pause': return runner.pause();
    case 'stop': return runner.stop();
    case 'status': return runner.snapshot();
    default: throw new Error('未知页面操作。');
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.channel !== 'submit.page') return;
  dispatch(message.action).then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
  return true;
});

let previousRoute = '';
let restoring = false;
async function syncRoute() {
  const current = location.href;
  if (restoring || runner.busy || previousRoute === current) return;
  previousRoute = current;
  panel.host.hidden = route() === 'other';
  restoring = true;
  try { await runner.restore(); } catch (error) { panel.log(error.message, 'error'); }
  finally { restoring = false; }
}
void syncRoute();
setInterval(syncRoute, 700);
addEventListener('pageshow', () => { previousRoute = ''; void syncRoute(); });
