import assert from "node:assert/strict";
import test from "node:test";
import { versionPreviewData } from "../src/lib/versionPreview.js";
import { boardEdgeData } from "../src/lib/boardGeometry.js";

function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
}

test("preview uses the saved board without changing its content or viewport", () => {
  const board = freeze({
    nodes: [{ id: 1, x: 0, y: 0, w: 200, h: 100, title: "Original", note: "Saved note", titleHtml: "<b>Original</b>" }, { id: 2, x: 600, y: 200 }],
    edges: [{ id: 1, from: 1, to: 2, side: "right", controlX: 400, controlY: 800, label: "Saved link" }],
    globalSettings: { structure: "elbow", pattern: "dashed", weight: "bold" },
    viewport: { x: 20, y: 30, scale: .8 },
  });
  const original = structuredClone(board), preview = versionPreviewData(board);
  assert.equal(preview.nodes[0].title, "Original");
  assert.equal(preview.nodes[0].note, "Saved note");
  assert.equal(preview.nodes[0].titleHtml, "<b>Original</b>");
  assert.equal(preview.edges[0].label, "Saved link");
  assert.equal(preview.edges[0].pattern, "dashed");
  assert.equal(preview.edges[0].weight, "bold");
  assert.equal(preview.edges[0].structure, "elbow");
  assert.ok(preview.bounds.y + preview.bounds.height >= 800);
  assert.deepEqual(board, original);
});

test("hidden items and collapsed branches do not appear in previews", () => {
  const board = {
    nodes: [{ id: 1, x: 0, y: 0, collapsed: true }, { id: 2, x: 300, y: 0 }, { id: 3, x: 600, y: 0 }, { id: 4, x: 0, y: 200, kind: "frame", hidden: true }, { id: 5, x: 100, y: 250, frameId: 4 }],
    edges: [{ id: 1, from: 1, to: 2 }, { id: 2, from: 2, to: 3 }, { id: 3, from: 3, to: 1 }],
  };
  const preview = versionPreviewData(board);
  assert.deepEqual(preview.nodes.map(node => node.id), [1]);
  assert.equal(preview.edges.length, 0);
  assert.equal(preview.totalCount, 5);
});

test("missing and empty versions produce a valid empty preview", () => {
  for (const board of [undefined, {}, { nodes: [], edges: [] }]) {
    assert.deepEqual(versionPreviewData(board), { nodes: [], edges: [], bounds: null, totalCount: 0 });
  }
});

test("shared connection geometry retains routes, style overrides and visibility", () => {
  const nodes = [{ id: 1, x: 0, y: 0, w: 200, h: 100 }, { id: 2, x: 600, y: 200, w: 200, h: 100 }];
  const edges = [{ id: 1, from: 1, to: 2, side: "right", structure: "straight", pattern: "dotted", weight: "thin" }, { id: 2, from: 1, to: 99 }];
  const result = boardEdgeData(nodes, edges, { structure: "elbow", pattern: "solid", weight: "bold" });
  assert.equal(result[0].path, "M200,50 L600,250");
  assert.equal(result[0].pattern, "dotted");
  assert.equal(result[0].weight, "thin");
  assert.equal(result[1], null);
  assert.deepEqual(boardEdgeData(nodes, edges, {}, new Set([1])), [null, null]);
  const curve = boardEdgeData(nodes, [{ ...edges[0], structure: "curve", controlX: 350, controlY: 420 }])[0];
  assert.equal(curve.path, "M200,50 Q350,420 600,250");
});

test("preview bounds contain rotated frames and their shapes", () => {
  const preview = versionPreviewData({ nodes: [{ id: 1, kind: "frame", x: 0, y: 0, w: 800, h: 400, rotate: 90 }, { id: 2, x: 100, y: 100, frameId: 1 }], edges: [] });
  assert.equal(preview.nodes.length, 2);
  assert.ok(preview.bounds.y <= -200);
  assert.ok(preview.bounds.y + preview.bounds.height >= 600);
});
