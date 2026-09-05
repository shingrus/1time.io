/**
 * Tests for the push service worker.
 *
 * The worker cannot be exercised in a normal test environment — it needs a
 * `self` with a registration and a clients list — so it is bundled and then run
 * inside a vm context against a stubbed global. That tests the shipped artifact,
 * including the bundled copy of `nameForId`, rather than the source module.
 *
 *   node --test test/
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

import {buildPushWorker} from '../scripts/build-push-sw.mjs';
import {nameForId} from '../src/lib/secretName.js';

const ID = 'Jk3nQpZr8sT2vW9xY1aB4c';
const NAME = nameForId(ID);

const workerSource = await (async () => {
    const dir = await mkdtemp(path.join(tmpdir(), '1time-sw-'));
    const outfile = await buildPushWorker(path.join(dir, 'push-sw.js'));
    return readFile(outfile, 'utf8');
})();

/** Load the bundle against a stubbed service-worker global. */
function loadWorker() {
    const listeners = {};
    const shown = [];
    const self = {
        location: {origin: 'https://1time.io'},
        addEventListener: (type, fn) => {
            listeners[type] = fn;
        },
        registration: {
            showNotification: (title, options) => {
                shown.push({title, options});
                return Promise.resolve();
            },
        },
        clients: {
            matchAll: async () => [],
            openWindow: async () => {},
        },
    };
    vm.runInContext(workerSource, vm.createContext({self, Date, Math, Number, JSON, URL, console}));
    return {listeners, shown, self};
}

/** Deliver one push and return what the worker would display. */
async function push(payload) {
    const worker = loadWorker();
    let pending;
    worker.listeners.push({
        data: payload === null ? null : {json: () => payload},
        waitUntil: (promise) => {
            pending = promise;
        },
    });
    await pending;
    assert.equal(worker.shown.length, 1, 'exactly one notification per push');
    return worker.shown[0];
}

const now = () => Math.floor(Date.now() / 1000);

test('a read message names the secret and says when', async () => {
    const {title, options} = await push({id: ID, kind: 'message', viewsLeft: 0, readAt: now()});

    assert.equal(title, `${NAME} was viewed`);
    assert.equal(options.body, 'Just now');
    // "opened" reads as the notification having been opened; the app's own word
    // for this is "view".
    assert.ok(!title.includes('opened'));
});

test('a downloaded file uses the file vocabulary', async () => {
    const {title, options} = await push({id: ID, kind: 'file', viewsLeft: 2, readAt: now()});

    assert.equal(title, `${NAME} was downloaded`);
    assert.equal(options.body, 'Just now · 2 downloads left');
});

test('a late delivery reports elapsed time, not "just now"', async () => {
    // Push services are store-and-forward: this is the case where a sender wakes
    // a laptop and learns about a read from last night.
    const threeHours = await push({id: ID, kind: 'message', viewsLeft: 0, readAt: now() - 3 * 3600});
    assert.equal(threeHours.options.body, '3 hours ago');

    const twoDays = await push({id: ID, kind: 'message', viewsLeft: 0, readAt: now() - 2 * 86400});
    assert.equal(twoDays.options.body, '2 days ago');

    const nineMinutes = await push({id: ID, kind: 'message', viewsLeft: 0, readAt: now() - 9 * 60});
    assert.equal(nineMinutes.options.body, '9 minutes ago');
});

test('a skewed device clock does not report a read in the future', async () => {
    const {options} = await push({id: ID, kind: 'message', viewsLeft: 0, readAt: now() + 600});
    assert.equal(options.body, 'Just now');
});

test('remaining reads appear only when there are any', async () => {
    const oneTime = await push({id: ID, kind: 'message', viewsLeft: 0, readAt: now()});
    assert.equal(oneTime.options.body, 'Just now', 'a one-time secret must not say "0 views left"');

    const singular = await push({id: ID, kind: 'message', viewsLeft: 1, readAt: now()});
    assert.equal(singular.options.body, 'Just now · 1 view left');

    const plural = await push({id: ID, kind: 'message', viewsLeft: 3, readAt: now()});
    assert.equal(plural.options.body, 'Just now · 3 views left');
});

test('repeat reads of one secret collapse instead of stacking', async () => {
    const first = await push({id: ID, kind: 'message', viewsLeft: 2, readAt: now()});
    const second = await push({id: ID, kind: 'message', viewsLeft: 1, readAt: now()});

    assert.equal(first.options.tag, ID);
    assert.equal(second.options.tag, ID, 'the same tag replaces the earlier notification');
    assert.equal(second.options.renotify, true, 'a replacement must not be silent');
});

test('a malformed payload still shows something', async () => {
    // userVisibleOnly means a push that displays nothing eventually costs us the
    // subscription, so there is no early return on a payload we cannot parse.
    const {title, options} = await push(null);

    assert.equal(title, 'Your secret was viewed');
    assert.equal(options.tag, 'secret-read');
});

test('the payload carries no human-readable label', async () => {
    // The name is derived locally from the id, so nothing resembling a title
    // ever passes through the push service.
    const {title} = await push({id: ID, kind: 'message', viewsLeft: 0, readAt: now()});

    assert.ok(title.startsWith(NAME), 'the name must be derived from the id, not sent');
    assert.notEqual(NAME, '');
});

test('clicking opens the /pn redirect when no window is open', async () => {
    const worker = loadWorker();
    let opened = null;
    let closed = false;
    let pending;
    worker.self.clients.openWindow = async (url) => {
        opened = url;
    };

    worker.listeners.notificationclick({
        notification: {
            close: () => {
                closed = true;
            },
            data: {id: ID},
        },
        waitUntil: (promise) => {
            pending = promise;
        },
    });
    await pending;

    // /pn rather than /my-secrets/ directly: it 302s to the same place, and the
    // hop is what makes a notification click countable in the access log.
    //
    // Absolute rather than relative, because Safari does not resolve a relative
    // openWindow URL against the worker's origin.
    assert.equal(opened, 'https://1time.io/pn');
    assert.equal(closed, true);
});

test('clicking focuses an existing My Secrets tab rather than opening another', async () => {
    const worker = loadWorker();
    let focused = null;
    let opened = null;
    let pending;

    // matchAll needs includeUncontrolled, since this worker controls no page.
    // Without it the list is empty and every click opens a redundant window.
    let matchAllOptions = null;
    worker.self.clients.matchAll = async (options) => {
        matchAllOptions = options;
        return [
            {url: 'https://1time.io/password-generator', focus: () => (focused = 'wrong tab')},
            {url: 'https://1time.io/my-secrets/', focus: () => (focused = 'my-secrets')},
        ];
    };
    worker.self.clients.openWindow = async (url) => (opened = url);

    worker.listeners.notificationclick({
        notification: {close: () => {}, data: {id: ID}},
        waitUntil: (promise) => {
            pending = promise;
        },
    });
    await pending;

    assert.equal(focused, 'my-secrets');
    assert.equal(opened, null);
    assert.equal(matchAllOptions.includeUncontrolled, true);
});
