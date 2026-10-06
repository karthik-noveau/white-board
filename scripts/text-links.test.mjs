import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { normalizeLinkURL, textLinkDraft, textLinkHTML } from '../src/lib/textLinks.js';
import { restoreTextSelection } from '../src/lib/inlineFormatting.js';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.document = dom.window.document; globalThis.window = dom.window; globalThis.NodeFilter = dom.window.NodeFilter;
const { cleanBlockHTML } = await import('../src/lib/richContent.js');
const { sanitizeSharedProject } = await import('../src/lib/sharedBoardContent.js');
const editor = html => { const root = document.createElement('div'); root.innerHTML = html; document.body.replaceChildren(root); return root; };
const draft = (root, start, end) => textLinkDraft(root, restoreTextSelection(root, start, end));
const parse = html => { const host = document.createElement('div'); host.innerHTML = html; return host; };

test('link addresses normalize domains and reject unsafe schemes or credentials', () => {
  assert.equal(normalizeLinkURL(' example.com/docs '), 'https://example.com/docs');
  assert.equal(normalizeLinkURL('mailto:hello@example.com'), 'mailto:hello@example.com');
  assert.equal(normalizeLinkURL('tel:+123456789'), 'tel:+123456789');
  for (const url of ['', 'javascript:alert(1)', 'data:text/html,hello', 'file:///tmp/local', 'https://user:secret@example.com', 'not a url', 'java\nscript:alert(1)']) assert.equal(normalizeLinkURL(url), '');
});

test('editing inside an existing link expands to the link and reads saved options', () => {
  const root = editor('Before <a href="https://example.com" target="_self" title="Guide"><strong>useful link</strong></a> after');
  const value = draft(root, 9, 13);
  assert.equal(value.text, 'useful link'); assert.equal(value.existing, true);
  assert.equal(value.newTab, false); assert.equal(value.title, 'Guide');
  const output = parse(textLinkHTML(value, { ...value, url: 'docs.example.com', newTab: true }));
  const link = output.querySelector('a');
  assert.equal(link.href, 'https://docs.example.com/'); assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer'); assert.equal(link.querySelector('strong').textContent, 'useful link');
});

test('applying a link across paragraphs preserves formatting and avoids nested anchors', () => {
  const root = editor('<p><strong>First</strong> <a href="https://old.example">old</a></p><ul><li><em>Second</em></li></ul>');
  const range = document.createRange(); range.selectNodeContents(root);
  const value = textLinkDraft(root, range);
  const output = parse(textLinkHTML(value, { ...value, url: 'https://new.example', newTab: false }));
  assert.equal(output.textContent, root.textContent); assert.equal(output.querySelectorAll('a').length, 2);
  assert.equal(output.querySelectorAll('a a, a p, a ul').length, 0);
  assert.equal(output.querySelector('p a strong').textContent, 'First');
  assert.equal(output.querySelector('ul li a em').textContent, 'Second');
  for (const link of output.querySelectorAll('a')) { assert.equal(link.target, '_self'); assert.equal(link.rel, ''); }
});

test('display text is escaped and an empty selection inserts the URL as its label', () => {
  const root = editor('Start'); const value = draft(root, 5, 5);
  const output = parse(textLinkHTML(value, { ...value, text: '<img src=x onerror=alert(1)>', url: 'example.com', title: 'A "title"', newTab: true }));
  assert.equal(output.querySelector('img'), null); assert.equal(output.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(output.querySelector('a').title, 'A "title"');
  assert.equal(parse(textLinkHTML(value, { ...value, url: 'example.com' })).textContent, 'https://example.com/');
  assert.equal(textLinkHTML(value, { ...value, url: 'javascript:alert(1)' }), null);
});

test('removing a link preserves its text and inline formatting', () => {
  const root = editor('Before <a href="https://example.com"><strong>Keep <em>this</em></strong></a> after');
  const output = parse(textLinkHTML(draft(root, 8, 10), null));
  assert.equal(output.querySelector('a'), null); assert.equal(output.querySelector('strong').textContent, 'Keep this');
  assert.equal(output.querySelector('em').textContent, 'this');
});

test('linking text inside nested inline marks retains those marks', () => {
  const root = editor('A <mark>big <code>question</code></mark>.');
  const value = draft(root, 6, 14);
  const output = parse(textLinkHTML(value, { ...value, url: 'example.com', newTab: true }));
  assert.equal(output.querySelector('a mark code').textContent, 'question');
});

test('block sanitization preserves both tab settings, title and safe relations across repeated saves', () => {
  const input = '<a href="https://same.example" target="_self" title="Same tab">Same</a><a href="https://new.example" target="_blank" rel="opener">New</a><a href="https://legacy.example">Legacy</a><a href="javascript:alert(1)">Unsafe</a>';
  const output = parse(cleanBlockHTML(cleanBlockHTML(input)));
  const [same, fresh, legacy] = output.querySelectorAll('a');
  assert.equal(same.target, '_self'); assert.equal(same.title, 'Same tab'); assert.equal(same.rel, '');
  assert.equal(fresh.target, '_blank'); assert.equal(fresh.rel, 'noopener noreferrer');
  assert.equal(legacy.target, '_blank'); assert.equal(output.querySelectorAll('a').length, 3);
});

test('shared card titles and notes retain link settings without admitting unsafe links', () => {
  const html = '<a href="https://example.com" target="_blank" title="Guide">New</a><a href="https://example.org" target="_self">Same</a><a href="javascript:alert(1)">Unsafe</a>';
  const project = sanitizeSharedProject({ board: { nodes: [{ id: 1, titleHtml: html, noteHtml: html }], edges: [] } });
  for (const key of ['titleHtml', 'noteHtml']) {
    const links = parse(project.board.nodes[0][key]).querySelectorAll('a');
    assert.equal(links.length, 2); assert.equal(links[0].target, '_blank'); assert.equal(links[0].rel, 'noopener noreferrer');
    assert.equal(links[0].title, 'Guide'); assert.equal(links[1].target, '_self');
  }
});
