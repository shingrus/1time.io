# onetimelink.me

One-time secret sharing service with:

- a Go backend on `127.0.0.1:8080`
- Redis for message storage
- an optional React frontend in `frontend/`

## Requirements

- Go
- Redis
- Node.js and npm

This repo currently builds locally with:

- Go `1.25.5`
- Node `25.2.1`
- npm `11.6.2`
- Redis `8.4.0`

## Backend setup

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

Bootstrap an Ubuntu/Debian VM from this repo checkout after `make build`:

```bash
sudo ./scripts/init_vm.sh
```

The script installs `nginx`, `redis-server`, and `rsync`, creates the `onetimelink` user, copies the built backend into `/opt/onetimelink/bin`, installs the `onetimelink` systemd unit, and starts the `onetimelink` service. If `frontend/build` exists, it also syncs it to `/var/www/onetimelink`.

`init_vm.sh` intentionally does not deploy the deprecated `templates/` flow. Use nginx to serve the React build and proxy only `/api` to the Go app for this deployment mode.

Install the sample nginx site from `configs/nginx/onetimelink.conf`, adjust `server_name`, then run `nginx -t` before reloading nginx.

## Frontend setup

Install dependencies:

```bash
cd frontend
npm install
```

Start the frontend dev server:

```bash
npm start
```

You can also use:

```bash
npm run dev
```

The frontend now runs on Vite. In development it serves on `http://127.0.0.1:3000` and proxies `/api` to the Go backend on `127.0.0.1:8080`, so the Go server must be running first.

Create a production build:

```bash
npm run build
```

Run frontend tests:

```bash
npm test
```

## Notes

- The frontend has been migrated from Create React App to Vite and now installs without the old CRA transitive vulnerability set.
- The server-rendered flow under `templates/` is deprecated. It still exists in the codebase, but it is not part of the recommended deployment path.
- Production nginx, Redis, and systemd example configs are in `configs/`.
