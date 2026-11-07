(() => {
  if (globalThis.__submitLoaded) return;
  globalThis.__submitLoaded = true;
  import(chrome.runtime.getURL('app/content/index.js')).catch(error => {
    globalThis.__submitLoaded = false;
    console.error('[Submit] 页面模块加载失败', error);
  });
})();
