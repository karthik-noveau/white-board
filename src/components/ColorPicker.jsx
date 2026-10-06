import { useEffect, useId, useState } from "react";
import { Button, ColorPicker as AntColorPicker, ConfigProvider, Input } from "antd";
import { colorSwatch, isCustomColor, normalizeHexColor, paletteFor, palettes } from "../lib/boardAppearance";
import styles from "../styles/colorPicker.module.css";

const recentKey = "drawanything-recent-colors-v1";
const pickerTheme = { token: { colorPrimary: "#6436dc", borderRadius: 8, fontFamily: "var(--nova-font-family)", controlHeight: 34, controlHeightSM: 32, motion: false } };
// Escape the canvas and the mobile appearance menu's clipping boundary.
const popupContainer = () => document.body;
const stopPointer = event => event.stopPropagation();
const readRecent = () => {
  try {
    const colors = JSON.parse(localStorage.getItem(recentKey) || "[]");
    return Array.isArray(colors) ? [...new Set(colors.filter(isCustomColor).map(normalizeHexColor))].slice(0, 7) : [];
  } catch { return []; }
};

export default function ColorPicker({ value, onChange, disabled = false, branch = false }) {
  const fieldId = useId();
  const [hex, setHex] = useState(() => normalizeHexColor(value) || paletteFor(value)[0]);
  const [pickerColor, setPickerColor] = useState(hex);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState(readRecent);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const color = normalizeHexColor(value) || paletteFor(value)[0];
    setHex(color);
    setPickerColor(color);
    setInvalid(false);
  }, [value]);
  const normalized = normalizeHexColor(hex);
  const apply = event => {
    event.preventDefault();
    if (disabled) return;
    if (!normalized) { setInvalid(true); return; }
    const colors = [normalized, ...readRecent().filter(color => color !== normalized)].slice(0, 7);
    try { localStorage.setItem(recentKey, JSON.stringify(colors)); } catch { /* Color changes still work when storage is unavailable. */ }
    setRecent(colors);
    setHex(normalized);
    setInvalid(false);
    setOpen(false);
    onChange(normalized);
  };
  const swatch = (color, label) => <Button type="text" key={color} disabled={disabled} className={styles.swatch} aria-pressed={value === color} onClick={() => onChange(color)} aria-label={label} title={label}><i style={{ background: colorSwatch(color) }}/></Button>;
  return <ConfigProvider theme={pickerTheme} getPopupContainer={popupContainer}><div className={styles.picker}>
    <div className={styles.swatches}>{Object.keys(palettes).map(color => swatch(color, `${color}${branch ? " branch" : ""} color`))}</div>
    <form className={styles.custom} onSubmit={apply} onKeyDown={event => { if (event.key !== "Escape") event.stopPropagation(); }}>
      <label htmlFor={fieldId}>Custom color</label>
      <div className={styles.fields}>
        <AntColorPicker value={pickerColor} open={open} onOpenChange={setOpen} disabled={disabled} disabledAlpha mode="single" defaultFormat="hex" placement="bottomLeft" classNames={{ popup: { root: styles.popup } }} getPopupContainer={popupContainer} panelRender={panel => <div data-color-picker-popup data-scope-toolbar onPointerDown={stopPointer} onClick={stopPointer}>{panel}</div>} onChange={color => { setPickerColor(color); setHex(color.toHexString()); setInvalid(false); }}>
          <Button className={styles.colorTrigger} disabled={disabled} aria-label="Choose custom color" aria-expanded={open} title="Choose custom color"><i style={{ background: normalized || "#ffffff" }}/></Button>
        </AntColorPicker>
        <Input id={fieldId} className={styles.hex} aria-label="Hex color" aria-invalid={invalid || undefined} aria-describedby={invalid ? `${fieldId}-error` : undefined} status={invalid ? "error" : undefined} value={hex} placeholder="#7c3aed" disabled={disabled} autoComplete="off" spellCheck={false} maxLength={7} onChange={event => { const color = normalizeHexColor(event.target.value); setHex(event.target.value); if (color) setPickerColor(color); setInvalid(false); }}/>
        <Button className={styles.apply} type="primary" htmlType="submit" disabled={disabled}>Apply</Button>
      </div>
      {invalid && <p className={styles.error} id={`${fieldId}-error`} role="alert">Enter a hex color, like #7C3AED.</p>}
    </form>
    {recent.length > 0 && <div className={styles.recent}><span>Recent colors</span><div className={styles.swatches}>{recent.map(color => swatch(color, `Use ${color}`))}</div></div>}
  </div></ConfigProvider>;
}
