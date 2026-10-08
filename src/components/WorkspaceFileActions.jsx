import { useEffect, useId, useRef, useState } from 'react';
import Icon from './BoardIcon';
import styles from '../styles/siteHeader.module.css';

export default function WorkspaceFileActions({ onImport, onImportUrl, onBackup, onBackupUrl, backupBusy }) {
  const [open, setOpen] = useState(null);
  const ref = useRef(null), importRef = useRef(null), backupRef = useRef(null), id = useId();
  const trigger = () => (open === 'import' ? importRef : backupRef).current;
  const close = (restoreFocus = false) => { if (restoreFocus) trigger()?.focus(); setOpen(null); };
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector('[role="menuitem"]')?.focus();
    const outside = event => { if (!ref.current?.contains(event.target)) setOpen(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const items = open === 'import'
    ? [['upload', 'Import file', 'Choose a board or workspace backup', onImport], ['textLink', 'Import from URL', 'Restore a workspace backup link', onImportUrl]]
    : [['download', 'Download file', 'Save a complete workspace backup', onBackup], ['textLink', 'Create backup URL', 'Copy a link to this workspace snapshot', onBackupUrl]];
  return <div ref={ref} className={styles.fileActions} role="group" aria-label="Workspace files" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null); }} onKeyDown={event => {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const buttons = [...ref.current.querySelectorAll('[role="menuitem"]')], index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }}>
    {onImport && <button ref={importRef} type="button" className={styles.fileAction} data-kind="import" aria-label="Import boards" title="Import boards" aria-haspopup="menu" aria-expanded={open === 'import'} aria-controls={`${id}-import`} onClick={() => setOpen(current => current === 'import' ? null : 'import')}><span className={styles.fileActionIcon}><Icon name="upload" size={16}/></span><span className={styles.fileActionLabel}>Import</span><span className={styles.fileChevron}><Icon name="chevron" size={11}/></span></button>}
    {onBackup && <button ref={backupRef} type="button" className={styles.fileAction} data-kind="backup" aria-label="Back up workspace" title="Back up workspace" aria-haspopup="menu" aria-expanded={open === 'backup'} aria-controls={`${id}-backup`} disabled={backupBusy} aria-busy={backupBusy} onClick={() => setOpen(current => current === 'backup' ? null : 'backup')}><span className={styles.fileActionIcon}><Icon name="download" size={16}/></span><span className={styles.fileActionLabel}>{backupBusy ? 'Preparing…' : 'Back up'}</span><span className={styles.fileChevron}><Icon name="chevron" size={11}/></span></button>}
    {open && <div id={`${id}-${open}`} role="menu" aria-label={open === 'import' ? 'Import options' : 'Backup options'} className={styles.fileMenu} data-kind={open}>
      {items.map(([icon, label, description, run]) => <button type="button" role="menuitem" key={label} onClick={() => { close(true); run?.(); }}><span className={styles.fileMenuIcon}><Icon name={icon} size={17}/></span><span className={styles.fileMenuCopy}><strong>{label}</strong><small>{description}</small></span></button>)}
    </div>}
  </div>;
}
