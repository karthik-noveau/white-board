import { useLayoutEffect } from 'react';
import { floatingMenuBounds, visibleViewport } from './floatingMenu';

export default function useFloatingMenu(ref, anchor, width = 320, height = 420) {
  useLayoutEffect(() => {
    const update = () => {
      const menu = ref.current;
      if (!menu) return;
      const rect = anchor?.element?.getBoundingClientRect() || anchor || { left: 16, top: 64, bottom: 64 };
      const viewport = visibleViewport();
      menu.style.width = `${Math.min(width, viewport.width - 16)}px`;
      menu.style.maxHeight = `${height}px`;
      const measuredHeight = Math.min(height, menu.getBoundingClientRect().height);
      const bounds = floatingMenuBounds(rect, viewport, { width, height: measuredHeight });
      Object.assign(menu.style, Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, `${value}px`])));
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [anchor, ref, width, height]);
}
