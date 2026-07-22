/**
 * Browser-local list for My Secrets.
 * Stores only id, kind, and timestamps; never plaintext, keys, or human labels.
 * Expired entries are pruned locally before status checks.
 */
const STORAGE_KEY = '1time.secretsList.v1';
const MAX_ENTRIES = 128;

/**
 * @typedef {Object} SecretEntry
 * @property {string} id          Server storage id (locates the secret).
 * @property {'message'|'file'} kind
 * @property {number} createdAt   ms epoch.
 * @property {number} expiresAt   ms epoch.
 */

function readRaw() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveSecrets(list) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        // Quota exceeded / private mode / disabled storage — list is best-effort.
    }
}

/**
 * Live (unexpired) entries, newest last. Also persists the pruned list.
 *
 * @returns {SecretEntry[]}
 */
export function loadSecrets() {
    const now = Date.now();
    const all = readRaw();
    const live = all.filter((e) => e && typeof e.expiresAt === 'number' && e.expiresAt > now);
    if (typeof localStorage !== 'undefined' && live.length !== all.length) {
        saveSecrets(live);
    }
    return live;
}

/**
 * Forget a single local record. Does not touch the server-side secret.
 *
 * @param {string} id
 */
export function removeSecret(id) {
    if (!id || typeof localStorage === 'undefined') return;
    saveSecrets(readRaw().filter((e) => e && e.id !== id));
}

/**
 * Record a freshly created secret. Best-effort and never throws.
 *
 * @param {{id: string, kind?: 'message'|'file', durationSeconds?: number}} params
 */
export function recordSecret({id, kind = 'message', durationSeconds = 86400}) {
    if (!id || typeof localStorage === 'undefined') return;

    const createdAt = Date.now();
    const entry = {
        id,
        kind,
        createdAt,
        expiresAt: createdAt + durationSeconds * 1000,
    };

    const list = loadSecrets().filter((e) => e && e.id !== id);
    list.push(entry);
    saveSecrets(list.length > MAX_ENTRIES ? list.slice(list.length - MAX_ENTRIES) : list);
}
