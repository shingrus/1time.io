// Round-trips a secret through a running backend using the extension's
// protocol copy: encrypt -> saveSecret -> get -> decrypt. Verifies that the
// synced protocol.mjs and the API contract used by background.js still match.
//
// Usage: node scripts/smoke-test.mjs [host]   (default: http://127.0.0.1:8080)
import assert from 'node:assert/strict';
import {
    ProtocolConstants,
    buildApiUrl,
    buildSecretLink,
    decryptSecretMessage,
    encryptSecretMessage,
    getRandomString,
    hashSecretKey,
    normalizeOrigin,
    parseSecretLink,
} from '../protocol.mjs';

const origin = normalizeOrigin(process.argv[2] || 'http://127.0.0.1:8080');
const secret = `smoke-test ${getRandomString(8)}`;

const randomKey = getRandomString(ProtocolConstants.randomKeyLen);
const {encryptedMessage, hashedKey} = await encryptSecretMessage(secret, randomKey);

const saveResponse = await fetch(buildApiUrl(origin, 'saveSecret'), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        secretMessage: encryptedMessage,
        hashedKey,
        duration: 60,
    }),
});
assert.equal(saveResponse.ok, true, `saveSecret failed with ${saveResponse.status}`);
const saved = await saveResponse.json();
assert.equal(saved.status, 'ok');
assert.ok(saved.newId, 'saveSecret returned no id');

const link = buildSecretLink(origin, randomKey, saved.newId);
const parsed = parseSecretLink(link);
assert.equal(parsed.randomKey, randomKey);
assert.equal(parsed.id, saved.newId);

const getResponse = await fetch(buildApiUrl(parsed.origin, 'get'), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        id: parsed.id,
        hashedKey: await hashSecretKey(parsed.randomKey),
    }),
});
assert.equal(getResponse.ok, true, `get failed with ${getResponse.status}`);
const fetched = await getResponse.json();
assert.equal(fetched.status, 'ok');

const decrypted = await decryptSecretMessage(fetched.cryptedMessage, parsed.randomKey);
assert.equal(decrypted, secret);

console.log(`ok — round-tripped via ${origin}: ${link}`);
