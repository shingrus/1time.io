import type {APIRoute} from 'astro';
import {absoluteUrl, isBlogEnabled} from '../lib/siteConfig.js';

interface RouteEntry {
    path: string;
    priority: number;
    changefreq: string;
    lastmod: string;
}

const coreRoutes: RouteEntry[] = [
    {path: '/', priority: 1.0, changefreq: 'weekly', lastmod: '2026-04-14'},
    {path: '/secure-file-sharing/', priority: 0.9, changefreq: 'weekly', lastmod: '2026-04-03'},
    {path: '/password-generator/', priority: 0.9, changefreq: 'weekly', lastmod: '2026-03-23'},
    {path: '/passphrase-generator/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-03-23'},
    {path: '/password-generator-12-characters/', priority: 0.7, changefreq: 'monthly', lastmod: '2026-03-22'},
    {path: '/password-generator-14-characters/', priority: 0.7, changefreq: 'monthly', lastmod: '2026-03-21'},
    {path: '/password-generator-15-characters/', priority: 0.7, changefreq: 'monthly', lastmod: '2026-03-22'},
    {path: '/password-generator-16-characters/', priority: 0.7, changefreq: 'monthly', lastmod: '2026-03-21'},
    {path: '/wifi-password-generator/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-03-23'},
    {path: '/api-key-generator/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-03-23'},
    {path: '/share-password-securely/', priority: 0.9, changefreq: 'weekly', lastmod: '2026-04-05'},
    {path: '/share-passwords-with-qr-code/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-03-31'},
    {path: '/share-passwords-microsoft-teams/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-04-20'},
    {path: '/about/', priority: 0.5, changefreq: 'monthly', lastmod: '2026-05-23'},
    {path: '/privacy/', priority: 0.4, changefreq: 'monthly', lastmod: '2026-03-22'},
];

const blogRoutes: RouteEntry[] = [
    {path: '/blog/', priority: 0.7, changefreq: 'daily', lastmod: '2026-05-23'},
    {path: '/blog/firefox-send-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-05-23'},
    {path: '/blog/quantum-safe-password-sharing/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-04-01'},
    {path: '/blog/share-secrets-from-terminal/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-22'},
    {path: '/blog/hkdf-key-derivation-explained/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-05-23'},
    {path: '/blog/password-for-crypto-wallet/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-21'},
    {path: '/blog/bitwarden-send-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-05-23'},
    {path: '/blog/database-password-security/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-21'},
    {path: '/blog/secure-home-wifi-setup/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-21'},
    {path: '/blog/strong-email-password/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-20'},
    {path: '/blog/how-to-share-wifi-password/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-20'},
    {path: '/blog/password-pusher-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-05-23'},
    {path: '/blog/team-password-sharing/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-04-17'},
    {path: '/blog/how-to-share-api-keys/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-20'},
    {path: '/blog/privnote-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-04-17'},
    {path: '/blog/is-slack-safe-for-passwords/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-19'},
    {path: '/blog/how-to-send-passwords-over-email/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-19'},
    {path: '/blog/onetimesecret-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-04-17'},
    {path: '/blog/self-destructing-messages-explained/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-04-14'},
    {path: '/blog/how-to-share-passwords-securely/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-04-14'},
    {path: '/blog/stop-sending-passwords-over-slack/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-31'},
];

export const GET: APIRoute = () => {
    const routes = isBlogEnabled() ? [...coreRoutes, ...blogRoutes] : coreRoutes;
    const urls = routes.map((r) => (
        `  <url>\n` +
        `    <loc>${absoluteUrl(r.path)}</loc>\n` +
        `    <lastmod>${r.lastmod}</lastmod>\n` +
        `    <changefreq>${r.changefreq}</changefreq>\n` +
        `    <priority>${r.priority.toFixed(1)}</priority>\n` +
        `  </url>`
    )).join('\n');

    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

    return new Response(body, {
        headers: {'Content-Type': 'application/xml'},
    });
};
