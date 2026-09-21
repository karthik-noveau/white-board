import assert from "node:assert/strict";
import test from "node:test";
import { commentsForScope } from "../src/lib/boardComments.js";

const nodes = [
  { id: 1, title: "Root", collapsed: true, comments: [{ id: "a", text: "Root note", createdAt: 10 }] },
  { id: 2, title: "Selected", comments: [{ id: "b", text: "Selected note", createdAt: 50, resolved: true }] },
  { id: 3, title: "Sibling", hidden: true, comments: [{ id: "c", text: "Sibling note", createdAt: 30 }] },
  { id: 4, title: "Child", comments: [{ id: "d", text: "Child note", createdAt: 20 }] },
  { id: 5, title: "Other branch", comments: [{ id: "e", text: "Other note", createdAt: 40 }] },
  { id: 6, title: "Empty shape" },
];
const edges = [
  { id: 11, from: 1, to: 2 }, { id: 12, from: 1, to: 3 },
  { id: 13, from: 2, to: 4 }, { id: 14, from: 5, to: 6 },
];

test("selected shape follows the current box and includes its resolved comments", () => {
  assert.deepEqual(commentsForScope(nodes, edges, "shape", 2).map(comment => comment.id), ["b"]);
  assert.equal(commentsForScope(nodes, edges, "shape", 2)[0].resolved, true);
  assert.deepEqual(commentsForScope(nodes, edges, "shape", 5).map(comment => comment.id), ["e"]);
  assert.deepEqual(commentsForScope(nodes, edges, "shape", 6), []);
});

test("entire branch includes both sides, ancestors, siblings, and collapsed descendants", () => {
  for (const selectedId of [1, 2, 3, 4]) {
    assert.deepEqual(commentsForScope(nodes, edges, "branch", selectedId).map(comment => comment.id), ["b", "c", "d", "a"]);
  }
  assert.deepEqual(commentsForScope(nodes, edges, "branch", 6).map(comment => comment.id), ["e"]);
  const reversed = edges.map(edge => ({ ...edge, from: edge.to, to: edge.from }));
  assert.deepEqual(commentsForScope(nodes, reversed, "branch", 2), commentsForScope(nodes, edges, "branch", 2));
});

test("all branches shows every comment, newest first, with or without a selection", () => {
  for (const selectedId of [null, 2, 5]) {
    assert.deepEqual(commentsForScope(nodes, edges, "all", selectedId).map(comment => comment.id), ["b", "e", "c", "d", "a"]);
  }
});

test("cards preserve their actual owner for navigation, resolving, and deletion", () => {
  const original = structuredClone({ nodes, edges });
  const comments = commentsForScope(nodes, edges, "all", 2);
  assert.deepEqual(comments.map(({ id, nodeId, nodeTitle }) => [id, nodeId, nodeTitle]), [
    ["b", 2, "Selected"], ["e", 5, "Other branch"], ["c", 3, "Sibling"], ["d", 4, "Child"], ["a", 1, "Root"],
  ]);
  assert.deepEqual({ nodes, edges }, original);
});

test("selected lines filter their branch, and missing selections never fall back to another box", () => {
  assert.deepEqual(commentsForScope(nodes, edges, "branch", null, 13).map(comment => comment.id), ["b", "c", "d", "a"]);
  for (const scope of ["shape", "branch"]) {
    assert.deepEqual(commentsForScope(nodes, edges, scope, null), []);
    assert.deepEqual(commentsForScope(nodes, edges, scope, 999), []);
  }
  assert.deepEqual(commentsForScope(nodes, edges, "branch", null, 999), []);
  assert.deepEqual(commentsForScope([], [], "all", null), []);
});
