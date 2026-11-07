export const ACTIVITY = Object.freeze({
  online: '在线', just_now: '刚刚活跃', today: '今日活跃',
  three_days: '3 日内活跃', this_week: '本周活跃', this_month: '本月活跃'
});

export const DEFAULTS = Object.freeze({
  keywords: ['C++'], minKeywordMatch: 1,
  excludeKeywords: ['外包', '派遣', '实习'], minExcludeMatch: 1,
  experience: [], maxJobs: 10, delay: 3000,
  hrOnlineStatus: false, hrActivityAllowed: Object.keys(ACTIVITY),
  autoGreeting: false,
  greetingTemplate: '您好，我对{company}的{position}职位很感兴趣，期待与您进一步沟通。'
});

export function words(value) {
  const items = Array.isArray(value) ? value : String(value ?? '').split(/[,，\n]/);
  return [...new Set(items.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
}

function integer(value, fallback, min, max) {
  if (value === '' || value == null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.floor(number))) : fallback;
}

export function normalizeSettings(input = {}) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const allowed = Array.isArray(value.hrActivityAllowed)
    ? value.hrActivityAllowed.filter(key => key in ACTIVITY)
    : value.hrActivityLimit ? Object.keys(ACTIVITY).slice(0, Math.max(0, Object.keys(ACTIVITY).indexOf(value.hrActivityLimit)) + 1)
      : DEFAULTS.hrActivityAllowed;
  return {
    keywords: words(value.keywords ?? DEFAULTS.keywords),
    minKeywordMatch: integer(value.minKeywordMatch, 1, 0, 100),
    excludeKeywords: words(value.excludeKeywords ?? DEFAULTS.excludeKeywords),
    minExcludeMatch: integer(value.minExcludeMatch, 1, 1, 100),
    experience: words(value.experience ?? []),
    maxJobs: integer(value.maxJobs, DEFAULTS.maxJobs, 1, 500),
    delay: integer(value.delay ?? value.minDelay, DEFAULTS.delay, 1000, 600000),
    hrOnlineStatus: Boolean(value.hrOnlineStatus ?? value.hrOnline ?? DEFAULTS.hrOnlineStatus),
    hrActivityAllowed: [...new Set(allowed)],
    autoGreeting: Boolean(value.autoGreeting ?? DEFAULTS.autoGreeting),
    greetingTemplate: typeof value.greetingTemplate === 'string' ? value.greetingTemplate.slice(0, 2000) : DEFAULTS.greetingTemplate
  };
}

export function validateSettings(settings) {
  if (settings.minKeywordMatch > settings.keywords.length) return '至少匹配数量不能超过关键词数量。';
  if (settings.hrOnlineStatus && !settings.hrActivityAllowed.length) return '请至少选择一种招聘者状态。';
  if (settings.autoGreeting && !settings.greetingTemplate.trim()) return '请填写招呼语，或关闭自定义招呼语。';
  return '';
}
