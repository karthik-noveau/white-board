import assert from "node:assert/strict";
import test from "node:test";
import { branchStyleScope, branchStyleSettings, applyBranchStyle, childBranchStyle } from "../src/lib/branchStyles.js";

const defaults = { shape: "round", color: "white", structure: "elbow", pattern: "solid", weight: "regular" };
const nodes = [
  { id: 1, root: true, title: "Root", shape: "round", color: "violet" },
  { id: 2, title: "Branch A", shape: "round", color: "blue" },
  { id: 3, title: "A child", shape: "round", color: "blue" },
  { id: 4, title: "Branch B", shape: "rectangle", color: "green" },
  { id: 5, title: "Independent root", root: true, shape: "pill", color: "pink" },
  { id: 6, title: "Independent child", shape: "pill", color: "pink" },
];
const edges = [
  { id: 11, from: 1, to: 2 }, { id: 12, from: 2, to: 3 },
  { id: 13, from: 1, to: 4 }, { id: 14, from: 5, to: 6 },
];

test("selecting Adopt styles the whole journey on both sides and excludes the disconnected idea", () => {
  const journey = ["Discover", "Consider", "Start", "Adopt", "Advocate", "Opportunity", "New idea"]
    .map((title, index) => ({ id: index + 1, title, root: index === 0, shape: "round", color: "orange" }));
  const connections = [[1, 2], [2, 3], [3, 4], [4, 5], [3, 6]]
    .map(([from, to], index) => ({ id: index + 1, from, to, structure: "straight", pattern: "solid", weight: "regular" }));
  const original = structuredClone({ journey, connections });
  for (const [selectedIds, selectedEdge] of [[[4], null], [[], 3], [[], 4]]) {
    const scope = branchStyleScope(journey, connections, selectedIds, selectedEdge);
    assert.deepEqual([...scope.nodeIds].sort(), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual([...scope.edgeIds], [1, 2, 3, 4, 5]);
    for (const [key, value] of [["shape", "pill"], ["color", "blue"]]) {
      const result = applyBranchStyle(journey, connections, scope, key, value);
      assert.ok(result.nodes.slice(0, 6).every(node => node[key] === value));
      assert.equal(result.nodes[6], journey[6]);
      assert.equal(result.edges, connections);
    }
    for (const [key, value] of [["structure", "curve"], ["pattern", "dotted"], ["weight", "bold"]]) {
      const result = applyBranchStyle(journey, connections, scope, key, value);
      assert.ok(result.edges.every(edge => edge[key] === value));
      assert.ok(result.nodes.slice(0, 6).every(node => node.branchStyle[key] === value));
      assert.equal(result.nodes[6], journey[6]);
    }
  }
  assert.deepEqual({ journey, connections }, original);
  const reversed = connections.map(edge => ({ ...edge, from: edge.to, to: edge.from }));
  assert.deepEqual([...branchStyleScope(journey, reversed, [4]).nodeIds].sort(), [1, 2, 3, 4, 5, 6]);
});

test("a selection styles its entire connected branch, including ancestors and siblings", () => {
  const scope = branchStyleScope(nodes, edges, [2]);
  assert.deepEqual([...scope.nodeIds].sort(), [1, 2, 3, 4]);
  assert.deepEqual([...scope.edgeIds], [11, 12, 13]);
  const colored = applyBranchStyle(nodes, edges, scope, "color", "orange");
  assert.deepEqual(colored.nodes.map(node => node.color), ["orange", "orange", "orange", "orange", "pink", "pink"]);
  assert.equal(colored.edges, edges);
  assert.equal(colored.nodes[4], nodes[4]);
  const styled = applyBranchStyle(nodes, edges, scope, "pattern", "dashed");
  assert.deepEqual(styled.edges.map(edge => edge.pattern), ["dashed", "dashed", "dashed", undefined]);
  assert.equal(styled.edges[3], edges[3]);
  assert.equal(styled.nodes[1].branchStyle.pattern, "dashed");
  assert.equal(styled.nodes[4], nodes[4]);
  assert.deepEqual(defaults, { shape: "round", color: "white", structure: "elbow", pattern: "solid", weight: "regular" });
});

test("root and multiple selections affect only their own trees, including the root shape", () => {
  const scope = branchStyleScope(nodes, edges, [1]);
  assert.deepEqual([...scope.nodeIds].sort(), [1, 2, 3, 4]);
  const result = applyBranchStyle(nodes, edges, scope, "shape", "ellipse");
  assert.equal(result.nodes[0].shape, "ellipse");
  assert.equal(result.nodes[4], nodes[4]);
  assert.deepEqual([...branchStyleScope(nodes, edges, [2, 5]).nodeIds].sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(branchStyleScope(nodes, edges, [2, 3]).branchCount, 1);
  assert.equal(branchStyleScope(nodes, edges, [2, 5]).branchCount, 2);
  for (const selectedId of [1, 2, 3, 4]) assert.deepEqual([...branchStyleScope(nodes, edges, [selectedId]).nodeIds].sort(), [1, 2, 3, 4]);
});

test("no selection, stale selection, frame selection, and locks cannot cause board-wide changes", () => {
  for (const ids of [[], [999], [7]]) {
    const scope = branchStyleScope([...nodes, { id: 7, kind: "frame" }], edges, ids);
    assert.deepEqual(applyBranchStyle(nodes, edges, scope, "color", "orange"), { nodes, edges });
    assert.equal(applyBranchStyle(nodes, edges, scope, "weight", "bold").edges, edges);
  }
  const lockedNodes = nodes.map(node => node.id === 3 ? { ...node, locked: true } : node);
  const lockedScope = branchStyleScope(lockedNodes, edges, [2]);
  assert.equal(lockedScope.locked, true);
  assert.equal(applyBranchStyle(lockedNodes, edges, lockedScope, "color", "orange").nodes, lockedNodes);
  assert.equal(applyBranchStyle(nodes, edges, branchStyleScope(nodes, edges, [2]), "weight", "bold", true).edges, edges);
});

test("selecting any line targets every line in that branch, including nested siblings", () => {
  const branchNodes = [...nodes, { id: 7, title: "Another A child", color: "blue", shape: "round" }];
  const branchEdges = [...edges, { id: 15, from: 2, to: 7 }];
  for (const selectedEdge of [11, 12, 13, 15]) {
    const scope = branchStyleScope(branchNodes, branchEdges, [], selectedEdge);
    assert.equal(scope.branchCount, 1);
    assert.deepEqual([...scope.nodeIds].sort(), [1, 2, 3, 4, 7]);
    assert.deepEqual([...scope.edgeIds], [11, 12, 13, 15]);
    for (const [key, value] of [["structure", "curve"], ["pattern", "dashed"], ["weight", "bold"]]) {
      const result = applyBranchStyle(branchNodes, branchEdges, scope, key, value);
      assert.deepEqual(result.edges.map(edge => edge[key]), [value, value, value, undefined, value]);
      assert.equal(result.edges[3], branchEdges[3]);
      assert.equal(result.nodes[4], branchNodes[4]);
      assert.equal(result.nodes[5], branchNodes[5]);
      assert.equal(result.nodes[1].branchStyle[key], value);
      assert.equal(branchStyleSettings(result.nodes, result.edges, scope, defaults)[key], value);
    }
  }
});

test("line selection handles independent trees, rootless trees, stale edges, and branch locks", () => {
  const independent = branchStyleScope(nodes, edges, [], 14);
  assert.deepEqual([...independent.edgeIds], [14]);
  const noRootFlags = nodes.map(({ root, ...node }) => node);
  assert.deepEqual([...branchStyleScope(noRootFlags, edges, [], 12).edgeIds], [11, 12, 13]);
  const empty = branchStyleScope(nodes, edges, [], 999);
  assert.equal(applyBranchStyle(nodes, edges, empty, "weight", "bold").edges, edges);
  const lockedNodes = nodes.map(node => node.id === 2 ? { ...node, locked: true } : node);
  const scope = branchStyleScope(lockedNodes, edges, [], 12);
  assert.equal(scope.locked, true);
  assert.equal(applyBranchStyle(lockedNodes, edges, scope, "pattern", "dotted").edges, edges);
});

test("mixed branch styles are not shown as one active choice", () => {
  const settings = branchStyleSettings(nodes, edges, branchStyleScope(nodes, edges, [1]), defaults);
  assert.equal(settings.color, null);
  assert.equal(settings.shape, null);
  assert.equal(settings.pattern, "solid");
  const selected = branchStyleSettings(nodes, edges, branchStyleScope(nodes, edges, [2]), defaults);
  assert.equal(selected.color, null);
  assert.equal(branchStyleSettings(nodes, edges, branchStyleScope(nodes, edges, [6]), defaults).color, "pink");
});

test("new children inherit branch styles, including settings chosen before a line exists", () => {
  const source = nodes[4], scope = branchStyleScope([source], [], [source.id]);
  const result = applyBranchStyle([source], [], scope, "structure", "curve");
  const inherited = childBranchStyle(result.nodes[0], [], defaults);
  assert.deepEqual(inherited, { shape: "pill", color: "pink", structure: "curve", pattern: "solid", weight: "regular" });
  assert.equal(branchStyleSettings(result.nodes, [], scope, defaults).structure, "curve");
  const withLine = childBranchStyle(nodes[1], [{ id: 20, from: 1, to: 2, weight: "bold" }], defaults);
  assert.equal(withLine.color, "blue");
  assert.equal(withLine.weight, "bold");
});

test("overlapping branches and cycles terminate, and dangling connections are excluded", () => {
  const connections = [...edges, { id: 15, from: 3, to: 2 }, { id: 16, from: 3, to: 999 }];
  const scope = branchStyleScope(nodes, connections, [2, 3]);
  assert.deepEqual([...scope.nodeIds].sort(), [1, 2, 3, 4]);
  assert.deepEqual([...scope.edgeIds], [11, 12, 13, 15]);
  const fromLine = branchStyleScope(nodes, connections, [], 12);
  assert.deepEqual([...fromLine.nodeIds].sort(), [1, 2, 3, 4]);
  assert.deepEqual([...fromLine.edgeIds], [11, 12, 13, 15]);
});
