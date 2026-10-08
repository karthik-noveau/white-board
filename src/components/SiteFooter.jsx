import { Link } from 'react-router';
import { SiteBrand } from './SiteHeader';
import { brand } from '../lib/brand';
import { productPages } from '../data/productPages';
import styles from '../styles/siteFooter.module.css';

export default function SiteFooter() {
  return <footer className={styles.footer}>
    <div className={styles.top}>
      <div className={styles.identity}><SiteBrand/><p>{brand.tagline}</p><span>A private online whiteboard for ideas,<br/>mind maps, and your next move.</span></div>
      <nav aria-label="Explore DrawAnything"><b>Make space for</b>{productPages.map(page => <Link key={page.path} to={page.path}>{page.label}</Link>)}</nav>
      <nav aria-label="Get started"><b>Start here</b><Link to="/templates">Template library</Link><Link to="/projects">Open workspace <span aria-hidden="true">↗</span></Link><Link to="/help">Help & getting started</Link><Link to="/#faq">Questions & answers</Link></nav>
    </div>
    <div className={styles.bottom}><span>© {new Date().getFullYear()} {brand.name}</span><div><Link to="/about">About {brand.name}</Link><Link to="/about#brand-assets">Brand assets</Link></div><span>No account needed. Saved on your device.</span></div>
  </footer>;
}
