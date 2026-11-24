import {copyTextToClipboard, formatRemaining, postJson} from '../lib/util.js';
import {buildRequestLink, createRequestKeys} from '../lib/requestProtocol.mjs';
import {nameForId} from '../lib/secretName.js';
import {addRequestEntry, answerLinkFor, canStoreRequests, loadRequestEntries, type RequestEntry} from '../lib/requestStore.js';
import {watchRequests} from '../lib/requestWatch.js';
import {showLinkReady} from './show-link-ready.ts';

const beacon = (event: string) => {
    fetch(`/pv?e=${event}`, {keepalive: true, credentials: 'omit'}).catch(() => {});
};

const MAX_ID_ATTEMPTS = 3;

function isRetryable(err: unknown): boolean {
    const {status, body} = (err ?? {}) as {status?: number; body?: {status?: string} | null};
    return status === 503 && body?.status === 'retry';
}

const OPEN_REQUEST_KEY = '1time.openRequest';

function rememberOpenRequest(id: string | undefined): void {
    try {
        if (id) sessionStorage.setItem(OPEN_REQUEST_KEY, id);
        else sessionStorage.removeItem(OPEN_REQUEST_KEY);
    } catch {
    }
}

function openRequestId(): string | null {
    try {
        return sessionStorage.getItem(OPEN_REQUEST_KEY);
    } catch {
        return null;
    }
}

const STORAGE_ERROR = 'Could not save this request in your browser, so its answer could not be opened. Check that this site may store data.';

const CLOCK_ERROR = 'Your device clock seems off. Fix it and try again.';

const formEl = document.querySelector<HTMLFormElement>('#request-form');
const template = document.querySelector<HTMLTemplateElement>('#link-ready-template');
if (formEl && template) {
    Object.assign(template.dataset, {
        title: 'Your request link is ready',
        usesOne: 'Waiting for their answer…',
        warning: 'Anyone with this link can answer it once. Send it only to the person you expect the secret from.',
        reset: 'Request another secret',
        inputLabel: 'Request link',
        share: 'request',
    });
    const durationSelect = formEl.querySelector<HTMLSelectElement>('#duration')!;
    const labelInput = formEl.querySelector<HTMLInputElement>('#request-label')!;
    const createBtn = formEl.querySelector<HTMLButtonElement>('[data-create]')!;
    const errorEl = formEl.querySelector<HTMLElement>('[data-error]')!;
    createBtn.disabled = false;

    const notifyBtn = document.createElement('button');
    notifyBtn.type = 'button';
    notifyBtn.className = 'btn btn-secondary btn-sm';
    notifyBtn.textContent = 'Notify me when it arrives';
    notifyBtn.hidden = true;
    const copyMessageBtn = document.createElement('button');
    copyMessageBtn.type = 'button';
    copyMessageBtn.className = 'btn btn-secondary btn-sm';
    copyMessageBtn.textContent = 'Copy with message';
    copyMessageBtn.hidden = true;
    copyMessageBtn.addEventListener('click', async () => {
        const link = card?.querySelector<HTMLInputElement>('.link-copy-control input')?.value;
        if (!link || !(await copyTextToClipboard(`${formEl.dataset.message}\n${link}`))) return;
        copyMessageBtn.textContent = 'Copied';
        setTimeout(() => {
            copyMessageBtn.textContent = 'Copy with message';
        }, 2000);
    });
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'btn btn-success btn-sm';
    openBtn.textContent = 'Open';
    openBtn.hidden = true;
    openBtn.addEventListener('click', () => {
        if (pendingOpen) openAnswer(pendingOpen);
    });
    const notifyHint = document.createElement('span');
    notifyHint.textContent = 'Notifications are blocked for this site in your browser settings.';
    notifyHint.hidden = true;
    let card: HTMLElement | undefined;
    let currentId: string | undefined;
    let pendingOpen: RequestEntry | undefined;

    const openAnswer = (entry: RequestEntry) => {
        rememberOpenRequest(undefined);
        window.location.replace(answerLinkFor(entry));
    };
    const openWhenBack = () => {
        if (!document.hidden && document.hasFocus() && pendingOpen && loadRequestEntries().some((e) => e.id === pendingOpen!.id)) openAnswer(pendingOpen);
    };
    document.addEventListener('visibilitychange', openWhenBack);

    const watch = watchRequests({
        only: () => currentId,
        openAnswer,
        notifyBtn,
        notifyHint,
        render: ({entries, statusOf}) => {
            if (!card || !currentId) return;
            const entry = entries[0];
            const status = statusOf(currentId);
            const live = status === 'checking' || status === 'waiting';
            const secondsLeft = entry ? Math.round((entry.expiresAt - Date.now()) / 1000) : 0;
            card.querySelector('[data-link-title]')!.textContent = live
                ? 'Your request link is ready'
                : status === 'answered' ? 'Your secret has arrived' : status === 'expired' ? 'This request expired' : 'This request is closed';
            card.querySelector('[data-link-expiry]')!.textContent = live
                ? secondsLeft > 0 ? `Expires in ${formatRemaining(secondsLeft)}` : 'Expires soon'
                : status === 'answered' ? secondsLeft > 0 ? `Open within ${formatRemaining(secondsLeft)}. It opens once, then it is deleted.` : 'It opens once, then it is deleted' : status === 'expired' ? 'Nobody answered in time' : 'The answer was opened, or the request was removed or expired.';
            const uses = card.querySelector<HTMLElement>('[data-link-uses]')!;
            uses.textContent = status === 'waiting' ? 'Waiting for their answer…' : 'Checking…';
            uses.hidden = !live;
            (uses.previousElementSibling as HTMLElement).hidden = !live;
            card.querySelector<HTMLElement>('.link-copy-control')!.hidden = !live;
            copyMessageBtn.hidden = !live;
            card.querySelector<HTMLElement>('.link-warning')!.hidden = !live;
            pendingOpen = status === 'answered' ? entry : undefined;
            openBtn.hidden = status !== 'answered';
            openWhenBack();
            notifyBtn.hidden ||= !live;
            notifyHint.hidden ||= !live;
        },
    });

    const showError = (text: string) => {
        errorEl.textContent = text;
        errorEl.toggleAttribute('hidden', false);
    };

    const showCard = async (entry: RequestEntry, autoCopy = true) => {
        currentId = entry.id;
        await showLinkReady(formEl, buildRequestLink(window.location.origin, entry.requestKey), () => {
            currentId = undefined;
            pendingOpen = undefined;
            card = undefined;
            openBtn.hidden = true;
            copyMessageBtn.hidden = true;
            rememberOpenRequest(undefined);
            labelInput.value = '';
            durationSelect.selectedIndex = Array.from(durationSelect.options).findIndex((o) => o.defaultSelected);
            watch.start();
            labelInput.focus({preventScroll: true});
        }, {
            durationLabel: formatRemaining(Math.max(Math.round((entry.expiresAt - Date.now()) / 1000), 1)),
            autoCopy,
        });
        const clone = document.querySelector<HTMLElement>('.link-display');
        if (!clone) return;
        const name = entry.label || nameForId(entry.id);
        if (name) {
            clone.querySelector('[data-reference-name]')!.textContent = name;
            clone.querySelector<HTMLElement>('[data-reference-wrap]')!.hidden = false;
            clone.querySelector<HTMLElement>('[data-footer-separator]')?.removeAttribute('hidden');
        }
        clone.querySelector('.link-secondary-actions')!.prepend(openBtn);
        clone.querySelector('.link-secondary-actions')!.append(copyMessageBtn, notifyBtn);
        clone.querySelector('[data-footer-meta]')!.append(notifyHint);
        const myLink = clone.querySelector<HTMLAnchorElement>('.link-extension');
        if (myLink) myLink.textContent = 'Track it in My Secrets';
        card = clone;
        watch.start();
    };

    formEl.addEventListener('submit', async (event) => {
        event.preventDefault();
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';
        errorEl.toggleAttribute('hidden', true);

        try {
            if (!canStoreRequests()) throw new Error(STORAGE_ERROR);
            const durationSeconds = Number(durationSelect.value);
            let keys;
            for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
                const candidate = await createRequestKeys(durationSeconds);
                const payload = {
                    id: candidate.id,
                    readTokenHash: candidate.readTokenHash,
                    answerTokenHash: candidate.answerTokenHash,
                    duration: durationSeconds,
                    expiry: candidate.requestKey.slice(-2),
                };
                let data;
                try {
                    data = await postJson('request', payload);
                } catch (err) {
                    if (!isRetryable(err)) throw err;
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    data = await postJson('request', payload);
                }
                if (data.status === 'ok') {
                    keys = candidate;
                    break;
                }
                if (data.status === 'clock') throw new Error(CLOCK_ERROR);
                if (data.status !== 'exists') break;
            }
            if (!keys) throw new Error('Failed to create request');

            const now = Date.now();
            const label = labelInput.value.trim().slice(0, 60);
            const createdEntry: RequestEntry = {
                id: keys.id,
                requestKey: keys.requestKey,
                requesterKey: keys.requesterKey,
                readToken: keys.readToken,
                createdAt: now,
                expiresAt: now + durationSeconds * 1000,
                ...(label && {label}),
            };
            if (!addRequestEntry(createdEntry)) throw new Error(STORAGE_ERROR);

            rememberOpenRequest(keys.id);
            await showCard(createdEntry);
            beacon('request-created');
        } catch (err) {
            showError(err instanceof Error && (err.message === STORAGE_ERROR || err.message === CLOCK_ERROR) ? err.message : 'Could not create the request link. Please try again.');
        }

        createBtn.disabled = false;
        createBtn.textContent = 'Create request link';
    });

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const openId = openRequestId();
    const openEntry = openId ? loadRequestEntries().find((e) => e.id === openId) : undefined;
    const restoring = navigation?.type === 'reload' || navigation?.type === 'back_forward' || (document as unknown as {wasDiscarded?: boolean}).wasDiscarded === true;
    if (restoring && openEntry) void showCard(openEntry, false);
    else rememberOpenRequest(undefined);
}
