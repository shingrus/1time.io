/**
 * Post-build: emit <link rel="modulepreload"> for every chunk a page's island
 * pulls in transitively.
 *
 * Without this the browser only discovers those chunks after downloading and
 * parsing the entry script, so the form stays un-submittable for an extra
 * network round trip. On a slow link the round trip costs far more than the
 * bytes do (~2s vs ~30ms on Chrome's Slow 3G profile), so flattening the
 * waterfall is the single biggest win for time-to-interactive.
 *
 * Chunk filenames are content-hashed, so the list can only be built after
 * `astro build` — hence a post-build pass rather than markup in BaseLayout.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {glob} from 'node:fs/promises';
import path from 'node:path';

const BUILD_DIR = path.resolve(import.meta.dirname, '..', 'build');

// Static `import ... from '...'` and bare `import '...'`. Dynamic import() is
// deliberately excluded: those chunks are meant to load later, and preloading
// them would put the cost back on the initial page.
//
// Vite minifies each chunk onto a single line, so neither pattern can anchor to
// a line start — a side-effect import shows up as `;import"./chunk.js"`.
const STATIC_IMPORT = /(?:^|[;\s}])(?:import|export)[^;'"]*?from\s*["']([^"']+)["']/g;
const BARE_IMPORT = /(?:^|[;}])\s*import\s*["']([^"']+)["']/g;
const ENTRY_SCRIPT = /<script[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g;
const EXISTING_PRELOAD = /<link[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g;

const warnings = new Set();

/** Every chunk reachable from `entry` through static imports, excluding `entry`. */
async function collectDeps(entry) {
    const found = new Set();
    const queue = [entry];
    const visited = new Set();

    while (queue.length) {
        const rel = queue.shift();
        if (visited.has(rel)) continue;
        visited.add(rel);

        const abs = path.join(BUILD_DIR, rel.replace(/^\//, ''));
        if (!existsSync(abs)) continue;
        const src = await readFile(abs, 'utf8');

        for (const re of [STATIC_IMPORT, BARE_IMPORT]) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(src)) !== null) {
                const spec = m[1];
                const dep = spec.startsWith('/')
                    ? spec
                    : '/' + path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)).replace(/^\/+/, '');
                if (dep === entry || found.has(dep)) continue;
                // Only hint files that are actually on disk. A regex false
                // positive would otherwise become a 404 on every page view.
                if (!existsSync(path.join(BUILD_DIR, dep.replace(/^\//, '')))) {
                    warnings.add(`  skipped missing dependency ${dep} (imported by ${rel})`);
                    continue;
                }
                found.add(dep);
                queue.push(dep);
            }
        }
    }
    return [...found];
}

let pages = 0;
let links = 0;

for await (const file of glob('**/*.html', {cwd: BUILD_DIR})) {
    const abs = path.join(BUILD_DIR, file);
    let html = await readFile(abs, 'utf8');

    ENTRY_SCRIPT.lastIndex = 0;
    const entries = [...html.matchAll(ENTRY_SCRIPT)].map((m) => m[1]);
    if (entries.length === 0) continue;

    const deps = new Set();
    for (const entry of entries) {
        for (const dep of await collectDeps(entry)) deps.add(dep);
    }

    // Diff against hints already in the page rather than skipping it wholesale:
    // if Astro ever emits its own preloads, the rest still need covering, and
    // this keeps a repeat run idempotent for free.
    EXISTING_PRELOAD.lastIndex = 0;
    for (const [, href] of html.matchAll(EXISTING_PRELOAD)) deps.delete(href);
    if (deps.size === 0) continue;

    const tags = [...deps].map((d) => `<link rel="modulepreload" href="${d}">`).join('');
    html = html.replace('</head>', `${tags}</head>`);
    await writeFile(abs, html);

    pages += 1;
    links += deps.size;
}

for (const w of warnings) console.warn(w);
console.log(`modulepreload: ${links} hint(s) across ${pages} page(s)`);
