#!/usr/bin/env python3
"""Native pointer regressions for temporary canvas pan shortcuts."""
import json
import os

from qa_browser import Browser

b = Browser(int(os.environ.get("NOVA_QA_PORT", "9232")), os.environ.get("NOVA_QA_URL", "http://127.0.0.1:5183/"))
results = []


def check(name, condition):
    results.append({"name": name, "status": "PASS" if condition else "FAIL"})


def state():
    return b.evaluate("""(() => {const world=document.querySelector('main > div[class*=world]'),m=new DOMMatrix(world.style.transform);return {x:m.m41,y:m.m42,scale:m.m11,nodes:[...document.querySelectorAll('main article')].map(e=>e.style.transform),selected:[...document.querySelectorAll('main article')].map(e=>e.className.includes('selectedNode'))}})()""")


def center(selector):
    return b.evaluate(f"""(() => {{const r=document.querySelector({json.dumps(selector)}).getBoundingClientRect();return {{x:r.x+r.width/2,y:r.y+r.height/2}}}})()""")


def key(kind, name, modifiers=0):
    b.call("Input.dispatchKeyEvent", {"type": kind, "key": " " if name == "Space" else name, "code": "MetaLeft" if name == "Meta" else name, "modifiers": modifiers, **({"text": " "} if name == "Space" and kind == "keyDown" else {})})


def mouse(kind, point, modifiers=0, count=1):
    b.call("Input.dispatchMouseEvent", {"type": kind, **point, "button": "left", "buttons": 0 if kind == "mouseReleased" else 1, "clickCount": count, "modifiers": modifiers})


def drag_pan(name, point, shortcut, dx=65, dy=40):
    before = state()
    modifiers = 4 if shortcut == "Meta" else 0
    key("keyDown", shortcut, modifiers)
    check(f"{name}: grab cursor", b.evaluate("getComputedStyle(document.querySelector('main article')).cursor") == "grab")
    mouse("mousePressed", point, modifiers)
    end = {"x": point["x"] + dx, "y": point["y"] + dy}
    mouse("mouseMoved", end, modifiers)
    check(f"{name}: dragging cursor", b.evaluate("getComputedStyle(document.querySelector('main')).cursor") == "grabbing")
    mouse("mouseReleased", end, modifiers)
    key("keyUp", shortcut)
    after = state()
    check(f"{name}: viewport follows pointer", after["x"] == before["x"] + dx and after["y"] == before["y"] + dy and after["scale"] == before["scale"])
    check(f"{name}: shapes and selection unchanged", after["nodes"] == before["nodes"] and after["selected"] == before["selected"])
    check(f"{name}: release restores cursor", b.evaluate("getComputedStyle(document.querySelector('main')).cursor") == "default")


try:
    b.call("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
    b.wait_for("document.body.innerText.includes('Open workspace')")
    b.click_text("Open workspace →")
    b.wait_for("document.body.innerText.includes('YOUR WORKSPACE')")
    b.click_text("Product roadmap", exact=False)
    b.wait_for("!!document.querySelector('input[aria-label=\"Board title\"]')")
    blank = {"x": 300, "y": 700}
    drag_pan("Space on blank canvas", blank, "Space")
    drag_pan("Command on blank canvas", blank, "Meta", -65, -40)
    b.evaluate("document.querySelector('main article').click()")
    drag_pan("Space over shape", center("main article h3"), "Space")
    drag_pan("Command over shape", center("main article h3"), "Meta", -65, -40)
    before = state()
    point = center("main article h3")
    mouse("mousePressed", point)
    mouse("mouseMoved", {"x": point["x"] + 45, "y": point["y"] + 30})
    mouse("mouseReleased", {"x": point["x"] + 45, "y": point["y"] + 30})
    after = state()
    check("Normal drag still moves shape", before["nodes"] != after["nodes"] and before["x"] == after["x"] and before["y"] == after["y"])
    key("keyDown", "Space")
    mouse("mousePressed", blank)
    key("keyUp", "Space")
    before = state()
    mouse("mouseMoved", {"x": 320, "y": 715})
    mouse("mouseReleased", {"x": 320, "y": 715})
    after = state()
    check("Releasing shortcut mid-drag finishes the same pan", after["x"] == before["x"] + 20 and after["y"] == before["y"] + 15)
    key("keyDown", "Space")
    mouse("mousePressed", blank)
    b.evaluate("window.dispatchEvent(new Event('blur'))")
    before = state()
    mouse("mouseMoved", {"x": 340, "y": 720})
    mouse("mouseReleased", {"x": 340, "y": 720})
    check("Focus loss cancels pan and clears held keys", before == state() and b.evaluate("getComputedStyle(document.querySelector('main')).cursor") == "default")
    key("keyUp", "Space")
    before = state()
    mouse("mousePressed", blank)
    mouse("mouseMoved", {"x": 350, "y": 740})
    mouse("mouseReleased", {"x": 350, "y": 740})
    after = state()
    check("Normal canvas drag returns to selection", before["x"] == after["x"] and before["y"] == after["y"])
    point = center("main article h3")
    for count in [1, 2]:
        mouse("mousePressed", point, count=count)
        mouse("mouseReleased", point, count=count)
    b.wait_for("!!document.querySelector('[data-field=title]')")
    b.evaluate("""(() => {const e=document.querySelector('[data-field=title]');e.focus();const r=document.createRange();r.selectNodeContents(e);getSelection().removeAllRanges();getSelection().addRange(r)})()""")
    b.call("Input.insertText", {"text": "Two"})
    key("keyDown", "Space")
    key("keyUp", "Space")
    b.call("Input.insertText", {"text": "words"})
    check("Space types normally in text editor", b.evaluate("document.querySelector('[data-field=title]').textContent") == "Two words")
    check("Text editing does not arm pan", b.evaluate("getComputedStyle(document.querySelector('main')).cursor") == "default")
    key("keyDown", "Meta", 4)
    key("keyDown", "a", 4)
    key("keyUp", "a", 4)
    key("keyUp", "Meta")
    check("Command in editor does not arm pan", b.evaluate("getComputedStyle(document.querySelector('main')).cursor") == "default")
    check("No browser errors", not b.errors)
finally:
    print(json.dumps(results, indent=2))
    b.close()
if any(item["status"] == "FAIL" for item in results):
    raise SystemExit(1)
