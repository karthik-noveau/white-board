import { useId } from 'react';
import { nodeSize, paletteFor, customColors, rootColors, isCardContent } from '../lib/boardAppearance';
import { versionPreviewData } from '../lib/versionPreview';
import { safeAttachment } from '../lib/cellContent';
import { previewBlocks, wrapPreviewText } from '../lib/previewLayout';

function Lines({ lines, x = 0, y = 16, leading = 22, ...props }) {
  return <text x={x} y={y} fontSize="14" fill="var(--nova-text)" {...props}>{lines.map((line, index) => <tspan key={index} x={x} dy={index ? leading : 0}>{line || '\u00a0'}</tspan>)}</text>;
}

function Blocks({ layout, ink }) {
  return layout.blocks.map(block => {
    const w = block.width, h = block.height;
    let content;
    if (block.type === 'table') {
      const totalWidth = block.columns.reduce((sum, width) => sum + width, 0);
      let rowY = block.headerHeight;
      content = <>
        <rect width={totalWidth} height={h} rx="8" fill="white" stroke="var(--nova-border)"/>
        <rect x="1" y="1" width={totalWidth - 2} height={block.headerHeight - 1} rx="7" fill="var(--nova-surface-tint)"/>
        {block.headers.map((lines, column) => {
          const x = block.columns.slice(0, column).reduce((sum, width) => sum + width, 0);
          return <g key={column}>{column > 0 && <path d={`M${x} 0v${h}`} stroke="var(--nova-border)"/>}<Lines lines={lines} x={x + 14} y={26} fontSize="13" fontWeight="600"/></g>;
        })}
        {block.rows.map((row, index) => {
          const top = rowY; rowY += row.height;
          return <g key={index} transform={`translate(0 ${top})`}><path d={`M0 0h${totalWidth}`} stroke="var(--nova-border)"/>{row.cells.map((cell, column) => <g key={column} transform={`translate(${14 + block.columns.slice(0, column).reduce((sum, width) => sum + width, 0)} 12)`}><Blocks layout={cell}/></g>)}</g>;
        })}
      </>;
    } else if (block.type === 'checklist') {
      content = block.tasks.map((task, index) => <g key={index} transform={`translate(0 ${task.y})`}>
        <rect y="4" width="17" height="17" rx="4" fill={task.done ? 'var(--nova-primary)' : 'white'} stroke={task.done ? 'var(--nova-primary)' : 'var(--nova-muted)'}/>
        {task.done && <path d="m4 12 3 3 6-7" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>}
        <Lines lines={task.lines} x={28} y={18} leading={24} textDecoration={task.done ? 'line-through' : undefined} fill={ink || (task.done ? "var(--nova-muted)" : "var(--nova-text)")}/>
      </g>);
    } else if (block.type === 'image') {
      const data = safeAttachment(block.data, true);
      content = <><rect width={w} height={block.imageHeight + 20} rx="8" fill="var(--nova-page)" stroke="var(--nova-border)"/>{data ? <image href={data} x={(w - block.imageWidth) / 2} y="10" width={block.imageWidth} height={block.imageHeight} preserveAspectRatio="xMidYMid meet"/> : <Lines lines={['No image attached']} x={w / 2} y={block.imageHeight / 2 + 14} textAnchor="middle"/>}<Lines lines={block.lines} x={w / 2} y={block.imageHeight + 44} leading={20} fontSize="12" textAnchor="middle"/></>;
    } else if (block.type === 'divider') {
      content = <path d={`M0 6h${w}`} stroke="var(--nova-border)"/>;
    } else if (block.type === 'code') {
      content = <><rect width={w} height={h} rx="8" fill="var(--nova-page)" stroke="var(--nova-border)"/><Lines lines={[block.language || 'Plain text']} x={14} y={25} fontSize="12" fill="var(--nova-muted)"/><path d={`M0 38h${w}`} stroke="var(--nova-border)"/><Lines lines={block.lines} x={14} y={66} fontFamily="ui-monospace,monospace" fontSize="13"/></>;
    } else {
      const boxed = ['note', 'link', 'file'].includes(block.type);
      const fills = { warm: '#fff8e7', mint: '#edf9f1', violet: '#f2edff' };
      content = <>{boxed && <rect width={w} height={h} rx="8" fill={block.type === 'note' ? fills[block.tone] || fills.warm : 'white'} stroke="var(--nova-border)"/>}<Lines lines={block.lines} x={boxed ? 14 : 0} y={(boxed ? 14 : 0) + block.fontSize + 2} leading={block.leading} fontSize={block.fontSize} fontWeight={block.type === 'heading' ? '600' : undefined} fill={boxed ? 'var(--nova-text)' : ink || 'var(--nova-text)'}/></>;
    }
    return <g key={block.id} transform={`translate(0 ${block.y})`}>{content}</g>;
  });
}

/** Shared bounded rendering for project thumbnails, the library and landing page. */
export default function BoardPreview({ board, title = 'Your idea', accent = 'violet', detailed = false, aspectRatio = 2, zoom = 1, pan = { x: 0, y: 0 }, className, accessible = false }) {
  const previewId = useId();
  const allNodes = board?.nodes || [
    { id: 1, x: 0, y: 130, title, root: true, color: accent },
    { id: 2, x: 410, y: 0, title: 'Explore', color: 'pink' },
    { id: 3, x: 410, y: 140, title: 'Connect', color: 'green' },
    { id: 4, x: 410, y: 280, title: 'Make it happen', color: 'blue' },
  ];
  const allEdges = board?.edges || [{ id: 1, from: 1, to: 2 }, { id: 2, from: 1, to: 3 }, { id: 3, from: 1, to: 4 }];
  const { nodes, edges: connections } = versionPreviewData({ ...board, nodes: allNodes, edges: allEdges });
  const boxes = nodes.map(node => { const size = nodeSize(node); return { left: node.x, top: node.y, right: node.x + size.width, bottom: node.y + size.height }; });
  for (const edge of connections) if (edge.label) {
    const width = Math.min(180, Math.max(40, edge.label.length * 5.7 + 16));
    boxes.push({ left: edge.labelPoint.x - width / 2, right: edge.labelPoint.x + width / 2, top: edge.labelPoint.y - 11, bottom: edge.labelPoint.y + 11 });
  }
  const bounds = boxes.reduce((area, box) => ({ left: Math.min(area.left, box.left), top: Math.min(area.top, box.top), right: Math.max(area.right, box.right), bottom: Math.max(area.bottom, box.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
  const viewWidth = detailed ? 1000 : 400, viewHeight = viewWidth / aspectRatio;
  const scale = Math.min((viewWidth - 40) / Math.max(1, width), (viewHeight - 40) / Math.max(1, height), detailed ? 1 : .7);
  return <svg className={className} viewBox={`0 0 ${viewWidth} ${viewHeight}`} aria-hidden={accessible ? undefined : true} role={accessible ? 'img' : undefined} aria-label={accessible ? `${title}: ${nodes.length} cards and ${connections.length} connections` : undefined} focusable="false">
    {!nodes.length ? <text x={viewWidth / 2} y={viewHeight / 2} textAnchor="middle" fill="var(--nova-muted)" fontSize="14">A little room to think</text> : <g transform={`translate(${viewWidth / 2 + pan.x} ${viewHeight / 2 + pan.y}) scale(${zoom}) translate(${-viewWidth / 2} ${-viewHeight / 2})`}>
      <g transform={`translate(${(viewWidth - width * scale) / 2} ${(viewHeight - height * scale) / 2}) scale(${scale}) translate(${-bounds.left} ${-bounds.top})`}>
        {connections.map(edge => <path key={edge.id} d={edge.path} stroke="#aeb0b9" strokeWidth={Math.max(edge.weight === 'bold' ? 4 : edge.weight === 'thin' ? 1 : 2, .65 / scale)} strokeDasharray={edge.pattern === 'dotted' ? '2 5' : edge.pattern === 'dashed' ? '8 5' : undefined} fill="none"/>)}
        {nodes.map(node => {
          const { width: w, height: h } = nodeSize(node), colors = paletteFor(node.color), custom = customColors(node.color);
          const document = node.content && !isCardContent(node);
          const fill = custom?.fill || (document ? 'white' : node.root ? rootColors(node).fill : colors[0]);
          const color = custom?.text || (document ? 'var(--nova-ink)' : node.root ? rootColors(node).text : 'var(--nova-ink)');
          const round = ['circle', 'ellipse', 'pill'].includes(node.shape) ? Math.min(w, h) / 2 : node.shape === 'rectangle' ? 3 : 12;
          const clipId = `${previewId}-${node.id}`;
          const titleLines = wrapPreviewText(node.title || 'Untitled', w - 48, 18, 2);
          const noteBudget = Math.max(0, Math.floor((h - 24 - titleLines.length * 22 - 8) / 20));
          const noteLines = detailed && node.note && noteBudget > 0 ? wrapPreviewText(node.note, w - 36, 14, noteBudget) : [];
          const stackHeight = titleLines.length * 22 + (noteLines.length ? 8 + noteLines.length * 20 : 0);
          const textTop = (h - stackHeight) / 2;
          return <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
            <rect width={w} height={h} rx={round} fill={fill} stroke={document ? 'var(--nova-border-strong)' : node.root ? fill : colors[1]} strokeWidth="1.5"/>
            <defs><clipPath id={clipId}><rect x="12" y="10" width={Math.max(0, w - 24)} height={Math.max(0, h - 20)}/></clipPath></defs>
            <g clipPath={`url(#${clipId})`}>
              {node.content ? <><Lines lines={titleLines} x={24} y={40} fontSize="18" leading={26} fontWeight="600" fill={color}/><g transform={`translate(24 ${56 + (titleLines.length - 1) * 26})`}><Blocks layout={previewBlocks(node.content, w - 50)} ink={custom?.text || (isCardContent(node) && node.root ? rootColors(node).note : undefined)}/></g></> : <>
                <Lines lines={titleLines} x={w / 2} y={textTop + 18} textAnchor="middle" fontSize="18" fontWeight="600" fill={color}/>
                {noteLines.length > 0 && <Lines lines={noteLines} x={w / 2} y={textTop + titleLines.length * 22 + 24} textAnchor="middle" leading={20} fill={custom?.note || (node.root ? rootColors(node).note : 'var(--nova-muted)')}/>}
              </>}
            </g>
          </g>;
        })}
        {connections.filter(edge => edge.label).map(edge => {
          const label = wrapPreviewText(edge.label, 164, 11, 1)[0], w = Math.min(180, Math.max(40, label.length * 5.7 + 16));
          return <g key={`label-${edge.id}`} transform={`translate(${edge.labelPoint.x} ${edge.labelPoint.y})`}><rect x={-w / 2} y="-11" width={w} height="22" rx="8" fill="white" stroke="var(--nova-border)"/><text textAnchor="middle" y="4" fontSize="11" fontWeight="500" fill="var(--nova-text)">{label}</text></g>;
        })}
      </g>
    </g>}
  </svg>;
}
