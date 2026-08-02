/**
 * 批量处理页面 — 三步交互流程（与新认证页一致）
 * 1. 上传多个PPT → 2. 逐个确认匹配标准 → 3. 开始批量认证
 */
const BatchPage = {
  container: null,
  state: {
    files: [],        // { name, text, empInfo, matched:[], selectedStdId, targetLevel, status, error }
    registry: [],     // 注册表岗位标准清单
    stdTextCache: {}, // registry_id -> full_text
    processing: false,
    aborted: false
  },

  async init(container) {
    this.container = container;
    this.state = { files: [], registry: [], stdTextCache: {}, processing: false, aborted: false };
    this.render();
    this.bindEvents();
    await this.loadRegistry();
  },

  render() {
    this.container.innerHTML = `
      <div class="page-header">
        <h2>📦 批量处理</h2>
        <p>上传多个员工举证PPT，自动匹配岗位标准并批量生成认证报告</p>
      </div>
      <div style="max-width:720px">

        <div class="step-card"><div class="step-badge">1</div>
          <h3>上传举证 PPT</h3><p class="step-desc">支持多选 .pptx 文件，可拖拽或点击上传</p>
          <div class="upload-zone" id="batchUploadZone">
            <input type="file" id="batchFileInput" accept=".pptx" multiple hidden>
            <div class="upload-icon">📑📑📑</div>
            <div class="upload-text"><strong>拖拽多个 PPT 文件到此处</strong><span>或点击选择（支持多选 .pptx）</span></div>
            <div class="upload-hint">系统会自动解析员工信息并匹配岗位标准</div>
          </div>
          <div class="file-list" id="batchFileList"></div>
        </div>

        <div class="step-card"><div class="step-badge">2</div>
          <h3>确认匹配标准</h3><p class="step-desc">系统已自动匹配，可逐个调整标准与申报级别</p>
          <div id="matchResults">
            <div style="font-size:13px;color:var(--gray-500);padding:8px">上传PPT后自动显示匹配结果</div>
          </div>
        </div>

        <div class="step-card"><div class="step-badge">3</div>
          <h3>开始批量认证</h3><p class="step-desc">逐个调用 AI 初审并生成报告</p>
          <button class="btn btn-primary btn-lg btn-full" id="btnBatchStart" disabled onclick="BatchPage.start()">🚀 开始批量认证 (0 个文件)</button>
          <div class="progress-bar-wrap" id="batchProgressWrap" style="display:none;margin-top:12px">
            <div class="progress-bar"><div class="progress-fill" id="batchProgressFill"></div></div>
            <div class="progress-text" id="batchProgressText">等待中...</div>
          </div>
          <div id="batchProcessResults"></div>
        </div>

      </div>`;
  },

  bindEvents() {
    const zone = document.getElementById('batchUploadZone');
    const input = document.getElementById('batchFileInput');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      this.handleFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', () => this.handleFiles(input.files));
  },

  async loadRegistry() {
    try {
      const res = await fetch('/api/v2/standards/registry');
      if (res.ok) {
        const registry = await res.json();
        // 序列排序：T → S → P
        const seqOrder = { 'T序列': 0, 'S序列': 1, 'P序列': 2 };
        this.state.registry = (registry['岗位标准清单'] || []).slice().sort((a, b) =>
          (seqOrder[a['序列']] ?? 3) - (seqOrder[b['序列']] ?? 3) ||
          (a['岗位名称'] || '').localeCompare(b['岗位名称'] || '', 'zh'));
      }
    } catch (e) {
      console.error('加载标准注册表失败:', e);
    }
  },

  async handleFiles(fileList) {
    for (const file of fileList) {
      if (!file.name.endsWith('.pptx')) {
        showToast(`${file.name} 不是 .pptx 文件`, 'warning');
        continue;
      }
      if (this.state.files.find(f => f.name === file.name)) continue;

      const item = {
        name: file.name, text: null, empInfo: null,
        matched: [], selectedStdId: '', targetLevel: '',
        status: 'parsing' // parsing, matched, processing, done, error
      };
      this.state.files.push(item);
      this.updateFileList();

      try {
        // 解析PPT + 后端自动匹配（与新认证页同一套匹配逻辑）
        const data = await API.uploadFile('/api/upload-ppt', file);
        item.text = data.full_text;
        item.empInfo = data.emp_info;
        item.matched = data.matched_standards || [];
        item.selectedStdId = item.matched.length > 0 ? item.matched[0].id : '';
        const lv = (item.empInfo && item.empInfo['申报级别'] || '').trim();
        item.targetLevel = /^[SPT]\d(-\d)?$/.test(lv) ? lv : '';
        item.status = 'matched';
      } catch (err) {
        item.status = 'error';
        item.error = err.error || '解析失败';
        showToast(`${file.name}: 解析失败 - ${err.error || ''}`, 'error');
      }
      this.updateFileList();
      this.updateMatchResults();
    }
  },

  removeFile(i) {
    this.state.files.splice(i, 1);
    this.updateFileList();
    this.updateMatchResults();
  },

  updateFileList() {
    const container = document.getElementById('batchFileList');
    if (!container) return;
    container.innerHTML = this.state.files.map((f, i) => {
      let statusClass = 'loading', statusText = '解析中...';
      if (f.status === 'matched') {
        statusClass = f.selectedStdId ? 'done' : 'failed';
        statusText = f.selectedStdId ? '✅ 已匹配' : '❓ 未匹配，请在第2步手动选择';
      } else if (f.status === 'error') {
        statusClass = 'failed'; statusText = '❌ ' + (f.error || '失败');
      }
      const emp = f.empInfo || {};
      return `
      <div class="file-item" style="flex-direction:column;align-items:flex-start;gap:4px;padding:12px">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <span style="font-weight:500">${f.name}</span>
          <span class="remove-btn" onclick="BatchPage.removeFile(${i})">✕</span>
        </div>
        <div style="font-size:12px;color:var(--gray-500);display:flex;gap:12px;flex-wrap:wrap">
          ${emp['员工姓名'] ? `<span>👤 ${emp['员工姓名']}</span>` : ''}
          ${emp['所在部门'] ? `<span>🏢 ${emp['所在部门']}</span>` : ''}
          ${emp['申报级别'] && emp['申报级别'] !== '未知' ? `<span>📊 ${emp['申报级别']}</span>` : ''}
          <span><span class="status-dot ${statusClass}"></span>${statusText}</span>
        </div>
      </div>`;
    }).join('');
    this.updateBtn();
  },

  levelOptions(selected) {
    const groups = { T: 'T序列-技术', S: 'S序列-营销', P: 'P序列-职能' };
    const names = { 1: '助理', 2: '初级', 3: '中级', 4: '高级', 5: '专家' };
    let html = `<option value="">自动检测</option>`;
    for (const seq of ['T', 'S', 'P']) {
      html += `<optgroup label="${groups[seq]}">`;
      html += `<option value="${seq}1" ${selected === seq + '1' ? 'selected' : ''}>${seq}1 助理</option>`;
      for (let lv = 2; lv <= 5; lv++) {
        for (let g = 1; g <= 3; g++) {
          const v = `${seq}${lv}-${g}`;
          html += `<option value="${v}" ${selected === v ? 'selected' : ''}>${v} ${names[lv]}</option>`;
        }
      }
      html += `</optgroup>`;
    }
    return html;
  },

  updateMatchResults() {
    const container = document.getElementById('matchResults');
    if (!container) return;
    const parsed = this.state.files.filter(f => f.status === 'matched');

    if (parsed.length === 0) {
      container.innerHTML = '<div style="font-size:13px;color:var(--gray-500);padding:8px">上传PPT后自动显示匹配结果</div>';
      this.updateBtn();
      return;
    }

    container.innerHTML = parsed.map(f => {
      const i = this.state.files.indexOf(f);
      const emp = f.empInfo || {};
      const badge = f.selectedStdId
        ? '<span class="badge badge-primary">✓ 已匹配</span>'
        : '<span class="badge" style="background:var(--danger-bg);color:var(--danger)">未匹配，请手动选择</span>';

      return `
      <div class="card" style="margin-bottom:8px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div>
            <strong>${emp['员工姓名'] && emp['员工姓名'] !== '未知' ? emp['员工姓名'] : f.name}</strong>
            <span style="color:var(--gray-500);font-size:12px;margin-left:8px">${emp['所在部门'] && emp['所在部门'] !== '未知' ? emp['所在部门'] : ''}</span>
          </div>
          ${badge}
        </div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px;font-size:13px">
          <span>申报: <strong>${emp['申报岗位'] && emp['申报岗位'] !== '未知' ? emp['申报岗位'] : '—'}</strong></span>
          <span>标准: <strong>${this.findStd(f.selectedStdId) ? this.findStd(f.selectedStdId)['岗位名称'] : '未选择'}</strong></span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <div id="stdWrap-${i}" style="flex:2;min-width:200px"></div>
          <select class="select-level" style="flex:1;min-width:120px;font-size:13px" onchange="BatchPage.onSelectLevel(${i}, this.value)">
            ${this.levelOptions(f.targetLevel)}
          </select>
        </div>
      </div>`;
    }).join('');

    // 每个文件初始化可搜索的标准选择框：自动匹配候选置顶，其余按序列分组
    parsed.forEach(f => {
      const i = this.state.files.indexOf(f);
      const wrap = document.getElementById(`stdWrap-${i}`);
      if (!wrap) return;
      const candidateIds = f.matched.map(m => m.id);
      const rest = this.state.registry.filter(s => !candidateIds.includes(s.id));
      const options = [
        ...f.matched.map((m, mi) => ({
          value: m.id,
          label: `${m['岗位名称']} (${m['序列']})${mi === 0 ? ' — 最佳匹配' : ''}`,
          group: '🤖 自动匹配候选',
        })),
        ...rest.map(s => ({
          value: s.id,
          label: `${s['岗位名称']} (${s['序列']})`,
          group: s['序列'],
        })),
      ];
      SearchSelect.create(wrap, {
        placeholder: '🔍 输入岗位名称搜索...',
        options,
        value: f.selectedStdId || '',
        onSelect: (id) => BatchPage.onSelectStd(i, id),
      });
    });
    this.updateBtn();
  },

  findStd(id) {
    return this.state.registry.find(s => s.id === id) || null;
  },

  onSelectStd(fileIndex, stdId) {
    const f = this.state.files[fileIndex];
    if (!f) return;
    f.selectedStdId = stdId;
    this.updateFileList();
    this.updateMatchResults();
  },

  onSelectLevel(fileIndex, level) {
    const f = this.state.files[fileIndex];
    if (!f) return;
    f.targetLevel = level;
  },

  updateBtn() {
    const btn = document.getElementById('btnBatchStart');
    if (!btn) return;
    const ready = this.state.files.filter(f => f.status === 'matched' && f.selectedStdId);
    btn.disabled = ready.length === 0 || this.state.processing;
    btn.textContent = `🚀 开始批量认证 (${ready.length} 个文件)`;
  },

  async loadStandardText(stdId) {
    // 缓存Promise而非结果：并行处理时多个文件申报同一岗位，标准全文只加载一次
    if (!this.state.stdTextCache[stdId]) {
      this.state.stdTextCache[stdId] = API.get(`/api/standards/${stdId}`).then(d => d.full_text);
    }
    return this.state.stdTextCache[stdId];
  },

  async start() {
    const ready = this.state.files.filter(f => f.status === 'matched' && f.selectedStdId);
    if (ready.length === 0) {
      showToast('没有可处理的文件（请先在第2步选择标准）', 'warning');
      return;
    }

    this.state.processing = true;
    this.state.aborted = false;
    document.getElementById('btnBatchStart').disabled = true;
    document.getElementById('batchProgressWrap').style.display = 'block';

    // 初始化结果列表
    document.getElementById('batchProcessResults').innerHTML = ready.map((f, i) => `
      <div class="file-item" id="batch-result-${i}">
        <span><span class="status-dot loading"></span>${f.name}</span>
        <span style="font-size:12px;color:var(--gray-500)">等待中</span>
      </div>`).join('');

    let completed = 0, successCount = 0, failCount = 0;
    const self = this;
    const CONCURRENCY = Math.min(3, ready.length);  // 3路并行分析

    const updateProgress = () => {
      const pct = Math.round(completed / ready.length * 100);
      document.getElementById('batchProgressFill').style.width = pct + '%';
      document.getElementById('batchProgressText').textContent =
        `${CONCURRENCY}路并行 | 已完成: ${completed}/${ready.length} | ✅ ${successCount} | ❌ ${failCount}`;
    };
    updateProgress();

    let nextIndex = 0;
    async function worker() {
      while (true) {
        if (self.state.aborted) return;
        const i = nextIndex++;
        if (i >= ready.length) return;
        const file = ready[i];
        const el = document.getElementById('batch-result-' + i);
        file.status = 'processing';

        try {
          if (el) {
            el.querySelector('.status-dot').className = 'status-dot loading';
            el.querySelector('span:last-child').textContent = '加载标准...';
          }
          const stdText = await self.loadStandardText(file.selectedStdId);

          if (el) el.querySelector('span:last-child').textContent = '分析中...';
          await self.processOneFile(file, stdText, el);

          successCount++;
          file.status = 'done';
          if (el) {
            el.querySelector('.status-dot').className = 'status-dot done';
            el.querySelector('span:last-child').textContent = '✅ 完成';
          }
        } catch (err) {
          failCount++;
          file.status = 'error';
          file.error = err.message || '失败';
          if (el) {
            el.querySelector('.status-dot').className = 'status-dot failed';
            el.querySelector('span:last-child').textContent = '❌ ' + (err.message || '失败');
          }
        }
        completed++;
        updateProgress();
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    document.getElementById('batchProgressText').textContent =
      `处理完成! 成功 ${successCount} / 失败 ${failCount}`;
    document.getElementById('batchProcessResults').insertAdjacentHTML('beforeend', `
      <div class="card" style="margin-top:12px;background:var(--success-bg)">
        <strong>批量处理完成:</strong> ✅ ${successCount} / ❌ ${failCount}
        <button class="btn btn-primary" style="margin-left:12px" onclick="App.navigate('reports')">📋 查看报告列表</button>
        <button class="btn" style="margin-left:8px" onclick="window.open('/api/export/reports/xlsx','_blank')">📥 导出Excel</button>
      </div>`);

    this.state.processing = false;
    this.updateBtn();
    App.refreshReportCount && App.refreshReportCount();
  },

  processOneFile(file, stdText, el) {
    return new Promise((resolve, reject) => {
      const empInfo = file.empInfo || {};
      const detectedLevel = (empInfo['申报级别'] || '').trim();
      const targetLevel = file.targetLevel || (/^[SPT]\d(-\d)?$/.test(detectedLevel) ? detectedLevel : '');

      const controller = API.streamSSE('/api/analyze', {
        ppt_text: file.text,
        ppt_filename: file.name,
        standard_id: file.selectedStdId,
        standard_text: stdText,
        target_level: targetLevel,
      }, {
        onChunk(text) {
          if (el) {
            const snippet = text.replace(/\n/g, ' ').slice(0, 30);
            el.querySelector('span:last-child').textContent = '生成中: ' + snippet + '...';
          }
        },
        onDone() { resolve(); },
        onError(msg) { reject(new Error(msg)); },
      });

      if (this.state.aborted) {
        controller.abort();
        reject(new Error('用户中止'));
      }
    });
  },

  destroy() { this.container = null; },
};
