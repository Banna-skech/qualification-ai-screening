/**
 * Loading Spinner 组件
 */
const Spinner = {
  render(text = '加载中...') {
    return `<div class="loading-state" style="display:flex">
      <div class="loading-pulse"></div>
      <p>${text}</p>
    </div>`;
  },

  renderInline(text = '处理中...') {
    return `<div style="display:flex;align-items:center;gap:12px;padding:20px">
      <div class="loading-pulse" style="width:24px;height:24px;border-width:3px"></div>
      <span style="font-size:14px;color:var(--gray-500)">${text}</span>
    </div>`;
  },
};
