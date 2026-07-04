import {loadSecrets, removeSecret} from '../lib/mySecrets.js';
import {nameForId} from '../lib/secretName.js';

type Kind = 'message' | 'file';
interface Entry {
    id: string;
    kind: Kind;
    createdAt: number;
    expiresAt: number;
}

type Status = 'checking' | 'unread' | 'consumed' | 'unknown';

const STATUS_META: Record<Status, {label: string; cls: string}> = {
    checking: {label: 'Checking…', cls: 'is-muted'},
    unread: {label: 'Unread', cls: 'is-unread'},
    consumed: {label: 'Consumed', cls: 'is-consumed'},
    unknown: {label: 'Unknown', cls: 'is-muted'},
};

// Inlined (not via util.js) on purpose: the mySecrets never does crypto, so pulling
// in util → protocol would drag the whole AES/HKDF bundle onto this route.
const API_BASE = (import.meta.env.PUBLIC_API_URL as string | undefined) || '/api/';

function relTime(ms: number): string {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
}

function applyStatus(el: HTMLElement, status: Status): void {
    const meta = STATUS_META[status];
    el.className = `my-secrets-status ${meta.cls}`;
    el.textContent = meta.label;
}

// exists=true  → still stored, so unopened.
// exists=false → gone before local expiry; usually read/downloaded, but the API
//                only proves it is no longer available.
function classify(exists: boolean | undefined): Status {
    if (exists === true) return 'unread';
    if (exists === false) return 'consumed';
    return 'unknown';
}

function renderRow(e: Entry): {li: HTMLLIElement; statusEl: HTMLElement} {
    const li = document.createElement('li');
    li.className = 'my-secrets-item';

    const main = document.createElement('div');
    main.className = 'my-secrets-item-main';

    const name = document.createElement('span');
    name.className = 'my-secrets-item-name';
    name.textContent = nameForId(e.id) || 'unknown secret';

    const meta = document.createElement('span');
    meta.className = 'my-secrets-item-meta';
    meta.textContent = `${e.kind === 'file' ? 'File' : 'Message'} · created ${relTime(e.createdAt)}`;

    main.append(name, meta);

    const statusEl = document.createElement('span');
    applyStatus(statusEl, 'checking');

    li.append(main, statusEl);
    return {li, statusEl};
}

async function fetchStatuses(ids: string[]): Promise<Record<string, boolean> | null> {
    if (!ids.length) return {};
    try {
        const res = await fetch(`${API_BASE}secretStatus`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ids}),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.status !== 'ok' || !data.secrets) return null;
        return data.secrets as Record<string, boolean>;
    } catch {
        return null;
    }
}

async function updateStatuses(entries: Entry[], statusEls: Map<string, HTMLElement>): Promise<void> {
    const secrets = await fetchStatuses(entries.map((e) => e.id));
    for (const e of entries) {
        const el = statusEls.get(e.id);
        if (!el) continue;
        const exists = secrets ? secrets[e.id] : undefined;
        applyStatus(el, classify(exists));
    }
}

const listEl = document.querySelector<HTMLUListElement>('[data-my-secrets-list]');
const emptyEl = document.querySelector<HTMLElement>('[data-my-secrets-empty]');
const loadingEl = document.querySelector<HTMLElement>('[data-my-secrets-loading]');
const createBtn = document.querySelector<HTMLElement>('[data-my-secrets-create]');

// The empty state carries its own "Create" button, so hide the header one when
// there's nothing to show and avoid a duplicate call-to-action.
const showEmpty = () => {
    emptyEl!.hidden = false;
    if (createBtn) createBtn.hidden = true;
};

if (listEl && emptyEl) {
    const entries = (loadSecrets() as Entry[]).slice().reverse(); // newest first
    loadingEl?.remove();

    if (!entries.length) {
        showEmpty();
    } else {
        const statusEls = new Map<string, HTMLElement>();
        const frag = document.createDocumentFragment();
        for (const e of entries) {
            const {li, statusEl} = renderRow(e);
            statusEls.set(e.id, statusEl);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'my-secrets-remove';
            removeBtn.setAttribute('aria-label', `Forget ${nameForId(e.id) || 'this secret'}`);
            removeBtn.title = 'Forget';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                removeSecret(e.id);
                statusEls.delete(e.id);
                li.remove();
                if (!listEl.children.length) {
                    listEl.hidden = true;
                    showEmpty();
                }
            });
            li.appendChild(removeBtn);

            frag.appendChild(li);
        }
        listEl.appendChild(frag);
        listEl.hidden = false;

        void updateStatuses(entries, statusEls);
    }
}
