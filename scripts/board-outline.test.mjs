import assert from "node:assert/strict";
import test from "node:test";
import { filterBoardOutline } from "../src/lib/boardOutline.js";

const nodes = [
  { id: 1, kind: "frame", title: "Planning" },
  { id: 2, frameId: 1, title: "Launch", tags: ["Marketing"], locked: true },
  { id: 3, kind: "frame", title: "Archive", hidden: true },
  { id: 4, frameId: 3, title: "Old research", note: "Customer interviews" },
  { id: 5, title: "Delivery", status: "todo", priority: "high" },
  { id: 6, frameId: "missing", title: "Unfiled", hidden: true },
];

test("search finds nested shapes even when their frame does not match", () => {
  const result = filterBoardOutline(nodes, " LAUNCH ");
  assert.equal(result.count, 1);
  assert.equal(result.groups[0].frame.id, 1);
  assert.deepEqual(result.groups[0].children.map(node => node.id), [2]);
  assert.deepEqual(result.unframed, []);
});

test("search includes notes, tags, status, and priority", () => {
  for (const [query, id] of [["marketing", 2], ["interviews", 4], ["todo", 5], ["high", 5]]) {
    const result = filterBoardOutline(nodes, query);
    assert.equal(result.count, 1);
    assert.equal((result.unframed[0] || result.groups[0].children[0]).id, id);
  }
});

test("filters combine with search and account for hidden frames", () => {
  assert.equal(filterBoardOutline(nodes, "", "shapes").count, 4);
  const frames = filterBoardOutline(nodes, "", "frames");
  assert.equal(frames.count, 2);
  assert.ok(frames.groups.every(group => group.children.length === 0));
  assert.equal(filterBoardOutline(nodes, "", "hidden").count, 3);
  assert.equal(filterBoardOutline(nodes, "research", "hidden").count, 1);
  assert.equal(filterBoardOutline(nodes, "launch", "locked").count, 1);
  assert.equal(filterBoardOutline(nodes, "delivery", "locked").count, 0);
});

test("all items remain reachable, including shapes with a missing frame", () => {
  const original = structuredClone(nodes);
  const result = filterBoardOutline(nodes);
  assert.equal(result.count, nodes.length);
  assert.deepEqual(result.unframed.map(node => node.id), [5, 6]);
  assert.deepEqual(nodes, original);
  assert.deepEqual(filterBoardOutline(nodes, "no-match"), { groups: [], unframed: [], count: 0 });
});
