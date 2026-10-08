import { Link } from 'react-router';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import BoardPreview from './BoardPreview';
import BoardIcon from './BoardIcon';
import { templates } from '../data/templates';
import { productPages } from '../data/productPages';
import { templatePath } from '../lib/seo';
import styles from '../styles/productPage.module.css';

export default function ProductPage({ page, onCreate }) {
  const starter = templates.find(item => item.id === page.starter);
  const preview = templates.find(item => item.id === (page.preview || page.starter));
  const picks = page.templateIds.map(id => templates.find(item => item.id === id));
  const related = productPages.filter(item => item.path !== page.path);
  return <div className={styles.page}>
    <a href="#main" className={styles.skip}>Skip to content</a>
    <SiteHeader/>
    <main id="main" className={styles.main}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link to="/">DrawAnything</Link><span aria-hidden="true">/</span><span aria-current="page">{page.label}</span></nav>
      <section className={styles.hero} aria-labelledby="page-title">
        <div className={styles.heroCopy}><span className={styles.eyebrow}>{page.eyebrow}</span><h1 id="page-title">{page.heading}</h1><p>{page.intro}</p><div className={styles.actions}><button className={styles.primary} onClick={() => onCreate(starter)}>{page.action}<BoardIcon name="forward" size={18}/></button><a href="#templates">Explore templates <span aria-hidden="true">↓</span></a></div><span className={styles.note}><BoardIcon name="lock" size={13}/>No account needed. Saved on your device.</span></div>
        <figure className={styles.preview}><div className={styles.previewBar}><span/><span/><span/><b>{preview.name}</b></div><BoardPreview board={preview.board} title={preview.name} aspectRatio={1.25} accessible/><figcaption>{page.previewCaption}</figcaption></figure>
      </section>
      <section className={styles.explainer} aria-labelledby="definition-title"><div><span className={styles.eyebrow}>The bigger picture</span><h2 id="definition-title">{page.definitionTitle}</h2><p>{page.definition}</p></div><aside className={styles.example}><BoardIcon name="spark" size={22}/><h3>{page.exampleTitle}</h3><p>{page.example}</p></aside></section>
      <section className={styles.workflow} aria-labelledby="steps-title"><span className={styles.eyebrow}>Make it happen</span><h2 id="steps-title">{page.stepsTitle}</h2><ol className={styles.steps}>{page.steps.map((step, index) => <li key={step.title}><span className={styles.number} aria-hidden="true">0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol></section>
      <section className={styles.benefits} aria-label={`Ways to use ${page.label.toLowerCase()}`}>{page.benefits.map((benefit, index) => <article key={benefit.title}><BoardIcon name={['layout', 'note', 'share'][index]} size={22}/><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}</section>
      <section className={styles.templates} id="templates" aria-labelledby="templates-title"><div className={styles.sectionTop}><div><span className={styles.eyebrow}>A place to begin</span><h2 id="templates-title">Start with a little structure.</h2></div><Link to="/templates">View all templates <BoardIcon name="forward" size={16}/></Link></div><div className={styles.templateGrid}>{picks.map(template => <article key={template.id}><Link className={styles.templatePreview} to={templatePath(template)} aria-label={`Explore ${template.name} template`}><BoardPreview board={template.board} aspectRatio={1.65}/></Link><div><h3><Link to={templatePath(template)}>{template.name}</Link></h3><p>{template.description}</p><button onClick={() => onCreate(template)} aria-label={`Use template: ${template.name}`}>Use template<BoardIcon name="forward" size={16}/></button></div></article>)}</div></section>
      <section className={styles.faq} aria-labelledby="questions-title"><div><span className={styles.eyebrow}>Good to know</span><h2 id="questions-title">A little clarity<br/>before you start.</h2></div><div>{page.faqs.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
      {related.length > 0 && <nav className={styles.related} aria-label="More ways to use DrawAnything"><span>Keep exploring</span>{related.map(item => <Link key={item.path} to={item.path}>{item.label}<BoardIcon name="forward" size={17}/></Link>)}</nav>}
    </main>
    <SiteFooter/>
  </div>;
}
