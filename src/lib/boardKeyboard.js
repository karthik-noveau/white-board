import { nodeSize } from "./boardAppearance.js";

const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export function nearbyBoardNode(nodes, currentId, direction) {
  if (!directions[direction]) return null;
  const current = nodes.find(node => node.id === currentId);
  if (!current) return nodes.find(node => node.root) || nodes[0] || null;
  const size = nodeSize(current), [vx, vy] = directions[direction];
  const cx = current.x + size.width / 2, cy = current.y + size.height / 2;
  return nodes.filter(node => node.id !== current.id).map(node => {
    const bounds = nodeSize(node);
    const dx = node.x + bounds.width / 2 - cx, dy = node.y + bounds.height / 2 - cy;
    return { node, forward: dx * vx + dy * vy, score: Math.hypot(dx, dy) + Math.abs(dx * vy - dy * vx) * 1.4 };
  }).filter(item => item.forward > 8).sort((a, b) => a.score - b.score)[0]?.node || null;
}

// Tab stays native; arrow keys provide an additional way through button groups.
export function navigateToolbar(event) {
  if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const button = event.target.closest?.("button"), group = button?.closest("[data-keyboard-toolbar]");
  if (!group) return;
  const buttons = [...group.querySelectorAll("button:not(:disabled)")].filter(item => item.getClientRects().length && !item.closest('[inert],[aria-hidden="true"]'));
  const index = buttons.indexOf(button);
  if (index < 0) return;
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  event.preventDefault();
  event.stopPropagation();
  buttons[next].focus();
}
