const CARD = '.job-card-wrapper, li.job-card-box, li[class*="job-card"], .job-list-item';
const DETAIL = '.job-detail-box, .job-detail-container, .job-detail-content, .job-detail, .job-banner';
const text = node => node?.textContent.replace(/\s+/g, ' ').trim() || '';
export const visible = node => Boolean(node?.isConnected && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
const usable = node => visible(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true';
const first = (root, selector) => [...root.querySelectorAll(selector)].find(visible);
const buttons = root => [...root.querySelectorAll('button, a, [role="button"]')].filter(usable);

export function route() {
  if (location.pathname.startsWith('/web/geek/chat')) return 'chat';
  if (location.pathname.startsWith('/job_detail/') || location.pathname.includes('/web/geek/job_detail/')) return 'detail';
  return location.pathname.startsWith('/web/geek/job') ? 'list' : 'other';
}

export function activity(root) {
  const online = first(root, '.boss-online-tag, .boss-online-icon');
  if (online) return { key: 'online', text: text(online) || '在线', known: true };
  const value = text(first(root, '.boss-active-time, .boss-info .active-time, .recruiter-active'));
  const rules = [
    ['online', /^在线$/], ['just_now', /刚刚活跃/], ['today', /今日活跃|今天活跃/],
    ['three_days', /[3三][日天]内活跃/], ['this_week', /本周(?:内)?活跃/], ['this_month', /本月(?:内)?活跃/]
  ];
  const found = rules.find(([, expression]) => expression.test(value));
  return { key: found?.[0] || 'unknown', text: value || '未显示', known: Boolean(found) };
}

export function scan() {
  const jobs = new Map();
  for (const card of document.querySelectorAll(CARD)) {
    if (!visible(card)) continue;
    const link = card.querySelector('a[href*="/job_detail/"]');
    const id = link?.href.match(/\/job_detail\/([^/?#]+)/)?.[1];
    const title = text(first(card, '.job-name, .job-title, [class*="job-name"]'));
    if (!id || !title || jobs.has(id)) continue;
    jobs.set(id, {
      id, title, url: link.href,
      company: text(first(card, '.company-name, .company-text')),
      salary: text(first(card, '.salary, [class*="salary"]')),
      experience: text(first(card, '.tag-list li, .job-limit li, [class*="experience"]')),
      description: text(first(card, '.job-desc, .info-desc')),
      activity: activity(card), card
    });
  }
  return [...jobs.values()];
}

export function serializable(job) {
  const { card, ...data } = job;
  return data;
}

export function selectedDetail(job) {
  if (route() === 'detail' && !location.pathname.includes(job.id)) return null;
  const roots = [...document.querySelectorAll(DETAIL)].filter(visible);
  const root = roots.find(node => {
    const content = text(node);
    return content.includes(job.title) && (!job.company || content.includes(job.company));
  });
  if (root) return root.closest('.job-detail-box, .job-detail-container, .job-detail') || root;
  if (route() === 'detail' && text(document.body).includes(job.title)) return document.body;
  return null;
}

export function readDetail(job) {
  const root = selectedDetail(job);
  if (!root) return null;
  const descriptionRoot = root.querySelector('.job-sec-text, .job-detail-text, .job-detail-section');
  const status = activity(root);
  return {
    ...serializable(job),
    description: text(descriptionRoot) || job.description,
    salary: text(first(root, '.salary, [class*="salary"]')) || job.salary,
    activity: status.known ? status : job.activity
  };
}

export function openDetail(job) {
  job.card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  // Some cards put their navigation handler on a link with target="_blank".
  const link = job.card.querySelector('a[href*="/job_detail/"]');
  if (link) {
    const target = link.getAttribute('target');
    link.setAttribute('target', '_self');
    link.click();
    if (target === null) link.removeAttribute('target'); else link.setAttribute('target', target);
  } else job.card.click();
}

export function communicationButton(job) {
  const root = selectedDetail(job);
  return root ? buttons(root).find(node => text(node).replace(/\s/g, '') === '立即沟通') : null;
}

export function communicationState(job) {
  if (route() === 'chat') return conversationMatches(job) ? 'chat' : null;
  const dialogs = [...document.querySelectorAll('[role="dialog"], .dialog-container, .greet-boss-dialog, .dialog-wrap')].filter(visible);
  for (const dialog of dialogs) {
    if (buttons(dialog).some(node => text(node).includes('继续沟通'))) return { dialog };
  }
  const root = selectedDetail(job);
  if (root && buttons(root).some(node => /^(继续沟通|已沟通)$/.test(text(node)))) return 'confirmed';
  return null;
}

export function continueChat(dialog) {
  const button = buttons(dialog).find(node => text(node).includes('继续沟通'));
  button?.click();
  return Boolean(button);
}

export function dismissDialog(dialog) {
  buttons(dialog).find(node => /留在此页|取消/.test(text(node)))?.click();
}

export function conversationMatches(job) {
  const headers = document.querySelectorAll('.chat-position, .chat-job-info, .chat-info, .chat-header, .chat-title, .chat-container .job-card');
  return [...headers].some(node => text(node).includes(job.title) && (!job.company || text(node).includes(job.company)))
    || Boolean(document.querySelector(`a[href*="/job_detail/${CSS.escape(job.id)}"]`));
}

export function greetingEditor() {
  return first(document, '#chat-input, .chat-input [contenteditable="true"], .chat-editor [contenteditable="true"], textarea.chat-input');
}

export function writeGreeting(editor, message) {
  editor.focus();
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    const proto = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(editor, message);
  } else {
    editor.replaceChildren(document.createTextNode(message));
  }
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

export function sendGreeting(editor) {
  const area = editor.closest('.chat-container, .chat-box, .chat-conversation') || document;
  const button = buttons(area).find(node => text(node).replace(/\s/g, '') === '发送');
  if (!button) return false;
  button.click();
  return true;
}

export function hasGreeting(message) {
  return [...document.querySelectorAll('.message-item .text, .message-item .message-text, .message-content')].some(node => text(node) === message);
}

export function loadMore() {
  const cards = [...document.querySelectorAll(CARD)].filter(visible);
  cards.at(-1)?.scrollIntoView({ block: 'end', behavior: 'smooth' });
}
