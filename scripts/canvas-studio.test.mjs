import test from "node:test";
import assert from "node:assert/strict";
import { createStudioCopy, createStarterFlow, createScreen, duplicateScreen, prototypeStart, prototypeStep, brokenInteractions, remapStudioScreen, validStudioScreen, isStudioScreen } from "../src/lib/canvasStudio.js";
import { createShareUrl, readShareLink } from "../src/lib/boardShare.js";
import { createBoardSvg } from "../src/lib/boardExport.js";

const flow=()=>createStarterFlow([11,12,13]);
test("Studio copy isolates nested data and keeps source metadata intact",()=>{
 const source={id:"original",title:"Idea",favorite:true,board:{nodes:flow(),edges:[],viewport:{x:1,y:2,scale:.6}}};
 const before=structuredClone(source),copy=createStudioCopy(source,source.board,"copy",500);
 copy.board.nodes[0].studio.elements[0].text="Edited";
 assert.deepEqual(source,before);assert.equal(copy.id,"copy");assert.equal(copy.studioExperiment.sourceId,"original");assert.equal(copy.board.viewport,undefined);assert.equal(copy.favorite,false);
});
test("Starter journey navigates forward, back, and rejects unavailable destinations",()=>{
 const nodes=flow();let history=[prototypeStart(nodes).id];
 history=prototypeStep(nodes,history,nodes[0].studio.elements.at(-1).action);assert.deepEqual(history,[11,12]);
 history=prototypeStep(nodes,history,nodes[1].studio.elements.at(-1).action);assert.deepEqual(history,[11,12,13]);
 history=prototypeStep(nodes,history,{type:"back"});assert.deepEqual(history,[11,12]);
 assert.equal(prototypeStep(nodes,history,{type:"navigate",target:999}),history);
 assert.equal(prototypeStep([{...nodes[2],hidden:true}],history,{type:"navigate",target:13}),history);
 assert.deepEqual(prototypeStep(nodes,[11],{type:"back"}),[11]);
});
test("Removing a screen reports broken actions without crashing playback",()=>{
 const nodes=flow().filter(screen=>screen.id!==12);
 assert.equal(brokenInteractions(nodes).length,3);
 assert.equal(prototypeStart(nodes,12).id,11);
});
test("Duplicate and clipboard remap navigation without modifying originals",()=>{
 const original=flow()[0],before=structuredClone(original);
 const copied=remapStudioScreen(original,new Map([[11,21],[12,22]]));
 assert.equal(copied.studio.elements.at(-1).action.target,22);assert.equal(copied.studio.start,false);
 const external=remapStudioScreen(original,new Map([[11,21]]),true);
 assert.equal(external.studio.elements.at(-1).action,undefined);
 original.studio.elements[0].action={type:"navigate",target:11};
 const duplicate=duplicateScreen(original,42,2000);assert.equal(duplicate.studio.elements[0].action.target,42);assert.equal(duplicate.studio.start,false);
 delete original.studio.elements[0].action;assert.deepEqual(original,before);
});
test("Starter screens and element bounds are valid",()=>{
 for(const screen of [...flow(),createScreen(31,0,0,"Desktop","desktop")]){
   assert.ok(validStudioScreen(screen.studio));
   for(const item of screen.studio.elements){assert.ok(item.x>=0&&item.y>=0&&item.x+item.w<=screen.w&&item.y+item.h<=screen.h,`${screen.title}: ${item.id}`)}
 }
});
test("Studio share roundtrip preserves interactions and rejects invalid element geometry",async()=>{
 const project={id:"studio",title:"Prototype",board:{nodes:flow(),edges:[]}};
 const link=await createShareUrl(project,"https://nova.example",{access:"readonly"});
 const decoded=await readShareLink(new URL(link).hash);assert.equal(decoded.access,"readonly");assert.deepEqual(decoded.project.board,project.board);
 project.board.nodes[0].studio.elements[0].x='0" onload="alert(1)';
 await assert.rejects(createShareUrl(project,"https://nova.example"),/invalid/);
});
test("SVG export includes screen contents and escapes user text",()=>{
 const nodes=flow();nodes[0].studio.elements[0].text='<script>& "test"';
 const output=createBoardSvg(nodes,[]).svg;
 assert.ok(output.includes("&lt;script&gt;&amp;"));assert.ok(output.includes("Save this place"));assert.ok(!output.includes("<script>"));assert.ok(output.includes("studio-element-export-0"));
});

test("Malformed imported screens fall back to ordinary frames",()=>{
 const screen=flow()[0];screen.studio.elements[0].text=null;
 assert.equal(isStudioScreen(screen),false);
 const duplicateIds=flow()[0];duplicateIds.studio.elements[1].id=duplicateIds.studio.elements[0].id;
 assert.equal(isStudioScreen(duplicateIds),false);
});
