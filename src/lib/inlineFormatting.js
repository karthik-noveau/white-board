const formats = {bold:'b,strong',italic:'i,em',underline:'u',strikeThrough:'s,del',highlight:'mark',code:'code'};
const clearTags = new Set(['B','STRONG','I','EM','U','S','DEL','MARK','CODE','SPAN','A','SUB','SUP']);

function selectedText(root, range) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (!range.intersectsNode(node)) continue;
    const start = range.startContainer === node ? range.startOffset : 0;
    const end = range.endContainer === node ? range.endOffset : node.length;
    if (end > start) nodes.push(node);
  }
  return nodes;
}
export function selectionFormats(root, range) {
  const nodes = range && !range.collapsed ? selectedText(root,range) : [];
  return Object.fromEntries(Object.entries(formats).map(([name,selector]) => [name, nodes.length > 0 && nodes.every(node => {
    const ancestor = node.parentElement.closest(selector); return ancestor && root.contains(ancestor);
  })]));
}

export function restoreTextSelection(root, start, end) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
  let offset = 0, node, begun = false;
  while ((node = walker.nextNode())) {
    if (!begun && offset + node.length >= start) { range.setStart(node,Math.max(0,start-offset)); begun=true; }
    if (begun && offset + node.length >= end) { range.setEnd(node,Math.max(0,end-offset)); break; }
    offset += node.length;
  }
  if (!begun) { range.selectNodeContents(root); range.collapse(false); }
  else if (!node) range.setEnd(root,root.childNodes.length);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  return range;
}

// Split only inline ancestors crossing a selection boundary. Paragraphs, lists,
// links and formatting outside the selection retain their original structure.
export function formattedSelectionHTML(root, range, command) {
  const before = document.createRange(); before.selectNodeContents(root); before.setEnd(range.startContainer,range.startOffset);
  const start = before.toString().length, end = start + range.toString().length;
  const tag = command === 'highlight' ? 'MARK' : 'CODE';
  const remove = command === 'removeFormat' || selectionFormats(root,range)[command];
  const removals = command === 'removeFormat' ? clearTags : new Set([tag]);
  let offset = 0;
  const visit = (node, split = false) => {
    if (node.nodeType === 3) {
      const from = Math.max(0,Math.min(node.length,start-offset)), to = Math.max(0,Math.min(node.length,end-offset)); offset += node.length;
      return [[node.data.slice(0,from),false],[node.data.slice(from,to),true],[node.data.slice(to),false]].filter(([text])=>text).map(([text,selected])=>{
        let child = document.createTextNode(text);
        if (selected && !remove && !node.parentElement.closest(tag.toLowerCase())) { const wrap = document.createElement(tag); wrap.append(child); child=wrap; }
        return {node:child,selected};
      });
    }
    if (node.nodeType !== 1) return [];
    const unwrap = remove && removals.has(node.tagName);
    const children = [...node.childNodes].flatMap(child=>visit(child,split||unwrap));
    if (!children.length) return [{node:node.cloneNode(false),selected:false}];
    if (!split && !unwrap) { const clone=node.cloneNode(false); clone.append(...children.map(child=>child.node)); return [{node:clone,selected:false}]; }
    const groups = [];
    for (const child of children) {
      if (groups.at(-1)?.selected !== child.selected) groups.push({selected:child.selected,nodes:[]});
      groups.at(-1).nodes.push(child.node);
    }
    return groups.flatMap(group=>{
      if (unwrap && group.selected) return group.nodes.map(node=>({node,selected:true}));
      const clone=node.cloneNode(false); clone.append(...group.nodes); return [{node:clone,selected:group.selected}];
    });
  };
  const host=document.createElement('div'); host.append(...[...root.childNodes].flatMap(node=>visit(node)).map(item=>item.node));
  return {html:host.innerHTML,start,end};
}
