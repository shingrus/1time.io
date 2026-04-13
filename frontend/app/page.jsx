import InlineCss from '../components/InlineCss';
import NewMessage from '../components/NewMessage';
import {siteHost, siteUrl} from '../utils/siteConfig';

export const metadata = {
    title: `One-Time Links for Secure Sharing | ${siteHost}`,
    description: 'Share passwords, API keys, files, and private notes through encrypted one-time links and QR codes that self-destruct after reading. Zero-knowledge secret sharing, free and open source.',
    alternates: { canonical: '/' },
    openGraph: {
        title: `${siteHost} — Secure One-Time Links for Passwords and Files`,
        description: 'Share passwords, API keys, and files through encrypted one-time links and QR codes. Zero-knowledge encryption, auto-destroyed after reading.',
        url: '/',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${siteHost} — Encrypted One-Time Secret Links` }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteHost,
    url: siteUrl,
    description: 'Share passwords, API keys, files, and sensitive notes through encrypted one-time self-destruct links. End-to-end encrypted — we never see your data.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: 'End-to-end encryption, One-time secret links, Password sharing, API key sharing, Encrypted file sharing, QR code sharing, Auto-expiry, CLI, Zero-knowledge architecture, Self-hosted',
};

export default function HomePage() {
    return (
        <>
            <InlineCss file="styles/home.css" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <div className="share-flow-page">
                <nav className="share-mode-nav" aria-label="Choose sharing mode">
                    <a href="/" className="share-mode-link share-mode-link-active">
                        Text Secret
                    </a>
                    <a href="/secure-file-sharing/" className="share-mode-link">
                        Secure File Sharing
                    </a>
                </nav>
                <NewMessage />
                <section className="seo-section">
                    <h1>Share Secrets Securely with Encrypted One-Time Links</h1>
                    <p>
                        {siteHost} is a free, open-source tool for sharing{' '}
                        <a href="/share-password-securely/">passwords securely</a>, sending API keys and private
                        notes, and delivering <a href="/secure-file-sharing/">encrypted files</a> through
                        one-time links. Each secret is encrypted in your browser using AES-256-GCM before being stored.
                        The server never sees the plaintext, and each link self-destructs after it is read once or
                        after a set expiry period. No signup required.
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
                        <a href="/secure-file-sharing/" className="feature-card feature-card-link">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4c1;</div>
                                <h2>Secure File Sharing</h2>
                            </div>
                            <p>Send encrypted files through one-time download links without exposing filenames or contents.</p>
                        </a>
                        <a href="/password-generator/" className="feature-card feature-card-link">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f511;</div>
                                <h2>Password Generator</h2>
                            </div>
                            <p>Create a strong, high-entropy password in your browser for critical accounts.</p>
                        </a>
                        <a href="/share-passwords-with-qr-code/" className="feature-card feature-card-link">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4f1;</div>
                                <h2>QR Code Sharing</h2>
                            </div>
                            <p>Reveal a one-time QR code for nearby or cross-device password sharing.</p>
                        </a>
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
                        Type or paste your secret above. {siteHost} encrypts it with a unique key directly in your
                        browser. You get a one-time link containing the decryption key in the URL fragment, which is
                        never sent to the server. Share it with your recipient. Once they open it, the secret is
                        decrypted locally and permanently deleted from our servers.
                    </p>

                    <h2>Perfect for sharing</h2>
                    <p>
                        Passwords, API keys, SSH keys, private notes, access tokens, WiFi passwords, two-factor backup
                        codes, database credentials, configuration secrets, or any text you need to share securely just once.
                    </p>

                    <h2>Ways to share securely</h2>
                    <nav className="seo-nav">
                        <a href="/share-password-securely/">Share Passwords Securely</a>
                        <a href="/secure-file-sharing/">Secure File Sharing</a>
                        <a href="/share-passwords-with-qr-code/">Share via QR Code</a>
                        <a href="/blog/how-to-share-passwords-securely/">How to Share Passwords Securely</a>
                        <a href="/blog/how-to-share-api-keys/">How to Share API Keys Securely</a>
                        <a href="/blog/share-secrets-from-terminal/">Share Secrets from Terminal</a>
                    </nav>

                    <h2>Security tools</h2>
                    <nav className="seo-nav">
                        <a href="/password-generator/">Password Generator</a>
                        <a href="/passphrase-generator/">Passphrase Generator</a>
                        <a href="/wifi-password-generator/">WiFi Password Generator</a>
                        <a href="/api-key-generator/">API Key Generator</a>
                        <a href="/password-generator-12-characters/">12-Character Password</a>
                        <a href="/password-generator-14-characters/">14-Character Password</a>
                        <a href="/password-generator-15-characters/">15-Character Password</a>
                        <a href="/password-generator-16-characters/">16-Character Password</a>
                    </nav>

                    <h2>From the blog</h2>
                    <nav className="seo-nav">
                        <a href="/blog/stop-sending-passwords-over-slack/">Stop Sending Passwords Over Slack</a>
                        <a href="/blog/how-to-share-wifi-password/">How to Share Your WiFi Password Securely</a>
                        <a href="/blog/is-slack-safe-for-passwords/">Is Slack Safe for Passwords?</a>
                        <a href="/blog/onetimesecret-alternative/">1time.io vs OneTimeSecret</a>
                        <a href="/blog/privnote-alternative/">1time.io vs Privnote</a>
                        <a href="/blog/team-password-sharing/">Team Password Sharing</a>
                        <a href="/blog/how-to-send-passwords-over-email/">How to Send Passwords Over Email</a>
                    </nav>
                </section>
            </div>
        </>
    );
}
