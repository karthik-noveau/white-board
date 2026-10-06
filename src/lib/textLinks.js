import { safeURL } from './cellContent.js';

export function normalizeLinkURL(value) {
  const text = String(value || '').trim();
  if (!text || /\s/.test(text) || [...text].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return '';
  if (/^mailto:[^@?]+@[^@?]+(?:\?.*)?$/i.test(text) || /^tel:\+?[\d().-]+$/i.test(text)) return text;
  if (text.startsWith('#card=')) {
    try {
      const id = decodeURIComponent(text.slice(6));
      return id && id.length <= 200 ? `#card=${encodeURIComponent(id)}` : '';
    } catch { return ''; }
  }
  return safeURL(text);
}

export function setLinkBehavior(link, newTab) {
  link.setAttribute('target', newTab ? '_blank' : '_self');
  if (newTab) link.setAttribute('rel', 'noopener noreferrer');
  else link.removeAttribute('rel');
}

// Editing any part of one link updates that whole link. Mixed selections keep
// their exact range so neighbouring links and text are left alone.
export function textLinkDraft(root, selection) {
  if (!selection || !root.contains(selection.commonAncestorContainer)) return null;
  const range = selection.cloneRange();
  const parentLink = node => (node.nodeType === 1 ? node : node.parentElement)?.closest('a');
  const start = parentLink(range.startContainer), end = parentLink(range.endContainer);
  const singleNode = range.startContainer === range.endContainer && range.endOffset === range.startOffset + 1
    ? range.startContainer.childNodes[range.startOffset] : null;
  const link = start && start === end && root.contains(start) ? start : singleNode?.nodeName === 'A' ? singleNode : null;
  if (link) range.selectNode(link);
  return {
    range, existing: Boolean(link), text: range.toString(),
    url: link?.getAttribute('href') || '', title: link?.getAttribute('title') || '',
    newTab: link ? link.getAttribute('target') === '_blank' : true,
  };
}

export function textLinkHTML(draft, values) {
  const host = document.createElement('div');
  host.append(draft.range.cloneContents());
  for (const link of host.querySelectorAll('a')) link.replaceWith(...link.childNodes);
  if (!values) return host.innerHTML;
  const url = normalizeLinkURL(values.url);
  if (!url) return null;
  const text = values.text || url;
  if (text !== draft.text) host.textContent = text;
  // cloneContents omits common inline ancestors (for example a selection inside
  // a highlighted word). Include them so native insertion retains those marks.
  let ancestor = draft.range.commonAncestorContainer;
  if (ancestor.nodeType !== 1) ancestor = ancestor.parentElement;
  const inline = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'MARK', 'CODE', 'SPAN', 'FONT', 'SUB', 'SUP']);
  while (ancestor && inline.has(ancestor.nodeName)) {
    const wrapper = ancestor.cloneNode(false);
    wrapper.append(...host.childNodes); host.append(wrapper); ancestor = ancestor.parentElement;
  }
  // Keep lists and paragraphs intact when a selection crosses block boundaries.
  const blocks = new Set(['P', 'DIV', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE']);
  const wrap = element => {
    let link;
    for (const node of [...element.childNodes]) {
      if (blocks.has(node.nodeName)) { link = null; wrap(node); continue; }
      if (!link) {
        link = document.createElement('a');
        link.setAttribute('href', url);
        if (values.title?.trim()) link.setAttribute('title', values.title.trim());
        setLinkBehavior(link, values.newTab);
        element.insertBefore(link, node);
      }
      link.append(node);
    }
  };
  wrap(host);
  return host.innerHTML;
}

// A single native edit preserves browser undo/redo, including target and title.
export function applyTextLink(root, draft, values) {
  if (!root.contains(draft.range.commonAncestorContainer)) return false;
  const html = textLinkHTML(draft, values);
  if (html === null) return false;
  root.focus({ preventScroll: true });
  const selection = window.getSelection();
  selection.removeAllRanges(); selection.addRange(draft.range.cloneRange());
  if (!values) return document.execCommand('unlink', false);
  return document.execCommand('insertHTML', false, html);
}
