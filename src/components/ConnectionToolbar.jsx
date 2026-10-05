import { useCallback, useEffect, useId, useRef, useState } from "react";
import Icon from "./BoardIcon";
import BoardStyleIcon from "./BoardStyleIcon";
import MotionPresence from "./MotionPresence";
import { navigateToolbar } from "../lib/boardKeyboard";
import styles from "../styles/connectionToolbar.module.css";

const sections = [
  ["label", "Label", "Connection label"],
  ["structure", "Line", "Line path"],
  ["pattern", "Line style", "Line style"],
  ["weight", "Weight", "Line weight"],
];
const lineOptions = {
  structure: [["curve", "Curve"], ["straight", "Straight"], ["elbow", "Elbow"]],
  pattern: [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]],
  weight: [["thin", "Thin"], ["regular", "Regular"], ["bold", "Bold"]],
};

function SettingIcon({ section, value }) {
  if (section === "label") return <Icon name="connectionLabel" size={20}/>;
  if (value && section !== "structure") return <span className={styles.lineSample} style={{
    "--sample-pattern": section === "pattern" ? value : "solid",
    "--sample-weight": `${section === "weight" ? { thin: 1, regular: 2, bold: 4 }[value] : 2}px`,
  }}/>;
  return <BoardStyleIcon name={section} lineType={value}/>;
}

export default function ConnectionToolbar({ className, edge, defaults, onChange, onEditLabel, labelEditing, labelDisabled, onDelete, onDismiss }) {
  const [section, setSection] = useState(null);
  const [popoverLeft, setPopoverLeft] = useState(0);
  const dockRef = useRef(null);
  const triggerRefs = useRef({});
  const popoverId = useId();

  const close = useCallback((restoreFocus = false) => {
    setSection(null);
    if (restoreFocus) triggerRefs.current[section]?.focus({ preventScroll: true });
  }, [section]);

  useEffect(() => {
    if (!section) return;
    const onOutside = event => {
      if (!dockRef.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [close, section]);

  const toggle = (value, button) => {
    if (section === value) { close(); return; }
    if (value === "label") { setSection(null); onEditLabel(); return; }
    const dock = dockRef.current.getBoundingClientRect();
    const trigger = button.getBoundingClientRect();
    setPopoverLeft(Math.max(0, Math.min(trigger.left - dock.left + trigger.width / 2 - 148, dock.width - 296)));
    setSection(value);
  };

  const choose = value => {
    if (value !== selected) onChange(section, value);
    close(true);
  };

  const onKeyDown = event => {
    if (event.key === "Escape" && section) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.target.closest("[data-connection-options]") && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      const buttons = [...event.currentTarget.querySelectorAll("[data-connection-options] button")];
      const index = buttons.indexOf(event.target);
      event.preventDefault();
      buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    } else navigateToolbar(event);
  };

  const title = sections.find(([key]) => key === section)?.[2];
  const options = lineOptions[section];
  const selected = edge[section] || defaults[section] || options?.[0][0];
  const scopeId = `${popoverId}-scope`;

  return <div ref={dockRef} className={`${styles.dock} ${className || ""}`} onKeyDown={onKeyDown}
    onBlur={event => {
      if (section && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close();
    }}>
    {onDismiss && <div className={styles.mobileHeader}><span>Selected line</span><button type="button" aria-label="Deselect connection" onClick={onDismiss}><Icon name="close" size={18}/></button></div>}
    <div className={styles.rail} role="toolbar" aria-label="Selected line settings" aria-describedby={scopeId} data-keyboard-toolbar>
      <span id={scopeId} className={styles.scope} title="Changes apply only to the selected line">Selected line</span>
      <span className={styles.separator} aria-hidden="true"/>
      {sections.map(([value, label, heading]) => <button key={value} type="button"
        ref={element => { triggerRefs.current[value] = element; }}
        className={(section === value || (value === "label" && labelEditing)) ? styles.active : undefined}
        aria-label={heading} disabled={value === "label" && labelDisabled}
        aria-expanded={value === "label" ? undefined : section === value} aria-haspopup={value === "label" ? undefined : "dialog"}
        aria-controls={section === value ? popoverId : undefined}
        title={value === "label" ? `${edge.label ? "Edit" : "Add"} label on the selected line` : `${heading} · selected line only`}
        onClick={event => toggle(value, event.currentTarget)}
        onKeyDown={event => {
          if (event.key === "ArrowDown") { event.preventDefault(); toggle(value, event.currentTarget); }
        }}>
        <SettingIcon section={value}/><span>{label}</span>
      </button>)}
      <span className={styles.separator} aria-hidden="true"/>
      <button type="button" className={styles.deleteButton} onClick={onDelete} aria-label="Delete connection" title="Delete connection">
        <Icon name="trash" size={18}/>
      </button>
    </div>
    <MotionPresence key={section || "closed"} present={Boolean(section)} kind="menu"
      focusSelector='[aria-pressed="true"]'>
      <div id={popoverId} className={styles.popover} style={{ left: popoverLeft }} role="dialog" aria-label={title}>
        <div className={styles.heading}><span>{title}</span><small>Selected line only</small></div>
        <div className={styles.options} data-connection-options data-keyboard-toolbar>
          {options?.map(([value, label]) => <button key={value} type="button" aria-pressed={selected === value} onClick={() => choose(value)}>
            <SettingIcon section={section} value={value}/><span>{label}</span>
          </button>)}
        </div>
      </div>
    </MotionPresence>
  </div>;
}
