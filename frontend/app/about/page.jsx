import Link from 'next/link';

export const metadata = {
    title: 'About — onetimelink.me',
    description: 'Learn how onetimelink.me uses end-to-end encryption to share secrets securely. Open source, zero-knowledge, no accounts required.',
    alternates: { canonical: '/about' },
    openGraph: {
        title: 'About — onetimelink.me',
        description: 'Learn how onetimelink.me uses end-to-end encryption to share secrets securely.',
        url: '/about',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'About onetimelink.me' }],
    },
};

export default function AboutPage() {
    return (
        <div className="about-page">
            <h1>About onetimelink.me</h1>
            <p className="subtitle">Secure one-time secret sharing, built for simplicity.</p>

            <div className="about-section">
                <h2>Why onetimelink.me?</h2>
                <p>
                    Every day, millions of passwords and secrets get shared through email, Slack, and
                    text messages — channels that store data indefinitely and are vulnerable to breaches.
                    onetimelink.me solves this by creating encrypted, self-destructing links that work exactly once.
                </p>
                <p>
                    We built onetimelink.me because sharing secrets should be as easy as pasting text into a box.
                    No accounts, no setup, no learning curve. Just paste, share, done.
                </p>
            </div>

            <div className="about-section">
                <h2>How it works</h2>
                <ul className="step-list">
                    <li>You type or paste your secret into the message box</li>
                    <li>Your browser encrypts it with AES using a unique generated key</li>
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
                    onetimelink.me is open source. You can inspect the code, verify the encryption implementation,
                    or host your own instance. Transparency is a core part of our security model.
                    Check out the source on <a href="https://github.com/shingrus/onetimelink" target="_blank" rel="noopener noreferrer">GitHub</a>.
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
