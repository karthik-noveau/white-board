const lineKeys = ["structure", "pattern", "weight"];
const allowedValues = {
  shape: ["rectangle", "round", "soft", "pill", "ellipse", "circle"],
  color: ["violet", "blue", "amber", "pink", "green", "orange", "white"],
  structure: ["curve", "straight", "elbow"],
  pattern: ["solid", "dashed", "dotted"],
  weight: ["thin", "regular", "bold"],
};

// Bottom-toolbar styles cover the entire connected component, regardless of
// which shape or line was selected or which direction its connections follow.
export function branchStyleScope(nodes, edges, selectedIds, selectedEdge = null) {
  const nodeMap = new Map(nodes.filter(node => node.kind !== "frame").map(node => [node.id, node]));
  const nodeIds = new Set(), edgeIds = new Set(), neighbors = new Map();
  for (const edge of edges) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) continue;
    if (!neighbors.has(edge.from)) neighbors.set(edge.from, []);
    if (!neighbors.has(edge.to)) neighbors.set(edge.to, []);
    neighbors.get(edge.from).push(edge.to);
    neighbors.get(edge.to).push(edge.from);
  }
  const seeds = selectedIds.filter(id => nodeMap.has(id));
  if (!seeds.length) {
    const edge = edges.find(item => item.id === selectedEdge && nodeMap.has(item.from) && nodeMap.has(item.to));
    if (edge) seeds.push(edge.from);
  }
  let branchCount = 0;
  for (const seed of seeds) {
    if (nodeIds.has(seed)) continue;
    branchCount += 1;
    const queue = [seed];
    nodeIds.add(seed);
    for (let index = 0; index < queue.length; index += 1) {
      for (const id of neighbors.get(queue[index]) || []) {
        if (nodeIds.has(id)) continue;
        nodeIds.add(id);
        queue.push(id);
      }
    }
  }
  for (const edge of edges) {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) edgeIds.add(edge.id);
  }
  const locked = [...nodeIds].some(id => nodeMap.get(id).locked);
  return { branchCount, nodeIds, edgeIds, locked };
}

const commonValue = values => values.length && values.every(value => value === values[0]) ? values[0] : null;

export function branchStyleSettings(nodes, edges, scope, defaults) {
  const shapes = nodes.filter(node => scope.nodeIds.has(node.id));
  const lines = edges.filter(edge => scope.edgeIds.has(edge.id));
  const settings = {};
  for (const key of ["shape", "color"]) settings[key] = commonValue(shapes.map(node => node[key] || defaults[key]));
  for (const key of lineKeys) {
    settings[key] = commonValue(lines.length
      ? lines.map(edge => edge[key] || defaults[key])
      : shapes.map(node => node.branchStyle?.[key] || defaults[key]));
  }
  return settings;
}

export function applyBranchStyle(nodes, edges, scope, key, value, canvasLocked = false) {
  if (canvasLocked || scope.locked || !allowedValues[key]?.includes(value)) return { nodes, edges };
  const isLine = lineKeys.includes(key);
  let nodesChanged = false, edgesChanged = false;
  const nextNodes = nodes.map(node => {
    if (!scope.nodeIds.has(node.id)) return node;
    if (isLine ? node.branchStyle?.[key] === value : node[key] === value) return node;
    nodesChanged = true;
    return isLine ? { ...node, branchStyle: { ...node.branchStyle, [key]: value } } : { ...node, [key]: value };
  });
  const nextEdges = isLine ? edges.map(edge => {
    if (!scope.edgeIds.has(edge.id) || edge[key] === value) return edge;
    edgesChanged = true;
    return { ...edge, [key]: value };
  }) : edges;
  return { nodes: nodesChanged ? nextNodes : nodes, edges: edgesChanged ? nextEdges : edges };
}

export function childBranchStyle(source, edges, defaults) {
  const incoming = edges.find(edge => edge.to === source.id);
  const outgoing = edges.find(edge => edge.from === source.id);
  const style = { shape: source.shape || defaults.shape, color: source.color || defaults.color };
  for (const key of lineKeys) style[key] = incoming?.[key] || source.branchStyle?.[key] || outgoing?.[key] || defaults[key];
  return style;
}
