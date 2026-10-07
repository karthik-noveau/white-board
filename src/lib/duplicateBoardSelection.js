// Duplicate a frame as a unit, including children that are not selected or
// visible. Only remap parents that are part of this copy; a card duplicated
// inside an existing frame should remain in that frame.
export function duplicateBoardSelection(nodes, edges, selectedIds, nextNodeId, nextEdgeId) {
  const chosen = new Set(selectedIds), children = new Map();
  for (const node of nodes) {
    if (!children.has(node.frameId)) children.set(node.frameId, []);
    children.get(node.frameId).push(node);
  }
  const queue = nodes.filter(node => chosen.has(node.id) && node.kind === 'frame');
  for (let index = 0; index < queue.length; index++) {
    for (const node of children.get(queue[index].id) || []) {
      if (chosen.has(node.id)) continue;
      chosen.add(node.id);
      if (node.kind === 'frame') queue.push(node);
    }
  }
  const source = nodes.filter(node => chosen.has(node.id));
  const idMap = new Map(source.map(node => [node.id, nextNodeId()])), groupMap = new Map();
  const copies = source.map(original => {
    const node = structuredClone(original);
    if (node.groupId && !groupMap.has(node.groupId)) groupMap.set(node.groupId, `group-${crypto.randomUUID()}`);
    return { ...node, id: idMap.get(node.id), groupId: groupMap.get(node.groupId),
      frameId: idMap.get(node.frameId) ?? node.frameId, x: node.x + 35, y: node.y + 35, root: false };
  });
  const connections = edges.filter(edge => idMap.has(edge.from) && idMap.has(edge.to)).map(edge => ({
    ...structuredClone(edge), id: nextEdgeId(), from: idMap.get(edge.from), to: idMap.get(edge.to),
    ...(Number.isFinite(edge.controlX) ? { controlX: edge.controlX + 35 } : {}),
    ...(Number.isFinite(edge.controlY) ? { controlY: edge.controlY + 35 } : {}),
  }));
  return { nodes: copies, edges: connections, ids: copies.map(node => node.id) };
}
