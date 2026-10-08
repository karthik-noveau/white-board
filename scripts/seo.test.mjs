import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { publicOrigin, brand } from '../src/lib/brand.js';
import { pageMetadata, publicPaths, renderHead, safeJson, templatePath } from '../src/lib/seo.js';
import { templates } from '../src/data/templates.js';
import { productPages } from '../src/data/productPages.js';
import { resourcePages } from '../src/data/resourcePages.js';
import { resolveBuildOrigin } from './build-origin.mjs';

const origin = 'https://whiteboard.example'; // Test fixture, never a deployment default.
test('production origin rejects ambiguous, insecure, and local addresses', () => {
  assert.equal(publicOrigin(''), '');
  assert.equal(publicOrigin(`${origin}/`), origin);
  for (const url of ['http://whiteboard.example', 'https://localhost', 'https://127.0.0.1', 'https://user:pass@whiteboard.example', `${origin}/app`, `${origin}?x=1`, `${origin}#hash`, 'not a url']) assert.throws(() => publicOrigin(url));
});
test('Netlify production uses the main site URL when the public origin is missing', () => {
  const env = { NETLIFY: 'true', CONTEXT: 'production', URL: `${origin}/`, DEPLOY_URL: 'https://unique-deploy.example', DEPLOY_PRIME_URL: 'https://branch-deploy.example' };
  for (const VITE_PUBLIC_APP_URL of [undefined, '', '  ']) {
    assert.equal(resolveBuildOrigin({ ...env, VITE_PUBLIC_APP_URL }, { requireOrigin: true }), origin);
  }
  assert.equal(resolveBuildOrigin({ ...env, VITE_PUBLIC_APP_URL: 'https://custom.example/' }), 'https://custom.example');
  assert.throws(() => resolveBuildOrigin({ ...env, VITE_PUBLIC_APP_URL: 'invalid' }));
  assert.throws(() => resolveBuildOrigin({ ...env, URL: 'http://insecure.example' }));
  assert.throws(() => resolveBuildOrigin({ ...env, URL: '' }, { requireOrigin: true }));
});
test('Netlify previews remain unindexed even with an inherited production origin', () => {
  for (const CONTEXT of ['deploy-preview', 'branch-deploy', 'dev', undefined]) {
    assert.equal(resolveBuildOrigin({ NETLIFY: 'true', CONTEXT, URL: origin, VITE_PUBLIC_APP_URL: origin }), '');
  }
});
test('explicit previews and Vercel previews cannot inherit production indexing', () => {
  for (const env of [
    { DEPLOYMENT_ENV: 'preview' },
    { VERCEL: '1', VERCEL_ENV: 'preview' },
    { VERCEL: '1', VERCEL_ENV: 'development' },
    { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'staging' },
    { VERCEL: '1' },
    { DEPLOYMENT_ENV: 'production', NETLIFY: 'true', CONTEXT: 'deploy-preview' },
  ]) {
    assert.equal(resolveBuildOrigin({ ...env, VITE_PUBLIC_APP_URL: origin }), '');
    assert.throws(() => resolveBuildOrigin({ ...env, VITE_PUBLIC_APP_URL: origin }, { requireOrigin: true }));
  }
  assert.equal(resolveBuildOrigin({ VERCEL: '1', VERCEL_ENV: 'production', VITE_PUBLIC_APP_URL: origin }), origin);
  assert.throws(() => resolveBuildOrigin({ DEPLOYMENT_ENV: 'typo', VITE_PUBLIC_APP_URL: origin }), /DEPLOYMENT_ENV/);
});
test('other build environments still require an explicitly configured production origin', () => {
  const env = { URL: origin, CONTEXT: 'production' };
  assert.equal(resolveBuildOrigin(env), '');
  assert.throws(() => resolveBuildOrigin(env, { requireOrigin: true }), /VITE_PUBLIC_APP_URL/);
  assert.equal(resolveBuildOrigin({ ...env, VITE_PUBLIC_APP_URL: origin }, { requireOrigin: true }), origin);
});
test('all public routes have unique canonical metadata and valid catalog structured data', () => {
  const titles = new Set(), descriptions = new Set();
  assert.deepEqual(publicPaths, ['/', '/templates', '/mind-map-maker', '/online-whiteboard', '/visual-planning', '/about', '/help']);
  for (const path of publicPaths) {
    const page = pageMetadata(path, origin);
    assert.equal(page.canonical, `${origin}${path}`);
    assert.match(page.robots, /^index, follow/);
    assert.ok(page.image.startsWith(`${origin}/social/`));
    assert.ok(page.title.includes(brand.name));
    assert.ok(!titles.has(page.title)); titles.add(page.title);
    assert.ok(!descriptions.has(page.description)); descriptions.add(page.description);
    assert.equal(page.schema['@context'], 'https://schema.org');
    assert.ok(!JSON.stringify(page.schema).includes('aggregateRating'));
    assert.equal(pageMetadata(`${path === '/' ? '' : path}/`, origin).canonical, page.canonical);
    const graph = page.schema['@graph'];
    const ids = new Set(graph.map(item => item['@id']));
    assert.equal(ids.size, graph.length, 'Entities have unique stable identities');
    const checkReferences = value => {
      if (!value || typeof value !== 'object') return;
      if (Object.keys(value).length === 1 && value['@id']) assert.ok(ids.has(value['@id']), `Unresolved entity: ${value['@id']}`);
      Object.values(value).forEach(checkReferences);
    };
    checkReferences(graph);
    assert.equal(graph.find(item => item['@type'] === 'Brand').name, brand.name);
    assert.equal(graph.find(item => item['@type'] === 'WebApplication').image, `${origin}/social/home.png?v=${brand.assetVersion}`);
    if (path !== '/') assert.equal(graph.find(item => item['@type'] === 'BreadcrumbList').itemListElement.at(-1).item, page.canonical);
    const doc = new JSDOM(`<head>${renderHead(page)}</head>`).window.document;
    assert.equal(doc.querySelectorAll('title').length, 1);
    assert.equal(doc.querySelectorAll('[rel="canonical"]').length, 1);
    assert.equal(doc.querySelector('[property="og:url"]').content, page.canonical);
    assert.deepEqual(JSON.parse(doc.querySelector('script').textContent), page.schema);
  }
  const list = pageMetadata('/templates', origin).schema['@graph'].find(item => item['@type'] === 'ItemList');
  assert.deepEqual(list.itemListElement.map(item => item.url), templates.map(item => `${origin}${templatePath(item)}`));
});
test('brand and help resources have distinct public metadata and accurate page entities', () => {
  for (const resource of resourcePages) {
    const page = pageMetadata(resource.path, origin);
    assert.equal(page.title, resource.title);
    assert.equal(page.description, resource.description);
    assert.equal(page.schema['@graph'].find(entity => entity['@id'] === `${page.canonical}#page`)['@type'], resource.type);
    assert.ok(resource.sections.length >= 3);
    assert.equal(new Set(resource.sections.map(section => section.id)).size, resource.sections.length);
  }
  const about = pageMetadata('/about', origin);
  assert.equal(about.schema['@graph'].find(entity => entity['@type'] === 'AboutPage').mainEntity['@id'], `${origin}/#brand`);
});
test('public guides have actionable workflows, valid template picks, and distinct social previews', () => {
  const images = new Set();
  for (const page of productPages) {
    assert.ok(page.starter === null || templates.some(item => item.id === page.starter));
    assert.ok(templates.some(item => item.id === (page.preview || page.starter)));
    for (const id of page.templateIds) assert.ok(templates.some(item => item.id === id), `Missing template ${id}`);
    assert.ok(page.steps.length >= 3);
    assert.ok(page.faqs.length >= 2);
    assert.equal(page.social.nodes.length, 4);
    const metadata = pageMetadata(page.path, origin);
    assert.equal(metadata.description, page.description);
    assert.equal(metadata.title, page.title);
    assert.ok(!images.has(metadata.image)); images.add(metadata.image);
    assert.ok(metadata.imageAlt.includes(page.social.title));
  }
});
test('private, missing, and preview pages cannot emit public canonicals or board content', () => {
  for (const path of ['/projects', '/projects/favorites', '/projects/folders/Confidential', '/boards/private-id', '/share', '/share/', '/missing', '/templates/does-not-exist', '/templates/weekly-plan', '/mind-map-maker/not-real']) {
    const page = pageMetadata(path, origin);
    assert.match(page.robots, /^noindex/); assert.equal(page.canonical, ''); assert.equal(page.image, ''); assert.equal(page.schema, null);
    assert.ok(!renderHead(page).includes('Confidential'));
    assert.ok(!renderHead(page).includes('private-id'));
  }
  for (const path of publicPaths) {
    const page = pageMetadata(path, '');
    assert.match(page.robots, /^noindex/); assert.equal(page.canonical, ''); assert.equal(page.schema, null);
  }
});
test('head output escapes text and prevents structured-data script termination', () => {
  const malicious = '</script><script>alert(1)</script>\u2028';
  const value = safeJson({ name: malicious });
  assert.ok(!value.includes('</script>')); assert.deepEqual(JSON.parse(value), { name: malicious });
  const doc = new JSDOM(`<head>${renderHead({ ...pageMetadata('/', origin), title: malicious, description: '\"><img src=x>' })}</head>`).window.document;
  assert.equal(doc.title, malicious); assert.equal(doc.querySelectorAll('img').length, 0);
  assert.equal(doc.querySelectorAll('script').length, 1);
});

async function serviceWorker() {
  const handlers = {}, records = new Map(), deleted = [];
  let network = true;
  const cache = { addAll: async () => {}, put: async (key, response) => records.set(typeof key === 'string' ? key : key.url, response), match: async key => records.get(typeof key === 'string' ? key : key.url)?.clone() };
  const context = { URL, Promise, self: { location: { origin }, addEventListener: (name, handler) => { handlers[name] = handler; }, clients: { claim: async () => {} } }, caches: { open: async () => cache, keys: async () => ['unrelated-cache', 'nova-shell-v2', 'drawanything-shell-old', 'drawanything-shell-test'], delete: async key => deleted.push(key) }, fetch: async request => { if (!network) throw Error('offline'); return new Response(`HTML:${request.url}`, { headers: { 'Content-Type': 'text/html' } }); } };
  vm.runInNewContext((await readFile('public/sw.js', 'utf8')).replace('__BUILD_REVISION__', 'test').replace('/*__PRECACHE__*/', ''), context);
  records.set('/app.html', new Response('neutral application shell'));
  const navigate = async path => { let result; handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: `${origin}${path}` }, respondWith: promise => { result = promise; } }); return (await result).text(); };
  return { handlers, records, deleted, navigate, offline: () => { network = false; } };
}
test('offline navigation never confuses public pages with each other or private boards', async () => {
  const sw = await serviceWorker();
  await sw.navigate('/'); await sw.navigate('/templates?campaign=a'); await sw.navigate('/boards/private');
  await sw.navigate('/mind-map-maker'); await sw.navigate('/share/');
  assert.ok(sw.records.has('/')); assert.ok(sw.records.has('/templates'));
  assert.ok(!sw.records.has('/templates?campaign=a')); assert.ok(!sw.records.has('/boards/private'));
  assert.ok(!sw.records.has('/share/'));
  sw.offline();
  assert.equal(await sw.navigate('/'), `HTML:${origin}/`);
  assert.equal(await sw.navigate('/templates?campaign=b'), `HTML:${origin}/templates?campaign=a`);
  assert.equal(await sw.navigate('/boards/another'), 'neutral application shell');
  assert.equal(await sw.navigate('/mind-map-maker'), `HTML:${origin}/mind-map-maker`);
  assert.equal(await sw.navigate('/share/'), 'neutral application shell');
});
test('service-worker activation only removes this app’s old caches', async () => {
  const sw = await serviceWorker(); let done;
  sw.handlers.activate({ waitUntil: promise => { done = promise; } }); await done;
  assert.deepEqual(sw.deleted, ['nova-shell-v2', 'drawanything-shell-old']);
});
