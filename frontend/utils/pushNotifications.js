import {Constants} from './util';

let vapidPublicKey = '';
const unavailableHint = 'Notifications unavailable in this browser.';

export async function loadPushConfig() {
    try {
        const response = await fetch(`${Constants.apiBaseUrl}frontConfig`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: '{}',
        });

        if (!response.ok) {
            return getPushControlState();
        }

        const config = await response.json();
        vapidPublicKey = typeof config.vapidPublicKey === 'string'
            ? config.vapidPublicKey.trim()
            : '';
    } catch (error) {
        vapidPublicKey = '';
    }

    return getPushControlState();
}

export function getPushControlState() {
    if (!vapidPublicKey) {
        return {
            isConfigured: false,
            isDisabled: true,
            hint: '',
        };
    }

    if (typeof window === 'undefined') {
        return {
            isConfigured: true,
            isDisabled: false,
            hint: '',
        };
    }

    if (!window.isSecureContext) {
        return {
            isConfigured: true,
            isDisabled: true,
            hint: unavailableHint,
        };
    }

    if (
        !('Notification' in window) ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
    ) {
        return {
            isConfigured: true,
            isDisabled: true,
            hint: unavailableHint,
        };
    }

    if (Notification.permission === 'denied') {
        return {
            isConfigured: true,
            isDisabled: true,
            hint: 'Notifications are blocked in this browser.',
        };
    }

    return {
        isConfigured: true,
        isDisabled: false,
        hint: '',
    };
}

export async function subscribeForReadNotifications() {
    const state = getPushControlState();
    if (state.isDisabled) {
        throw new Error(state.hint || 'Notifications are unavailable.');
    }

    let permission = Notification.permission;
    if (permission !== 'granted') {
        permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
        throw new Error('Notifications are blocked in this browser.');
    }

    const registration = await getServiceWorkerRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
    }

    return serializePushSubscription(subscription);
}

async function getServiceWorkerRegistration() {
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', {scope: '/'});
    }

    return navigator.serviceWorker.ready;
}

function serializePushSubscription(subscription) {
    const json = subscription.toJSON();
    return {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || '',
    };
}

function urlBase64ToUint8Array(value) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index += 1) {
        output[index] = raw.charCodeAt(index);
    }

    return output;
}
