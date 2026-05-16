/**
 * File encryption/decryption protocol for 1time.io
 *
 * File blob format (before encryption):
 *   [4 bytes: metadata JSON length (big-endian uint32)]
 *   [N bytes: metadata JSON {"name":"file.pdf","type":"application/pdf","size":1234}]
 *   [remaining bytes: raw file content]
 *
 * After encryption: standard AES-256-GCM blob (same as text secrets)
 */

import {decryptSecretBytes, encryptSecretBytes, getRandomString} from './protocol.mjs';
import {Constants} from './util';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Pack file + metadata into a single ArrayBuffer
 */
export function packFile(file, fileBytes) {
    const rawBytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
    const meta = JSON.stringify({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
    });
    const metaBytes = textEncoder.encode(meta);
    const metaLen = metaBytes.length;

    const packed = new Uint8Array(4 + metaLen + rawBytes.length);
    // 4-byte big-endian length prefix
    packed[0] = (metaLen >> 24) & 0xff;
    packed[1] = (metaLen >> 16) & 0xff;
    packed[2] = (metaLen >> 8) & 0xff;
    packed[3] = metaLen & 0xff;
    packed.set(metaBytes, 4);
    packed.set(rawBytes, 4 + metaLen);

    return packed;
}

/**
 * Unpack metadata + file from a decrypted ArrayBuffer
 * Returns { meta: {name, type, size}, fileBytes: Uint8Array }
 */
export function unpackFile(decryptedBuffer) {
    const decryptedBytes = decryptedBuffer instanceof Uint8Array
        ? decryptedBuffer
        : new Uint8Array(decryptedBuffer);
    if (decryptedBytes.byteLength < 4) {
        throw new Error('Encrypted file payload is truncated');
    }

    const view = new DataView(
        decryptedBytes.buffer,
        decryptedBytes.byteOffset,
        decryptedBytes.byteLength,
    );
    const metaLen = view.getUint32(0);
    const metaEnd = 4 + metaLen;
    if (metaEnd > decryptedBytes.byteLength) {
        throw new Error('Encrypted file metadata is invalid');
    }

    const metaBytes = decryptedBytes.subarray(4, metaEnd);
    const meta = JSON.parse(textDecoder.decode(metaBytes));
    const fileBytes = decryptedBytes.subarray(metaEnd);

    return {meta, fileBytes};
}

/**
 * Encrypt a file: pack metadata + content, then AES-256-GCM encrypt
 * Returns { encryptedBlob: Blob, hashedKey: string, randomKey: string }
 */
export async function encryptFile(file, secretKey) {
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const packed = packFile(file, fileBytes);

    const randomKey = getRandomString(Constants.randomKeyLen);
    const fullSecretKey = (secretKey || '') + randomKey;
    const {encryptedBytes, hashedKey} = await encryptSecretBytes(packed, fullSecretKey);

    return {
        encryptedBlob: new Blob([encryptedBytes]),
        hashedKey,
        randomKey,
    };
}

/**
 * Decrypt a file: AES-256-GCM decrypt, then unpack metadata + content
 * Returns { meta: {name, type, size}, fileBytes: Uint8Array }
 */
export async function decryptFile(encryptedBytes, fullSecretKey) {
    const decryptedBytes = await decryptSecretBytes(encryptedBytes, fullSecretKey);
    return unpackFile(decryptedBytes);
}

/**
 * Trigger a file download in the browser from decrypted bytes
 */
export function downloadFile(meta, fileBytes) {
    const blob = new Blob([fileBytes], {type: meta.type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name;
    a.click();
    URL.revokeObjectURL(url);
}
