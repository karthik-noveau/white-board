import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router";
import { boardPath, workspaceTemplatesPath } from "../lib/routes";
import usePageTitle from "../lib/usePageTitle";
import { readWorkspacePreferences, saveWorkspacePreferences } from "../lib/workspacePreferences";
import { projectUpdatedLabel } from "../lib/projectDates";
import useDeleteConfirmation from "../lib/useDeleteConfirmation";
import Icon from "./BoardIcon";
import MotionPresence from "./MotionPresence";
import BoardPreview from "./BoardPreview";
import TextInputDialog from "./TextInputDialog";
import ShareBoard from "./ShareBoard";
import WorkspaceFolders from "./WorkspaceFolders";
import ProjectSort from "./ProjectSort";
import WorkspacePageIntro, { WorkspaceCreateButton } from "./WorkspacePageIntro";
import styles from "../styles/home.module.css";

function Dialog({ title, description, onClose, children }) {
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
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClose={event => { if (!event.currentTarget.open) onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
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
  return projectUpdatedLabel(project, trash);
}

function ProjectCard({ project, returnTo, onDelete, onDuplicate, onRename, onFavorite, onMoveFolder, folders, onExport, trash, onRestore, onDeleteForever, selectionMode, selectionDisabled, selected, onToggle }) {
  const [menuOpen, setMenuOpen] = useState(false), [editMode, setEditMode] = useState(null), [shareProject, setShareProject] = useState(null);
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
  const preview = <BoardPreview board={project.board} title={project.title} accent={project.accent}/>;
  return <article data-accent={project.accent} data-selecting={selectionMode || undefined} className={`${styles.projectCard} ${menuOpen ? styles.cardMenuOpen : ""} ${selected ? styles.selectedProject : ""}`}>
    {!trash && <label className={styles.projectCheckbox} title={`Select ${project.title}`}><input type="checkbox" checked={selected} disabled={selectionDisabled} onChange={onToggle} aria-label={`Select ${project.title}`}/></label>}
    {selectionMode ? <button className={styles.previewButton} onClick={onToggle} aria-label={`${selected ? 'Deselect' : 'Select'} ${project.title} preview`}>{preview}</button> : trash ? <button className={styles.previewButton} onClick={() => onRestore(project.id)} aria-label={`Restore ${project.title}`}>{preview}</button> : <Link className={styles.previewButton} {...navigation} aria-label={`Open ${project.title}`}>{preview}</Link>}
    <div className={styles.cardMeta}>
      <div className={styles.cardTitle}>{selectionMode ? <button className={styles.projectName} onClick={onToggle}>{project.title}</button> : trash ? <button className={styles.projectName} onClick={() => onRestore(project.id)}>{project.title}</button> : <Link className={styles.projectName} {...navigation}>{project.title}</Link>}<span className={styles.projectDetails}>{project.folder && <span className={styles.folderLabel}><Icon name="folder" size={13}/>{project.folder}</span>}<span>{updatedLabel(project, trash)}</span></span></div>
      {!selectionMode && <div className={styles.cardActions}>
        {trash ? <button className={styles.iconButton} onClick={() => onRestore(project.id)} title="Restore project" aria-label="Restore project"><Icon name="history"/></button> : <button className={`${styles.iconButton} ${project.favorite ? styles.favoriteAction : ""}`} onClick={() => onFavorite(project.id)} title={project.favorite ? "Remove favorite" : "Add favorite"} aria-label={project.favorite ? "Remove favorite" : "Add favorite"} aria-pressed={Boolean(project.favorite)}><Icon name="star"/></button>}
        <div className={styles.menuAnchor} ref={menuRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}>
          <button ref={triggerRef} className={styles.iconButton} aria-label={`More actions for ${project.title}`} title="More actions" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}><Icon name="more"/></button>
          <MotionPresence present={menuOpen} kind="menu"><nav id={menuId} className={styles.cardMenu} aria-label={`Actions for ${project.title}`}>
            {trash ? <button className={styles.dangerAction} onClick={() => action(() => onDeleteForever(project.id))}><Icon name="trash"/>Delete forever</button> : <>
              <button onClick={() => action(() => setEditMode("rename"))}><Icon name="edit"/>Rename project</button>
              <button onClick={() => action(() => setEditMode("folder"))}><Icon name="folder"/>Move to folder</button>
              <button onClick={() => action(() => onDuplicate(project.id))}><Icon name="duplicate"/>Duplicate project</button>
              <button onClick={() => action(() => setShareProject(structuredClone(project)))}><Icon name="share"/>Share project</button>
              <button onClick={() => action(() => onExport(project))}><Icon name="download"/>Export project</button>
              <span className={styles.cardMenuDivider} aria-hidden="true"/>
              <button className={styles.dangerAction} onClick={() => action(() => onDelete(project.id))}><Icon name="trash"/>Move to trash</button>
            </>}
          </nav></MotionPresence>
        </div>
      </div>}
    </div>
    <MotionPresence present={editMode === "rename"}><ProjectEditDialog project={project} mode={editMode} onClose={() => { setEditMode(null); triggerRef.current?.focus(); }} onRename={onRename} onMoveFolder={onMoveFolder}/></MotionPresence>
    {editMode === "folder" && <TextInputDialog title="Move to folder" description="Choose an existing folder, type a new name, or leave it empty to keep the project outside folders." label="Folder name" initialValue={project.folder || ""} suggestions={folders} allowEmpty confirmLabel="Move project" fallbackFocus={triggerRef.current} onConfirm={value => onMoveFolder(project.id, value)} onClose={() => setEditMode(null)}/>}
    {shareProject && <ShareBoard project={shareProject} onClose={() => setShareProject(null)} onBackup={() => onExport(shareProject)}/>}
  </article>;
}

export default function Home({ projects, deletedProjects, storageError, onDismissError, onCreate, onDelete, onRestore, onDeleteForever, onDuplicate, onRename, onFavorite, onMoveFolder, onExport, onBatchAction, folders: savedFolders = [], onManageFolder, section = "projects" }) {
  const [requestDelete, deleteConfirmation] = useDeleteConfirmation();
  const projectsHeading = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const setQuery = value => setSearchParams(previous => { const next = new URLSearchParams(previous); if (value) next.set("q", value); else next.delete("q"); return next; }, { replace: true });
  const { folderName } = useParams(), location = useLocation();
  const sectionTitle = section === "folder" ? folderName : section === "favorites" ? "Favorites" : section === "trash" ? "Trash" : "Your projects";
  usePageTitle(section === "projects" ? "Projects" : sectionTitle);
  const [preferences, setPreferences] = useState(readWorkspacePreferences);
  const { sort, view } = preferences;
  const setSort = sort => setPreferences(current => ({ ...current, sort }));
  const setView = view => setPreferences(current => ({ ...current, view }));
  useEffect(() => { saveWorkspacePreferences(preferences); }, [preferences]);
  const gallery = searchParams.get("templates") === "1";
  const folders = useMemo(() => [...new Set([...savedFolders, ...projects.map(project => project.folder)].filter(Boolean))].sort((a, b) => a.localeCompare(b)), [projects, savedFolders]);
  const visibleProjects = section === "trash" ? deletedProjects : section === "favorites" ? projects.filter(project => project.favorite) : section === "folder" ? projects.filter(project => project.folder === folderName) : projects;
  const filtered = visibleProjects.filter(project => [project.title, project.folder, ...(project.board?.nodes || []).flatMap(node => [node.title, node.note])].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === "name" ? a.title.localeCompare(b.title) : sort === "oldest" ? a.updated - b.updated : b.updated - a.updated);
  const selectionScope = `${location.pathname}?${query}`;
  const [selection, setSelection] = useState({ scope: selectionScope, active: false, ids: [] });
  const [movingIds, setMovingIds] = useState(null), [batchBusy, setBatchBusy] = useState(false);
  const [batchNotice, setBatchNotice] = useState(''), [batchError, setBatchError] = useState('');
  useEffect(() => {
    setSelection(current => current.scope === selectionScope ? current : { scope: selectionScope, active: false, ids: [] });
  }, [selectionScope]);
  const selectionMode = section !== 'trash' && selection.scope === selectionScope && selection.active;
  const selectedIds = selectionMode ? filtered.filter(project => selection.ids.includes(project.id)).map(project => project.id) : [];
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const endSelection = () => setSelection({ scope: selectionScope, active: false, ids: [] });
  const finishSelection = () => {
    endSelection();
    projectsHeading.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!selectionMode || batchBusy || movingIds) return;
    const onEscape = event => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || document.querySelector('dialog[open]') || event.target?.closest?.('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      setSelection({ scope: selectionScope, active: false, ids: [] });
      projectsHeading.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [selectionMode, batchBusy, movingIds, selectionScope]);
  const toggleProject = id => {
    if (!selectionMode) { setBatchNotice(''); setBatchError(''); }
    setSelection(current => ({ scope: selectionScope, active: true, ids: selectedIds.includes(id) ? current.ids.filter(item => item !== id) : [...selectedIds, id] }));
  };
  const runBatch = async (ids, action, value, propagate = false) => {
    if (batchBusy || !ids.length) return;
    setBatchBusy(true); setBatchError(''); setBatchNotice('');
    try {
      const count = await onBatchAction(ids, action, value);
      const noun = count === 1 ? 'project' : 'projects';
      setBatchNotice(action === 'export' ? `Exported ${count} ${noun}.` : action === 'trash' ? `Moved ${count} ${noun} to Trash.` : value ? `Moved ${count} ${noun} to ${value}.` : `Removed the folder from ${count} ${noun}.`);
      if (action !== 'export') endSelection();
    } catch (error) {
      if (propagate) throw error;
      setBatchError(error.message || 'Could not update these projects. Please try again.');
    } finally { setBatchBusy(false); }
  };
  const confirmBatchTrash = () => {
    const ids = [...selectedIds];
    requestDelete({ title: `Move ${ids.length} ${ids.length === 1 ? 'project' : 'projects'} to Trash?`, description: 'You can restore these projects from Trash later.', confirmLabel: 'Move to Trash', fallbackFocus: projectsHeading.current, onConfirm: () => runBatch(ids, 'trash') });
  };

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
  const description = section === "trash" ? "A second chance for ideas. Restore a project whenever you need it." : section === "favorites" ? "The ideas you want to keep close." : section === "folder" ? "A little more order. A little more room to think." : "A home for the ideas you’re growing. Pick up a thought, or start a new one.";
  if (gallery) return <Navigate to={`${workspaceTemplatesPath}${searchParams.get("template") ? `?template=${encodeURIComponent(searchParams.get("template"))}` : ""}`} replace/>;
  return <>
      <main id="workspace-content" className={styles.main}>
        <WorkspacePageIntro title={sectionTitle} description={description}/>
        {storageError && <div className={styles.storageError} role="alert"><span>{storageError}</span><button onClick={onDismissError}>Dismiss</button></div>}
        {(section === "projects" || section === "folder") && <WorkspaceFolders key={folderName || "all"} folders={folders} projects={projects} currentFolder={section === "folder" ? folderName : undefined} onManageFolder={onManageFolder}/>}
        <section className={styles.projects} aria-labelledby="projects-title">
          <div className={styles.projectToolbar}>
            <div className={styles.projectHeading}>
              <h2 id="projects-title" ref={projectsHeading} tabIndex={-1}>{query ? "Search results" : section === "projects" ? "All projects" : sectionTitle}</h2>
              <span aria-live="polite">{filtered.length}</span>
            </div>
            <div className={styles.filters}>
              <label className={styles.search}>
                <Icon name="search" size={18}/>
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects…" aria-label="Search projects"/>
                {query && <button className={styles.iconButton} aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={16}/></button>}
              </label>
              <ProjectSort value={sort} onChange={setSort}/>
              <div className={styles.viewToggle} role="group" aria-label="Project view">
                <button type="button" className={styles.viewMode} aria-label="Grid view" title="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Icon name="grid" size={16}/></button>
                <button type="button" className={styles.viewMode} aria-label="List view" title="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><Icon name="textBulletedList" size={17}/></button>

              </div>
            </div>
            {section === "projects" && <WorkspaceCreateButton aria-label="New mind map" onClick={() => onCreate()}><Icon name="plus" size={17}/>New mind map</WorkspaceCreateButton>}
          </div>
          {selectionMode && <div className={styles.batchToolbar} role="group" aria-label="Selected project actions" aria-busy={batchBusy}>
            <label><input type="checkbox" checked={allSelected} ref={element => { if (element) element.indeterminate = selectedIds.length > 0 && !allSelected; }} disabled={batchBusy} onChange={() => setSelection({ scope: selectionScope, active: true, ids: allSelected ? [] : filtered.map(project => project.id) })}/>Select all visible</label>
            <strong aria-live="polite">{selectedIds.length} selected</strong>
            <div className={styles.batchActions}>
              <button disabled={!selectedIds.length || batchBusy} onClick={() => setMovingIds([...selectedIds])}><Icon name="folder" size={16}/>Move</button>
              <button disabled={!selectedIds.length || batchBusy} onClick={() => runBatch([...selectedIds], 'export')}><Icon name="download" size={16}/>Export</button>
              <button className={styles.batchTrash} disabled={!selectedIds.length || batchBusy} onClick={confirmBatchTrash}><Icon name="trash" size={16}/>Trash</button>
              <button className={styles.batchDone} disabled={batchBusy} aria-label="Clear project selection" aria-keyshortcuts="Escape" title="Clear selection (Esc)" onClick={finishSelection}><Icon name="close" size={15}/>Done</button>
            </div>
          </div>}
          {batchNotice && <p className={styles.batchNotice} role="status">{batchNotice}</p>}
          {batchError && <p className={styles.batchError} role="alert">{batchError}</p>}
          {filtered.length ? <div className={`${styles.projectGrid} ${view === "list" ? styles.projectList : ""}`}>{filtered.map(project => <ProjectCard key={project.id} project={project} selectionMode={selectionMode} selectionDisabled={batchBusy} selected={selectedIds.includes(project.id)} onToggle={() => { if (!batchBusy) toggleProject(project.id); }} trash={section === "trash"} returnTo={location.pathname + location.search} onDelete={id => confirmProjectDelete(id)} onRestore={onRestore} onDeleteForever={id => confirmProjectDelete(id, true)} onDuplicate={onDuplicate} onRename={onRename} onFavorite={onFavorite} onMoveFolder={onMoveFolder} folders={folders} onExport={onExport}/>)}</div> : <div className={styles.empty}><span className={styles.emptyIcon}><Icon name={query ? "search" : section === "trash" ? "trash" : section === "favorites" ? "star" : "newBoard"} size={28}/></span><h3>{query ? "No matching ideas yet" : section === "trash" ? "Nothing in the trash" : section === "favorites" ? "Keep your best ideas close" : section === "folder" ? "This folder is ready for your ideas" : "Your next idea starts here"}</h3><p>{query ? "Try a different name, folder, or word from your board." : section === "trash" ? "Projects you delete will appear here, ready to restore." : section === "favorites" ? "Star a project and you’ll find it right here." : section === "folder" ? "Move projects here using Move to folder in a project’s menu." : "Create a mind map and see where it takes you."}</p>{query ? <button className={styles.secondaryButton} onClick={() => setQuery("")}>Clear search</button> : section === "projects" ? <button className={styles.primaryButton} onClick={() => onCreate()}><Icon name="plus"/>Create your first map</button> : section === "favorites" || section === "folder" ? <Link className={styles.secondaryButton} to="/projects">Explore your projects<Icon name="forward" size={16}/></Link> : null}</div>}
        </section>
      </main>
    {movingIds && <TextInputDialog title={`Move ${movingIds.length} ${movingIds.length === 1 ? 'project' : 'projects'}`} description="Choose a folder, enter a new name, or leave it empty to remove the folder." label="Folder name" allowEmpty suggestions={folders} confirmLabel="Move projects" fallbackFocus={projectsHeading.current} onConfirm={value => runBatch(movingIds, 'move', value, true)} onClose={() => setMovingIds(null)}/>}
    {deleteConfirmation}

  </>;
}
