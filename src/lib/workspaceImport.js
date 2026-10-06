import { validateBoard } from './boardValidation.js';
import { normalizeCellContent } from './cellContent.js';

const invalid = 'This backup contains invalid or unsupported data. Nothing was imported.';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const optional = (value, check) => value == null || check(value);

export function normalizeImportedBoard(board) {
  validateBoard(board, false, invalid);
  return { ...board, nodes: board.nodes.map(node => ({
    ...node, title: node.title || '', color: node.color || 'white',
    ...(node.content != null ? { content: normalizeCellContent(node.content) } : {}),
  })), ...(board.savedViews ? { savedViews: board.savedViews.map(view => ({
    ...view, ...(view.board ? { board: normalizeImportedBoard(view.board) } : {}),
  })) } : {}) };
}

// Prepare the entire backup before opening a write transaction. Remap only
// project identities: card IDs and references inside each board remain intact.
export function prepareWorkspaceImport(payload, now = Date.now()) {
  const fail = () => { throw new Error(invalid); };
  if (!record(payload) || payload.version !== 1 || !['nova-project', 'nova-workspace'].includes(payload.format)) fail();
  const workspace = payload.format === 'nova-workspace';
  const input = workspace ? payload.projects : [payload.project];
  if (!Array.isArray(input)) fail();
  const identities = new Map();
  const projects = input.map(project => {
    if (!record(project) || !id(project.id) || identities.has(project.id)) fail();
    for (const field of ['title', 'accent', 'folder']) if (!optional(project[field], value => typeof value === 'string')) fail();
    for (const field of ['created', 'updated', 'deletedAt']) if (!optional(project[field], Number.isFinite)) fail();
    if (!optional(project.favorite, value => typeof value === 'boolean')) fail();
    const nextId = `project-${crypto.randomUUID()}`;
    identities.set(project.id, nextId);
    return { ...project, id: nextId, storageRevision: 1, title: project.title || 'Imported project',
      created: project.created || project.updated || now, updated: project.updated || now,
      deletedAt: workspace ? project.deletedAt : undefined, schemaVersion: 1,
      ...(project.board != null ? { board: normalizeImportedBoard(project.board) } : {}),
    };
  });
  if (!optional(payload.versions, Array.isArray) || !optional(payload.shapeLibrary, Array.isArray)) fail();
  const versions = (workspace ? payload.versions || [] : []).map(version => {
    if (!record(version) || !identities.has(version.projectId) || !Number.isFinite(version.createdAt)) fail();
    if (!optional(version.label, value => typeof value === 'string') || !optional(version.pinned, value => typeof value === 'boolean')) fail();
    return { projectId: identities.get(version.projectId), createdAt: version.createdAt,
      ...(version.label != null ? { label: version.label } : {}), ...(version.pinned != null ? { pinned: version.pinned } : {}),
      board: normalizeImportedBoard(version.board),
    };
  });
  const withHistory = new Set(versions.map(version => version.projectId));
  for (const project of projects) if (project.board && !withHistory.has(project.id)) {
    versions.push({ projectId: project.id, createdAt: project.updated, board: project.board });
  }
  const shapeLibrary = (workspace ? payload.shapeLibrary || [] : []).map(item => {
    if (!record(item) || !id(item.id) || typeof item.name !== 'string' || !record(item.payload)) fail();
    if (!optional(item.payload.width, Number.isFinite) || !optional(item.payload.height, Number.isFinite)) fail();
    const board = normalizeImportedBoard({ nodes: item.payload.nodes, edges: item.payload.edges || [] });
    return { ...item, payload: { ...item.payload, ...board } };
  });
  return { projects, versions, shapeLibrary };
}
