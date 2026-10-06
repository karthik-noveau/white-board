import { normalizeCellContent } from './cellContent.js';
import { palettes } from './boardAppearance.js';

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isId = value => Number.isSafeInteger(value) || (typeof value === "string" && value.length > 0 && value.length <= 200);
const optional = (value, check) => value == null || check(value);
const isText = value => typeof value === "string";
const isNumber = value => Number.isFinite(value);
const records = value => Array.isArray(value) && value.every(isRecord);

export function validateBoard(board, snapshot = false, message = "Invalid board data") {
  const fail = () => { throw new Error(message); };
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
    for (const key of ["w", "h", "rotate", "contentHeight"]) if (!optional(node[key], isNumber)) fail();
    if (!optional(node.color, value => Object.hasOwn(palettes, value))) fail();
    if (node.content != null) { try { normalizeCellContent(node.content); } catch { fail(); } }
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
    if (!optional(edge.labelPosition, value => isNumber(value) && value >= 0 && value <= 1)) fail();
  }
  for (const key of ["savedViews", "automationRules", "customFields", "teamMembers", "goals", "sprints"]) {
    if (!optional(board[key], records)) fail();
  }
  for (const view of board.savedViews || []) {
    if (!isRecord(view.transform) || !["x", "y", "scale"].every(key => isNumber(view.transform[key])) || view.transform.scale <= 0) fail();
    if (!optional(view.name, isText) || !optional(view.id, isId)) fail();
    if (view.board != null) validateBoard(view.board, true, message);
  }
  if (board.viewport != null && (!isRecord(board.viewport) || !["x", "y", "scale"].every(key => isNumber(board.viewport[key])) || board.viewport.scale <= 0)) fail();
  for (const field of board.customFields || []) if (!optional(field.options, Array.isArray)) fail();
  const conditions = { status: ['none', 'todo', 'doing', 'done'], priority: ['none', 'low', 'medium', 'high'] };
  const actions = { ...conditions, color: Object.keys(palettes), starred: ['true', 'false'] };
  for (const rule of board.automationRules || []) {
    if (!isId(rule.id) || typeof rule.enabled !== 'boolean' || !['status', 'priority', 'tag', 'overdue'].includes(rule.whenField)) fail();
    if (!isText(rule.whenValue) || (conditions[rule.whenField] && !conditions[rule.whenField].includes(rule.whenValue))) fail();
    if (!Object.hasOwn(actions, rule.actionField) || !actions[rule.actionField].includes(rule.actionValue)) fail();
  }
  for (const goal of board.goals || []) if (!optional(goal.nodeIds, Array.isArray)) fail();
  if (!optional(board.activeTimer, isRecord)) fail();
}
