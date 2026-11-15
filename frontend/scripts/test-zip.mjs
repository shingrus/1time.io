import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildZip, zipFileName, zipSize} from '../src/lib/zip.js';

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const has = (cmd) => spawnSync('which', [cmd]).status === 0;
const file = (name, bytes, lastModified) => new File([bytes], name, {lastModified});
const text = (s) => Buffer.from(s);

const big = crypto.randomBytes(5 * 1024 * 1024 + 123);
const entries = [
    ['empty.txt', Buffer.alloc(0), Date.UTC(2024, 5, 1)],
    ['Hợp đồng thuê nhà.pdf', text('vi'), Date.UTC(2023, 0, 2)],
    ['見積書.xlsx', text('ja'), Date.UTC(2022, 11, 31)],
    ['résumé été.txt', text('fr'), Date.UTC(2021, 3, 4)],
    ['photo.jpg', text('one'), Date.UTC(2020, 1, 1)],
    ['photo.jpg', text('two'), Date.UTC(2020, 1, 2)],
    ['photo.jpg', text('three'), Date.UTC(2020, 1, 3)],
    ['Photo.JPG', text('four'), Date.UTC(2020, 1, 4)],
    ['README', text('a'), Date.UTC(2019, 1, 1)],
    ['README', text('b'), Date.UTC(2019, 1, 1)],
    ['dir/sub/inner.txt', text('inner'), Date.UTC(1975, 0, 1)],
    ['..\\up.txt', text('up'), Date.UTC(2018, 0, 1)],
    ['../../etc/passwd', text('passwd'), Date.UTC(2018, 0, 1)],
    ['big.bin', big, Date.UTC(2017, 6, 7)],
];
const expectedNames = [
    'empty.txt', 'Hợp đồng thuê nhà.pdf', '見積書.xlsx', 'résumé été.txt',
    'photo.jpg', 'photo (2).jpg', 'photo (3).jpg', 'Photo (4).JPG',
    'README', 'README (2)', 'inner.txt', 'up.txt', 'passwd', 'big.bin',
];
const files = entries.map(([name, bytes, modified]) => file(name, bytes, modified));

const zip = await buildZip(files);
assert.equal(zip.name, zipFileName);
assert.equal(zip.type, 'application/zip');
assert.equal(zipSize(files), zip.size);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-zip-'));
try {
    const zipPath = path.join(dir, 'out.zip');
    fs.writeFileSync(zipPath, Buffer.from(await zip.arrayBuffer()));
    const expectedHashes = entries.map(([, bytes]) => sha(bytes));
    let tools = 0;

    if (has('unzip')) {
        tools++;
        execFileSync('unzip', ['-t', zipPath], {stdio: 'pipe'});
        const unzipDir = path.join(dir, 'unzip');
        execFileSync('unzip', ['-q', zipPath, '-d', unzipDir], {stdio: ['ignore', 'pipe', 'pipe']});
        expectedNames.forEach((name, i) => {
            const bytes = fs.readFileSync(path.join(unzipDir, name.normalize('NFC')));
            assert.equal(sha(bytes), expectedHashes[i], `unzip: ${name}`);
        });
        console.log('unzip -t and extraction: ok');
    } else console.log('unzip not installed, skipped');

    if (has('python3')) {
        tools++;
        const code = `
import sys, zipfile, hashlib, json
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
infos = z.infolist()
print(json.dumps({
  'names': [i.filename for i in infos],
  'stored': all(i.compress_type == zipfile.ZIP_STORED for i in infos),
  'systems': [[i.create_system, i.external_attr >> 16] for i in infos],
  'dates': [list(i.date_time) for i in infos],
  'hashes': [hashlib.sha256(z.read(i)).hexdigest() for i in infos],
}))`;
        const out = JSON.parse(execFileSync('python3', ['-I', '-c', code, zipPath]).toString());
        assert.deepEqual(out.names, expectedNames);
        assert.ok(out.names.every((n) => !n.includes('/') && !n.includes('\\')));
        assert.ok(out.stored);
        assert.ok(out.systems.every(([system, mode]) => system === 3 && mode === 0o100644));
        assert.deepEqual(out.hashes, expectedHashes);
        const expectedDates = entries.map(([, , ms]) => {
            const d = new Date(ms);
            if (d.getFullYear() < 1980) return [1980, 1, 1, 0, 0, 0];
            return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds() & ~1];
        });
        assert.deepEqual(out.dates, expectedDates);
        console.log('python zipfile: ok');
    } else console.log('python3 not installed, skipped');
    assert.ok(tools > 0, 'neither unzip nor python3 is available');

    if (process.platform === 'darwin' && has('ditto')) {
        const outDir = path.join(dir, 'ditto');
        execFileSync('ditto', ['-x', '-k', zipPath, outDir]);
        expectedNames.forEach((name, i) => {
            const bytes = fs.readFileSync(path.join(outDir, name.normalize('NFC')));
            assert.equal(sha(bytes), expectedHashes[i], `ditto: ${name}`);
        });
        console.log('ditto: ok');
    }

    const sevenZip = ['7zz', '7z'].find(has);
    if (sevenZip) {
        execFileSync(sevenZip, ['t', zipPath], {stdio: 'pipe'});
        console.log(`${sevenZip} t: ok`);
    } else console.log('7z not installed, skipped');
} finally {
    fs.rmSync(dir, {recursive: true, force: true});
}

const fake = (name, size) => ({name, size});
assert.throws(() => zipSize(Array.from({length: 65536}, (_, i) => fake(`f${i}`, 0))), /Too many/);
assert.equal(zipSize([fake('a', 0xFFFFFFFF)]), 30 + 1 + 0xFFFFFFFF + 46 + 1 + 22);
assert.throws(() => zipSize([fake('x'.repeat(65536), 0)]), /too long/);
await assert.rejects(buildZip([fake('a', 0xFFFFFFFF)]), /ZIP64/);
const shrinking = new File(['abc'], 'a.txt');
Object.defineProperty(shrinking, 'size', {value: 5});
await assert.rejects(buildZip([shrinking]), /changed/);
console.log('refusal paths: ok');
console.log('all zip tests passed');
