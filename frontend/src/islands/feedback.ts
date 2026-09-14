const root = document.querySelector<HTMLElement>('[data-feedback]');
const form = root?.querySelector<HTMLFormElement>('[data-feedback-form]');
if (root && form) {
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-feedback-submit]')!;
    const errorEl = form.querySelector<HTMLElement>('[data-feedback-error]')!;
    const thanks = root.querySelector<HTMLElement>('#thanks')!;
    const countdown = thanks.querySelector<HTMLElement>('[data-feedback-countdown]')!;
    const submitLabel = submitBtn.querySelector<HTMLElement>('[data-feedback-label]')!;
    const kbdHint = submitBtn.querySelector<HTMLElement>('[data-shortcut-hint]')!;
    const textarea = form.querySelector<HTMLTextAreaElement>('#feedback-text')!;

    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    const v = params.get('v');
    if ((src === 'ready' || src === 'read') && (v === '1' || v === '2' || v === '3')) {
        form.querySelector<HTMLInputElement>('[data-feedback-src]')!.value = src;
        form.querySelector<HTMLInputElement>('[data-feedback-v]')!.value = v;
    }

    const showError = (message: string) => {
        errorEl.textContent = message;
        errorEl.hidden = false;
    };

    textarea.addEventListener('input', () => {
        if (kbdHint.hidden && textarea.value.trim() && window.matchMedia('(pointer: fine)').matches) {
            const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
            kbdHint.textContent = isMac ? '⌘↵' : 'Ctrl+↵';
            kbdHint.hidden = false;
            submitBtn.title = `${isMac ? '⌘' : 'Ctrl'}+Enter`;
        }
    });

    form.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!submitBtn.disabled) form.requestSubmit(submitBtn);
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorEl.hidden = true;

        const body = new URLSearchParams();
        for (const [name, value] of new FormData(form)) {
            if (typeof value === 'string') body.append(name, value);
        }

        if (!(body.get('text') ?? '').trim()) {
            showError('Write a message first.');
            return;
        }

        submitBtn.disabled = true;
        submitLabel.textContent = 'Sending…';
        let message = 'That didn’t go through. Please try again.';
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {Accept: 'application/json'},
                body,
            });
            if (response.ok) {
                root.classList.add('is-sent');
                thanks.focus();
                let seconds = 8;
                const tick = () => {
                    if (seconds === 0) {
                        window.location.assign('/');
                        return;
                    }
                    countdown.textContent = `Taking you back to 1time.io in ${seconds}…`;
                    seconds -= 1;
                    setTimeout(tick, 1000);
                };
                countdown.hidden = false;
                tick();
                return;
            }
            if (response.status === 429) {
                message = 'Too many attempts. Please wait a minute and try again.';
            }
        } catch {}
        showError(message);
        submitBtn.disabled = false;
        submitLabel.textContent = 'Send';
    });
}
