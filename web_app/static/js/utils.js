/**
 * 通用工具函数
 */
const Utils = {
  formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  },

  formatDateTime(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleString('zh-CN');
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  truncate(str, len = 100) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
  },

  conclusionBadge(conclusion) {
    const map = {
      pass: '<span class="badge badge-pass">✅ 通过</span>',
      conditional: '<span class="badge badge-conditional">⚠️ 有条件通过</span>',
      fail: '<span class="badge badge-fail">❌ 不通过</span>',
    };
    return map[conclusion] || `<span class="badge">${conclusion}</span>`;
  },

  coverageBadge(c) {
    const map = {
      '✅': '<span style="color:var(--success);font-weight:700">✅</span>',
      '⚠️': '<span style="color:var(--warning);font-weight:700">⚠️</span>',
      '❌': '<span style="color:var(--danger);font-weight:700">❌</span>',
    };
    return map[c] || c || '';
  },

  scoreBadge(score) {
    if (score == null) return '';
    let cls = 'score-miss';
    if (score >= 9) cls = 'score-excellent';
    else if (score >= 7) cls = 'score-good';
    else if (score >= 5) cls = 'score-warning';
    else if (score >= 3) cls = 'score-poor';
    return `<span class="score-badge ${cls}">${score}/10</span>`;
  },

  // URL hash helpers
  getHash() {
    return window.location.hash.replace('#', '') || 'dashboard';
  },

  setHash(page, params = {}) {
    let hash = page;
    if (Object.keys(params).length) {
      hash += '?' + new URLSearchParams(params).toString();
    }
    window.location.hash = hash;
  },

  getHashParams() {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return {};
    return Object.fromEntries(new URLSearchParams(hash.slice(qIdx + 1)));
  },
};
