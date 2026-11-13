import type {APIRoute} from 'astro';
import {absoluteUrl} from '../lib/siteConfig.js';

interface RouteEntry {
    path: string;
    priority: number;
    changefreq: string;
    lastmod: string;
}

const coreRoutes: RouteEntry[] = [
    {path: '/', priority: 1.0, changefreq: 'weekly', lastmod: '2026-11-05'},
    {path: '/secure-file-sharing/', priority: 0.9, changefreq: 'weekly', lastmod: '2026-11-12'},
    {path: '/chrome-extension/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-07-23'},
    {path: '/developers/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-09-16'},
    {path: '/self-hosted/', priority: 0.8, changefreq: 'monthly', lastmod: '2026-11-13'},
    {path: '/password-generator/', priority: 0.9, changefreq: 'weekly', lastmod: '2026-03-23'},
    {path: '/passphrase-generator/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-08-05'},
    {path: '/password-generator-12-characters/', priority: 0.7, changefreq: 'monthly', lastmod: '2026-03-22'},
    {path: '/password-generator-14-characters/', priority: 0.7, changefreq: 'monthly', lastmod: '2026-03-21'},
    {path: '/password-generator-15-characters/', priority: 0.7, changefreq: 'monthly', lastmod: '2026-10-05'},
    {path: '/password-generator-16-characters/', priority: 0.7, changefreq: 'monthly', lastmod: '2026-09-26'},
    {path: '/wifi-password-generator/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-07-15'},
    {path: '/api-key-generator/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-09-26'},
    {path: '/share-password-securely/', priority: 0.9, changefreq: 'weekly', lastmod: '2026-10-24'},
    {path: '/share-passwords-with-qr-code/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-03-31'},
    {path: '/share-passwords-microsoft-teams/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-10-24'},
    {path: '/about/', priority: 0.5, changefreq: 'monthly', lastmod: '2026-05-23'},
    {path: '/no-cookie-banner/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-08-27'},
    {path: '/privacy/', priority: 0.4, changefreq: 'monthly', lastmod: '2026-10-11'},
    {path: '/es/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-11-06'},
    {path: '/es/compartir-contrasena/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-06'},
    {path: '/es/compartir-archivos/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-06'},
    {path: '/fr/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-11-07'},
    {path: '/fr/envoyer-mot-de-passe/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-07'},
    {path: '/fr/envoyer-fichier-securise/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-07'},
    {path: '/ja/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-11-07'},
    {path: '/ja/password/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-07'},
    {path: '/ja/file/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-07'},
    {path: '/id/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-11-07'},
    {path: '/id/kirim-password/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-07'},
    {path: '/id/kirim-file/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-07'},
    {path: '/de/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-11-10'},
    {path: '/de/passwort-sicher-versenden/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-10'},
    {path: '/de/dateien-sicher-versenden/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-10'},
    {path: '/pt/', priority: 0.8, changefreq: 'weekly', lastmod: '2026-11-10'},
    {path: '/pt/enviar-senha/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-10'},
    {path: '/pt/enviar-arquivos/', priority: 0.7, changefreq: 'weekly', lastmod: '2026-11-10'},
];

const blogRoutes: RouteEntry[] = [
    {path: '/blog/', priority: 0.7, changefreq: 'daily', lastmod: '2026-10-24'},
    {path: '/blog/firefox-send-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-10-14'},
    {path: '/blog/quantum-safe-password-sharing/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-04-01'},
    {path: '/blog/share-secrets-from-terminal/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-22'},
    {path: '/blog/hkdf-key-derivation-explained/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-05-23'},
    {path: '/blog/password-for-crypto-wallet/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-21'},
    {path: '/blog/bitwarden-send-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-10-14'},
    {path: '/blog/database-password-security/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-21'},
    {path: '/blog/secure-home-wifi-setup/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-21'},
    {path: '/blog/strong-email-password/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-20'},
    {path: '/blog/password-pusher-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-07-26'},
    {path: '/blog/how-to-share-api-keys/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-03-20'},
    {path: '/blog/privnote-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-08-01'},
    {path: '/blog/is-slack-safe-for-passwords/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-10-24'},
    {path: '/blog/onetimesecret-alternative/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-09-26'},
    {path: '/blog/self-destructing-messages-explained/', priority: 0.6, changefreq: 'monthly', lastmod: '2026-04-14'},
];

export const GET: APIRoute = () => {
    const routes = [...coreRoutes, ...blogRoutes];
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
