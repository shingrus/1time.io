import Link from 'next/link';
import InlineCss from '../../../components/InlineCss';

export const metadata = {
    title: 'How to Share API Keys Securely with Your Team — 1time.io',
    description: 'Learn how to share API keys, tokens, and secrets with developers safely. Stop pasting credentials in Slack and use encrypted one-time links instead.',
    alternates: { canonical: '/blog/how-to-share-api-keys' },
    openGraph: {
        title: 'How to Share API Keys Securely with Your Team',
        description: 'API keys in Slack channels are a security disaster. Here is the safe way to share credentials with developers.',
        url: '/blog/how-to-share-api-keys',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'How to Share API Keys Securely' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'How to Share API Keys Securely with Your Team',
        description: 'API keys in Slack channels are a security disaster. Here is the safe way to share credentials with developers.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'How to Share API Keys Securely with Your Team',
        description: 'Learn how to share API keys, tokens, and secrets with developers safely. Stop pasting credentials in Slack and use encrypted one-time links instead.',
        datePublished: '2026-01-13',
        dateModified: '2026-03-20',
        author: { '@type': 'Person', name: 'Igor Ermakov', url: 'https://1time.io/about/' },
        publisher: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io', logo: { '@type': 'ImageObject', url: 'https://1time.io/logo-512.png', width: 512, height: 512 } },
        mainEntityOfPage: 'https://1time.io/blog/how-to-share-api-keys/',
        image: ['https://1time.io/og-image.png'],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://1time.io/blog/' },
            { '@type': 'ListItem', position: 3, name: 'How to Share API Keys Securely', item: 'https://1time.io/blog/how-to-share-api-keys/' },
        ],
    },
];

export default function Article() {
    return (
        <>
            <InlineCss file="styles/article.css" />
            <article className="article">
            {jsonLd.map((schema, i) => (
                <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
            ))}
            <div className="article-header">
                <span className="article-tag">Guide</span>
                <h1>How to Share API Keys Securely with Your Team</h1>
                <p className="article-subtitle">
                    Every developer has done it: pasted an API key into Slack, a GitHub issue, or an
                    email. Here is why that is a serious risk and how to share credentials safely.
                </p>
                <div className="article-meta">By Igor Ermakov &middot; Jan 13, 2026 &middot; 7 min read</div>
            </div>

            <div className="article-body">
                <h2>The API Key Problem</h2>
                <p>
                    API keys are the passwords of the developer world. They grant access to databases,
                    cloud infrastructure, payment systems, and third-party services. A leaked API key
                    can cost real money — from unexpected cloud bills to exposed customer data.
                </p>
                <p>
                    Yet most teams share them the same way they share everything else: copy-paste into
                    a chat message. The key ends up stored permanently in a Slack workspace, an email
                    archive, or a Confluence page that half the company can access.
                </p>

                <div className="callout callout-warning">
                    <span className="callout-icon">⚠️</span>
                    <p>
                        <strong>Real cost:</strong> Exposed AWS keys are routinely exploited within minutes
                        of being published. Automated bots scan public repositories and paste sites for
                        key patterns. A single leaked key can generate thousands of dollars in unauthorized
                        cloud usage within hours.
                    </p>
                </div>

                <h2>Common Mistakes When Sharing API Keys</h2>
                <ol>
                    <li><strong>Slack or Teams messages</strong> — Stored forever in workspace history, searchable by admins and compliance tools.</li>
                    <li><strong>Git commits</strong> — Even if you delete the key in a later commit, it remains in git history forever unless you rewrite the entire branch.</li>
                    <li><strong>.env files in shared drives</strong> - No access controls, no audit trail, often shared with the entire team.</li>
                    <li><strong>Confluence or Notion pages</strong> — Wikis are designed for sharing, not secrets. Anyone with workspace access can find them.</li>
                    <li><strong>GitHub issues or PRs</strong> — Public by default on open source projects. Even on private repos, all collaborators can see them.</li>
                </ol>

                <h2>The Right Way to Share API Keys</h2>
                <p>
                    There are three tiers of solutions, depending on your team size and infrastructure maturity.
                </p>

                <h3>Tier 1: One-Time Links (Quick and Secure)</h3>
                <p>
                    For ad-hoc sharing — onboarding a new developer, giving a contractor access,
                    sharing a key with a teammate who needs it right now — one-time links are the
                    fastest secure option.
                </p>
                <ol>
                    <li>Paste the API key into the <Link href="/share-password-securely/">secure password sharing flow</Link>.</li>
                    <li>Set a short expiration (5-15 minutes is usually plenty).</li>
                    <li>Send the link to your teammate via any channel.</li>
                    <li>The key is destroyed after they view it. Nothing persists.</li>
                </ol>
                <p>
                    The key is encrypted in your browser with AES-GCM before being sent to the server.
                    The server never sees the plaintext key. The decryption key exists only in the URL
                    fragment, which browsers never send to servers.
                </p>

                <h3>Tier 2: Secrets Managers (Automated and Scalable)</h3>
                <p>
                    For production infrastructure, use a dedicated secrets manager like HashiCorp Vault,
                    AWS Secrets Manager, Google Secret Manager, or Doppler. These tools:
                </p>
                <ul>
                    <li>Inject secrets directly into applications at runtime.</li>
                    <li>Provide audit logs of who accessed what and when.</li>
                    <li>Support automatic key rotation.</li>
                    <li>Eliminate the need for humans to ever see or type the key.</li>
                </ul>

                <h3>Tier 3: Environment-Specific Configuration</h3>
                <p>
                    For development environments, use <code>.env</code> files that are gitignored and
                    never committed. Share the initial values via one-time links, then each developer
                    manages their own local copy.
                </p>
                <p>
                    Need to share an entire <code>.env</code> file, a service account JSON, or a PEM
                    certificate? Use <Link href="/secure-file-sharing/">secure file sharing</Link> to
                    send the file through an encrypted one-time download link.
                </p>

                <h2>Best Practices for API Key Security</h2>
                <ul>
                    <li><strong>Use the principle of least privilege.</strong> Give each key only the permissions it needs. Never share a root or admin key when a scoped key would work.</li>
                    <li><strong>Rotate keys regularly.</strong> Set a rotation schedule and stick to it. At minimum, rotate keys when someone leaves the team.</li>
                    <li><strong>Use separate keys per environment.</strong> Development, staging, and production should never share the same keys.</li>
                    <li><strong>Monitor for leaks.</strong> Use tools like GitGuardian or GitHub secret scanning to detect accidentally committed credentials.</li>
                    <li><strong>Set expiration dates.</strong> Where possible, use short-lived tokens or keys with built-in expiration.</li>
                </ul>

                <div className="callout callout-tip">
                    <span className="callout-icon">💡</span>
                    <p>
                        <strong>Quick rule:</strong> If an API key is important enough to keep secret,
                        it is important enough to share securely. The 10 seconds it takes to create
                        an encrypted link is always worth it.
                    </p>
                </div>

                <p>
                    Need to generate a new API key? Use our <Link href="/api-key-generator">API Key Generator</Link> to
                    create cryptographically random tokens directly in your browser.
                </p>

                <div className="article-cta">
                    <div className="article-cta-icon">🔑</div>
                    <h2>Share API keys without the risk</h2>
                    <p>Encrypted in your browser, destroyed after one view. The server never sees your key.</p>
                    <Link href="/share-password-securely/" className="btn btn-primary btn-lg">Create a secure link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/share-password-securely/" className="related-article-card">
                        <span>Share Passwords and API Keys Securely</span>
                        <span>Create an encrypted one-time link for a key, token, or password.</span>
                    </Link>
                    <Link href="/secure-file-sharing/" className="related-article-card">
                        <span>Secure File Sharing</span>
                        <span>Send .env files, certificates, and config exports through one-time download links.</span>
                    </Link>
                    <Link href="/blog/how-to-share-passwords-securely" className="related-article-card">
                        <span>How to Share Passwords Securely</span>
                        <span>The complete guide to secure credential sharing.</span>
                    </Link>
                </div>
            </div>
        </article>
        </>
    );
}
