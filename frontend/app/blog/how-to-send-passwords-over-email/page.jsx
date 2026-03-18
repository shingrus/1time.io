import Link from 'next/link';

export const metadata = {
    title: 'How to Send Passwords Securely Over Email — onetimelink.me',
    description: 'Learn why emailing passwords is dangerous and discover safe alternatives. Use encrypted one-time links to share passwords over email without exposing them.',
    alternates: { canonical: '/blog/how-to-send-passwords-over-email' },
    openGraph: {
        title: 'How to Send Passwords Securely Over Email',
        description: 'Email stores messages forever. Here is how to share passwords over email without the risk.',
        url: '/blog/how-to-send-passwords-over-email',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'How to Send Passwords Over Email' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'How to Send Passwords Securely Over Email',
        description: 'Email stores messages forever. Here is how to share passwords over email without the risk.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'How to Send Passwords Securely Over Email',
        description: 'Learn why emailing passwords is dangerous and discover safe alternatives. Use encrypted one-time links to share passwords over email without exposing them.',
        datePublished: '2026-03-18',
        dateModified: '2026-03-18',
        author: { '@type': 'Organization', name: 'onetimelink.me', url: 'https://onetimelink.me' },
        publisher: { '@type': 'Organization', name: 'onetimelink.me', url: 'https://onetimelink.me' },
        mainEntityOfPage: 'https://onetimelink.me/blog/how-to-send-passwords-over-email',
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://onetimelink.me' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://onetimelink.me/blog' },
            { '@type': 'ListItem', position: 3, name: 'How to Send Passwords Over Email' },
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
                <h1>How to Send Passwords Securely Over Email</h1>
                <p className="article-subtitle">
                    Email is the most common way people share passwords. It is also one of the worst.
                    Here is why, and what to do instead.
                </p>
                <div className="article-meta">March 2026 &middot; 6 min read</div>
            </div>

            <div className="article-body">
                <h2>Why Emailing Passwords Is Dangerous</h2>
                <p>
                    When you type a password into an email and hit send, that password now exists in
                    at least four places: your sent folder, the recipient inbox, your email server,
                    and the recipient email server. If either account uses IMAP, add every synced device
                    to that list.
                </p>
                <p>
                    Emails are stored indefinitely by default. That password you emailed six months ago
                    is still sitting in both inboxes, fully readable. If either email account is ever
                    compromised, the attacker gets every password ever shared through email.
                </p>

                <div className="diagram">
                    <div className="diagram-title">Where your emailed password ends up</div>
                    <div className="diagram-flow">
                        <div className="diagram-step diagram-step-danger">
                            <span className="diagram-step-icon">📤</span>
                            <span className="diagram-step-label">Your sent folder</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-danger">
                            <span className="diagram-step-icon">🖥️</span>
                            <span className="diagram-step-label">Your mail server</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-danger">
                            <span className="diagram-step-icon">🖥️</span>
                            <span className="diagram-step-label">Their mail server</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-danger">
                            <span className="diagram-step-icon">📥</span>
                            <span className="diagram-step-label">Their inbox</span>
                            <span className="diagram-step-desc">+ all synced devices</span>
                        </div>
                    </div>
                </div>

                <div className="callout callout-warning">
                    <span className="callout-icon">⚠️</span>
                    <p>
                        <strong>Email backups make it worse.</strong> Most email providers back up all
                        messages to disaster recovery systems. Even if you delete the email, copies may
                        persist in backups for months or years.
                    </p>
                </div>

                <h2>The Safe Way: One-Time Links in Emails</h2>
                <p>
                    Instead of putting the actual password in the email body, replace it with an
                    encrypted one-time link. The workflow is simple:
                </p>
                <ol>
                    <li>Go to <Link href="/">onetimelink.me</Link> and paste the password.</li>
                    <li>Copy the generated encrypted link.</li>
                    <li>Paste the link into your email instead of the actual password.</li>
                    <li>The recipient clicks the link, sees the password, and the link self-destructs.</li>
                </ol>
                <p>
                    Now the email only contains a link — not the password itself. After the link is
                    opened, the email is harmless. An attacker who gains access to the email account
                    later finds a dead link that reveals nothing.
                </p>

                <h2>Step-by-Step: Sending a Password Over Email Safely</h2>

                <h3>Step 1: Create the encrypted link</h3>
                <p>
                    Open <Link href="/">onetimelink.me</Link> in your browser. Paste the password,
                    API key, or credential into the text field. Optionally set a short expiration time
                    (15 minutes is usually enough for email) and add a passphrase for extra protection.
                </p>

                <h3>Step 2: Copy the link</h3>
                <p>
                    Click the copy button to copy the one-time link to your clipboard. The password is
                    now encrypted — the key is embedded in the link itself and never touches the server.
                </p>

                <h3>Step 3: Compose your email</h3>
                <p>
                    Write your email and paste the link where you would normally paste the password.
                    For extra security, do not mention what the link contains in the same email. Just say
                    something like: &quot;Here is the access you requested&quot; followed by the link.
                </p>

                <h3>Step 4: Tell them what it is via a different channel</h3>
                <p>
                    Send a quick message on Slack, Teams, or text: &quot;Check your email — I sent you the
                    staging password.&quot; This way, neither channel has enough context on its own.
                </p>

                <div className="callout callout-tip">
                    <span className="callout-icon">💡</span>
                    <p>
                        <strong>Pro tip:</strong> Set the link to expire in 15-30 minutes when sharing over
                        email. If the recipient does not open it in time, create a new one. This minimizes
                        the window of exposure.
                    </p>
                </div>

                <h2>Common Objections (and Why They Are Wrong)</h2>

                <h3>&quot;But my email uses TLS&quot;</h3>
                <p>
                    TLS encrypts the email in transit — while it travels between servers. It does
                    <strong>not</strong> encrypt the email at rest. Your password sits in plaintext on
                    the mail server, in the inbox, and in backups. TLS protects against eavesdropping
                    on the wire but not against account compromise.
                </p>

                <h3>&quot;I will just delete the email after&quot;</h3>
                <p>
                    Deleting an email removes it from your view. It does not remove it from server
                    backups, the recipient inbox, or any compliance archives your company might have.
                    And you are trusting the recipient to delete it too.
                </p>

                <h3>&quot;It is just an internal password, not that important&quot;</h3>
                <p>
                    Internal credentials are often the most valuable to attackers. A shared staging
                    password that has not been rotated in months is a common entry point for lateral
                    movement in breaches.
                </p>

                <h2>What About Password-Protected ZIP Files?</h2>
                <p>
                    Some people send passwords inside encrypted ZIP files attached to emails, then send
                    the ZIP password in a separate message. This is better than plaintext but still
                    flawed: the ZIP file persists in the email forever, and the encryption on older
                    ZIP formats is weak. One-time links are simpler and more secure.
                </p>

                <div className="article-cta">
                    <div className="article-cta-icon">📧</div>
                    <h2>Stop emailing passwords</h2>
                    <p>Create an encrypted one-time link instead. It takes 10 seconds and the password never sits in an inbox.</p>
                    <Link href="/" className="btn btn-primary btn-lg">Create a secure link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/blog/how-to-share-passwords-securely" className="related-article-card">
                        <span>How to Share Passwords Securely with Your Team</span>
                        <span>The complete guide to secure credential sharing.</span>
                    </Link>
                    <Link href="/blog/is-slack-safe-for-passwords" className="related-article-card">
                        <span>Is Slack Safe for Sharing Passwords?</span>
                        <span>Why Slack DMs are not as private as you think.</span>
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
