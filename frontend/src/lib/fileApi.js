/**
 * File API calls for 1time.io
 * Handles multipart upload and binary download
 */

import {Constants} from './util';

// Upload tuning. Mobile connections occasionally drop mid-upload (nginx logs
// these as 499/408); a couple of transparent retries recover most of them.
// Retrying re-POSTs the same encrypted blob — in the rare case the server
// already stored it before the connection dropped, the first copy is an
// unread orphan that auto-expires. We accept that over server-side idempotency.
const UPLOAD_MAX_ATTEMPTS = 4;
const UPLOAD_STALL_MS = 150000; // abort+retry only if the upload makes NO progress this long
const UPLOAD_RETRY_STATUS = new Set([408, 500, 502, 503, 504]);
const UPLOAD_BACKOFF_MS = [1000, 2000];

function attemptUpload(encryptedBlob, hashedKey, durationSeconds, onProgress) {
    // Fresh FormData per attempt (avoids consumed-stream issues on retry).
    const formData = new FormData();
    formData.append('file', encryptedBlob, 'encrypted.bin');
    formData.append('hashedKey', hashedKey);
    formData.append('duration', String(durationSeconds));

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${Constants.apiBaseUrl}saveFile`);

        let lastProgress = Date.now();
        let stalled = false;
        const stallTimer = setInterval(() => {
            if (Date.now() - lastProgress > UPLOAD_STALL_MS) {
                stalled = true;
                xhr.abort();
            }
        }, 5000);

        const fail = (message, status) => {
            clearInterval(stallTimer);
            const err = new Error(message);
            err.status = status;        // undefined for network/stall → retryable
            err.retryable = status === undefined || UPLOAD_RETRY_STATUS.has(status);
            reject(err);
        };

        xhr.upload.onprogress = (event) => {
            lastProgress = Date.now();
            if (typeof onProgress === 'function' && event.lengthComputable && event.total > 0) {
                onProgress(event.loaded / event.total);
            }
        };

        // The watchdog guards the UPLOAD phase only. Once the body is fully sent no
        // more upload progress fires, so stop the timer — otherwise a slow server
        // response would be misread as an upload stall and aborted/retried. The
        // response wait is bounded by the network (onerror) and nginx, not by this.
        xhr.upload.onloadend = () => clearInterval(stallTimer);

        xhr.onerror = () => fail('Upload failed (network error)');
        xhr.onabort = () => {
            if (stalled) fail('Upload stalled (no progress)');
        };
        xhr.onload = () => {
            clearInterval(stallTimer);
            if (xhr.status < 200 || xhr.status >= 300) {
                fail(`Upload failed with status ${xhr.status}`, xhr.status);
                return;
            }
            let data;
            try {
                data = JSON.parse(xhr.responseText);
            } catch (error) {
                fail('Upload returned invalid JSON', xhr.status); // not retryable (2xx)
                return;
            }
            // The server returns {status:"error"} in a 200 body for any save
            // failure. We do NOT resend on an application-level error — retrying a
            // request the server already rejected won't change the outcome. Only
            // transport failures (network drop, stall, 408/5xx) are retried.
            // Passing xhr.status (200) keeps this out of the retry set → terminal.
            if (data.status !== 'ok' || !data.newId || data.newId === '0') {
                fail(`Server reported save failure (${data.status || 'no status'})`, xhr.status);
                return;
            }
            if (typeof onProgress === 'function') {
                onProgress(1);
            }
            resolve(data);
        };

        xhr.send(formData);
    });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Upload encrypted file blob to server, with transparent retries on transient
 * failures (network drop / timeout / 5xx / 408). Returns { status, newId }.
 */
export async function saveFile(encryptedBlob, hashedKey, durationSeconds, onProgress) {
    let lastError;
    for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt += 1) {
        try {
            return await attemptUpload(encryptedBlob, hashedKey, durationSeconds, onProgress);
        } catch (error) {
            lastError = error;
            const hasMoreTries = attempt < UPLOAD_MAX_ATTEMPTS - 1;
            if (!error.retryable || !hasMoreTries) {
                throw error;
            }
            await delay(UPLOAD_BACKOFF_MS[attempt] ?? 2000);
        }
    }
    throw lastError;
}

/**
 * Download encrypted file blob from server (one-time, deletes on read).
 *
 * Reports byte progress via onProgress(loaded, total); total is 0 when the
 * server sends no Content-Length (chunked) so the caller shows an indeterminate
 * state. Uses XHR (not fetch) because fetch + arrayBuffer() gives no progress —
 * on a slow link the download would otherwise be a silent, frozen wait.
 *
 * IMPORTANT: never retry a failed download. The backend consumes (deletes) the
 * record the instant the request lands — before streaming a byte — so a retry
 * just returns {status:"no message"}. The caller surfaces a transport failure
 * honestly instead of masking a drop as "already read".
 *
 * Returns { status: 'ok', data: Uint8Array } on success, or { status } for a
 * JSON error response ('no message' | 'wrong key').
 */
export function getFile(id, hashedKey, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${Constants.apiBaseUrl}getFile`);
        xhr.responseType = 'arraybuffer';
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onprogress = (event) => {
            if (typeof onProgress === 'function') {
                onProgress(event.loaded, event.lengthComputable ? event.total : 0);
            }
        };
        xhr.onerror = () => reject(new Error('Download failed (network error)'));
        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(`Download failed with status ${xhr.status}`));
                return;
            }
            const contentType = xhr.getResponseHeader('Content-Type') || '';
            if (contentType.includes('application/json')) {
                // { status: "no message" } or { status: "wrong key" }
                try {
                    resolve(JSON.parse(new TextDecoder().decode(xhr.response)));
                } catch (error) {
                    reject(new Error('Download returned invalid JSON'));
                }
                return;
            }
            resolve({status: 'ok', data: new Uint8Array(xhr.response)});
        };
        xhr.send(JSON.stringify({id, hashedKey}));
    });
}
