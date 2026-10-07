import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { folderPath } from '../lib/routes';
import Icon from './BoardIcon';
import TextInputDialog from './TextInputDialog';
import DeleteConfirmation from './DeleteConfirmation';
import styles from '../styles/workspaceFolders.module.css';

function FolderCard({ name, count, onRename, onRemove }) {
  const [open, setOpen] = useState(false), [above, setAbove] = useState(false);
  const anchor = useRef(null), trigger = useRef(null), id = useId();
  useEffect(() => {
    if (!open) return;
    anchor.current?.querySelector('[role="menuitem"]')?.focus();
    const outside = event => { if (!anchor.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const choose = callback => { setOpen(false); trigger.current?.focus(); callback(name); };
  return <article className={styles.card}>
    <Link to={folderPath(name)} className={styles.open} aria-label={`Open folder ${name}`}><span className={styles.icon}><Icon name="folder" size={21}/></span><span className={styles.copy}><strong title={name}>{name}</strong><small>{count} {count === 1 ? 'project' : 'projects'}</small></span></Link>
    <div className={styles.anchor} ref={anchor} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => {
      if (!open) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const items = [...anchor.current.querySelectorAll('[role="menuitem"]')], index = items.indexOf(document.activeElement);
        items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length]?.focus();
      }
    }}>
      <button ref={trigger} className={styles.more} aria-label={`Folder options for ${name}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={event => { setAbove(event.currentTarget.getBoundingClientRect().bottom + 116 > window.innerHeight); setOpen(value => !value); }}><Icon name="more" size={18}/></button>
      {open && <div id={id} className={styles.menu} data-above={above || undefined} role="menu" aria-label={`Folder options for ${name}`}><button role="menuitem" onClick={() => choose(onRename)}><Icon name="edit" size={16}/>Rename folder</button><button role="menuitem" onClick={() => choose(onRemove)}><Icon name="trash" size={16}/>Remove folder</button></div>}
    </div>
  </article>;
}

export default function WorkspaceFolders({ folders, projects, currentFolder, onManageFolder }) {
  const navigate = useNavigate(), heading = useRef(null), removing = useRef(false);
  const [editing, setEditing] = useState(null), [remove, setRemove] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const askRemove = name => { setError(''); setRemove(name); };
  const removeFolder = async () => {
    if (removing.current) return;
    removing.current = true; setBusy(true); setError('');
    try { await onManageFolder('remove', remove); setRemove(null); if (currentFolder) navigate('/projects'); }
    catch (failure) { setError(failure.message || 'Could not remove this folder. Try again.'); }
    finally { removing.current = false; setBusy(false); }
  };
  const rename = name => setEditing({ name });
  return <section className={styles.section} aria-label={currentFolder ? 'Current folder' : 'Folders'}>
    <div className={styles.heading}>
      {currentFolder ? <Link ref={heading} className={styles.back} to="/projects"><Icon name="back" size={16}/>All projects</Link> : <h2 ref={heading} tabIndex={-1}>Folders<span>{folders.length}</span></h2>}
      {currentFolder ? <div className={styles.actions}><button onClick={() => rename(currentFolder)}><Icon name="edit" size={15}/>Rename folder</button><button aria-label={`Remove folder ${currentFolder}`} onClick={() => askRemove(currentFolder)}><Icon name="trash" size={15}/>Remove</button></div> : <button className={styles.create} onClick={() => setEditing({ name: '' })}><Icon name="plus" size={16}/>New folder</button>}
    </div>
    {!currentFolder && (folders.length ? <div className={styles.grid}>{folders.map(name => <FolderCard key={name} name={name} count={projects.filter(project => project.folder === name).length} onRename={rename} onRemove={askRemove}/>)}</div> : <p className={styles.empty}>Keep related projects together. Create a folder, then move projects into it.</p>)}
    {editing && <TextInputDialog title={editing.name ? 'Rename folder' : 'New folder'} description={editing.name ? 'Projects in this folder will stay together.' : 'Give related projects a place of their own.'} label="Folder name" initialValue={editing.name} confirmLabel={editing.name ? 'Save changes' : 'Create folder'} fallbackFocus={heading.current} onClose={() => setEditing(null)} onConfirm={async value => { await onManageFolder(editing.name ? 'rename' : 'create', editing.name || value, value); if (currentFolder) navigate(folderPath(value), { replace: true }); }}/>}

    {remove && <DeleteConfirmation title={`Remove “${remove}”?`} description={error || 'Your projects will stay in All projects. Only the folder will be removed.'} confirmLabel={busy ? 'Removing…' : 'Remove folder'} busy={busy} fallbackFocus={heading.current} onClose={() => { if (!busy) setRemove(null); }} onConfirm={removeFolder}/>}
  </section>;
}
