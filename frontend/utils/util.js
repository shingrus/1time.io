export var Constants = {
    randomKeyLen: 16,
    defaultDuration: 1,
    isDebug: process.env.NODE_ENV === 'development',
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "/api/",
    hkdfSalt: 'onetimelink:v2',
    hkdfEncryptInfo: 'encrypt',
    hkdfAuthInfo: 'auth',
};

const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const randomCharLimit = 256 - (256 % chars.length);

function requireWebCrypto() {
    if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
        throw new Error('Web Crypto API is unavailable');
    }

    return globalThis.crypto;
}

function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
    let binary = '';

    for (let i = 0; i < bytes.length; i += 0x8000) {
        const chunk = bytes.subarray(i, i + 0x8000);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function toBase64Url(bytes) {
    return bytesToBase64(bytes)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function fromBase64Url(base64Url) {
    const padding = (4 - (base64Url.length % 4)) % 4;
    const base64 = base64Url
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        + '='.repeat(padding);

    return base64ToBytes(base64);
}

async function deriveHkdfBaseKey(fullSecretKey) {
    const crypto = requireWebCrypto();

    return crypto.subtle.importKey(
        'raw',
        textEncoder.encode(fullSecretKey),
        'HKDF',
        false,
        ['deriveBits', 'deriveKey'],
    );
}

function getHkdfParams(info) {
    return {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: textEncoder.encode(Constants.hkdfSalt),
        info: textEncoder.encode(info),
    };
}

async function deriveSecretKey(fullSecretKey) {
    const crypto = requireWebCrypto();
    const baseKey = await deriveHkdfBaseKey(fullSecretKey);

    return crypto.subtle.deriveKey(
        getHkdfParams(Constants.hkdfEncryptInfo),
        baseKey,
        {name: 'AES-GCM', length: 256},
        false,
        ['encrypt', 'decrypt'],
    );
}

async function deriveAuthToken(fullSecretKey) {
    const crypto = requireWebCrypto();
    const baseKey = await deriveHkdfBaseKey(fullSecretKey);
    const authBits = await crypto.subtle.deriveBits(
        getHkdfParams(Constants.hkdfAuthInfo),
        baseKey,
        256,
    );

    return bytesToHex(new Uint8Array(authBits));
}

export function getRandomString(stringLen) {
    const crypto = requireWebCrypto();
    const randomBytes = new Uint8Array(Math.max(16, stringLen * 2));
    let randomString = '';

    while (randomString.length < stringLen) {
        crypto.getRandomValues(randomBytes);

        for (const byte of randomBytes) {
            if (byte >= randomCharLimit) {
                continue;
            }

            randomString += chars[byte % chars.length];
            if (randomString.length === stringLen) {
                break;
            }
        }
    }

    return randomString;
}

export async function encryptSecretMessage(secretMessage, fullSecretKey) {
    const crypto = requireWebCrypto();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptKey = await deriveSecretKey(fullSecretKey);
    const encryptedBuffer = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv},
        encryptKey,
        textEncoder.encode(secretMessage),
    );
    const hashedKey = await deriveAuthToken(fullSecretKey);

    return {
        encryptedMessage: `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encryptedBuffer))}`,
        hashedKey,
    };
}

export async function hashSecretKey(fullSecretKey) {
    return deriveAuthToken(fullSecretKey);
}

export async function decryptSecretMessage(cryptedMessage, fullSecretKey) {
    const crypto = requireWebCrypto();
    const [encodedIv, encodedMessage] = cryptedMessage.split('.');

    if (!encodedIv || !encodedMessage ) {
        throw new Error('Unsupported encrypted message format');
    }

    const iv = fromBase64Url(encodedIv);
    const encryptedMessage = fromBase64Url(encodedMessage);

    const decryptKey = await deriveSecretKey(fullSecretKey);
    const decryptedBuffer = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv},
        decryptKey,
        encryptedMessage,
    );

    return textDecoder.decode(decryptedBuffer);
}

export function buildSecretLink(randomString, newId) {
    return `${window.location.origin}/v/#${randomString}${newId}`;
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
