import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import Icon from './BoardIcon';
import CellSlashMenu from './CellSlashMenu';
import CanvasContextMenu from './CanvasContextMenu';
import MobileEditorDialog from './MobileEditorDialog';
import { isCardContent, isCardText } from '../lib/boardAppearance';
import { CODE_LANGUAGES } from '../lib/codeLanguages';
import { mobileQuery } from '../lib/useMediaQuery';
import { TYPES, IMAGE_TYPES, attachmentFromTransfer, placeAttachment, cloneContent, commandQuery, contentText, csvText, ensureEditor, insertCommand, insertRelativeBlock, editTable, locateBlock, readAttachment, safeAttachment, safeURL, textBlock } from '../lib/cellContent';
import styles from '../styles/cellContent.module.css';

const stop = event => event.stopPropagation();
const CodeEditor = lazy(() => import('./CodeEditor'));
const clean = html => DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b','strong','i','em','u','s','br','p','div','span','ul','ol','li','code','pre','blockquote','sub','sup'], ALLOWED_ATTR: [] });
function TextField({ value = '', onChange, className = '', ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    element.style.height = '0px'; element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  useEffect(() => {
    const element = ref.current;
    // The first observation also measures fields mounted in a closed dialog.
    // Their first layout pass has no height until showModal() displays them.
    let width;
    const observer = new ResizeObserver(() => {
      if (width === element.offsetWidth) return;
      width = element.offsetWidth; element.style.height = '0px'; element.style.height = `${element.scrollHeight}px`;
    });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  return <textarea ref={ref} rows={1} {...props} className={`${styles.textField} ${className}`} value={value} onChange={onChange}/>;
}
const download = (data, name) => { const a = document.createElement('a'); a.href = data; a.download = name; a.click(); };

function TaskCheckbox({ checked, label, readonly, onChange }) {
  return <span className={styles.taskToggle} data-checked={checked} role={readonly ? 'img' : undefined} aria-label={readonly ? (checked ? 'Completed' : 'Not completed') : undefined}>
    {!readonly && <input type="checkbox" aria-label={label} checked={checked} onChange={onChange}/>}
    <svg data-cell-check data-checked={checked} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x=".75" y=".75" width="16.5" height="16.5" rx="4" fill={checked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"/>
      {checked && <path d="m4.75 9 2.75 2.75 5.75-5.5" fill="none" stroke="var(--nova-surface)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>}
    </svg>
  </span>;
}

export default function CellContent(props) {
  return props.editing ? <CellEditingSession {...props}/> : <CellDocument {...props}/>;
}

function CellEditingSession(props) {
  // Preserve the editing session and caret when rotating a phone or tablet.
  const [mobile] = useState(() => window.matchMedia(mobileQuery).matches || window.matchMedia('(pointer: coarse)').matches);
  if (!mobile) return <CellDocument {...props}/>;
  return <>
    <CellDocument {...props} editing={false}/>
    <MobileEditorDialog className={styles.mobileEditor} label="Edit card" onClose={props.onFinish}>
      <CellDocument {...props} onHeight={undefined} mobileEditor/>
    </MobileEditorDialog>
  </>;
}

function CellDocument({ node, editing = false, mobileEditor = false, onChange, onFinish, onStartEditing, onHeight, onUndo, onRedo }) {
  const root = useRef(null), current = useRef(node), upload = useRef(null), uploadTarget = useRef(null);
  const focusedBlock = useRef(null);
  const pendingAttachments = useRef(new Map()), writable = useRef(false);
  current.current = node;
  const [menu, setMenu] = useState(null), [actions, setActions] = useState(null), [message, setMessage] = useState('');
  const [focus, setFocus] = useState(null), [dropTarget, setDropTarget] = useState(null);
  const canEdit = Boolean(onChange && !node.locked && (editing || onStartEditing));
  writable.current = canEdit;
  const readonly = !editing || !canEdit;
  const cardContent = !mobileEditor && isCardContent(node), cardText = cardContent && isCardText(node);
  useLayoutEffect(() => {
    if (!onHeight) return;
    const element = root.current;
    const measure = () => onHeight(node.id, Math.ceil(element.offsetHeight) + 2);
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [node.id, onHeight]);
  useLayoutEffect(() => {
    if (!editing || actions || menu) return;
    const block = focus && root.current?.querySelector(`[data-block-id="${CSS.escape(focus.id)}"]`);
    const element = focus?.image ? block?.querySelector('[data-image-drop]') : focus ? block?.querySelector('[data-code-editor] .cm-content,textarea') || block?.querySelector('input:not([type]),input[type="text"]') : root.current?.querySelector('textarea');
    element?.focus({ preventScroll: true });
    if (focus?.offset != null) element?.setSelectionRange?.(focus.offset, focus.offset);
    if (mobileEditor && focus) element?.scrollIntoView({ block: 'nearest' });
  }, [editing, focus, actions, menu, mobileEditor]);
  useEffect(() => {
    if (!editing) return;
    const outside = event => { if (!root.current?.contains(event.target) && !event.target.closest('[data-cell-menu]')) { setMenu(null); setActions(null); onFinish?.(); } };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [editing, onFinish]);
  const change = (mutate, key = null) => {
    const board = { cells: [{ ...current.current, content: structuredClone(current.current.content) }] };
    if (mutate(board) === false) return;
    const content = board.cells[0].content;
    onChange(node.id, { content, note: contentText(content), noteHtml: undefined, w: board.cells[0].w }, key);
  };
  const patch = (id, values, key = null) => change(board => { const entry = locateBlock(board, id); if (entry) Object.assign(entry.block, values); }, key);
  const openMenu = (event, id, depth) => {
    const range = commandQuery(event.target.value, event.target.selectionStart);
    setMenu(range ? { id, depth, range, anchor: { element: event.target } } : null);
  };
  const choose = type => {
    let added;
    change(board => { added = menu.position ? insertRelativeBlock(board, menu.id, type, menu.position) : insertCommand(board, menu.id, type, menu.range); if (type === 'table' && menu.depth === 0) board.cells[0].w = Math.max(520, board.cells[0].w || 0); });
    setMenu(null); setFocus({ id: added.id, offset: 0, image: type === 'image' });
    if (type === 'image' || type === 'file') chooseAttachment(added.id, type);
  };
  const chooseAttachment = (id, type) => {
    uploadTarget.current = { id, type };
    upload.current.accept = type === 'image' ? IMAGE_TYPES.join(',') : '';
    upload.current.click();
  };
  const attach = async (file, id, type, insert = false) => {
    if (!file || !canEdit) return;
    const request = Symbol();
    pendingAttachments.current.set(id, request);
    try {
      const data = await readAttachment(file, type === 'image');
      // Ignore stale reads if the card was closed, locked or replaced meanwhile.
      if (!root.current || !writable.current || current.current.id !== node.id || pendingAttachments.current.get(id) !== request) return;
      change(board => Boolean(placeAttachment(board, id, type, data, insert)));
      setMessage('');
    } catch (error) {
      if (root.current && pendingAttachments.current.get(id) === request) setMessage(error.message);
    } finally {
      if (pendingAttachments.current.get(id) === request) pendingAttachments.current.delete(id);
    }
  };
  const paste = event => {
    setDropTarget(null);
    const file = attachmentFromTransfer(event.clipboardData || event.dataTransfer);
    if (!file) return;
    const id = event.target.closest('[data-block-id]')?.dataset.blockId;
    const target = id && locateBlock({ cells: [current.current] }, id)?.block;
    // Prevent dropped files from navigating away, including in a read-only view.
    if (!canEdit || (!editing && target?.type !== 'image')) {
      if (event.type === 'drop') { event.preventDefault(); event.stopPropagation(); }
      return;
    }
    event.preventDefault(); event.stopPropagation();
    const type = target?.type === 'image' || file.type.startsWith('image/') ? 'image' : 'file';
    void attach(file, id, type, true);
  };
  const dragOver = event => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault(); event.stopPropagation();
    const id = event.target.closest('[data-block-id]')?.dataset.blockId;
    const image = id && locateBlock({ cells: [current.current] }, id)?.block.type === 'image';
    event.dataTransfer.dropEffect = canEdit && (editing || image) ? 'copy' : 'none';
    setDropTarget(canEdit && image ? id : null);
  };
  const blockAction = (id, action) => {
    change(board => {
      const entry = locateBlock(board, id); if (!entry) return;
      const { siblings, index } = entry;
      if (action === 'delete') siblings.splice(index, 1);
      if (action === 'duplicate') siblings.splice(index + 1, 0, ...cloneContent([entry.block]));
      const target = index + (action === 'up' ? -1 : 1);
      if (['up','down'].includes(action) && target >= 0 && target < siblings.length) [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
      ensureEditor(siblings);
    }); setActions(null); setFocus({ id });
  };
  const insertAt = (id, depth, position, anchor) => {
    setActions(null);
    setMenu({ id, depth, position, anchor });
    if (!editing) onStartEditing?.();
  };
  const openContext = (event, element = event.target) => {
    if (!onChange || (!editing && !onStartEditing) || node.locked) return;
    event.preventDefault(); event.stopPropagation();
    const target = element.closest('[data-block-id]');
    const slot = element.closest('[data-table-cell]');
    const rect = element.getBoundingClientRect();
    const pointer = event.type === 'contextmenu' && (event.clientX || event.clientY);
    setMenu(null);
    setActions({
      id: slot?.dataset.tableId || target?.dataset.blockId || node.content.at(-1)?.id,
      nestedId: slot && target?.dataset.blockId !== slot.dataset.tableId ? target?.dataset.blockId : null,
      tableId: slot?.dataset.tableId,
      row: slot?.hasAttribute('data-row') ? Number(slot.dataset.row) : null,
      column: slot ? Number(slot.dataset.column) : null,
      anchor: { container: element.closest('dialog[open]'), left: pointer ? event.clientX : rect.left, top: pointer ? event.clientY : rect.bottom + 4 },
    });
    if (!editing) onStartEditing?.();
  };
  const closeContext = (restoreFocus = false) => {
    const id = actions?.nestedId || actions?.id;
    setActions(null);
    if (restoreFocus && id) setFocus({ id });
  };
  const tableAction = (id, action, index) => {
    change(board => { editTable(board, id, action, index); });
    setActions(null); setFocus({ id });
  };
  const contextEntry = actions && locateBlock({ cells: [node] }, actions.id);
  const nestedEntry = actions?.nestedId && locateBlock({ cells: [node] }, actions.nestedId);
  const contextTable = contextEntry?.block.type === 'table' ? contextEntry.block : null;
  const contextTitle = contextTable ? `Table${actions.row !== null ? ` · Row ${actions.row + 1}` : ''}${actions.column !== null ? ` · Column ${actions.column + 1}` : ''}` : `${contextEntry ? TYPES[contextEntry.block.type].name : 'Content'} block`;
  const contextGroups = [];
  // Nested blocks retain their actions when the visible menu handles are removed.
  if (nestedEntry) {
    const { block, depth, index, siblings } = nestedEntry;
    const name = TYPES[block.type].name.toLowerCase();
    contextGroups.push([
      { label: `Insert before ${name}`, run: () => insertAt(block.id, depth, 'before', actions.anchor) },
      { label: `Insert after ${name}`, run: () => insertAt(block.id, depth, 'after', actions.anchor) },
      { label: `Move ${name} up`, icon: 'upload', disabled: index === 0, run: () => blockAction(block.id, 'up') },
      { label: `Move ${name} down`, icon: 'download', disabled: index === siblings.length - 1, run: () => blockAction(block.id, 'down') },
      { label: `Duplicate ${name}`, icon: 'duplicate', run: () => blockAction(block.id, 'duplicate') },
      { label: `Delete ${name}`, icon: 'trash', danger: true, run: () => blockAction(block.id, 'delete') },
    ]);
  }
  if (contextEntry) {
    const { block, depth, index, siblings } = contextEntry;
    if (contextTable) {
      const row = actions.row, column = actions.column;
      contextGroups.push([
        ...(row !== null ? [
          { label: 'Insert row above', disabled: block.rows.length >= 1000, run: () => tableAction(block.id, 'insert-row', row) },
          { label: 'Insert row below', disabled: block.rows.length >= 1000, run: () => tableAction(block.id, 'insert-row', row + 1) },
        ] : [{ label: 'Add row', disabled: block.rows.length >= 1000, run: () => tableAction(block.id, 'insert-row', block.rows.length) }]),
        ...(column !== null ? [
          { label: 'Insert column left', disabled: block.headers.length >= 30, run: () => tableAction(block.id, 'insert-column', column) },
          { label: 'Insert column right', disabled: block.headers.length >= 30, run: () => tableAction(block.id, 'insert-column', column + 1) },
        ] : [{ label: 'Add column', disabled: block.headers.length >= 30, run: () => tableAction(block.id, 'insert-column', block.headers.length) }]),
      ]);
      contextGroups.push([
        ...(row !== null ? [{ label: 'Delete row', icon: 'trash', danger: true, run: () => tableAction(block.id, 'delete-row', row) }] : []),
        ...(column !== null ? [{ label: 'Delete column', icon: 'trash', danger: true, disabled: block.headers.length === 1, run: () => tableAction(block.id, 'delete-column', column) }] : []),
      ]);
    }
    contextGroups.push([
      { label: contextTable ? 'Insert block before table' : 'Insert block before', run: () => insertAt(block.id, depth, 'before', actions.anchor) },
      { label: contextTable ? 'Insert block after table' : 'Insert block after', run: () => insertAt(block.id, depth, 'after', actions.anchor) },
    ]);
    contextGroups.push([
      ...(!contextTable ? [
        { label: 'Move up', icon: 'upload', disabled: index === 0, run: () => blockAction(block.id, 'up') },
        { label: 'Move down', icon: 'download', disabled: index === siblings.length - 1, run: () => blockAction(block.id, 'down') },
      ] : []),
      { label: contextTable ? 'Duplicate table' : 'Duplicate', icon: 'duplicate', run: () => blockAction(block.id, 'duplicate') },
      { label: contextTable ? 'Delete table' : 'Delete block', icon: 'trash', danger: true, run: () => blockAction(block.id, 'delete') },
    ]);
  }
  const textKey = (event, b) => {
    if (event.nativeEvent.isComposing || event.key !== 'Enter' || event.shiftKey || b.type !== 'text') return;
    event.preventDefault();
    const start = event.target.selectionStart, end = event.target.selectionEnd;
    let added;
    change(board => {
      const { block, siblings, index } = locateBlock(board, b.id);
      added = textBlock(block.text.slice(end)); block.text = block.text.slice(0, start); delete block.html;
      siblings.splice(index + 1, 0, added);
    }); setFocus({ id: added.id, offset: 0 });
  };
  const render = (content, depth = 0) => content.map((b, index) => <section key={b.id} data-block-id={b.id} data-cell-box={b.type === 'note' ? '' : undefined} className={`${styles.block} ${styles[b.type]} ${b.type === 'text' && !b.text && !b.html && (depth > 0 || content.length > 1) ? styles.empty : ''} ${b.type === 'note' ? styles[b.tone || 'warm'] : ''}`}>
    {!readonly && <div className={styles.insertPoint}><button type="button" aria-label={`Insert content before ${TYPES[b.type].name.toLowerCase()} ${index + 1}`} title="Insert content here" onClick={event => insertAt(b.id, depth, 'before', { element: event.currentTarget })}><Icon name="plus" size={12}/><span/></button></div>}
    {['text','heading','note'].includes(b.type) && (readonly ? <div data-cell-text className={styles.prose}>{b.html ? <span dangerouslySetInnerHTML={{ __html: clean(b.html) }}/> : b.text || (depth === 0 && content.length === 1 ? <span className={styles.placeholder}>{cardText ? 'Double-click to edit' : 'Double-click to edit · type / for blocks'}</span> : '\u00a0')}</div> : <TextField aria-label={`${TYPES[b.type].name} block`} value={b.text} placeholder={b.type === 'text' ? (depth ? '/ to insert' : cardText && node.w < 180 ? 'Type /…' : 'Type / to add content…') : b.type === 'heading' ? 'Heading' : 'Capture a thought…'} onChange={event => { patch(b.id, { text: event.target.value, html: undefined }, b.id); openMenu(event, b.id, depth); }} onClick={event => openMenu(event, b.id, depth)} onKeyUp={event => { if (['ArrowLeft','ArrowRight'].includes(event.key)) openMenu(event, b.id, depth); }} onKeyDown={event => textKey(event, b)}/>)}
    {b.type === 'divider' && <hr data-cell-box/>}
    {b.type === 'checklist' && <div className={styles.tasks}>{b.tasks.map((task, t) => <div key={t} className={`${styles.task} ${task.done ? styles.done : ''}`}>
      <TaskCheckbox readonly={readonly} label={`Complete ${task.text || `task ${t + 1}`}`} checked={task.done} onChange={() => patch(b.id, { tasks: b.tasks.map((item, i) => i === t ? { ...item, done: !item.done } : item) })}/>
      {readonly ? <span data-cell-text className={styles.taskLabel}>{task.text || 'Untitled task'}</span> : <TextField className={styles.taskLabel} aria-label={`Task ${t + 1}`} value={task.text} placeholder="To do…" onChange={event => patch(b.id, { tasks: b.tasks.map((item, i) => i === t ? { ...item, text: event.target.value } : item) }, `${b.id}-${t}`)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); patch(b.id, { tasks: [...b.tasks.slice(0, t + 1), { text: '', done: false }, ...b.tasks.slice(t + 1)] }); requestAnimationFrame(() => root.current?.querySelectorAll(`[data-block-id="${CSS.escape(b.id)}"] textarea`)[t + 1]?.focus()); } }}/>}
      {!readonly && b.tasks.length > 1 && <button type="button" className={styles.taskDelete} aria-label={`Remove task ${t + 1}`} onClick={() => patch(b.id, { tasks: b.tasks.filter((_, i) => i !== t) })}><Icon name="close" size={13}/></button>}
    </div>)}{!readonly && <button type="button" className={styles.subtle} onClick={() => patch(b.id, { tasks: [...b.tasks, { text: '', done: false }] })}><Icon name="plus" size={14}/>Add task</button>}</div>}
    {b.type === 'table' && <>
      <div data-cell-box className={styles.tableScroll}><table style={{ minWidth: b.headers.length * 190 }}>
        <thead><tr>{b.headers.map((header, col) => <th data-cell-box data-table-cell data-table-id={b.id} data-column={col} key={col}>
          {readonly ? <span data-cell-text>{header}</span> : <TextField aria-label={`Column ${col + 1} name`} value={header} onChange={event => patch(b.id, { headers: b.headers.map((h, i) => i === col ? event.target.value : h) }, `${b.id}-header-${col}`)}/>}
        </th>)}</tr></thead>
        <tbody>{b.rows.map((row, r) => <tr key={row[0].id}>{row.map((slot, col) => <td data-cell-box data-table-cell data-table-id={b.id} data-row={r} data-column={col} key={slot.id}>
          {render(slot.content, depth + 1)}
        </td>)}</tr>)}</tbody>
      </table></div>
      {!readonly && <div className={styles.tableTools}>
        <button type="button" disabled={b.rows.length >= 1000} onClick={() => tableAction(b.id, 'insert-row', b.rows.length)}><Icon name="plus" size={14}/>Row</button>
        <button type="button" disabled={b.headers.length >= 30} onClick={() => tableAction(b.id, 'insert-column', b.headers.length)}><Icon name="plus" size={14}/>Column</button>
        <button type="button" onClick={() => { const url = URL.createObjectURL(new Blob([csvText(b)], { type: 'text/csv' })); download(url, 'table.csv'); setTimeout(() => URL.revokeObjectURL(url), 1000); }}><Icon name="download" size={14}/>CSV</button>
      </div>}
    </>}
    {b.type === 'code' && <div data-cell-box className={styles.codeBox}><div data-cell-box className={styles.codeHeader}>{readonly ? <span data-cell-text>{b.language || 'Plain text'}</span> : <div className={styles.codeLanguage}>
        <select aria-label="Code language" value={b.language || 'Plain text'} onChange={event => patch(b.id, { language: event.target.value })}>
          {b.language && !CODE_LANGUAGES.includes(b.language) && <option value={b.language}>{b.language}</option>}
          {CODE_LANGUAGES.map(language => <option key={language} value={language}>{language}</option>)}
        </select><Icon name="chevron" size={12}/>
      </div>}<button type="button" onClick={async () => { try { await navigator.clipboard.writeText(b.code || ''); setMessage('Code copied'); } catch { setMessage('Could not copy. Select the code to copy it.'); } }}><Icon name="duplicate" size={14}/>Copy</button></div><Suspense fallback={<pre data-cell-text>{b.code || 'Loading editor…'}</pre>}>
        <CodeEditor value={b.code || ''} language={b.language || 'Plain text'} readOnly={readonly} autoFocus={focus?.id === b.id} onChange={code => patch(b.id, { code }, b.id)}/>
      </Suspense></div>}
    {b.type === 'image' && <figure>
      <div data-image-drop={b.id} role="group" tabIndex={canEdit ? 0 : undefined}
        aria-label={canEdit ? `Image: ${b.caption || b.filename || 'empty'}. Paste or drop an image, or press Enter to choose a file.` : undefined}
        className={`${styles.imageDrop} ${dropTarget === b.id && canEdit ? styles.imageDropActive : ''}`}
        onPointerDown={canEdit ? event => { event.stopPropagation(); if (!event.target.closest('button')) event.currentTarget.focus({ preventScroll: true }); } : undefined}
        onClick={canEdit ? stop : undefined}
        onDoubleClick={canEdit ? event => { event.stopPropagation(); setFocus({ id: b.id }); onStartEditing?.(); } : undefined}
        onKeyDown={event => { if (canEdit && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); chooseAttachment(b.id, 'image'); } }}>
        {safeAttachment(b.data, true)
          ? <div data-cell-box className={styles.imagePreview}><img data-cell-image src={b.data} alt={b.caption || b.filename || 'Attached image'} draggable={false}/></div>
          : <div className={styles.attachmentEmpty}>
              <span className={styles.attachmentIcon}><Icon name="image" size={22}/></span>
              <span>{canEdit ? 'Drop an image here' : 'No image attached'}</span>
              {canEdit && <><small>Or paste an image · up to 5 MB</small><button type="button" className={styles.subtle} onClick={() => chooseAttachment(b.id, 'image')}><Icon name="upload" size={14}/>Choose image</button></>}
            </div>}
        {canEdit && <div className={styles.imageDropHint} aria-hidden="true"><Icon name="image" size={18}/><span>{dropTarget === b.id ? (b.data ? 'Drop to replace image' : 'Drop to add image') : 'Paste or drop an image'}</span></div>}
      </div>
      {!readonly && b.data && <button type="button" className={styles.subtle} onClick={() => chooseAttachment(b.id, 'image')}><Icon name="upload" size={14}/>Replace image</button>}
      {readonly ? b.caption && <figcaption data-cell-text>{b.caption}</figcaption> : <TextField aria-label="Image caption" value={b.caption || ''} placeholder="Add a caption…" onChange={event => patch(b.id, { caption: event.target.value }, `${b.id}-caption`)}/>}
    </figure>}
    {b.type === 'link' && <div data-cell-box className={styles.linkBox}><span className={styles.attachmentIcon}><Icon name="share" size={18}/></span><div className={styles.linkBody}>{readonly ? safeURL(b.url) ? <a data-cell-text href={safeURL(b.url)} target="_blank" rel="noopener noreferrer" onPointerDown={stop} onClick={stop}>{b.url} ↗</a> : <span data-cell-text>{b.url || 'Add a link'}</span> : <TextField aria-label="Link URL" value={b.url || ''} placeholder="https://…" onChange={event => patch(b.id, { url: event.target.value }, `${b.id}-url`)}/>} {readonly ? b.description && <div data-cell-text>{b.description}</div> : <TextField aria-label="Link description" value={b.description || ''} placeholder="What is useful here?" onChange={event => patch(b.id, { description: event.target.value }, `${b.id}-description`)}/>}</div></div>}
    {b.type === 'file' && <div data-cell-box className={styles.fileBox}><span className={styles.attachmentIcon}><Icon name="attachment" size={20}/></span><div className={styles.fileBody}><b data-cell-text>{b.filename || 'Attach a file'}</b><small data-cell-text>{b.size ? `${(b.size / 1024).toFixed(0)} KB` : 'Up to 5 MB'}</small><div className={styles.fileActions}>{safeAttachment(b.data) && <a href={b.data} download={b.filename || 'attachment'} onClick={stop} onPointerDown={stop}><Icon name="download" size={14}/>Download</a>}{!readonly && <button type="button" className={styles.subtle} onClick={() => { uploadTarget.current = { id: b.id, type: b.type }; upload.current.accept = ''; upload.current.click(); }}><Icon name="upload" size={14}/>{b.data ? 'Replace file' : 'Choose file'}</button>}</div></div></div>}
  </section>);
  return <div ref={root} className={`${styles.cell} ${cardContent ? styles.cardContent : ''} ${cardText ? styles.cardText : ''} ${editing ? styles.editing : ''}`} data-cell-content onFocusCapture={event => { if (event.target.closest('[data-block-id]')) focusedBlock.current = event.target; }} onContextMenu={event => openContext(event)} onPointerDown={editing ? stop : undefined} onClick={editing ? stop : undefined} onDoubleClick={editing ? stop : undefined} onPaste={paste} onDragOver={dragOver} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(null); }} onDrop={paste} onKeyDown={event => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { openContext(event); return; }
    if (!editing && !(canEdit && event.target.closest('[data-image-drop]'))) return;
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (actions) setActions(null); else onFinish?.(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) onRedo?.(); else onUndo?.(); }
  }}>
    {editing && <div className={styles.editBar}><span>{mobileEditor ? <><b>Edit card</b><small>Type / to add content</small></> : <>Type <kbd>/</kbd> for blocks</>}</span>{mobileEditor && <button type="button" onClick={event => openContext(event, focusedBlock.current?.isConnected ? focusedBlock.current : root.current)}>Block actions</button>}<button type="button" onClick={onFinish}>Done {!mobileEditor && <kbd>esc</kbd>}</button></div>}
    <header className={styles.cellTitle}>{readonly ? <div data-cell-text>{node.titleHtml ? <span dangerouslySetInnerHTML={{ __html: clean(node.titleHtml) }}/> : node.title}</div> : <TextField aria-label="Card title" value={node.title} onChange={event => onChange(node.id, { title: event.target.value, titleHtml: undefined }, 'title')}/>}</header>
    <div className={styles.content}>{render(node.content)}</div>
    {canEdit && <input ref={upload} type="file" hidden onChange={event => { const target = uploadTarget.current; if (target) void attach(event.target.files[0], target.id, target.type); event.target.value = ''; }}/>}
    {message && <div role="status" className={styles.message}>{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><Icon name="close" size={14}/></button></div>}
    {actions && editing && contextEntry && <CanvasContextMenu anchor={actions.anchor} title={contextTitle} groups={contextGroups} onClose={closeContext}/>}
    {menu && editing && <CellSlashMenu key={`${menu.id}-${menu.range?.query || ''}`} query={menu.range?.query} depth={menu.depth} anchor={menu.anchor} searchable={Boolean(menu.position)} onChoose={choose} onClose={() => setMenu(null)}/>}
  </div>;
}
