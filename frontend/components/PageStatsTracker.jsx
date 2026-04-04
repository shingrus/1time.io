const trackerScript = `
(() => {
    const path = window.location.pathname || '/';
    const normalized = path.replace(/^\\/+/,'').replace(/\\/+$/,'');

    let page = null;
    if (!normalized) {
        page = 'home';
    } else if (normalized === 'blog' || normalized.startsWith('blog/')) {
        page = 'blog';
    } else if (
        normalized === 'passphrase-generator' ||
        normalized.includes('password') ||
        normalized === 'create-password-14-symbols' ||
        normalized === 'api-key-generator'
    ) {
        page = 'password';
    }

    if (!page) {
        return;
    }

    fetch('/api/stat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({page}),
        keepalive: true,
    }).catch(() => {});
})();
`;

export default function PageStatsTracker() {
    return <script dangerouslySetInnerHTML={{__html: trackerScript}} />;
}
