const DB_NAME = "nova-workspace";
const DB_VERSION = 1;
const PROJECTS = "projects";
const VERSIONS = "versions";
const META = "meta";
const LEGACY_KEY = "nova-projects";
const MAX_VERSIONS = 24;
const VERSION_INTERVAL = 30_000;

let databasePromise;

const requestResult = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transactionDone = transaction => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error);
  transaction.onabort = () => reject(transaction.error || new Error("Local storage transaction was aborted"));
});

function openWorkspace() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROJECTS)) {
          const projects = database.createObjectStore(PROJECTS, { keyPath: "id" });
          projects.createIndex("updated", "updated");
          projects.createIndex("deletedAt", "deletedAt");
        }
        if (!database.objectStoreNames.contains(VERSIONS)) {
          const versions = database.createObjectStore(VERSIONS, { keyPath: "key", autoIncrement: true });
          versions.createIndex("projectId", "projectId");
          versions.createIndex("projectTime", ["projectId", "createdAt"]);
        }
        if (!database.objectStoreNames.contains(META)) database.createObjectStore(META, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Nova storage is open in an older tab. Close it and reload."));
    });
  }
  return databasePromise;
}

function normalizeProject(project) {
  const now = Date.now();
  return {
    accent: "violet",
    created: project.created || project.updated || now,
    ...project,
    updated: project.updated || now,
    schemaVersion: 1,
  };
}

async function readMeta(key) {
  const database = await openWorkspace();
  const transaction = database.transaction(META, "readonly");
  return requestResult(transaction.objectStore(META).get(key));
}

async function writeMeta(key, value) {
  const database = await openWorkspace();
  const transaction = database.transaction(META, "readwrite");
  transaction.objectStore(META).put({ key, value });
  await transactionDone(transaction);
}

async function migrateLegacyProjects() {
  if ((await readMeta("legacyMigrated"))?.value) return;
  let legacy = [];
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
  } catch {
    // Keep the unreadable value intact so it can still be recovered manually.
  }
  if (Array.isArray(legacy) && legacy.length) {
    const database = await openWorkspace();
    const transaction = database.transaction(PROJECTS, "readwrite");
    legacy.map(normalizeProject).forEach(project => transaction.objectStore(PROJECTS).put(project));
    await transactionDone(transaction);
  }
  await writeMeta("legacyMigrated", true);
}

export async function initializeWorkspace(starterProjects = []) {
  if (!window.indexedDB) throw new Error("This browser does not support durable local storage.");
  await migrateLegacyProjects();
  const projects = await listProjects({ includeDeleted: true });
  if (!projects.length && starterProjects.length) {
    await Promise.all(starterProjects.map(project => putProject(project, { snapshot: false })));
  }
  if (navigator.storage?.persist) {
    try { await navigator.storage.persist(); } catch { /* Persistence is best-effort. */ }
  }
  return listProjects({ includeDeleted: true });
}

export async function listProjects({ includeDeleted = false } = {}) {
  const database = await openWorkspace();
  const transaction = database.transaction(PROJECTS, "readonly");
  const projects = await requestResult(transaction.objectStore(PROJECTS).getAll());
  return projects
    .filter(project => includeDeleted || !project.deletedAt)
    .sort((a, b) => b.updated - a.updated);
}

async function trimVersions(database, projectId) {
  const transaction = database.transaction(VERSIONS, "readwrite");
  const index = transaction.objectStore(VERSIONS).index("projectId");
  const versions = await requestResult(index.getAll(IDBKeyRange.only(projectId)));
  versions.sort((a, b) => b.createdAt - a.createdAt);
  versions.filter(version => !version.pinned).slice(MAX_VERSIONS).forEach(version => transaction.objectStore(VERSIONS).delete(version.key));
  await transactionDone(transaction);
}

export async function putProject(project, { snapshot = true } = {}) {
  const database = await openWorkspace();
  const normalized = normalizeProject(project);
  const transaction = database.transaction([PROJECTS, VERSIONS], "readwrite");
  transaction.objectStore(PROJECTS).put(normalized);
  if (snapshot && normalized.board) {
    const versionIndex = transaction.objectStore(VERSIONS).index("projectTime");
    const range = IDBKeyRange.bound([normalized.id, 0], [normalized.id, Number.MAX_SAFE_INTEGER]);
    const cursorRequest = versionIndex.openCursor(range, "prev");
    const latest = await new Promise((resolve, reject) => {
      cursorRequest.onsuccess = () => resolve(cursorRequest.result?.value);
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
    if (!latest || normalized.updated - latest.createdAt >= VERSION_INTERVAL) {
      transaction.objectStore(VERSIONS).add({ projectId: normalized.id, createdAt: normalized.updated, board: normalized.board });
    }
  }
  await transactionDone(transaction);
  if (snapshot) trimVersions(database, normalized.id).catch(() => {});
  return normalized;
}

export async function moveProjectToTrash(id) {
  const database = await openWorkspace();
  const transaction = database.transaction(PROJECTS, "readwrite");
  const store = transaction.objectStore(PROJECTS);
  const project = await requestResult(store.get(id));
  if (project) store.put({ ...project, deletedAt: Date.now(), updated: Date.now() });
  await transactionDone(transaction);
}

export async function restoreProject(id) {
  const database = await openWorkspace();
  const transaction = database.transaction(PROJECTS, "readwrite");
  const store = transaction.objectStore(PROJECTS);
  const project = await requestResult(store.get(id));
  if (project) {
    delete project.deletedAt;
    store.put({ ...project, updated: Date.now() });
  }
  await transactionDone(transaction);
}

export async function permanentlyDeleteProject(id) {
  const database = await openWorkspace();
  const transaction = database.transaction([PROJECTS, VERSIONS], "readwrite");
  transaction.objectStore(PROJECTS).delete(id);
  const index = transaction.objectStore(VERSIONS).index("projectId");
  const keys = await requestResult(index.getAllKeys(IDBKeyRange.only(id)));
  keys.forEach(key => transaction.objectStore(VERSIONS).delete(key));
  await transactionDone(transaction);
}

export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, percent: quota ? usage / quota * 100 : 0 };
}

export async function listProjectVersions(projectId) {
  const database = await openWorkspace();
  const transaction = database.transaction(VERSIONS, "readonly");
  const index = transaction.objectStore(VERSIONS).index("projectId");
  const versions = await requestResult(index.getAll(IDBKeyRange.only(projectId)));
  return versions.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteProjectVersion(key) {
  const database = await openWorkspace();
  const transaction = database.transaction(VERSIONS, "readwrite");
  transaction.objectStore(VERSIONS).delete(key);
  await transactionDone(transaction);
}

export async function listShapeLibrary() {
  return (await readMeta("shapeLibrary"))?.value || [];
}

export async function saveShapeLibraryItem(item) {
  const items = await listShapeLibrary();
  const next = [{ ...item, id: item.id || `library-${Date.now()}` }, ...items].slice(0, 60);
  await writeMeta("shapeLibrary", next);
  return next;
}

export async function deleteShapeLibraryItem(id) {
  const next = (await listShapeLibrary()).filter(item => item.id !== id);
  await writeMeta("shapeLibrary", next);
  return next;
}

function downloadJson(payload, filename, type = "application/x-nova+json") {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportProjectFile(project) {
  const payload = { format: "nova-project", version: 1, exportedAt: new Date().toISOString(), project: normalizeProject(project) };
  downloadJson(payload, `${project.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "untitled"}.nova`);
}

export async function exportWorkspaceFile(projects) {
  const database = await openWorkspace();
  const transaction = database.transaction(VERSIONS, "readonly");
  const versions = await requestResult(transaction.objectStore(VERSIONS).getAll());
  const shapeLibrary = (await readMeta("shapeLibrary"))?.value || [];
  const payload = { format: "nova-workspace", version: 1, exportedAt: new Date().toISOString(), projects: projects.map(normalizeProject), versions, shapeLibrary };
  downloadJson(payload, `nova-workspace-${new Date().toISOString().slice(0, 10)}.nova-workspace`, "application/x-nova-workspace+json");
}

export async function importNovaFile(file) {
  const payload = JSON.parse(await file.text());
  if (payload?.format === "nova-project" && payload.project?.id) {
    const project = normalizeProject({ ...payload.project, id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: payload.project.title || "Imported project", updated: Date.now(), deletedAt: undefined });
    await putProject(project, { snapshot: true });
    return [project];
  }
  if (payload?.format === "nova-workspace" && Array.isArray(payload.projects)) {
    const now = Date.now();
    const projects = payload.projects.map((project, index) => normalizeProject({ ...project, id: `project-${now}-${index}-${Math.random().toString(36).slice(2, 6)}`, updated: now + index, deletedAt: undefined }));
    await Promise.all(projects.map(project => putProject(project, { snapshot: Boolean(project.board) })));
    if (Array.isArray(payload.shapeLibrary) && payload.shapeLibrary.length) {
      const existing = await listShapeLibrary();
      const ids = new Set(payload.shapeLibrary.map(item => item.id));
      await writeMeta("shapeLibrary", [...payload.shapeLibrary, ...existing.filter(item => !ids.has(item.id))].slice(0, 60));
    }
    return projects;
  }
  throw new Error("This is not a valid Nova project or workspace backup.");
}
