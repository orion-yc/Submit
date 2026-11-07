import { NativeClient } from './native-client.js';
import { Repository } from './repository.js';

const repository = new Repository(chrome.storage, new NativeClient());
const sessionKey = tab => `submit.task.${tab}`;

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.channel !== 'submit') return;
  const dispatch = async () => {
    const { action, payload = {} } = message;
    switch (action) {
      case 'settings.get': return repository.settings();
      case 'settings.save': return repository.settings(payload);
      case 'records.list': return repository.records();
      case 'records.add': return repository.addRecord(payload);
      case 'records.clear': return repository.clearRecords();
      case 'native.status': return repository.status();
      case 'task.read':
      case 'task.write':
      case 'task.clear': {
        if (sender.tab?.id == null) throw new Error('任务必须从职位页面操作。');
        const key = sessionKey(sender.tab.id);
        if (action === 'task.clear') return chrome.storage.session.remove(key);
        if (action === 'task.write') return chrome.storage.session.set({ [key]: payload });
        return (await chrome.storage.session.get(key))[key] || null;
      }
      default: throw new Error('无法识别扩展请求。');
    }
  };
  dispatch().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
  return true;
});

chrome.tabs.onRemoved.addListener(tab => chrome.storage.session.remove(sessionKey(tab)));

chrome.runtime.onInstalled.addListener(async () => {
  const key = 'submit.workspace';
  const current = (await chrome.storage.local.get(key))[key];
  if (current?.version === 2) return;
  const legacyConfig = await chrome.storage.sync.get('config');
  const { records = [] } = await chrome.storage.local.get('records');
  const state = await repository.read();
  if (legacyConfig.config) state.settings = await repository.settings(legacyConfig.config);
  if (records.length) {
    const migrated = new Map(state.records.map(row => [String(row.id), row]));
    for (const row of records) if (row?.id && !migrated.has(String(row.id))) migrated.set(String(row.id), row);
    state.records = [...migrated.values()];
  }
  state.version = 2;
  await repository.write(state);
});
