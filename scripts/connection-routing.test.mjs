import assert from 'node:assert/strict';
import test from 'node:test';
import { boardEdgeData } from '../src/lib/boardGeometry.js';
import { createBoardSvg } from '../src/lib/boardExport.js';

const nodes = [{ id: 1, x: 0, y: 0, w: 100, h: 100 }, { id: 2, x: 600, y: 400, w: 100, h: 100 }];
const edge = { id: 1, from: 1, to: 2, side: 'right', structure: 'elbow', controlX: 562, controlY: 50 };
const coordinates = path => {
  const values = path.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number);
  return Array.from({ length: values.length / 2 }, (_, i) => ({ x: values[i * 2], y: values[i * 2 + 1] }));
};

test('a collapsed first bend does not leave an overshoot or a reverse hook', () => {
  const derived = boardEdgeData(nodes, [edge])[0];
  assert.equal(derived.path, 'M100,50 L538,50 Q552,50 552,64 L552,436 Q552,450 566,450 L600,450');
  assert.equal((derived.path.match(/Q/g) || []).length, 2);
  assert.ok(!coordinates(derived.path).some(point => point.x > 552 && point.y === 50));
});

test('collapsed bends are cleaned in every direction', () => {
  const original = coordinates(boardEdgeData(nodes, [edge])[0].path);
  const cases = [
    { side: 'left', nodes: nodes.map(node => ({ ...node, x: 600 - node.x })), controlX: 138, controlY: 50, map: point => ({ x: 700 - point.x, y: point.y }) },
    { side: 'bottom', nodes: nodes.map(node => ({ ...node, x: node.y, y: node.x })), controlX: 50, controlY: 562, map: point => ({ x: point.y, y: point.x }) },
    { side: 'top', nodes: nodes.map(node => ({ ...node, x: node.y, y: 600 - node.x })), controlX: 50, controlY: 138, map: point => ({ x: point.y, y: 700 - point.x }) },
  ];
  for (const item of cases) {
    const derived = boardEdgeData(item.nodes, [{ ...edge, side: item.side, controlX: item.controlX, controlY: item.controlY }])[0];
    assert.deepEqual(coordinates(derived.path), original.map(item.map), item.side);
  }
});

test('an aligned last bend does not double back before the endpoint', () => {
  const derived = boardEdgeData(nodes, [{ ...edge, controlX: 580, controlY: 450 }])[0];
  assert.equal(derived.path, 'M100,50 L566,50 Q580,50 580,64 L580,440 Q580,450 590,450 L600,450');
});

test('real detours remain rounded and preserve the saved routing controls', () => {
  const routed = { ...edge, controlX: 350, controlY: 600 }, before = structuredClone(routed);
  const derived = boardEdgeData(nodes, [routed])[0];
  assert.equal((derived.path.match(/Q/g) || []).length, 4);
  assert.equal(Math.max(...coordinates(derived.path).map(point => point.y)), 600);
  assert.deepEqual(routed, before);
});

test('fully collapsed routes remain finite at the actual connection point', () => {
  const touching = [nodes[0], { ...nodes[1], x: 100, y: 0 }];
  const derived = boardEdgeData(touching, [{ ...edge, controlX: 150, controlY: 50 }])[0];
  assert.equal(derived.path, 'M100,50 L100,50');
  assert.ok(Number.isFinite(derived.labelPoint.x) && Number.isFinite(derived.labelPoint.y));
});

test('labels and exports use the cleaned connector without altering its shape', () => {
  const plain = boardEdgeData(nodes, [edge])[0];
  const labeled = boardEdgeData(nodes, [{ ...edge, label: 'An editable connection label', labelPosition: .8 }])[0];
  assert.equal(labeled.path, plain.path);
  assert.ok(createBoardSvg(nodes, [labeled], 'white').svg.includes(`d="${plain.path}"`));
});
