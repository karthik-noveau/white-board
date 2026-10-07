import { SiteBrand, SiteHeaderFrame } from "./SiteHeader";
import { brand } from "../lib/brand";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Node } from "./Canvas";
import CommentsPanel from "./CommentsPanel";
import Icon from "./BoardIcon";
import { BlockWorkspaceContext } from "../lib/blockWorkspace";
import { versionPreviewData } from "../lib/versionPreview";
import { nodeSize } from "../lib/boardAppearance";
import { beginPinch, updatePinch } from "../lib/touchViewport";
import canvasStyles from "../styles/canvas.module.css";
import styles from "../styles/readOnlyBoard.module.css";

// This viewer never mounts the editor or writes to the local workspace.
// Collapsing branches, selection, and the camera are temporary viewing state.
export default function ReadOnlyBoard({ project }) {
  const viewportRef = useRef(null), pointers = useRef(new Map()), gesture = useRef(null), pendingFocus = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform); transformRef.current = transform;
  const [collapsed, setCollapsed] = useState(() => new Map());
  const [revealed, setRevealed] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null), [commentsOpen, setCommentsOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState(null);
  const graph = useMemo(() => versionPreviewData({ ...project.board, nodes: project.board.nodes.map(node =>
    ({ ...node, ...(collapsed.has(node.id) ? {collapsed:collapsed.get(node.id)} : {}), ...(revealed.has(node.id) ? {hidden:false} : {}) }),
  ) }), [project.board, collapsed, revealed]);

  const fit = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect(), bounds = graph.bounds;
    if (!rect || !bounds) return;
    const target = pendingFocus.current !== null && graph.nodes.find(node => node.id === pendingFocus.current);
    if (target) {
      pendingFocus.current = null;
      const size = nodeSize(target);
      setTransform(value => ({...value,x:rect.width/2-(target.x+size.width/2)*value.scale,y:rect.height/2-(target.y+size.height/2)*value.scale}));
      return;
    }
    const scale = Math.max(.01, Math.min((rect.width - 64) / bounds.width, (rect.height - 80) / bounds.height, 1.15));
    setTransform({ scale, x: (rect.width - bounds.width * scale) / 2 - bounds.x * scale, y: (rect.height - bounds.height * scale) / 2 - bounds.y * scale });
  }, [graph.bounds, graph.nodes]);
  useEffect(() => {
    fit();
    const observer = new ResizeObserver(fit); observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [fit]);
  const zoom = useCallback((factor, point) => {
    const rect = viewportRef.current.getBoundingClientRect();
    const x = point ? point.x - rect.left : rect.width / 2, y = point ? point.y - rect.top : rect.height / 2;
    setTransform(value => {
      const scale = Math.max(.01, Math.min(4, value.scale * factor));
      return { scale, x: x - (x - value.x) * scale / value.scale, y: y - (y - value.y) * scale / value.scale };
    });
  }, []);
  useEffect(() => {
    const viewport = viewportRef.current;
    const wheel = event => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      zoom(Math.exp(Math.max(-1, Math.min(1, -event.deltaY * unit * .002))), { x: event.clientX, y: event.clientY });
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [zoom]);

  const startGesture = (nodeId = null) => {
    const points = [...pointers.current.values()], value = transformRef.current;
    gesture.current = points.length > 1 ? beginPinch(points, value, viewportRef.current.getBoundingClientRect())
      : points.length ? { type: "pan", point: points[0], ...value, nodeId, moved: false } : null;
  };
  const pointerDown = event => {
    if (event.button !== 0 || event.target.closest("button,a")) return;
    event.currentTarget.focus({ preventScroll: true });
    const id = event.target.closest("[data-export-node]")?.getAttribute("data-export-node");
    const node = graph.nodes.find(item => String(item.id) === id);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId); startGesture(node?.id ?? null);
  };
  const pointerMove = event => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = gesture.current;
    if (active?.type === "pinch" && pointers.current.size > 1) setTransform(updatePinch(active, [...pointers.current.values()]));
    else if (active?.type === "pan") {
      const dx = event.clientX - active.point.x, dy = event.clientY - active.point.y;
      if (Math.hypot(dx, dy) > 4) active.moved = true;
      if (active.moved) setTransform({ scale: active.scale, x: active.x + dx, y: active.y + dy });
    }
  };
  const pointerEnd = event => {
    if (!pointers.current.has(event.pointerId)) return;
    const active = gesture.current;
    if (event.type === "pointerup" && active?.type === "pan" && !active.moved) setSelectedId(active.nodeId);
    pointers.current.delete(event.pointerId); startGesture();
  };
  const keyDown = event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest("button,a")) return;
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.2); }
    else if (event.key === "-") { event.preventDefault(); zoom(1 / 1.2); }
    else if (event.key === "0") { event.preventDefault(); fit(); }
    else if (event.key === "Escape") { setCommentsOpen(false); setSelectedId(null); }
    else if (event.key.startsWith("Arrow")) {
      event.preventDefault(); const step = event.shiftKey ? 140 : 50;
      setTransform(value => ({ ...value, x: value.x + (event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0), y: value.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0) }));
    }
  };
  const openShapeComments = id => { setSelectedId(id); setCommentsOpen(true); setCommentTarget({ id }); };
  const focusNode = node => {
    if (!node) return;
    setSelectedId(node.id);
    const rect = viewportRef.current.getBoundingClientRect(), size = nodeSize(node);
    const width = commentsOpen && rect.width > 760 ? rect.width - 384 : rect.width;
    setTransform(value => ({ ...value, x: width / 2 - (node.x + size.width / 2) * value.scale, y: rect.height / 2 - (node.y + size.height / 2) * value.scale }));
  };
  const navigateReference = id => {
    const node = project.board.nodes.find(item => String(item.id) === String(id));
    if (!node) return;
    if (graph.nodes.some(item => item.id === node.id)) { focusNode(node); return; }
    const ancestors = new Set([node.id]), queue = [node.id];
    while (queue.length) {
      const target = queue.shift();
      for (const edge of project.board.edges.filter(edge => edge.to === target)) {
        if (!ancestors.has(edge.from)) { ancestors.add(edge.from); queue.push(edge.from); }
      }
    }
    pendingFocus.current = node.id;
    setSelectedId(node.id);
    setCollapsed(current => { const next = new Map(current); for (const id of ancestors) next.set(id,false); return next; });
    setRevealed(current => new Set([...current,node.id,node.frameId]));
  };

  return <BlockWorkspaceContext.Provider value={{nodes:project.board.nodes,boardId:project.id,onNavigate:navigateReference}}><div className={`${canvasStyles.app} ${styles.app}`} data-readonly-board onKeyDown={event => {
    if (event.key === "Escape" && commentsOpen) { event.preventDefault(); setCommentsOpen(false); viewportRef.current?.focus({ preventScroll: true }); }
  }}>
    <SiteHeaderFrame className={styles.header} data-header-kind="editor">
      <SiteBrand to="/projects" className={styles.brand} label={`${brand.name} projects`}/>
      <div className={styles.title}><h1 title={project.title}>{project.title}</h1><p>Shared board</p></div>
      <span className={styles.access}><Icon name="eye" size={15}/>Read-only</span>
      <button aria-label="Comments" aria-expanded={commentsOpen} onClick={() => setCommentsOpen(value => !value)}><Icon name="comment" size={18}/><span>Comments</span></button>
    </SiteHeaderFrame>
    <main ref={viewportRef} className={styles.viewport} tabIndex={0} role="region" aria-label="Read-only board. Drag or use arrow keys to pan; plus and minus to zoom; zero to fit."
      onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}
      style={{ backgroundPosition: `${transform.x}px ${transform.y}px`, backgroundSize: `${24 * transform.scale}px ${24 * transform.scale}px` }}>
      {graph.nodes.length ? <div className={styles.world} style={{ transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})` }}>
        <svg className={styles.connections} aria-hidden="true">{graph.edges.map(edge => <g key={edge.id} className={`${canvasStyles[`${edge.pattern}Edge`] || ""} ${canvasStyles[`${edge.weight}Edge`] || ""}`}>
          <path className={canvasStyles.edgeLine} d={edge.path}/>
          {edge.label && <g className={canvasStyles.edgeLabel} transform={`translate(${edge.labelPoint.x},${edge.labelPoint.y})`}><rect x={-Math.min(90, Math.max(20, edge.label.length * 2.85 + 8))} y="-11" width={Math.min(180, Math.max(40, edge.label.length * 5.7 + 16))} height="22" rx="7"/><text textAnchor="middle" dominantBaseline="central">{edge.label.length > 28 ? `${edge.label.slice(0, 27)}…` : edge.label}</text></g>}
        </g>)}</svg>
        {graph.nodes.map(node => <Node key={node.id} node={node} readOnly selected={selectedId === node.id} onSelect={setSelectedId}
          childCount={project.board.edges.filter(edge => edge.from === node.id).length}
          onToggleCollapse={id => setCollapsed(current => new Map(current).set(id, !node.collapsed))}
          assignee={project.board.teamMembers?.find(member => member.id === node.assigneeId)}
          onComments={commentsOpen ? openShapeComments : undefined}/>)}
      </div> : <div className={styles.empty}><Icon name="frame" size={32}/><h2>{graph.totalCount ? "All items are hidden" : "This board is empty"}</h2><p>No visible shapes in this shared board.</p></div>}
    </main>
    <footer className={styles.controls}><p>Drag to pan · Scroll to zoom</p><div role="group" aria-label="Board zoom">
      <button disabled={!graph.nodes.length || transform.scale <= .01} onClick={() => zoom(1 / 1.2)} aria-label="Zoom out">−</button>
      <output aria-label="Zoom level">{Math.round(transform.scale * 100)}%</output>
      <button disabled={!graph.nodes.length || transform.scale >= 4} onClick={() => zoom(1.2)} aria-label="Zoom in">+</button><span/>
      <button disabled={!graph.nodes.length} onClick={fit} aria-label="Fit board"><Icon name="fit" size={16}/>Fit</button>
    </div></footer>
    {commentsOpen && <CommentsPanel readOnly nodes={graph.nodes} edges={project.board.edges} targetId={selectedId} focusTarget={commentTarget} onChoose={focusNode} onClose={() => setCommentsOpen(false)}/>}
  </div></BlockWorkspaceContext.Provider>;
}
