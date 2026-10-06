import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapPreviewText, previewBlocks } from '../src/lib/previewLayout.js';
import { templates } from '../src/data/templates.js';
import { nodeSize } from '../src/lib/boardAppearance.js';
import { readWorkspacePreferences, saveWorkspacePreferences, normalizeWorkspacePreferences, WORKSPACE_PREFERENCES_KEY } from '../src/lib/workspacePreferences.js';
import { projectBatchChanges, projectCollection } from '../src/lib/projectBatch.js';

test('preview text wraps words and long tokens, preserves newlines, and truncates within bounds', () => {
  assert.deepEqual(wrapPreviewText('one two three', 60, 10), ['one two', 'three']);
  assert.deepEqual(wrapPreviewText('first\nsecond', 100, 10), ['first', 'second']);
  assert.ok(wrapPreviewText('x'.repeat(100), 40).every(line => line.length <= 5));
  const shortened = wrapPreviewText('one two three four five', 60, 10, 1);
  assert.equal(shortened.length, 1); assert.ok(shortened[0].endsWith('…')); assert.ok(shortened[0].length <= 11);
});

test('preview layout retains completed checks and fits image aspect ratios', () => {
  const content = [{id:'tasks',type:'checklist',tasks:[{id:'a',text:'Completed experiment',done:true},{id:'b',text:'Next experiment',done:false}]},{id:'image',type:'image',naturalWidth:800,naturalHeight:400,caption:'Prototype'}];
  const before=structuredClone(content), layout=previewBlocks(content,420);
  assert.deepEqual(layout.blocks[0].tasks.map(task=>task.done),[true,false]);
  assert.equal(layout.blocks[1].imageWidth,400); assert.equal(layout.blocks[1].imageHeight,200);
  assert.ok(layout.blocks[1].y >= layout.blocks[0].height + 14);
  assert.deepEqual(content,before);
});

test('preview tables retain widths and recursively measure nested content', () => {
  const layout=previewBlocks([{id:'table',type:'table',headers:['Item','Outcome'],columnWidths:[150,250],rows:[[{content:[{id:'text',type:'text',text:'An experiment with a deliberately long title'}]},{content:[{id:'check',type:'checklist',tasks:[{text:'Ready',done:true}]}]}]]}],400);
  const table=layout.blocks[0];
  assert.deepEqual(table.columns,[150,250]); assert.ok(table.rows[0].cells[0].blocks[0].lines.length>1);
  assert.ok(table.rows[0].height>table.rows[0].cells[0].height);
  assert.equal(table.rows[0].cells[1].blocks[0].tasks[0].done,true);
});

test('every curated document preview fits within its card', () => {
  for(const template of templates) for(const node of template.board.nodes.filter(node=>node.content)) {
    const size=nodeSize(node);
    const end=56+(wrapPreviewText(node.title,size.width-48,18,2).length-1)*26+previewBlocks(node.content,size.width-50).height;
    assert.ok(end<=size.height-10,`${template.id}: ${node.title} overflows`);
  }
});

test('workspace preferences survive reload and handle invalid or unavailable storage', () => {
  const items=new Map(), storage={getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value)};
  assert.deepEqual(readWorkspacePreferences(storage),{view:'grid',sort:'recent'});
  assert.equal(saveWorkspacePreferences({view:'list',sort:'name'},storage),true);
  assert.deepEqual(readWorkspacePreferences(storage),{view:'list',sort:'name'});
  items.set(WORKSPACE_PREFERENCES_KEY,'bad JSON');
  assert.deepEqual(readWorkspacePreferences(storage),{view:'grid',sort:'recent'});
  assert.deepEqual(normalizeWorkspacePreferences({view:'bad',sort:'oldest'}),{view:'grid',sort:'oldest'});
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.deepEqual(readWorkspacePreferences(blocked),{view:'grid',sort:'recent'});
  assert.equal(saveWorkspacePreferences({view:'list'},blocked),false);
});

const projects=[{id:'a',title:'A',folder:'Work',updated:1,board:{nodes:[{id:1}]}},{id:'b',title:'B',folder:'Keep',updated:2},{id:'c',title:'C',updated:3,deletedAt:4}];
test('batch moves affect only selected active projects, deduplicate ids, and preserve board data', () => {
  const before=structuredClone(projects), changed=projectBatchChanges(projects,['a','a','c','missing'],'move','  Ideas  ',10);
  assert.equal(changed.length,1); assert.equal(changed[0].folder,'Ideas'); assert.equal(changed[0].updated,10);
  assert.deepEqual(changed[0].board,projects[0].board); assert.deepEqual(projects,before);
  assert.equal(projectBatchChanges(projects,['a'],'move','',11)[0].folder,'');
  assert.deepEqual(projectBatchChanges(projects,[],'move','Ideas'),[]);
});
test('batch Trash preserves recoverable content and never re-deletes trashed projects', () => {
  const changed=projectBatchChanges(projects,['a','b','c'],'trash','',20);
  assert.deepEqual(changed.map(p=>p.id),['a','b']); assert.ok(changed.every(p=>p.deletedAt===20));
  assert.deepEqual(changed[0].board,projects[0].board);
  assert.throws(()=>projectBatchChanges(projects,['a'],'unknown'));
});
test('selection export includes only selected projects and their own history', () => {
  const versions=[{projectId:'a',board:{nodes:[]}},{projectId:'b',board:{nodes:[]}},{projectId:'c',board:{nodes:[]}}];
  const payload=projectCollection([projects[0]],versions);
  assert.equal(payload.format,'nova-workspace'); assert.equal(payload.version,1);
  assert.deepEqual(payload.projects,[projects[0]]); assert.deepEqual(payload.versions,[versions[0]]);
  assert.deepEqual(payload.shapeLibrary,[]); assert.equal(versions.length,3);
});
