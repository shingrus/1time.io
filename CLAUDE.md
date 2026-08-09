# CLAUDE.md

Engineering guidance for this repo lives in **[AGENTS.md](AGENTS.md)** — read it first.
AGENTS.md is the single source of truth for architecture, conventions and constraints.
This file adds the **product, growth and analytics context** that has no home there.

## Quick orientation

- **How it works:** 1time.io is a zero-knowledge one-time secret/file sharing tool. All encryption is client-side (AES-256-GCM + HKDF-SHA256); the server stores only ciphertext, and the decryption key lives only in the URL fragment. See "How It Works (zero-knowledge protocol)" in AGENTS.md.
- **Canonical crypto:** `frontend/src/lib/protocol.mjs` — shared, dependency-free, runs in browser + Node, and is synced into the CLI (`cli/`) and the Zapier app (`zap/`). **Do not fork it — edit `protocol.mjs` and re-sync.**
- **Layout:** Go backend in `backend/`, Astro static frontend in `frontend/` (islands in `frontend/src/islands/`, builds to `frontend/build`), first-party CLI in `cli/`, Chrome extension in `extension/`, Zapier integration in `zap/`, ops/analytics scripts in `scripts/`.
- **Hard constraints:** frontend Lighthouse performance is not optional — keep CSS/JS off the initial render path per the "Frontend CSS/JS Performance" sections in AGENTS.md. Keep the frontend and backend `80 MB` file limits aligned (and nginx `client_max_body_size` above them, currently `81m`).

## Analytics

Run the skill; do not hand-write log parsing.

```bash
python3 .claude/skills/log-analysis/analyze.py <logdir>
```

[.claude/skills/log-analysis/SKILL.md](.claude/skills/log-analysis/SKILL.md) documents the
identity model, whale exclusion, response-size fingerprints, and the traps
(line de-duplication, partial-day comparison, browser-shaped scanner UAs).
`scripts/retention.py` and `scripts/export_redis_stats_to_gsheets.py` cover cohorts
and the Redis→Sheets export; `scripts/analytics/` is gitignored on purpose.

**Never report a metric without checking whether one identity produced it.** Both
"first extension usage" and "CLI adoption" turned out to be a single IP inside ten
minutes. The same applies to whales and to any single-day record.

## Structural findings (durable — don't re-derive)

- **Platform counts measure shares, not organisations.** Microsoft and Meta proxy
  all link previews centrally (`52.112.x`/`52.123.x` for Teams), so a Teams or
  WhatsApp count says how often links are pasted there, never by how many companies.
- **Retention figures are a floor, never an estimate.** Identity is `(IP, UA)` with
  IPv6 at /64, which cannot follow a person across a network change. The measured
  floor sits near 7–8%. A first-party anonymous id in localStorage sent with the
  existing `/api/stat` beacon is the missing instrument.

## Infrastructure state

- **Behind Cloudflare** (proxied DNS) since 2026-07-31. `configs/nginx/snippets/cloudflare-real-ip.conf`
  restores the visitor IP via `CF-Connecting-IP`, which also fixes `limit_req_zone`
  and the access log. Verified working. Migration also solved the Hetzner-IP
  blocklist problem that made the site unreachable from some networks — a failure
  mode that was **invisible in logs**, since blocked users never reached nginx.
- `X-Forwarded-For` is set to `$remote_addr`, not `$proxy_add_x_forwarded_for`,
  to avoid duplicating the client IP behind the proxy.
- **Open:** Cloudflare WAF rules for credential-path probes and an `/api/*`
  allowlist (7 real endpoints: `saveSecret get secretStatus saveFile getFile stat ss`);
  origin firewall restricting 80/443 to Cloudflare's 22 ranges. Do **not** enable
  Bot Fight Mode on the Free plan — it has no path exemptions and would break the
  CLI and Zapier app.

## Working notes

*Volatile numbers deliberately excluded — re-derive them with the skill.*