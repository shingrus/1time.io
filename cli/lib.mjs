import {parseArgs} from 'node:util';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {basename, parse, resolve} from 'node:path';
import {
    ProtocolConstants,
    buildApiUrl,
    buildSecretLink,
    decryptSecretBytes,
    decryptSecretMessage,
    encryptSecretBytes,
    encryptSecretMessage,
    getRandomString,
    hashSecretKey,
    normalizeOrigin,
    parseSecretLink,
} from './protocol.mjs';

const secretArgWarning = 'Warning: passing the secret in argv may leak via shell history or process listings.\n';
const passphraseArgWarning = 'Warning: passing the passphrase in argv may leak via shell history or process listings.\n';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const secondsPerHour = 60 * 60;
const secondsPerDay = secondsPerHour * 24;
const maxExpiresInSeconds = 30 * secondsPerDay;
const defaultExpiresInSeconds = ProtocolConstants.defaultDuration * secondsPerDay;
const defaultViews = 1;
const maxViews = 10;
// Self-reported log marker mirroring the extension's ?src=ext. Not trustworthy
// attribution — anyone can send it — so nothing may gate on it.
const clientSource = 'cli';

function apiUrl(origin, path) {
    return buildApiUrl(origin, `${path}?src=${clientSource}`);
}

function write(stream, text) {
    if (text) {
        stream.write(text);
    }
}

export function getHelpText() {
    return `1time v0

Usage:
  1time send [--host <host-or-origin>] [--expires-in <Nd|Nh|NdNh>] [--views <N>] [secret]
  1time read [--host <host-or-origin>] <link>
  1time send-file [--host <host-or-origin>] [--expires-in <Nd|Nh|NdNh>] [--views <N>] [--passphrase <passphrase>] <path>
  1time read-file [--host <host-or-origin>] [--passphrase <passphrase>] [--out <path>] <link>
  1time --help

Input precedence for send:
  1. piped stdin
  2. 1TIME_SECRET
  3. positional secret argument (warns because argv is not safe)

Notes:
  - send-file/read-file support optional passphrases via --passphrase or 1TIME_PASSPHRASE
  - --expires-in supports h and d units, for example 23h, 2d, or 2d23h (default 1d, max 30d)
  - --views sets how many times the link can be opened, downloads for files (default 1, max 10)
  - read/read-file report the remaining views on stderr, so stdout stays pipeable
  - http:// is only allowed for loopback hosts such as 127.0.0.1
`;
}

async function readAllStdin(stdin) {
    const chunks = [];
    for await (const chunk of stdin) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }

    return Buffer.concat(chunks).toString('utf8');
}

async function resolveSecret({stdin, env, values, stderr}) {
    if (!stdin.isTTY) {
        const stdinSecret = await readAllStdin(stdin);
        if (stdinSecret.length > 0) {
            return stdinSecret;
        }
    }

    if (env['1TIME_SECRET']) {
        return env['1TIME_SECRET'];
    }

    if (typeof values.secret === 'string' && values.secret.length > 0) {
        write(stderr, secretArgWarning);
        return values.secret;
    }

    throw new Error('Missing secret. Provide it via stdin, 1TIME_SECRET, or a positional argument.');
}

function resolveOptionalPassphrase({env, values, stderr}) {
    if (env['1TIME_PASSPHRASE']) {
        return env['1TIME_PASSPHRASE'];
    }

    if (typeof values.passphrase === 'string' && values.passphrase.length > 0) {
        write(stderr, passphraseArgWarning);
        return values.passphrase;
    }

    return '';
}

function parseExpiresIn(value) {
    if (value === undefined) {
        return defaultExpiresInSeconds;
    }

    const raw = String(value).trim().toLowerCase();
    const match = /^(?:(\d+)d)?(?:(\d+)h)?$/.exec(raw);
    if (!match || (!match[1] && !match[2])) {
        throw new Error(`Invalid expires-in value "${raw}": use d and h units, for example 23h, 2d, or 2d23h.`);
    }

    const totalSeconds = Number(match[1] || 0) * secondsPerDay + Number(match[2] || 0) * secondsPerHour;

    if (totalSeconds <= 0) {
        throw new Error(`Invalid expires-in value "${raw}": duration must be greater than 0.`);
    }

    if (totalSeconds > maxExpiresInSeconds) {
        throw new Error(`Invalid expires-in value "${raw}": maximum is 30d.`);
    }

    return totalSeconds;
}

function parseViews(value) {
    if (value === undefined) {
        return defaultViews;
    }

    const raw = String(value).trim();
    if (!/^\d+$/.test(raw)) {
        throw new Error(`Invalid views value "${raw}": use a whole number between 1 and ${maxViews}.`);
    }

    const views = Number(raw);
    if (views < 1 || views > maxViews) {
        throw new Error(`Invalid views value "${raw}": use a whole number between 1 and ${maxViews}.`);
    }

    return views;
}

async function postJson({origin, path, payload, fetchImpl}) {
    const response = await fetchImpl(apiUrl(origin, path), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
}

export async function createSecretLink({host, secret, expiresInSeconds = defaultExpiresInSeconds, views = defaultViews, fetchImpl}) {
    const origin = normalizeOrigin(host || ProtocolConstants.defaultHost);
    const generatedKey = getRandomString(ProtocolConstants.randomKeyLen);
    //left for later passphrase
    const {encryptedMessage, hashedKey} = await encryptSecretMessage(secret, generatedKey);
    const data = await postJson({
        origin,
        path: 'saveSecret',
        payload: {
            secretMessage: encryptedMessage,
            hashedKey,
            duration: expiresInSeconds,
            views,
        },
        fetchImpl,
    });

    if (data.status !== 'ok' || !data.newId) {
        throw new Error('Failed to create secret link');
    }

    return buildSecretLink(origin, generatedKey, data.newId);
}

function packFilePayload(meta, fileBytes) {
    const rawBytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
    const metaBytes = textEncoder.encode(JSON.stringify(meta));
    const packed = new Uint8Array(4 + metaBytes.length + rawBytes.length);

    packed[0] = (metaBytes.length >> 24) & 0xff;
    packed[1] = (metaBytes.length >> 16) & 0xff;
    packed[2] = (metaBytes.length >> 8) & 0xff;
    packed[3] = metaBytes.length & 0xff;
    packed.set(metaBytes, 4);
    packed.set(rawBytes, 4 + metaBytes.length);

    return packed;
}

function unpackFilePayload(decryptedBytes) {
    const bytes = decryptedBytes instanceof Uint8Array ? decryptedBytes : new Uint8Array(decryptedBytes);
    if (bytes.byteLength < 4) {
        throw new Error('Encrypted file payload is truncated');
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const metaLen = view.getUint32(0);
    const metaEnd = 4 + metaLen;
    if (metaEnd > bytes.byteLength) {
        throw new Error('Encrypted file metadata is invalid');
    }

    const meta = JSON.parse(textDecoder.decode(bytes.subarray(4, metaEnd)));
    return {
        meta,
        fileBytes: bytes.subarray(metaEnd),
    };
}

function buildFileLink(origin, randomString, newId) {
    return `${normalizeOrigin(origin)}/f/#${randomString}${newId}`;
}

async function writeFileToAvailablePath(targetPath, fileBytes) {
    for (let attempt = 0; attempt < 1000; attempt++) {
        const {dir, name, ext} = parse(targetPath);
        const suffix = attempt === 0 ? '' : ` (${attempt})`;
        const candidatePath = resolve(dir || '.', `${name}${suffix}${ext}`);
        try {
            await writeFile(candidatePath, fileBytes, {flag: 'wx'});
            return candidatePath;
        } catch (error) {
            if (error?.code === 'EEXIST') {
                continue;
            }
            throw error;
        }
    }

    throw new Error(`Failed to allocate output path for ${targetPath}`);
}

async function createFileLink({host, filePath, passphrase = '', expiresInSeconds = defaultExpiresInSeconds, views = defaultViews, fetchImpl}) {
    const origin = normalizeOrigin(host || ProtocolConstants.defaultHost);
    const fileBytes = await readFile(filePath);
    const meta = {
        name: basename(filePath),
        type: 'application/octet-stream',
        size: fileBytes.length,
    };
    const packed = packFilePayload(meta, fileBytes);
    const randomKey = getRandomString(ProtocolConstants.randomKeyLen);
    const fullSecretKey = `${passphrase}${randomKey}`;
    const {encryptedBytes, hashedKey} = await encryptSecretBytes(packed, fullSecretKey);

    const formData = new FormData();
    formData.append('file', new Blob([encryptedBytes]), 'encrypted.bin');
    formData.append('hashedKey', hashedKey);
    formData.append('duration', String(expiresInSeconds));
    if (views !== 1) {
        formData.append('views', String(views));
    }

    const response = await fetchImpl(apiUrl(origin, 'saveFile'), {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();

    if (data.status !== 'ok' || !data.newId) {
        throw new Error('Failed to create file link');
    }

    return buildFileLink(origin, randomKey, data.newId);
}

async function readFileLink({host, link, passphrase = '', outPath, cwd = process.cwd(), fetchImpl}) {
    const parsedLink = parseSecretLink(link, host || ProtocolConstants.defaultHost);
    const fullSecretKey = `${passphrase}${parsedLink.randomKey}`;

    if (outPath) {
        const resolvedOut = resolve(cwd, outPath);
        try {
            await stat(resolvedOut);
            throw new Error(`Output file already exists: ${resolvedOut}`);
        } catch (error) {
            if (error.message.startsWith('Output file already exists')) {
                throw error;
            }
            // ENOENT is expected — file doesn't exist yet
        }
    }

    const hashedKey = await hashSecretKey(fullSecretKey);
    const response = await fetchImpl(apiUrl(parsedLink.origin, 'getFile'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            id: parsedLink.id,
            hashedKey,
        }),
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    const viewsLeft = parseViewsLeftHeader(response.headers?.get?.('X-1Time-Views-Left'));
    const contentType = response.headers?.get?.('Content-Type') || response.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.status === 'wrong key') {
            throw new Error('This file link requires the correct passphrase. Provide it via --passphrase or 1TIME_PASSPHRASE.');
        }
        if (data.status === 'no message') {
            throw new Error('This file has already been downloaded or has expired.');
        }
        throw new Error('Failed to read file link');
    }

    const encryptedBuffer = await response.arrayBuffer();
    const decryptedBytes = await decryptSecretBytes(new Uint8Array(encryptedBuffer), fullSecretKey);
    const {meta, fileBytes} = unpackFilePayload(decryptedBytes);

    if (outPath) {
        const resolvedOut = resolve(cwd, outPath);
        await writeFile(resolvedOut, fileBytes);
        return {outputPath: resolvedOut, meta, viewsLeft};
    }

    const defaultName = basename(meta?.name || 'download.bin');
    const outputPath = await writeFileToAvailablePath(resolve(cwd, defaultName), fileBytes);
    return {outputPath, meta, viewsLeft};
}

function parseViewsLeftHeader(value) {
    // Older backends omit the header; treat that as the consumed one-time case.
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function formatViewsLeft(viewsLeft, noun) {
    if (viewsLeft <= 0) {
        return 'This link is now consumed and has been deleted from the server.\n';
    }

    return `This link has ${viewsLeft} ${viewsLeft === 1 ? noun : `${noun}s`} remaining.\n`;
}

export async function revealSecret({host, link, fetchImpl}) {
    const parsedLink = parseSecretLink(link, host || ProtocolConstants.defaultHost);
    const hashedKey = await hashSecretKey(parsedLink.randomKey);
    const data = await postJson({
        origin: parsedLink.origin,
        path: 'get',
        payload: {
            id: parsedLink.id,
            hashedKey,
        },
        fetchImpl,
    });

    if (data.status === 'wrong key') {
        throw new Error('This link requires a passphrase, which v0 does not support.');
    }

    if (data.status === 'no message') {
        throw new Error('This message has already been read or has expired.');
    }

    if (data.status !== 'ok' || typeof data.cryptedMessage !== 'string' || data.cryptedMessage.length === 0) {
        throw new Error('Failed to read secret link');
    }

    const secret = await decryptSecretMessage(data.cryptedMessage, parsedLink.randomKey);
    // Older backends omit viewsLeft; treat that as the consumed one-time case.
    return {secret, viewsLeft: typeof data.viewsLeft === 'number' ? data.viewsLeft : 0};
}

function parseSendArgs(args) {
    return parseArgs({
        args,
        allowPositionals: true,
        options: {
            help: {
                type: 'boolean',
                short: 'h',
            },
            host: {
                type: 'string',
            },
            'expires-in': {
                type: 'string',
            },
            views: {
                type: 'string',
            },
        },
    });
}

function parseSendFileArgs(args) {
    return parseArgs({
        args,
        allowPositionals: true,
        options: {
            help: {
                type: 'boolean',
                short: 'h',
            },
            host: {
                type: 'string',
            },
            'expires-in': {
                type: 'string',
            },
            views: {
                type: 'string',
            },
            passphrase: {
                type: 'string',
            },
        },
    });
}

function parseReadArgs(args) {
    return parseArgs({
        args,
        allowPositionals: true,
        options: {
            help: {
                type: 'boolean',
                short: 'h',
            },
            host: {
                type: 'string',
            },
        },
    });
}

function parseReadFileArgs(args) {
    return parseArgs({
        args,
        allowPositionals: true,
        options: {
            help: {
                type: 'boolean',
                short: 'h',
            },
            host: {
                type: 'string',
            },
            out: {
                type: 'string',
            },
            passphrase: {
                type: 'string',
            },
        },
    });
}

// parseArgs throws on a missing option value or an unknown flag, so every
// command routes through here to report it instead of crashing with a stack.
function parseCommandArgs(parseArgsForCommand, args, stderr) {
    try {
        return parseArgsForCommand(args);
    } catch (error) {
        write(stderr, `${error.message}\n`);
        return null;
    }
}

export async function run(argv = process.argv.slice(2), io = {}) {
    const stdin = io.stdin || process.stdin;
    const stdout = io.stdout || process.stdout;
    const stderr = io.stderr || process.stderr;
    const env = io.env || process.env;
    const fetchImpl = io.fetchImpl || fetch;

    if (argv.length === 0) {
        write(stderr, getHelpText());
        return 1;
    }

    const [command, ...rest] = argv;

    if (command === '--help' || command === '-h') {
        write(stdout, getHelpText());
        return 0;
    }

    if (command === 'send') {
        const parsed = parseCommandArgs(parseSendArgs, rest, stderr);
        if (!parsed) {
            return 1;
        }
        const {values, positionals} = parsed;
        if (values.help) {
            write(stdout, getHelpText());
            return 0;
        }
        if (positionals.length > 1) {
            write(stderr, 'send accepts at most one positional secret argument.\n');
            return 1;
        }

        try {
            const expiresInSeconds = parseExpiresIn(values['expires-in']);
            const views = parseViews(values.views);
            const secret = await resolveSecret({
                stdin,
                env,
                values: {
                    ...values,
                    secret: positionals[0],
                },
                stderr,
            });
            const link = await createSecretLink({
                host: values.host,
                secret,
                expiresInSeconds,
                views,
                fetchImpl,
            });
            write(stdout, `${link}\n`);
            return 0;
        } catch (error) {
            write(stderr, `${error.message}\n`);
            return 1;
        }
    }

    if (command === 'send-file') {
        const parsed = parseCommandArgs(parseSendFileArgs, rest, stderr);
        if (!parsed) {
            return 1;
        }
        const {values, positionals} = parsed;
        if (values.help) {
            write(stdout, getHelpText());
            return 0;
        }
        if (positionals.length !== 1) {
            write(stderr, 'send-file requires exactly one file path argument.\n');
            return 1;
        }

        try {
            const expiresInSeconds = parseExpiresIn(values['expires-in']);
            const views = parseViews(values.views);
            const link = await createFileLink({
                host: values.host,
                filePath: positionals[0],
                passphrase: resolveOptionalPassphrase({env, values, stderr}),
                expiresInSeconds,
                views,
                fetchImpl,
            });
            write(stdout, `${link}\n`);
            return 0;
        } catch (error) {
            write(stderr, `${error.message}\n`);
            return 1;
        }
    }

    if (command === 'read') {
        const parsed = parseCommandArgs(parseReadArgs, rest, stderr);
        if (!parsed) {
            return 1;
        }
        const {values, positionals} = parsed;
        if (values.help) {
            write(stdout, getHelpText());
            return 0;
        }
        if (positionals.length !== 1) {
            write(stderr, 'read requires exactly one link argument.\n');
            return 1;
        }

        try {
            const {secret, viewsLeft} = await revealSecret({
                host: values.host,
                link: positionals[0],
                fetchImpl,
            });
            write(stdout, `${secret}\n`);
            write(stderr, formatViewsLeft(viewsLeft, 'view'));
            return 0;
        } catch (error) {
            write(stderr, `${error.message}\n`);
            return 1;
        }
    }

    if (command === 'read-file') {
        const parsed = parseCommandArgs(parseReadFileArgs, rest, stderr);
        if (!parsed) {
            return 1;
        }
        const {values, positionals} = parsed;
        if (values.help) {
            write(stdout, getHelpText());
            return 0;
        }
        if (positionals.length !== 1) {
            write(stderr, 'read-file requires exactly one link argument.\n');
            return 1;
        }

        try {
            const {outputPath, viewsLeft} = await readFileLink({
                host: values.host,
                link: positionals[0],
                passphrase: resolveOptionalPassphrase({env, values, stderr}),
                outPath: values.out,
                cwd: io.cwd || process.cwd(),
                fetchImpl,
            });
            write(stdout, `${outputPath}\n`);
            write(stderr, formatViewsLeft(viewsLeft, 'download'));
            return 0;
        } catch (error) {
            write(stderr, `${error.message}\n`);
            return 1;
        }
    }

    write(stderr, `Unknown command: ${command}\n`);
    write(stderr, getHelpText());
    return 1;
}
