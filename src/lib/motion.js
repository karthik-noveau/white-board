const easing = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/** Animate visual properties only; never replace canvas positioning transforms. */
export function playTransition(element, { entering = true, kind = "panel" } = {}) {
  const animations = [];
  if (element?.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const duration = kind === "page" ? 240 : kind === "menu" ? 140 : entering ? 220 : 160;
    const options = { duration, easing, fill: "both" };
    const surface = kind === "overlay" ? element.firstElementChild : element;
    const fadeOnly = kind === "page" || kind === "fade";
    if (surface !== element) animations.push(element.animate({ opacity: entering ? [0, 1] : [1, 0] }, options));
    if (surface) {
      const offset = kind === "menu" ? "0 -4px" : kind === "drawer" ? "12px 0" : "0 12px";
      animations.push(surface.animate({
        opacity: entering ? [0, 1] : [1, 0],
        ...(!fadeOnly && { translate: entering ? [offset, "0 0"] : ["0 0", offset] }),
      }, options));
    }
  }
  return {
    finished: Promise.allSettled(animations.map(animation => animation.finished)),
    cancel: () => animations.forEach(animation => animation.cancel()),
  };
}
