/**
 * 报告管理页面
 */
const ReportsPage = {
  container: null,
  state: { page: 1, search: '', conclusion: '', dept: '', selected: new Set(), rtype: 'assessment' },

  async init(container, params) {
    this.container = container;
    // Always render first so DOM elements exist for showReport
    this.render();
    if (params.id) {
      // Direct detail view: hide spinner/table
      var tbl = document.getElementById('reportTableContainer');
      if (tbl) tbl.style.display = 'none';
      var fb = document.querySelector('.filter-bar');
      if (fb) fb.style.display = 'none';
      var tabs = document.getElementById('reportTabs');
      if (tabs) tabs.style.display = 'none';
      await this.showReport(params.id);
      return;
    }
    this.bindEvents();
    await this.loadData();
  },

  render() {
    this.container.innerHTML = `
      <div class="page-header">
        <h2>📋 报告管理</h2><p>查看、搜索所有审核报告</p>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="App.navigate('assessment')">📑 新建认证</button>
          <button class="btn btn-danger" id="btnBatchDelete" disabled onclick="ReportsPage.confirmBatchDelete()">🗑️ 批量删除</button>
          <button class="btn" id="btnExport" onclick="ReportsPage.exportXlsx()">📥 导出Excel</button>
        </div>
      </div>
      <div id="reportTabs" style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--gray-200)">
        <button class="report-tab active" data-type="assessment" onclick="ReportsPage.switchTab('assessment', this)"
          style="padding:10px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;border-bottom:2px solid var(--primary);margin-bottom:-2px;color:var(--primary)">📑 举证PPT审核</button>
        <button class="report-tab" data-type="standard_audit" onclick="ReportsPage.switchTab('standard_audit', this)"
          style="padding:10px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--gray-500)">📏 标准审核</button>
      </div>
      <div class="filter-bar">
        <input type="text" id="filterSearch" placeholder="搜索员工姓名/岗位...">
        <select id="filterConclusion"><option value="">全部结论</option>
          <option value="pass">✅ 通过</option><option value="conditional">⚠️ 有条件通过</option><option value="fail">❌ 不通过</option>
        </select>
        <input type="text" id="filterDept" placeholder="部门筛选">
        <button class="btn btn-primary" id="btnSearch">🔍 搜索</button>
        <button class="btn btn-ghost" id="btnReset">重置</button>
      </div>
      <div id="reportTableContainer">${Spinner.render('加载报告中...')}</div>
      <div id="reportDetail" style="display:none"></div>`;
  },

  switchTab(rtype, el) {
    this.state.rtype = rtype;
    this.state.page = 1;
    this.state.selected = new Set();
    document.querySelectorAll('.report-tab').forEach(t => {
      const active = t === el;
      t.style.borderBottomColor = active ? 'var(--primary)' : 'transparent';
      t.style.color = active ? 'var(--primary)' : 'var(--gray-500)';
      t.classList.toggle('active', active);
    });
    // 标准审核版块：调整筛选项和按钮
    const isAudit = rtype === 'standard_audit';
    document.getElementById('filterSearch').placeholder = isAudit ? '搜索标准名称...' : '搜索员工姓名/岗位...';
    document.getElementById('filterConclusion').innerHTML = isAudit
      ? `<option value="">全部结论</option><option value="pass">✅ 建议通过入库</option><option value="conditional">⚠️ 修改后入库</option><option value="fail">❌ 退回重写</option>`
      : `<option value="">全部结论</option><option value="pass">✅ 通过</option><option value="conditional">⚠️ 有条件通过</option><option value="fail">❌ 不通过</option>`;
    document.getElementById('filterDept').style.display = isAudit ? 'none' : '';
    document.getElementById('btnExport').style.display = isAudit ? 'none' : '';
    document.getElementById('reportDetail').style.display = 'none';
    this.loadData();
  },

  auditBadge(v) {
    if (v === 'pass') return '<span class="badge" style="background:var(--success-bg);color:var(--success)">✅ 建议通过入库</span>';
    if (v === 'conditional') return '<span class="badge" style="background:var(--warning-bg);color:var(--warning)">⚠️ 修改后入库</span>';
    if (v === 'fail') return '<span class="badge" style="background:var(--danger-bg);color:var(--danger)">❌ 退回重写</span>';
    return '<span class="badge">-</span>';
  },

  bindEvents() {
    document.getElementById('btnSearch').addEventListener('click', () => {
      this.state.search = document.getElementById('filterSearch').value;
      this.state.conclusion = document.getElementById('filterConclusion').value;
      this.state.dept = document.getElementById('filterDept').value;
      this.state.page = 1;
      this.loadData();
    });
    document.getElementById('btnReset').addEventListener('click', () => {
      document.getElementById('filterSearch').value = '';
      document.getElementById('filterConclusion').value = '';
      document.getElementById('filterDept').value = '';
      this.state = { page: 1, search: '', conclusion: '', dept: '', selected: new Set() };
      this.loadData();
    });
    document.getElementById('filterSearch').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btnSearch').click();
    });
  },

  async loadData() {
    try {
      const isAudit = this.state.rtype === 'standard_audit';
      const data = await API.get('/api/reports', {
        page: this.state.page, search: this.state.search,
        conclusion: this.state.conclusion, dept: this.state.dept,
        type: this.state.rtype,
      });
      const container = document.getElementById('reportTableContainer');
      const columns = isAudit ? [
        { key: 'standard_name', label: '标准名称' },
        { key: 'total_score', label: '综合评分', render: v => v != null ? `<strong>${v}</strong> / 10` : '-' },
        { key: 'conclusion', label: '审核结论', render: v => ReportsPage.auditBadge(v) },
        { key: 'created_at', label: '审核日期', render: v => Utils.formatDate(v) },
      ] : [
        { key: 'employee_name', label: '员工' },
        { key: 'employee_department', label: '部门', render: v => Utils.truncate(v, 20) },
        { key: 'applied_position', label: '申报岗位' },
        { key: 'applied_level', label: '级别' },
        { key: 'conclusion', label: '结论', render: v => Utils.conclusionBadge(v) },
        { key: 'created_at', label: '日期', render: v => Utils.formatDate(v) },
      ];
      container.innerHTML = DataTable.render({
        columns,
        rows: data.items,
        selectable: true,
        selectedIds: this.state.selected,
        rowActions: r => `
          <button class="btn btn-sm" onclick="ReportsPage.showReport(${r.id})">查看</button>
          <select class="btn btn-sm" style="padding:4px 8px;cursor:pointer" onchange="if(this.value) ReportsPage.download(${r.id}, this.value); this.value='';">
            <option value="">下载▼</option>
            <option value="docx">📄 Word</option>
            <option value="txt">📃 TXT</option>
          </select>
          <button class="btn btn-sm btn-ghost" onclick="ReportsPage.confirmDelete(${r.id})">删除</button>`,
        pagination: { page: data.page, pages: data.pages, total: data.total },
      });
      DataTable.bindEvents(container, {
        onSort: null,
        onRowClick: (id) => { if (id) this.showReport(parseInt(id)); },
        onPageChange: (p) => { this.state.page = p; this.loadData(); },
        onSelectChange: () => this.updateSelected(),
      });
      this.updateSelected();
    } catch (err) {
      document.getElementById('reportTableContainer').innerHTML =
        `<div class="empty-state"><p style="color:var(--danger)">加载失败: ${err.error || err.message}</p></div>`;
    }
  },

  updateSelected() {
    const checkboxes = document.querySelectorAll('.row-check:checked');
    this.state.selected = new Set(Array.from(checkboxes).map(cb => parseInt(cb.dataset.id)));
    const sel = Array.from(this.state.selected);
    document.getElementById('btnBatchDelete').disabled = sel.length === 0;
    document.getElementById('btnBatchDelete').textContent = sel.length > 0 ? `🗑️ 批量删除 (${sel.length})` : '🗑️ 批量删除';
  },

  async showReport(id) {
    try {
      const data = await API.get(`/api/reports/${id}`);
      const isAudit = data.report_type === 'standard_audit';
      const detail = document.getElementById('reportDetail');
      detail.style.display = 'block';
      const title = isAudit
        ? `📏 ${data.standard_name || '标准审核报告'}`
        : `📋 ${data.employee_name} — ${data.applied_position} (${data.applied_level})`;
      const badges = isAudit
        ? `<span class="badge">综合评分: <strong>${data.total_score ?? '-'}</strong> / 10</span> ${ReportsPage.auditBadge(data.conclusion)}`
        : `${Utils.conclusionBadge(data.conclusion)} <span class="badge badge-primary">${data.employee_department || ''}</span>`;
      detail.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3>${title}</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" onclick="ReportsPage.download(${id},'docx')">📄 Word</button>
            <button class="btn btn-sm" onclick="ReportsPage.download(${id},'txt')">📃 TXT</button>
            <button class="btn btn-sm" onclick="ReportsPage.exportHtml(${id})">🖨️ 打印</button>
            <button class="btn btn-sm btn-ghost" onclick="document.getElementById('reportDetail').style.display='none'">关闭</button>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:16px">${badges}</div>
        <div class="report-content">${MarkdownRenderer.render(data.raw_markdown || '')}</div>`;
      detail.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      showToast('加载报告失败', 'error');
    }
  },

  exportMd(id) { ReportsPage.download(id, 'md'); },
  exportHtml(id) { window.open(`/api/export/report/${id}/html`, '_blank'); },
  download(id, format) { window.open(`/api/export/report/${id}/${format}`, '_blank'); },
  exportXlsx() {
    const ids = Array.from(this.state.selected);
    const url = ids.length ? `/api/export/reports/xlsx?ids=${ids.join(',')}` : '/api/export/reports/xlsx';
    window.open(url, '_blank');
  },

  confirmDelete(id) {
    Modal.showConfirm('删除报告', '确认要删除这份报告吗？此操作不可撤销。', async () => {
      try {
        await API.del(`/api/reports/${id}`);
        showToast('报告已删除', 'success');
        await this.loadData();
      } catch (err) {
        showToast('删除失败: ' + err.error, 'error');
      }
    });
  },

  confirmBatchDelete() {
    const ids = Array.from(this.state.selected);
    if (ids.length === 0) return;

    Modal.showConfirm(
      '批量删除报告',
      `确认要删除选中的 ${ids.length} 份报告吗？此操作不可撤销。`,
      async () => {
        try {
          const result = await API.del('/api/reports/batch', { ids });
          showToast(result.message || `成功删除 ${ids.length} 份报告`, 'success');
          this.state.selected.clear();
          await this.loadData();
        } catch (err) {
          showToast('批量删除失败: ' + (err.error || err.message), 'error');
        }
      }
    );
  },

  destroy() { this.container = null; },
};
