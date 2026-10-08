import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Icon from './BoardIcon';
import styles from '../styles/projectSort.module.css';

const options = [['recent', 'Last edited'], ['name', 'Name A–Z'], ['oldest', 'Oldest first']];

export default function ProjectSort({ value, onChange }) {
  const [open, setOpen] = useState(false), [above, setAbove] = useState(false);
  const root = useRef(null), trigger = useRef(null), menu = useRef(null), initialFocus = useRef(null);
  const id = useId();
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = trigger.current.getBoundingClientRect(), height = menu.current.offsetHeight + 8;
      setAbove(rect.bottom + height > window.innerHeight - 12 && rect.top > height + 12);
    };
    position();
    const items = menu.current.querySelectorAll('button');
    (initialFocus.current === 'last' ? items[items.length - 1] : menu.current.querySelector('[aria-checked="true"]') || items[0])?.focus({ preventScroll: true });
    initialFocus.current = null;
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  return <div ref={root} className={styles.control} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (!open) return;
    const items = [...menu.current.querySelectorAll('button')], index = items.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== ' ') {
      const match = items.find(item => item.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
      if (match) { event.preventDefault(); match.focus(); }
    }
  }}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`Sort projects: ${options.find(option => option[0] === value)?.[1]}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen(current => !current)} onKeyDown={event => {
      if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); initialFocus.current = event.key === 'ArrowUp' ? 'last' : null; setOpen(true); }
    }}><span>{options.find(option => option[0] === value)?.[1]}</span><Icon name="chevron" size={14}/></button>
    {open && <div ref={menu} id={id} role="menu" aria-label="Sort projects" className={styles.menu} data-above={above}>
      {options.map(([key, label]) => <button type="button" key={key} role="menuitemradio" aria-checked={value === key} tabIndex={-1} onClick={() => { onChange(key); close(true); }}><span>{label}</span><Icon name="check" size={15}/></button>)}
    </div>}
  </div>;
}
