import assert from "node:assert/strict";
import test from "node:test";
import { BOARD_TOUR_KEY, createTourPreference, placeTourCard } from "../src/lib/boardTour.js";

test("first visit shows the tour; completion and skip survive a reload", () => {
  for (const status of ["completed", "skipped"]) {
    const values = new Map();
    const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    const preference = createTourPreference(() => storage);
    assert.equal(preference.shouldShow(), true);
    preference.dismiss(status);
    assert.equal(values.get(BOARD_TOUR_KEY), status);
    assert.equal(createTourPreference(() => storage).shouldShow(), false);
  }
});

test("storage failures do not crash or repeat the tour between boards in a session", () => {
  const preference = createTourPreference(() => { throw new Error("Storage blocked"); });
  assert.equal(preference.shouldShow(), true);
  preference.dismiss("skipped");
  assert.equal(preference.shouldShow(), false);
});

const overlaps = (a, b) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
test("cards stay in view and clear of highlighted controls at desktop and phone sizes", () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    const card = { width: Math.min(372, viewport.width - 24), height: Math.min(395, viewport.height - 24) };
    const targets = [
      { left: viewport.width / 2 - 40, top: 82, width: 80, height: 40 },
      { left: 10, top: viewport.height - 70, width: Math.min(500, viewport.width - 20), height: 46 },
      { left: viewport.width - 80, top: 10, width: 64, height: 36 },
      { left: -30, top: 30, width: 80, height: 40 },
      null,
    ];
    for (const target of targets) {
      const placement = placeTourCard(target, viewport, card);
      assert.ok(placement.left >= 12 && placement.top >= 12);
      assert.ok(placement.left + card.width <= viewport.width - 12);
      assert.ok(placement.top + card.height <= viewport.height - 12);
      if (placement.spotlight) assert.equal(overlaps({ ...placement, ...card }, placement.spotlight), false);
    }
  }
});

test("missing, hidden, and offscreen targets fall back to a centered card", () => {
  const viewport = { width: 1200, height: 800 }, card = { width: 372, height: 350 };
  for (const target of [null, { left: 0, top: 0, width: 0, height: 0 }, { left: 1400, top: 30, width: 80, height: 40 }]) {
    assert.deepEqual(placeTourCard(target, viewport, card), { left: 414, top: 225, spotlight: null });
  }
});
