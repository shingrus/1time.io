import {copyTextToClipboard} from '../lib/util.js';

/**
 * Replace `formEl` with the populated #link-ready-template clone.
 * Wires up Copy / QR / Reset behavior on the clone.
 * `onReset` is called when the user clicks "Create another".
 */
export function showLinkReady(formEl: HTMLElement, link: string, onReset: () => void): void {
    const tpl = document.getElementById('link-ready-template') as HTMLTemplateElement | null;
    if (!tpl) return;

    const clone = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;

    const input = clone.querySelector<HTMLInputElement>('[data-link-input]')!;
    input.value = link;

    const bookmarkEl = clone.querySelector<HTMLElement>('[data-bookmark-shortcut]')!;
    bookmarkEl.textContent = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || '') ? '⌘D' : 'Ctrl+D';

    const copyBtn = clone.querySelector<HTMLButtonElement>('[data-copy]')!;
    const copyLabel = clone.querySelector<HTMLElement>('[data-copy-label]')!;
    const copyDefault = clone.querySelector<SVGElement>('[data-copy-icon-default]')!;
    const copyDone = clone.querySelector<SVGElement>('[data-copy-icon-done]')!;
    let didAutoCopy = false;
    let copyTimer: number | undefined;

    const setCopiedUi = (copied: boolean) => {
        copyLabel.textContent = copied
            ? 'Copied!'
            : didAutoCopy ? 'Link already copied' : 'Copy link';
        const showDone = copied || didAutoCopy;
        copyDefault.style.display = showDone ? 'none' : '';
        copyDone.style.display = showDone ? '' : 'none';
    };

    const handleCopy = async () => {
        const ok = await copyTextToClipboard(link);
        if (!ok) return;
        didAutoCopy = true;
        setCopiedUi(true);
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = window.setTimeout(() => setCopiedUi(false), 3000);
    };
    copyBtn.addEventListener('click', handleCopy);
    input.addEventListener('click', handleCopy);

    void (async () => {
        const ok = await copyTextToClipboard(link);
        if (ok) {
            didAutoCopy = true;
            setCopiedUi(false);
        }
    })();

    const qrToggle = clone.querySelector<HTMLButtonElement>('[data-toggle-qr]')!;
    const qrLabel = clone.querySelector<HTMLElement>('[data-qr-label]')!;
    const qrPanel = clone.querySelector<HTMLElement>('[data-qr-panel]')!;
    const qrSlot = clone.querySelector<HTMLElement>('[data-qr-slot]')!;
    let qrLoading = false;
    let qrVisible = false;

    qrToggle.addEventListener('click', async () => {
        if (qrLoading) return;
        if (qrVisible) {
            qrVisible = false;
            qrPanel.toggleAttribute('hidden', true);
            qrSlot.innerHTML = '';
            qrLabel.textContent = 'Show QR code';
            return;
        }
        qrLoading = true;
        qrLabel.textContent = 'Loading QR...';
        try {
            const {createQrSvg} = await import('../lib/qr.js');
            qrSlot.innerHTML = await createQrSvg(link);
            qrPanel.toggleAttribute('hidden', false);
            qrVisible = true;
            qrLabel.textContent = 'Hide QR code';
        } catch {
            qrLabel.textContent = 'Show QR code';
        } finally {
            qrLoading = false;
        }
    });

    const resetBtn = clone.querySelector<HTMLButtonElement>('[data-reset]')!;
    resetBtn.addEventListener('click', () => {
        if (copyTimer) clearTimeout(copyTimer);
        clone.replaceWith(formEl);
        onReset();
    });

    formEl.replaceWith(clone);
}
