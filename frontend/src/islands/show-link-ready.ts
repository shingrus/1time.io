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
    }: {uses?: number; kind?: 'secret' | 'file'; durationLabel?: string} = {},
): Promise<void> {
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
    const input = clone.querySelector<HTMLInputElement>('[data-link-input]')!;

    title.textContent = text.title ?? `Your one-time ${item} link is ready`;
    expiry.textContent = (text.expiry ?? 'Expires in {duration}').replace('{duration}', durationLabel);
    usage.textContent = ((uses === 1 ? text.usesOne : text.usesOther) ?? `{count} ${action}${uses === 1 ? '' : 's'}`)
        .replace('{count}', String(uses));
    warning.textContent = text.warning ??
        `This page is the only place the link exists. We cannot show it again, and we cannot read the ${item}: ` +
        'the key lives in the # fragment, which never reaches our servers.';
    clone.querySelector<HTMLElement>('[data-reset-label]')!.textContent = text.reset ?? `Send another ${item}`;
    input.value = link;
    input.setAttribute('aria-label', text.inputLabel ?? `${isFile ? 'File' : 'Secret'} one-time link`);

    const footerSeparator = clone.querySelector<HTMLElement>('[data-footer-separator]');
    const referenceWrap = clone.querySelector<HTMLElement>('[data-reference-wrap]')!;
    const referenceName = clone.querySelector<HTMLElement>('[data-reference-name]')!;
    const updateFooterMeta = () => {
        if (footerSeparator) footerSeparator.hidden = referenceWrap.hidden;
    };

    let secretId = '';
    try {
        ({id: secretId} = parseSecretLink(link));
    } catch {
        // A reference is optional; the link still works.
    }

    void (async () => {
        try {
            if (!secretId) return;
            const {nameForId} = await import('../lib/secretName.js');
            const name = nameForId(secretId);
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

    const copiedLabel = text.copied ?? 'Copied';
    const copyHint = clone.querySelector<HTMLElement>('[data-copy-hint]')!;
    const hasCopyHint = matchMedia('(pointer: fine)').matches;
    if (hasCopyHint) {
        copyHint.textContent = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘C' : 'Ctrl+C';
        copyHint.hidden = false;
        const resetHint = clone.querySelector<HTMLElement>('[data-reset-hint]')!;
        resetBtn.addEventListener('focus', () => { resetHint.hidden = false; });
        resetBtn.addEventListener('blur', () => { resetHint.hidden = true; });
    }
    const showCopyStatus = (message: string) => {
        copyStatus.textContent = message;
        copyStatus.hidden = false;
        copyHint.hidden = true;
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = window.setTimeout(() => {
            copyStatus.hidden = true;
            copyStatus.textContent = '';
            copyHint.hidden = !hasCopyHint;
        }, 4000);
    };

    const handleCopy = async () => {
        if (!await copyTextToClipboard(link)) return;
        showCopyStatus(copiedLabel);
    };
    copyBtn.addEventListener('click', handleCopy);
    input.addEventListener('click', handleCopy);

    // Phones and tablets only: desktop browsers expose navigator.share too, but
    // there Copy is already the short path. Text only, no title or url: some
    // targets join the fields or put the title first, pushing the link off the
    // start of the line and inviting the truncation /v/ has to catch.
    const shareBtn = clone.querySelector<HTMLButtonElement>('[data-share]')!;
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
            const sharing = navigator.share({text: link});
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

    const copyShortcut = (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
        if (event.key.toLowerCase() !== 'c' && (/^[a-z]$/i.test(event.key) || event.code !== 'KeyC')) return;
        if (!clone.isConnected) return;
        const active = document.activeElement;
        const fieldSelection = (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
            && active.selectionStart !== active.selectionEnd;
        if (window.getSelection()?.isCollapsed === false || fieldSelection) return;
        event.preventDefault();
        void handleCopy();
    };

    resetBtn.addEventListener('click', () => {
        document.removeEventListener('keydown', copyShortcut);
        if (!isSelfHosted()) fetch('/pv?e=send-another', {keepalive: true, credentials: 'omit'}).catch(() => {});
        if (copyTimer) clearTimeout(copyTimer);
        clone.replaceWith(formEl);
        onReset();
    });

    formEl.replaceWith(clone);
    resetBtn.focus({preventScroll: true});
    document.addEventListener('keydown', copyShortcut);

    // Clipboard permissions vary; a visible Copy button remains available when this fails.
    void autoCopy.then((copied) => {
        if (copied) showCopyStatus(text.alreadyCopied ?? 'Already copied');
    });
}
