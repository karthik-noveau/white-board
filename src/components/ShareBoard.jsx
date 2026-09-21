import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createShareUrl, isLocalShareUrl } from "../lib/boardShare";
import Icon from "./BoardIcon";
import styles from "../styles/shareBoard.module.css";

export default function ShareBoard({ project, onClose, onBackup }) {
  const [url, setUrl] = useState(""), [error, setError] = useState("");
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState("");
  const dialogRef = useRef(null), inputRef = useRef(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current, previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    createShareUrl(project, import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin)
      .then(link => { if (!cancelled) setUrl(link); })
      .catch(failure => { if (!cancelled) setError(failure.message || "Could not create a share link."); });
    return () => { cancelled = true; };
  }, [project]);

  const copy = async () => {
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      let success = false;
      try { success = document.execCommand("copy"); } catch { /* The selected link remains available for manual copying. */ }
      if (success) setCopied(true);
      else setCopyError("Select the link and copy it manually.");
    }
  };

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="share-title"
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <header><h2 id="share-title">Share board</h2><button onClick={onClose} aria-label="Close share dialog">×</button></header>
    <div className={styles.body}>
      <p>Anyone with this link can open an editable copy.</p>
      {error ? <p className={styles.error} role="alert">{error}</p> : <>
        <label htmlFor="share-url">Board link</label>
        <div className={styles.linkRow}>
          <input ref={inputRef} id="share-url" readOnly value={url} placeholder="Preparing link…" onFocus={event => event.target.select()}/>
          <button onClick={copy} disabled={!url}><Icon name="duplicate" size={15}/>{copied ? "Copied" : "Copy link"}</button>
        </div>
        <small>Includes the entire board. Later edits need a new link.</small>
        {url && isLocalShareUrl(url) && <p className={styles.notice}>This is a local address. Host Nova publicly to share across devices.</p>}
        <span className={styles.status} role="status">{copied ? "Link copied" : copyError}</span>
      </>}
    </div>
    {error && <footer><button onClick={onBackup}><Icon name="download" size={15}/>Save backup</button></footer>}
  </dialog>;
}
