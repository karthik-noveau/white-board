# Nova whiteboard

A local-first visual workspace built with React and Vite. Boards and recovery
versions are stored in IndexedDB in the current browser.

## Development

Use Node 20 or later, then run `npm install` and `npm run dev`.
Run `npm run lint` and `npm run build` before shipping changes.

## Routes

Navigation uses React Router and the browser History API.

| URL | Page |
| --- | --- |
| `/` | Landing page |
| `/projects` | All projects |
| `/projects?templates=1` | Searchable, categorized template library |
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
uncompressed data; larger boards can be transferred with `.nova` export/import.
Some messaging services may impose smaller URL limits.

Sharing across devices requires an accessible deployment of Nova. Localhost
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

## Hosting

Build with `npm run build` and serve `dist`. The web server must rewrite application
routes (such as `/boards/product-vision`) to `/index.html` while serving real static
files normally. For nginx, use `try_files $uri $uri/ /index.html;` in the app's
`location /` block. Vite's development server and `npm run preview` already provide
this fallback. The app is configured for hosting at the domain root.

Keep the same origin when accessing existing boards: changing the hostname or
port opens a separate browser storage workspace. The production service worker
supports offline navigation after the application has been loaded online.

## Browser regression checks

The scripts in `scripts/` use Chrome's remote debugging protocol and Python's
`websocket-client` package. Run them against a dedicated Chrome test profile and
a separate local origin so test projects stay out of your workspace:

```sh
NOVA_QA_PORT=9232 NOVA_QA_URL=http://127.0.0.1:5185/ python3 scripts/qa_routing.py
NOVA_QA_PORT=9232 NOVA_QA_URL=http://127.0.0.1:5185/ python3 scripts/qa_richtext.py
NOVA_QA_PORT=9232 NOVA_QA_URL=http://localhost:5185/ python3 scripts/qa_exhaustive.py
NOVA_QA_PORT=9232 NOVA_QA_URL=http://localhost:5185/ python3 scripts/qa_share_access.py
NOVA_QA_PORT=9232 NOVA_QA_URL=http://localhost:5185/ python3 scripts/qa_templates.py
```
