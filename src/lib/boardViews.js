// Saved views are immutable snapshots. Keep the view collection outside each
// snapshot so saving another view never recursively copies earlier snapshots.
export function copyBoardState(board) {
  const content = { ...board };
  delete content.savedViews;
  return { ...structuredClone(content), savedViews: [...(board.savedViews || [])] };
}

export function createSavedView(board, transform, name, id = crypto.randomUUID(), now = Date.now()) {
  const content = { ...board };
  delete content.savedViews;
  const snapshot = structuredClone(content);
  snapshot.viewport = { ...transform };

  // Freeze tracked time at the save moment rather than restarting an old clock
  // when this view is opened days later. Saving leaves the live timer running.
  if (snapshot.activeTimer) {
    const { nodeId, startedAt } = snapshot.activeTimer;
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    snapshot.nodes = snapshot.nodes.map(node => node.id === nodeId
      ? { ...node, timeSpent: (node.timeSpent || 0) + elapsed }
      : node);
  }
  snapshot.activeTimer = null;

  return { id, name, createdAt: now, transform: { ...transform }, board: snapshot };
}

export function restoreSavedView(currentBoard, view) {
  // Older views only stored a camera position; their content cannot be recovered.
  if (!view.board) return { ...currentBoard, viewport: { ...view.transform } };
  return {
    ...copyBoardState(view.board),
    savedViews: [...(currentBoard.savedViews || [])],
    viewport: { ...view.transform },
  };
}

export function nextBoardItemId(items, current = 1) {
  return items.reduce((next, item) => {
    const id = Number(item.id);
    return Number.isSafeInteger(id) ? Math.max(next, id + 1) : next;
  }, current);
}
