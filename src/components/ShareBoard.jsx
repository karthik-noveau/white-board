import { brand } from "../lib/brand";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createShareUrl, isLocalShareUrl } from "../lib/boardShare";
import Icon from "./BoardIcon";
import styles from "../styles/shareBoard.module.css";

export default function ShareBoard({ project, onClose, onBackup }) {
  const [access, setAccess] = useState("editable"), [result, setResult] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(""), [copyError, setCopyError] = useState("");
  const dialogRef = useRef(null), inputRef = useRef(null);
  const current = result?.access === access && result.project === project ? result : null;
  const url = current?.url || "", error = current?.error || "", copied = Boolean(url && copiedUrl === url);

  useLayoutEffect(() => {
    const dialog = dialogRef.current, previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    createShareUrl(project, import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin, { access })
      .then(link => { if (!cancelled) setResult({ project, access, url: link }); })
      .catch(failure => { if (!cancelled) setResult({ project, access, error: failure.message || "Could not create a share link." }); });
    return () => { cancelled = true; };
  }, [project, access]);

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

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="share-title"
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <header><h2 id="share-title">Share board</h2><button onClick={onClose} aria-label="Close share dialog">×</button></header>
    <div className={styles.body}>
      <p>Choose how people can open this board.</p>
      <fieldset className={styles.accessOptions}>
        <legend>Link access</legend>
        {[["readonly", "Read-only", "View the board and comments.", "eye"], ["editable", "Editable", "Edit a separate copy on their device.", "pencil"]].map(([value, label, description, icon]) => <label key={value} className={styles.accessOption}>
          <input type="radio" name="share-access" value={value} aria-label={label} aria-describedby={`share-access-${value}`} checked={access === value} onChange={() => { setAccess(value); setCopyError(""); }}/>
          <span className={styles.accessIcon}><Icon name={icon} size={18}/></span>
          <span className={styles.accessCopy}><b>{label}</b><span id={`share-access-${value}`}>{description}</span></span>
          <span className={styles.accessCheck} aria-hidden="true"><Icon name="check" size={13}/></span>
        </label>)}
      </fieldset>
      {error ? <p className={styles.error} role="alert">{error}</p> : <>
        <label htmlFor="share-url">Board link</label>
        <div className={styles.linkRow}>
          <input ref={inputRef} id="share-url" readOnly value={url} placeholder="Preparing link…" onFocus={event => event.target.select()}/>
          <button onClick={copy} disabled={!url}><Icon name="duplicate" size={15}/>{copied ? "Copied" : "Copy link"}</button>
        </div>
        <small>{access === "readonly" ? "Opens in a read-only viewer." : "Each person gets their own editable copy."} Includes the entire board. Later edits need a new link.</small>
        {url && isLocalShareUrl(url) && <p className={styles.notice}>This is a local address. Host {brand.name} publicly to share across devices.</p>}
        <span className={styles.status} role="status">{copied ? "Link copied" : copyError}</span>
      </>}
    </div>
    {error && <footer><button onClick={onBackup}><Icon name="download" size={15}/>Save backup</button></footer>}
  </dialog>;
}
