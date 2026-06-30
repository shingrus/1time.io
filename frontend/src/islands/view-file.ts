import {Constants} from '../lib/util.js';
import {hashSecretKey} from '../lib/protocol.mjs';
import {getFile} from '../lib/fileApi.js';
import {decryptFile, downloadFile} from '../lib/fileProtocol.js';

const form = document.querySelector<HTMLFormElement>('#view-file-form');
if (form) {
    const passphraseSection = form.querySelector<HTMLElement>('[data-state="passphrase"]')!;
    const secretKeyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const wrongKeyAlert = form.querySelector<HTMLElement>('[data-wrong-key]')!;
    const preReadSection = form.querySelector<HTMLElement>('[data-state="pre-read"]')!;
    const downloadedSection = form.querySelector<HTMLElement>('[data-state="downloaded"]')!;
    const noMessageSection = form.querySelector<HTMLElement>('[data-state="no-message"]')!;
    const errorSection = form.querySelector<HTMLElement>('[data-state="error"]')!;
    const downloadBtn = form.querySelector<HTMLButtonElement>('[data-download]')!;
    const downloadLabel = form.querySelector<HTMLElement>('[data-download-label]')!;
    const progress = form.querySelector<HTMLElement>('[data-progress]')!;
    const progressFill = form.querySelector<HTMLElement>('[data-progress-fill]')!;
    const progressText = form.querySelector<HTMLElement>('[data-progress-text]')!;

    const hash = window.location.hash || '';
    const linkKey = hash.length > 1 ? hash.slice(1) : '';

    // Terminal states are mutually exclusive; the passphrase field overlays pre-read.
    const showOnly = (visible: HTMLElement) => {
        for (const el of [preReadSection, passphraseSection, downloadedSection, noMessageSection, errorSection]) {
            el.toggleAttribute('hidden', el !== visible);
        }
    };

    const fmtBytes = (n: number) => {
        if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
        if (n >= 1024) return `${Math.round(n / 1024)} KB`;
        return `${n} B`;
    };

    let isDownloading = false;
    type Phase = 'idle' | 'downloading' | 'decrypting';
    const setPhase = (phase: Phase) => {
        const busy = phase !== 'idle';
        isDownloading = busy;
        downloadBtn.disabled = busy;
        secretKeyInput.disabled = busy;
        if (phase === 'idle') {
            downloadLabel.textContent = 'Download the file';
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
            progressText.textContent = `Downloading… ${pct}% (${fmtBytes(loaded)} of ${fmtBytes(total)})`;
        } else {
            // No Content-Length — show bytes received, bar stays indeterminate.
            progressText.textContent = `Downloading… ${fmtBytes(loaded)}`;
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isDownloading) {
            return; 
        }
        wrongKeyAlert.toggleAttribute('hidden', true);
        if (!linkKey || linkKey.length <= Constants.randomKeyLen) {
            showOnly(noMessageSection);
            return;
        }

        // (Re)enter the downloading state from pre-read / error / passphrase
        // without disturbing the passphrase field.
        errorSection.toggleAttribute('hidden', true);
        noMessageSection.toggleAttribute('hidden', true);
        downloadedSection.toggleAttribute('hidden', true);
        preReadSection.toggleAttribute('hidden', false);
        setPhase('downloading');

        const randomKey = linkKey.slice(0, Constants.randomKeyLen);
        const id = linkKey.slice(Constants.randomKeyLen);
        const fullSecretKey = secretKeyInput.value + randomKey;

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
                downloadFile(meta, fileBytes);
                setPhase('idle');
                showOnly(downloadedSection);
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
