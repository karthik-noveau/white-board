/** Filter board items while keeping a matching shape's frame as context. */
export function filterBoardOutline(nodes, query = "", filter = "all") {
  const needle = query.trim().toLowerCase();
  const frames = nodes.filter(node => node.kind === "frame");
  const frameIds = new Set(frames.map(frame => frame.id));
  const hiddenFrames = new Set(frames.filter(frame => frame.hidden).map(frame => frame.id));
  const matches = nodes.filter(node => {
    const hidden = Boolean(node.hidden || hiddenFrames.has(node.frameId));
    const matchesFilter = filter === "all" || (filter === "shapes" && node.kind !== "frame") ||
      (filter === "frames" && node.kind === "frame") || (filter === "locked" && node.locked) ||
      (filter === "hidden" && hidden);
    const searchable = [node.title, node.note, node.status, node.priority, ...(node.tags || [])].filter(Boolean).join(" ").toLowerCase();
    return matchesFilter && searchable.includes(needle);
  });
  const matchedIds = new Set(matches.map(node => node.id));
  const groups = frames.map(frame => ({
    frame,
    children: matches.filter(node => node.kind !== "frame" && node.frameId === frame.id),
  })).filter(group => matchedIds.has(group.frame.id) || group.children.length);
  const unframed = matches.filter(node => node.kind !== "frame" && !frameIds.has(node.frameId));
  return { groups, unframed, count: matches.length };
}
