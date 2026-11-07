import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, words, validateSettings } from '../app/core/settings.js';
import { csvRecords, evaluate, mergeRecords, renderGreeting } from '../app/core/rules.js';

test('migrates old settings fields and limits values to safe ranges', () => {
  const settings = normalizeSettings({ hrOnline: true, hrActivityLimit: 'today', maxJobs: 9000, minDelay: 500 });
  assert.equal(settings.hrOnlineStatus, true);
  assert.deepEqual(settings.hrActivityAllowed, ['online', 'just_now', 'today']);
  assert.equal(settings.maxJobs, 500);
  assert.equal(settings.delay, 1000);
});

test('parses Chinese and Western separators and removes duplicate terms', () => {
  assert.deepEqual(words('C++, 后端,前端，后端\nLinux'), ['C++', '后端', '前端', 'Linux']);
});

test('scores eligible jobs and explains exclusion terms', () => {
  const settings = normalizeSettings({ keywords: ['C++'], excludeKeywords: ['外包'], hrOnlineStatus: false });
  assert.deepEqual(evaluate({ title: 'C++ 工程师', experience: '' }, settings), { accepted: true, score: 100, reason: '关键词 1 项，匹配度 100' });
  assert.match(evaluate({ title: 'C++ 外包工程师' }, settings).reason, /外包/);
});

test('unknown recruiter status does not veto, while an explicit disallowed status does', () => {
  const settings = normalizeSettings({ keywords: ['后端'], hrOnlineStatus: true, hrActivityAllowed: ['online'] });
  assert.equal(evaluate({ title: '后端开发', activity: { known: false } }, settings).accepted, true);
  assert.equal(evaluate({ title: '后端开发', activity: { known: true, key: 'today', text: '今日活跃' } }, settings).accepted, false);
});

test('renders only supported greeting variables and keeps unmatched tokens intact', () => {
  assert.equal(renderGreeting('{company}-{position}-{experience}-{other}', { company: '星河', title: 'C++', experience: '3年' }), '星河-C++-3年-{other}');
});

test('merges duplicate records by id and keeps the latest timestamp', () => {
  const rows = mergeRecords([{ id: 1, appliedAt: '2026-01-01', title: '旧' }], [{ id: 1, appliedAt: '2026-02-01', title: '新' }, { title: '无 id' }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '新');
});

test('exports quoted UTF-8 CSV cells and neutralizes formula-leading values', () => {
  const csv = csvRecords([{ id: 1, title: '=cmd', company: 'A,"B"' }]);
  assert.match(csv, /^\uFEFF/);
  assert.match(csv, /"'=cmd"/);
  assert.match(csv, /"A,""B"""/);
});

test('rejects contradictory filtering settings before a task starts', () => {
  assert.match(validateSettings(normalizeSettings({ keywords: ['one'], minKeywordMatch: 2 })), /不能超过/);
});
