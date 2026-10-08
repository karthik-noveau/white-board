import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { publicPaths, isWorkspacePath, pageMetadata } from '../src/lib/seo.js';
import { templates } from '../src/data/templates.js';
import { productPages } from '../src/data/productPages.js';
import { resourcePages } from '../src/data/resourcePages.js';
import { brand } from '../src/lib/brand.js';

const output = process.env.SEO_OUTPUT_DIR || 'dist';
let origin = '';
const documents = new Map(), titles = new Set(), descriptions = new Set();
for (const path of publicPaths) {
  const html = await readFile(`${output}${path === '/' ? '' : path}/index.html`, 'utf8');
  const doc = new JSDOM(html).window.document;
  documents.set(path, doc);
  assert.equal(doc.querySelectorAll('h1').length, 1, `${path}: one visible page heading`);
  assert.equal(doc.querySelectorAll('title').length, 1);
  assert.ok(doc.title.includes(brand.name));
  assert.ok(!titles.has(doc.title), `${path}: duplicate page title`); titles.add(doc.title);
  assert.equal(doc.querySelectorAll('[name="description"]').length, 1);
  const description = doc.querySelector('[name="description"]').content;
  assert.ok(!descriptions.has(description), `${path}: duplicate description`); descriptions.add(description);
  assert.equal(doc.querySelectorAll('[name="robots"]').length, 1);
  assert.equal(doc.documentElement.lang, 'en');
  assert.ok(doc.querySelector('nav[aria-label="Explore DrawAnything"]'), `${path}: shared public navigation`);
  assert.ok(!/\bNova\b/.test(doc.body.textContent), `${path}: no previous brand in public copy`);
  assert.equal(doc.getElementById('root').dataset.prerendered, path);
  assert.ok(doc.getElementById('root').textContent.length > 300, `${path}: content present without JavaScript`);
  const canonical = doc.querySelector('[rel="canonical"]');
  if (path === '/') origin = canonical ? new URL(canonical.href).origin : '';
  if (origin) {
    assert.equal(doc.querySelectorAll('[rel="canonical"]').length, 1);
    assert.equal(canonical.href, `${origin}${path}`);
    assert.match(doc.querySelector('[name="robots"]').content, /^index/);
    assert.equal(doc.querySelectorAll('[type="application/ld+json"]').length, 1);
    assert.deepEqual(JSON.parse(doc.querySelector('[type="application/ld+json"]').textContent), pageMetadata(path, origin).schema);
    assert.equal(doc.querySelector('[property="og:url"]').content, canonical.href);
    assert.equal(doc.querySelector('[name="twitter:card"]').content, 'summary_large_image');
  } else { assert.equal(canonical, null); assert.match(doc.querySelector('[name="robots"]').content, /^noindex/); }
  const socialPath = doc.querySelector('[property="og:image"]')?.content;
  if (socialPath) {
    const bytes = await readFile(`${output}${new URL(socialPath).pathname}`);
    assert.equal(bytes.readUInt32BE(16), 1200); assert.equal(bytes.readUInt32BE(20), 630);
  }
  // Assets must also be present in preview builds, where OG URLs are omitted.
  const social = await readFile(`${output}/social/${path === '/' ? 'home' : path.slice(1)}.png`);
  assert.equal(social.readUInt32BE(16), 1200); assert.equal(social.readUInt32BE(20), 630);
  const product = productPages.find(page => page.path === path);
  if (product) {
    assert.equal(doc.querySelector('h1').textContent, product.heading);
    for (const { title, text } of product.steps) {
      assert.ok(doc.body.textContent.includes(title)); assert.ok(doc.body.textContent.includes(text));
    }
    for (const { question, answer } of product.faqs) {
      assert.ok([...doc.querySelectorAll('summary')].some(item => item.textContent.includes(question)));
      assert.ok(doc.body.textContent.includes(answer));
    }
  }
  if (path === '/templates') for (const item of templates) {
    assert.ok(doc.getElementById(`template-${item.id}`));
    assert.ok(doc.querySelector(`button[data-template-id="${item.id}"][aria-haspopup="dialog"]`));
    assert.ok(doc.querySelector(`button[aria-label="Use template: ${item.name}"]`));
  }
  const resource = resourcePages.find(page => page.path === path);
  if (resource) {
    assert.equal(doc.querySelector('h1').textContent, resource.heading);
    for (const section of resource.sections) {
      const content = doc.getElementById(section.id);
      assert.ok(content, `${path}: missing help section ${section.id}`);
      for (const paragraph of section.paragraphs) assert.ok(content.textContent.includes(paragraph));
    }
  }
  for (const link of doc.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (href.startsWith('#')) assert.ok(doc.getElementById(href.slice(1)), `${path}: broken section link ${href}`);
    else if (href.startsWith('/')) {
      const destination = new URL(href, 'https://validation.example').pathname;
      if (link.hasAttribute('download')) assert.ok((await stat(`${output}${destination}`)).isFile(), `${path}: missing download ${href}`);
      else assert.ok(publicPaths.includes(destination) || isWorkspacePath(destination), `${path}: broken internal link ${href}`);
    }
  }
  for (const element of doc.querySelectorAll('script[src],img[src],link[rel="stylesheet"],link[rel="icon"],link[rel="apple-touch-icon"]')) {
    const asset = element.getAttribute('src') || element.getAttribute('href');
    assert.ok((await stat(`${output}${new URL(asset, 'https://validation.example').pathname}`)).isFile(), `Missing asset ${asset}`);
  }
  for (const source of doc.querySelectorAll('source[srcset]')) {
    for (const candidate of source.getAttribute('srcset').split(',')) {
      const [asset, width] = candidate.trim().split(/\s+/);
      assert.match(width, /^\d+w$/);
      assert.ok((await stat(`${output}${asset}`)).isFile(), `Missing responsive image ${asset}`);
    }
  }
}
// Crawl the generated internal link graph, including cross-page fragments.
const reachable = new Set();
function visit(path) {
  if (reachable.has(path)) return;
  reachable.add(path);
  for (const link of documents.get(path).querySelectorAll('a[href]')) {
    const url = new URL(link.getAttribute('href'), `https://validation.example${path}`);
    if (url.origin !== 'https://validation.example' || !documents.has(url.pathname)) continue;
    if (url.hash) assert.ok(documents.get(url.pathname).getElementById(decodeURIComponent(url.hash.slice(1))), `${path}: broken target ${url.pathname}${url.hash}`);
    visit(url.pathname);
  }
}
visit('/');
assert.equal(reachable.size, publicPaths.length, 'Every public page is reachable through real links');
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
const headers = await readFile(`${output}/_headers`, 'utf8');
for (const path of ['/projects', '/projects/*', '/boards', '/boards/*', '/share', '/404.html']) assert.ok(headers.includes(`${path}\n  X-Robots-Tag: noindex`));
const robots = await readFile(`${output}/robots.txt`, 'utf8');
assert.ok(origin ? robots.includes(`Sitemap: ${origin}/sitemap.xml`) && !robots.includes('Disallow: /') : robots.includes('Disallow: /'));
const favicon = await readFile(`${output}/favicon.ico`);
assert.equal(favicon.readUInt16LE(2), 1); assert.equal(favicon.readUInt16LE(4), 3);
for (const size of [32, 48, 180, 192, 512]) {
  const icon = await readFile(`${output}/icons/icon-${size}.png`);
  assert.equal(icon.readUInt32BE(16), size); assert.equal(icon.readUInt32BE(20), size);
}
const manifest = JSON.parse(await readFile(`${output}/manifest.webmanifest`, 'utf8'));
assert.equal(manifest.short_name, brand.name);
assert.ok(manifest.name.startsWith(brand.name));
for (const icon of manifest.icons) {
  assert.ok(icon.src.includes(`v=${brand.assetVersion}`), 'Installed icons use the current brand revision');
  assert.ok((await stat(`${output}${new URL(icon.src, 'https://validation.example').pathname}`)).isFile());
}
console.log(`Verified ${publicPaths.length} pre-rendered pages, private shells, sitemap, and brand assets (${origin || 'unindexed preview'}).`);
