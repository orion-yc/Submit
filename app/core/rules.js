export function evaluate(job, settings, { partial = false } = {}) {
  const text = `${job.title || ''} ${job.description || ''}`.toLocaleLowerCase();
  const hits = list => list.filter(word => text.includes(word.toLocaleLowerCase()));
  const excluded = hits(settings.excludeKeywords);
  if (excluded.length >= settings.minExcludeMatch) return { accepted: false, score: 0, reason: `命中排除词：${excluded.join('、')}` };
  const matched = hits(settings.keywords);
  const keywordPass = matched.length >= settings.minKeywordMatch;
  const experiencePass = !settings.experience.length || settings.experience.some(item => (job.experience || '').includes(item));
  const score = (keywordPass ? 70 : 0) + (experiencePass ? 30 : 0);
  if (!keywordPass && !partial) return { accepted: false, score, reason: `关键词 ${matched.length}/${settings.minKeywordMatch}` };
  if (settings.hrOnlineStatus && job.activity?.known && !settings.hrActivityAllowed.includes(job.activity.key)) {
    return { accepted: false, score, reason: `招聘者状态：${job.activity.text}` };
  }
  return { accepted: partial || keywordPass, score, reason: keywordPass ? `关键词 ${matched.length} 项，匹配度 ${score}` : '等待职位详情补充关键词' };
}

export function renderGreeting(template, job) {
  const values = { position: job.title || '该', company: job.company || '贵公司', experience: job.experience || '相关' };
  return template.replace(/\{(position|company|experience)\}/g, (_, key) => values[key]);
}

export function mergeRecords(...groups) {
  const byId = new Map();
  for (const row of groups.flat()) {
    if (!row || typeof row !== 'object' || !row.id) continue;
    const previous = byId.get(String(row.id));
    if (!previous || String(row.appliedAt || '') >= String(previous.appliedAt || '')) byId.set(String(row.id), row);
  }
  return [...byId.values()].sort((a, b) => String(b.appliedAt || '').localeCompare(String(a.appliedAt || '')));
}

export function csvRecords(records) {
  const cell = value => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
  const rows = [['职位', '公司', '薪资', '招聘者状态', '匹配度', '投递时间', '链接'],
    ...records.map(row => [row.title, row.company, row.salary, row.activity?.text || row.hrActivityText, row.matchScore, row.appliedAt, row.url])];
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
