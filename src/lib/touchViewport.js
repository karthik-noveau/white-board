const midpoint = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = ([a, b]) => Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));

// Keep the world point under the fingers fixed while zooming and panning together.
export function beginPinch(points, transform, rect = { left: 0, top: 0 }) {
  const center = midpoint(points);
  return {
    type: "pinch", distance: distance(points), scale: transform.scale,
    left: rect.left, top: rect.top,
    anchorX: (center.x - rect.left - transform.x) / transform.scale,
    anchorY: (center.y - rect.top - transform.y) / transform.scale,
  };
}

export function updatePinch(gesture, points) {
  const center = midpoint(points);
  const scale = Math.max(.01, Math.min(4, gesture.scale * distance(points) / gesture.distance));
  return {
    x: center.x - gesture.left - gesture.anchorX * scale,
    y: center.y - gesture.top - gesture.anchorY * scale,
    scale,
  };
}

export function beginTouchPan(pointerId, point, transform) {
  return { type: "pan", pointerId, sx: point.x, sy: point.y, x: transform.x, y: transform.y, touch: true };
}
