export class TaskPanel {
  constructor(onAction) {
    this.host = document.createElement('div');
    this.host.id = 'submit-workspace';
    this.host.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483646;';
    const root = this.host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{all:initial;color-scheme:dark;font:13px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;color:#e9edf5}
      *{box-sizing:border-box}button{font:inherit;cursor:pointer;border:1px solid #30394d;color:#dce3ee;background:#212a3c;border-radius:9px;padding:8px 12px}button:disabled{opacity:.4;cursor:default}
      .card{width:320px;border:1px solid #313b50;border-radius:18px;background:#111827;box-shadow:0 16px 55px #0007;overflow:hidden}
      header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #293247}strong{font-size:17px;letter-spacing:-.5px}small{color:#95a2ba;font-size:11px}.controls{display:flex;gap:7px;padding:12px}.primary{background:#fa3d66;border-color:#fa3d66;color:#fff}
      ol{padding:0 14px 12px;margin:0;list-style:none;max-height:225px;overflow:auto}li{padding:8px 0;border-bottom:1px solid #ffffff0a;font-size:12px;word-break:break-word}li[data-level=error]{color:#ff8c9e}li[data-level=success]{color:#67dcc5}time{color:#74839d;margin-right:7px;font-size:10px}.collapsed .controls,.collapsed ol{display:none}.collapsed{width:220px}.state{padding:0 14px 8px;color:#93a4bf;font-size:11px}[data-action=collapse]{padding:1px 8px;border:0;background:transparent}
    </style><section class="card"><header><div><strong>Submit</strong> <small>投递工作台</small></div><button data-action="collapse" aria-label="收起工作台">−</button></header><div class="controls"><button class="primary" data-action="start">开始</button><button data-action="pause" disabled>暂停</button><button data-action="stop" disabled>停止</button></div><div class="state" role="status">等待开始</div><ol aria-label="运行日志" aria-live="polite"></ol></section>`;
    this.root = root;
    root.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'collapse') {
        const collapsed = root.querySelector('.card').classList.toggle('collapsed');
        event.target.textContent = collapsed ? '+' : '−';
      } else if (action) onAction(action);
    });
    document.documentElement.appendChild(this.host);
  }

  update(state) {
    this.root.querySelector('[data-action=start]').disabled = ['running', 'paused', 'navigating'].includes(state.status);
    this.root.querySelector('[data-action=pause]').disabled = !['running', 'paused'].includes(state.status);
    this.root.querySelector('[data-action=pause]').textContent = state.status === 'paused' ? '继续' : '暂停';
    this.root.querySelector('[data-action=stop]').disabled = !['running', 'paused', 'navigating'].includes(state.status);
    const labels = { idle: '等待开始', running: '正在筛选', paused: '已暂停', navigating: '等待页面跳转', completed: '本轮结束', stopped: '已停止', error: '需要处理' };
    this.root.querySelector('.state').textContent = `${labels[state.status] || state.status} · 本轮成功 ${state.applied || 0} · 已检查 ${state.checked || 0}`;
  }

  log(message, level = 'info') {
    const list = this.root.querySelector('ol');
    const row = document.createElement('li');
    row.dataset.level = level;
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    row.append(time, document.createTextNode(message));
    list.appendChild(row);
    while (list.children.length > 120) list.firstChild.remove();
    list.scrollTop = list.scrollHeight;
  }
}
