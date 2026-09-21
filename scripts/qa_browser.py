#!/usr/bin/env python3
"""Small dependency-free CDP harness for Nova's local browser QA."""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

import websocket


class Browser:
    def __init__(self, port=None, url=None):
        port = port or int(os.environ.get("NOVA_QA_PORT", "9225"))
        url = url or os.environ.get("NOVA_QA_URL", "http://127.0.0.1:5176/")
        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/json/new?{urllib.parse.quote(url)}",
            method="PUT",
        )
        with urllib.request.urlopen(request) as response:
            target = json.load(response)
        self.ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=10)
        self.counter = 0
        self.errors = []
        self.call("Runtime.enable")
        self.call("Page.enable")
        self.call("Log.enable")
        self.wait_ready()

    def close(self):
        self.ws.close()

    def call(self, method, params=None):
        self.counter += 1
        call_id = self.counter
        self.ws.send(json.dumps({"id": call_id, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self.ws.recv())
            event = message.get("method")
            if event == "Runtime.exceptionThrown":
                detail = message["params"]["exceptionDetails"]
                exception = detail.get("exception", {})
                self.errors.append(exception.get("description") or detail.get("text", "Runtime exception"))
            elif event == "Log.entryAdded" and message["params"]["entry"].get("level") == "error":
                entry = message["params"]["entry"]
                self.errors.append(
                    f"{entry.get('text', 'Console error')} at {entry.get('url', '')}:{entry.get('lineNumber', '')}"
                )
            if message.get("id") == call_id:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    def evaluate(self, expression, await_promise=False):
        result = self.call(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": await_promise,
                "userGesture": True,
            },
        )
        if "exceptionDetails" in result:
            detail = result["exceptionDetails"]
            exception = detail.get("exception", {})
            raise RuntimeError(exception.get("description") or detail.get("text", "Evaluation failed"))
        return result.get("result", {}).get("value")

    def wait_ready(self, timeout=10):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                if self.evaluate("document.readyState") == "complete":
                    time.sleep(0.25)
                    return
            except Exception:
                pass
            time.sleep(0.1)
        raise TimeoutError("Page did not become ready")

    def wait_for(self, expression, timeout=5):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.evaluate(expression):
                return
            time.sleep(0.1)
        raise TimeoutError(expression)

    def click_text(self, text, exact=True):
        wanted = json.dumps(text)
        exact_js = "=== wanted" if exact else ".includes(wanted)"
        return self.evaluate(
            f"""(() => {{ const wanted={wanted}; const el=[...document.querySelectorAll('button,a')].find(item=>item.innerText.replace(/\\s+/g,' ').trim(){exact_js}); if(!el)return false; el.click(); return true }})()"""
        )

    def click_aria(self, label):
        selector = f'[aria-label="{label}"]'
        return self.evaluate(
            f"""(() => {{ const el=document.querySelector({json.dumps(selector)}); if(!el)return false; el.click(); return true }})()"""
        )

    def fill(self, selector, value):
        return self.evaluate(
            f"""(() => {{ const el=document.querySelector({json.dumps(selector)}); if(!el)return false; const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,{json.dumps(value)}); el.dispatchEvent(new Event('input',{{bubbles:true}})); el.dispatchEvent(new Event('change',{{bubbles:true}})); return true }})()"""
        )

    def choose(self, selector, value):
        return self.evaluate(
            f"""(() => {{ const el=document.querySelector({json.dumps(selector)}); if(!el)return false; el.value={json.dumps(str(value))}; el.dispatchEvent(new Event('change',{{bubbles:true}})); return true }})()"""
        )

    def text(self):
        return self.evaluate("document.body.innerText") or ""

    def count(self, selector):
        return self.evaluate(f"document.querySelectorAll({json.dumps(selector)}).length")

    def key(self, key, modifiers=0):
        code = key if len(key) > 1 else f"Key{key.upper()}"
        self.call("Input.dispatchKeyEvent", {"type": "keyDown", "key": key, "code": code, "modifiers": modifiers})
        self.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": key, "code": code, "modifiers": modifiers})

    def pause(self, seconds=0.15):
        time.sleep(seconds)

    def mouse_drag(self, start, end, steps=4):
        """Dispatch a real pointer drag so pointer capture and React handlers run."""
        self.call("Input.dispatchMouseEvent", {"type": "mousePressed", "x": start["x"], "y": start["y"], "button": "left", "buttons": 1, "clickCount": 1})
        for step in range(1, steps + 1):
            ratio = step / steps
            self.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": start["x"] + (end["x"] - start["x"]) * ratio, "y": start["y"] + (end["y"] - start["y"]) * ratio, "button": "left", "buttons": 1})
        self.call("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": end["x"], "y": end["y"], "button": "left", "buttons": 0, "clickCount": 1})


def inventory(browser):
    return browser.evaluate(
        """({
          url: location.href,
          title: document.title,
          text: document.body.innerText.slice(0, 3000),
          buttons: [...document.querySelectorAll('button')].map((el, index) => ({index, text: el.innerText.trim(), aria: el.getAttribute('aria-label'), title: el.title})),
          inputs: [...document.querySelectorAll('input, textarea, select')].map((el, index) => ({index, tag: el.tagName, type: el.type, value: el.value, aria: el.getAttribute('aria-label'), placeholder: el.placeholder}))
        })"""
    )


if __name__ == "__main__":
    browser = Browser(int(sys.argv[1]) if len(sys.argv) > 1 else 9225)
    try:
        print(json.dumps(inventory(browser), indent=2))
        print(json.dumps({"runtime_errors": browser.errors}, indent=2))
    finally:
        browser.close()
