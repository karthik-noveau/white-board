import assert from "node:assert/strict";
import test from "node:test";
import { playToolbarExit, playTransition } from "../src/lib/motion.js";

function surface() {
  const animations = [];
  return {
    animations,
    animate(frames) {
      let finish, reject;
      const finished = new Promise((resolve, fail) => { finish = resolve; reject = fail; });
      const animation = { frames, finished, finish, cancel: () => reject(new Error("Animation cancelled")) };
      animations.push(animation);
      return animation;
    },
  };
}

function motionPreference(t, reduced = false) {
  const previous = globalThis.window;
  globalThis.window = {
    matchMedia: () => ({ matches: reduced }),
    getComputedStyle: () => ({ opacity: "1", translate: "none" }),
  };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
}

test("reduced motion and missing animation support complete without delaying removal", async t => {
  motionPreference(t, true);
  const element = surface();
  await playTransition(element, { entering: false }).finished;
  assert.equal(element.animations.length, 0);
  await playTransition(null).finished;
  await playTransition({}).finished;
});

test("overlay removal waits for both the scrim and its content", async t => {
  motionPreference(t);
  const element = surface();
  element.firstElementChild = surface();
  const transition = playTransition(element, { entering: false, kind: "overlay" });
  let completed = false;
  transition.finished.then(() => { completed = true; });
  element.animations[0].finish();
  await Promise.resolve();
  assert.equal(completed, false);
  element.firstElementChild.animations[0].finish();
  await transition.finished;
  assert.equal(completed, true);
});

test("interrupted overlays release every animation without rejecting completion", async t => {
  motionPreference(t);
  const element = surface();
  element.firstElementChild = surface();
  const transition = playTransition(element, { kind: "overlay" });
  transition.cancel();
  const results = await transition.finished;
  assert.equal(results.length, 2);
  assert.ok(results.every(result => result.status === "rejected"));
});

test("motion preserves positioning transforms and pages never translate fixed controls", async t => {
  motionPreference(t);
  for (const kind of ["page", "fade", "panel", "drawer", "menu"]) {
    const element = surface();
    const transition = playTransition(element, { kind });
    const frames = element.animations[0].frames;
    assert.equal("transform" in frames, false);
    if (kind === "page" || kind === "fade") assert.equal("translate" in frames, false);
    transition.cancel();
    await transition.finished;
  }
});

function toolbar() {
  const actions = { ...surface(), inert: false, parentElement: { dataset: {} } };
  return { actions, querySelector: () => actions };
}

test("toolbar switch waits for the exit and prevents stale actions until replacement", async t => {
  motionPreference(t);
  const element = toolbar();
  const transition = playToolbarExit(element, 1);
  let completed = false;
  transition.finished.then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(element.actions.inert, true);
  element.actions.animations[0].finish();
  await transition.finished;
  assert.equal(completed, true);
  assert.equal(element.actions.inert, true);
  transition.cancel();
  assert.equal(element.actions.inert, false);
  assert.equal(element.actions.parentElement.dataset.scopeMotion, undefined);
});

test("cancelling a toolbar switch restores the outgoing controls", async t => {
  motionPreference(t);
  const element = toolbar();
  const transition = playToolbarExit(element, -1);
  transition.cancel();
  await transition.finished;
  assert.equal(element.actions.inert, false);
  assert.equal(element.actions.parentElement.dataset.scopeMotion, undefined);
});

test("toolbar switching is immediate and interactive with reduced motion", async t => {
  motionPreference(t, true);
  const element = toolbar();
  const transition = playToolbarExit(element, 1);
  await transition.finished;
  assert.equal(element.actions.animations.length, 0);
  assert.equal(element.actions.inert, false);
  transition.cancel();
  await playToolbarExit(null, 1).finished;
});
