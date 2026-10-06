import { useLayoutEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './BoardIcon';
import ImageMarkup from './ImageMarkup';
import { MARKUP_COLORS, normalizeMarkup, markupBounds, moveMarkup, resizeMarkup, markupHistory } from '../lib/imageMarkup';
import styles from '../styles/imageViewer.module.css';

export default function ImageViewer({ block, editable, onSave, onClose }) {
  const dialog = useRef(null), viewport = useRef(null), surface = useRef(null), gesture = useRef(null), confirmRef = useRef(null);
  const [history,dispatch] = useReducer(markupHistory,block.annotations,marks=>({past:[],present:normalizeMarkup(marks),future:[]}));
  const marks=history.present;
  const [draft,setDraft] = useState(null), [selected,setSelected] = useState(null);
  const [tool,setTool] = useState(editable?'select':'pan'), [color,setColor] = useState(MARKUP_COLORS[0]), [zoom,setZoom] = useState(1);
  const [size,setSize] = useState({width:block.naturalWidth||1000,height:block.naturalHeight||700}), [fit,setFit] = useState(1);
  const [confirm,setConfirm] = useState(false), [message,setMessage] = useState('');
  const dirty = JSON.stringify(marks) !== JSON.stringify(normalizeMarkup(block.annotations));
  const visibleMarks=draft ? draft.index==null?[...marks,draft.mark]:marks.map((mark,i)=>i===draft.index?draft.mark:mark) : marks;
  const selectedMark=selected==null?null:visibleMarks[selected], bounds=selectedMark&&markupBounds(selectedMark);
  const commit=next=>dispatch({type:'commit',marks:next});
  const close = () => dirty ? setConfirm(true) : onClose();
  useLayoutEffect(() => { if (confirm) confirmRef.current?.querySelector('button')?.focus(); }, [confirm]);
  useLayoutEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element.showModal();
    return () => { element.close(); if(previous?.isConnected)previous.focus({preventScroll:true}); };
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current;
    const resize = () => setFit(Math.max(.01, Math.min(1, (element.clientWidth - 48) / size.width, (element.clientHeight - 48) / size.height)));
    resize(); const observer = new ResizeObserver(resize); observer.observe(element); return () => observer.disconnect();
  }, [size]);
  const undo = () => { dispatch({type:'undo'});setSelected(null); };
  const redoMark = () => { dispatch({type:'redo'});setSelected(null); };
  const removeSelected=()=>{if(selected==null)return;commit(marks.filter((_,i)=>i!==selected));setSelected(null);setMessage('Annotation deleted');};
  const point = event => { const rect = surface.current.getBoundingClientRect(); return [Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))]; };
  const startEdit=(event,index,handle=null)=>{
    if(event.button!==0 || !editable)return;
    event.preventDefault();event.stopPropagation();setSelected(index);setColor(marks[index].color);
    surface.current.focus({preventScroll:true});surface.current.setPointerCapture(event.pointerId);
    gesture.current={index,handle,origin:point(event),original:marks[index],mark:marks[index]};
  };
  const end = (event,cancel=false) => {
    const active=gesture.current;if(!active)return;
    gesture.current=null;
    if(active.mark&&!cancel){
      if(active.index!=null)commit(marks.map((mark,i)=>i===active.index?active.mark:mark));
      else if(active.mark.type==='pen'&&active.mark.points.length>2||Math.hypot(active.mark.points[0][0]-active.mark.points.at(-1)[0],active.mark.points[0][1]-active.mark.points.at(-1)[1])>.002){
        commit([...marks,active.mark]);setSelected(marks.length);setTool('select');
      }
    }
    setDraft(null);event.stopPropagation();
  };
  const save = () => { onSave?.({annotations:marks,naturalWidth:size.width,naturalHeight:size.height});onClose(); };
  const download = async () => {
    try {
      const image = surface.current.querySelector('img'); await image.decode();
      const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;const context=canvas.getContext('2d');context.drawImage(image,0,0,size.width,size.height);
      const overlay=surface.current.querySelector('[data-image-markup]').cloneNode(true);overlay.setAttribute('xmlns','http://www.w3.org/2000/svg');overlay.setAttribute('width',size.width);overlay.setAttribute('height',size.height);overlay.removeAttribute('style');
      const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(overlay)],{type:'image/svg+xml'}));
      try{const markup=new Image();markup.src=url;await markup.decode();context.drawImage(markup,0,0,size.width,size.height)}finally{URL.revokeObjectURL(url)}
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error();const url2=URL.createObjectURL(blob),a=document.createElement('a');a.href=url2;a.download=`${(block.filename||'image').replace(/\.[^.]+$/,'')}-annotated.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url2),1000);
    }catch{setMessage('Could not download this image. Your annotations are still available.');}
  };
  return createPortal(<dialog ref={dialog} data-cell-menu className={styles.dialog} aria-label="Image viewer and annotation" onCancel={event=>{event.preventDefault();event.stopPropagation();close()}} onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onKeyDown={event=>{
    event.stopPropagation();if(confirm)return;
    const modifier=event.metaKey||event.ctrlKey,key=event.key.toLowerCase();
    if(modifier&&(key==='z'||key==='y')){event.preventDefault();if(editable)(key==='y'||event.shiftKey?redoMark:undo)();return;}
    if(!editable||!selectedMark||!surface.current.contains(event.target))return;
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();removeSelected();}
    if(event.key==='Escape'){event.preventDefault();setSelected(null);}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();const step=(event.shiftKey?10:1)/(fit*zoom),dx=(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/size.width,dy=(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/size.height;
      const next=event.altKey?resizeMarkup(selectedMark,'se',[bounds.right+dx,bounds.bottom+dy]):moveMarkup(selectedMark,dx,dy);
      commit(marks.map((mark,i)=>i===selected?next:mark));
    }
  }}>
    <header className={styles.header}><div><strong>{block.filename||'Image'}</strong><small>{block.caption||'Inspect at full size'}</small></div><button onClick={download} title="Download image with annotations"><Icon name="download" size={18}/><span>Download</span></button>{editable&&<button className={styles.save} onClick={save} disabled={!dirty}>Save changes</button>}<button aria-label="Close image" onClick={close}><Icon name="close" size={20}/></button></header>
    <div className={styles.tools} role="toolbar" aria-label="Image tools">
      {[...(editable?[["select","Select","cursor"]]:[]),["pan","Pan","hand"],...(editable?[["arrow","Arrow","forward"],["rectangle","Rectangle","box"],["pen","Draw","pencil"]]:[])].map(([value,label,icon])=><button key={value} aria-label={label} title={label} aria-pressed={tool===value} onClick={()=>{setTool(value);setSelected(null);setMessage('');}}><Icon name={icon} size={18}/><span>{label}</span></button>)}
      {editable&&<><i/>{MARKUP_COLORS.map(value=><button key={value} className={styles.swatch} aria-label={`Annotation color ${value}`} aria-pressed={(selectedMark?.color||color)===value} style={{'--swatch':value}} onClick={()=>{setColor(value);if(selected!=null)commit(marks.map((mark,i)=>i===selected?{...mark,color:value}:mark));}}/>)}<i/><button aria-label="Undo annotation" title="Undo annotation" disabled={!history.past.length} onClick={undo}><Icon name="undo" size={17}/></button><button aria-label="Redo annotation" title="Redo annotation" disabled={!history.future.length} onClick={redoMark}><Icon name="redo" size={17}/></button>{selectedMark&&<button aria-label="Delete selected annotation" title="Delete selected annotation" onClick={removeSelected}><Icon name="trash" size={18}/></button>}</>}
    </div>
    <div ref={viewport} className={styles.viewport}>
      <div className={styles.center} style={{minWidth:Math.ceil(size.width*fit*zoom)+48,minHeight:Math.ceil(size.height*fit*zoom)+48}}>
        <div ref={surface} tabIndex={0} aria-label="Image annotation canvas" className={styles.surface} style={{width:size.width*fit*zoom,height:size.height*fit*zoom,cursor:tool==='pan'?'grab':tool==='select'?'default':'crosshair'}}
          onPointerDown={event=>{
            if(event.button!==0)return;event.preventDefault();surface.current.focus({preventScroll:true});
            if(!['select','pan'].includes(tool)&&marks.length>=500){setMessage('An image supports up to 500 annotations.');return;}
            surface.current.setPointerCapture(event.pointerId);setSelected(null);
            if(tool==='pan')gesture.current={x:event.clientX,y:event.clientY,left:viewport.current.scrollLeft,top:viewport.current.scrollTop};
            else if(tool!=='select'){const p=point(event),mark={type:tool,color,points:[p,p]};gesture.current={mark};setDraft({mark});}
          }}
          onPointerMove={event=>{
            const active=gesture.current;if(!active)return;
            if(active.mark){const p=point(event);
              active.mark=active.index!=null ? active.handle?resizeMarkup(active.original,active.handle,p):moveMarkup(active.original,p[0]-active.origin[0],p[1]-active.origin[1])
                : {...active.mark,points:active.mark.type==='pen'?[...active.mark.points.slice(0,1999),p]:[active.mark.points[0],p]};
              setDraft({mark:active.mark,index:active.index});
            }else{viewport.current.scrollLeft=active.left-(event.clientX-active.x);viewport.current.scrollTop=active.top-(event.clientY-active.y);}
          }}
          onPointerUp={event=>end(event)} onPointerCancel={event=>end(event,true)} onLostPointerCapture={event=>end(event)}>
          <img src={block.data} alt={block.caption||block.filename||'Image'} draggable={false} onLoad={event=>setSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})}/>
          <ImageMarkup marks={visibleMarks} width={size.width} height={size.height}/>
          {editable&&tool==='select'&&<svg className={styles.hitTargets} viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-label="Saved annotations">
            {visibleMarks.map((mark,index)=>{
              const coords=mark.points.map(([x,y])=>[x*size.width,y*size.height]),b=markupBounds(mark);
              const props={tabIndex:0,role:'button','aria-label':`Select ${mark.type} annotation ${index+1}`,'aria-pressed':selected===index,stroke:'transparent',strokeWidth:24/(fit*zoom),onFocus:()=>{setSelected(index);setColor(mark.color);},onPointerDown:event=>startEdit(event,index),onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(index);}}};
              return mark.type==='rectangle'?<rect key={index} {...props} x={b.left*size.width} y={b.top*size.height} width={(b.right-b.left)*size.width} height={(b.bottom-b.top)*size.height} fill="transparent"/>:<polyline key={index} {...props} points={coords.map(p=>p.join(',')).join(' ')} fill="none"/>;
            })}
          </svg>}
          {editable&&tool==='select'&&bounds&&<div className={styles.selection} style={{left:`${bounds.left*100}%`,top:`${bounds.top*100}%`,width:`${(bounds.right-bounds.left)*100}%`,height:`${(bounds.bottom-bounds.top)*100}%`}}>
            {['nw','ne','sw','se'].map(handle=><button key={handle} className={styles.resizeHandle} data-handle={handle} aria-label={`Resize annotation ${handle==='nw'?'top left':handle==='ne'?'top right':handle==='sw'?'bottom left':'bottom right'}`} title="Drag to resize · Alt + arrow keys to resize" onPointerDown={event=>startEdit(event,selected,handle)}/>)}
          </div>}
        </div>
      </div>
    </div>
    <footer className={styles.footer}><span role="status">{message||(selectedMark?'Drag to move · Corners resize · Arrow keys adjust · Delete removes':editable?tool==='select'?'Select an annotation to edit it':tool==='pan'?'Drag to inspect':'Drag on the image to annotate':'Drag to inspect')}</span><div><button aria-label="Zoom image out" disabled={zoom<=.5} onClick={()=>setZoom(value=>Math.max(.5,value/1.25))}>−</button><output>{Math.round(fit*zoom*100)}%</output><button aria-label="Zoom image in" disabled={zoom>=Math.max(8,4/fit)} onClick={()=>setZoom(value=>Math.min(Math.max(8,4/fit),value*1.25))}>+</button><button onClick={()=>setZoom(1)}>Fit</button><button onClick={()=>setZoom(1/fit)}>100%</button></div></footer>
    {confirm&&<div ref={confirmRef} className={styles.confirm} role="alertdialog" aria-modal="true" aria-label="Unsaved annotations" onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setConfirm(false);}
      if(event.key==='Tab'){const buttons=[...event.currentTarget.querySelectorAll('button')];if(event.shiftKey&&event.target===buttons[0]){event.preventDefault();buttons.at(-1).focus();}else if(!event.shiftKey&&event.target===buttons.at(-1)){event.preventDefault();buttons[0].focus();}}
    }}><div><h2>Keep your annotations?</h2><p>Your original image is unchanged.</p><footer><button onClick={()=>setConfirm(false)}>Keep editing</button><button onClick={onClose}>Discard</button><button onClick={save}>Save</button></footer></div></div>}
  </dialog>,document.body);
}
