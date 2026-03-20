# onetimelink.me

## Overview

- Go backend lives at the repo root.
- Redis is required for message storage.
- React frontend lives in `frontend/` and uses Next.js with static export (`output: 'export'`).
- Server-rendered HTML flows in `templates/` are deprecated.

## Backend

- Entry point: `main.go`
- HTTP handlers: `handlers.go`
- Redis access: `storage.go`
- The backend listens on `127.0.0.1:8080`.
- Required env:
  - `REDISHOST=127.0.0.1:6379`
  - `REDISPASS=`

Run locally:

```bash
go run .
```

Build/test:

```bash
go build ./...
GOCACHE=/tmp/go-cache go test ./...
make build
```

- `make build` builds the frontend production bundle into `frontend/build` and the backend binary into `bin/1time`.

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
- Pages with `robots: 'noindex, nofollow'` in metadata: `/v/`.
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

## Domain And Branding

- Public domain is `https://onetimelink.me`.

## Deployment

- Frontend production build output: `frontend/build` (static HTML files per route)
- Backend production binary from `make build`: `bin/1time`
- Example nginx config: `configs/nginx/onetimelink.conf`
- nginx serves frontend statics and proxies `/api` to the Go app on `127.0.0.1:8080`.
- The nginx `try_files` directive includes `$uri/index.html` for Next.js trailing-slash static export.

## Important Behavior

- The React frontend uses the JSON API routes under `/api`.
- Each route generates its own `index.html` with full pre-rendered content and unique meta tags for SEO.
- The deprecated server-rendered `/view/...` flow is separate from the SPA `/v/` flow.
