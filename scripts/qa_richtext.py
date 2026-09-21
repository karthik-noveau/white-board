#!/usr/bin/env python3
"""Browser regressions for selection, native editing, and rich-text persistence."""
import json
import os
import base64
from pathlib import Path

from qa_browser import Browser


b = Browser(int(os.environ.get("NOVA_QA_PORT", "9232")), os.environ.get("NOVA_QA_URL", "http://127.0.0.1:5183/"))
results = []


def check(name, condition, detail=None):
    results.append({"name": name, "status": "PASS" if condition else "FAIL", "detail": detail})


def point(selector):
    return b.evaluate(f"""(() => {{const r=document.querySelector({json.dumps(selector)}).getBoundingClientRect();return {{x:r.x+r.width/2,y:r.y+r.height/2}}}})()""")


def click(selector, count=1):
    p = point(selector)
    b.call("Input.dispatchMouseEvent", {"type": "mouseMoved", **p})
    for click_count in range(1, count + 1):
        for kind in ["mousePressed", "mouseReleased"]:
            b.call("Input.dispatchMouseEvent", {"type": kind, **p, "button": "left", "buttons": 1 if kind == "mousePressed" else 0, "clickCount": click_count})
    b.pause(.08)


def field(name="title"):
    return f'[contenteditable=true][data-field="{name}"]'


def select(name="title", start=0, end=None):
    # Range setup is independent of the implementation, including nested marks.
    return b.evaluate(f"""(() => {{const el=document.querySelector({json.dumps(field(name))});el.focus();const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),texts=[];let n;while(n=walker.nextNode())texts.push(n);const length=el.textContent.length;let from={start},to={json.dumps(end)}??length,seen=0,r=document.createRange(),started=false;r.selectNodeContents(el);for(const text of texts){{const next=seen+text.length;if(!started&&from<=next){{r.setStart(text,from-seen);started=true}}if(to<=next){{r.setEnd(text,to-seen);break}}seen=next}}const s=getSelection();s.removeAllRanges();s.addRange(r);return s.toString()}})()""")


def replace(name, value):
    select(name)
    b.call("Input.insertText", {"text": value})
    b.pause(.08)


def html(name="title"):
    return b.evaluate(f"document.querySelector({json.dumps(field(name))})?.innerHTML")


try:
    b.call("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
    b.wait_for("document.body.innerText.includes('Open workspace')")
    b.click_text("Open workspace →")
    b.wait_for("document.body.innerText.includes('YOUR WORKSPACE')")
    b.click_text("Product roadmap", exact=False)
    b.wait_for("!!document.querySelector('input[aria-label=\"Board title\"]')")
    project_title = f"Rich text QA {b.evaluate('Date.now()')}"
    click('[aria-label="Board title"]')
    b.fill('[aria-label="Board title"]', project_title)
    click("main article h3", 2)
    b.wait_for("!!document.querySelector('[contenteditable=true]')")
    replace("title", "Alpha Beta Gamma")
    check("Title accepts typing", b.evaluate(f"document.querySelector({json.dumps(field())}).textContent") == "Alpha Beta Gamma", html())
    select("title", 6, 10)
    click('[aria-label="Bold"]')
    check("Partial formatting keeps selected text", b.evaluate("getSelection().toString()") == "Beta", html())
    click('[aria-label="Italic"]')
    check("Successive formats affect the same text", b.evaluate("document.queryCommandState('bold') && document.queryCommandState('italic') && getSelection().toString()==='Beta'"), html())
    select("title", 6, 10)
    click('[aria-label="Bold"]')
    check("Bold toggles off", not b.evaluate("document.queryCommandState('bold')"), html())
    b.call("Input.insertText", {"text": "Updated"})
    check("Typing after formatting replaces selection", b.evaluate(f"document.querySelector({json.dumps(field())}).textContent") == "Alpha Updated Gamma", html())
    b.call("Input.dispatchKeyEvent", {"type": "keyDown", "key": "z", "code": "KeyZ", "modifiers": 4, "commands": ["undo"]})
    b.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": "z", "code": "KeyZ", "modifiers": 4})
    check("Native undo restores replaced word", b.evaluate(f"document.querySelector({json.dumps(field())}).textContent") == "Alpha Beta Gamma", html())
    b.call("Input.dispatchKeyEvent", {"type": "keyDown", "key": "z", "code": "KeyZ", "modifiers": 12, "commands": ["redo"]})
    b.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": "z", "code": "KeyZ", "modifiers": 12})
    check("Native redo restores text", b.evaluate(f"document.querySelector({json.dumps(field())}).textContent") == "Alpha Updated Gamma", html())
    b.pause(.7)
    select("title", 0, 0)
    click('[aria-label="Underline"]')
    b.call("Input.insertText", {"text": "New "})
    check("Collapsed caret formatting applies to new text", b.evaluate(f"document.querySelector({json.dumps(field())}).textContent") == "New Alpha Updated Gamma" and "New" in (b.evaluate(f"document.querySelector({json.dumps(field())}).querySelector('u')?.textContent") or ""), html())
    replace("title", "Alpha Updated Gamma")
    select("title")
    click('[aria-label="Clear formatting"]')
    bounds = b.evaluate(f"""(() => {{const el=document.querySelector({json.dumps(field())}),r=document.createRange();const text=document.createTreeWalker(el,NodeFilter.SHOW_TEXT).nextNode();r.setStart(text,6);r.setEnd(text,13);const b=r.getBoundingClientRect();return {{start:{{x:b.left+.5,y:b.top+b.height/2}},end:{{x:b.right-.5,y:b.top+b.height/2}}}}}})()""")
    b.evaluate("getSelection().removeAllRanges()")
    b.mouse_drag(bounds["start"], bounds["end"])
    check("Mouse drag selects a word without moving the shape", b.evaluate("getSelection().toString()") == "Updated")
    click('[aria-label="Strikethrough"]')
    check("Mouse selection can be formatted", b.evaluate("document.queryCommandState('strikeThrough') && getSelection().toString()==='Updated'"), html())
    b.evaluate("document.querySelector('[aria-label=Underline]').focus()")
    b.call("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13, "text": "\r"})
    b.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13, "text": "\r"})
    check("Keyboard toolbar activation restores selection", b.evaluate("document.queryCommandState('underline') && getSelection().toString()==='Updated'"), html())
    select("note")
    b.call("Input.insertText", {"text": ""})
    select("note")
    click('[aria-label="Bold"]')
    b.call("Input.insertText", {"text": "First item"})
    check("Empty note accepts formatting then typing", "First item" in (b.evaluate(f"document.querySelector({json.dumps(field('note'))}).querySelector('b,strong')?.textContent") or ""), html("note"))
    select("note")
    click('[aria-label="Clear formatting"]')
    replace("note", "First item")
    click('[aria-label="Bulleted list"]')
    check("List stays inside note editor", bool(b.count(f'{field("note")} ul li')), html("note"))
    check("List leaves both fields editable", b.count('[contenteditable=true]') == 2)
    select("note")
    click('[aria-label="Numbered list"]')
    check("Numbered list replaces bullets", bool(b.count(f'{field("note")} ol li')) and not b.count(f'{field("note")} ul'), html("note"))
    click('[aria-label="Clear formatting"]')
    check("Clear formatting removes list", not b.count(f'{field("note")} ul,{field("note")} ol'), html("note"))
    click('[aria-label="Quote"]')
    check("Quote stays within note field", bool(b.count(f'{field("note")} blockquote')) and b.count('[contenteditable=true]') == 2, html("note"))
    click('[aria-label="Quote"]')
    check("Quote toggles off", not b.count(f'{field("note")} blockquote'), html("note"))
    click('[aria-label="Code block"]')
    check("Code block stays within note field", bool(b.count(f'{field("note")} pre')) and b.count('[contenteditable=true]') == 2, html("note"))
    click('[aria-label="Clear formatting"]')
    select("note")
    b.evaluate("window.prompt=()=> 'https://example.com'")
    click('[aria-label="Insert link"]')
    check("Link applies to selected note text", b.evaluate(f"document.querySelector({json.dumps(field('note'))}).querySelector('a')?.getAttribute('href')") == "https://example.com", html("note"))
    select("note")
    click('[aria-label="Clear formatting"]')
    check("Clear formatting removes link", not b.count(f'{field("note")} a'))
    click('[aria-label="Bulleted list"]')
    select("note", 10, 10)
    b.call("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13, "text": "\r"})
    b.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13, "text": "\r"})
    b.call("Input.insertText", {"text": "Second item"})
    check("Enter adds another editable list item", b.count(f'{field("note")} li') == 2, html("note"))
    Path('/tmp/nova-richtext-editing.png').write_bytes(base64.b64decode(b.call('Page.captureScreenshot', {"format": "png"})['data']))
    b.key("Escape")
    b.pause(.7)
    check("Finishing editing keeps title", b.evaluate("document.querySelector('main article').textContent.includes('Alpha Updated Gamma')"))
    check("Finishing editing keeps note list", bool(b.count('main article ul li')))
    projects = b.evaluate("""new Promise(resolve=>{const q=indexedDB.open('nova-workspace');q.onsuccess=()=>{const r=q.result.transaction('projects').objectStore('projects').getAll();r.onsuccess=()=>resolve(r.result)}})""", await_promise=True)
    saved = next(project for project in projects if project['title'] == project_title)['board']['nodes'][0]
    check("Both fields persist in IndexedDB", saved['title'] == 'Alpha Updated Gamma' and 'Second item' in saved['note'] and '<ul>' in saved['noteHtml'], saved)
    board_url = b.evaluate("location.href")
    b.call("Page.reload")
    b.wait_ready()
    b.wait_for("!!document.querySelector('input[aria-label=\"Board title\"]')")
    check("Reload stays on the same board URL", b.evaluate("location.href") == board_url)
    check("Reload restores edited text and list", b.evaluate("document.querySelector('main article').textContent.includes('Alpha Updated Gamma')") and b.count('main article ul li') == 2)
    click("main article h3", 2)
    b.wait_for("!!document.querySelector('[contenteditable=true]')")
    check("Double-click reopens saved formatted text", b.count('[contenteditable=true]') == 2)
    replace("title", "Outside click saved")
    p = b.evaluate("(() => {const r=document.querySelector('main').getBoundingClientRect();return{x:r.left+8,y:r.top+8}})()")
    b.mouse_drag(p, p)
    check("Outside click commits without losing typed text", not b.count('[contenteditable=true]') and b.evaluate("document.querySelector('main article').textContent.includes('Outside click saved')"))
    check("No browser errors", not b.errors, b.errors)
finally:
    print(json.dumps(results, indent=2))
    b.close()
if any(result["status"] == "FAIL" for result in results):
    raise SystemExit(1)
