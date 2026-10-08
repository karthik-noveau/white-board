import { publicOrigin } from '../src/lib/brand.js';

export function resolveBuildOrigin(env, { requireOrigin = false } = {}) {
  const netlify = env.NETLIFY === 'true';
  const preview = netlify && env.CONTEXT !== 'production';
  // URL is the site's main address; deploy-specific URLs must not become canonicals.
  const value = preview ? '' : env.VITE_PUBLIC_APP_URL?.trim() || (netlify && env.CONTEXT === 'production' ? env.URL : '');
  const origin = publicOrigin(value);
  if (requireOrigin && !origin) {
    throw new Error('Set VITE_PUBLIC_APP_URL to the production HTTPS origin, or build in Netlify production with its URL variable available.');
  }
  return origin;
}
