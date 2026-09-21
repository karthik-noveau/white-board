export const boardPath = id => `/boards/${encodeURIComponent(id)}`;
export const folderPath = name => `/projects/folders/${encodeURIComponent(name)}`;

export function workspaceReturnPath(from) {
  return typeof from === "string" && /^\/projects(?:[/?]|$)/.test(from) ? from : "/projects";
}
