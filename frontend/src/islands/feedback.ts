// Enhances the /feedback/ form, which also works as a plain form post. The
// island adds what static HTML cannot: carrying the banner's src/v from the
// query string, and an inline thank-you instead of a redirect.
const root = document.querySelector<HTMLElement>('[data-feedback]');
const form = root?.querySelector<HTMLFormElement>('[data-feedback-form]');
if (root && form) {
    const submitBtn = form.querySelector<HTMLButtonElement>('[data-feedback-submit]')!;
    const errorEl = form.querySelector<HTMLElement>('[data-feedback-error]')!;
    const thanks = root.querySelector<HTMLElement>('#thanks')!;

    // Only values the backend accepts; anything else would reject the whole
    // submission, and an answer without attribution is still worth having.
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

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorEl.hidden = true;

        const body = new URLSearchParams();
        for (const [name, value] of new FormData(form)) {
            if (typeof value === 'string') body.append(name, value);
        }

        const hasAnswer = body.has('feature') ||
            ['teamSize', 'email', 'text'].some((name) => (body.get(name) ?? '').trim() !== '');
        if (!hasAnswer) {
            showError('Pick at least one feature or write a note first.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {Accept: 'application/json'},
                body,
            });
            if (!response.ok) throw new Error(String(response.status));
            root.classList.add('is-sent');
            thanks.focus();
        } catch {
            showError('That didn’t go through. Check your email address and try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send';
        }
    });
}
