// Generates lib/protocol.js (CommonJS) from the single source of truth,
// frontend/src/lib/protocol.mjs, so the Zapier app shares the SAME crypto as
// the website/CLI instead of a hand-maintained copy. Run via `npm run sync`
// (also runs automatically before tests). The generated file is gitignored.
//
// protocol.mjs is pure (no imports, uses globalThis.crypto), so the only
// transform needed is stripping the `export` keywords and appending
// module.exports for the named exports.

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../frontend/src/lib/protocol.mjs');
const OUT = resolve(here, '../lib/protocol.js');

const source = readFileSync(SRC, 'utf8');

const exportRe = /export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/g;
const names = [...source.matchAll(exportRe)].map((m) => m[1]);
if (names.length === 0) {
    throw new Error(`No exports found in ${SRC} — did the protocol format change?`);
}

const body = source.replace(/export\s+(async\s+function|function|const)\s/g, '$1 ');
const header =
    '// AUTO-GENERATED from frontend/src/lib/protocol.mjs by scripts/sync-protocol.mjs.\n' +
    '// Do NOT edit by hand. Regenerate with: npm run sync\n\n';
const footer = `\nmodule.exports = {${names.map((n) => `\n    ${n},`).join('')}\n};\n`;

mkdirSync(dirname(OUT), {recursive: true});
writeFileSync(OUT, header + body + footer);
console.log(`synced ${names.length} exports -> lib/protocol.js (${names.join(', ')})`);
