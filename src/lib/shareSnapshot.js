// Apply disclosure choices before serialization. The owner's board and saved
// views are never changed, and private notes never enter a new share payload.
export function shareSnapshot(project, { includeHidden = false, includeSavedViews = false } = {}) {
  const copy = structuredClone(project);
  const filterBoard = board => {
    const excluded = new Set();
    if (!includeHidden) {
      const children = new Map();
      for (const node of board.nodes) {
        if (!children.has(node.frameId)) children.set(node.frameId, []);
        children.get(node.frameId).push(node);
      }
      const queue = board.nodes.filter(node => node.hidden);
      for (const node of queue) excluded.add(node.id);
      for (let index = 0; index < queue.length; index++) {
        if (queue[index].kind !== 'frame') continue;
        for (const child of children.get(queue[index].id) || []) {
          if (excluded.has(child.id)) continue;
          excluded.add(child.id); queue.push(child);
        }
      }
    }
    board.nodes = board.nodes.filter(node => !excluded.has(node.id));
    for (const node of board.nodes) delete node.presenterNote;
    const ids = new Set(board.nodes.map(node => node.id));
    board.edges = board.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to));
    if (board.goals) board.goals = board.goals.map(goal => ({ ...goal,
      ...(goal.nodeIds ? { nodeIds: goal.nodeIds.filter(id => ids.has(id)) } : {}),
    }));
    if (board.activeTimer && !ids.has(board.activeTimer.nodeId)) board.activeTimer = null;
    if (!includeSavedViews) delete board.savedViews;
    else for (const view of board.savedViews || []) if (view.board) filterBoard(view.board);
    return board;
  };
  copy.board = filterBoard(copy.board);
  return copy;
}
