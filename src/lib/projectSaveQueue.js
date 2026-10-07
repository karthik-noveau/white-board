// Title and board changes share a revision. Serialize this tab's writes without
// accepting revisions written by a different tab behind the user's back.
export function createProjectSaveQueue(write) {
  const queues = new Map(), revisions = new Map();
  const persist = (project, options = {}) => {
    const captured = structuredClone(project);
    const pending = (queues.get(project.id) || Promise.resolve()).catch(() => {}).then(async () => {
      const revision = Math.max(revisions.get(project.id) || 0, captured.storageRevision || 0);
      const saved = await write({ ...captured, storageRevision: revision }, options);
      revisions.set(project.id, saved.storageRevision);
      return saved;
    });
    queues.set(project.id, pending);
    const cleanup = () => { if (queues.get(project.id) === pending) queues.delete(project.id); };
    pending.then(cleanup, cleanup);
    return pending;
  };
  persist.flush = async () => {
    while (queues.size) await Promise.all([...queues.values()]);
  };
  return persist;
}
