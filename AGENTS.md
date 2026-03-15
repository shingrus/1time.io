# onetimelink.me

## Overview

- Go backend lives at the repo root.
- Redis is required for message storage.
- React frontend lives in `frontend/` and uses Vite.
- Server-rendered HTML flows in `templates/` are deprecated. They still exist in the codebase, but they are not part of the default deployment path.

## Backend

- Entry point: `main.go`
- HTTP handlers: `handlers.go`
- Redis access: `storage.go`
- Crypto/random helpers: `utils.go`
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

## Frontend

- Toolchain: Vite
- Runtime: React 19, React Router 6
- Entry HTML: `frontend/index.html`
- App entry: `frontend/src/index.jsx`
- Route shell: `frontend/src/App.jsx`

Run locally:

```bash
cd frontend
npm install
npm start
```

Useful commands:

```bash
cd frontend
npm test
npm run build
```

## Frontend Notes

- The dev server runs on `127.0.0.1:3000` and proxies `/api` to `127.0.0.1:8080`.
- Do not edit `frontend/build` directly; it is generated output.
- `frontend/index.html` contains critical inline shell CSS to reduce first-render layout shift and FOUC. Preserve that unless you intentionally rework the initial paint behavior.
- The footer tagline was moved into `frontend/src/App.jsx` so it renders with the app and does not shift after the form mounts.
- The frontend now uses the native Clipboard API helper in `frontend/src/utils/util.js`; do not reintroduce `react-copy-to-clipboard`.

## Domain And Branding

- Public domain is `https://onetimelink.me`.
- Do not reintroduce old domains such as `1time.it`, `1time.click`, or `sharepass.to`.
- Template favicon links should stay relative, e.g. `/ico.png`.
- `templates/result.html` still renders production-host share links for `onetimelink.me`, but the `templates/` flow is deprecated.

## Deployment

- Frontend production build output: `frontend/build`
- Backend production binary from `make build`: `bin/1time`
- Example nginx config: `configs/nginx/onetimelink.conf`
- nginx is expected to serve the frontend statics and proxy `/api` to the Go app on `127.0.0.1:8080`.

## Important Behavior

- The React frontend uses the JSON API routes under `/api`.
- The deprecated server-rendered `/view/...` flow is separate from the SPA `/v/...` flow.
- If changing legacy links, routes, or templates-backed behavior, check both the React frontend and the `templates/` files.
