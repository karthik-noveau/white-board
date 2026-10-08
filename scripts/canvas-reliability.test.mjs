import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { applyAutomations } from '../src/lib/boardAutomations.js';
import { cardsFromClipboard, CARD_MIME, readCardPayload } from '../src/lib/cardClipboard.js';

const card = (id, title, extra = {}) => ({ id, title, x: id * 300, y: 100, color: 'white', shape: 'round', ...extra });
const rule = (from, to, extra = {}) => ({ id: `${from}-${to}`, enabled: true, whenField: 'status', whenValue: from, actionField: 'status', actionValue: to, ...extra });

test('opposing rules terminate and preserve the original card; unrelated rules still work', () => {
  const nodes = [card(1, 'Cycle', { status: 'todo' }), card(2, 'Ready', { status: 'done' })];
  const result = applyAutomations(nodes, [rule('todo', 'doing'), rule('doing', 'todo'), rule('done', 'true', { actionField: 'starred' })]);
  assert.equal(result.nodes[0], nodes[0]); assert.deepEqual(result.conflicts, [1]);
  assert.equal(result.nodes[1].starred, true);
  const repeated = applyAutomations(result.nodes, [rule('todo', 'doing'), rule('doing', 'todo'), rule('done', 'true', { actionField: 'starred' })]);
  assert.equal(repeated.nodes, result.nodes);
});

test('multi-pass cycles stop, while reversed rule chains reach their fixed point', () => {
  const nodes = [card(1, 'Task', { status: 'todo' })];
  const cycle = [rule('doing', 'done'), rule('todo', 'doing'), rule('done', 'todo')];
  assert.equal(applyAutomations(nodes, cycle).nodes, nodes);
  const chain = [rule('doing', 'done'), rule('todo', 'doing')];
  const result = applyAutomations(nodes, chain);
  assert.equal(result.nodes[0].status, 'done'); assert.deepEqual(result.conflicts, []);
  assert.equal(applyAutomations(result.nodes, chain).nodes, result.nodes);
  const locked = [card(1, 'Locked', { status: 'todo', locked: true })];
  assert.equal(applyAutomations(locked, chain).nodes, locked);
});

test('OS card clipboard wins and unrelated text never reuses cached cards', () => {
  const cached = { version: 1, nodes: [card(1, 'Old copy')], edges: [] };
  const fresh = { version: 1, nodes: [card(2, 'Fresh copy')], edges: [] };
  const transfer = values => ({ types: Object.keys(values), getData: type => values[type] || '' });
  assert.equal(cardsFromClipboard(transfer({ 'text/plain': 'External text' }), cached), null);
  assert.equal(cardsFromClipboard(transfer({ 'text/plain': 'Old copy' }), cached), cached);
  assert.equal(cardsFromClipboard(transfer({ [CARD_MIME]: JSON.stringify(fresh), 'text/plain': 'Old copy' }), cached).nodes[0].id, 2);
  assert.equal(cardsFromClipboard(transfer({ [CARD_MIME]: 'bad', 'text/plain': 'Old copy' }), cached), null);
  assert.equal(cardsFromClipboard(transfer({}), cached), null);
  assert.equal(readCardPayload(JSON.stringify({ ...cached, edges: [{}] })), null);
});

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, NodeFilter: dom.window.NodeFilter,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout,
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
window.requestAnimationFrame = requestAnimationFrame; window.cancelAnimationFrame = cancelAnimationFrame;
HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width: 1100, height: 700, right: 1100, bottom: 700 });
HTMLElement.prototype.scrollIntoView = () => {};
HTMLElement.prototype.scrollTo = () => {};
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
document.fonts = { ready: Promise.resolve() };
localStorage.setItem('nova-board-tour-v1', 'completed');
const require = createRequire(import.meta.url);
const React = require('react'), { act } = React;
const { createRoot } = require('react-dom/client');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router');

async function loadComponent(entry, exportName = 'default') {
  const result = await build({ entryPoints: [entry], write: false, bundle: true, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  return module.exports[exportName];
}
const BoardPreview = await loadComponent('src/components/BoardPreview.jsx');
const Canvas = await loadComponent('src/components/Canvas.jsx');

test('homepage playground keeps edits across examples and carries them into a real board', async () => {
  const Landing = await loadComponent('src/components/Landing.jsx');
  const root = createRoot(document.getElementById('root'));
  let created;
  try {
    await act(async () => { root.render(React.createElement(MemoryRouter, null, React.createElement(Landing, { onCreate: value => { created = value; } }))); });
    assert.equal(document.querySelector('iframe'), null);
    for (const label of ['Main navigation', 'Mobile navigation']) {
      const navigation = document.querySelector(`[aria-label="${label}"]`);
      assert.deepEqual([...navigation.querySelectorAll('a')].map(link => link.getAttribute('href')), ['/templates']);
    }
    assert.equal(document.querySelectorAll('header a[href^="#"]').length, 0);
    const field = document.querySelector('[aria-label="Your starting idea"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(field, 'A calmer start to the day');
      field.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await click(document.querySelector('#product input[type="checkbox"]'));
    await click([...document.querySelectorAll('#product button')].find(button => button.textContent.includes('Add your idea')));
    assert.equal(document.querySelectorAll('[data-play-idea]').length, 3);
    await click([...document.querySelectorAll('#product button')].find(button => button.textContent.includes('Plan a launch')));
    await click([...document.querySelectorAll('#product button')].find(button => button.textContent.includes('Brainstorm')));
    assert.equal(document.querySelector('[aria-label="Your starting idea"]').value, 'A calmer start to the day');
    await click([...document.querySelectorAll('#product button')].find(button => button.textContent.includes('Start with this board')));
    assert.equal(created.name, 'A calmer start to the day');
    assert.equal(created.board.nodes.length, 5);
    assert.equal(created.board.nodes.find(node => node.id === 'action').content[0].tasks[0].done, true);
    const { validateBoard } = await import('../src/lib/boardValidation.js');
    assert.doesNotThrow(() => validateBoard(created.board));
  } finally { await act(async () => root.unmount()); }
});

test('template navigation and previews never create projects; creation needs Use template', async () => {
  const Home = await loadComponent('src/components/Home.jsx');
  const WorkspaceLayout = await loadComponent('src/components/WorkspaceLayout.jsx');
  const TemplatePage = await loadComponent('src/components/TemplatePage.jsx');
  const { Routes, Route } = require('react-router');
  const root = createRoot(document.getElementById('root'));
  let creations = 0;
  const onCreate = () => { creations++; };
  try {
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/projects'] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: '/projects', element: React.createElement(WorkspaceLayout, { projects: [], deletedProjects: [], onCreate }) },
          React.createElement(Route, { index: true, element: React.createElement(Home, { projects: [], deletedProjects: [], onCreate }) }),
          React.createElement(Route, { path: 'templates', element: React.createElement(TemplatePage, { onCreate, workspace: true }) }),
          React.createElement(Route, { path: 'templates/:templateId', element: React.createElement(TemplatePage, { onCreate, workspace: true }) }),
        ),
        React.createElement(Route, { path: '/templates', element: React.createElement(TemplatePage, { onCreate }) }),
        React.createElement(Route, { path: '/templates/:templateId', element: React.createElement(TemplatePage, { onCreate }) }),
      ))));
    assert.ok(!document.body.textContent.includes('Start something new'));
    assert.ok(!document.body.textContent.includes('A fresh canvas'));
    const sidebar = document.querySelector('aside');
    await click(sidebar.querySelector('a[href="/projects/templates"]'));
    assert.ok(document.querySelector('main[data-template-library]'));
    assert.equal(document.querySelector('aside'), sidebar, 'the workspace navigation stays mounted');
    assert.equal(sidebar.querySelector('a[href="/projects/templates"]').getAttribute('aria-current'), 'page');
    assert.equal(sidebar.querySelector('a[href="/projects"]').getAttribute('aria-current'), null);
    assert.ok(document.querySelector('main#workspace-content'));
    assert.equal(document.querySelector('dialog'), null);
    assert.equal(document.querySelectorAll('[data-template-id]').length, 10);
    for (const [category, count] of [['planning', 3], ['product', 3], ['teamwork', 1], ['strategy', 2], ['life', 1]]) {
      assert.equal(document.querySelectorAll(`[data-template-collection="${category}"] [data-template-id]`).length, count);
    }
    assert.doesNotMatch(document.body.textContent, /Complex templates|Simple templates/);
    assert.equal(sidebar.querySelector('a[href="/projects/templates"] small').textContent, '10');
    assert.equal(creations, 0);
    const previewButton = document.querySelector('[data-template-id="weekly-plan"]');
    assert.equal(previewButton.tagName, 'BUTTON');
    previewButton.focus();
    await click(document.querySelector('[data-template-id="weekly-plan"]'));
    assert.equal(document.querySelector('aside'), sidebar, 'template previews keep the workspace mounted');
    assert.equal(document.querySelector('dialog[open] h2').textContent, 'Weekly priorities');
    assert.equal(document.querySelector('h1').textContent, 'Template library');
    assert.equal(document.querySelectorAll('[data-template-id]').length, 10, 'the gallery stays mounted behind the popup');
    assert.equal(document.querySelector('[data-template-detail]'), null);
    await click(document.querySelector('[aria-label="Close enlarged preview"]'));
    assert.equal(document.activeElement, previewButton, 'closing returns focus to the same gallery card');
    await click(document.querySelector('[data-template-id="weekly-plan"]'));
    assert.equal(creations, 0);
    await click([...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Use template'));
    assert.equal(creations, 1);
    await click(document.querySelector('[aria-label="Close enlarged preview"]'));
    await click(document.querySelector('[aria-label="Use template: Project plan"]'));
    assert.equal(creations, 2, 'a template can also be used directly from the gallery');
  } finally { await act(async () => root.unmount()); }
});

test('retired template detail and query links return to the correct gallery', async () => {
  const TemplatePage = await loadComponent('src/components/TemplatePage.jsx');
  const { Routes, Route, useLocation } = require('react-router');
  function Location() { return React.createElement('output', { 'data-route': true }, useLocation().pathname); }
  for (const library of ['/templates', '/projects/templates']) {
    for (const suffix of ['/weekly-plan', '?template=weekly-plan']) {
      const root = createRoot(document.getElementById('root'));
      try {
        const element = React.createElement(TemplatePage, { workspace: library.startsWith('/projects'), onCreate: () => assert.fail('navigation must not create a board') });
        await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: [library + suffix] },
          React.createElement(Location), React.createElement(Routes, null,
            React.createElement(Route, { path: library, element }),
            React.createElement(Route, { path: `${library}/:templateId`, element }),
          ))));
        assert.equal(document.querySelector('[data-route]').textContent, library);
        assert.equal(document.querySelector('h1').textContent, 'Template library');
        assert.equal(document.querySelectorAll('[data-template-id]').length, 10);
        assert.equal(document.querySelector('dialog'), null);
      } finally { await act(async () => root.unmount()); }
    }
  }
});

test('project menu shares the chosen board and returns focus without opening the editor', async () => {
  const Home = await loadComponent('src/components/Home.jsx');
  const { readShareLink } = await import('../src/lib/boardShare.js');
  const project = { id: 'share-from-menu', title: 'Share this project', updated: 1000, board: {
    nodes: [card(1, 'Visible idea', { presenterNote: 'Private note' }), card(2, 'Hidden idea', { hidden: true })], edges: [],
  } };
  const original = structuredClone(project);
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/projects'] }, React.createElement(Home, {
      projects: [project], deletedProjects: [], onExport: () => assert.fail('sharing should not export a file'),
    }))));
    const trigger = document.querySelector('[aria-label="More actions for Share this project"]');
    await click(trigger);
    await click([...document.querySelectorAll('nav button')].find(button => button.textContent === 'Share project'));
    assert.equal(document.querySelector('dialog[open] header p').textContent, project.title);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    for (let attempt = 0; attempt < 30 && !document.getElementById('share-url')?.value; attempt++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    }
    const result = await readShareLink(new URL(document.getElementById('share-url').value).hash);
    assert.equal(result.project.title, project.title);
    assert.equal(result.access, 'editable');
    assert.deepEqual(result.project.board.nodes.map(node => node.id), [1]);
    assert.equal(result.project.board.nodes[0].presenterNote, undefined);
    assert.deepEqual(project, original);
    assert.ok(document.querySelector('[aria-label="Search projects"]'), 'the project list stays mounted');
    await click(document.querySelector('[aria-label="Close share dialog"]'));
    assert.equal(document.querySelector('dialog[open]'), null);
    assert.equal(document.activeElement, trigger);
  } finally { await act(async () => root.unmount()); }
});

test('card checkboxes start selection and bulk actions preserve the selected project scope', async () => {
  const Home = await loadComponent('src/components/Home.jsx');
  const root = createRoot(document.getElementById('root'));
  const projects = ['First', 'Second'].map((title, index) => ({ id: `project-${index}`, title, updated: Date.now(), board: { nodes: [], edges: [] } }));
  const batches = [];
  try {
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/projects'] }, React.createElement(Home, {
      projects, deletedProjects: [], onBatchAction: async (ids, action) => { batches.push({ ids, action }); return ids.length; },
    }))));
    const view = document.querySelector('[aria-label="Project view"]');
    assert.equal(view.querySelectorAll('button').length, 2);
    assert.ok(document.querySelector('a[aria-label="Open First"]'));
    assert.equal(document.querySelector('[aria-label="Selected project actions"]'), null);

    await click(document.querySelector('input[aria-label="Select First"]'));
    assert.ok(document.querySelector('input[aria-label="Select First"]').checked);
    assert.ok(document.querySelector('button[aria-label="Deselect First preview"]'));
    let actions = document.querySelector('[aria-label="Selected project actions"]');
    assert.ok(actions.textContent.includes('1 selected'));
    await click([...actions.querySelectorAll('button')].find(button => button.textContent === 'Export'));
    assert.deepEqual(batches, [{ ids: ['project-0'], action: 'export' }]);

    await click(actions.querySelector('input[type="checkbox"]'));
    assert.ok(document.querySelector('input[aria-label="Select Second"]').checked);
    await click(view.querySelector('[aria-label="List view"]'));
    actions = document.querySelector('[aria-label="Selected project actions"]');
    assert.ok(actions.textContent.includes('2 selected'));
    await click(actions.querySelector('[aria-label="Clear project selection"]'));
    assert.equal(document.querySelector('[aria-label="Selected project actions"]'), null);
    assert.equal(document.querySelector('input[aria-label="Select First"]').checked, false);
    assert.ok(document.querySelector('a[aria-label="Open First"]'));
    assert.equal(document.activeElement, document.getElementById('projects-title'));
  } finally { await act(async () => root.unmount()); }
});

async function mountProjectSelection(onBatchAction = async ids => ids.length) {
  const Home = await loadComponent('src/components/Home.jsx');
  const { useNavigate } = require('react-router');
  const root = createRoot(document.getElementById('root'));
  const projects = ['First', 'Second'].map((title, index) => ({ id: `project-${index}`, title, updated: Date.now(), board: { nodes: [], edges: [] } }));
  let navigate;
  function Harness() {
    navigate = useNavigate();
    return React.createElement(Home, { projects, deletedProjects: [], onBatchAction });
  }
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/projects'] }, React.createElement(Harness))));
  return { root, navigate: (...args) => navigate(...args) };
}
const selectionActions = () => document.querySelector('[aria-label="Selected project actions"]');
const selectionAction = text => [...selectionActions().querySelectorAll('button')].find(button => button.textContent === text);
const enterField = async (field, value) => act(async () => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, value);
  field.dispatchEvent(new window.Event('input', { bubbles: true }));
});
const escapeSelection = async target => act(async () => target.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));

test('selection stays cleared after searching, clearing search, and navigating back', async () => {
  const { root, navigate } = await mountProjectSelection();
  try {
    await click(document.querySelector('input[aria-label="Select First"]'));
    await enterField(document.querySelector('[aria-label="Search projects"]'), 'Second');
    assert.equal(selectionActions(), null);
    await click(document.querySelector('[aria-label="Clear search"]'));
    assert.equal(selectionActions(), null, 'clearing search must not revive the old selection');
    assert.equal(document.querySelector('input[aria-label="Select First"]').checked, false);

    await click(document.querySelector('input[aria-label="Select Second"]'));
    await act(async () => navigate('/projects/favorites'));
    assert.equal(selectionActions(), null);
    await act(async () => navigate(-1));
    assert.equal(selectionActions(), null, 'history navigation must not revive the old selection');
    assert.equal(document.querySelector('input[aria-label="Select Second"]').checked, false);
  } finally { await act(async () => root.unmount()); }
});

test('Escape clears selection but leaves dialogs and pending bulk work in control', async () => {
  let finishExport;
  const { root } = await mountProjectSelection(() => new Promise(resolve => { finishExport = resolve; }));
  try {
    await click(document.querySelector('input[aria-label="Select First"]'));
    await escapeSelection(document.querySelector('input[aria-label="Select First"]'));
    assert.equal(selectionActions(), null);
    assert.equal(document.activeElement, document.getElementById('projects-title'));

    await click(document.querySelector('input[aria-label="Select First"]'));
    const move = selectionAction('Move'); move.focus();
    await click(move);
    await escapeSelection(document.querySelector('dialog input'));
    assert.ok(selectionActions(), 'Escape inside a dialog must not clear the underlying selection');
    await act(async () => document.querySelector('dialog').dispatchEvent(new window.Event('cancel', { bubbles: true, cancelable: true })));
    assert.equal(document.querySelector('dialog'), null);
    assert.ok(selectionActions());
    assert.equal(document.activeElement, move);

    await click(selectionAction('Export'));
    assert.equal(selectionActions().getAttribute('aria-busy'), 'true');
    await escapeSelection(document.getElementById('projects-title'));
    assert.ok(selectionActions(), 'pending work must retain its selection');
    await act(async () => finishExport(1));
    await escapeSelection(document.querySelector('input[aria-label="Select First"]'));
    assert.equal(selectionActions(), null);
  } finally { await act(async () => root.unmount()); }
});

test('bulk Move preserves selection on failure and restores focus after a successful retry', async () => {
  let fail = true;
  const calls = [];
  const { root } = await mountProjectSelection(async (ids, action, value) => {
    calls.push({ ids, action, value });
    if (fail) throw new Error('Storage temporarily unavailable');
    return ids.length;
  });
  try {
    await click(document.querySelector('input[aria-label="Select First"]'));
    const move = selectionAction('Move'); move.focus();
    await click(move);
    await enterField(document.querySelector('dialog input'), 'Work');
    const submit = () => [...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Move projects');
    await click(submit());
    assert.ok(document.querySelector('dialog').textContent.includes('Storage temporarily unavailable'));
    assert.ok(document.querySelector('input[aria-label="Select First"]').checked);
    fail = false;
    await click(submit());
    assert.equal(document.querySelector('dialog'), null);
    assert.equal(selectionActions(), null);
    assert.equal(document.activeElement, document.getElementById('projects-title'));
    assert.deepEqual(calls, Array.from({ length: 2 }, () => ({ ids: ['project-0'], action: 'move', value: 'Work' })));
  } finally { await act(async () => root.unmount()); }
});

test('selection Escape works from page-body focus and respects consumed keyboard events', async () => {
  const { root } = await mountProjectSelection();
  try {
    await click(document.querySelector('input[aria-label="Select First"]'));
    document.activeElement.blur();
    assert.equal(document.activeElement, document.body);
    await escapeSelection(document.body);
    assert.equal(selectionActions(), null);
    assert.equal(document.activeElement, document.getElementById('projects-title'));

    await click(document.querySelector('input[aria-label="Select First"]'));
    const handled = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    handled.preventDefault();
    await act(async () => document.body.dispatchEvent(handled));
    assert.ok(selectionActions());
    const composing = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: true });
    await act(async () => document.body.dispatchEvent(composing));
    assert.ok(selectionActions());
    await escapeSelection(document.body);
    const idle = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    await act(async () => document.body.dispatchEvent(idle));
    assert.equal(idle.defaultPrevented, false, 'the selection listener is removed after finishing');
  } finally { await act(async () => root.unmount()); }
});

test('bulk Move restores useful focus when the dialog opens without a focused trigger', async () => {
  const { root } = await mountProjectSelection();
  try {
    await click(document.querySelector('input[aria-label="Select First"]'));
    document.activeElement.blur();
    assert.equal(document.activeElement, document.body);
    await click(selectionAction('Move'));
    await enterField(document.querySelector('dialog input'), 'Work');
    await click([...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Move projects'));
    assert.equal(document.querySelector('dialog'), null);
    assert.equal(selectionActions(), null);
    assert.equal(document.activeElement, document.getElementById('projects-title'));
  } finally { await act(async () => root.unmount()); }
});

test('opening the template page in a fresh workspace does not seed any projects', async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  const databaseFactory = new IDBFactory();
  const original = Object.getOwnPropertyDescriptor(window, 'indexedDB');
  const originalGlobal = globalThis.indexedDB;
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: databaseFactory });
  globalThis.indexedDB = databaseFactory;
  const App = await loadComponent('src/App.jsx');
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/templates'] }, React.createElement(App))));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    assert.ok(document.querySelector('main[data-template-library]'));
    const database = await new Promise((resolve, reject) => { const request = databaseFactory.open('nova-workspace'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const projects = await new Promise((resolve, reject) => { const request = database.transaction('projects').objectStore('projects').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    assert.deepEqual(projects, []);
    database.close();
  } finally {
    await act(async () => root.unmount());
    if (original) Object.defineProperty(window, 'indexedDB', original); else delete window.indexedDB;
    if (originalGlobal) globalThis.indexedDB = originalGlobal; else delete globalThis.indexedDB;
  }
});

test('project preview respects hidden cards, hidden frames, and collapsed branches', () => {
  const board = { nodes: [card(1, 'Visible', { collapsed: true }), card(2, 'CollapsedXYZ'), card(3, 'HiddenXYZ', { hidden: true }), card(4, 'FrameXYZ', { kind: 'frame', hidden: true }), card(5, 'FramedXYZ', { frameId: 4 })], edges: [{ id: 1, from: 1, to: 2 }] };
  const html = renderToStaticMarkup(React.createElement(BoardPreview, { board }));
  assert.ok(html.includes('Visible'));
  for (const title of ['CollapsedXYZ', 'HiddenXYZ', 'FrameXYZ', 'FramedXYZ']) assert.ok(!html.includes(title), title);
});

async function mountCanvas(extra = {}) {
  const root = createRoot(document.getElementById('root'));
  const props = { project: { id: 'audit', title: 'Audit board', board: { nodes: [card(1, 'Sample card')], edges: [], viewport: { x: 0, y: 0, scale: 1 } } }, onRename: async () => ({ ok: true }), onSave: async () => ({ ok: true }), ...extra };
  await act(async () => { root.render(React.createElement(MemoryRouter, null, React.createElement(Canvas, props))); });
  return root;
}
const click = async element => { assert.ok(element, 'element exists'); await act(async () => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))); };
const key = async (value, options = {}) => { await act(async () => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options }))); };

test('new boards without a saved viewport open centered and fully visible', async () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  try {
    for (const [width, height] of [[1100, 700], [2100, 1100]]) {
      HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width, height, right: width, bottom: height });
      for (const board of [undefined, { nodes: [card(1, 'Starting idea')], edges: [] }]) {
        const root = await mountCanvas({ project: { id: 'new-board', title: 'New board', board } });
        try {
          const nodes = [...document.querySelectorAll('[data-export-node]')];
          const [panX, panY, scale] = nodes[0].parentElement.style.transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
          const bounds = nodes.map(node => {
            const [x, y] = node.style.transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
            return { left: panX + x * scale, top: panY + y * scale,
              right: panX + (x + parseFloat(node.style.width)) * scale,
              bottom: panY + (y + parseFloat(node.style.height)) * scale };
          });
          const left = Math.min(...bounds.map(rect => rect.left)), right = Math.max(...bounds.map(rect => rect.right));
          const top = Math.min(...bounds.map(rect => rect.top)), bottom = Math.max(...bounds.map(rect => rect.bottom));
          assert.ok(Math.abs((left + right) / 2 - width / 2) <= 1, 'board is horizontally centered');
          assert.ok(Math.abs((top + bottom) / 2 - height / 2) <= 1, 'board is vertically centered');
          assert.ok(left >= 119 && right <= width - 119 && top >= 119 && bottom <= height - 119, 'every card fits inside the canvas controls');
        } finally { await act(async () => root.unmount()); }
      }
    }
  } finally { HTMLElement.prototype.getBoundingClientRect = originalRect; }
});

test('reopening a desktop board keeps its saved pan and zoom', async () => {
  const root = await mountCanvas({ project: { id: 'saved-view', title: 'Saved view', board: {
    nodes: [card(1, 'Off-center on purpose')], edges: [], viewport: { x: 84, y: -62, scale: .8 },
  } } });
  try {
    assert.equal(document.querySelector('[data-export-node]').parentElement.style.transform, 'translate(84px,-62px) scale(0.8)');
  } finally { await act(async () => root.unmount()); }
});

test('duplicate control keeps copied cards in the copied frame through save and undo', async () => {
  const saves = [];
  const original = { nodes: [card(1, 'Frame', { kind: 'frame', w: 700, h: 450 }), card(2, 'Child', { frameId: 1 })], edges: [], viewport: { x: 0, y: 0, scale: 1 } };
  const root = await mountCanvas({ project: { id: 'duplicate', title: 'Frame copy', board: original },
    onSave: async (id, board) => { saves.push(structuredClone(board)); return { ok: true }; },
  });
  try {
    document.querySelector('[aria-label="Board canvas"]').focus();
    await key('a', { metaKey: true });
    await click(document.querySelector('[aria-label="Duplicate"]'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    const board = saves.at(-1);
    assert.equal(board.nodes.length, 4);
    const frame = board.nodes.find(node => node.kind === 'frame' && node.id !== 1);
    const child = board.nodes.find(node => node.kind !== 'frame' && node.id !== 2);
    assert.equal(child.frameId, frame.id);
    await click(document.querySelector('[aria-label="Undo"]'));
    assert.equal(document.querySelectorAll('[data-export-node]').length, 2);
    await click(document.querySelector('[aria-label="Redo"]'));
    assert.equal(document.querySelectorAll('[data-export-node]').length, 4);
  } finally { await act(async () => root.unmount()); }
});

test('an older malformed date does not prevent opening the project list', async () => {
  const Home = await loadComponent('src/components/Home.jsx');
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Home, {
    projects: [{ id: 'bad-date', title: 'Recoverable board', updated: 1e20, board: { nodes: [], edges: [] } }], deletedProjects: [],
  })));
  assert.ok(html.includes('Edited date unavailable'));
  assert.ok(html.includes('Open Recoverable board'));
});

test('locked canvas rejects Delete, Enter and child creation, then editing works after unlock', async () => {
  const root = await mountCanvas();
  try {
    await click(document.querySelector('[data-export-node="1"]'));
    await click(document.querySelector('[aria-label="Lock canvas"]'));
    const stage = document.querySelector('[aria-label="Board canvas"]'); stage.focus();
    await key('Delete'); await key('Enter'); await key('Enter', { ctrlKey: true });
    assert.equal(document.querySelectorAll('[data-export-node]').length, 1);
    assert.equal(document.querySelectorAll('[contenteditable="true"]').length, 0);
    await click(document.querySelector('[aria-label="Unlock canvas"]'));
    stage.focus(); await key('Delete');
    assert.equal(document.querySelectorAll('[data-export-node]').length, 0);
  } finally { await act(async () => root.unmount()); }
});

test('conflict recovery saves the current board as a new copy', async () => {
  const conflict = Object.assign(new Error('This board changed in another tab.'), { code: 'PROJECT_CONFLICT' });
  let recovered;
  const root = await mountCanvas({ onSave: async () => ({ ok: false, error: conflict }), onSaveCopy: async value => { recovered = value; } });
  try {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    assert.ok(document.querySelector('[role="alert"]')?.textContent.includes('another tab'));
    await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Save as a new board'));
    assert.equal(recovered.board.nodes[0].title, 'Sample card'); assert.equal(recovered.title, 'Audit board');
  } finally { await act(async () => root.unmount()); }
});

test('canvas paste never inserts stale cards, but native DrawAnything card paste still works', async () => {
  const root = await mountCanvas();
  try {
    await click(document.querySelector('[data-export-node="1"]'));
    const data = {};
    const copy = new window.Event('copy', { cancelable: true });
    Object.defineProperty(copy, 'clipboardData', { value: { setData: (type, value) => { data[type] = value; } } });
    await act(async () => window.dispatchEvent(copy));
    assert.ok(data[CARD_MIME]);
    const paste = async values => {
      const event = new window.Event('paste', { cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { types: Object.keys(values), getData: type => values[type] || '' } });
      await act(async () => window.dispatchEvent(event));
    };
    await paste({ 'text/plain': 'External clipboard text' });
    assert.equal(document.querySelectorAll('[data-export-node]').length, 1);
    await paste(data);
    assert.equal(document.querySelectorAll('[data-export-node]').length, 2);
  } finally { await act(async () => root.unmount()); }
});

test('a mounted board with conflicting automations becomes idle and saves the original user content', async () => {
  const saves = [];
  const root = await mountCanvas({
    project: { id: 'cycle', title: 'Cycle', board: { nodes: [card(1, 'Original thought', { status: 'todo' })], edges: [], automationRules: [rule('todo', 'doing'), rule('doing', 'todo')], viewport: { x: 0, y: 0, scale: 1 } } },
    onSave: async (id, board) => { saves.push(board); return { ok: true }; },
  });
  try {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    assert.ok(saves.length > 0 && saves.length < 3);
    assert.equal(saves.at(-1).nodes[0].status, 'todo');
    assert.equal(saves.at(-1).nodes[0].title, 'Original thought');
  } finally { await act(async () => root.unmount()); }
});

test('workspace transfer menus expose both file and URL actions and support keyboard dismissal', async () => {
  const Actions = await loadComponent('src/components/WorkspaceFileActions.jsx');
  const root = createRoot(document.getElementById('root')), calls = [];
  try {
    await act(async () => root.render(React.createElement(Actions, { onImport: () => calls.push('file-in'), onImportUrl: () => calls.push('url-in'), onBackup: () => calls.push('file-out'), onBackupUrl: () => calls.push('url-out') })));
    for (const [label, first, second] of [['Import boards', 'file-in', 'url-in'], ['Back up workspace', 'file-out', 'url-out']]) {
      const trigger = document.querySelector(`[aria-label="${label}"]`);
      await click(trigger);
      assert.equal(document.querySelectorAll('[role="menuitem"]').length, 2);
      assert.equal(document.activeElement, document.querySelector('[role="menuitem"]'));
      await act(async () => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
      assert.equal(document.activeElement, document.querySelectorAll('[role="menuitem"]')[1]);
      await act(async () => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      assert.equal(document.querySelector('[role="menu"]'), null);
      assert.equal(document.activeElement, trigger);
      for (const [index, expected] of [[0, first], [1, second]]) {
        await click(trigger); await click(document.querySelectorAll('[role="menuitem"]')[index]);
        assert.equal(calls.at(-1), expected);
        assert.equal(document.querySelector('[role="menu"]'), null);
      }
    }
  } finally { await act(async () => root.unmount()); }
});

test('URL import previews without writes, keeps failures open, and prevents duplicate imports', async () => {
  const ImportDialog = await loadComponent('src/components/WorkspaceTransferDialog.jsx', 'ImportWorkspaceUrlDialog');
  const payload = { format: 'nova-workspace', version: 1, projects: [], folders: ['An empty folder'], shapeLibrary: [], versions: [] };
  const initialUrl = 'https://example.com/projects/restore#workspace.v1.json.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
  const root = createRoot(document.getElementById('root'));
  let calls = 0, closed = 0, finish;
  const onImport = async data => { assert.deepEqual(data, payload); calls++; if (calls === 1) throw new Error('Storage unavailable'); await new Promise(resolve => { finish = resolve; }); };
  try {
    await act(async () => root.render(React.createElement(ImportDialog, { initialUrl, onImport, onClose: () => closed++ })));
    assert.equal(document.querySelector('dialog h2').textContent, 'Import workspace');
    assert.equal(calls, 0); assert.equal(closed, 0);
    const submit = () => [...document.querySelectorAll('dialog button')].find(button => button.textContent.startsWith('Import'));
    await click(submit());
    assert.match(document.querySelector('[role="alert"]').textContent, /Storage unavailable/);
    assert.equal(closed, 0);
    await click(submit());
    assert.equal(submit().disabled, true);
    await click(submit());
    assert.equal(calls, 2);
    await act(async () => document.querySelector('dialog').dispatchEvent(new window.Event('cancel', { cancelable: true })));
    assert.equal(closed, 0);
    await act(async () => finish());
    assert.equal(closed, 1);
  } finally { await act(async () => root.unmount()); }
});

test('mobile Fit centers the board in the space between selection and navigation controls', async () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect, originalMedia = window.matchMedia;
  const rect = (left, top, width, height) => ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height });
  window.matchMedia = query => ({ matches: query.includes('760px'), addEventListener() {}, removeEventListener() {} });
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.matches('[data-scope-toolbar]')) return rect(8, 68, 344, 115);
    if (this.matches('[data-tour="navigation"]')) return rect(43, 680, 274, 52);
    if (this.matches('[aria-label="Board tools"]')) return rect(40, 68, 280, 62);
    return rect(0, 60, 360, 680);
  };
  let root;
  try {
    root = await mountCanvas();
    await click(document.querySelector('[data-export-node]'));
    await click(document.querySelector('[aria-label="Center and fit board"]'));
    const node = document.querySelector('[data-export-node]');
    const [panX, panY, scale] = node.parentElement.style.transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const [x, y] = node.style.transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.ok(Math.abs(panX + (x + parseFloat(node.style.width) / 2) * scale - 180) <= 1);
    assert.ok(Math.abs(60 + panY + (y + parseFloat(node.style.height) / 2) * scale - (183 + 680) / 2) <= 1);
  } finally {
    if (root) await act(async () => root.unmount());
    HTMLElement.prototype.getBoundingClientRect = originalRect; window.matchMedia = originalMedia;
  }
});

test('More card actions preserves duplication, locking, and keyboard focus', async () => {
  const root = await mountCanvas();
  try {
    await click(document.querySelector('[data-export-node]'));
    await click(document.querySelector('[aria-label="More card actions"]'));
    const menu = () => document.querySelector('[role="menu"][aria-label="More card actions"]');
    const action = label => [...menu().querySelectorAll('button')].find(button => button.textContent === label);
    assert.equal(document.activeElement.textContent, 'Focus on branch');
    await click(action('Duplicate'));
    assert.equal(document.querySelectorAll('[data-export-node]').length, 2);
    assert.equal(menu(), null);
    await click(document.querySelector('[aria-label="More card actions"]'));
    await click(action('Lock selection'));
    assert.equal(menu(), null);
    await click(document.querySelector('[aria-label="More card actions"]'));
    assert.ok(action('Unlock selection'));
    assert.equal(action('Delete').disabled, true);
    await click(action('Unlock selection'));
    await click(document.querySelector('[aria-label="More card actions"]'));
    await act(async () => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.equal(menu(), null);
    assert.equal(document.activeElement.getAttribute('aria-label'), 'More card actions');
  } finally { await act(async () => root.unmount()); }
});
