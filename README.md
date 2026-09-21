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
| `/projects/favorites` | Favorite projects |
| `/projects/trash` | Recoverable deleted projects |
| `/projects/folders/:folderName` | Projects in a URL-encoded folder |
| `/boards/:boardId` | A saved board |
| `/share#v1.gzip.…` | Import a board snapshot carried in the URL |

Workspace searches use the `q` query parameter. Board links support opening in
another tab, refresh, and browser Back/Forward. Missing pages and missing or
deleted boards have recovery screens. Pending board changes save when leaving
the board. A `/boards/:boardId` URL identifies local data. Use **Share** to copy a link
that carries the full current board, including rich text, comments, connections,
styles, saved views, and board metadata. The recipient gets an editable copy
with a new local ID; existing boards are never overwritten. Links are snapshots,
so later edits require a new link.

Share payloads are compressed and encoded in the URL fragment; no board-upload
service is required. Anyone with the link can read its contents. Broken links
show a recovery screen. Links are limited to 1,000,000 characters and 8 MiB of
uncompressed data; larger boards can be transferred with `.nova` export/import.
Some messaging services may impose smaller URL limits.

Sharing across devices requires an accessible deployment of Nova. Localhost
links work only on the sender’s device. Set `VITE_PUBLIC_APP_URL=https://your-domain`
at build time to generate links to a public deployment, or use Share on that
deployment directly.

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
```
