# [onetimelink.me](https://onetimelink.me) — Share Secrets with Encrypted One-Time Links

Share passwords, API keys, and sensitive data through self-destructing links with **end-to-end encryption**. The server never sees your secrets — everything is encrypted and decrypted in the browser using AES-GCM.

**[Try it live →](https://onetimelink.me)**

## Why onetimelink.me?

- **End-to-end encrypted** — secrets are encrypted in the browser before they leave your device. The decryption key is stored in the URL fragment (`#`), which is never sent to the server.
- **Zero-knowledge** — the server stores only encrypted blobs. Even with full database access, your secrets cannot be read.
- **Self-destructing** — each link can only be opened once. After that, the encrypted data is permanently deleted.
- **No signup required** — paste a secret, get a link, share it. No accounts, no tracking.
- **Open source** — the full source code is right here. Audit it yourself.
- **Free** — no paid tiers, no limits, no ads.

## How it works

1. You paste a secret into [onetimelink.me](https://onetimelink.me)
2. Your browser encrypts it with AES-GCM and a random key
3. The encrypted blob is sent to the server; the key stays in the URL fragment
4. You share the link — the recipient opens it, the browser decrypts it, and the server deletes the encrypted blob

The encryption key never touches the server. Even if the server is compromised, your secrets remain safe.

## Free tools

- [Password Generator](https://onetimelink.me/password-generator) — generate strong random passwords
- [Passphrase Generator](https://onetimelink.me/passphrase-generator) — memorable multi-word passphrases
- [API Key Generator](https://onetimelink.me/api-key-generator) — random tokens for developers
- [WiFi Password Generator](https://onetimelink.me/wifi-password-generator) — easy-to-type network passwords

## Tech stack

- **Backend:** Go + Redis
- **Frontend:** Next.js (static export)
- **Encryption:** Web Crypto API (AES-GCM)
- **Deployment:** nginx + systemd

---

## Development

### Requirements

- Go 1.25+
- Redis 8+
- Node.js 25+ and npm

This repo currently builds locally with:

- Go `1.25.5`
- Node `25.2.1`
- npm `11.6.2`
- Redis `8.4.0`

### Backend setup

Start Redis locally and export the backend connection settings:

```bash
export REDISHOST=127.0.0.1:6379
export REDISPASS=
```

Run the backend:

```bash
go run .
```

The app listens on `http://127.0.0.1:8080`.

Useful backend commands:

```bash
go build ./...
GOCACHE=/tmp/go-cache go test ./...
make build
```

`make build` now produces both the backend binary in `bin/1time` and the frontend production bundle in `frontend/build`. Install frontend dependencies with `cd frontend && npm install` before using it.

Bootstrap an Ubuntu/Debian VM from this repo checkout after `make build`:

```bash
sudo ./scripts/init_vm.sh
```

The script installs `nginx`, `redis-server`, and `rsync`, creates the `onetimelink` user, copies the built backend into `/opt/onetimelink/bin`, installs the `onetimelink` systemd unit, and starts the `onetimelink` service. If `frontend/build` exists, it also syncs it to `/var/www/onetimelink`.

`init_vm.sh` intentionally does not deploy the deprecated `templates/` flow. Use nginx to serve the React build and proxy only `/api` to the Go app for this deployment mode.

Install the sample nginx site from `configs/nginx/onetimelink.conf`, adjust `server_name`, then run `nginx -t` before reloading nginx.

### Frontend setup

Install dependencies:

```bash
cd frontend
npm install
```

Start the frontend dev server:

```bash
npm run dev
```

The frontend runs on Next.js. In development it serves on `http://127.0.0.1:3001` and proxies `/api` to the Go backend on `http://127.0.0.1:8080`, so the Go server must be running first. This keeps frontend requests same-origin in development, matching production behind nginx.

If you need to point the dev proxy somewhere else, set `API_PROXY_TARGET` before `npm run dev`.

`NEXT_PUBLIC_API_URL` should usually be left unset in local development so the frontend continues to use relative `/api/` requests through the Next.js proxy.

Create a production build:

```bash
npm run build
```

Run frontend tests:

```bash
npm test
```

### Notes

- The frontend has been migrated from Create React App to Next.js with static export for production builds.
- The server-rendered flow under `templates/` is deprecated. It still exists in the codebase, but it is not part of the recommended deployment path.
- Production nginx, Redis, and systemd example configs are in `configs/`.
