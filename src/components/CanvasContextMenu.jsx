import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './BoardIcon';
import styles from '../styles/canvasContextMenu.module.css';
import useFloatingMenu from '../lib/useFloatingMenu';

export default function CanvasContextMenu({ anchor, title, groups, onClose }) {
  const ref = useRef(null);
  const [navigation, setNavigation] = useState({ anchor, panels: [] });
  const panels = navigation.anchor === anchor ? navigation.panels : [];
  const panel = panels.at(-1) || { title, groups };
  const back = () => setNavigation({ anchor, panels: panels.slice(0, -1) });
  const choose = item => {
    if (item.children) setNavigation({ anchor, panels: [...panels, { title: item.label, groups: item.children }] });
    else item.run?.();
  };
  useFloatingMenu(ref, anchor, 264, 520);
  useLayoutEffect(() => {
    const menu = ref.current;
    menu.scrollTop = 0;
    menu.querySelector('[data-context-action]:not(:disabled)')?.focus({ preventScroll: true });
  }, [anchor, panels.length]);
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
    if (event.key === 'ArrowLeft' && panels.length) { event.preventDefault(); back(); return; }
    if (event.key === 'ArrowRight' && document.activeElement?.getAttribute('aria-haspopup') === 'menu') {
      event.preventDefault(); document.activeElement.click(); return;
    }
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault(); onClose(true); return;
    }
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...ref.current.querySelectorAll('[data-context-action]:not(:disabled)')], current = buttons.indexOf(document.activeElement);
    if (!buttons.length) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
    buttons[next]?.focus();
  };
  return createPortal(<div ref={ref} data-cell-menu className={styles.menu} role="menu" aria-label={panel.title}
    onKeyDown={keyboard}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
    <div className={styles.title}>{panels.length > 0 && <button type="button" className={styles.back} aria-label="Back to previous actions" onClick={back}><Icon name="back" size={16}/></button>}<span title={panel.title}>{panel.title}</span><button type="button" className={styles.close} aria-label="Close actions" onClick={() => onClose(true)}><Icon name="close" size={18}/></button></div>
    {panel.groups.filter(group => group.length).map((group, index) => <div key={index} className={styles.group} role="group">
      {group.map((item, index) => <button data-context-action type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked}
        aria-haspopup={item.children ? 'menu' : undefined} key={item.id ?? `${item.label}-${index}`} disabled={item.disabled}
        className={item.danger ? styles.danger : undefined} onClick={() => choose(item)}>
        <Icon name={item.icon || 'plus'} size={16}/><span>{item.label}</span>{item.children ? <Icon name="chevron" size={14}/> : item.checked ? <Icon name="check" size={14}/> : item.hint && <small>{item.hint}</small>}
      </button>)}
    </div>)}
  </div>, anchor?.container || anchor?.element?.closest('dialog[open]') || document.body);
}
