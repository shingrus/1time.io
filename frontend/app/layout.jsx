import InlineCss from '../components/InlineCss';
import Header from '../components/Header';
import PageStatsTracker from '../components/PageStatsTracker';
import {absoluteUrl, isBlogEnabled, siteHost, siteUrl} from '../utils/siteConfig';

export const metadata = {
    metadataBase: new URL(siteUrl),
    title: `Share Passwords Securely — Free Encrypted One-Time Links | ${siteHost}`,
    description: 'Share passwords and secrets through encrypted one-time links that self-destruct after reading. Zero-knowledge encryption, free, open source.',
    openGraph: {
        title: `${siteHost} — Free Encrypted One-Time Secret Links`,
        description: 'Send passwords and sensitive data through encrypted one-time links. Zero-knowledge encryption, auto-destroyed after reading.',
        type: 'website',
        url: '/',
        images: [{ url: '/1time-og-c1.png', width: 1200, height: 630, alt: `${siteHost} — Encrypted One-Time Secret Links` }],
    },
    twitter: {
        card: 'summary_large_image',
        title: `${siteHost} — Encrypted One-Time Secret Links`,
        description: 'Share passwords and private data securely. End-to-end encrypted, self-destruct after reading.',
    },
    icons: {
        icon: '/favicon.svg',
    },
    manifest: '/manifest.webmanifest',
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#C2410C',
};

export default function RootLayout({children}) {
    const showBlog = isBlogEnabled();

    return (
        <html lang="en">
            <head>
                {/* Preload critical fonts to eliminate render-blocking chain.
                    Without this, browser discovers fonts only after parsing inline CSS,
                    adding ~130ms to LCP. Preload starts download in parallel with HTML parsing. */}
                <link rel="preload" href="/bricolage-grotesque-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
            </head>
            <body>
                <InlineCss file="app/globals.css" />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Organization',
                        '@id': `${siteUrl}#organization`,
                        name: siteHost,
                        url: siteUrl,
                        description: 'Free encrypted one-time secret sharing with zero-knowledge architecture. Share passwords, API keys, and secrets via self-destructing links. No signup required, open source.',
                        logo: {
                            '@type': 'ImageObject',
                            url: absoluteUrl('/logo-512.png'),
                            width: 512,
                            height: 512,
                        },
                        sameAs: [
                            'https://github.com/shingrus/1time',
                            'https://www.npmjs.com/package/@1time/cli',
                        ],
                    }) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'WebSite',
                        name: siteHost,
                        url: siteUrl,
                    }) }}
                />
                <div className="app-layout">
                    <PageStatsTracker />
                    <Header />
                    <main className="app-main">
                        {children}
                    </main>
                    <footer className="app-footer">
                        <nav className="app-footer-tools">
                            <a href="/secure-file-sharing/">Secure File Sharing</a>
                            <a href="/password-generator/">Password Generator</a>
                            <a href="/passphrase-generator/">Passphrase</a>
                            <a href="/wifi-password-generator/">WiFi Password</a>
                            <a href="/api-key-generator/">API Key</a>
                            <a href="/share-passwords-with-qr-code/">QR Code</a>
                        </nav>
                        <nav className="app-footer-tools">
                            {showBlog && <a href="/blog/">Blog</a>}
                            <a href="/about/">About</a>
                            <a href="/privacy/">Privacy</a>
                            <a href="https://www.npmjs.com/package/@1time/cli" target="_blank" rel="noopener noreferrer">CLI</a>
                            <a href="https://github.com/shingrus/1time" target="_blank" rel="noopener noreferrer">GitHub</a>
                        </nav>
                        <p className="app-footer-text">
                            Zero-knowledge
                            {' '}&middot;{' '}
                            {showBlog
                                ? <a href="/blog/quantum-safe-password-sharing/">Quantum-safe encryption</a>
                                : 'Quantum-safe encryption'
                            }
                            {' '}&middot; &copy; 2026 1time.io
                        </p>
                    </footer>
                </div>
            </body>
        </html>
    );
}
