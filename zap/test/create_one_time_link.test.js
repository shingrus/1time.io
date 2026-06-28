const {test} = require('node:test');
const assert = require('node:assert/strict');

globalThis.crypto ??= require('node:crypto').webcrypto;

const create = require('../creates/create_one_time_link');
const {parseSecretLink, decryptSecretMessage} = require('../lib/protocol.js');

// Run perform() with a fake `z` (no network): capture the ciphertext it would
// POST, then decrypt it using the key parsed back out of the returned link.
// If this round-trips, the Zapier action is byte-compatible with the website's
// /v/ viewer.
function fakeZ(captured) {
    return {
        request: async (opts) => {
            captured.body = opts.body;
            return {data: {status: 'ok', newId: 'NEWID123'}};
        },
        errors: {Error: class ZError extends Error {}},
    };
}

test('produces a link whose secret decrypts (no passphrase)', async () => {
    const captured = {};
    const out = await create.operation.perform(fakeZ(captured), {
        inputData: {secret: 'hunter2-correct-horse', duration_days: 1},
    });

    assert.match(out.link, /\/v\/#.+NEWID123$/);
    assert.equal(captured.body.duration, 86400); // days -> seconds

    const {randomKey} = parseSecretLink(out.link);
    const decrypted = await decryptSecretMessage(captured.body.secretMessage, randomKey);
    assert.equal(decrypted, 'hunter2-correct-horse');
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
