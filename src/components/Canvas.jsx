import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VersionPreview from "./VersionPreview";
import { boardEdgeData, inferConnectionSide } from "../lib/boardGeometry";
import Header from "./BoardHeader";
import styles from "../styles/canvas.module.css";
import RichTextEditor from "./RichTextEditor";
import Icon from "./BoardIcon";
import MotionPresence from "./MotionPresence";
import useDeleteConfirmation from "../lib/useDeleteConfirmation";
import { nearbyBoardNode, navigateToolbar } from "../lib/boardKeyboard";
import { createSaveStatus } from "../lib/saveStatus";
import CanvasControlIcon from "./CanvasControlIcon";
import BoardStyleIcon from "./BoardStyleIcon";
import BoardTour from "./BoardTour";
import ExportStudio from "./ExportStudio";
import ShareBoard from "./ShareBoard";
import CommentsPanel from "./CommentsPanel";
import { palettes, rootColors, nodeSize } from "../lib/boardAppearance";
import { createBoardSvg, selectExportNodes, exportVisualFile } from "../lib/boardExport";
import { boardTourPreference } from "../lib/boardTour";
import { branchStyleScope, branchStyleSettings, applyBranchStyle, childBranchStyle } from "../lib/branchStyles";
import { beginPinch, updatePinch, beginTouchPan } from "../lib/touchViewport";
import { createNodeDrag, moveDraggedNodes, moveDraggedEdges } from "../lib/nodeDrag";
import { filterBoardOutline } from "../lib/boardOutline";
import { copyBoardState, createSavedView, restoreSavedView, nextBoardItemId } from "../lib/boardViews";
import { deleteProjectVersion, deleteShapeLibraryItem, exportProjectFile, listProjectVersions, listShapeLibrary, saveShapeLibraryItem } from "../lib/localWorkspace";

const WORLD = { width: 5000, height: 3500 };
const SIZE = { width: 228, height: 92 };
const CLIPBOARD_KEY = "nova-shape-clipboard";
const snapScale = value => {
  const safe=Math.max(.01,value);
  const precision=safe<.1?100:safe<1?20:10;
  return Math.max(.01,Math.round(safe*precision)/precision);
};

const initialNodes = [
  { id: 1, x: 1180, y: 752, title: "Build a better product", note: "Product strategy", color: "violet", shape: "round", root: true },
  { id: 2, x: 760, y: 560, title: "Understand the problem", note: "Research & insights", color: "blue", shape: "round" },
  { id: 3, x: 760, y: 960, title: "Define success", note: "Outcomes & metrics", color: "amber", shape: "round" },
  { id: 4, x: 1600, y: 500, title: "Explore solutions", note: "Ideas without limits", color: "pink", shape: "round" },
  { id: 5, x: 1600, y: 760, title: "Shape the experience", note: "Flows & prototypes", color: "green", shape: "round" },
  { id: 6, x: 1600, y: 1020, title: "Learn and iterate", note: "Test, measure, improve", color: "orange", shape: "round" },
  { id: 7, x: 430, y: 480, title: "Customer interviews", note: "8 conversations", color: "white", shape: "round" },
  { id: 8, x: 430, y: 640, title: "Market signals", note: "Patterns & trends", color: "white", shape: "round" },
  { id: 9, x: 1960, y: 680, title: "Core journey", note: "First-run experience", color: "white", shape: "round" },
  { id: 10, x: 1960, y: 840, title: "Design system", note: "Clear and consistent", color: "white", shape: "round" },
];

const initialEdges = [
  { id: 1, from: 1, to: 2, side: "left" }, { id: 2, from: 1, to: 3, side: "left" },
  { id: 3, from: 1, to: 4, side: "right" }, { id: 4, from: 1, to: 5, side: "right" }, { id: 5, from: 1, to: 6, side: "right" },
  { id: 6, from: 2, to: 7, side: "left" }, { id: 7, from: 2, to: 8, side: "left" },
  { id: 8, from: 5, to: 9, side: "right" }, { id: 9, from: 5, to: 10, side: "right" },
];

const shapeOptions = [
  ["rectangle","Rectangle"], ["round","Rounded"], ["soft","Soft"],
  ["pill","Pill"], ["ellipse","Ellipse"], ["circle","Circle"],
];
const relationTypes = [["related","Related"],["blocks","Blocks"],["depends","Depends on"],["supports","Supports"]];
const relationLabel = value => relationTypes.find(([key])=>key===(value||"related"))?.[1]||"Related";
const calculateBranchMetrics = (nodes,edges) => {
  const nodeMap=new Map(nodes.map(node=>[node.id,node])),children=new Map();edges.forEach(edge=>{if(!children.has(edge.from))children.set(edge.from,[]);children.get(edge.from).push(edge.to)});const metrics=new Map();
  nodes.forEach(root=>{if(!children.get(root.id)?.length)return;const descendants=new Set(),queue=[...(children.get(root.id)||[])];while(queue.length){const id=queue.shift();if(descendants.has(id)||id===root.id)continue;descendants.add(id);(children.get(id)||[]).forEach(child=>queue.push(child))}const tracked=[...descendants].map(id=>nodeMap.get(id)).filter(node=>node&&node.kind!=="frame"),done=tracked.filter(node=>node.status==="done").length,overdue=tracked.filter(isOverdue).length,blocked=tracked.filter(node=>edges.some(edge=>edge.to===node.id&&edge.relation==="blocks"&&nodeMap.get(edge.from)?.status!=="done")).length;metrics.set(root.id,{total:tracked.length,done,overdue,blocked,percent:tracked.length?Math.round(done/tracked.length*100):0})});
  return metrics;
};

const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const formatDueDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"}) : "";
const formatDuration = seconds => {const total=Math.max(0,Math.floor(seconds||0)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),rest=total%60;return hours?`${hours}h ${String(minutes).padStart(2,"0")}m`:minutes?`${minutes}m ${String(rest).padStart(2,"0")}s`:`${rest}s`};
const nextRecurringDate = (value,frequency,interval=1) => {const date=value?new Date(`${value}T00:00:00`):new Date(),step=Math.max(1,Number(interval)||1);if(frequency==="daily")date.setDate(date.getDate()+step);else if(frequency==="monthly")date.setMonth(date.getMonth()+step);else date.setDate(date.getDate()+step*7);return localDateKey(date)};
const isOverdue = node => Boolean(node.dueDate&&node.status!=="done"&&node.dueDate<localDateKey(new Date()));
const csvCell = value => {const text=String(value??"");return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text};
const parseCsv = text => {
  const rows=[];let row=[],cell="",quoted=false;
  for(let index=0;index<text.length;index+=1){const character=text[index];if(quoted){if(character==='"'&&text[index+1]==='"'){cell+='"';index+=1}else if(character==='"')quoted=false;else cell+=character}else if(character==='"')quoted=true;else if(character===","){row.push(cell);cell=""}else if(character==="\n"){row.push(cell);rows.push(row);row=[];cell=""}else if(character!=="\r")cell+=character}
  if(cell||row.length){row.push(cell);rows.push(row)}const [headers,...values]=rows.filter(item=>item.some(value=>value.trim()));if(!headers)return[];return values.map(valuesRow=>Object.fromEntries(headers.map((header,index)=>[header.trim(),valuesRow[index]??""])));
};
const overlapsNode = (x, y, width, height, nodes, padding = 48) => nodes.some(node => {
  const size = nodeSize(node);
  return x < node.x + size.width + padding &&
    x + width + padding > node.x &&
    y < node.y + size.height + padding &&
    y + height + padding > node.y;
});

const branchOffset = (index, side) => {
  if (index === 0) return 0;
  const step = side === "top" || side === "bottom" ? 282 : 152;
  const distance = Math.ceil(index / 2) * step;
  return index % 2 === 1 ? distance : -distance;
};

const findBranchPosition = (source, side, nodes, siblingIndex = 0) => {
  const sourceSize = nodeSize(source);
  const child = SIZE;

  // Each side owns a stable sibling sequence: center, positive axis,
  // negative axis, then alternating farther out. Collision fallback moves
  // farther in the requested direction without changing that sibling lane.
  for (let slot = siblingIndex; slot < siblingIndex + 18; slot += 1) {
    const offset = branchOffset(slot, side);
    for (let ring = 0; ring < 9; ring += 1) {
      const distance = 128 + ring * 112;
      let x = source.x;
      let y = source.y;
      if (side === "right") { x += sourceSize.width + distance; y += sourceSize.height / 2 - child.height / 2 + offset; }
      if (side === "left") { x -= child.width + distance; y += sourceSize.height / 2 - child.height / 2 + offset; }
      if (side === "top") { x += sourceSize.width / 2 - child.width / 2 + offset; y -= child.height + distance; }
      if (side === "bottom") { x += sourceSize.width / 2 - child.width / 2 + offset; y += sourceSize.height + distance; }
      if (!overlapsNode(x, y, child.width, child.height, nodes)) return { x, y };
    }
  }

  return { x: source.x + sourceSize.width + 160, y: source.y + nodes.length * 18 };
};


const compareBoards = (past={},current={}) => {
  const before=past.nodes||[],after=current.nodes||[],beforeMap=new Map(before.map(node=>[node.id,node])),afterMap=new Map(after.map(node=>[node.id,node])),added=after.filter(node=>!beforeMap.has(node.id)),removed=before.filter(node=>!afterMap.has(node.id)),changed=after.filter(node=>beforeMap.has(node.id)&&JSON.stringify(beforeMap.get(node.id))!==JSON.stringify(node)).map(node=>({before:beforeMap.get(node.id),after:node}));
  const beforeEdges=past.edges||[],afterEdges=current.edges||[],edgeDelta={added:afterEdges.filter(edge=>!beforeEdges.some(item=>item.id===edge.id)).length,removed:beforeEdges.filter(edge=>!afterEdges.some(item=>item.id===edge.id)).length,changed:afterEdges.filter(edge=>{const old=beforeEdges.find(item=>item.id===edge.id);return old&&JSON.stringify(old)!==JSON.stringify(edge)}).length},styleChanged=JSON.stringify(past.globalSettings||{})!==JSON.stringify(current.globalSettings||{});
  return{added,removed,changed,edgeDelta,styleChanged,total:added.length+removed.length+changed.length+edgeDelta.added+edgeDelta.removed+edgeDelta.changed+(styleChanged?1:0)};
};

function VersionHistory({ versions, loading, currentBoard, onRestore, onDelete, onClose }) {
  const [previewVersion,setPreviewVersion]=useState(null);
  const previewMetrics=useMemo(()=>calculateBranchMetrics(previewVersion?.board?.nodes||[],previewVersion?.board?.edges||[]),[previewVersion]);
  const [selectedKey,setSelectedKey]=useState(null),selected=versions.find(version=>version.key===selectedKey),comparison=selected?compareBoards(selected.board,currentBoard):null;
  return <><div className={styles.historyScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><aside className={`${styles.panelSurface} ${styles.versionPanel} ${selected?styles.versionPanelComparing:""}`} aria-label="Local version history"><header><div><small>LOCAL TIME MACHINE</small><h2>Version history</h2></div><button onClick={onClose} aria-label="Close version history">×</button></header><p>Versions are saved automatically. Preview or compare changes before restoring.</p><div className={styles.timeMachineBody}><div className={styles.versionList}>{loading?<div className={`${styles.panelEmpty} ${styles.versionEmpty}`}>Loading versions…</div>:versions.length?versions.map((version,index)=><article key={version.key} className={version.key===selectedKey?styles.versionSelected:""}><button onClick={()=>setSelectedKey(version.key)}><i className={version.pinned?styles.milestoneDot:""}/><span><b>{version.label||(!index?"Latest recovery point":new Date(version.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"}))}</b><small>{new Date(version.createdAt).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})} · {version.board?.nodes?.length||0} shapes</small></span><strong>Compare</strong></button>{version.pinned&&<button className={styles.deleteVersion} onClick={()=>{onDelete(version.key);if(version.key===selectedKey)setSelectedKey(null)}} aria-label={`Delete ${version.label}`}><Icon name="trash" size={13}/></button>}</article>):<div className={`${styles.panelEmpty} ${styles.versionEmpty}`}>Recovery points appear as you edit.</div>}</div>{selected&&<section className={styles.versionCompare}><header><div><small>CHANGES SINCE</small><b>{selected.label||new Date(selected.createdAt).toLocaleString()}</b></div><button onClick={()=>setSelectedKey(null)} aria-label="Close comparison">×</button></header><div className={styles.diffStats}><article><b>{comparison.added.length}</b><span>Added</span></article><article><b>{comparison.removed.length}</b><span>Removed</span></article><article><b>{comparison.changed.length}</b><span>Changed</span></article></div><div className={styles.diffList}>{comparison.added.map(node=><p key={`a-${node.id}`}><i className={styles.diffAdded}>+</i><span><b>{node.title||"Untitled"}</b><small>Added after this version</small></span></p>)}{comparison.removed.map(node=><p key={`r-${node.id}`}><i className={styles.diffRemoved}>−</i><span><b>{node.title||"Untitled"}</b><small>Removed after this version</small></span></p>)}{comparison.changed.map(item=><p key={`c-${item.after.id}`}><i className={styles.diffChanged}>~</i><span><b>{item.after.title||"Untitled"}</b><small>{item.before.title!==item.after.title?`${item.before.title} → ${item.after.title}`:"Content or appearance changed"}</small></span></p>)}{!comparison.added.length&&!comparison.removed.length&&!comparison.changed.length&&<p className={styles.diffEmpty}>No shape changes</p>}</div><div className={styles.diffMeta}><span>Connections <b>+{comparison.edgeDelta.added} −{comparison.edgeDelta.removed} ~{comparison.edgeDelta.changed}</b></span><span>Board style <b>{comparison.styleChanged?"Changed":"Same"}</b></span></div><footer><span>{comparison.total?`${comparison.total} total changes`:"Boards are identical"}</span><div className={styles.versionCompareActions}><button className={styles.versionPreviewButton} onClick={()=>setPreviewVersion(selected)}><Icon name="eye" size={18}/>Preview</button><button onClick={()=>onRestore(selected)}>Restore this version</button></div></footer></section>}</div></aside></div>{previewVersion&&<VersionPreview version={previewVersion} onClose={()=>setPreviewVersion(null)} onRestore={onRestore} renderNode={node=><Node key={node.id} node={node} progress={previewMetrics.get(node.id)} assignee={previewVersion.board.teamMembers?.find(member=>member.id===node.assigneeId)} blockedBy={previewVersion.board.edges?.filter(edge=>edge.to===node.id&&edge.relation==="blocks"&&previewVersion.board.nodes.find(source=>source.id===edge.from)?.status!=="done").length}/>}/>}</>;
}

function SearchPalette({ nodes, actions, onChoose, onClose }) {
  const [query,setQuery]=useState(""),[active,setActive]=useState(0);
  const needle=query.trim().toLowerCase(),commandMatches=actions.filter(action=>`${action.label} ${action.detail} ${action.keywords||""}`.toLowerCase().includes(needle)).slice(0,5),nodeMatches=nodes.filter(node=>`${node.title} ${node.note} ${node.status||""} ${node.priority||""} ${node.dueDate||""} ${(node.tags||[]).join(" ")} ${(node.links||[]).map(link=>`${link.label} ${link.url}`).join(" ")} ${Object.values(node.customValues||{}).join(" ")} ${node.decision?.status||""} ${node.decision?.rationale||""} ${node.risk?.status||""} ${node.risk?.mitigation||""}`.toLowerCase().includes(needle)).slice(0,6),results=[...commandMatches.map(action=>({...action,type:"command"})),...nodeMatches.map(node=>({key:`node-${node.id}`,label:node.title,detail:[node.status,node.priority,node.dueDate&&formatDueDate(node.dueDate),node.tags?.join(" · "),node.note].filter(Boolean).join(" · "),type:"node",node}))];
  useEffect(()=>setActive(0),[query]);
  const run=item=>{if(!item)return;if(item.type==="node")onChoose(item.node);else{item.run();onClose()}};
  const keyDown=e=>{if(e.key==="Escape"){e.preventDefault();onClose()}if(e.key==="ArrowDown"){e.preventDefault();setActive(value=>(value+1)%Math.max(1,results.length))}if(e.key==="ArrowUp"){e.preventDefault();setActive(value=>(value-1+Math.max(1,results.length))%Math.max(1,results.length))}if(e.key==="Enter"){e.preventDefault();run(results[active])}};
  return <div className={styles.searchScrim} onPointerDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={`${styles.panelSurface} ${styles.searchPalette}`} role="dialog" aria-label="Find shapes and commands"><div className={styles.searchField}><Icon name="search" size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={keyDown} placeholder="Find a shape or run a command…"/><kbd>Esc</kbd></div><div className={styles.searchResults}>{results.length?results.map((item,index)=><button key={item.key} className={index===active?styles.searchResultActive:""} onPointerMove={()=>setActive(index)} onClick={()=>run(item)}><i className={item.type==="command"?styles.commandMark:""} style={item.type==="node"?{background:palettes[item.node.color][1]}:undefined}>{item.type==="command"?"⌘":""}</i><span><strong>{item.label}</strong><small>{item.detail}</small></span><b>{item.shortcut||"↵"}</b></button>):<p>No matching shapes or commands</p>}</div></div></div>;
}

function OutlinePanel({ nodes, selectedIds, onChoose, onVisibility, onLock, onCommands, onClose }) {
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("all");
  const searchRef=useRef(null);
  const {groups,unframed,count}=useMemo(()=>filterBoardOutline(nodes,query,filter),[nodes,query,filter]);
  const filtered=Boolean(query.trim()||filter!=="all");
  const clear=()=>{setQuery("");setFilter("all");searchRef.current?.focus()};
  const navigateResults=event=>{
    if(event.isComposing)return;
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){
      event.preventDefault();event.stopPropagation();if(event.shiftKey)onCommands();else searchRef.current?.focus();return;
    }
    if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey||!["ArrowDown","ArrowUp"].includes(event.key))return;
    const row=event.target.closest(`.${styles.outlineRow}`);
    if(event.target!==searchRef.current&&!row)return;
    const results=[...event.currentTarget.querySelectorAll(`.${styles.outlineChoose}`)];
    if(!results.length)return;
    const index=results.indexOf(row?.querySelector(`.${styles.outlineChoose}`));
    const next=index<0?(event.key==="ArrowDown"?0:results.length-1):index+(event.key==="ArrowDown"?1:-1);
    event.preventDefault();event.stopPropagation();
    if(next<0)searchRef.current?.focus();else results[Math.min(next,results.length-1)].focus();
  };
  const row=(node,nested=false,parentHidden=false)=>{const effectivelyHidden=node.hidden||parentHidden;return <div key={node.id} className={`${styles.outlineRow} ${nested?styles.outlineNested:""} ${selectedIds.includes(node.id)?styles.outlineSelected:""} ${effectivelyHidden?styles.outlineHidden:""}`}><button className={styles.outlineChoose} onClick={()=>onChoose(node)}><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><span><b>{node.title||"Untitled"}</b><small>{node.kind==="frame"?"Frame":node.groupId?"Grouped shape":"Shape"}</small></span></button><button disabled={parentHidden} onClick={()=>onVisibility(node.id)} aria-label={effectivelyHidden?"Show item":"Hide item"} title={parentHidden?"Hidden by its frame":effectivelyHidden?"Show":"Hide"}><Icon name={effectivelyHidden?"eyeOff":"eye"} size={20}/></button><button className={node.locked?styles.outlineLocked:""} onClick={()=>onLock(node.id)} aria-label={node.locked?"Unlock item":"Lock item"} title={node.locked?"Unlock":"Lock"}><Icon name={node.locked?"lock":"unlock"} size={14}/></button></div>};
  return <aside id="board-search-filter" className={`${styles.panelSurface} ${styles.outlinePanel}`} aria-label="Search and filter board" onKeyDown={navigateResults}>
    <header><div><small>BOARD ITEMS</small><h2>Search & filter</h2></div><button onClick={onClose} aria-label="Close search and filter"><Icon name="close" size={18}/></button></header>
    <div className={styles.outlineSearch}><Icon name="search" size={18}/><input ref={searchRef} value={query} onChange={event=>setQuery(event.target.value)} aria-label="Search board items" placeholder="Search titles, notes, or tags…"/>{query&&<button onClick={()=>{setQuery("");searchRef.current?.focus()}} aria-label="Clear search"><Icon name="close" size={16}/></button>}</div>
    <div data-keyboard-toolbar className={styles.outlineFilters} role="group" aria-label="Filter board items">{[["all","All"],["shapes","Shapes"],["frames","Frames"],["locked","Locked"],["hidden","Hidden"]].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    <div className={styles.outlineResultCount}><span role="status">{count} {count===1?"result":"results"}{filtered?` of ${nodes.length} items`:""}</span>{filtered&&<button onClick={clear}>Reset</button>}</div>
    <div className={styles.outlineList}>{groups.map(({frame,children})=><section key={frame.id}>{row(frame)}{children.map(node=>row(node,true,frame.hidden))}</section>)}{unframed.map(node=>row(node))}{!count&&<div className={`${styles.panelEmpty} ${styles.outlineEmpty}`}><Icon name="searchFilter" size={24}/><b>No matching items</b><span>{filtered?"Try another search or reset your filters.":"Add a shape to start building your board."}</span>{filtered&&<button onClick={clear}>Reset filters</button>}</div>}</div>
  </aside>;
}

function ViewsPanel({ views, onSave, onOpen, onDelete, onClose }) {
  const [name,setName]=useState("");
  const submit=event=>{event.preventDefault();onSave(name.trim()||`View ${views.length+1}`);setName("")};
  return <aside className={`${styles.panelSurface} ${styles.viewsPanel}`} aria-label="Saved board views">
    <header><h2>Saved views</h2><button onClick={onClose} aria-label="Close saved views">×</button></header>
    <p>Save all board content, styles, and zoom. Open a view to restore it.</p>
    <form onSubmit={submit}>
      <input value={name} onChange={event=>setName(event.target.value)} aria-label="View name" placeholder={`View ${views.length+1}`}/>
      <button>Save view</button>
    </form>
    <div className={styles.viewsList}>{views.length?views.map(view=><article key={view.id}>
      <button className={styles.viewOpen} onClick={()=>onOpen(view)} title={view.board?"Restore this saved board. You can undo this change.":"Open this saved position. Board content stays unchanged."}>
        <i><Icon name={view.board?"bookmark":"focus"} size={16}/></i>
        <span><b>{view.name}</b><small>{view.board?`${view.board.nodes.length} items`:"Position only"} · {Math.round(view.transform.scale*100)}% zoom · {new Date(view.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</small></span>
      </button>
      <button className={styles.viewDelete} onClick={()=>onDelete(view.id)} aria-label={`Delete ${view.name}`} title={`Delete ${view.name}`}><Icon name="trash" size={16}/></button>
    </article>):<div className={`${styles.panelEmpty} ${styles.viewsEmpty}`}><Icon name="bookmark" size={22}/><b>No saved views</b><span>Save your board to return to this version anytime.</span></div>}</div>
  </aside>;
}

function TaskBoard({ nodes, onMove, onChoose, onClose }) {
  const columns=[["none","Ideas"],["todo","To do"],["doing","In progress"],["done","Done"]],items=nodes.filter(node=>node.kind!=="frame");
  return <div className={styles.taskScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.taskBoard}`} aria-label="Workflow board"><header><div><small>LOCAL WORKFLOW</small><h2>Status board</h2><p>Drag cards between columns. Changes update the shapes instantly.</p></div><button onClick={onClose} aria-label="Close status board">×</button></header><div className={styles.taskColumns}>{columns.map(([status,label])=>{const rank={high:0,medium:1,low:2,none:3},matches=items.filter(node=>(node.status||"none")===status).sort((a,b)=>(rank[a.priority||"none"]-rank[b.priority||"none"])||(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));return <section key={status} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();onMove(Number(event.dataTransfer.getData("text/plain")),status)}}><header><i className={styles[`status${status[0].toUpperCase()}${status.slice(1)}`]}/><b>{label}</b><span>{matches.length}</span></header><div>{matches.map(node=><article key={node.id} className={isOverdue(node)?styles.taskOverdue:""} draggable onDragStart={event=>event.dataTransfer.setData("text/plain",String(node.id))} onDoubleClick={()=>{onChoose(node);onClose()}}><strong>{node.title||"Untitled"}</strong>{node.note&&<p>{node.note}</p>}{(node.dueDate||node.priority&&node.priority!=="none")&&<div className={styles.taskMeta}><i className={styles[`priority${(node.priority||"none")[0].toUpperCase()}${(node.priority||"none").slice(1)}`]}/><span>{node.priority&&node.priority!=="none"?node.priority:""}</span>{node.dueDate&&<time>{formatDueDate(node.dueDate)}</time>}</div>} {!!node.tags?.length&&<footer>{node.tags.slice(0,3).map(tag=><span key={tag}>#{tag}</span>)}</footer>}<small>Drag to move · Double-click to open</small></article>)}{!matches.length&&<p className={styles.taskEmpty}>Drop shapes here</p>}</div></section>})}</div></section></div>;
}

function OutlineImport({ onImport, onClose }) {
  const [text,setText]=useState(""),lineCount=text.split("\n").filter(line=>line.trim()).length;
  return <div className={styles.importScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.importPanel}`} aria-label="Import text outline"><header><div><small>BULK CREATE</small><h2>Outline to mind map</h2></div><button onClick={onClose} aria-label="Close outline import">×</button></header><p>Paste an indented outline. Nova converts every line into a shape and connects nested items automatically.</p><textarea autoFocus value={text} onChange={event=>setText(event.target.value)} placeholder={"Product launch\n  Research\n    Customer interviews\n    Market analysis\n  Build\n    Prototype\n    Testing"}/><footer><span>{lineCount} {lineCount===1?"shape":"shapes"}</span><button onClick={()=>{onImport(text);onClose()}} disabled={!lineCount}>Create mind map</button></footer></section></div>;
}

function FindReplace({ nodes, onReplace, onChoose, onClose }) {
  const [query,setQuery]=useState(""),[replacement,setReplacement]=useState("");
  const needle=query.trim().toLowerCase(),matches=needle?nodes.filter(node=>`${node.title} ${node.note} ${(node.tags||[]).join(" ")}`.toLowerCase().includes(needle)):[];
  return <div className={styles.findReplaceScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.findReplacePanel}`} aria-label="Find and replace board text"><header><div><small>BOARD-WIDE EDIT</small><h2>Find and replace</h2></div><button onClick={onClose} aria-label="Close find and replace">×</button></header><div className={styles.replaceFields}><label>Find<input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Text, status, or tag…"/></label><label>Replace with<input value={replacement} onChange={event=>setReplacement(event.target.value)} placeholder="Replacement text"/></label></div><div className={styles.replaceResults}>{matches.slice(0,8).map(node=><button key={node.id} onClick={()=>{onChoose(node);onClose()}}><i style={{background:palettes[node.color]?.[1]}}/><span><b>{node.title}</b><small>{node.note||node.tags?.map(tag=>`#${tag}`).join(" · ")||"Shape"}</small></span></button>)}{needle&&!matches.length&&<p>No matching shapes</p>}{!needle&&<p>Enter text to search titles, descriptions, and tags.</p>}</div><footer><span>{matches.length} {matches.length===1?"match":"matches"}</span><button disabled={!needle||!matches.length} onClick={()=>{onReplace(query.trim(),replacement);onClose()}}>Replace all</button></footer></section></div>;
}

function InsightsPanel({ nodes, edges, onChoose, onClose }) {
  const shapes=nodes.filter(node=>node.kind!=="frame"),connected=new Set(edges.flatMap(edge=>[edge.from,edge.to])),orphans=shapes.filter(node=>!connected.has(node.id)),unresolved=shapes.filter(node=>node.comments?.some(comment=>!comment.resolved)),tracked=shapes.filter(node=>node.status&&node.status!=="none"),done=tracked.filter(node=>node.status==="done"),titleGroups=new Map();shapes.forEach(node=>{const title=node.title.trim().toLowerCase();if(title)titleGroups.set(title,[...(titleGroups.get(title)||[]),node])});const duplicates=[...titleGroups.values()].filter(group=>group.length>1).flat(),tagCounts=new Map();shapes.flatMap(node=>node.tags||[]).forEach(tag=>tagCounts.set(tag,(tagCounts.get(tag)||0)+1));const tags=[...tagCounts].sort((a,b)=>b[1]-a[1]).slice(0,6),completion=tracked.length?Math.round(done.length/tracked.length*100):0;
  const item=(node,detail)=><button key={`${detail}-${node.id}`} onClick={()=>{onChoose(node);onClose()}}><i style={{background:palettes[node.color]?.[1]}}/><span><b>{node.title}</b><small>{detail}</small></span><strong>Open</strong></button>;
  return <div className={styles.insightsScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.insightsPanel}`} aria-label="Board insights"><header><div><small>LOCAL ANALYSIS</small><h2>Board insights</h2></div><button onClick={onClose} aria-label="Close board insights">×</button></header><div className={styles.insightStats}><article><b>{shapes.length}</b><span>Shapes</span></article><article><b>{edges.length}</b><span>Connections</span></article><article><b>{completion}%</b><span>Completed</span></article><article><b>{unresolved.length}</b><span>Open feedback</span></article></div><div className={styles.completionTrack}><i style={{width:`${completion}%`}}/></div>{tags.length>0&&<div className={styles.insightTags}>{tags.map(([tag,count])=><span key={tag}>#{tag}<b>{count}</b></span>)}</div>}<div className={styles.insightLists}><section><header><b>Orphaned ideas</b><span>{orphans.length}</span></header><div>{orphans.slice(0,6).map(node=>item(node,"No connections"))}{!orphans.length&&<p>Every idea is connected.</p>}</div></section><section><header><b>Needs attention</b><span>{unresolved.length+duplicates.length}</span></header><div>{unresolved.slice(0,3).map(node=>item(node,"Unresolved comments"))}{duplicates.slice(0,3).map(node=>item(node,"Duplicate title"))}{!unresolved.length&&!duplicates.length&&<p>No duplicate titles or open feedback.</p>}</div></section></div></section></div>;
}

function ShapeLibrary({ items, selectedCount, loading, onSave, onInsert, onDelete, onClose }) {
  const [name,setName]=useState("");
  return <div className={styles.libraryScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.libraryPanel}`} aria-label="Shape library"><header><div><small>LOCAL COMPONENTS</small><h2>Shape library</h2><p>Reusable selections are available in every project on this device.</p></div><button onClick={onClose} aria-label="Close shape library">×</button></header>{selectedCount>0&&<form onSubmit={event=>{event.preventDefault();onSave(name.trim()||`Component ${items.length+1}`);setName("")}}><input value={name} onChange={event=>setName(event.target.value)} placeholder={`Name ${selectedCount} selected ${selectedCount===1?"shape":"shapes"}…`}/><button>Save selection</button></form>}<div className={styles.libraryGrid}>{loading?<div className={`${styles.panelEmpty} ${styles.libraryEmpty}`}>Loading components…</div>:items.length?items.map(item=><article key={item.id}><div className={styles.libraryPreview}>{item.payload.nodes.slice(0,7).map((node,index)=><i key={index} style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/>)}</div><div><b>{item.name}</b><small>{item.payload.nodes.length} {item.payload.nodes.length===1?"shape":"shapes"} · {item.payload.edges.length} links</small></div><footer><button onClick={()=>onInsert(item)}>Insert</button><button onClick={()=>onDelete(item.id)} aria-label={`Delete ${item.name}`}><Icon name="trash" size={13}/></button></footer></article>):<div className={`${styles.panelEmpty} ${styles.libraryEmpty}`}><Icon name="box" size={23}/><b>No reusable components</b><span>Select shapes on the canvas, reopen the library, and save them here.</span></div>}</div></section></div>;
}

function ShortcutsPanel({ onClose }) {
  const groups=[
    ["Navigate",[["Space / ⌘ + drag","Pan canvas"],["Tab / Shift + Tab","Move between controls"],["Arrow keys","Select nearby shape"],["Home / End","First / last shape"],["[ / ]","Previous / next connection"],["Alt + Arrow","Pan canvas"],["Shift + Arrow","Add nearby shape"],["⌘ K","Search & filter"],["⌘ ⇧ K","Board commands"],["⌘ 0","Fit board"],["Esc","Clear or exit focus"]]],
    ["Edit",[["Enter","Edit selected shape"],["⌘ / Ctrl + Enter","Add child shape"],["⌘ C / ⌘ V","Copy / paste"],["⌘ X","Cut selection"],["Delete","Delete selection"]]],
    ["History",[["⌘ Z","Undo"],["⇧ ⌘ Z","Redo"],["?","Open shortcuts"]]],
  ];
  return <div className={styles.shortcutsScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.shortcutsPanel}`} aria-label="Keyboard shortcuts"><header><div><small>KEYBOARD FIRST</small><h2>Shortcuts</h2></div><button onClick={onClose} aria-label="Close keyboard shortcuts">×</button></header><div>{groups.map(([title,items])=><section key={title}><h3>{title}</h3>{items.map(([keys,label])=><p key={keys}><span>{label}</span><kbd>{keys}</kbd></p>)}</section>)}</div></section></div>;
}

function AgendaPanel({ nodes, onChoose, onComplete, onClose }) {
  const today=localDateKey(new Date()),active=nodes.filter(node=>node.kind!=="frame"&&node.status!=="done"),groups=[
    ["Overdue",active.filter(node=>node.dueDate&&node.dueDate<today).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))],
    ["Today",active.filter(node=>node.dueDate===today)],
    ["Upcoming",active.filter(node=>node.dueDate&&node.dueDate>today).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))],
    ["No date",active.filter(node=>!node.dueDate&&(node.status==="todo"||node.status==="doing"))],
  ],total=groups.reduce((sum,[,items])=>sum+items.length,0);
  return <div className={styles.agendaScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.agendaPanel}`} aria-label="Local agenda"><header><div><small>LOCAL PLANNER</small><h2>Agenda <b>{total}</b></h2><p>Prioritized work from every shape on this board.</p></div><button onClick={onClose} aria-label="Close agenda">×</button></header><div className={styles.agendaGroups}>{groups.map(([label,items])=><section key={label}><header><b>{label}</b><span>{items.length}</span></header>{items.length?items.map(node=><article key={node.id} className={label==="Overdue"?styles.agendaOverdue:""}><button onClick={()=>{onChoose(node);onClose()}}><i className={styles[`priority${(node.priority||"none")[0].toUpperCase()}${(node.priority||"none").slice(1)}`]}/><span><b>{node.title}</b><small>{node.dueDate?formatDueDate(node.dueDate):node.status==="doing"?"In progress":"To do"}</small></span></button><button onClick={()=>onComplete(node.id)} title="Mark done" aria-label={`Mark ${node.title} done`}>✓</button></article>):<p>Nothing here</p>}</section>)}</div></section></div>;
}

function ResourceHub({ nodes, onChoose, onDelete, onClose }) {
  const [query,setQuery]=useState("");
  const resources=nodes.flatMap(node=>(node.links||[]).map(link=>({...link,nodeId:node.id,nodeTitle:node.title||"Untitled",nodeColor:node.color}))),needle=query.trim().toLowerCase(),matches=resources.filter(resource=>`${resource.label} ${resource.url} ${resource.nodeTitle}`.toLowerCase().includes(needle));
  return <div className={styles.resourcesScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.resourcesPanel}`} aria-label="Resource hub"><header><div><small>BOARD RESOURCES</small><h2>Resource Hub <b>{resources.length}</b></h2><p>Every link attached to a shape, searchable in one place.</p></div><button onClick={onClose} aria-label="Close resource hub">×</button></header><div className={styles.resourceSearch}><Icon name="search" size={15}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search links, URLs, or shapes…"/></div><div className={styles.resourceList}>{matches.length?matches.map(resource=><article key={`${resource.nodeId}-${resource.id}`}><button className={styles.resourceShape} onClick={()=>{onChoose(nodes.find(node=>node.id===resource.nodeId));onClose()}} title="Open shape"><i style={{background:palettes[resource.nodeColor]?.[1]||palettes.white[1]}}/><span>{resource.nodeTitle}</span></button><a href={resource.url} target="_blank" rel="noreferrer"><Icon name="link" size={15}/><span><b>{resource.label}</b><small>{resource.url}</small></span><strong>Open ↗</strong></a><button className={styles.resourceDelete} onClick={()=>onDelete(resource.nodeId,resource.id)} aria-label={`Remove ${resource.label}`}><Icon name="trash" size={14}/></button></article>):<div className={`${styles.panelEmpty} ${styles.resourceEmpty}`}><Icon name="link" size={22}/><b>{resources.length?"No matching links":"No links yet"}</b><span>{resources.length?"Try a different search.":"Attach a URL from Shape Details and it will appear here."}</span></div>}</div></section></div>;
}

function FocusLens({ nodes, onChoose, onSelectMany, onStar, onClose }) {
  const [query,setQuery]=useState(""),[status,setStatus]=useState("all"),[priority,setPriority]=useState("all"),[scope,setScope]=useState("all"),[tag,setTag]=useState("all");
  const items=nodes.filter(node=>node.kind!=="frame"),tags=[...new Set(items.flatMap(node=>node.tags||[]))].sort(),needle=query.trim().toLowerCase(),matches=items.filter(node=>{
    if(needle&&!`${node.title} ${node.note} ${(node.tags||[]).join(" ")} ${(node.links||[]).map(link=>`${link.label} ${link.url}`).join(" ")} ${Object.values(node.customValues||{}).join(" ")} ${node.decision?.status||""} ${node.decision?.rationale||""} ${node.risk?.status||""} ${node.risk?.mitigation||""}`.toLowerCase().includes(needle))return false;
    if(status!=="all"&&(node.status||"none")!==status)return false;
    if(priority!=="all"&&(node.priority||"none")!==priority)return false;
    if(tag!=="all"&&!(node.tags||[]).includes(tag))return false;
    if(scope==="starred"&&!node.starred)return false;if(scope==="overdue"&&!isOverdue(node))return false;if(scope==="linked"&&!node.links?.length)return false;if(scope==="untagged"&&node.tags?.length)return false;
    return true;
  });
  const clear=()=>{setQuery("");setStatus("all");setPriority("all");setScope("all");setTag("all")};
  return <div className={styles.focusLensScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.focusLensPanel}`} aria-label="Focus lens"><header><div><small>BOARD QUERY</small><h2>Focus Lens <b>{matches.length}</b></h2><p>Combine filters to isolate exactly what matters.</p></div><button onClick={onClose} aria-label="Close focus lens">×</button></header><div className={styles.lensControls}><label className={styles.lensSearch}><Icon name="search" size={14}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search content and resources…"/></label><select value={status} onChange={event=>setStatus(event.target.value)} aria-label="Filter by status"><option value="all">Any status</option><option value="none">No status</option><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select><select value={priority} onChange={event=>setPriority(event.target.value)} aria-label="Filter by priority"><option value="all">Any priority</option><option value="none">No priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><select value={scope} onChange={event=>setScope(event.target.value)} aria-label="Filter by property"><option value="all">All shapes</option><option value="starred">Starred</option><option value="overdue">Overdue</option><option value="linked">Has links</option><option value="untagged">Untagged</option></select><select value={tag} onChange={event=>setTag(event.target.value)} aria-label="Filter by tag"><option value="all">Any tag</option>{tags.map(value=><option key={value} value={value}>#{value}</option>)}</select></div><div className={styles.lensResults}>{matches.length?matches.map(node=><article key={node.id}><button className={styles.lensOpen} onClick={()=>{onChoose(node);onClose()}}><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><span><b>{node.title||"Untitled"}</b><small>{[node.status&&node.status!=="none"?node.status:null,node.priority&&node.priority!=="none"?`${node.priority} priority`:null,node.dueDate&&formatDueDate(node.dueDate),(node.tags||[]).map(value=>`#${value}`).join(" ")].filter(Boolean).join(" · ")||node.note||"Shape"}</small></span></button><button className={`${styles.lensStar} ${node.starred?styles.lensStarred:""}`} onClick={()=>onStar(node.id)} aria-label={node.starred?`Unstar ${node.title}`:`Star ${node.title}`}><Icon name="star" size={15}/></button></article>):<div className={`${styles.panelEmpty} ${styles.lensEmpty}`}><Icon name="focus" size={22}/><b>No matching shapes</b><span>Clear a filter or try another search.</span></div>}</div><footer><button onClick={clear}>Clear filters</button><span>{matches.length} of {items.length} shapes</span><button className={styles.lensSelect} disabled={!matches.length} onClick={()=>{onSelectMany(matches);onClose()}}>Select results</button></footer></section></div>;
}

function DependencyCenter({ nodes, edges, onChoose, onChangeType, onClose }) {
  const [query,setQuery]=useState(""),[type,setType]=useState("all"),needle=query.trim().toLowerCase(),nodeMap=new Map(nodes.map(node=>[node.id,node]));
  const relationships=edges.map(edge=>({edge,source:nodeMap.get(edge.from),target:nodeMap.get(edge.to)})).filter(item=>item.source&&item.target),matches=relationships.filter(item=>(type==="all"||(item.edge.relation||"related")===type)&&(!needle||`${item.source.title} ${item.target.title} ${item.edge.label||""} ${relationLabel(item.edge.relation)}`.toLowerCase().includes(needle))),activeBlockers=relationships.filter(item=>item.edge.relation==="blocks"&&item.source.status!=="done"&&item.target.status!=="done");
  return <div className={styles.dependencyScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.dependencyPanel}`} aria-label="Dependency center"><header><div><small>RELATIONSHIP INTELLIGENCE</small><h2>Dependency Center <b>{activeBlockers.length} active</b></h2><p>Classify connections and see what is blocking progress.</p></div><button onClick={onClose} aria-label="Close dependency center">×</button></header>{activeBlockers.length>0&&<div className={styles.blockerStrip}><strong>Active blockers</strong><div>{activeBlockers.slice(0,4).map(item=><button key={item.edge.id} onClick={()=>{onChoose(item.target);onClose()}}><span>{item.source.title}</span><b>blocks</b><span>{item.target.title}</span></button>)}</div></div>}<div className={styles.dependencyFilters}><label><Icon name="search" size={14}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search relationships…"/></label><select value={type} onChange={event=>setType(event.target.value)}><option value="all">All types</option>{relationTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><div className={styles.dependencyList}>{matches.length?matches.map(({edge,source,target})=><article key={edge.id}><button onClick={()=>onChoose(source)}><i style={{background:palettes[source.color]?.[1]}}/><span>{source.title}</span></button><div><select value={edge.relation||"related"} onChange={event=>onChangeType(edge.id,event.target.value)} aria-label={`Relationship from ${source.title} to ${target.title}`}>{relationTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>{edge.label&&<small>{edge.label}</small>}</div><button onClick={()=>onChoose(target)}><span>{target.title}</span><i style={{background:palettes[target.color]?.[1]}}/></button></article>):<div className={`${styles.panelEmpty} ${styles.dependencyEmpty}`}>No matching relationships</div>}</div><footer>{matches.length} of {relationships.length} connections</footer></section></div>;
}

function StorylineBuilder({ frames, onMove, onToggle, onNote, onChoose, onClose }) {
  const included=frames.filter(frame=>!frame.presentationExcluded).length;
  return <div className={styles.storyScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.storyPanel}`} aria-label="Storyline builder"><header><div><small>PRESENTATION FLOW</small><h2>Storyline Builder <b>{included}</b></h2><p>Choose the sequence, skip optional sections, and prepare private notes.</p></div><button onClick={onClose} aria-label="Close storyline builder">×</button></header><div className={styles.storyList}>{frames.length?frames.map((frame,index)=><article key={frame.id} className={frame.presentationExcluded?styles.storyExcluded:""}><div className={styles.storyOrder}><button disabled={!index} onClick={()=>onMove(frame.id,-1)} aria-label={`Move ${frame.title} earlier`}>↑</button><b>{index+1}</b><button disabled={index===frames.length-1} onClick={()=>onMove(frame.id,1)} aria-label={`Move ${frame.title} later`}>↓</button></div><button className={styles.storyFrame} onClick={()=>{onChoose(frame);onClose()}}><i style={{background:palettes[frame.color]?.[1]||palettes.violet[1]}}/><span><b>{frame.title||"Untitled section"}</b><small>{frame.presentationExcluded?"Skipped during presentation":"Included in presentation"}</small></span></button><label className={styles.storyInclude}><input type="checkbox" checked={!frame.presentationExcluded} onChange={()=>onToggle(frame.id)}/><span>Include</span></label><textarea key={`${frame.id}-${frame.presenterNote||""}`} defaultValue={frame.presenterNote||""} onBlur={event=>onNote(frame.id,event.target.value)} placeholder="Private presenter note…" rows="2"/></article>):<div className={`${styles.panelEmpty} ${styles.storyEmpty}`}><Icon name="present" size={24}/><b>No frames yet</b><span>Add frames to turn board sections into a guided presentation.</span></div>}</div><footer><span>{included} of {frames.length} frames will play</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function DataTable({ nodes, onChange, onBulkChange, onChoose, onClose }) {
  const [query,setQuery]=useState(""),[sort,setSort]=useState("title"),[selected,setSelected]=useState([]),[bulkStatus,setBulkStatus]=useState(""),[bulkPriority,setBulkPriority]=useState("");
  const needle=query.trim().toLowerCase(),rank={high:0,medium:1,low:2,none:3},items=nodes.filter(node=>node.kind!=="frame"&&(!needle||`${node.title} ${node.note} ${node.status||""} ${node.priority||""} ${node.dueDate||""} ${(node.tags||[]).join(" ")}`.toLowerCase().includes(needle))).sort((a,b)=>sort==="due"?(a.dueDate||"9999").localeCompare(b.dueDate||"9999"):sort==="priority"?rank[a.priority||"none"]-rank[b.priority||"none"]:sort==="status"?(a.status||"none").localeCompare(b.status||"none"):(a.title||"").localeCompare(b.title||"")),visibleIds=items.map(node=>node.id),allSelected=visibleIds.length>0&&visibleIds.every(id=>selected.includes(id));
  const toggle=id=>setSelected(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]),toggleAll=()=>setSelected(current=>allSelected?current.filter(id=>!visibleIds.includes(id)):[...new Set([...current,...visibleIds])]),applyBulk=()=>{const changes={};if(bulkStatus)changes.status=bulkStatus;if(bulkPriority)changes.priority=bulkPriority;if(Object.keys(changes).length&&selected.length)onBulkChange(selected,changes);setBulkStatus("");setBulkPriority("")};
  return <div className={styles.tableScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.dataTablePanel}`} aria-label="Board data table"><header><div><small>STRUCTURED BOARD DATA</small><h2>Data Table <b>{items.length}</b></h2><p>Edit shape metadata at scale without leaving the board.</p></div><button onClick={onClose} aria-label="Close data table">×</button></header><div className={styles.tableControls}><label><Icon name="search" size={14}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search titles, notes, tags…"/></label><select value={sort} onChange={event=>setSort(event.target.value)} aria-label="Sort shapes"><option value="title">Sort: Title</option><option value="due">Sort: Due date</option><option value="priority">Sort: Priority</option><option value="status">Sort: Status</option></select></div>{selected.length>0&&<div className={styles.tableBulk}><b>{selected.length} selected</b><select value={bulkStatus} onChange={event=>setBulkStatus(event.target.value)}><option value="">Set status…</option><option value="none">No status</option><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select><select value={bulkPriority} onChange={event=>setBulkPriority(event.target.value)}><option value="">Set priority…</option><option value="none">No priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><button disabled={!bulkStatus&&!bulkPriority} onClick={applyBulk}>Apply</button><button onClick={()=>setSelected([])}>Clear</button></div>}<div className={styles.tableViewport}><div className={styles.tableHeader}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select visible shapes"/><span>Shape</span><span>Status</span><span>Priority</span><span>Due</span><span>Tags</span><span/></div><div className={styles.tableRows}>{items.map(node=><article key={node.id} className={selected.includes(node.id)?styles.tableRowSelected:""}><input type="checkbox" checked={selected.includes(node.id)} onChange={()=>toggle(node.id)} aria-label={`Select ${node.title}`}/><label><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><input key={`${node.id}-${node.title}`} defaultValue={node.title} onBlur={event=>{const title=event.target.value.trim()||"Untitled";if(title!==node.title)onChange(node.id,{title})}} aria-label={`Title for ${node.title}`}/></label><select value={node.status||"none"} onChange={event=>onChange(node.id,{status:event.target.value})}><option value="none">None</option><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select><select value={node.priority||"none"} onChange={event=>onChange(node.id,{priority:event.target.value})}><option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><input type="date" value={node.dueDate||""} onChange={event=>onChange(node.id,{dueDate:event.target.value})}/><input key={`${node.id}-${(node.tags||[]).join(",")}`} defaultValue={(node.tags||[]).join(", ")} onBlur={event=>{const tags=[...new Set(event.target.value.split(",").map(value=>value.trim().replace(/^#/,"")).filter(Boolean))].slice(0,8);if(tags.join("|")!==(node.tags||[]).join("|"))onChange(node.id,{tags})}} placeholder="tag, tag" aria-label={`Tags for ${node.title}`}/><button onClick={()=>{onChoose(node);onClose()}} aria-label={`Open ${node.title}`}>↗</button></article>)}{!items.length&&<div className={`${styles.panelEmpty} ${styles.tableEmpty}`}>No matching shapes</div>}</div></div><footer><span>{selected.length?`${selected.length} selected · `:""}{nodes.filter(node=>node.kind!=="frame").length} total shapes</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function AutomationPanel({ rules, onAdd, onChange, onDelete, onClose }) {
  const conditionValues={status:[["none","No status"],["todo","To do"],["doing","In progress"],["done","Done"]],priority:[["none","No priority"],["low","Low"],["medium","Medium"],["high","High"]]},actionValues={status:[["none","No status"],["todo","To do"],["doing","In progress"],["done","Done"]],priority:[["none","No priority"],["low","Low"],["medium","Medium"],["high","High"]],color:Object.keys(palettes).map(value=>[value,value[0].toUpperCase()+value.slice(1)]),starred:[["true","Star shape"],["false","Remove star"]]};
  return <div className={styles.automationScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.automationPanel}`} aria-label="Local automations"><header><div><small>LOCAL WORKFLOWS</small><h2>Automations <b>{rules.filter(rule=>rule.enabled).length}</b></h2><p>Rules run instantly on this device whenever board data changes.</p></div><button onClick={onClose} aria-label="Close automations">×</button></header><div className={styles.automationList}>{rules.length?rules.map((rule,index)=><article key={rule.id} className={rule.enabled?"":styles.automationDisabled}><label className={styles.ruleSwitch}><input type="checkbox" checked={rule.enabled} onChange={event=>onChange(rule.id,{enabled:event.target.checked})}/><span/></label><div className={styles.ruleBody}><small>WHEN</small><select value={rule.whenField} onChange={event=>{const whenField=event.target.value,whenValue=whenField==="status"||whenField==="priority"?"none":"";onChange(rule.id,{whenField,whenValue})}}><option value="status">Status is</option><option value="priority">Priority is</option><option value="tag">Tag contains</option><option value="overdue">Is overdue</option></select>{rule.whenField==="tag"?<input value={rule.whenValue} onChange={event=>onChange(rule.id,{whenValue:event.target.value})} placeholder="Tag name"/>:rule.whenField!=="overdue"?<select value={rule.whenValue} onChange={event=>onChange(rule.id,{whenValue:event.target.value})}>{conditionValues[rule.whenField].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>:<span className={styles.ruleAutomatic}>Automatic</span>}</div><div className={styles.ruleArrow}>→</div><div className={styles.ruleBody}><small>THEN</small><select value={rule.actionField} onChange={event=>{const actionField=event.target.value;onChange(rule.id,{actionField,actionValue:actionValues[actionField][0][0]})}}><option value="priority">Set priority</option><option value="status">Set status</option><option value="color">Set color</option><option value="starred">Set star</option></select><select value={rule.actionValue} onChange={event=>onChange(rule.id,{actionValue:event.target.value})}>{actionValues[rule.actionField].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><button className={styles.ruleDelete} onClick={()=>onDelete(rule.id)} aria-label={`Delete automation ${index+1}`}><Icon name="trash" size={14}/></button></article>):<div className={`${styles.panelEmpty} ${styles.automationEmpty}`}><Icon name="spark" size={24}/><b>No automations yet</b><span>Create a rule to keep repetitive board maintenance automatic.</span></div>}</div><footer><span>{rules.length} {rules.length===1?"rule":"rules"} stored with this board</span><button onClick={onAdd}><Icon name="plus" size={14}/>Add rule</button></footer></section></div>;
}

function CustomFieldsPanel({ fields, nodes, onAdd, onUpdate, onDelete, onSetValue, onClose }) {
  const shapes=nodes.filter(node=>node.kind!=="frame"),[name,setName]=useState(""),[type,setType]=useState("text"),[options,setOptions]=useState(""),[shapeId,setShapeId]=useState(shapes[0]?.id||""),shape=shapes.find(node=>String(node.id)===String(shapeId));
  const submit=event=>{event.preventDefault();const clean=name.trim();if(!clean)return;onAdd({name:clean,type,options:type==="select"?options.split(",").map(value=>value.trim()).filter(Boolean).slice(0,12):[]});setName("");setOptions("")};
  const fieldInput=field=>{const value=shape?.customValues?.[field.id]??(field.type==="checkbox"?false:"");if(field.type==="checkbox")return <div className={styles.customCheck}><input type="checkbox" checked={Boolean(value)} onChange={event=>onSetValue(shape.id,field.id,event.target.checked)}/><span>{value?"Checked":"Unchecked"}</span></div>;if(field.type==="select")return <select value={value} onChange={event=>onSetValue(shape.id,field.id,event.target.value)}><option value="">Not set</option>{(field.options||[]).map(option=><option key={option} value={option}>{option}</option>)}</select>;return <input key={`${shape?.id}-${field.id}-${value}`} type={field.type==="number"?"number":field.type==="date"?"date":"text"} defaultValue={value} onBlur={event=>{const next=field.type==="number"&&event.target.value!==""?Number(event.target.value):event.target.value;if(next!==value)onSetValue(shape.id,field.id,next)}} placeholder={field.type==="text"?`Enter ${field.name.toLowerCase()}…`:undefined}/>};
  return <div className={styles.fieldsScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.fieldsPanel}`} aria-label="Custom fields"><header><div><small>BOARD SCHEMA</small><h2>Custom Fields <b>{fields.length}</b></h2><p>Create structured properties that every shape can use.</p></div><button onClick={onClose} aria-label="Close custom fields">×</button></header><div className={styles.fieldsBody}><aside><form onSubmit={submit}><input value={name} onChange={event=>setName(event.target.value)} placeholder="Field name" maxLength="32"/><select value={type} onChange={event=>setType(event.target.value)}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Choice</option><option value="checkbox">Checkbox</option></select>{type==="select"&&<input value={options} onChange={event=>setOptions(event.target.value)} placeholder="Choices, comma separated"/>}<button disabled={!name.trim()}>Add field</button></form><div className={styles.fieldDefinitions}>{fields.map(field=><article key={field.id}><span><b>{field.name}</b><small>{field.type}{field.type==="select"&&field.options?.length?` · ${field.options.length} choices`:""}</small></span><button onClick={()=>{const next=window.prompt("Rename field",field.name)?.trim();if(next&&next!==field.name)onUpdate(field.id,{name:next})}} aria-label={`Rename ${field.name}`}>Rename</button><button onClick={()=>onDelete(field.id)} aria-label={`Delete ${field.name}`}><Icon name="trash" size={13}/></button></article>)}{!fields.length&&<div className={`${styles.panelEmpty} ${styles.fieldsEmpty}`}>Create the first field for this board.</div>}</div></aside><main><label>Editing shape<select value={shapeId} onChange={event=>setShapeId(event.target.value)}>{shapes.map(node=><option key={node.id} value={node.id}>{node.title||"Untitled"}</option>)}</select></label><div className={styles.customValueList}>{shape&&fields.length?fields.map(field=><label key={field.id}><span><b>{field.name}</b><small>{field.type}</small></span>{fieldInput(field)}</label>):<div className={`${styles.panelEmpty} ${styles.customValuesEmpty}`}><Icon name="grid" size={23}/><b>{shape?"No custom fields":"No shapes available"}</b><span>{shape?"Add a field to begin capturing structured data.":"Create a shape first."}</span></div>}</div></main></div><footer><span>Field definitions and values stay inside this local project.</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function DataExchange({ nodes, fields, onExport, onImport, onClose }) {
  const [text,setText]=useState(""),[mode,setMode]=useState("append"),rows=useMemo(()=>parseCsv(text),[text]),headers=rows[0]?Object.keys(rows[0]):[],validRows=rows.filter(row=>Object.values(row).some(value=>String(value).trim()));
  const loadFile=async event=>{const file=event.target.files?.[0];if(file)setText(await file.text());event.target.value=""};
  return <div className={styles.exchangeScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.exchangePanel}`} aria-label="CSV data exchange"><header><div><small>PORTABLE BOARD DATA</small><h2>CSV Data Exchange</h2><p>Move structured board data between Nova and spreadsheet tools.</p></div><button onClick={onClose} aria-label="Close data exchange">×</button></header><div className={styles.exchangeActions}><article><Icon name="share" size={20}/><span><b>Export board data</b><small>{nodes.filter(node=>node.kind!=="frame").length} shapes · {fields.length} custom fields</small></span><button onClick={onExport}>Download CSV</button></article><article><Icon name="grid" size={20}/><span><b>Import CSV</b><small>Paste below or choose a local CSV file</small></span><label>Choose file<input type="file" accept=".csv,text/csv" onChange={loadFile}/></label></article></div><textarea value={text} onChange={event=>setText(event.target.value)} placeholder={'id,title,note,status,priority,due_date,tags,starred,color\n1,"Launch plan",Next steps,todo,high,2026-10-01,"strategy, launch",true,violet'} rows="8"/><div className={styles.exchangeMode}><label><input type="radio" name="import-mode" checked={mode==="append"} onChange={()=>setMode("append")}/><span><b>Append as new</b><small>Create new shapes and ignore imported IDs.</small></span></label><label><input type="radio" name="import-mode" checked={mode==="merge"} onChange={()=>setMode("merge")}/><span><b>Update by ID</b><small>Update matching shapes; append rows without a match.</small></span></label></div><div className={styles.csvPreview}><header><b>Preview</b><span>{validRows.length} {validRows.length===1?"row":"rows"} · {headers.length} columns</span></header>{validRows.length?<div><table><thead><tr>{headers.slice(0,5).map(header=><th key={header}>{header}</th>)}</tr></thead><tbody>{validRows.slice(0,4).map((row,index)=><tr key={index}>{headers.slice(0,5).map(header=><td key={header}>{row[header]}</td>)}</tr>)}</tbody></table>{headers.length>5&&<small>+ {headers.length-5} more columns</small>}</div>:<p>Imported rows will appear here before anything changes.</p>}</div><footer><span>CSV processing stays on this device.</span><button disabled={!validRows.length} onClick={()=>{onImport(validRows,mode);onClose()}}>Import {validRows.length||""} {validRows.length===1?"row":"rows"}</button></footer></section></div>;
}

/*
function CalendarView({ nodes, onSetDue, onChoose, onClose }) {
  const today=new Date(),todayKey=localDateKey(today),[month,setMonth]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1)),tasks=nodes.filter(node=>node.kind!=="frame"),start=new Date(month.getFullYear(),month.getMonth(),1-month.getDay()),days=Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date}),undated=tasks.filter(node=>!node.dueDate&&node.status!=="done").sort((a,b)=>({high:0,medium:1,low:2,none:3}[a.priority||"none"]-({high:0,medium:1,low:2,none:3}[b.priority||"none"])));
  const drop=(event,dueDate)=>{event.preventDefault();const id=Number(event.dataTransfer.getData("text/plain"));if(Number.isFinite(id))onSetDue(id,dueDate)};
  return <div className={styles.calendarScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.calendarPanel}`} aria-label="Board calendar"><header><div><small>LOCAL SCHEDULE</small><h2>Calendar</h2><p>Drag shapes onto dates to plan or reschedule them.</p></div><div className={styles.calendarNav}><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()-1,1))} aria-label="Previous month">←</button><button onClick={()=>setMonth(new Date(today.getFullYear(),today.getMonth(),1))}>Today</button><b>{month.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</b><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()+1,1))} aria-label="Next month">→</button></div><button className={styles.calendarClose} onClick={onClose} aria-label="Close calendar">×</button></header><div className={styles.calendarBody}><aside onDragOver={event=>event.preventDefault()} onDrop={event=>drop(event,"")}><header><b>Unscheduled</b><span>{undated.length}</span></header><div>{undated.map(node=><button key={node.id} draggable onDragStart={event=>event.dataTransfer.setData("text/plain",String(node.id))} onClick={()=>{onChoose(node);onClose()}}><i className={styles[`priority${(node.priority||"none")[0].toUpperCase()}${(node.priority||"none").slice(1)}`]}/><span>{node.title||"Untitled"}</span></button>)}{!undated.length&&<p>Drop here to clear a date</p>}</div></aside><main><div className={styles.weekdays}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><span key={day}>{day}</span>)}</div><div className={styles.calendarGrid}>{days.map(date=>{const key=localDateKey(date),items=tasks.filter(node=>node.dueDate===key).sort((a,b)=>({high:0,medium:1,low:2,none:3}[a.priority||"none"]-({high:0,medium:1,low:2,none:3}[b.priority||"none"])),outside=date.getMonth()!==month.getMonth();return <section key={key} className={`${outside?styles.calendarOutside:""} ${key===todayKey?styles.calendarToday:""}`} onDragOver={event=>event.preventDefault()} onDrop={event=>drop(event,key)}><header><span>{date.getDate()}</span>{items.length>3&&<b>+{items.length-3}</b>}</header>{items.slice(0,3).map(node=><button key={node.id} className={`${node.status==="done"?styles.calendarDone:""} ${isOverdue(node)?styles.calendarOverdue:""}`} draggable onDragStart={event=>event.dataTransfer.setData("text/plain",String(node.id))} onClick={()=>{onChoose(node);onClose()}} title={node.title}><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><span>{node.title||"Untitled"}</span></button>)}</section>})}</div></main></div><footer><span>{tasks.filter(node=>node.dueDate).length} scheduled · {undated.length} unscheduled</span><small>Drag any card between days or back to Unscheduled.</small></footer></section></div>;
}

*/

function ProgressDashboard({ nodes, metrics, onChoose, onClose }) {
  const [filter,setFilter]=useState("all"),items=nodes.filter(node=>metrics.has(node.id)).map(node=>({node,...metrics.get(node.id)})).filter(item=>filter==="risk"?item.overdue||item.blocked:filter==="complete"?item.percent===100:filter==="active"?item.percent>0&&item.percent<100:true).sort((a,b)=>(b.overdue+b.blocked)-(a.overdue+a.blocked)||a.percent-b.percent),all=[...metrics.values()],work=nodes.filter(node=>node.kind!=="frame"),overall=work.length?Math.round(work.filter(node=>node.status==="done").length/work.length*100):0;
  return <div className={styles.progressScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.progressPanel}`} aria-label="Branch progress"><header><div><small>HIERARCHY HEALTH</small><h2>Progress Rollups</h2><p>Completion and risk calculated across every connected branch.</p></div><button onClick={onClose} aria-label="Close progress rollups">×</button></header><div className={styles.progressSummary}><article><b>{overall}%</b><span>Overall completion</span><i><em style={{width:`${overall}%`}}/></i></article><article><b>{all.length}</b><span>Tracked branches</span></article><article><b>{all.reduce((sum,item)=>sum+item.overdue,0)}</b><span>Overdue descendants</span></article><article><b>{all.reduce((sum,item)=>sum+item.blocked,0)}</b><span>Blocked descendants</span></article></div><div className={styles.progressFilters}>{[["all","All"],["active","In progress"],["risk","At risk"],["complete","Complete"]].map(([value,label])=><button key={value} className={filter===value?styles.progressFilterActive:""} onClick={()=>setFilter(value)}>{label}</button>)}</div><div className={styles.progressList}>{items.length?items.map(item=><button key={item.node.id} onClick={()=>{onChoose(item.node);onClose()}}><i style={{background:palettes[item.node.color]?.[1]||palettes.white[1]}}/><span><b>{item.node.title||"Untitled branch"}</b><small>{item.done} of {item.total} complete{item.overdue?` · ${item.overdue} overdue`:""}{item.blocked?` · ${item.blocked} blocked`:""}</small><em><u style={{width:`${item.percent}%`}}/></em></span><strong>{item.percent}%</strong></button>):<div className={`${styles.panelEmpty} ${styles.progressEmpty}`}><Icon name="layout" size={23}/><b>No matching branches</b><span>Connect child shapes and assign statuses to build progress rollups.</span></div>}</div><footer><span>Rollups update automatically from descendant statuses.</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function WorkloadPanel({ members, nodes, onAddMember, onDeleteMember, onAssign, onChoose, onClose }) {
  const [name,setName]=useState(""),[filter,setFilter]=useState("active"),tasks=nodes.filter(node=>node.kind!=="frame"&&(filter==="all"||node.status!=="done")),submit=event=>{event.preventDefault();if(name.trim()){onAddMember(name.trim());setName("")}},metrics=members.map(member=>{const assigned=nodes.filter(node=>node.kind!=="frame"&&node.assigneeId===member.id),active=assigned.filter(node=>node.status!=="done");return{member,assigned,active:active.length,overdue:active.filter(isOverdue).length,high:active.filter(node=>node.priority==="high").length,done:assigned.filter(node=>node.status==="done").length}}),unassigned=tasks.filter(node=>!node.assigneeId).length;
  return <div className={styles.workloadScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.workloadPanel}`} aria-label="Team and workload"><header><div><small>LOCAL OWNERSHIP</small><h2>Team & Workload <b>{members.length}</b></h2><p>Assign responsibility and balance active work without an account system.</p></div><button onClick={onClose} aria-label="Close team and workload">×</button></header><form className={styles.memberForm} onSubmit={submit}><input value={name} onChange={event=>setName(event.target.value)} placeholder="Add a board member…" maxLength="32"/><button disabled={!name.trim()}><Icon name="plus" size={14}/>Add member</button></form><div className={styles.memberMetrics}>{metrics.map(({member,assigned,active,overdue,high,done})=><article key={member.id}><i style={{background:member.color}}>{member.initials}</i><span><b>{member.name}</b><small>{active} active · {done}/{assigned.length} done</small></span><em className={overdue?styles.memberRisk:""}>{overdue?`${overdue} overdue`:high?`${high} high`:"On track"}</em><button onClick={()=>onDeleteMember(member.id)} aria-label={`Remove ${member.name}`}><Icon name="trash" size={13}/></button></article>)}{!members.length&&<div className={`${styles.panelEmpty} ${styles.workloadEmpty}`}>Add members to begin assigning work.</div>}</div><div className={styles.workloadToolbar}><b>Assignments</b><span>{unassigned} unassigned</span><div><button className={filter==="active"?styles.workloadFilterActive:""} onClick={()=>setFilter("active")}>Active</button><button className={filter==="all"?styles.workloadFilterActive:""} onClick={()=>setFilter("all")}>All</button></div></div><div className={styles.assignmentList}>{tasks.map(node=>{const member=members.find(item=>item.id===node.assigneeId);return <article key={node.id}><button onClick={()=>{onChoose(node);onClose()}}><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><span><b>{node.title||"Untitled"}</b><small>{[node.status&&node.status!=="none"?node.status:null,node.dueDate&&formatDueDate(node.dueDate),isOverdue(node)?"overdue":null].filter(Boolean).join(" · ")||"No schedule"}</small></span></button><select value={node.assigneeId||""} onChange={event=>onAssign(node.id,event.target.value)} aria-label={`Assign ${node.title}`}><option value="">Unassigned</option>{members.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{member&&<i className={styles.assignmentAvatar} style={{background:member.color}}>{member.initials}</i>}</article>})}{!tasks.length&&<div className={`${styles.panelEmpty} ${styles.workloadEmpty}`}>No shapes in this view.</div>}</div><footer><span>Members and assignments are stored only in this board.</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function FocusSessions({ nodes, activeTimer, now, onStart, onStop, onReset, onChoose, onClose }) {
  const [query,setQuery]=useState(""),needle=query.trim().toLowerCase(),tasks=nodes.filter(node=>node.kind!=="frame"&&(!needle||`${node.title} ${node.note} ${(node.tags||[]).join(" ")}`.toLowerCase().includes(needle))).sort((a,b)=>(b.timeSpent||0)-(a.timeSpent||0)),activeNode=nodes.find(node=>node.id===activeTimer?.nodeId),liveSeconds=activeTimer?Math.floor((now-activeTimer.startedAt)/1000):0,totalTracked=nodes.reduce((sum,node)=>sum+(node.timeSpent||0),0)+liveSeconds;
  return <div className={styles.focusSessionsScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.focusSessionsPanel}`} aria-label="Focus sessions"><header><div><small>LOCAL TIME TRACKING</small><h2>Focus Sessions</h2><p>Track concentrated work against shapes without sending activity anywhere.</p></div><button onClick={onClose} aria-label="Close focus sessions">×</button></header>{activeNode&&<div className={styles.activeSession}><i style={{background:palettes[activeNode.color]?.[1]||palettes.white[1]}}/><span><small>FOCUSING NOW</small><b>{activeNode.title||"Untitled"}</b></span><strong>{formatDuration((activeNode.timeSpent||0)+liveSeconds)}</strong><button onClick={onStop}>Stop & save</button></div>}<div className={styles.sessionSummary}><article><b>{formatDuration(totalTracked)}</b><span>Total focused</span></article><article><b>{nodes.filter(node=>node.timeSpent).length}</b><span>Tracked shapes</span></article><label><Icon name="search" size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a shape…"/></label></div><div className={styles.sessionList}>{tasks.map(node=>{const running=activeTimer?.nodeId===node.id,seconds=(node.timeSpent||0)+(running?liveSeconds:0);return <article key={node.id} className={running?styles.sessionRunning:""}><button onClick={()=>{onChoose(node);onClose()}}><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><span><b>{node.title||"Untitled"}</b><small>{node.status&&node.status!=="none"?node.status:"Shape"}</small></span></button><strong>{formatDuration(seconds)}</strong>{running?<button className={styles.sessionStop} onClick={onStop}>Stop</button>:<button className={styles.sessionStart} onClick={()=>onStart(node.id)}>{activeTimer?"Switch":"Start"}</button>}<button className={styles.sessionReset} disabled={!node.timeSpent||running} onClick={()=>onReset(node.id)} aria-label={`Reset time for ${node.title}`}><Icon name="history" size={13}/></button></article>})}</div><footer><span>The active timer continues after closing this panel.</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function RecurringWork({ nodes, onSet, onRemove, onChoose, onClose }) {
  const shapes=nodes.filter(node=>node.kind!=="frame"),[shapeId,setShapeId]=useState(shapes.find(node=>node.status!=="done")?.id||shapes[0]?.id||""),[frequency,setFrequency]=useState("weekly"),[interval,setIntervalValue]=useState(1),[dueDate,setDueDate]=useState(localDateKey(new Date())),recurring=shapes.filter(node=>node.recurrence&&node.status!=="done").sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
  const submit=event=>{event.preventDefault();if(!shapeId||!dueDate)return;onSet(Number(shapeId),{frequency,interval:Math.max(1,Number(interval)||1)},dueDate)};
  return <div className={styles.recurringScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.recurringPanel}`} aria-label="Recurring work"><header><div><small>REPEATING SCHEDULES</small><h2>Recurring Work <b>{recurring.length}</b></h2><p>Completing an occurrence automatically creates the next scheduled shape.</p></div><button onClick={onClose} aria-label="Close recurring work">×</button></header><form className={styles.recurrenceForm} onSubmit={submit}><label>Shape<select value={shapeId} onChange={event=>setShapeId(event.target.value)}>{shapes.map(node=><option key={node.id} value={node.id}>{node.title||"Untitled"}</option>)}</select></label><label>Repeat<select value={frequency} onChange={event=>setFrequency(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Every<input type="number" min="1" max="99" value={interval} onChange={event=>setIntervalValue(event.target.value)}/></label><label>First due<input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)}/></label><button disabled={!shapeId||!dueDate}>Set recurrence</button></form><div className={styles.recurrencePreview}><span>Next dates</span>{[1,2,3].map(step=><b key={step}>{formatDueDate(Array.from({length:step}).reduce(date=>nextRecurringDate(date,frequency,interval),dueDate))}</b>)}</div><div className={styles.recurringList}>{recurring.length?recurring.map(node=><article key={node.id}><button onClick={()=>{onChoose(node);onClose()}}><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><span><b>{node.title||"Untitled"}</b><small>Every {node.recurrence.interval>1?`${node.recurrence.interval} `:""}{node.recurrence.frequency.replace("daily","day").replace("weekly","week").replace("monthly","month")}{node.recurrence.interval>1?"s":""} · next {formatDueDate(node.dueDate)}</small></span></button><strong>{node.status==="done"?"Completed":"Active"}</strong><button onClick={()=>onRemove(node.id)} aria-label={`Remove recurrence from ${node.title}`}><Icon name="trash" size={13}/></button></article>):<div className={`${styles.panelEmpty} ${styles.recurringEmpty}`}><Icon name="history" size={24}/><b>No recurring work</b><span>Choose a shape and schedule above to create the first recurrence.</span></div>}</div><footer><span>Each generated occurrence remains independently editable.</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function DecisionLog({ nodes, onSave, onDelete, onChoose, onClose }) {
  const shapes=nodes.filter(node=>node.kind!=="frame"),[shapeId,setShapeId]=useState(shapes[0]?.id||""),[status,setStatus]=useState("proposed"),[rationale,setRationale]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState("all"),needle=query.trim().toLowerCase(),decisions=shapes.filter(node=>node.decision&&(filter==="all"||node.decision.status===filter)&&(!needle||`${node.title} ${node.decision.rationale} ${node.decision.status}`.toLowerCase().includes(needle))).sort((a,b)=>(b.decision.updatedAt||b.decision.createdAt||0)-(a.decision.updatedAt||a.decision.createdAt||0));
  const submit=event=>{event.preventDefault();if(!shapeId||!rationale.trim())return;onSave(Number(shapeId),status,rationale.trim());setRationale("")};
  return <div className={styles.decisionsScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.decisionsPanel}`} aria-label="Decision log"><header><div><small>LOCAL DECISION MEMORY</small><h2>Decision Log <b>{shapes.filter(node=>node.decision).length}</b></h2><p>Capture what was decided, why, and what still needs another look.</p></div><button onClick={onClose} aria-label="Close decision log">×</button></header><form className={styles.decisionForm} onSubmit={submit}><select value={shapeId} onChange={event=>setShapeId(event.target.value)} aria-label="Decision shape">{shapes.map(node=><option key={node.id} value={node.id}>{node.title||"Untitled"}</option>)}</select><select value={status} onChange={event=>setStatus(event.target.value)} aria-label="Decision status"><option value="proposed">Proposed</option><option value="decided">Decided</option><option value="revisit">Revisit</option></select><textarea value={rationale} onChange={event=>setRationale(event.target.value)} placeholder="Record the rationale, trade-offs, or next question…" rows="3"/><button disabled={!shapeId||!rationale.trim()}>Record decision</button></form><div className={styles.decisionTools}><label><Icon name="search" size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search decisions…"/></label><div>{[["all","All"],["proposed","Proposed"],["decided","Decided"],["revisit","Revisit"]].map(([value,label])=><button key={value} className={filter===value?styles.decisionFilterActive:""} onClick={()=>setFilter(value)}>{label}</button>)}</div></div><div className={styles.decisionList}>{decisions.length?decisions.map(node=><article key={node.id}><button onClick={()=>{onChoose(node);onClose()}}><i className={styles[`decision${node.decision.status[0].toUpperCase()}${node.decision.status.slice(1)}`]}>{node.decision.status==="decided"?"✓":node.decision.status==="revisit"?"↻":"?"}</i><span><b>{node.title||"Untitled"}</b><p>{node.decision.rationale}</p><small>{node.decision.status} · {new Date(node.decision.updatedAt||node.decision.createdAt).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric"})}</small></span></button><button onClick={()=>onDelete(node.id)} aria-label={`Delete decision for ${node.title}`}><Icon name="trash" size={13}/></button></article>):<div className={`${styles.panelEmpty} ${styles.decisionEmpty}`}><Icon name="note" size={24}/><b>No matching decisions</b><span>Record the reasoning behind an important shape to build durable context.</span></div>}</div><footer><span>Decision history remains attached to its shape.</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function PrioritizationLab({ nodes, onScore, onClear, onChoose, onClose }) {
  const shapes=nodes.filter(node=>node.kind!=="frame"),[shapeId,setShapeId]=useState(shapes[0]?.id||""),[impact,setImpact]=useState(3),[effort,setEffort]=useState(3),[confidence,setConfidence]=useState(3),[query,setQuery]=useState(""),[filter,setFilter]=useState("all"),needle=query.trim().toLowerCase(),scored=shapes.map(node=>node.scoring?{node,...node.scoring,score:(node.scoring.impact*node.scoring.confidence)/node.scoring.effort}:null).filter(Boolean).filter(item=>!needle||`${item.node.title} ${item.node.note} ${(item.node.tags||[]).join(" ")}`.toLowerCase().includes(needle)).filter(item=>filter==="quick"?item.impact>=4&&item.effort<=2:filter==="high"?item.impact>=4:filter==="confident"?item.confidence>=4:true).sort((a,b)=>b.score-a.score),selected=shapes.find(node=>String(node.id)===String(shapeId));
  useEffect(()=>{if(!selected?.scoring)return;setImpact(selected.scoring.impact);setEffort(selected.scoring.effort);setConfidence(selected.scoring.confidence)},[selected]);
  const submit=event=>{event.preventDefault();if(!shapeId)return;onScore(Number(shapeId),{impact:Number(impact),effort:Number(effort),confidence:Number(confidence),updatedAt:Date.now()})};
  const rating=(label,value,setter,hint)=><label><span><b>{label}</b><small>{hint}</small></span><select value={value} onChange={event=>setter(event.target.value)}>{[1,2,3,4,5].map(number=><option key={number} value={number}>{number} — {number===1?"Very low":number===2?"Low":number===3?"Medium":number===4?"High":"Very high"}</option>)}</select></label>;
  return <div className={styles.priorityLabScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.priorityLab}`} aria-label="Prioritization lab"><header><div><small>OPPORTUNITY SCORING</small><h2>Prioritization Lab <b>{scored.length}</b></h2><p>Rank ideas objectively using impact, confidence, and required effort.</p></div><button onClick={onClose} aria-label="Close prioritization lab">×</button></header><form className={styles.priorityScoreForm} onSubmit={submit}><label className={styles.priorityShape}><span><b>Shape</b><small>Opportunity to evaluate</small></span><select value={shapeId} onChange={event=>setShapeId(event.target.value)}>{shapes.map(node=><option key={node.id} value={node.id}>{node.title||"Untitled"}</option>)}</select></label>{rating("Impact",impact,setImpact,"Expected value")}{rating("Confidence",confidence,setConfidence,"Evidence strength")}{rating("Effort",effort,setEffort,"Cost to deliver")}<div className={styles.priorityPreview}><span>Priority score</span><b>{((Number(impact)*Number(confidence))/Number(effort)).toFixed(1)}</b></div><button disabled={!shapeId}>Save score</button></form><div className={styles.priorityLabTools}><label><Icon name="search" size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search scored shapes…"/></label><div>{[["all","All"],["quick","Quick wins"],["high","High impact"],["confident","High confidence"]].map(([value,label])=><button key={value} className={filter===value?styles.priorityLabFilterActive:""} onClick={()=>setFilter(value)}>{label}</button>)}</div></div><div className={styles.priorityRanking}>{scored.length?scored.map((item,index)=><article key={item.node.id}><strong>{index+1}</strong><button onClick={()=>{onChoose(item.node);onClose()}}><i style={{background:palettes[item.node.color]?.[1]||palettes.white[1]}}/><span><b>{item.node.title||"Untitled"}</b><small>Impact {item.impact} · Confidence {item.confidence} · Effort {item.effort}</small></span></button><em>{item.score.toFixed(1)}</em><button onClick={()=>onClear(item.node.id)} aria-label={`Clear score for ${item.node.title}`}><Icon name="trash" size={13}/></button></article>):<div className={`${styles.panelEmpty} ${styles.priorityLabEmpty}`}><Icon name="spark" size={24}/><b>No scored shapes</b><span>Score promising ideas above to build a ranked shortlist.</span></div>}</div><footer><span>Score = impact × confidence ÷ effort</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function GoalsHub({ goals, nodes, onAdd, onDelete, onToggleNode, onChoose, onClose }) {
  const [title,setTitle]=useState(""),[dueDate,setDueDate]=useState(""),[selectedId,setSelectedId]=useState(goals[0]?.id||null),[query,setQuery]=useState(""),shapes=nodes.filter(node=>node.kind!=="frame"),today=localDateKey(new Date()),selected=goals.find(goal=>goal.id===selectedId)||goals[0],needle=query.trim().toLowerCase(),matches=shapes.filter(node=>!needle||`${node.title} ${node.note} ${(node.tags||[]).join(" ")}`.toLowerCase().includes(needle));
  useEffect(()=>{if(selectedId&&!goals.some(goal=>goal.id===selectedId))setSelectedId(goals[0]?.id||null)},[goals,selectedId]);
  const metrics=goal=>{const linked=shapes.filter(node=>(goal.nodeIds||[]).includes(node.id)),done=linked.filter(node=>node.status==="done").length,percent=linked.length?Math.round(done/linked.length*100):0,days=goal.dueDate?Math.ceil((new Date(`${goal.dueDate}T23:59:59`)-new Date())/86400000):null,status=percent===100&&linked.length?"achieved":goal.dueDate&&(goal.dueDate<today||days!==null&&days<=7&&percent<70)?"risk":"track";return{linked,done,percent,status}};
  const submit=event=>{event.preventDefault();if(!title.trim())return;const id=onAdd({title:title.trim(),dueDate});setTitle("");setDueDate("");setSelectedId(id)};
  return <div className={styles.goalsScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.goalsPanel}`} aria-label="Goals hub"><header><div><small>OUTCOME ALIGNMENT</small><h2>Goals Hub <b>{goals.length}</b></h2><p>Connect canvas work to outcomes and let completion update progress automatically.</p></div><button onClick={onClose} aria-label="Close goals hub">×</button></header><form className={styles.goalForm} onSubmit={submit}><input value={title} onChange={event=>setTitle(event.target.value)} placeholder="Goal or outcome…" maxLength="72"/><input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)} aria-label="Goal deadline"/><button disabled={!title.trim()}><Icon name="plus" size={14}/>Create goal</button></form><div className={styles.goalsBody}><div className={styles.goalList}>{goals.length?goals.map(goal=>{const metric=metrics(goal);return <article key={goal.id} className={selected?.id===goal.id?styles.goalSelected:""}><button onClick={()=>setSelectedId(goal.id)}><span><b>{goal.title}</b><small>{goal.dueDate?`Due ${formatDueDate(goal.dueDate)}`:"No deadline"} · {metric.done}/{metric.linked.length} complete</small></span><em className={styles[`goalStatus${metric.status[0].toUpperCase()}${metric.status.slice(1)}`]}>{metric.status==="achieved"?"Achieved":metric.status==="risk"?"At risk":"On track"}</em><i><u style={{width:`${metric.percent}%`}}/></i><strong>{metric.percent}%</strong></button><button onClick={()=>onDelete(goal.id)} aria-label={`Delete ${goal.title}`}><Icon name="trash" size={13}/></button></article>}):<div className={`${styles.panelEmpty} ${styles.goalEmpty}`}><Icon name="focus" size={24}/><b>No goals yet</b><span>Create an outcome, then connect the shapes that deliver it.</span></div>}</div><aside className={styles.goalWork}><header><div><small>KEY RESULTS</small><b>{selected?.title||"Select a goal"}</b></div>{selected&&<span>{metrics(selected).linked.length} linked</span>}</header>{selected&&<label><Icon name="search" size={13}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find shapes to connect…"/></label>}<div>{selected?matches.map(node=>{const linked=(selected.nodeIds||[]).includes(node.id);return <article key={node.id} className={linked?styles.goalWorkLinked:""}><label><input type="checkbox" checked={linked} onChange={()=>onToggleNode(selected.id,node.id)}/><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><span><b>{node.title||"Untitled"}</b><small>{node.status==="done"?"Completed":node.status==="doing"?"In progress":node.status==="todo"?"To do":"No status"}</small></span></label><button onClick={()=>{onChoose(node);onClose()}} aria-label={`Open ${node.title}`}>↗</button></article>}):<p>Select or create a goal to connect work.</p>}</div></aside></div><footer><span>Progress is calculated from linked shapes marked Done.</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function SprintPlanner({ sprints, nodes, onAdd, onDelete, onAssign, onEstimate, onChoose, onClose }) {
  const today=new Date(),defaultEnd=new Date(today);defaultEnd.setDate(defaultEnd.getDate()+13);
  const [name,setName]=useState(""),[startDate,setStartDate]=useState(localDateKey(today)),[endDate,setEndDate]=useState(localDateKey(defaultEnd)),[capacity,setCapacity]=useState(30),[selectedId,setSelectedId]=useState(sprints[0]?.id||null),[query,setQuery]=useState(""),[scope,setScope]=useState("all"),shapes=nodes.filter(node=>node.kind!=="frame"),selected=sprints.find(sprint=>sprint.id===selectedId)||sprints[0],needle=query.trim().toLowerCase();
  useEffect(()=>{if(selectedId&&!sprints.some(sprint=>sprint.id===selectedId))setSelectedId(sprints[0]?.id||null)},[selectedId,sprints]);
  const metrics=sprint=>{const assigned=shapes.filter(node=>node.sprintId===sprint.id),points=assigned.reduce((sum,node)=>sum+(node.estimate||1),0),done=assigned.filter(node=>node.status==="done").reduce((sum,node)=>sum+(node.estimate||1),0),percent=points?Math.round(done/points*100):0,over=points>sprint.capacity;return{assigned,points,done,percent,over}};
  const submit=event=>{event.preventDefault();if(!name.trim()||!startDate||!endDate)return;const id=onAdd({name:name.trim(),startDate,endDate,capacity:Math.max(1,Number(capacity)||1)});setName("");setSelectedId(id)};
  const tasks=selected?shapes.filter(node=>(scope==="assigned"?node.sprintId===selected.id:scope==="backlog"?!node.sprintId:true)&&(!needle||`${node.title} ${node.note} ${(node.tags||[]).join(" ")}`.toLowerCase().includes(needle))).sort((a,b)=>(b.sprintId===selected.id)-(a.sprintId===selected.id)||(a.status==="done")-(b.status==="done")):[];
  return <div className={styles.sprintScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.sprintPanel}`} aria-label="Sprint planner"><header><div><small>LOCAL DELIVERY PLANNING</small><h2>Sprint Planner <b>{sprints.length}</b></h2><p>Plan a time box, estimate effort, and keep committed work within capacity.</p></div><button onClick={onClose} aria-label="Close sprint planner">×</button></header><form className={styles.sprintForm} onSubmit={submit}><input value={name} onChange={event=>setName(event.target.value)} placeholder="Sprint name…" maxLength="48"/><label>Starts<input type="date" value={startDate} onChange={event=>setStartDate(event.target.value)}/></label><label>Ends<input type="date" min={startDate} value={endDate} onChange={event=>setEndDate(event.target.value)}/></label><label>Capacity<input type="number" min="1" max="999" value={capacity} onChange={event=>setCapacity(event.target.value)}/></label><button disabled={!name.trim()||!startDate||!endDate}>Create sprint</button></form><div className={styles.sprintBody}><div className={styles.sprintList}>{sprints.length?sprints.map(sprint=>{const metric=metrics(sprint),now=localDateKey(new Date()),state=sprint.endDate<now?"ended":sprint.startDate>now?"planned":"active";return <article key={sprint.id} className={selected?.id===sprint.id?styles.sprintSelected:""}><button onClick={()=>setSelectedId(sprint.id)}><span><b>{sprint.name}</b><small>{formatDueDate(sprint.startDate)} – {formatDueDate(sprint.endDate)}</small></span><em className={styles[`sprintState${state[0].toUpperCase()}${state.slice(1)}`]}>{state}</em><div><i><u style={{width:`${metric.percent}%`}}/></i><small>{metric.done}/{metric.points} points done</small></div><strong className={metric.over?styles.sprintOver:""}>{metric.points}/{sprint.capacity}</strong></button><button onClick={()=>onDelete(sprint.id)} aria-label={`Delete ${sprint.name}`}><Icon name="trash" size={13}/></button></article>}):<div className={`${styles.panelEmpty} ${styles.sprintEmpty}`}><Icon name="calendar" size={24}/><b>No sprints yet</b><span>Create a time box and pull canvas work into it.</span></div>}</div><aside className={styles.sprintWork}><header><div><small>SPRINT BACKLOG</small><b>{selected?.name||"Select a sprint"}</b></div>{selected&&(()=>{const metric=metrics(selected);return <span className={metric.over?styles.sprintCapacityOver:""}>{metric.points}/{selected.capacity} pts</span>})()}</header>{selected&&<><div className={styles.sprintTools}><label><Icon name="search" size={13}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find work…"/></label><div>{[["all","All"],["assigned","Committed"],["backlog","Backlog"]].map(([value,label])=><button key={value} className={scope===value?styles.sprintScopeActive:""} onClick={()=>setScope(value)}>{label}</button>)}</div></div><div className={styles.sprintTasks}>{tasks.map(node=>{const assigned=node.sprintId===selected.id;return <article key={node.id} className={assigned?styles.sprintTaskAssigned:""}><label><input type="checkbox" checked={assigned} onChange={()=>onAssign(node.id,assigned?null:selected.id)}/><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><span><b>{node.title||"Untitled"}</b><small>{node.status==="done"?"Completed":node.status==="doing"?"In progress":node.status==="todo"?"To do":node.sprintId?"Another sprint":"Backlog"}</small></span></label><select value={node.estimate||1} disabled={!assigned} onChange={event=>onEstimate(node.id,Number(event.target.value))} aria-label={`Estimate ${node.title}`}>{[1,2,3,5,8,13].map(value=><option key={value} value={value}>{value} pt{value===1?"":"s"}</option>)}</select><button onClick={()=>{onChoose(node);onClose()}} aria-label={`Open ${node.title}`}>↗</button></article>})}{!tasks.length&&<p>No work matches this view.</p>}</div></>}</aside></div><footer><span>Capacity and velocity recalculate from live shape status.</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function RiskRegister({ nodes, onSave, onClear, onChoose, onClose }) {
  const shapes=nodes.filter(node=>node.kind!=="frame"),[shapeId,setShapeId]=useState(shapes[0]?.id||""),[likelihood,setLikelihood]=useState(3),[impact,setImpact]=useState(3),[status,setStatus]=useState("open"),[mitigation,setMitigation]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState("active"),selected=shapes.find(node=>String(node.id)===String(shapeId)),needle=query.trim().toLowerCase(),risks=shapes.filter(node=>node.risk).map(node=>({node,...node.risk,score:node.risk.likelihood*node.risk.impact})).filter(item=>(filter==="all"||filter==="active"&&item.status==="open"||item.status===filter)&&(!needle||`${item.node.title} ${item.mitigation} ${item.status}`.toLowerCase().includes(needle))).sort((a,b)=>b.score-a.score||b.updatedAt-a.updatedAt),allRisks=shapes.filter(node=>node.risk),critical=allRisks.filter(node=>node.risk.status==="open"&&node.risk.likelihood*node.risk.impact>=16).length;
  useEffect(()=>{if(!selected?.risk){setLikelihood(3);setImpact(3);setStatus("open");setMitigation("");return}setLikelihood(selected.risk.likelihood);setImpact(selected.risk.impact);setStatus(selected.risk.status);setMitigation(selected.risk.mitigation||"")},[selected]);
  const submit=event=>{event.preventDefault();if(!shapeId)return;onSave(Number(shapeId),{likelihood:Number(likelihood),impact:Number(impact),status,mitigation:mitigation.trim(),updatedAt:Date.now()})};
  const level=score=>score>=16?"critical":score>=10?"high":score>=5?"medium":"low";
  return <div className={styles.riskScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`${styles.panelSurface} ${styles.riskPanel}`} aria-label="Risk register"><header><div><small>RISK INTELLIGENCE</small><h2>Risk Register <b>{allRisks.length}</b></h2><p>Score exposure, document responses, and keep critical risks visible.</p></div><button onClick={onClose} aria-label="Close risk register">×</button></header><div className={styles.riskTop}><form className={styles.riskForm} onSubmit={submit}><label className={styles.riskShape}>Shape<select value={shapeId} onChange={event=>setShapeId(event.target.value)}>{shapes.map(node=><option key={node.id} value={node.id}>{node.title||"Untitled"}</option>)}</select></label><label>Likelihood<select value={likelihood} onChange={event=>setLikelihood(event.target.value)}>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value} — {value<3?"Low":value===3?"Medium":"High"}</option>)}</select></label><label>Impact<select value={impact} onChange={event=>setImpact(event.target.value)}>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value} — {value<3?"Low":value===3?"Medium":"High"}</option>)}</select></label><label>Response<select value={status} onChange={event=>setStatus(event.target.value)}><option value="open">Open</option><option value="mitigated">Mitigated</option><option value="accepted">Accepted</option></select></label><textarea value={mitigation} onChange={event=>setMitigation(event.target.value)} placeholder="Mitigation, contingency, or reason for acceptance…" rows="2"/><div className={`${styles.riskScore} ${styles[`riskScore${level(Number(likelihood)*Number(impact))[0].toUpperCase()}${level(Number(likelihood)*Number(impact)).slice(1)}`]}`}><small>EXPOSURE</small><b>{Number(likelihood)*Number(impact)}</b><span>{level(Number(likelihood)*Number(impact))}</span></div><button disabled={!shapeId}>Save risk</button></form><div className={styles.riskMatrix}><header><span>Likelihood ↑</span><b>Exposure map</b><small>Impact →</small></header><div>{[5,4,3,2,1].flatMap(like=>[1,2,3,4,5].map(imp=>{const score=like*imp,count=allRisks.filter(node=>node.risk.likelihood===like&&node.risk.impact===imp).length;return <i key={`${like}-${imp}`} className={styles[`riskCell${level(score)[0].toUpperCase()}${level(score).slice(1)}`]} title={`Likelihood ${like}, impact ${imp}`}><span>{count||""}</span></i>}))}</div><footer><span><i/>Low</span><span><i/>Medium</span><span><i/>High</span><span><i/>Critical</span></footer></div></div><div className={styles.riskTools}><label><Icon name="search" size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search risks and mitigations…"/></label><div>{[["active","Active"],["all","All"],["mitigated","Mitigated"],["accepted","Accepted"]].map(([value,label])=><button key={value} className={filter===value?styles.riskFilterActive:""} onClick={()=>setFilter(value)}>{label}</button>)}</div><strong className={critical?styles.riskCriticalCount:""}>{critical} critical</strong></div><div className={styles.riskList}>{risks.length?risks.map(item=><article key={item.node.id}><em className={styles[`riskScore${level(item.score)[0].toUpperCase()}${level(item.score).slice(1)}`]}>{item.score}</em><button onClick={()=>{onChoose(item.node);onClose()}}><i style={{background:palettes[item.node.color]?.[1]||palettes.white[1]}}/><span><b>{item.node.title||"Untitled"}</b><p>{item.mitigation||"No response plan documented"}</p><small>{item.status} · likelihood {item.likelihood} × impact {item.impact}</small></span></button><button onClick={()=>onClear(item.node.id)} aria-label={`Remove risk from ${item.node.title}`}><Icon name="trash" size={13}/></button></article>):<div className={`${styles.panelEmpty} ${styles.riskEmpty}`}><Icon name="spark" size={24}/><b>No matching risks</b><span>Score uncertain or exposed work to build the register.</span></div>}</div><footer><span>Critical means an active exposure score of 16 or higher.</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function CalendarView({ nodes, onSetDue, onChoose, onClose }) {
  const today=new Date(),todayKey=localDateKey(today),[month,setMonth]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1));
  const tasks=nodes.filter(node=>node.kind!=="frame"),priorityRank={high:0,medium:1,low:2,none:3},start=new Date(month.getFullYear(),month.getMonth(),1-month.getDay()),days=Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date});
  const undated=tasks.filter(node=>!node.dueDate&&node.status!=="done").sort((a,b)=>priorityRank[a.priority||"none"]-priorityRank[b.priority||"none"]);
  const drop=(event,dueDate)=>{event.preventDefault();const id=Number(event.dataTransfer.getData("text/plain"));if(Number.isFinite(id))onSetDue(id,dueDate)};
  return <div className={styles.calendarScrim} onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className={`${styles.panelSurface} ${styles.calendarPanel}`} aria-label="Board calendar">
      <header><div><small>LOCAL SCHEDULE</small><h2>Calendar</h2><p>Drag shapes onto dates to plan or reschedule them.</p></div><div className={styles.calendarNav}><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()-1,1))} aria-label="Previous month">←</button><button onClick={()=>setMonth(new Date(today.getFullYear(),today.getMonth(),1))}>Today</button><b>{month.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</b><button onClick={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()+1,1))} aria-label="Next month">→</button></div><button className={styles.calendarClose} onClick={onClose} aria-label="Close calendar">×</button></header>
      <div className={styles.calendarBody}>
        <aside onDragOver={event=>event.preventDefault()} onDrop={event=>drop(event,"")}><header><b>Unscheduled</b><span>{undated.length}</span></header><div>{undated.map(node=><button key={node.id} draggable onDragStart={event=>event.dataTransfer.setData("text/plain",String(node.id))} onClick={()=>{onChoose(node);onClose()}}><i className={styles[`priority${(node.priority||"none")[0].toUpperCase()}${(node.priority||"none").slice(1)}`]}/><span>{node.title||"Untitled"}</span></button>)}{!undated.length&&<p>Drop here to clear a date</p>}</div></aside>
        <main><div className={styles.weekdays}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><span key={day}>{day}</span>)}</div><div className={styles.calendarGrid}>{days.map(date=>{const key=localDateKey(date),items=tasks.filter(node=>node.dueDate===key).sort((a,b)=>priorityRank[a.priority||"none"]-priorityRank[b.priority||"none"]),outside=date.getMonth()!==month.getMonth();return <section key={key} className={`${outside?styles.calendarOutside:""} ${key===todayKey?styles.calendarToday:""}`} onDragOver={event=>event.preventDefault()} onDrop={event=>drop(event,key)}><header><span>{date.getDate()}</span>{items.length>3&&<b>+{items.length-3}</b>}</header>{items.slice(0,3).map(node=><button key={node.id} className={`${node.status==="done"?styles.calendarDone:""} ${isOverdue(node)?styles.calendarOverdue:""}`} draggable onDragStart={event=>event.dataTransfer.setData("text/plain",String(node.id))} onClick={()=>{onChoose(node);onClose()}} title={node.title}><i style={{background:palettes[node.color]?.[1]||palettes.white[1]}}/><span>{node.title||"Untitled"}</span></button>)}</section>})}</div></main>
      </div>
      <footer><span>{tasks.filter(node=>node.dueDate).length} scheduled · {undated.length} unscheduled</span><small>Drag any card between days or back to Unscheduled.</small></footer>
    </section>
  </div>;
}

function Toolbar({ active, onActive, onAdd }) {
  const tools = [
    ["cursor","Select","Select","Select and move shapes"],
    ["hand","Pan","Pan","Pan canvas (Space or ⌘ + drag)"],
    ["box","Shape","Shape","Add a shape"],
    ["frame","Frame","Frame","Add a frame"],
    ["link","Connect","Connect","Connect two shapes"],
  ];
  return <div data-keyboard-toolbar className={styles.toolbar} aria-label="Board tools">
    {tools.map(([tool,label,text,title],index)=><div key={tool} className={index===2?styles.toolDivider:""}>
      <button className={`${tool==="box"||tool==="frame"||tool==="link"?styles.labeledTool:""} ${active===tool?styles.activeTool:""}`} onClick={()=>tool==="box"||tool==="frame"?onAdd(tool):onActive(tool)} aria-label={label} data-label={label} data-tour={`tool-${tool}`} title={title}>
        <Icon name={tool}/>{(tool==="box"||tool==="frame"||tool==="link")&&<span>{text}</span>}
      </button>
    </div>)}
  </div>;
}

function Node({ node, selected, transformable, connecting, editing, childCount, blockedBy, progress, assignee, onSelect, onDrag, onEdit, onRichChange, onBranch, onResize, onRotate, onToggleCollapse }) {
  const [bg,border,accent]=palettes[node.color]||palettes.white;
  const root=rootColors(node);
  const size=nodeSize(node);
  // Keep formatted descendants mounted when selecting a shape. Replacing them
  // between pointerdown and pointerup prevents clicks/double-clicks from firing.
  const titleMarkup=useMemo(()=>({__html:node.titleHtml}),[node.titleHtml]);
  const noteMarkup=useMemo(()=>({__html:node.noteHtml}),[node.noteHtml]);
  return <article aria-label={`${node.kind==="frame"?"Frame":"Shape"}: ${node.title||"Untitled"}${selected?", selected":""}${node.locked?", locked":""}`} data-export-node={node.id} className={`${styles.node} ${node.kind==="frame"?styles.frameNode:""} ${node.locked?styles.lockedNode:""} ${node.root?styles.rootNode:""} ${selected?styles.selectedNode:""} ${connecting?styles.connectingNode:""} ${editing?styles.editingNode:""} ${styles[node.shape]}`} style={{width:size.width,height:size.height,transform:`translate(${node.x}px,${node.y}px) rotate(${node.rotate||0}deg)`,background:node.root?root.fill:bg,borderColor:selected?accent:border,"--accent":accent,"--root-text":root.text,"--root-note":root.note,"--root-editor":root.editor}} onPointerDown={e=>onDrag(e,node)} onClick={e=>{e.stopPropagation();onSelect(node.id,e.shiftKey||e.metaKey||e.ctrlKey)}} onDoubleClick={e=>{e.stopPropagation();onEdit(node.id)}}>
    {node.locked&&<div className={styles.nodeLock}><Icon name="lock" size={11}/></div>}
    {!!node.comments?.filter(comment=>!comment.resolved).length&&<div className={styles.nodeComments}><Icon name="comment" size={11}/><b>{node.comments.filter(comment=>!comment.resolved).length}</b></div>}
    {node.status&&node.status!=="none"&&<div className={`${styles.nodeStatus} ${styles[`nodeStatus${node.status[0].toUpperCase()}${node.status.slice(1)}`]}`}>{node.status==="todo"?"To do":node.status==="doing"?"In progress":"Done"}</div>}
    {(node.dueDate||node.priority&&node.priority!=="none")&&<div className={`${styles.nodeDue} ${isOverdue(node)?styles.nodeOverdue:""}`}><i className={styles[`priority${(node.priority||"none")[0].toUpperCase()}${(node.priority||"none").slice(1)}`]}/>{node.dueDate?formatDueDate(node.dueDate):node.priority}</div>}
    {node.recurrence&&node.status!=="done"&&<div className={styles.nodeRecurring} title={`Repeats ${node.recurrence.frequency}`}>↻</div>}
    {node.risk?.status==="open"&&node.risk.likelihood*node.risk.impact>=12&&<div className={styles.nodeRisk} style={{right:assignee?36:8}} title={`Risk exposure ${node.risk.likelihood*node.risk.impact}`}>!</div>}
    {node.decision&&<div className={`${styles.nodeDecision} ${styles[`nodeDecision${node.decision.status[0].toUpperCase()}${node.decision.status.slice(1)}`]}`} style={{right:node.starred?36:8}} title={`${node.decision.status}: ${node.decision.rationale}`}>{node.decision.status==="decided"?"✓":node.decision.status==="revisit"?"↻":"?"}</div>}
    {node.starred&&<div className={styles.nodeStar}><Icon name="star" size={12}/></div>}
    {!!blockedBy&&<div className={styles.nodeBlocked} title={`Blocked by ${blockedBy} active shape${blockedBy===1?"":"s"}`}>Blocked · {blockedBy}</div>}
    {progress?.total>0&&<div className={styles.nodeProgress} title={`${progress.done} of ${progress.total} descendants complete`}><i style={{width:`${progress.percent}%`}}/></div>}
    {assignee&&<div className={styles.nodeAssignee} style={{background:assignee.color}} title={`Assigned to ${assignee.name}`}>{assignee.initials}</div>}
    {!!node.links?.length&&<div className={styles.nodeLinks} style={{right:node.comments?.some(comment=>!comment.resolved)?42:8}}><Icon name="link" size={11}/><b>{node.links.length}</b></div>}
    {!!childCount&&<button tabIndex={selected&&!editing?0:-1} className={`${styles.nodeCollapse} ${node.collapsed?styles.nodeCollapsed:""}`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onToggleCollapse(node.id)}} title={node.collapsed?"Expand branch":"Collapse branch"}>{node.collapsed?`+${childCount}`:"−"}</button>}
    <div className={styles.nodeAccent}/>
    <div className={styles.nodeGlyph}>{node.root?"✦":node.title.charAt(0)}</div>
    {editing?<RichTextEditor node={node} onChange={onRichChange} onFinish={()=>onEdit(null)}/>:<>{node.titleHtml?<h3 dangerouslySetInnerHTML={titleMarkup}/>:<h3>{node.title}</h3>}{node.noteHtml?<p dangerouslySetInnerHTML={noteMarkup}/>:<p>{node.note}</p>}</>}
    <button tabIndex={selected&&!editing?0:-1} className={`${styles.branch} ${styles.branchTop}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onBranch(node,"top")}} aria-label="Add branch above"><span/><b>+</b></button>
    <button tabIndex={selected&&!editing?0:-1} className={`${styles.branch} ${styles.branchRight}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onBranch(node,"right")}} aria-label="Add branch right"><span/><b>+</b></button>
    <button tabIndex={selected&&!editing?0:-1} className={`${styles.branch} ${styles.branchBottom}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onBranch(node,"bottom")}} aria-label="Add branch below"><span/><b>+</b></button>
    <button tabIndex={selected&&!editing?0:-1} className={`${styles.branch} ${styles.branchLeft}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onBranch(node,"left")}} aria-label="Add branch left"><span/><b>+</b></button>
    {transformable&&<div className={styles.transformControls}>
      {["nw","n","ne","e","se","s","sw","w"].map(handle=><span key={handle} className={`${styles.resizeHandle} ${styles[`resize${handle.toUpperCase()}`]}`} onPointerDown={e=>onResize(e,node,handle)}/>)}
      <button tabIndex={-1} className={styles.rotateHandle} onPointerDown={e=>onRotate(e,node)} aria-label="Rotate shape" title="Drag to rotate shape"><span>↻</span></button>
    </div>}
  </article>;
}

function SelectionBar({ node, selectionCount, grouped, locked, allLocked, onColor, onDuplicate, onDelete, onShape, onGroup, onUngroup, onFrame, onLock, onArrange, onComments, onFocus, onEdit, onAddChild, onDone }) {
  const [menu,setMenu]=useState(null),menuRef=useRef(null),triggerRef=useRef(null);
  useEffect(()=>{
    if(!menu)return;
    const close=event=>{if(!menuRef.current?.contains(event.target))setMenu(null)};
    const escape=event=>{if(event.key==="Escape"){event.stopPropagation();setMenu(null);triggerRef.current?.focus()}};
    document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape,true);
    return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape,true)};
  },[menu]);
  const toggle=(value,event)=>{triggerRef.current=event.currentTarget;setMenu(current=>current===value?null:value)};
  const shapeLabel=shapeOptions.find(([value])=>value===node.shape)?.[1]||"Rounded";
  const colors=<div className={styles.colorRow}>{Object.keys(palettes).map(color=><button key={color} disabled={locked} className={node.color===color?styles.chosenColor:""} style={{background:palettes[color][1]}} onClick={()=>onColor(color)} aria-label={`${color} color`} aria-pressed={node.color===color} title={`${color[0].toUpperCase()+color.slice(1)} fill`}/>)}</div>;
  return <div ref={menuRef} className={styles.selectionDock}>
    <div data-keyboard-toolbar className={styles.selectionBar} aria-label="Selected shape actions">
      {selectionCount>1&&<><b className={styles.selectionCount}>{selectionCount} selected</b><span/></>}
      <button className={styles.mobileSelectionAction} disabled={locked||selectionCount>1} onClick={onEdit}><Icon name="text" size={18}/>Edit</button>
      <div className={styles.desktopColors}>{colors}</div>
      <button className={styles.mobileSelectionAction} disabled={locked} aria-expanded={menu==="color"} onClick={event=>toggle("color",event)}><Icon name="palette" size={18}/>Fill</button>
      <span/>
      <button disabled={locked} className={styles.shapePickerButton} aria-expanded={menu==="shape"} onClick={event=>toggle("shape",event)}><i className={`${styles.shapePreview} ${styles[`shapePreview${node.shape[0].toUpperCase()}${node.shape.slice(1)}`]}`}/><span className={styles.shapePickerLabel}>{shapeLabel}</span><svg className={styles.shapePickerChevron} width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="m1 1 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button><span/>
      {selectionCount>1&&<button disabled={locked||grouped} className={styles.arrangeButton} aria-expanded={menu==="arrange"} title={grouped?"Ungroup shapes before arranging":"Align and distribute"} onClick={event=>toggle("arrange",event)}><Icon name="arrange" size={15}/>Arrange</button>}
      {selectionCount>1&&<button disabled={locked} title="Wrap selected shapes in a frame" onClick={onFrame}>Frame</button>}
      {selectionCount>1&&!grouped&&<button disabled={locked} title="Group selected shapes" onClick={onGroup}>Group</button>}
      {grouped&&<button disabled={locked} title="Ungroup selected shapes" onClick={onUngroup}>Ungroup</button>}
      <button className={styles.mobileSelectionAction} disabled={locked||selectionCount>1} onClick={onAddChild}><Icon name="plus" size={18}/>Branch</button>
      <button className={styles.selectionAction} title="Focus on this branch" aria-label="Focus on this branch" onClick={onFocus}><Icon name="focus" size={18}/></button>
      <button className={styles.selectionAction} title="Comments" aria-label="Comments" onClick={onComments}><Icon name="comment" size={18}/></button>
      <button className={`${styles.selectionAction} ${allLocked?styles.lockedAction:""}`} title={allLocked?"Unlock selection":"Lock selection"} aria-label={allLocked?"Unlock selection":"Lock selection"} onClick={onLock}><Icon name={allLocked?"unlock":"lock"} size={20}/></button>
      <button className={styles.selectionAction} title="Duplicate" aria-label="Duplicate" onClick={onDuplicate}><Icon name="duplicate" size={20}/></button>
      <button className={styles.selectionAction} disabled={locked} title="Delete" aria-label="Delete" onClick={onDelete}><Icon name="trash" size={19}/></button>
      <button className={`${styles.mobileSelectionAction} ${styles.selectionDone}`} onClick={onDone} aria-label="Deselect shapes">Done</button>
    </div>
    <MotionPresence present={menu==="color"} kind="menu"><div className={styles.selectionColorMenu}>{colors}</div></MotionPresence>
    <MotionPresence present={menu==="shape"} kind="menu"><div className={styles.selectionShapeMenu}>{shapeOptions.map(([value,label])=><button key={value} className={node.shape===value?styles.shapeOptionActive:""} onClick={()=>{onShape(value);setMenu(null)}}><i className={`${styles.shapePreview} ${styles[`shapePreview${value[0].toUpperCase()}${value.slice(1)}`]}`}/><span>{label}</span></button>)}</div></MotionPresence>
    <MotionPresence present={menu==="arrange"} kind="menu"><div className={styles.arrangeMenu}>{[["tree","Smart tree layout"],["grid","Tidy into a grid"],["left","Align left"],["center","Align centers"],["right","Align right"],["top","Align top"],["middle","Align middles"],["bottom","Align bottom"],["horizontal","Distribute horizontally"],["vertical","Distribute vertically"]].map(([value,label])=><button key={value} className={value==="tree"||value==="grid"?styles.tidyAction:""} disabled={(value==="horizontal"||value==="vertical")&&selectionCount<3} onClick={()=>{onArrange(value);setMenu(null)}}>{label}</button>)}</div></MotionPresence>
  </div>;
}

function BranchStylePanel({ settings, section, onSection, onChange, scopeLabel, canStyleShapes, canStyleLines, disabledReason }) {
  const dockRef=useRef(null);
  const structures = [["curve","Curve"],["straight","Straight"],["elbow","Elbow"]];
  const patterns = [["solid","Solid"],["dashed","Dashed"],["dotted","Dotted"]];
  const weights = [["thin","Thin"],["regular","Regular"],["bold","Bold"]];
  const items=[["shape","Shape"],["color","Color"],["structure","Line"],["pattern","Line style"],["weight","Weight"]];
  useEffect(()=>{if(!section)return;const closeOnOutside=e=>{if(!dockRef.current?.contains(e.target))onSection(null)};document.addEventListener("pointerdown",closeOnOutside);return()=>document.removeEventListener("pointerdown",closeOnOutside)},[section,onSection]);
  return <div ref={dockRef} className={styles.globalStyleDock} aria-label="Branch styles">
    {!section&&<div className={styles.branchStyleHint} role="status">{scopeLabel}</div>}
    <div data-keyboard-toolbar data-tour="styles" className={styles.globalStyleRail}>{items.map(([value,label])=><button key={value} disabled={value==="shape"||value==="color"?!canStyleShapes:!canStyleLines} className={section===value?styles.globalRailActive:""} onClick={()=>onSection(section===value?null:value)} aria-label={label} aria-expanded={section===value} title={disabledReason||((value==="shape"||value==="color")&&!canStyleShapes?"Select a branch to style":{shape:"Change branch shape",color:"Change branch fill color",structure:"Change branch line path",pattern:"Change branch line style",weight:"Change branch line thickness"}[value])}><BoardStyleIcon name={value}/><span>{label}</span></button>)}</div>
    <MotionPresence present={Boolean(section&&(section==="shape"||section==="color"?canStyleShapes:canStyleLines))} kind="menu"><aside className={styles.globalPanel} aria-label={`${items.find(item=>item[0]===section)?.[1]} settings`}>
      {section==="shape"&&<div className={styles.settingGroup}><div className={styles.shapeGrid}>{shapeOptions.map(([value,label])=><button key={value} className={settings.shape===value?styles.shapeOptionActive:""} onClick={()=>onChange("shape",value)}><i className={`${styles.shapePreview} ${styles[`shapePreview${value[0].toUpperCase()}${value.slice(1)}`]}`}/><span>{label}</span></button>)}</div></div>}
      {section==="color"&&<div className={styles.settingGroup}><div className={styles.globalColors}>{Object.keys(palettes).map(color=><button key={color} className={settings.color===color?styles.chosenGlobalColor:""} style={{background:palettes[color][1]}} onClick={()=>onChange("color",color)} aria-label={`${color} branch color`} title={`${color[0].toUpperCase()+color.slice(1)} branch fill`}/>)}</div></div>}
      {section==="structure"&&<div className={styles.settingGroup}><div className={styles.segmented}>{structures.map(([value,label])=><button key={value} className={settings.structure===value?styles.globalActive:""} aria-pressed={settings.structure===value} onClick={()=>onChange("structure",value)}><BoardStyleIcon name="structure" lineType={value}/>{label}</button>)}</div></div>}
      {section==="pattern"&&<div className={styles.settingGroup}><div className={styles.segmented}>{patterns.map(([value,label])=><button key={value} className={settings.pattern===value?styles.globalActive:""} onClick={()=>onChange("pattern",value)}>{label}</button>)}</div></div>}
      {section==="weight"&&<div className={styles.settingGroup}><div className={styles.segmented}>{weights.map(([value,label])=><button key={value} className={settings.weight===value?styles.globalActive:""} onClick={()=>onChange("weight",value)}>{label}</button>)}</div></div>}
    </aside></MotionPresence>
  </div>;
}

function MiniMap({ nodes, transform, view, onFit, onNavigate }) {
  const dragging=useRef(false),frame=useRef(null);
  const safeNodes=nodes.filter(node=>{const size=nodeSize(node);return Number.isFinite(node.x)&&Number.isFinite(node.y)&&Number.isFinite(size.width)&&Number.isFinite(size.height)});
  const raw=safeNodes.length?safeNodes.reduce((area,node)=>{const size=nodeSize(node);return{left:Math.min(area.left,node.x),top:Math.min(area.top,node.y),right:Math.max(area.right,node.x+size.width),bottom:Math.max(area.bottom,node.y+size.height)}},{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity}):{left:0,top:0,right:1000,bottom:700};
  const padding=180,aspect=184/110;let width=raw.right-raw.left+padding*2,height=raw.bottom-raw.top+padding*2;let left=raw.left-padding,top=raw.top-padding;
  if(width/height>aspect){const expanded=width/aspect;top-=(expanded-height)/2;height=expanded}else{const expanded=height*aspect;left-=(expanded-width)/2;width=expanded}
  const pointFromEvent=e=>{const rect=e.currentTarget.getBoundingClientRect();return{x:left+(e.clientX-rect.left)/rect.width*width,y:top+(e.clientY-rect.top)/rect.height*height}};
  const navigate=e=>onNavigate(pointFromEvent(e));
  const dragMove=e=>{if(!dragging.current)return;const point=pointFromEvent(e);if(frame.current)cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{onNavigate(point);frame.current=null})};
  const dragEnd=e=>{dragging.current=false;if(e.currentTarget.hasPointerCapture?.(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)};
  return <button className={styles.miniMap} onClick={event=>{if(event.detail===0)onFit()}} onPointerDown={e=>{dragging.current=true;e.currentTarget.setPointerCapture?.(e.pointerId);navigate(e)}} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd} onDoubleClick={e=>{e.stopPropagation();onFit()}} aria-label="Board overview. Drag to navigate; press Enter or double-click to fit">
    <svg viewBox={`${left} ${top} ${width} ${height}`} preserveAspectRatio="none">{safeNodes.map(n=>{const size=nodeSize(n);return <rect key={n.id} x={n.x} y={n.y} width={size.width} height={size.height} rx="12" fill={palettes[n.color]?.[1]||palettes.white[1]}/>})}<rect className={styles.miniViewport} x={-transform.x/transform.scale} y={-transform.y/transform.scale} width={view.width/transform.scale} height={view.height/transform.scale}/></svg>
  </button>;
}

export default function Canvas({project,backTo="/projects",onRename,onSave}) {
  const [requestDelete, deleteConfirmation] = useDeleteConfirmation();
  const [nodes,setNodes]=useState(()=>project?.board?.nodes?.map(node=>({...node}))||initialNodes.map(node=>({...node}))); const [edges,setEdges]=useState(()=>project?.board?.edges?.map(edge=>({...edge}))||initialEdges.map(edge=>({...edge})));
  const [selectedId,setSelectedId]=useState(null); const [selectedIds,setSelectedIds]=useState([]); const [selectedEdge,setSelectedEdge]=useState(null); const [editingId,setEditingId]=useState(null);
  const [activeTool,setActiveTool]=useState("cursor"); const [locked,setLocked]=useState(false); const [toast,setToast]=useState("");
  const [panReady,setPanReady]=useState(false),[isPanning,setIsPanning]=useState(false);
  const panKeys=useRef({space:false,meta:false}),suppressPanClick=useRef(false);
  const [globalSettings,setGlobalSettings]=useState(()=>project?.board?.globalSettings||{shape:"round",color:"white",structure:"elbow",pattern:"solid",weight:"regular"});
  const [branchStyleSection,setBranchStyleSection]=useState(null);
  const [searchOpen,setSearchOpen]=useState(false);
  const [tourOpen,setTourOpen]=useState(()=>boardTourPreference.shouldShow());
  const [outlineOpen,setOutlineOpen]=useState(false);
  const [commentsOpen,setCommentsOpen]=useState(false);
  const [touchMultiSelect,setTouchMultiSelect]=useState(false);
  const [viewsOpen,setViewsOpen]=useState(false);
  const [savedViews,setSavedViews]=useState(()=>project?.board?.savedViews?.map(view=>({...view,transform:{...view.transform}}))||[]);
  const [taskBoardOpen,setTaskBoardOpen]=useState(false);
  const [outlineImportOpen,setOutlineImportOpen]=useState(false);
  const [findReplaceOpen,setFindReplaceOpen]=useState(false);
  const [insightsOpen,setInsightsOpen]=useState(false);
  const [libraryOpen,setLibraryOpen]=useState(false);
  const [libraryItems,setLibraryItems]=useState([]);
  const [libraryLoading,setLibraryLoading]=useState(false);
  const [shortcutsOpen,setShortcutsOpen]=useState(false);
  const [agendaOpen,setAgendaOpen]=useState(false);
  const [resourcesOpen,setResourcesOpen]=useState(false);
  const [focusLensOpen,setFocusLensOpen]=useState(false);
  const [dependencyOpen,setDependencyOpen]=useState(false);
  const [exportStudioOpen,setExportStudioOpen]=useState(false);
  const [shareProject,setShareProject]=useState(null);
  const [storyOpen,setStoryOpen]=useState(false);
  const [tableOpen,setTableOpen]=useState(false);
  const [automationOpen,setAutomationOpen]=useState(false);
  const [automationRules,setAutomationRules]=useState(()=>project?.board?.automationRules?.map(rule=>({...rule}))||[]);
  const [fieldsOpen,setFieldsOpen]=useState(false);
  const [customFields,setCustomFields]=useState(()=>project?.board?.customFields?.map(field=>({...field,options:[...(field.options||[])]}))||[]);
  const [exchangeOpen,setExchangeOpen]=useState(false);
  const [calendarOpen,setCalendarOpen]=useState(false);
  const [progressOpen,setProgressOpen]=useState(false);
  const [workloadOpen,setWorkloadOpen]=useState(false);
  const [teamMembers,setTeamMembers]=useState(()=>project?.board?.teamMembers?.map(member=>({...member}))||[]);
  const [focusSessionsOpen,setFocusSessionsOpen]=useState(false);
  const [activeTimer,setActiveTimer]=useState(()=>project?.board?.activeTimer||null);
  const [timerNow,setTimerNow]=useState(Date.now());
  const [recurringOpen,setRecurringOpen]=useState(false);
  const [decisionsOpen,setDecisionsOpen]=useState(false);
  const [prioritizationOpen,setPrioritizationOpen]=useState(false);
  const [goalsOpen,setGoalsOpen]=useState(false);
  const [goals,setGoals]=useState(()=>project?.board?.goals?.map(goal=>({...goal,nodeIds:[...(goal.nodeIds||[])]}))||[]);
  const [sprintsOpen,setSprintsOpen]=useState(false);
  const [sprints,setSprints]=useState(()=>project?.board?.sprints?.map(sprint=>({...sprint}))||[]);
  const [risksOpen,setRisksOpen]=useState(false);
  const [focusRootId,setFocusRootId]=useState(null);
  const [presenting,setPresenting]=useState(false);
  const [presentationIndex,setPresentationIndex]=useState(0);
  const [showPresenterNotes,setShowPresenterNotes]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [versions,setVersions]=useState([]);
  const [versionsLoading,setVersionsLoading]=useState(false);
  const [snapGuides,setSnapGuides]=useState({x:null,y:null});
  const [selectionBox,setSelectionBox]=useState(null);
  const [connectionSource,setConnectionSource]=useState(null);
  const [transform,setTransform]=useState(()=>project?.board?.viewport||{x:-480,y:-410,scale:.9}); const [view,setView]=useState({width:1200,height:800});
  const [,setHistoryVersion]=useState(0);
  const stageRef=useRef(null); const gesture=useRef(null);
  const touchPointers=useRef(new Map()),transformRef=useRef(transform),mobileFitted=useRef(false);
  transformRef.current=transform; const nextNode=useRef(Math.max(0,...(project?.board?.nodes||initialNodes).map(node=>Number.isSafeInteger(Number(node.id))?Number(node.id):0))+1); const nextEdge=useRef(Math.max(0,...(project?.board?.edges||initialEdges).map(edge=>Number.isSafeInteger(Number(edge.id))?Number(edge.id):0))+1);
  const pasteCount=useRef(0);
  const recurrenceGuard=useRef(new Set());
  const [saveStatus,setSaveStatus]=useState("saved");
  const [saveTracker]=useState(()=>createSaveStatus(setSaveStatus));
  const saveRef=useRef(onSave),renameRef=useRef(onRename);saveRef.current=onSave;renameRef.current=onRename;
  const saveTimer=useRef(null),savePending=useRef(false),saveRevision=useRef(0);
  const pendingTitle=useRef(null),titleRevision=useRef(0);
  const historyRef=useRef({undo:[],redo:[]});
  const restoredBoard=useRef(null);
  const stateRef=useRef({nodes,edges,globalSettings,savedViews,automationRules,customFields,teamMembers,goals,sprints,activeTimer});
  stateRef.current={nodes,edges,globalSettings,savedViews,automationRules,customFields,teamMembers,goals,sprints,activeTimer};
  const flushSave=useCallback(()=>{
    window.clearTimeout(saveTimer.current);
    if(!savePending.current)return;
    const revision=saveRevision.current;
    savePending.current=false;
    void saveTracker.persist("board",revision,()=>saveRef.current(project.id,{...stateRef.current,viewport:{...transformRef.current}})).then(saved=>{
      if(!saved&&saveRevision.current===revision)savePending.current=true;
    });
  },[project.id,saveTracker]);
  const renameBoard=useCallback(title=>{
    pendingTitle.current=title;
    const revision=saveTracker.markDirty("title");
    titleRevision.current=revision;
    void saveTracker.persist("title",revision,()=>renameRef.current(title)).then(saved=>{
      if(saved&&titleRevision.current===revision)pendingTitle.current=null;
    });
  },[saveTracker]);
  const retrySave=useCallback(()=>{
    if(saveTracker.getStatus("board")==="error")flushSave();
    if(saveTracker.getStatus("title")==="error"&&pendingTitle.current!==null)renameBoard(pendingTitle.current);
  },[flushSave,renameBoard,saveTracker]);
  const selected=nodes.find(n=>n.id===selectedId);
  const selectedNodes=nodes.filter(node=>selectedIds.includes(node.id));
  const selectedGrouped=selectedNodes.some(node=>node.groupId);
  const selectedLocked=selectedNodes.length>0&&selectedNodes.every(node=>node.locked);
  const activeEdge=edges.find(edge=>edge.id===selectedEdge);
  const styleScope=useMemo(()=>branchStyleScope(nodes,edges,selectedIds,selectedEdge),[nodes,edges,selectedIds,selectedEdge]);
  const styleSettings=useMemo(()=>branchStyleSettings(nodes,edges,styleScope,globalSettings),[nodes,edges,styleScope,globalSettings]);
  const styleDisabledReason=locked?"Unlock the canvas to style":styleScope.locked?"Unlock the branch to style":!styleScope.nodeIds.size&&!styleScope.edgeIds.size?"Select a branch to style":"";
  const styleScopeLabel=styleDisabledReason||`${styleScope.branchCount===1?"Entire branch":`${styleScope.branchCount} entire branches`} · ${styleScope.nodeIds.size} ${styleScope.nodeIds.size===1?"shape":"shapes"}${styleScope.edgeIds.size?` · ${styleScope.edgeIds.size} ${styleScope.edgeIds.size===1?"line":"lines"}`:""}`;
  useEffect(()=>{setBranchStyleSection(null)},[selectedIds,selectedEdge,locked,styleScope.locked]);
  const focusIds=useMemo(()=>{if(focusRootId===null)return null;const ids=new Set([focusRootId]),queue=[focusRootId],root=nodes.find(node=>node.id===focusRootId);if(root?.kind==="frame")nodes.filter(node=>node.frameId===root.id).forEach(node=>{ids.add(node.id);queue.push(node.id)});while(queue.length){const id=queue.shift(),current=nodes.find(node=>node.id===id);if(current?.groupId)nodes.filter(node=>node.groupId===current.groupId).forEach(node=>{if(!ids.has(node.id)){ids.add(node.id);queue.push(node.id)}});edges.filter(edge=>edge.from===id).forEach(edge=>{if(!ids.has(edge.to)){ids.add(edge.to);queue.push(edge.to)}})}return ids},[edges,focusRootId,nodes]);
  const focusRoot=nodes.find(node=>node.id===focusRootId);
  const hiddenFrameIds=useMemo(()=>new Set(nodes.filter(node=>node.kind==="frame"&&node.hidden).map(node=>node.id)),[nodes]);
  const collapsedDescendantIds=useMemo(()=>{const hidden=new Set(),walk=(id,rootId)=>{edges.filter(edge=>edge.from===id).forEach(edge=>{if(edge.to===rootId||hidden.has(edge.to))return;hidden.add(edge.to);walk(edge.to,rootId)})};nodes.filter(node=>node.collapsed).forEach(node=>walk(node.id,node.id));return hidden},[edges,nodes]);
  const visibleNodes=useMemo(()=>nodes.filter(node=>!node.hidden&&!hiddenFrameIds.has(node.frameId)&&!collapsedDescendantIds.has(node.id)&&(!focusIds||focusIds.has(node.id))),[collapsedDescendantIds,focusIds,hiddenFrameIds,nodes]);
  const visibleNodeIds=useMemo(()=>new Set(visibleNodes.map(node=>node.id)),[visibleNodes]);
  const storylineFrames=useMemo(()=>nodes.filter(node=>node.kind==="frame"&&!node.hidden).sort((a,b)=>(a.presentationOrder??Number.MAX_SAFE_INTEGER)-(b.presentationOrder??Number.MAX_SAFE_INTEGER)||a.x-b.x||a.y-b.y),[nodes]);
  const presentationFrames=useMemo(()=>storylineFrames.filter(frame=>!frame.presentationExcluded),[storylineFrames]);
  const branchMetrics=useMemo(()=>calculateBranchMetrics(nodes,edges),[nodes,edges]);
  const activeFocusNode=nodes.find(node=>node.id===activeTimer?.nodeId);

  const notify=useCallback(message=>{setToast(message);window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>setToast(""),1700)},[]);
  const snapshot=useCallback(()=>copyBoardState({...stateRef.current,viewport:transformRef.current}),[]);
  const checkpoint=useCallback(()=>{const history=historyRef.current;history.undo.push(snapshot());if(history.undo.length>60)history.undo.shift();history.redo=[];setHistoryVersion(value=>value+1)},[snapshot]);
  const restoreSnapshot=useCallback(next=>{
    const restored=copyBoardState(next);
    restoredBoard.current=restored;
    nextNode.current=nextBoardItemId(restored.nodes,nextNode.current);
    nextEdge.current=nextBoardItemId(restored.edges,nextEdge.current);
    recurrenceGuard.current.clear();
    setNodes(restored.nodes);setEdges(restored.edges);setGlobalSettings(restored.globalSettings||{});
    setSavedViews(restored.savedViews);setAutomationRules(restored.automationRules||[]);
    setCustomFields(restored.customFields||[]);setTeamMembers(restored.teamMembers||[]);
    setGoals(restored.goals||[]);setSprints(restored.sprints||[]);setActiveTimer(restored.activeTimer||null);
    if(restored.viewport)setTransform(restored.viewport);
    setFocusRootId(null);setPresenting(false);setSelectedId(null);setSelectedIds([]);setSelectedEdge(null);
    setEditingId(null);setConnectionSource(null);setSelectionBox(null);setSnapGuides({x:null,y:null});
  },[]);
  const undo=useCallback(()=>{const history=historyRef.current;if(!history.undo.length){notify("Nothing to undo");return}history.redo.push(snapshot());restoreSnapshot(history.undo.pop());setHistoryVersion(value=>value+1);notify("Undone")},[notify,restoreSnapshot,snapshot]);
  const redo=useCallback(()=>{const history=historyRef.current;if(!history.redo.length){notify("Nothing to redo");return}history.undo.push(snapshot());restoreSnapshot(history.redo.pop());setHistoryVersion(value=>value+1);notify("Redone")},[notify,restoreSnapshot,snapshot]);
  const exportBoard=useCallback(()=>{exportProjectFile({...project,board:snapshot(),updated:Date.now()});notify("Project exported")},[notify,project,snapshot]);
  const openVersionHistory=useCallback(async()=>{setHistoryOpen(true);setVersionsLoading(true);try{setVersions(await listProjectVersions(project.id))}catch{notify("Could not open local history")}finally{setVersionsLoading(false)}},[notify,project.id]);
  const restoreVersion=useCallback(version=>{checkpoint();restoreSnapshot(version.board);setHistoryOpen(false);notify("Recovery point restored")},[checkpoint,notify,restoreSnapshot]);
  const deleteMilestone=key=>requestDelete({
    title: "Delete saved version?",
    description: "This saved version will be permanently deleted. This cannot be undone.",
    confirmLabel: "Delete version",
    onConfirm: async ()=>{try{await deleteProjectVersion(key);setVersions(items=>items.filter(version=>version.key!==key));notify("Milestone deleted")}catch{notify("Could not delete milestone")}},
  });
  const fitItems=useCallback((items,maxScale=1.15)=>{
    const rect=stageRef.current?.getBoundingClientRect();if(!rect||!items.length)return;
    const bounds=items.reduce((area,node)=>{const size=nodeSize(node);return{left:Math.min(area.left,node.x),top:Math.min(area.top,node.y),right:Math.max(area.right,node.x+size.width),bottom:Math.max(area.bottom,node.y+size.height)}},{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity});
    const compact=window.matchMedia("(max-width:760px), (max-height:500px) and (pointer:coarse)").matches;
    const landscape=compact&&rect.height<440&&rect.width>rect.height;
    const padding=compact?{left:landscape?80:24,right:24,top:76,bottom:landscape?80:148}:{left:120,right:120,top:120,bottom:120};
    const width=Math.max(80,rect.width-padding.left-padding.right),height=Math.max(80,rect.height-padding.top-padding.bottom);
    const candidate=Math.max(.01,Math.min(maxScale,width/Math.max(1,bounds.right-bounds.left),height/Math.max(1,bounds.bottom-bounds.top)));
    const scale=Math.min(candidate,snapScale(candidate));
    setTransform({x:padding.left+width/2-(bounds.left+bounds.right)/2*scale,y:padding.top+height/2-(bounds.top+bounds.bottom)/2*scale,scale});
  },[]);
  const fit=useCallback(()=>fitItems(visibleNodes),[fitItems,visibleNodes]);
  const enterPresentation=useCallback(()=>{setPresenting(true);setPresentationIndex(0);setShowPresenterNotes(false);setFocusRootId(null);setOutlineOpen(false);setCommentsOpen(false);setViewsOpen(false);setTaskBoardOpen(false);setOutlineImportOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setShortcutsOpen(false);setAgendaOpen(false);setResourcesOpen(false);setFocusLensOpen(false);setDependencyOpen(false);setExportStudioOpen(false);setStoryOpen(false);setTableOpen(false);setAutomationOpen(false);setFieldsOpen(false);setExchangeOpen(false);setCalendarOpen(false);setProgressOpen(false);setWorkloadOpen(false);setFocusSessionsOpen(false);setRecurringOpen(false);setDecisionsOpen(false);setPrioritizationOpen(false);setGoalsOpen(false);setSprintsOpen(false);setRisksOpen(false);setSearchOpen(false);setHistoryOpen(false);setBranchStyleSection(null);setSelectedId(null);setSelectedIds([]);setSelectedEdge(null);setEditingId(null)},[]);
  const focusNode=node=>{if(!node)return;const size=nodeSize(node),ancestors=new Set(),queue=[node.id];while(queue.length){const target=queue.shift();edges.filter(edge=>edge.to===target).forEach(edge=>{if(!ancestors.has(edge.from)){ancestors.add(edge.from);queue.push(edge.from)}})}setFocusRootId(null);if(node.hidden||hiddenFrameIds.has(node.frameId)||[...ancestors].some(id=>nodes.find(item=>item.id===id)?.collapsed))setNodes(items=>items.map(item=>item.id===node.id||item.id===node.frameId?{...item,hidden:false}:ancestors.has(item.id)&&item.collapsed?{...item,collapsed:false}:item));let centerX=view.width/2,centerY=view.height/2;const panel=document.querySelector(`.${styles.commentsPanel}`),stage=stageRef.current?.getBoundingClientRect();if(commentsOpen&&panel&&stage&&window.matchMedia("(max-width:760px), (max-height:500px) and (pointer:coarse)").matches){const bounds=panel.getBoundingClientRect();if(bounds.left-stage.left>40)centerX=Math.max(60,(bounds.left-stage.left)/2);else centerY=Math.max(100,(bounds.top-stage.top)/2)}setTransform(current=>({...current,x:Math.round(centerX-(node.x+size.width/2)*current.scale),y:Math.round(centerY-(node.y+size.height/2)*current.scale)}));setSelectedId(node.id);setSelectedIds([node.id]);setSelectedEdge(null);setSearchOpen(false)};
  const enterBranchFocus=id=>{setFocusRootId(id);setSelectedId(null);setSelectedIds([]);setSelectedEdge(null);setEditingId(null);setBranchStyleSection(null);setOutlineOpen(false);setCommentsOpen(false)};
  const navigateMiniMap=point=>setTransform(current=>({...current,x:Math.round(view.width/2-point.x*current.scale),y:Math.round(view.height/2-point.y*current.scale)}));
  const updateRichText=useCallback((id,content)=>setNodes(items=>items.map(node=>node.id===id&&Object.keys(content).some(key=>node[key]!==content[key])?{...node,...content}:node)),[]);
  const editNode=useCallback(id=>{if(presenting)return;if(id!==null&&nodes.find(node=>node.id===id)?.locked){notify("Unlock this shape to edit it");return}if(id!==null&&editingId!==id)checkpoint();if(id!==null){setSelectedId(id);setSelectedIds([id])}setEditingId(id);if(id===null)stageRef.current?.focus({preventScroll:true})},[checkpoint,editingId,nodes,notify,presenting]);
  const addNode=useCallback((kind="box",at=null)=>{checkpoint();const id=nextNode.current++;const rect=stageRef.current?.getBoundingClientRect();const originX=at?.x??(((rect?.width||1000)/2-transform.x)/transform.scale-SIZE.width/2);const originY=at?.y??(((rect?.height||700)/2-transform.y)/transform.scale-SIZE.height/2);setNodes(items=>{let x=originX,y=originY;if(overlapsNode(x,y,SIZE.width,SIZE.height,items)){for(let step=1;step<12;step+=1){const angle=step*2.4;const radius=70+step*34;const candidateX=originX+Math.cos(angle)*radius,candidateY=originY+Math.sin(angle)*radius;if(!overlapsNode(candidateX,candidateY,SIZE.width,SIZE.height,items)){x=candidateX;y=candidateY;break}}}return[...items,{id,x,y,title:kind==="text"?"Add a thought":"New idea",note:kind==="note"?"Write a note…":"Double-click to edit",color:kind==="note"?"amber":globalSettings.color,shape:kind==="text"?"pill":globalSettings.shape}]});setSelectedId(id);setSelectedIds([id]);setSelectedEdge(null)},[checkpoint,transform,globalSettings.color,globalSettings.shape]);
  const addFrame=useCallback(()=>{checkpoint();const id=nextNode.current++,rect=stageRef.current?.getBoundingClientRect(),width=560,height=360,x=((rect?.width||1000)/2-transform.x)/transform.scale-width/2,y=((rect?.height||700)/2-transform.y)/transform.scale-height/2;const frame={id,x,y,w:width,h:height,title:"New section",note:"Double-click to rename",color:"violet",shape:"round",kind:"frame"};setNodes(items=>[frame,...items]);setSelectedId(id);setSelectedIds([id]);setSelectedEdge(null)},[checkpoint,transform]);
  const addBranch=useCallback((source,side)=>{checkpoint();const id=nextNode.current++,inherited=childBranchStyle(source,edges,globalSettings),branchStyle={structure:inherited.structure,pattern:inherited.pattern,weight:inherited.weight};const siblingIndex=edges.filter(edge=>edge.from===source.id&&edge.side===side).length;setNodes(items=>{const position=findBranchPosition(source,side,items,siblingIndex);return[...items,{id,...position,title:"New branch",note:"Double-click to edit",color:inherited.color,shape:inherited.shape,branchStyle}]});setEdges(items=>[...items,{id:nextEdge.current++,from:source.id,to:id,side,...branchStyle}]);setSelectedId(id);setSelectedIds([id]);setSelectedEdge(null)},[checkpoint,edges,globalSettings]);
  const removeSelected=useCallback(()=>{
    if(!selectedEdge&&!selectedIds.length)return;if(!selectedEdge&&nodes.some(node=>selectedIds.includes(node.id)&&node.locked)){notify("Unlock the selection to delete it");return}
    checkpoint();
    if(selectedEdge){
      setEdges(items=>items.filter(edge=>edge.id!==selectedEdge));
    }else{
      const removing=new Set(selectedIds);
      setNodes(items=>{
        const removedFrames=new Set(items.filter(node=>removing.has(node.id)&&node.kind==="frame").map(node=>node.id));
        return items.filter(node=>!removing.has(node.id)).map(node=>removedFrames.has(node.frameId)?{...node,frameId:undefined}:node);
      });
      setEdges(items=>items.filter(edge=>!removing.has(edge.from)&&!removing.has(edge.to)));
      setGoals(items=>items.map(goal=>({...goal,nodeIds:(goal.nodeIds||[]).filter(id=>!removing.has(id))})));
    }
    setSelectedEdge(null);setSelectedId(null);setSelectedIds([]);
  },[checkpoint,nodes,notify,selectedEdge,selectedIds]);
  const duplicate=()=>{if(!selectedIds.length)return;checkpoint();const chosen=new Set(selectedIds),idMap=new Map(),groupMap=new Map();selectedIds.forEach(id=>idMap.set(id,nextNode.current++));const copies=nodes.filter(node=>chosen.has(node.id)).map(node=>{let groupId=node.groupId;if(groupId){if(!groupMap.has(groupId))groupMap.set(groupId,`group-${Date.now()}-${groupMap.size}`);groupId=groupMap.get(groupId)}return{...node,id:idMap.get(node.id),groupId,x:node.x+35,y:node.y+35,root:false}});const copiedEdges=edges.filter(edge=>chosen.has(edge.from)&&chosen.has(edge.to)).map(edge=>({...edge,id:nextEdge.current++,from:idMap.get(edge.from),to:idMap.get(edge.to)}));const ids=copies.map(node=>node.id);setNodes(items=>[...items,...copies]);setEdges(items=>[...items,...copiedEdges]);setSelectedIds(ids);setSelectedId(ids.at(-1)||null)};
  const copySelection=useCallback(()=>{if(!selectedIds.length)return false;const initiallyChosen=new Set(selectedIds),selectedFrames=new Set(nodes.filter(node=>initiallyChosen.has(node.id)&&node.kind==="frame").map(node=>node.id)),chosen=new Set([...selectedIds,...nodes.filter(node=>selectedFrames.has(node.frameId)).map(node=>node.id)]),copiedNodes=nodes.filter(node=>chosen.has(node.id));if(!copiedNodes.length)return false;const left=Math.min(...copiedNodes.map(node=>node.x)),top=Math.min(...copiedNodes.map(node=>node.y)),right=Math.max(...copiedNodes.map(node=>node.x+nodeSize(node).width)),bottom=Math.max(...copiedNodes.map(node=>node.y+nodeSize(node).height)),payload={version:1,width:right-left,height:bottom-top,nodes:copiedNodes.map(node=>({...node,x:node.x-left,y:node.y-top})),edges:edges.filter(edge=>chosen.has(edge.from)&&chosen.has(edge.to)).map(edge=>({...edge}))};try{localStorage.setItem(CLIPBOARD_KEY,JSON.stringify(payload));pasteCount.current=0;notify(`${copiedNodes.length} ${copiedNodes.length===1?"shape":"shapes"} copied`);return true}catch{notify("Could not copy selection");return false}},[edges,nodes,notify,selectedIds]);
  const pasteSelection=useCallback(()=>{let payload;try{payload=JSON.parse(localStorage.getItem(CLIPBOARD_KEY)||"")}catch{payload=null}if(!payload?.nodes?.length){notify("Nothing to paste");return}checkpoint();pasteCount.current+=1;const idMap=new Map(),groupMap=new Map();payload.nodes.forEach(node=>idMap.set(node.id,nextNode.current++));const rect=stageRef.current?.getBoundingClientRect(),offset=Math.min(96,pasteCount.current*18),originX=((rect?.width||view.width)/2-transform.x)/transform.scale-(payload.width||0)/2+offset,originY=((rect?.height||view.height)/2-transform.y)/transform.scale-(payload.height||0)/2+offset;const copies=payload.nodes.map(node=>{let groupId=node.groupId;if(groupId){if(!groupMap.has(groupId))groupMap.set(groupId,`group-${Date.now()}-${groupMap.size}`);groupId=groupMap.get(groupId)}return{...node,id:idMap.get(node.id),x:Math.round(originX+node.x),y:Math.round(originY+node.y),groupId,frameId:idMap.get(node.frameId),root:false}}),copiedEdges=(payload.edges||[]).filter(edge=>idMap.has(edge.from)&&idMap.has(edge.to)).map(edge=>({...edge,id:nextEdge.current++,from:idMap.get(edge.from),to:idMap.get(edge.to)})),ids=copies.map(node=>node.id);setNodes(items=>[...items,...copies]);setEdges(items=>[...items,...copiedEdges]);setSelectedIds(ids);setSelectedId(ids.at(-1)||null);setSelectedEdge(null);notify(`${copies.length} ${copies.length===1?"shape":"shapes"} pasted`)},[checkpoint,notify,transform,view]);
  const updateEdgeSetting=(key,value)=>{if(!selectedEdge)return;checkpoint();setEdges(items=>items.map(edge=>edge.id===selectedEdge?{...edge,[key]:value}:edge))};
  const updateEdgeLabel=value=>{if(!selectedEdge)return;const clean=value.trim();if((activeEdge?.label||"")===clean)return;checkpoint();setEdges(items=>items.map(edge=>edge.id===selectedEdge?{...edge,label:clean}:edge))};
  const updateBranchStyle=(key,value)=>{
    const next=applyBranchStyle(nodes,edges,styleScope,key,value,locked);
    if(next.nodes===nodes&&next.edges===edges)return;
    checkpoint();setNodes(next.nodes);setEdges(next.edges);
  };
  const groupSelected=()=>{if(selectedIds.length<2)return;checkpoint();const chosen=new Set(selectedIds),groupId=`group-${Date.now()}`;setNodes(items=>items.map(node=>chosen.has(node.id)?{...node,groupId}:node));notify(`${selectedIds.length} shapes grouped`)};
  const ungroupSelected=()=>{if(!selectedGrouped)return;checkpoint();const groups=new Set(selectedNodes.map(node=>node.groupId).filter(Boolean));setNodes(items=>items.map(node=>groups.has(node.groupId)?{...node,groupId:undefined}:node));notify("Shapes ungrouped")};
  const toggleSelectedLock=()=>{if(!selectedIds.length)return;checkpoint();const chosen=new Set(selectedIds),locked=!selectedLocked;setNodes(items=>items.map(node=>chosen.has(node.id)?{...node,locked}:node));notify(locked?"Selection locked":"Selection unlocked")};
  const toggleNodeVisibility=id=>{checkpoint();const target=nodes.find(node=>node.id===id),hidden=!target?.hidden;setNodes(items=>items.map(node=>node.id===id?{...node,hidden}:node));if(hidden&&selectedIds.includes(id)){const next=selectedIds.filter(item=>item!==id);setSelectedIds(next);setSelectedId(next.at(-1)||null)}notify(hidden?"Item hidden":"Item visible")};
  const toggleNodeLock=id=>{checkpoint();const target=nodes.find(node=>node.id===id),locked=!target?.locked;setNodes(items=>items.map(node=>node.id===id?{...node,locked}:node));notify(locked?"Item locked":"Item unlocked")};
  const toggleBranch=id=>{const target=nodes.find(node=>node.id===id);if(!target)return;checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,collapsed:!node.collapsed}:node));if(!target.collapsed){const descendants=new Set(),walk=source=>edges.filter(edge=>edge.from===source).forEach(edge=>{if(descendants.has(edge.to)||edge.to===id)return;descendants.add(edge.to);walk(edge.to)});walk(id);const next=selectedIds.filter(item=>!descendants.has(item));setSelectedIds(next);setSelectedId(next.at(-1)||id)}notify(target.collapsed?"Branch expanded":"Branch collapsed")};
  useEffect(()=>{
    if(!commentsOpen||!window.matchMedia("(max-width:760px), (max-height:500px) and (pointer:coarse)").matches)return;
    const panel=document.querySelector(`.${styles.commentsPanel}`)?.getBoundingClientRect(),stage=stageRef.current?.getBoundingClientRect();
    if(!panel||!stage)return;
    const side=panel.left-stage.left>40,dx=side?panel.width/2:0,dy=side?0:panel.height/2;
    setTransform(current=>({...current,x:current.x-dx,y:current.y-dy}));
    return()=>setTransform(current=>({...current,x:current.x+dx,y:current.y+dy}));
  },[commentsOpen]);
  const openComments=()=>{setCommentsOpen(true);setOutlineOpen(false);setViewsOpen(false)};
  const addComment=(nodeId,text)=>{checkpoint();const comment={id:globalThis.crypto?.randomUUID?.()||`comment-${Date.now()}`,text,createdAt:Date.now(),resolved:false};setNodes(items=>items.map(node=>node.id===nodeId?{...node,comments:[...(node.comments||[]),comment]}:node));notify("Comment added")};
  const resolveComment=(nodeId,commentId)=>{checkpoint();setNodes(items=>items.map(node=>node.id===nodeId?{...node,comments:(node.comments||[]).map(comment=>comment.id===commentId?{...comment,resolved:!comment.resolved}:comment)}:node))};
  const deleteComment=(nodeId,commentId)=>requestDelete({
    title: "Delete comment?",
    description: "This comment will be removed from the shape. You can undo this change.",
    confirmLabel: "Delete comment",
    onConfirm: ()=>{checkpoint();setNodes(items=>items.map(node=>node.id===nodeId?{...node,comments:(node.comments||[]).filter(comment=>comment.id!==commentId)}:node));notify("Comment deleted")},
  });
  const openViews=()=>{setViewsOpen(value=>!value);setOutlineOpen(false);setCommentsOpen(false)};
  const saveCurrentView=name=>{checkpoint();const saved=createSavedView(stateRef.current,transformRef.current,name);setSavedViews(items=>[...items,saved]);notify("Full board view saved")};
  const openSavedView=view=>{
    if(view.board){checkpoint();restoreSnapshot(restoreSavedView(stateRef.current,view))}
    else{setFocusRootId(null);setTransform({...view.transform})}
    setViewsOpen(false);notify(view.board?`Restored ${view.name}. Undo to go back.`:`Opened ${view.name}`);
  };
  const deleteSavedView=id=>requestDelete({
    title: "Delete saved view?",
    description: "This saved view will be removed. Your current board stays unchanged. You can undo this change.",
    confirmLabel: "Delete view",
    onConfirm: ()=>{checkpoint();setSavedViews(items=>items.filter(view=>view.id!==id));notify("Saved view deleted")},
  });
  const showSearchFilter=useCallback(()=>{setOutlineOpen(true);setCommentsOpen(false);setViewsOpen(false);setSearchOpen(false);document.getElementById("board-search-filter")?.querySelector("input")?.focus()},[]);
  const openOutline=()=>{if(outlineOpen)setOutlineOpen(false);else showSearchFilter()};
  const openTaskBoard=()=>{setTaskBoardOpen(true);setOutlineOpen(false);setCommentsOpen(false);setViewsOpen(false)};
  const moveTask=(id,status)=>{const target=nodes.find(node=>node.id===id);if(!target||(target.status||"none")===status)return;checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,status}:node))};
  const importOutline=text=>{const source=text.split("\n").map(line=>{const leading=line.match(/^\s*/)?.[0]||"",indent=[...leading].reduce((total,character)=>total+(character==="\t"?2:1),0),title=line.trim().replace(/^(?:[-*•]|\d+[.)])\s*/,"").trim();return{indent,title}}).filter(line=>line.title);if(!source.length)return;checkpoint();const rect=stageRef.current?.getBoundingClientRect(),originX=((rect?.width||view.width)/2-transform.x)/transform.scale-120,originY=((rect?.height||view.height)/2-transform.y)/transform.scale-source.length*56,stack=[],created=[],createdEdges=[],depthRows=new Map(),colors=["violet","blue","green","amber","pink","orange"];source.forEach(line=>{while(stack.length&&stack.at(-1).indent>=line.indent)stack.pop();const parent=stack.at(-1),depth=stack.length,row=depthRows.get(depth)||0,id=nextNode.current++;depthRows.set(depth,row+1);const node={id,x:originX+depth*310,y:originY+row*126,title:line.title,note:parent?"Imported branch":"Imported outline",color:colors[depth%colors.length],shape:globalSettings.shape};created.push(node);if(parent)createdEdges.push({id:nextEdge.current++,from:parent.id,to:id,side:"right",structure:globalSettings.structure,pattern:globalSettings.pattern,weight:globalSettings.weight});stack.push({indent:line.indent,id})});setNodes(items=>[...items,...created]);setEdges(items=>[...items,...createdEdges]);const ids=created.map(node=>node.id);setSelectedIds(ids);setSelectedId(ids.at(-1)||null);setSelectedEdge(null);notify(`${created.length} shapes imported`)};
  const replaceBoardText=(query,replacement)=>{const escaped=query.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),pattern=new RegExp(escaped,"gi");let changed=0;const updated=nodes.map(node=>{const title=(node.title||"").replace(pattern,replacement),note=(node.note||"").replace(pattern,replacement),tags=(node.tags||[]).map(tag=>tag.replace(pattern,replacement)).filter(Boolean),different=title!==node.title||note!==(node.note||"")||tags.length!==(node.tags||[]).length||tags.some((tag,index)=>tag!==(node.tags||[])[index]);if(!different)return node;changed+=1;return{...node,title,note,tags,titleHtml:title!==node.title?undefined:node.titleHtml,noteHtml:note!==(node.note||"")?undefined:node.noteHtml}});if(!changed)return;checkpoint();setNodes(updated);notify(`Updated ${changed} ${changed===1?"shape":"shapes"}`)};
  const openFindReplace=()=>{setFindReplaceOpen(true);setInsightsOpen(false);setTaskBoardOpen(false);setOutlineImportOpen(false)};
  const openInsights=()=>{setInsightsOpen(true);setFindReplaceOpen(false);setTaskBoardOpen(false);setOutlineImportOpen(false)};
  const openLibrary=async()=>{setLibraryOpen(true);setLibraryLoading(true);setFindReplaceOpen(false);setInsightsOpen(false);setTaskBoardOpen(false);setOutlineImportOpen(false);try{setLibraryItems(await listShapeLibrary())}catch{notify("Could not open shape library")}finally{setLibraryLoading(false)}};
  const saveSelectionToLibrary=async name=>{if(!selectedIds.length)return;const initiallyChosen=new Set(selectedIds),frames=new Set(nodes.filter(node=>initiallyChosen.has(node.id)&&node.kind==="frame").map(node=>node.id)),chosen=new Set([...selectedIds,...nodes.filter(node=>frames.has(node.frameId)).map(node=>node.id)]),picked=nodes.filter(node=>chosen.has(node.id)),left=Math.min(...picked.map(node=>node.x)),top=Math.min(...picked.map(node=>node.y)),right=Math.max(...picked.map(node=>node.x+nodeSize(node).width)),bottom=Math.max(...picked.map(node=>node.y+nodeSize(node).height)),payload={width:right-left,height:bottom-top,nodes:picked.map(node=>({...node,x:node.x-left,y:node.y-top,comments:[]})),edges:edges.filter(edge=>chosen.has(edge.from)&&chosen.has(edge.to)).map(edge=>({...edge}))};try{setLibraryItems(await saveShapeLibraryItem({name,createdAt:Date.now(),payload}));notify("Component saved to library")}catch{notify("Could not save component")}};
  const insertLibraryItem=item=>{const payload=item.payload;if(!payload?.nodes?.length)return;checkpoint();const idMap=new Map(),groupMap=new Map();payload.nodes.forEach(node=>idMap.set(node.id,nextNode.current++));const rect=stageRef.current?.getBoundingClientRect(),originX=((rect?.width||view.width)/2-transform.x)/transform.scale-(payload.width||0)/2,originY=((rect?.height||view.height)/2-transform.y)/transform.scale-(payload.height||0)/2,copies=payload.nodes.map(node=>{let groupId=node.groupId;if(groupId){if(!groupMap.has(groupId))groupMap.set(groupId,`group-${Date.now()}-${groupMap.size}`);groupId=groupMap.get(groupId)}return{...node,id:idMap.get(node.id),x:Math.round(originX+node.x),y:Math.round(originY+node.y),groupId,frameId:idMap.get(node.frameId),root:false}}),copiedEdges=(payload.edges||[]).map(edge=>({...edge,id:nextEdge.current++,from:idMap.get(edge.from),to:idMap.get(edge.to)})),ids=copies.map(node=>node.id);setNodes(items=>[...items,...copies]);setEdges(items=>[...items,...copiedEdges]);setSelectedIds(ids);setSelectedId(ids.at(-1)||null);setLibraryOpen(false);notify(`${item.name} inserted`)};
  const removeLibraryItem=id=>requestDelete({
    title: "Remove saved component?",
    description: "This component will be permanently removed from your shape library. This cannot be undone.",
    confirmLabel: "Remove component",
    onConfirm: async ()=>{try{setLibraryItems(await deleteShapeLibraryItem(id));notify("Component removed") }catch{notify("Could not remove component")}},
  });
  const revealBoardPoint=useCallback((x,y)=>{
    const rect=stageRef.current?.getBoundingClientRect();
    if(!rect)return;
    setTransform(value=>{
      const screenX=value.x+x*value.scale,screenY=value.y+y*value.scale;
      return screenX<80||screenX>rect.width-80||screenY<100||screenY>rect.height-100
        ? {...value,x:Math.round(rect.width/2-x*value.scale),y:Math.round(rect.height/2-y*value.scale)} : value;
    });
  },[]);
  const selectKeyboardNode=useCallback((node,additive=false)=>{
    if(!node)return;
    setSelectedId(node.id);setSelectedIds(ids=>additive?[...new Set([...ids,node.id])]:[node.id]);setSelectedEdge(null);
    stageRef.current?.focus({preventScroll:true});
    const size=nodeSize(node);revealBoardPoint(node.x+size.width/2,node.y+size.height/2);
  },[revealBoardPoint]);
  const navigateByArrow=useCallback((direction,additive=false)=>{
    selectKeyboardNode(nearbyBoardNode(visibleNodes,selectedId,direction),additive);
  },[selectKeyboardNode,selectedId,visibleNodes]);
  const navigateConnection=useCallback(direction=>{
    const visible=new Set(visibleNodes.map(node=>node.id));
    const candidates=edges.filter(edge=>visible.has(edge.from)&&visible.has(edge.to));
    if(!candidates.length)return;
    const current=candidates.findIndex(edge=>edge.id===selectedEdge);
    const index=current<0?(direction>0?0:candidates.length-1):(current+direction+candidates.length)%candidates.length;
    const edge=candidates[index],source=nodes.find(node=>node.id===edge.from),target=nodes.find(node=>node.id===edge.to);
    setSelectedEdge(edge.id);setSelectedId(null);setSelectedIds([]);stageRef.current?.focus({preventScroll:true});
    const from=nodeSize(source),to=nodeSize(target);
    revealBoardPoint((source.x+from.width/2+target.x+to.width/2)/2,(source.y+from.height/2+target.y+to.height/2)/2);
  },[edges,nodes,revealBoardPoint,selectedEdge,visibleNodes]);
  const exportMarkdown=()=>{const exported=nodes.filter(node=>node.kind!=="frame"&&!node.hidden&&!hiddenFrameIds.has(node.frameId)),ids=new Set(exported.map(node=>node.id)),incoming=new Set(edges.filter(edge=>ids.has(edge.from)&&ids.has(edge.to)).map(edge=>edge.to)),outgoing=new Map(exported.map(node=>[node.id,edges.filter(edge=>edge.from===node.id&&ids.has(edge.to))])),roots=exported.filter(node=>!incoming.has(node.id)),visited=new Set(),lines=[`# ${project.title}`,""];const write=(node,depth=0,relationship="")=>{if(visited.has(node.id))return;visited.add(node.id);const checkbox=node.status==="done"?"[x] ":node.status==="todo"||node.status==="doing"?"[ ] ":"",tags=(node.tags||[]).map(tag=>`#${tag}`).join(" "),relation=relationship?` — _${relationship}_`:"";lines.push(`${"  ".repeat(depth)}- ${checkbox}${node.title}${relation}${tags?` ${tags}`:""}`);if(node.note)lines.push(`${"  ".repeat(depth+1)}${node.note}`);(outgoing.get(node.id)||[]).forEach(edge=>{const child=exported.find(item=>item.id===edge.to);if(child)write(child,depth+1,edge.label||"")})};roots.forEach(root=>{write(root);lines.push("")});exported.filter(node=>!visited.has(node.id)).forEach(node=>write(node));const blob=new Blob([lines.join("\n")],{type:"text/markdown"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`${project.title.replace(/[^a-z0-9-_]+/gi,"-").replace(/^-|-$/g,"")||"board"}.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify("Markdown exported")};
  const openAgenda=()=>{setAgendaOpen(true);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const completeAgendaItem=id=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,status:"done"}:node));notify("Marked as done")};
  const openResources=()=>{setResourcesOpen(true);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const deleteNodeLink=(nodeId,linkId)=>requestDelete({
    title: "Remove resource link?",
    description: "This link will be removed from its shape. You can undo this change.",
    confirmLabel: "Remove link",
    onConfirm: ()=>{checkpoint();setNodes(items=>items.map(node=>node.id===nodeId?{...node,links:(node.links||[]).filter(link=>link.id!==linkId)}:node));notify("Link removed")},
  });
  const openFocusLens=()=>{setFocusLensOpen(true);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const toggleStar=id=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,starred:!node.starred}:node));notify(nodes.find(node=>node.id===id)?.starred?"Removed from starred":"Added to starred")};
  const selectLensResults=items=>{const ids=items.map(node=>node.id);setSelectedIds(ids);setSelectedId(ids.at(-1)||null);setSelectedEdge(null);setEditingId(null);fitItems(items);notify(`${ids.length} ${ids.length===1?"shape":"shapes"} selected`)};
  const openDependencyCenter=()=>{setDependencyOpen(true);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const changeRelationshipType=(edgeId,relation)=>{checkpoint();setEdges(items=>items.map(edge=>edge.id===edgeId?{...edge,relation}:edge));notify(`Relationship set to ${relationLabel(relation).toLowerCase()}`)};
  const openShare=()=>{setEditingId(null);setShareProject(structuredClone({...project,board:{...project.board,...stateRef.current,viewport:{...transform}},updated:Date.now()}))};
  const openExportStudio=()=>{setExportStudioOpen(true);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const openStoryline=()=>{setStoryOpen(true);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const moveStoryFrame=(id,direction)=>{const ordered=[...storylineFrames],index=ordered.findIndex(frame=>frame.id===id),target=index+direction;if(index<0||target<0||target>=ordered.length)return;[ordered[index],ordered[target]]=[ordered[target],ordered[index]];const order=new Map(ordered.map((frame,position)=>[frame.id,position]));checkpoint();setNodes(items=>items.map(node=>order.has(node.id)?{...node,presentationOrder:order.get(node.id)}:node))};
  const toggleStoryFrame=id=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,presentationExcluded:!node.presentationExcluded}:node))};
  const updatePresenterNote=(id,presenterNote)=>{const current=nodes.find(node=>node.id===id)?.presenterNote||"",clean=presenterNote.trim();if(current===clean)return;checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,presenterNote:clean}:node));notify("Presenter note saved")};
  const openDataTable=()=>{setTableOpen(true);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const updateTableNode=(id,changes)=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,...changes}:node))};
  const bulkUpdateTable=(ids,changes)=>{checkpoint();const chosen=new Set(ids);setNodes(items=>items.map(node=>chosen.has(node.id)?{...node,...changes}:node));notify(`${ids.length} ${ids.length===1?"shape":"shapes"} updated`)};
  const openAutomations=()=>{setAutomationOpen(true);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const addAutomation=()=>{checkpoint();setAutomationRules(items=>[...items,{id:globalThis.crypto?.randomUUID?.()||`rule-${Date.now()}`,enabled:true,whenField:"status",whenValue:"done",actionField:"starred",actionValue:"true"}])};
  const updateAutomation=(id,changes)=>{checkpoint();setAutomationRules(items=>items.map(rule=>rule.id===id?{...rule,...changes}:rule))};
  const deleteAutomation=id=>requestDelete({
    title: "Delete automation?",
    description: "This rule will be removed and will stop running on this board. You can undo this change.",
    confirmLabel: "Delete automation",
    onConfirm: ()=>{checkpoint();setAutomationRules(items=>items.filter(rule=>rule.id!==id));notify("Automation deleted")},
  });
  const openCustomFields=()=>{setFieldsOpen(true);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const addCustomField=field=>{checkpoint();setCustomFields(items=>[...items,{...field,id:globalThis.crypto?.randomUUID?.()||`field-${Date.now()}`}]);notify("Custom field added")};
  const updateCustomField=(id,changes)=>{checkpoint();setCustomFields(items=>items.map(field=>field.id===id?{...field,...changes}:field))};
  const deleteCustomField=id=>requestDelete({
    title: "Delete custom field?",
    description: "This field and all of its values will be removed from the board. You can undo this change.",
    confirmLabel: "Delete field",
    onConfirm: ()=>{checkpoint();setCustomFields(items=>items.filter(field=>field.id!==id));setNodes(items=>items.map(node=>{if(!node.customValues||!(id in node.customValues))return node;const customValues={...node.customValues};delete customValues[id];return{...node,customValues}}));notify("Custom field deleted")},
  });
  const setCustomValue=(nodeId,fieldId,value)=>{checkpoint();setNodes(items=>items.map(node=>node.id===nodeId?{...node,customValues:{...(node.customValues||{}),[fieldId]:value}}:node))};
  const openDataExchange=()=>{setExchangeOpen(true);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const exportCsv=()=>{const fields=customFields.map(field=>({field,header:`custom.${field.name}`})),headers=["id","title","note","status","priority","due_date","tags","starred","color",...fields.map(item=>item.header)],rows=nodes.filter(node=>node.kind!=="frame").map(node=>[node.id,node.title,node.note,node.status||"none",node.priority||"none",node.dueDate||"",(node.tags||[]).join(", "),Boolean(node.starred),node.color||"white",...fields.map(({field})=>node.customValues?.[field.id]??"")]),csv=[headers,...rows].map(row=>row.map(csvCell).join(",")).join("\n"),url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");link.href=url;link.download=`${project.title.replace(/[^a-z0-9-_]+/gi,"-").replace(/^-|-$/g,"")||"board"}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify("CSV exported")};
  const importCsv=(rows,mode)=>{checkpoint();const statuses=new Set(["none","todo","doing","done"]),priorities=new Set(["none","low","medium","high"]),colors=new Set(Object.keys(palettes)),rect=stageRef.current?.getBoundingClientRect(),originX=((rect?.width||view.width)/2-transform.x)/transform.scale-300,originY=((rect?.height||view.height)/2-transform.y)/transform.scale-200;setNodes(items=>{const next=[...items],shapeIds=new Set(items.filter(node=>node.kind!=="frame").map(node=>node.id));rows.forEach((row,index)=>{const importedId=Number(row.id),match=mode==="merge"&&Number.isFinite(importedId)&&shapeIds.has(importedId)?next.find(node=>node.id===importedId):null,customValues={...(match?.customValues||{})};customFields.forEach(field=>{const header=Object.keys(row).find(key=>key.toLowerCase()===`custom.${field.name}`.toLowerCase());if(header!==undefined){const raw=row[header],value=field.type==="checkbox"?/^(true|1|yes)$/i.test(raw):field.type==="number"&&raw!==""?Number(raw):raw;customValues[field.id]=value}});const patch={title:(row.title||match?.title||"Imported shape").trim()||"Imported shape",note:row.note??match?.note??"",status:statuses.has(row.status)?row.status:(match?.status||"none"),priority:priorities.has(row.priority)?row.priority:(match?.priority||"none"),dueDate:row.due_date??match?.dueDate??"",tags:row.tags!==undefined?row.tags.split(",").map(value=>value.trim().replace(/^#/,"")).filter(Boolean).slice(0,8):(match?.tags||[]),starred:row.starred!==undefined?/^(true|1|yes)$/i.test(row.starred):Boolean(match?.starred),color:colors.has(row.color)?row.color:(match?.color||"white"),customValues};if(match){const matchIndex=next.findIndex(node=>node.id===match.id);next[matchIndex]={...next[matchIndex],...patch}}else{const id=nextNode.current++,column=index%4,rowIndex=Math.floor(index/4);next.push({id,x:Math.round(originX+column*270),y:Math.round(originY+rowIndex*130),shape:globalSettings.shape,...patch})}});return next});notify(`${rows.length} ${rows.length===1?"row":"rows"} imported`)};
  const openCalendar=()=>{setCalendarOpen(true);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const setCalendarDue=(id,dueDate)=>{const target=nodes.find(node=>node.id===id);if(!target||target.dueDate===dueDate)return;checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,dueDate}:node));notify(dueDate?`Scheduled for ${formatDueDate(dueDate)}`:"Due date cleared")};
  const openProgress=()=>{setProgressOpen(true);setCalendarOpen(false);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const openWorkload=()=>{setWorkloadOpen(true);setProgressOpen(false);setCalendarOpen(false);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const addTeamMember=name=>{const colors=["#7052c1","#3d8ac9","#d8678c","#49a878","#df7d43","#bc8b28"],initials=name.split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"?";checkpoint();setTeamMembers(items=>[...items,{id:globalThis.crypto?.randomUUID?.()||`member-${Date.now()}`,name,initials,color:colors[items.length%colors.length]}]);notify(`${name} added`)};
  const deleteTeamMember=id=>requestDelete({
    title: "Remove team member?",
    description: "This member will be removed from the board and their assigned shapes will become unassigned. You can undo this change.",
    confirmLabel: "Remove member",
    onConfirm: ()=>{const member=teamMembers.find(item=>item.id===id);checkpoint();setTeamMembers(items=>items.filter(item=>item.id!==id));setNodes(items=>items.map(node=>node.assigneeId===id?{...node,assigneeId:undefined}:node));notify(`${member?.name||"Member"} removed`)},
  });
  const assignShape=(id,assigneeId)=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,assigneeId:assigneeId||undefined}:node))};
  const openFocusSessions=()=>{setFocusSessionsOpen(true);setWorkloadOpen(false);setProgressOpen(false);setCalendarOpen(false);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const startFocusTimer=id=>{if(activeTimer?.nodeId===id)return;const now=Date.now();checkpoint();if(activeTimer){const elapsed=Math.max(0,Math.floor((now-activeTimer.startedAt)/1000));setNodes(items=>items.map(node=>node.id===activeTimer.nodeId?{...node,timeSpent:(node.timeSpent||0)+elapsed}:node))}setActiveTimer({nodeId:id,startedAt:now});setTimerNow(now);notify(activeTimer?"Focus switched":"Focus timer started")};
  const stopFocusTimer=()=>{if(!activeTimer)return;const elapsed=Math.max(0,Math.floor((Date.now()-activeTimer.startedAt)/1000));checkpoint();setNodes(items=>items.map(node=>node.id===activeTimer.nodeId?{...node,timeSpent:(node.timeSpent||0)+elapsed}:node));setActiveTimer(null);notify("Focus session saved")};
  const resetFocusTime=id=>requestDelete({
    title: "Reset tracked time?",
    description: "The recorded time for this shape will be reset to zero. You can undo this change.",
    confirmLabel: "Reset time",
    onConfirm: ()=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,timeSpent:0}:node));notify("Tracked time reset")},
  });
  const openRecurringWork=()=>{setRecurringOpen(true);setFocusSessionsOpen(false);setWorkloadOpen(false);setProgressOpen(false);setCalendarOpen(false);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const setRecurrence=(id,recurrence,dueDate)=>{checkpoint();[...recurrenceGuard.current].filter(key=>key.startsWith(`${id}:`)).forEach(key=>recurrenceGuard.current.delete(key));setNodes(items=>items.map(node=>node.id===id?{...node,recurrence,dueDate,recurrenceGeneratedFor:undefined}:node));notify("Recurrence scheduled")};
  const removeRecurrence=id=>requestDelete({
    title: "Remove recurrence?",
    description: "This shape will stop creating recurring occurrences. You can undo this change.",
    confirmLabel: "Remove recurrence",
    onConfirm: ()=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,recurrence:undefined,recurrenceGeneratedFor:undefined}:node));notify("Recurrence removed")},
  });
  const openDecisionLog=()=>{setDecisionsOpen(true);setRecurringOpen(false);setFocusSessionsOpen(false);setWorkloadOpen(false);setProgressOpen(false);setCalendarOpen(false);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const saveDecision=(id,status,rationale)=>{checkpoint();const now=Date.now();setNodes(items=>items.map(node=>node.id===id?{...node,decision:{status,rationale,createdAt:node.decision?.createdAt||now,updatedAt:now}}:node));notify(status==="decided"?"Decision finalized":"Decision recorded")};
  const deleteDecision=id=>requestDelete({
    title: "Remove decision?",
    description: "This decision and its rationale will be removed from the shape. You can undo this change.",
    confirmLabel: "Remove decision",
    onConfirm: ()=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,decision:undefined}:node));notify("Decision removed")},
  });
  const openPrioritization=()=>{setPrioritizationOpen(true);setDecisionsOpen(false);setRecurringOpen(false);setFocusSessionsOpen(false);setWorkloadOpen(false);setProgressOpen(false);setCalendarOpen(false);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const savePriorityScore=(id,scoring)=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,scoring}:node));notify("Priority score saved")};
  const clearPriorityScore=id=>requestDelete({
    title: "Clear priority score?",
    description: "The saved scoring values will be removed from this shape. You can undo this change.",
    confirmLabel: "Clear score",
    onConfirm: ()=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,scoring:undefined}:node));notify("Priority score cleared")},
  });
  const openGoals=()=>{setGoalsOpen(true);setPrioritizationOpen(false);setDecisionsOpen(false);setRecurringOpen(false);setFocusSessionsOpen(false);setWorkloadOpen(false);setProgressOpen(false);setCalendarOpen(false);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const addGoal=goal=>{const id=globalThis.crypto?.randomUUID?.()||`goal-${Date.now()}`;checkpoint();setGoals(items=>[...items,{...goal,id,nodeIds:[],createdAt:Date.now()}]);notify("Goal created");return id};
  const deleteGoal=id=>requestDelete({
    title: "Remove goal?",
    description: "This goal and its links to board shapes will be removed. You can undo this change.",
    confirmLabel: "Remove goal",
    onConfirm: ()=>{checkpoint();setGoals(items=>items.filter(goal=>goal.id!==id));notify("Goal removed")},
  });
  const toggleGoalNode=(goalId,nodeId)=>{checkpoint();setGoals(items=>items.map(goal=>goal.id===goalId?{...goal,nodeIds:(goal.nodeIds||[]).includes(nodeId)?goal.nodeIds.filter(id=>id!==nodeId):[...(goal.nodeIds||[]),nodeId]}:goal))};
  const openSprints=()=>{setSprintsOpen(true);setGoalsOpen(false);setPrioritizationOpen(false);setDecisionsOpen(false);setRecurringOpen(false);setFocusSessionsOpen(false);setWorkloadOpen(false);setProgressOpen(false);setCalendarOpen(false);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const addSprint=sprint=>{const id=globalThis.crypto?.randomUUID?.()||`sprint-${Date.now()}`;checkpoint();setSprints(items=>[...items,{...sprint,id,createdAt:Date.now()}]);notify("Sprint created");return id};
  const deleteSprint=id=>requestDelete({
    title: "Remove sprint?",
    description: "This sprint will be removed and its shapes will become unassigned from the sprint. You can undo this change.",
    confirmLabel: "Remove sprint",
    onConfirm: ()=>{checkpoint();setSprints(items=>items.filter(sprint=>sprint.id!==id));setNodes(items=>items.map(node=>node.sprintId===id?{...node,sprintId:undefined}:node));notify("Sprint removed")},
  });
  const assignSprint=(nodeId,sprintId)=>{checkpoint();setNodes(items=>items.map(node=>node.id===nodeId?{...node,sprintId:sprintId||undefined,estimate:node.estimate||1}:node))};
  const setEstimate=(nodeId,estimate)=>{checkpoint();setNodes(items=>items.map(node=>node.id===nodeId?{...node,estimate}:node))};
  const openRisks=()=>{setRisksOpen(true);setSprintsOpen(false);setGoalsOpen(false);setPrioritizationOpen(false);setDecisionsOpen(false);setRecurringOpen(false);setFocusSessionsOpen(false);setWorkloadOpen(false);setProgressOpen(false);setCalendarOpen(false);setExchangeOpen(false);setFieldsOpen(false);setAutomationOpen(false);setTableOpen(false);setStoryOpen(false);setExportStudioOpen(false);setDependencyOpen(false);setFocusLensOpen(false);setResourcesOpen(false);setAgendaOpen(false);setTaskBoardOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setOutlineImportOpen(false)};
  const saveRisk=(id,risk)=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,risk}:node));notify("Risk updated")};
  const clearRisk=id=>requestDelete({
    title: "Remove risk?",
    description: "The saved risk details will be removed from this shape. You can undo this change.",
    confirmLabel: "Remove risk",
    onConfirm: ()=>{checkpoint();setNodes(items=>items.map(node=>node.id===id?{...node,risk:undefined}:node));notify("Risk removed")},
  });
  const arrangeSelection=mode=>{if(selectedNodes.length<2)return;if(selectedNodes.some(node=>node.locked)){notify("Unlock the selection to arrange it");return}checkpoint();const chosen=new Set(selectedIds),measured=selectedNodes.map(node=>({...node,...nodeSize(node)})),bounds=measured.reduce((area,node)=>({left:Math.min(area.left,node.x),top:Math.min(area.top,node.y),right:Math.max(area.right,node.x+node.width),bottom:Math.max(area.bottom,node.y+node.height)}),{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity}),positions=new Map();if(mode==="grid"){const ordered=[...measured].sort((a,b)=>a.y-b.y||a.x-b.x),columns=Math.ceil(Math.sqrt(ordered.length)),columnWidths=Array(columns).fill(0),rows=Math.ceil(ordered.length/columns),rowHeights=Array(rows).fill(0);ordered.forEach((node,index)=>{const column=index%columns,row=Math.floor(index/columns);columnWidths[column]=Math.max(columnWidths[column],node.width);rowHeights[row]=Math.max(rowHeights[row],node.height)});const columnX=[],rowY=[];columnWidths.forEach((width,index)=>{columnX[index]=index?columnX[index-1]+columnWidths[index-1]+56:bounds.left});rowHeights.forEach((height,index)=>{rowY[index]=index?rowY[index-1]+rowHeights[index-1]+42:bounds.top});ordered.forEach((node,index)=>{const column=index%columns,row=Math.floor(index/columns);positions.set(node.id,{x:Math.round(columnX[column]+(columnWidths[column]-node.width)/2),y:Math.round(rowY[row]+(rowHeights[row]-node.height)/2)})})}else if(mode==="horizontal"&&measured.length>2){const ordered=[...measured].sort((a,b)=>a.x-b.x),gap=(bounds.right-bounds.left-ordered.reduce((total,node)=>total+node.width,0))/(ordered.length-1);let x=bounds.left;ordered.forEach(node=>{positions.set(node.id,{x:Math.round(x),y:node.y});x+=node.width+gap})}else if(mode==="vertical"&&measured.length>2){const ordered=[...measured].sort((a,b)=>a.y-b.y),gap=(bounds.bottom-bounds.top-ordered.reduce((total,node)=>total+node.height,0))/(ordered.length-1);let y=bounds.top;ordered.forEach(node=>{positions.set(node.id,{x:node.x,y:Math.round(y)});y+=node.height+gap})}else measured.forEach(node=>{let x=node.x,y=node.y;if(mode==="left")x=bounds.left;if(mode==="center")x=(bounds.left+bounds.right-node.width)/2;if(mode==="right")x=bounds.right-node.width;if(mode==="top")y=bounds.top;if(mode==="middle")y=(bounds.top+bounds.bottom-node.height)/2;if(mode==="bottom")y=bounds.bottom-node.height;positions.set(node.id,{x:Math.round(x),y:Math.round(y)})});setNodes(items=>items.map(node=>chosen.has(node.id)?{...node,...positions.get(node.id)}:node));notify(mode==="grid"?"Selection tidied":mode==="horizontal"||mode==="vertical"?"Shapes distributed":"Shapes aligned")};
  const arrangeTree=(targets=selectedNodes)=>{const candidates=targets.filter(node=>node.kind!=="frame");if(candidates.length<2){notify("Select at least two connected shapes");return}if(candidates.some(node=>node.locked)){notify("Unlock shapes before auto-layout");return}const chosen=new Set(candidates.map(node=>node.id)),incoming=new Set(edges.filter(edge=>chosen.has(edge.from)&&chosen.has(edge.to)).map(edge=>edge.to)),children=new Map(candidates.map(node=>[node.id,edges.filter(edge=>edge.from===node.id&&chosen.has(edge.to)).map(edge=>edge.to)])),roots=candidates.filter(node=>!incoming.has(node.id)).sort((a,b)=>a.y-b.y),positions=new Map(),visited=new Set(),left=Math.min(...candidates.map(node=>node.x)),top=Math.min(...candidates.map(node=>node.y));let cursorY=top;const place=(id,depth)=>{if(visited.has(id))return positions.get(id)?.centerY??cursorY;visited.add(id);const node=candidates.find(item=>item.id===id),size=nodeSize(node),kids=(children.get(id)||[]).filter(child=>!visited.has(child));let centerY;if(kids.length){const centers=kids.map(child=>place(child,depth+1));centerY=(centers[0]+centers.at(-1))/2}else{centerY=cursorY+size.height/2;cursorY+=Math.max(132,size.height+44)}positions.set(id,{x:Math.round(left+depth*320),y:Math.round(centerY-size.height/2),centerY});return centerY};(roots.length?roots:[candidates[0]]).forEach(root=>{place(root.id,0);cursorY+=44});candidates.filter(node=>!visited.has(node.id)).forEach(node=>{place(node.id,0);cursorY+=44});checkpoint();setNodes(items=>items.map(node=>positions.has(node.id)?{...node,x:positions.get(node.id).x,y:positions.get(node.id).y}:node));notify("Smart tree layout applied")};
  const frameSelected=()=>{if(selectedNodes.length<2)return;checkpoint();const bounds=selectedNodes.reduce((area,node)=>{const size=nodeSize(node);return{left:Math.min(area.left,node.x),top:Math.min(area.top,node.y),right:Math.max(area.right,node.x+size.width),bottom:Math.max(area.bottom,node.y+size.height)}},{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity}),id=nextNode.current++,frame={id,x:bounds.left-46,y:bounds.top-72,w:bounds.right-bounds.left+92,h:bounds.bottom-bounds.top+118,title:"New section",note:`${selectedNodes.length} items`,color:"violet",shape:"round",kind:"frame"},chosen=new Set(selectedIds);setNodes(items=>[frame,...items.map(node=>chosen.has(node.id)?{...node,frameId:id}:node)]);setSelectedId(id);setSelectedIds([id]);notify("Selection framed")};
  const selectNode=(id,additive=false)=>{stageRef.current?.focus({preventScroll:true});if(activeTool!=="link"){additive=additive||touchMultiSelect;const target=nodes.find(node=>node.id===id),unit=target?.groupId?nodes.filter(node=>node.groupId===target.groupId).map(node=>node.id):[id];if(additive){const allSelected=unit.every(item=>selectedIds.includes(item));const next=allSelected?selectedIds.filter(item=>!unit.includes(item)):[...new Set([...selectedIds,...unit])];setSelectedIds(next);setSelectedId(next.at(-1)||null)}else if(!(selectedIds.length>1&&selectedIds.includes(id))){setSelectedIds(unit);setSelectedId(id)}setSelectedEdge(null);return}const target=nodes.find(node=>node.id===id);if(!target)return;if(!connectionSource){setConnectionSource({id});setSelectedId(null);setSelectedIds([]);setSelectedEdge(null);notify("Now select a target shape");return}if(connectionSource.id===id){setConnectionSource(null);notify("Connection cancelled");return}const source=nodes.find(node=>node.id===connectionSource.id);if(!source)return;const duplicateEdge=edges.some(edge=>(edge.from===source.id&&edge.to===target.id)||(edge.from===target.id&&edge.to===source.id));if(duplicateEdge){notify("These shapes are already connected");return}checkpoint();const edgeId=nextEdge.current++,side=connectionSource.side||inferConnectionSide(source,target);setEdges(items=>[...items,{id:edgeId,from:source.id,to:target.id,side,structure:globalSettings.structure,pattern:globalSettings.pattern,weight:globalSettings.weight}]);setConnectionSource(null);setSelectedId(null);setSelectedIds([]);setSelectedEdge(edgeId);notify("Connection created")};
  const branchAction=(source,side)=>{if(activeTool==="link"){setConnectionSource({id:source.id,side});setSelectedId(null);setSelectedIds([]);setSelectedEdge(null);notify(`Connect from ${side} · select a target`);return}addBranch(source,side)};
  const chooseTool=tool=>{if(window.matchMedia("(pointer:coarse)").matches)setTouchMultiSelect(current=>tool==="cursor"?!current:false);setActiveTool(tool);setConnectionSource(null);if(tool==="link"){if(selected){setConnectionSource({id:selected.id});setSelectedId(null);setSelectedIds([]);notify("Source selected · choose a target shape")}else notify("Select a source shape, then a target")}};

  const startDrag=(e,node)=>{if(touchMultiSelect)return;if(e.target.closest?.('[contenteditable="true"]'))return;if(locked||activeTool==="hand"||activeTool==="link")return;e.stopPropagation();if(e.shiftKey||e.metaKey||e.ctrlKey)return;const groupIds=node.groupId?nodes.filter(item=>item.groupId===node.groupId).map(item=>item.id):node.kind==="frame"?[node.id,...nodes.filter(item=>item.frameId===node.id).map(item=>item.id)]:[node.id],draggingIds=selectedIds.includes(node.id)?[...new Set([...selectedIds,...groupIds])]:groupIds;const drag=createNodeDrag(nodes,edges,draggingIds);if(drag.locked){notify("Unlock the selection to move it");return}if(!selectedIds.includes(node.id)){setSelectedId(node.id);setSelectedIds(draggingIds)}setSelectedEdge(null);gesture.current={...drag,type:draggingIds.length>1?"nodeMulti":"node",id:node.id,sx:e.clientX,sy:e.clientY,x:node.x,y:node.y};e.currentTarget.setPointerCapture?.(e.pointerId)};
  const applyNodeDrag=(g,dx,dy)=>{g.dx=dx;g.dy=dy;setNodes(items=>moveDraggedNodes(items,g,dx,dy));if(g.edgeOrigins.size)setEdges(items=>moveDraggedEdges(items,g,dx,dy))};
  const moveGroup=e=>{const g=gesture.current;if(!g||g.type!=="nodeMulti")return;if(!g.historySaved){checkpoint();g.historySaved=true}applyNodeDrag(g,(e.clientX-g.sx)/transform.scale,(e.clientY-g.sy)/transform.scale)};
  const moveMarquee=e=>{const g=gesture.current;if(!g||g.type!=="marquee")return;const left=Math.min(g.x,e.clientX-g.rect.left),top=Math.min(g.y,e.clientY-g.rect.top),right=Math.max(g.x,e.clientX-g.rect.left),bottom=Math.max(g.y,e.clientY-g.rect.top);setSelectionBox({left,top,width:right-left,height:bottom-top});const worldLeft=(left-transform.x)/transform.scale,worldTop=(top-transform.y)/transform.scale,worldRight=(right-transform.x)/transform.scale,worldBottom=(bottom-transform.y)/transform.scale;const directHits=nodes.filter(node=>{const size=nodeSize(node);return node.x<worldRight&&node.x+size.width>worldLeft&&node.y<worldBottom&&node.y+size.height>worldTop}),groups=new Set(directHits.map(node=>node.groupId).filter(Boolean)),hits=nodes.filter(node=>directHits.includes(node)||groups.has(node.groupId)).map(node=>node.id);const next=[...new Set([...g.baseIds,...hits])];setSelectedIds(next);setSelectedId(next.at(-1)||null)};
  const startEdgeRoute=(e,edge,mode="free")=>{if(locked)return;e.stopPropagation();setSelectedEdge(edge.id);setSelectedId(null);setSelectedIds([]);gesture.current={type:"edgeRoute",id:edge.id,mode,sx:e.clientX,sy:e.clientY,controlX:edge.routeX,controlY:edge.routeY,structure:edge.structure};e.currentTarget.setPointerCapture?.(e.pointerId)};
  const startResize=(e,node,handle)=>{if(locked||node.locked)return;e.stopPropagation();const size=nodeSize(node);gesture.current={type:"resize",id:node.id,handle,sx:e.clientX,sy:e.clientY,x:node.x,y:node.y,w:size.width,h:size.height};e.currentTarget.setPointerCapture?.(e.pointerId)};
  const startRotate=(e,node)=>{if(locked||node.locked)return;e.stopPropagation();const size=nodeSize(node);const rect=stageRef.current.getBoundingClientRect();const cx=rect.left+transform.x+(node.x+size.width/2)*transform.scale,cy=rect.top+transform.y+(node.y+size.height/2)*transform.scale;gesture.current={type:"rotate",id:node.id,cx,cy,start:Math.atan2(e.clientY-cy,e.clientX-cx),angle:node.rotate||0};e.currentTarget.setPointerCapture?.(e.pointerId)};
  useEffect(()=>{
    const update=()=>setPanReady(panKeys.current.space||panKeys.current.meta);
    const keyDown=event=>{
      if(tourOpen||presenting||event.isComposing||document.activeElement?.closest('input,textarea,select,[contenteditable="true"],button,a,[role="button"]'))return;
      if(event.code==="Space"||event.key===" "){event.preventDefault();panKeys.current.space=true;update()}
      if(event.key==="Meta"){panKeys.current.meta=true;update()}
    };
    const keyUp=event=>{
      if(event.code==="Space"||event.key===" ")panKeys.current.space=false;
      if(event.key==="Meta"||!event.metaKey)panKeys.current.meta=false;
      update();
    };
    const reset=()=>{
      touchPointers.current.clear();
      if(gesture.current?.type==="pinch")gesture.current=null;
      panKeys.current={space:false,meta:false};setPanReady(false);setIsPanning(false);
      if(gesture.current?.type==="pan"){
        const pointerId=gesture.current.pointerId;gesture.current=null;
        if(pointerId!==undefined&&stageRef.current?.hasPointerCapture(pointerId))stageRef.current.releasePointerCapture(pointerId);
      }
    };
    const visibility=()=>{if(document.hidden)reset()};
    window.addEventListener("keydown",keyDown);
    window.addEventListener("keyup",keyUp);
    window.addEventListener("blur",reset);
    document.addEventListener("visibilitychange",visibility);
    return()=>{window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);window.removeEventListener("blur",reset);document.removeEventListener("visibilitychange",visibility)};
  },[presenting,tourOpen]);
  const capturePan=event=>{
    const target=event.target;
    const onCanvas=target===event.currentTarget||target.closest?.(`.${styles.world}`);
    if(!onCanvas||target.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="toolbar"]')){suppressPanClick.current=false;return;}
    if(event.pointerType==="touch"){
      const pointers=touchPointers.current;
      if(!pointers.size)suppressPanClick.current=false;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size>=2){
        event.preventDefault();event.stopPropagation();
        finishGesture();setSelectionBox(null);suppressPanClick.current=true;
        gesture.current=beginPinch([...pointers.values()].slice(0,2),transformRef.current,event.currentTarget.getBoundingClientRect());
        setIsPanning(true);
        for(const id of pointers.keys())event.currentTarget.setPointerCapture(id);
        return;
      }
      const empty=target===event.currentTarget||target.classList.contains(styles.world);
      if(empty||activeTool==="hand"||presenting){
        event.stopPropagation();
        gesture.current={...beginTouchPan(event.pointerId,{x:event.clientX,y:event.clientY},transformRef.current),clearSelection:empty};
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      return;
    }
    suppressPanClick.current=false;
    if(event.button!==0||gesture.current||presenting)return;
    if(!(panKeys.current.space||event.metaKey||activeTool==="hand"))return;
    event.preventDefault();event.stopPropagation();suppressPanClick.current=true;
    gesture.current={type:"pan",pointerId:event.pointerId,sx:event.clientX,sy:event.clientY,x:transform.x,y:transform.y};
    setIsPanning(true);event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove=event=>{
    if(event.pointerType==="touch"){
      if(!touchPointers.current.has(event.pointerId))return;
      touchPointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
      const current=gesture.current;
      if(current?.type==="pinch"){
        const next=updatePinch(current,[...touchPointers.current.values()].slice(0,2));
        transformRef.current=next;setTransform(next);return;
      }
      if(current?.pointerId!==undefined&&current.pointerId!==event.pointerId)return;
      // Finger jitter must not move a shape, create history, or turn a tap into a pan.
      if(current&&Math.hypot(event.clientX-current.sx,event.clientY-current.sy)<6&&!current.moved)return;
      if(current){current.moved=true;suppressPanClick.current=true;if(current.type==="pan")setIsPanning(true)}
    }
    const type=gesture.current?.type;
    if(type==="nodeMulti")moveGroup(event);else if(type==="marquee")moveMarquee(event);else move(event);
  };
  const pointerEnd=event=>{
    if(event.pointerType==="touch"){
      if(!touchPointers.current.delete(event.pointerId))return;
      const current=gesture.current,pointers=touchPointers.current;
      if(event.type==="pointercancel")pointers.clear();
      if(current?.type==="pinch"&&pointers.size){
        if(pointers.size>=2)gesture.current=beginPinch([...pointers.values()].slice(0,2),transformRef.current,stageRef.current.getBoundingClientRect());
        else {const [id,point]=[...pointers][0];gesture.current={...beginTouchPan(id,point,transformRef.current),moved:true};}
        return;
      }
      if(current?.touch&&!current.moved&&current.clearSelection&&event.type!=="pointercancel"){
        setSelectedId(null);setSelectedIds([]);setSelectedEdge(null);setConnectionSource(null);
      }
    }
    finishGesture();setSelectionBox(null);
  };
  const suppressPanActivation=event=>{if(suppressPanClick.current&&event.detail>0&&(event.target===event.currentTarget||event.target.closest?.(`.${styles.world}`))){event.preventDefault();event.stopPropagation()}};
  const stageDown=e=>{if(e.target!==e.currentTarget&&!e.target.classList.contains(styles.world))return;stageRef.current?.focus({preventScroll:true});if(presenting){gesture.current={type:"pan",sx:e.clientX,sy:e.clientY,x:transform.x,y:transform.y};e.currentTarget.setPointerCapture?.(e.pointerId);return}const additive=e.shiftKey||e.metaKey||e.ctrlKey,baseIds=additive?selectedIds:[];if(!additive){setSelectedId(null);setSelectedIds([])}setSelectedEdge(null);if(activeTool==="link"){setConnectionSource(null);return}if(activeTool==="cursor"){const rect=e.currentTarget.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;gesture.current={type:"marquee",x,y,rect,baseIds};setSelectionBox({left:x,top:y,width:0,height:0});e.currentTarget.setPointerCapture?.(e.pointerId);return}if(locked)return;gesture.current={type:"pan",sx:e.clientX,sy:e.clientY,x:transform.x,y:transform.y};e.currentTarget.setPointerCapture?.(e.pointerId)};
  const move=e=>{const g=gesture.current;if(!g||g.type==="pinch")return;if(g.type==="pan"){setTransform(t=>({...t,x:g.x+e.clientX-g.sx,y:g.y+e.clientY-g.sy}));return}if(!g.historySaved){checkpoint();g.historySaved=true}if(g.type==="rotate"){const angle=g.angle+(Math.atan2(e.clientY-g.cy,e.clientX-g.cx)-g.start)*180/Math.PI;setNodes(items=>items.map(n=>n.id===g.id?{...n,rotate:Math.round(angle)}:n));return}const dx=(e.clientX-g.sx)/transform.scale,dy=(e.clientY-g.sy)/transform.scale;if(g.type==="edgeRoute"){let controlX=g.controlX+(g.mode==="y"?0:dx),controlY=g.controlY+(g.mode==="x"?0:dy);const data=edgeData.find(edge=>edge?.id===g.id);if(!data)return;let guideX=null,guideY=null,bestX=17,bestY=17;for(const other of edgeData){if(!other||other.id===g.id)continue;if(g.mode!=="y")for(const candidate of [other.start.x,other.routeX,other.end.x]){const delta=candidate-controlX;if(Math.abs(delta)<Math.abs(bestX)){bestX=delta;guideX=candidate}}if(g.mode!=="x")for(const candidate of [other.start.y,other.routeY,other.end.y]){const delta=candidate-controlY;if(Math.abs(delta)<Math.abs(bestY)){bestY=delta;guideY=candidate}}}if(guideX!==null)controlX+=bestX;if(guideY!==null)controlY+=bestY;const vx=data.end.x-data.start.x,vy=data.end.y-data.start.y,length=Math.hypot(vx,vy)||1;const distance=Math.abs(vy*controlX-vx*controlY+data.end.x*data.start.y-data.end.y*data.start.x)/length;const snapsStraight=g.mode==="free"&&guideX===null&&guideY===null&&distance<12;setEdges(items=>items.map(edge=>edge.id===g.id?{...edge,structure:snapsStraight?"straight":g.structure==="straight"?"curve":g.structure,controlX:snapsStraight?undefined:controlX,controlY:snapsStraight?undefined:controlY}:edge));setSnapGuides(snapsStraight?{x:null,y:"line"}:{x:guideX,y:guideY});return}if(g.type==="node"){const moving=nodes.find(n=>n.id===g.id);if(!moving)return;const size=nodeSize(moving);let x=g.x+dx,y=g.y+dy;let guideX=null,guideY=null,bestX=18,bestY=18;for(const other of nodes){if(g.origins.has(other.id)||!visibleNodeIds.has(other.id))continue;const otherSize=nodeSize(other);const movingX=[x,x+size.width/2,x+size.width],otherX=[other.x,other.x+otherSize.width/2,other.x+otherSize.width];const movingY=[y,y+size.height/2,y+size.height],otherY=[other.y,other.y+otherSize.height/2,other.y+otherSize.height];for(const mx of movingX)for(const ox of otherX){const delta=ox-mx;if(Math.abs(delta)<Math.abs(bestX)){bestX=delta;guideX=ox}}for(const my of movingY)for(const oy of otherY){const delta=oy-my;if(Math.abs(delta)<Math.abs(bestY)){bestY=delta;guideY=oy}}}if(guideX!==null)x+=bestX;if(guideY!==null)y+=bestY;setSnapGuides({x:guideX,y:guideY});applyNodeDrag(g,x-g.x,y-g.y);return}const west=g.handle.includes("w"),east=g.handle.includes("e"),north=g.handle.includes("n"),south=g.handle.includes("s");setNodes(items=>items.map(n=>n.id===g.id?{...n,x:west?g.x+dx:g.x,y:north?g.y+dy:g.y,w:Math.max(130,g.w+(east?dx:west?-dx:0)),h:Math.max(64,g.h+(south?dy:north?-dy:0))}:n))};
  const finishGesture=()=>{setIsPanning(false);const completed=gesture.current;if(completed?.type==="node"&&completed.historySaved)applyNodeDrag(completed,Math.round(completed.x+completed.dx)-completed.x,Math.round(completed.y+completed.dy)-completed.y);if(completed?.type==="resize")setNodes(items=>items.map(node=>node.id===completed.id?{...node,x:Math.round(node.x),y:Math.round(node.y),w:node.w?Math.round(node.w):node.w,h:node.h?Math.round(node.h):node.h}:node));gesture.current=null;setSnapGuides({x:null,y:null})};
  const wheel=e=>{e.preventDefault();const rect=stageRef.current.getBoundingClientRect();const px=e.clientX-rect.left,py=e.clientY-rect.top;const factor=e.deltaY<0?1.08:.92;setTransform(t=>{const scale=snapScale(t.scale*factor);const wx=(px-t.x)/t.scale,wy=(py-t.y)/t.scale;return{x:Math.round(px-wx*scale),y:Math.round(py-wy*scale),scale}})};

  const edgeData=useMemo(()=>boardEdgeData(nodes,edges,globalSettings,visibleNodeIds),[nodes,edges,globalSettings,visibleNodeIds]);

  const prepareExport=useCallback(async options=>{
    await document.fonts.ready;
    const items=selectExportNodes(visibleNodes,selectedIds,options.scope);
    const elements=new Map([...stageRef.current.querySelectorAll("[data-export-node]")].map(element=>[element.dataset.exportNode,element]));
    return createBoardSvg(items,edgeData,options.background,elements);
  },[visibleNodes,selectedIds,edgeData]);
  const exportVisual=async(options,prepared)=>{
    if(options.format==="nova"){exportBoard();return}
    await exportVisualFile(prepared,options,project.title);
    notify(`${options.format.toUpperCase()} exported`);
  };

  useEffect(()=>{
    const stage=stageRef.current;
    if(!stage)return;
    let previous=null;
    const resize=()=>{
      const rect=stage.getBoundingClientRect();
      setView({width:rect.width,height:rect.height});
      const keyboard=document.documentElement.dataset.keyboard==="true";
      if(previous&&(Math.abs(previous.width-rect.width)>1||(!keyboard&&!previous.keyboard&&Math.abs(previous.height-rect.height)>1))){
        setTransform(current=>({...current,x:current.x+(rect.width-previous.width)/2,y:current.y+(!keyboard&&!previous.keyboard?(rect.height-previous.height)/2:0)}));
        touchPointers.current.clear();gesture.current=null;setIsPanning(false);
      }
      previous={width:rect.width,height:rect.height,keyboard};
    };
    resize();const observer=new ResizeObserver(resize);observer.observe(stage);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(mobileFitted.current)return;
    mobileFitted.current=true;
    if(window.matchMedia("(max-width: 760px), (max-height: 500px) and (pointer: coarse)").matches)fitItems(visibleNodes);
  },[fitItems,visibleNodes]);
  useEffect(()=>{if(focusRootId===null)return;const animation=requestAnimationFrame(()=>fitItems(visibleNodes));return()=>cancelAnimationFrame(animation)},[fitItems,focusRootId,visibleNodes]);
  useEffect(()=>{if(!presenting)return;const frame=presentationFrames[presentationIndex];const animation=requestAnimationFrame(()=>frame?fitItems([frame],1.3):fit());return()=>cancelAnimationFrame(animation)},[fit,fitItems,presentationFrames,presentationIndex,presenting]);
  useEffect(()=>{if(restoredBoard.current?.nodes===nodes&&restoredBoard.current?.automationRules===automationRules)return;const activeRules=automationRules.filter(rule=>rule.enabled);if(!activeRules.length)return;setNodes(items=>{let changed=false;const next=items.map(original=>{if(original.kind==="frame")return original;let node=original;activeRules.forEach(rule=>{const matches=rule.whenField==="overdue"?isOverdue(node):rule.whenField==="tag"?(node.tags||[]).some(tag=>tag.toLowerCase()===rule.whenValue.trim().replace(/^#/,"").toLowerCase()):(node[rule.whenField]||"none")===rule.whenValue;if(!matches)return;const value=rule.actionField==="starred"?rule.actionValue==="true":rule.actionValue;if(node[rule.actionField]!==value){node={...node,[rule.actionField]:value};changed=true}});return node});return changed?next:items})},[automationRules,nodes]);
  useEffect(()=>{if(!activeTimer)return;setTimerNow(Date.now());const timer=window.setInterval(()=>setTimerNow(Date.now()),1000);return()=>window.clearInterval(timer)},[activeTimer]);
  useEffect(()=>{if(activeTimer&&!nodes.some(node=>node.id===activeTimer.nodeId))setActiveTimer(null)},[activeTimer,nodes]);
  useEffect(()=>{if(restoredBoard.current?.nodes===nodes)return;const completed=nodes.filter(node=>node.kind!=="frame"&&node.status==="done"&&node.recurrence&&node.dueDate&&node.recurrenceGeneratedFor!==node.dueDate&&!recurrenceGuard.current.has(`${node.id}:${node.dueDate}`));if(!completed.length)return;const generated=completed.map(node=>{recurrenceGuard.current.add(`${node.id}:${node.dueDate}`);return{...node,id:nextNode.current++,x:node.x+26,y:node.y+118,status:"todo",dueDate:nextRecurringDate(node.dueDate,node.recurrence.frequency,node.recurrence.interval),recurrenceGeneratedFor:undefined,comments:[],timeSpent:0,starred:false}}),sourceKeys=new Set(completed.map(node=>`${node.id}:${node.dueDate}`));setNodes(items=>[...items.map(node=>sourceKeys.has(`${node.id}:${node.dueDate}`)?{...node,recurrenceGeneratedFor:node.dueDate}:node),...generated]);notify(`${generated.length} recurring ${generated.length===1?"occurrence":"occurrences"} created`)},[nodes,notify]);
  useEffect(()=>{saveRevision.current=saveTracker.markDirty("board");savePending.current=true;saveTimer.current=window.setTimeout(flushSave,350);return()=>window.clearTimeout(saveTimer.current)},[nodes,edges,globalSettings,savedViews,automationRules,customFields,teamMembers,goals,sprints,activeTimer,transform,flushSave,saveTracker]);
  useEffect(()=>{
    const saveWhenHidden=()=>{if(document.visibilityState==="hidden")flushSave()};
    window.addEventListener("pagehide",flushSave);
    document.addEventListener("visibilitychange",saveWhenHidden);
    return()=>{window.removeEventListener("pagehide",flushSave);document.removeEventListener("visibilitychange",saveWhenHidden);flushSave()};
  },[flushSave]);
  useEffect(()=>{
    const keyboard=e=>{
      if(tourOpen||e.defaultPrevented||e.isComposing||shareProject||document.activeElement?.closest('dialog[open],[aria-modal="true"]'))return;
      const active=document.activeElement,isEditing=active?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]');
      if(shortcutsOpen){if(e.key==="Escape"){e.preventDefault();setShortcutsOpen(false);stageRef.current?.focus({preventScroll:true})}return}
      const modalOpen=outlineOpen||commentsOpen||viewsOpen||historyOpen||taskBoardOpen||outlineImportOpen||findReplaceOpen||insightsOpen||libraryOpen||agendaOpen||resourcesOpen||focusLensOpen||dependencyOpen||exportStudioOpen||storyOpen||tableOpen||automationOpen||fieldsOpen||exchangeOpen||calendarOpen||progressOpen||workloadOpen||focusSessionsOpen||recurringOpen||decisionsOpen||prioritizationOpen||goalsOpen||sprintsOpen||risksOpen;
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"&&!presenting&&(!modalOpen||outlineOpen)){
        e.preventDefault();e.stopImmediatePropagation();
        if(e.shiftKey){setOutlineOpen(false);setSearchOpen(true)}else showSearchFilter();
        return;
      }
      if(modalOpen){
        e.stopImmediatePropagation();
        if(e.key==="Escape"){
          setOutlineOpen(false);setCommentsOpen(false);setViewsOpen(false);setHistoryOpen(false);setTaskBoardOpen(false);setOutlineImportOpen(false);setFindReplaceOpen(false);setInsightsOpen(false);setLibraryOpen(false);setAgendaOpen(false);setResourcesOpen(false);setFocusLensOpen(false);setDependencyOpen(false);setExportStudioOpen(false);setStoryOpen(false);setTableOpen(false);setAutomationOpen(false);setFieldsOpen(false);setExchangeOpen(false);setCalendarOpen(false);setProgressOpen(false);setWorkloadOpen(false);setFocusSessionsOpen(false);setRecurringOpen(false);setDecisionsOpen(false);setPrioritizationOpen(false);setGoalsOpen(false);setSprintsOpen(false);setRisksOpen(false);
          e.preventDefault();stageRef.current?.focus({preventScroll:true});
        }
        return;
      }
      if(searchOpen||shareProject||active?.closest('dialog[open],[aria-modal="true"]')||isEditing)return;
      if(e.key==="?"&&!e.metaKey&&!e.ctrlKey){e.preventDefault();e.stopImmediatePropagation();setShortcutsOpen(true);return}
      const onCanvas=active===stageRef.current||active===document.body;
      if(onCanvas&&!presenting&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)&&!e.metaKey&&!e.ctrlKey){
        e.preventDefault();e.stopImmediatePropagation();
        if(e.altKey){const step=e.shiftKey?160:60;setTransform(value=>({...value,x:value.x+(e.key==="ArrowLeft"?step:e.key==="ArrowRight"?-step:0),y:value.y+(e.key==="ArrowUp"?step:e.key==="ArrowDown"?-step:0)}))}
        else navigateByArrow(e.key,e.shiftKey);
        return;
      }
      if(onCanvas&&!presenting&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&["Home","End","[","]"].includes(e.key)){
        e.preventDefault();e.stopImmediatePropagation();
        if(e.key==="Home"||e.key==="End")selectKeyboardNode(e.key==="Home"?visibleNodes[0]:visibleNodes.at(-1),e.shiftKey);
        else navigateConnection(e.key==="]"?1:-1);
        return;
      }
      if(presenting){
        if(e.key==="Escape"){e.preventDefault();setPresenting(false)}
        else if(onCanvas&&(e.key==="ArrowRight"||e.key==="ArrowDown"||e.key===" ")){e.preventDefault();setPresentationIndex(index=>Math.min(Math.max(0,presentationFrames.length-1),index+1))}
        else if(onCanvas&&(e.key==="ArrowLeft"||e.key==="ArrowUp")){e.preventDefault();setPresentationIndex(index=>Math.max(0,index-1))}
        return;
      }
      const modifier=e.metaKey||e.ctrlKey,key=e.key.toLowerCase();
      if(modifier&&key==="z"){e.preventDefault();if(e.shiftKey)redo();else undo();return}
      if(modifier&&key==="y"){e.preventDefault();redo();return}
      if(modifier&&key==="0"){e.preventDefault();fit();return}
      if(e.key==="Escape"){
        if(branchStyleSection){setBranchStyleSection(null);stageRef.current?.focus({preventScroll:true});return}
        if(focusRootId!==null){setFocusRootId(null);return}
        setSelectedId(null);setSelectedIds([]);setSelectedEdge(null);setEditingId(null);setConnectionSource(null);
        stageRef.current?.focus({preventScroll:true});return;
      }
      if(!onCanvas)return;
      if(modifier&&key==="a"){e.preventDefault();const ids=visibleNodes.map(node=>node.id);setSelectedIds(ids);setSelectedId(ids.at(-1)??null);setSelectedEdge(null);return}
      if(modifier&&key==="c"){if(selectedIds.length){e.preventDefault();copySelection()}return}
      if(modifier&&key==="x"){if(selectedIds.length){e.preventDefault();if(nodes.some(node=>selectedIds.includes(node.id)&&node.locked)){notify("Unlock the selection to cut it");return}if(copySelection())removeSelected()}return}
      if(modifier&&key==="v"){e.preventDefault();pasteSelection();return}
      if(e.key==="Backspace"||e.key==="Delete"){e.preventDefault();removeSelected();return}
      if(e.key==="Enter"&&selectedId!==null&&selectedIds.length===1){
        e.preventDefault();if(modifier&&selected)addBranch(selected,"right");else editNode(selectedId);
      }
    };
    window.addEventListener("keydown",keyboard);return()=>window.removeEventListener("keydown",keyboard)
  },[agendaOpen,automationOpen,calendarOpen,commentsOpen,decisionsOpen,dependencyOpen,exchangeOpen,exportStudioOpen,fieldsOpen,findReplaceOpen,focusLensOpen,focusSessionsOpen,goalsOpen,historyOpen,insightsOpen,libraryOpen,outlineImportOpen,outlineOpen,presenting,prioritizationOpen,progressOpen,recurringOpen,resourcesOpen,risksOpen,searchOpen,shortcutsOpen,sprintsOpen,storyOpen,tableOpen,taskBoardOpen,viewsOpen,workloadOpen,navigateByArrow,navigateConnection,selectKeyboardNode,visibleNodes,tourOpen,showSearchFilter,shareProject,removeSelected,selectedId,selectedIds,selected,addBranch,fit,undo,redo,editNode,copySelection,pasteSelection,nodes,notify,presentationFrames.length,focusRootId,branchStyleSection]);

  const openTour=()=>{
    setSelectedId(null);setSelectedIds([]);setSelectedEdge(null);setEditingId(null);
    setBranchStyleSection(null);setSearchOpen(false);setActiveTool("cursor");setConnectionSource(null);
    panKeys.current={space:false,meta:false};setPanReady(false);setIsPanning(false);
    setTourOpen(true);
  };
  const dismissTour=status=>{boardTourPreference.dismiss(status);setTourOpen(false)};

  const paletteActions=[
    {key:"board-tour",label:"Take board tour",detail:"A quick guide to creating, connecting, and organizing ideas",keywords:"help tutorial onboarding getting started",run:openTour},
    {key:"new-shape",label:"Create shape",detail:"Add a new shape at the center",keywords:"add node",run:()=>addNode("box")},
    {key:"new-frame",label:"Create frame",detail:"Add a section for organizing ideas",keywords:"add section",run:addFrame},
    {key:"select-all",label:"Select all",detail:`Select all ${visibleNodes.length} visible items`,shortcut:"⌘A",run:()=>{const ids=visibleNodes.map(node=>node.id);setSelectedIds(ids);setSelectedId(ids.at(-1)||null);setSelectedEdge(null)}},
    {key:"paste",label:"Paste shapes",detail:"Paste from Nova's local clipboard",shortcut:"⌘V",run:pasteSelection},
    {key:"fit",label:"Fit board to view",detail:"Center every item in the viewport",shortcut:"⌘0",keywords:"zoom center",run:fit},
    {key:"undo",label:"Undo",detail:"Reverse the latest board change",shortcut:"⌘Z",run:undo},
    {key:"redo",label:"Redo",detail:"Restore the last undone change",shortcut:"⇧⌘Z",run:redo},
    {key:"outline",label:"Search & filter board",detail:"Find shapes, filter items, and manage visibility",keywords:"outline layers structure search filters",run:()=>{setOutlineOpen(true);setCommentsOpen(false);setViewsOpen(false)}},
    {key:"comments",label:"Open comments",detail:"Review local feedback attached to shapes",keywords:"notes discussion feedback",run:()=>openComments()},
    {key:"views",label:"Open saved views",detail:`Open ${savedViews.length} saved views of this board`,keywords:"snapshot bookmark content restore navigation",run:()=>setViewsOpen(true)},
    {key:"workflow",label:"Open status board",detail:"Manage shapes as a visual workflow",keywords:"kanban tasks progress",run:openTaskBoard},
    {key:"import-outline",label:"Import text outline",detail:"Create a connected mind map from indented text",keywords:"bulk paste generate",run:()=>setOutlineImportOpen(true)},
    {key:"auto-layout",label:"Auto-layout visible map",detail:"Arrange connected shapes as a balanced hierarchy",keywords:"tree organize tidy",run:()=>arrangeTree(visibleNodes)},
    {key:"find-replace",label:"Find and replace",detail:"Update matching text across the entire board",keywords:"rename bulk edit",run:openFindReplace},
    {key:"insights",label:"Open board insights",detail:"Review structure, progress, and items needing attention",keywords:"analytics health stats orphan duplicate",run:openInsights},
    {key:"library",label:"Open shape library",detail:selectedIds.length?`Save ${selectedIds.length} selected items or insert a component`:"Insert reusable local components",keywords:"symbols components reuse",run:openLibrary},
    {key:"shortcuts",label:"Keyboard shortcuts",detail:"View navigation and editing shortcuts",shortcut:"?",keywords:"help keys",run:()=>setShortcutsOpen(true)},
    {key:"markdown",label:"Export as Markdown",detail:"Download the board hierarchy as structured text",keywords:"md text outline",run:exportMarkdown},
    {key:"agenda",label:"Open agenda",detail:"Review overdue, today, and upcoming shapes",keywords:"due date priority planner tasks",run:openAgenda},
    {key:"resources",label:"Open Resource Hub",detail:"Search every link attached to this board",keywords:"links urls bookmarks attachments sources",run:openResources},
    {key:"focus-lens",label:"Open Focus Lens",detail:"Filter shapes by status, priority, tags, and properties",keywords:"query filter starred overdue linked",run:openFocusLens},
    {key:"dependencies",label:"Open Dependency Center",detail:"Classify connections and review active blockers",keywords:"relationships blocks depends supports graph",run:openDependencyCenter},
    {key:"export-studio",label:"Open Export Studio",detail:"Download images, SVG, PDF, or a Nova backup",keywords:"image visual download vector png svg pdf backup",run:openExportStudio},
    {key:"storyline",label:"Open Storyline Builder",detail:"Order frames and prepare presenter notes",keywords:"presentation sequence slides speaker notes",run:openStoryline},
    {key:"data-table",label:"Open Data Table",detail:"Edit and bulk-update board metadata in rows",keywords:"spreadsheet grid database bulk sort",run:openDataTable},
    {key:"automations",label:"Open Automations",detail:"Create local rules that maintain board metadata",keywords:"workflow rules trigger action automatic",run:openAutomations},
    {key:"custom-fields",label:"Open Custom Fields",detail:"Define reusable structured properties for every shape",keywords:"schema properties text number date choice checkbox",run:openCustomFields},
    {key:"data-exchange",label:"Open CSV Data Exchange",detail:"Import or export board data for spreadsheets",keywords:"csv spreadsheet transfer backup merge",run:openDataExchange},
    {key:"calendar",label:"Open Calendar",detail:"Schedule shapes and drag work between dates",keywords:"month due dates planner schedule",run:openCalendar},
    {key:"progress",label:"Open Progress Rollups",detail:"Review completion and risk across connected branches",keywords:"dashboard hierarchy descendants overdue blocked percent",run:openProgress},
    {key:"workload",label:"Open Team & Workload",detail:"Assign shapes and balance active local work",keywords:"owners assignees members capacity responsibility",run:openWorkload},
    {key:"focus-sessions",label:"Open Focus Sessions",detail:"Track concentrated time against board shapes",keywords:"timer pomodoro time tracking productivity",run:openFocusSessions},
    {key:"recurring-work",label:"Open Recurring Work",detail:"Repeat scheduled shapes after completion",keywords:"repeat daily weekly monthly schedule routine",run:openRecurringWork},
    {key:"decision-log",label:"Open Decision Log",detail:"Record decisions, rationale, and items to revisit",keywords:"adr outcome proposal rationale history",run:openDecisionLog},
    {key:"prioritization",label:"Open Prioritization Lab",detail:"Rank opportunities by impact, confidence, and effort",keywords:"score rice ice ranking quick wins roadmap",run:openPrioritization},
    {key:"goals",label:"Open Goals Hub",detail:"Connect board work to measurable outcomes",keywords:"okr objectives key results outcomes strategy progress",run:openGoals},
    {key:"sprints",label:"Open Sprint Planner",detail:"Plan capacity, estimates, and delivery velocity",keywords:"agile iteration backlog story points commitment",run:openSprints},
    {key:"risks",label:"Open Risk Register",detail:"Score exposure and document mitigation plans",keywords:"risk likelihood impact matrix mitigation contingency",run:openRisks},
    {key:"present",label:"Present board",detail:presentationFrames.length?`Walk through ${presentationFrames.length} frames`:"Open a clean board view",keywords:"presentation focus fullscreen",run:enterPresentation},
    {key:"export",label:"Export project",detail:"Download a portable local .nova file",keywords:"backup download",run:exportBoard},
    ...(selectedId!==null?[{key:"focus-branch",label:"Focus on selected branch",detail:"Temporarily isolate this idea and its descendants",keywords:"spotlight isolate",run:()=>enterBranchFocus(selectedId)}]:[]),
    ...(selectedId!==null&&edges.some(edge=>edge.from===selectedId)?[{key:"collapse-branch",label:selected?.collapsed?"Expand selected branch":"Collapse selected branch",detail:"Temporarily hide or reveal descendant shapes",keywords:"fold children",run:()=>toggleBranch(selectedId)}]:[]),
    ...(selectedIds.length>1&&!selectedGrouped?[{key:"group",label:"Group selection",detail:`Keep ${selectedIds.length} selected shapes together`,keywords:"combine",run:groupSelected}]:[]),
    ...(selectedGrouped?[{key:"ungroup",label:"Ungroup selection",detail:"Separate the selected group",run:ungroupSelected}]:[]),
  ];

  return <div onKeyDown={navigateToolbar} className={`${styles.app} ${presenting?styles.presenting:""}`}>
    {deleteConfirmation}
    <MotionPresence present={Boolean(tourOpen)} kind="fade"><BoardTour onDismiss={dismissTour}/></MotionPresence>
    <Header selectingMultiple={touchMultiSelect} onSelectMultiple={()=>{setTouchMultiSelect(value=>!value);setActiveTool("cursor")}} title={project.title} onRename={renameBoard} saveStatus={saveStatus} onRetrySave={retrySave} backTo={backTo} outlineOpen={outlineOpen} onExport={openExportStudio} onShare={openShare} onHistory={openVersionHistory} onOutline={openOutline} onComments={()=>openComments()} onViews={openViews} onPresent={enterPresentation} onUndo={undo} onRedo={redo} canUndo={historyRef.current.undo.length>0} canRedo={historyRef.current.redo.length>0}/>
    {!selected&&!activeEdge&&<Toolbar active={activeTool} onActive={chooseTool} onAdd={kind=>kind==="frame"?addFrame():addNode(kind)}/>}
    <main tabIndex={0} role="application" aria-label="Board canvas" aria-describedby="board-keyboard-help board-keyboard-selection" ref={stageRef} className={`${styles.stage} ${activeTool==="hand"||panReady?styles.handMode:""} ${isPanning?styles.panning:""}`} style={{backgroundPosition:`${transform.x}px ${transform.y}px`,backgroundSize:`${24*transform.scale}px ${24*transform.scale}px`}} onPointerDownCapture={capturePan} onClickCapture={suppressPanActivation} onDoubleClickCapture={suppressPanActivation} onLostPointerCapture={event=>{if(gesture.current?.type==="pan"&&gesture.current.pointerId===event.pointerId){touchPointers.current.delete(event.pointerId);finishGesture()}}} onPointerDown={stageDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onWheel={wheel} onDoubleClick={e=>{if(!presenting&&(e.target===e.currentTarget||e.target.classList.contains(styles.world))){const rect=e.currentTarget.getBoundingClientRect();addNode("box",{x:(e.clientX-rect.left-transform.x)/transform.scale-SIZE.width/2,y:(e.clientY-rect.top-transform.y)/transform.scale-SIZE.height/2})}}}>
      <p id="board-keyboard-help" className={styles.keyboardOnly}>Use arrow keys to select shapes, Shift and arrows to extend selection, Enter to edit, and Delete to remove. Tab moves to controls. Use left and right brackets to select connections. Press question mark for all shortcuts.</p>
      <p id="board-keyboard-selection" className={styles.keyboardOnly} role="status" aria-live="polite" aria-atomic="true">{selectedEdge!==null?`Connection: ${nodes.find(node=>node.id===activeEdge?.from)?.title||"Untitled"} to ${nodes.find(node=>node.id===activeEdge?.to)?.title||"Untitled"}`:selected?`${selected.kind==="frame"?"Frame":"Shape"}: ${selected.title||"Untitled"}${selectedIds.length>1?`, ${selectedIds.length} items selected`:" selected"}`:"No item selected"}</p>
      <div className={styles.world} style={{width:WORLD.width,height:WORLD.height,transform:`translate3d(${Math.round(transform.x)}px,${Math.round(transform.y)}px,0) scale(${transform.scale})`}}>
        <svg className={styles.edges} width={WORLD.width} height={WORLD.height}>{edgeData.map(edge=>edge&&<g key={edge.id} className={`${edge.id===selectedEdge?styles.selectedEdge:""} ${styles[`${edge.pattern}Edge`]||""} ${styles[`${edge.weight}Edge`]||""}`} onClick={e=>{e.stopPropagation();stageRef.current?.focus({preventScroll:true});setSelectedEdge(edge.id);setSelectedId(null);setSelectedIds([])}}><path className={styles.edgeHit} d={edge.path}/><path className={styles.edgeLine} d={edge.path}/>{edge.label&&<g className={styles.edgeLabel} transform={`translate(${edge.control.x},${edge.control.y})`}><rect x={-Math.min(90,Math.max(20,edge.label.length*2.85+8))} y="-11" width={Math.min(180,Math.max(40,edge.label.length*5.7+16))} height="22" rx="7"/><text textAnchor="middle" dominantBaseline="central">{edge.label.length>28?`${edge.label.slice(0,27)}…`:edge.label}</text></g>}{edge.id===selectedEdge&&<>{edge.handles.map((handle,index)=><g key={`${handle.mode}-${index}`}>{handle.mode==="free"?<><circle className={styles.routeHandleHalo} cx={handle.x} cy={handle.y} r="14"/><circle className={styles.routeHandle} cx={handle.x} cy={handle.y} r="6" onPointerDown={e=>startEdgeRoute(e,edge,handle.mode)}/></>:<><rect className={styles.segmentHandleHalo} x={handle.x-(handle.mode==="x"?8:14)} y={handle.y-(handle.mode==="x"?14:8)} width={handle.mode==="x"?16:28} height={handle.mode==="x"?28:16} rx="8"/><rect className={`${styles.segmentHandle} ${handle.mode==="x"?styles.routeHandleX:styles.routeHandleY}`} x={handle.x-(handle.mode==="x"?4:9)} y={handle.y-(handle.mode==="x"?9:4)} width={handle.mode==="x"?8:18} height={handle.mode==="x"?18:8} rx="4" onPointerDown={e=>startEdgeRoute(e,edge,handle.mode)}/></>}</g>)}<circle className={styles.endpointHandle} cx={edge.start.x} cy={edge.start.y} r="6"/><circle className={styles.endpointHandle} cx={edge.end.x} cy={edge.end.y} r="6"/></>}</g>)}</svg>
        {typeof snapGuides.x==="number"&&<div className={styles.guideVertical} style={{left:snapGuides.x}}/>}
        {typeof snapGuides.y==="number"&&<div className={styles.guideHorizontal} style={{top:snapGuides.y}}/>}
        {visibleNodes.map(node=><Node key={node.id} node={node} childCount={edges.filter(edge=>edge.from===node.id).length} blockedBy={edges.filter(edge=>edge.to===node.id&&edge.relation==="blocks"&&nodes.find(source=>source.id===edge.from)?.status!=="done").length} progress={branchMetrics.get(node.id)} assignee={teamMembers.find(member=>member.id===node.assigneeId)} selected={selectedIds.includes(node.id)} transformable={selectedIds.length===1&&node.id===selectedId} connecting={node.id===connectionSource?.id} editing={node.id===editingId} onSelect={selectNode} onDrag={startDrag} onEdit={editNode} onRichChange={updateRichText} onBranch={branchAction} onResize={startResize} onRotate={startRotate} onToggleCollapse={toggleBranch}/>) }
      </div>
      <BranchStylePanel settings={styleSettings} section={branchStyleSection} onSection={setBranchStyleSection} onChange={updateBranchStyle} scopeLabel={styleScopeLabel} canStyleShapes={!styleDisabledReason&&styleScope.nodeIds.size>0} canStyleLines={!styleDisabledReason&&(styleScope.nodeIds.size>0||styleScope.edgeIds.size>0)} disabledReason={styleDisabledReason}/>
      {selected&&editingId===null&&<SelectionBar onEdit={()=>editNode(selected.id)} onAddChild={()=>addBranch(selected,"right")} onDone={()=>{setSelectedId(null);setSelectedIds([]);setSelectedEdge(null);setTouchMultiSelect(false)}} node={selected} selectionCount={selectedIds.length} grouped={selectedGrouped} locked={selectedNodes.some(node=>node.locked)} allLocked={selectedLocked} onColor={color=>{checkpoint();const chosen=new Set(selectedIds);setNodes(items=>items.map(node=>chosen.has(node.id)?{...node,color}:node))}} onDuplicate={duplicate} onDelete={removeSelected} onGroup={groupSelected} onUngroup={ungroupSelected} onFrame={frameSelected} onLock={toggleSelectedLock} onArrange={mode=>mode==="tree"?arrangeTree():arrangeSelection(mode)} onComments={()=>openComments()} onFocus={()=>enterBranchFocus(selected.id)} onShape={shape=>{checkpoint();const chosen=new Set(selectedIds);setNodes(items=>items.map(node=>chosen.has(node.id)?{...node,shape}:node))}}/>}
      {activeEdge&&<div className={styles.edgeBar}><select className={styles.edgeRelation} value={activeEdge.relation||"related"} onChange={event=>updateEdgeSetting("relation",event.target.value)} aria-label="Relationship type">{relationTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><input key={`${activeEdge.id}-${activeEdge.label}`} className={styles.edgeLabelInput} defaultValue={activeEdge.label||""} placeholder="Add label" aria-label="Connection label" onBlur={event=>updateEdgeLabel(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur()}}/><span>Line</span><div className={styles.lineToggle}>{[["curve","Curve"],["straight","Straight"],["elbow","Elbow"]].map(([value,label])=><button key={value} className={(activeEdge.structure||globalSettings.structure)===value?styles.activeLineStyle:""} onClick={()=>updateEdgeSetting("structure",value)}>{label}</button>)}</div><span>Line style</span><div className={styles.lineToggle}>{[["solid","Solid"],["dashed","Dash"],["dotted","Dot"]].map(([value,label])=><button key={value} className={(activeEdge.pattern||globalSettings.pattern)===value?styles.activeLineStyle:""} onClick={()=>updateEdgeSetting("pattern",value)}>{label}</button>)}</div><button className={styles.edgeDelete} onClick={removeSelected} aria-label="Delete connection" title="Delete connection"><Icon name="trash" size={16}/></button></div>}
      {touchMultiSelect&&<div className={styles.touchSelectionHint}><span>Tap shapes to select</span><button onClick={()=>setTouchMultiSelect(false)}>Done</button></div>}
      <MiniMap nodes={visibleNodes} transform={transform} view={view} onFit={fit} onNavigate={navigateMiniMap}/>
      <div data-keyboard-toolbar data-tour="navigation" className={styles.zoom}><button onClick={()=>setTransform(t=>({...t,scale:snapScale(t.scale-.1)}))} aria-label="Zoom out" title="Zoom out">−</button><button onClick={fit} aria-label="Fit map" title="Fit entire board to view">{Math.round(transform.scale*100)}%</button><button onClick={()=>setTransform(t=>({...t,scale:snapScale(t.scale+.1)}))} aria-label="Zoom in" title="Zoom in">+</button><span/><button className={locked?styles.locked:""} aria-pressed={locked} onClick={()=>setLocked(v=>!v)} aria-label={locked?"Unlock canvas":"Lock canvas"} title={locked?"Unlock canvas editing":"Lock canvas editing"}><CanvasControlIcon name={locked?"locked":"unlocked"}/></button><button onClick={fit} aria-label="Center and fit board" title="Center and fit board in view"><CanvasControlIcon name="fit"/></button><span/><button data-tour="replay" className={styles.tourButton} onClick={openTour} aria-label="Take board tour" title="Take a quick tour of the board">Tour</button></div>
      {selectionBox&&<div className={styles.selectionMarquee} style={selectionBox}/>}
      {snapGuides.y==="line"&&<div className={styles.magnetHint}>↯ Snapped to straight</div>}
      {(typeof snapGuides.x==="number"||typeof snapGuides.y==="number")&&<div className={styles.magnetHint}>↯ Magnetic alignment</div>}
      <MotionPresence present={Boolean(toast)} kind="fade"><div className={styles.toast} role="status">{toast}</div></MotionPresence>
      {focusRoot&&<div className={styles.focusBar}><Icon name="focus" size={15}/><span><small>FOCUSED BRANCH</small><b>{focusRoot.title}</b></span><em>{visibleNodes.length} items</em><button onClick={()=>setFocusRootId(null)}>Show all</button></div>}
      {presenting&&<><div className={styles.presentationBar}><button onClick={()=>setPresentationIndex(index=>Math.max(0,index-1))} disabled={!presentationIndex} aria-label="Previous frame">←</button><span><b>{presentationFrames[presentationIndex]?.title||project.title}</b><small>{presentationFrames.length?`${presentationIndex+1} of ${presentationFrames.length}`:"Board view"}</small></span><button onClick={()=>setPresentationIndex(index=>Math.min(Math.max(0,presentationFrames.length-1),index+1))} disabled={!presentationFrames.length||presentationIndex>=presentationFrames.length-1} aria-label="Next frame">→</button><i/>{presentationFrames[presentationIndex]?.presenterNote&&<button className={showPresenterNotes?styles.notesActive:""} onClick={()=>setShowPresenterNotes(value=>!value)}>Notes</button>}<button className={styles.exitPresentation} onClick={()=>setPresenting(false)}>Exit</button></div>{showPresenterNotes&&presentationFrames[presentationIndex]?.presenterNote&&<aside className={styles.presenterNotes}><small>PRIVATE PRESENTER NOTE</small><p>{presentationFrames[presentationIndex].presenterNote}</p></aside>}</>}
      {activeTimer&&activeFocusNode&&!presenting&&<div className={styles.focusTimerPill}><button onClick={openFocusSessions}><i/><span><small>FOCUSING</small><b>{activeFocusNode.title}</b></span><strong>{formatDuration((activeFocusNode.timeSpent||0)+Math.floor((timerNow-activeTimer.startedAt)/1000))}</strong></button><button onClick={stopFocusTimer} aria-label="Stop focus timer">■</button></div>}
    </main>
    <MotionPresence present={Boolean(searchOpen)} kind="overlay" focusSelector="input"><SearchPalette nodes={nodes} actions={paletteActions} onChoose={focusNode} onClose={()=>setSearchOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(outlineOpen)} kind="drawer" focusSelector="input"><OutlinePanel nodes={nodes} selectedIds={selectedIds} onChoose={focusNode} onVisibility={toggleNodeVisibility} onLock={toggleNodeLock} onCommands={()=>{setOutlineOpen(false);setSearchOpen(true)}} onClose={()=>setOutlineOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(commentsOpen)} kind="drawer"><CommentsPanel nodes={nodes} edges={edges} targetId={selectedId} selectedEdge={selectedEdge} onAdd={addComment} onResolve={resolveComment} onDelete={deleteComment} onChoose={focusNode} onClose={()=>setCommentsOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(viewsOpen)} kind="drawer"><ViewsPanel views={savedViews} onSave={saveCurrentView} onOpen={openSavedView} onDelete={deleteSavedView} onClose={()=>setViewsOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(taskBoardOpen)} kind="overlay"><TaskBoard nodes={nodes} onMove={moveTask} onChoose={focusNode} onClose={()=>setTaskBoardOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(outlineImportOpen)} kind="overlay"><OutlineImport onImport={importOutline} onClose={()=>setOutlineImportOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(findReplaceOpen)} kind="overlay"><FindReplace nodes={nodes} onReplace={replaceBoardText} onChoose={focusNode} onClose={()=>setFindReplaceOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(insightsOpen)} kind="overlay"><InsightsPanel nodes={nodes} edges={edges} onChoose={focusNode} onClose={()=>setInsightsOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(libraryOpen)} kind="overlay"><ShapeLibrary items={libraryItems} selectedCount={selectedIds.length} loading={libraryLoading} onSave={saveSelectionToLibrary} onInsert={insertLibraryItem} onDelete={removeLibraryItem} onClose={()=>setLibraryOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(shortcutsOpen)} kind="overlay"><ShortcutsPanel onClose={()=>setShortcutsOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(agendaOpen)} kind="overlay"><AgendaPanel nodes={nodes} onChoose={focusNode} onComplete={completeAgendaItem} onClose={()=>setAgendaOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(resourcesOpen)} kind="overlay"><ResourceHub nodes={nodes} onChoose={focusNode} onDelete={deleteNodeLink} onClose={()=>setResourcesOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(focusLensOpen)} kind="overlay"><FocusLens nodes={nodes} onChoose={focusNode} onSelectMany={selectLensResults} onStar={toggleStar} onClose={()=>setFocusLensOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(dependencyOpen)} kind="overlay"><DependencyCenter nodes={nodes} edges={edges} onChoose={focusNode} onChangeType={changeRelationshipType} onClose={()=>setDependencyOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(shareProject)} kind="panel"><ShareBoard project={shareProject} onBackup={exportBoard} onClose={()=>setShareProject(null)}/></MotionPresence>
    <MotionPresence present={Boolean(exportStudioOpen)} kind="panel"><ExportStudio selectedCount={selectExportNodes(visibleNodes,selectedIds,"selection").length} onPrepare={prepareExport} onExport={exportVisual} onClose={()=>setExportStudioOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(storyOpen)} kind="overlay"><StorylineBuilder frames={storylineFrames} onMove={moveStoryFrame} onToggle={toggleStoryFrame} onNote={updatePresenterNote} onChoose={focusNode} onClose={()=>setStoryOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(tableOpen)} kind="overlay"><DataTable nodes={nodes} onChange={updateTableNode} onBulkChange={bulkUpdateTable} onChoose={focusNode} onClose={()=>setTableOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(automationOpen)} kind="overlay"><AutomationPanel rules={automationRules} onAdd={addAutomation} onChange={updateAutomation} onDelete={deleteAutomation} onClose={()=>setAutomationOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(fieldsOpen)} kind="overlay"><CustomFieldsPanel fields={customFields} nodes={nodes} onAdd={addCustomField} onUpdate={updateCustomField} onDelete={deleteCustomField} onSetValue={setCustomValue} onClose={()=>setFieldsOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(exchangeOpen)} kind="overlay"><DataExchange nodes={nodes} fields={customFields} onExport={exportCsv} onImport={importCsv} onClose={()=>setExchangeOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(calendarOpen)} kind="overlay"><CalendarView nodes={nodes} onSetDue={setCalendarDue} onChoose={focusNode} onClose={()=>setCalendarOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(progressOpen)} kind="overlay"><ProgressDashboard nodes={nodes} metrics={branchMetrics} onChoose={focusNode} onClose={()=>setProgressOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(workloadOpen)} kind="overlay"><WorkloadPanel members={teamMembers} nodes={nodes} onAddMember={addTeamMember} onDeleteMember={deleteTeamMember} onAssign={assignShape} onChoose={focusNode} onClose={()=>setWorkloadOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(focusSessionsOpen)} kind="overlay"><FocusSessions nodes={nodes} activeTimer={activeTimer} now={timerNow} onStart={startFocusTimer} onStop={stopFocusTimer} onReset={resetFocusTime} onChoose={focusNode} onClose={()=>setFocusSessionsOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(recurringOpen)} kind="overlay"><RecurringWork nodes={nodes} onSet={setRecurrence} onRemove={removeRecurrence} onChoose={focusNode} onClose={()=>setRecurringOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(decisionsOpen)} kind="overlay"><DecisionLog nodes={nodes} onSave={saveDecision} onDelete={deleteDecision} onChoose={focusNode} onClose={()=>setDecisionsOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(prioritizationOpen)} kind="overlay"><PrioritizationLab nodes={nodes} onScore={savePriorityScore} onClear={clearPriorityScore} onChoose={focusNode} onClose={()=>setPrioritizationOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(goalsOpen)} kind="overlay"><GoalsHub goals={goals} nodes={nodes} onAdd={addGoal} onDelete={deleteGoal} onToggleNode={toggleGoalNode} onChoose={focusNode} onClose={()=>setGoalsOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(sprintsOpen)} kind="overlay"><SprintPlanner sprints={sprints} nodes={nodes} onAdd={addSprint} onDelete={deleteSprint} onAssign={assignSprint} onEstimate={setEstimate} onChoose={focusNode} onClose={()=>setSprintsOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(risksOpen)} kind="overlay"><RiskRegister nodes={nodes} onSave={saveRisk} onClear={clearRisk} onChoose={focusNode} onClose={()=>setRisksOpen(false)}/></MotionPresence>
    <MotionPresence present={Boolean(historyOpen)} kind="overlay"><VersionHistory versions={versions} loading={versionsLoading} currentBoard={{nodes,edges,globalSettings,savedViews}} onRestore={restoreVersion} onDelete={deleteMilestone} onClose={()=>setHistoryOpen(false)}/></MotionPresence>
  </div>;
}
