import {Constants, copyTextToClipboard, formatRemaining} from '../lib/util.js';
import {parseSecretLink} from '../lib/protocol.mjs';
import {isSelfHosted} from '../lib/siteConfig.js';

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
        durationLabel = formatRemaining(Constants.defaultDurationSeconds),
        sameSecret,
    }: {
        uses?: number;
        kind?: 'secret' | 'file';
        durationLabel?: string;
        sameSecret?: {create: () => Promise<string>; error: string};
    } = {},
): Promise<void> {
    let currentLink = link;
    // Start the best-effort auto-copy immediately instead of putting it behind a CSS request.
    const autoCopy = copyTextToClipboard(link);

    // Success styles stay out of the initial page and fail open if their chunk is unavailable.
    await loadStyles('link-ready-styles', () => import('../styles/link.css?raw')).catch(() => {});

    const tpl = document.getElementById('link-ready-template') as HTMLTemplateElement | null;
    if (!tpl) return;

    const clone = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const text = tpl.dataset;
    const isFile = kind === 'file';
    const item = isFile ? 'file' : 'secret';
    const action = isFile ? 'download' : 'view';

    const title = clone.querySelector<HTMLElement>('[data-link-title]')!;
    const expiry = clone.querySelector<HTMLElement>('[data-link-expiry]')!;
    const usage = clone.querySelector<HTMLElement>('[data-link-uses]')!;
    const warning = clone.querySelector<HTMLElement>('[data-link-warning]')!;
    const resetBtn = clone.querySelector<HTMLButtonElement>('[data-reset]')!;

    title.textContent = text.title ?? `Your one-time ${item} link is ready`;
    expiry.textContent = (text.expiry ?? 'Expires in {duration}').replace('{duration}', durationLabel);
    usage.textContent = ((uses === 1 ? text.usesOne : text.usesOther) ?? `{count} ${action}${uses === 1 ? '' : 's'}`)
        .replace('{count}', String(uses));
    warning.textContent = text.warning ??
        `This page is the only place the link exists. We cannot show it again, and we cannot read the ${item}: ` +
        'the key lives in the # fragment, which never reaches our servers.';
    clone.querySelector<HTMLElement>('[data-reset-label]')!.textContent = text.reset ?? `Send another ${item}`;

    const footerSeparator = clone.querySelector<HTMLElement>('[data-footer-separator]');
    const referenceWrap = clone.querySelector<HTMLElement>('[data-reference-wrap]')!;
    const referenceName = clone.querySelector<HTMLElement>('[data-reference-name]')!;
    const updateFooterMeta = () => {
        if (footerSeparator) footerSeparator.hidden = referenceWrap.hidden;
    };

    const showReference = async () => {
        referenceWrap.hidden = true;
        updateFooterMeta();
        try {
            const {nameForId} = await import('../lib/secretName.js');
            const name = nameForId(parseSecretLink(currentLink).id);
            if (!name) return;
            referenceName.textContent = name;
            referenceWrap.hidden = false;
            updateFooterMeta();
        } catch {
            // A reference is helpful but never required to use the link.
        }
    };
    void showReference();

    const copiedLabel = text.copied ?? 'Copied';
    const showQrLabel = text.qrShow ?? 'Show QR code';
    const hasCopyHint = matchMedia('(pointer: fine)').matches;
    if (hasCopyHint) {
        const resetHint = clone.querySelector<HTMLElement>('[data-reset-hint]')!;
        resetBtn.addEventListener('focus', () => { resetHint.hidden = false; });
        resetBtn.addEventListener('blur', () => { resetHint.hidden = true; });
    }

    const firstRow = clone.querySelector<HTMLElement>('.link-copy-control')!;
    const pristineRow = firstRow.cloneNode(true) as HTMLElement;
    let newestRow = firstRow;
    const copyTimers = new Set<number>();

    const wireRow = (row: HTMLElement, rowLink: string) => {
        const input = row.querySelector<HTMLInputElement>('[data-link-input]')!;
        const copyStatus = row.querySelector<HTMLElement>('[data-copy-status]')!;
        const copyHint = row.querySelector<HTMLElement>('[data-copy-hint]')!;
        let copyTimer: number | undefined;
        input.value = rowLink;
        input.setAttribute('aria-label', text.inputLabel ?? `${isFile ? 'File' : 'Secret'} one-time link`);
        if (hasCopyHint) {
            copyHint.textContent = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘C' : 'Ctrl+C';
            copyHint.hidden = false;
        }
        const showCopyStatus = (message: string) => {
            copyStatus.textContent = message;
            copyStatus.hidden = false;
            copyHint.hidden = true;
            clearTimeout(copyTimer);
            copyTimer = window.setTimeout(() => {
                copyStatus.hidden = true;
                copyStatus.textContent = '';
                copyHint.hidden = !hasCopyHint || row !== newestRow;
            }, 4000);
            copyTimers.add(copyTimer);
        };
        const handleCopy = async () => {
            if (!await copyTextToClipboard(rowLink)) return;
            showCopyStatus(copiedLabel);
        };
        row.querySelector('[data-copy]')!.addEventListener('click', handleCopy);
        input.addEventListener('click', handleCopy);

        // Phones and tablets only: desktop browsers expose navigator.share too, but
        // there Copy is already the short path. Text only, no title or url: some
        // targets join the fields or put the title first, pushing the link off the
        // start of the line and inviting the truncation /v/ has to catch.
        const shareBtn = row.querySelector<HTMLButtonElement>('[data-share]')!;
        if ('share' in navigator && matchMedia('(pointer: coarse)').matches) {
            let sheetOpen = false;
            // Each platform's own share glyph. iPadOS reports a Mac user agent, and
            // past the coarse-pointer check a Mac user agent means an iPad.
            const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
            shareBtn.querySelector(`[data-share-icon="${apple ? 'android' : 'apple'}"]`)!.remove();
            shareBtn.hidden = false;
            shareBtn.addEventListener('click', async () => {
                if (sheetOpen) return;
                sheetOpen = true;
                // Called before anything else: share needs the click's transient activation.
                const sharing = navigator.share({text: rowLink});
                navigator.sendBeacon('/api/stat', new Blob([JSON.stringify({share: 'tap'})], {type: 'application/json'}));
                try {
                    await sharing;
                } catch {
                    // Dismissing the sheet rejects with AbortError — a choice, not an error to show.
                } finally {
                    sheetOpen = false;
                }
            });
        }
        return {handleCopy, showCopyStatus};
    };
    const first = wireRow(firstRow, link);
    let newest = first;

    const qrToggle = clone.querySelector<HTMLButtonElement>('[data-toggle-qr]')!;
    const qrLabel = clone.querySelector<HTMLElement>('[data-qr-label]')!;
    const qrPanel = clone.querySelector<HTMLElement>('[data-qr-panel]')!;
    const qrSlot = clone.querySelector<HTMLElement>('[data-qr-slot]')!;
    qrSlot.setAttribute('aria-label', text.qrLabel ?? `${isFile ? 'File' : 'Secret'} link QR code`);
    let qrLoading = false;
    let qrVisible = false;
    let qrReady = false;

    qrToggle.addEventListener('click', async () => {
        if (qrLoading) return;
        if (qrVisible) {
            qrVisible = false;
            qrPanel.hidden = true;
            qrToggle.setAttribute('aria-expanded', 'false');
            qrLabel.textContent = showQrLabel;
            return;
        }

        if (!qrReady) {
            qrLoading = true;
            const qrFor = currentLink;
            qrLabel.textContent = text.qrLoading ?? 'Loading QR...';
            try {
                const [{createQrSvg}] = await Promise.all([
                    import('../lib/qr.js'),
                    loadStyles('qr-panel-styles', () => import('../styles/qr-panel.css?raw')).catch(() => {}),
                ]);
                const svg = await createQrSvg(qrFor);
                if (qrFor !== currentLink) throw new Error('Link changed');
                qrSlot.innerHTML = svg;
                qrReady = true;
            } catch {
                qrLabel.textContent = showQrLabel;
                qrLoading = false;
                return;
            }
            qrLoading = false;
        }

        qrVisible = true;
        qrPanel.hidden = false;
        qrToggle.setAttribute('aria-expanded', 'true');
        qrLabel.textContent = text.qrHide ?? 'Hide QR code';
    });

    const sameSecretBtn = clone.querySelector<HTMLButtonElement>('[data-same-secret]');
    const sameSecretError = clone.querySelector<HTMLElement>('[data-same-secret-error]');
    if (sameSecret && sameSecretBtn && sameSecretError) {
        sameSecretBtn.hidden = false;
        let creating = false;
        sameSecretBtn.addEventListener('click', async () => {
            if (creating) return;
            creating = true;
            sameSecretBtn.disabled = true;
            try {
                const newLink = await sameSecret.create();
                if (!clone.isConnected) return;
                currentLink = newLink;
                const row = pristineRow.cloneNode(true) as HTMLElement;
                newestRow.querySelector<HTMLElement>('[data-copy-hint]')!.hidden = true;
                newestRow.after(row);
                newestRow = row;
                newest = wireRow(row, newLink);
                void showReference();
                qrPanel.hidden = true;
                qrSlot.textContent = '';
                qrToggle.setAttribute('aria-expanded', 'false');
                qrLabel.textContent = showQrLabel;
                qrVisible = false;
                qrReady = false;
                sameSecretError.hidden = true;
                if (await copyTextToClipboard(newLink)) newest.showCopyStatus(text.alreadyCopied ?? 'Already copied');
                if (!isSelfHosted()) fetch('/pv?e=send-again', {keepalive: true, credentials: 'omit'}).catch(() => {});
            } catch {
                sameSecretError.textContent = sameSecret.error;
                sameSecretError.hidden = false;
            } finally {
                creating = false;
                sameSecretBtn.disabled = false;
                sameSecretBtn.focus();
            }
        });
    }

    const copyShortcut = (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
        if (event.key.toLowerCase() !== 'c' && (/^[a-z]$/i.test(event.key) || event.code !== 'KeyC')) return;
        if (!clone.isConnected) return;
        const active = document.activeElement;
        const fieldSelection = (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
            && active.selectionStart !== active.selectionEnd;
        if (window.getSelection()?.isCollapsed === false || fieldSelection) return;
        event.preventDefault();
        void newest.handleCopy();
    };

    resetBtn.addEventListener('click', () => {
        document.removeEventListener('keydown', copyShortcut);
        if (!isSelfHosted()) fetch('/pv?e=send-another', {keepalive: true, credentials: 'omit'}).catch(() => {});
        copyTimers.forEach(clearTimeout);
        clone.replaceWith(formEl);
        onReset();
    });

    formEl.replaceWith(clone);
    resetBtn.focus({preventScroll: true});
    document.addEventListener('keydown', copyShortcut);

    // Clipboard permissions vary; a visible Copy button remains available when this fails.
    void autoCopy.then((copied) => {
        if (copied) first.showCopyStatus(text.alreadyCopied ?? 'Already copied');
    });
}
