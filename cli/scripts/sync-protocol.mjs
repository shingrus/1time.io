import {copyFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cliDir = resolve(scriptDir, '..');
const sourcePath = resolve(cliDir, '../frontend/utils/protocol.mjs');
const targetPath = resolve(cliDir, 'protocol.mjs');

await copyFile(sourcePath, targetPath);
