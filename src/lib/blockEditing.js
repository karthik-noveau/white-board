import { cloneContent, contentText, ensureEditor, locateBlock, locateOwner, normalizeCellContent, textBlock, walkContent } from './cellContent.js';
import { nodeSize } from './boardAppearance.js';

export const BLOCK_MIME = 'application/x-nova-blocks';
export const BLOCK_CLIPBOARD_KEY = 'nova-content-clipboard-v1';
let clipboard = null;
export function saveBlockClipboard(payload) {
  clipboard = payload;
  try { localStorage.setItem(BLOCK_CLIPBOARD_KEY, JSON.stringify(payload)); } catch { /* Large image selections remain available in this tab. */ }
}
export function readBlockClipboard() {
  if (clipboard) return clipboard;
  try { return readBlockPayload(localStorage.getItem(BLOCK_CLIPBOARD_KEY)); } catch { return null; }
}

// Native clipboard contents take precedence; a cached copy is only valid while
// the plain-text clipboard still matches it (including image-only selections).
export function blocksFromClipboard(transfer, cached = readBlockClipboard()) {
  const raw = transfer?.getData(BLOCK_MIME);
  if (raw) return readBlockPayload(raw);
  if (!cached || !Array.from(transfer?.types || []).includes('text/plain')) return null;
  return transfer.getData('text/plain') === contentText(cached.blocks) ? cached : null;
}

export function clearBlockClipboard() {
  clipboard = null;
  try { localStorage.removeItem(BLOCK_CLIPBOARD_KEY); } catch { /* Memory copy is cleared. */ }
}

export function cardPreview(card, limit = 110) {
  const text = (card.content ? contentText(card.content) : card.note || '').replace(/\s+/g, ' ').trim();
  if (text && text !== 'Double-click to edit') return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  const types = [...new Set((card.content || []).filter(block => block.type !== 'text').map(block => block.type))];
  return types.length ? types.join(' · ') : 'Empty card';
}

// Ignore descendants of selected parents, retaining document order.
export function selectedBlocks(content, ids) {
  const selected = new Set(ids), result = [];
  const visit = items => items.forEach(block => {
    if (selected.has(block.id)) result.push(block);
    else if (block.type === 'table') block.rows.forEach(row => row.forEach(slot => visit(slot.content)));
  });
  visit(content);
  return result;
}

export function blockPayload(card, ids, boardId) {
  const blocks = selectedBlocks(card.content || [], ids);
  if (!blocks.length) return null;
  return { version: 1, boardId, sourceCard: card.id, ids: blocks.map(block => block.id), blocks: structuredClone(blocks) };
}

export function readBlockPayload(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 30 * 1024 * 1024) return null;
    const payload = JSON.parse(raw);
    if (payload?.version !== 1 || !Array.isArray(payload.blocks) || !payload.blocks.length) return null;
    return { ...payload, blocks: normalizeCellContent(payload.blocks) };
  } catch { return null; }
}

const nestedDepth = block => block.type === 'table'
  ? 1 + Math.max(0, ...block.rows.flatMap(row => row.flatMap(slot => slot.content.map(nestedDepth)))) : 0;

// Validate first, then edit a clone. A rejected drop never removes source data.
export function transferBlocks(nodes, payload, destination, move = false) {
  const target = nodes.find(node => node.id === destination.cardId);
  if (!target || target.locked) throw new Error('Choose an unlocked card.');
  const source = nodes.find(node => node.id === payload?.sourceCard);
  if (move && (!source || source.locked)) throw new Error('The source card is no longer editable.');
  const originals = move ? selectedBlocks(source.content || [], payload.ids || []) : payload.blocks;
  if (!originals?.length || (move && originals.length !== payload.ids.length)) throw new Error('The selected blocks are no longer available.');
  const cells = nodes.map(node => ({ ...node, content: structuredClone(node.content || []) }));
  const board = { cells }, targetCell = cells.find(node => node.id === target.id);
  if (!target.content) { const size = nodeSize(target); Object.assign(targetCell, {contentLayout:'card', w:size.width, h:size.height}); }
  if (!target.content && target.note?.trim() && target.note !== 'Double-click to edit') targetCell.content.push({ ...textBlock(target.note), ...(target.noteHtml ? { html: target.noteHtml } : {}) });
  const targetEntry = destination.blockId ? locateBlock(board, destination.blockId) : null;
  const targetOwner = destination.ownerId ? locateOwner(board, destination.ownerId) : null;
  if (destination.blockId && (!targetEntry || targetEntry.cell.id !== target.id)) throw new Error('The destination block is no longer available.');
  if (destination.ownerId && (!targetOwner || targetOwner.cell.id !== target.id)) throw new Error('The destination cell is no longer available.');
  const depth = targetEntry?.depth ?? targetOwner?.depth ?? 0;
  if (originals.some(block => depth + nestedDepth(block) > 3)) throw new Error('Tables can be nested up to three levels.');
  if (move) {
    const movingIds = new Set();
    walkContent(originals, ({ block }) => { movingIds.add(block.id); if (block.type === 'table') block.rows.flat().forEach(slot => movingIds.add(slot.id)); });
    if (movingIds.has(destination.blockId) || movingIds.has(destination.ownerId)) throw new Error('Drop outside the selected blocks.');
  }
  const blocks = move ? structuredClone(originals) : cloneContent(originals);
  const changed = new Set([target.id]);
  if (move) {
    changed.add(source.id);
    for (const block of blocks) {
      const entry = locateBlock(board, block.id);
      entry.siblings.splice(entry.index, 1);
      if (entry.owner !== entry.cell) ensureEditor(entry.siblings);
    }
  }
  // Locate again after removals because indexes can shift in the same document.
  const entry = destination.blockId ? locateBlock(board, destination.blockId) : null;
  const owner = destination.ownerId ? locateOwner(board, destination.ownerId)?.owner : null;
  const siblings = entry?.siblings || owner?.content || targetCell.content;
  const index = entry ? entry.index + (destination.position === 'before' ? 0 : 1) : siblings.length;
  siblings.splice(index, 0, ...blocks);
  ensureEditor(siblings);
  for (const cell of cells) if (changed.has(cell.id)) {
    ensureEditor(cell.content);
    // Validate the final document, including total block count and identities.
    normalizeCellContent(cell.content);
    cell.note = contentText(cell.content); cell.noteHtml = undefined;
    if (cell.content.some(block => block.type === 'table')) cell.w = Math.max(520, cell.w || 0);
  }
  return { nodes: nodes.map(node => changed.has(node.id) ? cells.find(cell => cell.id === node.id) : node), ids: blocks.map(block => block.id) };
}

export function removeBlocks(content, ids) {
  const board = { cells: [{ id: 'editing', content: structuredClone(content) }] };
  for (const block of selectedBlocks(board.cells[0].content, ids)) {
    const entry = locateBlock(board, block.id); entry.siblings.splice(entry.index, 1); ensureEditor(entry.siblings);
  }
  return board.cells[0].content;
}

export function blockSelection(content, current, id, { range = false, toggle = false } = {}) {
  const order = [];
  walkContent(content, ({ block }) => order.push(block.id));
  if (range && current.length) {
    const start = order.indexOf(current[0]), end = order.indexOf(id);
    if (start >= 0 && end >= 0) return order.slice(Math.min(start, end), Math.max(start, end) + 1);
  }
  return toggle ? current.includes(id) ? current.filter(value => value !== id) : [...current, id] : [id];
}
