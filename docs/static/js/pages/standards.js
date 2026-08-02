/**
 * 标准管理页面
 */
const StandardsPage = {
  container: null,

  async init(container) {
    this.container = container;
    this.render();
    await this.loadData();
  },

  render() {
    this.container.innerHTML = `
      <div class="page-header">
        <h2>📏 标准管理</h2><p>查看所有岗位任职资格标准，点击按钮下载原文件</p>
      </div>
      <div class="filter-bar">
        <select id="filterSeq"><option value="">全部序列</option>
          <option value="T">T序列(技术)</option><option value="S">S序列(营销)</option><option value="P">P序列(职能)</option>
        </select>
        <input type="text" id="filterStdSearch" placeholder="搜索标准名称...">
        <button class="btn btn-primary" id="btnStdSearch">🔍 筛选</button>
        <button class="btn" id="btnExtractSummary" title="扫描岗位标准文件夹和注册表，同步新增/变更的标准到系统，并重新提取职责/部门/版本等摘要信息">🔄 同步刷新标准</button>
        <button class="btn btn-primary" id="btnAuditStd" title="上传新岗位标准文件，按审核要求进行入库前AI审核">🆕 新标准审核</button>
      </div>
      <div id="stdListContainer">${Spinner.render()}</div>`;
    document.getElementById('btnStdSearch').addEventListener('click', () => this.loadData());
    document.getElementById('btnAuditStd').addEventListener('click', () => this.showAudit());
    document.getElementById('btnExtractSummary').addEventListener('click', async () => {
      const btn = document.getElementById('btnExtractSummary');
      btn.disabled = true; btn.textContent = '⏳ 同步刷新中...';
      try {
        const res = await API.post('/api/v2/standards/refresh', {});
        showToast(res.message, 'success');
        await this.loadData();
      } catch (e) {
        showToast('同步刷新失败: ' + (e.error || e.message), 'error');
      }
      btn.disabled = false; btn.textContent = '🔄 同步刷新标准';
    });
    document.getElementById('filterStdSearch').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.loadData();
    });
  },

  async loadData() {
    const seq = document.getElementById('filterSeq').value;
    const search = document.getElementById('filterStdSearch').value;
    try {
      const data = await API.get('/api/v2/standards', { sequence: seq, search });
      const items = data.items || [];

      // 首次使用时数据库无摘要数据 → 自动从标准文件提取一次
      if (items.length > 0 && items.every(s => !s.duty_count) && !this._extractTried) {
        this._extractTried = true;
        document.getElementById('stdListContainer').innerHTML = Spinner.renderInline('首次加载，正在从标准文件提取摘要信息...');
        try {
          const res = await API.post('/api/v2/standards/extract-summaries', {});
          showToast(res.message, 'success');
        } catch (e) { /* 提取失败不阻塞列表显示 */ }
        return this.loadData();
      }

      // Show as cards
      document.getElementById('stdListContainer').innerHTML = items.length === 0 ?
        '<div class="empty-state"><div class="empty-icon">📏</div><h3>暂无标准</h3></div>' :
        items.map(s => {
          const hasFile = s.file_name && s.file_path;
          const levels = s.level_coverage || [];
          const duties = (s.description || '').split(/[;；]/).filter(Boolean);
          return `
          <div class="card" style="transition:all 0.2s">
            <div style="display:flex;justify-content:space-between;align-items:start">
              <div>
                <strong style="font-size:16px">${Utils.escapeHtml(s.name)}</strong>
                <span class="badge badge-primary" style="margin-left:8px">${s.sequence}序列</span>
                ${s.version ? `<span class="badge" style="margin-left:4px;background:var(--gray-100);color:var(--gray-600)">${s.version}</span>` : ''}
              </div>
              <div style="display:flex;gap:6px">
                ${hasFile ? `<span style="font-size:12px;color:var(--gray-400)">📄 ${Utils.escapeHtml(s.file_name)}</span>` : ''}
              </div>
            </div>
            <div style="font-size:13px;color:var(--gray-500);margin-top:6px;display:flex;gap:14px;flex-wrap:wrap">
              <span>📋 关键职责 <strong style="color:var(--gray-700)">${s.duty_count || '?'}</strong> 项</span>
              <span>📊 覆盖级别 <strong style="color:var(--gray-700)">${levels.length}</strong> 级${levels.length ? `（${levels[0]} ~ ${levels[levels.length - 1]}）` : ''}</span>
              ${(s.department_scope || []).length ? `<span>🏢 ${(s.department_scope || []).slice(0, 3).map(Utils.escapeHtml).join('、')}</span>` : ''}
            </div>
            ${duties.length > 0 ? `
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
              ${duties.slice(0, 8).map(d => `<span style="font-size:12px;background:var(--primary-bg);color:var(--primary);padding:2px 8px;border-radius:10px">${Utils.escapeHtml(d)}</span>`).join('')}
              ${duties.length > 8 ? `<span style="font-size:12px;color:var(--gray-500);padding:2px 4px">+${duties.length - 8}</span>` : ''}
            </div>` : ''}
            ${s.keywords && s.keywords.length > 0 ? `
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px">
              关键词: ${(s.keywords || []).join(', ')}
            </div>` : ''}
          </div>`;
        }).join('');
    } catch (err) {
      showToast('加载标准失败: ' + err.error, 'error');
    }
  },

  async showDetail(id) {
    try {
      const data = await API.get(`/api/v2/standards/${id}`);
      const duties = data.duties || [];

      let html = `<h3>${Utils.escapeHtml(data.name)} <span class="badge badge-primary">${data.sequence}序列</span></h3>
        <div style="font-size:13px;color:var(--gray-500);margin-bottom:16px">
          版本: ${data.version} | 状态: ${data.status}
        </div>
        <div class="card" style="margin-bottom:12px">
          <div class="card-title">基本信息</div>
          <table class="data-table">
            <tr><td style="width:120px">覆盖级别</td><td>${(data.level_coverage || []).join(', ') || '-'}</td></tr>
            <tr><td>覆盖部门</td><td>${(data.department_scope || []).join(', ') || '-'}</td></tr>
            <tr><td>关键词</td><td>${(data.keywords || []).join(', ') || '-'}</td></tr>
            ${data.special_rules ? `<tr><td>特殊规则</td><td>${data.special_rules}</td></tr>` : ''}
            ${data.file_name ? `<tr><td>标准文件</td><td>📄 ${data.file_name}</td></tr>` : ''}
            ${data.description ? `<tr><td>描述</td><td>${data.description}</td></tr>` : ''}
          </table>
        </div>`;

      if (duties.length > 0) {
        const dutyGroups = {};
        duties.forEach(d => {
          const key = d.duty_name || `职责${d.duty_number}`;
          if (!dutyGroups[key]) dutyGroups[key] = [];
          dutyGroups[key].push(d);
        });

        Object.entries(dutyGroups).forEach(([name, items]) => {
          html += `<div class="card" style="margin-bottom:12px"><div class="card-title">${Utils.escapeHtml(name)}</div>`;
          html += '<table class="data-table"><thead><tr><th>条目</th><th>类型</th><th>级别</th><th>描述</th></tr></thead><tbody>';
          items.forEach(d => {
            html += `<tr>
              <td>${d.item_number || ''}</td>
              <td>${d.item_type === 'key_result' ? '关键成果' : d.item_type === 'key_behavior' ? '关键行为' : d.item_type}</td>
              <td>${d.level || 'ALL'}</td>
              <td>${Utils.truncate(d.description, 200)}</td></tr>`;
          });
          html += '</tbody></table></div>';
        });
      } else {
        html += `<div class="card" style="margin-bottom:12px;background:var(--warning-bg)">
          <div class="card-title">⚠️ 暂无结构化职责数据</div>
          <p style="font-size:13px;color:var(--gray-600)">
            该标准尚未解析文件内容。您可以下载原文件查看详细内容。
          </p>
        </div>`;
      }

      html += `<div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn" onclick="StandardsPage.loadData();document.getElementById('stdDetail').style.display='none'">返回列表</button>
      </div>`;

      document.getElementById('stdDetail').style.display = 'block';
      document.getElementById('stdDetail').innerHTML = html;
    } catch (err) {
      showToast('加载详情失败', 'error');
    }
  },

  showGenerate() {
    Modal.show('🤖 AI 生成标准', `
      <p style="font-size:14px;color:var(--gray-500);margin-bottom:16px">输入岗位信息，AI将自动生成完整的任职资格标准</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <input type="text" id="genName" class="select-std" placeholder="岗位名称（如：电商运营专员）">
        <select id="genSeq" class="select-std"><option value="S">S序列(营销)</option><option value="P">P序列(职能)</option><option value="T">T序列(技术)</option></select>
        <input type="text" id="genDept" class="select-std" placeholder="覆盖部门（如：电商事业部）">
        <textarea id="genDesc" class="select-std" rows="4" placeholder="岗位描述、主要职责、特殊要求等..."></textarea>
        <div style="font-size:12px;color:var(--gray-500)">支持级别: 助理(T1/P1/S1)、初级(2-1/2-2/2-3)、中级(3-1/3-2/3-3)、高级(4-1/4-2/4-3)、专家(5-1/5-2/5-3)</div>
      </div>
      <div id="genResult" style="max-height:400px;overflow-y:auto;margin-top:16px"></div>`,
      `<button class="btn" onclick="Modal.hide()">关闭</button>
       <button class="btn btn-primary" id="btnGenStart">🤖 开始生成</button>`);

    document.getElementById('btnGenStart').addEventListener('click', () => {
      const name = document.getElementById('genName').value.trim();
      if (!name) { showToast('请输入岗位名称', 'warning'); return; }
      this.doGenerate();
    });
  },

  doGenerate() {
    const body = {
      job_name: document.getElementById('genName').value,
      sequence: document.getElementById('genSeq').value,
      department: document.getElementById('genDept').value,
      description: document.getElementById('genDesc').value,
    };
    document.getElementById('btnGenStart').disabled = true;
    let markdown = '';
    const resultEl = document.getElementById('genResult');

    API.streamSSE('/api/v2/standards/generate', body, {
      onChunk(text) {
        markdown += text;
        resultEl.innerHTML = '<div class="report-content">' + MarkdownRenderer.render(markdown) + '</div>';
      },
      onDone() {
        showToast('✅ 标准生成完成！', 'success');
        document.getElementById('btnGenStart').disabled = false;
        resultEl.innerHTML += '<button class="btn btn-primary" style="margin-top:12px" onclick="Modal.hide();StandardsPage.loadData()">关闭并刷新列表</button>';
      },
      onError(msg) {
        showToast('生成失败: ' + msg, 'error');
        document.getElementById('btnGenStart').disabled = false;
      },
    });
  },

  // ============================================================
  // 新岗位标准入库前审核
  // ============================================================
  showAudit() {
    this._auditFile = null;
    this._auditMarkdown = '';
    Modal.show('🆕 新岗位标准审核', `
      <p style="font-size:13px;color:var(--gray-500);margin-bottom:12px">
        上传新建的岗位标准文件，系统将按<strong>结构完整性、关键成果与关键行为、职级区分度、行业对标充分性</strong>四个维度进行入库前审核，
        完成后自动保存Word版审核报告到输出报告文件夹。
      </p>
      <div class="upload-zone" id="auditUploadZone" style="padding:24px">
        <input type="file" id="auditFileInput" accept=".xlsx,.pdf" hidden>
        <div class="upload-icon">📏</div>
        <div class="upload-text"><strong>拖拽新标准文件到此处</strong><span>或点击选择（.xlsx / .pdf）</span></div>
      </div>
      <div id="auditFileInfo" style="display:none;margin-top:10px;padding:10px;background:var(--gray-50);border-radius:var(--radius-sm);font-size:13px"></div>
      <div id="auditResult" style="max-height:55vh;overflow-y:auto;margin-top:12px"></div>`,
      `<button class="btn" onclick="Modal.hide()">关闭</button>
       <button class="btn btn-primary" id="btnAuditStart" disabled>🔍 开始审核</button>`);

    const zone = document.getElementById('auditUploadZone');
    const input = document.getElementById('auditFileInput');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) this.handleAuditFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => { if (input.files.length) this.handleAuditFile(input.files[0]); });
    document.getElementById('btnAuditStart').addEventListener('click', () => this.doAudit());
  },

  async handleAuditFile(file) {
    if (!/\.(xlsx|pdf)$/i.test(file.name)) { showToast('仅支持 .xlsx / .pdf 格式', 'warning'); return; }
    const info = document.getElementById('auditFileInfo');
    info.style.display = 'block';
    info.innerHTML = `⏳ 正在解析 ${Utils.escapeHtml(file.name)} ...`;
    try {
      const data = await API.uploadFile('/api/upload-standard', file);
      this._auditFile = { name: file.name, text: data.full_text };
      info.innerHTML = `📄 <strong>${Utils.escapeHtml(file.name)}</strong> — 解析成功，共 ${data.full_text.length} 字`;
      document.getElementById('btnAuditStart').disabled = false;
    } catch (err) {
      info.innerHTML = `❌ 解析失败: ${err.error || ''}`;
      document.getElementById('btnAuditStart').disabled = true;
    }
  },

  doAudit() {
    if (!this._auditFile) return;
    const btn = document.getElementById('btnAuditStart');
    btn.disabled = true; btn.textContent = '⏳ 审核中...';
    const resultEl = document.getElementById('auditResult');
    resultEl.innerHTML = Spinner.renderInline('AI 正在审核标准...');
    let markdown = '';
    const self = this;

    API.streamSSE('/api/v2/standards/audit', {
      standard_text: this._auditFile.text,
      standard_filename: this._auditFile.name,
    }, {
      onChunk(text) {
        markdown += text;
        resultEl.innerHTML = '<div class="report-content">' + MarkdownRenderer.render(markdown) + '</div>';
        resultEl.scrollTop = resultEl.scrollHeight;
      },
      onDone() {
        self._auditMarkdown = markdown;
        showToast('✅ 审核完成', 'success');
        btn.textContent = '💾 保存中...';
        // 审核完成后自动保存Word报告到输出报告文件夹
        self.saveAuditReport().then(ok => {
          btn.textContent = ok ? '✅ 已保存，点击可再次保存' : '💾 保存Word报告';
          btn.disabled = false;
          btn.onclick = () => self.saveAuditReport();
        });
      },
      onError(msg) {
        showToast('审核失败: ' + msg, 'error');
        btn.disabled = false; btn.textContent = '🔍 开始审核';
      },
    });
  },

  async saveAuditReport() {
    if (!this._auditMarkdown) return false;
    try {
      const res = await API.post('/api/v2/standards/audit/save', {
        markdown: this._auditMarkdown,
        standard_name: this._auditFile.name,
      });
      showToast(res.message, 'success');
      return true;
    } catch (e) {
      showToast('保存失败: ' + (e.error || e.message), 'error');
      return false;
    }
  },

  showReview(id) {
    Modal.show('🔍 AI 审查标准', Spinner.renderInline('正在审查...'), '');
    let markdown = '';
    API.streamSSE(`/api/v2/standards/${id}/review`, {}, {
      onChunk(text) {
        markdown += text;
        document.getElementById('modalBody').innerHTML = '<div class="report-content" style="max-height:60vh">' + MarkdownRenderer.render(markdown) + '</div>';
      },
      onDone() {
        showToast('✅ 审查完成', 'success');
      },
      onError(msg) {
        document.getElementById('modalBody').innerHTML = `<p style="color:var(--danger)">审查失败: ${msg}</p>`;
      },
    });
  },

  confirmDelete(id) {
    Modal.showConfirm('删除标准', '确认要删除此标准吗？', async () => {
      try {
        await API.del(`/api/v2/standards/${id}`);
        showToast('标准已归档', 'success');
        await this.loadData();
      } catch (err) {
        showToast('删除失败: ' + err.error, 'error');
      }
    });
  },

  async syncFromFolder() {
    try {
      // 先获取预览
      const preview = await API.get('/api/v2/standards/sync/preview');

      let html = `
        <div style="margin-bottom:16px">
          <h4>📁 文件夹同步预览</h4>
          <p style="color:var(--gray-500);font-size:13px">
            将从 <code>标准注册表/standards_registry.json</code> 同步标准到数据库
          </p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:24px;color:var(--success)" id="syncNewCount">${preview.new_count}</div>
            <div style="font-size:12px;color:var(--gray-500)">新增标准</div>
          </div>
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:24px;color:var(--primary)">${preview.existing_count}</div>
            <div style="font-size:12px;color:var(--gray-500)">已有标准</div>
          </div>
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:24px;color:var(--warning)">${preview.new_count + preview.existing_count}</div>
            <div style="font-size:12px;color:var(--gray-500)">注册表总数</div>
          </div>
        </div>
      `;

      if (preview.new_standards && preview.new_standards.length > 0) {
        html += `<div style="max-height:200px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:8px;padding:12px">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:8px">新增标准预览（前10个）：</div>
          <table class="data-table" style="font-size:13px">
            <thead><tr><th>岗位名称</th><th>序列</th><th>文件</th></tr></thead>
            <tbody>
              ${preview.new_standards.map(s => `
                <tr>
                  <td>${Utils.escapeHtml(s.name)}</td>
                  <td><span class="badge badge-primary">${s.sequence}</span></td>
                  <td style="font-size:11px;color:var(--gray-500)">${Utils.escapeHtml(s.file)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
      }

      Modal.show('📁 从注册表同步', html,
        `<button class="btn" onclick="Modal.hide()">取消</button>
         <button class="btn btn-success" id="btnDoSync">✅ 确认同步</button>`);

      document.getElementById('btnDoSync').addEventListener('click', async () => {
        document.getElementById('btnDoSync').disabled = true;
        document.getElementById('btnDoSync').textContent = '⏳ 同步中...';

        try {
          const result = await API.post('/api/v2/standards/sync', {});
          showToast(result.message, 'success');
          Modal.hide();
          await this.loadData();
        } catch (err) {
          showToast('同步失败: ' + (err.error || err.message), 'error');
          document.getElementById('btnDoSync').disabled = false;
          document.getElementById('btnDoSync').textContent = '✅ 确认同步';
        }
      });
    } catch (err) {
      showToast('获取同步预览失败: ' + (err.error || err.message), 'error');
    }
  },

  async syncToRegistry() {
    try {
      // 获取当前标准统计
      const data = await API.get('/api/v2/standards');
      const total = data.total || 0;
      const withRegistry = data.items.filter(s => s.registry_id).length;
      const withoutRegistry = total - withRegistry;

      let html = `
        <div style="margin-bottom:16px">
          <h4>💾 同步到注册表</h4>
          <p style="color:var(--gray-500);font-size:13px">
            将数据库中的标准信息写回 <code>标准注册表/standards_registry.json</code>
          </p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px">
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:24px;color:var(--primary)">${total}</div>
            <div style="font-size:12px;color:var(--gray-500)">数据库标准总数</div>
          </div>
          <div class="card" style="text-align:center;padding:16px">
            <div style="font-size:24px;color:var(--warning)">${withoutRegistry}</div>
            <div style="font-size:12px;color:var(--gray-500)">将新增到注册表</div>
          </div>
        </div>
        <div style="background:var(--warning-bg);padding:12px;border-radius:8px;font-size:13px;color:var(--gray-600)">
          ⚠️ 注意：这会覆盖注册表中同名标准的现有信息，请确保操作正确。
        </div>
      `;

      Modal.show('💾 同步到注册表', html,
        `<button class="btn" onclick="Modal.hide()">取消</button>
         <button class="btn btn-warning" id="btnDoSyncToRegistry">💾 确认同步</button>`);

      document.getElementById('btnDoSyncToRegistry').addEventListener('click', async () => {
        document.getElementById('btnDoSyncToRegistry').disabled = true;
        document.getElementById('btnDoSyncToRegistry').textContent = '⏳ 同步中...';

        try {
          const result = await API.post('/api/v2/standards/sync/to-registry', {});
          showToast(result.message, 'success');
          Modal.hide();
          await this.loadData();
        } catch (err) {
          showToast('同步失败: ' + (err.error || err.message), 'error');
          document.getElementById('btnDoSyncToRegistry').disabled = false;
          document.getElementById('btnDoSyncToRegistry').textContent = '💾 确认同步';
        }
      });
    } catch (err) {
      showToast('获取同步预览失败: ' + (err.error || err.message), 'error');
    }
  },

  destroy() { this.container = null; },
};
