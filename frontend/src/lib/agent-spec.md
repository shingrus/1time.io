# Build a 1time.io client

> Paste this whole document into your coding agent. It is the complete spec for creating and reading 1time.io one-time links from any language.
> Canonical implementation: https://github.com/shingrus/1time/blob/master/frontend/src/lib/protocol.mjs

Save scheme v3 · API version 1

## What you are building

1time.io is zero-knowledge. All encryption happens in your client. The server stores ciphertext and a hash; it never receives the plaintext, the decryption key, the passphrase, or anything that can read the secret. The key travels only in the link's URL fragment (`#…`), which is never sent to a server.

Implement:

1. `createTextLink(text, {expiresInSeconds, views, passphrase?, host?}) → link`
2. `readTextLink(link, {passphrase?}) → {text, viewsLeft, expiresIn}`
3. `createFileLink(bytes, {name, type, expiresInSeconds, views, passphrase?, host?}) → link`
4. `readFileLink(link, {passphrase?}) → {name, type, size, bytes, viewsLeft}`
5. `checkStatus(host, ids) → {id: exists}` (optional)
6. `checkCompatibility(host) → bool` (recommended)

## Hard rules

- Save with `v: 3` and `readTokenHash`. Never send `hashedKey` on a save. That is the deprecated v2 scheme: it uploads a value that can read and destroy the secret.
- Generate `randomKey` with a cryptographically secure RNG.
- Never send `randomKey`, the passphrase, or a full link to any server, log, analytics or crash report. The key belongs only in the URL fragment, never in a path or query string.
- `/api/get` and `/api/getFile` are destructive: every successful call uses up a view. Retry only when the response is HTTP `503` and the JSON body is `{"status":"retry"}`. Never retry on a timeout, a network error, or any other status: the view may already be gone.
- HTTPS only. Plain `http://` is acceptable only for loopback hosts (`127.0.0.1`, `localhost`, `::1`).
- Identify your client (see section 6).

## 1. Keys

Alphabet (64 characters):

    ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_

1. `randomKey`: 20 characters. For each secure random byte, take `alphabet[byte % 64]` (unbiased, because 256 is a multiple of 64).
2. `fullSecretKey = passphrase + randomKey`: plain string concatenation, passphrase first; use `""` when there is no passphrase.
3. HKDF-SHA256 (RFC 5869, extract-then-expand) with `ikm = UTF-8(fullSecretKey)`, `salt = UTF-8("onetimelink:v2")`, output length 32 bytes:
   - `info = "encrypt"` gives the AES-256-GCM key
   - `info = "auth"` gives 32 bytes; lowercase hex of them is `readToken` (64 characters)
4. `readTokenHash = lowercase_hex(SHA-256(UTF-8(readToken)))`

The most common porting bug: `readTokenHash` hashes the 64-character hex string, not the 32 raw bytes it encodes. Get this wrong and every link you create answers `wrong key`.

The salt says `v2` even under save scheme v3. That is correct; do not change it.

Library pointers: Go `crypto/hkdf` (1.24+), Python `cryptography.hazmat.primitives.kdf.hkdf.HKDF`, Swift CryptoKit `HKDF<SHA256>`, Kotlin/Java BouncyCastle `HKDFBytesGenerator`, Node and browsers WebCrypto `HKDF`.

## 2. Encryption

AES-256-GCM, a fresh random 12-byte IV per payload, 128-bit tag appended to the ciphertext, no associated data.

Text. Plaintext is `UTF-8(text)`. The wire value is a string:

    base64url(iv) + "." + base64url(ciphertext || tag)

base64url uses `-` and `_`, without `=` padding. To decrypt, split on `.`.

Files. Plaintext is a packed blob:

    uint32_be(len(meta)) || meta || fileBytes

where `meta` is UTF-8 JSON such as `{"name":"report.pdf","type":"application/pdf","size":1234}` (`size` is the length of `fileBytes`; use `application/octet-stream` when the type is unknown).
The wire value is raw bytes: `iv || ciphertext || tag`, with no base64 and no dot. To decrypt, the first 12 bytes are the IV.

## 3. Links

- Text: `https://{host}/v/#{randomKey}{id}`
- File: `https://{host}/f/#{randomKey}{id}`

- `id` is returned by the server: 22 base64url characters.
- The fragment is exactly 42 alphabet characters: the first 20 are `randomKey`, the last 22 are `id`. Reject anything else as a broken link before calling the API; otherwise a truncated link looks exactly like an already-read secret.
- The passphrase is never part of the link. The recipient receives it through a separate channel.
- A link's origin is its API host. Self-hosted instances use the same paths.

## 4. HTTP API

Base URL: `https://1time.io/api/`, or any self-hosted origin. Every endpoint is `POST`; other methods answer `405`. Append `?src=<app-short-name>` to every request and set a matching `User-Agent`, e.g. `https://1time.io/api/saveSecret?src=webssh` with `User-Agent: WebSSH/32.8`. Use `?src=dev` until your client has a name (see section 6).

Most outcomes, including failures, return HTTP `200`: always check the `status` field.

### POST /api/saveSecret

`Content-Type: application/json`

    {
      "secretMessage": "<base64url iv>.<base64url ciphertext+tag>",
      "readTokenHash": "<64 lowercase hex>",
      "v": 3,
      "duration": 86400,
      "views": 1
    }

- `duration`: seconds, `1` to `2592000` (30 days). Missing or out of range silently becomes `86400`.
- `views`: `1` to `10`, optional, default `1`. Out of range is silently clamped.

Response: `{"status":"ok","newId":"<22 chars>"}`, or `{"status":"error","newId":"0"}` for a malformed body, wrong scheme fields, an empty message, or a server error. No reason is given.

Validate `duration` and `views` yourself and reject bad values. The server corrects them silently, so a "90-day" link would expire in one day.

### POST /api/saveFile

`multipart/form-data` fields:

- `file`: encrypted bytes (any filename, e.g. `encrypted.bin`)
- `readTokenHash`: 64 lowercase hex
- `v`: `3`
- `duration`: seconds, same rule as above
- `views`: `1` to `10`, optional

Response: same as `saveSecret`.

### POST /api/get (destructive)

    {"id": "<22 chars>", "hashedKey": "<readToken, 64 lowercase hex>"}

A read sends the `readToken` itself, in a field historically named `hashedKey`. Reads are identical for every save scheme.

- `200 {"status":"ok","cryptedMessage":…,"viewsLeft":…,"expiresIn":…}`: decrypt `cryptedMessage`. `viewsLeft` is what remains after this read (`0` means it is now deleted); `expiresIn` is seconds. Uses a view.
- `200 {"status":"wrong key"}`: passphrase missing or wrong. Ask for it and try again. Does not use a view.
- `200 {"status":"no message"}`: already read, expired, or never existed.
- `200 {"status":"error"}`: malformed request or server error. Do not retry.
- `503 {"status":"retry"}`: contention; rejected before anything was used. Safe to retry.

### POST /api/getFile (destructive)

Same request body as `/api/get`. Success is binary and every failure is JSON, so branch on `Content-Type`, not on the status code alone.

- Success: `200`, `Content-Type: application/octet-stream`, body is the encrypted bytes. Headers: `X-1Time-Views-Left`, and `X-1Time-Expires-In` (seconds, may be absent).
- `200` JSON `{"status":"wrong key"}` or `{"status":"no message"}`: as for `/api/get`.
- `400 {"status":"error"}` (`application/json`): malformed `id` or `hashedKey`.
- `503 {"status":"retry"}` (`application/json`): safe to retry.
- `500 {"status":"error"}` (`application/json`): server error; do not retry.

### POST /api/secretStatus (never uses a view)

    {"ids": ["<22 chars>", "..."]}

Up to 128 ids; extra and malformed ids are silently dropped.
Response: `{"status":"ok","secrets":{"<id>":true}}`. `true` means still available, `false` means read or expired.

### POST /api/ss (capabilities)

No body. The response includes `{"apiVersion":1,"saveSchemes":[0,3]}`; other fields are statistics, ignore them.
Before saving, confirm `saveSchemes` contains `3`. If it does not, the host is too old: fail with a clear error. Cache the result per host.

## 5. Limits (hosted 1time.io)

- Expiry: 1 second to 30 days, default 1 day
- Views or downloads: 1 to 10, default 1
- `saveSecret` request body: 25 MiB (about 18 MiB of plaintext after encryption and base64)
- File size (plaintext): 80 MiB; self-hosted instances may set a different limit
- `get` and `getFile` request body: 1 KiB
- `secretStatus`: 128 ids, 8 KiB
- Rate limit, saves: about 45 per minute per IP, burst 10, then `429`
- Rate limit, reads: about 60 per minute per IP, burst 15, then `429`

On `429` for a save: back off and retry. On `429` for a read: surface it to the user rather than retrying automatically.

Browsers: the hosted API does not send CORS headers, so JavaScript on another website cannot call it. Call it from a native app, a server, a CLI, or a browser extension's background context.

## 6. Attribution

Self-reported and never used for access control. It lets us see your integration's traffic and reach you before a protocol change.

- Pick a short lowercase name for your app, the way the existing clients do: `cli` (terminal client), `ext` (browser extension), `zap` (Zapier app), `webssh` (WebSSH). Send it on every API URL as `?src=<app-short-name>`, and use the same name in `User-Agent: <ClientName>/<version>`, e.g. `?src=webssh` with `WebSSH/32.8`.
- Until your client has a name, send `?src=dev` with `User-Agent: 1time-dev-client/0.1`. Both mark a client written from this spec; replace them before you release.
- Names already taken: `dev`, `cli`, `ext`, `zap`, `webssh`.
- Always set your own User-Agent: generic library defaults (`python-requests`, `Go-http-client`, `node`) are indistinguishable from scripts and scanners.
- Built something? Tell us at https://github.com/shingrus/1time/issues and we will list it on https://1time.io/developers/

## 7. Test vectors

Produced by the canonical `protocol.mjs`; V1 is also pinned in the Go backend tests. Encryption uses a random IV, so it is not deterministic: test your encryption by round-tripping it through your decryption, then against the live API.

V1: key derivation, no passphrase

    fullSecretKey  K7bQ2mXp9vRt4nLw8zYc
    readToken      5e6c13f429c1e6eb0c69bc2e67e98e7aa18db0a4bac73f943858694ac3fbe957
    readTokenHash  3bfecb0a1d1bc37a3e70eb843af6578ee1fa34c19fd059a89dfbdda4523bf396

V2: key derivation with passphrase "correct horse"

    fullSecretKey  correct horseK7bQ2mXp9vRt4nLw8zYc
    readToken      236c0385cdff9e6707c0ab1d20f936c0e6ab75dc5ce09170ca528cd39cc3a10f
    readTokenHash  323a850509f83d441ac10a8383cccbe356044213dd6439e9c7375eb788f35acc

V3: text decryption

    fullSecretKey   K7bQ2mXp9vRt4nLw8zYc
    cryptedMessage  9uCJlv0mLOve6cWh.-Z5xKVVauhg2NAM1n-AjlKZsT4m5sWjAYgKGql9AIl0
    plaintext       hello from 1time

V4: file decryption (86 bytes, shown as standard base64)

    fullSecretKey  K7bQ2mXp9vRt4nLw8zYc
    encrypted      uGUZGLv58lm1RelH+ZZA4pRL3caBNF/dcugFY6hiiHORfAi88QNuc90luBF+J3EGdFOWymIH6cMAK+qXiKakZvex55ygVWLjqazgBG2eCDYw2BDTSdA=
    meta           {"name":"hello.txt","type":"text/plain","size":5}
    content        hello

V5: link parsing

    link       https://1time.io/v/#K7bQ2mXp9vRt4nLw8zYcAbCdEfGhIjKlMnOpQrStUv
    origin     https://1time.io
    randomKey  K7bQ2mXp9vRt4nLw8zYc
    id         AbCdEfGhIjKlMnOpQrStUv

## 8. Done checklist

- [ ] V1 to V5 pass as unit tests
- [ ] Saves send `v: 3` and `readTokenHash`, never `hashedKey`
- [ ] Live round trip on https://1time.io: a text link and a file link created by your client open correctly in a browser
- [ ] Links created in the 1time.io web app, with and without a passphrase, open in your client
- [ ] A second read returns `no message`
- [ ] A wrong passphrase returns `wrong key`, and the correct one still works afterwards
- [ ] Reads retry only on `503` with `{"status":"retry"}`
- [ ] `duration` and `views` are validated client-side
- [ ] `?src=` and `User-Agent` are set: `?src=dev` and `1time-dev-client/0.1` while building, your app's short name before release
- [ ] No key, passphrase, readToken or link appears in logs, analytics or crash reports

## Versioning

Current save scheme: v3. Scheme 0 (v2, `hashedKey` on save) is still accepted so old clients keep working, but it is deprecated; new clients must not use it. Check `/api/ss` for what a host supports.
