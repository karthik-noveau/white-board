import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import TemplateLibrary from './TemplateLibrary';
import RouteNotice from './RouteNotice';
import { templates } from '../data/templates';
import { workspaceTemplatesPath } from '../lib/routes';
import usePageTitle from '../lib/usePageTitle';

export function WorkspaceTemplatePage({ onCreate }) {
  const { templateId } = useParams();
  const template = templates.find(item => item.id === templateId);
  usePageTitle(template ? `${template.name} template` : templateId ? 'Template not found' : 'Templates');
  return <TemplatePage onCreate={onCreate} workspace/>;
}

export default function TemplatePage({ onCreate, workspace = false }) {
  const navigate = useNavigate(), [params] = useSearchParams();
  const { templateId } = useParams();
  const template = templates.find(item => item.id === templateId);
  const legacy = templates.find(item => item.id === params.get('template'));
  const libraryPath = workspace ? workspaceTemplatesPath : '/templates';
  if (!templateId && legacy) return <Navigate replace to={`${libraryPath}/${legacy.id}`}/>;
  if (templateId && !template) {
    const notice = <RouteNotice title="Template not found" to={libraryPath} action="Browse templates">This template isn’t available. Explore the library to find a starting point.</RouteNotice>;
    return workspace ? <div id="workspace-content">{notice}</div> : notice;
  }
  return <TemplateLibrary key={templateId || 'library'} fullPage embedded={workspace} libraryPath={libraryPath} initialTemplate={template} onPreview={item => navigate(item ? `${libraryPath}/${item.id}` : libraryPath)} onCreate={onCreate} onClose={() => navigate('/projects')}/>;
}
