export const ProtocolConstants = {
    randomKeyLen: 20,
    defaultDuration: 1,
    defaultHost: '1time.io',
    hkdfSalt: 'onetimelink:v2',
    hkdfEncryptInfo: 'encrypt',
    hkdfAuthInfo: 'auth',
};

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
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
    if (typeof btoa === 'function') {
        let binary = '';

        for (let i = 0; i < bytes.length; i += 0x8000) {
            const chunk = bytes.subarray(i, i + 0x8000);
            binary += String.fromCharCode(...chunk);
        }

        return btoa(binary);
    }

    return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(base64) {
    if (typeof atob === 'function') {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return bytes;
    }

    return new Uint8Array(Buffer.from(base64, 'base64'));
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
        salt: textEncoder.encode(ProtocolConstants.hkdfSalt),
        info: textEncoder.encode(info),
    };
}

async function deriveSecretKey(fullSecretKey) {
    const crypto = requireWebCrypto();
    const baseKey = await deriveHkdfBaseKey(fullSecretKey);

    return crypto.subtle.deriveKey(
        getHkdfParams(ProtocolConstants.hkdfEncryptInfo),
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
        getHkdfParams(ProtocolConstants.hkdfAuthInfo),
        baseKey,
        256,
    );

    return bytesToHex(new Uint8Array(authBits));
}

function isLoopbackHostname(hostname) {
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';
}

export function normalizeOrigin(hostOrOrigin = ProtocolConstants.defaultHost) {
    const trimmed = String(hostOrOrigin || '').trim();
    if (!trimmed) {
        throw new Error('Host is required');
    }

    const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }

    if (parsed.protocol === 'http:' && !isLoopbackHostname(parsed.hostname)) {
        throw new Error('HTTP is only allowed for loopback hosts');
    }

    return `${parsed.protocol}//${parsed.host}`;
}

export function buildApiUrl(origin, path) {
    const normalizedPath = String(path || '').replace(/^\/+/, '');
    return `${normalizeOrigin(origin)}/api/${normalizedPath}`;
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

    if (!encodedIv || !encodedMessage) {
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

export function buildSecretLink(origin, randomString, newId) {
    return `${normalizeOrigin(origin)}/v/#${randomString}${newId}`;
}

export function parseSecretLink(link, fallbackHost = ProtocolConstants.defaultHost) {
    const trimmed = String(link || '').trim();
    if (!trimmed) {
        throw new Error('Secret link is required');
    }

    let origin = normalizeOrigin(fallbackHost);
    let token = trimmed;

    if (trimmed.includes('://')) {
        const parsed = new URL(trimmed);
        origin = normalizeOrigin(`${parsed.protocol}//${parsed.host}`);
        if (parsed.hash && parsed.hash.length > 1) {
            token = parsed.hash.slice(1);
        } else if (parsed.pathname.startsWith('/v/')) {
            token = parsed.pathname.slice(3).replace(/\/$/, '');
        } else {
            throw new Error('Unsupported secret link format');
        }
    } else if (trimmed.startsWith('/v/')) {
        token = trimmed.slice(3).replace(/\/$/, '');
    } else if (trimmed.startsWith('#')) {
        token = trimmed.slice(1);
    }

    if (!token || token.length <= ProtocolConstants.randomKeyLen) {
        throw new Error('Invalid secret link');
    }

    return {
        origin,
        token,
        randomKey: token.slice(0, ProtocolConstants.randomKeyLen),
        id: token.slice(ProtocolConstants.randomKeyLen),
    };
}
