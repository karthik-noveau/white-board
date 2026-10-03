import test from "node:test";
import assert from "node:assert/strict";
import { featuredTemplateIds, filterTemplates, templateCategories, templates } from "../src/data/templates.js";
import { nodeSize } from "../src/lib/boardAppearance.js";

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
