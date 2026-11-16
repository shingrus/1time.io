import {Constants, formatRemaining} from '../lib/util.js';
import {hashSecretKey, isValidLinkToken} from '../lib/protocol.mjs';
import {formatBytes, getFile} from '../lib/fileApi.js';
import {createFileUrl, decryptFile, saveFileUrl} from '../lib/fileProtocol.js';

const programExtensions = new Set(['exe', 'msi', 'scr', 'bat', 'cmd', 'ps1', 'vbs', 'apk']);

// Windows drops trailing dots and spaces on save, so "setup.exe." is an .exe.
const isProgramFile = (name: unknown) => {
    const ext = /\.([^.]*)$/.exec(String(name).replace(/[.\s]+$/, ''));
    return ext !== null && programExtensions.has(ext[1].toLowerCase());
};

const keptForMs = 10 * 60 * 1000;
const keptMaxBytes = 50 * 1024 * 1024;
const isFresh = (t: unknown) => typeof t === 'number' && Date.now() - t >= 0 && Date.now() - t < keptForMs;
const minutesLeft = (t: number) => {
    const minutes = Math.max(1, Math.ceil((t + keptForMs - Date.now()) / 60000));
    return `${minutes} more ${minutes === 1 ? 'minute' : 'minutes'}`;
};

// Every failure (no IndexedDB, private mode, quota) is swallowed: the kept copy is only a convenience.
const keptStore = async (mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest | void) => {
    try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const opening = indexedDB.open('1time-kept-files', 1);
            opening.onupgradeneeded = () => opening.result.createObjectStore('files').createIndex('t', 't');
            opening.onsuccess = () => resolve(opening.result);
            opening.onerror = () => reject(opening.error);
        });
        return await new Promise<unknown>((resolve) => {
            const tx = db.transaction('files', mode);
            const request = use(tx.objectStore('files'));
            tx.oncomplete = () => {
                db.close();
                resolve(request ? request.result : undefined);
            };
            tx.onerror = tx.onabort = () => {
                db.close();
                resolve(undefined);
            };
        });
    } catch {
        return undefined;
    }
};

const sweepExpired = (store: IDBObjectStore) => {
    store.index('t').openKeyCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
        if (!cursor) return;
        if (!isFresh(cursor.key)) store.delete(cursor.primaryKey);
        cursor.continue();
    };
};

const forgetKeptCopy = (id: string) => keptStore('readwrite', (store) => {
    store.delete(id);
});

const form = document.querySelector<HTMLFormElement>('#view-file-form');
if (form) {
    const passphraseSection = form.querySelector<HTMLElement>('[data-state="passphrase"]')!;
    const secretKeyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const wrongKeyAlert = form.querySelector<HTMLElement>('[data-wrong-key]')!;
    const preReadSection = form.querySelector<HTMLElement>('[data-state="pre-read"]')!;
    const downloadedSection = form.querySelector<HTMLElement>('[data-state="downloaded"]')!;
    const noMessageSection = form.querySelector<HTMLElement>('[data-state="no-message"]')!;
    const brokenLinkSection = form.querySelector<HTMLElement>('[data-state="broken-link"]')!;
    const errorSection = form.querySelector<HTMLElement>('[data-state="error"]')!;
    const programSection = form.querySelector<HTMLElement>('[data-state="program"]')!;
    const programName = form.querySelector<HTMLElement>('[data-program-name]')!;
    const saveProgramBtn = form.querySelector<HTMLButtonElement>('[data-save-program]')!;
    const downloadBtn = form.querySelector<HTMLButtonElement>('[data-download]')!;
    const downloadLabel = form.querySelector<HTMLElement>('[data-download-label]')!;
    const progress = form.querySelector<HTMLElement>('[data-progress]')!;
    const progressFill = form.querySelector<HTMLElement>('[data-progress-fill]')!;
    const progressText = form.querySelector<HTMLElement>('[data-progress-text]')!;
    const downloadState = form.querySelector<HTMLElement>('[data-download-state]')!;
    const saveAgainBtn = form.querySelector<HTMLButtonElement>('[data-save-again-btn]')!;
    const saveAgainHint = form.querySelector<HTMLElement>('[data-save-again-hint]')!;

    const preReadTitle = form.querySelector<HTMLElement>('[data-pre-read-title]')!;
    const preReadText = form.querySelector<HTMLElement>('[data-pre-read-text]')!;
    const originalPreReadTitle = preReadTitle.textContent;
    const originalPreReadText = preReadText.innerHTML;
    const originalSaveAgainHint = saveAgainHint.textContent;

    const hash = window.location.hash || '';
    const linkKey = hash.length > 1 ? hash.slice(1) : '';

    // Terminal states are mutually exclusive; the passphrase field overlays pre-read.
    const showOnly = (visible: HTMLElement) => {
        for (const el of [preReadSection, passphraseSection, downloadedSection, programSection, noMessageSection, errorSection, brokenLinkSection]) {
            el.toggleAttribute('hidden', el !== visible);
        }
    };

    // See view-secret.ts: a fragment that cannot name a file is known bad at load,
    // so there is nothing to confirm and nothing to consume.
    if (!isValidLinkToken(linkKey)) {
        showOnly(brokenLinkSection);
    }

    let savedFile: {url: string; name: string} | null = null;
    saveAgainBtn.addEventListener('click', () => {
        if (savedFile) {
            saveFileUrl(savedFile.url, savedFile.name);
        }
    });
    let saveConfirmedProgram: (() => void) | null = null;
    saveProgramBtn.addEventListener('click', () => {
        try {
            saveConfirmedProgram?.();
        } catch {
            showOnly(errorSection);
        }
        saveConfirmedProgram = null;
    });
    window.addEventListener('pagehide', (e) => {
        if (savedFile && !e.persisted) {
            URL.revokeObjectURL(savedFile.url);
            savedFile = null;
        }
    });

    const warnBeforeLeaving = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
    };

    let isDownloading = false;
    let keptCopy: {c: Uint8Array; t: number} | null = null;
    let keptAt: number | null = null;
    let idleLabel = 'Download the file';

    const renderPreRead = () => {
        idleLabel = keptCopy ? 'Save the file again' : 'Download the file';
        downloadLabel.textContent = idleLabel;
        preReadTitle.textContent = keptCopy ? 'You already downloaded this file' : originalPreReadTitle;
        if (keptCopy) {
            preReadText.textContent = `It has been deleted from our servers. This is your local copy, kept on this device for ${minutesLeft(keptCopy.t)}.`;
        } else {
            preReadText.innerHTML = originalPreReadText;
        }
    };

    const deleteWhenExpired = (id: string, t: number) => {
        setTimeout(() => void forgetKeptCopy(id), t + keptForMs - Date.now());
    };

    const keepCopy = (id: string, ciphertext: Uint8Array) => {
        if (secretKeyInput.value || !matchMedia('(pointer: coarse)').matches || ciphertext.byteLength > keptMaxBytes) return;
        try {
            if (localStorage.getItem('1time.secretsList.v1')?.includes(`"id":"${id}"`)) return;
        } catch {
            // Storage may be unavailable.
        }
        const t = Date.now();
        void keptStore('readwrite', (store) => store.put({c: ciphertext, t}, id)).then((key) => {
            if (key === undefined) return;
            keptAt = t;
            renderSaveAgainHint();
            deleteWhenExpired(id, t);
        });
    };

    const renderSaveAgainHint = () => {
        saveAgainHint.textContent = keptAt
            ? `The server copy is gone. A local copy stays on this device for ${minutesLeft(keptAt)}, so you can open this link again if the file didn't save.`
            : originalSaveAgainHint;
    };

    const presentFile = (meta: {name: string; type: string}, fileBytes: Uint8Array, viewsLeft: number, expiresIn: number) => {
        const save = () => {
            savedFile = {url: createFileUrl(meta, fileBytes), name: meta.name};
            saveFileUrl(savedFile.url, savedFile.name);
            const expiryClause = expiresIn > 0 ? ` It expires in ${formatRemaining(expiresIn)}.` : '';
            downloadState.textContent = viewsLeft > 0
                ? `This 1time link has ${viewsLeft} ${viewsLeft === 1 ? 'download' : 'downloads'} remaining and will self-destruct after the last.${expiryClause}`
                : 'One-time delivery complete. The encrypted file has been deleted from our servers.';
            renderSaveAgainHint();
            saveAgainHint.toggleAttribute('hidden', viewsLeft > 0);
            showOnly(downloadedSection);
        };
        if (isProgramFile(meta.name)) {
            programName.textContent = meta.name;
            saveConfirmedProgram = save;
            showOnly(programSection);
        } else {
            save();
        }
    };

    if (isValidLinkToken(linkKey)) {
        const linkId = linkKey.slice(Constants.randomKeyLen);
        void keptStore('readwrite', (store) => {
            sweepExpired(store);
            return store.get(linkId);
        }).then((found) => {
            const copy = found as {c?: unknown; t?: unknown} | undefined;
            if (!isDownloading && copy?.c instanceof Uint8Array && isFresh(copy.t)) {
                keptCopy = {c: copy.c, t: copy.t as number};
                renderPreRead();
                deleteWhenExpired(linkId, keptCopy.t);
            }
        });
    } else {
        void keptStore('readwrite', (store) => {
            sweepExpired(store);
        });
    }

    type Phase = 'idle' | 'downloading' | 'decrypting';
    const setPhase = (phase: Phase) => {
        const busy = phase !== 'idle';
        isDownloading = busy;
        if (busy) {
            window.addEventListener('beforeunload', warnBeforeLeaving);
        } else {
            window.removeEventListener('beforeunload', warnBeforeLeaving);
        }
        downloadBtn.disabled = busy;
        secretKeyInput.disabled = busy;
        if (phase === 'idle') {
            downloadLabel.textContent = idleLabel;
            progress.toggleAttribute('hidden', true);
            progress.classList.remove('indeterminate');
            return;
        }
        if (phase === 'decrypting') {
            // Decryption is fast, but label it honestly so the phase is never a lie.
            downloadLabel.textContent = 'Decrypting…';
            progress.classList.remove('indeterminate');
            progressFill.style.width = '100%';
            progressText.textContent = 'Decrypting…';
            return;
        }
        // downloading: start indeterminate until the first progress event lands.
        // Clear the inline width so the .indeterminate CSS rule controls the bar.
        downloadLabel.textContent = 'Downloading…';
        progress.toggleAttribute('hidden', false);
        progress.classList.add('indeterminate');
        progressFill.style.width = '';
        progressText.textContent = 'Starting…';
    };

    const onProgress = (loaded: number, total: number) => {
        if (total > 0) {
            const pct = Math.min(100, Math.round((loaded / total) * 100));
            progress.classList.remove('indeterminate');
            progressFill.style.width = `${pct}%`;
            progressText.textContent = `Downloading… ${pct}% (${formatBytes(loaded)} of ${formatBytes(total)})`;
        } else {
            // No Content-Length — show bytes received, bar stays indeterminate.
            progressText.textContent = `Downloading… ${formatBytes(loaded)}`;
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isDownloading) {
            return; 
        }
        wrongKeyAlert.toggleAttribute('hidden', true);
        // See view-secret.ts: a fragment of the wrong length or alphabet is a cut
        // link, not a consumed one.
        if (!isValidLinkToken(linkKey)) {
            showOnly(brokenLinkSection);
            return;
        }

        // (Re)enter the downloading state from pre-read / error / passphrase
        // without disturbing the passphrase field.
        errorSection.toggleAttribute('hidden', true);
        noMessageSection.toggleAttribute('hidden', true);
        downloadedSection.toggleAttribute('hidden', true);
        preReadSection.toggleAttribute('hidden', false);

        const randomKey = linkKey.slice(0, Constants.randomKeyLen);
        const id = linkKey.slice(Constants.randomKeyLen);
        const fullSecretKey = secretKeyInput.value + randomKey;

        if (keptCopy && isFresh(keptCopy.t)) {
            setPhase('decrypting');
            const file = await decryptFile(keptCopy.c, fullSecretKey).catch(() => null);
            setPhase('idle');
            if (file) {
                keptAt = keptCopy.t;
                try {
                    presentFile(file.meta, file.fileBytes, 0, 0);
                } catch {
                    showOnly(errorSection);
                }
                return;
            }
            void forgetKeptCopy(id);
        }
        if (keptCopy) {
            keptCopy = null;
            renderPreRead();
        }

        setPhase('downloading');

        let result;
        try {
            const hashed = await hashSecretKey(fullSecretKey);
            result = await getFile(id, hashed, onProgress);
        } catch {
            // Transport/network failure — do NOT mask it as "already read".
            setPhase('idle');
            showOnly(errorSection);
            return;
        }

        if (result.status === 'wrong key') {
            setPhase('idle');
            wrongKeyAlert.toggleAttribute('hidden', false);
            passphraseSection.toggleAttribute('hidden', false);
            secretKeyInput.focus();
            return;
        }

        if (result.status === 'no message') {
            setPhase('idle');
            showOnly(noMessageSection);
            return;
        }

        if (result.status === 'ok' && result.data) {
            try {
                setPhase('decrypting');
                const {meta, fileBytes} = await decryptFile(result.data, fullSecretKey);
                setPhase('idle');
                // Older backends omit the header and only support one download.
                const viewsLeft = typeof result.viewsLeft === 'number' ? result.viewsLeft : 0;
                const expiresIn = typeof result.expiresIn === 'number' ? result.expiresIn : 0;
                if (viewsLeft === 0) keepCopy(id, result.data);
                presentFile(meta, fileBytes, viewsLeft, expiresIn);
            } catch {
                // Download succeeded (and was consumed) but decrypt failed — be honest.
                setPhase('idle');
                showOnly(errorSection);
            }
            return;
        }

        setPhase('idle');
        showOnly(errorSection);
    });
}
