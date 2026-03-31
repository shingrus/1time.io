import Link from 'next/link';

export const metadata = {
    title: 'How to Share Passwords with a QR Code Securely — 1time.io',
    description: 'Learn when a one-time QR code is better than copy-paste, how QR password sharing works, and how to avoid exposing secrets on screen or in chat history.',
    alternates: { canonical: '/blog/how-to-share-passwords-with-qr-code' },
    openGraph: {
        title: 'How to Share Passwords with a QR Code Securely',
        description: 'Use one-time QR codes for nearby sharing and cross-device password handoffs without leaving secrets in chat history.',
        url: '/blog/how-to-share-passwords-with-qr-code',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'How to share passwords with a QR code securely' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'How to Share Passwords with a QR Code Securely',
        description: 'Use one-time QR codes for nearby sharing and cross-device password handoffs without leaving secrets in chat history.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'How to Share Passwords with a QR Code Securely',
        description: 'Learn when a one-time QR code is better than copy-paste, how QR password sharing works, and how to avoid exposing secrets on screen or in chat history.',
        datePublished: '2026-03-31',
        dateModified: '2026-03-31',
        author: { '@type': 'Person', name: 'Igor Ermakov', url: 'https://1time.io/about/' },
        publisher: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io', logo: { '@type': 'ImageObject', url: 'https://1time.io/logo-512.png', width: 512, height: 512 } },
        mainEntityOfPage: 'https://1time.io/blog/how-to-share-passwords-with-qr-code/',
        image: ['https://1time.io/og-image.png'],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://1time.io/blog/' },
            { '@type': 'ListItem', position: 3, name: 'How to Share Passwords with a QR Code', item: 'https://1time.io/blog/how-to-share-passwords-with-qr-code/' },
        ],
    },
];

export default function Article() {
    return (
        <article className="article">
            {jsonLd.map((schema, index) => (
                <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
            ))}
            <div className="article-header">
                <span className="article-tag">Guide</span>
                <h1>How to Share Passwords with a QR Code Securely</h1>
                <p className="article-subtitle">
                    QR codes are not just for menus and guest WiFi. For nearby sharing and cross-device
                    logins, a one-time QR code can be the fastest safe way to move a password without
                    leaving it behind in chat history.
                </p>
                <p>
                    <Link href="/share-passwords-with-qr-code" className="btn btn-secondary">
                        Try QR password sharing
                    </Link>
                </p>
                <div className="article-meta">By Igor Ermakov &middot; Mar 31, 2026 &middot; 5 min read</div>
            </div>

            <div className="article-body">
                <p>
                    Most password sharing advice assumes the sender and recipient are remote. In that
                    case, a copied one-time link is usually the right answer. But when both people are
                    together, or when the password needs to move from one device to another, scanning a
                    QR code is often faster and cleaner.
                </p>

                <h2>When a QR code is the better option</h2>
                <ul>
                    <li><strong>You are in the same room.</strong> The sender can show the QR and the recipient can scan it immediately.</li>
                    <li><strong>The password belongs on another device.</strong> For example, a phone needs a WiFi password or an app login created on a laptop.</li>
                    <li><strong>You want to avoid chat history entirely.</strong> Nothing needs to be pasted into Slack, email, or SMS.</li>
                </ul>

                <h2>How one-time QR sharing works</h2>
                <p>
                    With 1time.io, the QR code does not contain the plaintext password. It contains the same
                    one-time encrypted link you would normally copy and send. The recipient scans it, opens
                    the link, reads the secret, and the secret is destroyed after that read.
                </p>

                <div className="callout callout-tip">
                    <span className="callout-icon">🔐</span>
                    <p>
                        <strong>Important distinction:</strong> a one-time QR code is different from a permanent
                        WiFi QR code printed on a wall. A printed WiFi QR stays scannable forever. A one-time
                        QR disappears in practice as soon as the secret is opened.
                    </p>
                </div>

                <h2>When not to use QR</h2>
                <ul>
                    <li><strong>Remote sharing.</strong> If the recipient is elsewhere, copy the link instead.</li>
                    <li><strong>Busy public spaces.</strong> Anyone who can see the QR can try to scan it first.</li>
                    <li><strong>Same-device use.</strong> Showing a QR on the same phone that needs the secret is not useful.</li>
                </ul>

                <h2>QR code vs copy-paste</h2>
                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>Method</th>
                            <th>Best use case</th>
                            <th>Weakness</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>One-time link</strong></td>
                            <td>Remote sharing over email, chat, or ticket systems</td>
                            <td>Still needs a delivery channel</td>
                        </tr>
                        <tr>
                            <td><strong>One-time QR code</strong></td>
                            <td>Nearby handoff and cross-device logins</td>
                            <td>Anyone nearby can attempt to scan it first</td>
                        </tr>
                        <tr>
                            <td><strong>Plain password on screen</strong></td>
                            <td>Almost none</td>
                            <td>Visible and photographable in plaintext</td>
                        </tr>
                    </tbody>
                </table>

                <p>
                    If you want the product view, see our
                    {' '}<Link href="/share-passwords-with-qr-code">QR code sharing feature page</Link>.
                    If you want the broader security context, read
                    {' '}<Link href="/blog/how-to-share-passwords-securely">how to share passwords securely</Link>.
                </p>

                <div className="article-cta">
                    <div className="article-cta-icon">📱</div>
                    <h2>Try one-time QR sharing</h2>
                    <p>Create an encrypted secret link, reveal the QR, and let the recipient scan it once.</p>
                    <Link href="/" className="btn btn-primary btn-lg">Create a secure link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/share-passwords-with-qr-code" className="related-article-card">
                        <span>Share Passwords with a QR Code</span>
                        <span>The feature page for nearby and cross-device one-time sharing.</span>
                    </Link>
                    <Link href="/blog/how-to-share-passwords-securely" className="related-article-card">
                        <span>How to Share Passwords Securely</span>
                        <span>The complete guide to safe credential sharing for teams.</span>
                    </Link>
                    <Link href="/blog/how-to-share-wifi-password" className="related-article-card">
                        <span>How to Share Your WiFi Password Securely</span>
                        <span>Where one-time QR codes fit compared with guest WiFi and permanent WiFi QR codes.</span>
                    </Link>
                </div>
            </div>
        </article>
    );
}
