import assert from "node:assert/strict";
import test from "node:test";
import { createSaveStatus } from "../src/lib/saveStatus.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

test("changes show saving throughout debounce and until storage actually completes", async () => {
  const changes = [], tracker = createSaveStatus(status => changes.push(status));
  const token = tracker.markDirty("board");
  assert.equal(tracker.getStatus(), "saving");
  const storage = deferred(), pending = tracker.persist("board", token, () => storage.promise);
  await Promise.resolve();
  assert.equal(tracker.getStatus(), "saving");
  storage.resolve({ ok: true });
  assert.equal(await pending, true);
  assert.deepEqual(changes, ["saving", "saved"]);
});

test("an earlier completed write cannot mark a newer pending edit saved", async () => {
  const tracker = createSaveStatus(() => {}), oldStorage = deferred();
  const first = tracker.markDirty("board");
  const oldWrite = tracker.persist("board", first, () => oldStorage.promise);
  const latest = tracker.markDirty("board");
  oldStorage.resolve({ ok: true });
  await oldWrite;
  assert.equal(tracker.getStatus(), "saving");
  await tracker.persist("board", latest, () => Promise.resolve({ ok: true }));
  assert.equal(tracker.getStatus(), "saved");
});

test("overlapping title and board writes must both finish before showing saved", async () => {
  const tracker = createSaveStatus(() => {}), titleStorage = deferred(), boardStorage = deferred();
  const boardWrite = tracker.persist("board", tracker.markDirty("board"), () => boardStorage.promise);
  const titleWrite = tracker.persist("title", tracker.markDirty("title"), () => titleStorage.promise);
  boardStorage.resolve({ ok: true });
  await boardWrite;
  assert.equal(tracker.getStatus(), "saving");
  titleStorage.resolve({ ok: true });
  await titleWrite;
  assert.equal(tracker.getStatus(), "saved");
});

test("failed storage remains unsaved and retry can recover the same pending revision", async () => {
  const changes = [], tracker = createSaveStatus(status => changes.push(status));
  const token = tracker.markDirty("board");
  assert.equal(await tracker.persist("board", token, () => Promise.resolve({ ok: false, error: new Error("Storage full") })), false);
  assert.equal(tracker.getStatus(), "error");
  const storage = deferred(), retry = tracker.persist("board", token, () => storage.promise);
  assert.equal(tracker.getStatus(), "saving");
  storage.resolve({ ok: true });
  assert.equal(await retry, true);
  assert.deepEqual(changes, ["saving", "error", "saving", "saved"]);
});

test("rejected or synchronously thrown writes do not escape or report success", async () => {
  const tracker = createSaveStatus(() => {});
  assert.equal(await tracker.persist("board", tracker.markDirty("board"), () => Promise.reject(new Error("Aborted transaction"))), false);
  assert.equal(tracker.getStatus(), "error");
  assert.equal(await tracker.persist("board", tracker.markDirty("board"), () => { throw new Error("Storage unavailable"); }), false);
  assert.equal(tracker.getStatus(), "error");
});

test("a stale failed write cannot replace the result of a newer successful save", async () => {
  const tracker = createSaveStatus(() => {}), oldStorage = deferred();
  const oldWrite = tracker.persist("board", tracker.markDirty("board"), () => oldStorage.promise);
  await tracker.persist("board", tracker.markDirty("board"), () => Promise.resolve({ ok: true }));
  oldStorage.reject(new Error("Old write failed"));
  await oldWrite;
  assert.equal(tracker.getStatus(), "saved");
});

test("saving one kind of change does not conceal a failed write of another kind", async () => {
  const tracker = createSaveStatus(() => {});
  await tracker.persist("title", tracker.markDirty("title"), () => ({ ok: false }));
  await tracker.persist("board", tracker.markDirty("board"), () => ({ ok: true }));
  assert.equal(tracker.getStatus(), "error");
  assert.equal(tracker.getStatus("title"), "error");
  assert.equal(tracker.getStatus("board"), "saved");
  await tracker.persist("title", tracker.markDirty("title"), () => ({ ok: true }));
  assert.equal(tracker.getStatus(), "saved");
});
