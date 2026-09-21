import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { boardPath } from "../lib/routes";
import { readShareHash, sharedProjectCopy } from "../lib/boardShare";
import { sanitizeSharedProject } from "../lib/sharedBoardContent";
import usePageTitle from "../lib/usePageTitle";
import RouteNotice from "./RouteNotice";

export default function SharedBoardRoute({ onImport }) {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  usePageTitle("Opening shared board");

  useEffect(() => {
    let cancelled = false;
    setError("");
    const open = async () => {
      const decoded = await readShareHash(hash);
      if (cancelled) return;
      const project = sharedProjectCopy(sanitizeSharedProject(decoded));
      await onImport(project);
      if (!cancelled) navigate(boardPath(project.id), { replace: true });
    };
    open().catch(failure => { if (!cancelled) setError(failure.message || "Could not open this shared board."); });
    return () => { cancelled = true; };
  }, [hash, navigate, onImport]);

  if (error) return <RouteNotice title="Couldn’t open shared board">{error}</RouteNotice>;
  return <div className="appLoading" role="status"><span>✦</span><b>Opening shared board…</b></div>;
}
