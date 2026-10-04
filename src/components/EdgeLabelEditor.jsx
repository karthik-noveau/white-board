import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import styles from "../styles/edgeLabelEditor.module.css";

export default function EdgeLabelEditor({ value, point, scale, width, onChange, onSave, onCancel, onReturnFocus }) {
  const input = useRef(null), finished = useRef(false);
  const finish = useCallback((save, restoreFocus = false) => {
    if (finished.current) return;
    finished.current = true;
    if (save) onSave(input.current.value.trim());
    else onCancel();
    if (restoreFocus) onReturnFocus();
  }, [onSave, onCancel, onReturnFocus]);

  useLayoutEffect(() => {
    input.current.focus({ preventScroll: true });
    input.current.select();
  }, []);
  useEffect(() => {
    const outside = event => { if (event.target !== input.current) finish(true); };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [finish]);

  return <input ref={input} className={styles.editor} aria-label="Connection label"
    title="Enter to save · Escape to cancel" placeholder="Add a label…" value={value}
    style={{ left: point.x, top: point.y, width, transform: `translate(-50%, -50%) scale(${scale})`,
      height: 22, minHeight: 22, font: '600 9px/22px "DM Sans", sans-serif' }}
    onChange={event => onChange(event.target.value)} onBlur={() => finish(true)}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onDoubleClick={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault(); finish(event.key === "Enter", true);
      }
    }}/>;
}
