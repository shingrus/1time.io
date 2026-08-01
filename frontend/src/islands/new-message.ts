import {Constants, createSecretLink} from '../lib/util.js';
import {showLinkReady} from './show-link-ready.js';

const form = document.querySelector<HTMLFormElement>('#new-message-form');
if (form) {
    const textarea = form.querySelector<HTMLTextAreaElement>('#secretMessage')!;
    const keyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const durationSelect = form.querySelector<HTMLSelectElement>('#duration')!;
    const viewsSelect = form.querySelector<HTMLSelectElement>('#views')!;
    const optionsRow = form.querySelector<HTMLElement>('[data-options-row]')!;
    const passphraseEditor = form.querySelector<HTMLElement>('[data-passphrase-editor]')!;
    const passphraseToggle = form.querySelector<HTMLButtonElement>('[data-passphrase-toggle]')!;
    const passphraseDone = form.querySelector<HTMLButtonElement>('[data-passphrase-done]')!;
    const passphraseLabel = form.querySelector<HTMLElement>('[data-passphrase-label]')!;
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const labelEl = submitBtn.querySelector<HTMLElement>('.btn-label')!;
    const kbdHint = submitBtn.querySelector<HTMLElement>('[data-shortcut-hint]')!;
    const errorEl = form.querySelector<HTMLElement>('[data-message-error]')!;
    const defaultLabel = labelEl.textContent ?? 'Create one-time link';

    const setPassphraseOpen = (open: boolean, restoreFocus = true) => {
        optionsRow.toggleAttribute('hidden', open);
        passphraseEditor.toggleAttribute('hidden', !open);
        passphraseToggle.setAttribute('aria-expanded', String(open));
        if (open) keyInput.focus();
        else if (restoreFocus) passphraseToggle.focus();
    };
    const updatePassphraseLabel = () => {
        passphraseLabel.textContent = keyInput.value ? 'Passphrase ✓' : 'Passphrase';
    };
    passphraseToggle.addEventListener('click', () => setPassphraseOpen(true));
    passphraseDone.addEventListener('click', () => setPassphraseOpen(false));
    keyInput.addEventListener('input', updatePassphraseLabel);
    keyInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        event.preventDefault();
        setPassphraseOpen(false);
    });

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
        const selectedViews = Number(viewsSelect.value);
        try {
            const {link} = await createSecretLink(textarea.value, {
                secretKey: keyInput.value,
                durationSeconds: Number(durationSelect.value),
                views: selectedViews,
            });
            if (link) {
                showLinkReady(form, link, () => {
                    textarea.value = '';
                    keyInput.value = '';
                    durationSelect.value = String(Constants.defaultDurationSeconds);
                    viewsSelect.value = '1';
                    updatePassphraseLabel();
                    setPassphraseOpen(false, false);
                    updateSubmitState(false);
                    textarea.focus();
                }, {uses: selectedViews});
                return;
            }
        } catch {
            setError('Could not create the link. Please try again.');
        }
        updateSubmitState(false);
    });
}
