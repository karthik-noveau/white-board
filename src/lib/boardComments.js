import { branchStyleScope } from "./branchStyles.js";

export function commentsForScope(nodes, edges, scope, targetId, selectedEdge = null) {
  const ids = scope === "all" ? new Set(nodes.map(node => node.id))
    : scope === "branch" ? branchStyleScope(nodes, edges, targetId == null ? [] : [targetId], selectedEdge).nodeIds
    : new Set(targetId == null ? [] : [targetId]);
  return nodes.filter(node => ids.has(node.id))
    .flatMap(node => (node.comments || []).map(comment => ({ ...comment, nodeId: node.id, nodeTitle: node.title })))
    .sort((a, b) => b.createdAt - a.createdAt);
}
