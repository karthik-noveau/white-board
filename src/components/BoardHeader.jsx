import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import Icon from "./BoardIcon";
import MotionPresence from "./MotionPresence";
import styles from "../styles/canvas.module.css";
import headerStyles from "../styles/boardHeader.module.css";

function BoardTitleInput({ title, onRename }) {
  const [value,setValue]=useState(title);
  const inputRef=useRef(null);
  const draft=useRef(title),saved=useRef(title),rename=useRef(onRename);
  rename.current=onRename;
  useEffect(()=>{draft.current=title;saved.current=title;setValue(title)},[title]);
  const saveDraft=useCallback(()=>{const clean=draft.current.trim()||"Untitled mind map";if(clean!==saved.current){saved.current=clean;rename.current(clean)}return clean},[]);
  useEffect(()=>{window.addEventListener("pagehide",saveDraft);return()=>{window.removeEventListener("pagehide",saveDraft);saveDraft()}},[saveDraft]);
  const commit=()=>{draft.current=saveDraft();setValue(draft.current)};
  return <div className={headerStyles.titleEditor}>
    <span className={headerStyles.titleField}>
      <span className={headerStyles.titleMeasure} aria-hidden="true">{value||"Untitled mind map"}</span>
      <input ref={inputRef} className={headerStyles.titleInput} value={value} onChange={event=>{draft.current=event.target.value;setValue(draft.current)}} onBlur={commit} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur();if(event.key==="Escape"){draft.current=title;setValue(title);event.currentTarget.blur()}}} aria-label="Board title" title="Rename board"/>
    </span>
    <button type="button" className={headerStyles.renameButton} onClick={()=>{inputRef.current?.focus();inputRef.current?.select()}} aria-label="Rename board" title="Rename board"><Icon name="pencil" size={14}/></button>
  </div>;
}

export default function BoardHeader({ title, onRename, saveStatus = "saved", onRetrySave, backTo, onExport, onShare, onHistory, onOutline, outlineOpen, onPresent, onComments, onViews, onUndo, onRedo, canUndo, canRedo, selectingMultiple, onSelectMultiple }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null), triggerRef = useRef(null);
  useEffect(() => {
    if (!moreOpen) return;
    moreRef.current?.querySelector("nav button:not(:disabled)")?.focus();
    const outside = event => { if (!moreRef.current?.contains(event.target)) setMoreOpen(false); };
    const escape = event => {
      if (event.key === "Escape") { event.stopPropagation(); setMoreOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [moreOpen]);
  const actions = [["searchFilter", "Search & filter", onOutline], ["bookmark", "Saved views", onViews], ["comment", "Comments", onComments], ["present", "Present board", onPresent], ["history", "Version history", onHistory], ["download", "Export board", onExport]];
  const saving=saveStatus==="saving",saveFailed=saveStatus==="error";
  const saveLabel=saving?"Saving…":saveFailed?"Not saved":"Saved";
  const saveHint=saving?"Saving changes on this device":saveFailed?"Changes could not be saved. Click to retry.":"Saved on this device";
  const saveIndicator=<><span className={headerStyles.saveIcon}>{saving?<i className={headerStyles.savePulse}/>:<Icon name={saveFailed?"saveError":"check"} size={12}/>}</span><span className={headerStyles.saveLabel}>{saveLabel}</span></>;

  return <header className={styles.header}>
    <Link className={styles.brand} to={backTo} aria-label="Back to projects" title="Back to projects"><div className={styles.logo}><Icon name="spark" size={17}/></div><b>Nova</b></Link>
    <span className={styles.headerDivider}/>
    <div className={headerStyles.identity}><BoardTitleInput title={title} onRename={onRename}/><span className={headerStyles.saveAnnouncement} role="status" aria-live="polite" aria-atomic="true">{saveFailed?<button type="button" className={headerStyles.saveStatus} data-state={saveStatus} onClick={onRetrySave} aria-label="Not saved. Retry saving" title={saveHint}>{saveIndicator}</button>:<span className={headerStyles.saveStatus} data-state={saveStatus} title={saveHint} aria-label={saveHint}>{saveIndicator}</span>}</span></div>
    <div data-keyboard-toolbar className={headerStyles.historyControls} role="group" aria-label="Edit history"><button className={headerStyles.historyButton} onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)"><Icon name="undo" size={16}/></button><button className={headerStyles.historyButton} onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)"><Icon name="redo" size={16}/></button></div>
    <div className={styles.headerSpacer}/>
    <div data-keyboard-toolbar className={styles.headerActions}>{actions.slice(0, -1).map(([icon, label, action]) => <button key={icon} className={`${styles.iconButton} ${icon === "searchFilter" ? headerStyles.searchAction : ""}`} onClick={action} aria-label={label} title={icon === "searchFilter" ? `${label} (⌘K)` : label} aria-keyshortcuts={icon === "searchFilter" ? "Meta+K Control+K" : undefined} aria-expanded={icon === "searchFilter" ? outlineOpen : undefined} aria-controls={icon === "searchFilter" ? "board-search-filter" : undefined}><Icon name={icon} size={icon === "searchFilter" ? 18 : 20}/>{icon === "searchFilter" && <kbd className={headerStyles.searchShortcut} aria-hidden="true">⌘K</kbd>}</button>)}</div>
    <button data-tour="export" className={styles.exportButton} aria-label="Export board" title="Export board" onClick={onExport}><Icon name="download" size={16}/><span>Export</span></button>
    <button className={styles.share} aria-label="Share board" title="Share board" onClick={onShare}><Icon name="share" size={17}/><span>Share</span></button>
    <div ref={moreRef} className={styles.mobileMore} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMoreOpen(false); }}>
      <button ref={triggerRef} className={styles.iconButton} data-tour="mobile-more" aria-label="More board actions" aria-expanded={moreOpen} aria-controls="mobile-board-actions" onClick={() => setMoreOpen(value => !value)}><Icon name="more" size={22}/></button>
      <MotionPresence present={moreOpen} kind="menu"><nav id="mobile-board-actions" className={styles.mobileActions} aria-label="Board actions"><button disabled={!canUndo} onClick={() => { setMoreOpen(false); triggerRef.current?.focus(); onUndo(); }}><Icon name="undo" size={16}/><span>Undo</span></button><button disabled={!canRedo} onClick={() => { setMoreOpen(false); triggerRef.current?.focus(); onRedo(); }}><Icon name="redo" size={16}/><span>Redo</span></button><button aria-pressed={selectingMultiple} onClick={() => { setMoreOpen(false); triggerRef.current?.focus(); onSelectMultiple(); }}><Icon name="cursor" size={19}/><span>{selectingMultiple ? "Finish selecting" : "Select multiple"}</span></button>{actions.map(([icon, label, action]) => <button key={icon} onClick={() => { setMoreOpen(false); triggerRef.current?.focus(); action(); }}><Icon name={icon} size={19}/><span>{label}</span></button>)}</nav></MotionPresence>
    </div>
  </header>;
}
