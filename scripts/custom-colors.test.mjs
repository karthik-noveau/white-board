import assert from 'node:assert/strict';
import test from 'node:test';
import { colorSwatch, customColors, isBoardColor, normalizeHexColor, paletteFor, palettes, rootColors } from '../src/lib/boardAppearance.js';
import { applyBranchStyle, branchStyleScope, childBranchStyle } from '../src/lib/branchStyles.js';
import { validateBoard } from '../src/lib/boardValidation.js';
import { createShareUrl, readShareHash } from '../src/lib/boardShare.js';
import { createBoardSvg } from '../src/lib/boardExport.js';

test('custom fills accept hex shorthand, reject CSS, and preserve preset palettes', () => {
  assert.equal(normalizeHexColor(' ABC '), '#aabbcc');
  assert.equal(normalizeHexColor('#7C3AED'), '#7c3aed');
  for (const value of ['#12', '#gggggg', '#ffffffff', 'red', 'url(https://example.com)', 'constructor', {}, null]) {
    assert.equal(normalizeHexColor(value), null);
    assert.equal(isBoardColor(value), false);
  }
  for (const key of Object.keys(palettes)) assert.deepEqual(paletteFor(key), palettes[key]);
  assert.equal(rootColors({ color: 'violet' }).fill, '#6436dc');
  assert.equal(colorSwatch('#123'), '#112233');
});

test('custom colors keep the exact fill and choose text with at least 4.5:1 contrast', () => {
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255).map(s => s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  for (const fill of ['#ffffff', '#000000', '#163050', '#ffeea1', '#7c3aed', '#777777', '#00aa55', '#e05b8f']) {
    const colors = customColors(fill), values = [luminance(fill), luminance(colors.text)].sort((a,b) => a-b);
    assert.equal(colors.fill, fill);
    assert.ok((values[1] + .05) / (values[0] + .05) >= 4.5);
    assert.deepEqual(rootColors({ color: fill }), colors);
  }
});

test('custom branch colors respect disconnected and locked cards and inherit in children', () => {
  const nodes = [1, 2, 3].map(id => ({ id, color: 'white' })), edges = [{ id: 1, from: 1, to: 2 }];
  const scope = branchStyleScope(nodes, edges, [1]);
  const result = applyBranchStyle(nodes, edges, scope, 'color', '#173555');
  assert.deepEqual(result.nodes.map(n => n.color), ['#173555', '#173555', 'white']);
  assert.equal(childBranchStyle(result.nodes[0], edges, {}).color, '#173555');
  assert.equal(applyBranchStyle(nodes, edges, { ...scope, locked: true }, 'color', '#173555').nodes, nodes);
  assert.equal(applyBranchStyle(nodes, edges, scope, 'color', '#173555', true).nodes, nodes);
  assert.equal(applyBranchStyle(nodes, edges, scope, 'color', 'url(invalid)').nodes, nodes);
});

test('custom fills survive share round trips and SVG export for shapes and document cards', async () => {
  const board = { nodes: [
    { id: 1, x: 0, y: 0, title: 'Dark card', color: '#163050' },
    { id: 2, x: 300, y: 0, title: 'Light card', color: '#ffeea1', content: [{ id: 'text', type: 'text', text: 'Editable body' }] },
  ], edges: [], globalSettings: { color: '#163050' } };
  validateBoard(board);
  assert.throws(() => validateBoard({ ...board, nodes: [{ ...board.nodes[0], color: 'url(invalid)' }] }));
  const project = { id: 'custom', title: 'Custom colors', accent: 'violet', board };
  const link = await createShareUrl(project, 'https://example.com');
  assert.deepEqual((await readShareHash(new URL(link).hash)).board, board);
  const svg = createBoardSvg(board.nodes, [], 'transparent').svg;
  assert.match(svg, /fill="#163050"/);
  assert.match(svg, /fill="#ffeea1"/);
  assert.match(svg, /fill="#ffffff"[^>]*>Dark card/);
  assert.match(svg, /fill="#000000"[^>]*>Editable body/);
});
