export const MARKUP_COLORS = ['#6436dc', '#e14343', '#e39c19', '#18764d', '#ffffff'];
export function normalizeMarkup(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 500) throw new Error('Invalid image markup');
  return value.map(mark => {
    if (!mark || !['arrow','rectangle','pen'].includes(mark.type) || !Array.isArray(mark.points) || mark.points.length < 2 || mark.points.length > 2000) throw new Error('Invalid image markup');
    const points = mark.points.map(point => {
      if (!Array.isArray(point) || point.length !== 2 || point.some(value => !Number.isFinite(value))) throw new Error('Invalid image markup point');
      return point.map(value => Math.max(0, Math.min(1, value)));
    });
    return { type: mark.type, points: mark.type === 'pen' ? points : [points[0], points.at(-1)], color: MARKUP_COLORS.includes(mark.color) ? mark.color : MARKUP_COLORS[0] };
  });
}

export function markupBounds(mark) {
  return {
    left:Math.min(...mark.points.map(point=>point[0])), top:Math.min(...mark.points.map(point=>point[1])),
    right:Math.max(...mark.points.map(point=>point[0])), bottom:Math.max(...mark.points.map(point=>point[1])),
  };
}

export function moveMarkup(mark, dx, dy) {
  const bounds=markupBounds(mark);
  dx=Math.max(-bounds.left,Math.min(1-bounds.right,dx)); dy=Math.max(-bounds.top,Math.min(1-bounds.bottom,dy));
  return {...mark,points:mark.points.map(([x,y])=>[x+dx,y+dy])};
}

export function resizeMarkup(mark, handle, point) {
  const from=markupBounds(mark), to={...from}, minimum=.002;
  if(handle.includes('w'))to.left=Math.max(0,Math.min(from.right-minimum,point[0]));
  if(handle.includes('e'))to.right=Math.min(1,Math.max(from.left+minimum,point[0]));
  if(handle.includes('n'))to.top=Math.max(0,Math.min(from.bottom-minimum,point[1]));
  if(handle.includes('s'))to.bottom=Math.min(1,Math.max(from.top+minimum,point[1]));
  return {...mark,points:mark.points.map(([x,y],index)=>[
    from.right===from.left?to.left+index/(mark.points.length-1)*(to.right-to.left):to.left+(x-from.left)/(from.right-from.left)*(to.right-to.left),
    from.bottom===from.top?to.top+index/(mark.points.length-1)*(to.bottom-to.top):to.top+(y-from.top)/(from.bottom-from.top)*(to.bottom-to.top),
  ])};
}

export function markupHistory(state, action) {
  if(action.type==='undo' && state.past.length)return {past:state.past.slice(0,-1),present:state.past.at(-1),future:[state.present,...state.future]};
  if(action.type==='redo' && state.future.length)return {past:[...state.past,state.present],present:state.future[0],future:state.future.slice(1)};
  if(action.type==='commit') {
    const present=normalizeMarkup(action.marks);
    if(JSON.stringify(present)===JSON.stringify(state.present))return state;
    return {past:[...state.past.slice(-49),state.present],present,future:[]};
  }
  return state;
}
