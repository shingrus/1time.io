import {copyFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionDir = resolve(scriptDir, '..');
const sourcePath = resolve(extensionDir, '../frontend/src/lib/protocol.mjs');
const targetPath = resolve(extensionDir, 'protocol.mjs');

await copyFile(sourcePath, targetPath);
