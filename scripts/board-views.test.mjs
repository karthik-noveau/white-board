import assert from "node:assert/strict";
import test from "node:test";
import { copyBoardState, createSavedView, restoreSavedView, nextBoardItemId } from "../src/lib/boardViews.js";

const viewport = { x: -140, y: 60, scale: 0.75 };
const fixture = () => ({
  nodes: [
    { id: 1, title: "Plan", titleHtml: "<b>Plan</b>", x: 20, y: 80, frameId: 2, color: "blue", locked: true, comments: [{ id: "comment", text: "Keep this", createdAt: 1 }], customValues: { effort: 8 }, links: [{ url: "https://example.com" }], timeSpent: 10 },
    { id: 2, kind: "frame", title: "Section", x: 0, y: 0, w: 600, h: 400, hidden: true },
  ],
  edges: [{ id: 8, from: 1, to: 2, label: "Next", controlX: 150, pattern: "dashed" }],
  globalSettings: { color: "violet", weight: "bold" },
  customFields: [{ id: "effort", options: ["Small", "Large"] }],
  automationRules: [{ id: "rule", enabled: true }],
  teamMembers: [{ id: "member", name: "Team" }],
  goals: [{ id: "goal", nodeIds: [1] }],
  sprints: [{ id: "sprint", name: "Launch" }],
  activeTimer: null,
  savedViews: [],
  viewport: { x: 0, y: 0, scale: 1 },
});

test("a saved view captures all content and nested settings independently of later edits", () => {
  const board = fixture(), before = structuredClone(board);
  const view = createSavedView(board, viewport, "First", "first", 1000);
  assert.deepEqual(board, before);
  const expected = { ...before, viewport };
  delete expected.savedViews;
  assert.deepEqual(view.board, expected);
  board.nodes[0].comments[0].text = "Changed";
  board.nodes[0].customValues.effort = 20;
  board.customFields[0].options.push("Extra");
  board.edges[0].label = "Edited";
  assert.deepEqual(view.board, expected);
});

test("multiple saved views never nest the saved-view collection", () => {
  const board = fixture();
  for (let index = 0; index < 20; index++) {
    board.savedViews.push(createSavedView(board, viewport, `View ${index}`, `v${index}`, index));
  }
  for (const view of board.savedViews) assert.equal("savedViews" in view.board, false);
  assert.equal(JSON.stringify(board.savedViews.at(-1).board).length, JSON.stringify(board.savedViews[0].board).length);
});

test("opening a snapshot restores removed content and settings while retaining newer views", () => {
  const board = fixture(), first = createSavedView(board, viewport, "First", "first", 1000);
  board.savedViews.push(first);
  board.nodes = [{ id: 50, title: "Replacement", x: 200, y: 200 }];
  board.edges = [];
  board.globalSettings.color = "red";
  board.customFields = [];
  board.savedViews.push(createSavedView(board, board.viewport, "Second", "second", 2000));
  const before = structuredClone(board);
  const restored = restoreSavedView(board, first);
  assert.deepEqual(restored, { ...first.board, savedViews: board.savedViews });
  assert.deepEqual(board, before);
  restored.nodes[0].comments[0].text = "Edit after opening";
  restored.goals[0].nodeIds.push(50);
  assert.equal(first.board.nodes[0].comments[0].text, "Keep this");
  assert.deepEqual(first.board.goals[0].nodeIds, [1]);
});

test("snapshot and viewport survive persistence and an undo/redo round trip", () => {
  const current = fixture();
  current.savedViews.push(createSavedView(current, viewport, "Saved", "saved", 1000));
  current.nodes[0].title = "Later edit";
  const undo = copyBoardState(current);
  const persisted = JSON.parse(JSON.stringify(current));
  const opened = restoreSavedView(persisted, persisted.savedViews[0]);
  const redo = copyBoardState(opened);
  assert.equal(opened.nodes[0].title, "Plan");
  assert.deepEqual(opened.viewport, viewport);
  assert.deepEqual(copyBoardState(undo), current);
  assert.deepEqual(copyBoardState(redo), opened);
});

test("legacy position-only views leave all board content untouched", () => {
  const current = fixture(), original = structuredClone(current);
  const restored = restoreSavedView(current, { name: "Old", transform: viewport });
  assert.deepEqual(restored, { ...original, viewport });
  assert.deepEqual(current, original);
});

test("focus time freezes at save time without stopping the live timer or accruing stale time", () => {
  const board = fixture();
  board.activeTimer = { nodeId: 1, startedAt: 1000 };
  const view = createSavedView(board, viewport, "Timed", "timed", 6500);
  assert.equal(view.board.nodes[0].timeSpent, 15);
  assert.equal(view.board.activeTimer, null);
  assert.equal(board.nodes[0].timeSpent, 10);
  assert.deepEqual(board.activeTimer, { nodeId: 1, startedAt: 1000 });
  assert.equal(restoreSavedView(board, view).activeTimer, null);
});

test("new items cannot collide with IDs restored from an older view", () => {
  assert.equal(nextBoardItemId([{ id: 80 }, { id: "200" }, { id: "named" }], 10), 201);
  assert.equal(nextBoardItemId([{ id: 1 }], 300), 300);
  assert.equal(nextBoardItemId([]), 1);
});
