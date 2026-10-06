import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import TextFormattingToolbar from './TextFormattingToolbar';
import TextLinkDialog from './TextLinkDialog';
import { commandQuery, attachmentFromTransfer, cloneContent } from '../lib/cellContent';
import { blocksFromClipboard } from '../lib/blockEditing';
import { cleanBlockHTML, escapeHTML, cardIdFromHref, resolveCardHTML, splitEditable } from '../lib/richContent';
import { selectionFormats, formattedSelectionHTML, restoreTextSelection } from '../lib/inlineFormatting';
import { observeTextSelection } from '../lib/textSelectionToolbar';
import { textLinkDraft, applyTextLink, normalizeLinkURL } from '../lib/textLinks';
import { markdownBlocks } from '../lib/markdownBlocks';
import { useBlockWorkspace } from '../lib/blockWorkspace';
import styles from '../styles/richBlock.module.css';

export default function RichBlockEditor({ text = '', html, label, placeholder = '', className = '', depth = 0, onChange, onSplit, onSlash, onPasteBlocks, onMessage }) {
  const ref = useRef(null), saved = useRef(null), lastEmitted = useRef(null), composing = useRef(false), plainPaste = useRef(0);
  const selectionObserver = useRef(null);
  const [tools, setTools] = useState(null), [link, setLink] = useState(null);
  const workspace = useBlockWorkspace();
  const [formats, setFormats] = useState({});
  useLayoutEffect(() => {
    const desired = html ? resolveCardHTML(html, workspace.nodes) : escapeHTML(text).replaceAll('\n', '<br>');
    if (lastEmitted.current?.text === text && lastEmitted.current?.html === html && document.activeElement === ref.current) return;
    if (ref.current.innerHTML !== desired) ref.current.innerHTML = desired;
  }, [text, html, workspace.nodes]);
  const commit = () => {
    const element = ref.current;
    const value = { text: element.innerText.replace(/\n$/, match => element.textContent ? match : ''), html: cleanBlockHTML(element.innerHTML) };
    if (!element.textContent && !element.querySelector('li')) { element.replaceChildren(); value.text = ''; value.html = ''; }
    lastEmitted.current = value; onChange(value);
  };
  useEffect(() => {
    if (link) return;
    const observer = observeTextSelection(ref.current, {
      onSave: range => { saved.current = range; },
      onHide: () => setTools(null),
      onShow: range => {
        const rect = range.getBoundingClientRect();
        setTools({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, range, container: ref.current.closest('dialog[open]') });
        setFormats(selectionFormats(ref.current, range));
      },
    });
    selectionObserver.current = observer;
    return () => { observer.dispose(); selectionObserver.current = null; };
  }, [link]);
  const restore = () => {
    ref.current.focus({ preventScroll: true });
    if (saved.current && ref.current.contains(saved.current.commonAncestorContainer)) {
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(saved.current.cloneRange());
    }
  };
  const insertHTML = html => { document.execCommand('insertHTML', false, html); commit(); };
  const format = command => {
    restore();
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    if (['highlight','code','removeFormat'].includes(command)) {
      const result = formattedSelectionHTML(ref.current,selection.getRangeAt(0),command);
      const whole = document.createRange(); whole.selectNodeContents(ref.current);
      selection.removeAllRanges(); selection.addRange(whole);
      document.execCommand('insertHTML',false,cleanBlockHTML(result.html));
      saved.current = restoreTextSelection(ref.current,result.start,result.end).cloneRange();
    } else document.execCommand(command, false);
    commit();
    if (selection.rangeCount) { saved.current = selection.getRangeAt(0).cloneRange(); setFormats(selectionFormats(ref.current,saved.current)); }
  };

  const input = () => {
    commit(); if (composing.current) return;
    const selection = window.getSelection(), node = selection?.focusNode;
    if (node?.nodeType !== 3 || !ref.current.contains(node)) { onSlash?.(null); return; }
    const query = commandQuery(node.textContent, selection.focusOffset);
    if (query && onSlash) {
      const range = document.createRange(); range.setStart(node, query.start); range.setEnd(node, query.end);
      onSlash({ query: query.query, parts: splitEditable(ref.current, range), anchor: { element: ref.current } });
    } else onSlash?.(null);
  };
  const paste = event => {
    if (attachmentFromTransfer(event.clipboardData)) return;
    event.preventDefault(); event.stopPropagation();
    const plain = event.clipboardData.getData('text/plain');
    try {
      const copied = blocksFromClipboard(event.clipboardData);
      const plainOnly = Date.now() - plainPaste.current < 1000; plainPaste.current = 0;
      const blocks = onPasteBlocks && !plainOnly ? copied ? cloneContent(copied.blocks) : markdownBlocks(plain, depth) : null;
      if (blocks) { onPasteBlocks(blocks, splitEditable(ref.current)); setTools(null); onSlash?.(null); return; }
      const markup = event.clipboardData.getData('text/html');
      if (markup && !plainOnly) insertHTML(cleanBlockHTML(markup));
      else { document.execCommand('insertText', false, plain); commit(); }
    } catch (error) { onMessage?.(error.message); }
  };
  const openLink = () => {
    const draft = textLinkDraft(ref.current, saved.current);
    if (!draft) return;
    setLink(draft); setTools(null); onSlash?.(null);
  };
  const applyLink = values => {
    applyTextLink(ref.current, link, values);
    const selection = window.getSelection();
    if (selection?.rangeCount) saved.current = selection.getRangeAt(0).cloneRange();
    commit(); setLink(null); restore();
  };
  return <>
    <div ref={ref} data-rich-block role="textbox" aria-label={label} aria-multiline="true" contentEditable suppressContentEditableWarning
      data-placeholder={placeholder} className={`${styles.editor} ${className}`} onInput={input} onPaste={paste}
      onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; input(); }}
      onClick={event => { const href = event.target.closest('a')?.getAttribute('href'); if (href && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.stopPropagation(); const id = cardIdFromHref(href); if (id !== null) workspace.onNavigate?.(id); else { const url = normalizeLinkURL(href); if (url) window.open(url, '_blank', 'noopener,noreferrer'); } } }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'v') plainPaste.current = Date.now();
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); event.stopPropagation(); const selection = window.getSelection(); if (selection?.rangeCount) saved.current = selection.getRangeAt(0).cloneRange(); openLink(); return; }
        if (event.key === 'Enter' && !event.shiftKey && onSplit) { event.preventDefault(); onSplit(splitEditable(ref.current)); setTools(null); }
      }}/>
    {tools && !link && <TextFormattingToolbar anchor={tools} formats={formats} onFormat={format} onLink={openLink} onClose={() => { selectionObserver.current?.dismiss(); setTools(null); restore(); }}/>}
    {link && <TextLinkDialog draft={link} onApply={applyLink} onRemove={() => applyLink(null)} onClose={() => { setLink(null); restore(); }}/>}
  </>;
}
