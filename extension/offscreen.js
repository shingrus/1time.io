// Writes text to the clipboard from an extension-owned document, so the secret
// link never touches any web page's DOM. execCommand('copy') works here without
// a user gesture — unlike navigator.clipboard from a background context — and
// this document is not shared with any page.
const clipboard = document.getElementById('clipboard');

function writeToClipboard(text) {
    clipboard.value = text;
    clipboard.select();
    const copied = document.execCommand('copy');
    clipboard.value = ''; // don't retain the secret in this document either

    return copied;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target !== 'offscreen' || message.type !== 'copy') {
        return;
    }

    sendResponse(writeToClipboard(message.data));
});
