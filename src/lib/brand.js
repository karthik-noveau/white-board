// Public identity. Legacy storage keys and serialized formats remain stable so
// rebranding does not disconnect existing boards, share links, or backups.
export const brand = Object.freeze({
  name: 'DrawAnything',
  alternateName: 'Draw Anything',
  slug: 'drawanything',
  assetVersion: 'drawanything-2',
  tagline: 'Your ideas, connected.',
  description: 'A private online whiteboard for mind maps, brainstorming, and visual planning. Connect ideas with editable templates and save on your device. No account needed.',
  themeColor: '#6436dc',
  backgroundColor: '#f7f8fc',
  markPath: 'M18 12h12c14 0 23 8 23 20S44 52 30 52H12l8-8h10c9 0 15-4 15-12s-6-12-15-12h-8v15l-8 8V16a4 4 0 0 1 4-4Z',
});

export const backupFiles = Object.freeze({
  projectExtension: '.drawanything',
  workspaceExtension: '.drawanything-workspace',
  // Continue accepting backups made before the rebrand.
  accept: '.drawanything,.drawanything-workspace,.nova,.nova-workspace,application/json,application/x-nova+json,application/x-nova-workspace+json',
});

export function publicOrigin(value) {
  if (!value?.trim()) return '';
  let url;
  try { url = new URL(value); } catch { throw new Error('VITE_PUBLIC_APP_URL must be a full HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || /^(localhost|127\.|0\.|\[::1\])/.test(url.hostname) || !url.hostname.includes('.')) {
    throw new Error('VITE_PUBLIC_APP_URL must be a public HTTPS origin without a path, query, or credentials.');
  }
  return url.origin;
}

export const siteOrigin = publicOrigin(import.meta.env?.VITE_PUBLIC_APP_URL);
