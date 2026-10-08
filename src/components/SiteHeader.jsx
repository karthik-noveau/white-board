import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import BrandMark from './BrandMark';
import BoardIcon from './BoardIcon';
import WorkspaceFileActions from './WorkspaceFileActions';
import { brand } from '../lib/brand';
import styles from '../styles/siteHeader.module.css';

export function SiteBrand({ to = '/', label = `${brand.name} home`, className = '', onClick }) {
  return <Link to={to} className={`${styles.brand} ${className}`} data-site-brand="" aria-label={label} title={label} onClick={onClick}>
    <span className={styles.mark}><BrandMark size={24}/></span><b>{brand.name}</b>
  </Link>;
}

export function SiteHeaderFrame({ children, className = '', ...props }) {
  return <header className={`${styles.surface} ${className}`} data-site-header="" {...props}>{children}</header>;
}

function NavigationLinks({ onNavigate, templatePath }) {
  return <NavLink to={templatePath} onClick={onNavigate}>Templates</NavLink>;
}

export default function SiteHeader({ layout = 'landing', onImport, onImportUrl, onBackup, onBackupUrl, backupBusy = false }) {
  const showNavigation = layout !== 'workspace';
  const { pathname } = useLocation();
  const inWorkspace = pathname.startsWith('/projects');
  const templatePath = inWorkspace ? '/projects/templates' : '/templates';
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const toggleRef = useRef(null);
  const menuId = useId();

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const dismissOutside = event => {
      if (!headerRef.current.contains(event.target)) setMenuOpen(false);
    };
    const dismissOnEscape = event => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      toggleRef.current.focus();
    };
    const desktop = window.matchMedia('(min-width: 901px)');
    const dismissOnDesktop = event => { if (event.matches) setMenuOpen(false); };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    desktop.addEventListener('change', dismissOnDesktop);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
      desktop.removeEventListener('change', dismissOnDesktop);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  return <SiteHeaderFrame ref={headerRef} className={`${styles.header} ${layout !== 'landing' ? styles.flush : ''}`} data-header-layout={layout} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) closeMenu(); }} onKeyDown={event => {
    if (menuOpen && event.key === 'Escape') { event.stopPropagation(); closeMenu(); toggleRef.current?.focus(); }
  }}>
    <div className={styles.bar}>
      <SiteBrand onClick={closeMenu}/>
      {showNavigation && <nav className={styles.navigation} aria-label="Main navigation"><NavigationLinks templatePath={templatePath}/></nav>}
      <div className={styles.actions}>
        {(onImport || onBackup) && <WorkspaceFileActions onImport={onImport} onImportUrl={onImportUrl} onBackup={onBackup} onBackupUrl={onBackupUrl} backupBusy={backupBusy}/>}
        {!onBackup && <NavLink to="/projects" className={styles.workspace} onClick={closeMenu}>{inWorkspace ? 'Workspace' : 'Open workspace'}<BoardIcon name="forward" size={17}/></NavLink>}
        {showNavigation && <button ref={toggleRef} className={styles.menuToggle} type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}>
          {menuOpen ? <X size={20} strokeWidth={1.7} aria-hidden="true"/> : <Menu size={20} strokeWidth={1.7} aria-hidden="true"/>}
        </button>}
      </div>
    </div>
    {showNavigation && <div id={menuId} className={styles.mobilePanel} hidden={!menuOpen}>
      <nav aria-label="Mobile navigation"><NavigationLinks templatePath={templatePath} onNavigate={closeMenu}/></nav>
      {!onBackup && <NavLink to="/projects" className={styles.mobileWorkspace} onClick={closeMenu}><BoardIcon name="workspace" size={18}/>{inWorkspace ? 'Workspace' : 'Open workspace'}<BoardIcon name="forward" size={17}/></NavLink>}
      <span className={styles.localNote}><BoardIcon name="lock" size={12}/>Private by default. No account needed.</span>
    </div>}
  </SiteHeaderFrame>;
}
