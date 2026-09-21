import test from "node:test";
import assert from "node:assert/strict";
import { beginPinch, updatePinch, beginTouchPan } from "../src/lib/touchViewport.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test("pinching preserves the world point below the fingers, including header offset", () => {
  const before = { x: -700, y: -400, scale: .7 };
  const start = [{ x: 80, y: 250 }, { x: 280, y: 450 }];
  const gesture = beginPinch(start, before, { left: 8, top: 60 });
  const after = updatePinch(gesture, [{ x: 30, y: 180 }, { x: 330, y: 480 }]);
  close((180 - 8 - after.x) / after.scale, (180 - 8 - before.x) / before.scale);
  close((330 - 60 - after.y) / after.scale, (350 - 60 - before.y) / before.scale);
  close(after.scale, 1.05);
});

test("two fingers can pan without changing zoom", () => {
  const start = [{ x: 20, y: 40 }, { x: 120, y: 140 }];
  const gesture = beginPinch(start, { x: -200, y: 40, scale: .5 });
  const next = updatePinch(gesture, start.map(point => ({ x: point.x + 67, y: point.y - 31 })));
  assert.deepEqual(next, { x: -133, y: 9, scale: .5 });
});

test("zoom limits preserve the focal point at both extremes", () => {
  for (const spread of [.0001, 1e6]) {
    const gesture = beginPinch([{ x: 0, y: 0 }, { x: 200, y: 0 }], { x: -50, y: 70, scale: 1 });
    const next = updatePinch(gesture, [{ x: 100 - spread, y: 80 }, { x: 100 + spread, y: 80 }]);
    assert.ok(next.scale >= .01 && next.scale <= 4);
    close((100 - next.x) / next.scale, gesture.anchorX);
    close((80 - next.y) / next.scale, gesture.anchorY);
  }
});

test("coincident fingers never produce invalid coordinates", () => {
  const points = [{ x: 50, y: 90 }, { x: 50, y: 90 }];
  const next = updatePinch(beginPinch(points, { x: 12, y: -8, scale: 1 }), points);
  assert.deepEqual(next, { x: 12, y: -8, scale: 1 });
});

test("lifting a finger rebases panning without a viewport jump", () => {
  const next = updatePinch(beginPinch([{ x: 0, y: 0 }, { x: 100, y: 100 }], { x: -80, y: -60, scale: .9 }), [{ x: 20, y: 20 }, { x: 220, y: 220 }]);
  const pan = beginTouchPan(7, { x: 220, y: 220 }, next);
  assert.equal(pan.pointerId, 7);
  assert.deepEqual({ x: pan.x, y: pan.y }, { x: next.x, y: next.y });
  assert.deepEqual({ x: pan.sx, y: pan.sy }, { x: 220, y: 220 });
});

test("adding or removing a third finger can rebase the same viewport", () => {
  const points = [{ x: 93, y: 57 }, { x: 233, y: 399 }];
  const before = { x: -873.45, y: -641.89, scale: .346 };
  const next = updatePinch(beginPinch(points, before, { left: 12, top: 64 }), points);
  close(next.x, before.x); close(next.y, before.y); close(next.scale, before.scale);
});
