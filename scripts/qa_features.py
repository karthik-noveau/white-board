#!/usr/bin/env python3
"""Deep mutation and persistence tests for Nova's advanced workflows."""

import json
import time

from qa_browser import Browser


class Features:
    def __init__(self):
        self.b = Browser()
        self.results = []

    def check(self, name, fn):
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
            self.dismiss_overlays()

    def assert_(self, value, message):
        if not value:
            raise AssertionError(message)

    def click(self, selector):
        value = self.b.evaluate(f"""(() => {{const el=document.querySelector({json.dumps(selector)});el?.click();return !!el}})()""")
        self.assert_(value, f"Missing clickable {selector}")

    def click_in(self, container, text):
        value = self.b.evaluate(f"""(() => {{const root=document.querySelector({json.dumps(container)});const el=[...(root?.querySelectorAll('button')||[])].find(x=>x.innerText.trim()==={json.dumps(text)});el?.click();return !!el}})()""")
        self.assert_(value, f"Missing {text} in {container}")

    def has(self, text):
        self.assert_(text in self.b.text(), f"Missing text: {text}")

    def fill(self, selector, value):
        self.assert_(self.b.fill(selector, value), f"Could not fill {selector}")

    def open_command(self, query, label, dialog):
        self.assert_(self.b.click_text("Quick find", exact=False), "Quick find unavailable")
        self.b.wait_for("!!document.querySelector('input[placeholder*=\"Find a shape\"]')")
        self.fill('input[placeholder*="Find a shape"]', query)
        self.b.pause()
        clicked = self.b.evaluate(f"""(() => {{const el=[...document.querySelectorAll('button')].find(x=>x.querySelector('strong')?.innerText.trim()==={json.dumps(label)});el?.click();return !!el}})()""")
        self.assert_(clicked, f"Command missing: {label}")
        self.b.wait_for(f"!!document.querySelector({json.dumps('[aria-label="'+dialog+'"]')})")

    def close(self, aria):
        self.assert_(self.b.click_aria(aria), f"Close control unavailable: {aria}")

    def dismiss_overlays(self):
        self.b.evaluate("""(() => {const close=[...document.querySelectorAll('button[aria-label^="Close "]')].at(-1);close?.click()})()""")

    def setup(self):
        self.b.click_text("Open workspace →")
        self.b.wait_for("document.body.innerText.includes('YOUR WORKSPACE')")
        self.b.click_text("Product roadmap", exact=False)
        self.b.wait_for("document.body.innerText.includes('Product vision')")

    def run(self):
        b = self.b
        self.setup()

        def shape_details():
            self.click('main article')
            self.click('button[title="Shape details"]')
            b.wait_for("!!document.querySelector('[aria-label=\"Shape details\"]')")
            self.click_in('[aria-label="Shape details"]', "To do")
            self.click_in('[aria-label="Shape details"]', "High")
            self.fill('[aria-label="Shape details"] input[type="date"]', "2026-10-15")
            self.fill('input[placeholder="Add tag…"]', "qa-tag")
            self.click('input[placeholder="Add tag…"] + button')
            self.fill('input[placeholder="Label (optional)"]', "Spec")
            self.fill('input[placeholder="https://example.com"]', "example.com/spec")
            self.click('input[placeholder="https://example.com"] + button')
            self.has("#qa-tag")
            self.has("https://example.com/spec")
            self.close("Close shape details")
            self.has("To do")
        self.check("Shape status, priority, due date, tag, and secure link", shape_details)

        def comments():
            self.click('main article')
            self.click('button[title="Comments"]')
            self.fill('textarea[placeholder="Add a local comment…"]', "QA feedback")
            self.click_in('[aria-label="Local comments"]', "Comment")
            self.has("QA feedback")
            self.click_in('[aria-label="Local comments"]', "Resolve")
            self.has("Reopen")
            self.close("Close comments")
        self.check("Comments add and resolve", comments)

        def saved_view():
            self.click('[aria-label="Saved views"]')
            self.fill('[aria-label="Saved board views"] input', "QA View")
            self.click_in('[aria-label="Saved board views"]', "Save current view")
            self.has("QA View")
            opened = b.evaluate("""(() => {const root=document.querySelector('[aria-label="Saved board views"]');const button=[...root.querySelectorAll('button')].find(x=>x.innerText.includes('QA View'));button?.click();return !!button})()""")
            self.assert_(opened, "Saved view could not be reopened")
        self.check("Save and reopen canvas view", saved_view)

        def outline_import():
            before = b.count("main article")
            self.open_command("text outline", "Import text outline", "Import text outline")
            self.fill('[aria-label="Import text outline"] textarea', "QA Plan\n  Research\n  Build")
            self.click_in('[aria-label="Import text outline"]', "Create mind map")
            b.pause()
            self.assert_(b.count("main article") == before + 3, "Outline did not create three shapes")
            self.has("QA Plan")
        self.check("Indented outline import", outline_import)

        def find_replace():
            self.open_command("replace", "Find and replace", "Find and replace board text")
            self.fill('input[placeholder="Text, status, or tag…"]', "QA Plan")
            self.fill('input[placeholder="Replacement text"]', "Validated Plan")
            self.has("1 match")
            self.click_in('[aria-label="Find and replace board text"]', "Replace all")
            self.has("Validated Plan")
        self.check("Board-wide find and replace", find_replace)

        def shape_library():
            node = b.evaluate("""(() => {const node=[...document.querySelectorAll('main article')].find(x=>x.innerText.includes('Validated Plan'));node?.click();return !!node})()""")
            self.assert_(node, "Imported node unavailable")
            before = b.count("main article")
            self.open_command("library", "Open shape library", "Shape library")
            self.fill('[aria-label="Shape library"] form input', "QA Component")
            self.click_in('[aria-label="Shape library"]', "Save selection")
            b.pause(0.3)
            self.has("QA Component")
            self.click_in('[aria-label="Shape library"]', "Insert")
            b.pause()
            self.assert_(b.count("main article") > before, "Library component was not inserted")
        self.check("Reusable shape library save and insert", shape_library)

        def custom_field():
            self.open_command("custom fields", "Open Custom Fields", "Custom fields")
            self.fill('input[placeholder="Field name"]', "Owner note")
            self.click_in('[aria-label="Custom fields"]', "Add field")
            self.has("Owner note")
            self.fill('input[placeholder="Enter owner note…"]', "Local value")
            b.evaluate("document.querySelector('input[placeholder=\"Enter owner note…\"]').dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:null}))")
            self.close("Close custom fields")
        self.check("Custom field definition and value", custom_field)

        def csv_import():
            before = b.count("main article")
            self.open_command("data exchange", "Open CSV Data Exchange", "CSV data exchange")
            area = '[aria-label="CSV data exchange"] textarea'
            self.fill(area, 'title,note,status,priority,tags,color\n"CSV QA","Imported",todo,high,"qa,csv",blue')
            b.pause()
            self.has("1 row")
            button = b.evaluate("""(() => {const el=[...document.querySelectorAll('[aria-label="CSV data exchange"] button')].find(x=>x.innerText.includes('Import 1 row'));el?.click();return !!el})()""")
            self.assert_(button, "CSV import action unavailable")
            b.pause()
            self.assert_(b.count("main article") == before + 1, "CSV row did not create a shape")
            self.has("CSV QA")
        self.check("CSV preview and append import", csv_import)

        def automation():
            self.open_command("automations", "Open Automations", "Local automations")
            self.click_in('[aria-label="Local automations"]', "Add rule")
            self.has("WHEN")
            self.has("THEN")
            self.assert_(b.count('[aria-label="Local automations"] input[type="checkbox"]') == 1, "Automation switch missing")
            self.close("Close automations")
        self.check("Automation rule creation", automation)

        def data_table():
            self.open_command("data table", "Open Data Table", "Board data table")
            self.click('[aria-label="Select visible shapes"]')
            b.pause()
            selects = b.evaluate("[...document.querySelectorAll('[aria-label=\"Board data table\"] select')].map(x=>x.value)")
            self.assert_(len(selects) >= 3, "Bulk controls did not appear")
            b.choose('[aria-label="Board data table"] select:nth-of-type(2)', "doing")
            self.click_in('[aria-label="Board data table"]', "Apply")
            self.close("Close data table")
        self.check("Data Table select-all and bulk update", data_table)

        def workload():
            self.open_command("workload", "Open Team & Workload", "Team and workload")
            self.fill('input[placeholder="Add a board member…"]', "Ada QA")
            self.click_in('[aria-label="Team and workload"]', "Add member")
            self.has("Ada QA")
            assign = '[aria-label="Team and workload"] select[aria-label^="Assign "]'
            member_id = b.evaluate(f"document.querySelector({json.dumps(assign)})?.options[1]?.value")
            self.assert_(member_id, "Assignee option missing")
            self.assert_(b.choose(assign, member_id), "Could not assign shape")
            self.close("Close team and workload")
        self.check("Local team member and assignment", workload)

        def focus_timer():
            self.open_command("focus sessions", "Open Focus Sessions", "Focus sessions")
            self.click_in('[aria-label="Focus sessions"]', "Start")
            b.pause(0.3)
            self.has("FOCUSING NOW")
            self.click_in('[aria-label="Focus sessions"]', "Stop & save")
            self.close("Close focus sessions")
        self.check("Focus timer start and stop", focus_timer)

        def recurrence():
            self.open_command("recurring", "Open Recurring Work", "Recurring work")
            self.fill('[aria-label="Recurring work"] input[type="date"]', "2026-10-20")
            self.click_in('[aria-label="Recurring work"]', "Set recurrence")
            self.has("Every week")
            self.close("Close recurring work")
        self.check("Recurring schedule creation", recurrence)

        def decision():
            self.open_command("decision", "Open Decision Log", "Decision log")
            self.fill('[aria-label="Decision log"] textarea', "Validated customer evidence")
            self.click_in('[aria-label="Decision log"]', "Record decision")
            self.has("Validated customer evidence")
            self.close("Close decision log")
        self.check("Decision log rationale", decision)

        def prioritization():
            self.open_command("prioritization", "Open Prioritization Lab", "Prioritization lab")
            changed = b.evaluate("""(() => {const controls=[...document.querySelectorAll('[aria-label="Prioritization lab"] form select')]; if(controls.length!==4)return false; [[controls[1],'5'],[controls[2],'4'],[controls[3],'2']].forEach(([el,value])=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))});return true})()""")
            self.assert_(changed, "Scoring controls missing")
            self.click_in('[aria-label="Prioritization lab"]', "Save score")
            self.has("10.0")
            self.close("Close prioritization lab")
        self.check("Impact-confidence-effort scoring", prioritization)

        def goal():
            self.open_command("goals", "Open Goals Hub", "Goals hub")
            self.fill('input[placeholder="Goal or outcome…"]', "QA Outcome")
            self.fill('[aria-label="Goal deadline"]', "2026-12-31")
            self.click_in('[aria-label="Goals hub"]', "Create goal")
            self.has("QA Outcome")
            self.click('[aria-label="Goals hub"] aside input[type="checkbox"]')
            self.has("1 linked")
            self.close("Close goals hub")
        self.check("Goal creation and key-result linking", goal)

        def sprint():
            self.open_command("sprint", "Open Sprint Planner", "Sprint planner")
            self.fill('input[placeholder="Sprint name…"]', "QA Sprint")
            self.click_in('[aria-label="Sprint planner"]', "Create sprint")
            self.has("QA Sprint")
            self.click('[aria-label="Sprint planner"] aside input[type="checkbox"]')
            b.pause()
            estimate = '[aria-label="Sprint planner"] aside select:not([disabled])'
            self.assert_(b.choose(estimate, "5"), "Estimate control unavailable")
            self.has("5/")
            self.close("Close sprint planner")
        self.check("Sprint creation, assignment, and estimate", sprint)

        def risk():
            self.open_command("risk", "Open Risk Register", "Risk register")
            form_selects = b.evaluate("[...document.querySelectorAll('[aria-label=\"Risk register\"] form select')].length")
            self.assert_(form_selects == 4, "Risk scoring controls missing")
            b.evaluate("""(() => {const controls=[...document.querySelectorAll('[aria-label="Risk register"] form select')]; [[controls[1],'5'],[controls[2],'5']].forEach(([el,value])=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))})})()""")
            self.fill('[aria-label="Risk register"] textarea', "Fallback and staged rollout")
            self.click_in('[aria-label="Risk register"]', "Save risk")
            self.has("Fallback and staged rollout")
            self.has("1 critical")
            self.close("Close risk register")
            self.assert_(b.count('[title="Risk exposure 25"]') >= 1, "Canvas risk warning missing")
        self.check("Risk scoring, heat map, and canvas warning", risk)

        def version_history():
            self.click('[aria-label="Local version history"]')
            b.wait_for("!!document.querySelector('[aria-label=\"Local version history\"]')")
            self.fill('aside[aria-label="Local version history"] input', "QA Milestone")
            self.click_in('aside[aria-label="Local version history"]', "Save")
            b.pause(0.3)
            self.has("QA Milestone")
            self.close("Close version history")
        self.check("Pinned local history milestone", version_history)

        def presentation():
            self.click('[aria-label="Present board"]')
            self.has("Exit")
            self.click_in("body", "Exit")
            self.assert_("Exit" not in b.text(), "Presentation did not exit")
        self.check("Presentation mode enter and exit", presentation)

        def persistence():
            time.sleep(0.8)
            board_url = b.evaluate("location.href")
            b.call("Page.reload", {"ignoreCache": True})
            b.wait_ready()
            b.wait_for("!!document.querySelector('input[aria-label=\"Board title\"]')")
            self.assert_(b.evaluate("location.href") == board_url, "Reload left the board route")
            b.wait_for("document.body.innerText.includes('Validated Plan')")
            self.has("CSV QA")
        self.check("IndexedDB save and reload persistence", persistence)

        return self.results


if __name__ == "__main__":
    suite = Features()
    try:
        results = suite.run()
        print(json.dumps(results, indent=2))
        failed = [item for item in results if item["status"] == "FAIL"]
        print(json.dumps({"passed": len(results)-len(failed), "failed": len(failed)}, indent=2))
        raise SystemExit(1 if failed else 0)
    finally:
        suite.b.close()
