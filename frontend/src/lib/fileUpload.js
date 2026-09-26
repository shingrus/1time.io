/**
 * Chunked upload of encrypted files for 1time.io
 */

import {Constants, getRandomString} from './util';

// Must equal fileChunkBytes in backend/handlers.go.
const CHUNK_BYTES = 4 * 1024 * 1024;
const CHUNK_MAX_ATTEMPTS = 6;
const UPLOAD_STALL_MS = 60000; // abort+retry only if the chunk makes NO progress this long
const isRetryableStatus = (status) => status === 408 || status === 429 || (status >= 500 && status <= 599);
const UPLOAD_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];

function attemptChunk(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);

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
            err.retryable = status === undefined || isRetryableStatus(status);
            reject(err);
        };

        xhr.upload.onprogress = (event) => {
            lastProgress = Date.now();
            if (event.lengthComputable && event.total > 0) {
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
            // Passing xhr.status (200) keeps an application error out of the retry set.
            if (data.status !== 'ok') {
                fail(`Server reported save failure (${data.status || 'no status'})`, xhr.status);
                return;
            }
            onProgress(1);
            resolve(data);
        };

        xhr.send(formData);
    });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendChunkWithRetries(url, formData, onProgress) {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await attemptChunk(url, formData, onProgress);
        } catch (error) {
            if (!error.retryable || attempt >= CHUNK_MAX_ATTEMPTS - 1) {
                throw error;
            }
            onProgress(0);
            await delay(UPLOAD_BACKOFF_MS[attempt] ?? 15000);
        }
    }
}

/**
 * Upload an encrypted file blob in CHUNK_BYTES slices, with transparent retries
 * of a failed slice. Only the last slice's response carries newId; the link
 * cannot exist before every slice is stored. Returns { status, newId }.
 *
 * Takes readTokenHash (SHA-256 of the read token), never the token itself.
 */
export async function saveFile(encryptedBlob, readTokenHash, durationSeconds, views, onProgress) {
    const chunkCount = Math.max(1, Math.ceil(encryptedBlob.size / CHUNK_BYTES));
    const uploadId = getRandomString(Constants.storageIdLen);
    const report = typeof onProgress === 'function' ? onProgress : () => {};
    const buildForm = (file) => {
        const formData = new FormData();
        formData.append('readTokenHash', readTokenHash);
        formData.append('v', String(Constants.saveSchemeVersion));
        formData.append('duration', String(durationSeconds));
        if (views !== 1) {
            formData.append('views', String(views));
        }
        formData.append('file', file, 'encrypted.bin');
        return formData;
    };
    let data;

    for (let index = 0; index < chunkCount; index += 1) {
        const start = index * CHUNK_BYTES;
        const chunk = encryptedBlob.slice(start, start + CHUNK_BYTES);
        const params = new URLSearchParams({u: uploadId, i: String(index), n: String(chunkCount)});
        data = await sendChunkWithRetries(
            `${Constants.apiBaseUrl}saveFile?${params}`,
            buildForm(chunk),
            (fraction) => report((start + fraction * chunk.size) / encryptedBlob.size),
        );
        if (data.newId && index < chunkCount - 1) {
            // Only a pre-chunking server answers an early slice with an id.
            data = await sendChunkWithRetries(`${Constants.apiBaseUrl}saveFile`, buildForm(encryptedBlob), report);
            break;
        }
    }

    if (!data?.newId) {
        throw new Error('Server finished the upload without a file id');
    }
    return data;
}
