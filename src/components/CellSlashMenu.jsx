import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { commandsFor } from '../lib/cellContent';
import Icon from './BoardIcon';
import styles from '../styles/cellContent.module.css';
import useFloatingMenu from '../lib/useFloatingMenu';

const icons = { text: 'text', heading: 'text', table: 'grid', checklist: 'check', image: 'image', code: 'code', note: 'note', link: 'share', file: 'attachment', divider: 'lineWidth' };

export default function CellSlashMenu({ query = '', depth = 0, anchor, onChoose, onClose, searchable = false }) {
  const [search, setSearch] = useState('');
  const filter = searchable ? search : query;
  const items = commandsFor(filter, depth), [active, setActive] = useState(0), ref = useRef(null);
  useFloatingMenu(ref, anchor, 360);
  const index = Math.min(active, Math.max(0, items.length - 1));
  useEffect(() => { if (searchable) ref.current?.querySelector('input')?.focus({ preventScroll: true }); }, [searchable]);
  useEffect(() => { ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [index]);
  useEffect(() => {
    const key = event => {
      if (event.isComposing) return;
      if (!['ArrowDown','ArrowUp','Enter','Escape'].includes(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Escape') onClose();
      else if (event.key === 'Enter') { if (items[index]) onChoose(items[index].type); }
      else setActive((index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length));
    };
    const outside = event => { if (!ref.current?.contains(event.target) && event.target !== anchor?.element) onClose(); };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', outside, true); };
  }, [anchor, index, items, onChoose, onClose]);
  return createPortal(<div ref={ref} data-cell-menu className={styles.slashMenu} onPointerDown={event => { if (!event.target.closest('input')) event.preventDefault(); }} onClick={event => event.stopPropagation()} role="dialog" aria-label="Insert content">
    <header><span>Insert content</span><button type="button" className={styles.menuClose} aria-label="Close insert menu" onClick={onClose}><Icon name="close" size={18}/></button></header>
    {searchable && <input className={styles.blockSearch} aria-label="Search content types" placeholder="Search blocks…" value={search} onChange={event => { setSearch(event.target.value); setActive(0); }}/>}
    <div className={styles.commandList} role="listbox" aria-label="Content types">{items.map((item, i) => <button key={item.type} type="button" role="option" aria-selected={i === index} onPointerMove={() => setActive(i)} onClick={() => onChoose(item.type)}>
      <i aria-hidden="true"><Icon name={icons[item.type]} size={18}/></i><span className={styles.commandCopy}><span className={styles.commandTitle}><b>{item.name}</b><kbd aria-hidden="true">↵</kbd></span><small>{item.description}</small></span>
    </button>)}{!items.length && <p>No blocks match “{filter}”.</p>}</div>
    <footer>↑ ↓ to navigate <span>↵ to insert</span></footer>
  </div>, anchor?.container || anchor?.element?.closest('dialog[open]') || document.body);
}
