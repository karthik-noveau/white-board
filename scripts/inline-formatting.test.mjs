import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { formattedSelectionHTML, selectionFormats, restoreTextSelection } from '../src/lib/inlineFormatting.js';

const dom=new JSDOM('<!doctype html><body></body>');
globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.NodeFilter=dom.window.NodeFilter;
const editor=html=>{const root=document.createElement('div');root.innerHTML=html;document.body.replaceChildren(root);return root;};
const select=(root,start,end)=>restoreTextSelection(root,start,end);
function apply(root,start,end,command){
  const result=formattedSelectionHTML(root,select(root,start,end),command);
  root.innerHTML=result.html;select(root,result.start,result.end);return root;
}
const markedCharacters=(root,selector)=>{
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;const result=[];
  while((node=walker.nextNode()))result.push(...[...node.data].map(char=>({char,marked:!!node.parentElement.closest(selector)})));
  return result;
};
test('highlight and inline code both toggle on and off without losing the selection',()=>{
  for(const [command,tag] of [['highlight','mark'],['code','code']]){
    const root=editor('Hello <strong>world</strong>!');
    apply(root,3,9,command);assert.equal(root.textContent,'Hello world!');assert.equal(window.getSelection().toString(),'lo wor');
    assert.equal(selectionFormats(root,window.getSelection().getRangeAt(0))[command],true);
    assert.deepEqual(markedCharacters(root,tag).map(item=>item.marked),[false,false,false,true,true,true,true,true,true,false,false,false]);
    apply(root,3,9,command);assert.equal(root.querySelector(tag),null);assert.equal(root.querySelector('strong').textContent,'world');
  }
});
test('removing part of a nested mark preserves the outer formatting and both unselected sides',()=>{
  const root=editor('<mark><strong>before <em>middle</em> after</strong></mark>');
  apply(root,7,13,'highlight');
  assert.equal(root.textContent,'before middle after');
  assert.equal(root.querySelector('em').textContent,'middle');
  assert.deepEqual(markedCharacters(root,'mark').map(item=>item.marked),[...Array(7).fill(true),...Array(6).fill(false),...Array(6).fill(true)]);
  assert.ok(markedCharacters(root,'strong').every(item=>item.marked));
});
test('clear formatting removes marks, code and links only inside the selection',()=>{
  const root=editor('<p><a href="https://example.com"><b>one <mark><code>two</code></mark> three</b></a></p><ul><li>Keep list</li></ul>');
  apply(root,4,7,'removeFormat');
  assert.equal(root.textContent,'one two threeKeep list');assert.equal(root.querySelectorAll('p').length,1);assert.equal(root.querySelectorAll('li').length,1);
  assert.ok(markedCharacters(root,'b,a,mark,code').slice(4,7).every(item=>!item.marked));
  assert.ok(markedCharacters(root,'a').slice(0,4).every(item=>item.marked));
  assert.ok(markedCharacters(root,'a').slice(7,13).every(item=>item.marked));
});
test('mixed selections apply formatting consistently and expose accurate pressed state',()=>{
  const root=editor('<code>one</code> two');
  assert.equal(selectionFormats(root,select(root,0,7)).code,false);
  apply(root,0,7,'code');assert.equal(selectionFormats(root,select(root,0,7)).code,true);
  apply(root,0,7,'code');assert.equal(root.querySelector('code'),null);
  assert.equal(selectionFormats(root,select(root,2,2)).code,false);
});
test('formatting spanning paragraphs keeps paragraph and list structure intact',()=>{
  const root=editor('<p><mark>first</mark></p><p><mark>second</mark></p><ol><li><code>third</code></li></ol>');
  apply(root,2,14,'removeFormat');
  assert.equal(root.querySelectorAll('p').length,2);assert.equal(root.querySelectorAll('ol>li').length,1);
  assert.equal(root.textContent,'firstsecondthird');assert.equal(root.querySelector('mark').textContent,'fi');assert.equal(root.querySelector('code').textContent,'rd');
});
