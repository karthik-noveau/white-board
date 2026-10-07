import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateBoardSelection } from '../src/lib/duplicateBoardSelection.js';
import { createNodeDrag, moveDraggedNodes } from '../src/lib/nodeDrag.js';

const nodes = [
  { id: 'frame', kind: 'frame', title: 'Frame', x: 0, y: 0 },
  { id: 'a', frameId: 'frame', x: 10, y: 20, content: [{ id: 'text', type: 'text', text: 'Original' }] },
  { id: 'nested', kind: 'frame', frameId: 'frame', x: 200, y: 20 },
  { id: 'hidden', frameId: 'nested', hidden: true, x: 210, y: 30 },
  { id: 'outside', x: 900, y: 0 },
];
const edges = [{ id: 'inside', from: 'a', to: 'hidden', controlX: 100, controlY: 40 }, { id: 'outside', from: 'a', to: 'outside' }];
const duplicate = selected => {
  let node = 10, edge = 20;
  return duplicateBoardSelection(nodes, edges, selected, () => node++, () => edge++);
};

test('duplicating a frame includes nested and hidden children with independent parent references', () => {
  const before = structuredClone(nodes), copy = duplicate(['frame', 'nested']);
  assert.deepEqual(copy.ids, [10, 11, 12, 13]);
  assert.equal(copy.nodes[1].frameId, 10);
  assert.equal(copy.nodes[2].frameId, 10);
  assert.equal(copy.nodes[3].frameId, 12);
  assert.equal(copy.nodes[3].hidden, true);
  assert.deepEqual(copy.edges, [{ id: 20, from: 11, to: 13, controlX: 135, controlY: 75 }]);
  copy.nodes[1].content[0].text = 'Independent edit';
  assert.deepEqual(nodes, before);
  const all = [...nodes, ...copy.nodes];
  const drag = createNodeDrag(all, copy.edges, copy.ids);
  const moved = moveDraggedNodes(all, drag, 100, 200);
  assert.deepEqual(moved.slice(0, nodes.length), nodes);
  assert.equal(moved.find(node => node.id === 11).x, 145);
});

test('duplicating a card alone retains its existing parent without copying unrelated cards', () => {
  const copy = duplicate(['a']);
  assert.equal(copy.nodes.length, 1);
  assert.equal(copy.nodes[0].frameId, 'frame');
  assert.deepEqual(copy.edges, []);
});

test('duplicated groups receive fresh identities while staying grouped together', () => {
  let id = 10;
  const grouped = nodes.slice(0, 2).map(node => ({ ...node, groupId: 'original-group' }));
  const copy = duplicateBoardSelection(grouped, [], ['frame'], () => id++, () => id++);
  assert.notEqual(copy.nodes[0].groupId, 'original-group');
  assert.equal(copy.nodes[0].groupId, copy.nodes[1].groupId);
});
