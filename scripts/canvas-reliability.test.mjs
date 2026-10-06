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

async function loadComponent(entry) {
  const result = await build({ entryPoints: [entry], write: false, bundle: true, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  return module.exports.default;
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
    const navigation = document.querySelector('[aria-label="Main navigation"]');
    assert.equal(navigation.querySelector('a').getAttribute('href'), '/templates');
    assert.equal(navigation.querySelectorAll('a[href^="#"]').length, 0);
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
  const TemplatePage = await loadComponent('src/components/TemplatePage.jsx');
  const { Routes, Route } = require('react-router');
  const root = createRoot(document.getElementById('root'));
  let creations = 0;
  const onCreate = () => { creations++; };
  try {
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/projects'] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: '/projects', element: React.createElement(Home, { projects: [], deletedProjects: [], onCreate }) }),
        React.createElement(Route, { path: '/templates', element: React.createElement(TemplatePage, { onCreate }) }),
        React.createElement(Route, { path: '/templates/:templateId', element: React.createElement(TemplatePage, { onCreate }) }),
      ))));
    assert.ok(!document.body.textContent.includes('Start something new'));
    assert.ok(!document.body.textContent.includes('A fresh canvas'));
    await click(document.querySelector('a[href="/templates"]'));
    assert.ok(document.querySelector('main[data-template-library]'));
    assert.equal(document.querySelector('dialog'), null);
    assert.equal(creations, 0);
    await click(document.querySelector('[data-template-id="weekly-plan"]'));
    assert.equal(creations, 0);
    await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Use template'));
    assert.equal(creations, 1);
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
