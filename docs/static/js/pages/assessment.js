/**
 * 新认证页面 — 保留原有三步流程
 */
const AssessmentPage = {
  container: null,
  state: { files: [], selectedStdId: null, selectedStdText: null, selectedStdMeta: null, targetLevel: '' },

  async init(container) {
    this.container = container;
    this.render();
    this.bindEvents();
    // 加载标准列表用于手动选择
    try {
      const stds = await API.get('/api/standards');
      // 序列排序：T → S → P
      const seqOrder = { 'T序列': 0, 'S序列': 1, 'P序列': 2 };
      stds.sort((a, b) =>
        (seqOrder[a['序列']] ?? 3) - (seqOrder[b['序列']] ?? 3) ||
        (a['岗位名称'] || '').localeCompare(b['岗位名称'] || '', 'zh'));
      const wrap = document.getElementById('stdSelectWrap');
      if (wrap) {
        SearchSelect.create(wrap, {
          placeholder: '🔍 输入岗位名称搜索，如"运营"...',
          options: stds.map(s => ({
            value: s.id,
            label: `${s.岗位名称} (${s.序列})`,
            group: s.序列,
          })),
          onSelect: (id) => AssessmentPage.onManualSelect(id),
        });
      }
    } catch (e) { /* ignore */ }
  },

  render() {
    this.container.innerHTML = `
      <div class="page-header"><h2>📑 新认证</h2><p>上传员工举证PPT，自动匹配标准并生成认证报告</p></div>
      <div style="max-width:500px">
        <div class="step-card"><div class="step-badge">1</div>
          <h3>上传举证 PPT</h3><p class="step-desc">支持 .pptx 格式，可拖拽或点击上传</p>
          <div class="upload-zone" id="uploadZone">
            <input type="file" id="fileInput" accept=".pptx" hidden>
            <div class="upload-icon">📑</div>
            <div class="upload-text"><strong>拖拽 PPT 文件到此处</strong><span>或点击选择文件（.pptx）</span></div>
            <div class="upload-hint">支持多个文件 · 不会上传真实员工数据</div>
          </div>
          <button class="btn btn-ghost demo-example-btn" id="loadDemoAssessment">▶ 加载示例认证</button>
          <div class="file-list" id="fileList"></div>
          <div id="empPreview" style="display:none;margin-top:12px;padding:12px;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-sm)">
            <div style="font-size:13px"><span style="color:var(--gray-500)">👤 员工：</span><strong id="empName">-</strong></div>
            <div style="font-size:13px"><span style="color:var(--gray-500)">🏢 部门：</span><strong id="empDept">-</strong></div>
            <div style="font-size:13px"><span style="color:var(--gray-500)">📋 申请：</span><strong id="empLevel">-</strong></div>
          </div>
        </div>

        <div class="step-card"><div class="step-badge">2</div>
          <h3>匹配岗位标准</h3><p class="step-desc">自动匹配或手动选择</p>
          <div style="display:flex;gap:16px;margin-bottom:12px">
            <label><input type="radio" name="matchMode" value="auto" checked onchange="AssessmentPage.toggleMode()"> 🤖 自动匹配</label>
            <label><input type="radio" name="matchMode" value="manual" onchange="AssessmentPage.toggleMode()"> ✋ 手动选择</label>
          </div>
          <div id="autoMatch"><div class="match-results" id="matchList"><div style="font-size:13px;color:var(--gray-500);padding:8px">上传PPT后自动显示匹配结果</div></div></div>
          <div id="manualSelect" style="display:none">
            <div id="stdSelectWrap"></div>
          </div>
          <div id="stdPreview" style="display:none;margin-top:12px;padding:12px;background:var(--primary-bg);border-radius:var(--radius-sm)">
            <div style="font-size:13px"><span style="color:var(--gray-500)">📄 标准：</span><strong id="stdName">-</strong></div>
            <div style="font-size:13px"><span style="color:var(--gray-500)">🏷️ 序列：</span><strong id="stdSeq">-</strong></div>
            <div style="font-size:13px"><span style="color:var(--gray-500)">📝 申报级别：</span>
              <select class="select-level" id="targetLevel" style="width:auto;margin-top:4px">
                <option value="">自动检测</option>
                <option value="T3-2">T3-2 · 结构化示例</option>
                <option value="T4-2">T4-2 · 结构化示例</option>
                <option value="S3-1">S3-1 · 结构化示例</option>
                <option value="S4-3">S4-3 · 结构化示例</option>
                <option value="P3-3">P3-3 · 结构化示例</option>
              </select>
            </div>
          </div>
        </div>

        <div class="step-card"><div class="step-badge">3</div>
          <h3>开始分析</h3><p class="step-desc">点击按钮启动 AI 初审</p>
          <button class="btn btn-primary btn-lg btn-full" id="analyzeBtn" disabled onclick="AssessmentPage.startAnalysis()">🚀 开始认证初审</button>
          <div class="progress-bar-wrap" id="progressWrap" style="display:none">
            <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
            <div class="progress-text" id="progressText">正在分析...</div>
          </div>
        </div>
      </div>
      <div id="reportArea" style="margin-top:20px"></div>`;
  },

  bindEvents() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('fileInput');
    if (!zone || !input) return;
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      this.handleFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', () => this.handleFiles(input.files));
    const demoBtn = document.getElementById('loadDemoAssessment');
    if (demoBtn) demoBtn.addEventListener('click', () => this.handleFiles([{ name: '陈某某-测试工程师（演示）.pptx' }]));
  },

  toggleMode() {
    const mode = document.querySelector('input[name="matchMode"]:checked').value;
    document.getElementById('autoMatch').style.display = mode === 'auto' ? 'block' : 'none';
    document.getElementById('manualSelect').style.display = mode === 'manual' ? 'block' : 'none';
  },

  async handleFiles(fileList) {
    for (const file of fileList) {
      if (!file.name.endsWith('.pptx')) { showToast(`${file.name} 不是 .pptx 文件`, 'warning'); continue; }
      if (this.state.files.find(f => f.name === file.name)) continue;

      const item = { name: file.name, text: null, empInfo: null, matched: null };
      this.state.files.push(item);
      this.updateFileList();

      try {
        const data = await API.uploadFile('/api/upload-ppt', file);
        item.text = data.full_text;
        item.empInfo = data.emp_info;
        item.matched = data.matched_standards;
        this.updateFileList();
        this.updateEmpPreview();
        this.updateMatchList();
      } catch (err) {
        showToast(`${file.name}: ${err.error || '上传失败'}`, 'error');
        this.state.files = this.state.files.filter(f => f !== item);
        this.updateFileList();
      }
    }
  },

  updateFileList() {
    const container = document.getElementById('fileList');
    if (!container) return;
    container.innerHTML = this.state.files.map((f, i) => `
      <div class="file-item">
        <span><span class="status-dot ${f.text ? 'done' : 'loading'}"></span>${f.name}</span>
        <span class="remove-btn" onclick="AssessmentPage.removeFile(${i})">✕</span>
      </div>`).join('');
    this.checkAnalyzeBtn();
  },

  removeFile(i) { this.state.files.splice(i, 1); this.updateFileList(); this.updateEmpPreview(); this.updateMatchList(); },

  updateEmpPreview() {
    const preview = document.getElementById('empPreview');
    const f = this.state.files[0];
    if (!f || !f.empInfo) { if (preview) preview.style.display = 'none'; return; }
    preview.style.display = 'block';
    document.getElementById('empName').textContent = f.empInfo['员工姓名'] || '';
    document.getElementById('empDept').textContent = f.empInfo['所在部门'] || '';
    document.getElementById('empLevel').textContent = (f.empInfo['申报岗位'] || '') + ' (' + (f.empInfo['申报级别'] || '') + ')';
  },

  updateMatchList() {
    const f = this.state.files[0];
    const container = document.getElementById('matchList');
    if (!container) return;
    if (!f || !f.matched || f.matched.length === 0) {
      container.innerHTML = '<div style="font-size:13px;color:var(--gray-500);padding:8px">暂无匹配结果，可切换手动选择</div>';
      return;
    }
    container.innerHTML = f.matched.map((s, i) => `
      <div class="match-item${i === 0 && !this.state.selectedStdId ? ' selected' : ''}"
           onclick="AssessmentPage.selectMatch('${s.id}', this)" data-id="${s.id}">
        <div><strong>${s.岗位名称}</strong><div style="font-size:11px;color:var(--gray-500)">${s.序列} · ${(s.覆盖部门||[]).slice(0,2).join('、')}</div></div>
        <span class="match-score">匹配${i === 0 ? '最佳' : ''}</span>
      </div>`).join('');
    if (!this.state.selectedStdId && f.matched.length > 0) {
      this.selectMatch(f.matched[0].id, container.querySelector('[data-id]'));
    }
  },

  async selectMatch(id, el) {
    document.querySelectorAll('.match-item').forEach(m => m.classList.remove('selected'));
    if (el) el.classList.add('selected');
    this.state.selectedStdId = id;
    await this.loadStandard(id);
  },

  async onManualSelect(id) {
    if (!id) return;
    this.state.selectedStdId = id;
    await this.loadStandard(id);
  },

  async loadStandard(id) {
    try {
      const data = await API.get(`/api/standards/${id}`);
      this.state.selectedStdText = data.full_text;
      this.state.selectedStdMeta = data;
      // Update preview
      const preview = document.getElementById('stdPreview');
      if (preview) preview.style.display = 'block';
      document.getElementById('stdName').textContent = data['岗位名称'] || '';
      document.getElementById('stdSeq').textContent = data['序列'] || '';
      // Prefill level — use the PPT's own detected full level (e.g. "S3-2", "T2-1")
      const f = this.state.files[0];
      if (f && f.empInfo && f.empInfo['申报级别']) {
        const lv = f.empInfo['申报级别'].trim();
        // Match full format like "S3-2", "T2-1", "P4-3" etc.
        if (/^[SPT]\d-\d$/.test(lv)) {
          document.getElementById('targetLevel').value = lv;
        } else {
          // Try partial: "S3" → match the first S3-* option
          const m = lv.match(/^([SPT])(\d)/);
          if (m) {
            const prefix = m[1] + m[2];
            const sel = document.getElementById('targetLevel');
            const options = Array.from(sel.options);
            const matchOpt = options.find(o => o.value.startsWith(prefix));
            if (matchOpt) sel.value = matchOpt.value;
          }
        }
      }
      this.checkAnalyzeBtn();
    } catch (err) {
      showToast('加载标准失败', 'error');
    }
  },

  checkAnalyzeBtn() {
    const btn = document.getElementById('analyzeBtn');
    if (!btn) return;
    const f = this.state.files[0];
    btn.disabled = !(f && f.text && this.state.selectedStdText);
  },

  async startAnalysis() {
    const f = this.state.files[0];
    if (!f || !f.text || !this.state.selectedStdText) return;

    document.getElementById('reportArea').innerHTML = '';
    document.getElementById('progressWrap').style.display = 'block';
    document.getElementById('analyzeBtn').disabled = true;

    let markdown = '';

    API.streamSSE('/api/analyze', {
      ppt_text: f.text,
      ppt_filename: f.name,
      standard_id: this.state.selectedStdId,
      standard_text: this.state.selectedStdText,
      target_level: document.getElementById('targetLevel').value,
    }, {
      onChunk(text) {
        markdown += text;
        document.getElementById('reportArea').innerHTML =
          '<div class="report-content">' + MarkdownRenderer.render(markdown) + '</div>';
        const rc = document.querySelector('#reportArea .report-content');
        if (rc) rc.scrollTop = rc.scrollHeight;
      },
      onDone() {
        showToast('✅ 分析完成！', 'success');
        document.getElementById('progressWrap').style.display = 'none';
        document.getElementById('analyzeBtn').disabled = false;
        document.getElementById('reportArea').innerHTML +=
          '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn-primary" onclick="AssessmentPage.saveAndGoToReport()">💾 保存并查看</button>' +
          '<button class="btn" onclick="AssessmentPage.copyResult()">📋 复制摘要</button></div>';
        // Refresh report count
        App.refreshReportCount();
      },
      onError(msg) {
        showToast('❌ 分析出错: ' + msg, 'error');
        document.getElementById('progressWrap').style.display = 'none';
        document.getElementById('analyzeBtn').disabled = false;
      },
    });
  },

  saveAndGoToReport() {
    App.navigate('reports');
  },

  copyResult() {
    const md = document.querySelector('#reportArea .report-content')?.innerText || '';
    navigator.clipboard.writeText(md).then(() => showToast('📋 已复制', 'success'));
  },


  destroy() { this.container = null; },
};
