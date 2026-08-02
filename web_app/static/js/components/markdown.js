/**
 * Markdown → HTML 渲染器
 */
const MarkdownRenderer = {
  render(md) {
    if (!md) return '';
    let html = md;

    // Headers
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Blockquote
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br>');

    // Bold & italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Checkboxes
    html = html.replace(/^- \[ \] /gm, '☐ ');
    html = html.replace(/^- \[x\] /gmi, '☑ ');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Score badges
    html = html.replace(/(\d+)\/10/g, (m, score) => {
      const s = parseInt(score);
      let cls = 'score-miss';
      if (s >= 9) cls = 'score-excellent';
      else if (s >= 7) cls = 'score-good';
      else if (s >= 5) cls = 'score-warning';
      else if (s >= 3) cls = 'score-poor';
      return `<span class="score-badge ${cls}">${m}</span>`;
    });

    // Tables
    html = html.replace(/(\|.+\|\n)+/g, (tableBlock) => {
      const rows = tableBlock.trim().split('\n').filter(r => r.includes('|'));
      if (rows.length < 2) return tableBlock;
      const dataRows = rows.filter(r => !r.match(/^\|[\s\-:]+\|[\s\-:|]+\|/));
      if (dataRows.length === 0) return tableBlock;

      let tableHtml = '<table>';
      dataRows.forEach((row, i) => {
        const cells = row.split('|').filter(c => c.trim() !== '');
        const tag = i === 0 ? 'th' : 'td';
        tableHtml += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
      });
      tableHtml += '</table>';
      return tableHtml;
    });

    // Paragraph wrapping
    const lines = html.split('\n');
    let result = [];
    let inBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { result.push(''); inBlock = false; continue; }
      if (trimmed.startsWith('<') &&
        (trimmed.startsWith('<h') || trimmed.startsWith('<table') ||
         trimmed.startsWith('<ul') || trimmed.startsWith('<li') ||
         trimmed.startsWith('<blockquote') || trimmed.startsWith('<hr') ||
         trimmed.startsWith('</'))) {
        result.push(trimmed); inBlock = true; continue;
      }
      if (!inBlock) result.push(`<p>${trimmed}</p>`);
      else result.push(trimmed);
    }

    html = result.join('\n');
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    return html;
  },
};
