const easing = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/** Capture the visible positions before replacing a toolbar's scope. */
export function captureToolbarLayout(toolbar) {
  const background = toolbar?.querySelector("[data-scope-background]");
  if (!background || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const controls = new Map();
  for (const element of toolbar.querySelectorAll("[data-style-scope]")) {
    const style = window.getComputedStyle(element);
    controls.set(element.dataset.scopeControl, {
      rect: element.getBoundingClientRect(),
      color: style.color,
      backgroundColor: style.backgroundColor,
    });
  }
  return {
    rect: background.getBoundingClientRect(), controls,
    indicator: toolbar.querySelector("[data-scope-indicator]")?.getBoundingClientRect(),
  };
}

/** Keep the outgoing tools visible until their exit has actually finished. */
export function playToolbarExit(toolbar, direction) {
  const actions = toolbar?.querySelector("[data-scope-actions]");
  const viewport = actions?.parentElement;
  let animation;
  const wasInert = actions?.inert;
  if (actions?.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const current = window.getComputedStyle(actions);
    actions.inert = true;
    viewport.dataset.scopeMotion = "exit";
    animation = actions.animate({
      opacity: [current.opacity, 0],
      translate: [current.translate === "none" ? "0 0" : current.translate, `${-direction * 48}px 0`],
    }, { duration: 140, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" });
  }
  return {
    finished: Promise.allSettled(animation ? [animation.finished] : []),
    cancel: () => {
      animation?.cancel();
      if (actions) actions.inert = wasInert;
      if (viewport?.dataset.scopeMotion === "exit") delete viewport.dataset.scopeMotion;
    },
  };
}

/** Slide a complete replacement row in; keep the scope switch visible. */
export function playToolbarSwitch(toolbar, previous) {
  const animations = [];
  const background = toolbar?.querySelector("[data-scope-background]");
  const actions = toolbar?.querySelector("[data-scope-actions]");
  const viewport = actions?.parentElement;
  const releaseViewport = () => {
    if (viewport?.dataset.scopeMotion === "enter") delete viewport.dataset.scopeMotion;
  };
  if (previous && background?.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const options = { duration: 280, easing };
    const rect = background.getBoundingClientRect();
    animations.push(background.animate({
      width: [`${previous.rect.width}px`, `${rect.width}px`],
      height: [`${previous.rect.height}px`, `${rect.height}px`],
      translate: [`${previous.rect.left - rect.left}px ${previous.rect.top - rect.top}px`, "0 0"],
    }, options));
    const indicator = toolbar.querySelector("[data-scope-indicator]");
    if (indicator && previous.indicator) {
      const target = indicator.getBoundingClientRect();
      animations.push(indicator.animate({
        width: [`${previous.indicator.width}px`, `${target.width}px`],
        height: [`${previous.indicator.height}px`, `${target.height}px`],
        translate: [`${previous.indicator.left - target.left}px ${previous.indicator.top - target.top}px`, "0 0"],
      }, { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }));
    }
    const direction = toolbar.querySelector('[data-style-scope="branch"][aria-pressed="true"]') ? 1 : -1;
    if (actions) {
      viewport.dataset.scopeMotion = "enter";
      animations.push(actions.animate({
        opacity: [0, 1], translate: [`${direction * 48}px 0`, "0 0"],
      }, options));
    }
    for (const element of toolbar.querySelectorAll("[data-style-scope]")) {
      const before = previous.controls.get(element.dataset.scopeControl);
      if (before) {
        const after = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        animations.push(element.animate({
          translate: [`${before.rect.left - after.left}px ${before.rect.top - after.top}px`, "0 0"],
          color: [before.color, style.color],
          backgroundColor: [before.backgroundColor, style.backgroundColor],
        }, options));
      }
    }
  }
  const finished = Promise.allSettled(animations.map(animation => animation.finished));
  finished.then(releaseViewport);
  return {
    finished,
    cancel: () => { animations.forEach(animation => animation.cancel()); releaseViewport(); },
  };
}

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
