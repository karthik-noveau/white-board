import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BoardPreview from './BoardPreview';
import Icon from './BoardIcon';
import styles from '../styles/boardPreviewDialog.module.css';

const boundedPan = (pan, zoom) => ({ x: Math.max(-500 * (zoom - 1), Math.min(500 * (zoom - 1), pan.x)), y: Math.max(-250 * (zoom - 1), Math.min(250 * (zoom - 1), pan.y)) });
export default function BoardPreviewDialog({ board, title, onClose }) {
  const ref = useRef(null), drag = useRef(null), titleId = useId();
  const [view, setView] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const changeZoom = delta => setView(current => {
    const zoom = Math.max(1, Math.min(4, current.zoom + delta));
    return { zoom, pan: boundedPan(current.pan, zoom) };
  });
  const fit = () => setView({ zoom: 1, pan: { x: 0, y: 0 } });
  useLayoutEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    dialog.showModal(); dialog.querySelector('[data-preview-canvas]')?.focus();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={ref} className={styles.dialog} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.target.tagName === 'BUTTON') return;
      if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
      if (['+', '='].includes(event.key)) changeZoom(.25);
      if (event.key === '-') changeZoom(-.25);
      if (event.key === '0') fit();
      if (event.key.startsWith('Arrow')) setView(current => ({ ...current, pan: boundedPan({ x: current.pan.x + (event.key === 'ArrowLeft' ? 60 : event.key === 'ArrowRight' ? -60 : 0), y: current.pan.y + (event.key === 'ArrowUp' ? 60 : event.key === 'ArrowDown' ? -60 : 0) }, current.zoom) }));
    }}>
    <header><div><h2 id={titleId}>{title}</h2><p>Drag to pan · Use + and − to zoom</p></div><button onClick={onClose} aria-label="Close enlarged preview"><Icon name="close" size={20}/></button></header>
    <div className={styles.canvas} data-preview-canvas tabIndex={0} role="region" aria-label="Board preview. Use arrow keys to pan, plus and minus to zoom, and zero to fit."
      onPointerDown={event => {
        if (event.button !== 0 || drag.current) return;
        event.preventDefault(); event.currentTarget.focus();
        const rect = event.currentTarget.getBoundingClientRect();
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: view.pan, factor: Math.max(1000 / rect.width, 500 / rect.height) };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        setView(current => ({ ...current, pan: boundedPan({ x: start.pan.x + (event.clientX - start.x) * start.factor, y: start.pan.y + (event.clientY - start.y) * start.factor }, current.zoom) }));
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <BoardPreview board={board} title={title} detailed accessible zoom={view.zoom} pan={view.pan}/>
    </div>
    <footer><span>Preview only</span><div role="group" aria-label="Preview zoom"><button disabled={view.zoom <= 1} onClick={() => changeZoom(-.25)} aria-label="Zoom preview out">−</button><output aria-live="polite">{Math.round(view.zoom * 100)}%</output><button disabled={view.zoom >= 4} onClick={() => changeZoom(.25)} aria-label="Zoom preview in">+</button><button onClick={fit}><Icon name="fit" size={17}/>Fit</button></div></footer>
  </dialog>, document.body);
}
