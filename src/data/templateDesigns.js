// Shared dimensions keep previews and editable boards on the same baselines.
// Connections run through the open gutters between each level of the map.
export function arrangeTemplateBranches({ root, groups, layout, accent }) {
  const nodes = [], edges = [];
  const add = (item, x, y, w, h, color, isRoot = false) => {
    const node = { id: nodes.length + 1, title: item.title, note: item.note, x, y, w, h, color, shape: 'round', ...(isRoot ? { root: true } : {}) };
    nodes.push(node);
    return node;
  };
  const connect = (from, to, side) => edges.push({ id: edges.length + 1, from: from.id, to: to.id, side, structure: 'elbow', pattern: 'solid', weight: 'regular' });

  if (layout === 'tree') {
    const leafWidth = 224, leafGap = 24, groupGap = 64;
    const spans = groups.map(group => group.items.length * (leafWidth + leafGap) - leafGap);
    const total = spans.reduce((sum, width) => sum + width, 0) + groupGap * (groups.length - 1);
    const anchor = add(root, (total - 280) / 2, 0, 280, 104, accent, true);
    let left = 0;
    groups.forEach((group, index) => {
      const branch = add(group, left + (spans[index] - 264) / 2, 208, 264, 104, group.color);
      connect(anchor, branch, 'bottom');
      group.items.forEach((item, itemIndex) => {
        const leaf = add(item, left + itemIndex * (leafWidth + leafGap), 416, leafWidth, 128, group.color);
        connect(branch, leaf, 'bottom');
      });
      left += spans[index] + groupGap;
    });
  } else if (layout === 'columns' || layout === 'phases') {
    const width = 272, gap = 88, step = width + gap;
    const phases = layout === 'phases';
    const anchor = add(root, phases ? 0 : ((groups.length - 1) * step) / 2, 0, width, 104, accent, true);
    let previous = anchor;
    groups.forEach((group, index) => {
      const x = (index + (phases ? 1 : 0)) * step, y = phases ? 0 : 208;
      const branch = add(group, x, y, width, 104, group.color);
      connect(phases ? previous : anchor, branch, phases ? 'right' : 'bottom');
      previous = branch;
      let parent = branch;
      group.items.forEach((item, itemIndex) => {
        const leaf = add(item, x, y + 192 + itemIndex * 192, width, 120, group.color);
        connect(parent, leaf, 'bottom');
        parent = leaf;
      });
    });
  } else if (layout === 'bilateral') {
    const leafWidth = 248, branchWidth = 224, rootWidth = 272, gap = 88;
    const branchX = leafWidth + gap, rootX = branchX + branchWidth + gap;
    const rightBranchX = rootX + rootWidth + gap, rightLeafX = rightBranchX + branchWidth + gap;
    const leafHeight = 112, leafGap = 24, groupGap = 88;
    const sideCount = Math.ceil(groups.length / 2);
    const heights = groups.map(group => group.items.length * (leafHeight + leafGap) - leafGap);
    const rows = Array.from({ length: sideCount }, (_, index) => Math.max(heights[index], heights[index + sideCount] || 0));
    const total = rows.reduce((sum, height) => sum + height, 0) + groupGap * (rows.length - 1);
    const anchor = add(root, rootX, (total - 112) / 2, rootWidth, 112, accent, true);
    groups.forEach((group, index) => {
      const left = index < sideCount, row = index % sideCount;
      const top = rows.slice(0, row).reduce((sum, height) => sum + height + groupGap, 0);
      const center = top + rows[row] / 2, side = left ? 'left' : 'right';
      const branch = add(group, left ? branchX : rightBranchX, center - 52, branchWidth, 104, group.color);
      connect(anchor, branch, side);
      group.items.forEach((item, itemIndex) => {
        const leaf = add(item, left ? 0 : rightLeafX, center - heights[index] / 2 + itemIndex * (leafHeight + leafGap), leafWidth, leafHeight, group.color);
        connect(branch, leaf, side);
      });
    });
  } else {
    // Each horizontal branch sits on the centerline of its supporting ideas.
    const leafHeight = 120, leafGap = 24, groupGap = 72;
    const heights = groups.map(group => group.items.length * (leafHeight + leafGap) - leafGap);
    const total = heights.reduce((sum, height) => sum + height, 0) + groupGap * (groups.length - 1);
    const anchor = add(root, 0, (total - 112) / 2, 248, 112, accent, true);
    let top = 0;
    groups.forEach((group, index) => {
      const branch = add(group, 360, top + (heights[index] - 104) / 2, 248, 104, group.color);
      connect(anchor, branch, 'right');
      group.items.forEach((item, itemIndex) => {
        const leaf = add(item, 720, top + itemIndex * (leafHeight + leafGap), 288, leafHeight, group.color);
        connect(branch, leaf, 'right');
      });
      top += heights[index] + groupGap;
    });
  }
  return { nodes, edges, globalSettings: { shape: 'round', color: 'white', structure: 'elbow', pattern: 'solid', weight: 'regular' } };
}
