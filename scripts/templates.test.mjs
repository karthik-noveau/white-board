import test from "node:test";
import assert from "node:assert/strict";
import { featuredTemplateIds, filterTemplates, templateCategories, templates } from "../src/data/templates.js";
import { nodeSize } from "../src/lib/boardAppearance.js";
import { normalizeCellContent, contentText, walkContent } from '../src/lib/cellContent.js';
import { templateHighlights } from '../src/data/templateWorkspaces.js';
import { createShareUrl, readShareLink } from '../src/lib/boardShare.js';
import { boardEdgeData } from '../src/lib/boardGeometry.js';
import { connectionLabelPoint } from '../src/lib/connectionLabels.js';

test('template connections travel between cards without crossing their content', () => {
  for (const template of templates) {
    const { nodes, edges, globalSettings } = template.board;
    for (const edge of boardEdgeData(nodes, edges, globalSettings)) {
      for (const node of nodes.filter(item => item.id !== edge.from && item.id !== edge.to)) {
        const size = nodeSize(node);
        for (let sample = 1; sample < 200; sample++) {
          const point = connectionLabelPoint(edge.path, sample / 200);
          assert.ok(!(point.x > node.x + 4 && point.x < node.x + size.width - 4 && point.y > node.y + 4 && point.y < node.y + size.height - 4), `${template.id}: a connection crosses ${node.title}`);
        }
      }
    }
  }
});

test("the curated catalog has unique IDs, valid categories, and useful getting-started guidance", () => {
  assert.deepEqual(filterTemplates().map(template => template.id), [
    'weekly-plan', 'project-plan', 'meeting-agenda', 'product-roadmap', 'brainstorm', 'study-notes',
    'product-discovery', 'business-strategy', 'website-architecture', 'product-launch',
  ]);
  assert.equal(templates.filter(template => template.complexity === 'simple').length, 6);
  assert.equal(templates.filter(template => template.complexity === 'complex').length, 4);
  assert.equal(new Set(templates.map(template => template.id)).size, templates.length);
  for (const category of templateCategories) assert.ok(filterTemplates(category.id).length > 0, category.name);
  for (const template of templates) {
    assert.ok(templateCategories.some(category => category.id === template.category), template.id);
    assert.equal(template.steps.length, 3, template.id);
    assert.ok(template.steps.every(step => step.length > 25), template.id);
    assert.ok(template.tags.length >= 3, template.id);
  }
  for (const id of featuredTemplateIds) assert.ok(templates.some(template => template.id === id));
});

test("every template is a connected, acyclic board with no overlapping nodes", () => {
  for (const { id, board } of templates) {
    const ids = new Set(board.nodes.map(node => node.id));
    assert.equal(ids.size, board.nodes.length, id);
    assert.equal(new Set(board.edges.map(edge => edge.id)).size, board.edges.length, id);
    const roots = board.nodes.filter(node => node.root);
    assert.equal(roots.length, 1, id);
    assert.equal(board.edges.length, board.nodes.length - 1, id);
    const visited = new Set(), pending = [roots[0].id];
    while (pending.length) {
      const nodeId = pending.pop();
      assert.ok(!visited.has(nodeId), `${id}: cycle or multiple parents`);
      visited.add(nodeId);
      for (const edge of board.edges.filter(edge => edge.from === nodeId)) {
        assert.ok(ids.has(edge.to), `${id}: dangling edge`);
        pending.push(edge.to);
      }
    }
    assert.equal(visited.size, ids.size, id);
    for (const [index, node] of board.nodes.entries()) {
      assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y), id);
      assert.ok(node.title.trim() && node.note.trim(), id);
      const a = nodeSize(node);
      for (const other of board.nodes.slice(index + 1)) {
        const b = nodeSize(other);
        const overlaps = node.x < other.x + b.width && node.x + a.width > other.x && node.y < other.y + b.height && node.y + a.height > other.y;
        assert.ok(!overlaps, `${id}: ${node.title} overlaps ${other.title}`);
      }
    }
  }
});

test('parents sit on the centerline of their child branches', () => {
  const center = node => { const size = nodeSize(node); return { x: node.x + size.width / 2, y: node.y + size.height / 2 }; };
  for (const template of templates) {
    const { nodes, edges } = template.board;
    for (const parent of nodes) for (const side of ['left', 'right', 'top', 'bottom']) {
      const children = edges.filter(edge => edge.from === parent.id && edge.side === side).map(edge => nodes.find(node => node.id === edge.to));
      if (children.length < 2) continue;
      const horizontal = side === 'left' || side === 'right';
      const axis = horizontal ? 'y' : 'x', baseline = horizontal ? 'x' : 'y';
      const centers = children.map(node => center(node)[axis]);
      assert.equal(center(parent)[axis], (Math.min(...centers) + Math.max(...centers)) / 2, `${template.id}: ${parent.title} is off-center`);
      assert.equal(new Set(children.map(node => node[baseline])).size, 1, `${template.id}: uneven child baseline`);
      assert.equal(new Set(children.map(node => nodeSize(node).height)).size, 1, `${template.id}: uneven child sizes`);
    }
  }
});

test("search combines category and words, including practical aliases", () => {
  assert.equal(filterTemplates().length, templates.length);
  assert.deepEqual(filterTemplates("planning", "  delivery   kickoff ").map(template => template.id), ["project-plan"]);
  assert.deepEqual(filterTemplates("all", "EXAM").map(template => template.id), ["study-notes"]);
  assert.deepEqual(filterTemplates("teamwork", "vacation"), []);
  assert.deepEqual(filterTemplates("all", "not-a-template"), []);
  assert.equal(filterTemplates("all", "learning life").length, 1);
  assert.equal(filterTemplates('all', 'simple').length, 0);
  assert.equal(filterTemplates('all', 'complex').length, 0);
  assert.deepEqual(filterTemplates('product', 'website content').map(template => template.id), ['website-architecture']);
  assert.deepEqual(filterTemplates('planning').map(template => template.id), ['weekly-plan', 'project-plan', 'product-launch']);
  assert.deepEqual(filterTemplates('strategy').map(template => template.id), ['brainstorm', 'business-strategy']);
});

test('templates have multiple levels of editable prompts and consistent branch styles', () => {
  for (const template of templates) {
    const { nodes, edges, globalSettings } = template.board;
    const root = nodes.find(node => node.root);
    assert.ok(template.complexity === 'complex' ? nodes.length === 7 : nodes.length >= 9 && nodes.length <= 13, template.id);
    assert.ok(edges.some(edge => edge.from !== root.id), `${template.id}: missing supporting ideas`);
    assert.equal(globalSettings.structure, 'elbow');
    for (const node of nodes) {
      assert.equal(node.shape, 'round');
      assert.ok(node.title.length <= 28 && (node.content || node.note.length <= 75), `${template.id}: oversized prompt`);
    }
    for (const edge of edges) {
      assert.equal(edge.structure, 'elbow');
      const parent = nodes.find(node => node.id === edge.from), child = nodes.find(node => node.id === edge.to);
      // The project phases have independent colors along their horizontal timeline.
      if (!parent.root && !(template.layout === 'phases' && edge.side === 'right')) assert.equal(child.color, parent.color, template.id);
    }
    const highlights = templateHighlights(template);
    if (template.complexity === 'simple') {
      assert.ok(highlights[0].count >= 3, template.id);
      assert.equal(highlights[1].count, nodes.length);
    } else {
      assert.ok(highlights.some(item => item.type === 'table'));
      assert.ok(highlights.some(item => item.type === 'checklist'));
      assert.ok(highlights.some(item => item.type === 'note'));
    }
  }
});

test('complex templates use valid native blocks, useful tables, and unchecked actions', () => {
  for (const template of templates) {
    const cards = template.board.nodes.filter(node => node.content);
    if (template.complexity === 'simple') { assert.equal(cards.length, 0); continue; }
    assert.equal(cards.length, 6, template.id);
    const ids = new Set(), types = new Set();
    const unique = id => { assert.ok(id && !ids.has(id), `${template.id}: duplicate block or slot ID`); ids.add(id); };
    for (const card of cards) {
      assert.deepEqual(normalizeCellContent(card.content), card.content);
      assert.equal(card.note, contentText(card.content));
      walkContent(card.content, ({ block }) => {
        unique(block.id); types.add(block.type);
        if (block.type === 'table') {
          assert.equal(block.columnWidths.length, block.headers.length);
          assert.ok(block.columnWidths.every(width => width >= 100));
          assert.ok(block.columnWidths.reduce((sum, width) => sum + width, 0) <= card.w - 50);
          for (const row of block.rows) { assert.equal(row.length, block.headers.length); row.forEach(slot => unique(slot.id)); }
        }
        if (block.type === 'checklist') assert.ok(block.tasks.every(task => task.text.trim() && !task.done));
      });
    }
    for (const type of ['table', 'checklist', 'note', 'heading', 'text', 'divider']) assert.ok(types.has(type), `${template.id}: missing ${type}`);
    if (template.id === 'website-architecture') { assert.ok(types.has('code')); assert.ok(types.has('link')); }
  }
});

test('a template copy can be edited without changing the catalog or another new board', () => {
  for (const template of templates) {
    const original = JSON.stringify(template.board);
    const first = structuredClone(template.board), second = structuredClone(template.board);
    const table = first.nodes.flatMap(node => node.content || []).find(block => block.type === 'table');
    if (table) table.rows[0][0].content[0].text = 'My evidence';
    const checklist = first.nodes.flatMap(node => node.content || []).find(block => block.type === 'checklist');
    if (checklist) checklist.tasks[0].done = true;
    first.nodes[1].note = 'My own supporting idea';
    first.nodes[1].x += 100;
    first.nodes[0].title = 'My project';
    first.edges[0].structure = 'curve';
    assert.equal(JSON.stringify(second), original, template.id);
    assert.equal(JSON.stringify(template.board), original, template.id);
  }
});

test('template cards and connections survive a portable board round trip', async () => {
  for (const template of templates) {
    const { id } = template;
    const url = await createShareUrl({ title: template.name, board: structuredClone(template.board) }, 'https://nova.example');
    const restored = await readShareLink(new URL(url).hash);
    assert.deepEqual(restored.project.board.nodes, template.board.nodes, id);
    assert.deepEqual(restored.project.board.edges, template.board.edges, id);
  }
});
