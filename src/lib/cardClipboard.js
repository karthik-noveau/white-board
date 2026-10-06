import { validateBoard } from './boardValidation.js';

export const CARD_MIME = 'application/x-nova-cards';
export function readCardPayload(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 30 * 1024 * 1024) return null;
    const payload = JSON.parse(raw);
    if (payload?.version !== 1 || !payload.nodes?.length) return null;
    validateBoard({ nodes: payload.nodes, edges: payload.edges || [] });
    return payload;
  } catch { return null; }
}

export function cardsFromClipboard(transfer, cached) {
  const types = Array.from(transfer?.types || []);
  if (types.includes(CARD_MIME)) return readCardPayload(transfer.getData(CARD_MIME));
  if (!cached || !types.includes('text/plain')) return null;
  return transfer.getData('text/plain') === cached.nodes.map(node => node.title || 'Untitled card').join('\n') ? cached : null;
}
