// A context click keeps a multi-selection only when its target belongs to it.
export function contextNodeIds(nodes, selectedIds, targetId) {
  const target = nodes.find(node => node.id === targetId);
  if (!target) return [];
  const selected = selectedIds.filter(id => nodes.some(node => node.id === id));
  if (selected.includes(targetId)) return selected;
  return target.groupId ? nodes.filter(node => node.groupId === target.groupId).map(node => node.id) : [targetId];
}

export function canvasContextPoint(point, bounds, transform) {
  return {
    left: point.x, top: point.y,
    x: (point.x - bounds.left - transform.x) / transform.scale,
    y: (point.y - bounds.top - transform.y) / transform.scale,
  };
}
