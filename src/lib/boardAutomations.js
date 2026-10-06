// Settle chained rules before publishing state. A cycle leaves the user's
// original card intact instead of scheduling another React update forever.
export function applyAutomations(nodes, rules, isOverdue = () => false) {
  const active = rules.filter(rule => rule.enabled);
  if (!active.length) return { nodes, conflicts: [] };
  const fields = [...new Set(active.map(rule => rule.actionField))];
  const signature = node => JSON.stringify(fields.map(field => node[field]));
  const conflicts = [];
  let changed = false;
  const next = nodes.map(original => {
    if (original.kind === 'frame' || original.locked) return original;
    let node = original;
    const seen = new Set([signature(node)]);
    for (let pass = 0; pass < 100; pass++) {
      let applied = false;
      for (const rule of active) {
        const matches = rule.whenField === 'overdue' ? isOverdue(node)
          : rule.whenField === 'tag' ? (node.tags || []).some(tag => tag.toLowerCase() === rule.whenValue.trim().replace(/^#/, '').toLowerCase())
          : (node[rule.whenField] || 'none') === rule.whenValue;
        if (!matches) continue;
        const value = rule.actionField === 'starred' ? rule.actionValue === 'true' : rule.actionValue;
        if (node[rule.actionField] !== value) { node = { ...node, [rule.actionField]: value }; applied = true; }
      }
      if (!applied) { changed ||= node !== original; return node; }
      const key = signature(node);
      if (seen.has(key)) break;
      seen.add(key);
    }
    conflicts.push(original.id);
    return original;
  });
  return { nodes: changed ? next : nodes, conflicts };
}
