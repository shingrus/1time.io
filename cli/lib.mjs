import {parseArgs} from 'node:util';
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
} from './protocol.mjs';

const secretArgWarning = 'Warning: passing the secret in argv may leak via shell history or process listings.\n';

function write(stream, text) {
    if (text) {
        stream.write(text);
    }
}

export function getHelpText() {
    return `1time v0

Usage:
  1time send [--host <host-or-origin>] [secret]
  1time read [--host <host-or-origin>] <link>
  1time --help

Input precedence for send:
  1. piped stdin
  2. 1TIME_SECRET
  3. positional secret argument (warns because argv is not safe)

Notes:
  - read only supports links passed as an argument in v0
  - passphrases and custom expiry are not supported in v0
  - http:// is only allowed for loopback hosts such as 127.0.0.1
`;
}

export async function readAllStdin(stdin) {
    const chunks = [];
    for await (const chunk of stdin) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }

    return Buffer.concat(chunks).toString('utf8');
}

export async function resolveSecret({stdin, env, values, stderr}) {
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

export async function postJson({origin, path, payload, fetchImpl}) {
    const response = await fetchImpl(buildApiUrl(origin, path), {
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

export async function createSecretLink({host, secret, fetchImpl}) {
    const origin = normalizeOrigin(host || ProtocolConstants.defaultHost);
    const generatedKey = getRandomString(ProtocolConstants.randomKeyLen);
    //left for later passphrase
    const fullSecretKey = generatedKey;
    const {encryptedMessage, hashedKey} = await encryptSecretMessage(secret, fullSecretKey);
    const data = await postJson({
        origin,
        path: 'saveSecret',
        payload: {
            secretMessage: encryptedMessage,
            hashedKey,
            duration: ProtocolConstants.defaultDuration * 86400,
        },
        fetchImpl,
    });

    if (data.status !== 'ok' || !data.newId) {
        throw new Error('Failed to create secret link');
    }

    return buildSecretLink(origin, generatedKey, data.newId);
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

    return decryptSecretMessage(data.cryptedMessage, parsedLink.randomKey);
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
        const {values, positionals} = parseSendArgs(rest);
        if (values.help) {
            write(stdout, getHelpText());
            return 0;
        }
        if (positionals.length > 1) {
            write(stderr, 'send accepts at most one positional secret argument.\n');
            return 1;
        }

        try {
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
        const {values, positionals} = parseReadArgs(rest);
        if (values.help) {
            write(stdout, getHelpText());
            return 0;
        }
        if (positionals.length !== 1) {
            write(stderr, 'read requires exactly one link argument.\n');
            return 1;
        }

        try {
            const secret = await revealSecret({
                host: values.host,
                link: positionals[0],
                fetchImpl,
            });
            write(stdout, `${secret}\n`);
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
