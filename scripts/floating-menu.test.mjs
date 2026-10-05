import test from 'node:test';
import assert from 'node:assert/strict';
import { floatingMenuBounds } from '../src/lib/floatingMenu.js';

test('menus stay inside phone, landscape, tablet and keyboard viewports', () => {
  for (const viewport of [
    { left: 0, top: 0, width: 320, height: 568 },
    { left: 0, top: 0, width: 390, height: 844 },
    { left: 0, top: 190, width: 390, height: 290 },
    { left: 0, top: 0, width: 844, height: 230 },
    { left: 20, top: 30, width: 768, height: 1024 },
  ]) {
    for (const anchor of [{left:-10,top:0,bottom:20},{left:900,top:700,bottom:744},{left:100,top:300,bottom:344}]) {
      const result = floatingMenuBounds(anchor, viewport);
      assert.ok(result.left >= viewport.left + 8);
      assert.ok(result.top >= viewport.top + 8);
      assert.ok(result.left + result.width <= viewport.left + viewport.width - 8);
      assert.ok(result.top + result.maxHeight <= viewport.top + viewport.height - 8);
    }
  }
});

test('opening the keyboard shrinks and repositions an open menu', () => {
  const anchor = {left:20,top:450,bottom:490};
  const full = floatingMenuBounds(anchor, {left:0,top:0,width:390,height:844});
  const keyboard = floatingMenuBounds(anchor, {left:0,top:100,width:390,height:300});
  assert.ok(keyboard.maxHeight < full.maxHeight);
  assert.ok(keyboard.top + keyboard.maxHeight <= 392);
});

test('menus open below their field when there is room', () => {
  assert.equal(floatingMenuBounds({left:30,top:60,bottom:100}, {left:0,top:0,width:390,height:844}).top, 108);
});
