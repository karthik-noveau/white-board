import { useId, useMemo, useRef } from "react";
import { nodeSize } from "../lib/boardAppearance";
import { screenElements } from "../lib/canvasStudio";
import { studioScreenSvg } from "../lib/studioSvg";
import styles from "../styles/canvasStudio.module.css";

export default function StudioScreen({ screen, selectedElementId, onSelectElement, onMoveElement, onActivate, showHotspots = false, playing = false }) {
  const prefix = useId();
  const host = useRef(null), drag = useRef(null), suppressClick = useRef(false);
  const size = nodeSize(screen);
  const markup = useMemo(() => ({ __html: studioScreenSvg(screen,prefix) }), [screen,prefix]);
  const start = (event, item) => {
    if (!onMoveElement || event.button !== 0) return;
    event.stopPropagation();
    onSelectElement?.(item.id);
    drag.current = { id: item.id, x: item.x, y: item.y, clientX: event.clientX, clientY: event.clientY, scale: host.current.getBoundingClientRect().width / size.width, moved: false };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event, item) => {
    const origin = drag.current;
    if (!origin || origin.id !== item.id) return;
    const dx = (event.clientX - origin.clientX) / origin.scale, dy = (event.clientY - origin.clientY) / origin.scale;
    if (Math.abs(dx) + Math.abs(dy) < 3 && !origin.moved) return;
    onMoveElement(item.id, { x: Math.round(Math.max(0, Math.min(size.width - item.w, origin.x + dx))), y: Math.round(Math.max(0, Math.min(size.height - item.h, origin.y + dy))) }, !origin.moved);
    origin.moved = true; suppressClick.current = true;
  };
  return <div ref={host} className={styles.screenContent} data-studio-screen={screen.id}>
    <svg viewBox={`0 0 ${size.width} ${size.height}`} width="100%" height="100%" role="img" aria-label={`${screen.title}: ${screenElements(screen).map(item => item.text).join(". ")}`} dangerouslySetInnerHTML={markup}/>
    {screenElements(screen).filter(item => playing ? item.action : Boolean(onSelectElement)).map(item => <button key={item.id} type="button" data-studio-element={item.id}
      className={`${styles.elementTarget} ${selectedElementId === item.id ? styles.elementSelected : ""} ${showHotspots && item.action ? styles.hotspotVisible : ""}`}
      style={{ left: `${item.x / size.width * 100}%`, top: `${item.y / size.height * 100}%`, width: `${item.w / size.width * 100}%`, height: `${item.h / size.height * 100}%` }}
      aria-label={playing ? item.text : `Edit ${item.role}: ${item.text}`} aria-pressed={playing ? undefined : selectedElementId === item.id}
      onPointerDown={event => { event.stopPropagation(); if (!playing) start(event, item); }} onPointerMove={event => move(event, item)} onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } if (playing) onActivate?.(item.action); else onSelectElement?.(item.id); }}/>) }
  </div>;
}
