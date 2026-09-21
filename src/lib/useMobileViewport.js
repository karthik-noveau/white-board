import { useEffect } from "react";

// Resize the board to the visible area when the mobile keyboard or browser bars move.
// Browser page zoom remains available; it must not be mistaken for a keyboard resize.
export default function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      if (viewport && viewport.scale > 1.05) return;
      const height = viewport?.height || window.innerHeight;
      root.style.setProperty("--app-height", `${height}px`);
      root.style.setProperty("--app-top", `${viewport?.offsetTop || 0}px`);
      root.dataset.keyboard = String(window.innerHeight - height > 150);
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--app-top");
      delete root.dataset.keyboard;
    };
  }, []);
}
