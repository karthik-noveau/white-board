import test from "node:test";
import assert from "node:assert/strict";
import { zoomByWheel } from "../src/lib/wheelViewport.js";

const point = { x: 630, y: 348 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test("wheel zoom escapes the 30% dead zone in both directions", () => {
  for (const scale of [.02, .1, .3, .5, 1]) {
    const before = { x: -100, y: -70, scale };
    assert.ok(zoomByWheel(before, point, -1).scale > scale);
    assert.ok(zoomByWheel(before, point, 1).scale < scale);
  }
});

test("small trackpad deltas accumulate and preserve the pointer's world position", () => {
  const before = { x: -271.5, y: 85.75, scale: .3 };
  let after = before;
  for (let i = 0; i < 100; i++) after = zoomByWheel(after, point, -.1);
  const single = zoomByWheel(before, point, -10);
  close(after.scale, single.scale);
  for (const axis of ["x", "y"]) {
    close(after[axis], single[axis]);
    close((point[axis] - after[axis]) / after.scale, (point[axis] - before[axis]) / before.scale);
  }
  const restored = zoomByWheel(after, point, 10);
  close(restored.scale, before.scale);
  close(restored.x, before.x);
  close(restored.y, before.y);
});

test("pixel, line, and page wheel units produce equivalent zoom", () => {
  const before = { x: 12, y: -90, scale: .3 };
  const pixels = zoomByWheel(before, point, -160);
  assert.deepEqual(zoomByWheel(before, point, -10, 1), pixels);
  assert.deepEqual(zoomByWheel(before, point, -.2, 2, 800), pixels);
});

test("zero vertical delta and scrolling out at minimum zoom do not move the board", () => {
  const before = { x: -100, y: 20, scale: .01 };
  assert.equal(zoomByWheel(before, point, 0), before);
  assert.equal(zoomByWheel(before, point, 120), before);
  assert.ok(zoomByWheel(before, point, -1).scale > before.scale);
});
