#!/usr/bin/env python3
"""Check the template library in an isolated Chrome profile with the Vite server running."""
import base64
import json
import os
from pathlib import Path
from qa_browser import Browser

BASE = os.environ.get("DRAWANYTHING_QA_URL", os.environ.get("NOVA_QA_URL", "http://localhost:5177")).rstrip("/")
out = Path(os.environ.get("DRAWANYTHING_QA_OUTPUT", os.environ.get("NOVA_QA_OUTPUT", "/tmp/drawanything-templates-review")))
out.mkdir(exist_ok=True)
b = Browser(int(os.environ.get("DRAWANYTHING_QA_PORT", os.environ.get("NOVA_QA_PORT", "9237"))), BASE + "/projects?templates=1")

def visit(path):
    b.call("Page.navigate", {"url": BASE + path})
    b.wait_ready()

def shot(name):
    b.pause(.25)
    (out / (name + ".png")).write_bytes(base64.b64decode(b.call("Page.captureScreenshot", {"format": "png"})["data"]))

def key(name):
    for kind in ["keyDown", "keyUp"]:
        b.call("Input.dispatchKeyEvent", {"type": kind, "key": name, "code": name, "windowsVirtualKeyCode": 27 if name == "Escape" else 13})
    b.pause(.25)

def size(width, height):
    b.call("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False})
    b.pause(.25)

def contained():
    assert b.evaluate("""(()=>{const d=document.querySelector('[data-template-library]'),r=d.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth&&[...d.querySelectorAll('main,section,input,footer')].every(e=>e.getBoundingClientRect().right<=r.right)})()"""), "Library overflows viewport"

try:
    b.wait_for("!!document.querySelector('[data-template-library][open]')")
    b.evaluate("localStorage.setItem('nova-board-tour-v1','skipped')")
    size(1440, 1000)
    assert b.count('[data-template-id]') == 24
    assert b.evaluate("document.activeElement.getAttribute('aria-label')") == "Search templates"
    shot("library-desktop")
    # Category buttons filter without changing projects or creating a board.
    for index in range(1, 7):
        b.evaluate(f"document.querySelectorAll('[aria-label=\"Template categories\"] button')[{index}].click()")
        b.wait_for("document.querySelectorAll('[data-template-id]').length===4")
    b.evaluate("document.querySelector('[aria-label=\"Template categories\"] button').click()")
    b.fill('[aria-label="Search templates"]', '  UX interview  ')
    b.wait_for("document.querySelectorAll('[data-template-id]').length===1")
    assert b.count('[data-template-id="user-research"]') == 1
    b.fill('[aria-label="Search templates"]', 'nothing matches here')
    b.wait_for("document.querySelectorAll('[data-template-id]').length===0")
    assert b.click_text("Show all templates", exact=False)
    b.wait_for("document.querySelectorAll('[data-template-id]').length===24")
    for width, height in [(1440, 1000), (1024, 768), (768, 900), (390, 844), (320, 740)]:
        size(width, height)
        contained()
        shot("library-" + str(width))
        b.click_aria("Preview Weekly priorities")
        b.wait_for("!!document.querySelector('dialog h3[tabindex]')")
        contained()
        assert b.count('dialog ol li') == 3
        assert b.evaluate("document.activeElement.textContent") == "Weekly priorities"
        shot("preview-" + str(width))
        key("Escape")
        b.wait_for("document.querySelectorAll('[data-template-id]').length===24")
        assert b.evaluate("document.activeElement.dataset.templateId") == "weekly-plan", b.evaluate("({active:document.activeElement.tagName,open:document.querySelector('[data-template-library]').open})")
    print("PASS categories, multi-word search, empty reset, focus, preview and five responsive sizes", flush=True)
    size(1440, 1000)
    key("Escape")
    b.wait_for("!document.querySelector('[data-template-library]')")
    assert b.evaluate("!new URLSearchParams(location.search).has('templates')")
    # Create every template through the actual UI and inspect its saved board.
    catalog = b.evaluate("(async()=>{const {templates}=await import('/src/data/templates.js');return templates.map(t=>({id:t.id,count:t.board.nodes.length}))})()", True)
    clipped_templates = []
    for template in catalog:
        template_id = template['id']
        visit("/projects?templates=1")
        b.wait_for("document.querySelectorAll('[data-template-id]').length===24")
        b.evaluate(f"document.querySelector('[data-template-id=\"{template_id}\"]').click()")
        b.click_text("Use template", exact=False)
        b.wait_for("location.pathname.startsWith('/boards/') && document.querySelectorAll('[data-export-node]').length===" + str(template['count']))
        b.pause(.4)
        assert b.evaluate("""(()=>{const s=document.querySelector('[aria-label="Board canvas"]').getBoundingClientRect();return [...document.querySelectorAll('[data-export-node]')].every(e=>{const r=e.getBoundingClientRect();return r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom})})()"""), template_id + " does not fit on first open"
        info = b.evaluate("""(async()=>{const {listProjects}=await import('/src/lib/localWorkspace.js');const {templates}=await import('/src/data/templates.js');const p=(await listProjects()).find(p=>p.id===location.pathname.split('/').pop());return {name:p.title,nodes:p.board.nodes.map(n=>({id:n.id,x:n.x,y:n.y,title:n.title,note:n.note})),source:templates.find(t=>t.id===""" + json.dumps(template_id) + """).board.nodes.map(n=>({id:n.id,x:n.x,y:n.y,title:n.title,note:n.note}))}})()""", True)
        assert info["nodes"] == info["source"], template_id
        clipped = b.evaluate("""[...document.querySelectorAll('[data-export-node] h3,[data-export-node] p')].filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>({text:e.textContent,width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight}))""")
        if clipped:
            clipped_templates.append((template_id, clipped))
        shot("board-" + template_id)
    assert not clipped_templates, clipped_templates
    print("PASS all 24 templates: creation, saved content, geometry and readable prompts", flush=True)
    visit("/")
    b.wait_for("!!document.querySelector('a[href=\"/projects?templates=1\"]')")
    b.evaluate("document.querySelector('a[href=\"/projects?templates=1\"]').click()")
    b.wait_for("document.querySelectorAll('[data-template-id]').length===24")
    assert not b.errors, b.errors
    print("PASS landing link opens the library; no browser errors", flush=True)
finally:
    b.close()
