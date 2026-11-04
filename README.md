<p align="center">
  <a href="https://1time.io">
    <img src="frontend/public/og-image.png" alt="1time.io" width="400">
  </a>
</p>

<p align="center">
  <strong>Zero-knowledge one-time links for passwords, API keys and files.</strong><br>
  Encrypted in the browser, readable once, then gone. Use <a href="https://1time.io">1time.io</a> or run your own.
</p>

<p align="center">
  <a href="https://1time.io"><img src="https://img.shields.io/badge/Try_it_live-1time.io-E8552D?style=for-the-badge" alt="Try it live"></a>
  &nbsp;
  <a href="#self-hosting"><img src="https://img.shields.io/badge/Self--host-Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Self-host with Docker Compose"></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/shingrus/1time.io?style=flat-square" alt="License"></a>
  <a href="https://github.com/shingrus/1time.io/releases"><img src="https://img.shields.io/github/v/release/shingrus/1time.io?style=flat-square" alt="Release"></a>
  <a href="https://www.npmjs.com/package/@1time/cli"><img src="https://img.shields.io/npm/v/@1time/cli?style=flat-square&label=cli" alt="npm"></a>
</p>

<p align="center">
  <img src="docs/screenshot-create.png" alt="Paste a secret and create a one-time link" width="45%">
  &nbsp;&nbsp;
  <img src="docs/screenshot-link-ready.png" alt="The one-time link is ready to copy" width="45%">
</p>
<p align="center">
  <img src="docs/screenshot-reveal.png" alt="The recipient reveals the secret once" width="45%">
  &nbsp;&nbsp;
  <img src="docs/screenshot-file-sharing.png" alt="Send an encrypted file with a one-time download link" width="45%">
</p>

## What you get

- **Zero-knowledge encryption.** AES-256-GCM in the browser; the key stays in the link's `#` fragment and never reaches the server.
- **One-time links.** A link opens once by default (or up to 10 times if you choose) and expires after 1 hour to 30 days, read or not.
- **Encrypted files up to 250 MB**, with the filename and type inside the encrypted payload.
- **Optional passphrase** for links that shouldn't work on their own.
- **No accounts.** Paste, share, done.
- **A CLI and a browser extension** that use the same protocol, against 1time.io or your own instance.
- **Small and self-hostable.** Go + Redis + static HTML, MIT licensed.

## How it works

```
Sender's browser                Server                     Recipient's browser
  encrypt with a random key ──► stores ciphertext only
  link = …/v/#<key>                (can't decrypt)
          └────────── share the link ───────────────────────► opens the link
                                 ◄── proves it holds the link
                                 sends ciphertext, deletes it ─► decrypts with #<key>
```

The browser derives two values from the key in the link with HKDF-SHA256: an AES-256-GCM key, and a read token. The sender uploads only a **SHA-256 hash of the read token**. To open a secret, the recipient presents the token; the server checks it against the hash, returns the ciphertext and deletes it. So the server, its admins and its database can't read a secret, and a database dump can't be used to open or burn one.

Files work the same way: the browser encrypts the file and its metadata, then uploads it in 4 MiB chunks, so a dropped connection costs one chunk, not the whole upload. The full protocol, the HTTP API and test vectors are on the [developers page](https://1time.io/developers/).

## Self-hosting

Run your own instance for your team, on your own domain. The self-hosted build is just the tool: text and file sharing, the password generator and My Secrets, with no blog, marketing pages or analytics, and nothing loaded from other hosts. Links use whatever address your users open, so there's no hostname to configure.

```bash
curl -O https://raw.githubusercontent.com/shingrus/1time.io/master/docker-compose.yml
curl -O https://raw.githubusercontent.com/shingrus/1time.io/master/.env.example
cp .env.example .env
docker compose up -d
```

That starts three containers (Redis, the Go API, nginx serving the frontend) on `http://localhost:8080`, with data under `DATA_DIR`. Images are built for amd64 and arm64. To build from source instead:

```bash
git clone https://github.com/shingrus/1time.io.git && cd 1time.io
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d --build
```

**HTTPS.** Put your usual reverse proxy in front. With Caddy on the same host:

```
secrets.example.com {
    reverse_proxy localhost:8080
}
```

The container sends a CSP, `X-Frame-Options` and a strict `Referrer-Policy` (no referrer at all on secret and file pages). It doesn't send HSTS; set that on your proxy.

**Configuration** (`.env`, no rebuild needed):

| Variable | Default | |
|---|---|---|
| `APP_PORT` | `8080` | Port on the host |
| `DATA_DIR` | `./data` | Redis data and encrypted files |
| `TRUSTED_PROXIES` | the container's Docker network | Proxy addresses or CIDRs whose forwarded visitor IP is believed; `none` trusts nobody |
| `REAL_IP_HEADER` | `X-Forwarded-For` | `CF-Connecting-IP` behind Cloudflare |
| `RATE_LIMIT` | `on` | `off` disables API rate limits |
| `RATE_LIMIT_WRITE` / `_UPLOAD` / `_READ` | `45r/m` / `120r/m` / `60r/m` | Per visitor: secrets created / file chunks (a 250 MB file is 63) / secrets and files opened |
| `BACKEND_UPSTREAM` | `backend:8080` | Where nginx sends `/api/` |

**Rate limits behind a proxy.** By default only the container's own Docker network is trusted to report visitor IPs. That covers a proxy container in the same compose setup and a proxy on the host, and each visitor gets their own limit. For a proxy on another machine, put its address in `TRUSTED_PROXIES`; until then all visitors share the proxy's limit. Don't trust whole private ranges like `10.0.0.0/8`: on an internal network your users have private addresses too, and could fake their IP to get around the limits. With rootless Docker or Docker Desktop, nginx may see every client as the Docker gateway; if such an instance is reachable without a proxy, set `TRUSTED_PROXIES` to your proxy's address only.

**Upgrading** from an older release: `APP_HOSTNAME` and `SHOW_BLOG` are no longer used and can be removed from `.env`.

**How it compares** with other self-hosted tools:

| | **1time** | OneTimeSecret | Yopass | PrivateBin | Password Pusher |
|---|:---:|:---:|:---:|:---:|:---:|
| Zero-knowledge (E2E encrypted) | **Yes** | No | Yes | Yes | No |
| Self-destructs after first read | **Yes** | Yes | Yes | Optional | Optional |
| Self-hosted with Docker Compose | **Yes** | Yes | Yes | Yes | Yes |
| First-party CLI | **Yes** | No | Yes | No | Yes |
| Built-in password generator | **Yes** | No | No | No | No |
| Stack | Go + static HTML | Ruby | Go | PHP | Ruby |
| License | MIT | MIT | Apache-2.0 | zlib | Apache-2.0 |

More for teams evaluating it: [1time.io/self-hosted](https://1time.io/self-hosted/).

## CLI

```bash
npm install -g @1time/cli

printf '%s' "$DB_PASSWORD" | 1time send          # → https://1time.io/v/#…
1time read 'https://1time.io/v/#…'
1time send-file ./backup-codes.txt
1time read-file 'https://1time.io/f/#…'

printf '%s' "$TOKEN" | 1time send --host https://secrets.example.com   # your instance
```

Encryption happens locally, so plaintext never leaves the machine. Requires Node.js 20+. See the [CLI docs](cli/README.md).

## Build your own client

The [developers page](https://1time.io/developers/) has the complete protocol, HTTP API, limits and test vectors, written so you can hand it straight to a coding agent. It's also available as [plain text](https://1time.io/developers/agent-spec.txt).

## Development

Needs Go 1.25+, Redis 7+ and Node.js 22.23+.

```bash
# Backend on http://127.0.0.1:8080 (expects Redis on 127.0.0.1:6379)
mkdir -p /tmp/1time-files
FILE_STORAGE_DIR=/tmp/1time-files REDISHOST=127.0.0.1:6379 REDISPASS= go run ./backend

# Frontend on http://127.0.0.1:3001, proxying /api to the backend
cd frontend && npm install && npm run dev
```

The frontend builds in two editions: `npm run build` is the full 1time.io site, and `SELF_HOSTED=true npm run build` is the self-hosted tool (the default in Docker). Every build ends with a check that fails on any link to a page the edition doesn't ship.

Tests: `go test ./backend/...`, `cd frontend && npm run check`, `cd cli && npm test`. `make build` produces `bin/1time-api` and `frontend/build/`. [AGENTS.md](AGENTS.md) documents the architecture and conventions, and [docs/vm-deployment.md](docs/vm-deployment.md) how 1time.io itself is deployed without Docker.

## Browser extension

Select text on any page, right-click (or press `Alt+Shift+S`), and the encrypted one-time link is on your clipboard. It works in Chrome, Edge, Brave and other Chromium browsers, against 1time.io or your own instance (set the host in the extension's options). [Add to Chrome](https://chromewebstore.google.com/detail/1time-%E2%80%94-one-time-secret-l/oclenaeccacnolionlpiefekmmbppgkb) · source in [`extension/`](extension/).

## Contributing, security, license

Contributions are welcome: please open an issue first for anything non-trivial. See [CONTRIBUTING.md](CONTRIBUTING.md).

Found a vulnerability? Please report it privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

[MIT](LICENSE) — Copyright (c) 2018-2026 1time.io
