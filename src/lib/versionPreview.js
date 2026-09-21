import { boardEdgeData } from "./boardGeometry.js";
import { boardBounds } from "./boardExport.js";

export function versionPreviewData(board = {}) {
  const nodes = board.nodes || [], edges = board.edges || [];
  const hiddenFrames = new Set(nodes.filter(node => node.kind === "frame" && node.hidden).map(node => node.id));
  const collapsed = new Set();
  for (const root of nodes.filter(node => node.collapsed)) {
    const visited = new Set([root.id]), queue = [root.id];
    while (queue.length) {
      const id = queue.shift();
      for (const edge of edges.filter(edge => edge.from === id)) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to); collapsed.add(edge.to); queue.push(edge.to);
      }
    }
  }
  const visible = nodes.filter(node => !node.hidden && !hiddenFrames.has(node.frameId) && !collapsed.has(node.id));
  const settings = { structure: "elbow", pattern: "solid", weight: "regular", ...board.globalSettings };
  const connections = boardEdgeData(nodes, edges, settings, new Set(visible.map(node => node.id))).filter(Boolean);
  return { nodes: visible, edges: connections, bounds: boardBounds(visible, connections), totalCount: nodes.length };
}
