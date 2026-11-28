import assert from 'node:assert/strict';
import test from 'node:test';
import {ProtocolConstants, decryptSecretMessage, getRandomString, hashReadToken, hashSecretKey} from '../src/lib/protocol.mjs';
import {
    buildRequestLink,
    createRequestKeys,
    deriveRequestAuth,
    encryptRequestAnswer,
    isRequestLinkExpired,
    parseRequestLink,
} from '../src/lib/requestProtocol.mjs';

test('request answer round-trips and only the request key opens it', async () => {
    const keys = await createRequestKeys(3600);
    const stranger = await createRequestKeys(3600);
    const answer = await encryptRequestAnswer('p@ss wörd', keys.requestKey);

    assert.match(answer, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(await decryptSecretMessage(answer, keys.requestKey), 'p@ss wörd');
    await assert.rejects(decryptSecretMessage(answer, stranger.requestKey));
    assert.notEqual(answer, await encryptRequestAnswer('p@ss wörd', keys.requestKey));
});

test('request id is 23 base64url characters and stable for a key', async () => {
    const keys = await createRequestKeys(3600);
    const {id, answerToken} = await deriveRequestAuth(keys.requestKey);

    assert.match(id, /^[A-Za-z0-9_-]{23}$/);
    assert.equal(id, keys.id);
    assert.deepEqual(await deriveRequestAuth(keys.requestKey), {id, answerToken});
    assert.notEqual((await deriveRequestAuth(getRandomString(ProtocolConstants.randomKeyLen + 2))).id, id);
    assert.match(answerToken, /^[0-9a-f]{64}$/);
});

test('stored hashes match their derivations and the link cannot read', async () => {
    const keys = await createRequestKeys(3600);
    const {answerToken} = await deriveRequestAuth(keys.requestKey);

    assert.equal(keys.requestKey.length, ProtocolConstants.randomKeyLen + 2);
    assert.equal(keys.requesterKey.length, ProtocolConstants.randomKeyLen);
    assert.equal(keys.answerTokenHash, await hashReadToken(answerToken));
    assert.equal(keys.readTokenHash, await hashReadToken(await hashSecretKey(keys.requesterKey)));
    assert.notEqual(await hashReadToken(await hashSecretKey(keys.requestKey)), keys.readTokenHash);
    assert.notEqual(await hashSecretKey(keys.requestKey), answerToken);
});

test('request answer rejects tampered or malformed ciphertext', async () => {
    const {requestKey} = await createRequestKeys(3600);
    const [iv, ciphertext] = (await encryptRequestAnswer('x', requestKey)).split('.');
    const flipped = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);

    await assert.rejects(decryptSecretMessage(`${iv}.${flipped}`, requestKey));
    await assert.rejects(decryptSecretMessage(iv, requestKey));
});

test('request link is origin plus /r/# plus the 22-character key', async () => {
    const {requestKey} = await createRequestKeys(3600);
    const link = buildRequestLink('https://1time.io', requestKey);

    assert.equal(link, `https://1time.io/r/#${requestKey}`);
    assert.equal(link.length, 'https://1time.io/r/#'.length + 22);
    assert.deepEqual(parseRequestLink(link), {origin: 'https://1time.io', requestKey});
    for (let day = 0; day < 3968; day++) {
        assert.match((await createRequestKeys(86400, day * 86400000)).requestKey.at(-1), /[A-Za-z0-9]/);
    }
    assert.equal(parseRequestLink(`#${requestKey}`).requestKey, requestKey);
});

test('malformed request links are rejected', async () => {
    const {requestKey} = await createRequestKeys(3600);

    assert.throws(() => parseRequestLink(''));
    assert.throws(() => parseRequestLink('https://1time.io/r/'));
    assert.throws(() => parseRequestLink(`https://1time.io/r/#${requestKey.slice(1)}`));
    assert.throws(() => parseRequestLink(`https://1time.io/r/#${requestKey}A`));
    assert.throws(() => parseRequestLink(`https://1time.io/r/#${requestKey.slice(0, -1)}!`));
    assert.throws(() => parseRequestLink(`https://1time.io/r/#${requestKey.slice(0, -1)}+`));
});

const DAY = 86400000;

test('the expiry code is part of the key, so changing it changes id and answer token', async () => {
    const now = Date.UTC(2026, 10, 22, 12);
    const {requestKey} = await createRequestKeys(7 * 86400, now);
    const other = requestKey.slice(0, 20) + (requestKey.endsWith('AA') ? 'AB' : 'AA');

    assert.equal(requestKey.length, 22);
    assert.equal(other.length, 22);
    assert.notEqual(other, requestKey);
    assert.notEqual((await deriveRequestAuth(other)).id, (await deriveRequestAuth(requestKey)).id);
    assert.notEqual((await deriveRequestAuth(other)).answerToken, (await deriveRequestAuth(requestKey)).answerToken);
    assert.equal(await decryptSecretMessage(await encryptRequestAnswer('x', requestKey), requestKey), 'x');
});

test('a link works until a day after its expiry and is refused once the marker is gone', async () => {
    const now = Date.UTC(2026, 10, 22, 12);
    const {requestKey} = await createRequestKeys(7 * 86400, now);
    const expiry = now + 7 * 86400000;

    assert.equal(isRequestLinkExpired(requestKey, now), false);
    assert.equal(isRequestLinkExpired(requestKey, expiry), false);
    assert.equal(isRequestLinkExpired(requestKey, expiry + DAY), false);
    assert.equal(isRequestLinkExpired(requestKey, expiry + 3 * DAY), true);
    assert.equal(isRequestLinkExpired(requestKey, expiry + 40 * DAY), true);
});

test('the day code wraps every 3968 days and the window decides where the link comes back', async () => {
    const now = Date.UTC(2026, 10, 22, 12);
    const {requestKey} = await createRequestKeys(86400, now);
    const expiryDay = Math.ceil((now + DAY) / DAY);

    assert.equal(isRequestLinkExpired(requestKey, (expiryDay + 3968 - 11) * DAY), true);
    assert.equal(isRequestLinkExpired(requestKey, (expiryDay + 3968 - 10) * DAY), false);
    assert.equal(isRequestLinkExpired(requestKey, (expiryDay + 3968 + 1) * DAY), false);
    assert.equal(isRequestLinkExpired(requestKey, (expiryDay + 3968 + 2) * DAY), true);
});

test('a request status follows the server, not the local clock', async () => {
    const {decideRequestStatus} = await import('../src/lib/requestStore.ts');
    const now = Date.now();
    const entry = {id: 'A'.repeat(23), requestKey: 'k'.repeat(22), requesterKey: 'r'.repeat(20), createdAt: now, expiresAt: now + 7 * DAY};
    const pending = new Set([entry.id]);

    assert.equal(decideRequestStatus(entry, false, pending, now + 30 * DAY), 'waiting');
    assert.equal(decideRequestStatus(entry, false, undefined, now + 30 * DAY), 'waiting');
    assert.equal(decideRequestStatus(entry, false, new Set(), now + 8 * DAY - 1), 'expired');
    assert.equal(decideRequestStatus(entry, false, new Set(), now + 8 * DAY), 'forget');
    assert.equal(decideRequestStatus(entry, true, new Set(), now), 'answered');
    assert.equal(decideRequestStatus({...entry, answered: true}, false, new Set(), now), 'done');
});
