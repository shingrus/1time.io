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
    const downloadBtn = form.querySelector<HTMLButtonElement>('[data-download]')!;
    const downloadLabel = form.querySelector<HTMLElement>('[data-download-label]')!;

    const hash = window.location.hash || '';
    const linkKey = hash.length > 1 ? hash.slice(1) : '';

    const showOnly = (visible: HTMLElement) => {
        for (const el of [preReadSection, passphraseSection, downloadedSection, noMessageSection]) {
            el.toggleAttribute('hidden', el !== visible);
        }
    };

    const setLoading = (loading: boolean) => {
        downloadBtn.disabled = loading;
        downloadLabel.textContent = loading ? 'Decrypting...' : 'Download the file';
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        wrongKeyAlert.toggleAttribute('hidden', true);
        if (!linkKey || linkKey.length <= Constants.randomKeyLen) {
            showOnly(noMessageSection);
            return;
        }
        setLoading(true);

        const randomKey = linkKey.slice(0, Constants.randomKeyLen);
        const id = linkKey.slice(Constants.randomKeyLen);
        const fullSecretKey = secretKeyInput.value + randomKey;

        try {
            const hashed = await hashSecretKey(fullSecretKey);
            const result = await getFile(id, hashed);

            if (result.status === 'ok' && result.data) {
                const {meta, fileBytes} = await decryptFile(result.data, fullSecretKey);
                downloadFile(meta, fileBytes);
                showOnly(downloadedSection);
                setLoading(false);
                return;
            }

            if (result.status === 'wrong key') {
                wrongKeyAlert.toggleAttribute('hidden', false);
                passphraseSection.toggleAttribute('hidden', false);
                secretKeyInput.focus();
                setLoading(false);
                return;
            }

            if (result.status === 'no message') {
                showOnly(noMessageSection);
                setLoading(false);
                return;
            }
        } catch {}

        setLoading(false);
        showOnly(noMessageSection);
    });
}
