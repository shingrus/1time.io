# CLAUDE.md

Agent and contributor guidance for this repo lives in **[AGENTS.md](AGENTS.md)** — read it first. This file is a pointer so Claude Code picks up the same guidance; AGENTS.md is the single source of truth.

Quick orientation:

- **How it works:** 1time.io is a zero-knowledge one-time secret/file sharing tool. All encryption is client-side (AES-256-GCM + HKDF-SHA256); the server stores only ciphertext, and the decryption key lives only in the URL fragment. See "How It Works (zero-knowledge protocol)" in AGENTS.md.
- **Canonical crypto:** `frontend/src/lib/protocol.mjs` — shared, dependency-free, runs in browser + Node, and is synced into the CLI (`cli/`) and the Zapier app (`zap/`). **Do not fork it — edit `protocol.mjs` and re-sync.**
- **Layout:** Go backend in `backend/`, Astro static frontend in `frontend/` (islands in `frontend/src/islands/`, builds to `frontend/build`), first-party CLI in `cli/`, Chrome extension in `extension/`, Zapier integration in `zap/`, ops/analytics scripts in `scripts/`.
- **Hard constraints:** frontend Lighthouse performance is not optional — keep CSS/JS off the initial render path per the "Frontend CSS/JS Performance" sections in AGENTS.md. Keep the frontend and backend `25 MB` file limits aligned.
