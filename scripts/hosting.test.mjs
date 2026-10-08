import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { previewRouting } from './preview-routing.mjs';

async function fixture(t, robots = 'index, follow') {
  const root = await mkdtemp(join(tmpdir(), 'drawanything-hosting-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const html = `<meta name="robots" content="${robots}"><h1>Public page</h1>`;
  await mkdir(join(root, 'about'));
  await writeFile(join(root, 'index.html'), html);
  await writeFile(join(root, 'about/index.html'), html);
  await writeFile(join(root, 'app.html'), '<h1>Private shell</h1>');
  await writeFile(join(root, '404.html'), '<h1>Missing page</h1>');
  await writeFile(join(root, 'brand.svg'), '<svg/>');
  let handle;
  previewRouting().configurePreviewServer({ config: { root, build: { outDir: '.' } }, middlewares: { use: middleware => { handle = middleware; } } });
  return async (url, method = 'GET') => {
    const result = { status: null, headers: {}, body: '', next: false };
    const response = { writeHead(status, headers = {}) { result.status = status; result.headers = headers; return this; }, end(body) { result.body = body?.toString() || ''; return this; } };
    await handle({ url, method }, response, error => { if (error) throw error; result.next = true; });
    return result;
  };
}

test('public aliases redirect once and preserve campaign query parameters', async t => {
  const request = await fixture(t);
  for (const [from, to] of [['/index.html', '/'], ['/about/', '/about'], ['/about/index.html', '/about'], ['/%61bout', '/about'], ['/templates/retired', '/templates']]) {
    const response = await request(`${from}?utm_source=newsletter`);
    assert.equal(response.status, 301, from);
    assert.equal(response.headers.Location, `${to}?utm_source=newsletter`);
  }
  assert.equal((await request('/about')).status, 200);
});

test('private and missing URLs use neutral noindex shells and correct statuses', async t => {
  const request = await fixture(t);
  for (const url of ['/projects', '/projects/folders/secret', '/boards/secret', '/share/', '/app.html']) {
    const response = await request(url);
    assert.equal(response.status, 200);
    assert.match(response.headers['X-Robots-Tag'], /^noindex/);
    assert.equal(response.body, '<h1>Private shell</h1>');
  }
  for (const url of ['/not-a-page', '/about/nope', '/404.html', '/%2F..%2Foutside.txt']) {
    const response = await request(url);
    assert.equal(response.status, 404, url);
    assert.match(response.headers['X-Robots-Tag'], /^noindex/);
  }
  assert.equal((await request('/invalid%escape')).status, 400);
  assert.equal((await request('/brand.svg')).next, true);
  assert.equal((await request('/about', 'HEAD')).body, '');
});

test('preview HTTP headers agree with HTML indexing directives', async t => {
  const preview = await fixture(t, 'noindex, nofollow, noarchive');
  assert.match((await preview('/about')).headers['X-Robots-Tag'], /^noindex/);
  const production = await fixture(t);
  assert.equal((await production('/about')).headers['X-Robots-Tag'], undefined);
});
