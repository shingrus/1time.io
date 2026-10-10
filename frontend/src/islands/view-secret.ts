import {
    Constants,
    copyTextToClipboard,
    decryptSecretMessage,
    formatRemaining,
    hashSecretKey,
    postJson,
} from '../lib/util.js';
import {isValidLinkToken} from '../lib/protocol.mjs';

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
    const brokenLinkSection = form.querySelector<HTMLElement>('[data-state="broken-link"]')!;
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
    const linkIsBroken = !isValidLinkToken(linkKey);
    if (linkIsBroken) {
        qrToggle.disabled = true;
    }

    const showOnly = (visible: HTMLElement) => {
        for (const el of [preReadSection, passphraseSection, decryptedSection, noMessageSection, brokenLinkSection]) {
            el.toggleAttribute('hidden', el !== visible);
        }
    };

    // Decided at load, not on click. The fragment is already in hand, so the
    // confirm gate has nothing to protect here — no request will ever be made —
    // and "Someone sent you a secret" is a claim a nameless fragment cannot back.
    if (linkIsBroken) {
        qrAction.toggleAttribute('hidden', true);
        showOnly(brokenLinkSection);
    }

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
        // A fragment that is not exactly randomKeyLen + storageIdLen base64url
        // characters cannot name a secret, so this is a cut or mangled link, not
        // a consumed one. Reporting it as "gone" was both wrong and unactionable.
        if (!isValidLinkToken(linkKey)) {
            qrAction.toggleAttribute('hidden', true);
            showOnly(brokenLinkSection);
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
