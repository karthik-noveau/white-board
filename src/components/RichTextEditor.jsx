import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useMediaQuery from "../lib/useMediaQuery";
import styles from "../styles/canvas.module.css";
import Icon from "./BoardIcon";

const commands = ["bold", "italic", "underline", "strikeThrough", "insertOrderedList", "insertUnorderedList"];
const stopPropagation = event => event.stopPropagation();

export default function RichTextEditor({ node, onChange, onFinish }) {
  const rootRef = useRef(null);
  const mobileDialogRef = useRef(null);
  // Keep the same editor DOM during rotation so the caret and draft survive.
  const compact = useMediaQuery();
  const [mobile] = useState(compact);
  const titleRef = useRef(null);
  const noteRef = useRef(null);
  const savedSelection = useRef(null);
  const finishing = useRef(false);
  const prompting = useRef(false);
  const [initialContent] = useState(() => ({ ...node }));
  const [activeFormats, setActiveFormats] = useState({});

  useLayoutEffect(() => {
    const dialog = mobileDialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  // The browser owns the editable DOM for this session. React must not replace
  // it on autosave: doing so loses the caret, selected text, and native undo.
  useLayoutEffect(() => {
    for (const [name, ref] of [["title", titleRef], ["note", noteRef]]) {
      if (initialContent[`${name}Html`] != null) ref.current.innerHTML = initialContent[`${name}Html`];
      else ref.current.textContent = initialContent[name] || "";
    }
    titleRef.current.focus({ preventScroll: true });
  }, [initialContent]);

  const rememberSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const editor = [titleRef.current, noteRef.current].find(element => element?.contains(range.commonAncestorContainer));
    if (!editor) return;
    // Preserve collapsed ranges too, so formatting at the caret applies to
    // the next input instead of restoring an earlier highlighted word.
    savedSelection.current = { editor, range: range.cloneRange() };
    const block = document.queryCommandValue("formatBlock").toLowerCase();
    const formats = Object.fromEntries(commands.map(command => [command, document.queryCommandState(command)]));
    formats.blockquote = block === "blockquote";
    formats.pre = block === "pre";
    setActiveFormats(previous => Object.keys(formats).every(key => previous[key] === formats[key]) ? previous : formats);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", rememberSelection);
    rememberSelection();
    return () => document.removeEventListener("selectionchange", rememberSelection);
  }, [rememberSelection]);

  const commit = useCallback(() => {
    if (!titleRef.current || !noteRef.current) return;
    onChange(node.id, {
      title: titleRef.current.innerText.trim() || "Untitled",
      note: noteRef.current.innerText.trim(),
      titleHtml: titleRef.current.innerHTML,
      noteHtml: noteRef.current.innerHTML,
    });
  }, [node.id, onChange]);

  const finish = useCallback(() => {
    if (finishing.current || prompting.current) return;
    finishing.current = true;
    commit();
    onFinish();
  }, [commit, onFinish]);

  useEffect(() => {
    const outside = event => {
      const surface = mobileDialogRef.current || rootRef.current?.closest("article");
      if (!surface?.contains(event.target)) finish();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [finish]);

  const restoreSelection = () => {
    const saved = savedSelection.current;
    const editor = saved?.editor || titleRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    if (saved && editor.contains(saved.range.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(saved.range.cloneRange());
    }
  };

  const format = (command, value = null) => {
    restoreSelection();
    // Native commands handle toggling, mixed selections, typing marks and undo
    // as one editing operation; wrapping DOM ranges by hand does not.
    if (command === "formatBlock" && document.queryCommandValue("formatBlock").toLowerCase() === value) value = "div";
    if (command === "removeFormat") {
      document.execCommand("unlink", false);
      for (const list of ["insertOrderedList", "insertUnorderedList"]) {
        if (document.queryCommandState(list)) document.execCommand(list, false);
      }
      document.execCommand("formatBlock", false, "div");
    }
    document.execCommand(command, false, value);
    rememberSelection();
    commit();
  };

  const addLink = () => {
    prompting.current = true;
    const url = window.prompt("Paste a link");
    prompting.current = false;
    if (url?.trim()) {
      const value = url.trim();
      if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) format("createLink", value);
      else if (!/^[a-z][a-z\d+.-]*:/i.test(value)) format("createLink", `https://${value}`);
      else restoreSelection();
    } else restoreSelection();
  };

  const input = () => { rememberSelection(); commit(); };
  const keyDown = event => {
    event.stopPropagation();
    if (event.key === "Escape" && !event.isComposing && !event.nativeEvent.isComposing) {
      event.preventDefault();
      finish();
    }
  };
  const button = (command, label, content, value = null) => <button type="button" title={label} aria-label={label} aria-pressed={activeFormats[value || command] ?? undefined} onClick={() => format(command, value)}>{content}</button>;

  const editor = <div ref={rootRef} className={styles.richTextEditor} onPointerDown={stopPropagation} onClick={stopPropagation} onDoubleClick={stopPropagation} onKeyDown={keyDown} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget) && document.hasFocus()) finish();
  }}>
    {mobile && <header><h2>Edit shape</h2><button type="button" onPointerDown={event => event.preventDefault()} onClick={finish}>Done</button></header>}
    <div className={styles.richTextBar} role="toolbar" aria-label="Text formatting" onPointerDown={event => {
      rememberSelection();
      event.preventDefault();
    }}>
      {button("bold", "Bold", <b>B</b>)}
      {button("italic", "Italic", <i>I</i>)}
      {button("underline", "Underline", <u>U</u>)}
      {button("strikeThrough", "Strikethrough", <s>S</s>)}
      <span/>
      <button type="button" title="Insert link" aria-label="Insert link" onClick={addLink}><Icon name="link" size={15}/></button>
      <span/>
      {button("insertOrderedList", "Numbered list", <b className={styles.listIcon}>1.</b>)}
      {button("insertUnorderedList", "Bulleted list", <b className={styles.listIcon}>•</b>)}
      {button("formatBlock", "Quote", "❝", "blockquote")}
      {button("formatBlock", "Code block", "</>", "pre")}
      <span/>
      {button("removeFormat", "Clear formatting", "Tx")}
    </div>
    {mobile && <span className={styles.mobileEditorLabel}>Title</span>}
    <div ref={titleRef} className={styles.richTitle} contentEditable suppressContentEditableWarning role="textbox" aria-label="Shape title" aria-multiline="true" data-field="title" onInput={input} onPointerUp={rememberSelection} onKeyUp={rememberSelection}/>
    {mobile && <span className={styles.mobileEditorLabel}>Note</span>}
    <div ref={noteRef} className={styles.richNote} contentEditable suppressContentEditableWarning role="textbox" aria-label="Shape note" aria-multiline="true" data-field="note" onInput={input} onPointerUp={rememberSelection} onKeyUp={rememberSelection}/>
  </div>;
  return mobile ? createPortal(<dialog ref={mobileDialogRef} className={styles.mobileEditor} aria-label="Edit shape" onCancel={event => { event.preventDefault(); finish(); }} onKeyDown={stopPropagation} onKeyUp={stopPropagation}>{editor}</dialog>, document.body) : editor;
}
