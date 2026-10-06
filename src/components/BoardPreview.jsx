import { useId } from 'react';
import { nodeSize, palettes, rootColors } from "../lib/boardAppearance";
import { boardEdgeData } from "../lib/boardGeometry";
import { contentText } from '../lib/cellContent';

const shorten = (value, limit) => { const text = String(value || ''); return text.length > limit ? `${text.slice(0, limit - 1)}…` : text; };
function PreviewContent({ node, width }) {
  let y = 58;
  const inner = width - 40;
  return node.content.map(block => {
    const top = y;
    if (block.type === 'table') {
      const rowHeight = 34, column = inner / block.headers.length;
      y += (block.rows.length + 1) * rowHeight + 16;
      return <g key={block.id} transform={`translate(20 ${top})`}>
        <rect width={inner} height={(block.rows.length + 1) * rowHeight} rx="6" fill="white" stroke="var(--nova-border)"/>
        <rect x="1" y="1" width={inner - 2} height={rowHeight - 1} rx="5" fill="var(--nova-surface-tint)"/>
        {block.headers.map((header, col) => <g key={col}>
          {col > 0 && <path d={`M${col * column} 0v${(block.rows.length + 1) * rowHeight}`} stroke="var(--nova-border)"/>}
          <text x={col * column + 10} y="22" fontSize="12" fontWeight="550" fill="var(--nova-text)">{shorten(header, Math.floor((column - 20) / 6.5))}</text>
        </g>)}
        {block.rows.map((row, index) => <g key={index}>
          <path d={`M0 ${(index + 1) * rowHeight}h${inner}`} stroke="var(--nova-border)"/>
          {row.map((slot, col) => <text key={slot.id} x={col * column + 10} y={(index + 1) * rowHeight + 22} fontSize="12" fill="var(--nova-muted)">{shorten(contentText(slot.content), Math.floor((column - 20) / 6.2))}</text>)}
        </g>)}
      </g>;
    }
    if (block.type === 'checklist') {
      y += block.tasks.length * 28 + 14;
      return <g key={block.id} transform={`translate(20 ${top})`}>{block.tasks.map((task, index) => <g key={index} transform={`translate(0 ${index * 28})`}>
        <rect x="0" y="3" width="13" height="13" rx="3" fill="white" stroke="var(--nova-muted)"/>
        <text x="23" y="15" fontSize="13" fill="var(--nova-text)">{shorten(task.text, Math.floor((inner - 28) / 6.8))}</text>
      </g>)}</g>;
    }
    const note = block.type === 'note';
    const rows = String(block.text || '').split('\n').filter(Boolean);
    if (!rows.length) return null;
    y += rows.length * 22 + (note ? 20 : 0) + 14;
    return <g key={block.id} transform={`translate(20 ${top})`}>
      {note && <rect width={inner} height={rows.length * 22 + 20} rx="6" fill="#fff8e7" stroke="#ead9ae"/>}
      {rows.map((row, index) => <text key={index} x={note ? 10 : 0} y={index * 22 + (note ? 25 : 15)} fontSize="13" fill="var(--nova-muted)">{shorten(row, Math.floor((inner - (note ? 20 : 0)) / 6.6))}</text>)}
    </g>;
  });
}

/** A single coordinate space keeps thumbnail nodes and connections aligned. */
export default function BoardPreview({ board, title = "Your idea", accent = "violet", detailed = false }) {
  const previewId = useId();
  const nodes = board?.nodes || [
    { id: 1, x: 0, y: 130, title, root: true, color: accent },
    { id: 2, x: 410, y: 0, title: "Explore", color: "pink" },
    { id: 3, x: 410, y: 140, title: "Connect", color: "green" },
    { id: 4, x: 410, y: 280, title: "Make it happen", color: "blue" },
  ];
  const edges = board?.edges || [{ id: 1, from: 1, to: 2 }, { id: 2, from: 1, to: 3 }, { id: 3, from: 1, to: 4 }];
  if (!nodes.length) return <svg viewBox="0 0 400 200" aria-hidden="true"><text x="200" y="104" textAnchor="middle" fill="var(--nova-muted)" fontSize="13">A little room to think</text></svg>;
  const bounds = nodes.reduce((area, node) => {
    const { width, height } = nodeSize(node);
    return { left: Math.min(area.left, node.x), top: Math.min(area.top, node.y), right: Math.max(area.right, node.x + width), bottom: Math.max(area.bottom, node.y + height) };
  }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
  const viewWidth = detailed ? 1000 : 400, viewHeight = detailed ? 500 : 200;
  const scale = Math.min((viewWidth - 40) / Math.max(1, width), (viewHeight - 40) / Math.max(1, height), detailed ? 1 : .7);
  const connections = boardEdgeData(nodes, edges, { structure: "elbow", pattern: "solid", weight: "regular", ...board?.globalSettings }).filter(Boolean);
  return <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} aria-hidden="true" focusable="false">
    <g transform={`translate(${(viewWidth - width * scale) / 2} ${(viewHeight - height * scale) / 2}) scale(${scale}) translate(${-bounds.left} ${-bounds.top})`}>
      {connections.map(edge => <path key={edge.id} d={edge.path} stroke="var(--nova-border-strong)" strokeWidth="2" strokeDasharray={edge.pattern === "dotted" ? "2 5" : edge.pattern === "dashed" ? "8 5" : undefined} fill="none"/>)}
      {nodes.map(node => {
        const { width: w, height: h } = nodeSize(node), colors = palettes[node.color] || palettes.white;
        const fill = node.root ? rootColors(node).fill : colors[0], text = node.root ? rootColors(node).text : "var(--nova-ink)";
        const round = ["circle", "ellipse", "pill"].includes(node.shape) ? Math.min(w, h) / 2 : node.shape === "rectangle" ? 3 : 14;
        const label = String(node.title || "Untitled");
        const limit = detailed ? 28 : 22;
        const shortLabel = label.length > limit ? `${label.slice(0, limit - 2)}…` : label;
        const fontSize = Math.min(20, (w - 24) / Math.max(1, shortLabel.length * .56));
        const note = String(node.note || "");
        if (node.content) {
          const clipId = `${previewId}-${node.id}`;
          return <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
            <rect width={w} height={h} rx="12" fill="white" stroke="var(--nova-border-strong)" strokeWidth="1.5"/>
            <text x="20" y="32" fill="var(--nova-ink)" fontSize="18" fontWeight="600">{shorten(label, Math.floor((w - 40) / 9.5))}</text>
            <defs><clipPath id={clipId}><rect x="12" y="44" width={w - 24} height={Math.max(0, h - 56)}/></clipPath></defs>
            <g clipPath={`url(#${clipId})`}><PreviewContent node={node} width={w}/></g>
          </g>;
        }
        return <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
          <rect width={w} height={h} rx={round} fill={fill} stroke={node.root ? fill : colors[1]} strokeWidth="1.5"/>
          <text x={w / 2} y={h / 2 + fontSize * .3 - (detailed && note ? 12 : 0)} textAnchor="middle" fill={text} fontSize={fontSize} fontWeight="550">{shortLabel}</text>
          {detailed && note && <text x={w / 2} y={h / 2 + 23} textAnchor="middle" fill={node.root ? rootColors(node).note : "var(--nova-muted)"} fontSize={Math.min(14, (w - 28) / Math.max(1, note.length * .52))}>{note}</text>}
        </g>;
      })}
    </g>
  </svg>;
}
