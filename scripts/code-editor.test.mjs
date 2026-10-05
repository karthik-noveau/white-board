import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { history, insertNewlineAndIndent, undo } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { CODE_LANGUAGES } from '../src/lib/codeLanguages.js';
import { codeChange, highlightedCodeLines, loadCodeLanguage } from '../src/lib/codeEditor.js';

test('every selectable code language loads a syntax mode', async () => {
  for (const name of CODE_LANGUAGES) {
    const support = await loadCodeLanguage(name);
    if (name === 'Plain text') assert.equal(support, null);
    else assert.ok(support?.language.parser, name);
  }
  assert.equal(await loadCodeLanguage('unknown-language'), null);
});

test('saved HTML uses syntax tokens while retaining source markup as text', async () => {
  const code = '<section class="intro">\n  <h1>Hello & welcome</h1>\n</section>\n';
  const lines = highlightedCodeLines(code, await loadCodeLanguage('HTML'));
  assert.equal(lines.map(line => line.map(token => token.text).join('')).join('\n'), code);
  assert.ok(lines.flat().some(token => token.text === 'section' && token.className === 'nova-code-type'));
  assert.ok(lines.flat().some(token => token.text === '"intro"' && token.className === 'nova-code-string'));
  assert.equal(lines.length, 4);
});

test('language changes use the selected grammar without rewriting the snippet', async () => {
  for (const [name, code] of [
    ['JavaScript', 'const answer = 42; // comment'],
    ['Python', 'def hello():\n  return "world"'],
    ['GraphQL', 'query Project($id: ID!) { project(id: $id) { name } }'],
  ]) {
    const lines = highlightedCodeLines(code, await loadCodeLanguage(name));
    assert.equal(lines.map(line => line.map(token => token.text).join('')).join('\n'), code);
    assert.ok(lines.flat().some(token => token.className === 'nova-code-keyword'), name);
  }
  assert.deepEqual(highlightedCodeLines('', null), [[]]);
});

test('external updates replace only changed code and preserve the rest', () => {
  for (const [previous, next] of [['abc', 'aXbc'], ['abc', 'ac'], ['', 'hello'], ['hello', ''], ['one\ntwo', 'one\nthree'], ['🙂', '🙃']]) {
    const change = codeChange(previous, next);
    assert.equal(previous.slice(0, change.from) + change.insert + previous.slice(change.to), next);
  }
  assert.equal(codeChange('same', 'same'), null);
  assert.deepEqual(codeChange('const answer = 1;', 'const answer = 42;'), { from: 15, to: 16, insert: '42' });
});

test('the editor indents a JavaScript block and undoes the edit', async () => {
  const code = 'function start() {';
  const target = {
    state: EditorState.create({ doc: code, selection: { anchor: code.length }, extensions: [await loadCodeLanguage('JavaScript'), indentUnit.of('  '), history()] }),
    dispatch(transaction) { target.state = transaction.state || target.state.update(transaction).state; },
  };
  assert.ok(insertNewlineAndIndent(target));
  assert.equal(target.state.doc.toString(), `${code}\n  `);
  assert.ok(undo(target));
  assert.equal(target.state.doc.toString(), code);
});
