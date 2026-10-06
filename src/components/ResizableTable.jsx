import { useRef, useState } from 'react';
import styles from '../styles/cellContent.module.css';

import { clampColumnWidth as clamp, fitColumnWidth } from '../lib/tableSizing';

export default function ResizableTable({ block, readonly, onWidths, header, children }) {
  const table = useRef(null), drag = useRef(null);
  const [draft, setDraft] = useState(null);
  const widths = draft || block.columnWidths || block.headers.map(() => 190);
  const measuredWidths = () => [...table.current.rows[0].cells].map(cell => cell.offsetWidth);
  const start = (event, column) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus({preventScroll:true});
    const values = measuredWidths();
    // Project pointer movement onto the table's own x axis, including rotated
    // cards and canvas zoom. Bounding-box ratios alone break on rotated cards.
    let matrix = new DOMMatrix();
    for (let element = table.current; element; element = element.parentElement) {
      const transform = getComputedStyle(element).transform;
      if (transform !== 'none') matrix = new DOMMatrix(transform).multiply(matrix);
    }
    drag.current = { column, values, x:event.clientX, y:event.clientY, axis:[matrix.a,matrix.b], next:values };
    setDraft(values); event.currentTarget.setPointerCapture(event.pointerId);
  };
  const finish = (event, cancel = false) => {
    if (!drag.current) return;
    event.stopPropagation();
    const { next, values } = drag.current; drag.current = null; setDraft(null);
    if (!cancel && next.some((width, index) => width !== values[index])) onWidths(next);
  };
  return <div data-cell-box className={styles.tableScroll}>
    <table ref={table} style={{ width: draft || block.columnWidths ? widths.reduce((a, b) => a + b, 0) : '100%', minWidth: widths.reduce((a, b) => a + b, 0) }}>
      <colgroup>{widths.map((width, index) => <col key={index} style={{ width }}/>)}</colgroup>
      <thead><tr>{block.headers.map((name, col) => <th data-cell-box data-table-cell data-table-id={block.id} data-column={col} key={col}>
        {header(name, col)}
        {!readonly && <span className={styles.columnResize} role="separator" tabIndex={0} aria-label={`Resize ${name || `column ${col + 1}`}`} aria-orientation="vertical" aria-valuemin={100} aria-valuemax={1200} aria-valuenow={Math.round(widths[col])}
          title="Drag to resize · Arrow keys adjust · Double-click to fit content"
          onPointerDown={event => start(event, col)}
          onPointerMove={event => {
            if (!drag.current) return;
            event.stopPropagation();
            const state = drag.current, next = [...state.values], [x,y] = state.axis;
            const delta = ((event.clientX-state.x)*x+(event.clientY-state.y)*y)/(x*x+y*y||1);
            next[state.column] = clamp(state.values[state.column]+delta); state.next = next; setDraft(next);
          }}
          onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event)}
          onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); const next = measuredWidths(); const context = document.createElement('canvas').getContext('2d'); context.font = getComputedStyle(table.current).font || '14px sans-serif'; next[col] = fitColumnWidth(block, col, text => context.measureText(text).width); onWidths(next); }}
          onKeyDown={event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const next = measuredWidths(); next[col] = event.key === 'Home' ? 100 : event.key === 'End' ? 1200 : clamp(next[col] + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 40 : 10)); onWidths(next); }}/>}
      </th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>;
}
