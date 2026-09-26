/**
 * Post-build: write build/llms-full.txt — llms.txt followed by the full text of
 * every page it links, so an AI assistant can read the site in one request.
 * llms.txt is the manifest; add a link there and the page appears here.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';

const BUILD_DIR = path.resolve(import.meta.dirname, '..', 'build');
const ORIGIN = 'https://1time.io';
const SKIP = new Set(['/robots.txt', '/llms-full.txt']);

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rarr: '→', larr: '←', middot: '·'};

function decode(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
        if (code[0] === '#') {
            const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
        }
        return ENTITIES[code.toLowerCase()] ?? whole;
    });
}

function collapseOutsidePre(html) {
    return html.split(/(<pre\b[\s\S]*?<\/pre>)/i)
        .map((part, i) => (i % 2 ? part : part.replace(/\s+/g, ' ')))
        .join('');
}

function htmlToText(html) {
    const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
    return decode(collapseOutsidePre(main)
        .replace(/<(script|style|svg|noscript|template|form|button|textarea|select|nav)\b[\s\S]*?<\/\1>/gi, '')
        .replace(/<(\w+)[^>]*aria-hidden="true"[^>]*>[^<]*<\/\1>/gi, '')
        .replace(/<h([1-4])[^>]*>/gi, (_, level) => `\n\n${'#'.repeat(Number(level))} `)
        .replace(/<\/h[1-4]>/gi, '\n\n')
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, ' | ')
        .replace(/<(br|\/p|\/tr|\/div|\/section|\/ul|\/ol|\/table|\/pre|\/blockquote)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ''))
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function linkedPaths(llms) {
    const seen = new Set();
    for (const [, url] of llms.matchAll(/\]\((https:\/\/1time\.io\/[^)\s]*)\)/g)) {
        const p = new URL(url).pathname;
        if (!SKIP.has(p)) seen.add(p);
    }
    return [...seen];
}

function builtFile(p) {
    return path.join(BUILD_DIR, p.endsWith('/') ? `${p}index.html` : p);
}

const llms = await readFile(path.join(BUILD_DIR, 'llms.txt'), 'utf8');
const sections = [llms.trim()];
const missing = [];

for (const p of linkedPaths(llms)) {
    const file = builtFile(p);
    if (!existsSync(file)) {
        missing.push(p);
        continue;
    }
    const raw = await readFile(file, 'utf8');
    const isHtml = file.endsWith('.html');
    const title = isHtml ? decode(raw.match(/<title>([^<]*)<\/title>/i)?.[1] ?? p) : p;
    const body = isHtml ? htmlToText(raw) : raw.trim();
    const squash = (text) => text.replace(/\s+/g, ' ');
    if (!isHtml && squash(sections.join(' ')).includes(squash(body).slice(0, 500))) {
        continue;
    }
    sections.push(`# ${title}\n\nURL: ${ORIGIN}${p}\n\n${body}`);
}

if (missing.length) {
    throw new Error(`llms-full: pages linked from llms.txt are missing from the build: ${missing.join(', ')}`);
}

const out = sections.join('\n\n---\n\n') + '\n';
await writeFile(path.join(BUILD_DIR, 'llms-full.txt'), out);
console.log(`llms-full: ${sections.length - 1} pages, ${Math.round(out.length / 1024)} KB`);
