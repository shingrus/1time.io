import {createSecretLink, Constants} from '../lib/util.js';
import {showLinkReady} from './show-link-ready.js';

const form = document.querySelector<HTMLFormElement>('#new-message-form');
if (form) {
    const textarea = form.querySelector<HTMLTextAreaElement>('#secretMessage')!;
    const keyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const durationSelect = form.querySelector<HTMLSelectElement>('#duration')!;
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const errorEl = form.querySelector<HTMLElement>('[data-message-error]')!;
    const defaultLabel = submitBtn.textContent ?? 'Create one-time link';

    const setError = (msg: string) => {
        errorEl.textContent = msg;
        errorEl.toggleAttribute('hidden', !msg);
    };

    const updateSubmitState = (isLoading = false) => {
        submitBtn.disabled = isLoading || textarea.value.length === 0;
        submitBtn.textContent = isLoading ? 'Encrypting...' : defaultLabel;
    };

    textarea.addEventListener('input', () => {
        setError('');
        updateSubmitState(false);
    });
    updateSubmitState(false);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (textarea.value.length === 0) return;
        setError('');
        updateSubmitState(true);
        try {
            const {link} = await createSecretLink(textarea.value, {
                secretKey: keyInput.value,
                durationDays: Number(durationSelect.value),
            });
            if (link) {
                showLinkReady(form, link, () => {
                    textarea.value = '';
                    keyInput.value = '';
                    durationSelect.value = String(Constants.defaultDuration);
                    updateSubmitState(false);
                    textarea.focus();
                });
                return;
            }
        } catch {
            setError('Could not create the link. Please try again.');
        }
        updateSubmitState(false);
    });
}
