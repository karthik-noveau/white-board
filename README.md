# DrawAnything whiteboard

A local-first visual workspace built with React and Vite. Boards and recovery
versions are stored in IndexedDB in the current browser.

## Development

Use Node 20 or later, then run `npm install` and `npm run dev`.
Run `npm run lint` and `npm run build` before shipping changes.
Run `npm test` for the regression suite and `npm run test:seo` after building to
verify the generated HTML, metadata, sitemap, icons, and social previews.

## Routes

Navigation uses React Router and the browser History API.

| URL | Page |
| --- | --- |
| `/` | Landing page |
| `/projects` | All projects |
| `/templates` | Searchable, categorized template library |
| `/templates/:templateId` | Public template preview and practical guide |
| `/projects/favorites` | Favorite projects |
| `/projects/trash` | Recoverable deleted projects |
| `/projects/folders/:folderName` | Projects in a URL-encoded folder |
| `/boards/:boardId` | A saved board |
| `/share#v2.gzip.…` | Open a read-only snapshot or import an editable copy |

Workspace searches use the `q` query parameter. Board links support opening in
another tab, refresh, and browser Back/Forward. Missing pages and missing or
deleted boards have recovery screens. Pending board changes save when leaving
the board. A `/boards/:boardId` URL identifies local data. Use **Share** to copy a link
that carries the full current board, including rich text, comments, connections,
styles, saved views, and board metadata. Choose **Read-only** to open a viewer
with pan, zoom, branch expansion, and comment browsing; it does not import or
save a board. Choose **Editable** to give the recipient a separate local copy
with a new ID; existing boards are never overwritten. Edits are not synchronized.
Links are snapshots, so later edits require a new link. Existing v1 links still
open editable copies. New v2 links include a validated access mode and are
rejected by older clients that cannot honor it.

Read-only is an application viewing mode, not server-enforced authorization:
snapshot data is included in the link, and there is no account-based access
control or link revocation.

Share payloads are compressed and encoded in the URL fragment; no board-upload
service is required. Anyone with the link can read its contents. Broken links
show a recovery screen. Links are limited to 1,000,000 characters and 8 MiB of
uncompressed data; larger boards can be transferred with `.drawanything` export/import.
Some messaging services may impose smaller URL limits.

Sharing across devices requires an accessible deployment of DrawAnything. Localhost
links work only on the sender’s device. Set `VITE_PUBLIC_APP_URL=https://your-domain`
at build time to generate links to a public deployment, or use Share on that
deployment directly.

## Templates

The library includes 24 editable templates in six categories: Planning,
Product & research, Teamwork, Strategy & ideas, Content & marketing, and
Learning & life. Search matches names, descriptions, categories, and keywords.
Preview a board and its three-step guide before choosing **Use template**.
Every new board is a separate copy of the template.

Template content, category metadata, featured picks, and layout helpers live in
`src/data/templates.js`. Run `node --test scripts/templates.test.mjs` to check
catalog integrity, filtering, connected graphs, and overlapping cards.

## Branding and search

`src/lib/brand.js` is the source of truth for the product name, description,
tagline, icon shape, asset revision, and install colors. `BrandMark` uses the same mark throughout
the site, workspace, editor, and shared viewer. Builds generate PNG install icons,
an Apple touch icon, a web manifest, and 1200 × 630 social images for every public
page. Social cards use system Arial when available; install Arial on a Linux
build host for consistent typography. New downloads use `.drawanything` and `.drawanything-workspace` extensions.
Older `.nova` and `.nova-workspace` files still import. Storage identifiers,
clipboard formats, and serialized backup/share formats stay unchanged, so
existing boards, history, and shared links remain usable.
Run `npm run brand:assets` after editing the identity to refresh development
favicons and the install manifest; production builds regenerate all assets.
Versioned icon and social-image URLs help refresh previews after a rebrand.
Increase `brand.assetVersion` when changing the public logo.

The build renders the homepage, template library, and all 24 template guides to
HTML. They have unique descriptions, canonical URLs, Open Graph/Twitter previews,
and JSON-LD for the website, web application, collection, and breadcrumbs. Visible
template links work without JavaScript. Interactive editing still requires it.
Metadata contains only public catalog content, never local board data. Workspace,
board, share, and missing-page responses have `noindex` in their initial HTML.

Set `VITE_PUBLIC_APP_URL` to the **real production HTTPS origin** before deploying,
for example in the hosting provider's build environment. Use the origin only,
without a subdirectory, query, or fragment. This also controls public share URLs.

```sh
npm run build:production
npm run test:seo
```

`build:production` fails if the origin is missing or invalid. An ordinary
`npm run build` without an origin creates an unindexed preview: it omits canonical
URLs and structured data and emits a blocking robots file and empty sitemap.
No placeholder domain is shipped. Keep the variable unset for preview deployments;
do not copy a production indexing configuration to an unrelated preview hostname.

After deployment, verify `/robots.txt`, `/sitemap.xml`, and an individual template
page at the real origin. Add that property to Google Search Console, submit the
sitemap, and inspect those URLs. Search Console verification and indexing require
access to the deployed domain; metadata alone does not guarantee rankings or
specific search-result features.

## Hosting

Serve `dist` at the domain root. Public pages are static HTML; private application
routes use `app.html`. Unknown URLs must return `404.html` with HTTP **404**, not
the homepage with HTTP 200. `npm run preview` includes these routing rules.
The build emits Netlify-compatible `_redirects` and `_headers` files. On another
host, configure the equivalent routes. For nginx:

```nginx
location ~ ^/(projects|boards)(/|$) {
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    try_files /app.html =404;
}
location = /share {
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    try_files /app.html =404;
}
location = /sw.js {
    add_header Cache-Control "no-cache";
}
location / {
    try_files $uri $uri/index.html =404;
}
error_page 404 /404.html;
```

The sitemap uses extension-free paths without trailing slashes; redirect duplicate
`/index.html` and trailing-slash URLs to those paths on your host. Do not configure
a global SPA fallback to `/index.html`, which gives private and missing URLs the
homepage's indexable metadata. Serve hashed `/assets/` files with long-lived,
immutable caching and revalidate HTML and `sw.js` on each visit.

Keep the same origin when accessing existing boards: changing the hostname or
port opens a separate browser storage workspace. The production service worker
supports offline navigation after its initial installation completes. Public
pages cache separately; private views use a neutral application shell. Updates
wait for older tabs to close before retiring their assets. No board contents are
stored in the service-worker cache.

## Browser regression checks

The scripts in `scripts/` use Chrome's remote debugging protocol and Python's
`websocket-client` package. Run them against a dedicated Chrome test profile and
a separate local origin so test projects stay out of your workspace:

```sh
DRAWANYTHING_QA_PORT=9232 DRAWANYTHING_QA_URL=http://127.0.0.1:5185/ python3 scripts/qa_routing.py
DRAWANYTHING_QA_PORT=9232 DRAWANYTHING_QA_URL=http://127.0.0.1:5185/ python3 scripts/qa_richtext.py
DRAWANYTHING_QA_PORT=9232 DRAWANYTHING_QA_URL=http://localhost:5185/ python3 scripts/qa_exhaustive.py
DRAWANYTHING_QA_PORT=9232 DRAWANYTHING_QA_URL=http://localhost:5185/ python3 scripts/qa_share_access.py
DRAWANYTHING_QA_PORT=9232 DRAWANYTHING_QA_URL=http://localhost:5185/ python3 scripts/qa_templates.py
```
