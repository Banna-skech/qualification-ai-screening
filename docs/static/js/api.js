/**
 * HTTP API 客户端
 */
const API = {
  async get(url, params = {}) {
    if (window.DEMO_MODE && window.DemoFixtures) return window.DemoFixtures.get(url, params);
    const qs = new URLSearchParams(params).toString();
    const fullUrl = qs ? `${url}?${qs}` : url;
    const resp = await fetch(fullUrl);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw err;
    }
    return resp.json();
  },

  async post(url, data = {}) {
    if (window.DEMO_MODE && window.DemoFixtures) return { success: true, message: '演示操作已完成' };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw err;
    }
    return resp.json();
  },

  async put(url, data = {}) {
    if (window.DEMO_MODE && window.DemoFixtures) return { success: true };
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw err;
    }
    return resp.json();
  },

  async del(url, data = null) {
    if (window.DEMO_MODE && window.DemoFixtures) return { success: true, message: '演示数据已更新' };
    const options = { method: 'DELETE' };
    if (data) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(data);
    }
    const resp = await fetch(url, options);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw err;
    }
    return resp.json();
  },

  async uploadFile(url, file, fieldName = 'file') {
    if (window.DEMO_MODE && window.DemoFixtures) return window.DemoFixtures.upload(file);
    const formData = new FormData();
    formData.append(fieldName, file);
    const resp = await fetch(url, { method: 'POST', body: formData });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw err;
    }
    return resp.json();
  },

  /**
   * SSE 流式请求
   * @returns AbortController for cancellation
   */
  streamSSE(url, body, callbacks) {
    const { onChunk, onDone, onError } = callbacks;
    const controller = new AbortController();

    if (window.DEMO_MODE && window.DemoFixtures) {
      const text = window.DemoFixtures.markdown();
      let i = 0;
      const tick = () => {
        if (controller.signal.aborted) return;
        if (i < text.length) { callbacks.onChunk(text.slice(i, i + 72)); i += 72; setTimeout(tick, 45); }
        else callbacks.onDone({ demo: true });
      };
      setTimeout(tick, 120);
      return controller;
    }

    (async () => {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          onError(err.error || 'Request failed');
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') onChunk(data.content);
              else if (data.type === 'done') onDone(data);
              else if (data.type === 'error') onError(data.content);
            } catch { /* skip parse errors */ }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') onError(err.message);
      }
    })();

    return controller;
  },
};
