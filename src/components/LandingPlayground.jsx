import { brand } from "../lib/brand";
import { useLayoutEffect, useRef, useState } from 'react';
import Icon from './BoardIcon';
import { playgroundExamples, playgroundProject } from '../data/playground';
import styles from '../styles/landingPlayground.module.css';

function Editable({ value, onChange, label, className = '', placeholder, autoFocus = false, maxLength = 180 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const field = ref.current;
    const resize = () => { field.style.height = '0px'; field.style.height = `${field.scrollHeight}px`; };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(field.parentElement);
    return () => observer.disconnect();
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={event => onChange(event.target.value)} aria-label={label} placeholder={placeholder} maxLength={maxLength} className={className} autoFocus={autoFocus} spellCheck="false"/>;
}

function Connections({ count }) {
  const svgRef = useRef(null);
  const [paths, setPaths] = useState([]);
  useLayoutEffect(() => {
    const element = svgRef.current.parentElement;
    const draw = () => {
      const bounds = element.getBoundingClientRect();
      const point = (item, right) => { const box = item.getBoundingClientRect(); return { x: (right ? box.right : box.left) - bounds.left, y: box.top + box.height / 2 - bounds.top }; };
      const root = element.querySelector('[data-play-root]'), action = element.querySelector('[data-play-action]');
      if (!root || !action) return;
      const curve = (a, b) => `M${a.x},${a.y} C${(a.x + b.x) / 2},${a.y} ${(a.x + b.x) / 2},${b.y} ${b.x},${b.y}`;
      const next = [...element.querySelectorAll('[data-play-idea]')].flatMap(idea => [curve(point(root, true), point(idea, false)), curve(point(idea, true), point(action, false))]);
      setPaths(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    element.querySelectorAll('[data-play-card]').forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [count]);
  return <svg ref={svgRef} className={styles.connections} aria-hidden="true">{paths.map((path, i) => <path key={i} d={path}/>)}</svg>;
}

export default function LandingPlayground({ onCreate }) {
  const [active, setActive] = useState('brainstorm');
  const [drafts, setDrafts] = useState(() => Object.fromEntries(playgroundExamples.map(item => [item.id, structuredClone(item)])));
  const [newIdea, setNewIdea] = useState(null);
  const draft = drafts[active];
  const update = change => setDrafts(current => ({ ...current, [active]: { ...current[active], ...change } }));
  const editIdea = (id, change) => update({ ideas: draft.ideas.map(idea => idea.id === id ? { ...idea, ...change } : idea) });
  const addIdea = () => {
    const id = `idea-${crypto.randomUUID()}`;
    update({ ideas: [...draft.ideas, { id, title: '', note: '' }] }); setNewIdea(id);
  };
  return <section className={styles.showcase} id="product" aria-label={`Try ${brand.name}`} data-reveal="">
    <header className={styles.intro}><div><span className={styles.eyebrow}><i/>A LITTLE ROOM TO THINK</span><h2>See where one idea takes you.</h2><p>Make a connection. Find a possibility. Take the next step.</p></div></header>
    <div className={styles.playground}>
      <div className={styles.topline}><div className={styles.examples} role="group" aria-label="Choose an example">{playgroundExamples.map(example => <button key={example.id} aria-pressed={active === example.id} onClick={() => { setActive(example.id); setNewIdea(null); }}><Icon name={example.icon} size={16}/>{example.label}</button>)}</div><button className={styles.reset} onClick={() => { update(structuredClone(playgroundExamples.find(item => item.id === active))); setNewIdea(null); }} aria-label="Reset this example"><Icon name="undo" size={15}/><span>Reset</span></button></div>
      <div className={styles.surface} key={active}>
        <Connections count={draft.ideas.length}/>
        <div className={styles.lane}><span className={styles.stageLabel}><b>01</b>The spark</span><article className={`${styles.card} ${styles.root}`} data-play-card data-play-root><span className={styles.spark}><Icon name="spark" size={20}/></span><Editable value={draft.title} onChange={title => update({ title })} label="Your starting idea" className={styles.rootTitle} maxLength={90}/><p>{draft.note}</p><i className={styles.portRight}/></article></div>
        <div className={`${styles.lane} ${styles.ideas}`}><span className={styles.stageLabel}><b>02</b>The possibilities</span>{draft.ideas.map((idea, index) => <article className={styles.card} key={idea.id} data-play-card data-play-idea><i className={styles.portLeft}/><div className={styles.cardTag}>IDEA {String(index + 1).padStart(2, '0')}<Icon name="pencil" size={12}/></div><Editable value={idea.title} onChange={title => editIdea(idea.id, { title })} label={`Idea ${index + 1} title`} placeholder="Your idea" className={styles.cardTitle} maxLength={70} autoFocus={newIdea === idea.id}/><Editable value={idea.note} onChange={note => editIdea(idea.id, { note })} label={`Idea ${index + 1} details`} placeholder="What could you try?" className={styles.cardBody}/><i className={styles.portRight}/></article>)}{draft.ideas.length < 4 && <button className={styles.addIdea} onClick={addIdea}><Icon name="plus" size={16}/>Add your idea</button>}</div>
        <div className={styles.lane}><span className={styles.stageLabel}><b>03</b>The next step</span><article className={`${styles.card} ${styles.action}`} data-play-card data-play-action><i className={styles.portLeft}/><span className={styles.actionIcon}><Icon name="check" size={17}/></span><h3>{draft.action}</h3><div className={styles.tasks}>{draft.tasks.map((task, index) => <label key={index} className={task.done ? styles.completed : ''}><input type="checkbox" checked={task.done} onChange={event => update({ tasks: draft.tasks.map((item, i) => i === index ? { ...item, done: event.target.checked } : item) })}/><span>{task.text}</span></label>)}</div><span className={styles.actionNote}>Small enough to start. Useful enough to matter.</span></article></div>
      </div>
      <footer className={styles.footer}><span><Icon name="pencil" size={15}/>Click any idea to make it yours.</span><button className={styles.start} onClick={() => onCreate(playgroundProject(draft))}>Start with this board<Icon name="forward" size={18}/></button></footer>
    </div>
    <p className={styles.caption}>A small preview of a much bigger canvas. Your edits come with you.</p>
  </section>;
}
