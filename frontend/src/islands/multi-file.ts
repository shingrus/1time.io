import {isSelfHosted} from '../lib/siteConfig.js';
export {buildZip, zipSize} from '../lib/zip.js';

type SizeLabel = (bytes: number) => string;

let rows: HTMLElement[] = [];

export const multiSummary = (files: File[], text: DOMStringMap, sizeLabel: SizeLabel) =>
    (text.multiSummary ?? '{count} files · {size}')
        .replace('{count}', String(files.length))
        .replace('{size}', sizeLabel(files.reduce((sum, file) => sum + file.size, 0)));

export const clearList = () => {
    rows.forEach((row) => row.remove());
    rows = [];
};

const cloneRow = (template: HTMLElement, title: string, meta: string) => {
    const row = template.cloneNode(true) as HTMLElement;
    row.querySelector('[data-file-name]')!.textContent = title;
    row.querySelector('[data-file-size]')!.textContent = meta;
    const button = row.querySelector<HTMLButtonElement>('[data-file-remove]')!;
    row.querySelectorAll('[data-file-name], [data-file-size], [data-file-remove]').forEach((el) => {
        el.removeAttribute('data-file-name');
        el.removeAttribute('data-file-size');
        el.removeAttribute('data-file-remove');
    });
    row.removeAttribute('hidden');
    return {row, button};
};

export const renderList = (
    template: HTMLElement,
    files: File[],
    text: DOMStringMap,
    sizeLabel: SizeLabel,
    onRemove: (index: number) => void,
    onRemoveAll: () => void,
) => {
    const previous = rows[1];
    const scrollTop = previous?.scrollTop ?? 0;
    const previousCount = previous?.children.length ?? 0;
    clearList();
    const head = document.createElement('div');
    head.className = 'file-list-head';
    const summary = document.createElement('strong');
    summary.textContent = multiSummary(files, text, sizeLabel);
    const removeAll = document.createElement('button');
    removeAll.type = 'button';
    removeAll.className = 'btn btn-ghost btn-sm';
    removeAll.textContent = text.removeAll ?? 'Remove all';
    removeAll.addEventListener('click', onRemoveAll);
    const note = document.createElement('span');
    note.className = 'form-help';
    note.textContent = text.zipNote ?? 'Sent as one zip file';
    head.append(summary, removeAll, note);
    const fileRows = files.map((file, index) => {
        const {row, button} = cloneRow(template, file.name, sizeLabel(file.size));
        button.setAttribute('aria-label', `${button.getAttribute('aria-label')} ${file.name}`);
        button.addEventListener('click', () => onRemove(index));
        return row;
    });
    const list = document.createElement('div');
    list.className = 'file-list';
    list.append(...fileRows);
    rows = [head, list];
    template.after(head, list);
    list.scrollTop = previousCount && fileRows.length > previousCount ? list.scrollHeight : scrollTop;
};

export const reportMultiFileSent = () => {
    if (!isSelfHosted()) fetch('/pv?e=multi-file', {keepalive: true, credentials: 'omit'}).catch(() => {});
};
