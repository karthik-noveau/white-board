import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createProjectSaveQueue } from '../src/lib/projectSaveQueue.js';
import { templates } from '../src/data/templates.js';
import { prepareWorkspaceImport } from '../src/lib/workspaceImport.js';
import { backupFiles } from '../src/lib/brand.js';
import { projectUpdatedLabel } from '../src/lib/projectDates.js';

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

test('workspace backup includes boards created in another tab and restores its entire history', async () => {
  await storage.putProject(project('first'));
  const staleTab = await storage.listProjects({ includeDeleted: true });
  const second = await storage.putProject(project('second-tab-board'));
  await storage.putProject({ ...second, title: 'Latest title' });
  // Older callers passing their cached list must still get stored projects.
  await storage.exportWorkspaceFile(staleTab);
  const backup = JSON.parse(await downloads.at(-1).text());
  assert.equal(backup.projects.length, 2);
  assert.equal(backup.projects.find(item => item.id === second.id).title, 'Latest title');
  const restored = await storage.importNovaFile(file(backup));
  assert.equal(restored.length, 2);
  assert.ok((await storage.listProjectVersions(restored.find(item => item.title === 'Latest title').id)).length);
});

test('backup after another tab deletes a board never resurrects stale cached projects', async () => {
  const original = await storage.putProject(project('deleted-elsewhere'));
  const staleTab = await storage.listProjects({ includeDeleted: true });
  await storage.permanentlyDeleteProject(original.id);
  await storage.exportWorkspaceFile(staleTab);
  const backup = JSON.parse(await downloads.at(-1).text());
  assert.deepEqual(backup.projects, []);
  assert.deepEqual(backup.versions, []);
  assert.deepEqual(await storage.importNovaFile(file(backup)), []);
});

test('flushing pending saves makes the latest queued edits available for backup', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const write = createProjectSaveQueue(async (...args) => { await gate; return storage.putProject(...args); });
  const original = project('pending');
  const writes = [write(original), write({ ...original, title: 'Queued rename' })];
  let completed = false;
  const flushed = write.flush().then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  release();
  await flushed;
  await Promise.all(writes);
  await storage.exportWorkspaceFile();
  const backup = JSON.parse(await downloads.at(-1).text());
  assert.equal(backup.projects[0].title, 'Queued rename');
});

test('invalid project and history timestamps never partially import a workspace', async () => {
  const valid = project('valid');
  for (const value of [1e20, -1e20, 'yesterday']) {
    for (const field of ['created', 'updated', 'deletedAt']) {
      await assert.rejects(storage.importNovaFile(file({ format: 'nova-workspace', version: 1,
        projects: [valid, { ...project('bad'), [field]: value }],
      })), /invalid|unsupported/i);
    }
    await assert.rejects(storage.importNovaFile(file({ format: 'nova-workspace', version: 1,
      projects: [valid], versions: [{ projectId: valid.id, createdAt: value, board: board() }],
    })), /invalid|unsupported/i);
    assert.deepEqual(await storage.listProjects({ includeDeleted: true }), []);
  }
  const [epoch] = await storage.importNovaFile(file({ format: 'nova-project', version: 1,
    project: { ...valid, created: 0, updated: 0 },
  }));
  assert.equal(epoch.created, 0);
  assert.equal(epoch.updated, 0);
  assert.equal((await storage.listProjects())[0].updated, 0);
});

test('bad dates in existing storage have readable labels instead of crashing project lists', () => {
  for (const updated of [1e20, -1e20, NaN, undefined, null, 'bad']) {
    assert.equal(projectUpdatedLabel({ updated }), 'Edited date unavailable');
    assert.equal(projectUpdatedLabel({ deletedAt: updated }, true), 'Deleted date unavailable');
  }
  assert.equal(projectUpdatedLabel({ updated: 1000 }, false, 1000), 'Edited today');
  assert.match(projectUpdatedLabel({ updated: 0 }, false), /Edited .*1970/);
});

test('backup verification prevents downloading data the restore parser would reject', async () => {
  const transaction = database.transaction('projects', 'readwrite');
  transaction.objectStore('projects').put({ ...project('legacy-bad-date'), updated: 1e20 });
  await transactionDone(transaction);
  await assert.rejects(storage.exportWorkspaceFile(), /restorable backup could not be created/);
  assert.equal(downloads.length, 0);
});

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
  await storage.exportWorkspaceFile();
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
  await storage.exportWorkspaceFile();
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

test('folders persist without projects and rename/remove update all memberships without losing boards', async () => {
  await storage.changeWorkspaceFolder('create', 'Empty folder');
  await storage.putProject({ ...project('active'), folder: 'Work' });
  const trashed = await storage.putProject({ ...project('trashed'), folder: 'Work', deletedAt: Date.now() });
  assert.deepEqual(await storage.listWorkspaceFolders(), ['Empty folder', 'Work']);
  const before = await storage.listProjects({ includeDeleted: true });
  await storage.changeWorkspaceFolder('rename', 'Work', 'Design / 设计');
  const renamed = await storage.listProjects({ includeDeleted: true });
  assert.ok(renamed.every(item => item.folder === 'Design / 设计'));
  assert.equal(renamed.find(item => item.id === trashed.id).deletedAt, trashed.deletedAt);
  await assert.rejects(storage.putProject({ ...before[0], title: 'Stale folder assignment' }), /another tab|changed|conflict/i);
  await storage.changeWorkspaceFolder('remove', 'Design / 设计');
  const after = await storage.listProjects({ includeDeleted: true });
  assert.equal(after.length, 2);
  assert.ok(after.every(item => item.folder === ''));
  assert.deepEqual(after.map(item => item.board), before.map(item => item.board));
  assert.deepEqual(await storage.listWorkspaceFolders(), ['Empty folder']);
});

test('duplicate and invalid folder changes are rejected atomically; moving the last project preserves its old folder', async () => {
  await storage.changeWorkspaceFolder('create', 'Research');
  await storage.putProject({ ...project('moving'), folder: 'Work' });
  const before = await storage.readWorkspaceBackup();
  for (const args of [['create', 'research'], ['create', '  '], ['create', 'x'.repeat(181)], ['rename', 'Work', 'Research'], ['rename', 'Missing', 'New']]) {
    await assert.rejects(storage.changeWorkspaceFolder(...args));
    assert.deepEqual((await storage.readWorkspaceBackup()).projects, before.projects);
    assert.deepEqual(await storage.listWorkspaceFolders(), ['Research', 'Work']);
  }
  await storage.applyProjectBatch(['moving'], 'move', 'Research');
  assert.deepEqual(await storage.listWorkspaceFolders(), ['Research', 'Work']);
  await storage.applyProjectBatch(['moving'], 'move', '');
  assert.equal((await storage.listProjects())[0].folder, '');
  assert.deepEqual(await storage.listWorkspaceFolders(), ['Research', 'Work']);
});

test('URL restore keeps empty folders, private content, Trash, history and colliding saved shapes', async () => {
  const { createWorkspaceBackupUrl, readWorkspaceBackupUrl } = await import('../src/lib/workspaceShare.js');
  await storage.changeWorkspaceFolder('create', 'Empty folder');
  const source = { ...project('complete'), folder: 'Work', favorite: true, deletedAt: Date.now() };
  source.board.nodes[0].presenterNote = 'Private backup note';
  source.board.nodes[1].hidden = true;
  await storage.putProject(source);
  await storage.saveShapeLibraryItem({ id: 'shape-1', name: 'Stored shape', payload: board() });
  const snapshot = await storage.readWorkspaceBackup();
  const url = await createWorkspaceBackupUrl(snapshot, 'https://example.com');
  const decoded = await readWorkspaceBackupUrl(url);
  assert.deepEqual(decoded, snapshot);
  // Reading and previewing a URL writes nothing.
  assert.equal((await storage.listProjects({ includeDeleted: true })).length, 1);
  const [copy] = await storage.importWorkspacePayload(decoded);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.folder, 'Work'); assert.equal(copy.favorite, true);
  assert.equal(copy.deletedAt, source.deletedAt);
  assert.equal(copy.board.nodes[0].presenterNote, 'Private backup note');
  assert.equal(copy.board.nodes[1].hidden, true);
  assert.equal((await storage.listProjectVersions(copy.id)).length, snapshot.versions.length);
  assert.deepEqual(await storage.listWorkspaceFolders(), ['Empty folder', 'Work']);
  const shapes = await storage.listShapeLibrary();
  assert.equal(shapes.length, 2); assert.equal(new Set(shapes.map(item => item.id)).size, 2);
  assert.equal(shapes.find(item => item.id === 'shape-1').name, 'Stored shape');
  await assert.rejects(storage.importWorkspacePayload({ ...decoded, folders: [123] }));
  assert.equal((await storage.listProjects({ includeDeleted: true })).length, 2);
});
