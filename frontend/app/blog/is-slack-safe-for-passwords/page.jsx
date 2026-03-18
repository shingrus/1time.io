import Link from 'next/link';

export const metadata = {
    title: 'Is Slack Safe for Sharing Passwords? (No, and Here Is Why) — onetimelink.me',
    description: 'Slack stores all messages indefinitely and admins can read DMs. Learn why Slack is dangerous for sharing passwords and what secure alternatives exist.',
    alternates: { canonical: '/blog/is-slack-safe-for-passwords' },
    openGraph: {
        title: 'Is Slack Safe for Sharing Passwords?',
        description: 'Slack DMs are not private. Admins can read them, messages are stored forever, and breaches expose everything.',
        url: '/blog/is-slack-safe-for-passwords',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Is Slack Safe for Passwords' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Is Slack Safe for Sharing Passwords?',
        description: 'Slack DMs are not private. Admins can read them, messages are stored forever, and breaches expose everything.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Is Slack Safe for Sharing Passwords? (No, and Here Is Why)',
        description: 'Slack stores all messages indefinitely and admins can read DMs. Learn why Slack is dangerous for sharing passwords and what secure alternatives exist.',
        datePublished: '2026-03-18',
        dateModified: '2026-03-18',
        author: { '@type': 'Organization', name: 'onetimelink.me', url: 'https://onetimelink.me' },
        publisher: { '@type': 'Organization', name: 'onetimelink.me', url: 'https://onetimelink.me' },
        mainEntityOfPage: 'https://onetimelink.me/blog/is-slack-safe-for-passwords',
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://onetimelink.me' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://onetimelink.me/blog' },
            { '@type': 'ListItem', position: 3, name: 'Is Slack Safe for Passwords?' },
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
                <span className="article-tag">Security</span>
                <h1>Is Slack Safe for Sharing Passwords? (No, and Here Is Why)</h1>
                <p className="article-subtitle">
                    You probably share passwords over Slack DMs. So does everyone else. Here is why
                    that is a serious security risk and what to do instead.
                </p>
                <div className="article-meta">March 2026 &middot; 6 min read</div>
            </div>

            <div className="article-body">
                <h2>The Short Answer: No</h2>
                <p>
                    Slack is a messaging tool, not a security tool. It was designed for communication,
                    not for protecting sensitive data. Sharing passwords over Slack has specific,
                    concrete risks that most people do not realize.
                </p>

                <h2>5 Reasons Slack Is Not Safe for Passwords</h2>

                <h3>1. Messages Are Stored Forever</h3>
                <p>
                    Every message you send in Slack — including DMs — is stored on Slack servers
                    permanently (on paid plans) or for 90 days (on free plans). That password you
                    sent three months ago is still sitting in the conversation, waiting for anyone
                    who scrolls up or uses the search function.
                </p>

                <h3>2. Admins Can Read Your DMs</h3>
                <p>
                    On Slack Business+ and Enterprise plans, workspace admins can export all messages
                    including private DMs. On all paid plans, admins with a Compliance Export can read
                    every message in the workspace. Your DMs are not private from your employer.
                </p>

                <div className="callout callout-warning">
                    <span className="callout-icon">⚠️</span>
                    <p>
                        <strong>This is not a bug — it is a feature.</strong> Slack is designed to enable
                        corporate compliance and e-discovery. Message access by admins is documented and
                        intentional. Slack DMs should never be treated as private channels for sensitive data.
                    </p>
                </div>

                <h3>3. Search Makes It Easy to Find</h3>
                <p>
                    Slack has powerful search. Anyone with access to the workspace can search for keywords
                    like &quot;password&quot;, &quot;API key&quot;, or &quot;credentials&quot;. If an
                    attacker gains access to any account in your workspace, they can search for every
                    password ever shared across all public channels.
                </p>

                <h3>4. One Compromised Account Exposes Everything</h3>
                <p>
                    Slack sessions are long-lived. If an attacker compromises a single Slack account
                    — through phishing, a stolen session cookie, or a reused password — they get access
                    to the entire message history. Every password shared in any channel that user has
                    access to is immediately exposed.
                </p>

                <h3>5. Third-Party Apps Can Read Messages</h3>
                <p>
                    Many Slack workspaces have dozens of third-party app integrations. Some of these
                    apps have permission to read messages in channels. A compromised or malicious
                    Slack app could silently harvest credentials shared in messages.
                </p>

                <h2>But I Deleted the Message — Am I Safe?</h2>
                <p>
                    Deleting a Slack message removes it from the visible conversation, but:
                </p>
                <ul>
                    <li>Slack may retain deleted messages in compliance exports for a configurable period.</li>
                    <li>If the recipient has email notifications enabled, the message content may exist in their email inbox.</li>
                    <li>Any Slack app or bot that processed the message may have a copy.</li>
                    <li>The recipient may have already seen, copied, or screenshotted it.</li>
                </ul>
                <p>
                    Deletion is not the same as destruction. With a self-destructing one-time link,
                    the data is cryptographically destroyed on first read — not just hidden from view.
                </p>

                <h2>What to Do Instead</h2>
                <p>
                    You can still use Slack as the delivery channel — just do not put the actual
                    password in the message. Replace the password with an encrypted one-time link:
                </p>
                <ol>
                    <li>Paste the password into <Link href="/">onetimelink.me</Link>.</li>
                    <li>Copy the encrypted one-time link.</li>
                    <li>Send the link in the Slack DM instead of the password.</li>
                    <li>The recipient clicks it, sees the password, and the link is permanently destroyed.</li>
                </ol>
                <p>
                    Now the Slack message only contains a link. After it is opened, the link is dead.
                    An attacker who gains access to the Slack workspace later finds only dead links
                    that reveal nothing.
                </p>

                <div className="diagram">
                    <div className="diagram-title">Password in Slack vs. one-time link in Slack</div>
                    <div className="diagram-flow">
                        <div className="diagram-step diagram-step-danger">
                            <span className="diagram-step-icon">💬</span>
                            <span className="diagram-step-label">Password in Slack</span>
                            <span className="diagram-step-desc">Readable forever</span>
                        </div>
                        <span className="diagram-arrow">vs</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔗</span>
                            <span className="diagram-step-label">Link in Slack</span>
                            <span className="diagram-step-desc">Dead after one click</span>
                        </div>
                    </div>
                </div>

                <h2>The Same Applies to Microsoft Teams</h2>
                <p>
                    Everything in this article applies equally to Microsoft Teams. Teams messages are
                    stored on Microsoft servers, searchable, accessible by admins through compliance
                    tools, and retained according to corporate policies. The risks are identical.
                </p>

                <h2>Quick Checklist for Your Team</h2>
                <ul>
                    <li>Never paste raw passwords, API keys, or tokens into Slack or Teams messages.</li>
                    <li>Always use an encrypted one-time link as the delivery mechanism.</li>
                    <li>Set the link to expire quickly (5-15 minutes for immediate shares).</li>
                    <li>Rotate any credentials that have been shared in plaintext in the past.</li>
                    <li>Search your Slack workspace for &quot;password&quot; — you might be surprised what you find.</li>
                </ul>

                <div className="article-cta">
                    <div className="article-cta-icon">💬</div>
                    <h2>Stop pasting passwords in Slack</h2>
                    <p>Send an encrypted one-time link instead. It takes 10 seconds and the password is destroyed after one view.</p>
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
                    <Link href="/blog/how-to-share-api-keys" className="related-article-card">
                        <span>How to Share API Keys Securely</span>
                        <span>Best practices for sharing tokens and keys with your team.</span>
                    </Link>
                    <Link href="/blog/how-to-send-passwords-over-email" className="related-article-card">
                        <span>How to Send Passwords Over Email</span>
                        <span>Why emailing passwords is dangerous and what to do instead.</span>
                    </Link>
                </div>
            </div>
        </article>
    );
}
