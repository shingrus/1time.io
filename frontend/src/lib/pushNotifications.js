import {postJson} from './util.js';

const BLOCKED_HINT = 'Notifications are blocked in this browser.';
const ENABLING_HINT = 'Enabling notifications...';
const UNAVAILABLE_HINT = 'Notifications unavailable in this browser.';

function isPushSupported() {
    return (
        typeof window !== 'undefined' &&
        typeof Notification !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        window.isSecureContext
    );
}

function decodeBase64Url(value) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function serializePushSubscription(subscription) {
    const json = subscription.toJSON();
    const keys = json.keys || {};
    if (!json.endpoint || !keys.p256dh || !keys.auth) {
        return null;
    }
    return {
        endpoint: json.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
    };
}

export function attachReadNotificationControls(form) {
    const label = form.querySelector('[data-notify-label]');
    const checkbox = form.querySelector('[data-notify-checkbox]');
    const hint = form.querySelector('[data-notify-hint]');

    if (!label || !checkbox || !hint) {
        return {
            async getPushSubscription() {
                return null;
            },
            reset() {},
        };
    }

    const supported = isPushSupported();
    let vapidPublicKey = '';
    let isPreparingPush = false;
    let isAvailable = false;
    let configLoaded = false;
    let configPromise;

    const render = () => {
        const isBlocked = supported && Notification.permission === 'denied';
        const isDisabled = isPreparingPush || !isAvailable || isBlocked;

        checkbox.disabled = isDisabled;
        if (isBlocked || !isAvailable) {
            checkbox.checked = false;
        }
        label.classList.toggle('notify-option-label-disabled', isDisabled);

        let nextHint = '';
        if (isPreparingPush) {
            nextHint = ENABLING_HINT;
        } else if (isBlocked) {
            nextHint = BLOCKED_HINT;
        } else if (configLoaded && !isAvailable) {
            nextHint = UNAVAILABLE_HINT;
        }

        hint.textContent = nextHint;
        hint.toggleAttribute('hidden', !nextHint);
    };

    const loadConfig = async () => {
        if (configPromise) {
            return configPromise;
        }

        configPromise = (async () => {
            if (!supported) {
                configLoaded = true;
                render();
                return;
            }

            try {
                const data = await postJson('frontConfig', {});
                vapidPublicKey = typeof data?.vapidPublicKey === 'string' ? data.vapidPublicKey.trim() : '';
                isAvailable = vapidPublicKey !== '';
            } catch {
                isAvailable = false;
            }

            configLoaded = true;
            render();
        })();

        return configPromise;
    };

    render();
    void loadConfig();

    return {
        async getPushSubscription() {
            if (!checkbox.checked) {
                return null;
            }

            await loadConfig();
            if (!checkbox.checked || !isAvailable || !supported) {
                return null;
            }

            if (Notification.permission === 'denied') {
                render();
                return null;
            }

            isPreparingPush = true;
            render();

            try {
                const permission = Notification.permission === 'granted'
                    ? 'granted'
                    : await Notification.requestPermission();
                if (permission !== 'granted') {
                    return null;
                }

                const registration = await navigator.serviceWorker.register('/sw.js');
                const existingSubscription = await registration.pushManager.getSubscription();
                const subscription = existingSubscription || await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: decodeBase64Url(vapidPublicKey),
                });

                return serializePushSubscription(subscription);
            } catch {
                return null;
            } finally {
                isPreparingPush = false;
                render();
            }
        },
        reset() {
            checkbox.checked = false;
            render();
        },
    };
}
