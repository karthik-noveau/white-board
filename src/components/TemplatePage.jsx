import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import TemplateLibrary from './TemplateLibrary';
import RouteNotice from './RouteNotice';
import { templates } from '../data/templates';
import { templatePath } from '../lib/seo';

export default function TemplatePage({ onCreate }) {
  const navigate = useNavigate(), [params] = useSearchParams();
  const { templateId } = useParams();
  const template = templates.find(item => item.id === templateId);
  const legacy = templates.find(item => item.id === params.get('template'));
  if (!templateId && legacy) return <Navigate replace to={templatePath(legacy)}/>;
  if (templateId && !template) return <RouteNotice title="Template not found" to="/templates" action="Browse templates">This template isn’t available. Explore the library to find a starting point.</RouteNotice>;
  return <TemplateLibrary key={templateId || 'library'} fullPage initialTemplate={template} onPreview={item => navigate(item ? templatePath(item) : '/templates')} onCreate={onCreate} onClose={() => navigate('/projects')}/>;
}
