import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router";
import { brand } from "../lib/brand";
import { folderPath, workspaceTemplatesPath } from "../lib/routes";
import { getStorageEstimate } from "../lib/localWorkspace";
import { templates } from "../data/templates";
import BrandMark from "./BrandMark";
import Icon from "./BoardIcon";
import styles from "../styles/home.module.css";

function WorkspaceMark() { return <span className={styles.mark}><BrandMark size={24}/></span>; }
const formatBytes = value => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;

export default function WorkspaceLayout({ projects, deletedProjects, storageError, onCreate, onBackup }) {
  const homeRef = useRef(null), sidebarRef = useRef(null);
  const { pathname } = useLocation(), { folderName } = useParams();
  const inTemplates = pathname === workspaceTemplatesPath || pathname.startsWith(`${workspaceTemplatesPath}/`);
  const sectionTitle = inTemplates ? "Templates" : folderName || (pathname === "/projects/favorites" ? "Favorites" : pathname === "/projects/trash" ? "Trash" : "Projects");
  const folders = useMemo(() => [...new Set(projects.map(project => project.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [projects]);
  const [storage, setStorage] = useState(null), [backupBusy, setBackupBusy] = useState(false);
  const backUp = async () => { if (backupBusy) return; setBackupBusy(true); try { await onBackup(); } finally { setBackupBusy(false); } };
  useEffect(() => { let active = true; getStorageEstimate().then(value => { if (active) setStorage(value); }).catch(() => {}); return () => { active = false; }; }, [projects, deletedProjects]);
  useLayoutEffect(() => {
    const page = homeRef.current, sidebar = sidebarRef.current;
    const measureHeader = () => page.style.setProperty('--workspace-header-height', `${Math.ceil(sidebar.getBoundingClientRect().height)}px`);
    measureHeader();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measureHeader);
      observer.observe(sidebar);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measureHeader);
    return () => window.removeEventListener('resize', measureHeader);
  }, []);

  return <div ref={homeRef} className={styles.home} data-workspace-layout="">
    <a href="#workspace-content" className={styles.skipLink}>Skip to {inTemplates ? "templates" : "projects"}</a>
    <aside ref={sidebarRef} className={styles.sidebar}>
      <Link className={styles.brand} to="/" aria-label={`${brand.name} home`}><WorkspaceMark/><b>{brand.name}<span>Space to think.</span></b></Link>
      <div className={styles.workspaceIdentity}><span className={styles.workspaceAvatar}><Icon name="workspace" size={20}/></span><div><strong>My workspace</strong><small><Icon name="lock" size={11}/>Personal</small></div></div>
      <p className={styles.navLabel}>YOUR LIBRARY</p>
      <nav aria-label="Workspace"><NavLink to="/projects" end className={({ isActive }) => isActive ? styles.activeNav : ""}><Icon name="grid"/><span>Projects</span><small>{projects.length}</small></NavLink><NavLink to="/projects/favorites" className={({ isActive }) => isActive ? styles.activeNav : ""}><Icon name="star"/><span>Favorites</span></NavLink><NavLink to="/projects/trash" className={({ isActive }) => isActive ? styles.activeNav : ""}><Icon name="trash"/><span>Trash</span>{deletedProjects.length > 0 && <small>{deletedProjects.length}</small>}</NavLink>
        {folders.length > 0 && <div className={styles.folderNav}><p className={styles.navLabel}>FOLDERS</p>{folders.map(folder => <NavLink key={folder} caseSensitive to={folderPath(folder)} className={({ isActive }) => isActive ? styles.activeNav : ""} title={folder}><Icon name="folder"/><span>{folder}</span></NavLink>)}</div>}
      </nav>
      <NavLink className={({ isActive }) => `${styles.templateNav} ${isActive ? styles.activeNav : ""}`} to={workspaceTemplatesPath}><Icon name="template"/><span className={styles.templateLabel}>Template library</span><span className={styles.templateCompactLabel}>Templates</span><small>{templates.length}</small></NavLink>
      <div className={styles.sidebarNote}><Icon name="spark" size={27}/><span>A little room<br/>for a big idea.</span><p>Make connections.<br/>See where they take you.</p><button onClick={() => onCreate()}>Make something new<Icon name="forward" size={14}/></button></div>
      <div className={styles.localStatus}><span className={styles.storageIcon}><Icon name="deviceStorage" size={17}/></span><div><b>Device storage</b><small>{storage ? `${formatBytes(storage.usage)} used` : "Stored in this browser"}</small></div></div>
    </aside>
    <div className={styles.workspace}>
      <div className={styles.topbar}><div className={styles.breadcrumb}><Icon name="folder" size={16}/><span>Workspace</span><Icon name="chevron" size={12}/><b>{sectionTitle}</b></div><div className={styles.deviceStorage}><span className={styles.saveState} role="status" data-error={Boolean(storageError)} aria-label={storageError ? "Storage needs attention" : "Saved on this device"} title={storageError || "Saved on this device"}><Icon name={storageError ? "saveError" : "saved"} size={16}/><span>{storageError ? "Storage needs attention" : "Saved locally"}</span></span><button type="button" disabled={backupBusy} onClick={backUp} aria-label="Download a workspace backup" aria-busy={backupBusy}><Icon name="download" size={15}/><span>{backupBusy ? "Preparing…" : "Back up"}</span></button></div></div>
      <Outlet/>
    </div>
  </div>;
}
