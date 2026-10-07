import { useLocation, useNavigate } from 'react-router';
import { ImportWorkspaceUrlDialog } from './WorkspaceTransferDialog';
import usePageTitle from '../lib/usePageTitle';

export default function WorkspaceRestoreRoute({ onImport }) {
  const location = useLocation(), navigate = useNavigate();
  usePageTitle('Restore workspace backup');
  return <main id="workspace-content"><ImportWorkspaceUrlDialog key={location.hash} initialUrl={location.hash ? new URL(location.pathname + location.hash, window.location.origin).href : ''} onImport={onImport} onClose={() => navigate('/projects', { replace: true })}/></main>;
}
