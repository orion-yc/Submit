export async function request(action, payload = {}) {
  const result = await chrome.runtime.sendMessage({ channel: 'submit', action, payload });
  if (!result?.ok) throw new Error(result?.error || '扩展服务暂时不可用，请重新加载 Submit。');
  return result.data;
}

export async function tabRequest(tabId, action) {
  const result = await chrome.tabs.sendMessage(tabId, { channel: 'submit.page', action });
  if (!result?.ok) throw new Error(result?.error || '页面尚未准备好，请刷新职位页。');
  return result.data;
}
