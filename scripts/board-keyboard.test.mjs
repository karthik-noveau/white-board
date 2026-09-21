import assert from "node:assert/strict";
import test from "node:test";
import { nearbyBoardNode } from "../src/lib/boardKeyboard.js";

const nodes = [
  { id: 1, root: true, x: 500, y: 500 },
  { id: 2, x: 800, y: 500 },
  { id: 3, x: 200, y: 500 },
  { id: 4, x: 500, y: 200 },
  { id: 5, x: 500, y: 800 },
];

test("entering board navigation selects the root or first available item", () => {
  assert.equal(nearbyBoardNode(nodes, null, "ArrowRight").id, 1);
  assert.equal(nearbyBoardNode(nodes.slice(1), 1, "ArrowRight").id, 2);
  assert.equal(nearbyBoardNode([], null, "ArrowRight"), null);
});

test("each arrow selects the closest item in that direction", () => {
  for (const [key, id] of [["ArrowRight", 2], ["ArrowLeft", 3], ["ArrowUp", 4], ["ArrowDown", 5]]) {
    assert.equal(nearbyBoardNode(nodes, 1, key).id, id);
  }
  assert.equal(nearbyBoardNode(nodes, 2, "ArrowRight"), null);
  assert.equal(nearbyBoardNode(nodes, 1, "Tab"), null);
});

test("spatial navigation considers frame dimensions and prefers aligned shapes", () => {
  const board = [
    { id: 1, kind: "frame", x: 0, y: 0, w: 1000, h: 400 },
    { id: 2, x: 200, y: 150 },
    { id: 3, x: 1100, y: 150 },
    { id: 4, x: 600, y: 700 },
  ];
  const original = structuredClone(board);
  assert.equal(nearbyBoardNode(board, 1, "ArrowRight").id, 3);
  assert.equal(nearbyBoardNode(board, 1, "ArrowLeft").id, 2);
  assert.deepEqual(board, original);
});
