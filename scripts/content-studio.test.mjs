import test from 'node:test';
import assert from 'node:assert/strict';
import { newContent, textBlock, normalizeCellContent, editTable, placeAttachment, replaceContentText } from '../src/lib/cellContent.js';
import { blockPayload, blockSelection, selectedBlocks, readBlockPayload, transferBlocks, removeBlocks } from '../src/lib/blockEditing.js';
import { markdownBlocks } from '../src/lib/markdownBlocks.js';
import { normalizeMarkup } from '../src/lib/imageMarkup.js';
import { createShareUrl, readShareLink } from '../src/lib/boardShare.js';

const text = value => ({ ...textBlock(value), html: `<strong>${value}</strong>` });
const card = (id,content) => ({id,x:0,y:0,title:`Card ${id}`,note:'',color:'white',shape:'round',content});

test('column widths survive row and column edits, normalization and portable validation', async () => {
  const table=newContent('table');table.columnWidths=[130,360];const board={cells:[card(1,[table])]};
  editTable(board,table.id,'insert-column',1);assert.deepEqual(table.columnWidths,[130,190,360]);
  editTable(board,table.id,'insert-row',0);assert.deepEqual(table.columnWidths,[130,190,360]);
  editTable(board,table.id,'delete-column',0);assert.deepEqual(table.columnWidths,[190,360]);
  assert.deepEqual(normalizeCellContent([table])[0].columnWidths,[190,360]);
  const url=await createShareUrl({title:'Columns',board:{nodes:board.cells,edges:[]}},'https://nova.example');
  const shared=await readShareLink(new URL(url).hash);assert.deepEqual(shared.project.board.nodes[0].content[0].columnWidths,[190,360]);
  assert.throws(()=>normalizeCellContent([{...table,columnWidths:[-1,Infinity]}]));
  assert.throws(()=>normalizeCellContent([{...table,columnWidths:[180]}]));
});

test('multi-block selection preserves order and does not duplicate selected descendants', () => {
  const a=text('A'),table=newContent('table'),b=text('B'),nested=table.rows[0][0].content[0];
  assert.deepEqual(selectedBlocks([a,table,b],[nested.id,b.id,table.id,a.id]).map(block=>block.id),[a.id,table.id,b.id]);
  assert.ok(blockSelection([a,table,b],[a.id],b.id,{range:true}).includes(nested.id));
  assert.deepEqual(blockSelection([a,b],[a.id],b.id,{toggle:true}),[a.id,b.id]);
  assert.deepEqual(blockSelection([a,b],[a.id,b.id],a.id,{toggle:true}),[b.id]);
});

test('moving several formatted blocks between cards is atomic and preserves identifiers', () => {
  const a=text('A'),b=text('B'),c=text('C');const nodes=[card(1,[a,b]),card(2,[c])],before=structuredClone(nodes);
  const result=transferBlocks(nodes,blockPayload(nodes[0],[a.id,b.id],'board'),{cardId:2,blockId:c.id,position:'before'},true);
  assert.deepEqual(result.nodes[1].content.slice(0,3).map(block=>block.id),[a.id,b.id,c.id]);
  assert.equal(result.nodes[1].content[0].html,'<strong>A</strong>');
  assert.equal(result.nodes[0].content.length,1);assert.equal(result.nodes[0].content[0].text,'');
  assert.deepEqual(nodes,before);
});

test('same-card reordering accounts for removals before the destination', () => {
  const a=text('A'),b=text('B'),c=text('C'),d=text('D'),nodes=[card(1,[a,b,c,d])];
  const result=transferBlocks(nodes,blockPayload(nodes[0],[a.id,b.id],'board'),{cardId:1,blockId:d.id,position:'after'},true);
  assert.deepEqual(result.nodes[0].content.slice(0,4).map(block=>block.text),['C','D','A','B']);
});

test('copy regenerates all nested ids and preserves table widths, links and image annotations', () => {
  const table=newContent('table');table.columnWidths=[150,300];
  table.rows[0][0].content=[{...text('See card'),html:'<a href="#card=2">@Card 2</a>'}];
  const image={...newContent('image'),annotations:[{type:'arrow',color:'#e14343',points:[[.1,.2],[.6,.8]]}]};
  const nodes=[card(1,[table,image]),card(2,[])];
  const payload=readBlockPayload(JSON.stringify(blockPayload(nodes[0],[table.id,image.id],'board')));
  const result=transferBlocks(nodes,payload,{cardId:2});const [copy,copyImage]=result.nodes[1].content;
  assert.notEqual(copy.id,table.id);assert.notEqual(copy.rows[0][0].id,table.rows[0][0].id);assert.notEqual(copy.rows[0][0].content[0].id,table.rows[0][0].content[0].id);
  assert.equal(copy.rows[0][0].content[0].html,table.rows[0][0].content[0].html);assert.deepEqual(copy.columnWidths,[150,300]);assert.deepEqual(copyImage.annotations,image.annotations);
});

test('invalid targets, locked cards, self-drops and nested cycles cannot delete source content', () => {
  const table=newContent('table'),node=card(1,[table]),nodes=[node,{...card(2,[]),locked:true}],before=structuredClone(nodes),payload=blockPayload(node,[table.id],'board');
  for(const destination of [{cardId:2},{cardId:99},{cardId:1,blockId:'missing'},{cardId:1,ownerId:table.rows[0][0].id},{cardId:1,blockId:table.id}])assert.throws(()=>transferBlocks(nodes,payload,destination,true));
  assert.deepEqual(nodes,before);
  assert.throws(()=>transferBlocks([{...node,locked:true},card(2,[])],payload,{cardId:2},true));
});

test('moves into table cells enforce nesting depth without truncation', () => {
  const a=newContent('table'),b=newContent('table'),c=newContent('table'),source=newContent('table');
  a.rows[0][0].content=[b];b.rows[0][0].content=[c];
  const nodes=[card(1,[source]),card(2,[a])],payload=blockPayload(nodes[0],[source.id],'board');
  assert.throws(()=>transferBlocks(nodes,payload,{cardId:2,ownerId:c.rows[0][0].id},true),/three levels/);
  const moved=transferBlocks(nodes,blockPayload(nodes[1],[c.rows[0][0].content[0].id],'board'),{cardId:1,blockId:source.id,position:'before'},true);
  assert.doesNotThrow(()=>normalizeCellContent(moved.nodes[1].content));
});

test('dropping into a simple card retains its note and appearance', () => {
  const a=text('A'),target={id:2,x:100,y:100,w:260,h:120,rotate:8,shape:'pill',color:'violet',title:'Simple',note:'Existing note'};
  const nodes=[card(1,[a]),target],result=transferBlocks(nodes,blockPayload(nodes[0],[a.id],'board'),{cardId:2});
  assert.equal(result.nodes[1].content[0].text,'Existing note');assert.equal(result.nodes[1].content[1].text,'A');
  assert.equal(result.nodes[1].contentLayout,'card');assert.equal(result.nodes[1].w,260);assert.equal(result.nodes[1].shape,'pill');assert.equal(result.nodes[1].rotate,8);
});

test('deleting selected parents and children leaves an editable document', () => {
  const table=newContent('table');const removed=removeBlocks([table],[table.id,table.rows[0][0].content[0].id]);
  assert.equal(removed.length,1);assert.equal(removed[0].type,'text');assert.equal(removed[0].text,'');
});

test('Markdown paste creates real heading, task, code and table blocks with inline formatting', () => {
  const blocks=markdownBlocks('# Research\n\n- [x] **Done**\n- [ ] Next\n\n```ts\nconst ok: boolean = true;\n```\n\n| Option | Note |\n| --- | --- |\n| A | *Useful* |');
  assert.deepEqual(blocks.map(block=>block.type),['heading','checklist','code','table']);
  assert.equal(blocks[0].level,1);assert.equal(blocks[1].tasks[0].done,true);assert.match(blocks[1].tasks[0].html,/<strong>Done<\/strong>/);assert.doesNotMatch(blocks[1].tasks[0].html,/<input/);
  assert.equal(blocks[2].language,'TypeScript');assert.equal(blocks[2].code,'const ok: boolean = true;');assert.match(blocks[3].rows[0][1].content[0].html,/<em>Useful<\/em>/);
});

test('Markdown leaves ordinary text alone and does not execute HTML or load remote images', () => {
  assert.equal(markdownBlocks('Ordinary words\nsecond line'),null);
  const blocks=markdownBlocks('**Read** [bad](javascript:alert) ![remote](https://example.com/pic.png)\n\n<script>alert(1)</script>');
  assert.doesNotMatch(blocks[0].html,/<img|javascript:/);assert.match(blocks[0].html,/https:\/\/example.com\/pic.png/);
  assert.equal(blocks[1].text,'<script>alert(1)</script>');assert.equal(blocks[1].html,undefined);
  assert.throws(()=>markdownBlocks('a'.repeat(500001)),/500,000/);
  assert.equal(markdownBlocks('| A | B |\n|---|---|\n|C|D|',3)[0].type,'text');
});

test('annotation validation bounds geometry and replacement resets old markup only', () => {
  const annotations=normalizeMarkup([{type:'rectangle',color:'red',points:[[-1,2],[.5,.5]]}]);assert.deepEqual(annotations[0].points,[[0,1],[.5,.5]]);
  assert.throws(()=>normalizeMarkup([{type:'pen',points:[[0,NaN],[1,1]]}]));
  const image={...newContent('image'),caption:'Keep caption',data:'old',annotations};const board={cells:[card(1,[image])]};
  placeAttachment(board,image.id,'image',{data:'new',filename:'new.png'});assert.deepEqual(image.annotations,[]);assert.equal(image.caption,'Keep caption');
  const task={...newContent('checklist'),tasks:[{text:'old',html:'<b>old</b>',done:false}]};assert.equal(replaceContentText([task],/old/g,'new')[0].tasks[0].html,undefined);
});

test('shared boards retain formatted tasks, card references and editable image annotations', async () => {
  const task={...newContent('checklist'),tasks:[{text:'Review Card 2',html:'Review <a href="#card=2">@Card 2</a>',done:false}]};
  const image={...newContent('image'),naturalWidth:800,naturalHeight:400,annotations:[{type:'arrow',color:'#e14343',points:[[.2,.3],[.7,.8]]}]};
  const url=await createShareUrl({title:'Rich content',board:{nodes:[card(1,[task,image]),card(2,[])],edges:[]}},'https://nova.example');
  const shared=await readShareLink(new URL(url).hash),blocks=shared.project.board.nodes[0].content;
  assert.deepEqual(blocks[0].tasks,task.tasks);
  assert.deepEqual(blocks[1].annotations,image.annotations);
  assert.equal(blocks[1].naturalWidth,800);assert.equal(blocks[1].naturalHeight,400);
});
