import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "./BoardIcon";
import { versionPreviewData } from "../lib/versionPreview";
import { beginPinch, updatePinch } from "../lib/touchViewport";
import { playTransition } from "../lib/motion";
import canvasStyles from "../styles/canvas.module.css";
import styles from "../styles/versionPreview.module.css";

export default function VersionPreview({ version, renderNode, onClose, onRestore }) {
  const dialogRef = useRef(null), viewportRef = useRef(null), closeRef = useRef(null);
  const pointers = useRef(new Map()), gesture = useRef(null), closing = useRef(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const currentTransform = useRef(transform); currentTransform.current = transform;
  const titleId = useId(), descriptionId = useId();
  const graph = useMemo(() => versionPreviewData(version.board), [version.board]);
  const timestamp = new Date(version.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  useLayoutEffect(() => {
    const dialog = dialogRef.current, previous = document.activeElement;
    dialog.showModal(); closeRef.current?.focus({ preventScroll: true });
    const entrance = playTransition(dialog);
    return () => { entrance.cancel(); dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    playTransition(dialogRef.current, { entering: false }).finished.then(onClose);
  };
  const fit = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect(), bounds = graph.bounds;
    if (!rect || !bounds) return;
    const scale = Math.max(.01, Math.min((rect.width - 32) / bounds.width, (rect.height - 32) / bounds.height, 1.2));
    setTransform({ scale, x: (rect.width - bounds.width * scale) / 2 - bounds.x * scale, y: (rect.height - bounds.height * scale) / 2 - bounds.y * scale });
  }, [graph.bounds]);
  useEffect(() => {
    fit(); const observer = new ResizeObserver(fit); observer.observe(viewportRef.current);
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
    const wheel = event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, { x: event.clientX, y: event.clientY }); };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [zoom]);

  const startGesture = () => {
    const points = [...pointers.current.values()], value = currentTransform.current;
    gesture.current = points.length > 1 ? beginPinch(points, value, viewportRef.current.getBoundingClientRect()) : points.length ? { type: "pan", point: points[0], ...value } : null;
  };
  const pointerDown = event => {
    if (event.button !== 0) return;
    event.currentTarget.focus({ preventScroll: true });
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId); startGesture();
  };
  const pointerMove = event => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = gesture.current;
    if (active?.type === "pinch" && pointers.current.size > 1) setTransform(updatePinch(active, [...pointers.current.values()]));
    else if (active?.type === "pan") setTransform({ scale: active.scale, x: active.x + event.clientX - active.point.x, y: active.y + event.clientY - active.point.y });
  };
  const pointerEnd = event => { pointers.current.delete(event.pointerId); startGesture(); };
  const keyDown = event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.2); }
    if (event.key === "-") { event.preventDefault(); zoom(1 / 1.2); }
    if (event.key === "0") { event.preventDefault(); fit(); }
    if (event.key.startsWith("Arrow")) {
      event.preventDefault(); const step = event.shiftKey ? 140 : 50;
      setTransform(value => ({ ...value, x: value.x + (event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0), y: value.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0) }));
    }
  };

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}
    onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); }}>
    <header className={styles.header}>
      <div><h2 id={titleId}>Version preview</h2><p>{version.label ? `${version.label} · ${timestamp}` : timestamp}</p></div>
      <span className={styles.badge}><Icon name="eye" size={16}/>Read only</span>
      <button ref={closeRef} className={styles.close} onClick={close} aria-label="Close version preview"><Icon name="close" size={20}/></button>
    </header>
    <div ref={viewportRef} className={styles.viewport} tabIndex={0} role="region" aria-label="Saved board preview. Drag or use arrow keys to pan; plus and minus to zoom; zero to fit."
      onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}
      style={{ backgroundPosition: `${transform.x}px ${transform.y}px`, backgroundSize: `${24 * transform.scale}px ${24 * transform.scale}px` }}>
      {graph.nodes.length ? <div className={styles.world} inert aria-hidden="true" style={{ transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})` }}>
        <svg className={styles.connections}>{graph.edges.map(edge => <g key={edge.id} className={`${canvasStyles[`${edge.pattern}Edge`] || ""} ${canvasStyles[`${edge.weight}Edge`] || ""}`}>
          <path className={canvasStyles.edgeLine} d={edge.path}/>
          {edge.label && <g className={canvasStyles.edgeLabel} transform={`translate(${edge.control.x},${edge.control.y})`}><rect x={-Math.min(90, Math.max(20, edge.label.length * 2.85 + 8))} y="-11" width={Math.min(180, Math.max(40, edge.label.length * 5.7 + 16))} height="22" rx="7"/><text textAnchor="middle" dominantBaseline="central">{edge.label.length > 28 ? `${edge.label.slice(0, 27)}…` : edge.label}</text></g>}
        </g>)}</svg>
        {graph.nodes.map(renderNode)}
      </div> : <div className={styles.empty}><Icon name="frame" size={30}/><b>{graph.totalCount ? "All items are hidden" : "This version is empty"}</b><p>No visible shapes in this saved version.</p></div>}
      <div className={canvasStyles.keyboardOnly}>{graph.nodes.map(node => <p key={node.id}>{node.title}. {node.note}</p>)}</div>
    </div>
    <div className={styles.controls}>
      <p>{graph.totalCount} items · {graph.edges.length} visible connections</p>
      <div role="group" aria-label="Preview zoom"><button disabled={!graph.nodes.length || transform.scale <= .01} onClick={() => zoom(1 / 1.2)} aria-label="Zoom preview out">−</button><output aria-label="Preview zoom level">{Math.round(transform.scale * 100)}%</output><button disabled={!graph.nodes.length || transform.scale >= 4} onClick={() => zoom(1.2)} aria-label="Zoom preview in">+</button><span/><button disabled={!graph.nodes.length} onClick={fit}>Fit</button></div>
    </div>
    <footer className={styles.footer}><p id={descriptionId}>Your current board stays unchanged until you restore.</p><div><button className={styles.secondary} onClick={close}>Back to history</button><button className={styles.primary} onClick={() => onRestore(version)}>Restore this version</button></div></footer>
  </dialog>;
}
