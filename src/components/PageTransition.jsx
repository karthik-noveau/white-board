import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router";
import { playTransition } from "../lib/motion";

export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  const ref = useRef(null);
  useLayoutEffect(() => {
    const transition = playTransition(ref.current, { kind: "page" });
    transition.finished.then(transition.cancel);
    return transition.cancel;
  }, [pathname]);
  return <div ref={ref} className="pageView">{children}</div>;
}
