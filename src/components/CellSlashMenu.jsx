import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { commandsFor } from '../lib/cellContent';
import Icon from './BoardIcon';
import styles from '../styles/cellContent.module.css';

const icons = { text: 'text', heading: 'text', table: 'grid', checklist: 'check', image: 'image', code: 'code', note: 'note', link: 'share', file: 'attachment', divider: 'lineWidth' };

export default function CellSlashMenu({ query = '', depth = 0, anchor, onChoose, onClose, searchable = false }) {
  const [search, setSearch] = useState('');
  const filter = searchable ? search : query;
  const items = commandsFor(filter, depth), [active, setActive] = useState(0), ref = useRef(null);
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
  const width = Math.min(320, window.innerWidth - 24), height = Math.min(420, window.innerHeight - 24);
  const rect = anchor?.element?.getBoundingClientRect() || anchor || { left: 20, bottom: 80, top: 60 };
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const bottom = rect.bottom ?? rect.top;
  const top = bottom + height + 8 < window.innerHeight ? bottom + 8 : Math.max(12, Math.min(rect.top - height - 8, window.innerHeight - height - 12));
  return createPortal(<div ref={ref} data-cell-menu className={styles.slashMenu} style={{ left, top, width, maxHeight: height }} onPointerDown={event => { if (!event.target.closest('input')) event.preventDefault(); }} onClick={event => event.stopPropagation()} role="dialog" aria-label="Insert content">
    <header><span>Insert content</span><kbd>esc</kbd></header>
    {searchable && <input className={styles.blockSearch} aria-label="Search content types" placeholder="Search blocks…" value={search} onChange={event => { setSearch(event.target.value); setActive(0); }}/>}
    <div className={styles.commandList} role="listbox" aria-label="Content types">{items.map((item, i) => <button key={item.type} type="button" role="option" aria-selected={i === index} onPointerMove={() => setActive(i)} onClick={() => onChoose(item.type)}>
      <i><Icon name={icons[item.type]} size={18}/></i><span><b>{item.name}</b><small>{item.description}</small></span><kbd>↵</kbd>
    </button>)}{!items.length && <p>No blocks match “{filter}”.</p>}</div>
    <footer>↑ ↓ to navigate <span>↵ to insert</span></footer>
  </div>, anchor?.element?.closest('dialog[open]') || document.body);
}
