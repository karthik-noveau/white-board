import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './BoardIcon';
import styles from '../styles/textInputDialog.module.css';

export default function TextInputDialog({ title, description, label, initialValue = '', maxLength = 180, allowEmpty = false, suggestions = [], confirmLabel = 'Save changes', onConfirm, onClose, fallbackFocus }) {
  const ref = useRef(null), input = useRef(null), id = useId();
  const [value, setValue] = useState(initialValue), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useLayoutEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    dialog.showModal(); input.current?.select(); input.current?.focus();
    return () => {
      dialog.close();
      const canRestorePrevious = previous?.isConnected && previous !== document.body && previous !== document.documentElement && !previous.disabled;
      const target = canRestorePrevious ? previous : fallbackFocus;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [fallbackFocus]);
  return createPortal(<dialog ref={ref} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }}>
    <header><div><h2 id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{description}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Close dialog"><Icon name="close" size={20}/></button></header>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy || (!allowEmpty && !value.trim())) return;
      setBusy(true); setError('');
      try { await onConfirm(value.trim()); onClose(); }
      catch (failure) { setError(failure.message || 'Could not save. Please try again.'); setBusy(false); }
    }}>
      <label htmlFor={`${id}-input`}>{label}</label><input ref={input} id={`${id}-input`} value={value} onChange={event => setValue(event.target.value)} maxLength={maxLength} required={!allowEmpty} disabled={busy} list={suggestions.length ? `${id}-suggestions` : undefined}/>
      {suggestions.length > 0 && <datalist id={`${id}-suggestions`}>{suggestions.map(item => <option key={item} value={item}/>)}</datalist>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className={styles.primary} disabled={busy || (!allowEmpty && !value.trim())}>{busy ? 'Saving…' : confirmLabel}</button></footer>
    </form>
  </dialog>, document.body);
}
