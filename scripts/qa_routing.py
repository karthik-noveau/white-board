#!/usr/bin/env python3
"""Exercise real routing, browser history, deep links, and saves during navigation.

Run against a dedicated Chrome test profile. Creates only uniquely named QA data.
"""
import base64
import json
import os
from pathlib import Path
from urllib.parse import quote

from qa_browser import Browser

PORT = int(os.environ.get("NOVA_QA_PORT", "9232"))
BASE = os.environ.get("NOVA_QA_URL", "http://127.0.0.1:5185/").rstrip("/")
b = Browser(PORT, BASE + "/")
results = []


def check(name, condition):
    results.append({"name": name, "status": "PASS" if condition else "FAIL"})
    if not condition:
        raise AssertionError(name)


def path():
    return b.evaluate("location.pathname+location.search")


def wait_board():
    b.wait_for("!!document.querySelector('[aria-label=\"Board title\"]')")


def visit(route):
    b.call("Page.navigate", {"url": BASE + route})
    b.wait_ready()


def nav(route):
    check("Navigation link exists: " + route, b.evaluate(f"""(() => {{const a=document.querySelector('a[href={json.dumps(route)}]');a?.click();return !!a}})()"""))
    b.wait_for(f"location.pathname==={json.dumps(route)}")


def history(direction, route):
    b.evaluate(f"window.history.{direction}()")
    b.wait_for(f"location.pathname+location.search==={json.dumps(route)}")


def click(selector, count=1):
    p = b.evaluate(f"""(() => {{const r=document.querySelector({json.dumps(selector)}).getBoundingClientRect();return {{x:r.x+r.width/2,y:r.y+r.height/2}}}})()""")
    b.call("Input.dispatchMouseEvent", {"type": "mouseMoved", **p})
    for n in range(1, count + 1):
        for kind in ["mousePressed", "mouseReleased"]:
            b.call("Input.dispatchMouseEvent", {"type": kind, **p, "button": "left", "buttons": 1 if kind == "mousePressed" else 0, "clickCount": n})


def rename(value):
    click('[aria-label="Board title"]')
    b.fill('[aria-label="Board title"]', value)
    b.key("Enter")


def card_action(title, label):
    return b.evaluate(f"""(() => {{const card=[...document.querySelectorAll('article')].find(el=>el.querySelector('a')?.getAttribute('aria-label')==={json.dumps('Open ' + title)});const action=card?.querySelector({json.dumps('[aria-label="' + label + '"]')});action?.click();return !!action}})()""")


try:
    b.call("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False})
    b.wait_for("!!document.querySelector('a[href=\"/projects\"]')")
    b.evaluate("window.__routingDocument=crypto.randomUUID()")
    document_id = b.evaluate("window.__routingDocument")
    check("Landing opens workspace through a real link", b.click_text("Open workspace →"))
    b.wait_for("location.pathname==='/projects' && document.body.innerText.includes('YOUR WORKSPACE')")
    check("Client navigation preserves the document", b.evaluate("window.__routingDocument") == document_id)
    check("Workspace navigation uses an accessible active link", b.evaluate("document.querySelector('nav[aria-label=Workspace] a[aria-current=page]').pathname==='/projects'"))
    check("Project cards expose board URLs", b.evaluate("[...document.querySelectorAll('article a[aria-label^=\"Open \"]')].every(a=>a.pathname.startsWith('/boards/'))"))
    b.click_text("New mind map", exact=False)
    wait_board()
    board_route = path()
    check("Creating a board updates the URL", board_route.startswith('/boards/project-'))
    title = "Routing QA " + str(b.evaluate("Date.now()"))
    rename(title)
    b.wait_for(f"document.title==={json.dumps(title + ' · Nova')}")
    check("Board title updates the tab title", True)

    # Leave before the 350 ms debounce expires, while the editable field is open.
    click('main article h3', 2)
    b.wait_for("!!document.querySelector('[contenteditable=true][data-field=title]')")
    b.evaluate("""(() => {const el=document.querySelector('[contenteditable=true][data-field=title]');el.focus();const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r)})()""")
    b.call('Input.insertText', {'text': 'Saved before navigating'})
    b.click_aria('Back to projects')
    b.wait_for("location.pathname==='/projects'")
    b.click_aria('Open ' + title)
    wait_board()
    check("Leaving immediately saves the latest editable text", 'Saved before navigating' in b.text())
    history('back', '/projects')
    history('forward', board_route)
    wait_board()
    check("Browser Back and Forward restore the same board", b.evaluate("document.querySelector('[aria-label=\"Board title\"]').value") == title)
    click('[aria-label="Board title"]')
    title += " renamed"
    b.fill('[aria-label="Board title"]', title)
    history('back', '/projects')
    history('forward', board_route)
    wait_board()
    check("Browser Back saves a title draft without requiring blur", b.evaluate("document.querySelector('[aria-label=\"Board title\"]').value") == title)
    click('[aria-label="Board title"]')
    b.fill('[aria-label="Board title"]', "Cancelled title")
    b.key('Escape')
    check("Escape still cancels a title edit", b.evaluate("document.querySelector('[aria-label=\"Board title\"]').value") == title)
    b.call('Page.reload', {'ignoreCache': True})
    b.wait_ready()
    wait_board()
    check("Refresh preserves the board route and saved text", path() == board_route and 'Saved before navigating' in b.text())
    other = Browser(PORT, BASE + board_route)
    try:
        other.wait_for("!!document.querySelector('[aria-label=\"Board title\"]')")
        check("A copied board URL opens in a second tab", other.evaluate("document.querySelector('[aria-label=\"Board title\"]').value") == title and 'Saved before navigating' in other.text())
    finally:
        other.call('Page.close')
        other.close()
    b.call('Page.bringToFront')
    b.click_aria('Back to projects')
    b.wait_for("location.pathname==='/projects'")
    check("Project can be favorited", card_action(title, 'Add favorite'))
    nav('/projects/favorites')
    b.fill('[aria-label="Search projects"]', title)
    b.wait_for("new URLSearchParams(location.search).has('q')")
    filtered_route = path()
    check("Search is encoded in the URL", b.evaluate("new URLSearchParams(location.search).get('q')") == title)
    b.click_aria('Open ' + title)
    wait_board()
    b.click_aria('Back to projects')
    b.wait_for(f"location.pathname+location.search==={json.dumps(filtered_route)}")
    check("Projects link restores Favorites and its search", b.evaluate("document.querySelector('[aria-label=\"Search projects\"]').value") == title)
    b.call('Page.reload')
    b.wait_ready()
    b.wait_for("!!document.querySelector('[aria-label=\"Search projects\"]')")
    check("Refreshing Favorites preserves its search and result", path() == filtered_route and b.count('article a[aria-label^="Open "]') == 1)

    folder = 'Design / R&D #1 — 100% ' + title
    b.evaluate(f'window.prompt=()=>{json.dumps(folder)}')
    check("Project can be moved into a folder", card_action(title, 'Move to folder'))
    folder_route = '/projects/folders/' + quote(folder, safe="~()*!.'-")
    b.wait_for(f"!!document.querySelector('a[href={json.dumps(folder_route)}]')")
    nav(folder_route)
    check("Encoded folder route shows its project", title in b.text())
    b.call('Page.reload')
    b.wait_ready()
    b.wait_for("!!document.querySelector('[aria-label=\"Search projects\"]')")
    check("Folder names containing slash, percent, and Unicode survive refresh", folder in b.text() and title in b.text())
    Path('/tmp/nova-routing-workspace.png').write_bytes(base64.b64decode(b.call('Page.captureScreenshot', {'format': 'png'})['data']))
    check("Project can be moved to Trash", card_action(title, 'Move project to trash'))
    visit(board_route)
    b.wait_for("document.body.innerText.includes('This board is in Trash')")
    check("Deleted board URL offers recovery", b.count('a[href="/projects/trash"]') == 1)
    nav('/projects/trash')
    b.wait_for(f"!!document.querySelector('[aria-label={json.dumps('Restore ' + title)}]')")
    check("Trash has its own route and saved project", title in b.text())
    b.click_aria('Restore ' + title)
    visit(board_route)
    wait_board()
    check("Restoring a board keeps its original URL and contents", 'Saved before navigating' in b.text())
    visit('/boards/does-not-exist')
    b.wait_for("document.body.innerText.includes('Board not found')")
    check("Missing board links show a recovery page", b.count('a[href="/projects"]') == 1)
    visit('/projects/not-a-real-section')
    b.wait_for("document.body.innerText.includes('Page not found')")
    check("Unknown routes show a 404 page", True)
    check("No runtime errors", not b.errors)
finally:
    print(json.dumps({'checks': results, 'runtime_errors': b.errors}, indent=2))
    b.close()

if any(item['status'] == 'FAIL' for item in results):
    raise SystemExit(1)
