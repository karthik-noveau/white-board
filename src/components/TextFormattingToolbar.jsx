import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './BoardIcon';
import { visibleViewport } from '../lib/floatingMenu';
import styles from '../styles/textFormatting.module.css';

export default function TextFormattingToolbar({ anchor, formats, onFormat, onLink, onClose, blockStyles = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const position = () => {
      const element = ref.current, viewport = visibleViewport();
      const current = anchor.range?.commonAncestorContainer.isConnected ? anchor.range.getBoundingClientRect() : null;
      const rect = current?.width || current?.height ? current : anchor;
      const width = element.offsetWidth, height = element.offsetHeight, margin = 8;
      const left = Math.max(viewport.left + margin, Math.min((rect.left + rect.right - width) / 2, viewport.left + viewport.width - width - margin));
      const above = rect.top - height - margin;
      const top = Math.max(viewport.top + margin, Math.min(above >= viewport.top + margin ? above : rect.bottom + margin, viewport.top + viewport.height - height - margin));
      Object.assign(element.style, { left: `${left}px`, top: `${top}px` });
    };
    position();
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position); window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [anchor]);
  const button = (command, label, content, value) => <button key={value || command} type="button" title={label} aria-label={label} aria-pressed={!!formats[value || command]} onClick={() => onFormat(command, value)}>{content}</button>;
  return createPortal(<div ref={ref} data-cell-menu data-rich-text-tools className={`${styles.tools} ${blockStyles ? styles.withBlockStyles : ''}`} role="toolbar" aria-label={blockStyles ? 'Text formatting' : 'Format selected text'} onPointerDown={event => event.preventDefault()} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const buttons = [...ref.current.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
      buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    }
  }}>
    <div className={styles.toolGroup} role="group" aria-label="Text style">
      {[
        ['bold', 'Bold', 'B'], ['italic', 'Italic', 'I'],
        ['underline', 'Underline', 'U'], ['strikeThrough', 'Strikethrough', 'S'],
      ].map(([command, label, glyph]) => button(command, label, <span aria-hidden="true" className={`${styles.typeGlyph} ${styles[command]}`}>{glyph}</span>))}
    </div>
    <span className={styles.toolSeparator} aria-hidden="true"/>
    {blockStyles ? <div className={styles.toolGroup} role="group" aria-label="Lists and blocks">
      {button('insertOrderedList', 'Numbered list', <Icon name="textNumberedList" size={14}/>)}
      {button('insertUnorderedList', 'Bulleted list', <Icon name="textBulletedList" size={14}/>)}
      {button('formatBlock', 'Quote', <Icon name="textQuote" size={14}/>, 'blockquote')}
      {button('formatBlock', 'Code block', <Icon name="textCodeBlock" size={16}/>, 'pre')}
    </div> : <div className={styles.toolGroup} role="group" aria-label="Text emphasis">
      {button('highlight', 'Highlight', <Icon name="textHighlight" size={16}/>)}
      {button('code', 'Inline code', <Icon name="textCode" size={16}/>)}
    </div>}
    <span className={styles.toolSeparator} aria-hidden="true"/>
    <div className={styles.toolGroup} role="group" aria-label="Link and cleanup">
      <button type="button" aria-label="Add or edit link" title="Add or edit link" aria-haspopup="dialog" onClick={onLink}><Icon name="textLink" size={16}/></button>
      <button className={styles.clearTool} type="button" aria-label="Clear formatting" title="Clear formatting" onClick={() => onFormat('removeFormat')}><Icon name="textClear" size={16}/></button>
    </div>
  </div>, anchor.container || document.body);
}
