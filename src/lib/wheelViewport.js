// Wheel deltas may use pixels, lines, or pages. Keep fractional zoom steps so
// small scrolls can accumulate even when the board is zoomed far out.
export function zoomByWheel(transform, point, deltaY, deltaMode = 0, pageHeight = 800) {
  if (!deltaY) return transform;
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? pageHeight : 1;
  const exponent = Math.max(-1, Math.min(1, -deltaY * unit * .002));
  const scale = Math.max(.01, transform.scale * Math.exp(exponent));
  if (scale === transform.scale) return transform;
  const ratio = scale / transform.scale;
  return {
    x: point.x - (point.x - transform.x) * ratio,
    y: point.y - (point.y - transform.y) * ratio,
    scale,
  };
}
