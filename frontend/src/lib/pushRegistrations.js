/**
 * Service worker registration bookkeeping for read notifications.
 *
 * Split from pushNotifications.js so a page that only needs to *remove*
 * registrations — the My Secrets off switch — does not load the subscribe code,
 * the notification control, and their markup. That was 4.2 KB on a page whose
 * whole preload set is otherwise 2.4 KB.
 *
 * Deliberately imports nothing, so it stays safe to import statically from
 * anywhere. See the same reasoning at the top of islands/mySecrets.ts.
 */

/** One registration per secret, so each gets its own push endpoint. */
const SCOPE_PREFIX = '/push/';

export function scopeFor(id) {
    return `${SCOPE_PREFIX}${id}/`;
}

/**
 * Turn notifications off for one secret.
 *
 * Unsubscribing invalidates the endpoint, so the next send gets 410 Gone from
 * the push service and the server drops its copy. No API call is needed to undo
 * an subscribing.
 *
 * @param {string} id
 */
export async function unsubscribeFromUpdates(id) {
    if (!id || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.getRegistration(scopeFor(id));
        if (!registration) return;

        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
        }
        await registration.unregister();
    } catch {
        // Best-effort: a stale registration is swept on a later visit.
    }
}

/**
 * Drop registrations for secrets no longer in the live list.
 *
 * A sender posting twenty links a day would otherwise accumulate twenty dead
 * registrations a day. The worker cannot clean up after itself — unregistering
 * inside a push handler risks clearing the notification it just raised — so the
 * page does it instead. Passing an empty list removes every one, which is what
 * the My Secrets off switch wants.
 *
 * @param {Set<string>|string[]} liveIds
 */
export async function sweepStaleRegistrations(liveIds) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const live = liveIds instanceof Set ? liveIds : new Set(liveIds);

    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
            registrations.map(async (registration) => {
                const {pathname} = new URL(registration.scope);
                if (!pathname.startsWith(SCOPE_PREFIX)) return;

                const id = pathname.slice(SCOPE_PREFIX.length).replace(/\/$/, '');
                if (!id || live.has(id)) return;

                const subscription = await registration.pushManager.getSubscription().catch(() => null);
                if (subscription) {
                    await subscription.unsubscribe().catch(() => {});
                }
                await registration.unregister().catch(() => {});
            }),
        );
    } catch {
        // Nothing here is worth surfacing to the sender.
    }
}
