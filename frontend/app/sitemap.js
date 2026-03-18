const LAST_MODIFIED = '2026-03-18';
const SITE_URL = 'https://onetimelink.me';

export const dynamic = 'force-static';

const routes = [
    ['/', 1.0],
    // Password generator tools
    ['/password-generator', 0.9],
    ['/strong-password-generator', 0.8],
    ['/secure-password-generator', 0.8],
    ['/create-password-14-symbols', 0.8],
    ['/password-generator-16-characters', 0.8],
    ['/random-password-generator', 0.8],
    ['/passphrase-generator', 0.8],
    ['/wifi-password-generator', 0.8],
    ['/api-key-generator', 0.8],
    // Blog
    ['/blog', 0.8],
    ['/blog/hkdf-key-derivation-explained', 0.8],
    ['/blog/password-for-crypto-wallet', 0.8],
    ['/blog/database-password-security', 0.8],
    ['/blog/secure-home-wifi-setup', 0.8],
    ['/blog/strong-email-password', 0.8],
    ['/blog/team-password-sharing', 0.8],
    ['/blog/is-slack-safe-for-passwords', 0.8],
    ['/blog/how-to-send-passwords-over-email', 0.8],
    ['/blog/how-to-share-api-keys', 0.8],
    ['/blog/how-to-share-wifi-password', 0.8],
    ['/blog/how-to-share-passwords-securely', 0.8],
    ['/blog/self-destructing-messages-explained', 0.8],
    ['/blog/onetimesecret-alternative', 0.8],
    ['/blog/bitwarden-send-alternative', 0.8],
    ['/blog/privnote-alternative', 0.8],
    ['/blog/password-pusher-alternative', 0.8],
    // About
    ['/about', 0.5],
];

export default function sitemap() {
    return routes.map(([url, priority]) => ({
        url: `${SITE_URL}${url}`,
        lastModified: LAST_MODIFIED,
        priority,
    }));
}
