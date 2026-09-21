import { nodeSize } from "./boardAppearance.js";

const rotatedPoint = (node, x, y, width, height) => {
  const radians = (node.rotate || 0) * Math.PI / 180;
  if (!radians) return { x, y };
  const cx = node.x + width / 2;
  const cy = node.y + height / 2;
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * Math.cos(radians) - dy * Math.sin(radians), y: cy + dx * Math.sin(radians) + dy * Math.cos(radians) };
};

const roundedOrthogonalPath = (rawPoints, radius = 13) => {
  const points=rawPoints.filter((point,index)=>index===0||point.x!==rawPoints[index-1].x||point.y!==rawPoints[index-1].y);
  if(points.length<2)return "";
  if(radius<=0)return points.slice(1).reduce((path,point)=>`${path} L${point.x},${point.y}`,`M${points[0].x},${points[0].y}`);
  let path=`M${points[0].x},${points[0].y}`;
  for(let index=1;index<points.length-1;index+=1){
    const previous=points[index-1],corner=points[index],next=points[index+1];
    const incoming=Math.hypot(corner.x-previous.x,corner.y-previous.y),outgoing=Math.hypot(next.x-corner.x,next.y-corner.y);
    const curve=Math.min(radius,incoming/2,outgoing/2);
    const before={x:corner.x-(corner.x-previous.x)/incoming*curve,y:corner.y-(corner.y-previous.y)/incoming*curve};
    const after={x:corner.x+(next.x-corner.x)/outgoing*curve,y:corner.y+(next.y-corner.y)/outgoing*curve};
    path+=` L${before.x},${before.y} Q${corner.x},${corner.y} ${after.x},${after.y}`;
  }
  const last=points[points.length-1];
  return `${path} L${last.x},${last.y}`;
};

export const inferConnectionSide = (source, target) => {
  const sourceSize=nodeSize(source),targetSize=nodeSize(target);
  const dx=target.x+targetSize.width/2-(source.x+sourceSize.width/2);
  const dy=target.y+targetSize.height/2-(source.y+sourceSize.height/2);
  if(Math.abs(dx)>=Math.abs(dy))return dx>=0?"right":"left";
  return dy>=0?"bottom":"top";
};

export function boardEdgeData(nodes, edges, globalSettings = {}, visibleNodeIds = new Set(nodes.map(node => node.id))) {
  return edges.map(edge=>{
    const a=nodes.find(n=>n.id===edge.from),b=nodes.find(n=>n.id===edge.to);
    if(!a||!b||!visibleNodeIds.has(a.id)||!visibleNodeIds.has(b.id))return null;
    const aSize=nodeSize(a),bSize=nodeSize(b),aw=aSize.width,ah=aSize.height,bw=bSize.width,bh=bSize.height;
    const sourceSide=edge.side||inferConnectionSide(a,b);
    const horizontal=sourceSide==="left"||sourceSide==="right";
    const forward=sourceSide==="right"||sourceSide==="bottom";
    const structure=edge.structure||globalSettings.structure,pattern=edge.pattern||globalSettings.pattern,weight=edge.weight||globalSettings.weight;
    const sharedBranch=edge.side&&edges.filter(candidate=>candidate.from===edge.from&&candidate.side===edge.side).length>1;
    const cornerRadius=sharedBranch?7:14;
    let start,end,curve,elbow,control,handles,routeX,routeY;

    if(horizontal){
      start=rotatedPoint(a,a.x+(forward?aw:0),a.y+ah/2,aw,ah);
      end=rotatedPoint(b,b.x+(forward?0:bw),b.y+bh/2,bw,bh);
      const bend=Math.max(70,Math.abs(end.x-start.x)*.45),mid=edge.controlX??(start.x+end.x)/2;
      routeX=mid;routeY=edge.controlY??end.y;control={x:routeX,y:routeY};
      curve=edge.controlX!==undefined?`M${start.x},${start.y} Q${edge.controlX},${edge.controlY} ${end.x},${end.y}`:`M${start.x},${start.y} C${start.x+(forward?bend:-bend)},${start.y} ${end.x-(forward?bend:-bend)},${end.y} ${end.x},${end.y}`;
      if(edge.controlX!==undefined){const approach=end.x-(forward?48:-48);elbow=roundedOrthogonalPath([start,{x:edge.controlX,y:start.y},{x:edge.controlX,y:edge.controlY},{x:approach,y:edge.controlY},{x:approach,y:end.y},end],cornerRadius)}else elbow=roundedOrthogonalPath([start,{x:mid,y:start.y},{x:mid,y:end.y},end],cornerRadius);
    }else{
      start=rotatedPoint(a,a.x+aw/2,a.y+(forward?ah:0),aw,ah);
      end=rotatedPoint(b,b.x+bw/2,b.y+(forward?0:bh),bw,bh);
      const bend=Math.max(60,Math.abs(end.y-start.y)*.45),mid=edge.controlY??(start.y+end.y)/2;
      routeX=edge.controlX??end.x;routeY=mid;control={x:routeX,y:routeY};
      curve=edge.controlX!==undefined?`M${start.x},${start.y} Q${edge.controlX},${edge.controlY} ${end.x},${end.y}`:`M${start.x},${start.y} C${start.x},${start.y+(forward?bend:-bend)} ${end.x},${end.y-(forward?bend:-bend)} ${end.x},${end.y}`;
      if(edge.controlX!==undefined){const approach=end.y-(forward?48:-48);elbow=roundedOrthogonalPath([start,{x:start.x,y:edge.controlY},{x:edge.controlX,y:edge.controlY},{x:edge.controlX,y:approach},{x:end.x,y:approach},end],cornerRadius)}else elbow=roundedOrthogonalPath([start,{x:start.x,y:mid},{x:end.x,y:mid},end],cornerRadius);
    }

    const alignedElbow=structure==="elbow"&&edge.controlX===undefined&&(horizontal?Math.abs(start.y-end.y)<=16:Math.abs(start.x-end.x)<=16);
    if(structure==="straight"||alignedElbow||(structure==="curve"&&edge.controlX===undefined)){control={x:(start.x+end.x)/2,y:(start.y+end.y)/2};routeX=control.x;routeY=control.y;handles=[{...control,mode:"free"}]}else if(structure==="elbow"&&horizontal){const approach=end.x-(forward?48:-48);handles=[{x:routeX,y:(start.y+routeY)/2,mode:"x"},{x:(routeX+approach)/2,y:routeY,mode:"y"}]}else if(structure==="elbow"){const approach=end.y-(forward?48:-48);handles=[{x:(start.x+routeX)/2,y:routeY,mode:"y"},{x:routeX,y:(routeY+approach)/2,mode:"x"}]}else handles=[{...control,mode:"free"}];
    const path=structure==="straight"||alignedElbow?`M${start.x},${start.y} L${end.x},${end.y}`:structure==="elbow"?elbow:curve;
    return{...edge,path,structure,pattern,weight,start,end,control,handles,routeX,routeY,horizontal};
  });
}
