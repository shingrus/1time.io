import {isBlogEnabled, siteHostDefault} from '../utils/siteConfig';

export const dynamic = 'force-static';

// [path, priority, changefreq, lastModified]
// Update lastModified only when page content actually changes
const coreRoutes = [
    ['/', 1.0, 'weekly', '2026-04-04'],
    ['/secure-file-sharing/', 0.9, 'weekly', '2026-04-03'],
    // Password generator tools
    ['/password-generator/', 0.9, 'weekly', '2026-03-23'],
    ['/passphrase-generator/', 0.8, 'weekly', '2026-03-23'],
    ['/password-generator-12-characters/', 0.7, 'monthly', '2026-03-22'],
    ['/password-generator-14-characters/', 0.7, 'monthly', '2026-03-21'],
    ['/password-generator-15-characters/', 0.7, 'monthly', '2026-03-22'],
    ['/password-generator-16-characters/', 0.7, 'monthly', '2026-03-21'],
    ['/wifi-password-generator/', 0.8, 'weekly', '2026-03-23'],
    ['/api-key-generator/', 0.8, 'weekly', '2026-03-23'],
    ['/share-passwords-with-qr-code/', 0.7, 'weekly', '2026-03-31'],
    // About & legal
    ['/about/', 0.5, 'monthly', '2026-03-23'],
    ['/privacy/', 0.4, 'monthly', '2026-03-22'],
];

const blogRoutes = [
    ['/blog/', 0.7, 'daily', '2026-04-04'],
    ['/blog/firefox-send-alternative/', 0.6, 'monthly', '2026-04-04'],
    ['/blog/quantum-safe-password-sharing/', 0.6, 'monthly', '2026-04-01'],
    ['/blog/share-secrets-from-terminal/', 0.6, 'monthly', '2026-03-22'],
    ['/blog/hkdf-key-derivation-explained/', 0.6, 'monthly', '2026-03-21'],
    ['/blog/password-for-crypto-wallet/', 0.6, 'monthly', '2026-03-21'],
    ['/blog/bitwarden-send-alternative/', 0.6, 'monthly', '2026-03-21'],
    ['/blog/database-password-security/', 0.6, 'monthly', '2026-03-21'],
    ['/blog/secure-home-wifi-setup/', 0.6, 'monthly', '2026-03-21'],
    ['/blog/strong-email-password/', 0.6, 'monthly', '2026-03-20'],
    ['/blog/how-to-share-wifi-password/', 0.6, 'monthly', '2026-03-20'],
    ['/blog/password-pusher-alternative/', 0.6, 'monthly', '2026-03-20'],
    ['/blog/team-password-sharing/', 0.6, 'monthly', '2026-03-20'],
    ['/blog/how-to-share-api-keys/', 0.6, 'monthly', '2026-03-20'],
    ['/blog/privnote-alternative/', 0.6, 'monthly', '2026-03-19'],
    ['/blog/is-slack-safe-for-passwords/', 0.6, 'monthly', '2026-03-19'],
    ['/blog/how-to-send-passwords-over-email/', 0.6, 'monthly', '2026-03-19'],
    ['/blog/onetimesecret-alternative/', 0.6, 'monthly', '2026-03-23'],
    ['/blog/self-destructing-messages-explained/', 0.6, 'monthly', '2026-03-18'],
    ['/blog/how-to-share-passwords-securely/', 0.6, 'monthly', '2026-03-18'],
    ['/blog/stop-sending-passwords-over-slack/', 0.6, 'monthly', '2026-03-31'],
];

export default function sitemap() {
    const routes = isBlogEnabled()
        ? [...coreRoutes, ...blogRoutes]
        : coreRoutes;
    const siteUrl = `https://${process.env.NEXT_PUBLIC_SITE_HOST || siteHostDefault}`;

    return routes.map(([url, priority, changefreq, lastModified]) => ({
        url: `${siteUrl}${url}`,
        lastModified,
        changefreq,
        priority,
    }));
}
