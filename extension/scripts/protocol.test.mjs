// Self-contained (no backend) proof that the synced protocol.mjs still
// round-trips and that the link format matches /v/. `pretest` re-syncs the
// copy first, so a stale protocol.mjs is caught here. For an end-to-end check
// against a running backend, use scripts/smoke-test.mjs instead.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ProtocolConstants,
    buildSecretLink,
    decryptSecretMessage,
    encryptSecretMessage,
    getRandomString,
    hashSecretKey,
    normalizeOrigin,
    parseSecretLink,
} from '../protocol.mjs';

test('encrypt -> decrypt round-trips and the auth hash is stable', async () => {
    const secret = `unit ${getRandomString(12)}`;
    const key = getRandomString(ProtocolConstants.randomKeyLen);
    const {encryptedMessage, hashedKey} = await encryptSecretMessage(secret, key);

    assert.equal(await hashSecretKey(key), hashedKey);
    assert.equal(await decryptSecretMessage(encryptedMessage, key), secret);
});

test('secret link parses back to its key and id', () => {
    const key = getRandomString(ProtocolConstants.randomKeyLen);
    const id = 'abc123';
    const parsed = parseSecretLink(buildSecretLink('https://1time.io', key, id));

    assert.equal(parsed.randomKey, key);
    assert.equal(parsed.id, id);
});

test('normalizeOrigin allows loopback http but rejects public http', () => {
    assert.equal(normalizeOrigin('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
    assert.throws(() => normalizeOrigin('http://example.com'));
});
