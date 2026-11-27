// Post-build: fail if a page has an inline executable script, an inline event handler or a javascript: URL,
// because the CSP script-src is 'self' only. Data blocks such as ld+json are allowed.
import {glob, readFile} from 'node:fs/promises';
import path from 'node:path';

const BUILD_DIR = path.resolve(import.meta.dirname, '..', 'build');
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const TAG = /<[a-zA-Z][^\s>/]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const QUOTED_VALUE = /"[^"]*"|'[^']*'/g;
const HANDLER = /\s(on[a-z]+)\s*=/i;
const JS_URL = /\s(href|src|action|formaction)\s*=\s*(?:"\s*javascript:|'\s*javascript:|\s*javascript:)/i;
const NON_MARKUP = /(<(style|script)\b[^>]*>)[\s\S]*?(<\/\2>)/gi;
const EXECUTABLE_TYPES = /^(?:module|(?:text|application)\/(?:x-)?(?:javascript|ecmascript)|text\/jscript|text\/livescript)$/i;

function excerpt(text) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 80);
}

const problems = [];
for await (const rel of glob('**/*.html', {cwd: BUILD_DIR})) {
    const html = await readFile(path.join(BUILD_DIR, rel), 'utf8');
    for (const [, attrs, body] of html.matchAll(SCRIPT)) {
        if (/\bsrc\s*=/i.test(attrs) || !body.trim()) continue;
        const type = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
        const value = type ? (type[1] ?? type[2] ?? type[3]).trim() : '';
        if (value === '' || EXECUTABLE_TYPES.test(value)) {
            problems.push(`${rel}: inline script: ${excerpt(body)}`);
        }
    }
    for (const [tag] of html.replace(NON_MARKUP, '$1$3').matchAll(TAG)) {
        const handler = HANDLER.exec(tag.replace(QUOTED_VALUE, '""'));
        if (handler) problems.push(`${rel}: inline ${handler[1]} handler: ${excerpt(tag)}`);
        const jsUrl = JS_URL.exec(tag);
        if (jsUrl) problems.push(`${rel}: javascript: URL in ${jsUrl[1]}: ${excerpt(tag)}`);
    }
}

if (problems.length) {
    console.error(`check-inline-scripts: ${problems.length} problem(s), CSP script-src is 'self':\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log('check-inline-scripts: no inline executable scripts, event handlers or javascript: URLs');
