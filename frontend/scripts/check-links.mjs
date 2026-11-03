/**
 * Post-build: fail if any page in build/ links to a same-origin path that does
 * not exist in build/. Runs for both editions; it is what keeps the self-hosted
 * edition (an allowlist of pages, see prune-selfhosted.mjs) free of dead links
 * when a shared component gains a link to a page the edition does not ship.
 *
 * Checks href= and src= values that start with a single "/". nginx serves a
 * path as the file itself, then <path>/index.html (docker/nginx and
 * configs/nginx `try_files $uri $uri/ $uri/index.html`), so this resolves the
 * same way. Redirects that live only in nginx are not visible here, so a link
 * relying on one fails the check — link to the target instead.
 */
import {existsSync, statSync} from 'node:fs';
import {glob, readFile} from 'node:fs/promises';
import path from 'node:path';

const BUILD_DIR = path.resolve(import.meta.dirname, '..', 'build');
const ATTR = /\b(?:href|src)="(\/(?!\/)[^"]*)"/g;
// Inline CSS holds attribute selectors such as a[href="/developers/"]; those are not links.
// Only the element's contents go; a <script src> tag itself is still checked.
const NON_MARKUP = /(<(style|script)\b[^>]*>)[\s\S]*?(<\/\2>)/gi;

function exists(urlPath) {
    const clean = decodeURIComponent(urlPath.replace(/[?#].*$/, ''));
    const abs = path.join(BUILD_DIR, clean);
    if (!abs.startsWith(BUILD_DIR)) return false;
    if (existsSync(abs) && statSync(abs).isFile()) return true;
    return existsSync(path.join(abs, 'index.html'));
}

const broken = [];
for await (const rel of glob('**/*.html', {cwd: BUILD_DIR})) {
    const html = (await readFile(path.join(BUILD_DIR, rel), 'utf8')).replace(NON_MARKUP, '$1$3');
    for (const [, target] of html.matchAll(ATTR)) {
        if (!exists(target)) broken.push(`${rel} -> ${target}`);
    }
}

if (broken.length) {
    const unique = [...new Set(broken)].sort();
    console.error(`check-links: ${unique.length} broken same-origin link(s):\n  ${unique.join('\n  ')}`);
    process.exit(1);
}
console.log('check-links: every same-origin href/src resolves');
