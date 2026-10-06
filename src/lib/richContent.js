import DOMPurify from 'dompurify';
import { normalizeLinkURL, setLinkBehavior } from './textLinks.js';

export const escapeHTML = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const cardHref = id => `#card=${encodeURIComponent(String(id))}`;
export function cardIdFromHref(href) {
  if (!href?.startsWith('#card=')) return null;
  try { return decodeURIComponent(href.slice(6)); } catch { return null; }
}

export function cleanBlockHTML(html) {
  const fragment = DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: ['b','strong','i','em','u','s','del','br','p','div','span','ul','ol','li','code','pre','blockquote','sub','sup','a','mark'],
    ALLOWED_ATTR: ['href','title','start','target'], ALLOW_DATA_ATTR: false, RETURN_DOM_FRAGMENT: true,
  });
  for (const link of fragment.querySelectorAll('a')) {
    const href = link.getAttribute('href');
    const cardId = cardIdFromHref(href);
    if (cardId !== null && cardId.length <= 200) {
      link.setAttribute('href', cardHref(cardId)); link.setAttribute('data-card-reference', cardId);
      link.removeAttribute('target');
    } else {
      const safe = normalizeLinkURL(href);
      if (safe) { link.setAttribute('href', safe); setLinkBehavior(link, link.getAttribute('target') !== '_self'); }
      else link.replaceWith(...link.childNodes);
    }
  }
  const host = document.createElement('div'); host.append(fragment); return host.innerHTML;
}

export function resolveCardHTML(html, nodes) {
  const host = document.createElement('div'); host.innerHTML = cleanBlockHTML(html);
  for (const link of host.querySelectorAll('[data-card-reference]')) {
    const node = nodes.find(node => String(node.id) === link.dataset.cardReference);
    if (node) { link.textContent = node.title || 'Untitled card'; link.title = `Go to ${node.title || 'Untitled card'}`; }
    else { link.dataset.missing = 'true'; link.title = 'This card is no longer available'; }
  }
  return host.innerHTML;
}

export function editableOffset(element) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !element.contains(selection.focusNode)) return { start: 0, end: 0 };
  const range = selection.getRangeAt(0), before = range.cloneRange();
  before.selectNodeContents(element); before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length };
}

export function setEditableOffset(element, offset) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = offset, node;
  while ((node = walker.nextNode())) {
    if (remaining <= node.textContent.length) {
      const range = document.createRange(); range.setStart(node, remaining); range.collapse(true);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); return;
    }
    remaining -= node.textContent.length;
  }
  const range = document.createRange(); range.selectNodeContents(element); range.collapse(false);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
}

// Range fragments preserve marks on both sides of a split/paste/slash command.
export function fragmentHTML(fragment) { const host = document.createElement('div'); host.append(fragment); return cleanBlockHTML(host.innerHTML); }
export function splitEditable(element, range) {
  const selection = window.getSelection();
  range ||= selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range || !element.contains(range.commonAncestorContainer)) return null;
  const before = document.createRange(), after = document.createRange();
  before.selectNodeContents(element); before.setEnd(range.startContainer, range.startOffset);
  after.selectNodeContents(element); after.setStart(range.endContainer, range.endOffset);
  return { before: { text: before.toString(), html: fragmentHTML(before.cloneContents()) }, after: { text: after.toString(), html: fragmentHTML(after.cloneContents()) } };
}
