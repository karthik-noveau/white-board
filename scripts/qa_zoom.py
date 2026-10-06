#!/usr/bin/env python3
"""Native wheel regression for canvas zoom, including the former 30% dead zone."""
import json
import os
import sys

from qa_browser import Browser

origin = os.environ.get("DRAWANYTHING_QA_URL", os.environ.get("NOVA_QA_URL", "http://localhost:5177/")).rstrip("/")
b = Browser(int(os.environ.get("DRAWANYTHING_QA_PORT", os.environ.get("NOVA_QA_PORT", "9237"))), origin + "/projects")
cases = [(scale, modifier) for scale in [.01, .1, .3, .5, 1] for modifier in [4, 2, 0]]
if "--repro" in sys.argv:
    cases = [(.3, 4)]


def state():
    return b.evaluate("""(() => {
      const stage=document.querySelector('[aria-label="Board canvas"]');
      const matrix=new DOMMatrix(stage.querySelector(':scope > div[class*=world]').style.transform);
      return {x:matrix.m41,y:matrix.m42,scale:matrix.m11,top:stage.getBoundingClientRect().top,
        pageScale:visualViewport.scale,nodes:[...stage.querySelectorAll('[data-export-node]')].map(e=>e.style.transform)};
    })()""")


def wheel(delta, modifier, point):
    key = {"key": "Meta" if modifier == 4 else "Control", "code": "MetaLeft" if modifier == 4 else "ControlLeft"}
    if modifier:
        b.call("Input.dispatchKeyEvent", {"type": "keyDown", **key, "modifiers": modifier})
    b.call("Input.dispatchMouseEvent", {"type": "mouseWheel", **point, "deltaX": 0, "deltaY": delta, "modifiers": modifier})
    b.pause(.15)
    if modifier:
        b.call("Input.dispatchKeyEvent", {"type": "keyUp", **key, "modifiers": 0})


try:
    b.call("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
    b.wait_for("!!document.querySelector('#projects-title')")
    b.evaluate("""(async()=>{
      localStorage.setItem('nova-board-tour-v1','skipped');
      const {putProject}=await import('/src/lib/localWorkspace.js');
      const {templates}=await import('/src/data/templates.js');
      for(const [scale,modifier] of """ + json.dumps(cases) + """ ){
        const board=structuredClone(templates.find(t=>t.id==='decision-tree').board);
        board.viewport={x:-100,y:-100,scale};
        await putProject({id:`qa-wheel-${scale*100}-${modifier}`,title:'Wheel zoom regression',board,updated:Date.now()});
      }
    })()""", await_promise=True)
    for scale, modifier in cases:
        b.call("Page.navigate", {"url": f"{origin}/boards/qa-wheel-{scale*100:g}-{modifier}"})
        b.wait_ready()
        try:
            b.wait_for("document.querySelectorAll('[data-export-node]').length===7")
        except TimeoutError:
            print(json.dumps({"url": b.evaluate("location.href"), "text": b.text(), "errors": b.errors}), flush=True)
            raise
        b.evaluate("window.wheelEvents=[];document.addEventListener('wheel',e=>window.wheelEvents.push({prevented:e.defaultPrevented,meta:e.metaKey,ctrl:e.ctrlKey}))")
        before = state()
        point = {"x": 620, "y": 420}
        wheel(-100, modifier, point)
        after = state()
        assert after["scale"] > before["scale"], f"Zoom stuck at {scale * 100:g}% with modifier {modifier}: {before} -> {after}"
        for axis, offset in [("x", 0), ("y", before["top"])]:
            anchor = (point[axis] - offset - before[axis]) / before["scale"]
            # The canvas pixel-snaps its displayed translation. The stored
            # viewport stays precise; allow less than one screen pixel here.
            drift = abs(after[axis] + anchor * after["scale"] - (point[axis] - offset))
            assert drift < 1, f"Zoom anchor drifted {drift}px: {before} -> {after}"
        assert before["pageScale"] == after["pageScale"], "Browser page zoom changed"
        assert before["nodes"] == after["nodes"], "Wheel moved board content"
        wheel(100, modifier, point)
        restored = state()
        assert abs(restored["scale"] - before["scale"]) < 1e-9, "Opposite wheel movement did not restore zoom"
        assert b.evaluate("window.wheelEvents.length===2 && window.wheelEvents.every(e=>e.prevented)"), "Native wheel default was not prevented"
        if modifier:
            assert b.evaluate(f"window.wheelEvents.every(e=>e.{'meta' if modifier == 4 else 'ctrl'})"), "Wheel modifier was not received"
        print(f"PASS {scale * 100:g}% zoom, modifier {modifier}: zoom in/out, pointer anchor, browser zoom, content unchanged", flush=True)
    assert not b.errors, b.errors
    print("Wheel zoom regression passed without browser errors.", flush=True)
finally:
    b.close()
