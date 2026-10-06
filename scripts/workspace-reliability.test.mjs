import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createProjectSaveQueue } from '../src/lib/projectSaveQueue.js';
import { templates } from '../src/data/templates.js';
import { prepareWorkspaceImport } from '../src/lib/workspaceImport.js';
import { backupFiles } from '../src/lib/brand.js';

const memory = new Map(), downloads = [], filenames = [];
Object.assign(globalThis, { indexedDB, IDBKeyRange, window: { indexedDB },
  localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) },
  document: { createElement: () => ({ click() { filenames.push(this.download); } }) },
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
URL.createObjectURL = blob => { downloads.push(blob); return 'blob:audit'; };
URL.revokeObjectURL = () => {};
const storage = await import('../src/lib/localWorkspace.js');
await storage.initializeWorkspace([]);
const database = await new Promise((resolve, reject) => { const request = indexedDB.open('nova-workspace'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const transactionDone = transaction => new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onabort = () => reject(transaction.error); transaction.onerror = () => reject(transaction.error); });
beforeEach(async () => {
  memory.clear(); downloads.length = 0; filenames.length = 0;
  const transaction = database.transaction(['projects', 'versions', 'meta'], 'readwrite');
  for (const name of ['projects', 'versions', 'meta']) transaction.objectStore(name).clear();
  await transactionDone(transaction);
});
const board = () => ({ nodes: [{ id: 1, title: 'First idea', x: 0, y: 0, color: 'white' }, { id: 2, title: 'Second idea', x: 300, y: 0, color: 'white' }], edges: [{ id: 1, from: 1, to: 2 }] });
const project = id => ({ id, title: id, updated: Date.now(), board: board() });
const file = payload => ({ text: async () => JSON.stringify(payload) });

test('concurrent tabs cannot overwrite an acknowledged board or its history', async () => {
  const saved = await storage.putProject(project('concurrent'));
  const tabA = structuredClone(saved), tabB = structuredClone(saved);
  tabA.board.nodes[0].title = 'From A'; tabB.board.nodes[1].title = 'From B';
  const writerA = createProjectSaveQueue(storage.putProject), writerB = createProjectSaveQueue(storage.putProject);
  const outcomes = await Promise.allSettled([writerA(tabA), writerB(tabB)]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(result => result.status === 'rejected').reason.code, 'PROJECT_CONFLICT');
  const [stored] = await storage.listProjects();
  assert.equal(stored.storageRevision, 2);
  assert.equal(stored.board.nodes[0].title, 'From A');
  assert.equal(stored.board.nodes[1].title, 'Second idea');
  await assert.rejects(writerB(tabB), { code: 'PROJECT_CONFLICT' });
  const copy = await writerB({ ...tabB, id: 'recovered-copy', storageRevision: 0 });
  assert.equal(copy.board.nodes[1].title, 'From B');
  assert.equal((await storage.listProjects()).length, 2);
});

test('same-tab queued title/content changes do not conflict or lose either field', async () => {
  const write = createProjectSaveQueue(storage.putProject);
  const original = project('queued');
  const creation = write(original);
  const rename = write({ ...original, title: 'Renamed' });
  const edited = structuredClone(original.board); edited.nodes[0].title = 'Changed';
  const update = write({ ...original, title: 'Renamed', board: edited });
  await Promise.all([creation, rename, update]);
  const [saved] = await storage.listProjects();
  assert.equal(saved.storageRevision, 3); assert.equal(saved.title, 'Renamed'); assert.equal(saved.board.nodes[0].title, 'Changed');
});

test('failed writes retain the expected revision and can be retried', async () => {
  let fail = true;
  const write = createProjectSaveQueue(async (...args) => { if (fail) throw new Error('Quota exceeded'); return storage.putProject(...args); });
  await assert.rejects(write(project('retry')), /Quota/);
  fail = false;
  assert.equal((await write(project('retry'))).storageRevision, 1);
});

test('trash, restore, batch changes and permanent deletion invalidate older writers', async () => {
  const first = await storage.putProject(project('lifecycle'));
  const trashed = await storage.moveProjectToTrash(first.id);
  assert.equal(trashed.storageRevision, 2);
  await assert.rejects(storage.putProject(first), { code: 'PROJECT_CONFLICT' });
  const restored = await storage.restoreProject(first.id);
  assert.equal(restored.storageRevision, 3);
  const [moved] = await storage.applyProjectBatch([first.id], 'move', 'Ideas');
  assert.equal(moved.storageRevision, 4);
  await assert.rejects(storage.putProject(restored), { code: 'PROJECT_CONFLICT' });
  const saved = await storage.putProject({ ...moved, title: 'New title' });
  await storage.permanentlyDeleteProject(saved.id);
  await assert.rejects(storage.putProject(saved), { code: 'PROJECT_CONFLICT' });
  assert.equal((await storage.listProjects({ includeDeleted: true })).length, 0);
});

test('backup round trip retains every history entry, pinned labels and Trash state', async () => {
  let current = project('history'); const now = Date.now();
  for (let i = 0; i < 3; i++) {
    current = await storage.putProject({ ...current, updated: now - (2 - i) * 45000, board: { ...current.board, nodes: current.board.nodes.map(node => ({ ...node, title: `Revision ${i}` })) } });
  }
  const versions = await storage.listProjectVersions(current.id);
  const transaction = database.transaction('versions', 'readwrite');
  transaction.objectStore('versions').put({ ...versions[1], pinned: true, label: 'Approved draft' });
  await transactionDone(transaction);
  await storage.moveProjectToTrash(current.id);
  await storage.exportWorkspaceFile(await storage.listProjects({ includeDeleted: true }));
  const backup = JSON.parse(await downloads.at(-1).text());
  const [restored] = await storage.importNovaFile(file(backup));
  assert.notEqual(restored.id, current.id); assert.equal(restored.deletedAt, backup.projects[0].deletedAt);
  const restoredVersions = await storage.listProjectVersions(restored.id);
  assert.equal(restoredVersions.length, 3);
  assert.deepEqual(restoredVersions.map(v => v.board), versions.map(v => v.board));
  assert.equal(restoredVersions[1].label, 'Approved draft'); assert.equal(restoredVersions[1].pinned, true);
  assert.ok(restoredVersions.every(v => v.projectId === restored.id));
  assert.ok(restoredVersions.every(v => !versions.some(old => old.key === v.key)));
  assert.equal((await storage.listProjects()).length, 0);
});

test('invalid project, history, library and unsupported versions never partially import', async () => {
  const valid = project('valid');
  const malformed = { ...project('bad'), board: { nodes: board().nodes, edges: {} } };
  const payloads = [
    { format: 'nova-project', version: 1, project: malformed },
    { format: 'nova-workspace', version: 1, projects: [valid, malformed] },
    { format: 'nova-workspace', version: 1, projects: [valid], versions: [{ projectId: valid.id, createdAt: 10, board: malformed.board }] },
    { format: 'nova-workspace', version: 1, projects: [valid], shapeLibrary: [{ id: 'bad', name: 'Bad', payload: { nodes: [], edges: [{}] } }] },
    { format: 'nova-project', version: 99, project: valid },
    { format: 'nova-workspace', version: 1, projects: [valid, valid] },
  ];
  for (const payload of payloads) {
    await assert.rejects(storage.importNovaFile(file(payload)), /invalid|unsupported/i);
    assert.equal((await storage.listProjects({ includeDeleted: true })).length, 0);
  }
});

test('write failure aborts every project and recovery point in the import', async () => {
  const originalAdd = Object.getPrototypeOf(database.transaction('versions').objectStore('versions')).add;
  const prototype = Object.getPrototypeOf(database.transaction('versions').objectStore('versions'));
  prototype.add = function(value) { if (this.name === 'versions') throw new Error('Injected write failure'); return originalAdd.call(this, value); };
  try { await assert.rejects(storage.importNovaFile(file({ format: 'nova-workspace', version: 1, projects: [project('a'), project('b')] })), /Injected/); }
  finally { prototype.add = originalAdd; }
  assert.equal((await storage.listProjects({ includeDeleted: true })).length, 0);
  assert.equal((await storage.listProjectVersions('a')).length, 0);
});

test('starter boards seed once, including concurrent startup and intentionally empty workspaces', async () => {
  const starters = [project('starter')];
  await Promise.all([storage.initializeWorkspace(starters), storage.initializeWorkspace(starters)]);
  assert.equal((await storage.listProjects()).length, 1);
  await storage.permanentlyDeleteProject('starter');
  assert.equal((await storage.initializeWorkspace(starters)).length, 0);
});

test('old workspaces without revisions remain editable and never get sample projects added', async () => {
  const transaction = database.transaction('projects', 'readwrite'); transaction.objectStore('projects').put(project('legacy')); await transactionDone(transaction);
  const [legacy] = await storage.initializeWorkspace([project('starter')]);
  assert.equal(legacy.id, 'legacy');
  assert.equal(legacy.storageRevision, 1);
  assert.equal((await storage.putProject(legacy)).storageRevision, 2);
  await storage.permanentlyDeleteProject('legacy');
  assert.equal((await storage.initializeWorkspace([project('starter')])).length, 0);
});

test('all shipped templates remain valid imports', () => {
  for (const template of templates) {
    const result = prepareWorkspaceImport({ format: 'nova-project', version: 1, project: { id: template.id, title: template.name, board: template.board } });
    assert.equal(result.projects[0].board.nodes.length, template.board.nodes.length, template.id);
  }
});

test('an empty workspace from the previous app version remains empty on upgrade', async () => {
  const transaction = database.transaction('meta', 'readwrite');
  transaction.objectStore('meta').put({ key: 'legacyMigrated', value: true });
  await transactionDone(transaction);
  assert.equal((await storage.initializeWorkspace([project('starter')])).length, 0);
});

test('DrawAnything project downloads round-trip while preserving pre-rebrand data formats', async () => {
  const existing = await storage.putProject(project('existing-board'));
  await storage.exportProjectFile(existing);
  assert.equal(filenames.at(-1), 'existing-board.drawanything');
  const payload = JSON.parse(await downloads.at(-1).text());
  assert.equal(payload.format, 'nova-project');
  assert.equal(payload.project.id, existing.id);
  for (const name of ['existing-board.drawanything', 'existing-board.nova']) {
    const [imported] = await storage.importNovaFile({ name, text: async () => JSON.stringify(payload) });
    assert.equal(imported.title, existing.title);
    assert.notEqual(imported.id, existing.id);
    assert.deepEqual(imported.board.edges, existing.board.edges);
    assert.equal(imported.board.nodes[0].title, existing.board.nodes[0].title);
  }
  assert.equal((await storage.listProjects()).length, 3);
  assert.equal((await storage.listProjects()).find(item => item.id === existing.id).title, existing.title);
  for (const extension of ['.drawanything', '.drawanything-workspace', '.nova', '.nova-workspace']) assert.ok(backupFiles.accept.split(',').includes(extension));
});

test('workspace and selection backups carry the new name and retain importable history', async () => {
  const existing = await storage.putProject(project('first'), { snapshot: true });
  await storage.exportWorkspaceFile([existing]);
  assert.match(filenames.at(-1), /^drawanything-workspace-\d{4}-\d{2}-\d{2}\.drawanything-workspace$/);
  const workspace = JSON.parse(await downloads.at(-1).text());
  assert.equal(workspace.format, 'nova-workspace');
  assert.ok(workspace.versions.some(version => version.projectId === existing.id));
  await storage.exportProjectSelection([existing]);
  assert.match(filenames.at(-1), /^drawanything-selection-\d{4}-\d{2}-\d{2}\.drawanything-workspace$/);
  const selection = JSON.parse(await downloads.at(-1).text());
  assert.equal(selection.projects.length, 1);
  assert.equal(selection.projects[0].id, existing.id);
  for (const payload of [workspace, selection]) {
    const [restored] = await storage.importNovaFile(file(payload));
    assert.equal(restored.board.nodes[0].title, existing.board.nodes[0].title);
    assert.notEqual(restored.id, existing.id);
  }
});
