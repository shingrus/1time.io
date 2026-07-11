# 1time Chrome Extension

Select text on any page, press a shortcut, and a zero-knowledge one-time link
lands in your clipboard. The text is AES-256-GCM-encrypted locally before
upload; the target server only ever sees ciphertext and the derived auth hash.
The decryption key stays in the URL fragment, exactly like the web app.

## Install (unpacked)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this `extension/` directory.

## Usage

1. Select text on any page.
2. Press **Alt+Shift+S**, or click the extension icon and hit
   *Share selection as one-time link* in the popup.
3. The one-time link is now in your clipboard — a toast confirms it.

The popup also holds the settings: target server and the keyboard shortcut
(remappable via `chrome://extensions/shortcuts`).

Default target server is `https://1time.io`. To use a self-hosted instance,
enter its origin in the popup (e.g. `https://secrets.example.com` or
`http://127.0.0.1:8080` for local development) and save — Chrome will ask
for host access to that origin once. Links expire after one day or on first read.

## Development

- `protocol.mjs` is a synced copy of `frontend/src/lib/protocol.mjs` — never
  edit it here. Change the source and run `node scripts/sync-protocol.mjs`.
- `background.js` — service worker: reads the selection, encrypts, calls
  `POST /api/saveSecret`, injects the clipboard write + toast into the page.
- `popup.html` / `popup.js` — toolbar popup in the 1time.io look: share button,
  target server + host permission handling, shortcut display. Also serves as
  the options page.
- Smoke test against a running local backend:

  ```bash
  node scripts/smoke-test.mjs http://127.0.0.1:8080
  ```

## Packaging

```powershell
Compress-Archive -Path manifest.json, background.js, settings.mjs, protocol.mjs, popup.html, popup.js, bricolage-grotesque-latin-wght-normal.woff2, icons -DestinationPath 1time-extension.zip -Force
```

Note: shortcuts only fire on regular web pages — Chrome blocks script
injection on `chrome://` pages and the Chrome Web Store.
