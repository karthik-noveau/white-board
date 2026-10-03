import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import Home from "./components/Home";
import Landing from "./components/Landing";
import RouteNotice from "./components/RouteNotice";
import SharedBoardRoute from "./components/SharedBoardRoute";
import PageTransition from "./components/PageTransition";
import { boardPath, workspaceReturnPath } from "./lib/routes";
import useMobileViewport from "./lib/useMobileViewport";
import usePageTitle from "./lib/usePageTitle";
import {
  exportProjectFile,
  exportWorkspaceFile,
  importNovaFile,
  initializeWorkspace,
  moveProjectToTrash,
  permanentlyDeleteProject,
  putProject,
  restoreProject,
} from "./lib/localWorkspace";
import "./app.css";

const Canvas = lazy(() => import("./components/Canvas"));

const starterProjects = [
  { id:"product-vision", title:"Product vision", updated:Date.now(), accent:"violet" },
  { id:"launch-plan", title:"Launch planning", updated:Date.now()-86400000, accent:"blue" },
  { id:"research-map", title:"Research synthesis", updated:Date.now()-172800000, accent:"green" },
];

function BoardRoute({ projects, onRename, onSave, storageError }) {
  const { boardId } = useParams();
  const location = useLocation();
  const project = projects.find(item => item.id === boardId);
  usePageTitle(project?.deletedAt ? "This board is in Trash" : project?.title || (storageError ? "Couldn’t open your workspace" : "Board not found"));
  if (storageError && !project) return <RouteNotice title="Couldn’t open your workspace">{storageError}</RouteNotice>;
  if (!project) return <RouteNotice title="Board not found">This board isn’t in this browser’s local workspace. Open it on the device where you created it, or import its .nova file.</RouteNotice>;
  if (project.deletedAt) return <RouteNotice title="This board is in Trash" to="/projects/trash" action="Open Trash">Restore this board from Trash to open it again.</RouteNotice>;
  return <Suspense fallback={<div className="appLoading" role="status"><span>✦</span><b>Opening your board…</b></div>}><Canvas key={project.id} project={project} backTo={workspaceReturnPath(location.state?.from)} onRename={title => onRename(project.id, title)} onSave={onSave}/></Suspense>;
}

export default function App() {
  useMobileViewport();
  const navigate = useNavigate();
  const location = useLocation();
  const [projects,setProjects]=useState([]);
  const projectsRef=useRef([]);
  const [loading,setLoading]=useState(true);
  const [storageError,setStorageError]=useState("");
  const replaceProjects=useCallback(next=>{projectsRef.current=next;setProjects(next)},[]);
  const updateProject=useCallback((id,change,{snapshot=false}={})=>{
    const current=projectsRef.current.find(project=>project.id===id);
    if(!current)return Promise.resolve({ok:false,error:new Error("This board is no longer available")});
    const nextProject={...current,...(typeof change==="function"?change(current):change),updated:Date.now()};
    replaceProjects(projectsRef.current.map(project=>project.id===id?nextProject:project));
    return putProject(nextProject,{snapshot}).then(
      ()=>({ok:true}),
      error=>{setStorageError(error.message);return{ok:false,error}},
    );
  },[replaceProjects]);

  useEffect(()=>{let alive=true;initializeWorkspace(starterProjects).then(items=>{if(alive)replaceProjects(items)}).catch(error=>{if(alive)setStorageError(error.message)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[replaceProjects]);
  useEffect(()=>{window.scrollTo(0,0)},[location.pathname]);

  const createProject=template=>{const now=Date.now(),id=`project-${crypto.randomUUID()}`;const project={id,title:template?.name||"Untitled mind map",created:now,updated:now,accent:template?.accent||["violet","blue","green","orange"][projectsRef.current.filter(item=>!item.deletedAt).length%4],board:template?.board?structuredClone(template.board):undefined};replaceProjects([project,...projectsRef.current]);putProject(project,{snapshot:Boolean(project.board)}).catch(error=>setStorageError(error.message));navigate(boardPath(id),{state:{from:location.pathname+location.search}})};
  const deleteProject=id=>{const now=Date.now();replaceProjects(projectsRef.current.map(project=>project.id===id?{...project,deletedAt:now,updated:now}:project));moveProjectToTrash(id).catch(error=>setStorageError(error.message))};
  const restoreDeleted=id=>{const now=Date.now();replaceProjects(projectsRef.current.map(project=>{if(project.id!==id)return project;const restored={...project,updated:now};delete restored.deletedAt;return restored}));restoreProject(id).catch(error=>setStorageError(error.message))};
  const deleteForever=id=>{replaceProjects(projectsRef.current.filter(project=>project.id!==id));permanentlyDeleteProject(id).catch(error=>setStorageError(error.message))};
  const duplicateProject=id=>{const source=projectsRef.current.find(project=>project.id===id);if(!source)return;const now=Date.now();const copy={...source,id:`project-${now}`,title:`${source.title} copy`,created:now,updated:now,deletedAt:undefined,board:source.board?structuredClone(source.board):undefined};replaceProjects([copy,...projectsRef.current]);putProject(copy,{snapshot:Boolean(copy.board)}).catch(error=>setStorageError(error.message))};
  const renameProject=(id,title)=>updateProject(id,{title:title.trim()||"Untitled mind map"});
  const toggleFavorite=id=>updateProject(id,current=>({favorite:!current.favorite}));
  const moveToFolder=(id,folder)=>updateProject(id,{folder:folder.trim()});
  const saveBoard=(id,board)=>updateProject(id,{board},{snapshot:true});
  const importProject=async file=>{try{const imported=await importNovaFile(file);replaceProjects([...imported,...projectsRef.current]);navigate("/projects")}catch(error){setStorageError(error.message)}};
  const importSharedProject=useCallback(async project=>{await putProject(project,{snapshot:true});replaceProjects([project,...projectsRef.current])},[replaceProjects]);
  const backupWorkspace=()=>exportWorkspaceFile(projectsRef.current).catch(error=>setStorageError(error.message));
  if(loading)return <div className="appLoading"><span>✦</span><b>Opening your local workspace…</b></div>;
  const workspaceProps={projects:projects.filter(project=>!project.deletedAt),deletedProjects:projects.filter(project=>project.deletedAt),storageError,onDismissError:()=>setStorageError(""),onCreate:createProject,onDelete:deleteProject,onRestore:restoreDeleted,onDeleteForever:deleteForever,onDuplicate:duplicateProject,onRename:renameProject,onFavorite:toggleFavorite,onMoveFolder:moveToFolder,onExport:exportProjectFile,onBackup:backupWorkspace,onImport:importProject};
  return <PageTransition><Routes>
    <Route path="/" element={<Landing onCreate={createProject}/>}/>
    <Route path="/projects">
      <Route index element={<Home {...workspaceProps} section="projects"/>}/>
      <Route path="favorites" element={<Home {...workspaceProps} section="favorites"/>}/>
      <Route path="trash" element={<Home {...workspaceProps} section="trash"/>}/>
      <Route path="folders/:folderName" element={<Home {...workspaceProps} section="folder"/>}/>
    </Route>
    <Route path="/share" element={<SharedBoardRoute onImport={importSharedProject}/>}/>
    <Route path="/boards/:boardId" element={<BoardRoute projects={projects} onRename={renameProject} onSave={saveBoard} storageError={storageError}/>}/>
    <Route path="*" element={<RouteNotice/>}/>
  </Routes></PageTransition>;
}
