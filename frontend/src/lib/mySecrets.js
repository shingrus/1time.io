/**
 * Browser-local list for My Secrets.
 * Stores only id, kind, view allowance and timestamps; never plaintext, keys,
 * or human labels.
 * Expired entries are pruned locally before status checks.
 */
const STORAGE_KEY = '1time.secretsList.v1';
const MAX_ENTRIES = 128;

/**
 * @typedef {Object} SecretEntry
 * @property {string} id          Server storage id (locates the secret).
 * @property {'message'|'file'} kind
 * @property {number} [views]     View allowance chosen at send time; absent on
 *                                entries written before this was recorded.
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

const NOTIFY_OPT_OUT_KEY = '1time.notifications.off.v1';

/**
 * Whether the sender has switched read notifications off for this browser.
 *
 * Checked before the auto-subscribe path: once permission is granted every new secret
 * would otherwise subscribe itself, so turning one off would last exactly until the
 * next link.
 */
export function notificationsOptedOut() {
    try {
        return localStorage.getItem(NOTIFY_OPT_OUT_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * @param {boolean} optedOut
 */
export function setNotificationsOptedOut(optedOut) {
    try {
        if (optedOut) {
            localStorage.setItem(NOTIFY_OPT_OUT_KEY, '1');
        } else {
            localStorage.removeItem(NOTIFY_OPT_OUT_KEY);
        }
    } catch {
        // Private mode or disabled storage — the preference is best-effort.
    }
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
 * The manage token is deliberately NOT kept here. Subscribing a notification takes it
 * straight from the save response while the link-ready screen is open, and
 * nothing reads it back afterwards — storing a capability no one uses only
 * widens what a stolen localStorage yields. Subscribing an older secret from My
 * Secrets would need it; that feature does not exist.
 *
 * @param {{id: string, kind?: 'message'|'file', durationSeconds?: number, views?: number}} params
 */
export function recordSecret({id, kind = 'message', durationSeconds = 86400, views = 1}) {
    if (!id || typeof localStorage === 'undefined') return;

    const createdAt = Date.now();
    const entry = {
        id,
        kind,
        views,
        createdAt,
        expiresAt: createdAt + durationSeconds * 1000,
    };

    const list = loadSecrets().filter((e) => e && e.id !== id);
    list.push(entry);
    saveSecrets(list.length > MAX_ENTRIES ? list.slice(list.length - MAX_ENTRIES) : list);
}
