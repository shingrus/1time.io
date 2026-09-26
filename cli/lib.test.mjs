import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, basename, resolve} from 'node:path';
import {Readable} from 'node:stream';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';

import {createSecretLink, revealSecret, run} from './lib.mjs';
const chunkBytes = 4 * 1024 * 1024;

// v3 saves upload SHA-256(readToken); reads still send the token itself. These
// tests therefore assert that the two are related by a hash, NOT that they are
// equal — equality was the v2 property, and asserting it would silently pin the
// weaker scheme back in place. Mirrors TestInteropVectorFromProtocolMjs on the
// Go side, and hashes the token's hex string for the same reason.
function sha256Hex(text) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

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

// Stands in for /api/saveFile's chunked path: answers {"status":"ok"} per
// chunk and the id only for the last one, and keeps the stored ciphertext.
// Fields come from the multipart body; u, i and n from the query.
function createChunkServer(newId = 'serverFile123456789abc') {
    const chunks = [];
    const requests = [];
    return {
        requests,
        encryptedBytes: () => new Uint8Array(Buffer.concat(chunks)),
        fetchImpl: async (url, options) => {
            const params = new URL(url).searchParams;
            const index = Number(params.get('i'));
            const form = options.body;
            requests.push({url, params, form, headers: options.headers});
            chunks[index] = Buffer.from(await form.get('file').arrayBuffer());
            const isLast = index === Number(params.get('n')) - 1;
            return new Response(JSON.stringify(isLast ? {status: 'ok', newId} : {status: 'ok'}), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            });
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
                    newId: 'abc123456789abcdefghij',
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
                newId: 'abc123456789abcdefghij',
            }),
        }),
    });

    assert.equal(exitCode, 0);
    assert.match(stderr.getOutput(), /Warning: passing the secret in argv/);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.io\/v\/#/);
});

test('run send accepts compact --expires-in day and hour units', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let requestBody = null;

    const exitCode = await run(['send', '--expires-in', '2d23h', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'abc123456789abcdefghij',
                }),
            };
        },
    });

    assert.equal(exitCode, 0);
    assert.equal(requestBody.duration, 255600);
    assert.match(stderr.getOutput(), /Warning: passing the secret in argv/);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.io\/v\/#/);
});

test('run send accepts --expires-in equals form', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let requestBody = null;

    const exitCode = await run(['send', '--expires-in=2d23h', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'abc123456789abcdefghij',
                }),
            };
        },
    });

    assert.equal(exitCode, 0);
    assert.equal(requestBody.duration, 255600);
    assert.match(stderr.getOutput(), /Warning: passing the secret in argv/);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.io\/v\/#/);
});

test('run send rejects --expires-in units in reverse order', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--expires-in', '23h2d', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /"23h2d": use d and h units/);
});

test('run send accepts --expires-in at the maximum boundary', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let requestBody = null;

    const exitCode = await run(['send', '--expires-in', '30d', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'abc123456789abcdefghij',
                }),
            };
        },
    });

    assert.equal(exitCode, 0);
    assert.equal(requestBody.duration, 2592000);
    assert.match(stderr.getOutput(), /Warning: passing the secret in argv/);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.io\/v\/#/);
});

test('run send rejects whitespace inside --expires-in', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--expires-in', '2d 23h', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /"2d 23h": use d and h units/);
});

test('run send rejects zero --expires-in values', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--expires-in', '0d', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /"0d": duration must be greater than 0/);
});

test('run send rejects empty --expires-in values', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--expires-in', '', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /Invalid expires-in value "": use d and h units/);
});

test('run send rejects --expires-in above the maximum', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--expires-in', '30d1h', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /"30d1h": maximum is 30d/);
});

test('run send rejects unsupported --expires-in units', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--expires-in', '30m', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /"30m": use d and h units/);
});

test('run send rejects duplicate --expires-in units', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--expires-in', '1d2d', 'argv secret'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /"1d2d": use d and h units/);
});

test('run send sends the default view count', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let requestBody = null;

    const exitCode = await run(['send'], {
        stdin: createStdin('secret from stdin'),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'abc123456789abcdefghij',
                }),
            };
        },
    });

    assert.equal(exitCode, 0);
    assert.equal(requestBody.views, 1);
});

test('run send accepts --views', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let requestBody = null;

    const exitCode = await run(['send', '--views', '3'], {
        stdin: createStdin('secret from stdin'),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'abc123456789abcdefghij',
                }),
            };
        },
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.getOutput(), '');
    assert.equal(requestBody.views, 3);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.io\/v\/#/);
});

test('run send rejects --views above the maximum', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--views', '11'], {
        stdin: createStdin('secret from stdin'),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /"11": use a whole number between 1 and 10/);
});

test('run send rejects non-numeric --views values', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--views', '2.5'], {
        stdin: createStdin('secret from stdin'),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /"2\.5": use a whole number between 1 and 10/);
});

test('every api request carries the src=cli marker and the 1time-cli User-Agent', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const outputDir = await mkdtemp(join(tmpdir(), '1time-cli-output-'));
    const sourcePath = join(sourceDir, 'report.txt');
    await writeFile(sourcePath, 'round-trip file');

    const requests = [];
    const captureRequest = (url, options) => {
        requests.push({url, options});
    };

    const sendStdout = createWritableCapture();
    let storedPayload = null;
    await run(['send', '--host', 'http://127.0.0.1:8080'], {
        stdin: createStdin('marker secret'),
        stdout: sendStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: async (url, options) => {
            captureRequest(url, options);
            storedPayload = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({status: 'ok', newId: 'serverId123456789abcde'}),
            };
        },
    });

    await run(['read', sendStdout.getOutput().trim()], {
        stdin: createStdin('', true),
        stdout: createWritableCapture().stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: async (url, options) => {
            captureRequest(url, options);
            return {
                ok: true,
                json: async () => ({status: 'ok', cryptedMessage: storedPayload.secretMessage}),
            };
        },
    });

    const sendFileStdout = createWritableCapture();
    const fileServer = createChunkServer();
    await run(['send-file', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendFileStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: async (url, options) => {
            captureRequest(url, options);
            return fileServer.fetchImpl(url, options);
        },
    });

    await run(['read-file', sendFileStdout.getOutput().trim()], {
        stdin: createStdin('', true),
        stdout: createWritableCapture().stream,
        stderr: createWritableCapture().stream,
        env: {},
        cwd: outputDir,
        fetchImpl: async (url, options) => {
            captureRequest(url, options);
            return new Response(fileServer.encryptedBytes(), {
                status: 200,
                headers: {'Content-Type': 'application/octet-stream'},
            });
        },
    });

    assert.deepEqual(requests.map(({url}) => new URL(url).pathname), [
        '/api/saveSecret',
        '/api/get',
        '/api/saveFile',
        '/api/getFile',
    ]);

    for (const {url, options} of requests) {
        assert.equal(new URL(url).searchParams.get('src'), 'cli', `missing src=cli on ${url}`);
        assert.match(options.headers['User-Agent'], /^1time-cli\/\d+\.\d+\.\d+$/, `missing 1time-cli User-Agent on ${url}`);
    }
});

test('run send reports a missing --views value instead of throwing', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send', '--views'], {
        stdin: createStdin('secret from stdin'),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /--views <value>' argument missing/);
});

test('run send-file reports a missing --views value instead of throwing', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send-file', '--views'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /--views <value>' argument missing/);
});

test('run reports unparsable arguments for every command instead of throwing', async () => {
    for (const argv of [
        ['send', '--host'],
        ['send', '--unknown-flag'],
        ['read', '--host'],
        ['send-file', '--expires-in'],
        ['read-file', '--out'],
    ]) {
        const stdout = createWritableCapture();
        const stderr = createWritableCapture();

        const exitCode = await run(argv, {
            stdin: createStdin('', true),
            stdout: stdout.stream,
            stderr: stderr.stream,
            env: {},
            fetchImpl: async () => {
                throw new Error('should not fetch');
            },
        });

        assert.equal(exitCode, 1, `expected exit code 1 for ${argv.join(' ')}`);
        assert.equal(stdout.getOutput(), '', `expected empty stdout for ${argv.join(' ')}`);
        assert.notEqual(stderr.getOutput(), '', `expected an error on stderr for ${argv.join(' ')}`);
    }
});

test('run read reports the remaining views on stderr', async () => {
    let storedPayload = null;
    const createdLink = await createSecretLink({
        secret: 'multi-view secret',
        views: 3,
        fetchImpl: async (_url, options) => {
            storedPayload = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    status: 'ok',
                    newId: 'serverId123456789abcde',
                }),
            };
        },
    });

    const stdout = createWritableCapture();
    const stderr = createWritableCapture();

    const exitCode = await run(['read', createdLink], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => ({
            ok: true,
            json: async () => ({
                status: 'ok',
                cryptedMessage: storedPayload.secretMessage,
                viewsLeft: 2,
            }),
        }),
    });

    assert.equal(exitCode, 0);
    assert.equal(storedPayload.views, 3);
    assert.equal(stdout.getOutput(), 'multi-view secret\n');
    assert.equal(stderr.getOutput(), 'This link has 2 views remaining.\n');
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
                    newId: 'serverId123456789abcde',
                }),
            };
        },
    });

    const {secret: decryptedSecret} = await revealSecret({
        link: createdLink,
        fetchImpl: async (_url, options) => {
            const requestBody = JSON.parse(options.body);
            assert.equal(requestBody.id, 'serverId123456789abcde');
            assert.equal(sha256Hex(requestBody.hashedKey), storedPayload.readTokenHash);

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

test('run send-file uploads a file and prints the created file link', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), '1time-cli-send-file-'));
    const sourcePath = join(tempDir, 'secret.txt');
    await writeFile(sourcePath, 'file from cli');

    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const server = createChunkServer('file123456789abcdefghi');

    const exitCode = await run(['send-file', '--host', '1time.example', sourcePath], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: server.fetchImpl,
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.getOutput(), '');
    assert.equal(server.requests.length, 1);
    const [{params, form}] = server.requests;
    assert.match(params.get('u'), /^[A-Za-z0-9_-]{22}$/);
    assert.equal(params.get('i'), '0');
    assert.equal(params.get('n'), '1');
    assert.equal(form.get('v'), '3');
    assert.equal(form.get('duration'), '86400');
    assert.match(form.get('readTokenHash'), /^[0-9a-f]{64}$/);
    assert.ok(form.get('file') instanceof Blob);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.example\/f\/#/);
    assert.match(stdout.getOutput(), /file123/);
});

test('run send-file accepts --expires-in', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), '1time-cli-send-file-'));
    const sourcePath = join(tempDir, 'secret.txt');
    await writeFile(sourcePath, 'file from cli');

    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const server = createChunkServer('file123456789abcdefghi');

    const exitCode = await run(['send-file', '--expires-in', '23h', sourcePath], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: server.fetchImpl,
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.getOutput(), '');
    assert.equal(server.requests[0].form.get('duration'), '82800');
    assert.match(stdout.getOutput(), /^https:\/\/1time\.io\/f\/#/);
});

test('run send-file accepts --views and omits the field for single downloads', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), '1time-cli-send-file-'));
    const sourcePath = join(tempDir, 'secret.txt');
    await writeFile(sourcePath, 'file from cli');

    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const server = createChunkServer('file123456789abcdefghi');

    const io = {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: server.fetchImpl,
    };

    assert.equal(await run(['send-file', '--views', '5', sourcePath], io), 0);
    assert.equal(await run(['send-file', sourcePath], io), 0);

    assert.equal(stderr.getOutput(), '');
    assert.equal(server.requests[0].form.get('views'), '5');
    assert.equal(server.requests[1].form.get('views'), null);
});

test('run send-file rejects --views below the minimum', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), '1time-cli-send-file-'));
    const sourcePath = join(tempDir, 'secret.txt');
    await writeFile(sourcePath, 'file from cli');

    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['send-file', '--views', '0', sourcePath], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /"0": use a whole number between 1 and 10/);
});

test('run read-file reports the remaining downloads on stderr', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const outputDir = await mkdtemp(join(tmpdir(), '1time-cli-output-'));
    const sourcePath = join(sourceDir, 'report.txt');
    await writeFile(sourcePath, 'round-trip file');

    const sendStdout = createWritableCapture();
    const server = createChunkServer();

    const sendExitCode = await run(['send-file', '--views', '3', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: server.fetchImpl,
    });

    assert.equal(sendExitCode, 0);

    const readStdout = createWritableCapture();
    const readStderr = createWritableCapture();
    const readExitCode = await run(['read-file', sendStdout.getOutput().trim()], {
        stdin: createStdin('', true),
        stdout: readStdout.stream,
        stderr: readStderr.stream,
        env: {},
        cwd: outputDir,
        fetchImpl: async () => new Response(server.encryptedBytes(), {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-1Time-Views-Left': '2',
            },
        }),
    });

    assert.equal(readExitCode, 0);
    assert.equal(readStderr.getOutput(), 'This link has 2 downloads remaining.\n');
    assert.equal(await readFile(readStdout.getOutput().trim(), 'utf8'), 'round-trip file');
});

test('run read-file downloads the decrypted file into the current directory', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const outputDir = await mkdtemp(join(tmpdir(), '1time-cli-output-'));
    const sourcePath = join(sourceDir, 'report.txt');
    await writeFile(sourcePath, 'round-trip file');

    const sendStdout = createWritableCapture();
    const server = createChunkServer();

    const sendExitCode = await run(['send-file', '--passphrase', 'extra-passphrase', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: server.fetchImpl,
    });
    const storedReadTokenHash = server.requests[0].form.get('readTokenHash');

    assert.equal(sendExitCode, 0);
    const createdLink = sendStdout.getOutput().trim();

    const readStdout = createWritableCapture();
    const readStderr = createWritableCapture();
    const readExitCode = await run(['read-file', '--passphrase', 'extra-passphrase', createdLink], {
        stdin: createStdin('', true),
        stdout: readStdout.stream,
        stderr: readStderr.stream,
        env: {},
        cwd: outputDir,
        fetchImpl: async (_url, options) => {
            const requestBody = JSON.parse(options.body);
            assert.equal(requestBody.id, 'serverFile123456789abc');
            assert.equal(sha256Hex(requestBody.hashedKey), storedReadTokenHash);

            return new Response(server.encryptedBytes(), {
                status: 200,
                headers: {'Content-Type': 'application/octet-stream'},
            });
        },
    });

    assert.equal(readExitCode, 0);
    assert.equal(readStderr.getOutput(), `${passphraseWarningLine()}${consumedLine()}`);
    const outputPath = readStdout.getOutput().trim();
    assert.equal(outputPath, resolve(outputDir, basename(sourcePath)));
    assert.equal(await readFile(outputPath, 'utf8'), 'round-trip file');
});

test('read-file reports when a passphrase-protected file link is missing the passphrase', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();

    const exitCode = await run(['read-file', 'https://1time.io/f/#AbCdEfGhIjKlMnOpQr-_file123456789abcdefghi'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async () => new Response(JSON.stringify({
            status: 'wrong key',
        }), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        }),
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.match(stderr.getOutput(), /requires the correct passphrase/i);
});

test('read-file picks a unique filename when the decrypted name already exists', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const outputDir = await mkdtemp(join(tmpdir(), '1time-cli-output-'));
    const sourcePath = join(sourceDir, 'report.txt');
    const existingPath = join(outputDir, basename(sourcePath));
    await writeFile(sourcePath, 'round-trip file');
    await writeFile(existingPath, 'existing file');

    const sendStdout = createWritableCapture();
    const server = createChunkServer();

    const sendExitCode = await run(['send-file', '--passphrase', 'extra-passphrase', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: server.fetchImpl,
    });
    const storedReadTokenHash = server.requests[0].form.get('readTokenHash');

    assert.equal(sendExitCode, 0);
    const createdLink = sendStdout.getOutput().trim();

    const readStdout = createWritableCapture();
    const readStderr = createWritableCapture();
    const readExitCode = await run(['read-file', '--passphrase', 'extra-passphrase', createdLink], {
        stdin: createStdin('', true),
        stdout: readStdout.stream,
        stderr: readStderr.stream,
        env: {},
        cwd: outputDir,
        fetchImpl: async (_url, options) => {
            const requestBody = JSON.parse(options.body);
            assert.equal(requestBody.id, 'serverFile123456789abc');
            assert.equal(sha256Hex(requestBody.hashedKey), storedReadTokenHash);

            return new Response(server.encryptedBytes(), {
                status: 200,
                headers: {'Content-Type': 'application/octet-stream'},
            });
        },
    });

    assert.equal(readExitCode, 0);
    assert.equal(readStderr.getOutput(), `${passphraseWarningLine()}${consumedLine()}`);

    const outputPath = readStdout.getOutput().trim();
    assert.equal(outputPath, resolve(outputDir, 'report (1).txt'));
    assert.equal(await readFile(outputPath, 'utf8'), 'round-trip file');
    assert.equal(await readFile(existingPath, 'utf8'), 'existing file');
});

test('read-file fails before fetching when --out already exists', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), '1time-cli-output-'));
    const targetPath = join(outputDir, 'existing.txt');
    await writeFile(targetPath, 'existing file');

    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let fetchCalled = false;

    const exitCode = await run(['read-file', '--out', targetPath, 'https://1time.io/f/#AbCdEfGhIjKlMnOpQr-_file123456789abcdefghi'], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        cwd: outputDir,
        fetchImpl: async () => {
            fetchCalled = true;
            throw new Error('should not fetch');
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.getOutput(), '');
    assert.equal(fetchCalled, false);
    assert.match(stderr.getOutput(), /already exists/i);
});

function passphraseWarningLine() {
    return 'Warning: passing the passphrase in argv may leak via shell history or process listings.\n';
}

function consumedLine() {
    return 'This link is now consumed and has been deleted from the server.\n';
}

test('send-file splits a large file into fixed-size chunks and read-file reassembles it', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const outputDir = await mkdtemp(join(tmpdir(), '1time-cli-output-'));
    const sourcePath = join(sourceDir, 'large.bin');
    const content = randomBytes(chunkBytes * 2 + 12345);
    await writeFile(sourcePath, content);

    const server = createChunkServer();
    const sendStdout = createWritableCapture();
    const io = {stdin: createStdin('', true), stderr: createWritableCapture().stream, env: {}, cwd: outputDir};
    assert.equal(await run(['send-file', sourcePath], {...io, stdout: sendStdout.stream, fetchImpl: server.fetchImpl}), 0);

    assert.deepEqual(server.requests.map(({params}) => [params.get('i'), params.get('n')]), [['0', '3'], ['1', '3'], ['2', '3']]);
    assert.equal(new Set(server.requests.map(({params}) => params.get('u'))).size, 1);
    const sizes = await Promise.all(server.requests.map(({form}) => form.get('file').size));
    assert.deepEqual(sizes.slice(0, 2), [chunkBytes, chunkBytes]);
    const encrypted = server.encryptedBytes();

    const readStdout = createWritableCapture();
    assert.equal(await run(['read-file', sendStdout.getOutput().trim()], {
        ...io,
        stdout: readStdout.stream,
        fetchImpl: async () => new Response(encrypted, {status: 200, headers: {'Content-Type': 'application/octet-stream'}}),
    }), 0);
    assert.deepEqual(await readFile(readStdout.getOutput().trim()), content);
});

test('send-file resends only the chunk whose request failed', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const sourcePath = join(sourceDir, 'large.bin');
    await writeFile(sourcePath, randomBytes(chunkBytes + 10));

    const server = createChunkServer();
    const failures = [new TypeError('fetch failed'), 502];
    const sent = [];
    const stdout = createWritableCapture();
    const exitCode = await run(['send-file', sourcePath], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        retryDelaysMs: [0, 0, 0],
        fetchImpl: async (url, options) => {
            const index = new URL(url).searchParams.get('i');
            sent.push(index);
            if (index === '1' && failures.length > 0) {
                const failure = failures.shift();
                if (failure instanceof Error) {
                    throw failure;
                }
                return new Response('', {status: failure});
            }
            return server.fetchImpl(url, options);
        },
    });

    assert.equal(exitCode, 0);
    assert.deepEqual(sent, ['0', '1', '1', '1']);
    assert.match(stdout.getOutput(), /serverFile123456789abc/);
});

test('send-file gives up on a chunk the server rejects', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const sourcePath = join(sourceDir, 'small.txt');
    await writeFile(sourcePath, 'rejected');

    let calls = 0;
    const stderr = createWritableCapture();
    const exitCode = await run(['send-file', sourcePath], {
        stdin: createStdin('', true),
        stdout: createWritableCapture().stream,
        stderr: stderr.stream,
        env: {},
        retryDelaysMs: [0, 0, 0],
        fetchImpl: async () => {
            calls++;
            return new Response(JSON.stringify({status: 'error'}), {status: 400});
        },
    });

    assert.equal(exitCode, 1);
    assert.equal(calls, 1);
    assert.match(stderr.getOutput(), /status 400/);
});

test('send-file falls back to one request when the server predates chunked uploads', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const outputDir = await mkdtemp(join(tmpdir(), '1time-cli-output-'));
    const sourcePath = join(sourceDir, 'large.bin');
    const content = randomBytes(chunkBytes + 500);
    await writeFile(sourcePath, content);

    // An old server ignores u/i/n and stores every request as a whole file.
    const stored = new Map();
    const requests = [];
    const oldServer = async (url, options) => {
        const id = `oldServerFile${String(stored.size).padStart(9, '0')}`;
        requests.push(new URL(url).searchParams);
        stored.set(id, new Uint8Array(await options.body.get('file').arrayBuffer()));
        return new Response(JSON.stringify({status: 'ok', newId: id}), {status: 200, headers: {'Content-Type': 'application/json'}});
    };

    const sendStdout = createWritableCapture();
    const io = {stdin: createStdin('', true), stderr: createWritableCapture().stream, env: {}, cwd: outputDir};
    assert.equal(await run(['send-file', sourcePath], {...io, stdout: sendStdout.stream, fetchImpl: oldServer}), 0);

    assert.deepEqual(requests.map((params) => params.get('i')), ['0', null]);
    const link = sendStdout.getOutput().trim();
    assert.match(link, /oldServerFile000000001$/);

    const readStdout = createWritableCapture();
    assert.equal(await run(['read-file', link], {
        ...io,
        stdout: readStdout.stream,
        fetchImpl: async () => new Response(stored.get('oldServerFile000000001'), {status: 200, headers: {'Content-Type': 'application/octet-stream'}}),
    }), 0);
    assert.deepEqual(await readFile(readStdout.getOutput().trim()), content);
});

test('send-file retries a chunk on 429 or a Cloudflare 52x and fails once every attempt is used', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const sourcePath = join(sourceDir, 'small.txt');
    await writeFile(sourcePath, 'throttled');

    const server = createChunkServer();
    const transient = [429, 524];
    const recovered = await run(['send-file', sourcePath], {
        stdin: createStdin('', true),
        stdout: createWritableCapture().stream,
        stderr: createWritableCapture().stream,
        env: {},
        retryDelaysMs: [0, 0],
        fetchImpl: async (url, options) => {
            if (transient.length > 0) {
                return new Response('', {status: transient.shift()});
            }
            return server.fetchImpl(url, options);
        },
    });
    assert.equal(recovered, 0);
    assert.equal(transient.length, 0);

    let calls = 0;
    const stderr = createWritableCapture();
    const exhausted = await run(['send-file', sourcePath], {
        stdin: createStdin('', true),
        stdout: createWritableCapture().stream,
        stderr: stderr.stream,
        env: {},
        retryDelaysMs: [0, 0],
        fetchImpl: async () => {
            calls++;
            throw new TypeError('fetch failed');
        },
    });
    assert.equal(exhausted, 1);
    assert.equal(calls, 3);
    assert.match(stderr.getOutput(), /fetch failed/);
});

test('send-file fails on an error body or a finished upload without an id', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const sourcePath = join(sourceDir, 'small.txt');
    await writeFile(sourcePath, 'rejected');

    for (const body of [{status: 'error'}, {status: 'ok'}]) {
        let calls = 0;
        const stderr = createWritableCapture();
        const exitCode = await run(['send-file', sourcePath], {
            stdin: createStdin('', true),
            stdout: createWritableCapture().stream,
            stderr: stderr.stream,
            env: {},
            retryDelaysMs: [0, 0],
            fetchImpl: async () => {
                calls++;
                return new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
            },
        });
        assert.equal(exitCode, 1, JSON.stringify(body));
        assert.equal(calls, 1, JSON.stringify(body));
        assert.match(stderr.getOutput(), /Failed to create file link/);
    }
});
