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
- The root HTML flow under `templates/` is also functional, so you can use the backend without the React app.
- Production nginx and Redis example configs are in `configs/`.
