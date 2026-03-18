import Link from 'next/link';

export const metadata = {
    title: 'How to Share Your WiFi Password Securely — onetimelink.me',
    description: 'Learn the safest ways to share your WiFi password with guests, Airbnb visitors, and coworkers without exposing your network to security risks.',
    alternates: { canonical: '/blog/how-to-share-wifi-password' },
    openGraph: {
        title: 'How to Share Your WiFi Password Securely',
        description: 'Share WiFi credentials safely with guests and visitors. Avoid writing passwords on sticky notes.',
        url: '/blog/how-to-share-wifi-password',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'How to Share WiFi Password Securely' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'How to Share Your WiFi Password Securely',
        description: 'Share WiFi credentials safely with guests and visitors. Avoid writing passwords on sticky notes.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'How to Share Your WiFi Password Securely',
        description: 'Learn the safest ways to share your WiFi password with guests, Airbnb visitors, and coworkers without exposing your network to security risks.',
        datePublished: '2026-03-18',
        dateModified: '2026-03-18',
        author: { '@type': 'Organization', name: 'onetimelink.me', url: 'https://onetimelink.me' },
        publisher: { '@type': 'Organization', name: 'onetimelink.me', url: 'https://onetimelink.me' },
        mainEntityOfPage: 'https://onetimelink.me/blog/how-to-share-wifi-password',
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://onetimelink.me' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://onetimelink.me/blog' },
            { '@type': 'ListItem', position: 3, name: 'How to Share WiFi Password' },
        ],
    },
];

export default function Article() {
    return (
        <article className="article">
            {jsonLd.map((schema, i) => (
                <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
            ))}
            <div className="article-header">
                <span className="article-tag">Guide</span>
                <h1>How to Share Your WiFi Password Securely</h1>
                <p className="article-subtitle">
                    Whether you are hosting guests, running an Airbnb, or onboarding office visitors,
                    sharing WiFi passwords the wrong way can compromise your entire network.
                </p>
                <div className="article-meta">March 2026 &middot; 5 min read</div>
            </div>

            <div className="article-body">
                <h2>Why WiFi Password Security Matters</h2>
                <p>
                    Your WiFi password is the gateway to your home or office network. Anyone with the
                    password can connect to your network and potentially access shared files, printers,
                    smart home devices, and see unencrypted traffic from other devices on the network.
                </p>
                <p>
                    Most people share WiFi passwords in ways that leave the credential exposed
                    indefinitely: written on a sticky note on the fridge, taped to the router, or
                    sent in a text message that lives forever in the chat history.
                </p>

                <h2>The 5 Safest Ways to Share WiFi Passwords</h2>

                <h3>1. Send a Self-Destructing Link</h3>
                <p>
                    The simplest secure approach: paste your WiFi password into <Link href="/">onetimelink.me</Link>,
                    get an encrypted link, and send it via text or email. The recipient opens it, copies
                    the password, connects to WiFi, and the link self-destructs. No trace left in any
                    message history.
                </p>
                <p>
                    This is especially useful for Airbnb hosts — send the link in your welcome message
                    and it works once for the guest. After they connect, the password is gone from the
                    conversation.
                </p>

                <h3>2. Use a QR Code (In Person)</h3>
                <p>
                    If the person is physically present, a QR code that auto-connects them to WiFi is
                    the easiest method. Most phones can scan a WiFi QR code and connect without manually
                    typing the password.
                </p>
                <p>
                    The downside: QR codes printed on paper or displayed on a screen are visible to
                    anyone who can see them. Use this for guest networks, not your primary network.
                </p>

                <h3>3. Set Up a Guest Network</h3>
                <p>
                    Most modern routers support guest networks — a separate WiFi network with its own
                    password that isolates guests from your main network. Guests can access the internet
                    but cannot see your devices or shared files.
                </p>
                <p>
                    Share the guest network password freely and change it periodically. This way, even
                    if the password leaks, your main network stays protected.
                </p>

                <h3>4. Apple Share Password Feature</h3>
                <p>
                    If both you and the recipient use Apple devices, you can share WiFi passwords
                    automatically via AirDrop-like proximity sharing. The password is transferred
                    encrypted over Bluetooth and never shown on screen.
                </p>

                <h3>5. Tell Them In Person</h3>
                <p>
                    Sometimes the simplest approach is the best. Say the password out loud, let them
                    type it in, and nothing is stored anywhere. Not practical for remote sharing, but
                    unbeatable for in-person security.
                </p>

                <h2>Methods to Avoid</h2>

                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>Method</th>
                            <th>Risk</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Text message</strong></td>
                            <td>Password stored in both phones permanently, synced to cloud</td>
                        </tr>
                        <tr>
                            <td><strong>Sticky note</strong></td>
                            <td>Visible to everyone, easily photographed</td>
                        </tr>
                        <tr>
                            <td><strong>Email</strong></td>
                            <td>Stored in inboxes and backups indefinitely</td>
                        </tr>
                        <tr>
                            <td><strong>Printed on welcome card</strong></td>
                            <td>Previous guests keep the card, password never changes</td>
                        </tr>
                        <tr>
                            <td><strong>Written on whiteboard</strong></td>
                            <td>Visible to anyone in the room, often never erased</td>
                        </tr>
                    </tbody>
                </table>

                <h2>For Airbnb and Rental Hosts</h2>
                <p>
                    If you host guests regularly, the best setup is:
                </p>
                <ol>
                    <li>Set up a dedicated guest WiFi network on your router.</li>
                    <li>For each new guest, send the password via a one-time link in your check-in message.</li>
                    <li>Change the guest network password between guests (optional but recommended).</li>
                </ol>
                <p>
                    This keeps your personal network isolated and ensures no previous guest can access
                    your WiFi after checkout.
                </p>

                <div className="callout callout-tip">
                    <span className="callout-icon">💡</span>
                    <p>
                        <strong>Strong WiFi passwords matter.</strong> Use a strong, random password for
                        your WiFi — not your address, pet name, or phone number. Try our
                        {' '}<Link href="/password-generator">password generator</Link> or
                        {' '}<Link href="/passphrase-generator">passphrase generator</Link> to create one.
                    </p>
                </div>

                <div className="article-cta">
                    <div className="article-cta-icon">📶</div>
                    <h2>Share your WiFi password safely</h2>
                    <p>Create an encrypted one-time link. The password is gone after one view.</p>
                    <Link href="/" className="btn btn-primary btn-lg">Create a secure link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/blog/how-to-share-passwords-securely" className="related-article-card">
                        <span>How to Share Passwords Securely</span>
                        <span>The complete guide to secure credential sharing.</span>
                    </Link>
                    <Link href="/blog/how-to-send-passwords-over-email" className="related-article-card">
                        <span>How to Send Passwords Over Email</span>
                        <span>Why emailing passwords is dangerous and what to do instead.</span>
                    </Link>
                    <Link href="/blog/self-destructing-messages-explained" className="related-article-card">
                        <span>Self-Destructing Messages Explained</span>
                        <span>How one-time messages actually work under the hood.</span>
                    </Link>
                </div>
            </div>
        </article>
    );
}
