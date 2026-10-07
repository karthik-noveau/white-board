import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createWorkspaceBackupUrl, readWorkspaceBackupUrl, workspaceBackupSummary, MAX_WORKSPACE_LINK_BYTES, MAX_WORKSPACE_URL_LENGTH } from '../src/lib/workspaceShare.js';
import { prepareWorkspaceImport } from '../src/lib/workspaceImport.js';

const board = { nodes: [{ id: 1, title: 'Hidden idea', x: 0, y: 0, color: 'violet', hidden: true, presenterNote: 'Private presenter note' }], edges: [], savedViews: [{ id: 'v1', name: 'Before', transform: { x: 10, y: 20, scale: .8 }, board: { nodes: [{ id: 1, title: 'Earlier idea', x: 0, y: 0, color: 'blue' }], edges: [] } }] };
const snapshot = () => ({ format: 'nova-workspace', version: 1, exportedAt: '2026-10-08T00:00:00.000Z', projects: [
  { id: 'active', title: 'தமிழ் — Launch 🚀', folder: 'Work', favorite: true, created: 1, updated: 2, board: structuredClone(board) },
  { id: 'trash', title: 'Archived', updated: 2, deletedAt: 3, board: structuredClone(board) },
], versions: [{ projectId: 'active', createdAt: 1, label: 'Approved', pinned: true, board: structuredClone(board) }], shapeLibrary: [{ id: 'shape', name: 'Reusable', payload: { width: 228, height: 92, nodes: board.nodes, edges: [] } }] });
const encoded = (text, encoding = 'gzip') => `https://example.test/projects/restore#workspace.v1.${encoding}.${(encoding === 'gzip' ? gzipSync(text) : Buffer.from(text)).toString('base64url')}`;

test('workspace URL round-trips every backup field and remaps restored project/history identities', async () => {
  const input = snapshot(), before = structuredClone(input);
  const url = await createWorkspaceBackupUrl(input, 'https://example.test/projects?q=ignored#old');
  assert.equal(new URL(url).pathname, '/projects/restore');
  assert.equal(new URL(url).search, '');
  assert.match(new URL(url).hash, /^#workspace\.v1\.gzip\./);
  const decoded = await readWorkspaceBackupUrl(url);
  assert.deepEqual(decoded, before);
  assert.deepEqual(input, before);
  assert.deepEqual(workspaceBackupSummary(decoded), { projects: 1, trashed: 1, versions: 1, shapes: 1 });
  const prepared = prepareWorkspaceImport(decoded);
  assert.notEqual(prepared.projects[0].id, input.projects[0].id);
  assert.equal(prepared.versions[0].projectId, prepared.projects[0].id);
  assert.equal(prepared.projects[0].board.nodes[0].presenterNote, 'Private presenter note');
  assert.equal(prepared.projects[1].deletedAt, 3);
});

test('compression captures one immutable snapshot and JSON fallback remains importable', async () => {
  const input = snapshot(), before = structuredClone(input);
  const pending = createWorkspaceBackupUrl(input, 'https://example.test');
  input.projects[0].title = 'Later edit';
  assert.deepEqual(await readWorkspaceBackupUrl(await pending), before);
  const compression = globalThis.CompressionStream;
  try {
    globalThis.CompressionStream = undefined;
    const url = await createWorkspaceBackupUrl(before, 'https://example.test');
    assert.match(url, /#workspace\.v1\.json\./);
    assert.deepEqual(await readWorkspaceBackupUrl(url), before);
  } finally { globalThis.CompressionStream = compression; }
});

test('invalid, truncated, foreign, unsupported and poisoned URLs are rejected before import', async () => {
  const input = snapshot();
  const valid = await createWorkspaceBackupUrl(input, 'https://example.test');
  for (const url of ['not a URL', 'javascript:alert(1)', valid.replace('workspace.v1', 'workspace.v99'), valid.replace('/projects/restore', '/share'), valid.slice(0, -12), valid + '.extra', encoded('{"__proto__":{"polluted":true}}'), encoded('{"constructor":{}}'), encoded('[]'), encoded(JSON.stringify({ ...input, format: 'nova-project' })), encoded(JSON.stringify({ ...input, projects: [...input.projects, input.projects[0]] })), encoded(JSON.stringify({ ...input, versions: [{ projectId: 'missing', createdAt: 1, board }] }))]) {
    await assert.rejects(readWorkspaceBackupUrl(url), /invalid|incomplete/);
  }
  assert.equal({}.polluted, undefined);
  await assert.rejects(createWorkspaceBackupUrl(input, 'file:///tmp/app'), /HTTP/);
});

test('workspace URL limits reject oversized source, large URLs, and decompression bombs', async () => {
  const large = snapshot();
  large.projects[0].title = 'x'.repeat(MAX_WORKSPACE_LINK_BYTES);
  await assert.rejects(createWorkspaceBackupUrl(large, 'https://example.test'), /Download a backup file/);
  await assert.rejects(readWorkspaceBackupUrl(encoded(' '.repeat(MAX_WORKSPACE_LINK_BYTES + 1))), /Download a backup file/);
  await assert.rejects(readWorkspaceBackupUrl('https://example.test/' + 'x'.repeat(MAX_WORKSPACE_URL_LENGTH)), /Download a backup file/);
  const incompressible = snapshot();
  incompressible.projects[0].title = randomBytes(110_000).toString('base64url');
  await assert.rejects(createWorkspaceBackupUrl(incompressible, 'https://example.test'), /Download a backup file/);
});

test('an empty workspace is a valid snapshot and viewing it does not require device storage', async () => {
  const input = { format: 'nova-workspace', version: 1, projects: [], versions: [], shapeLibrary: [] };
  assert.deepEqual(await readWorkspaceBackupUrl(await createWorkspaceBackupUrl(input, 'http://localhost:5177')), input);
  assert.deepEqual(workspaceBackupSummary(input), { projects: 0, trashed: 0, versions: 0, shapes: 0 });
});
