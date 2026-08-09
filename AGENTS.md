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
- **Read (one-time by default):** the recipient's browser re-derives `hashedKey` from the fragment and POSTs `{id, hashedKey}`; the server constant-time-verifies it and reserves one allowed read/download. The browser decrypts locally. Text ciphertext remains in Redis while views remain. File metadata remains in Redis and the encrypted disk blob remains on disk while downloads remain.
- **View/download counters:** `saveSecret` accepts an optional `views` field — `1` (default, burn after reading) or `2..10`. File uploads accept multipart `views` with the same `1..10` range and a one-download default. Both paths use Redis `WATCH` transactions with bounded exponential-backoff retries and preserve TTL via `PTTL`. Text reads return `viewsLeft` and `expiresIn` in JSON. File downloads return them in `X-1Time-Views-Left` and `X-1Time-Expires-In` headers alongside the binary body. A file reservation opens the encrypted blob before committing its counter mutation, so the final concurrent downloader cannot unlink the path before earlier authorized downloaders hold descriptors. The final reservation deletes Redis metadata before streaming and removes the disk blob after the stream attempt. Legacy records without counters remain single-use.
- **Retrying a read is dangerous — `/api/get` is destructive.** On persistent `WATCH` contention the server answers HTTP `503` with body `{"status":"retry"}`, which is the *only* proof a read was rejected **before** consuming a view. A client may replay the request solely on that explicit body (`isRetryableRead` in `frontend/src/islands/view-secret.ts`); a bare `503` from a proxy/CDN gives no such guarantee and replaying it can burn a second view. `postJson` attaches both `status` and the parsed `body` to the thrown error so callers can tell the two apart.
- **Status ("My Secrets"):** `POST /api/secretStatus` reports, for a batch of ids, whether each secret still exists — **without consuming it**. "Gone" means read or expired.

## Backend

- Entry point: `backend/main.go`
- HTTP handlers: `backend/handlers.go`
- Redis access: `backend/storage.go`
- File upload/download API endpoints live in `backend/handlers.go` as `/api/saveFile` and `/api/getFile`.
- `/api/secretStatus` (`apiSecretStatus` in `backend/handlers.go`) is a **non-consuming** batch existence check used by the Outbox / "My Secrets" page — it reads whether ids still exist and never deletes.
- Backend file size limit is `80 MB` via `maxFileSize` in `backend/handlers.go`.
- Every JSON endpoint caps its request body with `http.MaxBytesReader`: `maxSaveSecretBodyBytes` (25 MB — base64url adds ~4/3 over AES-GCM, so roughly 18 MB of plaintext), `maxStatusBodyBytes` (8 KB), and `maxLookupBodyBytes` (1 KB for `/api/get`, `/api/getFile`, `/api/stat`). `maxSaveSecretBodyBytes` is deliberately **decoupled** from `maxFileSize`: text secrets gain nothing from a larger cap, so it stays at 25 MB while the file limit is 80 MB. Keep `maxSaveSecretBodyBytes` under nginx's `client_max_body_size` (`81m`). There is **no client-side length guard**, so oversized text fails with a generic error.
- `/api/get` and `/api/getFile` validate the id and hashed-key **shapes** (`isValidStorageID`, `isValidHashedKey`) before any Redis key is built. Malformed input is answered with the same statuses the storage layer would return (`no message` / `wrong key`), deliberately introducing no new response shape — see the exporter coupling under "Analytics & Ops Scripts".
- Stored text/file counters and their respective view/download distributions are each written together — see "View-counter stats" below.
- Uploaded encrypted files are written to `FILE_STORAGE_DIR/<id>.enc` and the Redis record stores the path plus hashed key.
- `backend/storage.go` runs a file janitor every 2 hours and deletes expired `*.enc` files based on file mtime.
- Stored file counters use Redis keys `stats:stored:file:total` and `stats:stored:file:day:YYYYMMDD`.
- **View-counter stats:** text uses `stats:views:total:<views>` and `stats:views:day:YYYYMMDD:<views>`; files use `stats:views:file:total:<downloads>` and `stats:views:file:day:YYYYMMDD:<downloads>`. Lifetime keys do not expire; daily keys use `statsHistoryTTL` (60 days). Bucket `1` is recorded for both. Each distribution is written in the same `TxPipelined` as its stored-item counters so the denominator stays exactly aligned with the buckets.
- Stats are recorded by `saveToStorage` **after** a confirmed `SetNX`, and are **best-effort**: a counter failure is logged and must never fail a stored secret or inflate totals with saves that never landed.
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
- `send` and `send-file` accept `--views <N>` (default `1`, max `10`, matching the backend caps); `read` and `read-file` print the remaining views/downloads on `stderr` so `stdout` stays pipeable.
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

- Lives in `extension/` — a Manifest V3 extension published on the Chrome Web Store. The canonical listing URL lives in `frontend/src/lib/siteConfig.js`; use that shared value for website CTAs instead of duplicating the URL.
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
  - `export_redis_stats_to_gsheets.py` — exports Redis counters + nginx sender/receiver stats to a Google Sheet. The combined `views_total` tab shows text-secret and file counts/share percentages side by side by bucket; `views_daily` and `file_views_daily` remain separate. Buckets are sorted **numerically**, so `10` follows `5` rather than `1`.
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
- The secure file sharing island encrypts the file in the browser, uploads with `XMLHttpRequest`, shows upload progress, and allows `1 / 2 / 3 / 5 / 10` downloads (one by default).
- The file download island reads the link key from the URL hash first; generated file links are hash-based. Successful binary responses expose remaining downloads and TTL in response headers. Missing headers mean a legacy one-download backend.
- Frontend file size limit is `Constants.maxFileSizeBytes = 80 * 1024 * 1024` in `frontend/src/lib/util.js`; keep it aligned with the backend's `maxFileSize`. Both describe the **plaintext** file; the wire limit is `maxFileUploadBodyBytes` (81 MB), which allows for the AES-GCM IV/tag and multipart overhead and matches nginx's `81m`.
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
- **“One-time” is core product branding and high-value SEO language.** Do not remove or replace it in titles, metadata, headings, CTAs, link-ready states, or other prominent copy merely because optional multi-view/download limits exist. Keep the one-time promise as the default and qualify multi-use behavior only where the configured count is actually known.
- `/f/` cannot know a link's download count before making the destructive download request. Its pre-download gate and metadata must therefore retain one-time wording; after download, `view-file.ts` uses the response headers to state the exact remaining-download status.
- Treat established SEO wording as product behavior. Do not rewrite or weaken it without explicit approval, even when nearby implementation details change.

## Deployment

- Frontend production build output: `frontend/build` (static HTML files per route)
- Backend production binary from `make build`: `bin/1time-api`
- Example nginx config: `configs/nginx/1time.conf`
- nginx serves frontend statics and proxies `/api` to the Go app on `127.0.0.1:8080`.
- nginx upload ceiling is `81m` in both `configs/nginx/1time.conf` and `docker/nginx/default.conf.template` to stay above the backend's `80 MB` multipart limit. Upload/download timeouts on `/api/saveFile` and `/api/getFile` are `10m`, sized so an 80 MB transfer survives a slow mobile uplink.
- Host nginx has an exact `/f/` location with the same sensitive-header treatment as `/v/`.
- The nginx `try_files` directive includes `$uri/index.html` for static trailing-slash routes.

## Important Behavior

- The Astro frontend uses the JSON API routes under `/api`.
- Each route generates its own `index.html` with full pre-rendered content and unique meta tags for SEO.
- The deprecated server-rendered `/view/...` flow is separate from the SPA `/v/` flow.
- File links are one-time and currently use the SPA `/f/` flow.
- File downloads are consumed when an authorized fetch reserves one allowed download. The Redis record is decremented while downloads remain and deleted before the final transfer; the disk blob is removed after the final stream attempt.
