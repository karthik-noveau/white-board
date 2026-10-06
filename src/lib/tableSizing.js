import { contentText } from './cellContent.js';

export const clampColumnWidth = width => Math.max(100, Math.min(1200, Math.round(width)));
export function distributeColumnWidths(widths) {
  const total = widths.reduce((sum, width) => sum + width, 0);
  return widths.map(() => clampColumnWidth(total / widths.length));
}

// Measure unwrapped text, not the current (possibly already clipped) cell box.
// Cap automatic sizing at 600px; manual resizing still allows wider columns.
export function fitColumnWidth(block, column, measure = text => text.length * 8) {
  const lines = [block.headers[column] || ''];
  let mediaWidth = 0;
  for (const row of block.rows) {
    const content = row[column]?.content || [];
    lines.push(...contentText(content).split('\n'));
    if (content.some(item => ['image', 'table'].includes(item.type))) mediaWidth = 280;
  }
  return Math.min(600, clampColumnWidth(lines.reduce((width,line)=>Math.max(width,measure(line)),mediaWidth) + 48));
}
