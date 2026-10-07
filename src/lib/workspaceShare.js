import { prepareWorkspaceImport } from './workspaceImport.js';

export const MAX_WORKSPACE_LINK_BYTES = 8 * 1024 * 1024;
export const MAX_WORKSPACE_URL_LENGTH = 100_000;
export const workspaceRestorePath = '/projects/restore';
const invalid = 'This workspace backup URL is invalid or incomplete. Copy the full link and try again.';
const tooLarge = 'This workspace is too large for a backup URL. Download a backup file instead.';

async function readLimited(stream) {
  const reader = stream.getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_WORKSPACE_LINK_BYTES) { await reader.cancel(); throw new Error(tooLarge); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

function validateBackup(payload) {
  if (payload?.format !== 'nova-workspace' || payload.version !== 1) throw new Error(invalid);
  prepareWorkspaceImport(payload);
  return payload;
}

export async function createWorkspaceBackupUrl(payload, baseUrl) {
  validateBackup(payload);
  const url = new URL(workspaceRestorePath, baseUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS address for the backup URL.');
  // Capture all data before compression so subsequent edits cannot alter the snapshot.
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.length > MAX_WORKSPACE_LINK_BYTES) throw new Error(tooLarge);
  const compressed = typeof CompressionStream === 'function';
  const encoded = compressed ? await readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))) : bytes;
  let binary = '';
  for (let i = 0; i < encoded.length; i += 0x8000) binary += String.fromCharCode(...encoded.subarray(i, i + 0x8000));
  const data = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  url.hash = `workspace.v1.${compressed ? 'gzip' : 'json'}.${data}`;
  if (url.href.length > MAX_WORKSPACE_URL_LENGTH) throw new Error(tooLarge);
  return url.href;
}

export async function readWorkspaceBackupUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_WORKSPACE_URL_LENGTH) throw new Error(value?.length > MAX_WORKSPACE_URL_LENGTH ? tooLarge : invalid);
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error(invalid); }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname.replace(/\/$/, '') !== workspaceRestorePath) throw new Error(invalid);
  const [kind, version, encoding, data, extra] = url.hash.slice(1).split('.');
  if (kind !== 'workspace' || version !== 'v1' || !['gzip', 'json'].includes(encoding) || extra !== undefined || !data || !/^[A-Za-z0-9_-]+$/.test(data) || data.length % 4 === 1) throw new Error(invalid);
  if (encoding === 'gzip' && typeof DecompressionStream !== 'function') throw new Error('Open this backup URL in a browser that supports compressed links, or import a backup file.');
  try {
    const bytes = Uint8Array.from(atob(data.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
    const decoded = encoding === 'gzip' ? await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))) : bytes;
    if (decoded.length > MAX_WORKSPACE_LINK_BYTES) throw new Error(tooLarge);
    const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded), (key, item) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(invalid);
      return item;
    });
    return validateBackup(payload);
  } catch (error) { throw new Error(error.message === tooLarge ? tooLarge : invalid); }
}

export function workspaceBackupSummary(payload) {
  const projects = payload.projects || [];
  const trashed = projects.filter(project => project.deletedAt).length;
  return { projects: projects.length - trashed, trashed, versions: payload.versions?.length || 0, shapes: payload.shapeLibrary?.length || 0 };
}
