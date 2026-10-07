import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { createShareUrl, readShareHash, readShareLink, sharedProjectCopy, isLocalShareUrl, MAX_SHARE_BYTES } from "../src/lib/boardShare.js";
import { createSavedView } from "../src/lib/boardViews.js";
import { templates } from "../src/data/templates.js";

const project = {
  id: "sender-board", title: "திட்டம் — Product 🚀", created: 1000, updated: 2000, accent: "violet", folder: "Plans",
  board: {
    nodes: [
      { id: 1, x: -122.5, y: 250, w: 320, h: 150, rotate: 12, title: "Build < & >", note: "Line one\nLine two", titleHtml: '<b>Build</b> <span style="color: rgb(20, 50, 80);">better</span>', noteHtml: "<ul><li>First</li><li>Second</li></ul>", root: true, collapsed: true, color: "blue", shape: "pill", groupId: "group-one", frameId: 3,
        comments: [{ id: "c1", text: "A note\nwith a second line", resolved: false, createdAt: 100 }, { id: "c2", text: "Done", resolved: true, createdAt: 200 }],
        tags: ["work"], links: [{ id: "link-1", label: "Example", url: "https://example.com" }], customValues: { effort: 5 }, branchStyle: { weight: "bold" }, timeSpent: 120, decision: "Approved" },
      { id: 2, x: 600, y: 400, title: "Hidden child", hidden: true, locked: true, color: "green", shape: "round" },
      { id: 3, x: -250, y: 100, title: "Frame", kind: "frame", w: 1200, h: 700, presenterNote: "Talk about this", presentationOrder: 1 },
    ],
    edges: [{ id: 1, from: 1, to: 2, controlX: 400, controlY: 310, structure: "elbow", pattern: "dashed", weight: "bold", side: "right", label: "Related" }],
    globalSettings: { shape: "round", color: "white", structure: "elbow", pattern: "solid", weight: "regular" },
    savedViews: [{ id: "view-1", name: "Overview", transform: { x: 20, y: -50, scale: 0.8 } }],
    automationRules: [{ id: "rule-1", enabled: true, whenField: "status", whenValue: "done", actionField: "starred", actionValue: "true" }],
    customFields: [{ id: "effort", name: "Effort", type: "number", options: [] }],
    teamMembers: [{ id: "member-1", name: "Team member", color: "green" }],
    goals: [{ id: "goal-1", name: "Launch", nodeIds: [1, 2] }],
    sprints: [{ id: "sprint-1", name: "Sprint one", start: "2026-09-01", end: "2026-09-20" }],
    activeTimer: { nodeId: 1, startedAt: 1500 }, viewport: { x: 80, y: -120, scale: 0.9 },
  },
};

function externalHash(value, encoding = "gzip") {
  const bytes = Buffer.from(JSON.stringify(value));
  return `#v1.${encoding}.${(encoding === "gzip" ? gzipSync(bytes) : bytes).toString("base64url")}`;
}
const envelope = value => ({ format: "nova-share", version: 1, project: value });
const allContent = { includeHidden: true, includeSavedViews: true };
const sharedProject = structuredClone(project);
delete sharedProject.board.nodes[2].presenterNote;

test("share URL carries opted-in board content independently of sender storage", async () => {
  const before = structuredClone(project);
  const link = await createShareUrl(project, "https://nova.example/boards/sender-board?old=1#ignored", allContent);
  const url = new URL(link);
  assert.equal(url.origin, "https://nova.example");
  assert.equal(url.pathname, "/share");
  assert.equal(url.search, "");
  assert.match(url.hash, /^#v2\.gzip\.[A-Za-z0-9_-]+$/);
  assert.ok(url.hash.length < Buffer.byteLength(JSON.stringify(project)));
  assert.deepEqual(await readShareHash(url.hash), sharedProject);
  assert.deepEqual(project, before);
});

test("every board template survives sharing without losing its geometry or styles", async () => {
  for (const template of templates) {
    const source = { id: template.id, title: template.name, accent: template.accent, board: template.board };
    assert.deepEqual(await readShareHash(new URL(await createShareUrl(source, "https://nova.example")).hash), source);
  }
});

test("share access travels with the snapshot while legacy links remain editable", async () => {
  for (const access of ["readonly", "editable"]) {
    const url = new URL(await createShareUrl(project, "https://nova.example", { access, ...allContent }));
    const decoded = await readShareLink(url.hash);
    assert.equal(decoded.access, access);
    assert.deepEqual(decoded.project, sharedProject);
    assert.match(url.hash, /^#v2\./);
  }
  assert.equal((await readShareLink(externalHash(envelope(project)))).access, "editable");
});

test("missing or unknown v2 access never falls back to an editable copy", async () => {
  for (const access of [undefined, null, "owner", "read-only", true, {}]) {
    const hash = externalHash({ format: "nova-share", version: 2, project, access }).replace("#v1.", "#v2.");
    await assert.rejects(readShareLink(hash), /invalid or incomplete/);
  }
  await assert.rejects(createShareUrl(project, "https://nova.example", { access: "owner" }), /Choose Read-only or Editable/);
  await assert.rejects(readShareLink(externalHash(envelope(project)).replace("#v1.", "#v2.")), /invalid or incomplete/);
});

test("independently encoded compressed and plain links load Unicode and all board fields", async () => {
  for (const encoding of ["gzip", "json"]) assert.deepEqual(await readShareHash(externalHash(envelope(project), encoding)), project);
});

test("link is an immutable snapshot even when the sender edits during compression", async () => {
  const mutable = structuredClone(project);
  const pending = createShareUrl(mutable, "https://nova.example", allContent);
  mutable.board.nodes[0].title = "Later edit";
  mutable.title = "Renamed later";
  const restored = await readShareHash(new URL(await pending).hash);
  assert.deepEqual(restored, sharedProject);
});

test("recipient gets a separate editable copy without replacing the sender or another local board", async () => {
  const received = await readShareHash(externalHash(envelope({ ...project, deletedAt: 10 })));
  const first = sharedProjectCopy(received, "recipient-one", 5000);
  const second = sharedProjectCopy(received, "recipient-two", 6000);
  assert.equal(first.id, "recipient-one");
  assert.equal(second.id, "recipient-two");
  assert.equal(first.updated, 5000);
  assert.equal(first.created, project.created);
  assert.equal(first.deletedAt, undefined);
  assert.deepEqual(first.board, project.board);
  first.board.nodes[0].title = "Recipient edit";
  assert.equal(second.board.nodes[0].title, project.board.nodes[0].title);
  assert.equal(received.board.nodes[0].title, project.board.nodes[0].title);
});

test("empty boards and string IDs are preserved", async () => {
  const empty = { title: "Empty", board: { nodes: [], edges: [] } };
  assert.deepEqual(await readShareHash(new URL(await createShareUrl(empty, "https://nova.example")).hash), empty);
  const strings = { title: "String IDs", board: { nodes: [{ id: "root", x: 0, y: 0 }, { id: "child", x: 250, y: 0 }], edges: [{ id: "edge", from: "root", to: "child" }] } };
  assert.deepEqual(await readShareHash(externalHash(envelope(strings))), strings);
});

test("missing, damaged, unsupported, or truncated links fail with a readable error", async () => {
  const valid = externalHash(envelope(project));
  for (const hash of ["", "#", "#v2.gzip.abc", "#v1.unknown.abc", "#v1.gzip.a", "#v1.gzip.%2F", "#v1.gzip.abcd.extra", valid.slice(0, -12), "#v1.gzip." + Buffer.from("not gzip").toString("base64url"), externalHash({ format: "other", version: 1, project })]) {
    await assert.rejects(readShareHash(hash), /invalid or incomplete/);
  }
});

test("invalid board records and dangling connections cannot reach the canvas", async () => {
  const changes = [
    value => { value.board.nodes = {}; },
    value => { value.board.nodes[0].x = "bad"; },
    value => { value.board.nodes[0].title = {}; },
    value => { value.board.nodes[0].comments = "bad"; },
    value => { value.board.nodes[0].comments[0].text = {}; },
    value => { value.board.nodes[1].id = 1; },
    value => { value.board.edges[0].to = 999; },
    value => { value.board.savedViews = "bad"; },
    value => { value.board.savedViews[0].transform = {}; },
    value => { value.board.viewport.scale = 0; },
    value => { value.board.goals[0].nodeIds = 9; },
    value => { value.title = {}; },
    value => { value.created = 1e20; },
    value => { value.updated = -1e20; },
  ];
  for (const change of changes) {
    const invalid = structuredClone(project);
    change(invalid);
    await assert.rejects(readShareHash(externalHash(envelope(invalid))), /invalid or incomplete/);
  }
  const polluted = JSON.parse(JSON.stringify(envelope(project)).replace('"title":', '"__proto__":{"polluted":true},"title":'));
  await assert.rejects(readShareHash(externalHash(polluted)), /invalid or incomplete/);
  assert.equal({}.polluted, undefined);
});

test("oversized boards, URL payloads, and decompression bombs are rejected rather than truncated", async () => {
  const huge = structuredClone(project);
  huge.board.nodes[0].note = "x".repeat(MAX_SHARE_BYTES);
  await assert.rejects(createShareUrl(huge, "https://nova.example"), /too large/);
  await assert.rejects(readShareHash(externalHash(envelope(huge))), /too large/);
  const incompressible = structuredClone(project);
  incompressible.board.nodes[0].note = randomBytes(850_000).toString("base64");
  await assert.rejects(createShareUrl(incompressible, "https://nova.example"), /too large/);
});

test("localhost links are clearly distinguished from public deployment links", () => {
  for (const origin of ["http://localhost:5183", "http://127.0.0.1:5183", "http://[::1]:5183", "http://dev.localhost:5183"]) assert.equal(isLocalShareUrl(origin), true);
  assert.equal(isLocalShareUrl("https://nova.example/share#payload"), false);
});


test("opted-in saved views retain nested content while excluding private notes", async () => {
  const source = structuredClone(project);
  const saved = createSavedView(source.board, source.board.viewport, "Full board", "snapshot", 5000);
  source.board.savedViews.push(saved);
  const received = await readShareHash(new URL(await createShareUrl(source, "https://nova.example", allContent)).hash);
  const expected = structuredClone(source);
  delete expected.board.nodes[2].presenterNote;
  delete expected.board.savedViews[1].board.nodes[2].presenterNote;
  assert.deepEqual(received, expected);
  assert.equal(saved.board.nodes[2].presenterNote, 'Talk about this', 'owner notes remain unchanged');
});

test('both share modes default to current, non-hidden content without private notes', async () => {
  const source = structuredClone(project);
  source.board.nodes.push(
    { id: 'private-frame', kind: 'frame', x: 0, y: 0, hidden: true, title: 'Hidden frame' },
    { id: 'nested-frame', kind: 'frame', x: 0, y: 0, frameId: 'private-frame' },
    { id: 'nested-card', x: 0, y: 0, frameId: 'nested-frame', note: 'Hidden frame content' },
    { id: 'collapsed-child', x: 0, y: 0, title: 'Expandable content' },
  );
  source.board.edges.push({ id: 'collapsed-edge', from: 1, to: 'collapsed-child' });
  source.board.activeTimer.nodeId = 2;
  source.board.savedViews.push(createSavedView(source.board, source.board.viewport, 'Old sensitive content'));
  const before = structuredClone(source);
  for (const access of ['readonly', 'editable']) {
    const received = await readShareLink(new URL(await createShareUrl(source, 'https://nova.example', { access })).hash);
    const board = received.project.board;
    assert.equal(received.access, access);
    assert.deepEqual(board.nodes.map(node => node.id), [1, 3, 'collapsed-child']);
    assert.deepEqual(board.edges.map(edge => edge.id), ['collapsed-edge']);
    assert.deepEqual(board.goals[0].nodeIds, [1]);
    assert.equal(board.activeTimer, null);
    assert.equal(board.savedViews, undefined);
    assert.ok(board.nodes.every(node => !Object.hasOwn(node, 'presenterNote')));
    assert.ok(!JSON.stringify(received).includes('Old sensitive content'));
  }
  assert.deepEqual(source, before);
});

test('sharing hidden cards and saved snapshots are independent opt-ins', async () => {
  const source = structuredClone(project);
  source.board.savedViews.push(createSavedView(source.board, source.board.viewport, 'Earlier version'));
  for (const includeHidden of [false, true]) for (const includeSavedViews of [false, true]) {
    const received = await readShareHash(new URL(await createShareUrl(source, 'https://nova.example', { includeHidden, includeSavedViews })).hash);
    assert.equal(received.board.nodes.some(node => node.id === 2), includeHidden);
    assert.equal(Boolean(received.board.savedViews), includeSavedViews);
    if (includeSavedViews) assert.equal(received.board.savedViews[1].board.nodes.some(node => node.id === 2), includeHidden);
    assert.ok(!JSON.stringify(received).includes('Talk about this'));
  }
});

test("invalid and recursively nested saved snapshots are rejected on shared boards", async () => {
  for (const change of [
    board => { board.nodes[0].x = "invalid"; },
    board => { board.edges[0].to = "missing"; },
    board => { board.savedViews = []; },
    board => { board.nodes[0].titleHtml = {}; },
    board => { board.nodes[0].links = "invalid"; },
  ]) {
    const source = structuredClone(project);
    const saved = createSavedView(source.board, source.board.viewport, "Full board", "snapshot", 5000);
    change(saved.board);
    source.board.savedViews.push(saved);
    await assert.rejects(readShareHash(externalHash(envelope(source))), /invalid or incomplete/);
  }
});
