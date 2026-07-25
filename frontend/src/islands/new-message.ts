import {createSecretLink, Constants} from '../lib/util.js';
import {showLinkReady} from './show-link-ready.js';

const form = document.querySelector<HTMLFormElement>('#new-message-form');
if (form) {
    const textarea = form.querySelector<HTMLTextAreaElement>('#secretMessage')!;
    const keyInput = form.querySelector<HTMLInputElement>('#secretKey')!;
    const durationSelect = form.querySelector<HTMLSelectElement>('#duration')!;
    const viewsSelect = form.querySelector<HTMLSelectElement>('#views')!;
    const optionsPanel = form.querySelector<HTMLElement>('[data-options-panel]')!;
    const chips = Array.from(form.querySelectorAll<HTMLButtonElement>('.option-chip'));
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

    // Summary chips: each mirrors one setting and expands the options panel.
    // data-chip holds the id of the control it summarises, so the click target
    // and the label both derive from the markup with no extra lookup table.
    const setPanelOpen = (open: boolean) => {
        optionsPanel.toggleAttribute('hidden', !open);
        for (const chip of chips) chip.setAttribute('aria-expanded', String(open));
    };
    const chipText = (id: string) => {
        if (id === 'duration') return durationSelect.selectedOptions[0]?.textContent ?? '1 day';
        if (id === 'views') return `${viewsSelect.value} view${viewsSelect.value === '1' ? '' : 's'}`;
        return keyInput.value ? 'passphrase added' : 'set passphrase';
    };
    const updateChipLabels = () => {
        for (const chip of chips) chip.lastElementChild!.textContent = chipText(chip.dataset.chip!);
    };
    for (const chip of chips) {
        chip.addEventListener('click', () => {
            setPanelOpen(true);
            form.querySelector<HTMLElement>('#' + chip.dataset.chip)?.focus();
        });
    }
    for (const el of [durationSelect, viewsSelect, keyInput]) {
        el.addEventListener(el === keyInput ? 'input' : 'change', updateChipLabels);
    }

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
                views: Number(viewsSelect.value),
            });
            if (link) {
                showLinkReady(form, link, () => {
                    textarea.value = '';
                    keyInput.value = '';
                    durationSelect.value = String(Constants.defaultDurationSeconds);
                    viewsSelect.value = '1';
                    updateChipLabels();
                    setPanelOpen(false);
                    updateSubmitState(false);
                    textarea.focus();
                }, Number(viewsSelect.value));
                return;
            }
        } catch {
            setError('Could not create the link. Please try again.');
        }
        updateSubmitState(false);
    });
}
