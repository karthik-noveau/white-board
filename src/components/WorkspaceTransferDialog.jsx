import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './BoardIcon';
import { createWorkspaceBackupUrl, readWorkspaceBackupUrl, workspaceBackupSummary, MAX_WORKSPACE_URL_LENGTH } from '../lib/workspaceShare';
import { downloadWorkspaceBackup } from '../lib/localWorkspace';
import { isLocalShareUrl } from '../lib/boardShare';
import styles from '../styles/workspaceTransfer.module.css';

function TransferDialog({ title, description, icon, busy = false, onClose, children }) {
  const ref = useRef(null), id = useId();
  useLayoutEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector('textarea')?.focus();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={ref} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><span className={styles.icon}><Icon name={icon} size={22}/></span><div><h2 id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{description}</p></div><button className={styles.close} type="button" disabled={busy} aria-label="Close workspace transfer" onClick={onClose}><Icon name="close" size={20}/></button></header>
    {children}
  </dialog>, document.body);
}

function BackupSummary({ payload }) {
  const summary = workspaceBackupSummary(payload);
  return <dl className={styles.summary}>{[['projects', 'Projects'], ['trashed', 'In Trash'], ['versions', 'Versions'], ['shapes', 'Saved shapes']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{summary[key]}</dd></div>)}</dl>;
}

export function BackupUrlDialog({ onReadBackup, onClose }) {
  const [payload, setPayload] = useState(null), [url, setUrl] = useState(''), [error, setError] = useState('');
  const [pending, setPending] = useState(true), [copied, setCopied] = useState(false), [copyError, setCopyError] = useState(''), [attempt, setAttempt] = useState(0);
  const input = useRef(null), id = useId();
  useEffect(() => {
    let active = true;
    setPending(true); setError(''); setPayload(null); setUrl(''); setCopied(false); setCopyError('');
    (async () => {
      try {
        const snapshot = await onReadBackup();
        if (!active) return;
        setPayload(snapshot);
        const link = await createWorkspaceBackupUrl(snapshot, import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin);
        if (active) setUrl(link);
      } catch (failure) { if (active) setError(failure.message || 'Could not create the backup URL.'); }
      finally { if (active) setPending(false); }
    })();
    return () => { active = false; };
  }, [onReadBackup, attempt]);
  const copy = async () => {
    setCopyError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url); setCopied(true);
    } catch {
      input.current?.focus(); input.current?.select();
      let success = false;
      try { success = document.execCommand('copy'); } catch { /* Leave the URL selected for manual copying. */ }
      if (success) setCopied(true); else setCopyError('The URL is selected. Copy it manually.');
    }
  };
  return <TransferDialog title="Workspace backup URL" description="Keep a snapshot of your entire workspace." icon="textLink" onClose={onClose}>
    <div className={styles.body}>
      {pending && <p className={styles.status} role="status">Preparing your backup…</p>}
      {payload && <><BackupSummary payload={payload}/><p className={styles.note}>Includes folders, favorites, hidden content, and private notes. Anyone with this URL can restore a copy.</p></>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {url && <><label className={styles.label} htmlFor={id}>Backup URL</label><textarea ref={input} id={id} className={styles.url} rows={3} readOnly value={url} onFocus={event => event.target.select()}/><p className={styles.note}>This link captures your workspace now. Create a new backup after making changes.</p>{isLocalShareUrl(url) && <p className={styles.notice}>This link uses a local address. Use a publicly hosted app to open it on another device, or download the backup file.</p>}</>}
      <p className={copyError ? styles.error : styles.status} role="status">{copyError || (copied ? 'Backup URL copied' : '')}</p>
    </div>
    <footer>{payload ? <button type="button" className={styles.secondary} onClick={() => downloadWorkspaceBackup(payload)}><Icon name="download" size={16}/>Download file</button> : <button type="button" className={styles.secondary} disabled={pending} onClick={() => setAttempt(value => value + 1)}>Try again</button>}<button type="button" className={styles.primary} disabled={!url || pending} onClick={copy}><Icon name={copied ? 'check' : 'duplicate'} size={16}/>{copied ? 'Copied' : 'Copy URL'}</button></footer>
  </TransferDialog>;
}

export function ImportWorkspaceUrlDialog({ initialUrl = '', onImport, onClose }) {
  const [value, setValue] = useState(initialUrl), [payload, setPayload] = useState(null), [error, setError] = useState('');
  const [checking, setChecking] = useState(false), [importing, setImporting] = useState(false);
  const request = useRef(0), importingRef = useRef(false), id = useId();
  const review = useCallback(async url => {
    const revision = ++request.current;
    setChecking(true); setPayload(null); setError('');
    try { const snapshot = await readWorkspaceBackupUrl(url); if (revision === request.current) setPayload(snapshot); }
    catch (failure) { if (revision === request.current) setError(failure.message || 'Could not read this backup URL.'); }
    finally { if (revision === request.current) setChecking(false); }
  }, []);
  useEffect(() => { const sequence = request; if (initialUrl) review(initialUrl); return () => { sequence.current++; }; }, [initialUrl, review]);
  const restore = async () => {
    if (!payload || importingRef.current) return;
    importingRef.current = true; setImporting(true); setError('');
    try { await onImport(payload); onClose(); }
    catch (failure) { setError(failure.message || 'Could not import the backup. Please try again.'); importingRef.current = false; setImporting(false); }
  };
  return <TransferDialog title={payload ? 'Import workspace' : 'Import from URL'} description={payload ? 'Review this backup before adding it to your device.' : 'Paste a workspace backup URL to get started.'} icon="upload" busy={importing} onClose={onClose}>
    <div className={styles.body}>
      {!payload ? <form id={`${id}-form`} onSubmit={event => { event.preventDefault(); review(value); }}><label className={styles.label} htmlFor={id}>Workspace backup URL</label><textarea id={id} className={styles.url} rows={4} value={value} maxLength={MAX_WORKSPACE_URL_LENGTH} autoComplete="off" spellCheck={false} placeholder="Paste your backup URL…" disabled={checking} onChange={event => { request.current++; setValue(event.target.value); setError(''); }}/></form> : <><BackupSummary payload={payload}/><ul className={styles.projects}>{payload.projects.slice(0, 5).map(project => <li key={project.id}><Icon name={project.deletedAt ? 'trash' : 'box'} size={15}/><span>{project.title || 'Untitled mind map'}</span>{project.deletedAt && <small>Trash</small>}</li>)}{payload.projects.length > 5 && <li className={styles.more}>+ {payload.projects.length - 5} more projects</li>}</ul><p className={styles.note}>Projects and saved shapes are imported as copies. Your existing workspace stays intact.</p></>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {checking && <p className={styles.status} role="status">Checking backup…</p>}
    </div>
    <footer><button type="button" className={styles.secondary} disabled={importing || checking} onClick={payload ? () => { setPayload(null); setError(''); } : onClose}>{payload ? 'Change URL' : 'Cancel'}</button>{payload ? <button type="button" className={styles.primary} disabled={importing} onClick={restore}>{importing ? 'Importing…' : 'Import workspace'}<Icon name="forward" size={16}/></button> : <button type="submit" form={`${id}-form`} className={styles.primary} disabled={checking || !value.trim()}>Preview backup<Icon name="forward" size={16}/></button>}</footer>
  </TransferDialog>;
}
