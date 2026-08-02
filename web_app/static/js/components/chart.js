/**
 * 简易图表组件 — Canvas 2D 手写
 */
const Chart = {
  /**
   * 绘制柱状图
   * @param canvas - canvas element
   * @param data - [{label, value, color?}]
   */
  bar(canvas, data, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = 250;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', W / 2, H / 2);
      return;
    }

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const barW = Math.min(chartW / data.length * 0.6, 40);

    // Y-axis
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * (1 - i / 4);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * i / 4), pad.left - 8, y + 4);
    }

    // Bars
    data.forEach((d, i) => {
      const x = pad.left + (chartW / data.length) * i + (chartW / data.length - barW) / 2;
      const barH = (d.value / maxVal) * chartH;
      const y = pad.top + chartH - barH;

      ctx.fillStyle = d.color || '#4f46e5';
      ctx.fillRect(x, y, barW, barH);

      // Label
      ctx.fillStyle = '#374151';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label || '', x + barW / 2, pad.top + chartH + 20);

      // Value on top
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(d.value, x + barW / 2, y - 5);
    });
  },

  /**
   * 绘制折线图
   */
  line(canvas, data, opts = {}) {
    // data: [{label, value}] or [[{label, value}]] for multi-line
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = 260;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const datasets = Array.isArray(data[0]) ? data : [data];
    const allValues = datasets.flat();
    if (allValues.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', W / 2, H / 2);
      return;
    }

    const maxVal = Math.max(...allValues.map(d => d.value), 1);
    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

    // Grid
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * (1 - i / 4);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * i / 4), pad.left - 8, y + 4);
    }

    datasets.forEach((set, si) => {
      const color = colors[si % colors.length];
      if (set.length === 0) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      set.forEach((d, i) => {
        const x = pad.left + (chartW / (set.length - 1 || 1)) * i;
        const y = pad.top + chartH - (d.value / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Dots
      set.forEach((d, i) => {
        const x = pad.left + (chartW / (set.length - 1 || 1)) * i;
        const y = pad.top + chartH - (d.value / maxVal) * chartH;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#374151';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.label || '', x, pad.top + chartH + 15);
      });
    });
  },

  /** Doughnut chart */
  doughnut(canvas, data, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = 240;
    const cx = W / 2, cy = H / 2, r = Math.min(cx, cy) - 20;

    ctx.clearRect(0, 0, W, H);

    if (!data || data.length === 0) return;

    const total = data.reduce((s, d) => s + d.value, 0);
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];
    let startAngle = -Math.PI / 2;

    data.forEach((d, i) => {
      const slice = (d.value / total) * Math.PI * 2;
      ctx.fillStyle = d.color || colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fill();

      // Label
      const midAngle = startAngle + slice / 2;
      const lx = cx + Math.cos(midAngle) * r * 0.7;
      const ly = cy + Math.sin(midAngle) * r * 0.7;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(d.value / total * 100) + '%', lx, ly);

      startAngle += slice;
    });
  },
};
