import {Constants, decryptSecretMessage, hashSecretKey, postJson, copyTextToClipboard} from '../lib/util.js';

// Turn a remaining-TTL in seconds into a coarse, human-friendly span
// ("30 days", "1 hour", "5 minutes").
function formatRemaining(seconds: number): string {
    const unit = (n: number, label: string) => `${n} ${label}${n === 1 ? '' : 's'}`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) return unit(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return unit(hours, 'hour');
    return unit(Math.round(hours / 24), 'day');
}

const form = document.querySelector<HTMLFormElement>('#view-secret-form');
if (form) {
    const passphraseSection = form.querySelector<HTMLElement>('[data-state="passphrase"]')!;
    const secretKeyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const wrongKeyAlert = form.querySelector<HTMLElement>('[data-wrong-key]')!;
    const preReadSection = form.querySelector<HTMLElement>('[data-state="pre-read"]')!;
    const decryptedSection = form.querySelector<HTMLElement>('[data-state="decrypted"]')!;
    const decryptedBody = form.querySelector<HTMLElement>('[data-decrypted-body]')!;
    const noMessageSection = form.querySelector<HTMLElement>('[data-state="no-message"]')!;
    const viewsLeftNote = form.querySelector<HTMLElement>('[data-views-left]')!;
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

    // A/B/C/D banner copy test: variant is encoded in the reply URL (?reply=N)
    // so nginx logs measure clicks per variant with no extra tracking.
    // Variants 1 and 4 claim the message was destroyed, so multi-view reads
    // (the link still works) only draw from variants 2 and 3.
    const REPLY_HEADINGS = [
        'Message read and destroyed. Nothing to trace back.',
        'Your reply deserves the same protection.',
        'Sending something back? Keep it out of the chat history too.',
        "That's how secrets should travel — one view, then gone.",
    ];
    const pickReplyVariant = (destroyed: boolean) => {
        const pool = destroyed ? [1, 2, 3, 4] : [2, 3];
        const v = pool[Math.floor(Math.random() * pool.length)];
        const h = form.querySelector<HTMLElement>('[data-reply-heading]');
        const b = form.querySelector<HTMLAnchorElement>('[data-reply-btn]');
        if (h) h.textContent = REPLY_HEADINGS[v - 1];
        if (b) b.href = `/?reply=${v}`;
    };

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
                decryptedBody.textContent = await decryptSecretMessage(data.cryptedMessage, fullSecretKey);
                // Older backends omit viewsLeft; treat that as the consumed one-time case.
                const viewsLeft = typeof data.viewsLeft === 'number' ? data.viewsLeft : 0;
                const expiresIn = typeof data.expiresIn === 'number' ? data.expiresIn : 0;
                const expiryClause = expiresIn > 0 ? ` It expires in ${formatRemaining(expiresIn)}.` : '';
                if (viewsLeft === -1) {
                    viewsLeftNote.textContent = expiresIn > 0
                        ? `This link stays available for another ${formatRemaining(expiresIn)}.`
                        : 'This link stays available until it expires.';
                } else if (viewsLeft > 0) {
                    viewsLeftNote.textContent =
                        `This link can be opened ${viewsLeft} more ${viewsLeft === 1 ? 'time' : 'times'}.${expiryClause}`;
                }
                viewsLeftNote.toggleAttribute('hidden', viewsLeft === 0);
                pickReplyVariant(viewsLeft === 0);
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
