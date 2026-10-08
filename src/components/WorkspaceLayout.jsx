import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { workspaceTemplatesPath } from "../lib/routes";
import { getStorageEstimate } from "../lib/localWorkspace";
import { templates } from "../data/templates";
import { backupFiles } from "../lib/brand";
import SiteHeader from "./SiteHeader";
import { BackupUrlDialog, ImportWorkspaceUrlDialog } from './WorkspaceTransferDialog';
import Icon from "./BoardIcon";
import styles from "../styles/home.module.css";

const formatBytes = value => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;

export default function WorkspaceLayout({ projects, deletedProjects, storageError, onCreate, onBackup, onImport, onReadBackup, onImportWorkspace }) {
  const homeRef = useRef(null), sidebarRef = useRef(null), fileInput = useRef(null);
  const { pathname } = useLocation();
  const inTemplates = pathname === workspaceTemplatesPath || pathname.startsWith(`${workspaceTemplatesPath}/`);
  const [storage, setStorage] = useState(null), [backupBusy, setBackupBusy] = useState(false);
  const [transfer, setTransfer] = useState(null);
  const backUp = async () => { if (backupBusy) return; setBackupBusy(true); try { await onBackup(); } finally { setBackupBusy(false); } };
  const storageSize = storage ? formatBytes(storage.usage).split(' ') : null;
  const saveStatus = <span className={styles.saveState} role="status" data-error={Boolean(storageError)} aria-label={storageError ? "Storage needs attention" : "Saved on this device"} title={storageError || "All changes saved on this device"}>{storageError ? <Icon name="saveError" size={13}/> : <i aria-hidden="true"/>}<span>{storageError ? "Needs attention" : "Saved"}</span></span>;
  const storageStatus = <div className={styles.storageSummary} data-error={Boolean(storageError)}>
    <span className={styles.storageLabel}>Local storage</span>
    {storageSize && <span className={styles.storageUsage} aria-label={`${formatBytes(storage.usage)} used`}><strong>{storageSize[0]}</strong><span>{storageSize[1]} used</span></span>}
    <svg className={styles.storageArtwork} viewBox="0 0 56 56" fill="none" aria-hidden="true" focusable="false">
      <path d="m7 30 21-12 21 12v9L28 51 7 39Z" fill="#785bb5"/>
      <path d="m28 42 21-12v9L28 51Z" fill="#513876"/>
      <path d="m7 30 21-12 21 12-21 12Z" fill="#ad8fdf"/>
      <path d="m7 17 21-12 21 12v10L28 39 7 27Z" fill="#9a77d4"/>
      <path d="m28 29 21-12v10L28 39Z" fill="#7250a7"/>
      <path d="m7 17 21-12 21 12-21 12Z" fill="#d0b6ff"/>
      <path d="m7 17 21 12 21-12M28 29v10" stroke="#efe4ff" strokeOpacity=".4"/>
      <path d="m17 17 11-6 11 6-11 6Z" fill="#a486d0"/>
      <path d="m35 29 7-4" stroke="#ddccfa" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="42" cy="36" r="1.6" fill="#a6f0d6"/>
    </svg>
    <div className={styles.storageFooter}><span>On this device</span>{saveStatus}</div>
  </div>;
  useEffect(() => { let active = true; getStorageEstimate().then(value => { if (active) setStorage(value); }).catch(() => {}); return () => { active = false; }; }, [projects, deletedProjects]);
  useLayoutEffect(() => {
    const page = homeRef.current, sidebar = sidebarRef.current;
    const measureHeader = () => {
      page.style.setProperty('--workspace-header-height', `${Math.ceil(sidebar.getBoundingClientRect().height + page.querySelector('[data-site-header]').getBoundingClientRect().height)}px`);
      const nav = sidebar.querySelector('nav'), current = nav.querySelector('[aria-current="page"]');
      if (current && window.matchMedia('(max-width: 700px)').matches) {
        const bounds = nav.getBoundingClientRect(), active = current.getBoundingClientRect();
        if (active.left < bounds.left || active.right > bounds.right) nav.scrollLeft += active.left - bounds.left - (nav.clientWidth - active.width) / 2;
      }
    };
    measureHeader();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measureHeader);
      observer.observe(sidebar);
      observer.observe(page.querySelector('[data-site-header]'));
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measureHeader);
    return () => window.removeEventListener('resize', measureHeader);
  }, [pathname]);

  return <div ref={homeRef} className={styles.home} data-workspace-layout="">
    <a href="#workspace-content" className={styles.skipLink}>Skip to {inTemplates ? "templates" : "projects"}</a>
    <SiteHeader layout="workspace" onImport={() => fileInput.current?.click()} onImportUrl={() => setTransfer('import')} onBackup={backUp} onBackupUrl={() => setTransfer('backup')} backupBusy={backupBusy}/>
    <input ref={fileInput} className={styles.fileInput} type="file" accept={backupFiles.accept} aria-label="Import board file" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ""; }}/>
    <aside ref={sidebarRef} className={styles.sidebar}>
      <p className={styles.navLabel}>YOUR LIBRARY</p>
      <nav aria-label="Workspace"><NavLink to="/projects" end className={({ isActive }) => (isActive || pathname.startsWith("/projects/folders/")) ? styles.activeNav : ""}><Icon name="grid"/><span>Projects</span><small>{projects.length}</small></NavLink><NavLink to="/projects/favorites" className={({ isActive }) => isActive ? styles.activeNav : ""}><Icon name="star"/><span>Favorites</span></NavLink>
      <NavLink className={({ isActive }) => `${styles.templateNav} ${isActive ? styles.activeNav : ""}`} to={workspaceTemplatesPath}><Icon name="template"/><span className={styles.templateLabel}>Template library</span><span className={styles.templateCompactLabel}>Templates</span><small>{templates.length}</small></NavLink>
      <span className={styles.navDivider} aria-hidden="true"/>
      <NavLink to="/projects/trash" className={({ isActive }) => `${styles.trashNav} ${isActive ? styles.activeNav : ""}`}><Icon name="trash"/><span>Trash</span>{deletedProjects.length > 0 && <small>{deletedProjects.length}</small>}</NavLink>
      </nav>
      <div className={styles.sidebarNote}><Icon name="spark" size={27}/><span>A little room<br/>for a big idea.</span><p>Make connections.<br/>See where they take you.</p>{pathname === "/projects" && <button onClick={() => onCreate()}>Make something new<Icon name="forward" size={14}/></button>}</div>
      <div className={styles.localStatus}>{storageStatus}</div>
    </aside>
    <div className={styles.workspace}>
      <Outlet/>
      <div className={styles.mobileStorageStatus}>{storageStatus}</div>
    </div>
    {transfer === 'backup' && <BackupUrlDialog onReadBackup={onReadBackup} onClose={() => setTransfer(null)}/>}
    {transfer === 'import' && <ImportWorkspaceUrlDialog onImport={onImportWorkspace} onClose={() => setTransfer(null)}/>}
  </div>;
}
