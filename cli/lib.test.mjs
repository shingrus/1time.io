import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, basename, resolve} from 'node:path';
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
                newId: 'file123',
            }), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            });
        },
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.getOutput(), '');
    assert.equal(requestBody.get('duration'), '86400');
    assert.equal(typeof requestBody.get('hashedKey'), 'string');
    assert.ok(requestBody.get('file') instanceof Blob);
    assert.match(stdout.getOutput(), /^https:\/\/1time\.example\/f\/#/);
    assert.match(stdout.getOutput(), /file123/);
});

test('run read-file downloads the decrypted file into the current directory', async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), '1time-cli-source-'));
    const outputDir = await mkdtemp(join(tmpdir(), '1time-cli-output-'));
    const sourcePath = join(sourceDir, 'report.txt');
    await writeFile(sourcePath, 'round-trip file');

    const sendStdout = createWritableCapture();
    let encryptedBytes = null;
    let storedHashedKey = null;

    const sendExitCode = await run(['send-file', '--passphrase', 'extra-passphrase', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: async (_url, options) => {
            const formData = options.body;
            storedHashedKey = formData.get('hashedKey');
            encryptedBytes = new Uint8Array(await formData.get('file').arrayBuffer());
            return new Response(JSON.stringify({
                status: 'ok',
                newId: 'server-file-123',
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
            assert.equal(requestBody.id, 'server-file-123');
            assert.equal(requestBody.hashedKey, storedHashedKey);

            return new Response(encryptedBytes, {
                status: 200,
                headers: {'Content-Type': 'application/octet-stream'},
            });
        },
    });

    assert.equal(readExitCode, 0);
    assert.equal(readStderr.getOutput(), passphraseWarningLine());
    const outputPath = readStdout.getOutput().trim();
    assert.equal(outputPath, resolve(outputDir, basename(sourcePath)));
    assert.equal(await readFile(outputPath, 'utf8'), 'round-trip file');
});

test('read-file reports when a passphrase-protected file link is missing the passphrase', async () => {
    const stdout = createWritableCapture();
    const stderr = createWritableCapture();

    const exitCode = await run(['read-file', 'https://1time.io/f/#AbCdEfGhIjKlMnOpQr-_file123'], {
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
    let storedHashedKey = null;

    const sendExitCode = await run(['send-file', '--passphrase', 'extra-passphrase', sourcePath], {
        stdin: createStdin('', true),
        stdout: sendStdout.stream,
        stderr: createWritableCapture().stream,
        env: {},
        fetchImpl: async (_url, options) => {
            const formData = options.body;
            storedHashedKey = formData.get('hashedKey');
            encryptedBytes = new Uint8Array(await formData.get('file').arrayBuffer());
            return new Response(JSON.stringify({
                status: 'ok',
                newId: 'server-file-123',
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
            assert.equal(requestBody.id, 'server-file-123');
            assert.equal(requestBody.hashedKey, storedHashedKey);

            return new Response(encryptedBytes, {
                status: 200,
                headers: {'Content-Type': 'application/octet-stream'},
            });
        },
    });

    assert.equal(readExitCode, 0);
    assert.equal(readStderr.getOutput(), passphraseWarningLine());

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

    const exitCode = await run(['read-file', '--out', targetPath, 'https://1time.io/f/#AbCdEfGhIjKlMnOpQr-_file123'], {
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
