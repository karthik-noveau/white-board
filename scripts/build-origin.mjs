import { publicOrigin } from '../src/lib/brand.js';

export function resolveBuildOrigin(env, { requireOrigin = false } = {}) {
  const netlify = env.NETLIFY === 'true';
  if (env.DEPLOYMENT_ENV && !['production', 'preview'].includes(env.DEPLOYMENT_ENV)) {
    throw new Error('DEPLOYMENT_ENV must be production or preview.');
  }
  const preview = env.DEPLOYMENT_ENV === 'preview' || (netlify && env.CONTEXT !== 'production') || (env.VERCEL === '1' && (env.VERCEL_TARGET_ENV || env.VERCEL_ENV) !== 'production');
  // URL is the site's main address; deploy-specific URLs must not become canonicals.
  const value = preview ? '' : env.VITE_PUBLIC_APP_URL?.trim() || (netlify && env.CONTEXT === 'production' ? env.URL : '');
  const origin = publicOrigin(value);
  if (requireOrigin && !origin) {
    throw new Error('Set VITE_PUBLIC_APP_URL to the production HTTPS origin, or build in Netlify production with its URL variable available.');
  }
  return origin;
}
