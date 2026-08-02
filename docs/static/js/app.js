/**
 * 任职资格认证 AI 初筛系统 v2.0 — SPA 应用壳
 */
(function () {
  // 确保所有页面模块都已定义，若缺失则提供占位
  const requiredPages = ['DashboardPage', 'AssessmentPage', 'ReportsPage',
    'StandardsPage', 'EmployeesPage', 'BatchPage', 'SettingsPage'];
  const missingPages = requiredPages.filter(p => typeof window[p] === 'undefined' && typeof eval(p) === 'undefined');
  if (missingPages.length > 0) {
    console.error('[App] Missing page modules:', missingPages.join(', '));
  }

  const App = {
    currentPage: null,
    container: null,
    pages: {},

    init() {
      this.container = document.getElementById('pageContent');
      if (!this.container) {
        console.error('[App] pageContent not found!');
        return;
      }

      // 注册所有页面 — 安全注册，缺失模块用占位
      this.pages = {
        dashboard: typeof DashboardPage !== 'undefined' ? DashboardPage : null,
        assessment: typeof AssessmentPage !== 'undefined' ? AssessmentPage : null,
        reports: typeof ReportsPage !== 'undefined' ? ReportsPage : null,
        standards: typeof StandardsPage !== 'undefined' ? StandardsPage : null,
        employees: typeof EmployeesPage !== 'undefined' ? EmployeesPage : null,
        batch: typeof BatchPage !== 'undefined' ? BatchPage : null,
        settings: typeof SettingsPage !== 'undefined' ? SettingsPage : null,
      };

      // 初始化 Modal
      if (typeof Modal !== 'undefined') Modal.init();

      // 导航事件 — 绑定到 sidebar
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.querySelectorAll('.nav-link').forEach(link => {
          link.addEventListener('click', (e) => {
            // 只处理侧边栏内的导航链接
            const page = link.dataset.page;
            if (page) {
              e.preventDefault();
              this.navigate(page);
            }
          });
        });
      }

      // Hash 路由
      window.addEventListener('hashchange', () => this.route());

      // 初始加载
      if (!window.location.hash) {
        window.location.hash = '#dashboard';
      } else {
        this.route();
      }

      // 刷新报告计数
      this.refreshReportCount();
    },

    route() {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      const qIdx = hash.indexOf('?');
      let page = hash;
      let params = {};
      if (qIdx > -1) {
        page = hash.slice(0, qIdx);
        const qs = hash.slice(qIdx + 1);
        qs.split('&').forEach(p => {
          const eq = p.indexOf('=');
          if (eq > -1) params[decodeURIComponent(p.slice(0, eq))] = decodeURIComponent(p.slice(eq + 1));
        });
      }
      this.loadPage(page, params);
    },

    navigate(page, params = {}) {
      let hash = page;
      const parts = [];
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        }
      });
      if (parts.length) hash += '?' + parts.join('&');
      window.location.hash = hash;
    },

    async loadPage(name, params = {}) {
      // 显示加载状态
      this.container.innerHTML = '<div class="loading-state" style="display:flex"><div class="loading-pulse"></div><p>加载中...</p></div>';

      const PageModule = this.pages[name];
      if (!PageModule) {
        this.container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>页面加载失败</h3><p>模块 "${name}" 未找到</p><button class="btn btn-primary" onclick="window.location.hash='#dashboard'">返回首页</button></div>`;
        return;
      }

      // 更新导航高亮
      document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === name);
      });

      // 销毁上一个页面
      if (this.currentPage && this.currentPage.destroy) {
        try { this.currentPage.destroy(); } catch (e) { console.warn('destroy error:', e); }
      }

      // 初始化新页面
      try {
        await PageModule.init(this.container, params);
        this.currentPage = PageModule;
      } catch (err) {
        console.error('[App] Page init error:', name, err);
        this.container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><h3>加载出错</h3><p>${err.message || '未知错误'}</p><button class="btn btn-primary" onclick="window.location.hash='#dashboard'">返回首页</button></div>`;
      }
    },

    async refreshReportCount() {
      try {
        const data = await API.get('/api/reports/stats');
        const badge = document.getElementById('navReportCount');
        if (badge) badge.textContent = data.total || 0;
      } catch (e) { /* silent */ }
    },
  };

  // 暴露到全局
  window.App = App;

  // 启动
  document.addEventListener('DOMContentLoaded', () => App.init());
})();
