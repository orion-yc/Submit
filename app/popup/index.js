import { csvRecords, mergeRecords, validateSettings } from '../core/rules.js';
import { normalizeSettings, words } from '../core/settings.js';
import { request, tabRequest } from '../core/rpc.js';

const $ = id => document.getElementById(id);
let noticeTimer;
function notify(message, error = false) {
  const node = $('notice');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => node.classList.remove('show'), 2600);
}

function renderSettings(raw) {
  const settings = normalizeSettings(raw);
  $('keywords').value = settings.keywords.join(', ');
  $('minKeywordMatch').value = settings.minKeywordMatch;
  $('excludeKeywords').value = settings.excludeKeywords.join(', ');
  $('minExcludeMatch').value = settings.minExcludeMatch;
  $('maxJobs').value = settings.maxJobs;
  $('delay').value = settings.delay;
  $('hrOnline').checked = settings.hrOnlineStatus;
  $('autoGreeting').checked = settings.autoGreeting;
  $('greetingTemplate').value = settings.greetingTemplate;
  document.querySelectorAll('[name=hrActivityOption]').forEach(item => item.checked = settings.hrActivityAllowed.includes(item.value));
}

async function saveSettings() {
  const settings = normalizeSettings({
    keywords: words($('keywords').value), minKeywordMatch: $('minKeywordMatch').value,
    excludeKeywords: words($('excludeKeywords').value), minExcludeMatch: $('minExcludeMatch').value,
    maxJobs: $('maxJobs').value, delay: $('delay').value,
    hrOnlineStatus: $('hrOnline').checked,
    hrActivityAllowed: [...document.querySelectorAll('[name=hrActivityOption]:checked')].map(node => node.value),
    autoGreeting: $('autoGreeting').checked, greetingTemplate: $('greetingTemplate').value
  });
  const error = validateSettings(settings);
  if (error) throw new Error(error);
  return request('settings.save', settings);
}

function renderRecords(records) {
  const root = $('recordsList');
  root.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '这里还没有记录'; root.append(empty); return;
  }
  for (const record of mergeRecords(records)) {
    const card = document.createElement('article'); card.className = 'record';
    const title = document.createElement('div'); title.className = 'record-title'; title.textContent = record.title || '未命名职位';
    const company = document.createElement('div'); company.className = 'record-company'; company.textContent = `${record.company || '公司未识别'} · ${record.salary || '薪资未显示'}`;
    const meta = document.createElement('div'); meta.className = 'record-meta';
    const date = new Date(record.appliedAt);
    meta.textContent = `${record.activity?.text || record.hrActivityText || '招聘者状态未显示'} · 匹配 ${record.matchScore ?? '—'}${Number.isFinite(record.matchScore) ? ' 分' : ''} · ${Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN')}`;
    card.append(title, company, meta); root.append(card);
  }
}

async function refresh() {
  const [settings, records, status] = await Promise.all([request('settings.get'), request('records.list'), request('native.status')]);
  renderSettings(settings); renderRecords(records);
  const today = new Date().toDateString();
  $('totalApplied').textContent = records.length;
  $('todayApplied').textContent = records.filter(row => new Date(row.appliedAt).toDateString() === today).length;
  $('pendingSync').textContent = status.pending;
  $('serviceState').textContent = status.online ? '同步已连接' : '本机存储';
  $('serviceLamp').parentElement.classList.toggle('online', status.online);
}

document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tab,.page').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  $(`${button.dataset.tab}-page`).classList.add('active');
  if (button.dataset.tab === 'history') void refresh().catch(error => notify(error.message, true));
}));

$('saveConfig').addEventListener('click', async () => {
  try { await saveSettings(); await refresh(); notify('设置已保存'); }
  catch (error) { notify(error.message, true); }
});

$('startApply').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await saveSettings();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/^https:\/\/([\w-]+\.)?zhipin\.com\//.test(tab?.url || '')) throw new Error('请先在已登录的 BOSS 直聘职位列表页使用。');
    const result = await tabRequest(tab.id, 'start');
    notify(result.status === 'running' ? '已启动，请查看职位页右下角面板' : '任务已恢复');
  } catch (error) { notify(error.message, true); }
  finally { button.disabled = false; }
});

$('clearRecords').addEventListener('click', async () => {
  if (!confirm('清除所有本地和同步投递记录？')) return;
  try { await request('records.clear'); await refresh(); notify('记录已清除'); }
  catch (error) { notify(error.message, true); }
});

$('exportRecords').addEventListener('click', async () => {
  try {
    const records = await request('records.list');
    if (!records.length) return notify('当前没有可导出的记录', true);
    const blob = new Blob([csvRecords(records)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `submit-records-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { notify(error.message, true); }
});

void refresh().catch(error => notify(error.message, true));
