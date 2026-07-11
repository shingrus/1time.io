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
        func: () => String(window.getSelection()),
    });

    return injection?.result ?? '';
}

// Runs inside the page: copies the link (if any) and shows a short toast.
// The clipboard write happens in the tab because the service worker has no
// DOM and no reliable clipboard access.
function deliverToPage(message, link) {
    const showToast = (text) => {
        const toast = document.createElement('div');
        toast.textContent = text;
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
    };

    if (!link) {
        showToast(message);
        return;
    }

    const copyViaTextarea = () => {
        const area = document.createElement('textarea');
        area.value = link;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.documentElement.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        return copied;
    };

    navigator.clipboard.writeText(link).then(
        () => showToast(message),
        () => showToast(copyViaTextarea() ? message : `Could not access the clipboard. Link: ${link}`),
    );
}

function notify(tabId, message, link = null) {
    return chrome.scripting.executeScript({
        target: {tabId},
        func: deliverToPage,
        args: [message, link],
    });
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

async function shareSelection(tab) {
    if (!tab?.id) {
        return;
    }

    try {
        const selection = await readSelection(tab.id);
        if (!selection.trim()) {
            await notify(tab.id, 'Select some text first, then press the shortcut again.');
            return;
        }

        const {host, expiresInSeconds} = await chrome.storage.sync.get(SettingsDefaults);
        const origin = normalizeOrigin(host);

        const granted = await chrome.permissions.contains({origins: [`${origin}/*`]});
        if (!granted) {
            await notify(tab.id, `Grant access to ${origin} in the extension options first.`);
            chrome.runtime.openOptionsPage();
            return;
        }

        const link = await createOneTimeLink(origin, selection, expiresInSeconds);
        await notify(tab.id, 'One-time link copied to your clipboard.', link);
    } catch (error) {
        // On restricted pages (chrome://, Web Store) even the toast injection
        // fails — nothing more we can do there.
        await notify(tab.id, `1time: ${error.message}`).catch(() => {});
    }
}

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
