import {nameForId} from '../lib/secretName.js';
import {answerLinkFor, requestLinkFor, type RequestEntry} from '../lib/requestStore.js';
import {watchRequests} from '../lib/requestWatch.js';

function timeLeft(seconds: number): string {
    const minutes = Math.max(Math.round(seconds / 60), 1);
    const [count, unit] = minutes < 60 ? [minutes, 'minute'] : minutes < 1440 ? [Math.round(minutes / 60), 'hour'] : [Math.round(minutes / 1440), 'day'];
    return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

export function mountRequests(onEmpty: () => void): () => void {
    const section = document.querySelector<HTMLElement>('[data-requests-section]')!;
    const heading = section.querySelector<HTMLElement>('[data-requests-heading]')!;
    const listEl = section.querySelector<HTMLUListElement>('[data-requests]')!;

    let lastSignature = '';
    const watch = watchRequests({
        notifyBtn: section.querySelector<HTMLButtonElement>('[data-notify]')!,
        notifyHint: section.querySelector<HTMLElement>('[data-notify-hint]')!,
        render: ({entries, statusOf, forget}) => {
            const rows = entries.slice().reverse().map((entry) => {
                const status = statusOf(entry.id);
                const left = Math.round((entry.expiresAt - Date.now()) / 1000);
                const metaText = status === 'answered' ? left > 0 ? `Open within ${timeLeft(left)}` : '' : left > 0 ? `Link expires in ${timeLeft(left)}` : status === 'waiting' ? '' : 'Link expired';
                return {entry, status, metaText};
            });
            const signature = rows.map((r) => `${r.entry.id}|${r.status}|${r.metaText}`).join('\n');
            if (signature !== lastSignature) {
                lastSignature = signature;
                const active = document.activeElement as HTMLElement | null;
                const focused = active && listEl.contains(active) ? {id: active.closest('li')?.dataset.id, control: active.dataset.control} : undefined;
                listEl.replaceChildren();
                for (const {entry, status, metaText} of rows) {
                    const li = document.createElement('li');
                    li.className = 'my-secrets-item';
                    li.dataset.id = entry.id;

                    const main = document.createElement('div');
                    main.className = 'my-secrets-item-main';
                    const name = document.createElement('span');
                    name.className = 'my-secrets-item-name';
                    const displayName = (typeof entry.label === 'string' && entry.label.trim()) || nameForId(entry.id);
                    name.textContent = displayName || 'request';
                    const meta = document.createElement('span');
                    meta.className = 'my-secrets-item-meta';
                    meta.textContent = metaText;
                    main.append(name, meta);
                    li.append(main);

                    if (status === 'answered') {
                        const openBtn = document.createElement('a');
                        openBtn.className = 'btn btn-success btn-sm';
                        openBtn.href = answerLinkFor(entry);
                        openBtn.textContent = 'Open';
                        openBtn.dataset.control = 'open';
                        const label = document.createElement('span');
                        label.className = 'my-secrets-status is-consumed';
                        label.textContent = 'Answer received';
                        li.append(label, openBtn);
                    } else {
                        const label = document.createElement('span');
                        label.className = `my-secrets-status ${status === 'waiting' ? 'is-unread' : 'is-muted'}`;
                        label.textContent = status === 'waiting' ? 'Waiting…' : status === 'expired' ? 'Expired' : 'Checking…';
                        li.append(label);
                        if (status === 'waiting' || status === 'checking') {
                            const copyBtn = document.createElement('button');
                            copyBtn.type = 'button';
                            copyBtn.className = 'btn btn-secondary btn-sm';
                            copyBtn.dataset.control = 'copy';
                            copyBtn.textContent = 'Copy link';
                            copyBtn.addEventListener('click', async () => {
                                try {
                                    await navigator.clipboard.writeText(requestLinkFor(entry));
                                } catch {
                                    return;
                                }
                                copyBtn.textContent = 'Copied';
                                setTimeout(() => {
                                    copyBtn.textContent = 'Copy link';
                                }, 2000);
                            });
                            li.append(copyBtn);
                        }
                    }

                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.dataset.control = 'forget';
                    removeBtn.className = 'my-secrets-remove';
                    removeBtn.title = 'Forget';
                    removeBtn.setAttribute('aria-label', `Forget ${displayName || 'this request'}`);
                    removeBtn.textContent = '×';
                    removeBtn.addEventListener('click', () => {
                        if (status !== 'expired' && status !== 'done' && !window.confirm('Forget this request? Its answer can then never be opened.')) return;
                        forget(entry.id);
                    });
                    li.append(removeBtn);

                    listEl.append(li);
                }
                if (focused) listEl.querySelector<HTMLElement>(`li[data-id="${CSS.escape(focused.id ?? '')}"] [data-control="${focused.control}"]`)?.focus({preventScroll: true});
            }
            heading.toggleAttribute('hidden', entries.length === 0);
            listEl.toggleAttribute('hidden', entries.length === 0);
            section.hidden = entries.length === 0;
            if (entries.length === 0) onEmpty();
        },
    });

    section.hidden = false;
    watch.start();
    return watch.sync;
}
