import { useEffect, useId, useRef, useState } from "react";
import Icon from "./BoardIcon";
import MotionPresence from "./MotionPresence";
import { commentsForScope } from "../lib/boardComments";
import styles from "../styles/canvas.module.css";

const scopes = [
  { value: "shape", label: "Selected shape", icon: "box" },
  { value: "branch", label: "Entire branch", icon: "layout" },
  { value: "all", label: "All branches", icon: "grid" },
];

function CommentScopePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null), triggerRef = useRef(null), optionRefs = useRef([]);
  const listId = useId();
  const selectedIndex = scopes.findIndex(scope => scope.value === value);
  const selected = scopes[selectedIndex];

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const dismiss = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  const choose = scope => {
    onChange(scope);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const keyDown = event => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(event.key === "Home" ? 0 : event.key === "End" ? scopes.length - 1
        : !open ? selectedIndex : (activeIndex + (event.key === "ArrowDown" ? 1 : scopes.length - 1)) % scopes.length);
      setOpen(true);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return <div ref={rootRef} className={styles.commentScopePicker} onKeyDown={keyDown}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={triggerRef} type="button" className={styles.commentScopeTrigger}
      aria-label={`Comment scope: ${selected.label}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
      onClick={() => { setActiveIndex(selectedIndex); setOpen(current => !current); }}>
      <Icon name={selected.icon} size={15}/><span>{selected.label}</span>
      <svg className={styles.commentScopeChevron} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    <MotionPresence present={open} kind="menu"><div id={listId} className={styles.commentScopeMenu} role="listbox" aria-label="Comment scope">
      {scopes.map((scope, index) => <button key={scope.value} ref={element => { optionRefs.current[index] = element; }}
        type="button" role="option" aria-selected={value === scope.value} tabIndex={activeIndex === index ? 0 : -1}
        onFocus={() => setActiveIndex(index)} onClick={() => choose(scope.value)}>
        <Icon name={scope.icon} size={15}/><span>{scope.label}</span>
        {value === scope.value && <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="m2.5 6.5 2.5 2.5 5.5-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>)}
    </div></MotionPresence>
  </div>;
}

export default function CommentsPanel({ nodes, edges, targetId, selectedEdge, onAdd, onResolve, onDelete, onChoose, onClose }) {
  const [drafts, setDrafts] = useState({});
  const [scope, setScope] = useState(() => targetId != null ? "shape" : selectedEdge != null ? "branch" : "all");
  const chosen = nodes.find(node => node.id === targetId);
  const chosenId = chosen?.id ?? "", text = drafts[chosenId] || "";
  const comments = commentsForScope(nodes, edges, scope, targetId, selectedEdge);
  const openCount = comments.filter(comment => !comment.resolved).length;
  const needsSelection = scope === "shape" ? !chosen : scope === "branch" && !chosen && selectedEdge == null;
  const emptyTitle = needsSelection ? "Select a shape" : "No comments yet";
  const emptyHint = needsSelection ? (scope === "branch" ? "Choose a shape or line on the board." : "Choose a box on the board.")
    : scope === "all" ? "Comments from all branches appear here."
      : scope === "branch" ? "No comments in this branch." : "Add a comment for this shape.";
  const submit = event => {
    event.preventDefault();
    const clean = text.trim();
    if (!clean || !chosen) return;
    onAdd(chosen.id, clean);
    setDrafts(current => ({ ...current, [chosenId]: "" }));
  };

  return <aside className={`${styles.panelSurface} ${styles.commentsPanel}`} aria-label="Local comments">
    <header><div><small>LOCAL DISCUSSION</small><h2>Comments <b>{openCount}</b></h2></div><button onClick={onClose} aria-label="Close comments">×</button></header>
    <form onSubmit={submit}>
      <CommentScopePicker value={scope} onChange={setScope}/>
      {chosen && <div className={styles.commentComposerTarget}>On <strong>{chosen.title || "Untitled"}</strong></div>}
      <textarea value={text} disabled={!chosen} onChange={event => setDrafts(current => ({ ...current, [chosenId]: event.target.value }))}
        aria-label={chosen ? `Comment on ${chosen.title || "Untitled"}` : "Select a shape to comment"}
        placeholder={chosen ? "Add a local comment…" : "Select a shape to comment…"} rows="3"/>
      <button disabled={!text.trim() || !chosen}>Comment</button>
    </form>
    <div className={styles.commentList} aria-live="polite">
      {comments.length ? comments.map(comment => <article key={`${comment.nodeId}:${comment.id}`} className={comment.resolved ? styles.commentResolved : ""}>
        <button className={styles.commentTarget} onClick={() => onChoose(nodes.find(node => node.id === comment.nodeId))} aria-label={`Go to ${comment.nodeTitle || "Untitled shape"} on board`}><i/><span>{comment.nodeTitle || "Untitled"}</span></button>
        <p>{comment.text}</p>
        <footer>
          <time>{new Date(comment.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
          <button onClick={() => onResolve(comment.nodeId, comment.id)}>{comment.resolved ? "Reopen" : "Resolve"}</button>
          <button onClick={() => onDelete(comment.nodeId, comment.id)} aria-label="Delete comment"><Icon name="trash" size={13}/></button>
        </footer>
      </article>) : <div className={`${styles.panelEmpty} ${styles.commentEmpty}`}><Icon name="comment" size={20}/><b>{emptyTitle}</b><span>{emptyHint}</span></div>}
    </div>
  </aside>;
}
