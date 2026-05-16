/**
 * File API calls for 1time.io
 * Handles multipart upload and binary download
 */

import {Constants} from './util';

/**
 * Upload encrypted file blob to server
 * Returns { status, newId }
 */
export function saveFile(encryptedBlob, hashedKey, durationDays, onProgress) {
    const formData = new FormData();
    formData.append('file', encryptedBlob, 'encrypted.bin');
    formData.append('hashedKey', hashedKey);
    formData.append('duration', String(durationDays * 86400));

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${Constants.apiBaseUrl}saveFile`);

        if (typeof onProgress === 'function') {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && event.total > 0) {
                    onProgress(event.loaded / event.total);
                }
            };
        }

        xhr.onerror = () => {
            reject(new Error('Upload failed'));
        };

        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(`Upload failed with status ${xhr.status}`));
                return;
            }

            if (typeof onProgress === 'function') {
                onProgress(1);
            }

            try {
                resolve(JSON.parse(xhr.responseText));
            } catch (error) {
                reject(new Error('Upload returned invalid JSON'));
            }
        };

        xhr.send(formData);
    });
}

/**
 * Download encrypted file blob from server (one-time, deletes on read)
 * Returns Uint8Array of encrypted bytes
 */
export async function getFile(id, hashedKey) {
    const response = await fetch(`${Constants.apiBaseUrl}getFile`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id, hashedKey}),
    });

    if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
    }

    // Check if response is JSON (error) or binary (file)
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
        return response.json(); // { status: "no message" } or { status: "wrong key" }
    }

    const buffer = await response.arrayBuffer();
    return {status: 'ok', data: new Uint8Array(buffer)};
}
