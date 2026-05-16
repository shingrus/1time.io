import {Constants, decryptSecretMessage, hashSecretKey, postJson, copyTextToClipboard} from '../lib/util.js';

const form = document.querySelector<HTMLFormElement>('#view-secret-form');
if (form) {
    const passphraseSection = form.querySelector<HTMLElement>('[data-state="passphrase"]')!;
    const secretKeyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const wrongKeyAlert = form.querySelector<HTMLElement>('[data-wrong-key]')!;
    const preReadSection = form.querySelector<HTMLElement>('[data-state="pre-read"]')!;
    const decryptedSection = form.querySelector<HTMLElement>('[data-state="decrypted"]')!;
    const decryptedBody = form.querySelector<HTMLElement>('[data-decrypted-body]')!;
    const noMessageSection = form.querySelector<HTMLElement>('[data-state="no-message"]')!;
    const postReadCta = form.querySelector<HTMLElement>('[data-state="post-read-cta"]')!;
    const revealBtn = form.querySelector<HTMLButtonElement>('[data-reveal]')!;
    const copyBtn = form.querySelector<HTMLButtonElement>('[data-copy]')!;
    const copyLabel = form.querySelector<HTMLElement>('[data-copy-label]')!;
    const copyIconCopy = form.querySelector<SVGElement>('[data-copy-icon-copy]')!;
    const copyIconDone = form.querySelector<SVGElement>('[data-copy-icon-done]')!;
    const qrToggle = form.querySelector<HTMLButtonElement>('[data-toggle-qr]')!;
    const qrLabel = form.querySelector<HTMLElement>('[data-qr-label]')!;
    const qrPanel = form.querySelector<HTMLElement>('[data-qr-panel]')!;
    const qrSlot = form.querySelector<HTMLElement>('[data-qr-slot]')!;
    const qrAction = form.querySelector<HTMLElement>('[data-qr-action]')!;

    const hash = window.location.hash || '';
    const linkKey = hash.length > 1 ? hash.slice(1) : '';
    if (!linkKey || linkKey.length <= Constants.randomKeyLen) {
        qrToggle.disabled = true;
    }

    const showOnly = (visible: HTMLElement) => {
        for (const el of [preReadSection, passphraseSection, decryptedSection, noMessageSection]) {
            el.toggleAttribute('hidden', el !== visible);
        }
    };

    const setLoading = (loading: boolean) => {
        revealBtn.disabled = loading;
        revealBtn.textContent = loading ? 'Revealing...' : 'Reveal the secret';
    };

    qrToggle.addEventListener('click', async () => {
        if (!linkKey) return;
        if (qrSlot.innerHTML) {
            qrSlot.innerHTML = '';
            qrPanel.toggleAttribute('hidden', true);
            qrLabel.textContent = 'Show QR code';
            return;
        }
        qrToggle.disabled = true;
        qrLabel.textContent = 'Loading QR...';
        try {
            const {createQrSvg} = await import('../lib/qr.js');
            qrSlot.innerHTML = await createQrSvg(`${window.location.origin}/v/#${linkKey}`);
            qrPanel.toggleAttribute('hidden', false);
            qrLabel.textContent = 'Hide QR code';
        } catch {
            qrLabel.textContent = 'Show QR code';
        } finally {
            qrToggle.disabled = false;
        }
    });

    let copyTimer: number | undefined;
    copyBtn.addEventListener('click', async () => {
        const ok = await copyTextToClipboard(decryptedBody.textContent ?? '');
        if (!ok) return;
        copyLabel.textContent = 'Copied!';
        copyIconCopy.style.display = 'none';
        copyIconDone.style.display = '';
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = window.setTimeout(() => {
            copyLabel.textContent = 'Copy';
            copyIconCopy.style.display = '';
            copyIconDone.style.display = 'none';
        }, 3000);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        wrongKeyAlert.toggleAttribute('hidden', true);
        if (!linkKey || linkKey.length <= Constants.randomKeyLen) {
            qrAction.toggleAttribute('hidden', true);
            showOnly(noMessageSection);
            return;
        }
        setLoading(true);

        const randomKey = linkKey.slice(0, Constants.randomKeyLen);
        const id = linkKey.slice(Constants.randomKeyLen);
        const fullSecretKey = secretKeyInput.value + randomKey;

        try {
            const hashedKey = await hashSecretKey(fullSecretKey);
            const data = await postJson('get', {id, hashedKey});

            if (data.status === 'ok' && typeof data.cryptedMessage === 'string' && data.cryptedMessage.length > 0) {
                const plain = await decryptSecretMessage(data.cryptedMessage, fullSecretKey);
                decryptedBody.textContent = plain;
                qrAction.toggleAttribute('hidden', true);
                postReadCta.toggleAttribute('hidden', false);
                showOnly(decryptedSection);
                setLoading(false);
                return;
            }

            if (data.status === 'wrong key') {
                wrongKeyAlert.toggleAttribute('hidden', false);
                passphraseSection.toggleAttribute('hidden', false);
                secretKeyInput.focus();
                setLoading(false);
                return;
            }

            if (data.status === 'no message') {
                qrAction.toggleAttribute('hidden', true);
                showOnly(noMessageSection);
                setLoading(false);
                return;
            }
        } catch {}

        setLoading(false);
    });
}
