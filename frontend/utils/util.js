export var Constants = {
    randomKeyLen: 12,
    defaultDuration: 7,
    isDebug: process.env.NODE_ENV === 'development',
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "/api/",
};

const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
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

async function sha256Bytes(value) {
    const crypto = requireWebCrypto();
    const hashBuffer = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
    return new Uint8Array(hashBuffer);
}

async function importSecretKey(fullSecretKey) {
    const crypto = requireWebCrypto();
    const keyBytes = await sha256Bytes(fullSecretKey);

    return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
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
    const secretKey = await importSecretKey(fullSecretKey);
    const encryptedBuffer = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv},
        secretKey,
        textEncoder.encode(secretMessage),
    );
    const hashedKey = bytesToHex(await sha256Bytes(fullSecretKey));

    return {
        encryptedMessage: `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encryptedBuffer))}`,
        hashedKey,
    };
}

export async function hashSecretKey(fullSecretKey) {
    return bytesToHex(await sha256Bytes(fullSecretKey));
}

export async function decryptSecretMessage(cryptedMessage, fullSecretKey) {
    const crypto = requireWebCrypto();
    const [version, encodedIv, encodedMessage] = cryptedMessage.split('.');

    if (version !== 'v1' || !encodedIv || !encodedMessage) {
        throw new Error('Unsupported encrypted message format');
    }

    const secretKey = await importSecretKey(fullSecretKey);
    const decryptedBuffer = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: fromBase64Url(encodedIv)},
        secretKey,
        fromBase64Url(encodedMessage),
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
