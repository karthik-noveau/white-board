import { Link } from 'react-router';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import BrandMark from './BrandMark';
import BoardIcon from './BoardIcon';
import { brand } from '../lib/brand';
import styles from '../styles/resourcePage.module.css';

function BrandAssets() {
  return <section id="brand-assets" className={styles.assets} aria-labelledby="assets-title">
    <span className={styles.eyebrow}>The essentials</span><h2 id="assets-title">One name. A familiar mark.</h2>
    <p>Writing about {brand.name}? Use the name as one word, with a capital D and A. Keep the mark in its original proportions and give it room to breathe.</p>
    <div className={styles.assetGrid}>
      <a href="/brand/drawanything-wordmark.svg" download><div className={styles.wordmark}><BrandMark size={40}/><b>{brand.name}</b></div><span>Download wordmark <small>SVG</small><BoardIcon name="download" size={17}/></span></a>
      <a href="/brand.svg" download="drawanything-mark.svg"><div className={styles.mark}><BrandMark size={76}/></div><span>Download brand mark <small>SVG</small><BoardIcon name="download" size={17}/></span></a>
      <a href="/icons/icon-512.png" download="drawanything-icon.png"><div className={styles.color}><span>{brand.themeColor.toUpperCase()}</span><b>Room for possibility.</b></div><span>Download app icon <small>PNG</small><BoardIcon name="download" size={17}/></span></a>
    </div>
  </section>;
}

export default function ResourcePage({ page }) {
  const about = page.path === '/about';
  return <div className={styles.page}>
    <a href="#main" className={styles.skip}>Skip to content</a><SiteHeader/>
    <main id="main" className={styles.main}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link to="/">{brand.name}</Link><span aria-hidden="true">/</span><span aria-current="page">{page.label}</span></nav>
      <header className={styles.hero}><div><span className={styles.eyebrow}>{page.eyebrow}</span><h1>{page.heading}</h1><p>{page.intro}</p></div><div className={styles.brandCard} aria-hidden="true"><BrandMark size={112}/><span>{brand.name}</span><small>{brand.tagline}</small></div></header>
      <div className={styles.content}>
        <nav className={styles.contents} aria-label="On this page"><span>On this page</span>{page.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}{about && <a href="#brand-assets">Brand assets</a>}</nav>
        <article className={styles.article}>{page.sections.map(section => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.link && <Link className={styles.textLink} to={section.link.to}>{section.link.label}<BoardIcon name="forward" size={16}/></Link>}</section>)}</article>
      </div>
      {about && <BrandAssets/>}
      <aside className={styles.cta}><div><span className={styles.eyebrow}>Your next move</span><h2>Make room for an idea.</h2><p>No account needed. Start with a blank board or a little structure.</p></div><Link to="/templates">Explore templates<BoardIcon name="forward" size={18}/></Link></aside>
    </main><SiteFooter/>
  </div>;
}
