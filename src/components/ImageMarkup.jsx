import { useId } from 'react';

export default function ImageMarkup({ marks = [], className = '', width = 1000, height = 1000 }) {
  const id = useId().replaceAll(':', '');
  return <svg data-image-markup className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
    {marks.map((mark, index) => {
      const points = mark.points.map(([x,y]) => [x * width, y * height]), [start,end] = [points[0], points.at(-1)];
      const stroke = Math.max(width, height) / 260;
      return <g key={index} fill="none" stroke={mark.color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {mark.type === 'rectangle' ? <rect x={Math.min(start[0],end[0])} y={Math.min(start[1],end[1])} width={Math.abs(end[0]-start[0])} height={Math.abs(end[1]-start[1])} rx={stroke}/>
          : mark.type === 'pen' ? <polyline points={points.map(point => point.join(',')).join(' ')}/>
          : <><defs><marker id={`${id}-${index}`} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M1 1 5.5 3.5 1 6" stroke={mark.color} strokeWidth="1.5" fill="none"/></marker></defs><path d={`M${start.join(',')}L${end.join(',')}`} markerEnd={`url(#${id}-${index})`}/></>}
      </g>;
    })}
  </svg>;
}
