export function edgeScrollVelocity(point, rect, margin = 64, speed = 14) {
  if (!rect || point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) return {x:0,y:0};
  const axis = (value, start, end) => {
    const band = Math.min(margin, (end - start) / 3);
    return value < start + band ? -speed * (1 - (value - start) / band)
      : value > end - band ? speed * (1 - (end - value) / band) : 0;
  };
  return {x:axis(point.x,rect.left,rect.right),y:axis(point.y,rect.top,rect.bottom)};
}

export function blockDragPreview(event, count, className) {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = `${event.altKey ? 'Copy' : 'Move'} ${count} ${count === 1 ? 'block' : 'blocks'}`;
  element.setAttribute('aria-hidden','true');
  document.body.append(element);
  event.dataTransfer.setDragImage(element, 18, 18);
  // The browser captures the drag image after the dragstart handler returns.
  requestAnimationFrame(() => element.remove());
}
