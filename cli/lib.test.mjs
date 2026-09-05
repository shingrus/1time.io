import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, basename, resolve} from 'node:path';
import {Readable} from 'node:stream';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

import {createSecretLink, revealSecret, run} from './lib.mjs';

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

test('every api request carries the src=cli marker', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const outputDir = await mkdtemp(join(tmpdir(), '1time-cli-output-'));
    const sourcePath = join(sourceDir, 'report.txt');
    await writeFile(sourcePath, 'round-trip file');

    const requests = [];
    const captureRequest = (url) => {
        requests.push(url);
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
    let encryptedBytes = null;
    await run(['send-file', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendFileStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: async (url, options) => {
            captureRequest(url, options);
            encryptedBytes = new Uint8Array(await options.body.get('file').arrayBuffer());
            return new Response(JSON.stringify({status: 'ok', newId: 'serverFile123456789abc'}), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            });
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
            return new Response(encryptedBytes, {
                status: 200,
                headers: {'Content-Type': 'application/octet-stream'},
            });
        },
    });

    assert.deepEqual(requests.map((url) => new URL(url).pathname), [
        '/api/saveSecret',
        '/api/get',
        '/api/saveFile',
        '/api/getFile',
    ]);

    for (const url of requests) {
        assert.equal(new URL(url).searchParams.get('src'), 'cli', `missing src=cli on ${url}`);
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
    let requestBody = null;

    const exitCode = await run(['send-file', '--host', '1time.example', sourcePath], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async (_url, options) => {
            requestBody = options.body;
            return new Response(JSON.stringify({
                status: 'ok',
                newId: 'file123456789abcdefghi',
            }), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            });
        },
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.getOutput(), '');
    assert.equal(requestBody.get('duration'), '86400');
    assert.equal(typeof requestBody.get('readTokenHash'), 'string');
    assert.ok(requestBody.get('file') instanceof Blob);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.example\/f\/#/);
    assert.match(stdout.getOutput(), /file123/);
});

test('run send-file accepts --expires-in', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), '1time-cli-send-file-'));
    const sourcePath = join(tempDir, 'secret.txt');
    await writeFile(sourcePath, 'file from cli');

    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    let requestBody = null;

    const exitCode = await run(['send-file', '--expires-in', '23h', sourcePath], {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl: async (_url, options) => {
            requestBody = options.body;
            return new Response(JSON.stringify({
                status: 'ok',
                newId: 'file123456789abcdefghi',
            }), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            });
        },
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.getOutput(), '');
    assert.equal(requestBody.get('duration'), '82800');
    assert.match(stdout.getOutput(), /^https:\/\/1time\.io\/f\/#/);
});

test('run send-file accepts --views and omits the field for single downloads', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), '1time-cli-send-file-'));
    const sourcePath = join(tempDir, 'secret.txt');
    await writeFile(sourcePath, 'file from cli');

    const stdout = createWritableCapture();
    const stderr = createWritableCapture();
    const requestBodies = [];
    const fetchImpl = async (_url, options) => {
        requestBodies.push(options.body);
        return new Response(JSON.stringify({
            status: 'ok',
            newId: 'file123456789abcdefghi',
        }), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        });
    };

    const io = {
        stdin: createStdin('', true),
        stdout: stdout.stream,
        stderr: stderr.stream,
        env: {},
        fetchImpl,
    };

    assert.equal(await run(['send-file', '--views', '5', sourcePath], io), 0);
    assert.equal(await run(['send-file', sourcePath], io), 0);

    assert.equal(stderr.getOutput(), '');
    assert.equal(requestBodies[0].get('views'), '5');
    assert.equal(requestBodies[1].get('views'), null);
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
    let encryptedBytes = null;

    const sendExitCode = await run(['send-file', '--views', '3', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: async (_url, options) => {
            encryptedBytes = new Uint8Array(await options.body.get('file').arrayBuffer());
            return new Response(JSON.stringify({
                status: 'ok',
                newId: 'serverFile123456789abc',
            }), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            });
        },
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
        fetchImpl: async () => new Response(encryptedBytes, {
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
    let encryptedBytes = null;
    let storedReadTokenHash = null;

    const sendExitCode = await run(['send-file', '--passphrase', 'extra-passphrase', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: async (_url, options) => {
            const formData = options.body;
            storedReadTokenHash = formData.get('readTokenHash');
            encryptedBytes = new Uint8Array(await formData.get('file').arrayBuffer());
            return new Response(JSON.stringify({
                status: 'ok',
                newId: 'serverFile123456789abc',
            }), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            });
        },
    });

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

            return new Response(encryptedBytes, {
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
    let encryptedBytes = null;
    let storedReadTokenHash = null;

    const sendExitCode = await run(['send-file', '--passphrase', 'extra-passphrase', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: async (_url, options) => {
            const formData = options.body;
            storedReadTokenHash = formData.get('readTokenHash');
            encryptedBytes = new Uint8Array(await formData.get('file').arrayBuffer());
            return new Response(JSON.stringify({
                status: 'ok',
                newId: 'serverFile123456789abc',
            }), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            });
        },
    });

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

            return new Response(encryptedBytes, {
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
