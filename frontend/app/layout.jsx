import InlineCss from '../components/InlineCss';
import Header from '../components/Header';
import PageStatsTracker from '../components/PageStatsTracker';
import Link from 'next/link';
import {absoluteUrl, isBlogEnabled, siteHost, siteUrl} from '../utils/siteConfig';

export const metadata = {
    metadataBase: new URL(siteUrl),
    title: `${siteHost} — Free Encrypted One-Time Links for Passwords & Secrets`,
    description: 'Send passwords, API keys, and sensitive data through free encrypted one-time links that self-destruct after reading. Zero-knowledge encryption — we never see your data. No signup required.',
    openGraph: {
        title: `${siteHost} — Free Encrypted One-Time Secret Links`,
        description: 'Send passwords and sensitive data through encrypted one-time links. Zero-knowledge encryption, auto-destroyed after reading.',
        type: 'website',
        url: '/',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${siteHost} — Encrypted One-Time Secret Links` }],
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
            <body>
                <InlineCss file="app/globals.css" />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Organization',
                        name: siteHost,
                        url: siteUrl,
                        logo: absoluteUrl('/favicon.svg'),
                        sameAs: ['https://github.com/shingrus/1time'],
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
                            <Link href="/password-generator">Password Generator</Link>
                            <Link href="/passphrase-generator">Passphrase Generator</Link>
                            <Link href="/wifi-password-generator">WiFi Password Generator</Link>
                            <Link href="/api-key-generator">API Key Generator</Link>
                        </nav>
                        <p className="app-footer-text">
                            <Link href="/about">About</Link>
                            {showBlog && (
                                <>
                                    {' '} &middot; <Link href="/blog">Blog</Link>
                                </>
                            )}
                            {' '} &middot; End-to-end encrypted &middot; <a href="https://github.com/shingrus/1time" target="_blank" rel="noopener noreferrer">Open source</a>
                        </p>
                    </footer>
                </div>
            </body>
        </html>
    );
}
