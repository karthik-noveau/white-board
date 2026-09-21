import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "./BoardIcon";
import { exportDimensions } from "../lib/boardExport";
import styles from "../styles/exportStudio.module.css";

const formats = [["png", "PNG", "Image"], ["pdf", "PDF", "Document"], ["svg", "SVG", "Vector"]];
const qualities = {
  standard: { label: "Standard", scale: 2 },
  high: { label: "High", scale: 4 },
  ultra: { label: "Ultra", scale: 8 },
};

export default function ExportStudio({ selectedCount, onPrepare, onExport, onClose }) {
  const [format, setFormat] = useState("png"), [selectionOnly, setSelectionOnly] = useState(Boolean(selectedCount));
  const [quality, setQuality] = useState("high");
  const [preview, setPreview] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [busy, setBusy] = useState(null);
  const dialogRef = useRef(null), exporting = useRef(false);
  const scope = selectionOnly && selectedCount ? "selection" : "board";
  const { scale } = qualities[quality];
  const options = { format, scope, background: "white", scale, dpi: 600, paper: "a4" };
  const dimensions = format === "png" && preview?.prepared ? exportDimensions(preview.prepared, options) : null;
  const qualityHint = dimensions?.limited ? "For full detail, choose SVG." : dimensions ? `${dimensions.width} × ${dimensions.height} px` : `${scale}× resolution`;

  useLayoutEffect(() => {
    const dialog = dialogRef.current, previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    let cancelled = false, url;
    setLoading(true); setError("");
    onPrepare({ scope, background: "white" }).then(prepared => {
      if (cancelled) return;
      url = prepared ? URL.createObjectURL(new Blob([prepared.svg], { type: "image/svg+xml" })) : null;
      setPreview({ prepared, url });
    }).catch(() => { if (!cancelled) { setPreview(null); setError("Could not load the preview. Reopen Export to retry."); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [onPrepare, scope]);

  const download = async (requestedFormat = format) => {
    if (exporting.current || (requestedFormat !== "nova" && (!preview?.prepared || loading))) return;
    exporting.current = true; setBusy(requestedFormat); setError("");
    try { await onExport({ ...options, format: requestedFormat }, preview?.prepared); onClose(); }
    catch (failure) { setError(failure.message || "Export failed. Try SVG or save a backup."); }
    finally { exporting.current = false; setBusy(null); }
  };

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="export-title" aria-busy={Boolean(busy)}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <header className={styles.header}><h2 id="export-title">Export board</h2><button className={styles.close} onClick={onClose} disabled={Boolean(busy)} aria-label="Close export studio">×</button></header>
    <div className={styles.body}>
      <div className={styles.preview}>
        {loading ? <span>Preparing preview…</span> : preview?.url ? <img src={preview.url} alt="Board export preview"/> : <span>No visible shapes</span>}
      </div>
      <fieldset className={styles.formats} disabled={Boolean(busy)}><legend>Format</legend>
        {formats.map(([value, label, description]) => <button key={value} aria-pressed={format === value} onClick={() => { setFormat(value); setError(""); }}><b>{label}</b><small>{description}</small></button>)}
      </fieldset>
      {format === "png" && <div className={styles.qualitySelect}>
        <div className={styles.qualityLabel}>
          <label htmlFor="export-quality">Quality</label>
          <p id="export-quality-hint" className={styles.quality} aria-live="polite">{qualityHint}</p>
        </div>
        <select id="export-quality" aria-describedby="export-quality-hint" value={quality} disabled={Boolean(busy)} onChange={event => { setQuality(event.target.value); setError(""); }}>
          {Object.entries(qualities).map(([value, preset]) => <option key={value} value={value}>{preset.label}</option>)}
        </select>
      </div>}
      {format === "svg" && <p className={styles.quality}>Sharp at any size</p>}
      {selectedCount > 0 && <label className={styles.selection}><input type="checkbox" checked={selectionOnly} disabled={Boolean(busy)} onChange={event => setSelectionOnly(event.target.checked)}/>Selected shapes only</label>}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <footer className={styles.footer}>
      <button className={styles.backup} disabled={Boolean(busy)} onClick={() => download("nova")} title="Save the full board as an editable .nova file">{busy === "nova" ? "Saving…" : "Save backup"}</button>
      <button className={styles.download} disabled={Boolean(busy) || loading || !preview?.prepared} onClick={() => download()}><Icon name="download" size={16}/>{busy && busy !== "nova" ? "Exporting…" : `Export ${format.toUpperCase()}`}</button>
    </footer>
  </dialog>;
}
