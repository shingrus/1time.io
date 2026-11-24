export interface RequestEntry {
    id: string;
    requestKey: string;
    requesterKey: string;
    readToken?: string;
    createdAt: number;
    expiresAt: number;
    label?: string;
    answered?: true;
}

export const REQUEST_KEY_PREFIX = '1time.request.';

function parseEntry(raw: string | null): RequestEntry | undefined {
    try {
        const e = JSON.parse(raw ?? 'null');
        return e && typeof e.id === 'string' && typeof e.requestKey === 'string' && typeof e.requesterKey === 'string' ? e : undefined;
    } catch {
        return undefined;
    }
}

export function loadRequestEntries(): RequestEntry[] {
    try {
        const entries: RequestEntry[] = [];
        for (const key of Object.keys(localStorage)) {
            if (!key.startsWith(REQUEST_KEY_PREFIX)) continue;
            const entry = parseEntry(localStorage.getItem(key));
            if (entry && key === REQUEST_KEY_PREFIX + entry.id) entries.push(entry);
        }
        return entries.sort((a, b) => a.createdAt - b.createdAt);
    } catch {
        return [];
    }
}

function writeRequestEntry(entry: RequestEntry): boolean {
    try {
        localStorage.setItem(REQUEST_KEY_PREFIX + entry.id, JSON.stringify(entry));
        return true;
    } catch {
        return false;
    }
}

export function canStoreRequests(): boolean {
    try {
        localStorage.setItem(REQUEST_KEY_PREFIX, 'x'.repeat(512));
        localStorage.removeItem(REQUEST_KEY_PREFIX);
        return true;
    } catch {
        return false;
    }
}

export const addRequestEntry = writeRequestEntry;

export function removeRequestEntry(id: string): boolean {
    try {
        localStorage.removeItem(REQUEST_KEY_PREFIX + id);
        return true;
    } catch {
        return false;
    }
}

export function markRequestAnswered(id: string): boolean {
    try {
        const entry = parseEntry(localStorage.getItem(REQUEST_KEY_PREFIX + id));
        return entry ? writeRequestEntry({...entry, answered: true}) : false;
    } catch {
        return false;
    }
}

export const KEEP_EXPIRED_MS = 86_400_000;

export function decideRequestStatus(
    entry: RequestEntry,
    existsOnServer: boolean,
    pending: Set<string> | undefined,
    now: number,
): 'answered' | 'done' | 'waiting' | 'expired' | 'forget' {
    if (existsOnServer) return 'answered';
    if (entry.answered) return 'done';
    if (!pending || pending.has(entry.id)) return 'waiting';
    return now >= entry.expiresAt + KEEP_EXPIRED_MS ? 'forget' : 'expired';
}

export function requestLinkFor({requestKey}: RequestEntry): string {
    return `${window.location.origin}/r/#${requestKey}`;
}

export function answerLinkFor({requestKey, requesterKey, id}: RequestEntry): string {
    return `${window.location.origin}/v/#r.${requestKey}${requesterKey}${id}`;
}
