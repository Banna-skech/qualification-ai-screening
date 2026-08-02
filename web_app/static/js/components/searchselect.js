/**
 * SearchSelect — 可搜索下拉选择组件
 * 用法:
 *   SearchSelect.create(document.getElementById('wrap'), {
 *     options: [{ value: 'gtm', label: 'GTM (S序列)', group: '自动匹配候选' }, ...],
 *     placeholder: '搜索岗位标准...',
 *     value: 'gtm',              // 初始选中值（可选）
 *     onSelect: (value, option) => {},
 *   });
 */
const SearchSelect = {
  _styleInjected: false,

  _injectStyle() {
    if (this._styleInjected) return;
    this._styleInjected = true;
    const css = `
      .ss-wrap { position: relative; }
      .ss-input { width: 100%; box-sizing: border-box; }
      .ss-dropdown {
        position: absolute; top: calc(100% + 2px); left: 0; right: 0; z-index: 1000;
        background: #fff; border: 1px solid var(--gray-200, #e5e7eb);
        border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.12);
        max-height: 260px; overflow-y: auto; display: none;
      }
      .ss-dropdown.open { display: block; }
      .ss-group {
        padding: 6px 12px 4px; font-size: 11px; color: var(--gray-500, #6b7280);
        font-weight: 600; background: var(--gray-50, #f9fafb);
        position: sticky; top: 0;
      }
      .ss-item { padding: 8px 12px; font-size: 13px; cursor: pointer; }
      .ss-item:hover, .ss-item.active { background: var(--primary-bg, #eef2ff); color: var(--primary, #4f46e5); }
      .ss-item.selected { font-weight: 600; color: var(--primary, #4f46e5); }
      .ss-empty { padding: 12px; font-size: 13px; color: var(--gray-500, #6b7280); text-align: center; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  },

  create(container, opts) {
    this._injectStyle();
    const options = opts.options || [];
    let selectedValue = opts.value || '';
    const selectedOpt = options.find(o => o.value === selectedValue);

    container.classList.add('ss-wrap');
    container.innerHTML = `
      <input type="text" class="select-std ss-input" placeholder="${opts.placeholder || '输入关键词搜索...'}"
             value="${selectedOpt ? this._esc(selectedOpt.label) : ''}" autocomplete="off">
      <div class="ss-dropdown"></div>`;

    const input = container.querySelector('.ss-input');
    const dropdown = container.querySelector('.ss-dropdown');
    let activeIndex = -1;
    let visibleItems = [];

    const renderList = (keyword) => {
      const kw = (keyword || '').trim().toLowerCase();
      const filtered = kw
        ? options.filter(o => o.label.toLowerCase().includes(kw))
        : options;
      visibleItems = filtered;
      activeIndex = -1;
      if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="ss-empty">未找到匹配项</div>';
        return;
      }
      let html = '', lastGroup = null;
      filtered.forEach((o, i) => {
        if (o.group && o.group !== lastGroup) {
          html += `<div class="ss-group">${this._esc(o.group)}</div>`;
          lastGroup = o.group;
        }
        html += `<div class="ss-item${o.value === selectedValue ? ' selected' : ''}" data-i="${i}">${this._esc(o.label)}</div>`;
      });
      dropdown.innerHTML = html;
      dropdown.querySelectorAll('.ss-item').forEach(el => {
        el.addEventListener('mousedown', e => {
          e.preventDefault();  // 防止input失焦先触发
          pick(parseInt(el.dataset.i));
        });
      });
    };

    const pick = (i) => {
      const o = visibleItems[i];
      if (!o) return;
      selectedValue = o.value;
      input.value = o.label;
      close();
      if (opts.onSelect) opts.onSelect(o.value, o);
    };

    const open = () => { renderList(''); dropdown.classList.add('open'); input.select(); };
    const close = () => dropdown.classList.remove('open');

    input.addEventListener('focus', open);
    input.addEventListener('input', () => { dropdown.classList.add('open'); renderList(input.value); });
    input.addEventListener('blur', () => setTimeout(() => {
      close();
      // 失焦时还原为已选中项的文字，避免输入了一半的关键词留在框里
      const cur = options.find(o => o.value === selectedValue);
      input.value = cur ? cur.label : '';
    }, 150));
    input.addEventListener('keydown', e => {
      const items = dropdown.querySelectorAll('.ss-item');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        activeIndex = e.key === 'ArrowDown'
          ? Math.min(activeIndex + 1, items.length - 1)
          : Math.max(activeIndex - 1, 0);
        items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0) pick(activeIndex);
        else if (visibleItems.length === 1) pick(0);
      } else if (e.key === 'Escape') {
        close(); input.blur();
      }
    });

    return {
      getValue: () => selectedValue,
      setValue: (v) => {
        selectedValue = v;
        const o = options.find(x => x.value === v);
        input.value = o ? o.label : '';
      },
    };
  },

  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};
