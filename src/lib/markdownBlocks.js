import { Marked } from 'marked';
import { newContent, newSlot, textBlock, safeURL, normalizeCellContent } from './cellContent.js';
import { CODE_LANGUAGES } from './codeLanguages.js';

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const parser = new Marked({ gfm: true, async: false, renderer: {
  checkbox: () => '',
  html: ({ text }) => escape(text),
  image: ({ href, text }) => { const url = safeURL(href); return url ? `<a href="${escape(url)}">${escape(text || 'Image reference')}</a>` : escape(text); },
  link({ href, tokens }) { const url = safeURL(href), text = this.parser.parseInline(tokens); return url ? `<a href="${escape(url)}">${text}</a>` : text; },
} });
const inlineHTML = tokens => parser.Parser.parseInline(tokens, parser.defaults);
const blockHTML = tokens => parser.parser(tokens);
const plain = tokens => (tokens || []).map(token => token.type === 'br' ? '\n' : token.items ? token.items.map(item => plain(item.tokens)).join('\n') : token.tokens ? plain(token.tokens) : token.text || '').join('');
const languageName = value => {
  const name = (value || '').split(/\s/)[0], aliases = { js: 'JavaScript', ts: 'TypeScript', py: 'Python', sh: 'Shell', md: 'Markdown', yml: 'YAML', cpp: 'C++', cs: 'C#' };
  return aliases[name.toLowerCase()] || CODE_LANGUAGES.find(language => language.toLowerCase() === name.toLowerCase()) || name || 'Plain text';
};

// Return null for ordinary text so a normal paste retains the caret and marks.
export function markdownBlocks(source, depth = 0) {
  if (typeof source !== 'string' || !source.trim()) return null;
  if (source.length > 500000) throw new Error('Paste up to 500,000 characters at a time.');
  const tokens = parser.lexer(source);
  const structured = tokens.some(token => !['space','paragraph','text'].includes(token.type) || token.tokens?.some(inline => !['text','escape'].includes(inline.type)));
  if (!structured) return null;
  const result = [];
  for (const token of tokens) {
    if (['space','def'].includes(token.type)) continue;
    if (token.type === 'heading') result.push({ ...newContent('heading'), text: plain(token.tokens), html: inlineHTML(token.tokens), level: token.depth });
    else if (token.type === 'code') result.push({ ...newContent('code'), code: token.text, language: languageName(token.lang) });
    else if (token.type === 'hr') result.push(newContent('divider'));
    else if (token.type === 'table' && depth < 3) {
      const table = newContent('table');
      table.headers = token.header.map(cell => plain(cell.tokens));
      table.rows = token.rows.map(row => row.map(cell => ({ ...newSlot(), content: [{ ...textBlock(plain(cell.tokens)), html: inlineHTML(cell.tokens) }] })));
      result.push(table);
    } else if (token.type === 'list' && token.items.every(item => item.task)) {
      result.push({ ...newContent('checklist'), tasks: token.items.map(item => ({ text: plain(item.tokens), html: blockHTML(item.tokens), done: !!item.checked })) });
    } else if (token.type === 'blockquote') {
      result.push({ ...newContent('note'), text: plain(token.tokens), html: blockHTML(token.tokens) });
    } else if (token.type === 'table') {
      result.push(textBlock([token.header.map(cell => plain(cell.tokens)).join(' | '), ...token.rows.map(row => row.map(cell => plain(cell.tokens)).join(' | '))].join('\n')));
    } else if (token.type === 'html') result.push(textBlock(token.text));
    else result.push({ ...textBlock(token.type === 'list' ? token.items.map(item => plain(item.tokens)).join('\n') : plain(token.tokens) || token.text || ''), html: token.type === 'list' ? blockHTML([token]) : inlineHTML(token.tokens || []) });
  }
  return normalizeCellContent(result);
}
