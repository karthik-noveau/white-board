import { useId, useLayoutEffect, useRef } from "react";
import Icon from "./BoardIcon";
import styles from "../styles/deleteConfirmation.module.css";

export default function DeleteConfirmation({ title, description, confirmLabel = "Delete", onConfirm, onClose, fallbackFocus }) {
  const dialogRef = useRef(null), cancelRef = useRef(null);
  const titleId = useId(), descriptionId = useId();
  useLayoutEffect(() => {
    const dialog = dialogRef.current, previousFocus = document.activeElement;
    dialog.showModal();
    cancelRef.current.focus({ preventScroll: true });
    return () => {
      dialog.close();
      const target = previousFocus?.isConnected ? previousFocus : fallbackFocus;
      target?.focus({ preventScroll: true });
    };
  }, [fallbackFocus]);

  return <dialog ref={dialogRef} className={styles.dialog} role="alertdialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <button type="button" className={styles.close} onClick={onClose} aria-label="Cancel deletion"><Icon name="close" size={18}/></button>
    <div className={styles.content}>
      <span className={styles.icon}><Icon name="trash" size={28}/></span>
      <div className={styles.message}>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
      </div>
    </div>
    <div className={styles.actions}><button type="button" ref={cancelRef} className={styles.cancel} onClick={onClose}>Cancel</button><button type="button" className={styles.confirm} onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}
