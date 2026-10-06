import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { observeTextSelection } from '../src/lib/textSelectionToolbar.js';

function fixture(t) {
  const dom = new JSDOM('<div contenteditable="true" tabindex="0">A small experiment can answer a big question.</div><div data-rich-text-tools><button>Bold</button></div><input>');
  const { window } = dom, { document } = window;
  const editor = document.querySelector('[contenteditable]'), button = document.querySelector('button');
  let now = 0, sequence = 0, visible = false, shows = 0, hides = 0, lastRange;
  const timers = new Map();
  window.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; };
  window.clearTimeout = id => timers.delete(id);
  const tick = duration => {
    now += duration;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  };
  const observer = observeTextSelection(editor, {
    onSave: range => { lastRange = range; },
    onShow: () => { visible = true; shows++; },
    onHide: () => { visible = false; hides++; },
  });
  t.after(() => { observer.dispose(); dom.window.close(); });
  const event = (target, name, fields = {}) => {
    const value = new window.Event(name, { bubbles: true }); Object.assign(value, fields); target.dispatchEvent(value);
  };
  const select = (start, end) => {
    const range = document.createRange(); range.setStart(editor.firstChild, start); range.setEnd(editor.firstChild, end);
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range); event(document, 'selectionchange');
  };
  return { editor, button, document, window, observer, event, select, tick,
    get visible() { return visible; }, get shows() { return shows; }, get hides() { return hides; }, get lastRange() { return lastRange; } };
}

test('mouse selection stays hidden even when a held drag pauses, then appears after release', t => {
  const f = fixture(t);
  f.event(f.editor, 'pointerdown', { button: 0, pointerId: 1 });
  f.select(2, 7); f.tick(500); assert.equal(f.visible, false);
  f.select(2, 18); f.tick(500); assert.equal(f.visible, false);
  f.event(f.document, 'pointerup', { pointerId: 1 });
  f.tick(179); assert.equal(f.visible, false);
  f.tick(1); assert.equal(f.visible, true); assert.equal(f.lastRange.toString(), 'small experiment');
});

test('native touch-handle or programmatic selection updates restart the settle delay', t => {
  const f = fixture(t);
  f.select(2, 7); f.tick(150); assert.equal(f.visible, false);
  f.select(2, 18); f.tick(150); assert.equal(f.visible, false);
  f.tick(30); assert.equal(f.visible, true);
  f.select(2, 22); assert.equal(f.visible, false);
  f.tick(180); assert.equal(f.visible, true); assert.equal(f.shows, 2);
});

test('keyboard selection waits for the held arrow to be released', t => {
  const f = fixture(t);
  f.event(f.editor, 'keydown', { key: 'ArrowRight', code: 'ArrowRight', shiftKey: true });
  f.select(2, 7); f.tick(400); assert.equal(f.visible, false);
  f.event(f.editor, 'keydown', { key: 'ArrowRight', code: 'ArrowRight', shiftKey: true, repeat: true });
  f.select(2, 18); f.tick(400); assert.equal(f.visible, false);
  f.event(f.editor, 'keyup', { key: 'ArrowRight', code: 'ArrowRight', shiftKey: true });
  f.tick(180); assert.equal(f.visible, true);
});

test('toolbar actions preserve the visible toolbar when formatting replaces selected nodes', t => {
  const f = fixture(t);
  f.select(2, 18); f.tick(180);
  f.event(f.button, 'pointerdown', { button: 0, pointerId: 1 });
  f.editor.replaceChildren(f.document.createTextNode(f.editor.textContent));
  f.select(2, 18);
  assert.equal(f.visible, true); assert.equal(f.hides, 0); assert.equal(f.shows, 2);
  f.event(f.button, 'pointerup', { pointerId: 1 }); f.tick(180);
  assert.equal(f.hides, 0);
});

test('collapsing, leaving the editor or composing cancels pending tools', t => {
  const f = fixture(t);
  f.select(2, 18); f.tick(100); f.select(18, 18); f.tick(180); assert.equal(f.visible, false);
  f.select(2, 18); f.event(f.editor, 'focusout', { relatedTarget: f.document.querySelector('input') });
  f.tick(180); assert.equal(f.visible, false);
  f.select(2, 19); f.event(f.editor, 'compositionstart'); f.tick(180); assert.equal(f.visible, false);
  f.event(f.editor, 'compositionend'); f.tick(180); assert.equal(f.visible, true);
  f.select(19, 19); assert.equal(f.visible, false);
});

test('Escape dismissal survives restored selection and allows a new selection', t => {
  const f = fixture(t);
  f.select(2, 18); f.tick(180); assert.equal(f.visible, true);
  f.observer.dismiss(); f.select(2, 18); f.tick(500); assert.equal(f.visible, false);
  f.select(2, 22); f.tick(180); assert.equal(f.visible, true);
});

test('pointer cancellation, window blur and unmount cannot leave delayed tools behind', t => {
  const f = fixture(t);
  f.event(f.editor, 'pointerdown', { button: 0, pointerId: 2 }); f.select(2, 18);
  f.event(f.document, 'pointercancel', { pointerId: 2 }); f.tick(500); assert.equal(f.visible, false);
  f.select(2, 22); f.event(f.window, 'blur'); f.tick(500); assert.equal(f.visible, false);
  f.select(2, 25); f.observer.dispose(); f.tick(500); assert.equal(f.visible, false);
});
