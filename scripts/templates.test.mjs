import test from "node:test";
import assert from "node:assert/strict";
import { featuredTemplateIds, filterTemplates, templateCategories, templates } from "../src/data/templates.js";
import { nodeSize } from "../src/lib/boardAppearance.js";
import { normalizeCellContent, walkContent, contentText } from '../src/lib/cellContent.js';
import { templateHighlights } from '../src/data/templateWorkspaces.js';
import { createShareUrl, readShareLink } from '../src/lib/boardShare.js';

test("the curated catalog has unique IDs, valid categories, and useful getting-started guidance", () => {
  assert.equal(templates.length, 24);
  assert.equal(new Set(templates.map(template => template.id)).size, templates.length);
  for (const category of templateCategories) assert.equal(filterTemplates(category.id).length, 4, category.name);
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

test("search combines category and words, including practical aliases", () => {
  assert.equal(filterTemplates().length, templates.length);
  assert.deepEqual(filterTemplates("product", "  UX   interview ").map(template => template.id), ["user-research"]);
  assert.deepEqual(filterTemplates("all", "VACATION").map(template => template.id), ["trip-plan"]);
  assert.deepEqual(filterTemplates("teamwork", "vacation"), []);
  assert.deepEqual(filterTemplates("all", "not-a-template"), []);
  assert.equal(filterTemplates("all", "learning life").length, 4);
});

test('working templates contain valid editable tables and unchecked actions with unique block IDs', () => {
  const working = templates.filter(template => template.board.nodes.some(node => node.content));
  assert.equal(working.length, 18);
  for (const template of working) {
    const ids = new Set();
    assert.equal(template.board.nodes.filter(node => node.content).length, 4, template.id);
    assert.deepEqual(templateHighlights(template).map(item => item.type), ['table', 'checklist'], template.id);
    const unique = id => { assert.ok(id && !ids.has(id), `${template.id}: duplicate content ID ${id}`); ids.add(id); };
    for (const node of template.board.nodes.filter(node => node.content)) {
      assert.doesNotThrow(() => normalizeCellContent(node.content), template.id);
      assert.equal(node.note, contentText(node.content));
      walkContent(node.content, ({ block }) => {
        unique(block.id);
        if (block.type === 'table') {
          assert.ok(block.headers.length >= 2 && block.rows.length > 0, template.id);
          assert.equal(block.columnWidths.length, block.headers.length);
          assert.ok(block.columnWidths.every(width => width >= 100), template.id);
          assert.ok(block.columnWidths.reduce((sum, width) => sum + width, 0) <= nodeSize(node).width - 50, `${template.id}: table overflows its card`);
          for (const row of block.rows) {
            assert.equal(row.length, block.headers.length);
            for (const slot of row) unique(slot.id);
          }
        }
        if (block.type === 'checklist') assert.ok(block.tasks.every(task => task.text.trim() && task.done === false), template.id);
      }, node);
    }
  }
});

test('a template copy can be edited without changing the catalog or another new board', () => {
  for (const template of templates.filter(item => item.board.nodes.some(node => node.content))) {
    const original = JSON.stringify(template.board);
    const first = structuredClone(template.board), second = structuredClone(template.board);
    const card = first.nodes.find(node => node.content?.some(block => block.type === 'checklist'));
    card.content.find(block => block.type === 'checklist').tasks[0].done = true;
    first.nodes[0].title = 'My project';
    assert.equal(JSON.stringify(second), original, template.id);
    assert.equal(JSON.stringify(template.board), original, template.id);
  }
});

test('structured template content survives a portable board round trip', async () => {
  for (const id of ['weekly-plan', 'project-plan', 'meeting-agenda', 'user-research', 'trip-plan']) {
    const template = templates.find(item => item.id === id);
    const url = await createShareUrl({ title: template.name, board: structuredClone(template.board) }, 'https://nova.example');
    const restored = await readShareLink(new URL(url).hash);
    assert.deepEqual(restored.project.board.nodes, template.board.nodes, id);
  }
});
