import {createSecretLink, Constants} from '../lib/util.js';
import {showLinkReady} from './show-link-ready.js';

const form = document.querySelector<HTMLFormElement>('#new-message-form');
if (form) {
    const textarea = form.querySelector<HTMLTextAreaElement>('#secretMessage')!;
    const keyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const durationSelect = form.querySelector<HTMLSelectElement>('#duration')!;
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const labelEl = submitBtn.querySelector<HTMLElement>('.btn-label')!;
    const kbdHint = submitBtn.querySelector<HTMLElement>('[data-shortcut-hint]')!;
    const errorEl = form.querySelector<HTMLElement>('[data-message-error]')!;
    const defaultLabel = labelEl.textContent ?? 'Create one-time link';

    const setError = (msg: string) => {
        errorEl.textContent = msg;
        errorEl.toggleAttribute('hidden', !msg);
    };

    let hintShown = false;
    const showShortcutHint = () => {
        if (hintShown || !window.matchMedia('(pointer: fine)').matches) return;
        hintShown = true;
        const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
        kbdHint.textContent = isMac ? '⌘↵' : 'Ctrl+↵';
        kbdHint.hidden = false;
        submitBtn.title = `${isMac ? '⌘' : 'Ctrl'}+Enter`;
    };

    const updateSubmitState = (isLoading = false) => {
        submitBtn.disabled = isLoading || textarea.value.length === 0;
        labelEl.textContent = isLoading ? 'Encrypting...' : defaultLabel;
        if (!submitBtn.disabled) showShortcutHint();
    };

    textarea.addEventListener('input', () => {
        setError('');
        updateSubmitState(false);
    });
    updateSubmitState(false);

    form.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            if (submitBtn.disabled) return;
            form.requestSubmit(submitBtn);
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (textarea.value.length === 0) return;
        setError('');
        updateSubmitState(true);
        try {
            const {link} = await createSecretLink(textarea.value, {
                secretKey: keyInput.value,
                durationSeconds: Number(durationSelect.value),
            });
            if (link) {
                showLinkReady(form, link, () => {
                    textarea.value = '';
                    keyInput.value = '';
                    durationSelect.value = String(Constants.defaultDurationSeconds);
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
