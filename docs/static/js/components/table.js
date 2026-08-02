/**
 * 数据表格组件
 */
const DataTable = {
  /**
   * @param {Object} opts — { columns: [{key, label, sortable, render}], rows: [], onSort, onRowClick, selectable: bool, selectedIds: Set }
   */
  render(opts) {
    const { columns, rows, onSort, onRowClick, selectable, selectedIds } = opts;
    let html = '<div class="data-table-wrap"><table class="data-table"><thead><tr>';

    if (selectable) html += '<th style="width:40px"><input type="checkbox" class="select-all-check"></th>';

    columns.forEach(col => {
      const sortable = col.sortable !== false;
      html += `<th data-key="${col.key}"${sortable ? ' class="sortable"' : ''}>${col.label}</th>`;
    });
    html += '<th style="width:80px">操作</th>';
    html += '</tr></thead><tbody>';

    if (!rows || rows.length === 0) {
      const span = columns.length + (selectable ? 2 : 1);
      html += `<tr><td colspan="${span}" style="text-align:center;padding:40px;color:var(--gray-500)">
        📭 暂无数据</td></tr>`;
    } else {
      rows.forEach((row, idx) => {
        const selected = selectedIds && selectedIds.has(row.id);
        html += `<tr class="${onRowClick ? 'clickable-row' : ''}${selected ? ' selected' : ''}" data-idx="${idx}" data-id="${row.id || ''}">`;

        if (selectable) {
          html += `<td><input type="checkbox" class="row-check" data-id="${row.id}"${selected ? ' checked' : ''}></td>`;
        }

        columns.forEach(col => {
          const val = row[col.key];
          const display = col.render ? col.render(val, row) : (val ?? '');
          html += `<td>${display}</td>`;
        });

        html += `<td>${opts.rowActions ? opts.rowActions(row) : ''}</td></tr>`;
      });
    }

    html += '</tbody></table></div>';

    // Pagination (if opts has pagination)
    if (opts.pagination) {
      const { page, pages, total } = opts.pagination;
      html += `<div class="pagination">
        <button${page <= 1 ? ' disabled' : ''}>« 首页</button>
        <button${page <= 1 ? ' disabled' : ''}>‹ 上一页</button>
        <span class="page-info">第 ${page} / ${pages} 页 (共 ${total} 条)</span>
        <button${page >= pages ? ' disabled' : ''}>› 下一页</button>
        <button${page >= pages ? ' disabled' : ''}>» 末页</button>
      </div>`;
    }

    return html;
  },

  /** Bind events to the rendered table */
  bindEvents(container, opts) {
    const { onSort, onRowClick, onPageChange, onSelectChange } = opts;

    // Sort click
    container.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        if (onSort) onSort(th.dataset.key);
      });
    });

    // Row click
    if (onRowClick) {
      container.querySelectorAll('tr.clickable-row').forEach(tr => {
        tr.addEventListener('click', (e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
          onRowClick(tr.dataset.id, parseInt(tr.dataset.idx));
        });
      });
    }

    // Pagination
    if (onPageChange) {
      container.querySelectorAll('.pagination button').forEach((btn, i) => {
        btn.addEventListener('click', () => {
          const { page, pages } = opts.pagination || {};
          let newPage = page;
          if (i === 0) newPage = 1;
          else if (i === 1) newPage = Math.max(1, page - 1);
          else if (i === 2) newPage = Math.min(pages, page + 1);
          else if (i === 3) newPage = pages;
          if (newPage !== page) onPageChange(newPage);
        });
      });
    }

    // Select
    if (onSelectChange) {
      const allCheck = container.querySelector('.select-all-check');
      if (allCheck) {
        allCheck.addEventListener('change', () => {
          container.querySelectorAll('.row-check').forEach(cb => { cb.checked = allCheck.checked; });
          onSelectChange();
        });
      }
      container.querySelectorAll('.row-check').forEach(cb => {
        cb.addEventListener('change', onSelectChange);
      });
    }
  },
};
