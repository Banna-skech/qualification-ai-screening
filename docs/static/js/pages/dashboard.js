/**
 * 仪表盘页面
 */
const DashboardPage = {
  container: null,

  async init(container) {
    this.container = container;
    this.render();
    await this.loadData();
  },

  render() {
    this.container.innerHTML = `
      <div class="page-header"><h2>📊 仪表盘</h2><p>认证系统全局概览</p></div>
      <div class="stats-grid" id="dashStats"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="card"><div class="card-title">📈 通过率趋势</div><div class="chart-container"><canvas id="trendChart"></canvas></div></div>
        <div class="card"><div class="card-title">🎯 认证结论分布</div><div class="chart-container"><canvas id="conclusionChart" style="max-height:220px"></canvas></div></div>
      </div>
      <div class="card" style="margin-top:20px"><div class="card-title">📋 最近报告</div><div id="dashRecentReports"></div></div>`;
  },

  async loadData() {
    try {
      const [summary, trend, deptData] = await Promise.all([
        API.get('/api/dashboard/summary'),
        API.get('/api/dashboard/pass-rate', { months: 6 }),
        API.get('/api/reports', { per_page: 5 }),
      ]);

      // Stats cards
      document.getElementById('dashStats').innerHTML = `
        <div class="stat-card accent-primary">
          <div class="stat-value">${summary.total_reports}</div><div class="stat-label">总报告数</div></div>
        <div class="stat-card accent-success">
          <div class="stat-value">${summary.pass_rate}%</div><div class="stat-label">通过率</div></div>
        <div class="stat-card accent-warning">
          <div class="stat-value">${summary.conditional_count}</div><div class="stat-label">有条件通过</div></div>
        <div class="stat-card">
          <div class="stat-value">${summary.active_standards}</div><div class="stat-label">活跃标准</div></div>
        <div class="stat-card">
          <div class="stat-value">${summary.employee_count}</div><div class="stat-label">员工数</div></div>
        <div class="stat-card accent-primary">
          <div class="stat-value">${summary.this_month}</div><div class="stat-label">本月新增</div></div>`;

      // Trend chart
      const trendData = (trend.trend || []).map(t => ({ label: t.month.slice(5), value: t.pass_rate }));
      Chart.line(document.getElementById('trendChart'), trendData);

      // Conclusion doughnut
      Chart.doughnut(document.getElementById('conclusionChart'), [
        { label: '通过', value: summary.pass_count, color: '#10b981' },
        { label: '有条件通过', value: summary.conditional_count, color: '#f59e0b' },
        { label: '不通过', value: summary.fail_count, color: '#ef4444' },
      ].filter(d => d.value > 0));

      // Recent reports
      document.getElementById('dashRecentReports').innerHTML = DataTable.render({
        columns: [
          { key: 'employee_name', label: '员工' },
          { key: 'applied_position', label: '岗位' },
          { key: 'applied_level', label: '级别' },
          { key: 'total_score', label: '总分', render: v => `<strong>${v ?? '-'}</strong>` },
          { key: 'conclusion', label: '结论', render: v => Utils.conclusionBadge(v) },
          { key: 'created_at', label: '日期', render: v => Utils.formatDate(v) },
        ],
        rows: (summary.total_reports > 0 ? deptData.items || [] : []),
        rowActions: r => `<button class="btn btn-sm" onclick="App.navigate('reports',{id:${r.id}})">查看</button>`,
      });

      // Update nav badge
      const badge = document.getElementById('navReportCount');
      if (badge) badge.textContent = summary.total_reports;

    } catch (err) {
      this.container.innerHTML += `<p style="color:var(--danger)">加载失败: ${err.error || err.message}</p>`;
    }
  },

  destroy() { this.container = null; },
};
