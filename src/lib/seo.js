import { brand, siteOrigin } from './brand.js';
import { templates } from '../data/templates.js';

export const templatePath = template => `/templates/${typeof template === 'string' ? template : template.id}`;
export const publicPaths = ['/', '/templates', ...templates.map(templatePath)];
export const isWorkspacePath = path => /^\/(projects|boards)(\/|$)/.test(path) || path === '/share';

// Use only trusted catalog data. Never serialize local board titles or content.
export function pageMetadata(pathname, origin = siteOrigin) {
  const path = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const template = templates.find(item => templatePath(item) === path);
  const isPublic = publicPaths.includes(path);
  const title = template ? `${template.name} template — ${brand.name}` : path === '/templates' ? `Whiteboard & mind map templates — ${brand.name}` : path === '/' ? `${brand.name} — Private whiteboard for ideas & mind maps` : isWorkspacePath(path) ? `Your workspace — ${brand.name}` : `Page not found — ${brand.name}`;
  const description = template ? `${template.description} Start with this editable ${brand.name} whiteboard template. Customize every card and connection, with no account needed.` : path === '/templates' ? `Explore ${templates.length} editable whiteboard templates for brainstorming, project planning, meetings, and learning. Preview a layout, then make it yours in ${brand.name}.` : brand.description;
  const canonical = isPublic && origin ? `${origin}${path}` : '';
  const imagePath = `/social/${template?.id || (path === '/templates' ? 'templates' : 'home')}.png`;
  const image = origin && isPublic ? `${origin}${imagePath}?v=${brand.assetVersion}` : '';
  const schema = [];
  if (canonical) {
    const websiteId = `${origin}/#website`, appId = `${origin}/#app`;
    if (path === '/') {
      schema.push({ '@type': 'WebSite', '@id': websiteId, name: brand.name, alternateName: brand.alternateName, url: `${origin}/`, description: brand.description, inLanguage: 'en' });
      schema.push({ '@type': 'WebApplication', '@id': appId, name: brand.name, url: `${origin}/`, description: brand.description, applicationCategory: 'ProductivityApplication', operatingSystem: 'Web browser', browserRequirements: 'Requires JavaScript and a modern browser with IndexedDB.', image, featureList: ['Visual whiteboard', 'Mind maps and connected cards', 'Editable templates', 'Local device storage', 'Board snapshots and export'] });
    }
    schema.push({ '@type': path === '/templates' ? 'CollectionPage' : 'WebPage', '@id': `${canonical}#page`, url: canonical, name: title, description, inLanguage: 'en', isPartOf: { '@id': websiteId }, ...(image && { primaryImageOfPage: { '@type': 'ImageObject', url: image, width: 1200, height: 630 } }) });
    if (path === '/templates') schema.push({ '@type': 'ItemList', name: 'Whiteboard templates', numberOfItems: templates.length, itemListElement: templates.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, url: `${origin}${templatePath(item)}` })) });
    if (path !== '/') schema.push({ '@type': 'BreadcrumbList', itemListElement: [{ name: brand.name, url: `${origin}/` }, { name: 'Templates', url: `${origin}/templates` }, ...(template ? [{ name: template.name, url: canonical }] : [])].map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })) });
  }
  return { path, title, description, canonical, image, imageAlt: `${template?.name || brand.tagline} — ${brand.name} visual whiteboard`, isPublic, robots: isPublic && origin ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive', schema: schema.length ? { '@context': 'https://schema.org', '@graph': schema } : null };
}

export const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
export const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function headTags(metadata) {
  const { title, description, canonical, image, imageAlt, robots, schema } = metadata;
  return [
    { tag: 'title', text: title },
    { tag: 'meta', name: 'description', content: description },
    { tag: 'meta', name: 'robots', content: robots },
    { tag: 'meta', name: 'application-name', content: brand.name },
    { tag: 'meta', name: 'theme-color', content: brand.themeColor },
    ...(canonical ? [{ tag: 'link', rel: 'canonical', href: canonical }] : []),
    ...Object.entries({ 'og:type': 'website', 'og:site_name': brand.name, 'og:locale': 'en_US', 'og:title': title, 'og:description': description, ...(canonical && { 'og:url': canonical }), ...(image && { 'og:image': image, 'og:image:width': '1200', 'og:image:height': '630', 'og:image:type': 'image/png', 'og:image:alt': imageAlt }) }).map(([property, content]) => ({ tag: 'meta', property, content })),
    ...Object.entries({ 'twitter:card': image ? 'summary_large_image' : 'summary', 'twitter:title': title, 'twitter:description': description, ...(image && { 'twitter:image': image, 'twitter:image:alt': imageAlt }) }).map(([name, content]) => ({ tag: 'meta', name, content })),
    ...(schema ? [{ tag: 'script', type: 'application/ld+json', text: safeJson(schema) }] : []),
  ];
}

export function renderHead(metadata) {
  return headTags(metadata).map(({ tag, text, ...attributes }) => `<${tag} data-seo=""${Object.entries(attributes).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join('')}>${tag === 'meta' || tag === 'link' ? '' : `${tag === 'script' ? text : escapeHtml(text)}</${tag}>`}`).join('\n');
}
