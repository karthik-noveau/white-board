import { brand, siteOrigin } from './brand.js';
import { templates } from '../data/templates.js';
import { productPages, productPageFor } from '../data/productPages.js';
import { resourcePages, resourcePageFor } from '../data/resourcePages.js';

export const templatePath = template => `/templates#template-${typeof template === 'string' ? template : template.id}`;
export const publicPaths = ['/', '/templates', ...productPages.map(page => page.path), ...resourcePages.map(page => page.path)];
export const isWorkspacePath = path => /^\/(projects|boards)(\/|$)/.test(path) || /^\/share\/?$/.test(path);

// Use only trusted catalog data. Never serialize local board titles or content.
export function pageMetadata(pathname, origin = siteOrigin) {
  const path = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const isPublic = publicPaths.includes(path);
  const product = productPageFor(path) || resourcePageFor(path);
  const title = product?.title || (path === '/templates' ? `Whiteboard & mind map templates — ${brand.name}` : path === '/' ? `${brand.name} — Private whiteboard & mind maps` : isWorkspacePath(path) ? `Your workspace — ${brand.name}` : `Page not found — ${brand.name}`);
  const description = product?.description || (path === '/templates' ? `Explore ${templates.length} editable whiteboard templates for brainstorming, project planning, meetings, and learning. Preview a layout, then make it yours in ${brand.name}.` : brand.description);
  const canonical = isPublic && origin ? `${origin}${path}` : '';
  const imagePath = `/social/${path === '/' ? 'home' : isPublic ? path.slice(1) : 'home'}.png`;
  const image = origin && isPublic ? `${origin}${imagePath}?v=${brand.assetVersion}` : '';
  const schema = [];
  if (canonical) {
    const websiteId = `${origin}/#website`, appId = `${origin}/#app`, brandId = `${origin}/#brand`, imageId = `${canonical}#image`, breadcrumbId = `${canonical}#breadcrumbs`;
    // Describe the known product identity without inventing a company, reviews,
    // social profiles, or eligibility for search-result enhancements.
    schema.push({ '@type': 'Brand', '@id': brandId, name: brand.name, alternateName: brand.alternateName, url: `${origin}/`, slogan: brand.tagline, logo: { '@type': 'ImageObject', url: `${origin}/icons/icon-512.png?v=${brand.assetVersion}`, width: 512, height: 512 } });
    schema.push({ '@type': 'WebSite', '@id': websiteId, name: brand.name, alternateName: brand.alternateName, url: `${origin}/`, description: brand.description, inLanguage: 'en', about: { '@id': appId } });
    schema.push({ '@type': 'WebApplication', '@id': appId, name: brand.name, url: `${origin}/`, description: brand.description, applicationCategory: 'ProductivityApplication', operatingSystem: 'Web browser', browserRequirements: 'Requires JavaScript and a modern browser with IndexedDB.', image: `${origin}/social/home.png?v=${brand.assetVersion}`, featureList: ['Visual whiteboard', 'Mind maps and connected cards', 'Editable templates', 'Local device storage', 'Board snapshots and export'] });
    schema.push({ '@type': 'ImageObject', '@id': imageId, url: image, contentUrl: image, width: 1200, height: 630, caption: product ? `${product.label} with ${brand.name}` : brand.tagline });
    schema.push({ '@type': path === '/templates' ? 'CollectionPage' : product?.type || 'WebPage', '@id': `${canonical}#page`, url: canonical, name: title, description, inLanguage: 'en', isPartOf: { '@id': websiteId }, about: { '@id': appId }, primaryImageOfPage: { '@id': imageId }, ...(path === '/templates' && { mainEntity: { '@id': `${canonical}#templates` } }), ...(path === '/about' && { mainEntity: { '@id': brandId } }), ...(path !== '/' && { breadcrumb: { '@id': breadcrumbId } }) });
    if (path === '/templates') schema.push({ '@type': 'ItemList', '@id': `${canonical}#templates`, name: 'Whiteboard templates', numberOfItems: templates.length, itemListElement: templates.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, url: `${origin}${templatePath(item)}` })) });
    if (path !== '/') schema.push({ '@type': 'BreadcrumbList', '@id': breadcrumbId, itemListElement: [{ name: brand.name, url: `${origin}/` }, { name: product?.label || 'Templates', url: canonical }].map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })) });
  }
  const imageAlt = product ? `${product.social.title} — ${brand.name} ${product.label.toLowerCase()}` : path === '/templates' ? `Editable whiteboard and mind map templates from ${brand.name}` : `${brand.tagline} — ${brand.name} visual whiteboard`;
  return { path, title, description, canonical, image, imageAlt, isPublic, robots: isPublic && origin ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow, noarchive', schema: schema.length ? { '@context': 'https://schema.org', '@graph': schema } : null };
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
    { tag: 'meta', name: 'apple-mobile-web-app-title', content: brand.name },
    { tag: 'meta', name: 'theme-color', content: brand.themeColor },
    ...(canonical ? [{ tag: 'link', rel: 'canonical', href: canonical }] : []),
    ...Object.entries({ 'og:type': 'website', 'og:site_name': brand.name, 'og:locale': 'en_US', 'og:title': title, 'og:description': description, ...(canonical && { 'og:url': canonical }), ...(image && { 'og:image': image, 'og:image:secure_url': image, 'og:image:width': '1200', 'og:image:height': '630', 'og:image:type': 'image/png', 'og:image:alt': imageAlt }) }).map(([property, content]) => ({ tag: 'meta', property, content })),
    ...Object.entries({ 'twitter:card': image ? 'summary_large_image' : 'summary', 'twitter:title': title, 'twitter:description': description, ...(image && { 'twitter:image': image, 'twitter:image:alt': imageAlt }) }).map(([name, content]) => ({ tag: 'meta', name, content })),
    ...(schema ? [{ tag: 'script', type: 'application/ld+json', text: safeJson(schema) }] : []),
    ...(canonical && metadata.path === '/' ? Object.entries({ 'google-site-verification': import.meta.env?.VITE_GOOGLE_SITE_VERIFICATION, 'msvalidate.01': import.meta.env?.VITE_BING_SITE_VERIFICATION }).filter(([, value]) => value?.trim()).map(([name, content]) => ({ tag: 'meta', name, content: content.trim() })) : []),
  ];
}

export function renderHead(metadata) {
  return headTags(metadata).map(({ tag, text, ...attributes }) => `<${tag} data-seo=""${Object.entries(attributes).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join('')}>${tag === 'meta' || tag === 'link' ? '' : `${tag === 'script' ? text : escapeHtml(text)}</${tag}>`}`).join('\n');
}
