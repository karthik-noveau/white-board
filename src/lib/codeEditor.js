import { HighlightStyle, LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { highlightTree, tags } from '@lezer/highlight';

// The same token classes color the live editor and the saved, exportable view.
export const codeHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], class: 'nova-code-keyword' },
  { tag: [tags.string, tags.regexp], class: 'nova-code-string' },
  { tag: [tags.number, tags.bool, tags.null], class: 'nova-code-number' },
  { tag: [tags.comment, tags.meta], class: 'nova-code-comment' },
  { tag: [tags.tagName, tags.typeName, tags.className], class: 'nova-code-type' },
  { tag: [tags.attributeName, tags.propertyName, tags.function(tags.variableName)], class: 'nova-code-property' },
  { tag: [tags.operator, tags.punctuation], class: 'nova-code-punctuation' },
  { tag: tags.invalid, class: 'nova-code-invalid' },
]);

// GraphQL is not included in CodeMirror's language catalog. Supply its lexical
// mode while the remaining languages load their maintained parser packages.
const graphql = StreamLanguage.define({
  name: 'graphql',
  startState: () => ({ string: false }),
  token(stream, state) {
    if (state.string) {
      while (!stream.eol()) { if (stream.match('"""')) { state.string = false; break; } stream.next(); }
      return 'string';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('#')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match('"""')) { state.string = true; return 'string'; }
    if (stream.match(/"(?:[^"\\]|\\.)*(?:"|$)/)) return 'string';
    if (stream.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return 'number';
    if (stream.match(/\$[A-Za-z_]\w*/)) return 'variableName';
    if (stream.match(/@[A-Za-z_]\w*/)) return 'meta';
    if (stream.match(/(?:query|mutation|subscription|fragment|on|type|input|enum|scalar|interface|union|extend|schema|directive|implements)\b/)) return 'keyword';
    if (stream.match(/(?:true|false|null)\b/)) return 'bool';
    if (stream.match(/[A-Z][\w]*/)) return 'typeName';
    if (stream.match(/[a-z_]\w*/)) return 'propertyName';
    stream.next(); return 'punctuation';
  },
  languageData: { commentTokens: { line: '#' }, closeBrackets: { brackets: ['(', '[', '{', '"'] } },
});

export async function loadCodeLanguage(name) {
  if (name === 'GraphQL') return new LanguageSupport(graphql);
  return LanguageDescription.matchLanguageName(languages, name || 'Plain text', false)?.load() || null;
}

export function highlightedCodeLines(code, support) {
  const runs = []; let end = 0;
  if (support) highlightTree(support.language.parser.parse(code), codeHighlightStyle, (from, to, className) => {
    if (from > end) runs.push({ text: code.slice(end, from), className: '' });
    runs.push({ text: code.slice(from, to), className }); end = to;
  });
  if (end < code.length) runs.push({ text: code.slice(end), className: '' });
  const lines = [[]];
  for (const run of runs) run.text.split(/\r\n?|\n/).forEach((text, index) => {
    if (index) lines.push([]);
    if (text) lines.at(-1).push({ text, className: run.className });
  });
  return lines;
}

// Keep selection and scroll stable when undo or an external board update
// changes part of a snippet. Replacing the whole document moves the caret.
export function codeChange(previous, next) {
  if (previous === next) return null;
  let from = 0, to = previous.length, end = next.length;
  while (from < to && from < end && previous[from] === next[from]) from++;
  while (to > from && end > from && previous[to - 1] === next[end - 1]) { to--; end--; }
  return { from, to, insert: next.slice(from, end) };
}
