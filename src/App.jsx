import BrandMark from "./components/BrandMark";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import Home from "./components/Home";
import Landing from "./components/Landing";
import TemplatePage, { WorkspaceTemplatePage } from "./components/TemplatePage";
import WorkspaceLayout from "./components/WorkspaceLayout";
import RouteNotice from "./components/RouteNotice";
import SharedBoardRoute from "./components/SharedBoardRoute";
import WorkspaceRestoreRoute from './components/WorkspaceRestoreRoute';
import PageTransition from "./components/PageTransition";
import { boardPath, workspaceReturnPath } from "./lib/routes";
import { createProjectSaveQueue } from "./lib/projectSaveQueue";
import useMobileViewport from "./lib/useMobileViewport";
import usePageTitle from "./lib/usePageTitle";
import useSeo from "./lib/useSeo";
import { isWorkspacePath } from "./lib/seo";
import {
  exportProjectFile,
  exportProjectSelection,
  applyProjectBatch,
  exportWorkspaceFile,
  importNovaFile,
  importWorkspacePayload,
  readWorkspaceBackup,
  initializeWorkspace,
  listProjects,
  listWorkspaceFolders,
  changeWorkspaceFolder,
  moveProjectToTrash,
  permanentlyDeleteProject,
  putProject,
  restoreProject,
} from "./lib/localWorkspace";
import "./app.css";

const Canvas = lazy(() => import("./components/Canvas"));


function BoardRoute({ projects, onRename, onSave, onSaveCopy, storageError }) {
  const { boardId } = useParams();
  const location = useLocation();
  const project = projects.find(item => item.id === boardId);
  usePageTitle(project?.deletedAt ? "This board is in Trash" : project?.title || (storageError ? "Couldn’t open your workspace" : "Board not found"));
  if (storageError && !project) return <RouteNotice title="Couldn’t open your workspace">{storageError}</RouteNotice>;
  if (!project) return <RouteNotice title="Board not found">This board isn’t in this browser’s local workspace. Open it on the device where you created it, or import its board backup.</RouteNotice>;
  if (project.deletedAt) return <RouteNotice title="This board is in Trash" to="/projects/trash" action="Open Trash">Restore this board from Trash to open it again.</RouteNotice>;
  return <Suspense fallback={<div className="appLoading" role="status"><span><BrandMark size={28}/></span><b>Opening your board…</b></div>}><Canvas key={project.id} project={project} backTo={workspaceReturnPath(location.state?.from)} onRename={title => onRename(project.id, title)} onSave={onSave} onSaveCopy={onSaveCopy}/></Suspense>;
}

export default function App() {
  useMobileViewport();
  useSeo();
  const navigate = useNavigate();
  const location = useLocation();
  const [projects,setProjects]=useState([]);
  const [folders,setFolders]=useState([]);
  const projectsRef=useRef([]);
  const [persistProject] = useState(() => createProjectSaveQueue(putProject));
  const [loading,setLoading]=useState(true);
  const [storageError,setStorageError]=useState("");
  const [createError,setCreateError]=useState("");
  const initialization=useRef(null);
  const replaceProjects=useCallback(next=>{projectsRef.current=next;setProjects(next)},[]);
  const ensureWorkspace=useCallback(()=>{
    if(!initialization.current) initialization.current=initializeWorkspace([]).then(async items=>{replaceProjects(items);setFolders(await listWorkspaceFolders());return items}).catch(error=>{setStorageError(error.message);throw error}).finally(()=>setLoading(false));
    return initialization.current;
  },[replaceProjects]);
  const updateProject=useCallback((id,change,{snapshot=false}={})=>{
    const current=projectsRef.current.find(project=>project.id===id);
    if(!current)return Promise.resolve({ok:false,error:new Error("This board is no longer available")});
    const nextProject={...current,...(typeof change==="function"?change(current):change),updated:Date.now()};
    replaceProjects(projectsRef.current.map(project=>project.id===id?nextProject:project));
    return persistProject(nextProject,{snapshot}).then(
      saved=>{replaceProjects(projectsRef.current.map(project=>project.id===id?{...project,storageRevision:saved.storageRevision}:project));return{ok:true}},
      error=>{setStorageError(error.message);return{ok:false,error}},
    );
  },[replaceProjects,persistProject]);

  useEffect(()=>{ensureWorkspace().catch(()=>{})},[ensureWorkspace]);
  useEffect(()=>{window.scrollTo(0,0)},[location.pathname]);

  const createProject=async template=>{try{await ensureWorkspace()}catch(error){setCreateError(`Couldn’t create a board: ${error.message}`);return}const now=Date.now(),id=`project-${crypto.randomUUID()}`;const project={id,title:template?.name||"Untitled mind map",created:now,updated:now,accent:template?.accent||["violet","blue","green","orange"][projectsRef.current.filter(item=>!item.deletedAt).length%4],board:template?.board?structuredClone(template.board):undefined};replaceProjects([project,...projectsRef.current]);persistProject(project,{snapshot:Boolean(project.board)}).catch(error=>setStorageError(error.message));navigate(boardPath(id),{state:{from:location.pathname+location.search}})};
  const deleteProject=id=>{const now=Date.now();replaceProjects(projectsRef.current.map(project=>project.id===id?{...project,deletedAt:now,updated:now}:project));moveProjectToTrash(id).then(saved=>{if(saved)replaceProjects(projectsRef.current.map(project=>project.id===id?saved:project))}).catch(error=>setStorageError(error.message))};
  const restoreDeleted=id=>{const now=Date.now();replaceProjects(projectsRef.current.map(project=>{if(project.id!==id)return project;const restored={...project,updated:now};delete restored.deletedAt;return restored}));restoreProject(id).then(saved=>{if(saved)replaceProjects(projectsRef.current.map(project=>project.id===id?saved:project))}).catch(error=>setStorageError(error.message))};
  const deleteForever=id=>{replaceProjects(projectsRef.current.filter(project=>project.id!==id));permanentlyDeleteProject(id).catch(error=>setStorageError(error.message))};
  const duplicateProject=id=>{const source=projectsRef.current.find(project=>project.id===id);if(!source)return;const now=Date.now();const copy={...source,id:`project-${crypto.randomUUID()}`,storageRevision:0,title:`${source.title} copy`,created:now,updated:now,deletedAt:undefined,board:source.board?structuredClone(source.board):undefined};replaceProjects([copy,...projectsRef.current]);persistProject(copy,{snapshot:Boolean(copy.board)}).catch(error=>setStorageError(error.message))};
  const renameProject=(id,title)=>updateProject(id,{title:title.trim()||"Untitled mind map"});
  const toggleFavorite=id=>updateProject(id,current=>({favorite:!current.favorite}));
  const moveToFolder=(id,folder)=>batchProjects([id],'move',folder);
  const saveBoard=(id,board)=>updateProject(id,{board},{snapshot:true});
  const importProject=async file=>{try{const imported=await importNovaFile(file);replaceProjects([...imported,...projectsRef.current]);setFolders(await listWorkspaceFolders());navigate("/projects")}catch(error){setStorageError(error.message)}};
  const importSharedProject=useCallback(async project=>{const saved=await persistProject({...project,storageRevision:0},{snapshot:true});replaceProjects([saved,...projectsRef.current])},[replaceProjects,persistProject]);
  const saveBoardCopy = async project => {
    const now = Date.now();
    const copy = { ...project, id: `project-${crypto.randomUUID()}`, storageRevision: 0, title: `${project.title} copy`, created: now, updated: now, deletedAt: undefined };
    const saved = await persistProject(copy, { snapshot: true });
    replaceProjects(await listProjects({ includeDeleted: true })); setStorageError("");
    navigate(boardPath(saved.id), { state: { from: "/projects" } });
  };
  const backupWorkspace=async()=>{try{await persistProject.flush();await exportWorkspaceFile()}catch(error){setStorageError(error.message)}};
  const readBackup = useCallback(async () => {
    await ensureWorkspace();
    await persistProject.flush();
    return readWorkspaceBackup();
  }, [ensureWorkspace, persistProject]);
  const importWorkspace = async payload => {
    await ensureWorkspace();
    await persistProject.flush();
    const imported = await importWorkspacePayload(payload);
    replaceProjects([...imported, ...projectsRef.current]);
    setFolders(await listWorkspaceFolders());
    navigate('/projects', { replace: true });
  };
  const batchProjects = async (ids, action, value) => {
    if (action === 'export') {
      const selected = projectsRef.current.filter(project => ids.includes(project.id) && !project.deletedAt);
      await exportProjectSelection(selected);
      return selected.length;
    }
    await persistProject.flush();
    const changed = await applyProjectBatch(ids, action, value);
    const byId = new Map(changed.map(project => [project.id, project]));
    replaceProjects(projectsRef.current.map(project => byId.get(project.id) || project));
    setFolders(await listWorkspaceFolders());
    return changed.length;
  };
  const manageFolder = async (action, name, nextName) => {
    await ensureWorkspace();
    await persistProject.flush();
    const result = await changeWorkspaceFolder(action, name, nextName);
    replaceProjects(result.projects);
    setFolders(result.folders);
  };
  if(loading && isWorkspacePath(location.pathname))return <div className="appLoading" role="status"><span><BrandMark size={28}/></span><b>Opening your local workspace…</b></div>;
  const workspaceProps={folders,onManageFolder:manageFolder,projects:projects.filter(project=>!project.deletedAt),deletedProjects:projects.filter(project=>project.deletedAt),storageError,onDismissError:()=>setStorageError(""),onCreate:createProject,onDelete:deleteProject,onRestore:restoreDeleted,onDeleteForever:deleteForever,onDuplicate:duplicateProject,onRename:renameProject,onFavorite:toggleFavorite,onMoveFolder:moveToFolder,onExport:exportProjectFile,onBackup:backupWorkspace,onImport:importProject,onReadBackup:readBackup,onImportWorkspace:importWorkspace,onBatchAction:batchProjects};
  return <>{createError && <div className="creationError" role="alert">{createError}<button onClick={()=>setCreateError("")}>Dismiss</button></div>}<PageTransition><Routes>
    <Route path="/" element={<Landing onCreate={createProject}/>}/>
    <Route path="/templates" element={<TemplatePage onCreate={createProject}/>}/>
    <Route path="/templates/:templateId" element={<TemplatePage onCreate={createProject}/>}/>
    <Route path="/projects" element={<WorkspaceLayout {...workspaceProps}/>}>
      <Route index element={<Home {...workspaceProps} section="projects"/>}/>
      <Route path="favorites" element={<Home {...workspaceProps} section="favorites"/>}/>
      <Route path="trash" element={<Home {...workspaceProps} section="trash"/>}/>
      <Route path="restore" element={<WorkspaceRestoreRoute onImport={importWorkspace}/>}/>
      <Route path="folders/:folderName" element={<Home {...workspaceProps} section="folder"/>}/>
      <Route path="templates" element={<WorkspaceTemplatePage onCreate={createProject}/>}/>
      <Route path="templates/:templateId" element={<WorkspaceTemplatePage onCreate={createProject}/>}/>
    </Route>
    <Route path="/share" element={<SharedBoardRoute onImport={importSharedProject}/>}/>
    <Route path="/boards/:boardId" element={<BoardRoute projects={projects} onRename={renameProject} onSave={saveBoard} onSaveCopy={saveBoardCopy} storageError={storageError}/>}/>
    <Route path="*" element={<RouteNotice/>}/>
  </Routes></PageTransition></>;
}
