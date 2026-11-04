# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in 1time.io, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email security concerns to the repository maintainer via GitHub's private vulnerability reporting feature:

1. Go to the [Security tab](https://github.com/shingrus/1time.io/security) of this repository
2. Click "Report a vulnerability"
3. Provide a detailed description of the vulnerability

We will acknowledge your report within 72 hours and aim to provide a fix within 7 days for critical issues.

## Security Model

1time.io uses a zero-knowledge architecture:

- **Encryption happens in the browser** using AES-256-GCM with HKDF-SHA256 key derivation
- **The server never sees plaintext** — only ciphertext and a hash-based proof-of-knowledge
- **The encryption key stays in the URL fragment** (`#`), which is never sent to the server by browsers
- **Secrets are deleted after one read** — the server removes the ciphertext immediately after retrieval
- **No user accounts or sessions** — no authentication data to compromise

## Supported Versions

We only support the latest version. Please ensure you are running the most recent release before reporting.

## Scope

The following are in scope for security reports:

- Encryption/decryption implementation flaws
- Server-side data leakage (plaintext exposure)
- Authentication bypass (retrieving secrets without the correct key)
- Cross-site scripting (XSS) in the web frontend
- Injection vulnerabilities in the API
- Timing attacks on hash comparison
- Redis data persistence concerns

Out of scope:

- Denial of service (DoS) attacks
- Social engineering
- Issues in third-party dependencies (report these upstream)
- Self-hosted deployment misconfigurations
