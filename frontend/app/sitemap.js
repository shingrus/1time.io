const LAST_MODIFIED = '2026-03-18';
const SITE_URL = 'https://onetimelink.me';

export const dynamic = 'force-static';

const routes = [
    ['/', 1.0],
    ['/password-generator', 0.9],
    ['/strong-password-generator', 0.8],
    ['/create-password-14-symbols', 0.8],
    ['/random-password-generator', 0.8],
    ['/passphrase-generator', 0.8],
    ['/about', 0.5],
    ['/blog', 0.8],
    ['/blog/how-to-share-passwords-securely', 0.8],
    ['/blog/self-destructing-messages-explained', 0.8],
    ['/blog/onetimesecret-alternative', 0.8],
];

export default function sitemap() {
    return routes.map(([url, priority]) => ({
        url: `${SITE_URL}${url}`,
        lastModified: LAST_MODIFIED,
        priority,
    }));
}
