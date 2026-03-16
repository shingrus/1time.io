export var Constants = {
    randomKeyLen: 12,
    defaultDuration: 7,
    isDebug: import.meta.env.DEV,
    apiBaseUrl: "/api/",
};

let cryptoJSPromise;

const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
// create a key for symmetric encryption
// pass in the desired length of your key
export function getRandomString(stringLen) {
    let randomstring = '';

    for (let i = 0; i < stringLen; i++) {
        let rnum = Math.floor(Math.random() * chars.length);
        randomstring += chars[rnum];
    }
    return randomstring;
}

async function loadCryptoJS() {
    if (!cryptoJSPromise) {
        cryptoJSPromise = import('crypto-js').then((module) => module.default);
    }

    return cryptoJSPromise;
}

export function preloadCryptoJS() {
    void loadCryptoJS();
}

export async function encryptSecretMessage(secretMessage, fullSecretKey) {
    const CryptoJS = await loadCryptoJS();

    return {
        encryptedMessage: CryptoJS.AES.encrypt(secretMessage, fullSecretKey).toString(),
        hashedKey: CryptoJS.SHA256(fullSecretKey).toString(),
    };
}

export async function hashSecretKey(fullSecretKey) {
    const CryptoJS = await loadCryptoJS();
    return CryptoJS.SHA256(fullSecretKey).toString();
}

export async function decryptSecretMessage(cryptedMessage, fullSecretKey) {
    const CryptoJS = await loadCryptoJS();
    const decryptedData = CryptoJS.AES.decrypt(cryptedMessage, fullSecretKey);
    return decryptedData.toString(CryptoJS.enc.Utf8);
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
