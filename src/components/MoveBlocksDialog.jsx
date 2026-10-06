import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cardPreview } from '../lib/blockEditing';
import Icon from './BoardIcon';
import styles from '../styles/richBlock.module.css';

export default function MoveBlocksDialog({ nodes, sourceId, count, onChoose, onClose }) {
  const ref = useRef(null), [query,setQuery] = useState(''), [index,setIndex] = useState(0);
  const cards = nodes.filter(node=>node.id!==sourceId && !node.locked && node.kind!=='frame');
  const results = cards.filter(node=>`${node.title || ''} ${cardPreview(node)}`.toLowerCase().includes(query.toLowerCase())).slice(0,50);
  useLayoutEffect(()=>{
    const dialog=ref.current, previous=document.activeElement;
    dialog.showModal(); dialog.querySelector('input').focus();
    return()=>{dialog.close(); if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  useLayoutEffect(()=>{ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});},[index]);
  return createPortal(<dialog ref={ref} data-cell-menu className={styles.moveDialog} aria-label="Move blocks to card"
    onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}} onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}
    onKeyDown={event=>{
      event.stopPropagation();
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setIndex(value=>(value+(event.key==='ArrowDown'?1:results.length-1))%Math.max(1,results.length));}
      if(event.key==='Enter' && event.target.tagName==='INPUT' && results[index]){event.preventDefault();onChoose(results[index]);}
    }}>
    <header><div><strong>Move to card</strong><small>{count} {count===1?'block':'blocks'} · Choose a destination</small></div><button aria-label="Close move to card" onClick={onClose}><Icon name="close" size={20}/></button></header>
    <label className={styles.cardSearch}><Icon name="search" size={18}/><input role="combobox" aria-label="Find destination card" aria-controls="move-card-results" aria-expanded="true" aria-activedescendant={results[index]?`move-card-${results[index].id}`:undefined} placeholder="Search cards and content…" value={query} onChange={event=>{setQuery(event.target.value);setIndex(0);}}/></label>
    <div id="move-card-results" className={styles.cardResults} role="listbox" aria-label="Destination cards">
      {results.map((card,i)=><button key={card.id} id={`move-card-${card.id}`} role="option" aria-selected={i===index} onFocus={()=>setIndex(i)} onClick={()=>onChoose(card)}><Icon name="box" size={18}/><span><b>{card.title||'Untitled card'}</b><small>{cardPreview(card)}</small>{cards.filter(other=>other.title===card.title).length>1&&<em>Card {String(card.id).slice(-6)}</em>}</span><Icon name="forward" size={16}/></button>)}
      {!results.length&&<p>{cards.length?'No matching cards':'Add another unlocked card to move blocks into.'}</p>}
    </div>
    <footer>Blocks are added at the end of the destination card.</footer>
  </dialog>,document.body);
}
