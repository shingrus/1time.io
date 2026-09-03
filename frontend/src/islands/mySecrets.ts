import {loadSecrets, notificationsOptedOut, removeSecret, setNotificationsOptedOut} from '../lib/mySecrets.js';
// Static, not dynamic: a dynamic import here was the one thing tipping Rollup
// into splitting out Vite's preload helper, putting an extra request on every
// page in the site. Imported from pushRegistrations rather than
// pushNotifications so this page gets the sweep without the subscribe code.
import {sweepStaleRegistrations} from '../lib/pushRegistrations.js';
import {nameForId} from '../lib/secretName.js';

type Kind = 'message' | 'file';
interface Entry {
    id: string;
    kind: Kind;
    views?: number;
    createdAt: number;
    expiresAt: number;
}

type Status = 'checking' | 'unread' | 'available' | 'consumed' | 'used' | 'unknown';

const STATUS_META: Record<Status, {label: string; cls: string}> = {
    checking: {label: 'Checking…', cls: 'is-muted'},
    unread: {label: 'Unread', cls: 'is-unread'},
    available: {label: 'Available', cls: 'is-unread'},
    consumed: {label: 'Consumed', cls: 'is-consumed'},
    used: {label: 'All views used', cls: 'is-consumed'},
    unknown: {label: 'Unknown', cls: 'is-muted'},
};

// Inlined (not via util.js) on purpose: the mySecrets never does crypto, so pulling
// in util → protocol would drag the whole AES/HKDF bundle onto this route.
const API_BASE = (import.meta.env.PUBLIC_API_URL as string | undefined) || '/api/';

// A single-view secret flips exists->gone the moment it is read, so the page is
// only truthful if it re-checks. 30s costs 2 req/min against the api_read limit
// of 60 r/m, and the timer is paused while the tab is hidden.
const REFRESH_MS = 30_000;

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

// exists=true  → still stored. Unopened only for a single-view secret; with a
//                larger allowance it means at least one view remains, and the
//                keyless status API cannot say how many were used.
// exists=false → gone before local expiry; usually read/downloaded, but the API
//                only proves it is no longer available.
function classify(exists: boolean | undefined, views: number): Status {
    const multi = views > 1;
    if (exists === true) return multi ? 'available' : 'unread';
    if (exists === false) return multi ? 'used' : 'consumed';
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
        applyStatus(el, classify(exists, typeof e.views === 'number' ? e.views : 1));
    }
}

// Read notifications are per-browser, so the switch lives here rather than on a
// single link. Without it, turning one secret off lasts only until the next one
// is created — permission is already granted, so that one subscribes itself.
const notifyToggle = document.querySelector<HTMLButtonElement>('[data-my-secrets-notify]');
if (
    notifyToggle &&
    typeof Notification !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Notification.permission === 'granted'
) {
    // Only shown once notifications have actually been granted: with nothing
    // subscribed and none possible, a switch would be a control over nothing.
    void (async () => {
        const render = () => {
            notifyToggle.textContent = notificationsOptedOut()
                ? 'Turn read notifications back on'
                : 'Turn off read notifications';
        };

        notifyToggle.addEventListener('click', async () => {
            const turningOff = !notificationsOptedOut();
            setNotificationsOptedOut(turningOff);
            render();

            if (turningOff) {
                // Drop every live registration too, or secrets subscribed before the
                // switch was flipped would still notify.
                await sweepStaleRegistrations(new Set<string>());
            }
        });

        render();
        notifyToggle.hidden = false;
    })();
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

        const refreshBtn = document.querySelector<HTMLButtonElement>('[data-my-secrets-refresh]');
        const refreshLabel = document.querySelector<HTMLElement>('[data-my-secrets-refresh-label]');

        let tick: number | undefined;
        let remaining = REFRESH_MS / 1000;
        let inFlight = false;

        const setLabel = (text: string) => {
            if (refreshLabel) refreshLabel.textContent = text;
        };

        const refresh = async () => {
            if (inFlight) return;
            inFlight = true;
            if (refreshBtn) refreshBtn.disabled = true;
            setLabel('Checking…');
            try {
                await updateStatuses(entries, statusEls);
            } finally {
                inFlight = false;
                if (refreshBtn) refreshBtn.disabled = false;
                remaining = REFRESH_MS / 1000;
                setLabel(`${remaining}s`);
            }
        };

        const stopTimer = () => {
            if (tick) clearInterval(tick);
            tick = undefined;
        };

        // setInterval rather than a self-scheduling timeout: a fixed 1s cadence keeps
        // the countdown honest even when a fetch overruns it.
        const startTimer = () => {
            stopTimer();
            tick = window.setInterval(() => {
                if (inFlight) return;
                remaining -= 1;
                if (remaining <= 0) {
                    void refresh();
                    return;
                }
                setLabel(`${remaining}s`);
            }, 1000);
        };

        // Forgetting the last row has to stop the poller too, or the timer keeps
        // posting the ids the user just asked us to forget.
        const teardown = () => {
            stopTimer();
            if (refreshBtn) refreshBtn.hidden = true;
            listEl.hidden = true;
            showEmpty();
        };

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
                // Drop it from the polled set as well: statusEls alone only stops the
                // row being painted, it does not stop the id being sent.
                const at = entries.indexOf(e);
                if (at !== -1) entries.splice(at, 1);
                li.remove();
                if (!entries.length) teardown();
            });
            li.appendChild(removeBtn);

            frag.appendChild(li);
        }
        listEl.appendChild(frag);
        listEl.hidden = false;

        if (refreshBtn) {
            refreshBtn.hidden = false;
            refreshBtn.addEventListener('click', () => {
                void refresh();
                startTimer();
            });
        }

        // A hidden tab cannot be read, so polling it only burns battery and quota.
        // Coming back is exactly when the data is most likely stale.
        document.addEventListener('visibilitychange', () => {
            if (!entries.length) return;
            if (document.hidden) {
                stopTimer();
            } else {
                void refresh();
                startTimer();
            }
        });

        void refresh();
        startTimer();
    }
}
