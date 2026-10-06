import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK_MIME, blocksFromClipboard, blockPayload, cardPreview } from '../src/lib/blockEditing.js';
import { newContent, textBlock, contentText } from '../src/lib/cellContent.js';
import { fitColumnWidth, distributeColumnWidths } from '../src/lib/tableSizing.js';
import { moveMarkup, resizeMarkup, markupBounds, markupHistory } from '../src/lib/imageMarkup.js';
import { edgeScrollVelocity } from '../src/lib/blockDrag.js';

const transfer = data => ({types:Object.keys(data),getData:type=>data[type]||''});
test('native block clipboard wins and unrelated clipboard text never reuses stale blocks',()=>{
  const a=textBlock('Keep formatting'),b=textBlock('New copy');
  const old=blockPayload({id:1,content:[a]},[a.id],'board');
  const fresh=blockPayload({id:2,content:[b]},[b.id],'board');
  assert.equal(blocksFromClipboard(transfer({[BLOCK_MIME]:JSON.stringify(fresh),'text/plain':'Different serialization'}),old).sourceCard,2);
  assert.equal(blocksFromClipboard(transfer({'text/plain':'Keep formatting'}),old),old);
  assert.equal(blocksFromClipboard(transfer({'text/plain':'External text'}),old),null);
  assert.equal(blocksFromClipboard(transfer({[BLOCK_MIME]:'invalid','text/plain':'Keep formatting'}),old),null);
  assert.equal(blocksFromClipboard(transfer({}),old),null);
  const image=newContent('image'),imageCopy=blockPayload({id:3,content:[image]},[image.id],'board');
  assert.equal(blocksFromClipboard(transfer({'text/plain':contentText(imageCopy.blocks)}),imageCopy),imageCopy);
});
test('auto-fit considers all rows, headers and media, with bounded automatic widths',()=>{
  const table=newContent('table');table.headers=['Tiny','Observation'];
  table.rows[0][0].content=[textBlock('A longer experiment description')];
  assert.equal(fitColumnWidth(table,0,text=>text.length*10),358);
  table.rows[0][0].content=[textBlock('x'.repeat(10000))];assert.equal(fitColumnWidth(table,0),600);
  table.rows[0][0].content=[newContent('image')];assert.equal(fitColumnWidth(table,0),328);
  assert.deepEqual(distributeColumnWidths([120,480,300]),[300,300,300]);
});
test('moving markup clamps the whole annotation to the image without distorting it',()=>{
  const mark={type:'rectangle',color:'#6436dc',points:[[.2,.3],[.5,.7]]};
  const moved=moveMarkup(mark,1,-1);assert.deepEqual(moved.points,[[.7,0],[1,.39999999999999997]]);
  assert.deepEqual(mark.points,[[.2,.3],[.5,.7]]);
});
test('resizing keeps the opposite corner fixed, preserves pen proportions and supports horizontal arrows',()=>{
  const mark={type:'pen',color:'#6436dc',points:[[.2,.2],[.3,.3],[.4,.4]]};
  const changed=resizeMarkup(mark,'se',[.8,.6]);
  assert.deepEqual(changed.points[0],[.2,.2]);assert.deepEqual(changed.points.at(-1),[.8,.6]);
  assert.ok(Math.abs(changed.points[1][0]-.5)<1e-10);
  const clamped=markupBounds(resizeMarkup(mark,'nw',[2,2]));assert.ok(clamped.left<clamped.right&&clamped.top<clamped.bottom);
  const arrow={...mark,type:'arrow',points:[[.1,.2],[.7,.2]]};
  assert.deepEqual(resizeMarkup(arrow,'se',[.9,.6]).points,[[.1,.2],[.9,.6]]);
});
test('annotation history undoes moves, recolors and deletion of previously saved marks',()=>{
  const mark={type:'arrow',color:'#6436dc',points:[[.1,.2],[.7,.8]]};
  const initial={past:[],present:[mark],future:[]};
  let state=markupHistory(initial,{type:'commit',marks:[moveMarkup(mark,.1,0)]});
  state=markupHistory(state,{type:'commit',marks:[{...state.present[0],color:'#e14343'}]});
  state=markupHistory(state,{type:'commit',marks:[]});
  state=markupHistory(state,{type:'undo'});assert.equal(state.present[0].color,'#e14343');
  state=markupHistory(state,{type:'undo'});assert.equal(state.present[0].color,mark.color);
  state=markupHistory(state,{type:'undo'});assert.deepEqual(state.present,[mark]);
  state=markupHistory(state,{type:'redo'});assert.notDeepEqual(state.present,[mark]);
  state=markupHistory(state,{type:'commit',marks:[]});assert.equal(state.future.length,0);
});
test('edge scrolling is bounded, directional and stops outside the canvas',()=>{
  const rect={left:100,right:900,top:50,bottom:650};
  assert.deepEqual(edgeScrollVelocity({x:500,y:350},rect),{x:0,y:0});
  assert.deepEqual(edgeScrollVelocity({x:0,y:350},rect),{x:0,y:0});
  assert.equal(edgeScrollVelocity({x:900,y:350},rect).x,14);
  assert.equal(edgeScrollVelocity({x:500,y:50},rect).y,-14);
});
test('destination previews use content and truncate predictably',()=>{
  assert.equal(cardPreview({title:'Same',content:[textBlock('First\nproject')]}),'First project');
  assert.equal(cardPreview({title:'Same',note:'Second project'}),'Second project');
  assert.equal(cardPreview({content:[textBlock('abcdefghij')]},6),'abcde…');
  assert.equal(cardPreview({note:'Double-click to edit'}),'Empty card');
});
