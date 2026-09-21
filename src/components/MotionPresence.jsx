import { cloneElement, useLayoutEffect, useRef, useState } from "react";
import { playTransition } from "../lib/motion";

/** Keep the last open content mounted until its exit completes. */
export default function MotionPresence({ present, children, kind = "panel", focusSelector }) {
  const [retained, setRetained] = useState(present ? children : null);
  const ref = useRef(null);
  const content = present ? children : retained;
  const mounted = Boolean(content);
  const direct = typeof content?.type === "string" && !content.props.ref;

  useLayoutEffect(() => {
    if (present) setRetained(children);
  }, [present, children]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const element = direct ? ref.current : ref.current?.firstElementChild;
    if (!element) return;
    let cancelled = false;
    element.dataset.motionState = present ? "enter" : "exit";
    element.inert = !present;
    // Focus after reactivating retained content, including a quick close/reopen.
    if (present && focusSelector) element.querySelector(focusSelector)?.focus({ preventScroll: true });
    const transition = playTransition(element, { entering: Boolean(present), kind });
    transition.finished.then(() => {
      if (cancelled) return;
      if (!present) setRetained(null);
      else {
        transition.cancel();
        delete element.dataset.motionState;
      }
    });
    return () => {
      cancelled = true;
      transition.cancel();
      element.inert = false;
      delete element.dataset.motionState;
    };
  }, [present, mounted, direct, kind, focusSelector]);

  if (!content) return null;
  // Preserve direct-child selectors for native menus and popovers.
  return direct ? cloneElement(content, { ref }) : <div ref={ref} className="motionHost">{content}</div>;
}
