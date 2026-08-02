import {copyTextToClipboard} from '../lib/util.js';
import {parseSecretLink} from '../lib/protocol.mjs';
import {chromeStoreUrl} from '../lib/siteConfig.js';

const loadStyles = async (id: string, importer: () => Promise<{default: string}>) => {
    if (document.getElementById(id)) return;
    const {default: css} = await importer();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.append(style);
};

/**
 * Replace `formEl` with the populated #link-ready-template clone.
 * Wires up Copy / QR / Reset behavior on the clone.
 * `onReset` is called when the user clicks "Create another".
 * `uses` and `kind` keep one-time branding while making an explicitly selected
 * multi-use link honest about its actual destruction point.
 */
export async function showLinkReady(
    formEl: HTMLElement,
    link: string,
    onReset: () => void,
    {uses = 1, kind = 'secret'}: {uses?: number; kind?: 'secret' | 'file'} = {},
): Promise<void> {
    // Success-state styles are not needed on first paint.
    await loadStyles('link-ready-styles', () => import('../styles/link.css?raw')).catch(() => {});

    const tpl = document.getElementById('link-ready-template') as HTMLTemplateElement | null;
    if (!tpl) return;

    const clone = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;

    const input = clone.querySelector<HTMLInputElement>('[data-link-input]')!;
    input.value = link;

    const isFile = kind === 'file';
    const kindEl = clone.querySelector<HTMLElement>('[data-link-kind]');
    if (isFile) input.setAttribute('aria-label', 'File one-time link');

    if (uses === 1) {
        if (isFile && kindEl) kindEl.textContent = 'Your one-time file link';
    } else {
        const action = isFile ? 'download' : 'view';
        const item = isFile ? 'file' : 'secret';
        const notice = clone.querySelector<HTMLElement>('.link-notice');
        const qrNote = clone.querySelector<HTMLElement>('[data-qr-note]');
        if (kindEl) kindEl.textContent = `Your 1time ${item} link`;
        if (notice) {
            notice.textContent =
                `One-time is the default. You selected ${uses} ${action}s, and the encrypted ${item} will be permanently destroyed after the ${uses}${uses === 2 ? 'nd' : uses === 3 ? 'rd' : 'th'}.` +
                ' Even we cannot read it because encryption happens in your browser.';
        }
        if (qrNote) qrNote.textContent = `This QR encodes the same limited-${action} 1time link shown above.`;
    }

    const fingerprintNameEl = clone.querySelector<HTMLElement>('[data-fingerprint-name]');
    if (fingerprintNameEl) {
        // Lazy-load the word list so it stays off the initial home bundle;
        // it's only needed once a link has actually been created.
        void (async () => {
            try {
                const {id} = parseSecretLink(link);
                if (!id) return;
                const {nameForId} = await import('../lib/secretName.js');
                const name = nameForId(id);
                if (name) {
                    fingerprintNameEl.textContent = ` ("${name}")`;
                }
            } catch {
                // Leave the title unchanged if the link can't be parsed.
            }
        })();
    }

    const ua = navigator.userAgent || '';
    const tipTextEl = clone.querySelector<HTMLElement>('[data-tip-text]')!;
    if (/Chrome\//.test(ua) && !/Android|Mobi|iPhone|iPad|iPod/i.test(ua)) {
        // Chromium desktop can install the extension — promote it instead of the
        // bookmark shortcut, with an accent-colored CTA so it stands out.
        const iconEl = clone.querySelector<HTMLElement>('.callout-icon');
        if (iconEl) {
            iconEl.style.color = 'var(--accent)';
            iconEl.innerHTML =
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>';
        }
        tipTextEl.innerHTML =
            `<a href="${chromeStoreUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:700;text-decoration:underline">Add the 1time extension for Chrome →</a>`;
    } else {
        const bookmarkEl = clone.querySelector<HTMLElement>('[data-bookmark-shortcut]')!;
        bookmarkEl.textContent = /Mac|iPhone|iPad|iPod/.test(ua) ? '⌘D' : 'Ctrl+D';
    }

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
            const [{createQrSvg}] = await Promise.all([
                import('../lib/qr.js'),
                loadStyles('qr-panel-styles', () => import('../styles/qr-panel.css?raw')).catch(() => {}),
            ]);
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
