# 1time.io

## Overview

- Go backend lives in `backend/`.
- Redis stores one-time secret metadata and counters.
- `FILE_STORAGE_DIR` stores encrypted uploaded files on disk as `*.enc` blobs.
- File shares use Redis for one-time metadata plus disk storage for the encrypted blob itself.
- React frontend lives in `frontend/` and uses Next.js with static export (`output: 'export'`).
- Server-rendered HTML flows in `templates/` are deprecated.

## Backend

- Entry point: `backend/main.go`
- HTTP handlers: `backend/handlers.go`
- Redis access: `backend/storage.go`
- File upload/download API endpoints live in `backend/handlers.go` as `/api/saveFile` and `/api/getFile`.
- Backend file size limit is `10 MB` via `maxFileSize` in `backend/handlers.go`.
- Uploaded encrypted files are written to `FILE_STORAGE_DIR/<id>.enc` and the Redis record stores the path plus hashed key.
- `backend/storage.go` runs a file janitor every 2 hours and deletes expired `*.enc` files based on file mtime.
- Stored file counters use Redis keys `stats:stored:file:total` and `stats:stored:file:day:YYYYMMDD`.
- The backend listens on `127.0.0.1:8080`.
- Required env:
  - `FILE_STORAGE_DIR=/absolute/path/to/encrypted-files`
  - `REDISHOST=127.0.0.1:6379`
  - `REDISPASS=`
- Optional env:
  - `LISTEN_ADDR=127.0.0.1:8080`

Run locally:

```bash
go run ./backend
```

Build/test:

```bash
go build ./backend
GOCACHE=/tmp/go-cache go test ./backend/...
make build
```

- `make build` builds the frontend production bundle into `frontend/build` and the backend binary into `bin/1time-api`.

## CLI

- First-party CLI lives in `cli/` and publishes as `@1time/cli`.
- Runtime: Node.js 20+.
- Entry point: `cli/index.mjs`
- Command implementation: `cli/lib.mjs`
- Shared encryption protocol: `cli/protocol.mjs`
- The CLI syncs shared protocol code via `cli/scripts/sync-protocol.mjs` before `npm test`, `npm pack`, and `npm publish`.
- Supported commands: `1time send`, `1time read`, `1time send-file`, `1time read-file`, `--host`, `-h` / `--help`
- `1time send` input precedence is: piped `stdin`, `1TIME_SECRET`, then positional secret argument.
- Prefer `stdin` for `send`; positional secrets leak through shell history and process listings.
- `read` and `read-file` currently accept the full secret link as a positional argument only, which also exposes decryption material in shell history and process listings.
- `send-file` and `read-file` support optional passphrases via `--passphrase` or `1TIME_PASSPHRASE`.
- File links use the `/f/#<randomKey><id>` format.
- `read-file --out <path>` refuses to start if the target path already exists.
- `read-file` without `--out` writes into the current directory using the original filename and auto-suffixes collisions like `report (1).txt`.
- Default host is `1time.io`; bare hosts normalize to `https://...`; plain `http://` is only allowed for loopback addresses such as `127.0.0.1`.

Run locally:

```bash
node cli/index.mjs --help
printf 'hello' | node cli/index.mjs send
node cli/index.mjs read 'https://1time.io/v/#...'
```

Build/test:

```bash
cd cli
npm test
npm pack --dry-run
```

## Frontend

- Toolchain: Next.js 15 with static export
- Runtime: React 19
- Config: `frontend/next.config.js` (output: 'export', distDir: 'build', trailingSlash: true)
- Root layout: `frontend/app/layout.jsx`
- Pages: `frontend/app/*/page.jsx` (file-based routing)
- Client components: `frontend/components/*.jsx` (marked with 'use client')
- Utils: `frontend/utils/util.js` (encryption), `frontend/utils/wordlist.js`
- Styles: `frontend/app/globals.css` (base), `frontend/styles/*.css` (per-component)

Run locally:

```bash
cd frontend
npm install
npm run dev
```

Useful commands:

```bash
cd frontend
npm test
npm run build
```

## Frontend Notes

- The dev server runs on `127.0.0.1:3001`.
- In normal local development, leave `NEXT_PUBLIC_API_URL` unset so the frontend uses relative `/api/` requests and Next.js proxies them to `http://127.0.0.1:8080`.
- To use a different backend target in development, set `API_PROXY_TARGET` before `npm run dev`.
- Do not edit `frontend/build` directly; it is generated output.
- SEO metadata is defined via `export const metadata` in each page.jsx file, NOT via useEffect. This is critical for Google indexing.
- Each page.jsx is a server component that exports metadata and renders a client component from `components/`.
- The `'use client'` directive is required on all interactive components (forms, buttons, state).
- The active create/share flow renders the generated secret link inline on the current page.
- The `/v/` route reads the secret key from the URL hash (`#key`), which is client-side only.
- File sharing UI lives on `/secure-file-sharing/` and renders `frontend/components/SecureFileShare.jsx`.
- File download UI lives on `/f/` and renders `frontend/components/ViewSecretFile.jsx`.
- `SecureFileShare` encrypts the file in the browser, uploads with `XMLHttpRequest`, and shows upload progress.
- `ViewSecretFile` reads the link key from the URL hash first; the component also contains a fallback parser for `/f/<key>` style paths, but generated file links are hash-based.
- Frontend file size limit is `Constants.maxFileSizeBytes = 10 * 1024 * 1024` in `frontend/utils/util.js`; keep it aligned with the backend limit.
- File metadata (`name`, `type`, `size`) is packed into the encrypted payload before upload; the web app server does not store that metadata separately.
- Pages with `robots: 'noindex, nofollow'` in metadata: `/v/`, `/f/`.
- Tests live in `frontend/src/App.test.jsx` and use vitest + React Testing Library.
- The vitest config (`frontend/vitest.config.js`) uses esbuild with `jsx: 'automatic'` to handle JSX in components.

## Frontend CSS Performance

- Treat every `<link rel="stylesheet">` in `frontend/build/**/index.html` as render-blocking unless proven otherwise.
- Keep `frontend/app/layout.jsx` limited to truly shared base styles only: app chrome, typography tokens, buttons, form primitives, and other classes needed on first paint across most routes.
- Do not import route-specific CSS into `frontend/app/layout.jsx`.
- If a stylesheet is specific to one route family and required for first paint, emit it from that route's server `page.jsx` or `layout.jsx`, preferably via `frontend/components/InlineCss.jsx`, instead of promoting it to the root layout.
- If UI only appears after user interaction (success states, generated-link panels, drawers, modals, secondary tools), lazy-load the component so its JS and CSS stay out of the initial render path.
- Do not statically import post-interaction components from large entry components when the initial screen can render without them.
- Before merging frontend UI changes, run `cd frontend && npm run build` and inspect the generated HTML for the affected route to confirm it is not pulling unrelated CSS chunks.
- A route should not ship CSS for unrelated pages such as blog, stats, view, about, or post-submit states during initial render.

## Frontend JS Performance

- Lighthouse performance is a hard constraint, not a nice-to-have. Treat regressions as bugs unless there is a clear product reason.
- Static content routes such as `/blog/**` and other read-mostly pages should stay as close to zero-JS as practical. Do not add client components to content pages unless the interaction is essential.
- Treat every `<script src>` in `frontend/build/**/index.html` as suspect on content routes. Verify whether each chunk is required for user-visible behavior on that route.
- Do not pull generator, share-flow, stats, view-secret, or other app-tooling bundles into blog or marketing pages.
- Avoid putting client components in `frontend/app/layout.jsx` when a server component, plain markup, or a tiny standalone script would work. Shared client components in the root layout force hydration across the whole site.
- For static pages, prefer plain links and server-rendered navigation patterns when they materially reduce app-router hydration cost.
- If a page is primarily article or marketing content, optimize for first-load HTML and CSS first, and only then add JavaScript that is strictly necessary.
- After frontend performance changes, build with `cd frontend && npm run build` and inspect the affected HTML for both CSS and JS:
  - confirm there are no unrelated route chunks
  - confirm route-specific assets stay route-specific
  - confirm content pages are not loading interactive app bundles
- If you self-host fonts or other root-level static assets outside `/_next/static/`, make sure deployment config adds explicit cache headers for them.

## Domain And Branding

- Public domain is `https://1time.io`.

## Deployment

- Frontend production build output: `frontend/build` (static HTML files per route)
- Backend production binary from `make build`: `bin/1time-api`
- Example nginx config: `configs/nginx/1time.conf`
- nginx serves frontend statics and proxies `/api` to the Go app on `127.0.0.1:8080`.
- nginx upload ceiling is `11m` in both `configs/nginx/1time.conf` and `docker/nginx/default.conf.template` to stay above the backend's `10 MB` multipart limit.
- Host nginx has an exact `/f/` location with the same sensitive-header treatment as `/v/`.
- The nginx `try_files` directive includes `$uri/index.html` for Next.js trailing-slash static export.

## Important Behavior

- The React frontend uses the JSON API routes under `/api`.
- Each route generates its own `index.html` with full pre-rendered content and unique meta tags for SEO.
- The deprecated server-rendered `/view/...` flow is separate from the SPA `/v/` flow.
- File links are one-time and currently use the SPA `/f/` flow.
- File downloads are consumed on the first authorized fetch attempt: the Redis file record is deleted before transfer completion is known, and the disk blob is removed after the stream attempt.
