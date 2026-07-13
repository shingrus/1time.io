import {normalizeOrigin} from './protocol.mjs';
import {SettingsDefaults} from './settings.mjs';

// The required, manifest-declared host permission — never revoke this one.
const DEFAULT_ORIGIN = normalizeOrigin(SettingsDefaults.host);

const hostInput = document.getElementById('host');
const expirySelect = document.getElementById('expiry');
const status = document.getElementById('status');

const lastLinkSection = document.getElementById('last-link');
const lastLinkInput = document.getElementById('last-link-input');
const lastLinkStatus = document.getElementById('last-link-status');

function showStatus(text, ok) {
    status.textContent = text;
    status.className = ok ? 'ok' : 'error';
}

// The most recently created link, kept in session storage by the background
// worker. It's an extension-owned surface, so showing it here doesn't expose
// the secret fragment to any web page.
async function renderLastLink() {
    const {lastLink} = await chrome.storage.session.get('lastLink');
    lastLinkInput.value = lastLink ?? '';
    lastLinkSection.hidden = !lastLink;
    lastLinkStatus.textContent = '';
}

await renderLastLink();

// storage.local, not sync: preferences must not travel through Chrome Sync — a
// self-hosted hostname can itself be sensitive, and Sync is not zero-knowledge.
const {host, expiresInSeconds} = await chrome.storage.local.get(SettingsDefaults);
hostInput.value = host;
expirySelect.value = String(expiresInSeconds);

const commands = await chrome.commands.getAll();
const shareCommand = commands.find((command) => command.name === 'share-selection');
if (shareCommand?.shortcut) {
    document.getElementById('shortcut').textContent = shareCommand.shortcut;
    document.getElementById('shortcut-current').textContent = shareCommand.shortcut;
}

document.getElementById('share').addEventListener('click', () => {
    // The background worker reads the selection from the page and shows the
    // result toast there; close the popup so the toast is visible. The created
    // link is saved to session storage and appears here on the next open.
    chrome.runtime.sendMessage({type: 'share-selection'});
    window.close();
});

lastLinkInput.addEventListener('focus', () => lastLinkInput.select());

document.getElementById('copy-last').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(lastLinkInput.value);
        lastLinkStatus.textContent = 'Copied!';
        lastLinkStatus.className = 'ok';
    } catch {
        lastLinkInput.select();
        lastLinkStatus.textContent = 'Press Ctrl/Cmd+C to copy';
        lastLinkStatus.className = 'error';
    }
});

document.getElementById('clear-last').addEventListener('click', async () => {
    await chrome.storage.session.remove('lastLink');
    await renderLastLink();
});

// The host needs an explicit Save: chrome.permissions.request requires a live
// user gesture, and a toolbar popup can close on blur before a `change` event
// commits. The button click is that gesture, and we await both the permission
// grant and the storage write before reporting success.
document.getElementById('save-host').addEventListener('click', async () => {
    let origin;
    try {
        origin = normalizeOrigin(hostInput.value);
    } catch (error) {
        showStatus(error.message, false);
        return;
    }

    const granted = await chrome.permissions.request({origins: [`${origin}/*`]});
    if (!granted) {
        showStatus(`Permission for ${origin} was declined.`, false);
        return;
    }

    const {host: previous} = await chrome.storage.local.get(SettingsDefaults);
    await chrome.storage.local.set({host: origin});
    hostInput.value = origin;

    // Drop access to the server we just switched away from so grants don't
    // accumulate — but never the required 1time.io permission.
    if (previous && previous !== origin && previous !== DEFAULT_ORIGIN) {
        await chrome.permissions.remove({origins: [`${previous}/*`]}).catch(() => {});
    }

    showStatus('Saved.', true);
});

// Expiry has no permission or focus concern — a select commits reliably in the
// open popup — so it applies on change.
expirySelect.addEventListener('change', async () => {
    await chrome.storage.local.set({expiresInSeconds: Number(expirySelect.value)});
    showStatus('Saved.', true);
});

document.getElementById('edit-shortcut').addEventListener('click', () => {
    chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
});
