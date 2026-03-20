import {isBlogEnabled, siteHostDefault} from '../utils/siteConfig';

export const dynamic = 'force-static';

// [path, priority, lastModified]
// Update lastModified only when page content actually changes
const coreRoutes = [
    ['/', 1.0, '2025-03-19'],
    // Password generator tools (content expanded 2025-03-19)
    ['/password-generator', 0.9, '2025-03-19'],
    ['/passphrase-generator', 0.8, '2025-03-19'],
    ['/password-generator-14-characters', 0.8, '2025-03-19'],
    ['/password-generator-16-characters', 0.8, '2025-03-19'],
    ['/wifi-password-generator', 0.8, '2025-03-19'],
    ['/api-key-generator', 0.8, '2025-03-19'],
    // About
    ['/about', 0.5, '2025-01-01'],
];

const blogRoutes = [
    ['/blog', 0.8, '2025-03-19'],
    ['/blog/hkdf-key-derivation-explained', 0.8, '2025-02-01'],
    ['/blog/password-for-crypto-wallet', 0.8, '2025-02-01'],
    ['/blog/database-password-security', 0.8, '2025-02-01'],
    ['/blog/secure-home-wifi-setup', 0.8, '2025-02-01'],
    ['/blog/strong-email-password', 0.8, '2025-02-01'],
    ['/blog/team-password-sharing', 0.8, '2025-02-01'],
    ['/blog/is-slack-safe-for-passwords', 0.8, '2025-02-01'],
    ['/blog/how-to-send-passwords-over-email', 0.8, '2025-02-01'],
    ['/blog/how-to-share-api-keys', 0.8, '2025-02-01'],
    ['/blog/how-to-share-wifi-password', 0.8, '2025-02-01'],
    ['/blog/how-to-share-passwords-securely', 0.8, '2025-02-01'],
    ['/blog/self-destructing-messages-explained', 0.8, '2025-02-01'],
    ['/blog/onetimesecret-alternative', 0.8, '2025-02-01'],
    ['/blog/bitwarden-send-alternative', 0.8, '2025-02-01'],
    ['/blog/privnote-alternative', 0.8, '2025-02-01'],
    ['/blog/password-pusher-alternative', 0.8, '2025-02-01'],
];

export default function sitemap() {
    const routes = isBlogEnabled()
        ? [...coreRoutes, ...blogRoutes]
        : coreRoutes;
    const siteUrl = `https://${process.env.NEXT_PUBLIC_SITE_HOST || siteHostDefault}`;

    return routes.map(([url, priority, lastModified]) => ({
        url: `${siteUrl}${url}`,
        lastModified,
        priority,
    }));
}
