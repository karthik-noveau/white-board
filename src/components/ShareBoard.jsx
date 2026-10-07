import { brand } from "../lib/brand";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createShareUrl, isLocalShareUrl } from "../lib/boardShare";
import Icon from "./BoardIcon";
import styles from "../styles/shareBoard.module.css";

export default function ShareBoard({ project, onClose, onBackup }) {
  const [access, setAccess] = useState("editable"), [result, setResult] = useState(null);
  const [options, setOptions] = useState({ includeHidden: false, includeSavedViews: false });
  const [copiedUrl, setCopiedUrl] = useState(""), [copyError, setCopyError] = useState("");
  const dialogRef = useRef(null), inputRef = useRef(null);
  const current = result?.access === access && result.project === project && result.options === options ? result : null;
  const url = current?.url || "", error = current?.error || "", copied = Boolean(url && copiedUrl === url);

  useLayoutEffect(() => {
    const dialog = dialogRef.current, previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    createShareUrl(project, import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin, { access, ...options })
      .then(link => { if (!cancelled) setResult({ project, access, options, url: link }); })
      .catch(failure => { if (!cancelled) setResult({ project, access, options, error: failure.message || "Could not create a share link." }); });
    return () => { cancelled = true; };
  }, [project, access, options]);

  const copy = async () => {
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
    } catch {
      if (inputRef.current?.value !== url) return;
      inputRef.current?.focus();
      inputRef.current?.select();
      let success = false;
      try { success = document.execCommand("copy"); } catch { /* The selected link remains available for manual copying. */ }
      if (success) setCopiedUrl(url);
      else setCopyError("Select the link and copy it manually.");
    }
  };

  const extraCount = Number(options.includeHidden) + Number(options.includeSavedViews);

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="share-title"
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <header className={styles.header}>
      <span className={styles.headerIcon}><Icon name="share" size={21}/></span>
      <div><h2 id="share-title">Share board</h2><p title={project.title}>{project.title || "Untitled mind map"}</p></div>
      <button onClick={onClose} aria-label="Close share dialog"><Icon name="close" size={19}/></button>
    </header>
    <div className={styles.body}>
      <fieldset className={styles.accessOptions}>
        <legend>Link access</legend>
        <div className={styles.accessGrid}>
          {[["readonly", "Read-only", "View the board and comments.", "eye"], ["editable", "Editable", "Edit a separate copy on their device.", "pencil"]].map(([value, label, description, icon]) => <label key={value} className={styles.accessOption}>
            <input type="radio" name="share-access" value={value} aria-label={label} aria-describedby={`share-access-${value}`} checked={access === value} onChange={() => { setAccess(value); setCopyError(""); }}/>
            <span className={styles.accessIcon}><Icon name={icon} size={20}/></span>
            <span className={styles.accessCopy}><b>{label}</b><span id={`share-access-${value}`}>{description}</span></span>
            <span className={styles.accessCheck} aria-hidden="true"><Icon name="check" size={12}/></span>
          </label>)}
        </div>
      </fieldset>
      <details className={styles.extraOptions}>
        <summary><span>Include extra content</span><span className={styles.optionSummary}>{extraCount ? `${extraCount} selected` : "Optional"}<Icon name="chevron" size={15}/></span></summary>
        <fieldset className={styles.contentOptions}>
          <legend className={styles.srOnly}>Include in this link</legend>
          {[["includeHidden", "Hidden cards and frames", "Includes hidden cards and content inside hidden frames."], ["includeSavedViews", "Saved views and snapshots", "Includes earlier board content from your saved views."]].map(([key, label, description]) => <label key={key}>
            <input type="checkbox" checked={options[key]} aria-label={label} aria-describedby={`share-${key}`} onChange={event => { setOptions(current => ({ ...current, [key]: event.target.checked })); setCopyError(""); }}/>
            <span>{label}<small id={`share-${key}`}>{description}</small></span>
          </label>)}
        </fieldset>
      </details>
      <p className={styles.privacyNote}><Icon name="lock" size={13}/>Private presenter notes are always excluded.</p>
    </div>
    <footer className={styles.footer}>
      {error ? <>
        <p className={styles.error} role="alert">{error}</p>
        <button className={styles.backupButton} onClick={onBackup}><Icon name="download" size={15}/>Save backup</button>
      </> : <>
        <label className={styles.linkLabel} htmlFor="share-url">Board link</label>
        <div className={styles.linkRow}>
          <input ref={inputRef} id="share-url" aria-describedby="share-link-hint" readOnly value={url} placeholder="Preparing link…" onFocus={event => event.target.select()}/>
          <button onClick={copy} disabled={!url}><Icon name={copied ? "check" : "duplicate"} size={15}/>{copied ? "Copied" : "Copy link"}</button>
        </div>
        <p id="share-link-hint" className={styles.linkHint}>{access === "readonly" ? "Read-only snapshot." : "Each person gets an editable copy."} Collapsed branches can be expanded. Later edits need a new link.</p>
        {url && isLocalShareUrl(url) && <p className={styles.notice}><Icon name="saveError" size={15}/><span>This is a local address. Host {brand.name} publicly to share across devices.</span></p>}
        <span className={copyError ? styles.copyError : styles.srOnly} role="status">{copied ? "Link copied" : copyError}</span>
      </>}
    </footer>
  </dialog>;
}
