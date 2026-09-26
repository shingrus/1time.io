/**
 * File API calls for 1time.io
 * Handles binary download
 */

import {Constants} from './util';

export function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Reserve and download one permitted copy of an encrypted file.
 *
 * Reports byte progress via onProgress(loaded, total); total is 0 when the
 * server sends no Content-Length (chunked) so the caller shows an indeterminate
 * state. Uses XHR (not fetch) because fetch + arrayBuffer() gives no progress —
 * on a slow link the download would otherwise be a silent, frozen wait.
 *
 * Only an explicit 503 + {"status":"retry"} from our backend is replayed once:
 * that response proves contention prevented reservation. Network/proxy failures
 * are never replayed because an allowed download may already be consumed.
 *
 * Returns { status: 'ok', data: Uint8Array } on success, or { status } for a
 * JSON error response ('no message' | 'wrong key').
 */
function attemptDownload(id, hashedKey, onProgress) {
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
                let body = null;
                try {
                    body = JSON.parse(new TextDecoder().decode(xhr.response));
                } catch {}
                const error = new Error(`Download failed with status ${xhr.status}`);
                error.safeToRetry = xhr.status === 503 && body?.status === 'retry';
                reject(error);
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
            const parseIntHeader = (name) => {
                const raw = xhr.getResponseHeader(name);
                if (raw === null || !/^\d+$/.test(raw)) return null;
                return Number(raw);
            };
            resolve({
                status: 'ok',
                data: new Uint8Array(xhr.response),
                viewsLeft: parseIntHeader('X-1Time-Views-Left'),
                expiresIn: parseIntHeader('X-1Time-Expires-In'),
            });
        };
        xhr.send(JSON.stringify({id, hashedKey}));
    });
}

export async function getFile(id, hashedKey, onProgress) {
    try {
        return await attemptDownload(id, hashedKey, onProgress);
    } catch (error) {
        if (!error?.safeToRetry) throw error;
        await delay(400);
        return attemptDownload(id, hashedKey, onProgress);
    }
}
