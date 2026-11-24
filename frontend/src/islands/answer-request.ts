import {formatRemaining, postJson} from '../lib/util.js';
import {deriveRequestAuth, encryptRequestAnswer, isRequestLinkExpired, parseRequestLink} from '../lib/requestProtocol.mjs';

type State = 'compose' | 'sent' | 'gone' | 'broken-link';

function isRetryable(err: unknown): boolean {
    const {status, body} = (err ?? {}) as {status?: number; body?: {status?: string} | null};
    return status === 503 && body?.status === 'retry';
}

const form = document.querySelector<HTMLFormElement>('#answer-request-form');
if (form) {
    const sections = new Map<State, HTMLElement>();
    for (const state of ['compose', 'sent', 'gone', 'broken-link'] as State[]) {
        sections.set(state, form.querySelector<HTMLElement>(`[data-state="${state}"]`)!);
    }
    const message = form.querySelector<HTMLTextAreaElement>('#answerMessage')!;
    const sendBtn = form.querySelector<HTMLButtonElement>('[data-send]')!;
    const sendError = form.querySelector<HTMLElement>('[data-send-error]')!;

    const show = (visible: State) => {
        for (const [state, el] of sections) el.toggleAttribute('hidden', state !== visible);
    };

    window.addEventListener('hashchange', () => window.location.reload());

    let sendFailed = false;
    let sending = false;
    let request: ReturnType<typeof parseRequestLink> | undefined;
    try {
        request = parseRequestLink(window.location.hash);
    } catch {
    }

    if (!request) {
        show('broken-link');
    } else if (isRequestLinkExpired(request.requestKey)) {
        show('gone');
    } else {
        const requestKey = request.requestKey;
        const answered = (async () => {
            try {
                const {id} = await deriveRequestAuth(requestKey);
                const data = await postJson('secretStatus', {ids: [id]});
                return data?.status === 'ok' && Array.isArray(data.pending) && !data.pending.includes(id);
            } catch {
                return false;
            }
        })();
        const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000));
        void Promise.race([answered, timeout]).then((isGone) => show(isGone ? 'gone' : 'compose'));
        message.addEventListener('input', () => {
            sendBtn.disabled = sending || message.value.length === 0;
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!request || !message.value || sending) return;

            sending = true;
            message.readOnly = true;
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
            sendError.toggleAttribute('hidden', true);

            let posted = false;
            let mayHaveSent = false;
            try {
                const secretMessage = await encryptRequestAnswer(message.value, request.requestKey);
                const {id, answerToken} = await deriveRequestAuth(request.requestKey);
                let data;
                for (let attempt = 0; ; attempt++) {
                    try {
                        posted = true;
                        data = await postJson('answer', {id, answerToken, secretMessage});
                        break;
                    } catch (err) {
                        if (attempt === 0 && isRetryable(err)) {
                            await new Promise((resolve) => setTimeout(resolve, 400));
                            continue;
                        }
                        throw err;
                    }
                }

                if (data.status === 'ok') {
                    message.value = '';
                    const sentExpiry = document.querySelector<HTMLElement>('[data-sent-expiry]');
                    if (sentExpiry && typeof data.expiresIn === 'number' && data.expiresIn > 0) {
                        sentExpiry.textContent = `It is kept for up to ${formatRemaining(data.expiresIn)} until they open it. Then it is deleted.`;
                        sentExpiry.hidden = false;
                    }
                    show('sent');
                    fetch('/pv?e=request-answered', {keepalive: true, credentials: 'omit'}).catch(() => {});
                    return;
                }
                if (data.status === 'no message') {
                    if (sendFailed) {
                        sections.get('gone')!.querySelector('h2')!.textContent = 'Already answered. If that was you, it may have gone through.';
                    }
                    show('gone');
                    return;
                }
                if (data.status === 'wrong key') {
                    show('broken-link');
                    return;
                }
                mayHaveSent = true;
            } catch (err) {
                const status = (err as {status?: number})?.status;
                mayHaveSent = posted && !isRetryable(err) && (status === undefined || status >= 500);
            }

            if (mayHaveSent) sendFailed = true;
            sending = false;
            message.readOnly = false;
            sendError.textContent = 'Could not send. Please try again.';
            sendError.toggleAttribute('hidden', false);
            sendBtn.disabled = message.value.length === 0;
            sendBtn.textContent = 'Send';
        });
    }
}
