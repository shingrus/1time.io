import Link from 'next/link';
import InlineCss from '../../components/InlineCss';
import {siteHost} from '../../utils/siteConfig';

export const metadata = {
    title: `Share Passwords with a QR Code Securely | ${siteHost}`,
    description: 'Generate a one-time QR code for encrypted secret links. Better for nearby sharing, cross-device logins, and quick password handoffs without leaving the secret in chat history.',
    alternates: { canonical: '/share-passwords-with-qr-code' },
    openGraph: {
        title: 'Share Passwords with a QR Code Securely',
        description: 'Use one-time QR codes to share passwords and secrets on another device without exposing them in chat history.',
        url: '/share-passwords-with-qr-code',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Share passwords with a QR code securely' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Share Passwords with a QR Code Securely',
        description: 'Use one-time QR codes to share passwords and secrets on another device without exposing them in chat history.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Share Passwords with a QR Code Securely',
        description: 'Generate a one-time QR code for encrypted secret links. Better for nearby sharing, cross-device logins, and quick password handoffs.',
        url: 'https://1time.io/share-passwords-with-qr-code/',
        isPartOf: 'https://1time.io/',
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io/' },
            { '@type': 'ListItem', position: 2, name: 'Share Passwords with a QR Code', item: 'https://1time.io/share-passwords-with-qr-code/' },
        ],
    },
];

export default function SharePasswordsWithQrCodePage() {
    return (
        <>
            <InlineCss file="styles/blog.css" />
            {jsonLd.map((schema, index) => (
                <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
            ))}
            <article className="article">
                <div className="article-header">
                    <span className="article-tag">Feature</span>
                    <h1>Share Passwords with a QR Code</h1>
                    <p className="article-subtitle">
                        Generate a one-time QR code for an encrypted secret link. It is ideal when the sender
                        and recipient are together, or when a password needs to jump quickly from one device to another.
                    </p>
                    <p>
                        <Link href="/" className="btn btn-primary">
                            Create a secure link
                        </Link>
                    </p>
                </div>

                <div className="article-body">
                    <p>
                        On 1time.io, the QR code is just another way to deliver the same one-time encrypted
                        link. Create the secret, reveal the QR, let the recipient scan it on another device,
                        and the secret disappears after it is opened.
                    </p>

                    <h2>When QR sharing is useful</h2>
                    <ul>
                        <li><strong>Cross-device logins.</strong> You create the secret on a laptop and scan it with the phone that actually needs the password.</li>
                        <li><strong>Nearby handoffs.</strong> Two people are in the same room, so scanning is faster than sending a chat message.</li>
                        <li><strong>Short-lived credentials.</strong> Temporary guest access, staging logins, WiFi passwords, and one-off support sessions.</li>
                    </ul>

                    <h2>How it works</h2>
                    <ol>
                        <li>Create the encrypted one-time link on 1time.io.</li>
                        <li>Click <strong>Show QR code</strong> on the success screen.</li>
                        <li>The recipient scans the QR on another device and opens the same one-time link.</li>
                        <li>Once the secret is read, it is destroyed from the server.</li>
                    </ol>

                    <h2>Why this is safer than displaying the password itself</h2>
                    <p>
                        Putting the raw password on screen makes it readable to anyone nearby and easy to
                        photograph. A one-time QR still needs care, but it contains a one-time link instead
                        of the plaintext password. Whoever scans it first gets the secret once, then it is gone.
                    </p>

                    <div className="callout callout-tip">
                        <span className="callout-icon">💡</span>
                        <p>
                            <strong>Best practice:</strong> Use QR for nearby or cross-device sharing.
                            For remote recipients, <Link href="/">copy the one-time link</Link> instead.
                        </p>
                    </div>

                    <h2>QR code vs copy link</h2>
                    <table className="comparison-table">
                        <thead>
                            <tr>
                                <th>Method</th>
                                <th>Best for</th>
                                <th>Main tradeoff</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Copy link</strong></td>
                                <td>Email, Slack, SMS, remote sharing</td>
                                <td>Requires sending through another channel</td>
                            </tr>
                            <tr>
                                <td><strong>One-time QR code</strong></td>
                                <td>Nearby sharing and cross-device handoff</td>
                                <td>Not useful on the same device, visible to nearby scanners</td>
                            </tr>
                            <tr>
                                <td><strong>Plain password on screen</strong></td>
                                <td>Almost never</td>
                                <td>Readable and photographable in plaintext</td>
                            </tr>
                        </tbody>
                    </table>

                    <p>
                        If you want the broader security context, read our guide on
                        {' '}<Link href="/blog/how-to-share-passwords-securely">how to share passwords securely</Link>.
                        For WiFi-specific examples, read
                        {' '}<Link href="/blog/how-to-share-wifi-password">how to share your WiFi password securely</Link>.
                    </p>

                    <div className="article-cta">
                        <div className="article-cta-icon">📱</div>
                        <h2>Create a one-time QR code now</h2>
                        <p>Generate an encrypted link, reveal the QR, and let the recipient scan it once.</p>
                        <Link href="/" className="btn btn-primary btn-lg">Create a secure link</Link>
                    </div>
                </div>

                <div className="related-articles">
                    <h2>Keep Reading</h2>
                    <div className="related-articles-grid">
                        <Link href="/blog/how-to-send-passwords-over-email" className="related-article-card">
                            <span>How to Send Passwords Over Email</span>
                            <span>What to do when the recipient is remote and QR is not the right fit.</span>
                        </Link>
                        <Link href="/blog/how-to-share-passwords-securely" className="related-article-card">
                            <span>How to Share Passwords Securely</span>
                            <span>The broader guide to encrypted one-time sharing for teams.</span>
                        </Link>
                        <Link href="/blog/how-to-share-wifi-password" className="related-article-card">
                            <span>How to Share Your WiFi Password Securely</span>
                            <span>How QR sharing fits into guest networks and in-person access.</span>
                        </Link>
                    </div>
                </div>
            </article>
        </>
    );
}
