export const BOARD_TOUR_KEY = "nova-board-tour-v1";

// Keep the decision for this session even when browser storage is unavailable.
export function createTourPreference(getStorage) {
  let dismissed = false;
  return {
    shouldShow() {
      if (dismissed) return false;
      try {
        return !["completed", "skipped"].includes(getStorage().getItem(BOARD_TOUR_KEY));
      } catch {
        return true;
      }
    },
    dismiss(status) {
      dismissed = true;
      try {
        getStorage().setItem(BOARD_TOUR_KEY, status);
      } catch {
        // The tour remains dismissed for this session.
      }
    },
  };
}

export const boardTourPreference = createTourPreference(() => window.localStorage);

export function placeTourCard(target, viewport, card) {
  const margin = 12, gap = 16;
  const width = Math.min(card.width, viewport.width - margin * 2);
  const height = Math.min(card.height, viewport.height - margin * 2);
  const clampX = value => Math.max(margin, Math.min(value, viewport.width - width - margin));
  const clampY = value => Math.max(margin, Math.min(value, viewport.height - height - margin));
  const centered = { left: clampX((viewport.width - width) / 2), top: clampY((viewport.height - height) / 2), spotlight: null };
  if (!target || target.width <= 0 || target.height <= 0) return centered;

  const left = Math.max(4, target.left - 6), top = Math.max(4, target.top - 6);
  const right = Math.min(viewport.width - 4, target.left + target.width + 6);
  const bottom = Math.min(viewport.height - 4, target.top + target.height + 6);
  if (right <= left || bottom <= top) return centered;
  const spotlight = { left, top, width: right - left, height: bottom - top };
  const alignedX = clampX((left + right - width) / 2);
  const alignedY = clampY((top + bottom - height) / 2);
  if (bottom + gap + height <= viewport.height - margin) return { left: alignedX, top: bottom + gap, spotlight };
  if (top - gap - height >= margin) return { left: alignedX, top: top - gap - height, spotlight };
  if (right + gap + width <= viewport.width - margin) return { left: right + gap, top: alignedY, spotlight };
  if (left - gap - width >= margin) return { left: left - gap - width, top: alignedY, spotlight };
  // On very short screens, keep the explanation readable without covering a highlight.
  return centered;
}
