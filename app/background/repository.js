import { normalizeSettings } from '../core/settings.js';
import { mergeRecords } from '../core/rules.js';

const KEY = 'submit.workspace';

export class Repository {
  constructor(storage, native) {
    this.storage = storage;
    this.native = native;
    this.tail = Promise.resolve();
  }

  transact(operation) {
    const next = this.tail.then(operation);
    this.tail = next.catch(() => {});
    return next;
  }

  async read() {
    const saved = (await this.storage.local.get(KEY))[KEY];
    if (saved) return saved;
    const legacy = await this.storage.sync.get('config');
    const { records = [] } = await this.storage.local.get('records');
    let config = legacy.config;
    if (!config) {
      try { config = await this.native.call('/api/config'); } catch { config = {}; }
    }
    const state = { version: 2, settings: normalizeSettings(config), records: mergeRecords(records), outbox: [] };
    await this.write(state);
    return state;
  }

  write(state) { return this.storage.local.set({ [KEY]: state }); }

  async flush(state) {
    // Keep the operation in storage until the server acknowledges it.
    while (state.outbox.length) {
      const entry = state.outbox[0];
      if (entry.method === 'DELETE' && entry.path === '/api/records') await this.native.clearRecords();
      else await this.native.call(entry.path, entry.method, entry.body);
      state.outbox.shift();
      await this.write(state);
    }
  }

  settings(value) {
    return this.transact(async () => {
      const state = await this.read();
      if (value === undefined) return state.settings;
      state.settings = normalizeSettings(value);
      state.outbox = state.outbox.filter(item => item.path !== '/api/config');
      state.outbox.push({ path: '/api/config', method: 'PUT', body: state.settings });
      await this.write(state);
      try { await this.flush(state); } catch { /* Retry on the next workspace refresh. */ }
      return state.settings;
    });
  }

  records() {
    return this.transact(async () => {
      const state = await this.read();
      try {
        await this.flush(state);
        const remote = await this.native.call('/api/records');
        if (Array.isArray(remote)) {
          state.records = mergeRecords(state.records, remote);
          await this.write(state);
        }
      } catch { /* The local record list remains available offline. */ }
      return state.records;
    });
  }

  addRecord(record) {
    return this.transact(async () => {
      if (!record?.id || !record?.title) throw new Error('职位记录缺少标识或标题。');
      const state = await this.read();
      if (state.records.some(row => row.id === record.id)) return record;
      const saved = { ...record, appliedAt: new Date().toISOString() };
      state.records = mergeRecords(state.records, [saved]);
      state.outbox.push({ path: '/api/records', method: 'POST', body: saved });
      await this.write(state);
      try { await this.flush(state); } catch { /* The record is already committed locally. */ }
      return saved;
    });
  }

  clearRecords() {
    return this.transact(async () => {
      const state = await this.read();
      state.records = [];
      state.outbox = state.outbox.filter(item => item.path !== '/api/records');
      state.outbox.push({ path: '/api/records', method: 'DELETE' });
      await this.write(state);
      try { await this.flush(state); } catch { /* Persist the deletion so old records cannot reappear. */ }
    });
  }

  status() {
    return this.transact(async () => {
      const state = await this.read();
      try {
        await this.flush(state);
        await this.native.call('/api/health');
        return { online: true, pending: state.outbox.length };
      } catch {
        return { online: false, pending: state.outbox.length };
      }
    });
  }
}
