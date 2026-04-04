import {
    ProtocolConstants,
    buildSecretLink as buildProtocolSecretLink,
    decryptSecretMessage,
    encryptSecretMessage,
    getRandomString,
    hashSecretKey,
} from './protocol.mjs';

export var Constants = {
    ...ProtocolConstants,
    isDebug: process.env.NODE_ENV === 'development',
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "/api/",
    maxFileSizeBytes: 10 * 1024 * 1024,
};

export const SHARE_DURATION_OPTIONS = [
    {value: 1, label: '1 day'},
    {value: 3, label: '3 days'},
    {value: 7, label: '7 days'},
    {value: 30, label: '30 days'},
];

export {decryptSecretMessage, encryptSecretMessage, getRandomString, hashSecretKey};

export function buildSecretLink(randomString, newId) {
    return buildProtocolSecretLink(window.location.origin, randomString, newId);
}

export async function createSecretLink(secretMessage, options = {}) {
    const {secretKey = '', durationDays = Constants.defaultDuration} = options;

    if (!secretMessage) {
        throw new Error('Secret message is required');
    }

    const randomKey = getRandomString(Constants.randomKeyLen);
    const fullSecretKey = secretKey + randomKey;
    const {encryptedMessage, hashedKey} = await encryptSecretMessage(secretMessage, fullSecretKey);

    const data = await postJson('saveSecret', {
        secretMessage: encryptedMessage,
        hashedKey,
        duration: durationDays * 86400,
    });

    if (data.status !== 'ok' || !data.newId) {
        throw new Error('Failed to create secret link');
    }

    return {
        randomKey,
        newId: data.newId,
        link: buildSecretLink(randomKey, data.newId),
    };
}

export async function postJson(path, payload) {
    const response = await fetch(`${Constants.apiBaseUrl}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
}

export function getStatsPageName(path) {
    if (!path || path === '/') {
        return 'home';
    }

    const normalizedPath = path.replace(/^\/+/, '').replace(/\/+$/, '');

    if (!normalizedPath || normalizedPath === 'about' || normalizedPath === 'v') {
        return null;
    }

    if (normalizedPath === 'blog' || normalizedPath.startsWith('blog/')) {
        return 'blog';
    }

    if (
        normalizedPath === 'passphrase-generator' ||
        normalizedPath.includes('password') ||
        normalizedPath === 'create-password-14-symbols'
    ) {
        return 'password';
    }

    if (normalizedPath === 'api-key-generator') {
        return 'password';
    }

    return null;
}

export function sendStatsPing(page) {
    if (!page || typeof window === 'undefined') {
        return;
    }

    void fetch(`${Constants.apiBaseUrl}stat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({page}),
        keepalive: true,
    }).catch(() => {});
}

export async function copyTextToClipboard(text) {
    if (!text) {
        return false;
    }

    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {}
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';

    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch (error) {}

    document.body.removeChild(textArea);
    return copied;
}
