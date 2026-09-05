const {test} = require('node:test');
const assert = require('node:assert/strict');

globalThis.crypto ??= require('node:crypto').webcrypto;

const create = require('../creates/create_one_time_link');
const {createHash} = require('node:crypto');
const {parseSecretLink, decryptSecretMessage, hashSecretKey, ProtocolConstants} = require('../lib/protocol.js');

// Run perform() with a fake `z` (no network): capture the ciphertext it would
// POST, then decrypt it using the key parsed back out of the returned link.
// If this round-trips, the Zapier action is byte-compatible with the website's
// /v/ viewer.
function fakeZ(captured) {
    return {
        request: async (opts) => {
            captured.body = opts.body;
            // 22 base64url chars — the real id length parseSecretLink enforces.
            return {data: {status: 'ok', newId: 'NEWID123456789abcdefgh'}};
        },
        errors: {Error: class ZError extends Error {}},
    };
}

test('produces a link whose secret decrypts (no passphrase)', async () => {
    const captured = {};
    const out = await create.operation.perform(fakeZ(captured), {
        inputData: {secret: 'hunter2-correct-horse', duration_days: 1},
    });

    assert.match(out.link, /\/v\/#.+NEWID123456789abcdefgh$/);
    assert.equal(captured.body.duration, 86400); // days -> seconds

    const {randomKey} = parseSecretLink(out.link);
    const decrypted = await decryptSecretMessage(captured.body.secretMessage, randomKey);
    assert.equal(decrypted, 'hunter2-correct-horse');

    // v3: the upload carries SHA-256(readToken) and the scheme version, and must
    // NOT carry the read token itself — that is the whole point of the scheme.
    assert.equal(captured.body.v, ProtocolConstants.saveSchemeVersion);
    assert.equal(captured.body.hashedKey, undefined);
    assert.equal(
        captured.body.readTokenHash,
        createHash('sha256').update(await hashSecretKey(randomKey), 'utf8').digest('hex'),
    );
});

test('honors an extra passphrase (passphrase + key order)', async () => {
    const captured = {};
    const out = await create.operation.perform(fakeZ(captured), {
        inputData: {secret: 'db-password', passphrase: 'team-shared', duration_days: 7},
    });

    assert.equal(captured.body.duration, 7 * 86400);
    const {randomKey} = parseSecretLink(out.link);
    const decrypted = await decryptSecretMessage(captured.body.secretMessage, 'team-shared' + randomKey);
    assert.equal(decrypted, 'db-password');
});
