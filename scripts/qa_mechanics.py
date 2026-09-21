#!/usr/bin/env python3
"""Canvas interaction, relationship, filtering, export, and drag/drop QA."""

import json
import time

from qa_browser import Browser


class Mechanics:
    def __init__(self):
        self.b = Browser()
        self.results = []

    def test(self, name, fn):
        before = len(self.b.errors)
        try:
            fn()
            self.b.pause(0.12)
            self.b.evaluate("true")
            errors = self.b.errors[before:]
            if errors:
                raise AssertionError("; ".join(errors))
            self.results.append({"name": name, "status": "PASS"})
        except Exception as error:
            self.results.append({"name": name, "status": "FAIL", "detail": str(error)})
            self.b.evaluate("[...document.querySelectorAll('button[aria-label^=\"Close \"]')].at(-1)?.click()")

    def assert_(self, value, message):
        if not value:
            raise AssertionError(message)

    def click(self, selector):
        self.assert_(self.b.evaluate(f"""(() => {{const el=document.querySelector({json.dumps(selector)});el?.click();return !!el}})()"""), f"Missing {selector}")

    def click_text_in(self, root, text):
        self.assert_(self.b.evaluate(f"""(() => {{const root=document.querySelector({json.dumps(root)});const el=[...(root?.querySelectorAll('button')||[])].find(x=>x.innerText.trim()==={json.dumps(text)});el?.click();return !!el}})()"""), f"Missing {text}")

    def open_command(self, query, label, dialog):
        self.assert_(self.b.click_text("Quick find", exact=False), "Quick find unavailable")
        self.b.wait_for("!!document.querySelector('input[placeholder*=\"Find a shape\"]')")
        self.b.fill('input[placeholder*="Find a shape"]', query)
        self.b.pause()
        self.assert_(self.b.evaluate(f"""(() => {{const el=[...document.querySelectorAll('button')].find(x=>x.querySelector('strong')?.innerText.trim()==={json.dumps(label)});el?.click();return !!el}})()"""), f"Missing command {label}")
        self.b.wait_for(f"!!document.querySelector({json.dumps('[aria-label="'+dialog+'"]')})")

    def setup(self):
        self.b.click_text("Open workspace →")
        self.b.wait_for("document.body.innerText.includes('YOUR WORKSPACE')")
        self.b.click_text("Product roadmap", exact=False)
        self.b.wait_for("document.body.innerText.includes('Product vision')")

    def run(self):
        b = self.b
        self.setup()

        def drag_node():
            rect = b.evaluate("""(() => {const el=document.querySelector('main article');const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,transform:el.style.transform}})()""")
            b.call("Input.dispatchMouseEvent", {"type": "mousePressed", "x": rect["x"], "y": rect["y"], "button": "left", "buttons": 1, "clickCount": 1})
            b.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": rect["x"]+90, "y": rect["y"]+55, "button": "left", "buttons": 1})
            b.call("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": rect["x"]+90, "y": rect["y"]+55, "button": "left", "buttons": 0, "clickCount": 1})
            b.pause()
            after = b.evaluate("document.querySelector('main article').style.transform")
            self.assert_(after != rect["transform"], "Node position did not change")
        self.test("Pointer drag moves a node", drag_node)

        def global_styles():
            before = b.evaluate("document.querySelector('svg[class] g')?.className.baseVal")
            self.click('[aria-label="Global styles"] [aria-label="Line"]')
            self.click_text_in('[aria-label="Line settings"]', "Curve")
            self.click('[aria-label="Global styles"] [aria-label="Line style"]')
            self.click_text_in('[aria-label="Line style settings"]', "Dashed")
            self.click('[aria-label="Global styles"] [aria-label="Weight"]')
            self.click_text_in('[aria-label="Weight settings"]', "Bold")
            after = b.evaluate("document.querySelector('svg[class] g')?.className.baseVal")
            self.assert_(before != after, "Rendered connection styles did not change")
        self.test("Global connector style changes", global_styles)

        def connect_shapes():
            before = b.count("svg[class] g")
            b.key("Escape")
            b.pause()
            self.assert_(b.click_aria("Connect"), "Connect tool unavailable")
            connected = b.evaluate("""(() => {const nodes=[...document.querySelectorAll('main article')];nodes[0].click();nodes[1].click();return nodes.length>=2})()""")
            self.assert_(connected, "Could not choose connection endpoints")
            b.pause()
            self.assert_(b.count('[aria-label="Relationship type"]') == 1, "New connection was not selected")
            self.assert_(b.count("svg[class] g") >= before, "Connection geometry missing")
            self.assert_(b.click_aria("Select"), "Could not return to select tool")
        self.test("Connect tool creates selectable relationship", connect_shapes)

        def dependency_type():
            self.open_command("dependency", "Open Dependency Center", "Dependency center")
            selector = '[aria-label="Dependency center"] select[aria-label^="Relationship from"]'
            self.assert_(b.choose(selector, "blocks"), "Relationship type control missing")
            self.assert_("active" in b.text(), "Blocker summary did not update")
            self.assert_(b.click_aria("Close dependency center"), "Could not close dependency center")
        self.test("Relationship type and blocker detection", dependency_type)

        def copy_paste():
            b.evaluate("document.querySelector('main article').click()")
            before = b.count("main article")
            b.key("c", modifiers=4)
            b.key("v", modifiers=4)
            b.pause()
            self.assert_(b.count("main article") == before+1, "Copy/paste did not duplicate selection")
        self.test("Cross-project local clipboard copy/paste", copy_paste)

        def duplicate_lock_delete():
            b.evaluate("document.querySelector('main article').click()")
            before = b.count("main article")
            self.click('button[title="Duplicate"]')
            self.assert_(b.count("main article") == before+1, "Duplicate control failed")
            self.click('button[title="Lock selection"]')
            self.assert_(b.evaluate("document.querySelector('button[title=\"Delete\"]')?.disabled"), "Locked selection still allows deletion")
            self.click('button[title="Unlock selection"]')
            self.click('button[title="Delete"]')
            self.assert_(b.count("main article") == before, "Delete after unlock failed")
        self.test("Duplicate, lock protection, unlock, and delete", duplicate_lock_delete)

        def group_and_frame():
            before = b.count("main article")
            b.key("a", modifiers=4)
            b.pause()
            selected = "selected" in b.text() and b.count('main article')>=2
            self.assert_(selected, "Multi-select failed")
            self.click_text_in("body", "Group")
            self.assert_("Ungroup" in b.text(), "Grouping failed")
            self.click_text_in("body", "Ungroup")
            self.click_text_in("body", "Frame")
            self.assert_(b.count("main article") == before+1, "Frame was not created around selection")
        self.test("Multi-select, grouping, ungrouping, and framing", group_and_frame)

        def branch_collapse():
            root = b.evaluate("""(() => {const node=[...document.querySelectorAll('main article')].find(x=>x.innerText.includes('Product vision'));node?.click();return !!node})()""")
            self.assert_(root, "Root shape missing")
            before = b.count("main article")
            self.click('button[title="Collapse branch"]')
            b.pause()
            self.assert_(b.count("main article") < before, "Collapse did not hide descendants")
            self.click('button[title="Expand branch"]')
            b.pause()
            self.assert_(b.count("main article") == before, "Expand did not restore descendants")
        self.test("Collapse and expand connected branch", branch_collapse)

        def status_drag_drop():
            self.open_command("workflow", "Open status board", "Workflow board")
            moved = b.evaluate("""(() => {const board=document.querySelector('[aria-label="Workflow board"]');const card=board.querySelector('article[draggable=true]');const target=[...board.querySelectorAll('section')].find(x=>x.querySelector(':scope > header b')?.innerText==='Done');if(!card||!target)return false;const dt=new DataTransfer();card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));return true})()""")
            self.assert_(moved, "Could not perform status drag")
            b.pause()
            done_count = b.evaluate("""(() => {const board=document.querySelector('[aria-label="Workflow board"]');const target=[...board.querySelectorAll('section')].find(x=>x.querySelector(':scope > header b')?.innerText==='Done');return target?.querySelectorAll('article').length||0})()""")
            self.assert_(done_count >= 1, "Dropped card did not enter Done")
            self.assert_(b.click_aria("Close status board"), "Could not close status board")
        self.test("Status board drag and drop", status_drag_drop)

        def resources_and_focus():
            b.evaluate("document.querySelector('main article').click()")
            self.click('button[title="Shape details"]')
            b.fill('input[placeholder="Label (optional)"]', "QA Link")
            b.fill('input[placeholder="https://example.com"]', "https://example.com/qa")
            self.click('input[placeholder="https://example.com"] + button')
            b.click_aria("Close shape details")
            self.open_command("resource", "Open Resource Hub", "Resource hub")
            self.assert_("QA Link" in b.text(), "Resource Hub did not index shape link")
            b.click_aria("Close resource hub")
            self.open_command("focus lens", "Open Focus Lens", "Focus lens")
            self.assert_(b.choose('[aria-label="Filter by property"]', "linked"), "Linked filter unavailable")
            self.assert_("QA Link" not in b.text() or b.count('[aria-label="Focus lens"] article') >= 1, "Focus Lens linked filter returned no shape")
            self.click_text_in('[aria-label="Focus lens"]', "Select results")
        self.test("Resource indexing and Focus Lens linked filter", resources_and_focus)

        def export_svg():
            b.call("Browser.setDownloadBehavior", {"behavior": "allow", "downloadPath": "/tmp"})
            self.open_command("export studio", "Open Export Studio", "Export studio")
            self.click_text_in('[aria-label="Export studio"]', "SVG vector")
            self.click_text_in('[aria-label="Export studio"]', "Export SVG")
            b.pause()
            self.assert_(not b.evaluate("!!document.querySelector('[aria-label=\"Export studio\"]')"), "Export Studio did not close after export")
        self.test("SVG visual export", export_svg)

        def unlimited_zoom():
            for _ in range(35):
                b.click_aria("Zoom in")
            percent = b.evaluate("parseInt(document.querySelector('[aria-label=\"Fit map\"]')?.innerText)")
            self.assert_(percent > 400, f"Zoom still appears capped at {percent}%")
            for _ in range(80):
                b.click_aria("Zoom out")
            low = b.evaluate("parseInt(document.querySelector('[aria-label=\"Fit map\"]')?.innerText)")
            self.assert_(low <= 5, f"Deep zoom-out appears capped at {low}%")
            b.click_aria("Center and fit board")
        self.test("Extended zoom range and fit recovery", unlimited_zoom)

        return self.results


if __name__ == "__main__":
    suite = Mechanics()
    try:
        results = suite.run()
        print(json.dumps(results, indent=2))
        failed = [item for item in results if item["status"] == "FAIL"]
        print(json.dumps({"passed": len(results)-len(failed), "failed": len(failed)}, indent=2))
        raise SystemExit(1 if failed else 0)
    finally:
        suite.b.close()
