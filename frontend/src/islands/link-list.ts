import {copyTextToClipboard} from '../lib/util.js';
import {isSelfHosted} from '../lib/siteConfig.js';

export interface MadeLink {
    name: string;
    link: string;
}

let container: HTMLElement | null = null;

const createCopyButton = (label: string, getText: () => string, copiedLabel: string) => {
    const button = document.createElement('button');
    let restoreTimer: number | undefined;
    button.type = 'button';
    button.className = 'btn btn-secondary btn-sm';
    button.textContent = label;
    button.addEventListener('click', async () => {
        if (!await copyTextToClipboard(getText())) return;
        clearTimeout(restoreTimer);
        button.textContent = copiedLabel;
        restoreTimer = window.setTimeout(() => {
            button.textContent = label;
        }, 2000);
    });
    return button;
};

/** Render the in-memory list of links made on this page, right after `anchor`. */
export function renderLinkList(anchor: HTMLElement, links: MadeLink[], text: DOMStringMap): void {
    if (!container?.isConnected) {
        container = document.createElement('section');
        container.className = 'link-display link-list';
        anchor.after(container);
    }

    const copyLabel = text.copy ?? 'Copy';
    const copiedLabel = text.copied ?? 'Copied';
    const copyAllLabel = text.copyAll ?? 'Copy all';

    const heading = document.createElement('h2');
    heading.className = 'link-list-title';
    heading.textContent = (text.listTitle ?? 'Links made in this tab ({count})').replace('{count}', String(links.length));

    const copyAll = createCopyButton(
        copyAllLabel,
        () => links.map(({link}) => link).join('\n'),
        copiedLabel,
    );

    copyAll.addEventListener('click', () => {
        if (!isSelfHosted()) fetch('/pv?e=copy-all', {keepalive: true, credentials: 'omit'}).catch(() => {});
    });

    const rows = links.map(({name, link}) => {
        const row = document.createElement('li');
        row.className = 'link-list-row';
        const nameEl = document.createElement('strong');
        nameEl.className = 'link-list-name';
        nameEl.textContent = name;
        const linkEl = document.createElement('span');
        linkEl.className = 'link-list-url';
        linkEl.textContent = link;
        const copy = createCopyButton(copyLabel, () => link, copiedLabel);
        copy.setAttribute('aria-label', (text.copyRowLabel ?? 'Copy link {name}').replace('{name}', name));
        row.append(nameEl, linkEl, copy);
        return row;
    });

    const note = document.createElement('p');
    note.className = 'form-help';
    note.textContent = text.listNote ?? 'Only in this tab, never stored or sent anywhere. Reloading the page forgets the list.';

    const header = document.createElement('div');
    header.className = 'link-list-header';
    header.append(heading, copyAll);

    const list = document.createElement('ol');
    list.className = 'link-list-rows';
    list.append(...rows);

    container.replaceChildren(header, list, note);
}
