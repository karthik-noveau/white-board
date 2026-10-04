export const TYPES = {
  text: { name: 'Text', icon: 'type', description: 'Just start writing.', aliases: 'paragraph plain' },
  heading: { name: 'Heading', icon: 'heading-2', description: 'Give an idea a clear heading.', aliases: 'title h2' },
  table: { name: 'Table', icon: 'table-2', description: 'Compare information. Every cell accepts blocks.', aliases: 'grid data' },
  checklist: { name: 'Checklist', icon: 'list-checks', description: 'A few actionable next steps.', aliases: 'todo to-do task check' },
  image: { name: 'Image', icon: 'image', description: 'Upload, paste, or drop a screenshot.', aliases: 'photo screenshot picture' },
  code: { name: 'Code', icon: 'code-2', description: 'An editable snippet with a copy button.', aliases: 'snippet script' },
  note: { name: 'Note', icon: 'sticky-note', description: 'Highlight a finding or an open question.', aliases: 'callout sticky' },
  link: { name: 'Link', icon: 'link', description: 'A useful URL with a little context.', aliases: 'bookmark url website' },
  file: { name: 'File', icon: 'paperclip', description: 'Keep an original file alongside your work.', aliases: 'attachment upload' },
  divider: { name: 'Divider', icon: 'minus', description: 'A quiet break between ideas.', aliases: 'separator line' },
};
export const uid = (prefix = 'block') => `${prefix}-${crypto.randomUUID()}`;
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const copy = value => structuredClone(value);
export function safeURL(value) {
  try {
    const text = String(value).trim();
    if (!text || /\s/.test(text)) return '';
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
export function textBlock(text = '') { return { id: uid('text'), type: 'text', text }; }
export function newSlot(text = '') { return { id: uid('slot'), content: [textBlock(text)] }; }
export function newContent(type) {
  if (!Object.hasOwn(TYPES, type)) throw new Error('Unknown content type');
  return Object.assign({ id: uid(type), type }, {
    text: { text: '' }, heading: { text: '' }, divider: {},
    table: { headers: ['Item', 'Details'], rows: [[newSlot(), newSlot()], [newSlot(), newSlot()]] },
    checklist: { tasks: [{ text: '', done: false }] },
    code: { code: '', language: 'JavaScript' },
    note: { text: '', tone: 'warm' },
    image: { assetId: '', filename: '', caption: '', naturalWidth: 0, naturalHeight: 0, fit: 'contain' },
    link: { url: '', description: '' },
    file: { assetId: '', filename: '', mime: '', size: 0, description: '' },
  }[type]);
}
export function newCell(title = 'Untitled cell', x = 70, y = 60) { return { id: uid('cell'), title, x, y, width: 560, content: [textBlock()] }; }
export function walkContent(content, visit, cell, owner = cell, depth = 0) {
  content.forEach((block, index) => {
    visit({ block, siblings: content, index, owner, cell, depth });
    if (block.type === 'table') block.rows.forEach(row => row.forEach(slot => walkContent(slot.content, visit, cell, slot, depth + 1)));
  });
}
export function walkBoard(board, visit) { board.cells.forEach(cell => walkContent(cell.content, visit, cell)); }
export function locateBlock(board, id) { let result = null; walkBoard(board, entry => { if (entry.block.id === id) result = entry; }); return result; }
export function locateOwner(board, id) {
  const cell = board.cells.find(c => c.id === id); if (cell) return { owner: cell, cell, depth: 0 };
  let result = null;
  walkBoard(board, entry => { if (entry.block.type === 'table') for (const row of entry.block.rows) for (const slot of row) if (slot.id === id) result = { owner: slot, cell: entry.cell, depth: entry.depth + 1 }; });
  return result;
}
export function assetIds(board) { const ids = new Set(); walkBoard(board, ({ block }) => { if (block.assetId) ids.add(block.assetId); }); return [...ids]; }
export function contentCount(board) { let count = 0; walkBoard(board, ({ block }) => { if (block.type !== 'text' || block.text.trim()) count++; }); return count; }
export function ensureEditor(content) {
  if (!content.length || content.at(-1).type !== 'text' || content.at(-1).text !== '') content.push(textBlock());
  content.forEach(b => { if (b.type === 'table') b.rows.forEach(row => row.forEach(slot => { if (!slot.content.length) slot.content.push(textBlock()); })); });
}
export function commandQuery(value, caret = value.length) {
  const prefix = value.slice(0, caret), match = prefix.match(/(?:^|[\s])\/([a-z-]*)$/i);
  if (!match) return null;
  return { query: match[1].toLowerCase(), start: caret - match[1].length - 1, end: caret };
}
export function commandsFor(query = '', depth = 0) {
  return Object.entries(TYPES).filter(([type, item]) => (depth < 3 || type !== 'table') && `${type} ${item.name} ${item.aliases}`.toLowerCase().includes(query.trim().toLowerCase())).map(([type, item]) => ({ type, ...item }));
}
export function insertCommand(board, id, type, range = null) {
  const entry = locateBlock(board, id); if (!entry) throw new Error('This cell is no longer available');
  if (type === 'table' && entry.depth >= 3) throw new Error('Use another cell for a deeper table');
  const { block, siblings, index } = entry, added = newContent(type);
  if (range && ['text', 'heading', 'note'].includes(block.type)) {
    const before = block.text.slice(0, range.start), after = block.text.slice(range.end);
    if (!before.trim() && !after.trim()) siblings.splice(index, 1, added);
    else if (block.type === 'text') {
      const replacements = [];
      if (before) replacements.push({ ...block, text: before });
      replacements.push(added);
      if (after) replacements.push(textBlock(after));
      siblings.splice(index, 1, ...replacements);
    } else { block.text = before + after; siblings.splice(index + 1, 0, added); }
  } else siblings.splice(index + 1, 0, added);
  ensureEditor(siblings);
  return added;
}
export function insertRelativeBlock(board, id, type, position = 'after') {
  const entry = locateBlock(board, id);
  if (!entry) throw new Error('This block is no longer available');
  if (!['before', 'after'].includes(position)) throw new Error('Invalid insertion position');
  if (type === 'table' && entry.depth >= 3) throw new Error('Use another card for a deeper table');
  const added = newContent(type);
  entry.siblings.splice(entry.index + (position === 'after' ? 1 : 0), 0, added);
  ensureEditor(entry.siblings);
  return added;
}

// Keep row widths and nested block identities intact during structural edits.
export function editTable(board, id, action, index) {
  const table = locateBlock(board, id)?.block;
  if (table?.type !== 'table' || !Number.isInteger(index)) return false;
  if (action === 'insert-row' && index >= 0 && index <= table.rows.length && table.rows.length < 1000) {
    table.rows.splice(index, 0, table.headers.map(() => newSlot()));
  } else if (action === 'delete-row' && index >= 0 && index < table.rows.length) {
    table.rows.splice(index, 1);
  } else if (action === 'insert-column' && index >= 0 && index <= table.headers.length && table.headers.length < 30) {
    table.headers.splice(index, 0, 'Column');
    table.rows.forEach(row => row.splice(index, 0, newSlot()));
  } else if (action === 'delete-column' && index >= 0 && index < table.headers.length && table.headers.length > 1) {
    table.headers.splice(index, 1);
    table.rows.forEach(row => row.splice(index, 1));
  } else return false;
  return true;
}
export function cloneContent(content) {
  return content.map(b => {
    const cloned = { ...copy(b), id: uid(b.type) };
    if (cloned.type === 'table') cloned.rows = cloned.rows.map(row => row.map(slot => ({ id: uid('slot'), content: cloneContent(slot.content) })));
    return cloned;
  });
}
export function contentText(content) {
  return content.map(b => b.text ?? b.code ?? (b.type === 'checklist' ? b.tasks.map(t => `${t.done ? '[x]' : '[ ]'} ${t.text}`).join('\n') : b.type === 'table' ? [b.headers.join(' | '), ...b.rows.map(row => row.map(s => contentText(s.content)).join(' | '))].join('\n') : b.type === 'link' ? [b.url, b.description].filter(Boolean).join('\n') : [b.filename, b.caption || b.description].filter(Boolean).join('\n'))).filter(Boolean).join('\n');
}
export function csvText(block) {
  const quote = value => { let text = String(value ?? ''); if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"','""')}"`; };
  return [block.headers, ...block.rows.map(row => row.map(slot => contentText(slot.content)))].map(row => row.map(quote).join(',')).join('\r\n');
}

export function replaceContentText(content, pattern, replacement) {
  const next = copy(content); let changed = false;
  const replace = text => { const result = text.replace(pattern, replacement); if (result !== text) changed = true; return result; };
  walkContent(next, ({ block }) => {
    for (const key of ['text','code','caption','description','url','filename']) {
      if (typeof block[key] !== 'string') continue;
      const result = replace(block[key]);
      if (key === 'text' && result !== block.text) delete block.html;
      block[key] = result;
    }
    if (block.type === 'table') block.headers = block.headers.map(replace);
    if (block.type === 'checklist') block.tasks = block.tasks.map(task => ({ ...task, text: replace(task.text) }));
  });
  return changed ? next : content;
}

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
// Clipboard screenshots can be exposed through items instead of files. Prefer
// image data when a browser also supplies another representation of the paste.
export function attachmentFromTransfer(transfer) {
  const files = Array.from(transfer?.files || []);
  if (!files.length) for (const item of Array.from(transfer?.items || [])) {
    if (item.kind === 'file') { const file = item.getAsFile?.(); if (file) files.push(file); }
  }
  return files.find(file => file.type.startsWith('image/')) || files[0] || null;
}

// Apply a fully read attachment in one undo step; replacing an image preserves
// its caption, block identity and position, including inside a table cell.
export function placeAttachment(board, id, type, data, insert = false) {
  const entry = id == null ? null : locateBlock(board, id);
  if (id != null && !entry) return null;
  let block = entry?.block;
  if (block?.type !== type) {
    if (!insert) return null;
    if (entry) block = insertCommand(board, id, type);
    else {
      block = newContent(type);
      board.cells[0].content.push(block);
      ensureEditor(board.cells[0].content);
    }
  }
  Object.assign(block, data);
  return block;
}
export function safeAttachment(value, image = false) {
  if (typeof value !== 'string' || value.length > MAX_ATTACHMENT_BYTES * 1.4) return '';
  const match = value.match(/^data:([^;,]+);base64,([a-zA-Z0-9+/]*={0,2})$/);
  return match && (image ? IMAGE_TYPES.includes(match[1]) : match[1] === 'application/octet-stream') ? value : '';
}

// Use the same portable payload for IndexedDB, undo, backups and share links.
// Attachments are local data, never remote resources loaded from a shared board.
export function readAttachment(file, image = false) {
  if (file.size > MAX_ATTACHMENT_BYTES) return Promise.reject(new Error('Choose a file smaller than 5 MB.'));
  if (image && !IMAGE_TYPES.includes(file.type)) return Promise.reject(new Error('Choose a PNG, JPEG, WebP, GIF or AVIF image.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('This file could not be read. Please try again.'));
    reader.onload = () => resolve({ data: image ? reader.result : String(reader.result).replace(/^data:[^,]*,/, 'data:application/octet-stream;base64,'), filename: file.name || 'Pasted image', mime: file.type, size: file.size });
    reader.readAsDataURL(file);
  });
}

export function normalizeCellContent(content) {
  const ids = new Set(); let count = 0;
  const id = value => { if (typeof value !== 'string' || !value || value.length > 200 || ids.has(value)) throw new Error('Invalid content identifier'); ids.add(value); return value; };
  function normalize(items, depth = 0) {
    if (!Array.isArray(items) || depth > 3) throw new Error('Invalid cell content');
    return items.map(item => {
      if (++count > 10000 || !item || !Object.hasOwn(TYPES, item.type)) throw new Error('Invalid content block');
      const b = { id: id(item.id), type: item.type };
      for (const key of ['text', 'html', 'code', 'caption', 'filename', 'description', 'url', 'language', 'mime']) if (item[key] != null) b[key] = String(item[key]);
      if (['text', 'heading', 'note'].includes(b.type)) b.text ??= '';
      if (b.type === 'table') {
        if (depth >= 3 || !Array.isArray(item.headers) || !item.headers.length || item.headers.length > 30 || !Array.isArray(item.rows) || item.rows.length > 1000) throw new Error('Invalid table');
        b.headers = item.headers.map(String);
        b.rows = item.rows.map(row => {
          if (!Array.isArray(row) || row.length !== b.headers.length) throw new Error('Invalid table row');
          return row.map(slot => ({ id: id(slot.id), content: normalize(slot.content, depth + 1) }));
        });
      }
      if (b.type === 'checklist') {
        if (!Array.isArray(item.tasks) || item.tasks.length > 1000) throw new Error('Invalid checklist');
        b.tasks = item.tasks.map(task => ({ text: String(task?.text ?? ''), done: !!task?.done }));
      }
      if (b.type === 'note') b.tone = ['warm','mint','violet'].includes(item.tone) ? item.tone : 'warm';
      if (['image', 'file'].includes(b.type)) {
        b.data = safeAttachment(item.data, b.type === 'image');
        b.size = Math.max(0, Number(item.size) || 0);
        b.naturalWidth = Math.max(0, Number(item.naturalWidth) || 0);
        b.naturalHeight = Math.max(0, Number(item.naturalHeight) || 0);
      }
      return b;
    });
  }
  return normalize(content);
}

export function upgradeCell(node, draft, type) {
  const content = [];
  if (draft.note?.trim() && draft.note !== 'Double-click to edit') content.push({ ...textBlock(draft.note), ...(draft.noteHtml ? { html: draft.noteHtml } : {}) });
  content.push(newContent(type));
  ensureEditor(content);
  return { ...draft, note: '', noteHtml: undefined, content, shape: 'round', w: Math.max(node.w || 0, type === 'table' ? 520 : 380), h: 0 };
}
