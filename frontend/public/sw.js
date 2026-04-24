self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    event.waitUntil(handlePush(event));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(openHome());
});

async function handlePush(event) {
    await self.registration.showNotification('Your one-time link was opened', {
        icon: '/logo-512.png',
        badge: '/logo-512.png',
    });
}

async function openHome() {
    const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
    });

    for (const client of windows) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin && 'focus' in client) {
            return client.focus();
        }
    }

    if (self.clients.openWindow) {
        return self.clients.openWindow('/');
    }

    return undefined;
}
