# 1time.io

## Overview

- Go backend lives in `backend/`.
- Redis stores one-time secret metadata and counters.
- `FILE_STORAGE_DIR` stores encrypted uploaded files on disk as `*.enc` blobs.
- File shares use Redis for one-time metadata plus disk storage for the encrypted blob itself.
- Astro frontend lives in `frontend/` and builds static HTML into `frontend/build`.
- Server-rendered HTML flows in `templates/` are deprecated.

## How It Works (zero-knowledge protocol)

The server never sees plaintext or the decryption key. All crypto is client-side; the canonical implementation is `frontend/src/lib/protocol.mjs` — a shared, dependency-free module that runs in the browser **and** Node, reused by the web app, the CLI, and the Zapier app.

- **Create:** the client generates a 20-char `randomKey` (`getRandomString`). With an optional passphrase, `fullSecretKey = passphrase + randomKey`. HKDF-SHA256 (salt `onetimelink:v2`) derives (a) an AES-256-GCM key (`info=encrypt`) and (b) `hashedKey` (`info=auth`, hex) — the **only** key material ever sent to the server.
- The client AES-256-GCM-encrypts the secret/file (12-byte IV prepended) and POSTs `{ciphertext, hashedKey, duration}`. The server stores `{ciphertext, hashedKey}` under a server-generated id — never the key or plaintext.
- **Link:** `/v/#<randomKey><id>` (text) or `/f/#<randomKey><id>` (file). `randomKey` lives **only** in the URL fragment and is never sent to the server.
- **Read (one-time):** the recipient's browser re-derives `hashedKey` from the fragment and POSTs `{id, hashedKey}`; the server constant-time-verifies it, returns the ciphertext, and **deletes** the record. The browser decrypts locally. File downloads delete the record *before* streaming (delete-before-stream), so a failed download cannot be retried.
- **Status ("My Secrets"):** `POST /api/secretStatus` reports, for a batch of ids, whether each secret still exists — **without consuming it**. "Gone" means read or expired.

## Backend

- Entry point: `backend/main.go`
- HTTP handlers: `backend/handlers.go`
- Redis access: `backend/storage.go`
- File upload/download API endpoints live in `backend/handlers.go` as `/api/saveFile` and `/api/getFile`.
- `/api/secretStatus` (`apiSecretStatus` in `backend/handlers.go`) is a **non-consuming** batch existence check used by the Outbox / "My Secrets" page — it reads whether ids still exist and never deletes.
- Backend file size limit is `25 MB` via `maxFileSize` in `backend/handlers.go`.
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

## Zapier Integration

- Lives in `zap/` — a Zapier Platform CLI app (CommonJS). Public action: **Create One-Time Link** (`zap/creates/create_one_time_link.js`).
- Reuses the shared crypto: `zap/scripts/sync-protocol.mjs` generates `zap/lib/protocol.js` (CJS) from `frontend/src/lib/protocol.mjs`. **Run `npm run sync` before `zapier push`** — Zapier does not run npm scripts, and `lib/protocol.js` is gitignored (a build artifact). `pretest` auto-syncs.
- Tests use Node's built-in runner (`npm test` → `node --test`); no jest. They round-trip encrypt→link→decrypt to prove byte-compatibility with `/v/`.
- **Not end-to-end zero-knowledge:** encryption runs on Zapier's servers, so the plaintext passes through Zapier. This is disclosed in the action description. The website and CLI remain the zero-knowledge paths.

## Chrome Extension

- Lives in `extension/` — a Manifest V3 extension, loaded unpacked (not on the Web Store).
- Share flow: select text → keyboard shortcut (default `Alt+Shift+S`), the selection context-menu item, or the share button in the toolbar popup → `background.js` reads the selection via `chrome.scripting`, encrypts it with the shared protocol, POSTs `/api/saveSecret`, copies the one-time link via an **offscreen document**, then injects a **generic** status toast into the page.
- **Never put the link in the page DOM:** the clipboard write happens in `offscreen.html`/`offscreen.js` (an extension-owned context), and the injected toast only ever shows generic text. Isolated-world scripts share the page's DOM, so the secret fragment must never be rendered or inserted there.
- The created link is also saved to `chrome.storage.session` (in-memory, not disk, not synced, not readable by pages) and shown in the popup's "Last link" card (copy / clear) — the popup is extension-owned, so this is safe. Preferences use `chrome.storage.local` (never `sync`, since a self-hosted host can be sensitive).
- Zero-knowledge like the web app: encryption happens in the extension's service worker; only ciphertext and `hashedKey` leave the browser.
- Toolbar popup (`popup.html`/`popup.js`, styled with the site's design tokens) doubles as the options page: share button, target server, shortcut display. Custom origins are granted via `optional_host_permissions` at save time. `https://1time.io` is pre-granted. HTTP only for loopback.
- Shared encryption protocol: `extension/protocol.mjs` is synced from `frontend/src/lib/protocol.mjs` via `extension/scripts/sync-protocol.mjs` — same rule as CLI/Zapier: **never edit the copy**.
- Smoke test (needs a running backend): `node extension/scripts/smoke-test.mjs http://127.0.0.1:8080` round-trips encrypt → save → get → decrypt.
- The shortcut is remappable at `chrome://extensions/shortcuts`; the options page links there.

## Analytics & Ops Scripts

- `scripts/` holds operational analytics run against nginx logs / Redis — **not part of the served app**:
  - `retention.py` — sender cohort retention + conversion funnel from nginx logs.
  - `export_redis_stats_to_gsheets.py` — exports Redis counters + nginx sender/receiver stats to a Google Sheet.
  - `scripts/analytics/` — **gitignored on purpose**. Never force-add anything from this directory.
- Owner/self traffic is identified by hits to `/ss` (the private stats page); analytics exclude it.

## Frontend

- Toolchain: Astro static build
- Runtime: Astro islands with small vanilla browser modules
- Config: `frontend/astro.config.mjs` (`outDir: './build'`)
- Root layout: `frontend/src/layouts/BaseLayout.astro`
- Pages: `frontend/src/pages/**/index.astro` plus generated `robots.txt.ts` and `sitemap.xml.ts`
- Components: `frontend/src/components/*.astro`
- Browser islands: `frontend/src/islands/*.ts`
- Crypto: `frontend/src/lib/protocol.mjs` is the canonical shared client-side encryption (AES-256-GCM + HKDF-SHA256); it is the single source synced into the CLI and Zapier app. `frontend/src/lib/util.js` wraps it for the web (`createSecretLink`, API calls) and `frontend/src/lib/fileProtocol.js` handles file packing. **Do not fork the crypto — edit `protocol.mjs` and re-sync.**
- Styles: `frontend/src/styles/*.css`, inlined per route where needed

Run locally:

```bash
cd frontend
npm install
npm run dev
```

Useful commands:

```bash
cd frontend
npm run check
npm run build
```

## Frontend Notes

- The dev server runs on `127.0.0.1:3001`.
- In normal local development, the Astro dev proxy forwards relative `/api/` requests to `http://127.0.0.1:8080`.
- To use a different backend target in development, set `API_PROXY_TARGET` before `npm run dev`.
- Do not edit `frontend/build` directly; it is generated output.
- SEO metadata is rendered in Astro page/layout frontmatter and must be present in static HTML.
- Keep static content pages close to zero-JS; add browser islands only when interaction is required.
- The active create/share flow renders the generated secret link inline on the current page.
- The `/v/` route reads the secret key from the URL hash (`#key`), which is client-side only.
- File sharing UI lives on `/secure-file-sharing/` and uses `frontend/src/islands/secure-file-share.ts`.
- File download UI lives on `/f/` and uses `frontend/src/islands/view-file.ts`.
- The secure file sharing island encrypts the file in the browser, uploads with `XMLHttpRequest`, and shows upload progress.
- The file download island reads the link key from the URL hash first; generated file links are hash-based.
- Frontend file size limit is `Constants.maxFileSizeBytes = 25 * 1024 * 1024` in `frontend/src/lib/util.js`; keep it aligned with the backend limit.
- File metadata (`name`, `type`, `size`) is packed into the encrypted payload before upload; the web app server does not store that metadata separately.
- Pages with `robots: 'noindex, nofollow'` in metadata: `/v/`, `/f/`.
- Outbox / "My Secrets": the `/my-secrets/` page + `frontend/src/islands/mySecrets.ts` keep a `localStorage` list of the secrets **this browser** created and batch-check their read status via `POST /api/secretStatus` (non-consuming). Linked from the success screen (`components/LinkReadyTemplate.astro`) and the footer. localStorage is per-browser — no cross-device, no account.
- Frontend validation is `npm run check`; there is no React/Vitest suite after the Astro migration.

## Frontend CSS Performance

- Treat every `<link rel="stylesheet">` in `frontend/build/**/index.html` as render-blocking unless proven otherwise.
- Keep `frontend/src/styles/globals.css` limited to truly shared base styles only: app chrome, typography tokens, buttons, form primitives, and other classes needed on first paint across most routes.
- Do not import route-specific CSS into `BaseLayout.astro`.
- If a stylesheet is specific to one route family and required for first paint, inline it from that route/page via `frontend/src/components/InlineCss.astro` instead of promoting it to the root layout.
- If UI only appears after user interaction (success states, generated-link panels, drawers, modals, secondary tools), lazy-load the component so its JS and CSS stay out of the initial render path.
- Do not statically import post-interaction components from large entry components when the initial screen can render without them.
- Before merging frontend UI changes, run `cd frontend && npm run build` and inspect the generated HTML for the affected route to confirm it is not pulling unrelated CSS chunks.
- A route should not ship CSS for unrelated pages such as blog, stats, view, about, or post-submit states during initial render.

## Frontend JS Performance

- Lighthouse performance is a hard constraint, not a nice-to-have. Treat regressions as bugs unless there is a clear product reason.
- Static content routes such as `/blog/**` and other read-mostly pages should stay as close to zero-JS as practical. Do not add client components to content pages unless the interaction is essential.
- Treat every `<script src>` in `frontend/build/**/index.html` as suspect on content routes. Verify whether each chunk is required for user-visible behavior on that route.
- Do not pull generator, share-flow, stats, view-secret, or other app-tooling bundles into blog or marketing pages.
- Avoid putting browser islands in `BaseLayout.astro` when plain markup or a tiny standalone script would work. Shared islands in the root layout force JS across the whole site.
- For static pages, prefer plain links and server-rendered navigation patterns when they materially reduce app-router hydration cost.
- If a page is primarily article or marketing content, optimize for first-load HTML and CSS first, and only then add JavaScript that is strictly necessary.
- After frontend performance changes, build with `cd frontend && npm run build` and inspect the affected HTML for both CSS and JS:
  - confirm there are no unrelated route chunks
  - confirm route-specific assets stay route-specific
  - confirm content pages are not loading interactive app bundles
- Astro fingerprints built assets under `/_astro/`; deployment config should cache that path aggressively.
- If you self-host fonts or other root-level static assets outside `/_astro/`, make sure deployment config adds explicit cache headers for them.

## Domain And Branding

- Public domain is `https://1time.io`.

## Deployment

- Frontend production build output: `frontend/build` (static HTML files per route)
- Backend production binary from `make build`: `bin/1time-api`
- Example nginx config: `configs/nginx/1time.conf`
- nginx serves frontend statics and proxies `/api` to the Go app on `127.0.0.1:8080`.
- nginx upload ceiling is `26m` in both `configs/nginx/1time.conf` and `docker/nginx/default.conf.template` to stay above the backend's `25 MB` multipart limit.
- Host nginx has an exact `/f/` location with the same sensitive-header treatment as `/v/`.
- The nginx `try_files` directive includes `$uri/index.html` for static trailing-slash routes.

## Important Behavior

- The Astro frontend uses the JSON API routes under `/api`.
- Each route generates its own `index.html` with full pre-rendered content and unique meta tags for SEO.
- The deprecated server-rendered `/view/...` flow is separate from the SPA `/v/` flow.
- File links are one-time and currently use the SPA `/f/` flow.
- File downloads are consumed on the first authorized fetch attempt: the Redis file record is deleted before transfer completion is known, and the disk blob is removed after the stream attempt.
