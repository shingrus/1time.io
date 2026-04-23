import '../../styles/about.css';
import Link from 'next/link';
import {siteHost} from '../../utils/siteConfig';

export const metadata = {
    title: `Privacy Policy — ${siteHost}`,
    description: `Privacy policy for ${siteHost}. Zero-knowledge architecture — we never see your secrets. No tracking, no analytics, no cookies.`,
    alternates: { canonical: '/privacy' },
    openGraph: {
        title: `Privacy Policy — ${siteHost}`,
        description: `Privacy policy for ${siteHost}. Zero-knowledge, no tracking, no cookies.`,
        url: '/privacy',
        images: [{ url: '/1time-og-main.png', width: 1200, height: 630, alt: `${siteHost} — Encrypted One-Time Secret Links` }],
    },
};

export default function PrivacyPage() {
    return (
        <div className="about-page">
            <h1>Privacy Policy</h1>
            <p className="subtitle">Last updated: March 22, 2026</p>

            <div className="about-section">
                <h2>The short version</h2>
                <p>
                    {siteHost} is built on a zero-knowledge architecture. Your secrets are encrypted
                    in your browser before they reach our server. We cannot read them. We do not track you.
                    We do not use cookies. We do not run analytics.
                </p>
            </div>

            <div className="about-section">
                <h2>What we store</h2>
                <ul>
                    <li>
                        <strong>Encrypted secret data:</strong> When you create a one-time link, your browser
                        encrypts the secret with AES-256-GCM before sending it to our server. We store only
                        the encrypted ciphertext. The decryption key stays in the URL fragment (<code>#</code>),
                        which is never sent to the server. We cannot decrypt your secrets.
                    </li>
                    <li>
                        <strong>Automatic deletion:</strong> Encrypted data is permanently deleted after
                        the link is opened once, or after the expiry period you choose (1–30 days),
                        whichever comes first.
                    </li>
                    <li>
                        <strong>Server logs:</strong> Standard web server logs (IP address, timestamp,
                        URL path, user agent) may be retained for up to 14 days for security and
                        abuse prevention. These logs never contain secret content or decryption keys.
                    </li>
                    <li>
                        <strong>Aggregate counters:</strong> We maintain simple counters — total secrets
                        shared and page visits by category (home, blog, tools). These are plain numbers,
                        not per-user or per-session. No IP addresses, no identifiers, no way to link
                        a count to any individual.
                    </li>
                </ul>
            </div>

            <div className="about-section">
                <h2>What we do not collect</h2>
                <ul>
                    <li>No accounts or personal information — the service works without sign-up</li>
                    <li>No cookies — not even a session cookie</li>
                    <li>No analytics or tracking scripts — no Google Analytics, no pixels, no fingerprinting. We only keep an aggregate secret count with no identifying information</li>
                    <li>No third-party requests — no CDNs, ad networks, or external resources</li>
                    <li>No plaintext secrets — encryption happens client-side before transmission</li>
                </ul>
            </div>

            <div className="about-section">
                <h2>Password and key generators</h2>
                <p>
                    The <Link href="/password-generator">password generator</Link>, passphrase generator,
                    API key generator, and WiFi password generator run entirely in your browser
                    using the Web Crypto API. Generated values are never sent to our server.
                </p>
            </div>

            <div className="about-section">
                <h2>CLI</h2>
                <p>
                    The <a href="https://www.npmjs.com/package/@1time/cli" target="_blank" rel="noopener noreferrer">1time CLI</a> performs
                    encryption locally on your machine before sending data to the server.
                    The same zero-knowledge guarantees apply — the server never sees plaintext or keys.
                </p>
            </div>

            <div className="about-section">
                <h2>Self-hosting</h2>
                <p>
                    {siteHost} is <a href="https://github.com/shingrus/1time" target="_blank" rel="noopener noreferrer">open source</a>.
                    You can run your own instance and control your data entirely. When self-hosted,
                    no data is sent to {siteHost} or any third party.
                </p>
            </div>

            <div className="about-section">
                <h2>Infrastructure</h2>
                <p>
                    The hosted service at {siteHost} runs on infrastructure located in Europe.
                    All connections are encrypted with TLS. The server stores only encrypted blobs
                    in Redis with automatic expiration.
                </p>
            </div>

            <div className="about-section">
                <h2>Changes to this policy</h2>
                <p>
                    If this policy changes, the update date at the top of the page will be revised.
                    Because {siteHost} collects virtually no data, meaningful changes are unlikely.
                </p>
            </div>

            <div className="about-section">
                <h2>Contact</h2>
                <p>
                    Questions about privacy? Open an issue on{' '}
                    <a href="https://github.com/shingrus/1time/issues" target="_blank" rel="noopener noreferrer">GitHub</a> or
                    reach us through the repository.
                </p>
            </div>
        </div>
    );
}
