import { useId, useRef, useState } from 'react';
import SiteHeader from './SiteHeader';
import { filterTemplates, templateCategories, templates } from '../data/templates';
import BoardPreview from './BoardPreview';
import BoardPreviewDialog from './BoardPreviewDialog';
import WorkspacePageIntro from './WorkspacePageIntro';
import Icon from './BoardIcon';
import styles from '../styles/templateLibrary.module.css';

export default function TemplateLibrary({ onCreate, embedded = false }) {
  const searchRef = useRef(null);
  const titleId = useId(), resultsId = useId();
  const [category, setCategory] = useState('all'), [query, setQuery] = useState(''), [preview, setPreview] = useState(null);
  const results = filterTemplates(category, query);
  const collections = templateCategories.map(collection => ({
    ...collection, templates: results.filter(template => template.category === collection.id),
  })).filter(collection => collection.templates.length);
  const activeCategory = templateCategories.find(item => item.id === category);
  const categoryName = id => templateCategories.find(item => item.id === id)?.name;

  return <main id={embedded ? 'workspace-content' : undefined} tabIndex={embedded ? -1 : undefined} className={`${styles.dialog} ${styles.page} ${embedded ? styles.embedded : ''}`} aria-labelledby={titleId} data-template-library="">
    {!embedded && <SiteHeader layout="content"/>}
    <div className={styles.body}><div className={styles.main}><div className={styles.scrollArea}>
      <WorkspacePageIntro title="Template library" titleId={titleId} eyebrow={embedded ? 'Your workspace' : 'A little structure. A world of possibilities.'} description="Find a starting point for your next idea. Every card, connection, and possibility is yours to shape."/>
      <div className={styles.libraryTools}>
        <div className={styles.pageSearch}><label className={styles.search}><Icon name="search" size={18}/><input ref={searchRef} aria-label="Search templates" placeholder="Search templates…" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button className={styles.iconButton} aria-label="Clear template search" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><Icon name="close" size={16}/></button>}</label></div>
        <nav className={styles.categories} aria-label="Template categories">
          {[{ id: 'all', name: 'All templates' }, ...templateCategories].map(item => <button key={item.id} aria-pressed={category === item.id} aria-controls={resultsId} onClick={() => setCategory(item.id)}><span>{item.name}</span>{item.id === 'all' && <small>{templates.length}</small>}</button>)}
        </nav>
      </div>
      <div id={resultsId}>
        <div className={styles.resultsHeading}><div><h2 id={`${resultsId}-heading`}>{query.trim() ? 'Search results' : activeCategory?.name || 'Browse by purpose'}</h2>{(query.trim() || activeCategory) && <p>{query.trim() ? `Matching “${query.trim()}”${activeCategory ? ` in ${activeCategory.name}` : ''}` : activeCategory.description}</p>}</div><span role="status">{results.length} {results.length === 1 ? 'template' : 'templates'}</span></div>
        {results.length ? collections.map(collection => <section key={collection.id} className={styles.collection} data-template-collection={collection.id} aria-labelledby={activeCategory ? `${resultsId}-heading` : `${resultsId}-${collection.id}`}>
          {!activeCategory && <header className={styles.collectionHeading}><h2 id={`${resultsId}-${collection.id}`}>{collection.name}<span>{collection.templates.length}</span></h2><p>{collection.description}</p></header>}
          <div className={styles.grid}>{collection.templates.map(template => <article key={template.id} id={`template-${template.id}`} className={styles.card}>
            <button type="button" className={styles.previewAction} data-template-id={template.id} aria-label={`Preview ${template.name}`} aria-haspopup="dialog" onClick={() => setPreview(template)}>
              <div className={styles.thumbnail} data-accent={template.accent}><BoardPreview board={template.board} aspectRatio={1.6}/><span className={styles.previewHint}><Icon name="eye" size={14}/>Preview</span></div>
              <div className={styles.cardText}><span className={styles.categoryLabel}>{categoryName(template.category)}</span><h3>{template.name}</h3><p>{template.description}</p></div>
            </button>
            <div className={styles.cardFooter}><span>{template.board.nodes.length} editable cards</span><button className={styles.primaryButton} aria-label={`Use template: ${template.name}`} onClick={() => onCreate(template)}>Use template<Icon name="forward" size={14}/></button></div>
          </article>)}</div>
        </section>) : <div className={styles.empty}><span><Icon name="search" size={26}/></span><h3>No templates found</h3><p>Try a broader search or explore another category.</p><button onClick={() => { setQuery(''); setCategory('all'); searchRef.current?.focus(); }}>Show all templates<Icon name="forward" size={16}/></button></div>}
      </div>
    </div></div></div>
    {preview && <BoardPreviewDialog key={preview.id} board={preview.board} title={preview.name} onClose={() => setPreview(null)} onUseTemplate={() => onCreate(preview)}/>}
  </main>;
}
