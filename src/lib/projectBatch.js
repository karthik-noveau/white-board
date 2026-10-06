export function projectBatchChanges(projects, ids, action, value = '', now = Date.now()) {
  if (!['move', 'trash'].includes(action)) throw new Error('Unknown project action');
  const chosen = new Set(ids);
  return projects.filter(project => chosen.has(project.id) && !project.deletedAt).map(project => ({
    ...project, updated: now,
    ...(action === 'trash' ? { deletedAt: now } : { folder: String(value).trim().slice(0, 180) }),
  }));
}

export function projectCollection(projects, versions = []) {
  const ids = new Set(projects.map(project => project.id));
  return { format: 'nova-workspace', version: 1, exportedAt: new Date().toISOString(), projects, versions: versions.filter(version => ids.has(version.projectId)), shapeLibrary: [] };
}
