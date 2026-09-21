import assert from "node:assert/strict";
import test from "node:test";
import { boardBounds, createBoardSvg, exportDimensions, pdfLayout, rasterSize, selectExportNodes, MAX_EXPORT_PIXELS, MAX_EXPORT_SIDE } from "../src/lib/boardExport.js";

test("frame selection includes descendants without unrelated shapes", () => {
  const nodes = [{ id: 1, kind: "frame" }, { id: 2, frameId: 1, kind: "frame" }, { id: 3, frameId: 2 }, { id: 4 }];
  assert.deepEqual(selectExportNodes(nodes, [1], "selection").map(node => node.id), [1, 2, 3]);
  assert.deepEqual(selectExportNodes(nodes, [3], "selection").map(node => node.id), [3]);
  assert.deepEqual(selectExportNodes(nodes, [], "selection"), []);
  assert.equal(selectExportNodes(nodes, [], "board"), nodes);
});

test("export bounds contain rotated corners and distant routed connections", () => {
  const nodes = [{ id: 1, x: 0, y: 0, w: 100, h: 20, rotate: 90 }, { id: 2, x: 200, y: 0, w: 100, h: 20 }];
  const rotated = boardBounds([nodes[0]], [], 0);
  assert.ok(rotated.y <= -40 && rotated.y + rotated.height >= 60);
  const routed = boardBounds(nodes, [{ from: 1, to: 2, path: "M100,10 C100,-800 200,-800 200,10" }], 0);
  assert.equal(routed.y, -800);
  assert.equal(boardBounds([], []), null);
});

test("high-resolution dimensions preserve aspect ratio within browser limits", () => {
  assert.deepEqual(rasterSize(300, 200, 8), { width: 2400, height: 1600, scale: 8, limited: false });
  for (const [width, height] of [[100000, 80], [5000, 5000], [80, 100000]]) {
    const size = rasterSize(width, height, 8);
    assert.ok(size.width <= MAX_EXPORT_SIDE && size.height <= MAX_EXPORT_SIDE);
    assert.ok(size.width * size.height <= MAX_EXPORT_PIXELS);
    assert.ok(size.limited);
    assert.ok(Math.abs(size.width / width - size.height / height) < .015);
  }
  assert.throws(() => rasterSize(0, 100, 4), /Invalid/);
  assert.throws(() => rasterSize(100, Infinity, 4), /Invalid/);
});

test("PDF pages fit the board without stretching and report actual DPI", () => {
  for (const paper of ["a4", "a3", "letter", "board"]) {
    const page = pdfLayout(1600, 900, paper);
    assert.ok(page.pageWidth > page.pageHeight);
    assert.ok(page.x >= 0 && page.y >= 0);
    assert.ok(Math.abs(page.width / page.height - 1600 / 900) < .0001);
    const size = exportDimensions({ width: 1600, height: 900 }, { format: "pdf", paper, dpi: 300 });
    assert.ok(size.dpi >= 299 && size.dpi <= 300);
  }
  assert.ok(pdfLayout(900, 1600).pageHeight > pdfLayout(900, 1600).pageWidth);
});

test("SVG preserves color and rotation, escapes text, and excludes unrelated edges", () => {
  const nodes = [{ id: 1, x: -20, y: 10, title: '<script>alert("x")</script>', note: "A & B", root: true, color: "blue", shape: "round", rotate: 30 }];
  const prepared = createBoardSvg(nodes, [{ from: 1, to: 999, path: "M0 0 L9000 0" }], "transparent");
  assert.match(prepared.svg, /&lt;script&gt;/);
  assert.match(prepared.svg, /A &amp; B/);
  assert.match(prepared.svg, /rotate\(30/);
  assert.match(prepared.svg, /fill="#2770ae"/);
  assert.doesNotMatch(prepared.svg, /<script>|L9000/);
  assert.doesNotMatch(prepared.svg, /fill="#fff"/);
  assert.match(createBoardSvg(nodes, [], "grid").svg, /export-grid/);
});
