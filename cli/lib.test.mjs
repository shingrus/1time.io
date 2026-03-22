import {Readable} from 'node:stream';
import test from 'node:test';
import assert from 'node:assert/strict';

import {createSecretLink, revealSecret, run} from './lib.mjs';

function createWritableCapture() {
    let output = '';
    return {
        stream: {
            write(chunk) {
                output += String(chunk);
            },
        },
        getOutput() {
            return output;
        },
    };
}

function createStdin(input, isTTY = false) {
    const stream = Readable.from(input === '' ? [] : [input]);
    stream.isTTY = isTTY;
    return stream;
}

test('run send prefers stdin over env and prints the created link', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let requestBody = null;

    const exitCode = await run(['send', '--host', '1time.example'], {
        stdin: createStdin('secret from stdin'),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {
            '1TIME_SECRET': 'secret from env',
        },
        fetchImpl: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'abc123',
                }),
            };
        },
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.getOutput(), '');
    assert.equal(requestBody.duration, 86400);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.example\/v\/#/);
    assert.match(stdout.getOutput(), /abc123/);
});

test('run send warns when the secret is passed as a positional argv argument', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();

    const exitCode = await run(['send', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => ({
            ok: true,
            json: async () => ({
                status: 'ok',
                newId: 'abc123',
            }),
        }),
    });

    assert.equal(exitCode, 0);
    assert.match(stderr.getOutput(), /Warning: passing the secret in argv/);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.io\/v\/#/);
});

test('createSecretLink and revealSecret round-trip through the API protocol', async () => {
    let storedPayload = null;
    const createdLink = await createSecretLink({
        host: 'https://1time.io',
        secret: 'round-trip secret',
        fetchImpl: async (_url, options) => {
            storedPayload = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'server-id-123',
                }),
            };
        },
    });

    const decryptedSecret = await revealSecret({
        link: createdLink,
        fetchImpl: async (_url, options) => {
            const requestBody = JSON.parse(options.body);
            assert.equal(requestBody.id, 'server-id-123');
            assert.equal(requestBody.hashedKey, storedPayload.hashedKey);

            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    cryptedMessage: storedPayload.secretMessage,
                }),
            };
        },
    });

    assert.equal(decryptedSecret, 'round-trip secret');
});
