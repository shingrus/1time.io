# 1time CLI

`1time` is a command-line client for [1time.io](https://1time.io), an end-to-end encrypted one-time secret sharing service.

Use it to share passwords, API keys, tokens, private notes, and other sensitive text as self-destructing links from your terminal.
It can also share encrypted files with one-time download links.

## Why Use 1time CLI

- End-to-end encrypted: the secret is encrypted locally before it is sent to the server.
- One-time links: once the recipient opens the link, the stored payload is deleted.
- Simple terminal workflow: pipe a secret in, get a secure link out.
- Good for developer secrets: API keys, access tokens, SSH snippets, passwords, and incident-response notes.

## Quick Start

Install from npm:

```bash
npm install -g @1time/cli
```

Create a one-time link from `stdin`:

```bash
printf 'my-api-key' | 1time send
```

Read a one-time link:

```bash
1time read 'https://1time.io/v/#...'
```

Create a one-time file link:

```bash
1time send-file ./backup-codes.txt
```

Download a one-time file:

```bash
1time read-file 'https://1time.io/f/#...'
```

## How It Works

1. You send a secret from your terminal.
2. The CLI encrypts it locally using the same protocol as the web app.
3. The backend stores only ciphertext plus an authentication token.
4. The recipient opens the one-time link and decrypts the payload with the key material stored in the URL fragment.

The server does not receive the plaintext secret.

## Install

From npm:

```bash
npm install -g @1time/cli
```

From this repository:

```bash
cd cli
npm install -g .
```

Requires Node.js `20+`.

## Commands

### `1time send`

Create an encrypted one-time link.

Input precedence:

1. piped `stdin`
2. `1TIME_SECRET`
3. positional secret argument

Examples:

```bash
printf 'postgres://user:pass@host/db' | 1time send
```

```bash
1TIME_SECRET='sk_live_123' 1time send
```

```bash
1time send 'temporary-password-123'
```

Use a custom host:

```bash
printf 'hello' | 1time send --host 1time.io
printf 'hello' | 1time send --host https://1time.io
printf 'hello' | 1time send --host http://127.0.0.1:8080
```

### `1time read <link>`

Fetch and decrypt a one-time link.

Examples:

```bash
1time read 'https://1time.io/v/#...'
```

```bash
1time read --host http://127.0.0.1:8080 'http://127.0.0.1:8080/v/#...'
```

### `1time send-file <path>`

Create an encrypted one-time file link.

Examples:

```bash
1time send-file ./secret.pdf
```

```bash
1TIME_PASSPHRASE='extra-passphrase' 1time send-file ./backup-codes.txt
```

```bash
1time send-file --host http://127.0.0.1:8080 --passphrase 'extra-passphrase' ./report.zip
```

### `1time read-file <link>`

Fetch, decrypt, and save a one-time file link.

By default, the file is written to the current directory using the original filename.

Examples:

```bash
1time read-file 'https://1time.io/f/#...'
```

```bash
1TIME_PASSPHRASE='extra-passphrase' 1time read-file 'https://1time.io/f/#...'
```

```bash
1time read-file --out ./downloads/secret.pdf 'https://1time.io/f/#...'
```

## Command Reference

- `--host <host-or-origin>`
- `--passphrase <passphrase>` for `send-file` and `read-file`
- `--out <path>` for `read-file`
- `-h`, `--help`

## Host Rules

- default host is `1time.io`
- bare hosts like `1time.io` are normalized to `https://1time.io`
- `https://...` is accepted
- `http://...` is rejected except for loopback hosts such as `127.0.0.1`

## Security Notes

- Prefer `stdin` for `send`.
- `1time send 'secret'` is supported for convenience, but it is insecure because command-line arguments can leak through shell history and process listings.
- `1time read <link>` also places the full secret link in command history and process listings. In this protocol, the URL fragment contains the decryption material.
- `send-file` and `read-file` support optional passphrases via `--passphrase` or `1TIME_PASSPHRASE`.
- Custom expiry is not yet supported from the CLI.

## Current Limitations

- no custom expiry support yet
- `read` currently accepts the link as a command argument only

## Local Development

Run directly from the repository root:

```bash
node cli/index.mjs --help
printf 'hello' | node cli/index.mjs send
node cli/index.mjs read 'https://1time.io/v/#...'
```

Run tests:

```bash
cd cli
npm test
```

## Release

Publish from `cli/` so npm uses this README for the package page:

```bash
cd cli
npm login
npm pack --dry-run
npm publish --access public
```

The package syncs the shared protocol before `npm test`, `npm pack`, and `npm publish`, so the published CLI includes the current encryption logic.
