/**
 * 员工管理页面
 */
const EmployeesPage = {
  container: null,
  state: { page: 1, search: '', dept: '' },

  async init(container) {
    this.container = container;
    this.render();
    this.bindEvents();
    await this.loadData();
  },

  render() {
    this.container.innerHTML = `
      <div class="page-header">
        <h2>👥 员工管理</h2><p>管理员工信息，追踪认证历史</p>
        <div class="page-actions">
          <button class="btn" id="btnEmpSync" title="从已有认证报告和举证材料PPT中同步提取员工信息">🔄 同步员工</button>
          <button class="btn btn-primary" onclick="EmployeesPage.showAdd()">➕ 添加员工</button>
        </div>
      </div>
      <div class="filter-bar">
        <input type="text" id="empSearch" placeholder="搜索姓名/岗位...">
        <input type="text" id="empDept" placeholder="部门筛选">
        <button class="btn btn-primary" id="btnEmpSearch">🔍 搜索</button>
      </div>
      <div id="empListContainer">${Spinner.render()}</div>
      <div id="empDetail" style="display:none"></div>`;
  },

  bindEvents() {
    document.getElementById('btnEmpSearch').addEventListener('click', () => {
      this.state.search = document.getElementById('empSearch').value;
      this.state.dept = document.getElementById('empDept').value;
      this.state.page = 1;
      this.loadData();
    });
    document.getElementById('btnEmpSync').addEventListener('click', async () => {
      const btn = document.getElementById('btnEmpSync');
      btn.disabled = true; btn.textContent = '⏳ 同步中...';
      try {
        const res = await API.post('/api/employees/sync', {});
        showToast(res.message, 'success');
        await this.loadData();
      } catch (e) {
        showToast('同步失败: ' + (e.error || e.message), 'error');
      }
      btn.disabled = false; btn.textContent = '🔄 同步员工';
    });
  },

  async loadData() {
    try {
      const data = await API.get('/api/employees', this.state);
      const container = document.getElementById('empListContainer');
      container.innerHTML = DataTable.render({
        columns: [
          { key: 'name', label: '姓名' },
          { key: 'department', label: '部门' },
          { key: 'position', label: '岗位' },
          { key: 'years_experience', label: '行业年限', render: v => v != null ? v + ' 年' : '-' },
          { key: 'report_count', label: '认证次数', render: v => `<strong>${v}</strong>` },
          { key: 'created_at', label: '创建日期', render: v => Utils.formatDate(v) },
        ],
        rows: data.items,
        rowActions: r => `
          <button class="btn btn-sm" onclick="EmployeesPage.showDetail(${r.id})">查看</button>
          <button class="btn btn-sm btn-ghost" onclick="App.navigate('reports',{search:'${r.name}'})">报告</button>
          <button class="btn btn-sm btn-ghost" onclick="EmployeesPage.confirmDelete(${r.id}, '${r.name}')">删除</button>`,
        pagination: { page: data.page, pages: data.pages, total: data.total },
      });
      DataTable.bindEvents(container, {
        onRowClick: (id) => { if (id) this.showDetail(parseInt(id)); },
        onPageChange: (p) => { this.state.page = p; this.loadData(); },
      });
    } catch (err) {
      showToast('加载失败: ' + err.error, 'error');
    }
  },

  async showDetail(id) {
    try {
      const data = await API.get(`/api/employees/${id}`);
      const timeline = await API.get(`/api/employees/${id}/timeline`);

      const detail = document.getElementById('empDetail');
      detail.style.display = 'block';
      detail.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:16px">
          <h3>👤 ${Utils.escapeHtml(data.name)} <span class="badge badge-primary">${data.department || ''}</span></h3>
          <button class="btn btn-sm btn-ghost" onclick="document.getElementById('empDetail').style.display='none'">关闭</button>
        </div>
        <div class="card">
          <div class="card-title">基本信息</div>
          <table class="data-table">
            <tr><td>岗位</td><td>${data.position || '-'}</td><td>学历</td><td>${data.education || '-'}</td></tr>
            <tr><td>行业年限</td><td>${data.years_experience != null ? data.years_experience + ' 年' : '-'}</td><td>本岗位年限</td><td>${data.years_in_current != null ? data.years_in_current + ' 年' : '-'}</td></tr>
            ${(data.extra || {}).管理经验 ? `<tr><td>管理经验</td><td colspan="3">${data.extra.管理经验}</td></tr>` : ''}
          </table>
        </div>
        <div class="card" style="margin-top:12px">
          <div class="card-title">📋 认证报告</div>
          <div class="chart-container"><canvas id="timelineChart"></canvas></div>
          ${DataTable.render({
            columns: [
              { key: 'applied_position', label: '申报岗位' },
              { key: 'applied_level', label: '级别' },
              { key: 'total_score', label: '总分', render: v => `<strong>${v ?? '-'}</strong>` },
              { key: 'conclusion', label: '结论', render: v => Utils.conclusionBadge(v) },
              { key: 'created_at', label: '日期', render: v => Utils.formatDate(v) },
            ],
            rows: data.reports || [],
            rowActions: r => `<button class="btn btn-sm" onclick="ReportsPage.showReport(${r.id})">查看报告</button>`,
          })}
        </div>`;

      // Timeline chart
      const tl = timeline.timeline || [];
      if (tl.length > 0) {
        Chart.line(document.getElementById('timelineChart'),
          tl.map(t => ({ label: Utils.formatDate(t.date), value: t.total_score || 0 })));
      }
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      showToast('加载员工详情失败', 'error');
    }
  },

  showAdd() {
    Modal.show('➕ 添加员工', `
      <div style="display:flex;flex-direction:column;gap:10px">
        <input type="text" id="addName" class="select-std" placeholder="姓名 *">
        <input type="text" id="addDept" class="select-std" placeholder="部门">
        <input type="text" id="addPos" class="select-std" placeholder="岗位">
        <input type="text" id="addEdu" class="select-std" placeholder="学历">
        <input type="number" id="addYrs" class="select-std" placeholder="行业年限">
        <input type="text" id="addEmail" class="select-std" placeholder="邮箱">
      </div>`,
      `<button class="btn" onclick="Modal.hide()">取消</button>
       <button class="btn btn-primary" id="btnAddSave">保存</button>`);
    document.getElementById('btnAddSave').addEventListener('click', async () => {
      const body = {
        name: document.getElementById('addName').value,
        department: document.getElementById('addDept').value,
        position: document.getElementById('addPos').value,
        education: document.getElementById('addEdu').value,
        years_experience: parseInt(document.getElementById('addYrs').value) || null,
        email: document.getElementById('addEmail').value,
      };
      if (!body.name) { showToast('请输入姓名', 'warning'); return; }
      try {
        await API.post('/api/employees', body);
        showToast('✅ 员工已添加', 'success');
        Modal.hide();
        this.loadData();
      } catch (err) { showToast('保存失败: ' + err.error, 'error'); }
    });
  },

  confirmDelete(id, name) {
    Modal.showConfirm('删除员工', `确认要删除员工 "${name}" 吗？此操作不可撤销。`, async () => {
      try {
        await API.del(`/api/employees/${id}`);
        showToast('员工已删除', 'success');
        await this.loadData();
      } catch (err) {
        showToast('删除失败: ' + (err.error || err.message), 'error');
      }
    });
  },

  destroy() { this.container = null; },
};
