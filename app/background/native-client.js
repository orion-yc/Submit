export class NativeClient {
  constructor(base = 'http://127.0.0.1:8888') { this.base = base; }

  async call(path, method = 'GET', body) {
    const response = await fetch(this.base + path, {
      method, signal: AbortSignal.timeout(1500),
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`本地服务响应 ${response.status}`);
    return response.json();
  }

  async clearRecords() {
    const response = await fetch(`${this.base}/api/records`, { method: 'DELETE', signal: AbortSignal.timeout(1500) });
    if (!response.ok) throw new Error(`本地服务响应 ${response.status}`);
    return response.json();
  }
}
