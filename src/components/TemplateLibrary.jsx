import { useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from 'react-router';
import { brand } from '../lib/brand';
import BrandMark from './BrandMark';
import { Network, Square, Table2, ListChecks, StickyNote, Code2, Link2 } from 'lucide-react';
import { TYPES } from '../lib/cellContent';
import { filterTemplates, templateCategories, templates } from "../data/templates";
import { templateHighlights } from '../data/templateWorkspaces';
import BoardPreview from "./BoardPreview";
import BoardPreviewDialog from "./BoardPreviewDialog";
import Icon from "./BoardIcon";
import styles from "../styles/templateLibrary.module.css";

const highlightIcons = { branches: Network, cards: Square, table: Table2, checklist: ListChecks, note: StickyNote, code: Code2, link: Link2 };

export default function TemplateLibrary({ onClose, onCreate, initialTemplate = null, fullPage = false, embedded = false, libraryPath = '/templates', onPreview }) {
  const dialogRef = useRef(null), searchRef = useRef(null), previewHeading = useRef(null), scrollRef = useRef(null), lastCard = useRef(null);
  const titleId = useId(), resultsId = useId();
  const [category, setCategory] = useState("all"), [query, setQuery] = useState(""), [selected, setSelected] = useState(initialTemplate);
  const [expanded, setExpanded] = useState(false);
  const results = filterTemplates(category, query);
  const collections = templateCategories.map(collection => ({
    ...collection, templates: results.filter(template => template.category === collection.id),
  })).filter(collection => collection.templates.length);
  const activeCategory = templateCategories.find(item => item.id === category);
  const relatedTemplates = selected ? templates.filter(item => item.id !== selected.id)
    .sort((a, b) => Number(b.category === selected.category) - Number(a.category === selected.category)).slice(0, 3) : [];

  useLayoutEffect(() => {
    const dialog = dialogRef.current, previousFocus = document.activeElement;
    if (!fullPage) { dialog.showModal(); searchRef.current?.focus(); }
    return () => {
      if (!fullPage) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [fullPage]);

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

  const changeCategory = id => { setCategory(id); if (fullPage && selected) onPreview(null); else setSelected(null); lastCard.current = null; scrollRef.current?.scrollTo(0, 0); };
  const openPreview = template => { lastCard.current = template.id; setSelected(template); };
  const categoryName = id => templateCategories.find(item => item.id === id)?.name;
  const templateUrl = template => `${libraryPath}/${template.id}`;

  const escape = event => { event.preventDefault(); event.stopPropagation(); if (selected) { if (fullPage) onPreview(null); else setSelected(null); } else if (!fullPage) onClose(); };
  const Surface = fullPage ? "main" : "dialog", DetailHeading = fullPage ? "h1" : "h3", ResultsHeading = fullPage ? "h2" : "h3", CardHeading = fullPage ? "h3" : "h4", PreviewAction = fullPage ? Link : "button";
  const search = <label className={styles.search}><Icon name="search" size={18}/><input ref={searchRef} aria-label="Search templates" placeholder={fullPage ? "Search templates…" : "Search templates, e.g. meeting or launch"} value={query} onChange={event => { setQuery(event.target.value); if (!fullPage) scrollRef.current?.scrollTo(0, 0); }}/>{query && <button className={styles.iconButton} aria-label="Clear template search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><Icon name="close" size={16}/></button>}</label>;
  const categories = <nav className={styles.categories} aria-label="Template categories">
    {!fullPage && <span className={styles.navLabel}>Browse by purpose</span>}
    {[{ id: "all", name: "All templates", icon: "grid" }, ...templateCategories].map(item => <button key={item.id} aria-pressed={category === item.id} aria-controls={resultsId} onClick={() => changeCategory(item.id)}>{!fullPage && <Icon name={item.icon} size={17}/>}<span>{item.name}</span>{(!fullPage || item.id === "all") && <small>{item.id === "all" ? templates.length : templates.filter(template => template.category === item.id).length}</small>}</button>)}
    {!fullPage && <div className={styles.sidebarNote}><Icon name="edit" size={17}/><p>A little structure.<br/>Plenty of room for you.</p><span>Every shape, prompt, and connection is yours to edit.</span></div>}
  </nav>;
  return <Surface ref={dialogRef} id={embedded ? 'workspace-content' : undefined} tabIndex={embedded ? -1 : undefined} className={`${styles.dialog} ${fullPage ? styles.page : ""} ${embedded ? styles.embedded : ""}`} aria-labelledby={fullPage && selected ? `${titleId}-preview` : titleId} data-template-library="" onKeyDown={event => { if (event.key === "Escape") escape(event); }} onCancel={escape} onClick={event => {
    if (fullPage || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    {!embedded && (fullPage ? <header className={styles.pageHeader}>
      <div className={styles.pageHeaderInner}>
        <div className={styles.pageIdentity}><Link to="/" className={styles.brandHome} aria-label={`${brand.name} home`}><BrandMark size={26}/><span>{brand.name}</span></Link><span className={styles.headerDivider} aria-hidden="true"/><Link to="/templates" className={styles.libraryLink}>Templates</Link></div>
        <nav className={styles.pageActions} aria-label="Workspace actions"><Link to="/projects" className={styles.workspaceLink}><Icon name="workspace" size={16}/><span>Workspace</span></Link><button className={styles.blankButton} aria-label="Start blank" onClick={() => onCreate()}><Icon name="plus" size={16}/><span>Start blank</span></button></nav>
      </div>
    </header> : <header className={styles.header}>
      <div className={styles.identity}><span className={styles.libraryIcon}><Icon name="template" size={22}/></span><div><h2 id={titleId}>Template library</h2><p>Choose a layout for the way you think.</p></div></div>
      <button className={styles.iconButton} aria-label="Close template library" onClick={onClose}><Icon name="close"/></button>
    </header>)}
    <div className={styles.body}>
      {!fullPage && categories}
      <div className={styles.main}>
        {!fullPage && !selected && <div className={styles.searchBar}>{search}</div>}
        <div className={styles.scrollArea} ref={scrollRef} id={resultsId}>
          {fullPage && !selected && <>
            <section className={styles.pageIntro} aria-labelledby={titleId}>
              <div><h1 id={titleId}>Template library</h1><p>Find a starting point for your next idea.<br/>Every card, connection, and possibility is yours to shape.</p></div>
              <div className={styles.pageSearch}>{search}{embedded && <button className={styles.blankButton} aria-label="Start blank" title="Start blank" onClick={() => onCreate()}><Icon name="plus" size={16}/><span>Start blank</span></button>}</div>
            </section>
            {categories}
          </>}
          {selected && <div className={styles.previewToolbar}>{fullPage ? <nav className={styles.breadcrumbs} aria-label="Breadcrumb">{!embedded && <><Link to="/">Home</Link><span aria-hidden="true">/</span></>}<Link to={libraryPath}>{embedded && <Icon name="back" size={14}/>}Templates</Link><span aria-hidden="true">/</span><span>{selected.name}</span></nav> : <button onClick={() => setSelected(null)}><Icon name="back" size={16}/>Back to templates</button>}{!fullPage && <span>{categoryName(selected.category)}</span>}</div>}
          {selected ? <section className={styles.detail} aria-labelledby={`${titleId}-preview`}>
            <div className={styles.detailHero}>
              <div className={styles.detailIntro}><span className={styles.eyebrow}>{selected.layoutLabel || "Made for your next step"}</span><DetailHeading id={`${titleId}-preview`} ref={previewHeading} tabIndex={-1}>{selected.name}</DetailHeading><p>{selected.description}</p><div className={styles.highlights}>{templateHighlights(selected).map(item => { const HighlightIcon = highlightIcons[item.type] || Square; return <span key={item.type}><HighlightIcon size={14} strokeWidth={1.5} aria-hidden="true"/>{item.label}</span>; })}</div>{fullPage && <div className={styles.detailStart}><button className={styles.primaryButton} onClick={() => onCreate(selected)}>Use template<Icon name="forward" size={16}/></button><span>Fully editable · Saved on your device</span></div>}</div>
              <div className={styles.largePreview} data-accent={selected.accent}><span className={styles.previewLabel}><Icon name="eye" size={14}/>Board preview<span>{selected.board.nodes.length} cards</span><button className={styles.expandPreview} onClick={() => setExpanded(true)}><Icon name="fit" size={15}/>Enlarge</button></span><BoardPreview board={selected.board} detailed aspectRatio={fullPage ? 1.6 : 2}/></div>
            </div>
            {selected.board.nodes.some(node => node.content) && <div className={styles.included}><h4>Ready to work with</h4><div>{selected.board.nodes.filter(node => node.content).map(node => <section key={node.id}><h5>{node.title}</h5><p>{[...new Set(node.content.map(block => TYPES[block.type].name))].join(' · ')}</p></section>)}</div></div>}
            <div className={styles.guide}><h4>Make it yours</h4><ol>{selected.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></div>
            {fullPage && <nav className={styles.related} aria-label="Related templates"><h2>Keep exploring</h2>{relatedTemplates.map(item => <Link key={item.id} to={templateUrl(item)}>{item.name}<Icon name="forward" size={15}/></Link>)}</nav>}
          </section> : <>
            <div className={styles.resultsHeading}><div><ResultsHeading id={`${resultsId}-heading`}>{query.trim() ? "Search results" : activeCategory?.name || (fullPage ? "Browse by purpose" : "Find your starting point")}</ResultsHeading>{(query.trim() || activeCategory || !fullPage) && <p>{query.trim() ? `Matching “${query.trim()}”${activeCategory ? ` in ${activeCategory.name}` : ""}` : activeCategory?.description || "Useful frameworks for the work and life you’re planning."}</p>}</div><span role="status">{results.length} {results.length === 1 ? "template" : "templates"}</span></div>
            {results.length ? collections.map(collection => <section key={collection.id} className={styles.collection} data-template-collection={collection.id} aria-labelledby={activeCategory ? `${resultsId}-heading` : `${resultsId}-${collection.id}`}>
              {!activeCategory && <header className={styles.collectionHeading}><div><ResultsHeading id={`${resultsId}-${collection.id}`}>{collection.name}<span>{collection.templates.length}</span></ResultsHeading><p>{collection.description}</p></div></header>}
              <div className={styles.grid}>{collection.templates.map(template => <article key={template.id} className={styles.card}>
              <PreviewAction {...(fullPage ? { to: templateUrl(template) } : { onClick: () => openPreview(template) })} className={styles.previewAction} data-template-id={template.id} aria-label={`Preview ${template.name}`}>
                <div className={styles.thumbnail} data-accent={template.accent}>{!fullPage && <span className={styles.layoutTag}>{template.layoutLabel}</span>}<BoardPreview board={template.board} aspectRatio={fullPage ? 1.6 : 2}/>{fullPage && <span className={styles.previewHint}><Icon name="eye" size={14}/>Preview</span>}</div>
                <div className={styles.cardText}><span className={styles.categoryLabel}>{categoryName(template.category)}</span><CardHeading>{template.name}</CardHeading><p>{template.description}</p></div>
              </PreviewAction>
              <div className={styles.cardFooter}><span>{template.board.nodes.length} editable cards</span><button className={styles.primaryButton} aria-label={`Use template: ${template.name}`} onClick={() => onCreate(template)}>Use template{fullPage && <Icon name="forward" size={14}/>}</button></div>
            </article>)}</div></section>) : <div className={styles.empty}><span><Icon name="search" size={26}/></span><h4>No templates found</h4><p>Try a broader search or explore another category.</p><button onClick={() => { setQuery(""); changeCategory("all"); searchRef.current?.focus(); }}>Show all templates<Icon name="forward" size={16}/></button></div>}
          </>}
          {fullPage && <div className={styles.pageNote}><Icon name="lock" size={14}/><span>Your ideas stay yours. Boards are saved on this device.</span></div>}
        </div>
        {!fullPage && <footer className={styles.footer}><span><Icon name={selected ? "edit" : "lock"} size={15}/>{selected ? "Make a copy, then edit any card." : "Your board is saved on this device."}</span>{selected ? <button className={styles.primaryButton} onClick={() => onCreate(selected)}>Use template<Icon name="forward" size={17}/></button> : <button className={styles.blankButton} onClick={() => onCreate()}><Icon name="plus" size={17}/>Start blank</button>}</footer>}
      </div>
    </div>
    {expanded && selected && <BoardPreviewDialog board={selected.board} title={selected.name} onClose={() => setExpanded(false)}/>}
  </Surface>;
}
