// A collapsed shape carries its hidden descendants without selecting them.
export function createNodeDrag(nodes, edges, selectedIds) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const ids = new Set(selectedIds.filter(id => nodeMap.has(id)));
  const children = new Map();
  for (const edge of edges) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) continue;
    if (!children.has(edge.from)) children.set(edge.from, []);
    children.get(edge.from).push(edge.to);
  }
  const queue = [...ids].filter(id => nodeMap.get(id).collapsed);
  const visited = new Set(queue);
  for (let index = 0; index < queue.length; index += 1) {
    for (const id of children.get(queue[index]) || []) {
      ids.add(id);
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(id);
    }
  }
  const origins = new Map(nodes.filter(node => ids.has(node.id))
    .map(node => [node.id, { x: node.x, y: node.y }]));
  const edgeOrigins = new Map(edges.filter(edge => ids.has(edge.from) && ids.has(edge.to)
    && (Number.isFinite(edge.controlX) || Number.isFinite(edge.controlY)))
    .map(edge => [edge.id, { controlX: edge.controlX, controlY: edge.controlY }]));
  return { origins, edgeOrigins, locked: [...ids].some(id => nodeMap.get(id).locked) };
}

// Always translate from pointer-down positions, avoiding accumulated drift.
export function moveDraggedNodes(nodes, drag, dx, dy) {
  return nodes.map(node => {
    const origin = drag.origins.get(node.id);
    return origin ? { ...node, x: origin.x + dx, y: origin.y + dy } : node;
  });
}

export function moveDraggedEdges(edges, drag, dx, dy) {
  if (!drag.edgeOrigins.size) return edges;
  return edges.map(edge => {
    const origin = drag.edgeOrigins.get(edge.id);
    if (!origin) return edge;
    return {
      ...edge,
      ...(Number.isFinite(origin.controlX) ? { controlX: origin.controlX + dx } : {}),
      ...(Number.isFinite(origin.controlY) ? { controlY: origin.controlY + dy } : {}),
    };
  });
}
