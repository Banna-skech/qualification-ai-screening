/**
 * 设置页面
 */
const SettingsPage = {
  container: null,

  async init(container) {
    this.container = container;
    this.render();
    await this.loadSettings();
  },

  render() {
    this.container.innerHTML = `
      <div class="page-header"><h2>⚙️ 设置</h2><p>系统配置与API管理</p></div>
      <div class="card">
        <div class="card-title">🔑 AI API 配置</div>
        <div style="display:flex;flex-direction:column;gap:12px;max-width:500px">
          <div>
            <label style="font-size:13px;color:var(--gray-500)">API Key</label>
            <input type="password" id="setApiKey" class="select-std" placeholder="DeepSeek API Key">
          </div>
          <div>
            <label style="font-size:13px;color:var(--gray-500)">AI 模型</label>
            <input type="text" id="setModel" class="select-std" placeholder="例如: deepseek-V4-pro">
          </div>
          <div>
            <label style="font-size:13px;color:var(--gray-500)">API Base URL</label>
            <input type="text" id="setBaseUrl" class="select-std" placeholder="https://api.deepseek.com/anthropic">
          </div>
          <button class="btn btn-primary" onclick="SettingsPage.save()">💾 保存设置</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">📊 系统信息</div>
        <table class="data-table" style="max-width:400px">
          <tr><td>系统版本</td><td><strong>v2.0</strong></td></tr>
          <tr><td>数据库</td><td>SQLite</td></tr>
          <tr><td>后端框架</td><td>Flask + SQLAlchemy</td></tr>
          <tr><td>AI 引擎</td><td>DeepSeek (Anthropic SDK)</td></tr>
          <tr><td>前端</td><td>Vanilla JS SPA</td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">🔗 快捷操作</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" onclick="window.open('/api/export/reports/xlsx')">📥 导出全部报告(Excel)</button>
          <button class="btn" onclick="window.open('/api/dashboard/summary')">📊 仪表盘数据(JSON)</button>
          <button class="btn" onclick="window.open('/api/reports/stats')">📈 报告统计(JSON)</button>
        </div>
      </div>`;
  },

  async loadSettings() {
    try {
      const data = await API.get('/api/settings');
      document.getElementById('setApiKey').value = data.deepseek_api_key || '';
      document.getElementById('setModel').value = data.ai_model || '';
      document.getElementById('setBaseUrl').value = data.ai_base_url || '';
    } catch (e) {}
  },

  async save() {
    const fields = [
      { key: 'deepseek_api_key', el: 'setApiKey' },
      { key: 'ai_model', el: 'setModel' },
      { key: 'ai_base_url', el: 'setBaseUrl' },
    ];
    try {
      for (const f of fields) {
        await API.put(`/api/settings/${f.key}`, { value: document.getElementById(f.el).value });
      }
      showToast('✅ 设置已保存', 'success');
    } catch (err) {
      showToast('保存失败: ' + err.error, 'error');
    }
  },

  destroy() { this.container = null; },
};
