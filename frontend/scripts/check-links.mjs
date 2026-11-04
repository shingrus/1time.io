// Post-build: fail if a page links to a same-origin path missing from build/.
// Redirects that live only in nginx are invisible here: link to the target instead.
import {existsSync, statSync} from 'node:fs';
import {glob, readFile} from 'node:fs/promises';
import path from 'node:path';

const BUILD_DIR = path.resolve(import.meta.dirname, '..', 'build');
const ATTR = /\b(?:href|src)="(\/(?!\/)[^"]*)"/g;
// Inline CSS holds selectors like a[href="/developers/"]; those are not links.
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
