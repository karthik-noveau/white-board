// SVG previews use bounded, wrapped text so dense cards never spill into neighbours.
export function wrapPreviewText(value, width, fontSize = 14, maxLines = Infinity) {
  const limit = Math.max(1, Math.floor(width / (fontSize * .54)));
  const output = [];
  for (const paragraph of String(value || '').split('\n')) {
    let line = '';
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && line.length + word.length + 1 > limit) { output.push(line); line = ''; }
      while (word.length > limit) { output.push(word.slice(0, limit)); word = word.slice(limit); }
      line = line ? `${line} ${word}` : word;
    }
    output.push(line);
  }
  if (output.length > maxLines) return [...output.slice(0, maxLines - 1), `${output[maxLines - 1].slice(0, Math.max(0, limit - 1))}…`];
  return output;
}

export function previewBlocks(content, width, gap = 14) {
  let y = 0;
  const blocks = (content || []).map(block => {
    const item = { ...block, y, width };
    if (block.type === 'table') {
      const count = block.headers.length;
      item.columns = block.columnWidths || Array.from({ length: count }, () => Math.max(190, width / count));
      item.headers = block.headers.map((value, index) => wrapPreviewText(value, item.columns[index] - 28, 13));
      item.headerHeight = 20 + Math.max(...item.headers.map(lines => lines.length)) * 22;
      item.rows = block.rows.map(row => {
        const cells = row.map((slot, index) => previewBlocks(slot.content, Math.max(20, item.columns[index] - 28), 10));
        return { cells, height: 24 + Math.max(22, ...cells.map(cell => cell.height)) };
      });
      item.height = item.headerHeight + item.rows.reduce((sum, row) => sum + row.height, 0);
    } else if (block.type === 'checklist') {
      let offset = 0;
      item.tasks = block.tasks.map(task => {
        const lines = wrapPreviewText(task.text || 'Untitled task', width - 30);
        const result = { ...task, lines, y: offset };
        offset += Math.max(32, lines.length * 24 + 8);
        return result;
      });
      item.height = offset;
    } else if (block.type === 'image') {
      const scale = Math.min((width - 20) / (block.naturalWidth || width), 360 / (block.naturalHeight || 180), 1);
      item.imageWidth = Math.max(1, (block.naturalWidth || width - 20) * scale);
      item.imageHeight = Math.max(1, (block.naturalHeight || 180) * scale);
      item.lines = block.caption ? wrapPreviewText(block.caption, width, 12) : [];
      item.height = item.imageHeight + 20 + (item.lines.length ? 8 + item.lines.length * 20 : 0);
    } else if (block.type === 'divider') {
      item.height = 12;
    } else if (block.type === 'code') {
      item.lines = wrapPreviewText(block.code, width - 28, 13, 18);
      item.height = 38 + 28 + item.lines.length * 22;
    } else {
      item.fontSize = block.type === 'heading' ? (block.level === 1 ? 22 : 18) : 14;
      item.leading = block.type === 'heading' ? 26 : 22;
      const boxed = ['note', 'link', 'file'].includes(block.type);
      const value = block.type === 'link' ? [block.url, block.description].filter(Boolean).join('\n')
        : block.type === 'file' ? [block.filename || 'Attachment', block.description].filter(Boolean).join('\n') : block.text;
      item.lines = wrapPreviewText(value, width - (boxed ? 28 : 0), item.fontSize);
      item.height = item.lines.length * item.leading + (boxed ? 28 : 0);
    }
    y += item.height + gap;
    return item;
  });
  return { blocks, height: Math.max(0, y - gap) };
}
