// A selection can pause during a drag or a held keyboard shortcut. Wait for both
// the gesture to finish and selectionchange to settle before showing its tools.
export function observeTextSelection(editor, { onSave, onShow, onHide, delay = 180 }) {
  const doc = editor.ownerDocument, view = doc.defaultView;
  let timer, pointer = null, composing = false, dismissed = null, shown = null, disposed = false;
  const keys = new Set();
  const inTools = target => target?.closest?.('[data-rich-text-tools]');
  const read = () => {
    const selection = view.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!editor.isConnected || !editor.contains(range.commonAncestorContainer)) return null;
    onSave(range.cloneRange());
    if (range.collapsed || !range.toString().trim()) return null;
    const before = range.cloneRange();
    before.selectNodeContents(editor); before.setEnd(range.startContainer, range.startOffset);
    return { range: range.cloneRange(), key: `${before.toString().length}:${range.toString()}` };
  };
  const cancel = () => { view.clearTimeout(timer); timer = undefined; };
  const hide = () => { cancel(); if (shown !== null) onHide(); shown = null; };
  const changed = () => {
    if (disposed) return;
    const current = read();
    cancel();
    if (!current || composing || pointer !== null || keys.size || current.key === dismissed) { hide(); return; }
    // Formatting can replace text nodes. Keep the toolbar steady for the same
    // text selection while refreshing its range and active formatting states.
    if (shown === current.key) { onShow(current.range); return; }
    hide();
    timer = view.setTimeout(() => {
      timer = undefined;
      const settled = read();
      if (disposed || composing || pointer !== null || keys.size || !settled || settled.key === dismissed) return;
      if (settled.key !== current.key) { changed(); return; }
      shown = settled.key; onShow(settled.range);
    }, delay);
  };
  const dismiss = () => { dismissed = read()?.key ?? null; hide(); };
  const pointerDown = event => {
    if (inTools(event.target)) return;
    if (event.button === 0 && editor.contains(event.target)) {
      dismissed = null; pointer = event.pointerId; hide();
    } else dismiss();
  };
  const pointerUp = event => {
    if (event.pointerId !== pointer) return;
    pointer = null; changed();
  };
  const pointerCancel = event => { if (event.pointerId === pointer) { pointer = null; dismiss(); } };
  const keyDown = event => {
    if (!editor.contains(event.target) || inTools(event.target)) return;
    if (event.key === 'Escape') { dismiss(); return; }
    if (['Shift', 'Control', 'Meta', 'Alt', 'CapsLock', 'Tab'].includes(event.key)) return;
    dismissed = null; keys.add(event.code || event.key); hide();
  };
  const keyUp = event => { if (keys.delete(event.code || event.key)) changed(); };
  const compositionStart = event => { if (editor.contains(event.target)) { composing = true; hide(); } };
  const compositionEnd = event => { if (editor.contains(event.target)) { composing = false; changed(); } };
  const focusOut = event => { if (!editor.contains(event.relatedTarget) && !inTools(event.relatedTarget)) dismiss(); };
  const blur = () => { pointer = null; keys.clear(); dismiss(); };
  const listeners = [
    [doc, 'selectionchange', changed], [doc, 'pointerdown', pointerDown],
    [doc, 'pointerup', pointerUp], [doc, 'pointercancel', pointerCancel],
    [doc, 'keydown', keyDown], [doc, 'keyup', keyUp],
    [editor, 'compositionstart', compositionStart], [editor, 'compositionend', compositionEnd],
    [editor, 'focusout', focusOut], [view, 'blur', blur],
  ];
  for (const [target, name, callback] of listeners) target.addEventListener(name, callback, true);
  return {
    dismiss,
    dispose() {
      disposed = true; cancel();
      for (const [target, name, callback] of listeners) target.removeEventListener(name, callback, true);
    },
  };
}
