import { useEffect, useId, useRef, useState } from "react";
import Icon from "./BoardIcon";
import MotionPresence from "./MotionPresence";
import { commentsForScope } from "../lib/boardComments";
import styles from "../styles/comments.module.css";

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

export default function CommentsPanel({ nodes, edges, targetId, selectedEdge, focusTarget, onAdd, onResolve, onDelete, onChoose, onClose, readOnly = false }) {
  const [drafts, setDrafts] = useState({});
  const [status, setStatus] = useState("all");
  const composerRef = useRef(null), listRef = useRef(null);
  const [scope, setScope] = useState(() => targetId != null ? "shape" : selectedEdge != null ? "branch" : "all");
  useEffect(() => {
    if (!focusTarget) return;
    setScope("shape");
    setStatus("all");
    listRef.current?.scrollTo({ top: 0 });
  }, [focusTarget]);
  const chosen = nodes.find(node => node.id === targetId);
  const chosenId = chosen?.id ?? "", text = drafts[chosenId] || "";
  const comments = commentsForScope(nodes, edges, scope, targetId, selectedEdge);
  const openCount = comments.filter(comment => !comment.resolved).length;
  const visibleComments = comments.filter(comment => status === "all" || (status === "resolved" ? comment.resolved : !comment.resolved));
  const needsSelection = scope === "shape" ? !chosen : scope === "branch" && !chosen && selectedEdge == null;
  const emptyTitle = needsSelection ? "Choose a shape to explore" : comments.length ? (status === "resolved" ? "Nothing resolved yet" : "All caught up") : readOnly ? "No comments" : "Start the conversation";
  const emptyHint = needsSelection ? (scope === "branch" ? "Choose a shape or line on the board." : "Choose a box on the board.")
    : comments.length ? (status === "resolved" ? "Resolved comments will appear here." : "Every comment in this view is resolved.")
      : readOnly ? "There are no comments in this part of the shared board." : chosen ? "Ask a question, leave feedback, or capture a thought about this idea."
        : "Select a shape on the canvas to leave your first note.";
  const submit = event => {
    event.preventDefault();
    const clean = text.trim();
    if (readOnly || !clean || !chosen) return;
    onAdd(chosen.id, clean);
    setDrafts(current => ({ ...current, [chosenId]: "" }));
    setStatus("all");
    listRef.current?.scrollTo({ top: 0 });
    composerRef.current?.focus();
  };

  return <aside data-comments-panel className={styles.commentsPanel} aria-label="Local comments">
    <header className={styles.header}>
      <span className={styles.headerIcon}><Icon name="comment" size={21}/></span>
      <div><h2>Comments <span>{comments.length}</span></h2><p>Notes attached to your ideas.</p></div>
      <button className={styles.closeButton} onClick={onClose} aria-label="Close comments"><Icon name="close" size={18}/></button>
    </header>
    <div className={styles.filters}>
      <CommentScopePicker value={scope} onChange={setScope}/>
      <div className={styles.statusFilters} role="group" aria-label="Filter comments">
        {[["all", "All", comments.length], ["open", "Open", openCount], ["resolved", "Resolved", comments.length - openCount]].map(([value, label, count]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}<span>{count}</span></button>)}
      </div>
    </div>
    <div ref={listRef} className={styles.commentList} aria-live="polite" aria-label="Comments in this view">
      {visibleComments.length ? visibleComments.map(comment => <article key={`${comment.nodeId}:${comment.id}`} className={`${styles.commentCard} ${comment.resolved ? styles.commentResolved : ""}`}>
        <div className={styles.cardHeader}><button className={styles.commentTarget} onClick={() => onChoose(nodes.find(node => node.id === comment.nodeId))} aria-label={`Go to ${comment.nodeTitle || "Untitled shape"} on board`}><Icon name="box" size={15}/><span>{comment.nodeTitle || "Untitled"}</span><Icon name="chevron" size={13}/></button>
          <time dateTime={new Date(comment.createdAt).toJSON() || undefined} title={new Date(comment.createdAt).toLocaleString()}>{new Date(comment.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div>
        <p>{comment.text}</p>
        <footer>
          <span className={styles.commentState}>{comment.resolved ? <Icon name="check" size={13}/> : <i/>}{comment.resolved ? "Resolved" : "Open"}</span>
          {!readOnly&&<><button className={styles.resolveButton} onClick={() => onResolve(comment.nodeId, comment.id)}>{comment.resolved ? "Reopen" : "Resolve"}{!comment.resolved && <Icon name="check" size={14}/>}</button>
          <button className={styles.deleteButton} onClick={() => onDelete(comment.nodeId, comment.id)} aria-label="Delete comment" title="Delete comment"><Icon name="trash" size={15}/></button></>}
        </footer>
      </article>) : <div className={styles.commentEmpty}><span className={styles.emptyIcon}><Icon name={comments.length && status === "open" ? "check" : "comment"} size={27}/></span><h3>{emptyTitle}</h3><p>{emptyHint}</p>{!readOnly && chosen && !comments.length && <button onClick={() => composerRef.current?.focus()}>Write a comment <Icon name="forward" size={15}/></button>}</div>}
    </div>
    {readOnly ? <div className={styles.composer}><div className={styles.selectionHint}><Icon name="eye" size={18}/><span>Read-only · Comments from the shared board.</span></div></div> : <form className={styles.composer} onSubmit={submit}>
      {chosen ? <>
        <div className={styles.composerTarget}><span>Commenting on</span><Icon name="box" size={14}/><strong title={chosen.title || "Untitled"}>{chosen.title || "Untitled"}</strong></div>
        <div className={styles.composerField}>
          <textarea ref={composerRef} value={text} onChange={event => setDrafts(current => ({ ...current, [chosenId]: event.target.value }))}
            onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) submit(event); }}
            aria-label={`Comment on ${chosen.title || "Untitled"}`} placeholder="Add a local comment…" rows="3"/>
          <div className={styles.composerActions}><span><Icon name="lock" size={12}/> On this device</span><button type="submit" disabled={!text.trim()}>Comment <Icon name="forward" size={16}/></button></div>
        </div>
      </> : <div className={styles.selectionHint}><Icon name="cursor" size={20}/><span>Select a shape on the canvas to add a comment.</span></div>}
    </form>}
  </aside>;
}
