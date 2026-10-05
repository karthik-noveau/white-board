import { useLayoutEffect, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './BoardIcon';
import styles from '../styles/canvasContextMenu.module.css';
import useFloatingMenu from '../lib/useFloatingMenu';

export default function CanvasContextMenu({ anchor, title, groups, onClose }) {
  const ref = useRef(null);
  useFloatingMenu(ref, anchor, 280, 520);
  useLayoutEffect(() => {
    const menu = ref.current;
    menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [anchor]);
  useEffect(() => {
    const outside = event => { if (!ref.current?.contains(event.target)) onClose(false); };
    const reposition = event => { if (!ref.current?.contains(event.target)) onClose(false); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', reposition, true);
    };
  }, [onClose]);
  const keyboard = event => {
    event.stopPropagation();
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault(); onClose(true); return;
    }
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...ref.current.querySelectorAll('button:not(:disabled)')], current = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
    buttons[next]?.focus();
  };
  return createPortal(<div ref={ref} data-cell-menu className={styles.menu} role="menu" aria-label={title}
    onKeyDown={keyboard}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
    <div className={styles.title}><span>{title}</span><button type="button" className={styles.close} role="menuitem" aria-label="Close actions" onClick={() => onClose(true)}><Icon name="close" size={18}/></button></div>
    {groups.filter(group => group.length).map((group, index) => <div key={index} className={styles.group} role="group">
      {group.map(item => <button type="button" role="menuitem" key={item.label} disabled={item.disabled}
        className={item.danger ? styles.danger : undefined} onClick={item.run}>
        <Icon name={item.icon || 'plus'} size={16}/><span>{item.label}</span>{item.hint && <small>{item.hint}</small>}
      </button>)}
    </div>)}
  </div>, anchor?.container || anchor?.element?.closest('dialog[open]') || document.body);
}
