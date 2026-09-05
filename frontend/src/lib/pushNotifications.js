/**
 * Subscribing browser push notifications for a secret the sender just created.
 *
 * Loaded only from the link-ready state, never from a page bundle: the main page
 * ships nothing for this feature.
 *
 * Each secret gets its own service worker registration at `/push/<id>/`, which
 * gives it its own push endpoint. One worker at `/` would reuse a single
 * endpoint for every secret this browser creates, handing the server a durable
 * identifier that links a sender's secrets to each other.
 */
// No util.js import, deliberately. Reaching for postJson would pull in util, and
// util statically imports protocol.mjs — so any page importing this module would
// load the whole AES/HKDF bundle. See the same reasoning at the top of
// islands/mySecrets.ts. The two modules below import nothing themselves, so they
// cost their own size and drag in no bundle.
//
// Both are static rather than dynamic: one extra dynamic-import site was enough
// to make Rollup split out Vite's preload helper and put an extra request on
// every page in the site.
import {loadSecrets, notificationsOptedOut, setNotificationsOptedOut} from './mySecrets.js';
// Registration bookkeeping lives apart so the My Secrets off switch can import
// just that, without the subscribe code and the control markup below.
import {unsubscribeFromUpdates, scopeFor, sweepStaleRegistrations} from './pushRegistrations.js';

const API_BASE = import.meta.env.PUBLIC_API_URL || '/api/';

const WORKER_URL = '/push-sw.js';

/**
 * Outcomes the caller renders. They are deliberately distinct: telling a sender
 * "you'll be notified" when nothing was subscribed is worse than telling them
 * nothing, because they will read silence as "never opened".
 *
 * @typedef {'subscribed'|'gone'|'denied'|'unavailable'|'failed'} SubscribeResult
 */

/**
 * iOS and iPadOS expose Web Push only to a web app installed on the Home
 * Screen, never to an ordinary Safari tab. Checked explicitly rather than left
 * to the API sniffing below, so a Safari release that starts exposing the
 * interfaces in a tab cannot put a control on screen that could only fail.
 */
function iosOutsideHomeScreen() {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;

    // iPadOS reports a Macintosh user agent, so touch points are what separate
    // it from a desktop Mac, where maxTouchPoints is 0.
    const isApplePhoneOrTablet =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    if (!isApplePhoneOrTablet) return false;

    const installed =
        window.navigator.standalone === true ||
        window.matchMedia?.('(display-mode: standalone)').matches === true;

    return !installed;
}

/**
 * Whether this browser can subscribe at all.
 *
 * `vapidPublicKey` is absent whenever the deployment has no push configured, so
 * a self-hosted instance without keys simply never offers the option.
 */
export function pushAvailable(vapidPublicKey) {
    return Boolean(
        vapidPublicKey &&
        typeof window !== 'undefined' &&
        window.isSecureContext &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        typeof Notification !== 'undefined' &&
        !iosOutsideHomeScreen(),
    );
}

/** Current permission, or 'unsupported' where the API is missing. */
export function permissionState() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
}

/**
 * base64url string to bytes. `applicationServerKey` takes a BufferSource;
 * passing the string works in Chrome but not everywhere.
 */
function decodeBase64Url(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

/**
 * POST JSON and return the parsed body, or null on any non-2xx or transport
 * failure. Subscribing has no retryable case — unlike a read, nothing is consumed —
 * so none of postJson's error-shape plumbing is needed here.
 */
async function postSubscription(payload) {
    try {
        const response = await fetch(`${API_BASE}subscribeToUpdates`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
}

/** How long to wait for a freshly registered worker to reach 'activated'. */
const ACTIVATION_TIMEOUT_MS = 10000;

/**
 * Wait until a registration has an active worker.
 *
 * `pushManager.subscribe()` requires one, and a brand-new registration is still
 * `installing` when `register()` resolves — subscribing straight away throws.
 *
 * `navigator.serviceWorker.ready` is NOT the way to wait here: it resolves for
 * the registration controlling the page, and these workers deliberately control
 * nothing, so awaiting it would hang forever.
 */
async function waitForActiveWorker(registration) {
    if (registration.active) return;

    const worker = registration.installing || registration.waiting;
    if (!worker) return;

    await new Promise((resolve) => {
        const timer = setTimeout(resolve, ACTIVATION_TIMEOUT_MS);
        const onStateChange = () => {
            if (worker.state === 'activated' || worker.state === 'redundant') {
                worker.removeEventListener('statechange', onStateChange);
                clearTimeout(timer);
                resolve();
            }
        };
        worker.addEventListener('statechange', onStateChange);
        onStateChange();
    });
}

/**
 * Ask for permission if it has not been decided, then subscribe and register the
 * subscription against the secret.
 *
 * @param {{id: string, manageToken: string, vapidPublicKey: string}} params
 * @returns {Promise<SubscribeResult>}
 */
export async function subscribeToUpdates({id, manageToken, vapidPublicKey}) {
    if (!id || !manageToken || !pushAvailable(vapidPublicKey)) {
        return 'unavailable';
    }

    let permission = Notification.permission;
    if (permission === 'default') {
        // Only ever from a click — browsers penalise unprompted requests, and
        // Chrome will quietly auto-deny for users who habitually dismiss them.
        permission = await Notification.requestPermission().catch(() => 'denied');
    }
    if (permission !== 'granted') {
        return 'denied';
    }

    try {
        const registration = await navigator.serviceWorker.register(WORKER_URL, {scope: scopeFor(id)});
        await waitForActiveWorker(registration);

        const subscription = await registration.pushManager.subscribe({
            // Mandatory in Chrome: every push must produce a visible
            // notification, so this channel cannot be used silently.
            userVisibleOnly: true,
            applicationServerKey: decodeBase64Url(vapidPublicKey),
        });

        const {endpoint, keys} = subscription.toJSON();
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            await unsubscribeFromUpdates(id);
            return 'failed';
        }

        const data = await postSubscription({
            id,
            manageToken,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
        });

        if (data && data.status === 'ok') {
            return 'subscribed';
        }

        // The recipient opened the link between creating it and subscribing. Say so
        // rather than promising a notification that can never arrive.
        if (data && data.status === 'gone') {
            await unsubscribeFromUpdates(id);
            return 'gone';
        }

        await unsubscribeFromUpdates(id);
        return 'failed';
    } catch (error) {
        // Logged rather than swallowed: without this the only symptom is a
        // "Try again" button that says nothing about what went wrong.
        console.error('[1time] could not subscribe notifications:', error);
        await unsubscribeFromUpdates(id);
        return 'failed';
    }
}

/**
 * Build the notification control on a link-ready card and wire it up.
 *
 * Lives here rather than in show-link-ready.ts because that island is preloaded
 * on every page carrying a share form: code left there is paid for by senders
 * who never subscribe anything. This module is only fetched when notifications are
 * actually available.
 *
 * Once permission has been granted the subscribing is automatic and the control
 * becomes an off switch — a sender creating twenty links a day should not have
 * to click twenty times.
 *
 * @param {HTMLElement} card the cloned link-ready section
 * @param {{id: string, isFile: boolean, manageToken: string, vapidPublicKey: string}} options
 */
export async function mountNotifyControl(card, {id, isFile, manageToken, vapidPublicKey}) {
    if (!id || !manageToken || !pushAvailable(vapidPublicKey)) return;

    // Denied is permanent until the sender changes it in site settings, and no
    // browser will re-prompt. Leave the template's "Check if it's been read"
    // link in place rather than swapping in a control that cannot work.
    if (permissionState() === 'denied') return;

    // Takes the place of the "Check if it's been read" link, which points at the
    // same destination the notification opens. Same answer, one pulled and one
    // pushed — so they are alternatives rather than two controls. Only swapped
    // once the feature is known usable; otherwise the link stays, since it is
    // then the only way to find out.
    const readLink = card.querySelector('.link-extension');
    if (!readLink) return;

    // Built here rather than in LinkReadyTemplate.astro: that template is
    // inlined into the HTML of every page carrying a share form, so markup there
    // is paid for on first render by everyone.
    const toggle = document.createElement('button');
    toggle.className = 'link-extension';
    toggle.type = 'button';

    const statusSeparator = document.createElement('span');
    statusSeparator.setAttribute('aria-hidden', 'true');
    statusSeparator.textContent = '\u00b7';
    statusSeparator.hidden = true;

    const status = document.createElement('span');
    status.className = 'link-notify-status';
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;

    readLink.replaceWith(toggle);
    toggle.after(statusSeparator, status);

    const verb = isFile ? 'downloaded' : 'viewed';
    const IDLE_LABEL = `Notify me when it's ${verb}`;

    /**
     * The control is always present once the feature is available at all. Hiding
     * it on some outcomes made the feature look absent rather than unavailable,
     * and left the sender with nothing to act on.
     */
    const render = ({label, enabled, message}) => {
        toggle.textContent = label;
        toggle.disabled = !enabled;
        status.textContent = message;
        status.hidden = !message;
        statusSeparator.hidden = !message;
    };

    let subscribed = false;

    const renderIdle = () => {
        subscribed = false;
        render({label: IDLE_LABEL, enabled: true, message: ''});
    };

    /**
     * Denied at the prompt. Restores the exact node the template rendered, so
     * the row ends up as if notifications had never been offered.
     */
    const restoreReadLink = () => {
        statusSeparator.remove();
        status.remove();
        toggle.replaceWith(readLink);
    };

    const subscribe = async () => {
        render({label: IDLE_LABEL, enabled: false, message: 'Setting up...'});

        const result = await subscribeToUpdates({id, manageToken, vapidPublicKey});

        switch (result) {
            case 'subscribed':
                // An explicit subscribe is also how the sender turns the preference
                // back on after switching it off.
                setNotificationsOptedOut(false);
                subscribed = true;
                render({label: 'Turn off', enabled: true, message: `You'll be notified when it's ${verb}`});
                // Clear out registrations for secrets that have since expired.
                // This id is included explicitly: where localStorage is
                // unavailable loadSecrets() returns nothing and the sweep would
                // unregister the subscription just confirmed.
                void sweepStaleRegistrations([id, ...loadSecrets().map((entry) => entry.id)]);
                return;
            case 'gone':
                // The recipient got there first. Never claim a notification is
                // coming when the secret is already spent.
                render({
                    label: IDLE_LABEL,
                    enabled: false,
                    message: `Already ${verb} \u2014 no notification will be sent`,
                });
                return;
            case 'denied':
                restoreReadLink();
                return;
            default:
                render({label: 'Try again', enabled: true, message: "Couldn't set up notifications"});
        }
    };

    toggle.addEventListener('click', async () => {
        if (!subscribed) {
            await subscribe();
            return;
        }

        toggle.disabled = true;
        // The switch is a per-browser preference, not a per-link one: otherwise
        // "off" would last only until the next secret, since permission is
        // already granted and the next one auto-subscribes.
        //
        // So it sweeps every registration, exactly as the My Secrets switch
        // does. Dissubscribing only this secret would leave earlier subscribed links still
        // notifying a sender who had just been told notifications were off.
        // An empty live list reads the registrations straight from the browser;
        // nothing iterates the stored secrets.
        setNotificationsOptedOut(true);
        await sweepStaleRegistrations(new Set());
        renderIdle();
    });

    if (permissionState() === 'granted' && !notificationsOptedOut()) {
        // Permission is already there and the sender has not switched
        // notifications off, so nothing needs asking. The control stays on
        // screen throughout, showing "Setting up..." rather than vanishing.
        renderIdle();
        await subscribe();
        return;
    }

    renderIdle();
}
