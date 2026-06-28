// Older Node runtimes don't expose globalThis.crypto; protocol.js needs it.
globalThis.crypto ??= require('node:crypto').webcrypto;

const {
    getRandomString,
    encryptSecretMessage,
    buildSecretLink,
    ProtocolConstants,
} = require('../lib/protocol.js');

const ORIGIN = process.env.ONETIME_ORIGIN || 'https://1time.io';

// Mirrors frontend/src/lib/util.js -> createSecretLink(), with z.request in
// place of fetch. Encryption happens here (on Zapier), so the 1time server only
// ever receives ciphertext + the auth hash; the key stays in the URL fragment.
const perform = async (z, bundle) => {
    const {secret, passphrase, duration_days} = bundle.inputData;

    const randomKey = getRandomString(ProtocolConstants.randomKeyLen);
    const fullSecretKey = (passphrase || '') + randomKey; // passphrase first, then key
    const {encryptedMessage, hashedKey} = await encryptSecretMessage(secret, fullSecretKey);

    const response = await z.request({
        url: `${ORIGIN}/api/saveSecret`,
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: {
            secretMessage: encryptedMessage,
            hashedKey,
            duration: Number(duration_days || 1) * 86400, // API expects seconds
        },
    });

    const data = response.data;
    if (!data || data.status !== 'ok' || !data.newId || data.newId === '0') {
        throw new z.errors.Error('1time failed to store the secret', 'SaveFailed', 502);
    }

    return {
        link: buildSecretLink(ORIGIN, randomKey, data.newId), // ORIGIN/v/#<key><id>
        id: data.newId,
    };
};

module.exports = {
    key: 'create_one_time_link',
    noun: 'One-Time Link',
    display: {
        label: 'Create One-Time Link',
        description:
            'Encrypt text and get a self-destructing one-time link. Note: the secret is ' +
            'encrypted on Zapier’s servers, so this is NOT end-to-end zero-knowledge ' +
            '(unlike the 1time website, browser extension, or CLI).',
    },
    operation: {
        inputFields: [
            {
                key: 'secret',
                label: 'Secret',
                type: 'text',
                required: true,
                helpText: 'The sensitive text to share exactly once.',
            },
            {
                key: 'passphrase',
                label: 'Extra passphrase',
                type: 'string',
                required: false,
                helpText: 'Optional. The recipient must also know this to decrypt the secret.',
            },
            {
                key: 'duration_days',
                label: 'Expire after',
                type: 'integer',
                required: false,
                default: '1',
                choices: {1: '1 day', 3: '3 days', 7: '7 days', 30: '30 days'},
            },
        ],
        perform,
        sample: {link: 'https://1time.io/v/#xxxxxxxxxxxxxxxxxxxxNEWID', id: 'NEWID'},
        outputFields: [
            {key: 'link', label: 'One-Time Link'},
            {key: 'id', label: 'Secret ID'},
        ],
    },
};
