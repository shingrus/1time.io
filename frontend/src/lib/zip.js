export const zipFileName = '1timeio-files.zip';

const MAX_32 = 0xFFFFFFFF;
const MAX_16 = 0xFFFF;
const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const END_RECORD = 22;
const textEncoder = new TextEncoder();

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
}

async function crc32(file) {
    const reader = file.stream().getReader();
    let crc = MAX_32;
    let length = 0;
    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        length += value.length;
        for (let i = 0; i < value.length; i++) crc = crcTable[(crc ^ value[i]) & 0xFF] ^ (crc >>> 8);
    }
    if (length !== file.size) throw new Error(`File changed while reading: ${file.name}`);
    return (crc ^ MAX_32) >>> 0;
}

function baseName(name) {
    const parts = String(name).split(/[\\/]/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : 'file';
}

function entryNames(files) {
    const used = new Set();
    return files.map((file) => {
        const name = baseName(file.name);
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let candidate = name;
        for (let n = 2; used.has(candidate.normalize('NFC').toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
        used.add(candidate.normalize('NFC').toLowerCase());
        return textEncoder.encode(candidate);
    });
}

function dosDateTime(lastModified) {
    const d = new Date(lastModified);
    const year = d.getFullYear();
    if (!(year >= 1980 && year <= 2107)) return {date: 0x21, time: 0};
    return {
        date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
        time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    };
}

function layout(files) {
    if (files.length > MAX_16) throw new Error('Too many files for a zip');
    const names = entryNames(files);
    let offset = 0;
    let central = 0;
    const offsets = names.map((name, i) => {
        if (name.length > MAX_16) throw new Error('File name too long for a zip');
        const start = offset;
        offset += LOCAL_HEADER + name.length + files[i].size;
        central += CENTRAL_HEADER + name.length;
        return start;
    });
    const total = offset + central + END_RECORD;
    return {names, offsets, centralStart: offset, centralSize: central, total};
}

export function zipSize(files) {
    return layout(files).total;
}

export async function buildZip(files) {
    const {names, offsets, centralStart, centralSize, total} = layout(files);
    if (total > MAX_32) throw new Error('Zip too large without ZIP64');
    const parts = [];
    const central = new Uint8Array(centralSize);
    let c = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const name = names[i];
        const crc = await crc32(file);
        const {date, time} = dosDateTime(file.lastModified);
        const local = new Uint8Array(LOCAL_HEADER + name.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034B50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0x0800, true);
        lv.setUint16(10, time, true);
        lv.setUint16(12, date, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, file.size, true);
        lv.setUint32(22, file.size, true);
        lv.setUint16(26, name.length, true);
        local.set(name, LOCAL_HEADER);
        parts.push(local, file);

        const cv = new DataView(central.buffer, c);
        cv.setUint32(0, 0x02014B50, true);
        cv.setUint16(4, 0x0314, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(12, time, true);
        cv.setUint16(14, date, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, file.size, true);
        cv.setUint32(24, file.size, true);
        cv.setUint16(28, name.length, true);
        cv.setUint32(38, (0o100644 << 16) >>> 0, true);
        cv.setUint32(42, offsets[i], true);
        central.set(name, c + CENTRAL_HEADER);
        c += CENTRAL_HEADER + name.length;
    }
    const end = new Uint8Array(END_RECORD);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054B50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralStart, true);
    parts.push(central, end);
    return new File(parts, zipFileName, {type: 'application/zip'});
}
