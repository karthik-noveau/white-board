import test from 'node:test';
import assert from 'node:assert/strict';
import { commandsFor, commandQuery, contentText, replaceContentText, csvText, cloneContent, insertCommand, insertRelativeBlock, editTable, locateBlock, newContent, newSlot, normalizeCellContent, safeAttachment, safeURL, textBlock, upgradeCell, attachmentFromTransfer, placeAttachment, readAttachment, MAX_ATTACHMENT_BYTES } from '../src/lib/cellContent.js';
import { nodeSize } from '../src/lib/boardAppearance.js';
import { createShareUrl, readShareLink } from '../src/lib/boardShare.js';
import { copyBoardState } from '../src/lib/boardViews.js';
import { createBoardSvg } from '../src/lib/boardExport.js';
const board = content => ({ cells: [{ id: 1, content }] });

test('image transfers accept file lists and clipboard items without consuming text pastes', () => {
  const image = { name: 'screenshot.png', type: 'image/png', size: 1024 };
  const file = { name: 'notes.txt', type: 'text/plain', size: 42 };
  assert.equal(attachmentFromTransfer({ files: [image] }), image);
  assert.equal(attachmentFromTransfer({ files: [file, image] }), image);
  assert.equal(attachmentFromTransfer({ files: [], items: [
    { kind: 'string', type: 'text/html' },
    { kind: 'file', getAsFile: () => null },
    { kind: 'file', getAsFile: () => image },
  ] }), image);
  assert.equal(attachmentFromTransfer({ files: [file] }), file);
  assert.equal(attachmentFromTransfer({ items: [{ kind: 'string', type: 'text/plain' }] }), null);
  assert.equal(attachmentFromTransfer(null), null);
});
test('replacing an image keeps its caption and location, including inside tables', () => {
  const image = normalizeCellContent([{ ...newContent('image'), data: 'data:image/png;base64,b2xk', caption: 'Keep this caption' }])[0];
  const table = newContent('table'); table.rows[0][1].content = [image, textBlock('Keep this note')];
  const value = board([table]);
  const data = { data: 'data:image/png;base64,bmV3', filename: 'new.png', mime: 'image/png', size: 3 };
  const result = placeAttachment(value, image.id, 'image', data, true);
  assert.equal(result, image);
  assert.equal(result.caption, 'Keep this caption');
  assert.equal(table.rows[0][1].content.length, 2);
  assert.equal(table.rows[0][1].content[1].text, 'Keep this note');
  assert.equal(result.data, data.data);
  assert.deepEqual(normalizeCellContent(value.cells[0].content), value.cells[0].content);
});
test('attachments insert beside text without losing it and do not resurrect deleted targets', () => {
  const text = textBlock('Keep my text'), value = board([text]);
  const data = { data: 'data:image/png;base64,bmV3' };
  const added = placeAttachment(value, text.id, 'image', data, true);
  assert.equal(value.cells[0].content[0].text, 'Keep my text');
  assert.equal(value.cells[0].content[1], added);
  const before = structuredClone(value);
  assert.equal(placeAttachment(value, 'deleted-id', 'image', data, true), null);
  assert.equal(placeAttachment(value, text.id, 'image', data), null);
  assert.deepEqual(value, before);
});
test('unsupported and oversized images are rejected before reading or changing content', async () => {
  await assert.rejects(readAttachment({ size: MAX_ATTACHMENT_BYTES + 1, type: 'image/png' }, true), /5 MB/);
  await assert.rejects(readAttachment({ size: 42, type: 'text/plain' }, true), /PNG, JPEG/);
  await assert.rejects(readAttachment({ size: 42, type: 'image/svg+xml' }, true), /PNG, JPEG/);
});

test('slash commands filter without consuming ordinary URLs or division', () => {
  assert.equal(commandQuery('https://example.com/table'), null);
  assert.equal(commandQuery('2/3'), null);
  assert.deepEqual(commandQuery('Compare /tab'), { query: 'tab', start: 8, end: 12 });
  assert.equal(commandsFor('todo')[0].type, 'checklist');
  assert.equal(commandsFor('', 3).some(item => item.type === 'table'), false);
});
test('insertion preserves text on both sides and an editable trailing paragraph', () => {
  const text = textBlock('Before /table after'), value = board([text]);
  insertCommand(value, text.id, 'table', { start: 7, end: 13 });
  assert.deepEqual(value.cells[0].content.map(b => b.type), ['text','table','text','text']);
  assert.equal(value.cells[0].content[0].text, 'Before ');
  assert.equal(value.cells[0].content[2].text, ' after');
});
test('table cells contain independently editable nested blocks', () => {
  const table = newContent('table'), value = board([table]), slot = table.rows[0][1];
  slot.content[0].text = '/checklist';
  const checklist = insertCommand(value, slot.content[0].id, 'checklist', { start: 0, end: 10 });
  checklist.tasks[0] = { text: 'Verify storage', done: true };
  assert.equal(locateBlock(value, checklist.id).depth, 1);
  assert.equal(slot.content[0].type, 'checklist');
  assert.equal(slot.content[1].type, 'text');
  assert.match(contentText([table]), /Item \| Details/);
  assert.match(contentText([table]), /\[x\] Verify storage/);
  assert.deepEqual(normalizeCellContent(JSON.parse(JSON.stringify([table]))), [table]);
});
test('insert blocks between a table and checklist without replacing either neighbor', () => {
  const table = newContent('table'), checklist = newContent('checklist'), value = board([table, checklist]);
  checklist.tasks[0].text = 'Keep this task';
  const note = insertRelativeBlock(value, table.id, 'note', 'after');
  const heading = insertRelativeBlock(value, table.id, 'heading', 'before');
  assert.deepEqual(value.cells[0].content.map(b => b.id), [heading.id, table.id, note.id, checklist.id, value.cells[0].content.at(-1).id]);
  assert.equal(value.cells[0].content.at(-1).type, 'text');
  assert.equal(checklist.tasks[0].text, 'Keep this task');
  assert.equal(locateBlock(value, note.id).depth, 0);
  assert.deepEqual(normalizeCellContent(value.cells[0].content), value.cells[0].content);
});
test('relative insertion respects the selected table cell and nesting limit', () => {
  const table = newContent('table'), value = board([table]);
  const slot = table.rows[0][0], original = slot.content[0]; original.text = 'Keep cell text';
  const checklist = insertRelativeBlock(value, original.id, 'checklist', 'before');
  assert.equal(slot.content[0].id, checklist.id);
  assert.equal(slot.content[1].text, 'Keep cell text');
  assert.equal(locateBlock(value, checklist.id).depth, 1);
  assert.equal(value.cells[0].content.length, 1);
  let parent = table;
  for (let depth = 1; depth < 3; depth++) {
    parent = insertRelativeBlock(value, parent.rows[1][0].content[0].id, 'table');
  }
  assert.throws(() => insertRelativeBlock(value, parent.rows[0][0].content[0].id, 'table'), /deeper table/);
});
test('row and column editing keeps nested content, widths and identifiers intact', () => {
  const table = newContent('table'), value = board([table]), retained = table.rows[0][1];
  retained.content = [{ ...newContent('checklist'), tasks: [{ text: 'Do not lose this', done: true }] }];
  const original = structuredClone(table);
  assert.equal(editTable(value, table.id, 'insert-column', 1), true);
  assert.equal(table.rows[0][2].id, retained.id);
  assert.equal(table.rows[0][1].content[0].text, '');
  assert.notEqual(table.rows[0][1].id, table.rows[1][1].id);
  assert.equal(editTable(value, table.id, 'insert-row', 0), true);
  assert.equal(table.rows[1][2].id, retained.id);
  assert.equal(editTable(value, table.id, 'delete-column', 1), true);
  assert.equal(editTable(value, table.id, 'delete-row', 0), true);
  assert.deepEqual(table, original);
  assert.deepEqual(normalizeCellContent([table]), [table]);
});
test('table boundaries prevent malformed tables and allow recovery after deleting all rows', () => {
  const table = newContent('table'), value = board([table]);
  assert.equal(editTable(value, table.id, 'delete-column', -1), false);
  assert.equal(editTable(value, table.id, 'insert-row', 99), false);
  assert.equal(editTable(value, table.id, 'delete-column', 1), true);
  assert.equal(editTable(value, table.id, 'delete-column', 0), false);
  assert.equal(editTable(value, table.id, 'delete-row', 0), true);
  assert.equal(editTable(value, table.id, 'delete-row', 0), true);
  assert.equal(editTable(value, table.id, 'delete-row', 0), false);
  assert.equal(editTable(value, table.id, 'insert-column', 1), true);
  assert.equal(editTable(value, table.id, 'insert-row', 0), true);
  assert.equal(table.rows[0].length, 2);
  assert.deepEqual(normalizeCellContent([table]), [table]);
  table.headers = Array(30).fill('Column'); table.rows = [];
  assert.equal(editTable(value, table.id, 'insert-column', 0), false);
  table.rows = Array.from({ length: 1000 }, () => []);
  assert.equal(editTable(value, table.id, 'insert-row', 0), false);
});
test('duplicating content regenerates nested identifiers without coupling edits', () => {
  const table = newContent('table'); table.rows[0][0].content = [newContent('image')];
  table.rows[0][0].content[0].data = 'data:image/png;base64,aGVsbG8=';
  const clone = cloneContent([table])[0];
  assert.notEqual(clone.id, table.id);
  assert.notEqual(clone.rows[0][0].id, table.rows[0][0].id);
  assert.notEqual(clone.rows[0][0].content[0].id, table.rows[0][0].content[0].id);
  clone.headers[0] = 'Changed'; assert.equal(table.headers[0], 'Item');
  assert.equal(clone.rows[0][0].content[0].data, table.rows[0][0].content[0].data);
});
test('legacy shape upgrade preserves text and rich formatting', () => {
  const node = { id: 1, title: 'Research', x: 30, y: 70, note: 'Findings', comments: [{ text: 'Check' }], root: true };
  const patch = upgradeCell(node, { title: node.title, titleHtml: '<b>Research</b>', note: node.note, noteHtml: '<i>Findings</i>' }, 'table');
  assert.equal(patch.titleHtml, '<b>Research</b>');
  assert.equal(patch.content[0].html, '<i>Findings</i>');
  assert.equal(patch.w, 520);
  assert.equal(node.x, 30); assert.equal(node.comments.length, 1);
});
test('unsafe attachments and URLs cannot become active content', () => {
  assert.equal(safeURL('javascript:alert(1)'), '');
  assert.equal(safeURL('https://user:password@example.com'), '');
  assert.equal(safeURL('developer.mozilla.org'), 'https://developer.mozilla.org/');
  assert.equal(safeAttachment('data:image/svg+xml;base64,PHN2Zz4=', true), '');
  assert.equal(safeAttachment('https://tracker.example/image.png', true), '');
  assert.equal(safeAttachment('data:text/html;base64,PHNjcmlwdD4='), '');
  assert.ok(safeAttachment('data:application/octet-stream;base64,aGVsbG8='));
});
test('content validation rejects malformed, duplicate and overly nested blocks', () => {
  const table = newContent('table'); table.rows[0].pop();
  assert.throws(() => normalizeCellContent([table]), /table row/);
  const text = textBlock('value'); assert.throws(() => normalizeCellContent([text, text]), /identifier/);
  const outer = newContent('table'); let nested = outer;
  for (let depth = 0; depth < 3; depth++) { const child = newContent('table'); nested.rows[0][0].content = [child]; nested = child; }
  assert.throws(() => normalizeCellContent([outer]), /table/);
});
test('CSV keeps nested values and neutralizes spreadsheet formulas', () => {
  const table = newContent('table'); table.rows = [[newSlot('=SUM(A1:A2)'), newSlot('a,"b"\nc')]];
  assert.match(csvText(table), /"'=SUM\(A1:A2\)"/);
  assert.match(csvText(table), /"a,""b""\nc"/);
});
test('attachments and nested content survive board snapshots and both share modes', async () => {
  const table = newContent('table'), image = newContent('image'); image.data = 'data:image/png;base64,aGVsbG8='; image.caption = 'Reference';
  table.rows[0][0].content = [image];
  const project = { title: 'Project', board: { nodes: [{ id: 1, x: 0, y: 0, title: 'Brief', content: [table], w: 520, contentHeight: 400 }], edges: [] } };
  const snapshot = copyBoardState(project.board);
  project.board.nodes[0].title = 'Updated'; assert.equal(snapshot.nodes[0].title, 'Brief');
  for (const access of ['readonly','editable']) {
    const link = await createShareUrl(project, 'https://nova.example', { access });
    const restored = await readShareLink(new URL(link).hash);
    assert.equal(restored.access, access);
    assert.deepEqual(restored.project.board.nodes[0].content, [table]);
  }
  project.board.nodes[0].content = [{ type: 'table', id: 'bad' }];
  await assert.rejects(() => createShareUrl(project, 'https://nova.example'), /invalid/);
});
test('cell geometry grows with content, retaining legacy sizes', () => {
  assert.deepEqual(nodeSize({}), { width: 228, height: 92 });
  assert.deepEqual(nodeSize({ content: [], w: 200, h: 80, contentHeight: 360 }), { width: 320, height: 360 });
  const node = { id: 1, title: 'R&D', x: 0, y: 0, content: [textBlock('A < B')], w: 380, contentHeight: 160 };
  const svg = createBoardSvg([node], []).svg;
  assert.match(svg, /R&amp;D/); assert.match(svg, /A &lt; B/);
  assert.doesNotMatch(svg, /foreignObject|<script/);
});

test('find and replace reaches nested blocks without touching attachment data', () => {
  const table=newContent('table'); table.rows[0][0].content=[{...newContent('checklist'),tasks:[{text:'Try Redis',done:true}]}];
  const content=[table,{...newContent('image'),data:'data:image/png;base64,UmVkaXM=',caption:'Redis chart'}];
  const next=replaceContentText(content,/Redis/g,'IndexedDB');
  assert.match(contentText(next),/Try IndexedDB/);
  assert.equal(next[1].caption,'IndexedDB chart');
  assert.equal(next[1].data,content[1].data);
  assert.match(contentText(content),/Try Redis/);
  assert.equal(replaceContentText(content,/unmatched/g,'value'),content);
});
