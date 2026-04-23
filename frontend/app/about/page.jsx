import '../../styles/about.css';
import Link from 'next/link';
import {absoluteUrl, siteHost, siteUrl} from '../../utils/siteConfig';

export const metadata = {
    title: `About ${siteHost} — Zero-Knowledge Secret Sharing, Open Source`,
    description: `Learn how ${siteHost} uses end-to-end encryption to share secrets securely. Open source, zero-knowledge, no accounts required.`,
    alternates: { canonical: '/about' },
    openGraph: {
        title: `About ${siteHost} — Zero-Knowledge Secret Sharing, Open Source`,
        description: `Learn how ${siteHost} uses end-to-end encryption to share secrets securely.`,
        url: '/about',
        images: [{ url: '/1time-og-main.png', width: 1200, height: 630, alt: `About ${siteHost}` }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: absoluteUrl('/about/'),
    name: `About ${siteHost} — Zero-Knowledge Secret Sharing, Open Source`,
    description: `Learn how ${siteHost} uses end-to-end encryption to share secrets securely. Open source, zero-knowledge, no accounts required.`,
    mainEntity: {
        '@type': 'Organization',
        '@id': `${siteUrl}#organization`,
        name: siteHost,
        url: siteUrl,
        description: 'Free encrypted one-time secret sharing with zero-knowledge architecture.',
    },
};

export default function AboutPage() {
    return (
        <div className="about-page">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <h1>About {siteHost}</h1>
            <p className="subtitle">Secure one-time secret sharing, built for simplicity.</p>
            <p className="article-last-updated" style={{fontSize: '0.85em', color: 'var(--color-muted, #888)', marginTop: 4}}>Last updated: March 2026</p>

            <div className="about-section">
                <h2>Why {siteHost}?</h2>
                <p>
                    Every day, millions of passwords and secrets get shared through email, Slack, and
                    text messages — channels that store data indefinitely and are vulnerable to breaches.
                    {siteHost} solves this by creating encrypted, self-destructing links that work exactly once.
                </p>
                <p>
                    We built {siteHost} because sharing secrets should be as easy as pasting text into a box.
                    No accounts, no setup, no learning curve. Just paste, share, done.
                </p>
            </div>

            <div className="about-section">
                <h2>How it works</h2>
                <ul className="step-list">
                    <li>You type or paste your secret into the message box</li>
                    <li>Your browser derives a cryptographic key using HKDF (RFC 5869) and encrypts your secret with AES-GCM-256</li>
                    <li>Only the encrypted ciphertext is sent to our server</li>
                    <li>You get a one-time link containing the decryption key</li>
                    <li>Your recipient opens the link — their browser decrypts the message</li>
                    <li>The encrypted data is permanently deleted from our server</li>
                </ul>
            </div>

            <div className="about-section">
                <h2>Security by design</h2>
                <ul>
                    <li>End-to-end encryption: your data is encrypted in the browser before transmission</li>
                    <li>Zero-knowledge: we never have access to your plaintext data or encryption keys</li>
                    <li>One-time access: each link can only be opened once, then the data is destroyed</li>
                    <li>Auto-expiry: even unread messages are automatically deleted after your chosen period</li>
                    <li>Optional passphrase: add a second layer of protection with a shared passphrase</li>
                    <li>No accounts required: no personal data collected, no tracking</li>
                </ul>
            </div>

            <div className="about-section">
                <h2>Open source</h2>
                <p>
                    {siteHost} is open source. You can inspect the code, verify the encryption implementation,
                    or host your own instance. Transparency is a core part of our security model.
                    Check out the source on <a href="https://github.com/shingrus/1time" target="_blank" rel="noopener noreferrer">GitHub</a>.
                </p>
            </div>

            <div className="about-section">
                <h2>Command-line interface</h2>
                <p>
                    Share secrets directly from your terminal with the{' '}
                    <a href="https://www.npmjs.com/package/@1time/cli" target="_blank" rel="noopener noreferrer">1time CLI</a>.
                    Install it with <code>npm install -g @1time/cli</code>, then pipe secrets in and get a one-time link back.
                    Same end-to-end encryption as the web app — your secret is encrypted locally before it ever leaves your machine.
                    Works with self-hosted instances via the <code>--host</code> flag.
                </p>
            </div>

            <div className="about-section">
                <h2>Use cases</h2>
                <ul>
                    <li>Sharing passwords with team members or clients</li>
                    <li>Sending API keys and access tokens securely</li>
                    <li>Transmitting SSH keys or certificates</li>
                    <li>Sharing two-factor backup codes</li>
                    <li>Sending database credentials during onboarding</li>
                    <li>Any situation where sensitive text needs to be shared once</li>
                </ul>
            </div>

            <div style={{textAlign: 'center', paddingTop: 16}}>
                <Link href="/" className="btn btn-primary btn-lg">
                    Create a secret link
                </Link>
            </div>
        </div>
    );
}
