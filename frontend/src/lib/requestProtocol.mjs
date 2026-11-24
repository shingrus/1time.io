import {
    ProtocolConstants,
    encryptSecretMessage,
    getRandomString,
    hashReadToken,
    hashSecretKey,
    normalizeOrigin,
    toBase64Url,
} from './protocol.mjs';

const hkdfSalt = 'onetimelink:request:v2';
const textEncoder = new TextEncoder();
const base64UrlAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const dayMs = 86400000;
const expiryDays = 3968;
const expiryLowBase = 62;
const expiryCodeLen = 2;
const requestKeyLen = ProtocolConstants.randomKeyLen + expiryCodeLen;
const expiryWindowDays = 10;

function expiryCode(now, durationSeconds) {
    const day = Math.ceil((now + durationSeconds * 1000) / dayMs) % expiryDays;
    return base64UrlAlphabet[Math.floor(day / expiryLowBase)] + base64UrlAlphabet[day % expiryLowBase];
}

export function isRequestLinkExpired(requestKey, now = Date.now()) {
    const code = String(requestKey).slice(-expiryCodeLen);
    const high = base64UrlAlphabet.indexOf(code[0]);
    const low = base64UrlAlphabet.indexOf(code[1]);
    if (high < 0 || low < 0 || low >= expiryLowBase) return true;
    const day = high * expiryLowBase + low;
    const distance = (((day - Math.floor(now / dayMs)) % expiryDays) + expiryDays) % expiryDays;
    return !(distance <= expiryWindowDays || distance === expiryDays - 1);
}

async function deriveRequestBits(requestKey, info, bytes) {
    const crypto = globalThis.crypto;
    const baseKey = await crypto.subtle.importKey('raw', textEncoder.encode(requestKey), 'HKDF', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        {name: 'HKDF', hash: 'SHA-256', salt: textEncoder.encode(hkdfSalt), info: textEncoder.encode(info)},
        baseKey,
        bytes * 8,
    );

    return new Uint8Array(bits);
}

export async function deriveRequestAuth(requestKey) {
    const answerBytes = await deriveRequestBits(requestKey, 'answer', 32);

    return {
        id: toBase64Url(await deriveRequestBits(requestKey, 'id', 17)),
        answerToken: Array.from(answerBytes, (byte) => byte.toString(16).padStart(2, '0')).join(''),
    };
}

export async function createRequestKeys(durationSeconds, now = Date.now()) {
    const requestKey = getRandomString(ProtocolConstants.randomKeyLen) + expiryCode(now, durationSeconds);
    const requesterKey = getRandomString(ProtocolConstants.randomKeyLen);
    const {id, answerToken} = await deriveRequestAuth(requestKey);
    const readToken = await hashSecretKey(requesterKey);

    return {
        requestKey,
        requesterKey,
        id,
        answerTokenHash: await hashReadToken(answerToken),
        readToken,
        readTokenHash: await hashReadToken(readToken),
    };
}

export async function encryptRequestAnswer(message, requestKey) {
    return (await encryptSecretMessage(message, requestKey)).encryptedMessage;
}

export function buildRequestLink(origin, requestKey) {
    return `${normalizeOrigin(origin)}/r/#${requestKey}`;
}

function isValidRequestToken(token) {
    const s = String(token ?? '');
    return s.length === requestKeyLen && /^[A-Za-z0-9_-]+$/.test(s);
}

export function parseRequestLink(link, fallbackHost = ProtocolConstants.defaultHost) {
    const trimmed = String(link || '').trim();
    if (!trimmed) {
        throw new Error('Request link is required');
    }

    let origin = normalizeOrigin(fallbackHost);
    let token = trimmed;

    if (trimmed.includes('://')) {
        const parsed = new URL(trimmed);
        origin = normalizeOrigin(`${parsed.protocol}//${parsed.host}`);
        token = parsed.hash.slice(1);
    } else if (trimmed.startsWith('#')) {
        token = trimmed.slice(1);
    }

    if (!isValidRequestToken(token)) {
        throw new Error('Invalid request link');
    }

    return {origin, requestKey: token};
}
