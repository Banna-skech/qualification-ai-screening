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
      <div class="page-header"><h2>⚙ 设置</h2><p>演示环境与数据说明</p></div>
      <div class="card">
        <div class="card-title">演示模式状态</div>
        <div class="status-panel"><span class="status-dot done"></span><strong>已启用本地回放</strong><span class="muted">固定种子 · 不调用真实模型 · 不上传文件</span></div>
        <p class="card-desc" style="margin-top:14px">站点中的姓名、部门、岗位、证据与评分均为合成数据，仅用于展示审核工作流。</p>
      </div>
      <div class="card">
        <div class="card-title">📊 系统信息</div>
        <table class="data-table" style="max-width:400px">
          <tr><td>系统版本</td><td><strong>v2.0</strong></td></tr>
          <tr><td>数据来源</td><td>Demo fixtures（精选示例）</td></tr>
          <tr><td>AI 引擎</td><td>预置结果回放</td></tr>
          <tr><td>前端</td><td>Vanilla JS SPA</td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">演示说明</div>
        <ul class="feature-list"><li>可完整体验单人认证、批量认证与标准审核流程</li><li>报告与标准仅支持站内阅读，不提供任何下载</li><li>正式业务需结合专家复核，演示结论不用于真实决策</li></ul>
      </div>`;
  },

  async loadSettings() {
    try {
      await API.get('/api/settings');
    } catch (e) {}
  },


  destroy() { this.container = null; },
};
