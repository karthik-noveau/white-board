import { useEffect } from 'react';
import { BLOCK_MIME } from './blockEditing';
import { edgeScrollVelocity } from './blockDrag';

export default function useBlockDragPan(stageRef, setTransform, enabled) {
  useEffect(() => {
    if (!enabled) return;
    let point = null, frame = 0, last = 0;
    const stop = () => { point = null; cancelAnimationFrame(frame); frame = 0; last = 0; };
    const tick = time => {
      if (!point || !stageRef.current) { stop(); return; }
      const factor = last ? Math.min(2, (time - last) / 16.67) : 1;
      last = time;
      const stage = stageRef.current;
      const delta = edgeScrollVelocity(point, stage.getBoundingClientRect());
      // Scroll a wide table before moving the canvas under it.
      let consumedX = false, consumedY = false;
      for (let element = document.elementFromPoint(point.x, point.y); element && element !== stage; element = element.parentElement) {
        const css = getComputedStyle(element), velocity = edgeScrollVelocity(point, element.getBoundingClientRect(), 40, 12);
        const left = element.scrollLeft, top = element.scrollTop;
        if (!consumedX && /auto|scroll/.test(css.overflowX)) element.scrollLeft += velocity.x * factor;
        if (!consumedY && /auto|scroll/.test(css.overflowY)) element.scrollTop += velocity.y * factor;
        consumedX ||= element.scrollLeft !== left; consumedY ||= element.scrollTop !== top;
      }
      if ((delta.x && !consumedX) || (delta.y && !consumedY)) setTransform(value => ({...value,x:value.x-(consumedX?0:delta.x)*factor,y:value.y-(consumedY?0:delta.y)*factor}));
      frame = requestAnimationFrame(tick);
    };
    const over = event => {
      if (!event.dataTransfer?.types.includes(BLOCK_MIME) || !stageRef.current?.contains(event.target)) { stop(); return; }
      point = {x:event.clientX,y:event.clientY};
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const leave = event => { if (!event.relatedTarget) stop(); };
    document.addEventListener('dragover', over, true);
    document.addEventListener('dragleave', leave, true);
    document.addEventListener('drop', stop, true);
    document.addEventListener('dragend', stop, true);
    window.addEventListener('blur', stop);
    return () => {
      stop(); document.removeEventListener('dragover',over,true); document.removeEventListener('dragleave',leave,true);
      document.removeEventListener('drop',stop,true); document.removeEventListener('dragend',stop,true); window.removeEventListener('blur',stop);
    };
  }, [stageRef, setTransform, enabled]);
}
