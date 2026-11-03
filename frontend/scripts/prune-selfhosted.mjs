/**
 * Post-build, self-hosted edition only (SELF_HOSTED=true): delete everything in
 * build/ that is not on the allowlist below.
 *
 * It is an allowlist on purpose. A new marketing page, blog post or public asset
 * stays out of self-hosted instances without anyone remembering to gate it, and
 * check-links.mjs fails the build if a kept page still links to something removed.
 */
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
