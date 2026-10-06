import BrandMark from './BrandMark';
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { boardPath } from "../lib/routes";
import { readShareLink, sharedProjectCopy } from "../lib/boardShare";
import { sanitizeSharedProject } from "../lib/sharedBoardContent";
import usePageTitle from "../lib/usePageTitle";
import RouteNotice from "./RouteNotice";
const ReadOnlyBoard = lazy(() => import("./ReadOnlyBoard"));

export default function SharedBoardRoute({ onImport }) {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(null);
  const readOnlyProject = opened?.hash === hash ? opened.project : null;
  usePageTitle(readOnlyProject?.title || "Opening shared board");

  useEffect(() => {
    let cancelled = false;
    setError("");
    const open = async () => {
      const decoded = await readShareLink(hash);
      if (cancelled) return;
      const shared = sanitizeSharedProject(decoded.project);
      if (decoded.access === "readonly") { setOpened({ hash, project: shared }); return; }
      const project = sharedProjectCopy(shared);
      await onImport(project);
      if (!cancelled) navigate(boardPath(project.id), { replace: true });
    };
    open().catch(failure => { if (!cancelled) setError(failure.message || "Could not open this shared board."); });
    return () => { cancelled = true; };
  }, [hash, navigate, onImport]);

  if (error) return <RouteNotice title="Couldn’t open shared board">{error}</RouteNotice>;
  if (readOnlyProject) return <Suspense fallback={<div className="appLoading" role="status">Opening shared board…</div>}><ReadOnlyBoard key={hash} project={readOnlyProject}/></Suspense>;
  return <div className="appLoading" role="status"><span><BrandMark size={28}/></span><b>Opening shared board…</b></div>;
}
