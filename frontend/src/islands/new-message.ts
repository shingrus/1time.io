import {Constants, createSecretLink} from '../lib/util.js';
import {showLinkReady} from './show-link-ready.js';

const form = document.querySelector<HTMLFormElement>('#new-message-form');
if (form) {
    const textarea = form.querySelector<HTMLTextAreaElement>('#secretMessage')!;
    const keyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const durationSelect = form.querySelector<HTMLSelectElement>('#duration')!;
    const viewsSelect = form.querySelector<HTMLSelectElement>('#views')!;
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const passphraseAddBtn = form.querySelector<HTMLButtonElement>('[data-passphrase-add]')!;
    const passphraseField = form.querySelector<HTMLElement>('[data-passphrase-field]')!;
    const labelEl = submitBtn.querySelector<HTMLElement>('.btn-label')!;
    const kbdHint = submitBtn.querySelector<HTMLElement>('[data-shortcut-hint]')!;
    const errorEl = form.querySelector<HTMLElement>('[data-message-error]')!;
    const defaultLabel = labelEl.textContent ?? 'Create one-time link';

    const setError = (msg: string) => {
        errorEl.textContent = msg;
        errorEl.toggleAttribute('hidden', !msg);
    };

    const resetPassphrase = () => {
        keyInput.value = '';
        passphraseField.toggleAttribute('hidden', true);
        passphraseAddBtn.toggleAttribute('hidden', false);
        passphraseAddBtn.setAttribute('aria-expanded', 'false');
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

    // Strength meter: loaded on demand, never on first paint. The inline shape test
    // keeps the chunk off the wire entirely for notes, key blobs and pasted files.
    const strengthSlot = form.querySelector<HTMLElement>('[data-strength]')!;
    const isCredentialShaped = (v: string) =>
        v.length >= 4 && v.length <= 100 && !/[\n\r]/.test(v) && v.trim().split(/\s+/).length <= 8;

    let strengthMeter: Promise<{update(value: string): void}> | null = null;
    let strengthTimer = 0;
    const updateStrength = () => {
        const value = textarea.value;
        if (!strengthMeter) {
            if (!isCredentialShaped(value)) return;
            strengthMeter = import('./strength-meter').then((m) => m.mountStrengthMeter(strengthSlot));
        }
        clearTimeout(strengthTimer);
        // A phone keyboard fires input far faster than anyone can read a verdict.
        strengthTimer = window.setTimeout(() => {
            strengthMeter!.then((meter) => meter.update(value));
        }, 150);
    };

    textarea.addEventListener('input', () => {
        setError('');
        updateSubmitState(false);
        updateStrength();
    });
    passphraseAddBtn.addEventListener('click', () => {
        passphraseAddBtn.toggleAttribute('hidden', true);
        passphraseAddBtn.setAttribute('aria-expanded', 'true');
        passphraseField.toggleAttribute('hidden', false);
        keyInput.focus();
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
        const durationSeconds = Number(durationSelect.value);
        const selectedViews = Number(viewsSelect.value);
        try {
            const {link} = await createSecretLink(textarea.value, {
                secretKey: keyInput.value,
                durationSeconds,
                views: selectedViews,
            });
            if (link) {
                await showLinkReady(form, link, () => {
                    textarea.value = '';
                    resetPassphrase();
                    durationSelect.value = String(Constants.defaultDurationSeconds);
                    viewsSelect.value = '1';
                    updateSubmitState(false);
                    updateStrength();
                    textarea.focus();
                }, {uses: selectedViews, durationSeconds});
                return;
            }
        } catch {
            setError('Could not create the link. Please try again.');
        }
        updateSubmitState(false);
    });
}
