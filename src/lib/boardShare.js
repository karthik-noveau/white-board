export const MAX_SHARE_BYTES = 8 * 1024 * 1024;
export const MAX_SHARE_URL_LENGTH = 1_000_000;
const invalidLink = "This share link is invalid or incomplete. Ask for a new link.";
const tooLarge = "This board is too large for a share link. Save a .nova backup instead.";
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isId = value => Number.isSafeInteger(value) || (typeof value === "string" && value.length > 0 && value.length <= 200);
const optional = (value, check) => value == null || check(value);
const isText = value => typeof value === "string";
const isNumber = value => Number.isFinite(value);
const records = value => Array.isArray(value) && value.every(isRecord);

function validateProject(project) {
  const fail = () => { throw new Error(invalidLink); };
  if (!isRecord(project) || !isText(project.title) || !isRecord(project.board)) fail();
  for (const key of ["accent", "folder"]) if (!optional(project[key], isText)) fail();
  validateBoard(project.board);
  return project;
}

function validateBoard(board, snapshot = false) {
  const fail = () => { throw new Error(invalidLink); };
  if (!isRecord(board) || (snapshot && board.savedViews != null)) fail();
  if (!records(board.nodes) || !records(board.edges) || board.nodes.length > 20_000 || board.edges.length > 40_000) fail();
  if (!optional(board.globalSettings, isRecord)) fail();
  for (const key of ["shape", "color", "structure", "pattern", "weight"]) {
    if (!optional(board.globalSettings?.[key], isText)) fail();
  }
  const nodeIds = new Set(), edgeIds = new Set();
  for (const node of board.nodes) {
    if (!isId(node.id) || nodeIds.has(node.id) || !isNumber(node.x) || !isNumber(node.y)) fail();
    nodeIds.add(node.id);
    for (const key of ["title", "note", "titleHtml", "noteHtml", "color", "shape", "kind", "status", "priority", "dueDate"]) {
      if (!optional(node[key], isText)) fail();
    }
    for (const key of ["w", "h", "rotate"]) if (!optional(node[key], isNumber)) fail();
    if (!optional(node.tags, value => Array.isArray(value) && value.every(isText))) fail();
    if (!optional(node.comments, value => records(value) && value.every(comment => isId(comment.id) && isText(comment.text) && isNumber(comment.createdAt)))) fail();
    if (!optional(node.links, value => records(value) && value.every(link => isText(link.url) && optional(link.label, isText)))) fail();
    for (const key of ["branchStyle", "customValues", "risk", "recurrence", "score"]) if (!optional(node[key], isRecord)) fail();
  }
  for (const edge of board.edges) {
    if (!isId(edge.id) || edgeIds.has(edge.id) || !nodeIds.has(edge.from) || !nodeIds.has(edge.to)) fail();
    edgeIds.add(edge.id);
    for (const key of ["side", "structure", "pattern", "weight", "label", "type"]) if (!optional(edge[key], isText)) fail();
    for (const key of ["controlX", "controlY"]) if (!optional(edge[key], isNumber)) fail();
  }
  for (const key of ["savedViews", "automationRules", "customFields", "teamMembers", "goals", "sprints"]) {
    if (!optional(board[key], records)) fail();
  }
  for (const view of board.savedViews || []) {
    if (!isRecord(view.transform) || !["x", "y", "scale"].every(key => isNumber(view.transform[key])) || view.transform.scale <= 0) fail();
    if (!optional(view.name, isText) || !optional(view.id, isId)) fail();
    if (view.board != null) validateBoard(view.board, true);
  }
  if (board.viewport != null && (!isRecord(board.viewport) || !["x", "y", "scale"].every(key => isNumber(board.viewport[key])) || board.viewport.scale <= 0)) fail();
  for (const field of board.customFields || []) if (!optional(field.options, Array.isArray)) fail();
  for (const goal of board.goals || []) if (!optional(goal.nodeIds, Array.isArray)) fail();
  if (!optional(board.activeTimer, isRecord)) fail();
}

function base64Url(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function readLimited(stream) {
  const reader = stream.getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_SHARE_BYTES) { await reader.cancel(); throw new Error(tooLarge); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function createShareUrl(project, baseUrl) {
  validateProject(project);
  const url = new URL("/share", baseUrl);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Use an HTTP or HTTPS address for Nova.");
  // Serialize before awaiting compression so this is one consistent snapshot.
  const bytes = new TextEncoder().encode(JSON.stringify({ format: "nova-share", version: 1, project }));
  if (bytes.length > MAX_SHARE_BYTES) throw new Error(tooLarge);
  const compressed = typeof CompressionStream === "function";
  const encoded = compressed ? await readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))) : bytes;
  url.hash = `v1.${compressed ? "gzip" : "json"}.${base64Url(encoded)}`;
  if (url.href.length > MAX_SHARE_URL_LENGTH) throw new Error(tooLarge);
  return url.href;
}

export async function readShareHash(hash) {
  if (typeof hash !== "string" || hash.length > MAX_SHARE_URL_LENGTH) throw new Error(invalidLink);
  const [version, encoding, data, extra] = hash.replace(/^#/, "").split(".");
  if (version !== "v1" || !["gzip", "json"].includes(encoding) || extra !== undefined || !data || !/^[A-Za-z0-9_-]+$/.test(data) || data.length % 4 === 1) throw new Error(invalidLink);
  if (encoding === "gzip" && typeof DecompressionStream !== "function") throw new Error("Open this link in an up-to-date browser to load the board.");
  try {
    const binary = atob(data.replaceAll("-", "+").replaceAll("_", "/"));
    const encoded = Uint8Array.from(binary, character => character.charCodeAt(0));
    const bytes = encoding === "gzip" ? await readLimited(new Blob([encoded]).stream().pipeThrough(new DecompressionStream("gzip"))) : encoded;
    if (bytes.length > MAX_SHARE_BYTES) throw new Error(tooLarge);
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes), (key, value) => {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error(invalidLink);
      return value;
    });
    if (payload?.format !== "nova-share" || payload.version !== 1) throw new Error(invalidLink);
    return validateProject(payload.project);
  } catch (error) {
    throw new Error(error.message === tooLarge ? tooLarge : invalidLink);
  }
}

export function sharedProjectCopy(project, id = `project-${crypto.randomUUID()}`, now = Date.now()) {
  const copy = { ...structuredClone(project), id, updated: now, schemaVersion: 1 };
  delete copy.deletedAt;
  return copy;
}

export function isLocalShareUrl(link) {
  const { hostname } = new URL(link);
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || hostname === "0.0.0.0" || hostname.startsWith("127.");
}
