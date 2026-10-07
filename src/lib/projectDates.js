export const isValidTimestamp = value => Number.isFinite(value) && Number.isFinite(new Date(value).getTime());

export function projectUpdatedLabel(project, trash, now = Date.now()) {
  const date = trash ? project.deletedAt : project.updated;
  const prefix = trash ? 'Deleted' : 'Edited';
  // Older imports may already contain an invalid date. Keep their boards
  // accessible so the user can open, export, or remove the affected project.
  if (!isValidTimestamp(date)) return `${prefix} date unavailable`;
  const days = Math.round((date - now) / 86400000);
  const relative = Math.abs(days) < 7
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(days, 'day')
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', ...(new Date(date).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) }).format(date);
  return `${prefix} ${relative}`;
}
