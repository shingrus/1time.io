import {
    ProtocolConstants,
    buildApiUrl,
    buildSecretLink,
    encryptSecretMessage,
    getRandomString,
    normalizeOrigin,
} from './protocol.mjs';
import {SettingsDefaults} from './settings.mjs';

async function readSelection(tabId) {
    const [injection] = await chrome.scripting.executeScript({
        target: {tabId},
        // window.getSelection() ignores text selected inside <input>/<textarea>,
        // so check the focused field first — that covers "share what I just
        // typed", including password fields.
        func: () => {
            const active = document.activeElement;
            if (active
                && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
                && typeof active.selectionStart === 'number'
                && active.selectionStart !== active.selectionEnd) {
                return active.value.slice(active.selectionStart, active.selectionEnd);
            }

            return String(window.getSelection());
        },
    });

    return injection?.result ?? '';
}

// Runs inside the page: shows a short, generic status toast. It deliberately
// never receives the secret link. An isolated-world script shares the page's
// DOM, so anything rendered here — or any element inserted here — is readable
// by page JavaScript. The link (and its secret key fragment) must never reach
// the page; the clipboard write happens in an offscreen document instead.
function deliverToPage(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: '2147483647',
        maxWidth: '360px',
        padding: '10px 14px',
        background: '#16181d',
        color: '#fff',
        font: '13px/1.4 system-ui, sans-serif',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        wordBreak: 'break-all',
    });
    document.documentElement.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function notify(tabId, message) {
    return chrome.scripting.executeScript({
        target: {tabId},
        func: deliverToPage,
        args: [message],
    });
}

// The clipboard write runs in an extension-owned offscreen document, not in the
// page. The service worker has no DOM of its own, and injecting the link into
// the tab would expose the secret fragment to page scripts through the shared
// DOM. The offscreen document is a private extension context the page cannot
// observe.
async function ensureOffscreenDocument() {
    const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
    });

    if (contexts.length === 0) {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['CLIPBOARD'],
            justification: 'Copy the one-time link to the clipboard without exposing it to the page.',
        });
    }
}

async function copyToClipboard(text) {
    await ensureOffscreenDocument();
    const copied = await chrome.runtime.sendMessage({target: 'offscreen', type: 'copy', data: text});

    return copied === true;
}

async function createOneTimeLink(origin, secret, expiresInSeconds) {
    const randomKey = getRandomString(ProtocolConstants.randomKeyLen);
    const {encryptedMessage, hashedKey} = await encryptSecretMessage(secret, randomKey);

    const response = await fetch(buildApiUrl(origin, 'saveSecret'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            secretMessage: encryptedMessage,
            hashedKey,
            duration: expiresInSeconds,
        }),
    });

    if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== 'ok' || !data.newId) {
        throw new Error('The server rejected the secret');
    }

    return buildSecretLink(origin, randomKey, data.newId);
}

// presetSelection is supplied by the context menu (info.selectionText), which
// already resolves selections inside iframes. Reading via chrome.scripting only
// targets the top frame, so it would miss those — use the preset when we have it.
async function shareSelection(tab, presetSelection) {
    if (!tab?.id) {
        return;
    }

    try {
        const selection = presetSelection ?? await readSelection(tab.id);
        if (!selection.trim()) {
            await notify(tab.id, 'Select some text first, then press the shortcut again.');
            return;
        }

        const {host, expiresInSeconds} = await chrome.storage.local.get(SettingsDefaults);
        const origin = normalizeOrigin(host);

        const granted = await chrome.permissions.contains({origins: [`${origin}/*`]});
        if (!granted) {
            await notify(tab.id, `Grant access to ${origin} in the extension options first.`);
            chrome.runtime.openOptionsPage();
            return;
        }

        const link = await createOneTimeLink(origin, selection, expiresInSeconds);
        // Keep the link in session storage (in-memory, never on disk, never
        // synced, not readable by pages) so the popup can show and re-copy it.
        await chrome.storage.session.set({lastLink: link});

        const copied = await copyToClipboard(link);
        await notify(
            tab.id,
            copied
                ? 'One-time link copied to your clipboard.'
                : 'Link created — open the 1time popup to copy it.',
        );
    } catch (error) {
        // On restricted pages (chrome://, Web Store) even the toast injection
        // fails — nothing more we can do there.
        await notify(tab.id, `1time: ${error.message}`).catch(() => {});
    }
}

const CONTEXT_MENU_ID = 'share-selection';

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: 'Share as one-time link',
        contexts: ['selection'],
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
        shareSelection(tab, info.selectionText);
    }
});

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'share-selection') {
        shareSelection(tab);
    }
});

// Sent by the popup's share button; the popup closes itself right away, so
// the tab lookup and the toast happen here.
chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'share-selection') {
        chrome.tabs.query({active: true, lastFocusedWindow: true})
            .then(([tab]) => shareSelection(tab));
    }
});
