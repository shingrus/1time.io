/**
 * Push mailbox for one secret.
 *
 * Registered once per secret at scope `/push/<id>/`, so each secret gets its own
 * registration and therefore its own push endpoint. That is what keeps the
 * server from holding anything that links a sender's secrets to each other — one
 * worker at `/` would reuse a single endpoint for every secret this browser ever
 * creates.
 *
 * Nothing is ever served from that scope, so this worker controls no page and
 * intercepts no fetch. It exists only to receive pushes.
 *
 * Built to `public/push-sw.js` by scripts/build-push-sw.mjs — edit this file,
 * never the generated one.
 */
import {nameForId} from '../lib/secretName.js';

// Matches the vocabulary the link-ready screen used when the secret was created:
// `showLinkReady` says "view" for a message and "download" for a file. "Opened"
// is avoided on purpose — on a notification it reads as the notification itself
// having been opened.
const ACTIONS = {
    message: {verb: 'viewed', noun: 'view'},
    file: {verb: 'downloaded', noun: 'download'},
};

const FALLBACK_TITLE = 'Your secret was viewed';
const SECRETS_PATH = '/my-secrets';

/**
 * Elapsed time as a phrase, from a Unix timestamp.
 *
 * Push services are store-and-forward: a notification for a secret read last
 * night arrives when the laptop wakes. Saying "just now" then would be a lie
 * about the one fact the sender cares about.
 *
 * A duration needs no time zone, which is why the payload carries a timestamp
 * rather than a formatted time.
 */
function describeElapsed(readAt) {
    if (!Number.isFinite(readAt) || readAt <= 0) {
        return '';
    }

    const seconds = Math.floor(Date.now() / 1000) - readAt;
    // Negative means a skewed device clock, not a read in the future.
    if (seconds < 60) {
        return 'Just now';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Remaining reads, rendered only when there are any — a one-time secret would
 * otherwise carry a permanent, meaningless "0 views left".
 */
function describeRemaining(viewsLeft, noun) {
    if (!Number.isInteger(viewsLeft) || viewsLeft <= 0) {
        return '';
    }

    return `${viewsLeft} ${noun}${viewsLeft === 1 ? '' : 's'} left`;
}

function readPayload(event) {
    if (!event.data) {
        return null;
    }
    try {
        return event.data.json();
    } catch {
        // Nothing usable, but a notification must still be shown.
        return null;
    }
}

self.addEventListener('push', (event) => {
    const payload = readPayload(event) || {};
    const id = typeof payload.id === 'string' ? payload.id : '';
    const action = ACTIONS[payload.kind] || ACTIONS.message;

    // Derived locally from the id, which is why no human-readable label ever
    // travels through the push service.
    const name = nameForId(id);
    const title = name ? `${name} was ${action.verb}` : FALLBACK_TITLE;
    const body = [describeElapsed(payload.readAt), describeRemaining(payload.viewsLeft, action.noun)]
        .filter(Boolean)
        .join(' · ');

    // userVisibleOnly means a push that shows nothing eventually costs us the
    // subscription, so this runs even for a payload we could not parse.
    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            // One notification per secret: later reads of a multi-view secret
            // replace the previous one instead of stacking, and the survivor is
            // always the most current.
            tag: id || 'secret-read',
            renotify: true,
            icon: '/web-app-manifest-192x192.png',
            badge: '/favicon-96x96.png',
            data: {id},
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        (async () => {
            // includeUncontrolled is required: this worker controls no pages, so
            // without it matchAll returns nothing and every click opens a
            // redundant window.
            // Absolute, not relative. The spec says openWindow resolves against
            // the worker's URL, but Safari does not do so reliably and simply
            // opens nothing.
            const target = new URL(`${SECRETS_PATH}/`, self.location.origin).href;

            const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
            const open = windows.find((client) => new URL(client.url).pathname.startsWith(SECRETS_PATH));

            if (open) {
                try {
                    return await open.focus();
                } catch {
                    // Safari can reject focus(); opening a window still works.
                }
            }
            return self.clients.openWindow(target);
        })(),
    );
});
