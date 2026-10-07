import { Navigate, useParams, useSearchParams } from 'react-router';
import TemplateLibrary from './TemplateLibrary';
import { workspaceTemplatesPath } from '../lib/routes';
import usePageTitle from '../lib/usePageTitle';

export function WorkspaceTemplatePage({ onCreate }) {
  usePageTitle('Templates');
  return <TemplatePage onCreate={onCreate} workspace/>;
}

export default function TemplatePage({ onCreate, workspace = false }) {
  const { templateId } = useParams(), [params] = useSearchParams();
  const libraryPath = workspace ? workspaceTemplatesPath : '/templates';
  if (templateId || params.has('template')) return <Navigate replace to={libraryPath}/>;
  return <TemplateLibrary embedded={workspace} onCreate={onCreate}/>;
}
