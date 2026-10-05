import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function MobileEditorDialog({ children, className, label, onClose }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector('textarea,input:not([type="checkbox"])')?.focus({ preventScroll: true });
    const revealInput = () => {
      const active = document.activeElement;
      if (dialog.contains(active) && active.matches('textarea,input,[contenteditable="true"]')) active.scrollIntoView({ block: 'nearest' });
    };
    window.visualViewport?.addEventListener('resize', revealInput);
    return () => {
      window.visualViewport?.removeEventListener('resize', revealInput);
      dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={ref} data-card-editor className={className} aria-label={label}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    {children}
  </dialog>, document.body);
}
