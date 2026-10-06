import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './BoardIcon';
import { normalizeLinkURL } from '../lib/textLinks';
import styles from '../styles/textLinkDialog.module.css';

export default function TextLinkDialog({ draft, onApply, onRemove, onClose }) {
  const ref = useRef(null), urlRef = useRef(null), id = useId();
  const [values, setValues] = useState(() => ({ text: draft.text, url: draft.url, title: draft.title, newTab: draft.newTab }));
  const [error, setError] = useState('');
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog.showModal(); urlRef.current.focus({ preventScroll: true }); urlRef.current.select();
    return () => dialog.close();
  }, []);
  const change = (key, value) => { setValues(previous => ({ ...previous, [key]: value })); if (key === 'url') setError(''); };
  const close = callback => { ref.current.close(); callback(); };
  const submit = event => {
    event.preventDefault();
    const url = normalizeLinkURL(values.url);
    if (!url) { setError('Enter a valid website, email or phone link.'); urlRef.current.focus(); return; }
    close(() => onApply({ ...values, url }));
  };
  return createPortal(<dialog ref={ref} data-cell-menu className={styles.dialog} aria-labelledby={`${id}-heading`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close(onClose); }}
    onPointerDown={event => event.stopPropagation()} onClick={event => {
      event.stopPropagation();
      if (event.target === event.currentTarget) {
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(onClose);
      }
    }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <form onSubmit={submit} noValidate>
      <header className={styles.header}>
        <span className={styles.linkIcon}><Icon name="textLink" size={20}/></span>
        <div><h2 id={`${id}-heading`}>{draft.existing ? 'Edit link' : 'Add link'}</h2><p id={`${id}-description`}>Choose a destination for your text.</p></div>
        <button type="button" className={styles.close} aria-label="Close link dialog" onClick={() => close(onClose)}><Icon name="close" size={18}/></button>
      </header>
      <div className={styles.body}>
        <label className={styles.field} htmlFor={`${id}-text`}><span>Text to display</span><input id={`${id}-text`} value={values.text} onChange={event => change('text', event.target.value)} placeholder="Use the link address" autoComplete="off"/></label>
        <label className={styles.field} htmlFor={`${id}-url`}><span>Link address</span><input ref={urlRef} id={`${id}-url`} type="text" inputMode="url" value={values.url} onChange={event => change('url', event.target.value)} placeholder="https://example.com" autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={`${id}-url-help`}/></label>
        <p id={`${id}-url-help`} className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>{error || 'Paste a URL, or enter a domain such as example.com.'}</p>
        <label className={styles.option}>
          <span><strong>Open in new tab</strong><small id={`${id}-tab-help`}>{values.newTab ? 'Keep the board open when following the link.' : 'Open the destination in the current tab.'}</small></span>
          <input type="checkbox" role="switch" aria-label="Open in new tab" aria-describedby={`${id}-tab-help`} checked={values.newTab} onChange={event => change('newTab', event.target.checked)}/><span className={styles.switch} aria-hidden="true"/>
        </label>
        <label className={styles.field} htmlFor={`${id}-title`}><span>Hover title <small>Optional</small></span><input id={`${id}-title`} value={values.title} onChange={event => change('title', event.target.value)} placeholder="A short description of the destination" autoComplete="off"/></label>
      </div>
      <footer className={styles.footer}>
        {draft.existing && <button type="button" className={styles.remove} onClick={() => close(onRemove)}>Remove link</button>}
        <div><button type="button" className={styles.cancel} onClick={() => close(onClose)}>Cancel</button><button type="submit" className={styles.apply}>{draft.existing ? 'Save link' : 'Insert link'}</button></div>
      </footer>
    </form>
  </dialog>, document.body);
}
