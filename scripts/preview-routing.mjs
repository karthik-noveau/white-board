import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publicPaths, isWorkspacePath } from '../src/lib/seo.js';

// Preview the same status codes and HTML shells emitted for static hosting.
export function previewRouting() {
  return { name: 'public-page-routing', configurePreviewServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!['GET', 'HEAD'].includes(request.method)) return next();
      const url = new URL(request.url, 'http://localhost');
      let path;
      try { path = decodeURIComponent(url.pathname); } catch { response.writeHead(400).end(); return; }
      const clean = path === '/' ? '/' : path.replace(/\/$/, '');
      const canonical = path === '/index.html' ? '/' : path.endsWith('/index.html') && publicPaths.includes(path.slice(0, -11)) ? path.slice(0, -11) : (path !== clean || url.pathname !== path) && publicPaths.includes(clean) ? clean : path.startsWith('/templates/') ? '/templates' : null;
      if (canonical) { response.writeHead(301, { Location: canonical + url.search }).end(); return; }
      const publicPage = publicPaths.includes(clean);
      const privatePage = isWorkspacePath(path) || path === '/app.html';
      if (!publicPage && !privatePage && path !== '/404.html') {
        const candidate = resolve(server.config.root, server.config.build.outDir, `.${path}`);
        const root = resolve(server.config.root, server.config.build.outDir);
        if (candidate.startsWith(`${root}/`) && (await stat(candidate).catch(() => null))?.isFile()) return next();
      }
      const file = publicPage ? `${clean === '/' ? '' : clean}/index.html` : privatePage ? '/app.html' : '/404.html';
      try {
        const html = await readFile(resolve(server.config.root, server.config.build.outDir, `.${file}`));
        const noindex = !publicPage || /name="robots" content="noindex/.test(html.toString());
        response.writeHead(publicPage || privatePage ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ...(noindex && { 'X-Robots-Tag': 'noindex, nofollow, noarchive' }) });
        response.end(request.method === 'HEAD' ? undefined : html);
      } catch (error) { next(error); }
    });
  } };
}
