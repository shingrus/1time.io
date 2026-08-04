import {Constants, copyTextToClipboard, formatRemaining} from '../lib/util.js';
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

/** Replace a completed share form with its link-ready state. */
export async function showLinkReady(
    formEl: HTMLElement,
    link: string,
    onReset: () => void,
    {
        uses = 1,
        kind = 'secret',
        durationSeconds = Constants.defaultDurationSeconds,
    }: {uses?: number; kind?: 'secret' | 'file'; durationSeconds?: number} = {},
): Promise<void> {
    // Start the best-effort auto-copy immediately instead of putting it behind a CSS request.
    const autoCopy = copyTextToClipboard(link);

    // Success styles stay out of the initial page and fail open if their chunk is unavailable.
    await loadStyles('link-ready-styles', () => import('../styles/link.css?raw')).catch(() => {});

    const tpl = document.getElementById('link-ready-template') as HTMLTemplateElement | null;
    if (!tpl) return;

    const clone = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const isFile = kind === 'file';
    const item = isFile ? 'file' : 'secret';
    const action = isFile ? 'download' : 'view';

    const title = clone.querySelector<HTMLElement>('[data-link-title]')!;
    const expiry = clone.querySelector<HTMLElement>('[data-link-expiry]')!;
    const usage = clone.querySelector<HTMLElement>('[data-link-uses]')!;
    const warning = clone.querySelector<HTMLElement>('[data-link-warning]')!;
    const resetBtn = clone.querySelector<HTMLButtonElement>('[data-reset]')!;
    const input = clone.querySelector<HTMLInputElement>('[data-link-input]')!;

    title.textContent = `Your one-time ${item} link is ready`;
    expiry.textContent = `Expires in ${formatRemaining(durationSeconds)}`;
    usage.textContent = `${uses} ${action}${uses === 1 ? '' : 's'}`;
    warning.textContent =
        `This page is the only place the link exists. We cannot show it again, and we cannot read the ${item}: ` +
        'the key lives in the # fragment, which never reaches our servers.';
    resetBtn.textContent = `Send another ${item}`;
    input.value = link;
    input.setAttribute('aria-label', `${isFile ? 'File' : 'Secret'} one-time link`);

    const footerMeta = clone.querySelector<HTMLElement>('[data-footer-meta]')!;
    const footerSeparator = clone.querySelector<HTMLElement>('[data-footer-separator]')!;
    const referenceWrap = clone.querySelector<HTMLElement>('[data-reference-wrap]')!;
    const referenceName = clone.querySelector<HTMLElement>('[data-reference-name]')!;
    const extensionLink = clone.querySelector<HTMLAnchorElement>('[data-extension-link]')!;
    const updateFooterMeta = () => {
        const hasReference = !referenceWrap.hidden;
        const hasExtension = !extensionLink.hidden;
        footerMeta.hidden = !hasReference && !hasExtension;
        footerSeparator.hidden = !hasReference || !hasExtension;
    };

    const ua = navigator.userAgent || '';
    const isDesktopChrome =
        /Chrome\//.test(ua) &&
        !/Android|Mobi|iPhone|iPad|iPod|Edg|OPR|Vivaldi|YaBrowser|SamsungBrowser/i.test(ua) &&
        !('brave' in navigator);
    if (isDesktopChrome) {
        extensionLink.href = chromeStoreUrl;
        extensionLink.hidden = false;
        updateFooterMeta();
    }

    void (async () => {
        try {
            const {id} = parseSecretLink(link);
            if (!id) return;
            const {nameForId} = await import('../lib/secretName.js');
            const name = nameForId(id);
            if (!name) return;
            referenceName.textContent = name;
            referenceWrap.hidden = false;
            updateFooterMeta();
        } catch {
            // A reference is helpful but never required to use the link.
        }
    })();

    const copyBtn = clone.querySelector<HTMLButtonElement>('[data-copy]')!;
    const copyStatus = clone.querySelector<HTMLElement>('[data-copy-status]')!;
    let copyTimer: number | undefined;

    const showCopyStatus = (message: 'Already copied' | 'Copied') => {
        copyStatus.textContent = message;
        copyStatus.hidden = false;
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = window.setTimeout(() => {
            copyStatus.hidden = true;
            copyStatus.textContent = '';
        }, 4000);
    };

    const handleCopy = async () => {
        if (!await copyTextToClipboard(link)) return;
        showCopyStatus('Copied');
    };
    copyBtn.addEventListener('click', handleCopy);
    input.addEventListener('click', handleCopy);

    const qrToggle = clone.querySelector<HTMLButtonElement>('[data-toggle-qr]')!;
    const qrLabel = clone.querySelector<HTMLElement>('[data-qr-label]')!;
    const qrPanel = clone.querySelector<HTMLElement>('[data-qr-panel]')!;
    const qrSlot = clone.querySelector<HTMLElement>('[data-qr-slot]')!;
    qrSlot.setAttribute('aria-label', `${isFile ? 'File' : 'Secret'} link QR code`);
    let qrLoading = false;
    let qrVisible = false;
    let qrReady = false;

    qrToggle.addEventListener('click', async () => {
        if (qrLoading) return;
        if (qrVisible) {
            qrVisible = false;
            qrPanel.hidden = true;
            qrToggle.setAttribute('aria-expanded', 'false');
            qrLabel.textContent = 'Show QR code';
            return;
        }

        if (!qrReady) {
            qrLoading = true;
            qrLabel.textContent = 'Loading QR...';
            try {
                const [{createQrSvg}] = await Promise.all([
                    import('../lib/qr.js'),
                    loadStyles('qr-panel-styles', () => import('../styles/qr-panel.css?raw')).catch(() => {}),
                ]);
                qrSlot.innerHTML = await createQrSvg(link);
                qrReady = true;
            } catch {
                qrLabel.textContent = 'Show QR code';
                qrLoading = false;
                return;
            }
            qrLoading = false;
        }

        qrVisible = true;
        qrPanel.hidden = false;
        qrToggle.setAttribute('aria-expanded', 'true');
        qrLabel.textContent = 'Hide QR code';
    });

    resetBtn.addEventListener('click', () => {
        if (copyTimer) clearTimeout(copyTimer);
        clone.replaceWith(formEl);
        onReset();
    });

    formEl.replaceWith(clone);

    // Clipboard permissions vary; a visible Copy button remains available when this fails.
    void autoCopy.then((copied) => {
        if (copied) showCopyStatus('Already copied');
    });
}
