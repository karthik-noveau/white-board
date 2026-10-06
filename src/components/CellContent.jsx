import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import RichBlockEditor from './RichBlockEditor';
import ResizableTable from './ResizableTable';
import ImageViewer from './ImageViewer';
import ImageMarkup from './ImageMarkup';
import MoveBlocksDialog from './MoveBlocksDialog';
import { blockDragPreview } from '../lib/blockDrag';
import { distributeColumnWidths, fitColumnWidth } from '../lib/tableSizing';
import { useBlockWorkspace } from '../lib/blockWorkspace';
import { BLOCK_MIME, blockPayload, readBlockPayload, blocksFromClipboard, readBlockClipboard, saveBlockClipboard, selectedBlocks, blockSelection, removeBlocks } from '../lib/blockEditing';
import { cleanBlockHTML, resolveCardHTML, cardIdFromHref, setEditableOffset } from '../lib/richContent';
import Icon from './BoardIcon';
import CellSlashMenu from './CellSlashMenu';
import CanvasContextMenu from './CanvasContextMenu';
import MobileEditorDialog from './MobileEditorDialog';
import { isCardContent, isCardText } from '../lib/boardAppearance';
import { CODE_LANGUAGES } from '../lib/codeLanguages';
import { mobileQuery } from '../lib/useMediaQuery';
import { TYPES, IMAGE_TYPES, attachmentFromTransfer, placeAttachment, cloneContent, contentText, csvText, ensureEditor, insertCommand, insertRelativeBlock, editTable, locateBlock, readAttachment, safeAttachment, safeURL, textBlock, newContent, normalizeCellContent } from '../lib/cellContent';
import styles from '../styles/cellContent.module.css';

const stop = event => event.stopPropagation();
const CodeEditor = lazy(() => import('./CodeEditor'));
const clean = cleanBlockHTML;
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
  const pendingContext = useRef(null);
  useEffect(() => { if (!props.editing) pendingContext.current = null; }, [props.editing]);
  const editWithContext = actions => {
    pendingContext.current = actions;
    props.onStartEditing?.();
  };
  return props.editing ? <CellEditingSession {...props} initialActions={pendingContext.current}/>
    : <CellDocument {...props} onEditContext={editWithContext}/>;
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

function CellDocument({ node, editing = false, mobileEditor = false, initialActions = null, onEditContext, onChange, onFinish, onStartEditing, onHeight, onUndo, onRedo }) {
  const workspace = useBlockWorkspace();
  const [imageId, setImageId] = useState(null), [blockDrop, setBlockDrop] = useState(null), [movingIds, setMovingIds] = useState(null);
  const imageBlock = imageId && locateBlock({cells:[node]}, imageId)?.block;
  const root = useRef(null), current = useRef(node), upload = useRef(null), uploadTarget = useRef(null);
  const focusedBlock = useRef(null);
  const pendingAttachments = useRef(new Map()), writable = useRef(false);
  current.current = node;
  const [menu, setMenu] = useState(null), [actions, setActions] = useState(mobileEditor ? null : initialActions), [message, setMessage] = useState('');
  const [focus, setFocus] = useState(null), [dropTarget, setDropTarget] = useState(null);
  const canEdit = Boolean(onChange && !node.locked && (editing || onStartEditing));
  writable.current = canEdit;
  const readonly = !editing || !canEdit;
  const selectedIds = !readonly && workspace.selection?.cardId === node.id ? workspace.selection.ids : [];
  const cardContent = !mobileEditor && isCardContent(node), cardText = cardContent && isCardText(node);
  useLayoutEffect(() => {
    if (!mobileEditor || !initialActions) return;
    // A saved block opens a new mobile dialog. Anchor its pending menu only
    // after that dialog mounts so the menu remains in the modal's top layer.
    const frame = requestAnimationFrame(() => {
      const id = initialActions.nestedId || initialActions.id;
      const element = root.current?.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
      setActions({ ...initialActions, anchor: { element, container: root.current?.closest('dialog') } });
    });
    return () => cancelAnimationFrame(frame);
  }, [mobileEditor, initialActions]);
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
    const element = focus?.image ? block?.querySelector('[data-image-drop]') : focus ? block?.querySelector('[data-rich-block],[data-code-editor] .cm-content,textarea') || block?.querySelector('input:not([type]),input[type="text"]') : root.current?.querySelector('textarea');
    element?.focus({ preventScroll: true });
    if (focus?.offset != null) { if (element?.matches('[data-rich-block]')) setEditableOffset(element, focus.offset); else element?.setSelectionRange?.(focus.offset, focus.offset); }
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
    normalizeCellContent(board.cells[0].content);
    const content = board.cells[0].content;
    onChange(node.id, { content, note: contentText(content), noteHtml: undefined, w: board.cells[0].w }, key);
  };
  const patch = (id, values, key = null) => change(board => { const entry = locateBlock(board, id); if (entry) Object.assign(entry.block, values); }, key);
  const insertRichBlocks = (id, blocks, parts) => {
    let added;
    change(board => {
      const entry = locateBlock(board, id); if (!entry) return false;
      const replacements = [];
      if (parts?.before.text) replacements.push({ ...entry.block, ...parts.before });
      replacements.push(...blocks);
      if (parts?.after.text) replacements.push({ ...textBlock(), ...parts.after });
      if (!parts) entry.siblings.splice(entry.index + 1, 0, ...blocks);
      else entry.siblings.splice(entry.index, 1, ...replacements);
      ensureEditor(entry.siblings);
      if (entry.depth === 0 && blocks.some(block => block.type === 'table')) board.cells[0].w = Math.max(520, board.cells[0].w || 0);
      const last = blocks.at(-1), index = entry.siblings.findIndex(block => block.id === last.id);
      added = ['text','heading','note'].includes(last.type) ? last : entry.siblings[index + 1] || last;
    });
    if (added) setFocus({ id: added.id, offset: added.text?.length || 0 });
  };
  const choose = type => {
    let added;
    if (menu.parts) { added = newContent(type); insertRichBlocks(menu.id, [added], menu.parts); }
    else change(board => { added = menu.position ? insertRelativeBlock(board, menu.id, type, menu.position) : insertCommand(board, menu.id, type, menu.range); if (type === 'table' && menu.depth === 0) board.cells[0].w = Math.max(520, board.cells[0].w || 0); });
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
    const transfer = event.clipboardData || event.dataTransfer;
    const raw = transfer?.getData(BLOCK_MIME);
    const payload = event.type === 'paste' ? blocksFromClipboard(transfer) : readBlockPayload(raw);
    if (payload && event.type === 'paste' && event.target.closest('input,textarea,[contenteditable]')) return;
    if (payload) {
      event.preventDefault(); event.stopPropagation(); setBlockDrop(null);
      if (canEdit && workspace.onTransfer) {
        const slot = event.target.closest('[data-table-cell][data-slot-id]');
        const closest = event.target.closest('[data-block-id]');
        const element = slot && !slot.contains(closest) ? null : closest;
        const rect = element?.getBoundingClientRect();
        workspace.onTransfer(payload, {cardId:node.id, blockId:element?.dataset.blockId, ownerId:!element ? slot?.getAttribute('data-slot-id') : undefined, position:event.type === 'drop' && event.clientY < rect?.top + rect?.height/2 ? 'before' : 'after'}, event.type === 'drop' && payload.boardId === workspace.boardId && !event.altKey);
      }
      return;
    }
    if (raw) { event.preventDefault(); event.stopPropagation(); return; }
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
    if (event.dataTransfer.types.includes(BLOCK_MIME)) {
      event.preventDefault(); event.stopPropagation();
      event.dataTransfer.dropEffect = canEdit ? event.altKey ? 'copy' : 'move' : 'none';
      if (canEdit) {
        const slot = event.target.closest('[data-table-cell][data-slot-id]'), closest = event.target.closest('[data-block-id]');
        const element = slot && !slot.contains(closest) ? slot : closest, rect = element?.getBoundingClientRect();
        setBlockDrop({id:element?.dataset.blockId || null,slotId:element?.dataset.slotId,position:event.clientY < rect?.top+rect?.height/2 ? 'before':'after'});
      }
      return;
    }
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault(); event.stopPropagation();
    const id = event.target.closest('[data-block-id]')?.dataset.blockId;
    const image = id && locateBlock({ cells: [current.current] }, id)?.block.type === 'image';
    event.dataTransfer.dropEffect = canEdit && (editing || image) ? 'copy' : 'none';
    setDropTarget(canEdit && image ? id : null);
  };
  const selectBlock = (event, id) => {
    event.stopPropagation();
    const ids = blockSelection(node.content, selectedIds, id, {range:event.shiftKey,toggle:event.metaKey||event.ctrlKey||(event.nativeEvent.pointerType==='touch'&&selectedIds.length>0)});
    workspace.setSelection?.({cardId:node.id,ids});
  };
  const copyBlocks = async (ids, event) => {
    const payload = blockPayload(current.current, ids, workspace.boardId); if (!payload) return false;
    saveBlockClipboard(payload);
    if (event?.clipboardData) { event.preventDefault(); event.stopPropagation(); event.clipboardData.setData(BLOCK_MIME,JSON.stringify(payload)); event.clipboardData.setData('text/plain',contentText(payload.blocks)); }
    else { try { await navigator.clipboard.writeText(contentText(payload.blocks)); } catch { /* Paste blocks remains available in the context menu. */ } }
    setMessage(`${payload.blocks.length} ${payload.blocks.length===1?'block':'blocks'} copied`); return true;
  };
  const deleteBlocks = ids => { const content=removeBlocks(current.current.content,ids);onChange(node.id, {content,note:contentText(content),noteHtml:undefined}); workspace.setSelection?.(null); setActions(null); };
  const startBlockDrag = (event, id) => {
    event.stopPropagation();
    if (readonly || !workspace.onTransfer) { event.preventDefault(); return; }
    const ids = selectedIds.includes(id) ? selectedIds : [id], payload = blockPayload(current.current, ids, workspace.boardId);
    if (!payload) { event.preventDefault(); return; }
    workspace.setSelection?.({cardId:node.id,ids});
    event.dataTransfer.effectAllowed='copyMove'; event.dataTransfer.setData(BLOCK_MIME,JSON.stringify(payload));event.dataTransfer.setData('text/plain',contentText(payload.blocks));
    blockDragPreview(event,payload.blocks.length,styles.dragPreview);
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
    const target = element.closest('[data-block-id]');
    const slot = element.closest('[data-table-cell]');
    // The card title and padding belong to the card's menu, not its last block.
    if (!target && !slot && event.type === 'contextmenu') return;
    event.preventDefault(); event.stopPropagation();
    const rect = element.getBoundingClientRect();
    const pointer = event.type === 'contextmenu' && (event.clientX || event.clientY);
    setMenu(null);
    const nextActions = {
      id: slot?.dataset.tableId || target?.dataset.blockId || node.content.at(-1)?.id,
      nestedId: slot && target?.dataset.blockId !== slot.dataset.tableId ? target?.dataset.blockId : null,
      tableId: slot?.dataset.tableId,
      row: slot?.hasAttribute('data-row') ? Number(slot.dataset.row) : null,
      column: slot ? Number(slot.dataset.column) : null,
      task: element.closest('[data-task-index]') ? Number(element.closest('[data-task-index]').dataset.taskIndex) : null,
      anchor: { container: element.closest('dialog[open]'), left: pointer ? event.clientX : rect.left, top: pointer ? event.clientY : rect.bottom + 4 },
    };
    if (editing) setActions(nextActions);
    else onEditContext?.(nextActions);
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
  const contextBlock = nestedEntry?.block || contextEntry?.block;
  const contextIds = contextBlock && selectedIds.includes(contextBlock.id) ? selectedBlocks(node.content,selectedIds).map(block=>block.id) : contextBlock ? [contextBlock.id] : [];
  const contextCount = contextIds.length;
  const runContext = run => () => { closeContext(true); run(); };
  const copyContextText = text => runContext(async () => {
    try { await navigator.clipboard.writeText(text); setMessage('Copied to clipboard'); }
    catch { setMessage('Could not copy. Select the text and copy it.'); }
  });
  if (contextBlock?.type === 'code') contextGroups.push([
    { label: 'Copy code', icon: 'duplicate', run: copyContextText(contextBlock.code || '') },
  ]);
  if (contextBlock?.type === 'image' || contextBlock?.type === 'file') contextGroups.push([
    { label: contextBlock.data ? `Replace ${contextBlock.type}` : `Upload ${contextBlock.type}`, icon: 'upload', run: runContext(() => chooseAttachment(contextBlock.id, contextBlock.type)) },
    { label: `Download ${contextBlock.type}`, icon: 'download', disabled: !safeAttachment(contextBlock.data, contextBlock.type === 'image'), run: runContext(() => download(contextBlock.data, contextBlock.filename || contextBlock.type)) },
  ]);
  if (contextBlock?.type === 'link') contextGroups.push([
    { label: 'Open link', icon: 'share', disabled: !safeURL(contextBlock.url), run: runContext(() => window.open(safeURL(contextBlock.url), '_blank', 'noopener,noreferrer')) },
    { label: 'Copy link', icon: 'duplicate', disabled: !contextBlock.url, run: copyContextText(contextBlock.url || '') },
  ]);
  if (contextBlock?.type === 'checklist') {
    const index = actions.task, task = index !== null ? contextBlock.tasks[index] : null;
    contextGroups.push([
      { label: task ? 'Add task below' : 'Add task', icon: 'plus', run: runContext(() => { const tasks = [...contextBlock.tasks]; tasks.splice(task ? index + 1 : tasks.length, 0, { text: '', done: false }); patch(contextBlock.id, { tasks }); }) },
      ...(task ? [{ label: 'Delete task', icon: 'trash', danger: true, disabled: contextBlock.tasks.length === 1, run: runContext(() => patch(contextBlock.id, { tasks: contextBlock.tasks.filter((_, i) => i !== index) })) }] : []),
    ]);
  }
  if (contextBlock?.text && ['text', 'heading', 'note'].includes(contextBlock.type)) contextGroups.push([
    { label: 'Copy text', icon: 'duplicate', run: copyContextText(contextBlock.text || '') },
  ]);
  if (contextBlock && workspace.onTransfer) {
    const payload = readBlockClipboard();
    contextGroups.unshift([
      {label:contextCount>1?`Copy ${contextCount} blocks`:'Copy block',icon:'duplicate',hint:'⌘C',run:()=>{void copyBlocks(contextIds);closeContext(true)}},
      ...(payload?[{label:'Paste blocks after',icon:'paste',run:()=>{workspace.onTransfer(payload,{cardId:node.id,blockId:contextBlock.id,position:'after'});closeContext(true)}}]:[]),
      {label:'Move to card…',icon:'forward',run:()=>{setActions(null);setMovingIds(contextIds)}},
      ...(contextCount>1?[{label:`Delete ${contextCount} blocks`,icon:'trash',danger:true,run:()=>deleteBlocks(contextIds)}]:[]),
    ]);
  }
  // Nested blocks retain their actions when the visible menu handles are removed.
  if (nestedEntry) {
    const { block, depth, index, siblings } = nestedEntry;
    const name = TYPES[block.type].name.toLowerCase();
    contextGroups.push([{ label: 'Cell content', icon: 'box', children: [[
      { label: `Insert before ${name}`, run: () => insertAt(block.id, depth, 'before', actions.anchor) },
      { label: `Insert after ${name}`, run: () => insertAt(block.id, depth, 'after', actions.anchor) },
      { label: `Move ${name} up`, icon: 'upload', disabled: index === 0, run: () => blockAction(block.id, 'up') },
      { label: `Move ${name} down`, icon: 'download', disabled: index === siblings.length - 1, run: () => blockAction(block.id, 'down') },
      { label: `Duplicate ${name}`, icon: 'duplicate', run: () => blockAction(block.id, 'duplicate') },
      { label: `Delete ${name}`, icon: 'trash', danger: true, run: () => blockAction(block.id, 'delete') },
    ]] }]);
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
      const element=root.current?.querySelector(`[data-block-id="${CSS.escape(block.id)}"] table`);
      const measured=element ? [...element.rows[0].cells].map(cell=>cell.offsetWidth) : block.columnWidths || block.headers.map(()=>190);
      contextGroups.push([
        ...(column!==null?[{label:'Fit column to content',icon:'grid',run:runContext(()=>{
          const context=document.createElement('canvas').getContext('2d'); context.font=element?getComputedStyle(element).font:'14px sans-serif';
          const widths=[...measured]; widths[column]=fitColumnWidth(block,column,text=>context.measureText(text).width); patch(block.id,{columnWidths:widths});
        })}]:[]),
        {label:'Distribute columns evenly',icon:'grid',disabled:block.headers.length<2,run:runContext(()=>patch(block.id,{columnWidths:distributeColumnWidths(measured)}))},
      ]);
      contextGroups.push([
        ...(row !== null ? [{ label: 'Delete row', icon: 'trash', danger: true, run: () => tableAction(block.id, 'delete-row', row) }] : []),
        ...(column !== null ? [{ label: 'Delete column', icon: 'trash', danger: true, disabled: block.headers.length === 1, run: () => tableAction(block.id, 'delete-column', column) }] : []),
      ]);
    }
    const blockGroups = [[
      { label: contextTable ? 'Insert block before table' : 'Insert block before', run: () => insertAt(block.id, depth, 'before', actions.anchor) },
      { label: contextTable ? 'Insert block after table' : 'Insert block after', run: () => insertAt(block.id, depth, 'after', actions.anchor) },
    ], [
      ...(!contextTable ? [
        { label: 'Move up', icon: 'upload', disabled: index === 0, run: () => blockAction(block.id, 'up') },
        { label: 'Move down', icon: 'download', disabled: index === siblings.length - 1, run: () => blockAction(block.id, 'down') },
      ] : []),
      { label: contextTable ? 'Duplicate table' : 'Duplicate', icon: 'duplicate', run: () => blockAction(block.id, 'duplicate') },
      { label: contextTable ? 'Delete table' : 'Delete block', icon: 'trash', danger: true, run: () => blockAction(block.id, 'delete') },
    ]];
    if (contextTable) contextGroups.push([{ label: 'Table actions', icon: 'grid', children: blockGroups }]);
    else contextGroups.push(...blockGroups);
  }
  const render = (content, depth = 0) => content.map((b, index) => <section key={b.id} data-block-id={b.id} data-heading-level={b.type==='heading'?b.level||2:undefined} data-cell-box={b.type === 'note' ? '' : undefined} data-block-selected={selectedIds.includes(b.id)||undefined} data-drop-position={blockDrop?.id===b.id?blockDrop.position:undefined} className={`${styles.block} ${styles[b.type]} ${b.type === 'text' && !b.text && !b.html && (depth > 0 || content.length > 1) ? styles.empty : ''} ${b.type === 'note' ? styles[b.tone || 'warm'] : ''}`}>
    {!readonly && workspace.onTransfer && <button type="button" data-block-handle className={styles.blockHandle} draggable aria-label={`Select or drag ${TYPES[b.type].name.toLowerCase()} block ${index+1}`} aria-pressed={selectedIds.includes(b.id)} title="Drag to move · Click to select · Shift-click for a range" onPointerDown={stop} onClick={event=>selectBlock(event,b.id)} onDoubleClick={stop} onDragStart={event=>startBlockDrag(event,b.id)} onDragEnd={()=>setBlockDrop(null)} onKeyDown={event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();if(event.altKey)blockAction(b.id,event.key==='ArrowUp'?'up':'down')}if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();event.stopPropagation();deleteBlocks(selectedIds.includes(b.id)?selectedIds:[b.id])}}}><span>⠿</span></button>}
    {!readonly && <div className={styles.insertPoint}><button type="button" aria-label={`Insert content before ${TYPES[b.type].name.toLowerCase()} ${index + 1}`} title="Insert content here" onClick={event => insertAt(b.id, depth, 'before', { element: event.currentTarget })}><Icon name="plus" size={12}/><span/></button></div>}
    {['text','heading','note'].includes(b.type) && (readonly ? <div data-cell-text role={b.type==='heading'?'heading':undefined} aria-level={b.type==='heading'?b.level||2:undefined} className={styles.prose}>{b.html ? <span dangerouslySetInnerHTML={{ __html: resolveCardHTML(b.html,workspace.nodes) }}/> : b.text || (depth === 0 && content.length === 1 ? <span className={styles.placeholder}>{cardText ? 'Double-click to edit' : 'Double-click to edit · type / for blocks'}</span> : '\u00a0')}</div> : <RichBlockEditor depth={depth} label={`${TYPES[b.type].name} block`} text={b.text} html={b.html} placeholder={b.type==='text'?(depth?'/ to insert':'Type / to add content…'):b.type==='heading'?'Heading':'Capture a thought…'} onChange={values=>patch(b.id,values,b.id)} onMessage={setMessage}
      onSlash={query=>setMenu(query?{...query,id:b.id,depth,range:{query:query.query}}:null)}
      onPasteBlocks={(blocks,parts)=>insertRichBlocks(b.id,blocks,parts)}
      onSplit={b.type==='text'?parts=>{if(!parts)return;const added={...textBlock(),...parts.after};change(board=>{const entry=locateBlock(board,b.id);Object.assign(entry.block,parts.before);entry.siblings.splice(entry.index+1,0,added);ensureEditor(entry.siblings)});setFocus({id:added.id,offset:0})}:undefined}/>)}
    {b.type === 'divider' && <hr data-cell-box/>}
    {b.type === 'checklist' && <div className={styles.tasks}>{b.tasks.map((task, t) => <div key={t} data-task-index={t} className={`${styles.task} ${task.done ? styles.done : ''}`}>
      <TaskCheckbox readonly={readonly} label={`Complete ${task.text || `task ${t + 1}`}`} checked={task.done} onChange={() => patch(b.id, { tasks: b.tasks.map((item, i) => i === t ? { ...item, done: !item.done } : item) })}/>
      {readonly ? <span data-cell-text className={styles.taskLabel}>{task.html?<span dangerouslySetInnerHTML={{__html:resolveCardHTML(task.html,workspace.nodes)}}/>:task.text || 'Untitled task'}</span> : <RichBlockEditor className={styles.taskLabel} label={`Task ${t+1}`} text={task.text} html={task.html} placeholder="To do…" onMessage={setMessage} onChange={values=>patch(b.id,{tasks:b.tasks.map((item,i)=>i===t?{...item,...values}:item)},`${b.id}-${t}`)} onSplit={parts=>{if(!parts)return;patch(b.id,{tasks:[...b.tasks.slice(0,t),{...task,...parts.before},{...parts.after,done:false},...b.tasks.slice(t+1)]});requestAnimationFrame(()=>root.current?.querySelectorAll(`[data-block-id="${CSS.escape(b.id)}"] [data-rich-block]`)[t+1]?.focus())}}/>}
      {!readonly && b.tasks.length > 1 && <button type="button" className={styles.taskDelete} aria-label={`Remove task ${t + 1}`} onClick={() => patch(b.id, { tasks: b.tasks.filter((_, i) => i !== t) })}><Icon name="close" size={13}/></button>}
    </div>)}{!readonly && <button type="button" className={styles.subtle} onClick={() => patch(b.id, { tasks: [...b.tasks, { text: '', done: false }] })}><Icon name="plus" size={14}/>Add task</button>}</div>}
    {b.type === 'table' && <>
      <ResizableTable block={b} readonly={readonly} onWidths={columnWidths=>patch(b.id,{columnWidths})} header={(header,col)=>readonly?<span data-cell-text>{header}</span>:<TextField aria-label={`Column ${col+1} name`} value={header} onChange={event=>patch(b.id,{headers:b.headers.map((h,i)=>i===col?event.target.value:h)},`${b.id}-header-${col}`)}/>}>
        {b.rows.map((row,r)=><tr key={row[0].id}>{row.map((slot,col)=><td data-cell-box data-table-cell data-slot-id={slot.id} data-drop-slot={blockDrop?.slotId===slot.id||undefined} data-table-id={b.id} data-row={r} data-column={col} key={slot.id}>{render(slot.content,depth+1)}</td>)}</tr>)}
      </ResizableTable>
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
        </select>
      </div>}<button type="button" onClick={async () => { try { await navigator.clipboard.writeText(b.code || ''); setMessage('Code copied'); } catch { setMessage('Could not copy. Select the code to copy it.'); } }}><Icon name="duplicate" size={14}/>Copy</button></div><Suspense fallback={<pre data-cell-text>{b.code || 'Loading editor…'}</pre>}>
        <CodeEditor value={b.code || ''} language={b.language || 'Plain text'} readOnly={readonly} autoFocus={focus?.id === b.id} onChange={code => patch(b.id, { code }, b.id)}/>
      </Suspense></div>}
    {b.type === 'image' && <figure>
      <div data-image-drop={b.id} role="group" tabIndex={canEdit ? 0 : undefined}
        aria-label={canEdit ? `Image: ${b.caption || b.filename || 'empty'}. Paste or drop an image, or press Enter to choose a file.` : undefined}
        className={`${styles.imageDrop} ${dropTarget === b.id && canEdit ? styles.imageDropActive : ''}`}
        onPointerDown={canEdit ? event => { event.stopPropagation(); if (!event.target.closest('button')) event.currentTarget.focus({ preventScroll: true }); } : undefined}
        onClick={canEdit ? stop : undefined}
        onDoubleClick={event=>{event.stopPropagation();if(b.data)setImageId(b.id)}}
        onKeyDown={event => { if (canEdit && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); if(b.data)setImageId(b.id);else chooseAttachment(b.id, 'image'); } }}>
        {safeAttachment(b.data, true)
          ? <div data-cell-box className={styles.imagePreview}><div className={styles.imageWithMarkup}><img data-cell-image src={b.data} alt={b.caption || b.filename || 'Attached image'} draggable={false}/><ImageMarkup marks={b.annotations} width={b.naturalWidth||1000} height={b.naturalHeight||1000}/></div><button type="button" className={styles.imageOpen} aria-label="Open image viewer" title="View full size and annotate" onClick={event=>{event.stopPropagation();setImageId(b.id)}}><Icon name="fit" size={17}/></button></div>
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
  return <div ref={root} className={`${styles.cell} ${cardContent ? styles.cardContent : ''} ${cardText ? styles.cardText : ''} ${editing ? styles.editing : ''}`} data-cell-content data-block-drop={blockDrop?true:undefined} onFocusCapture={event => { if (event.target.closest('[data-block-id]')) focusedBlock.current = event.target; }} onContextMenu={event => openContext(event)} onPointerDown={editing ? stop : undefined} onClick={event=>{const link=event.target.closest('a[data-card-reference]');if(link&&(readonly||event.metaKey||event.ctrlKey)){event.preventDefault();event.stopPropagation();const id=cardIdFromHref(link.getAttribute('href'));workspace.onNavigate?.(id);return}if(editing)event.stopPropagation();if(!event.target.closest('[data-block-handle],[data-cell-menu]'))workspace.setSelection?.(null)}} onDoubleClick={editing ? stop : undefined} onCopy={event=>{if(selectedIds.length&&!event.target.closest('textarea,input,[contenteditable]'))void copyBlocks(selectedIds,event)}} onCut={event=>{if(selectedIds.length&&canEdit&&!event.target.closest('textarea,input,[contenteditable]')){void copyBlocks(selectedIds,event);deleteBlocks(selectedIds)}}} onPaste={paste} onDragOver={dragOver} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) {setDropTarget(null);setBlockDrop(null);} }} onDrop={paste} onKeyDown={event => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { openContext(event); return; }
    if (event.key === 'Escape' && selectedIds.length) {event.preventDefault();event.stopPropagation();workspace.setSelection?.(null);return;}
    if (!editing && !(canEdit && event.target.closest('[data-image-drop]'))) return;
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (actions) setActions(null); else onFinish?.(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) onRedo?.(); else onUndo?.(); }
  }}>
    {editing && <div className={styles.editBar}><span>{mobileEditor ? <><b>Edit card</b><small>Type / to add content</small></> : <>Type <kbd>/</kbd> for blocks</>}</span>{mobileEditor && <button type="button" onClick={event => openContext(event, focusedBlock.current?.isConnected ? focusedBlock.current : root.current)}>Block actions</button>}<button type="button" onClick={onFinish}>Done {!mobileEditor && <kbd>esc</kbd>}</button></div>}
    {!readonly&&selectedIds.length>0&&<div data-cell-menu className={styles.blockSelectionBar} role="toolbar" aria-label="Selected blocks"><span>{selectedBlocks(node.content,selectedIds).length} selected</span><button type="button" aria-label="Copy selected blocks" title="Copy selected blocks" onClick={()=>void copyBlocks(selectedIds)}><Icon name="duplicate" size={16}/></button><button type="button" onClick={()=>setMovingIds(selectedIds)}><Icon name="forward" size={14}/>Move to card</button><button type="button" aria-label="Delete selected blocks" onClick={()=>deleteBlocks(selectedIds)}><Icon name="trash" size={14}/></button><button type="button" aria-label="Clear block selection" onClick={()=>workspace.setSelection?.(null)}><Icon name="close" size={14}/></button></div>}
    {movingIds&&<MoveBlocksDialog nodes={workspace.nodes} sourceId={node.id} count={selectedBlocks(node.content,movingIds).length} onClose={()=>setMovingIds(null)} onChoose={card=>{
      const payload=blockPayload(current.current,movingIds,workspace.boardId);
      if(payload&&workspace.onTransfer?.(payload,{cardId:card.id},true)){setMovingIds(null);onFinish?.();workspace.onNavigate?.(card.id);}
    }}/>}
    {imageBlock&&<ImageViewer key={imageBlock.id} block={imageBlock} editable={canEdit} onSave={values=>patch(imageBlock.id,values)} onClose={()=>setImageId(null)}/>}
    <header className={styles.cellTitle}>{readonly ? <div data-cell-text>{node.titleHtml ? <span dangerouslySetInnerHTML={{ __html: clean(node.titleHtml) }}/> : node.title}</div> : <TextField aria-label="Card title" value={node.title} onChange={event => onChange(node.id, { title: event.target.value, titleHtml: undefined }, 'title')}/>}</header>
    <div className={styles.content}>{render(node.content)}</div>
    {canEdit && <input ref={upload} type="file" hidden onChange={event => { const target = uploadTarget.current; if (target) void attach(event.target.files[0], target.id, target.type); event.target.value = ''; }}/>}
    {message && <div role="status" className={styles.message}>{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><Icon name="close" size={14}/></button></div>}
    {actions && editing && contextEntry && <CanvasContextMenu anchor={actions.anchor} title={contextTitle} groups={contextGroups} onClose={closeContext}/>}
    {menu && editing && <CellSlashMenu key={`${menu.id}-${menu.range?.query || ''}`} query={menu.range?.query} depth={menu.depth} anchor={menu.anchor} searchable={Boolean(menu.position)} onChoose={choose} onClose={() => setMenu(null)}/>}
  </div>;
}
