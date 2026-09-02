/**
 * Build the push service worker.
 *
 * The worker needs `nameForId`, but files in `public/` bypass Vite entirely, so
 * it cannot import anything at runtime. Bundling it here keeps one source of
 * truth for the wordlist — copying secretName.js into `public/` is exactly the
 * forking AGENTS.md warns about for protocol.mjs.
 *
 * Output goes to `public/push-sw.js` rather than `build/` so `astro dev` serves
 * it too. It is generated, and gitignored: edit `src/sw/push-sw.js`.
 *
 * Runs from npm's `predev` and `prebuild` hooks.
 */
import {build} from 'esbuild';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENTRY = path.join(ROOT, 'src', 'sw', 'push-sw.js');
export const DEFAULT_OUTPUT = path.join(ROOT, 'public', 'push-sw.js');

/**
 * Bundle the worker. Exported so the test suite builds the same artifact this
 * script ships, rather than asserting against a stale copy in public/.
 */
export async function buildPushWorker(outfile = DEFAULT_OUTPUT) {
    await build({
        entryPoints: [ENTRY],
        outfile,
        bundle: true,
        minify: true,
        // A classic worker, not an ES module: `type: 'module'` workers have a
        // narrower browser floor and buy nothing here, since bundling already
        // resolved every import.
        format: 'iife',
        target: ['chrome91', 'firefox114', 'safari16.4'],
        // The worker is served from the site root so it can claim any
        // /push/<id>/ scope without a Service-Worker-Allowed header.
        banner: {js: '/* Generated from src/sw/push-sw.js — do not edit. */'},
    });
    return outfile;
}

// Only build when run as a script, so importing this from a test does nothing.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
    await buildPushWorker();
    console.log(`push-sw.js -> ${path.relative(ROOT, DEFAULT_OUTPUT)}`);
}
