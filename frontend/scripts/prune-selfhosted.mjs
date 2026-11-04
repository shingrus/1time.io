// Self-hosted edition: delete everything in build/ not on the allowlist, so new pages stay out by default.
import {readdir, rm} from 'node:fs/promises';
import path from 'node:path';

if (process.env.SELF_HOSTED !== 'true') {
    process.exit(0);
}

const BUILD_DIR = path.resolve(import.meta.dirname, '..', 'build');

const KEEP = new Set([
    // Pages: the two forms, the generator, the view pages and My Secrets.
    'index.html',
    'secure-file-sharing',
    'password-generator',
    'v',
    'f',
    'my-secrets',
    '404.html',
    'robots.txt',
    // Assets those pages load.
    '_astro',
    'favicon.svg',
    'favicon.ico',
    'favicon-96x96.png',
    'apple-touch-icon.png',
    'apple-touch-icon-precomposed.png',
    'manifest.webmanifest',
    'web-app-manifest-192x192.png',
    'web-app-manifest-512x512.png',
]);

const KEEP_PATTERN = /\.woff2$/;

const removed = [];
for (const entry of await readdir(BUILD_DIR)) {
    if (KEEP.has(entry) || KEEP_PATTERN.test(entry)) continue;
    await rm(path.join(BUILD_DIR, entry), {recursive: true, force: true});
    removed.push(entry);
}

console.log(`prune-selfhosted: removed ${removed.length} entries from build/ (${removed.sort().join(', ')})`);
