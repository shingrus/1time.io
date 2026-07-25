import {Constants, formatRemaining} from '../lib/util.js';
import {hashSecretKey} from '../lib/protocol.mjs';
import {formatBytes, getFile} from '../lib/fileApi.js';
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
    const downloadState = form.querySelector<HTMLElement>('[data-download-state]')!;

    const hash = window.location.hash || '';
    const linkKey = hash.length > 1 ? hash.slice(1) : '';

    // Same A/B/C/D banner test as view-secret.
    const REPLY_HEADINGS = [
        'Keep the conversation private.',
        'Your reply deserves the same protection.',
        'Sending something back? Keep it out of the chat history too.',
        'Reply securely with a one-time link.',
    ];
    const pickReplyVariant = () => {
        const v = Math.floor(Math.random() * REPLY_HEADINGS.length) + 1;
        const h = form.querySelector<HTMLElement>('[data-reply-heading]');
        const b = form.querySelector<HTMLAnchorElement>('[data-reply-btn]');
        if (h) h.textContent = REPLY_HEADINGS[v - 1];
        if (b) b.href = `/secure-file-sharing/?reply=${v}`;
    };
    // Terminal states are mutually exclusive; the passphrase field overlays pre-read.
    const showOnly = (visible: HTMLElement) => {
        for (const el of [preReadSection, passphraseSection, downloadedSection, noMessageSection, errorSection]) {
            el.toggleAttribute('hidden', el !== visible);
        }
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
                // Older backends omit the header and only support one download.
                const viewsLeft = typeof result.viewsLeft === 'number' ? result.viewsLeft : 0;
                const expiresIn = typeof result.expiresIn === 'number' ? result.expiresIn : 0;
                const expiryClause = expiresIn > 0 ? ` It expires in ${formatRemaining(expiresIn)}.` : '';
                downloadState.textContent = viewsLeft > 0
                    ? `This 1time link has ${viewsLeft} ${viewsLeft === 1 ? 'download' : 'downloads'} remaining and will self-destruct after the last.${expiryClause}`
                    : 'One-time delivery complete. The encrypted file has been deleted from our servers.';
                pickReplyVariant();
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
