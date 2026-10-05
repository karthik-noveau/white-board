import { useLayoutEffect, useRef } from "react";
import styles from "../styles/styleScopePicker.module.css";
import BoardIcon from "./BoardIcon";

export default function StyleScopePicker({ value, onChange, selectionCount, cardCount, lineCount, branchCount, onChoose, onDismiss }) {
  const pickerRef = useRef(null);
  useLayoutEffect(() => {
    const picker = pickerRef.current;
    const indicator = picker.querySelector("[data-scope-indicator]");
    const updateIndicator = () => {
      const active = picker.querySelector('[aria-pressed="true"]');
      if (!active) return;
      Object.assign(indicator.style, {
        left: `${active.offsetLeft}px`, top: `${active.offsetTop}px`,
        width: `${active.offsetWidth}px`, height: `${active.offsetHeight}px`,
      });
    };
    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(picker);
    picker.querySelectorAll("button").forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [value, selectionCount, branchCount]);
  const choices = [
    ["selection", selectionCount > 1 ? "Selected cards" : "Selected card", `${selectionCount} ${selectionCount === 1 ? "card" : "cards"}`, selectionCount > 1 ? "Apply styles to the selected cards only." : "Apply styles to the selected card only."],
    ["branch", branchCount > 1 ? "Entire branches" : "Entire branch", `${cardCount} ${cardCount === 1 ? "card" : "cards"} · ${lineCount} ${lineCount === 1 ? "line" : "lines"}`, "Change all connected cards and lines."],
  ];
  const choose = next => {
    onChoose?.();
    onChange(next);
  };

  return <div ref={pickerRef} className={styles.picker} role="group" aria-label="Apply styles to">
    <span className={styles.indicator} data-scope-indicator aria-hidden="true"/>
    {choices.map(([key, label, count, description]) => <button key={key} type="button" data-style-scope={key} data-scope-control={`scope-${key}`} className={styles.option}
      aria-pressed={value === key} aria-label={`${label}: ${count}`} title={`${count} · ${description}`} onClick={() => choose(key)}>
      <BoardIcon name={key === "selection" ? "cursor" : "branchScope"} size={18}/>
      <span>{label}</span>
    </button>)}
    {onDismiss && <button type="button" className={styles.dismiss} aria-label="Deselect cards" onClick={onDismiss}><BoardIcon name="close" size={18}/></button>}
  </div>;
}

export function StyleScopeSummary({ value, selectionCount, cardCount, lineCount, message, hidden }) {
  if (hidden) return null;
  const count = value === "branch" ? cardCount : selectionCount;
  const summary = value === "branch"
    ? `${count} connected ${count === 1 ? "card" : "cards"} · ${lineCount} ${lineCount === 1 ? "line" : "lines"}`
    : `${count} selected ${count === 1 ? "card" : "cards"}`;
  return <p className={message ? styles.notice : styles.summary} role="status">{message || summary}</p>;
}
