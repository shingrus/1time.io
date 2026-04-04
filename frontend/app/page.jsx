import Link from 'next/link';
import InlineCss from '../components/InlineCss';
import NewMessage from '../components/NewMessage';
import {siteHost, siteUrl} from '../utils/siteConfig';

export const metadata = {
    title: `Share Passwords Securely — Free Encrypted One-Time Links | ${siteHost}`,
    description: 'Share passwords, files, and secrets through encrypted one-time links and QR codes that self-destruct after reading. Zero-knowledge encryption, free, open source.',
    alternates: { canonical: '/' },
    openGraph: {
        title: `${siteHost} — Free Encrypted One-Time Secret Links`,
        description: 'Send passwords and sensitive text through encrypted one-time links and QR codes. Zero-knowledge encryption, auto-destroyed after reading.',
        url: '/',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${siteHost} — Encrypted One-Time Secret Links` }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteHost,
    url: siteUrl,
    description: 'Share passwords, tokens, and sensitive text through encrypted one-time self-destruct links. End-to-end encrypted — we never see your data.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: 'End-to-end encryption, One-time access, Encrypted file sharing, QR code sharing, Auto-expiry, Password generator, CLI, Zero-knowledge architecture, Self-hosted',
};

export default function HomePage() {
    return (
        <>
            <InlineCss file="styles/home.css" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <div className="share-flow-page">
                <nav className="share-mode-nav" aria-label="Choose sharing mode">
                    <Link href="/" className="share-mode-link share-mode-link-active">
                        Text Secret
                    </Link>
                    <Link href="/secure-file-sharing/" className="share-mode-link">
                        Secure File Sharing
                    </Link>
                </nav>
                <NewMessage />
                <section className="seo-section">
                    <h1>Share Secrets and Files with Encrypted One-Time Links</h1>
                    <p>
                        {siteHost} is a free, open-source tool for sharing passwords, text secrets, and{' '}
                        <Link href="/secure-file-sharing/">encrypted files</Link> through
                        one-time links. Each secret is encrypted in your browser using AES-256-GCM
                        before being stored. The server never sees the plaintext. Links self-destruct after
                        they are read once or after a set expiry period. No signup required.
                    </p>

                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f512;</div>
                                <h2>End-to-end encrypted</h2>
                            </div>
                            <p>AES encryption happens in your browser. The server only stores ciphertext.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4a5;</div>
                                <h2>One-time access</h2>
                            </div>
                            <p>Each link works exactly once. After reading, the data is permanently deleted.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x23f1;&#xfe0f;</div>
                                <h2>Auto-expiry</h2>
                            </div>
                            <p>Links self-destruct after 1 to 30 days, even if nobody opens them.</p>
                        </div>
                        <Link href="/secure-file-sharing/" className="feature-card feature-card-link">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4c1;</div>
                                <h2>Secure File Sharing</h2>
                            </div>
                            <p>Send encrypted files through one-time download links without exposing filenames or contents.</p>
                        </Link>
                        <Link href="/password-generator" className="feature-card feature-card-link">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f511;</div>
                                <h2>Password Generator</h2>
                            </div>
                            <p>Create a strong, high-entropy password in your browser for critical accounts.</p>
                        </Link>
                        <Link href="/share-passwords-with-qr-code" className="feature-card feature-card-link">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4f1;</div>
                                <h2>QR Code Sharing</h2>
                            </div>
                            <p>Reveal a one-time QR code for nearby or cross-device password sharing.</p>
                        </Link>
                        <a href="https://www.npmjs.com/package/@1time/cli" className="feature-card feature-card-link" target="_blank" rel="noopener noreferrer">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4bb;</div>
                                <h2>CLI</h2>
                            </div>
                            <p>Share secrets from your terminal. <code style={{fontSize: '0.85em'}}>printf 'secret' | 1time send</code></p>
                        </a>
                    </div>

                    <h2>How it works</h2>
                    <p>
                        Type or paste your secret above. {siteHost} encrypts it with a unique key directly in
                        your browser. You get a one-time link containing the decryption key in the URL fragment.
                        Share it with your recipient. Once they open it, the secret is decrypted locally and
                        permanently deleted from our servers.
                    </p>

                    <h2>Perfect for sharing</h2>
                    <p>
                        Passwords, API keys, SSH keys, private notes, access tokens, two-factor backup codes,
                        database credentials, configuration secrets, or any text you need to share securely just once.
                    </p>

                    <h2>Security tools</h2>
                    <nav className="seo-nav">
                        <Link href="/secure-file-sharing/">Secure File Sharing</Link>
                        <Link href="/password-generator">Password Generator</Link>
                        <Link href="/passphrase-generator">Passphrase Generator</Link>
                        <Link href="/wifi-password-generator">WiFi Password Generator</Link>
                        <Link href="/api-key-generator">API Key Generator</Link>
                        <Link href="/password-generator-12-characters">12-Character Password</Link>
                        <Link href="/password-generator-14-characters">14-Character Password</Link>
                        <Link href="/password-generator-15-characters">15-Character Password</Link>
                        <Link href="/password-generator-16-characters">16-Character Password</Link>
                    </nav>

                    <h2>From the blog</h2>
                    <nav className="seo-nav">
                        <Link href="/blog/stop-sending-passwords-over-slack">Stop Sending Passwords Over Slack</Link>
                        <Link href="/blog/how-to-share-wifi-password">How to Share Your WiFi Password Securely</Link>
                        <Link href="/blog/onetimesecret-alternative">1time.io vs OneTimeSecret</Link>
                        <Link href="/blog/privnote-alternative">1time.io vs Privnote</Link>
                        <Link href="/blog/is-slack-safe-for-passwords">Is Slack Safe for Passwords?</Link>
                        <Link href="/blog/how-to-share-passwords-securely">How to Share Passwords Securely</Link>
                        <Link href="/blog/how-to-share-api-keys">How to Share API Keys Securely</Link>
                        <Link href="/blog/share-secrets-from-terminal">Share Secrets from Terminal</Link>
                    </nav>
                </section>
            </div>
        </>
    );
}
