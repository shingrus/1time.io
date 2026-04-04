# Contributing to 1time.io

Thanks for your interest in contributing! 1time.io is an open-source, zero-knowledge secret sharing tool.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/1time.git`
3. Set up the development environment (see below)
4. Create a feature branch: `git checkout -b feature/your-feature`
5. Make your changes
6. Run tests
7. Open a Pull Request

## Development Setup

### Prerequisites

- Go 1.22+
- Node.js 20+
- Redis 7+
- Docker & Docker Compose (optional)

### Backend (Go)

```bash
# Start Redis
redis-server

# Run the backend
mkdir -p /tmp/1time-files
export FILE_STORAGE_DIR=/tmp/1time-files
export REDISHOST=127.0.0.1:6379
export REDISPASS=
go run ./backend
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev    # starts on port 3001, proxies /api/ to backend
```

### CLI

```bash
cd cli
npm install
npm test
```

### Full Stack (Docker)

```bash
cp .env.example .env
# Edit .env with your settings
docker compose -f docker-compose.dev.yml up
```

## What to Contribute

- Bug fixes
- Security improvements
- Performance optimizations
- New tool pages (password generators, security utilities)
- Blog articles about security best practices
- CLI improvements
- Documentation improvements
- Translations

## Guidelines

- **Open an issue first** for non-trivial changes to discuss the approach
- **Keep PRs focused** — one feature or fix per PR
- **Write tests** for new backend functionality
- **Follow existing patterns** — match the code style of surrounding code
- **No tracking or analytics** — we are a privacy-first tool
- **Client-side first** — cryptographic operations must happen in the browser

## Architecture

- **Backend:** Go stdlib HTTP server + Redis
- **Frontend:** Next.js static export (React 19)
- **CLI:** Node.js ES modules
- **Encryption:** Web Crypto API (AES-256-GCM, HKDF-SHA256)

See [AGENTS.md](AGENTS.md) for detailed architecture documentation.

## Running Tests

```bash
# Backend
GOCACHE=/tmp/go-cache go test ./backend/...

# Frontend
cd frontend && npm test

# CLI
cd cli && npm test
```

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
