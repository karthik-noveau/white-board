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
| `/mind-map-maker` | Mind mapping workflow, examples, and starter templates |
| `/online-whiteboard` | Whiteboarding workflow, storage, and sharing guidance |
| `/visual-planning` | Visual project planning workflow and starter templates |
| `/projects` | All projects |
| `/templates` | Searchable, categorized template library |
| `/projects/templates` | Template library inside the workspace |
| `/projects/restore#workspace.v1.…` | Preview and import a complete workspace backup URL |
| `/templates/:templateId`, `/projects/templates/:templateId` | Legacy links redirect to the corresponding library |
| `/projects/favorites` | Favorite projects |
| `/projects/trash` | Recoverable deleted projects |
| `/projects/folders/:folderName` | Projects in a URL-encoded folder |
| `/boards/:boardId` | A saved board |
| `/share#v2.gzip.…` | Open a read-only snapshot or import an editable copy |

Workspace searches use the `q` query parameter. Board links support opening in
another tab, refresh, and browser Back/Forward. Missing pages and missing or
deleted boards have recovery screens. Pending board changes save when leaving
the board. A `/boards/:boardId` URL identifies local data. Use **Share** to copy a link
that carries the current board, including rich text, comments, connections,
styles, and board metadata. Private presenter notes are excluded from every new
link. Hidden cards and frames, and saved views containing older snapshots, are
excluded by default; explicitly enable either option in Share to include them.
Collapsed branches remain expandable. Choose **Read-only** to open a viewer
with pan, zoom, branch expansion, and comment browsing; it does not import or
save a board. Choose **Editable** to give the recipient a separate local copy
with a new ID; existing boards are never overwritten. Edits are not synchronized.
Links are snapshots, so later edits require a new link. Existing v1 links still
open editable copies. New v2 links include a validated access mode and are
rejected by older clients that cannot honor it.

Read-only is an application viewing mode, not server-enforced authorization:
snapshot data is included in the link, and there is no account-based access
control or link revocation.

Existing links keep the content encoded when they were created. Create a new
link to apply the current sharing choices; older links cannot be revoked.

Folders live in the main Projects area. Create empty folders, open them to see
their projects, or use the folder menu to rename or remove them. Project menus
and the bulk Move action offer existing folders and accept a new folder name.
Removing a folder keeps its projects; renames and removals also update projects
in Trash. Folder names and empty folders persist in device storage and travel
with both file and URL workspace backups.

Workspace backups wait for this tab's pending saves, read projects, history and
the shape library together from device storage, and validate the result before
downloading it. Changes made in other tabs are included. Imports reject invalid
timestamps before writing any projects; older stored records with bad timestamps
remain accessible with a fallback date label.

The header offers **Import → Import file / Import from URL** and **Back up →
Download file / Create backup URL**. Workspace URLs contain a complete snapshot,
including Trash, version history, folders, favorites, saved shapes, hidden content,
and private notes. Opening or pasting a URL only previews it; **Import workspace**
adds copies with new project identities and keeps existing projects and shapes.
These links are compressed locally, require no upload service, and are limited to
100,000 characters and 8 MiB of uncompressed data. Oversized snapshots retain a
**Download file** fallback. Anyone who has the URL can restore its contents.

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

The library includes 10 editable templates in five categories: Planning,
Product & research, Teamwork, Strategy & ideas, and
Learning & life. Search matches names, descriptions, categories, and keywords.
Cards open a zoomable preview popup. Choose **Use template** from the card or
the popup to create a board, without visiting a separate detail page.
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
The shared header and footer use the same wordmark, purple mark, and
“Your ideas, connected.” positioning. Install assets include a maskable icon
with an inset mark, a 48-pixel search favicon, and a multi-size `favicon.ico`.
Run `npm run brand:assets` after editing the identity to refresh development
favicons and the install manifest; production builds regenerate all assets.
Versioned icon and social-image URLs help refresh previews after a rebrand.
Increase `brand.assetVersion` when changing the public logo.

The build renders seven public pages: the homepage, template library, guides
for mind maps, online whiteboarding, and visual planning, plus About and Help.
Each product guide includes a
concrete example, an actionable workflow, relevant template links, and visible
answers about product capabilities. Copy lives in `src/data/productPages.js`;
that registry also drives routes, metadata, social previews, and navigation.
The pages have unique titles, descriptions, canonical URLs, Open Graph/Twitter
previews, and connected JSON-LD entities for the brand, website, web application,
page, social image, collection, and breadcrumbs. All public content and links are
available without JavaScript; previewing and editing boards require it.
FAQs are ordinary visible content; the site does not claim FAQ rich-result
eligibility or publish invented reviews, ratings, or company details.
`src/data/resourcePages.js` holds the About and Help content. The About page
explains the product and offers downloadable SVG wordmark/mark and PNG icon
assets. Help documents the actual save, backup, share, export, and offline flows.
Both pages have static section links, breadcrumbs, dedicated social cards,
and public metadata; the About page uses an `AboutPage` entity tied to the brand.
Brand downloads are generated with the other assets by `brand:assets` and builds.
The homepage uses responsive 720/1280/1774-pixel WebP images (10–78 KB), with
the original JPEG as fallback, explicit dimensions, and high fetch priority.
Retired template detail URLs redirect to the library and are excluded from the sitemap.
Metadata contains only public catalog content, never local board data. Workspace,
board, share, and missing-page responses have `noindex` in their initial HTML.

On Netlify, production builds automatically use the site's main `URL` as the
public origin. Set `VITE_PUBLIC_APP_URL` in the build environment to override it,
or when deploying to another provider. Use the **real production HTTPS origin**
only, without a subdirectory, query, or fragment. The resolved origin is used
for both page metadata and public share URLs.

```sh
npm run build:production
npm run test:seo
```

`build:production` fails if neither a configured origin nor a valid Netlify
production URL is available. Invalid origins also fail validation. An ordinary
`npm run build` without an origin creates an unindexed preview: it omits canonical
URLs and structured data and emits a blocking robots file and empty sitemap.
No placeholder domain is shipped. Netlify deploy previews and branch deploys
always build without a public origin, even if they inherit the production
variable. Vercel preview, development, and custom non-production environments
also suppress the inherited production origin. On other hosts, set
`DEPLOYMENT_ENV=preview` in the build environment, or leave the public URL unset.
`DEPLOYMENT_ENV` accepts only `production` or `preview`; a provider's detected
preview state always takes precedence. Vercel still needs an explicitly configured
production origin and equivalent hosting routes; preview detection does not
configure that provider's routing.
Copy `.env.example` to `.env.local` to configure local builds. Optional
`VITE_GOOGLE_SITE_VERIFICATION` and `VITE_BING_SITE_VERIFICATION` accept the public
verification tokens issued by those services. Only the indexed homepage emits
them. Tokens are public HTML metadata, not account credentials; adding one does
not submit a sitemap or request indexing.

`npm run test:seo` verifies all seven generated pages, unique metadata, JSON-LD
references, linked template anchors, reachability from the homepage, social image
dimensions, downloadable brand files, responsive image files, favicon sizes,
sitemap membership, robots rules, and private shells.
Unit tests additionally cover preview isolation, private routes, escaping, and
service-worker navigation. Deployment previews receive an HTTP `noindex` header;
private routes also carry it at their original paths, alongside HTML metadata.
Hosting regression tests check permanent redirects, query preservation, encoded
public aliases, private shells, missing paths, and preview HTTP indexing headers.

Run the read-only HTTP audit against the actual deployment after publishing:

```sh
npm run audit:seo -- https://your-production-domain
```

It checks all public HTML, metadata, structured data, section links, brand
downloads, sitemap and robots, private/404 pages, permanent redirects, and social
image dimensions. It prints a JSON report and exits nonzero on failure. For a
preview, append `--preview`. To test a local production fixture, set
`SEO_EXPECTED_ORIGIN` to the fixture's canonical origin and pass the localhost
preview URL. The audit never submits a sitemap or accesses saved board data.

After deployment, verify `/robots.txt`, `/sitemap.xml`, and every public route
at the real origin. Add that property to Google Search Console, submit the
sitemap, and inspect those URLs. Search Console verification and indexing require
access to the deployed domain; metadata alone does not guarantee rankings or
specific search-result features. The implementation follows
[Google's JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
and [guidance for generative AI search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide):
useful visible content, crawlable links, and consistent indexing signals are the
foundation. A special AI text file is not required for Google Search visibility.

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
