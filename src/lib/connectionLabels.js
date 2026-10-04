// Labels use a fraction of path length, independent of the route's control
// points. The same geometry is used by the canvas, previews and exports.
const cache = new Map();
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const clamp = value => Math.max(0, Math.min(1, value));

function flatten(points, output, depth = 0) {
  const first = points[0], last = points.at(-1), chord = distance(first, last);
  const polygon = points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);
  const deviation = Math.max(...points.slice(1, -1).map(point => chord
    ? Math.abs((last.x - first.x) * (first.y - point.y) - (first.x - point.x) * (last.y - first.y)) / chord
    : distance(first, point)));
  if (depth >= 12 || (polygon - chord < .1 && deviation < .2)) { output.push(last); return; }
  const left = [first], right = [last];
  let row = points;
  while (row.length > 1) {
    row = row.slice(1).map((point, i) => mix(row[i], point, .5));
    left.push(row[0]); right.unshift(row.at(-1));
  }
  flatten(left, output, depth + 1); flatten(right, output, depth + 1);
}

function measure(path) {
  if (cache.has(path)) return cache.get(path);
  // boardGeometry emits absolute M/L/Q/C commands with explicit coordinates.
  const tokens = (path || '').match(/[MLQC]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || [];
  const points = [];
  let index = 0, current = { x: 0, y: 0 };
  const point = () => ({ x: Number(tokens[index++]), y: Number(tokens[index++]) });
  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === 'M' || command === 'L') { current = point(); points.push(current); }
    else if (command === 'Q' || command === 'C') {
      const controls = command === 'C' ? [point(), point()] : [point()];
      const end = point(); flatten([current, ...controls, end], points); current = end;
    } else break;
  }
  const samples = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  let length = 0;
  const measured = samples.map((point, i) => { if (i) length += distance(samples[i - 1], point); return { ...point, length }; });
  const result = { points: measured, length };
  if (cache.size >= 256) cache.delete(cache.keys().next().value);
  cache.set(path, result);
  return result;
}

export function connectionLabelPoint(path, position = .5) {
  const { points, length } = measure(path);
  if (!points.length) return { x: 0, y: 0 };
  const target = clamp(Number.isFinite(position) ? position : .5) * length;
  for (let i = 1; i < points.length; i++) {
    if (points[i].length >= target) {
      const span = points[i].length - points[i - 1].length;
      return mix(points[i - 1], points[i], span ? (target - points[i - 1].length) / span : 0);
    }
  }
  return { x: points.at(-1).x, y: points.at(-1).y };
}

export function closestLabelPosition(path, target, previous = .5) {
  const { points, length } = measure(path);
  if (!length || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return previous;
  let bestDistance = Infinity, position = previous;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy;
    if (!squared) continue;
    const t = clamp(((target.x - a.x) * dx + (target.y - a.y) * dy) / squared);
    const candidate = mix(a, b, t), delta = distance(target, candidate);
    const fraction = (a.length + (b.length - a.length) * t) / length;
    if (delta < bestDistance - 1e-6 || (Math.abs(delta - bestDistance) < 1e-6 && Math.abs(fraction - previous) < Math.abs(position - previous))) {
      bestDistance = delta; position = fraction;
    }
  }
  return clamp(position);
}

// Reserve the whole label pill around each handle, including its halo and a
// small gap. Do this even when deselected so selecting a line never moves text.
export function connectionLabelPlacement(path, position = .5, label = '', handles = [], previous = position) {
  const requested = clamp(Number.isFinite(position) ? position : .5);
  const halfWidth = Math.min(90, Math.max(20, (label || 'Add a label…').length * 2.85 + 8));
  const obstacles = handles.filter(handle => Number.isFinite(handle.x) && Number.isFinite(handle.y)).map(handle => {
    const haloX = handle.mode === 'endpoint' ? 6 : handle.mode === 'x' ? 8 : 14;
    const haloY = handle.mode === 'endpoint' ? 6 : handle.mode === 'y' ? 8 : 14;
    // Half a pixel also covers the curve-flattening tolerance and pill stroke.
    return { left: handle.x - halfWidth - haloX - 4.5, right: handle.x + halfWidth + haloX + 4.5,
      top: handle.y - 11 - haloY - 4.5, bottom: handle.y + 11 + haloY + 4.5 };
  });
  const inside = (point, box) => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
  const point = connectionLabelPoint(path, requested);
  if (!obstacles.some(box => inside(point, box))) return { position: requested, point };

  const { points, length } = measure(path), blocked = [];
  // Clip each path segment against the expanded handle boxes to find every
  // forbidden interval, including bends and paths that double back.
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], span = b.length - a.length;
    if (!span) continue;
    for (const box of obstacles) {
      let enter = 0, leave = 1;
      for (const [axis, low, high] of [['x', box.left, box.right], ['y', box.top, box.bottom]]) {
        const delta = b[axis] - a[axis];
        if (!delta) { if (a[axis] < low || a[axis] > high) { leave = -1; break; } }
        else {
          const t1 = (low - a[axis]) / delta, t2 = (high - a[axis]) / delta;
          enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
        }
      }
      if (enter <= leave) blocked.push([(a.length + span * enter) / length, (a.length + span * leave) / length]);
    }
  }
  if (length) {
    blocked.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const range of blocked) {
      const last = merged.at(-1);
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    }
    const gap = .01 / length;
    const candidates = [0, 1, ...merged.flatMap(([start, end]) => [start - gap, end + gap])]
      .filter(value => value >= 0 && value <= 1 && !merged.some(([start, end]) => value >= start && value <= end));
    candidates.sort((a, b) => Math.abs(Math.abs(a - requested) - Math.abs(b - requested)) < 1e-8
      ? Math.abs(a - previous) - Math.abs(b - previous) : Math.abs(a - requested) - Math.abs(b - requested));
    if (candidates.length) return { position: candidates[0], point: connectionLabelPoint(path, candidates[0]) };
  }

  // A very short connector may have no room for a pill anywhere on its path.
  // Place it just beside the line so its handles still remain accessible.
  const beside = obstacles.flatMap(box => [
    { x: point.x, y: box.top - .01 }, { x: point.x, y: box.bottom + .01 },
    { x: box.left - .01, y: point.y }, { x: box.right + .01, y: point.y },
  ]).filter(candidate => !obstacles.some(box => inside(candidate, box)));
  beside.sort((a, b) => distance(a, point) - distance(b, point));
  return { position: requested, point: beside[0] || point };
}
