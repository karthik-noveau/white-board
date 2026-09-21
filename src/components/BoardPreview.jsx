import { nodeSize, palettes, rootColors } from "../lib/boardAppearance";

/** A single coordinate space keeps thumbnail nodes and connections aligned. */
export default function BoardPreview({ board, title = "Your idea", accent = "violet" }) {
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
  const scale = Math.min(340 / Math.max(1, width), 154 / Math.max(1, height), .7);
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  return <svg viewBox="0 0 400 200" aria-hidden="true" focusable="false">
    <g transform={`translate(${(400 - width * scale) / 2} ${(200 - height * scale) / 2}) scale(${scale}) translate(${-bounds.left} ${-bounds.top})`}>
      {edges.map(edge => {
        const a = nodeMap.get(edge.from), b = nodeMap.get(edge.to);
        if (!a || !b) return null;
        const as = nodeSize(a), bs = nodeSize(b);
        const ax = a.x + as.width / 2, ay = a.y + as.height / 2, bx = b.x + bs.width / 2, by = b.y + bs.height / 2;
        return <path key={edge.id} d={`M${ax} ${ay} C${(ax + bx) / 2} ${ay},${(ax + bx) / 2} ${by},${bx} ${by}`} stroke="var(--nova-border-strong)" strokeWidth="2.5" fill="none"/>;
      })}
      {nodes.map(node => {
        const { width: w, height: h } = nodeSize(node), colors = palettes[node.color] || palettes.white;
        const fill = node.root ? rootColors(node).fill : colors[0], text = node.root ? rootColors(node).text : "var(--nova-ink)";
        const round = ["circle", "ellipse", "pill"].includes(node.shape) ? Math.min(w, h) / 2 : node.shape === "rectangle" ? 3 : 14;
        const label = String(node.title || "Untitled");
        const shortLabel = label.length > 20 ? `${label.slice(0, 18)}…` : label;
        const fontSize = Math.min(20, (w - 24) / Math.max(1, shortLabel.length * .56));
        return <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
          <rect width={w} height={h} rx={round} fill={fill} stroke={node.root ? fill : colors[1]} strokeWidth="1.5"/>
          <text x={w / 2} y={h / 2 + fontSize * .3} textAnchor="middle" fill={text} fontSize={fontSize} fontWeight="550">{shortLabel}</text>
        </g>;
      })}
    </g>
  </svg>;
}
