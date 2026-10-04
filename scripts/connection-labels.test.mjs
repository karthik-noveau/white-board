import assert from 'node:assert/strict';
import test from 'node:test';
import { connectionLabelPoint, closestLabelPosition, connectionLabelPlacement } from '../src/lib/connectionLabels.js';
import { boardEdgeData } from '../src/lib/boardGeometry.js';
import { createBoardSvg } from '../src/lib/boardExport.js';
import { createSavedView, restoreSavedView } from '../src/lib/boardViews.js';
import { createShareUrl, readShareLink } from '../src/lib/boardShare.js';

const near = (actual, expected, tolerance = .3) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);
const nodes = [{ id: 1, x: 0, y: 0, w: 100, h: 80 }, { id: 2, x: 600, y: 300, w: 100, h: 80 }];
const edge = { id: 1, from: 1, to: 2, side: 'right', label: 'A connection', labelPosition: .8 };

test('straight labels project onto the line and stop at its endpoints', () => {
  const path = 'M100,40 L600,40';
  assert.deepEqual(connectionLabelPoint(path), { x: 350, y: 40 });
  assert.deepEqual(connectionLabelPoint(path, .8), { x: 500, y: 40 });
  near(closestLabelPosition(path, { x: 500, y: 500 }), .8, 1e-8);
  assert.equal(closestLabelPosition(path, { x: -100, y: 40 }), 0);
  assert.equal(closestLabelPosition(path, { x: 900, y: 40 }), 1);
  assert.deepEqual(connectionLabelPoint(path, -20), { x: 100, y: 40 });
  assert.deepEqual(connectionLabelPoint(path, 20), { x: 600, y: 40 });
});
test('quadratic and cubic labels follow the curve rather than the routing handle', () => {
  const quadratic = 'M0,0 Q100,200 200,0', cubic = 'M0,0 C0,200 200,200 200,0';
  const q = connectionLabelPoint(quadratic), c = connectionLabelPoint(cubic);
  near(q.x, 100); near(q.y, 100);
  near(c.x, 100); near(c.y, 150);
  for (const path of [quadratic, cubic]) for (const position of [.1, .3, .7, .9]) {
    near(closestLabelPosition(path, connectionLabelPoint(path, position)), position, 1e-6);
  }
});
test('elbow labels can cross corners and use distance along the complete path', () => {
  const path = 'M0,0 L100,0 L100,200 L300,200';
  assert.deepEqual(connectionLabelPoint(path, .5), { x: 100, y: 150 });
  near(closestLabelPosition(path, { x: 270, y: 180 }), .94, 1e-8);
  const rounded = 'M0,0 L90,0 Q100,0 100,10 L100,200';
  const fraction = closestLabelPosition(rounded, { x: 97.5, y: 2.5 });
  const point = connectionLabelPoint(rounded, fraction);
  near(point.x, 97.5); near(point.y, 2.5);
});
test('degenerate and reversed paths remain finite', () => {
  assert.deepEqual(connectionLabelPoint('M8,9 L8,9'), { x: 8, y: 9 });
  assert.equal(closestLabelPosition('M8,9 L8,9', { x: 40, y: 40 }, .7), .7);
  assert.deepEqual(connectionLabelPoint('M100,0 L0,0', .25), { x: 75, y: 0 });
  assert.deepEqual(connectionLabelPoint(''), { x: 0, y: 0 });
  const loop = 'M0,0 C100,200 -100,200 0,0';
  const mid = connectionLabelPoint(loop);
  near(mid.x, 0); near(mid.y, 150);
});
test('moving a label never changes the connector geometry or route handles', () => {
  for (const structure of ['straight', 'curve', 'elbow']) for (const routing of [{}, { controlX: 320, controlY: 520 }]) {
    const original = boardEdgeData(nodes, [{ ...edge, ...routing, structure, labelPosition: .5 }])[0];
    const moved = boardEdgeData(nodes, [{ ...edge, ...routing, structure }])[0];
    assert.equal(moved.path, original.path);
    assert.deepEqual(moved.control, original.control);
    assert.deepEqual(moved.handles, original.handles);
    assert.notDeepEqual(moved.labelPoint, original.labelPoint);
    near(closestLabelPosition(moved.path, moved.labelPoint), moved.labelPosition, 1e-6);
  }
});

test('labels stop on either side of a control dot and can cross past it', () => {
  const path = 'M0,0 L500,0', handles = [{ x: 250, y: 0, mode: 'free' }];
  const left = connectionLabelPlacement(path, .5, 'Label', handles, .3);
  const right = connectionLabelPlacement(path, .5, 'Label', handles, .7);
  assert.ok(left.point.x + 22.25 < 250 - 14 - 4);
  assert.ok(right.point.x - 22.25 > 250 + 14 + 4);
  near(left.point.y, 0); near(right.point.y, 0);
  assert.equal(connectionLabelPlacement(path, .8, 'Label', handles, left.position).position, .8);
  assert.deepEqual(connectionLabelPlacement(path, left.position, 'Label', handles), left);
  assert.deepEqual(connectionLabelPlacement(path, right.position, 'Label', handles), right);
});
test('vertical, diagonal and elbow labels leave space for handles and endpoints', () => {
  const cases = [
    ['M0,0 L0,400', [{ x: 0, y: 200, mode: 'free' }]],
    ['M0,0 L400,400', [{ x: 200, y: 200, mode: 'free' }]],
    ['M0,0 L100,0 L100,200 L300,200', [{ x: 100, y: 100, mode: 'x' }, { x: 200, y: 200, mode: 'y' }]],
  ];
  for (const [path, handles] of cases) {
    handles.push({ ...connectionLabelPoint(path, 0), mode: 'endpoint' }, { ...connectionLabelPoint(path, 1), mode: 'endpoint' });
    for (const label of ['A', 'A very long connection label']) for (const fraction of [0, .25, .5, .75, 1]) {
      const placed = connectionLabelPlacement(path, fraction, label, handles);
      const halfWidth = Math.min(90, Math.max(20, label.length * 2.85 + 8));
      for (const handle of handles) {
        const x = handle.mode === 'endpoint' ? 6 : handle.mode === 'x' ? 8 : 14;
        const y = handle.mode === 'endpoint' ? 6 : handle.mode === 'y' ? 8 : 14;
        assert.ok(Math.abs(placed.point.x - handle.x) > halfWidth + x + 4 || Math.abs(placed.point.y - handle.y) > 11 + y + 4);
      }
      assert.deepEqual(connectionLabelPlacement(path, placed.position, label, handles), placed);
    }
  }
});
test('off-path curve controls do not displace labels, but on-path dots do', () => {
  const path = 'M0,0 Q100,200 200,0';
  const unchanged = connectionLabelPlacement(path, .5, 'Label', [{ x: 100, y: 200, mode: 'free' }]);
  assert.equal(unchanged.position, .5);
  const shifted = connectionLabelPlacement(path, .5, 'Label', [{ x: 100, y: 100, mode: 'free' }]);
  assert.notEqual(shifted.position, .5);
  near(closestLabelPosition(path, shifted.point), shifted.position, 1e-6);
});
test('very short and zero-length connections keep labels beside their dots', () => {
  for (const path of ['M0,0 L20,0', 'M10,0 L10,0']) {
    const placed = connectionLabelPlacement(path, .5, 'A long connection label', [{ x: 10, y: 0, mode: 'free' }]);
    assert.equal(placed.position, .5);
    near(placed.point.x, 10);
    assert.ok(Math.abs(placed.point.y) > 11 + 14 + 4);
  }
});
test('default and saved midpoint labels are safely positioned in geometry and exports', () => {
  const boardNodes = [{ id: 1, x: 0, y: 0, w: 100, h: 80 }, { id: 2, x: 600, y: 0, w: 100, h: 80 }];
  for (const labelPosition of [undefined, .5]) {
    const derived = boardEdgeData(boardNodes, [{ ...edge, structure: 'straight', labelPosition }])[0];
    assert.ok(Math.abs(derived.labelPoint.x - derived.control.x) > 60);
    const rebuilt = boardEdgeData(boardNodes, [{ ...edge, structure: 'straight', labelPosition: derived.labelPosition }])[0];
    assert.deepEqual(rebuilt.labelPoint, derived.labelPoint);
    assert.ok(createBoardSvg(boardNodes, [derived], 'white').svg.includes(`<text x="${derived.labelPoint.x}"`));
  }
});
test('labels keep their path position as connected nodes move', () => {
  const original = boardEdgeData(nodes, [{ ...edge, structure: 'elbow' }])[0];
  const moved = boardEdgeData(nodes.map(node => ({ ...node, x: node.x + 123, y: node.y - 70 })), [{ ...edge, structure: 'elbow' }])[0];
  near(moved.labelPoint.x, original.labelPoint.x + 123);
  near(moved.labelPoint.y, original.labelPoint.y - 70);
  const resized = boardEdgeData([{ ...nodes[0], w: 240 }, nodes[1]], [{ ...edge, structure: 'curve' }])[0];
  near(closestLabelPosition(resized.path, resized.labelPoint), .8, 1e-6);
});
test('exports and saved views retain the moved label position', () => {
  const board = { nodes, edges: [{ ...edge, structure: 'straight' }] };
  const derived = boardEdgeData(nodes, board.edges)[0];
  const exported = createBoardSvg(nodes, [derived], 'white').svg;
  assert.ok(exported.includes(`<text x="${derived.labelPoint.x}" y="${derived.labelPoint.y + 3.5}"`));
  const view = createSavedView(board, { x: 0, y: 0, scale: 1 }, 'Label position');
  assert.equal(restoreSavedView({ ...board, edges: [] }, view).edges[0].labelPosition, .8);
});
test('both share modes preserve positions and reject invalid fractions', async () => {
  const project = { title: 'Labels', board: { nodes, edges: [{ ...edge, structure: 'curve' }] } };
  for (const access of ['readonly', 'editable']) {
    const url = await createShareUrl(project, 'https://nova.example', { access });
    const restored = await readShareLink(new URL(url).hash);
    assert.equal(restored.project.board.edges[0].labelPosition, .8);
  }
  for (const labelPosition of [-1, 2, 'middle', Infinity]) {
    await assert.rejects(createShareUrl({ ...project, board: { nodes, edges: [{ ...edge, labelPosition }] } }, 'https://nova.example'), /invalid/);
  }
});
