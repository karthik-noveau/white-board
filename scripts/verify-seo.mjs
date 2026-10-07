import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { publicPaths, isWorkspacePath } from '../src/lib/seo.js';
import { templates } from '../src/data/templates.js';
import { brand } from '../src/lib/brand.js';

const output = process.env.SEO_OUTPUT_DIR || 'dist';
let origin = '';
for (const path of publicPaths) {
  const html = await readFile(`${output}${path === '/' ? '' : path}/index.html`, 'utf8');
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelectorAll('h1').length, 1, `${path}: one visible page heading`);
  assert.equal(doc.querySelectorAll('title').length, 1);
  assert.ok(doc.title.includes(brand.name));
  assert.ok(!/\bNova\b/.test(doc.body.textContent), `${path}: no previous brand in public copy`);
  assert.equal(doc.getElementById('root').dataset.prerendered, path);
  assert.ok(doc.getElementById('root').textContent.length > 300, `${path}: content present without JavaScript`);
  const canonical = doc.querySelector('[rel="canonical"]');
  if (path === '/') origin = canonical ? new URL(canonical.href).origin : '';
  if (origin) {
    assert.equal(canonical.href, `${origin}${path}`);
    assert.match(doc.querySelector('[name="robots"]').content, /^index/);
  } else { assert.equal(canonical, null); assert.match(doc.querySelector('[name="robots"]').content, /^noindex/); }
  const socialPath = doc.querySelector('[property="og:image"]')?.content;
  if (socialPath) {
    const bytes = await readFile(`${output}${new URL(socialPath).pathname}`);
    assert.equal(bytes.readUInt32BE(16), 1200); assert.equal(bytes.readUInt32BE(20), 630);
  }
  if (path === '/templates') for (const item of templates) {
    assert.ok(doc.getElementById(`template-${item.id}`));
    assert.ok(doc.querySelector(`button[data-template-id="${item.id}"][aria-haspopup="dialog"]`));
    assert.ok(doc.querySelector(`button[aria-label="Use template: ${item.name}"]`));
  }
  for (const link of doc.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (href.startsWith('#')) assert.ok(doc.getElementById(href.slice(1)), `${path}: broken section link ${href}`);
    else if (href.startsWith('/')) {
      const destination = new URL(href, 'https://validation.example').pathname;
      assert.ok(publicPaths.includes(destination) || isWorkspacePath(destination), `${path}: broken internal link ${href}`);
    }
  }
  for (const element of doc.querySelectorAll('script[src],link[rel="stylesheet"],link[rel="icon"],link[rel="apple-touch-icon"]')) {
    const asset = element.getAttribute('src') || element.getAttribute('href');
    assert.ok((await stat(`${output}${new URL(asset, 'https://validation.example').pathname}`)).isFile(), `Missing asset ${asset}`);
  }
}
for (const file of ['app.html', '404.html']) {
  const doc = new JSDOM(await readFile(`${output}/${file}`, 'utf8')).window.document;
  assert.match(doc.querySelector('[name="robots"]').content, /^noindex/);
  assert.equal(doc.querySelector('[rel="canonical"]'), null);
  assert.equal(doc.querySelector('[type="application/ld+json"]'), null);
}
const sitemap = new JSDOM(await readFile(`${output}/sitemap.xml`, 'utf8'), { contentType: 'application/xml' }).window.document;
assert.deepEqual([...sitemap.querySelectorAll('loc')].map(item => item.textContent), origin ? publicPaths.map(path => `${origin}${path}`) : []);
const sw = await readFile(`${output}/sw.js`, 'utf8');
assert.ok((await readFile(`${output}/_redirects`, 'utf8')).includes('/templates/* /templates 301!'));
assert.ok(!sw.includes('__BUILD_REVISION__')); assert.ok(!sw.includes('__PRECACHE__'));
const manifest = JSON.parse(await readFile(`${output}/manifest.webmanifest`, 'utf8'));
assert.equal(manifest.short_name, brand.name);
assert.ok(manifest.name.startsWith(brand.name));
for (const icon of manifest.icons) {
  assert.ok(icon.src.includes(`v=${brand.assetVersion}`), 'Installed icons use the current brand revision');
  assert.ok((await stat(`${output}${new URL(icon.src, 'https://validation.example').pathname}`)).isFile());
}
console.log(`Verified ${publicPaths.length} pre-rendered pages, private shells, sitemap, and brand assets (${origin || 'unindexed preview'}).`);
