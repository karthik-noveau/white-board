// Layout coordinates include the visual viewport offset when the keyboard pans
// the page. Keep every menu inside the part of the screen the user can see.
export function floatingMenuBounds(anchor, viewport, preferred = {}) {
  const margin = 8, gap = 8;
  const width = Math.min(preferred.width || 320, Math.max(0, viewport.width - margin * 2));
  const maxHeight = Math.min(preferred.height || 420, Math.max(0, viewport.height - margin * 2));
  const left = Math.max(viewport.left + margin, Math.min(anchor.left, viewport.left + viewport.width - width - margin));
  const below = Math.max(viewport.top + margin, (anchor.bottom ?? anchor.top) + gap);
  const top = below + maxHeight <= viewport.top + viewport.height - margin ? below
    : Math.max(viewport.top + margin, Math.min(anchor.top - maxHeight - gap, viewport.top + viewport.height - maxHeight - margin));
  return { left, top, width, maxHeight };
}

export function visibleViewport() {
  const viewport = window.visualViewport;
  return {
    left: viewport?.offsetLeft || 0, top: viewport?.offsetTop || 0,
    width: viewport?.width || window.innerWidth,
    height: viewport?.height || window.innerHeight,
  };
}
