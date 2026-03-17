import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/outfit';
import './globals.css';
import '../styles/home.css';
import '../styles/link.css';
import '../styles/view.css';
import '../styles/generator.css';
import '../styles/about.css';
import Header from '../components/Header';
import Link from 'next/link';

export const metadata = {
    metadataBase: new URL('https://onetimelink.me'),
    title: 'onetimelink.me — Share Secrets with Encrypted One-Time Links',
    description: 'Share passwords, tokens, and sensitive data through encrypted one-time self-destruct links. End-to-end encrypted — we never see your data. Free, fast, no signup required.',
    openGraph: {
        title: 'onetimelink.me — Share Secrets with Self-Destruct Links',
        description: 'Send passwords and sensitive data through encrypted one-time links. End-to-end encrypted, auto-destroyed after reading.',
        type: 'website',
        url: '/',
    },
    twitter: {
        card: 'summary',
        title: 'onetimelink.me — Encrypted One-Time Secret Links',
        description: 'Share passwords and private data securely. End-to-end encrypted, self-destruct after reading.',
    },
    icons: {
        icon: '/favicon.svg',
    },
    manifest: '/manifest.json',
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#EA580C',
};

export default function RootLayout({children}) {
    return (
        <html lang="en">
            <body>
                <div className="app-layout">
                    <Header />
                    <main className="app-main">
                        {children}
                    </main>
                    <footer className="app-footer">
                        <p className="app-footer-text">
                            <Link href="/about">About</Link> &middot; End-to-end encrypted &middot; <a href="https://github.com/shingrus/onetimelink" target="_blank" rel="noopener noreferrer">Open source</a>
                        </p>
                    </footer>
                </div>
            </body>
        </html>
    );
}
