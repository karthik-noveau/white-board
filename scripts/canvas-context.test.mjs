import assert from 'node:assert/strict';
import test from 'node:test';
import { contextNodeIds, canvasContextPoint } from '../src/lib/canvasContext.js';

const nodes = [{ id: 0 }, { id: 1 }, { id: 2, groupId: 'team' }, { id: 3, groupId: 'team', locked: true }, { id: 'card-4' }];
test('right-click on a selected card keeps the whole selection, including locked cards', () => {
  const selection = [0, 1, 3];
  assert.deepEqual(contextNodeIds(nodes, selection, 1), selection);
  assert.deepEqual(selection, [0, 1, 3]);
});
test('right-click on an unselected card replaces an unrelated selection', () => {
  assert.deepEqual(contextNodeIds(nodes, [1, 2, 3], 0), [0]);
  assert.deepEqual(contextNodeIds(nodes, [0, 1], 'card-4'), ['card-4']);
});
test('right-click respects groups without selecting unrelated cards', () => {
  assert.deepEqual(contextNodeIds(nodes, [0, 1], 2), [2, 3]);
  assert.deepEqual(contextNodeIds(nodes, [2, 3], 3), [2, 3]);
});
test('removed targets and stale selections are ignored', () => {
  assert.deepEqual(contextNodeIds(nodes, [99, 1], 1), [1]);
  assert.deepEqual(contextNodeIds(nodes, [1], 99), []);
});
test('add and paste positions follow the context click through zoom, pan, and header offsets', () => {
  const point = canvasContextPoint({ x: 340, y: 220 }, { left: 20, top: 60 }, { x: -180, y: 40, scale: 2 });
  assert.deepEqual(point, { left: 340, top: 220, x: 250, y: 60 });
});
test('context clicks at the viewport edge keep coordinate zero', () => {
  assert.deepEqual(canvasContextPoint({ x: 0, y: 0 }, { left: 0, top: 0 }, { x: 100, y: -50, scale: .5 }), { left: 0, top: 0, x: -200, y: 100 });
});
