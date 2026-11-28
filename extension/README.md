# 1time Chrome Extension

Select text on any page, press a shortcut, and a zero-knowledge one-time link
lands in your clipboard. The text is AES-256-GCM-encrypted locally before
upload; the target server only ever sees ciphertext and the derived auth hash.
The decryption key stays in the URL fragment, exactly like the web app.

## Install (unpacked)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this `extension/` directory.

## Usage

1. Select text on any page — including inside inputs and textareas.
2. Press **Alt+Shift+S**, or right-click the selection → *Share as one-time link*.
3. The one-time link is now in your clipboard — a toast confirms it.

You can also type or paste a secret into the popup's text form and press
**Create one-time link** (Ctrl/Cmd+Enter works too). Choose how long the link
lives and how many views it allows (1 to 10), and optionally add a passphrase:
it is mixed into the encryption key but never put in the link, so readers are
asked for it on the page. Whatever you type is kept as a draft in session
memory until the link is created or the browser closes; the passphrase is never
stored.

Your most recently created link is also shown in the popup's **Last link** card,
where you can re-copy or clear it. It's held in session memory only (gone when
you close the browser) and never touches any web page.

The folded **Settings** section of the popup (open by default on the options
page) holds the target server and the keyboard shortcut (remappable via
`chrome://extensions/shortcuts`). Link expiry sits in the text form and also
applies to the shortcut and context-menu flow.

Default target server is `https://1time.io`. To use a self-hosted instance,
enter its origin in the popup (e.g. `https://secrets.example.com` or
`http://127.0.0.1:8080` for local development) — settings apply as you change
them, and Chrome asks for host access to that origin once. Links expire on
first read, or after the chosen lifetime (1 hour to 30 days; default five days).

## Development

- `protocol.mjs` is a synced copy of `frontend/src/lib/protocol.mjs` — never
  edit it here. Change the source and run `npm run sync:protocol`.
- `background.js` — service worker: reads the selection (or takes the popup's
  `create-secret` message with text, passphrase and views), encrypts, calls
  `POST /api/saveSecret`, copies the link via the offscreen document, and
  injects a generic status toast into the page. Registers the keyboard command
  and the selection context-menu item.
- `offscreen.html` / `offscreen.js` — extension-owned document that performs the
  clipboard write. The secret link is copied here, never in the page DOM, so
  page scripts cannot read it.
- `popup.html` / `popup.js` — toolbar popup in the 1time.io look: last-link card
  (read from `chrome.storage.session`), text form (draft kept in
  `chrome.storage.session`), expiry and views selects, optional passphrase,
  and a folded Settings section with target server +
  host permission handling and shortcut display. Also serves as the options
  page (`popup.html?options`, Settings expanded). Preferences use `chrome.storage.local`, never `sync`.
- `npm test` re-syncs the protocol copy and runs an offline round-trip test
  (`scripts/protocol.test.mjs`). `npm run check:sync` fails if the committed
  `protocol.mjs` has drifted from the source — wire it into CI to guard drift.
- Smoke test against a running local backend:

  ```bash
  node scripts/smoke-test.mjs http://127.0.0.1:8080
  ```

## Packaging

```powershell
Compress-Archive -Path manifest.json, background.js, offscreen.html, offscreen.js, settings.mjs, protocol.mjs, popup.html, popup.js, bricolage-grotesque-latin-wght-normal.woff2, icons -DestinationPath 1time-extension.zip -Force
```

Note: shortcuts only fire on regular web pages — Chrome blocks script
injection on `chrome://` pages and the Chrome Web Store.
