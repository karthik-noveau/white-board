#!/usr/bin/env python3
"""End-to-end functional audit for Nova using an isolated Chrome CDP session."""

import json
import time

from qa_browser import Browser


class Audit:
    def __init__(self):
        self.browser = Browser()
        self.results = []

    def record(self, name, fn):
        before = len(self.browser.errors)
        try:
            detail = fn()
            self.browser.pause()
            # Flush queued browser events.
            self.browser.evaluate("true")
            new_errors = self.browser.errors[before:]
            if new_errors:
                raise AssertionError("; ".join(new_errors))
            self.results.append({"name": name, "status": "PASS", "detail": detail or ""})
        except Exception as error:
            self.results.append({"name": name, "status": "FAIL", "detail": str(error)})

    def assert_true(self, value, message):
        if not value:
            raise AssertionError(message)

    def text_has(self, value):
        self.assert_true(value in self.browser.text(), f"Missing text: {value}")

    def click_selector(self, selector):
        clicked = self.browser.evaluate(
            f"""(() => {{ const el=document.querySelector({json.dumps(selector)}); if(!el)return false; el.click(); return true }})()"""
        )
        self.assert_true(clicked, f"Missing clickable selector: {selector}")

    def click_button_label(self, label):
        clicked = self.browser.evaluate(
            f"""(() => {{ const el=[...document.querySelectorAll('button')].find(button=>button.querySelector('strong')?.innerText.trim()==={json.dumps(label)} || button.innerText.trim()==={json.dumps(label)}); if(!el)return false; el.click(); return true }})()"""
        )
        self.assert_true(clicked, f"Missing button: {label}")

    def open_command(self, query, label, dialog_label):
        self.assert_true(self.browser.click_text("Quick find", exact=False), "Quick find did not open")
        self.browser.wait_for("!!document.querySelector('input[placeholder*=\"Find a shape\"]')")
        self.assert_true(self.browser.fill('input[placeholder*="Find a shape"]', query), "Could not enter command query")
        self.browser.pause()
        self.click_button_label(label)
        self.browser.wait_for(f"!!document.querySelector('[aria-label={json.dumps(dialog_label)}]')")

    def close_dialog(self, aria):
        self.assert_true(self.browser.click_aria(aria), f"Could not close dialog: {aria}")
        self.browser.pause(0.08)

    def run(self):
        b = self.browser

        self.record("Landing page renders", lambda: self.text_has("Ideas deserve"))

        def enter_workspace():
            self.assert_true(b.click_text("Open workspace →"), "Workspace CTA missing")
            b.wait_for("document.body.innerText.includes('YOUR WORKSPACE')")
            self.text_has("10 flexible starting points")
            self.assert_true(b.count('a[aria-label^="Open "]') >= 3, "Expected starter projects")
        self.record("Landing to workspace navigation", enter_workspace)

        def project_search():
            self.assert_true(b.fill('input[placeholder="Search projects"]', "Research"), "Search field unavailable")
            b.pause()
            self.text_has("Research synthesis")
            self.assert_true("Product vision" not in b.text(), "Project filtering did not hide non-matches")
            b.fill('input[placeholder="Search projects"]', "")
        self.record("Project search", project_search)

        def favorite_project():
            self.click_selector('button[aria-label="Add favorite"]')
            self.assert_true(b.click_text("Favorites", exact=False), "Favorites navigation unavailable")
            b.pause()
            self.assert_true(b.count('a[aria-label^="Open "]') >= 1, "Favorite did not appear")
            self.assert_true(b.click_text("Projects", exact=False), "Projects navigation unavailable")
        self.record("Favorite project and filter", favorite_project)

        def duplicate_and_trash():
            before = b.count('a[aria-label^="Open "]')
            self.click_selector('button[aria-label="Duplicate project"]')
            b.pause()
            self.assert_true(b.count('a[aria-label^="Open "]') == before + 1, "Duplicate was not created")
            cards = b.evaluate("[...document.querySelectorAll('article')].map(x=>x.innerText).filter(x=>x.includes('copy'))")
            self.assert_true(cards, "Duplicate title missing")
            moved = b.evaluate("""(() => { const card=[...document.querySelectorAll('article')].find(x=>x.innerText.includes('copy')); const button=card?.querySelector('[aria-label="Move project to trash"]'); button?.click(); return !!button })()""")
            self.assert_true(moved, "Could not move duplicate to trash")
            self.assert_true(b.click_text("Trash", exact=False), "Trash navigation unavailable")
            b.pause()
            self.assert_true(b.count('button[aria-label^="Restore "]') >= 1, "Trashed project missing")
            self.click_selector('button[aria-label^="Restore "]')
            b.pause()
            self.assert_true(b.click_text("Projects", exact=False), "Could not return to projects")
        self.record("Duplicate, trash, and restore project", duplicate_and_trash)

        def open_template():
            self.assert_true(b.click_text("Product roadmap", exact=False), "Template card missing")
            b.wait_for("!!document.querySelector('main') && document.body.innerText.includes('Product vision')")
            self.assert_true(b.count('main article') >= 6, "Template nodes did not render")
            self.assert_true(b.count('svg path') > 0, "Canvas connections did not render")
        self.record("Create project from template", open_template)

        def create_undo_redo():
            before = b.count('main article')
            self.assert_true(b.click_aria("Shape"), "Shape tool missing")
            b.pause()
            self.assert_true(b.count('main article') == before + 1, "Shape was not created")
            self.assert_true(b.click_aria("Undo"), "Undo unavailable")
            b.pause()
            self.assert_true(b.count('main article') == before, "Undo did not remove shape")
            self.assert_true(b.click_aria("Redo"), "Redo unavailable")
            b.pause()
            self.assert_true(b.count('main article') == before + 1, "Redo did not restore shape")
        self.record("Create shape, undo, and redo", create_undo_redo)

        def edit_rich_text():
            started = b.evaluate("""(() => { const node=[...document.querySelectorAll('main article')].at(-1); if(!node)return false; node.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); return true })()""")
            self.assert_true(started, "Could not start node editing")
            b.wait_for("!!document.querySelector('main article [data-field=title][contenteditable=true]')")
            changed = b.evaluate("""(() => { const title=document.querySelector('main article [data-field=title][contenteditable=true]'); title.focus(); title.innerHTML='<b>QA idea</b>'; title.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'QA idea'})); title.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:null})); return true })()""")
            self.assert_true(changed, "Could not edit rich text")
            b.pause()
            self.text_has("QA idea")
        self.record("Rich-text shape editing", edit_rich_text)

        def add_branch():
            before = b.count('main article')
            node_clicked = b.evaluate("""(() => { const node=[...document.querySelectorAll('main article')].find(x=>x.innerText.includes('QA idea')); node?.click(); return !!node })()""")
            self.assert_true(node_clicked, "Edited node could not be selected")
            self.assert_true(b.click_aria("Add branch right"), "Branch handle missing")
            b.pause()
            self.assert_true(b.count('main article') == before + 1, "Branch was not created")
        self.record("Create connected branch", add_branch)

        def zoom_controls():
            before = b.evaluate("document.querySelector('[aria-label=\"Fit map\"]')?.innerText")
            self.assert_true(b.click_aria("Zoom in"), "Zoom in unavailable")
            after = b.evaluate("document.querySelector('[aria-label=\"Fit map\"]')?.innerText")
            self.assert_true(before != after, "Zoom percentage did not change")
            self.assert_true(b.click_aria("Zoom out"), "Zoom out unavailable")
            self.assert_true(b.click_aria("Center and fit board"), "Fit control unavailable")
        self.record("Zoom and fit controls", zoom_controls)

        def escape_from_focused_field():
            self.open_command("replace", "Find and replace", "Find and replace board text")
            self.click_selector('input[placeholder="Text, status, or tag…"]')
            b.key("Escape")
            b.pause()
            self.assert_true(not b.evaluate("!!document.querySelector('[aria-label=\"Find and replace board text\"]')"), "Escape did not close the focused dialog")
        self.record("Escape closes a dialog while its field is focused", escape_from_focused_field)

        dialogs = [
            ("outline", "Open board outline", "Board outline", "Close outline"),
            ("comments", "Open comments", "Local comments", "Close comments"),
            ("views", "Open saved views", "Saved board views", "Close saved views"),
            ("workflow", "Open status board", "Workflow board", "Close status board"),
            ("text outline", "Import text outline", "Import text outline", "Close outline import"),
            ("replace", "Find and replace", "Find and replace board text", "Close find and replace"),
            ("insights", "Open board insights", "Board insights", "Close board insights"),
            ("library", "Open shape library", "Shape library", "Close shape library"),
            ("shortcuts", "Keyboard shortcuts", "Keyboard shortcuts", "Close keyboard shortcuts"),
            ("agenda", "Open agenda", "Local agenda", "Close agenda"),
            ("resource", "Open Resource Hub", "Resource hub", "Close resource hub"),
            ("focus lens", "Open Focus Lens", "Focus lens", "Close focus lens"),
            ("dependency", "Open Dependency Center", "Dependency center", "Close dependency center"),
            ("export studio", "Open Export Studio", "Export studio", "Close export studio"),
            ("storyline", "Open Storyline Builder", "Storyline builder", "Close storyline builder"),
            ("data table", "Open Data Table", "Board data table", "Close data table"),
            ("automations", "Open Automations", "Local automations", "Close automations"),
            ("custom fields", "Open Custom Fields", "Custom fields", "Close custom fields"),
            ("data exchange", "Open CSV Data Exchange", "CSV data exchange", "Close data exchange"),
            ("calendar", "Open Calendar", "Board calendar", "Close calendar"),
            ("progress", "Open Progress Rollups", "Branch progress", "Close progress rollups"),
            ("workload", "Open Team & Workload", "Team and workload", "Close team and workload"),
            ("focus sessions", "Open Focus Sessions", "Focus sessions", "Close focus sessions"),
            ("recurring", "Open Recurring Work", "Recurring work", "Close recurring work"),
            ("decision", "Open Decision Log", "Decision log", "Close decision log"),
            ("prioritization", "Open Prioritization Lab", "Prioritization lab", "Close prioritization lab"),
            ("goals", "Open Goals Hub", "Goals hub", "Close goals hub"),
            ("sprint", "Open Sprint Planner", "Sprint planner", "Close sprint planner"),
            ("risk", "Open Risk Register", "Risk register", "Close risk register"),
        ]
        for query, command, dialog, close in dialogs:
            self.record(
                f"Command opens {dialog}",
                lambda q=query, c=command, d=dialog, x=close: (self.open_command(q, c, d), self.close_dialog(x)),
            )

        return self.results

    def close(self):
        self.browser.close()


if __name__ == "__main__":
    audit = Audit()
    try:
        results = audit.run()
        print(json.dumps(results, indent=2))
        failed = [result for result in results if result["status"] == "FAIL"]
        print(json.dumps({"passed": len(results) - len(failed), "failed": len(failed)}, indent=2))
        raise SystemExit(1 if failed else 0)
    finally:
        audit.close()
