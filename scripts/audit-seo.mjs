import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { publicOrigin } from '../src/lib/brand.js';
import { publicPaths, pageMetadata } from '../src/lib/seo.js';

// Read-only deployment check: never submits URLs or sends board content.
const input = process.argv[2];
if (!input) throw new Error('Usage: npm run audit:seo -- https://your-production-domain');
const target = new URL(input);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
if (target.pathname !== '/' || target.search || target.hash || target.username || target.password || (!local && target.protocol !== 'https:') || !['http:', 'https:'].includes(target.protocol)) {
  throw new Error('Provide an HTTPS origin, or an HTTP localhost origin for a local check.');
}
const origin = process.argv.includes('--preview') ? '' : publicOrigin(process.env.SEO_EXPECTED_ORIGIN || target.origin);
const report = [], documents = new Map();
async function check(name, run) {
  try { await run(); report.push({ check: name, passed: true }); }
  catch (error) { report.push({ check: name, passed: false, error: error.message }); }
}
const request = path => fetch(new URL(path, target), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
for (const path of publicPaths) await check(`Public page ${path}`, async () => {
  const response = await request(path);
  assert.equal(response.status, 200, 'Public page must respond with HTTP 200');
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  const doc = new JSDOM(await response.text()).window.document;
  documents.set(path, doc);
  const metadata = pageMetadata(path, origin);
  assert.equal(doc.querySelectorAll('h1').length, 1, 'Expected one main heading');
  assert.ok(doc.querySelector('main')?.textContent.length > 300, 'Content must be available before JavaScript runs');
  assert.equal(doc.querySelectorAll('title').length, 1);
  assert.equal(doc.title, metadata.title);
  assert.equal(doc.querySelectorAll('meta[name="description"]').length, 1);
  assert.equal(doc.querySelector('meta[name="description"]')?.content, metadata.description);
  assert.equal(doc.querySelectorAll('meta[name="robots"]').length, 1);
  assert.equal(doc.querySelector('meta[name="robots"]')?.content, metadata.robots);
  assert.equal(doc.querySelectorAll('link[rel="canonical"]').length, origin ? 1 : 0);
  assert.equal(doc.querySelector('link[rel="canonical"]')?.href || '', metadata.canonical);
  if (origin) {
    assert.equal(doc.querySelectorAll('script[type="application/ld+json"]').length, 1);
    assert.ok(!/noindex/i.test(response.headers.get('x-robots-tag') || ''), 'HTTP header must not block production indexing');
    assert.equal(doc.querySelector('meta[property="og:image"]')?.content, metadata.image);
    assert.equal(doc.querySelector('meta[property="og:url"]')?.content, metadata.canonical);
    assert.deepEqual(JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.textContent || 'null'), metadata.schema);
  } else assert.equal(doc.querySelectorAll('script[type="application/ld+json"]').length, 0);
});
await check('Internal links and downloadable brand assets', async () => {
  const assets = new Set();
  for (const [path, doc] of documents) for (const link of doc.querySelectorAll('a[href]')) {
    const url = new URL(link.getAttribute('href'), `${target.origin}${path}`);
    if (url.origin !== target.origin) continue;
    if (url.hash && documents.has(url.pathname)) assert.ok(documents.get(url.pathname).getElementById(decodeURIComponent(url.hash.slice(1))), `Broken link: ${path} → ${url.pathname}${url.hash}`);
    if (link.hasAttribute('download')) assets.add(url.pathname);
  }
  for (const path of assets) {
    const response = await request(path);
    assert.equal(response.status, 200, `Missing download: ${path}`);
    assert.ok(!/text\/html/.test(response.headers.get('content-type') || ''), `Download returned HTML: ${path}`);
  }
});
await check('Sitemap contains exactly the public canonical URLs', async () => {
  const response = await request('/sitemap.xml');
  assert.equal(response.status, 200);
  const doc = new JSDOM(await response.text(), { contentType: 'application/xml' }).window.document;
  assert.deepEqual([...doc.querySelectorAll('loc')].map(node => node.textContent).sort(), origin ? publicPaths.map(path => `${origin}${path}`).sort() : []);
});
await check('Robots policy matches deployment environment', async () => {
  const response = await request('/robots.txt');
  assert.equal(response.status, 200);
  const robots = await response.text();
  if (origin) { assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`)); assert.ok(!/^Disallow:\s*\/\s*$/m.test(robots)); }
  else assert.match(robots, /^Disallow:\s*\/\s*$/m);
});
for (const path of ['/projects', '/boards/seo-audit', '/share', '/seo-audit-missing-page']) await check(`Private/404 indexing ${path}`, async () => {
  const response = await request(path);
  assert.equal(response.status, path === '/seo-audit-missing-page' ? 404 : 200);
  const doc = new JSDOM(await response.text()).window.document;
  assert.match(doc.querySelector('meta[name="robots"]')?.content || '', /^noindex/);
  assert.equal(doc.querySelector('link[rel="canonical"]'), null);
  assert.equal(doc.querySelector('script[type="application/ld+json"]'), null);
});
for (const [from, to] of [['/index.html', '/'], ['/about/index.html', '/about'], ['/templates/retired', '/templates']]) await check(`Canonical redirect ${from}`, async () => {
  const response = await request(from);
  assert.ok([301, 308].includes(response.status), `Expected a permanent redirect, received ${response.status}`);
  const destination = new URL(response.headers.get('location'), target);
  assert.equal(destination.origin, target.origin);
  assert.equal(destination.pathname, to);
});
for (const path of publicPaths) await check(`Social card ${path}`, async () => {
  const response = await request(`/social/${path === '/' ? 'home' : path.slice(1)}.png`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /image\/png/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert.equal(bytes.readUInt32BE(16), 1200);
  assert.equal(bytes.readUInt32BE(20), 630);
});
const failed = report.filter(item => !item.passed);
console.log(JSON.stringify({ target: target.origin, canonicalOrigin: origin || null, passed: report.length - failed.length, failed: failed.length, checks: report }, null, 2));
if (failed.length) process.exitCode = 1;
