import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { publicOrigin, brand } from '../src/lib/brand.js';
import { pageMetadata, publicPaths, renderHead, safeJson, templatePath } from '../src/lib/seo.js';
import { templates } from '../src/data/templates.js';

const origin = 'https://whiteboard.example'; // Test fixture, never a deployment default.
test('production origin rejects ambiguous, insecure, and local addresses', () => {
  assert.equal(publicOrigin(''), '');
  assert.equal(publicOrigin(`${origin}/`), origin);
  for (const url of ['http://whiteboard.example', 'https://localhost', 'https://127.0.0.1', 'https://user:pass@whiteboard.example', `${origin}/app`, `${origin}?x=1`, `${origin}#hash`, 'not a url']) assert.throws(() => publicOrigin(url));
});
test('all public routes have unique canonical metadata and valid catalog structured data', () => {
  const titles = new Set(), descriptions = new Set();
  assert.equal(publicPaths.length, templates.length + 2);
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
    const doc = new JSDOM(`<head>${renderHead(page)}</head>`).window.document;
    assert.equal(doc.querySelectorAll('title').length, 1);
    assert.equal(doc.querySelectorAll('[rel="canonical"]').length, 1);
    assert.equal(doc.querySelector('[property="og:url"]').content, page.canonical);
    assert.deepEqual(JSON.parse(doc.querySelector('script').textContent), page.schema);
  }
  const list = pageMetadata('/templates', origin).schema['@graph'].find(item => item['@type'] === 'ItemList');
  assert.deepEqual(list.itemListElement.map(item => item.url), templates.map(item => `${origin}${templatePath(item)}`));
});
test('private, missing, and preview pages cannot emit public canonicals or board content', () => {
  for (const path of ['/projects', '/projects/favorites', '/projects/folders/Confidential', '/boards/private-id', '/share', '/missing', '/templates/does-not-exist']) {
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
  const cache = { addAll: async () => {}, put: async (key, response) => records.set(typeof key === 'string' ? key : key.url, response), match: async key => records.get(typeof key === 'string' ? key : key.url) };
  const context = { URL, Promise, self: { location: { origin }, addEventListener: (name, handler) => { handlers[name] = handler; }, clients: { claim: async () => {} } }, caches: { open: async () => cache, keys: async () => ['unrelated-cache', 'nova-shell-v2', 'drawanything-shell-old', 'drawanything-shell-test'], delete: async key => deleted.push(key) }, fetch: async request => { if (!network) throw Error('offline'); return new Response(`HTML:${request.url}`, { headers: { 'Content-Type': 'text/html' } }); } };
  vm.runInNewContext((await readFile('public/sw.js', 'utf8')).replace('__BUILD_REVISION__', 'test').replace('/*__PRECACHE__*/', ''), context);
  records.set('/app.html', new Response('neutral application shell'));
  const navigate = async path => { let result; handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: `${origin}${path}` }, respondWith: promise => { result = promise; } }); return (await result).text(); };
  return { handlers, records, deleted, navigate, offline: () => { network = false; } };
}
test('offline navigation never confuses public pages with each other or private boards', async () => {
  const sw = await serviceWorker();
  await sw.navigate('/'); await sw.navigate('/templates?campaign=a'); await sw.navigate('/boards/private');
  assert.ok(sw.records.has('/')); assert.ok(sw.records.has('/templates'));
  assert.ok(!sw.records.has('/templates?campaign=a')); assert.ok(!sw.records.has('/boards/private'));
  sw.offline();
  assert.equal(await sw.navigate('/'), `HTML:${origin}/`);
  assert.equal(await sw.navigate('/templates?campaign=b'), `HTML:${origin}/templates?campaign=a`);
  assert.equal(await sw.navigate('/boards/another'), 'neutral application shell');
});
test('service-worker activation only removes this app’s old caches', async () => {
  const sw = await serviceWorker(); let done;
  sw.handlers.activate({ waitUntil: promise => { done = promise; } }); await done;
  assert.deepEqual(sw.deleted, ['nova-shell-v2', 'drawanything-shell-old']);
});
