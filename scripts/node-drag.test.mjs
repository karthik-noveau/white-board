import assert from "node:assert/strict";
import test from "node:test";
import { createNodeDrag, moveDraggedNodes, moveDraggedEdges } from "../src/lib/nodeDrag.js";

const nodes = [
  { id: 1, x: 500, y: 300, collapsed: true },
  { id: 2, x: 100, y: 150 },
  { id: 3, x: 900, y: 150, collapsed: true },
  { id: 4, x: 1200, y: 500 },
  { id: 5, x: 500, y: 800 },
];
const edges = [
  { id: 11, from: 1, to: 2, controlX: 200, controlY: 250 },
  { id: 12, from: 1, to: 3 },
  { id: 13, from: 3, to: 4, controlX: 1100, controlY: 350 },
  { id: 14, from: 5, to: 1, controlX: 400, controlY: 600 },
];

test("collapse, drag, and expand preserves the full layout on both sides", () => {
  const original = structuredClone({ nodes, edges });
  const drag = createNodeDrag(nodes, edges, [1]);
  const moved = moveDraggedNodes(nodes, drag, 250, -120);
  const expanded = moved.map(node => node.id === 1 ? { ...node, collapsed: false } : node);
  assert.deepEqual([...drag.origins.keys()], [1, 2, 3, 4]);
  for (let index = 0; index < 4; index += 1) {
    assert.equal(expanded[index].x, nodes[index].x + 250);
    assert.equal(expanded[index].y, nodes[index].y - 120);
    assert.equal(expanded[index].x - expanded[0].x, nodes[index].x - nodes[0].x);
    assert.equal(expanded[index].y - expanded[0].y, nodes[index].y - nodes[0].y);
  }
  assert.equal(expanded[2].collapsed, true);
  assert.equal(expanded[4], nodes[4]);
  assert.deepEqual({ nodes, edges }, original);
});

test("expanded parents still move independently, while collapsed children carry their descendants", () => {
  const expanded = nodes.map(node => node.id === 1 ? { ...node, collapsed: false } : node);
  assert.deepEqual([...createNodeDrag(expanded, edges, [1]).origins.keys()], [1]);
  assert.deepEqual([...createNodeDrag(expanded, edges, [3]).origins.keys()], [3, 4]);
});

test("group, frame, and multiple selections carry collapsed descendants only once", () => {
  const frame = { id: 6, x: 0, y: 0, kind: "frame" };
  const framed = [...nodes.map(node => ({ ...node, frameId: 6 })), frame];
  const selection = [6, 1, 3];
  const drag = createNodeDrag(framed, edges, selection);
  assert.deepEqual([...drag.origins.keys()], [1, 2, 3, 4, 6]);
  const moved = moveDraggedNodes(framed, drag, -150, 80);
  assert.deepEqual(moved.map(node => [node.x, node.y]), [
    [350, 380], [-50, 230], [750, 230], [1050, 580], [500, 800], [-150, 80],
  ]);
  assert.deepEqual(selection, [6, 1, 3]);
});

test("shared descendants, cycles, and stale endpoints cannot duplicate movement", () => {
  const connected = [...edges,
    { id: 15, from: 2, to: 4 }, { id: 16, from: 4, to: 1 },
    { id: 17, from: 4, to: 999 },
  ];
  const drag = createNodeDrag(nodes, connected, [1, 3, 999]);
  assert.deepEqual([...drag.origins.keys()], [1, 2, 3, 4]);
  assert.equal(moveDraggedNodes(nodes, drag, 100, 0)[3].x, 1300);
});

test("manual connector bends travel with both endpoints; outside and automatic routes stay intact", () => {
  const drag = createNodeDrag(nodes, edges, [1]);
  const moved = moveDraggedEdges(edges, drag, 250, -120);
  assert.deepEqual(moved[0], { ...edges[0], controlX: 450, controlY: 130 });
  assert.deepEqual(moved[2], { ...edges[2], controlX: 1350, controlY: 230 });
  assert.equal(moved[1], edges[1]);
  assert.equal(moved[3], edges[3]);
});

test("repeated pointer updates and final snap rounding use the same offset for every shape and bend", () => {
  const drag = createNodeDrag(nodes, edges, [1]);
  const first = moveDraggedNodes(nodes, drag, 20.3, -40.6);
  const second = moveDraggedNodes(first, drag, 60.8, -90.3);
  const dx = Math.round(nodes[0].x + 60.8) - nodes[0].x;
  const dy = Math.round(nodes[0].y - 90.3) - nodes[0].y;
  const final = moveDraggedNodes(second, drag, dx, dy);
  const routed = moveDraggedEdges(moveDraggedEdges(edges, drag, 60.8, -90.3), drag, dx, dy);
  assert.deepEqual(final.slice(0, 4).map(node => [node.x, node.y]), [
    [561, 210], [161, 60], [961, 60], [1261, 410],
  ]);
  assert.equal(routed[0].controlX - final[0].x, edges[0].controlX - nodes[0].x);
  assert.equal(routed[0].controlY - final[0].y, edges[0].controlY - nodes[0].y);
  assert.deepEqual(moveDraggedNodes(final, drag, 0, 0), nodes);
  assert.deepEqual(moveDraggedEdges(routed, drag, 0, 0), edges);
});

test("locked hidden descendants block the drag just like locked selected shapes", () => {
  const locked = nodes.map(node => node.id === 4 ? { ...node, locked: true } : node);
  assert.equal(createNodeDrag(locked, edges, [1]).locked, true);
  assert.equal(createNodeDrag(locked, edges, [2]).locked, false);
  assert.equal(createNodeDrag(locked, edges, [3]).locked, true);
});
