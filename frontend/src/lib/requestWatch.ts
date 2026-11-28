import {API_BASE, fetchStatusReport} from './mySecrets.js';
import {answerLinkFor, decideRequestStatus, loadRequestEntries, markRequestAnswered, removeRequestEntry, type RequestEntry} from './requestStore.js';

export type RequestStatus = 'checking' | 'waiting' | 'answered' | 'expired' | 'done';

const REFRESH_MS = 30_000;
const STATUS_CHUNK = 100;
const notificationsSupported = () => 'Notification' in window && !/Android/i.test(navigator.userAgent);

async function fetchExisting(ids: string[]): Promise<{existing: Record<string, boolean>; pending?: Set<string>} | null> {
    const existing: Record<string, boolean> = {};
    let pending: Set<string> | undefined;
    for (let i = 0; i < ids.length; i += STATUS_CHUNK) {
        const part = await fetchStatusReport(ids.slice(i, i + STATUS_CHUNK));
        if (!part) return null;
        Object.assign(existing, part.secrets);
        if (part.pending) pending = new Set([...(pending ?? []), ...part.pending]);
    }
    return {existing, pending};
}

export interface RequestsWatchOptions {
    only?: () => string | undefined;
    notifyBtn: HTMLButtonElement;
    notifyHint: HTMLElement;
    render: (view: RequestsView) => void;
    openAnswer?: (entry: RequestEntry) => void;
}

export interface RequestsView {
    entries: RequestEntry[];
    statusOf: (id: string) => RequestStatus;
    forget: (id: string) => void;
}

function cancelOnServer(entry: RequestEntry) {
    if (!entry.readToken) return;
    fetch(`${API_BASE}request`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: entry.id, cancel: entry.readToken}),
        keepalive: true,
    }).catch(() => {});
}

export function watchRequests(options: RequestsWatchOptions) {
    const {only, notifyBtn, notifyHint} = options;
    let notifySupported = notificationsSupported();
    const matches = (e: RequestEntry) => !only || e.id === only();

    const originalTitle = document.title;
    let entries = loadRequestEntries().filter(matches);
    const statuses = new Map<string, RequestStatus>();
    let answerArrived = false;
    let timer: number | undefined;
    let inFlight = false;
    const openNotifications = new Set<Notification>();
    let generation = 0;

    const updateTitle = () => {
        const waitingForYou = entries.filter((e) => statuses.get(e.id) === 'answered').length;
        document.title = answerArrived && waitingForYou > 0 ? `(${waitingForYou}) Answer received – 1time.io` : originalTitle;
    };

    const forget = (id: string, finalStatus: RequestStatus) => {
        entries = entries.filter((e) => e.id !== id);
        statuses.set(id, finalStatus);
        removeRequestEntry(id);
    };

    const render = () => {
        notifyBtn.toggleAttribute('hidden', entries.length === 0 || !notifySupported || Notification.permission !== 'default');
        notifyHint.toggleAttribute('hidden', entries.length === 0 || !notifySupported || Notification.permission !== 'denied');
        if (entries.length === 0) stopTimer();
        options.render({
            entries,
            statusOf: (id) => statuses.get(id) ?? 'checking',
            forget: (id) => {
                const entry = entries.find((e) => e.id === id);
                const status = statuses.get(id) ?? 'checking';
                if (entry && (status === 'waiting' || status === 'checking')) cancelOnServer(entry);
                forget(id, 'done');
                render();
                updateTitle();
            },
        });
    };

    const refresh = async () => {
        if (inFlight || entries.length === 0) return;
        inFlight = true;
        const gen = generation;
        try {
            const stored = loadRequestEntries().filter(matches);
            for (const gone of entries.filter((e) => !stored.some((s) => s.id === e.id))) statuses.set(gone.id, 'done');
            entries = entries.filter((e) => stored.some((s) => s.id === e.id));
            for (const entry of stored) {
                if (!entries.some((e) => e.id === entry.id)) entries.push(entry);
            }
            if (entries.length === 0) {
                render();
                updateTitle();
                return;
            }
            const report = await fetchExisting(entries.map((e) => e.id));
            if (!report || gen !== generation) return;
            const {existing, pending} = report;
            const arrivedIds: string[] = [];
            for (const entry of entries.slice()) {
                if (!(entry.id in existing)) continue;
                const decision = decideRequestStatus(entry, existing[entry.id], pending, Date.now());
                if (decision === 'answered') {
                    if (!entry.answered) {
                        markRequestAnswered(entry.id);
                        entry.answered = true;
                    }
                    if (statuses.get(entry.id) !== 'answered') {
                        if (statuses.get(entry.id) === 'waiting') arrivedIds.push(entry.id);
                        statuses.set(entry.id, 'answered');
                    }
                } else if (decision === 'done') {
                    forget(entry.id, 'done');
                } else if (decision === 'forget') {
                    forget(entry.id, 'expired');
                } else {
                    statuses.set(entry.id, decision);
                }
            }
            if (arrivedIds.length > 0) {
                answerArrived = true;
                if (notifySupported && Notification.permission === 'granted' && !document.hasFocus()) {
                    for (const id of arrivedIds) {
                        try {
                            const notification = new Notification('Answer received', {body: 'Someone answered your secret request.', tag: `1time-request-${id}`});
                            openNotifications.add(notification);
                            notification.onclose = () => openNotifications.delete(notification);
                            notification.onclick = () => {
                                window.focus();
                                notification.close();
                                const current = loadRequestEntries().find((e) => e.id === id);
                                if (current) (options.openAnswer ?? ((e: RequestEntry) => window.location.assign(answerLinkFor(e))))(current);
                            };
                        } catch {
                            notifySupported = false;
                            break;
                        }
                    }
                }
            }
            render();
            updateTitle();
            if (entries.some((e) => {
                const status = statuses.get(e.id);
                return status === undefined || status === 'checking' || status === 'waiting' || status === 'answered';
            })) {
                if (!timer) startTimer();
            } else {
                stopTimer();
            }
        } finally {
            if (gen === generation) inFlight = false;
        }
    };

    function stopTimer() {
        if (timer) clearInterval(timer);
        timer = undefined;
    }

    const startTimer = () => {
        stopTimer();
        timer = window.setInterval(() => void refresh(), REFRESH_MS);
    };

    notifyBtn.addEventListener('click', async () => {
        if (!notifySupported) return;
        await Notification.requestPermission();
        render();
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && entries.length > 0) void refresh();
    });

    window.addEventListener('pagehide', () => {
        for (const notification of openNotifications) notification.close();
    });

    return {
        sync() {
            entries = loadRequestEntries().filter(matches);
            render();
            if (entries.length > 0) {
                void refresh();
                if (!timer) startTimer();
            }
        },
        start() {
            generation++;
            inFlight = false;
            entries = loadRequestEntries().filter(matches);
            statuses.clear();
            answerArrived = false;
            stopTimer();
            document.title = originalTitle;
            render();
            if (entries.length > 0) {
                void refresh();
                startTimer();
            }
        },
    };
}
