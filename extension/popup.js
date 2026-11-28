import {normalizeOrigin} from './protocol.mjs';
import {SettingsDefaults} from './settings.mjs';

// The required, manifest-declared host permission — never revoke this one.
const DEFAULT_ORIGIN = normalizeOrigin(SettingsDefaults.host);

const hostInput = document.getElementById('host');
const expirySelect = document.getElementById('expiry');
const status = document.getElementById('status');

const settings = document.getElementById('settings');
settings.open = location.search.includes('options');

const createForm = document.getElementById('create-form');
const secretText = document.getElementById('secret-text');
const viewsSelect = document.getElementById('views');
const passphraseInput = document.getElementById('passphrase');
const addPassphraseButton = document.getElementById('add-passphrase');
const createButton = document.getElementById('create');
const formStatus = document.getElementById('form-status');
let creating = false;

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

function showFormStatus(text, ok) {
    formStatus.textContent = text;
    formStatus.className = ok ? 'ok' : 'error';
}

function updateCreateButton() {
    createButton.disabled = creating || !secretText.value.trim();
    createButton.textContent = creating ? 'Encrypting…' : 'Create one-time link';
}

// storage.session: in memory only, cleared when the browser closes.
const {draft} = await chrome.storage.session.get('draft');
secretText.value = draft ?? '';
updateCreateButton();
secretText.focus();

secretText.addEventListener('input', () => {
    updateCreateButton();
    chrome.storage.session.set({draft: secretText.value});
});

secretText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        createForm.requestSubmit();
    }
});

addPassphraseButton.addEventListener('click', () => {
    addPassphraseButton.hidden = true;
    passphraseInput.hidden = false;
    passphraseInput.focus();
});

createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (creating || !secretText.value.trim()) {
        return;
    }

    creating = true;
    updateCreateButton();
    showFormStatus('', true);

    let reply;
    try {
        reply = await chrome.runtime.sendMessage({
            type: 'create-secret',
            text: secretText.value,
            passphrase: passphraseInput.value,
            views: Number(viewsSelect.value),
        });
    } catch (error) {
        reply = {ok: false, error: error.message};
    }

    creating = false;

    if (!reply?.ok) {
        updateCreateButton();
        showFormStatus(reply?.error ?? 'Something went wrong.', false);
        return;
    }

    secretText.value = '';
    passphraseInput.value = '';
    passphraseInput.hidden = true;
    addPassphraseButton.hidden = false;
    viewsSelect.value = '1';
    updateCreateButton();
    await renderLastLink();
    lastLinkStatus.textContent = reply.copied ? 'Copied!' : 'Press Ctrl/Cmd+C to copy';
    lastLinkStatus.className = reply.copied ? 'ok' : 'error';
    if (!reply.copied) {
        lastLinkInput.select();
    }
});

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
expirySelect.addEventListener('change', () => {
    chrome.storage.local.set({expiresInSeconds: Number(expirySelect.value)});
});

document.getElementById('edit-shortcut').addEventListener('click', () => {
    chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
});
