import {normalizeOrigin} from './protocol.mjs';
import {SettingsDefaults} from './settings.mjs';

const hostInput = document.getElementById('host');
const status = document.getElementById('status');

function showStatus(text, ok) {
    status.textContent = text;
    status.className = ok ? 'ok' : 'error';
}

const {host} = await chrome.storage.sync.get(SettingsDefaults);
hostInput.value = host;

const commands = await chrome.commands.getAll();
const shareCommand = commands.find((command) => command.name === 'share-selection');
if (shareCommand?.shortcut) {
    document.getElementById('shortcut').textContent = shareCommand.shortcut;
}

document.getElementById('save').addEventListener('click', async () => {
    let origin;
    try {
        origin = normalizeOrigin(hostInput.value);
    } catch (error) {
        showStatus(error.message, false);
        return;
    }

    const granted = await chrome.permissions.request({origins: [`${origin}/*`]});
    if (!granted) {
        showStatus(`Permission for ${origin} was declined.`, false);
        return;
    }

    await chrome.storage.sync.set({host: origin});
    hostInput.value = origin;
    showStatus('Saved.', true);
});

document.getElementById('edit-shortcut').addEventListener('click', () => {
    chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
});
