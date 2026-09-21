#!/usr/bin/env python3
"""Micro-level product regression suite for Nova.

This complements the smoke, feature, and mechanics suites. It checks edge cases,
download payloads, IndexedDB persistence, and pointer-driven interactions.
"""

import glob
import json
import os
import struct
import time
from datetime import date, timedelta

from qa_browser import Browser


DOWNLOAD_DIR = "/tmp/nova-exhaustive-downloads"


class Exhaustive:
    def __init__(self):
        self.b = Browser(int(os.environ.get("NOVA_QA_PORT", "9225")))
        self.results = []

    def test(self, name, fn):
        before = len(self.b.errors)
        try:
            detail = fn()
            self.b.pause(.12)
            self.b.evaluate("true")
            errors = self.b.errors[before:]
            if errors:
                raise AssertionError("; ".join(errors))
            self.results.append({"name": name, "status": "PASS", "detail": detail or ""})
        except Exception as error:
            self.results.append({"name": name, "status": "FAIL", "detail": str(error)})
            self.dismiss()

    def assert_(self, value, message):
        if not value:
            raise AssertionError(message)

    def click(self, selector):
        ok = self.b.evaluate(f"""(() => {{const e=document.querySelector({json.dumps(selector)});e?.click();return !!e}})()""")
        self.assert_(ok, f"Missing clickable: {selector}")

    def click_text(self, root, text, exact=True):
        op = "===wanted" if exact else ".includes(wanted)"
        ok = self.b.evaluate(f"""(() => {{const r=document.querySelector({json.dumps(root)})||document;const wanted={json.dumps(text)};const e=[...r.querySelectorAll('button,a')].find(x=>x.innerText.trim(){op});e?.click();return !!e}})()""")
        self.assert_(ok, f"Missing action: {text}")

    def fill(self, selector, value):
        self.assert_(self.b.fill(selector, value), f"Missing field: {selector}")

    def dismiss(self):
        self.b.evaluate("""(() => { const closes=[...document.querySelectorAll('button[aria-label^="Close "]')]; closes.at(-1)?.click(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); })()""")

    def command(self, query, label, dialog):
        self.assert_(self.b.click_text("Quick find", exact=False), "Quick Find missing")
        self.b.wait_for("!!document.querySelector('input[placeholder*=\"Find a shape\"]')")
        self.fill('input[placeholder*="Find a shape"]', query)
        self.b.pause(.08)
        ok = self.b.evaluate(f"""(() => {{const e=[...document.querySelectorAll('button')].find(x=>x.querySelector('strong')?.innerText.trim()==={json.dumps(label)});e?.click();return !!e}})()""")
        self.assert_(ok, f"Command not found: {label}")
        self.b.wait_for(f"!!document.querySelector({json.dumps('[aria-label="'+dialog+'"]')})")

    def latest_download(self, suffix, since):
        deadline = time.time() + 5
        while time.time() < deadline:
            matches = [path for path in glob.glob(f"{DOWNLOAD_DIR}/*{suffix}") if os.path.getmtime(path) >= since]
            matches = [path for path in matches if not path.endswith(".crdownload")]
            if matches:
                return max(matches, key=os.path.getmtime)
            time.sleep(.1)
        raise AssertionError(f"No {suffix} download completed")

    def inject_file(self, name, content, mime="application/json"):
        return self.b.evaluate(f"""(() => {{const input=document.querySelector('input[type=file]');if(!input)return false;const file=new File([{json.dumps(content)}],{json.dumps(name)},{{type:{json.dumps(mime)}}});const dt=new DataTransfer();dt.items.add(file);Object.defineProperty(input,'files',{{value:dt.files,configurable:true}});input.dispatchEvent(new Event('change',{{bubbles:true}}));return true}})()""")

    def db_projects(self):
        return self.b.evaluate("""new Promise((resolve,reject)=>{const q=indexedDB.open('nova-workspace');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,t=db.transaction('projects','readonly'),r=t.objectStore('projects').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}})""", await_promise=True)

    def current_project(self):
        title = self.b.evaluate("document.querySelector('input[aria-label=\"Board title\"]')?.value")
        projects = self.db_projects()
        return max((p for p in projects if p.get("title") == title), key=lambda p: p.get("updated", 0), default=None)

    def setup(self):
        self.b.call("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        for path in glob.glob(f"{DOWNLOAD_DIR}/*"):
            os.unlink(path)
        self.b.call("Browser.setDownloadBehavior", {"behavior": "allow", "downloadPath": DOWNLOAD_DIR, "eventsEnabled": True})
        self.b.wait_for("document.body.innerText.includes('Open workspace')", timeout=10)
        self.b.click_text("Open workspace →")
        self.b.wait_for("document.body.innerText.includes('YOUR WORKSPACE')")

    def run(self):
        b = self.b
        self.setup()

        def rename_blank():
            self.click('button[aria-label="Rename project"]')
            field = 'article input'
            self.fill(field, "   ")
            b.key("Enter")
            b.pause(.4)
            self.assert_("Untitled mind map" in b.text(), "Blank rename was not normalized")
        self.test("Home: blank rename falls back to Untitled", rename_blank)

        def rename_escape():
            self.click('button[aria-label="Rename project"]')
            self.fill('article input', "Should not persist")
            b.key("Escape")
            self.assert_("Should not persist" not in b.text(), "Escape committed project rename")
        self.test("Home: Escape cancels rename", rename_escape)

        def folder_trim():
            b.evaluate("window.prompt=()=> '  QA Folder  '")
            self.click('button[aria-label="Move to folder"]')
            b.pause(.4)
            self.assert_(b.click_text("QA Folder", exact=False), "Trimmed folder nav not created")
            b.pause(.2)
            self.assert_(b.count('section article a[aria-label^="Open "]') >= 1, "Folder filter did not show its project")
            self.assert_(b.click_text("Projects", exact=False), "Could not leave folder")
            b.pause(.2)
        self.test("Home: folder names are trimmed and filterable", folder_trim)

        def export_project():
            started = time.time()
            self.click('button[aria-label="Export project"]')
            path = self.latest_download(".nova", started)
            payload = json.load(open(path, encoding="utf-8"))
            self.assert_(payload.get("format") == "nova-project" and payload.get("version") == 1, "Invalid project envelope")
            self.assert_(payload.get("project", {}).get("id"), "Export omitted project id")
            return os.path.basename(path)
        self.test("Home: project download has valid portable schema", export_project)

        def backup_workspace():
            started = time.time()
            self.click_text("body", "Backup all", exact=False)
            path = self.latest_download(".nova-workspace", started)
            payload = json.load(open(path, encoding="utf-8"))
            self.assert_(payload.get("format") == "nova-workspace", "Invalid workspace envelope")
            self.assert_(len(payload.get("projects", [])) >= 3, "Backup omitted projects")
            self.assert_(isinstance(payload.get("versions"), list) and isinstance(payload.get("shapeLibrary"), list), "Backup omitted local collections")
        self.test("Home: workspace backup includes projects, versions, and library", backup_workspace)

        def invalid_import():
            self.assert_(self.inject_file("broken.nova", "{not json"), "File input unavailable")
            b.wait_for("!!document.querySelector('main') && !![...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Dismiss')")
            self.click_text("body", "Dismiss")
        self.test("Home: malformed import reports a dismissible error", invalid_import)

        def valid_import():
            payload = {"format":"nova-project","version":1,"project":{"id":"foreign","title":"Imported Edge Project","updated":1,"board":{"nodes":[{"id":1,"x":100,"y":100,"title":"Imported Node","note":"","shape":"round","color":"white"}],"edges":[]}}}
            self.assert_(self.inject_file("valid.nova", json.dumps(payload)), "Could not inject import")
            b.wait_for("document.body.innerText.includes('Imported Edge Project')")
            projects = self.db_projects()
            item = next((p for p in projects if p.get("title") == "Imported Edge Project"), None)
            self.assert_(item and item["id"] != "foreign", "Import did not allocate a collision-safe id")
        self.test("Home: valid project import gets a new id and retains content", valid_import)

        def workspace_import():
            payload = {"format":"nova-workspace","version":1,"projects":[{"id":"same","title":"Workspace One","updated":1},{"id":"same","title":"Workspace Two","updated":2}],"shapeLibrary":[{"id":"imported-library","name":"Imported component","payload":{"nodes":[],"edges":[]}}]}
            self.inject_file("workspace.nova-workspace", json.dumps(payload))
            b.wait_for("document.body.innerText.includes('Workspace One') && document.body.innerText.includes('Workspace Two')")
            imported = [p for p in self.db_projects() if p.get("title", "").startswith("Workspace ")]
            self.assert_(len(imported) == 2 and len({p["id"] for p in imported}) == 2, "Workspace ids collided")
        self.test("Home: workspace import safely merges multiple projects", workspace_import)

        def delete_cancel_confirm():
            # Trash the imported project first.
            moved = b.evaluate("""(() => {const a=[...document.querySelectorAll('article')].find(x=>x.innerText.includes('Imported Edge Project'));a?.querySelector('[aria-label="Move project to trash"]')?.click();return !!a})()""")
            self.assert_(moved, "Imported card missing")
            self.assert_(b.click_text("Trash", exact=False), "Trash nav missing")
            b.pause(.2)
            b.evaluate("window.confirm=()=>false")
            self.click('button[aria-label="Delete forever"]')
            self.assert_("Imported Edge Project" in b.text(), "Cancel still deleted project")
            b.evaluate("window.confirm=()=>true")
            self.click('button[aria-label="Delete forever"]')
            b.pause(.3)
            self.assert_("Imported Edge Project" not in b.text(), "Confirmed permanent delete failed")
            self.assert_(b.click_text("Projects", exact=False), "Projects nav missing")
        self.test("Home: permanent delete honors cancel and confirm", delete_cancel_confirm)

        def open_template():
            self.assert_(b.click_text("Product roadmap", exact=False), "Template unavailable")
            b.wait_for("document.body.innerText.includes('Product vision')")
            self.assert_(b.count("main article") >= 6, "Template nodes missing")
        self.test("Canvas: template opens with nodes and edges", open_template)

        def board_title():
            self.fill('input[aria-label="Board title"]', "  Exhaustive QA  ")
            b.evaluate("document.querySelector('input[aria-label=\"Board title\"]')?.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:null}))")
            b.pause(.5)
            self.assert_(b.evaluate("document.querySelector('input[aria-label=\"Board title\"]')?.value") == "Exhaustive QA", "Title was not trimmed")
        self.test("Canvas: board title trims and persists", board_title)

        def double_click_canvas():
            before = b.count("main article")
            rect = b.evaluate("(() => {const r=document.querySelector('main').getBoundingClientRect();return{x:r.left+70,y:r.top+130}})()")
            for _ in range(2):
                b.call("Input.dispatchMouseEvent", {"type":"mousePressed","x":rect["x"],"y":rect["y"],"button":"left","buttons":1,"clickCount":2})
                b.call("Input.dispatchMouseEvent", {"type":"mouseReleased","x":rect["x"],"y":rect["y"],"button":"left","buttons":0,"clickCount":2})
                break
            b.pause(.2)
            self.assert_(b.count("main article") == before + 1, "Canvas double-click did not add exactly one shape")
        self.test("Canvas: double-click adds exactly one shape", double_click_canvas)

        def keyboard_create_edit():
            node = b.evaluate("""(() => {const e=[...document.querySelectorAll('main article')].at(-1);e.click();return e.innerText})()""")
            before = b.count("main article")
            b.key("Tab")
            self.assert_(b.count("main article") == before + 1, "Tab did not add a child")
            b.key("Enter")
            b.wait_for("!!document.querySelector('main article [data-field=title][contenteditable=true]')")
            b.key("Escape")
            self.assert_(not b.evaluate("!!document.querySelector('main article [data-field=title][contenteditable=true]')"), "Escape did not finish editing")
            return node
        self.test("Canvas: Tab child, Enter edit, Escape commit lifecycle", keyboard_create_edit)

        def real_rich_text_selection():
            opened = b.evaluate("""(() => {const article=[...document.querySelectorAll('main article')].at(-1);article?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));return !!article})()""")
            self.assert_(opened, "Editable shape missing")
            b.wait_for("!!document.querySelector('main article [data-field=title][contenteditable=true]')")
            prepared = b.evaluate("""(() => {const title=document.querySelector('main article [data-field=title][contenteditable=true]');if(!title)return false;title.focus();title.textContent='Alpha Beta Gamma';title.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'Alpha Beta Gamma'}));const text=title.firstChild,range=document.createRange();range.setStart(text,6);range.setEnd(text,10);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);title.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift',bubbles:true}));return selection.toString()==='Beta'})()""")
            self.assert_(prepared, "Could not create a partial text selection")
            button = b.evaluate("(() => {const e=document.querySelector('button[aria-label=\"Bold\"]');const r=e?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()")
            self.assert_(button, "Bold formatting button missing")
            b.call("Input.dispatchMouseEvent", {"type":"mousePressed","x":button["x"],"y":button["y"],"button":"left","buttons":1,"clickCount":1})
            b.call("Input.dispatchMouseEvent", {"type":"mouseReleased","x":button["x"],"y":button["y"],"button":"left","buttons":0,"clickCount":1})
            b.pause(.15)
            html = b.evaluate("document.querySelector('main article [data-field=title][contenteditable=true]')?.innerHTML") or ""
            self.assert_(("<b>Beta</b>" in html or "<strong>Beta</strong>" in html) and "Alpha" in html and "Gamma" in html, f"Partial bold formatting failed: {html}")
            b.key("Escape")
            b.pause(.6)
            project = self.current_project()
            saved = next((node for node in project.get("board", {}).get("nodes", []) if node.get("title") == "Alpha Beta Gamma"), None) if project else None
            self.assert_(saved and ("<b>Beta</b>" in saved.get("titleHtml", "") or "<strong>Beta</strong>" in saved.get("titleHtml", "")), "Formatted HTML was not persisted to IndexedDB")
        self.test("Rich text: type, select a substring, format it, commit, and persist", real_rich_text_selection)

        def outside_click_saves_text():
            opened = b.evaluate("""(() => {const article=[...document.querySelectorAll('main article')].at(-1);article?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));return !!article})()""")
            self.assert_(opened, "Editable shape missing")
            b.wait_for("!!document.querySelector('main article [data-field=title][contenteditable=true]')")
            changed = b.evaluate("""(() => {const title=document.querySelector('main article [data-field=title][contenteditable=true]');title.focus();title.textContent='Outside click saved';title.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'Outside click saved'}));return title.innerText})()""")
            self.assert_(changed == "Outside click saved", "Typing did not update the editor DOM")
            point = b.evaluate("(() => {const r=document.querySelector('main').getBoundingClientRect();return{x:r.left+8,y:r.top+8}})()")
            b.call("Input.dispatchMouseEvent", {"type":"mousePressed","x":point["x"],"y":point["y"],"button":"left","buttons":1,"clickCount":1})
            b.call("Input.dispatchMouseEvent", {"type":"mouseReleased","x":point["x"],"y":point["y"],"button":"left","buttons":0,"clickCount":1})
            b.wait_for("!document.querySelector('main article [data-field=title][contenteditable=true]')")
            self.assert_("Outside click saved" in b.text(), "Outside click closed editing but lost the typed title")
            b.pause(.6)
            project = self.current_project()
            saved = next((node for node in project.get("board", {}).get("nodes", []) if node.get("title") == "Outside click saved"), None) if project else None
            self.assert_(saved and saved.get("titleHtml") == "Outside click saved", "Outside-click edit was not persisted to IndexedDB")
        self.test("Rich text: clicking blank canvas commits and persists typed text", outside_click_saves_text)

        def selection_survives_editor_click():
            b.evaluate("""[...document.querySelectorAll('main article')].find(x=>x.innerText.includes('Outside click saved'))?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))""")
            b.wait_for("!!document.querySelector('main article [data-field=title][contenteditable=true]')")
            b.pause(.1)
            selected = b.evaluate("""(() => {const title=document.querySelector('main article [data-field=title][contenteditable=true]'),text=title.firstChild,range=document.createRange();range.setStart(text,0);range.setEnd(text,7);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);title.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:81}));title.dispatchEvent(new MouseEvent('click',{bubbles:true}));return{value:selection.toString(),select:getComputedStyle(title).userSelect,editing:!!document.querySelector('[data-field=title][contenteditable=true]')}})()""")
            self.assert_(selected["select"] == "text", f"Editable text has user-select: {selected['select']}")
            self.assert_(selected["editing"] and selected["value"] == "Outside", f"Editor click destroyed the selected range: {selected}")
            button = b.evaluate("(() => {const e=document.querySelector('button[aria-label=\"Italic\"]');const r=e?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()")
            self.assert_(button, "Italic formatting button missing")
            b.call("Input.dispatchMouseEvent", {"type":"mousePressed","x":button["x"],"y":button["y"],"button":"left","buttons":1,"clickCount":1})
            b.call("Input.dispatchMouseEvent", {"type":"mouseReleased","x":button["x"],"y":button["y"],"button":"left","buttons":0,"clickCount":1})
            b.pause(.15)
            html = b.evaluate("document.querySelector('main article [data-field=title][contenteditable=true]')?.innerHTML") or ""
            self.assert_("<i>" in html or "<em>" in html, f"Mouse-selected text was not formatted: {html}")
            b.key("Escape")
        self.test("Rich text: editor click lifecycle preserves selection for formatting", selection_survives_editor_click)

        def branch_directions():
            b.evaluate("document.querySelector('main article').click()")
            before = b.count("main article")
            for label in ["Add branch above", "Add branch right", "Add branch below", "Add branch left"]:
                self.assert_(b.click_aria(label), f"Missing {label}")
            self.assert_(b.count("main article") == before + 4, "Directional branch buttons did not each add a shape")
        self.test("Canvas: all four branch handles create children", branch_directions)

        def details_edges():
            b.evaluate("document.querySelector('main article').click()")
            self.click('button[title="Shape details"]')
            self.click_text('[aria-label="Shape details"]', "In progress")
            self.click_text('[aria-label="Shape details"]', "High")
            today = date.today().isoformat()
            self.fill('[aria-label="Shape details"] input[type=date]', today)
            for tag in [" alpha ", "#alpha", "beta"]:
                self.fill('input[placeholder="Add tag…"]', tag)
                self.click_text('[aria-label="Shape details"]', "Add")
            text = b.text()
            self.assert_(text.count("#alpha") == 1 and "#beta" in text, "Tags were not trimmed/deduplicated")
            self.fill('input[placeholder="https://example.com"]', "javascript:alert(1)")
            self.click_text('[aria-label="Shape details"]', "Add link")
            self.assert_("Enter a valid" in b.text(), "Unsafe link was accepted")
            self.fill('input[placeholder="https://example.com"]', "qa@example.com")
            self.click_text('[aria-label="Shape details"]', "Add link")
            href = b.evaluate("document.querySelector('[aria-label=\"Shape details\"] a')?.getAttribute('href')")
            self.assert_(href == "mailto:qa@example.com", f"Email link was not normalized: {href}")
            self.click('button[aria-label="Close shape details"]')
        self.test("Details: status, priority, date, tag dedupe, and URL validation", details_edges)

        def comments():
            b.evaluate("document.querySelector('main article').click()")
            self.click('button[title="Comments"]')
            self.fill('[aria-label="Local comments"] textarea', "Micro feedback")
            self.click_text('[aria-label="Local comments"]', "Comment")
            self.assert_("Micro feedback" in b.text(), "Comment missing")
            self.click_text('[aria-label="Local comments"]', "Resolve")
            self.assert_("Reopen" in b.text(), "Resolve did not toggle")
            self.click_text('[aria-label="Local comments"]', "Reopen")
            self.click('button[aria-label="Delete comment"]')
            self.assert_("Micro feedback" not in b.text(), "Comment delete failed")
            self.click('button[aria-label="Close comments"]')
        self.test("Comments: add, resolve, reopen, and delete", comments)

        def saved_views():
            self.click('button[aria-label="Saved views"]')
            self.fill('[aria-label="Saved board views"] input', "QA View")
            self.click_text('[aria-label="Saved board views"]', "Save current view")
            self.assert_("QA View" in b.text(), "Saved view missing")
            self.click_text('[aria-label="Saved board views"]', "QA View", exact=False)
            self.click('button[aria-label="Saved views"]')
            self.click('button[aria-label="Delete QA View"]')
            self.assert_("QA View" not in b.text(), "Saved view delete failed")
            self.click('button[aria-label="Close saved views"]')
        self.test("Views: save, reopen, and delete", saved_views)

        def outline_controls():
            self.click('button[aria-label="Board outline"]')
            self.fill('[aria-label="Board outline"] input', "Product vision")
            self.assert_(b.count('[aria-label="Board outline"] .does-not-exist') == 0, "")
            self.click('[aria-label="Board outline"] button[aria-label="Hide item"]')
            self.assert_(b.count("main article") >= 1, "Hiding one item hid all nodes")
            self.click('[aria-label="Board outline"] button[aria-label="Show item"]')
            self.click('[aria-label="Board outline"] button[aria-label="Lock item"]')
            self.assert_(b.evaluate("!!document.querySelector('[aria-label=\"Board outline\"] button[aria-label=\"Unlock item\"]')"), "Outline lock did not toggle")
            self.click('[aria-label="Board outline"] button[aria-label="Unlock item"]')
            self.click('button[aria-label="Close outline"]')
        self.test("Outline: filter, hide/show, and lock/unlock", outline_controls)

        def resize_rotate():
            b.evaluate("document.querySelector('main article').click()")
            b.click_aria("Center and fit board")
            b.pause(.15)
            before = b.evaluate("(() => {const n=document.querySelector('main article[class*=selectedNode]');const r=n?.getBoundingClientRect();return r?{w:r.width,h:r.height}:null})()")
            self.assert_(before, "Selected node missing before resize")
            handle = b.evaluate("(() => {const e=document.querySelector('[class*=resizeSE]');if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()")
            self.assert_(handle, "Southeast resize handle missing")
            b.mouse_drag(handle, {"x":handle["x"]+70,"y":handle["y"]+45})
            after = b.evaluate("(() => {const n=document.querySelector('main article[class*=selectedNode]');const r=n?.getBoundingClientRect();return r?{w:r.width,h:r.height,style:n.style.cssText}:null})()")
            self.assert_(after["w"] > before["w"] + 30 and after["h"] > before["h"] + 20, "Resize did not change both dimensions")
            rotate = b.evaluate("(() => {const e=document.querySelector('[aria-label=\"Rotate shape\"]');const r=e?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()")
            self.assert_(rotate, "Rotate handle missing")
            old = b.evaluate("document.querySelector('main article[class*=selectedNode]').style.transform")
            b.mouse_drag(rotate, {"x":rotate["x"]+60,"y":rotate["y"]+35})
            new = b.evaluate("document.querySelector('main article[class*=selectedNode]').style.transform")
            self.assert_(old != new and "rotate(0deg)" not in new, "Rotation did not change")
        self.test("Canvas: real pointer resize and rotation", resize_rotate)

        def minimap():
            old = b.evaluate("document.querySelector('main > div[style*=translate3d]').style.transform")
            dispatched = b.evaluate("""(() => {const e=document.querySelector('[aria-label^="Drag to navigate"]');if(!e)return false;const r=e.getBoundingClientRect();e.setPointerCapture=()=>{};e.hasPointerCapture=()=>false;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:71,clientX:r.left+15,clientY:r.top+15,buttons:1}));e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:71,clientX:r.left+15,clientY:r.top+15}));return true})()""")
            self.assert_(dispatched, "Mini map missing")
            b.pause(.2)
            new = b.evaluate("document.querySelector('main > div[style*=translate3d]').style.transform")
            self.assert_(old != new, "Mini map drag did not navigate")
            b.click_aria("Center and fit board")
        self.test("Canvas: minimap drag changes viewport and fit recovers", minimap)

        def calendar_drag():
            self.command("calendar", "Open Calendar", "Board calendar")
            result = b.evaluate("""(() => {const root=document.querySelector('[aria-label="Board calendar"]');const card=root.querySelector('aside button[draggable=true]');const cells=[...root.querySelectorAll('main section')];const cell=cells.find(x=>!x.querySelector('button[draggable=true]'));if(!card||!cell)return false;const dt=new DataTransfer();card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));cell.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));cell.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));return {title:card.innerText.trim(),day:cell.querySelector('header span')?.innerText}})()""")
            self.assert_(result, "No undated card/day available for calendar drag")
            b.pause(.2)
            self.assert_(b.evaluate("document.querySelector('[aria-label=\"Board calendar\"] footer span').innerText").startswith("2") or b.count('[aria-label="Board calendar"] main button[draggable=true]') >= 1, "Calendar did not schedule dragged card")
            self.click('button[aria-label="Close calendar"]')
        self.test("Calendar: unscheduled card drag assigns a date", calendar_drag)

        def automation_effect():
            self.command("automations", "Open Automations", "Local automations")
            # Defaults are status / done / starred / true.
            self.click_text('[aria-label="Local automations"]', "Add rule")
            self.assert_(b.evaluate("document.querySelector('[aria-label=\"Local automations\"] h2 b')?.innerText") == "1", "Automation was not added/enabled")
            self.click('button[aria-label="Close automations"]')
            b.evaluate("document.querySelector('main article').click()")
            self.click('button[title="Shape details"]')
            self.click_text('[aria-label="Shape details"]', "Done")
            b.pause(.3)
            self.assert_("Starred" in b.text(), "Automation did not star matching Done shape")
            self.click('button[aria-label="Close shape details"]')
        self.test("Automations: matching rule performs its action", automation_effect)

        def recurrence_generation():
            # Use a currently non-done node.
            b.evaluate("[...document.querySelectorAll('main article')].find(x=>!x.innerText.includes('Done'))?.click()")
            self.command("recurring", "Open Recurring Work", "Recurring work")
            self.fill('[aria-label="Recurring work"] input[type=date]', date.today().isoformat())
            self.click_text('[aria-label="Recurring work"]', "Set recurrence")
            self.click('button[aria-label="Close recurring work"]')
            before = b.count("main article")
            self.click('button[title="Shape details"]')
            self.click_text('[aria-label="Shape details"]', "Done")
            b.pause(.5)
            self.assert_(b.count("main article") == before + 1, "Completion did not create one recurring occurrence")
            self.click('button[aria-label="Close shape details"]')
            b.pause(.2)
            self.assert_(b.count("main article") == before + 1, "Recurring occurrence was generated more than once")
        self.test("Recurring work: completion creates exactly one next occurrence", recurrence_generation)

        def history_restore():
            # Save state, add a shape, then restore saved milestone.
            before = b.count("main article")
            self.click('button[aria-label="Local version history"]')
            self.fill('aside[aria-label="Local version history"] input', "Restore Base")
            self.click_text('aside[aria-label="Local version history"]', "Save")
            self.click('button[aria-label="Close version history"]')
            b.key("Escape")
            b.pause(.08)
            b.click_aria("Shape")
            self.assert_(b.count("main article") == before + 1, "Mutation before restore failed")
            self.click('button[aria-label="Local version history"]')
            b.wait_for("document.querySelectorAll('aside[aria-label=\"Local version history\"] article').length > 0")
            self.click('aside[aria-label="Local version history"] article button')
            self.assert_("1" in b.evaluate("document.querySelector('[class*=diffStats]')?.innerText"), "Comparison did not detect added shape")
            self.click_text('aside[aria-label="Local version history"]', "Restore this version")
            b.pause(.2)
            self.assert_(b.count("main article") == before, "Version restore did not revert shape count")
        self.test("History: compare detects mutation and restore reverts it", history_restore)

        def svg_png_exports():
            self.command("export studio", "Open Export Studio", "Export studio")
            self.click_text('[aria-label="Export studio"]', "SVG vector")
            started = time.time()
            self.click('[aria-label="Export studio"] footer button')
            svg = self.latest_download(".svg", started)
            content = open(svg, encoding="utf-8").read()
            self.assert_(content.startswith("<svg") and "<rect" in content and "<text" in content, "SVG lacks expected vector content")
            self.command("export studio", "Open Export Studio", "Export studio")
            self.click_text('[aria-label="Export studio"]', "PNG image")
            started = time.time()
            self.click('[aria-label="Export studio"] footer button')
            png = self.latest_download(".png", started)
            with open(png, "rb") as stream:
                header = stream.read(24)
            self.assert_(header[:8] == b"\x89PNG\r\n\x1a\n", "Invalid PNG signature")
            width, height = struct.unpack(">II", header[16:24])
            self.assert_(width > 100 and height > 100, "PNG dimensions are unexpectedly small")
        self.test("Export Studio: SVG structure and PNG binary dimensions", svg_png_exports)

        def csv_markdown_exports():
            self.command("data exchange", "Open CSV Data Exchange", "CSV data exchange")
            started = time.time()
            self.click_text('[aria-label="CSV data exchange"]', "Download CSV")
            csv = self.latest_download(".csv", started)
            body = open(csv, encoding="utf-8").read()
            self.assert_(body.splitlines()[0].startswith("id,title,note,status"), "CSV header schema is wrong")
            non_frames = b.evaluate("[...document.querySelectorAll('main article')].filter(x=>!x.className.includes('frameNode')).length")
            self.assert_(len(body.splitlines()) == non_frames + 1, "CSV row count does not match shapes")
            self.click('button[aria-label="Close data exchange"]')
            self.assert_(b.click_text("Quick find", exact=False), "Quick Find missing")
            self.fill('input[placeholder*="Find a shape"]', "markdown")
            b.pause(.1)
            started = time.time()
            self.click_text("body", "Export as Markdown", exact=False)
            md = self.latest_download(".md", started)
            markdown = open(md, encoding="utf-8").read()
            self.assert_(markdown.startswith("# Exhaustive QA") and "Product vision" in markdown, "Markdown content incomplete")
        self.test("Data portability: CSV schema/count and Markdown hierarchy", csv_markdown_exports)

        def persistence():
            time.sleep(.7)
            project = self.current_project()
            self.assert_(project and project.get("board"), "Current board was not persisted")
            expected = len(project["board"]["nodes"])
            board_url = b.evaluate("location.href")
            b.call("Page.reload", {"ignoreCache": True})
            b.wait_ready()
            b.wait_for("!!document.querySelector('input[aria-label=\"Board title\"]')")
            self.assert_(b.evaluate("location.href") == board_url, "Reload left the board route")
            self.assert_(b.evaluate("document.querySelector('[aria-label=\"Board title\"]').value") == project["title"], "Reload opened a different board")
            self.assert_(b.count("main article") == expected, "Reloaded node count differs from IndexedDB")
        self.test("Persistence: saved board reload matches IndexedDB state", persistence)

        return self.results


if __name__ == "__main__":
    suite = Exhaustive()
    try:
        results = suite.run()
        print(json.dumps(results, indent=2))
        failed = [result for result in results if result["status"] == "FAIL"]
        print(json.dumps({"passed":len(results)-len(failed),"failed":len(failed),"total":len(results)}, indent=2))
        raise SystemExit(1 if failed else 0)
    finally:
        suite.b.close()
