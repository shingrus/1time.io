import {
    Constants,
    copyTextToClipboard,
    decryptSecretMessage,
    formatRemaining,
    hashSecretKey,
    postJson,
} from '../lib/util.js';

// A read may only be retried when our backend explicitly reports contention
// (503 + {"status":"retry"}). Anything else — including a bare proxy 503 — may
// have already consumed a view, so it must not be replayed.
function isRetryableRead(err: unknown): boolean {
    const {status, body} = (err ?? {}) as {status?: number; body?: {status?: string} | null};
    return status === 503 && body?.status === 'retry';
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
    // so nginx logs measure clicks per variant with no extra tracking. Assignment
    // stays uniform for every link type; state-specific copy keeps claims honest.
    const REPLY_HEADINGS = [
        'Message read and destroyed. Nothing to trace back.',
        'Your reply deserves the same protection.',
        'Sending something back? Keep it out of the chat history too.',
        "That's how secrets should travel — one view, then gone.",
    ];
    const pickReplyVariant = (destroyed: boolean) => {
        const v = Math.floor(Math.random() * REPLY_HEADINGS.length) + 1;
        let heading = REPLY_HEADINGS[v - 1];
        if (!destroyed && v === 1) {
            heading = 'Message read securely. The link remains available for its configured views.';
        } else if (!destroyed && v === 4) {
            heading = "That's how secrets should travel — encrypted, controlled, then gone.";
        }
        const h = form.querySelector<HTMLElement>('[data-reply-heading]');
        const b = form.querySelector<HTMLAnchorElement>('[data-reply-btn]');
        if (h) h.textContent = heading;
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
    const copyMessage = async () => {
        const ok = await copyTextToClipboard(decryptedBody.textContent ?? '');
        if (!ok) return;
        copyLabel.textContent = 'Copied!';
        copyIconCopy.style.display = 'none';
        copyIconDone.style.display = '';
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = window.setTimeout(() => {
            copyLabel.textContent = 'Copy message';
            copyIconCopy.style.display = '';
            copyIconDone.style.display = 'none';
        }, 3000);
    };
    copyBtn.addEventListener('click', copyMessage);

    // Clicking the message itself copies it as well. The button remains the
    // keyboard/assistive path; this only adds a pointer shortcut, and it stands
    // down when the click was really the end of a manual text selection.
    decryptedBody.parentElement?.addEventListener('click', () => {
        if (window.getSelection()?.toString()) return;
        void copyMessage();
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
            // Our backend answers 503 + {"status":"retry"} when a concurrent read
            // holds the record's Redis lock; that body is the only proof the read
            // was rejected before consuming anything. A bare 503 from a proxy/CDN
            // gives no such guarantee — /api/get is destructive, so retrying it
            // blindly could burn a second view. Require the explicit body.
            let data;
            for (let attempt = 0; ; attempt++) {
                try {
                    data = await postJson('get', {id, hashedKey});
                    break;
                } catch (err) {
                    if (attempt === 0 && isRetryableRead(err)) {
                        await new Promise((resolve) => setTimeout(resolve, 400));
                        continue;
                    }
                    throw err;
                }
            }

            if (data.status === 'ok' && typeof data.cryptedMessage === 'string' && data.cryptedMessage.length > 0) {
                decryptedBody.textContent = await decryptSecretMessage(data.cryptedMessage, fullSecretKey);
                // Older backends omit viewsLeft; treat that as the consumed one-time case.
                const viewsLeft = typeof data.viewsLeft === 'number' ? data.viewsLeft : 0;
                const expiresIn = typeof data.expiresIn === 'number' ? data.expiresIn : 0;
                const expiryClause = expiresIn > 0 ? ` It expires in ${formatRemaining(expiresIn)}.` : '';
                viewsLeftNote.textContent = viewsLeft > 0
                    ? `This link can be opened ${viewsLeft} more ${viewsLeft === 1 ? 'time' : 'times'}.${expiryClause}`
                    : 'This message is burned.';
                viewsLeftNote.toggleAttribute('hidden', false);
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
        } catch (err) {
            // The server is unavailable (503). Surfacing a retry prompt is safe
            // either way — unlike the automatic retry above, it costs nothing and
            // the user learns the real state on their next click.
            if ((err as {status?: number})?.status === 503) {
                revealBtn.disabled = false;
                revealBtn.textContent = 'Server busy — try again';
                return;
            }
        }

        setLoading(false);
    });
}
