import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { basicSetup } from 'codemirror';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap, placeholder, tooltips } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit, syntaxHighlighting } from '@codemirror/language';
import { codeChange, codeHighlightStyle, highlightedCodeLines, loadCodeLanguage } from '../lib/codeEditor';
import styles from '../styles/codeEditor.module.css';

function EditableCode({ value, support, language, onChange, autoFocus }) {
  const host = useRef(null), view = useRef(null), languageMode = useRef(new Compartment());
  const current = useRef({ value, onChange, autoFocus });
  current.current = { value, onChange, autoFocus };
  const hintId = useId();
  useLayoutEffect(() => {
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: current.current.value, extensions: [
        basicSetup,
        indentUnit.of('  '), EditorState.tabSize.of(2), keymap.of([indentWithTab]),
        syntaxHighlighting(codeHighlightStyle), languageMode.current.of([]),
        placeholder('Write or paste code…'), tooltips({ position: 'absolute' }),
        EditorView.contentAttributes.of({ 'aria-label': 'Code snippet', 'aria-describedby': hintId, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !update.transactions.every(transaction => transaction.annotation(Transaction.addToHistory) === false)) current.current.onChange(update.state.doc.toString());
        }),
      ] }),
    });
    view.current = editor;
    if (current.current.autoFocus) editor.focus();
    return () => { view.current = null; editor.destroy(); };
  }, [hintId]);
  useEffect(() => { view.current?.dispatch({ effects: languageMode.current.reconfigure(support || []) }); }, [support]);
  useLayoutEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const changes = codeChange(editor.state.doc.toString(), value);
    if (changes) editor.dispatch({ changes, annotations: Transaction.addToHistory.of(false) });
  }, [value]);
  useEffect(() => { if (autoFocus) view.current?.focus(); }, [autoFocus]);
  return <div className={styles.editor} data-code-editor data-language={language}
    onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <span id={hintId} className={styles.hint}>Tab indents. Press Escape, then Tab to leave the code editor. Use the card's Done button to finish editing.</span>
    <div ref={host}/>
  </div>;
}

export default function CodeEditor({ value = '', language = 'Plain text', readOnly = false, onChange, autoFocus = false }) {
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    let active = true;
    loadCodeLanguage(language).then(support => { if (active) setLoaded({ language, support }); })
      .catch(() => { if (active) setLoaded({ language, support: null }); });
    return () => { active = false; };
  }, [language]);
  const support = loaded?.language === language ? loaded.support : null;
  const lines = useMemo(() => readOnly ? highlightedCodeLines(value, support) : [], [value, support, readOnly]);
  if (!readOnly) return <EditableCode value={value} support={support} language={language} onChange={onChange} autoFocus={autoFocus}/>;
  return <div className={styles.viewer} data-code-viewer data-language={language} onPointerDown={event => event.stopPropagation()}>
    <div className={styles.lines}>{lines.map((tokens, line) => <div className={styles.row} key={line}>
      <span className={styles.number} aria-hidden="true">{line + 1}</span>
      <code data-cell-text>{tokens.map((token, index) => <span key={index} className={token.className}>{token.text}</span>)}{!tokens.length && '\u00a0'}</code>
    </div>)}</div>
  </div>;
}
