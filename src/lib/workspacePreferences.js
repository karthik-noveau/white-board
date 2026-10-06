export const WORKSPACE_PREFERENCES_KEY = 'nova-workspace-preferences';
const defaults = { view: 'grid', sort: 'recent' };
export function normalizeWorkspacePreferences(value) {
  return { view: ['grid', 'list'].includes(value?.view) ? value.view : defaults.view, sort: ['recent', 'name', 'oldest'].includes(value?.sort) ? value.sort : defaults.sort };
}
export function readWorkspacePreferences(storage) {
  try { return normalizeWorkspacePreferences(JSON.parse((storage || window.localStorage).getItem(WORKSPACE_PREFERENCES_KEY))); }
  catch { return { ...defaults }; }
}
export function saveWorkspacePreferences(value, storage) {
  try { (storage || window.localStorage).setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(normalizeWorkspacePreferences(value))); return true; }
  catch { return false; }
}
