import { useId, useLayoutEffect, useRef, useState } from "react";
import { Table2, ListChecks } from 'lucide-react';
import { filterTemplates, templateCategories, templates } from "../data/templates";
import { templateHighlights } from '../data/templateWorkspaces';
import BoardPreview from "./BoardPreview";
import Icon from "./BoardIcon";
import styles from "../styles/templateLibrary.module.css";

export default function TemplateLibrary({ onClose, onCreate }) {
  const dialogRef = useRef(null), searchRef = useRef(null), previewHeading = useRef(null), scrollRef = useRef(null), lastCard = useRef(null);
  const titleId = useId(), resultsId = useId();
  const [category, setCategory] = useState("all"), [query, setQuery] = useState(""), [selected, setSelected] = useState(null);
  const results = filterTemplates(category, query);
  const activeCategory = templateCategories.find(item => item.id === category);

  useLayoutEffect(() => {
    const dialog = dialogRef.current, previousFocus = document.activeElement;
    dialog.showModal();
    searchRef.current?.focus();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    if (selected) {
      previewHeading.current?.focus({ preventScroll: true });
      scrollRef.current?.scrollTo(0, 0);
    } else if (lastCard.current) {
      const card = dialogRef.current?.querySelector(`[data-template-id="${lastCard.current}"]`);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "nearest" });
      lastCard.current = null;
    }
  }, [selected]);

  const changeCategory = id => { setCategory(id); setSelected(null); lastCard.current = null; scrollRef.current?.scrollTo(0, 0); };
  const openPreview = template => { lastCard.current = template.id; setSelected(template); };
  const categoryName = id => templateCategories.find(item => item.id === id)?.name;

  const escape = event => { event.preventDefault(); event.stopPropagation(); if (selected) setSelected(null); else onClose(); };
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} data-template-library="" onKeyDown={event => { if (event.key === "Escape") escape(event); }} onCancel={escape} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    <header className={styles.header}>
      <div className={styles.identity}><span className={styles.libraryIcon}><Icon name="template" size={22}/></span><div><h2 id={titleId}>Template library</h2><p>{templates.length} practical starting points. Make one your own.</p></div></div>
      <button className={styles.iconButton} aria-label="Close template library" onClick={onClose}><Icon name="close"/></button>
    </header>
    <div className={styles.body}>
      <nav className={styles.categories} aria-label="Template categories">
        <span className={styles.navLabel}>Browse by purpose</span>
        {[{ id: "all", name: "All templates", icon: "grid" }, ...templateCategories].map(item => <button key={item.id} aria-pressed={category === item.id} aria-controls={resultsId} onClick={() => changeCategory(item.id)}><Icon name={item.icon} size={17}/><span>{item.name}</span><small>{item.id === "all" ? templates.length : templates.filter(template => template.category === item.id).length}</small></button>)}
        <div className={styles.sidebarNote}><Icon name="edit" size={17}/><p>A little structure.<br/>Plenty of room for you.</p><span>Every shape, prompt, and connection is yours to edit.</span></div>
      </nav>
      <div className={styles.main}>
        {selected ? <div className={styles.previewToolbar}><button onClick={() => setSelected(null)}><Icon name="back" size={16}/>Back to templates</button><span>{categoryName(selected.category)}</span></div> : <div className={styles.searchBar}><label className={styles.search}><Icon name="search" size={18}/><input ref={searchRef} aria-label="Search templates" placeholder="Search templates, e.g. meeting or launch" value={query} onChange={event => { setQuery(event.target.value); scrollRef.current?.scrollTo(0, 0); }}/>{query && <button className={styles.iconButton} aria-label="Clear template search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><Icon name="close" size={16}/></button>}</label></div>}
        <div className={styles.scrollArea} ref={scrollRef} id={resultsId}>
          {selected ? <section className={styles.detail} aria-labelledby={`${titleId}-preview`}>
            <div className={styles.detailIntro}><span className={styles.eyebrow}>Made for your next step</span><h3 id={`${titleId}-preview`} ref={previewHeading} tabIndex={-1}>{selected.name}</h3><p>{selected.description}</p><div className={styles.highlights}>{templateHighlights(selected).map(item => <span key={item.type}>{item.type === 'table' ? <Table2 size={14} strokeWidth={1.5} aria-hidden="true"/> : <ListChecks size={14} strokeWidth={1.5} aria-hidden="true"/>}{item.label}</span>)}</div></div>
            <div className={styles.largePreview} data-accent={selected.accent}><span className={styles.previewLabel}><Icon name="eye" size={14}/>Board preview<span>{selected.board.nodes.length} cards</span></span><BoardPreview board={selected.board} detailed/></div>
            {selected.board.nodes.some(node => node.content) && <div className={styles.included}><h4>Ready to work with</h4><div>{selected.board.nodes.filter(node => node.content).map(node => <section key={node.id}><h5>{node.title}</h5><p>{node.content.some(block => block.type === 'table') ? node.content.find(block => block.type === 'table').headers.join(' · ') : node.content.find(block => block.type === 'checklist')?.tasks[0]?.text || node.content[0]?.text}</p></section>)}</div></div>}
            <div className={styles.guide}><h4>Make it yours</h4><ol>{selected.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></div>
          </section> : <>
            <div className={styles.resultsHeading}><div><h3>{query.trim() ? "Search results" : activeCategory?.name || "Find your starting point"}</h3><p>{query.trim() ? `Matching “${query.trim()}”${activeCategory ? ` in ${activeCategory.name}` : ""}` : activeCategory?.description || "Useful frameworks for the work and life you’re planning."}</p></div><span role="status">{results.length} {results.length === 1 ? "template" : "templates"}</span></div>
            {results.length ? <div className={styles.grid}>{results.map(template => <button key={template.id} className={styles.card} data-template-id={template.id} aria-label={`Preview ${template.name}`} onClick={() => openPreview(template)}>
              <div className={styles.thumbnail} data-accent={template.accent}><BoardPreview board={template.board}/><span className={styles.previewHint}><Icon name="eye" size={14}/>Preview template</span></div>
              <div className={styles.cardText}><span className={styles.categoryLabel}>{categoryName(template.category)}</span><h4>{template.name}</h4><p>{template.description}</p><span className={styles.cardFooter}>{templateHighlights(template).map(item => item.label).join(' · ') || `${template.board.nodes.length} connected cards`}<Icon name="forward" size={16}/></span></div>
            </button>)}</div> : <div className={styles.empty}><span><Icon name="search" size={26}/></span><h4>No templates found</h4><p>Try a broader search or explore another category.</p><button onClick={() => { setQuery(""); changeCategory("all"); searchRef.current?.focus(); }}>Show all templates<Icon name="forward" size={16}/></button></div>}
          </>}
        </div>
        <footer className={styles.footer}><span><Icon name={selected ? "edit" : "lock"} size={15}/>{selected ? "Make a copy, then edit any card." : "Your board is saved on this device."}</span>{selected ? <button className={styles.primaryButton} onClick={() => onCreate(selected)}>Use template<Icon name="forward" size={17}/></button> : <button className={styles.blankButton} onClick={() => onCreate()}><Icon name="plus" size={17}/>Start blank</button>}</footer>
      </div>
    </div>
  </dialog>;
}
