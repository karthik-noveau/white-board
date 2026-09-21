import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useParams, useSearchParams } from "react-router";
import { boardPath, folderPath } from "../lib/routes";
import usePageTitle from "../lib/usePageTitle";
import useDeleteConfirmation from "../lib/useDeleteConfirmation";
import { templates } from "../data/templates";
import { getStorageEstimate } from "../lib/localWorkspace";
import Icon from "./BoardIcon";
import MotionPresence from "./MotionPresence";
import BoardPreview from "./BoardPreview";
import styles from "../styles/home.module.css";

function NovaMark() { return <span className={styles.mark}><Icon name="spark" size={24}/></span>; }

function Dialog({ title, description, onClose, children, wide = false }) {
  const ref = useRef(null), titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current, previousFocus = document.activeElement;
    dialog.showModal();
    dialog.querySelector("input")?.focus();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={`${styles.dialog} ${wide ? styles.wideDialog : ""}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClose={event => { if (!event.currentTarget.open) onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <header><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button className={styles.iconButton} onClick={onClose} aria-label="Close dialog"><Icon name="close"/></button></header>
    {children}
  </dialog>;
}

function ProjectEditDialog({ project, mode, onClose, onRename, onMoveFolder }) {
  const [value, setValue] = useState(mode === "rename" ? project.title : project.folder || "");
  return <Dialog title={mode === "rename" ? "Rename project" : "Move to folder"} description={mode === "rename" ? "Give your idea a name that feels right." : "Choose a folder name, or leave it empty to remove the folder."} onClose={onClose}>
    <form className={styles.editForm} onSubmit={event => { event.preventDefault(); (mode === "rename" ? onRename : onMoveFolder)(project.id, value); onClose(); }}>
      <label>{mode === "rename" ? "Project name" : "Folder name"}<input autoFocus value={value} maxLength={180} onChange={event => setValue(event.target.value)} placeholder={mode === "rename" ? "Untitled mind map" : "e.g. Work, Personal, Ideas"}/></label>
      <footer><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button className={styles.primaryButton} type="submit">Save changes</button></footer>
    </form>
  </Dialog>;
}

function updatedLabel(project, trash) {
  const date = trash ? project.deletedAt : project.updated;
  const days = Math.round((date - Date.now()) / 86400000);
  const relative = Math.abs(days) < 7 ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day") : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", ...(new Date(date).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) }).format(date);
  return `${trash ? "Deleted" : "Edited"} ${relative}`;
}

function ProjectCard({ project, returnTo, onDelete, onDuplicate, onRename, onFavorite, onMoveFolder, onExport, trash, onRestore, onDeleteForever }) {
  const [menuOpen, setMenuOpen] = useState(false), [editMode, setEditMode] = useState(null);
  const menuRef = useRef(null), triggerRef = useRef(null), menuId = useId();
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector("nav button")?.focus();
    const outside = event => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const escape = event => { if (event.key === "Escape") { setMenuOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);
  const action = callback => { setMenuOpen(false); triggerRef.current?.focus(); callback(); };
  const navigation = { to: boardPath(project.id), state: { from: returnTo } };
  const preview = <><BoardPreview board={project.board} title={project.title} accent={project.accent}/><span className={styles.openHint}>{trash ? "Restore project" : "Open board"}<Icon name={trash ? "history" : "forward"} size={15}/></span></>;
  return <article className={`${styles.projectCard} ${menuOpen ? styles.cardMenuOpen : ""}`}>
    {trash ? <button className={styles.previewButton} onClick={() => onRestore(project.id)} aria-label={`Restore ${project.title}`}>{preview}</button> : <Link className={styles.previewButton} {...navigation} aria-label={`Open ${project.title}`}>{preview}</Link>}
    <div className={styles.cardMeta}>
      <div className={styles.cardTitle}>{trash ? <button className={styles.projectName} onClick={() => onRestore(project.id)}>{project.title}</button> : <Link className={styles.projectName} {...navigation}>{project.title}</Link>}<span className={styles.projectDetails}>{project.folder && <span className={styles.folderLabel}><Icon name="folder" size={13}/>{project.folder}</span>}<span>{updatedLabel(project, trash)}</span></span></div>
      <div className={styles.cardActions}>
        {trash ? <button className={styles.iconButton} onClick={() => onRestore(project.id)} title="Restore project" aria-label="Restore project"><Icon name="history"/></button> : <button className={`${styles.iconButton} ${project.favorite ? styles.favoriteAction : ""}`} onClick={() => onFavorite(project.id)} title={project.favorite ? "Remove favorite" : "Add favorite"} aria-label={project.favorite ? "Remove favorite" : "Add favorite"} aria-pressed={Boolean(project.favorite)}><Icon name="star"/></button>}
        <div className={styles.menuAnchor} ref={menuRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}>
          <button ref={triggerRef} className={styles.iconButton} aria-label={`More actions for ${project.title}`} title="More actions" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}><Icon name="more"/></button>
          <MotionPresence present={menuOpen} kind="menu"><nav id={menuId} className={styles.cardMenu} aria-label={`Actions for ${project.title}`}>
            {trash ? <button className={styles.dangerAction} onClick={() => action(() => onDeleteForever(project.id))}><Icon name="trash"/>Delete forever</button> : <>
              <button onClick={() => action(() => setEditMode("rename"))}><Icon name="edit"/>Rename project</button>
              <button onClick={() => action(() => setEditMode("folder"))}><Icon name="folder"/>Move to folder</button>
              <button onClick={() => action(() => onDuplicate(project.id))}><Icon name="duplicate"/>Duplicate project</button>
              <button onClick={() => action(() => onExport(project))}><Icon name="download"/>Export project</button>
              <button className={styles.dangerAction} onClick={() => action(() => onDelete(project.id))}><Icon name="trash"/>Move to trash</button>
            </>}
          </nav></MotionPresence>
        </div>
      </div>
    </div>
    <MotionPresence present={Boolean(editMode)}><ProjectEditDialog project={project} mode={editMode} onClose={() => { setEditMode(null); triggerRef.current?.focus(); }} onRename={onRename} onMoveFolder={onMoveFolder}/></MotionPresence>
  </article>;
}

function TemplateCard({ template, onCreate }) {
  return <button className={styles.templateCard} onClick={() => onCreate(template)}><div className={styles.templatePreview}><BoardPreview board={template.board}/></div><span><strong>{template.name}</strong><small>{template.description}</small></span><Icon name="forward" size={16}/></button>;
}

const formatBytes = value => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;

export default function Home({ projects, deletedProjects, storageError, onDismissError, onCreate, onDelete, onRestore, onDeleteForever, onDuplicate, onRename, onFavorite, onMoveFolder, onExport, onBackup, onImport, section = "projects" }) {
  const [requestDelete, deleteConfirmation] = useDeleteConfirmation();
  const projectsHeading = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const setQuery = value => setSearchParams(previous => { const next = new URLSearchParams(previous); if (value) next.set("q", value); else next.delete("q"); return next; }, { replace: true });
  const { folderName } = useParams(), location = useLocation();
  const sectionTitle = section === "folder" ? folderName : section === "favorites" ? "Favorites" : section === "trash" ? "Trash" : "Your projects";
  usePageTitle(section === "projects" ? "Projects" : sectionTitle);
  const [storage, setStorage] = useState(null), [gallery, setGallery] = useState(false), [sort, setSort] = useState("recent"), [view, setView] = useState("grid");
  const fileInput = useRef(null), galleryTrigger = useRef(null);
  const folders = useMemo(() => [...new Set(projects.map(project => project.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [projects]);
  const visibleProjects = section === "trash" ? deletedProjects : section === "favorites" ? projects.filter(project => project.favorite) : section === "folder" ? projects.filter(project => project.folder === folderName) : projects;
  const filtered = visibleProjects.filter(project => [project.title, project.folder, ...(project.board?.nodes || []).flatMap(node => [node.title, node.note])].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === "name" ? a.title.localeCompare(b.title) : sort === "oldest" ? a.updated - b.updated : b.updated - a.updated);
  useEffect(() => { let active = true; getStorageEstimate().then(value => { if (active) setStorage(value); }).catch(() => {}); return () => { active = false; }; }, [projects, deletedProjects]);
  const closeGallery = () => { setGallery(false); galleryTrigger.current?.focus(); };
  const confirmProjectDelete = (id, permanent = false) => {
    const project = (permanent ? deletedProjects : projects).find(item => item.id === id);
    if (!project) return;
    requestDelete({
      title: permanent ? "Delete project forever?" : "Move project to Trash?",
      description: permanent ? `“${project.title}” and its saved versions will be permanently deleted from this device. This cannot be undone.` : `“${project.title}” will move to Trash. You can restore it later.`,
      confirmLabel: permanent ? "Delete forever" : "Move to Trash",
      fallbackFocus: projectsHeading.current,
      onConfirm: () => (permanent ? onDeleteForever : onDelete)(id),
    });
  };
  const description = section === "trash" ? "A second chance for ideas. Restore a project whenever you need it." : section === "favorites" ? "The ideas you want to keep close." : section === "folder" ? "A little more order. A little more room to think." : "A little space for your next big idea.";
  return <div className={styles.home}>
    <a href="#workspace-content" className={styles.skipLink}>Skip to projects</a>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} to="/" aria-label="Nova home"><NovaMark/><b>Nova<span>Space to think.</span></b></Link>
      <p className={styles.navLabel}>WORKSPACE</p>
      <nav aria-label="Workspace"><NavLink to="/projects" end className={({ isActive }) => isActive ? styles.activeNav : ""}><Icon name="grid"/><span>Projects</span><small>{projects.length}</small></NavLink><NavLink to="/projects/favorites" className={({ isActive }) => isActive ? styles.activeNav : ""}><Icon name="star"/><span>Favorites</span></NavLink><NavLink to="/projects/trash" className={({ isActive }) => isActive ? styles.activeNav : ""}><Icon name="trash"/><span>Trash</span>{deletedProjects.length > 0 && <small>{deletedProjects.length}</small>}</NavLink>
        {folders.length > 0 && <div className={styles.folderNav}><p className={styles.navLabel}>FOLDERS</p>{folders.map(folder => <NavLink key={folder} caseSensitive to={folderPath(folder)} className={({ isActive }) => isActive ? styles.activeNav : ""} title={folder}><Icon name="folder"/><span>{folder}</span></NavLink>)}</div>}
      </nav>
      <div className={styles.sidebarNote}><span><Icon name="lock" size={17}/>Yours, by default.</span><p>Your ideas stay on this device.<br/>No account. Just you and a canvas.</p></div>
      <div className={styles.localStatus}><i/><div><b>Local workspace</b><small>{storage ? `${formatBytes(storage.usage)} used on this device` : "Stored on this device"}</small></div></div>
    </aside>
    <div className={styles.workspace}>
      <div className={styles.topbar}><div className={styles.breadcrumb}><span>Workspace</span><Icon name="chevron" size={14}/><b>{section === "projects" ? "Projects" : sectionTitle}</b></div><div className={styles.workspaceTools}><span className={styles.savedStatus}><i/>Saved on this device</span><button className={styles.quietButton} onClick={onBackup}><Icon name="download" size={16}/><span>Back up workspace</span></button></div></div>
      <main id="workspace-content" className={styles.main}>
        <header className={styles.pageHeader}><div><p className={styles.eyebrow}>A CLEARER HEAD STARTS HERE</p><h1>{sectionTitle}<span>.</span></h1><p className={styles.subtitle}>{description}</p></div><div className={styles.homeActions}><button className={styles.secondaryButton} onClick={() => fileInput.current?.click()}><Icon name="upload"/>Import</button><button className={styles.primaryButton} aria-label="New mind map" onClick={() => onCreate()}><Icon name="plus"/>New mind map</button></div></header>
        {storageError && <div className={styles.storageError} role="alert"><span>{storageError}</span><button onClick={onDismissError}>Dismiss</button></div>}
        {section === "projects" && !query && <section className={styles.templates} aria-labelledby="templates-title"><div className={styles.sectionHeading}><h2 id="templates-title">Start something new</h2><button className={styles.textButton} ref={galleryTrigger} onClick={() => setGallery(true)}>Browse templates<Icon name="forward" size={16}/></button></div><div className={styles.templateGrid}>
          <button className={styles.blankCard} onClick={() => onCreate()}><span className={styles.blankIcon}><Icon name="plus" size={24}/></span><span><strong>A fresh canvas</strong><small>Start with a little possibility.</small></span><Icon name="forward" size={16}/></button>
          {[templates[0], templates[4], templates[1]].map(template => <TemplateCard key={template.id} template={template} onCreate={onCreate}/>)}</div></section>}
        <input ref={fileInput} className={styles.fileInput} type="file" accept=".nova,.nova-workspace,application/json,application/x-nova+json,application/x-nova-workspace+json" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ""; }}/>
        <section className={styles.projects} aria-labelledby="projects-title"><div className={styles.projectToolbar}><div className={styles.projectHeading}><h2 id="projects-title" ref={projectsHeading} tabIndex={-1}>{query ? "Search results" : section === "projects" ? "All projects" : sectionTitle}</h2><span aria-live="polite">{filtered.length}</span></div><div className={styles.filters}><label className={styles.search}><Icon name="search" size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects…" aria-label="Search projects"/>{query && <button className={styles.iconButton} aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={16}/></button>}</label><select aria-label="Sort projects" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Last edited</option><option value="name">Name A–Z</option><option value="oldest">Oldest first</option></select><div className={styles.viewToggle} aria-label="Project view"><button aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Icon name="grid" size={17}/></button><button aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><Icon name="bulletList" size={19}/></button></div></div></div>
          {filtered.length ? <div className={`${styles.projectGrid} ${view === "list" ? styles.projectList : ""}`}>{filtered.map(project => <ProjectCard key={project.id} project={project} trash={section === "trash"} returnTo={location.pathname + location.search} onDelete={id => confirmProjectDelete(id)} onRestore={onRestore} onDeleteForever={id => confirmProjectDelete(id, true)} onDuplicate={onDuplicate} onRename={onRename} onFavorite={onFavorite} onMoveFolder={onMoveFolder} onExport={onExport}/>)}</div> : <div className={styles.empty}><span className={styles.emptyIcon}><Icon name={query ? "search" : section === "trash" ? "trash" : section === "favorites" ? "star" : "layout"} size={28}/></span><h3>{query ? "No matching ideas yet" : section === "trash" ? "Nothing in the trash" : section === "favorites" ? "Keep your best ideas close" : "Your next idea starts here"}</h3><p>{query ? "Try a different name, folder, or word from your board." : section === "trash" ? "Projects you delete will appear here, ready to restore." : section === "favorites" ? "Star a project and you’ll find it right here." : "Create a mind map and see where it takes you."}</p>{query ? <button className={styles.secondaryButton} onClick={() => setQuery("")}>Clear search</button> : section === "projects" ? <button className={styles.primaryButton} onClick={() => onCreate()}><Icon name="plus"/>Create your first map</button> : section === "favorites" ? <Link className={styles.secondaryButton} to="/projects">Explore your projects<Icon name="forward" size={16}/></Link> : null}</div>}
        </section>
        <footer className={styles.workspaceFooter}><span><Icon name="lock" size={14}/>Private by default. Room for every idea.</span><span>{projects.length} {projects.length === 1 ? "project" : "projects"} in your workspace</span></footer>
      </main>
    </div>
    {deleteConfirmation}
    <MotionPresence present={gallery}><Dialog title="A starting point for every idea" description="Pick a template and make it your own." onClose={closeGallery} wide><div className={styles.galleryGrid}>{templates.map(template => <TemplateCard key={template.id} template={template} onCreate={onCreate}/>)}</div></Dialog></MotionPresence>
  </div>;
}
