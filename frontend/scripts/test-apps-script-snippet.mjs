import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';

const apiOrigin = process.argv[2];
const fakeOrigin = 'https://local.test';
const cli = new URL('../../cli/index.mjs', import.meta.url).pathname;
const source = fs.readFileSync(new URL('../src/lib/1time.gs', import.meta.url), 'utf8');
const banner = '// AES-256-GCM below is @noble/ciphers 2.4.0 (aes.js gcm), unmodified, bundled with esbuild.';
const key = 'K7bQ2mXp9vRt4nLw8zYc';
const fragment = key + 'AbCdEfGhIjKlMnOpQrStUv';
const alphabet = /^[A-Za-z0-9_-]+$/;

const state = {uuidCalls: 0, sleeps: [], fetches: [], queue: [], live: false};

function signedBytes(value, where) {
    assert.ok(Array.isArray(value), `${where}: expected an array`);
    for (const item of value) {
        assert.ok(Number.isInteger(item) && item >= -128 && item <= 127, `${where}: byte out of range ${item}`);
    }
    return Buffer.from(Int8Array.from(value).buffer);
}

function toSigned(buffer) {
    return Array.from(new Int8Array(buffer.buffer, buffer.byteOffset, buffer.length));
}

const Utilities = {
    DigestAlgorithm: {SHA_256: 'SHA_256'},
    computeHmacSha256Signature: (value, hmacKey) =>
        toSigned(crypto.createHmac('sha256', signedBytes(hmacKey, 'hmac key')).update(signedBytes(value, 'hmac value')).digest()),
    computeDigest: (algorithm, value) => {
        assert.equal(algorithm, 'SHA_256');
        const input = typeof value === 'string' ? Buffer.from(value, 'utf8') : signedBytes(value, 'digest');
        return toSigned(crypto.createHash('sha256').update(input).digest());
    },
    newBlob: (value) => {
        const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : signedBytes(value, 'blob');
        return {getBytes: () => toSigned(bytes), getDataAsString: () => bytes.toString('utf8')};
    },
    base64EncodeWebSafe: (bytes) => signedBytes(bytes, 'base64 encode').toString('base64url').padEnd(Math.ceil(bytes.length / 3) * 4, '='),
    base64DecodeWebSafe: (text) => {
        assert.equal(typeof text, 'string');
        if (text.length % 4 !== 0) throw new Error('Illegal base64 length');
        return toSigned(Buffer.from(text, 'base64url'));
    },
    getUuid: () => { state.uuidCalls++; return crypto.randomUUID(); },
    sleep: (milliseconds) => { state.sleeps.push(milliseconds); },
};

function liveFetch(url, options) {
    const target = url.replace(fakeOrigin, apiOrigin);
    const output = execFileSync('curl', [
        '-s', '-S', '-X', 'POST', '-H', `Content-Type: ${options.contentType}`, '-H', 'User-Agent: Mozilla/5.0 (compatible; Google-Apps-Script; beanserver; +https://script.google.com; id: local-test)',
        '--data-binary', options.payload, '-w', '\n%{http_code}', target,
    ], {encoding: 'utf8'});
    const split = output.lastIndexOf('\n');
    return {code: Number(output.slice(split + 1)), body: output.slice(0, split)};
}

const UrlFetchApp = {
    fetch: (url, options) => {
        state.fetches.push({url, ...options});
        const reply = state.live ? liveFetch(url, options) : state.queue.shift();
        assert.ok(reply, 'no scripted response left');
        return {getResponseCode: () => reply.code, getContentText: () => reply.body};
    },
};

function load(text = source) {
    const context = vm.createContext({Utilities, UrlFetchApp});
    vm.runInContext(text, context);
    return context;
}

function call(context, name, ...args) {
    context.callArgs = args;
    return vm.runInContext(`${name}(...callArgs)`, context);
}

function reset(replies = []) {
    state.fetches.length = 0;
    state.sleeps.length = 0;
    state.queue = [...replies];
    state.live = false;
}

const json = (code, body) => ({code, body: JSON.stringify(body)});
const context = load();
let failed = 0;

function check(name, body) {
    try {
        body();
        console.log(`PASS ${name}`);
    } catch (error) {
        failed++;
        console.log(`FAIL ${name} -- ${error.message}`);
    }
}

function rejects(body, pattern) {
    assert.throws(body, (error) => pattern.test(error.message), `expected an error matching ${pattern}`);
}

const keysOf = (passphrase, randomKey) => call(context, 'oneTimeKeys_', passphrase, randomKey);
const nodeKey = (keys) => Buffer.from(keys.aesKey);

check('V1 keys without passphrase', () => {
    const keys = keysOf('', key);
    assert.equal(keys.readToken, '5e6c13f429c1e6eb0c69bc2e67e98e7aa18db0a4bac73f943858694ac3fbe957');
    assert.equal(keys.readTokenHash, '3bfecb0a1d1bc37a3e70eb843af6578ee1fa34c19fd059a89dfbdda4523bf396');
});

check('V2 keys with passphrase', () => {
    const keys = keysOf('correct horse', key);
    assert.equal(keys.readToken, '236c0385cdff9e6707c0ab1d20f936c0e6ab75dc5ce09170ca528cd39cc3a10f');
    assert.equal(keys.readTokenHash, '323a850509f83d441ac10a8383cccbe356044213dd6439e9c7375eb788f35acc');
});

check('V3 decrypts the published message', () => {
    const wire = '9uCJlv0mLOve6cWh.-Z5xKVVauhg2NAM1n-AjlKZsT4m5sWjAYgKGql9AIl0';
    assert.equal(call(context, 'oneTimeDecrypt_', wire, keysOf('', key).aesKey), 'hello from 1time');
});

check('V5 link parsing', () => {
    const parts = call(context, 'oneTimeParseLink_', `https://1time.io/v/#${fragment}`);
    assert.deepEqual({...parts}, {origin: 'https://1time.io', randomKey: key, id: 'AbCdEfGhIjKlMnOpQrStUv'});
});

check('link with surrounding whitespace parses', () => {
    const parts = call(context, 'oneTimeParseLink_', ` https://1time.io/v/#${fragment}\n`);
    assert.deepEqual({...parts}, {origin: 'https://1time.io', randomKey: key, id: 'AbCdEfGhIjKlMnOpQrStUv'});
});

check('encrypt then decrypt, non-ASCII and 100 KB', () => {
    const aesKey = keysOf('pass', key).aesKey;
    for (const text of ['plain', 'Привет, мир 你好 🔐', 'x'.repeat(100 * 1024)]) {
        assert.equal(call(context, 'oneTimeDecrypt_', call(context, 'oneTimeEncrypt_', text, aesKey), aesKey), text);
    }
});

check('snippet ciphertext opens with Node AES-GCM', () => {
    const keys = keysOf('', key);
    const [ivText, bodyText] = call(context, 'oneTimeEncrypt_', 'from snippet ключ', keys.aesKey).split('.');
    const body = Buffer.from(bodyText, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', nodeKey(keys), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(body.subarray(body.length - 16));
    const plain = Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]);
    assert.equal(plain.toString('utf8'), 'from snippet ключ');
});

check('Node ciphertext opens in the snippet', () => {
    const keys = keysOf('', key);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', nodeKey(keys), iv);
    const sealed = Buffer.concat([cipher.update('from node ключ', 'utf8'), cipher.final(), cipher.getAuthTag()]);
    const wire = `${iv.toString('base64url')}.${sealed.toString('base64url')}`;
    assert.equal(call(context, 'oneTimeDecrypt_', wire, keys.aesKey), 'from node ключ');
});

check('tampered ciphertext is rejected', () => {
    const aesKey = keysOf('', key).aesKey;
    const [iv, body] = call(context, 'oneTimeEncrypt_', 'tamper me', aesKey).split('.');
    const bytes = Buffer.from(body, 'base64url');
    bytes[0] ^= 1;
    assert.throws(() => call(context, 'oneTimeDecrypt_', `${iv}.${bytes.toString('base64url')}`, aesKey));
});

check('random key is 20 alphabet characters and differs between draws', () => {
    const first = call(context, 'oneTimeRandomKey_');
    assert.ok(first.length === 20 && alphabet.test(first));
    assert.notEqual(first, call(context, 'oneTimeRandomKey_'));
});

check('two encryptions use different IVs', () => {
    const aesKey = keysOf('', key).aesKey;
    const first = call(context, 'oneTimeEncrypt_', 'same', aesKey).split('.')[0];
    assert.notEqual(first, call(context, 'oneTimeEncrypt_', 'same', aesKey).split('.')[0]);
});

check('each random draw calls getUuid three times', () => {
    const before = state.uuidCalls;
    call(context, 'oneTimeRandomBytes_', 12);
    assert.equal(state.uuidCalls - before, 3);
});

check('readable source avoids Math.random, Date, Logger and console', () => {
    const readable = source.slice(0, source.indexOf(banner));
    assert.ok(readable.length > 0);
    for (const forbidden of ['Math.random', 'Date', 'Logger.', 'console.', 'User-Agent', 'ONE_TIME_CONTACT_URL']) assert.ok(!readable.includes(forbidden), forbidden);
});

check('bundle and banner are present', () => {
    assert.ok(source.includes(banner));
    assert.ok(source.includes('var oneTimeAes_='));
});

const goodLink = `https://1time.io/v/#${fragment}`;
const badLinks = {
    'wrong length': `https://1time.io/v/#${fragment.slice(1)}`,
    'bad character': `https://1time.io/v/#${fragment.slice(0, 41)}!`,
    '/f/ path': `https://1time.io/f/#${fragment}`,
    '/V/ path': `https://1time.io/V/#${fragment}`,
    'http': `http://1time.io/v/#${fragment}`,
    'http loopback': `http://127.0.0.1:8080/v/#${fragment}`,
};
for (const [name, link] of Object.entries(badLinks)) {
    check(`link: ${name} rejected before any request`, () => {
        reset();
        rejects(() => call(context, 'readOneTimeLink', link), /Not a 1time/);
        assert.equal(state.fetches.length, 0);
    });
}

check('host: http://example.com rejected', () => {
    reset();
    rejects(() => call(context, 'createOneTimeLink', 'x', {host: 'http://example.com'}), /https/);
    assert.equal(state.fetches.length, 0);
});

check('invalid options rejected before any request', () => {
    reset();
    rejects(() => call(context, 'createOneTimeLink', 'x', {views: 11}), /views/);
    rejects(() => call(context, 'createOneTimeLink', 'x', {views: 1.5}), /views/);
    rejects(() => call(context, 'createOneTimeLink', 'x', {expiresInSeconds: 0}), /expiresInSeconds/);
    rejects(() => call(context, 'createOneTimeLink', 'x', {expiresInSeconds: 2592001}), /expiresInSeconds/);
    rejects(() => call(context, 'createOneTimeLink', '', {}), /Secret/);
    rejects(() => call(context, 'createOneTimeLink', 42, {}), /Secret/);
    assert.equal(state.fetches.length, 0);
});

const savedId = 'AbCdEfGhIjKlMnOpQrStUv';

check('save request shape', () => {
    reset([json(200, {status: 'ok', newId: savedId})]);
    const link = call(context, 'createOneTimeLink', 'hello', {expiresInSeconds: 3600, views: 2});
    assert.ok(link.startsWith('https://1time.io/v/#') && link.endsWith(savedId) && link.length === 'https://1time.io/v/#'.length + 42);
    const request = state.fetches[0];
    assert.equal(request.url, 'https://1time.io/api/saveSecret?src=gas');
    assert.equal(request.headers, undefined);
    assert.equal(request.contentType, 'application/json');
    const body = JSON.parse(request.payload);
    assert.deepEqual(Object.keys(body).sort(), ['duration', 'readTokenHash', 'secretMessage', 'v', 'views']);
    assert.equal(body.v, 3);
    assert.equal(body.duration, 3600);
    assert.equal(body.views, 2);
});

check('save failure is reported', () => {
    reset([json(200, {status: 'error', newId: '0'})]);
    rejects(() => call(context, 'createOneTimeLink', 'hello'), /did not accept/);
});

const read = () => call(context, 'readOneTimeLink', goodLink);

check('read: bare 503 HTML is not retried', () => {
    reset([{code: 503, body: '<html>busy</html>'}]);
    rejects(read, /HTTP 503/);
    assert.equal(state.fetches.length, 1);
});

check('read: 503 retry twice then no message makes 3 requests', () => {
    reset([json(503, {status: 'retry'}), json(503, {status: 'retry'}), json(200, {status: 'no message'})]);
    rejects(read, /No message/);
    assert.equal(state.fetches.length, 3);
    assert.deepEqual(state.sleeps, [250, 500]);
});

check('read: endless 503 retry stops at 4 requests', () => {
    reset(Array.from({length: 6}, () => json(503, {status: 'retry'})));
    rejects(read, /HTTP 503/);
    assert.equal(state.fetches.length, 4);
});

check('read: 200 with status retry is not retried', () => {
    reset([json(200, {status: 'retry'})]);
    rejects(read, /could not process/);
    assert.equal(state.fetches.length, 1);
});

check('read: 429 HTML is not retried', () => {
    reset([{code: 429, body: '<html>slow down</html>'}]);
    rejects(read, /HTTP 429/);
    assert.equal(state.fetches.length, 1);
});

check('read: wrong key and error statuses', () => {
    reset([json(200, {status: 'wrong key'}), json(200, {status: 'error'})]);
    rejects(read, /Wrong key/);
    rejects(read, /could not process/);
});

check('read request shape', () => {
    reset([json(200, {status: 'no message'})]);
    rejects(read, /No message/);
    const request = state.fetches[0];
    assert.equal(request.url, 'https://1time.io/api/get?src=gas');
    const body = JSON.parse(request.payload);
    assert.deepEqual(Object.keys(body).sort(), ['hashedKey', 'id']);
    assert.equal(body.id, 'AbCdEfGhIjKlMnOpQrStUv');
    assert.equal(body.hashedKey, keysOf('', key).readToken);
});

if (apiOrigin) {
    const live = (body) => () => { reset(); state.live = true; body(); };
    const create = (secret, options = {}) => call(context, 'createOneTimeLink', secret, {host: fakeOrigin, ...options});

    check('live: create then read, second read fails', live(() => {
        const text = 'secret ключ 🔐';
        const link = create(text);
        assert.equal(call(context, 'readOneTimeLink', link).text, text);
        rejects(() => call(context, 'readOneTimeLink', link), /No message/);
    }));

    check('live: two views report one left', live(() => {
        assert.equal(call(context, 'readOneTimeLink', create('two views', {views: 2})).viewsLeft, 1);
    }));

    check('live: passphrase round trip', live(() => {
        const link = create('guarded', {passphrase: 'correct horse'});
        rejects(() => call(context, 'readOneTimeLink', link), /Wrong key/);
        rejects(() => call(context, 'readOneTimeLink', link, 'nope'), /Wrong key/);
        assert.equal(call(context, 'readOneTimeLink', link, 'correct horse').text, 'guarded');
    }));

    check('live: snippet link is read by the CLI', live(() => {
        const text = `interop ${Date.now()} ключ`;
        const link = create(text).replace(fakeOrigin, apiOrigin);
        const output = execFileSync('node', [cli, 'read', link], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
        assert.equal(output.replace(/\n$/, ''), text);
    }));

    check('live: CLI link is read by the snippet', live(() => {
        const text = `interop ${Date.now()} ключ`;
        const link = execFileSync('node', [cli, 'send', '--host', apiOrigin], {input: text, encoding: 'utf8'}).trim();
        assert.equal(call(context, 'readOneTimeLink', link.replace(apiOrigin, fakeOrigin)).text, text);
    }));
}

if (failed) {
    console.log(`${failed} check(s) failed`);
    process.exit(1);
}
console.log('All checks passed');
