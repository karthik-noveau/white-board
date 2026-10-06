import { build, loadEnv } from 'vite';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { brand, publicOrigin } from '../src/lib/brand.js';
import { generateBrandAssets } from './brand-assets.mjs';

const output = process.env.SEO_OUTPUT_DIR || 'dist';
const serverOutput = `${output}-ssr`;
const env = loadEnv('production', process.cwd(), 'VITE_');
const origin = publicOrigin(env.VITE_PUBLIC_APP_URL);
if (process.argv.includes('--require-origin') && !origin) throw new Error('Set VITE_PUBLIC_APP_URL to the production HTTPS origin before building for deployment.');
await build({ build: { manifest: true, outDir: output } });
await build({ build: { ssr: 'src/entry-server.jsx', outDir: serverOutput } });
const { render, renderHead, pageMetadata, publicPaths } = await import(pathToFileURL(resolve(serverOutput, 'entry-server.js')));
const shell = await readFile(`${output}/index.html`, 'utf8');
const page = (path, html = '', prerendered = false) => shell.replace(/<!--seo-start-->[\s\S]*?<!--seo-end-->/, `<!--seo-start-->\n${renderHead(pageMetadata(path, origin))}\n<!--seo-end-->`).replace('<div id="root"></div>', `<div id="root"${prerendered ? ` data-prerendered="${path}"` : ''}>${html}</div>`);
for (const path of publicPaths) {
  const folder = path === '/' ? output : `${output}${path}`;
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/index.html`, page(path, render(path), true));
}
await writeFile(`${output}/app.html`, page('/projects'));
await writeFile(`${output}/404.html`, page('/404', render('/404')));
await generateBrandAssets(output);
await writeFile(`${output}/robots.txt`, `User-agent: *\n${origin ? `Allow: /\n\nSitemap: ${origin}/sitemap.xml` : 'Disallow: /'}\n`);
await writeFile(`${output}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${origin ? publicPaths.map(path => `\n  <url><loc>${origin}${path}</loc></url>`).join('') : ''}\n</urlset>\n`);
// Netlify normalizes trailing slashes before matching: a slash-only redirect
// would loop. Canonicals handle those aliases; Pretty URLs are disabled in netlify.toml.
const redirects = [...publicPaths.filter(path => path.startsWith('/templates/')).map(path => `/templates template=${path.split('/').at(-1)} ${path} 301!`), '/index.html / 301!', ...publicPaths.filter(path => path !== '/').map(path => `${path}/index.html ${path} 301!`), '/projects /app.html 200', '/projects/* /app.html 200', '/boards /app.html 200', '/boards/* /app.html 200', '/share /app.html 200', ...publicPaths.filter(path => path !== '/').map(path => `${path} ${path}/index.html 200`), '/* /404.html 404'];
await writeFile(`${output}/_redirects`, `${redirects.join('\n')}\n`);
await writeFile(`${output}/_headers`, `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/app.html\n  X-Robots-Tag: noindex, nofollow, noarchive\n/404.html\n  X-Robots-Tag: noindex, nofollow, noarchive\n/sw.js\n  Cache-Control: no-cache\n`);
// Versioned with the build, so cached HTML never points at removed assets.
const files = await readdir(`${output}/assets`);
const manifest = JSON.parse(await readFile(`${output}/manifest.json`, 'utf8'));
const assets = new Set(), visited = new Set();
function include(key) {
  if (visited.has(key) || !manifest[key]) return;
  visited.add(key);
  const entry = manifest[key];
  for (const file of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) assets.add(`/${file}`);
  for (const dependency of entry.imports || []) include(dependency);
}
// Keep saved boards available offline without downloading every optional
// CodeMirror language or PDF-export dependency on a landing-page visit.
for (const key of ['index.html', 'src/components/Canvas.jsx', 'src/components/ReadOnlyBoard.jsx']) include(key);
const installManifest = JSON.parse(await readFile(`${output}/manifest.webmanifest`, 'utf8'));
const shellAssets = [...new Set([...assets, `/brand.svg?v=${brand.assetVersion}`, `/manifest.webmanifest?v=${brand.assetVersion}`, ...installManifest.icons.map(icon => icon.src), `/icons/icon-32.png?v=${brand.assetVersion}`, `/icons/icon-180.png?v=${brand.assetVersion}`])];
const revision = createHash('sha256').update(shell + files.sort().join('')).digest('hex').slice(0, 12);
const sw = (await readFile('public/sw.js', 'utf8')).replace('__BUILD_REVISION__', revision).replace('/*__PRECACHE__*/', shellAssets.map(file => JSON.stringify(file)).join(','));
await writeFile(`${output}/sw.js`, sw);
console.log(`Pre-rendered ${publicPaths.length} public pages. ${origin ? `Canonical origin: ${origin}` : 'Preview build: indexing disabled. Set VITE_PUBLIC_APP_URL for deployment.'}`);
