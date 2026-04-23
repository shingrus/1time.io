import Link from 'next/link';
import InlineCss from '../../../components/InlineCss';

export const metadata = {
    title: 'Database Password Security Best Practices — 1time.io',
    description: 'Learn how to generate and manage strong database passwords. Covers PostgreSQL, MySQL, MongoDB, and Redis. Includes a free database password generator.',
    alternates: { canonical: '/blog/database-password-security' },
    openGraph: {
        title: 'Database Password Security Best Practices',
        description: 'How to generate, store, and share database credentials securely.',
        url: '/blog/database-password-security',
        images: [{ url: '/1time-og-main.png', width: 1200, height: 630, alt: 'Database Password Security' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Database Password Security Best Practices',
        description: 'How to generate, store, and share database credentials securely.',
        images: ['/1time-og-main.png'],
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Database Password Security Best Practices',
        description: 'Learn how to generate and manage strong database passwords for PostgreSQL, MySQL, MongoDB, and Redis.',
        datePublished: '2026-02-27',
        dateModified: '2026-03-21',
        author: { '@type': 'Person', name: 'Igor Ermakov', url: 'https://1time.io/about/' },
        publisher: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io', logo: { '@type': 'ImageObject', url: 'https://1time.io/logo-512.png', width: 512, height: 512 } },
        mainEntityOfPage: 'https://1time.io/blog/database-password-security/',
        image: ['https://1time.io/1time-og-main.png'],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://1time.io/blog/' },
            { '@type': 'ListItem', position: 3, name: 'Database Password Security', item: 'https://1time.io/blog/database-password-security/' },
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
                <span className="article-tag">DevOps</span>
                <h1>Database Password Security Best Practices</h1>
                <p className="article-subtitle">
                    Your database password is the front door to your application data.
                    Here is how to generate, store, rotate, and share database credentials without putting your data at risk.
                </p>
                <div className="article-meta">By Igor Ermakov &middot; Feb 27, 2026 &middot; 8 min read</div>
            </div>

            <div className="article-body">
                <h2>Why Database Passwords Are High-Value Targets</h2>
                <p>
                    A compromised database password gives an attacker direct access to your application data —
                    user records, payment information, emails, everything. Unlike an API endpoint, there is no
                    rate limiting, no WAF, no application-level access control. It is raw, unrestricted access.
                </p>
                <p>
                    Database breaches are consistently among the most expensive security incidents.
                    They also tend to go undetected for months because direct database access often
                    bypasses application-level logging.
                </p>

                <h2>Requirements by Database Engine</h2>
                <p>
                    Different databases have different password constraints and security features. Here is what
                    you need to know for the most common engines:
                </p>

                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>Database</th>
                            <th>Max Password Length</th>
                            <th>Character Restrictions</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>PostgreSQL</strong></td>
                            <td>1000 chars</td>
                            <td>None (any UTF-8)</td>
                            <td>Supports SCRAM-SHA-256 authentication</td>
                        </tr>
                        <tr>
                            <td><strong>MySQL</strong></td>
                            <td>Unlimited</td>
                            <td>None</td>
                            <td>Use caching_sha2_password plugin (default in 8.x)</td>
                        </tr>
                        <tr>
                            <td><strong>MongoDB</strong></td>
                            <td>Unlimited</td>
                            <td>Avoid colons in SCRAM auth</td>
                            <td>Enable SCRAM-SHA-256, disable legacy auth</td>
                        </tr>
                        <tr>
                            <td><strong>Redis</strong></td>
                            <td>512 chars</td>
                            <td>None</td>
                            <td>Use ACL system (Redis 6+) instead of single requirepass</td>
                        </tr>
                    </tbody>
                </table>

                <div className="callout callout-tip">
                    <span className="callout-icon">💡</span>
                    <p>
                        <strong>Pro tip:</strong> Avoid special characters that may cause issues in connection strings.
                        Characters like <code>@</code>, <code>:</code>, <code>/</code>, and <code>%</code> often need
                        URL encoding in connection URIs. Stick to alphanumeric plus safe symbols like
                        <code>-</code>, <code>_</code>, <code>.</code>, and <code>!</code>.
                    </p>
                </div>

                <h2>Generate a Database Password</h2>
                <p>
                    Use the generator below to create a strong database password. It is preset to 32 characters with
                    alphanumeric characters only — safe for connection strings without encoding issues.
                    Everything runs locally in your browser.
                </p>

                <p>
                    <Link href="/password-generator-16-characters" className="btn btn-primary">Generate a database password →</Link>
                </p>

                <h2>How to Store Database Passwords</h2>
                <p>
                    Database credentials should never be hardcoded in your application or committed to version control.
                    Here are the approaches, ranked from best to acceptable:
                </p>

                <h3>1. Secrets Manager (Best)</h3>
                <p>
                    Use a dedicated secrets manager like AWS Secrets Manager, Google Cloud Secret Manager,
                    HashiCorp Vault, or Doppler. These tools encrypt credentials at rest, provide audit logs,
                    support automatic rotation, and integrate with your deployment pipeline.
                </p>

                <h3>2. Environment Variables</h3>
                <p>
                    Store credentials in environment variables set by your deployment system (Kubernetes secrets,
                    Docker secrets, platform env vars). Better than config files, but no audit trail and rotation
                    requires redeployment.
                </p>

                <h3>3. Encrypted Config Files</h3>
                <p>
                    Tools like SOPS, git-crypt, or Ansible Vault encrypt config files before they are committed.
                    The decryption key is managed separately. Acceptable for smaller teams, but harder to rotate
                    and audit.
                </p>

                <div className="callout callout-warning">
                    <span className="callout-icon">⚠️</span>
                    <p>
                        <strong>Never do this:</strong> Do not store database passwords in <code>.env</code> files committed
                        to git, in Slack messages, in shared Google Docs, or in deployment scripts. These are the most
                        common sources of database credential leaks.
                    </p>
                </div>

                <h2>Sharing Database Credentials with Your Team</h2>
                <p>
                    There are legitimate reasons to share a database password: onboarding a new developer,
                    granting access to a DBA, or sharing staging credentials with a contractor. Here is the
                    safe way to do it:
                </p>
                <ul>
                    <li>
                        <strong>For one-time sharing:</strong> Use an <Link href="/">encrypted one-time link</Link>.
                        Paste the connection string, send the link, and it self-destructs after reading.
                        The server never sees the plaintext.
                    </li>
                    <li>
                        <strong>For ongoing access:</strong> Add the person to your secrets manager with their own
                        credentials. Never share a single password across the team.
                    </li>
                    <li>
                        <strong>For contractors:</strong> Create a separate database user with limited permissions.
                        Share the credentials via one-time link and revoke the user when the project ends.
                    </li>
                </ul>

                <h2>Password Rotation Strategy</h2>
                <p>
                    Rotating database passwords is critical but often neglected because it is disruptive.
                    Here is a practical rotation strategy:
                </p>
                <ol>
                    <li><strong>Automate it.</strong> If your secrets manager supports it, enable automatic rotation (AWS Secrets Manager does this natively for RDS).</li>
                    <li><strong>Use dual credentials.</strong> Create two database users. Rotate one while the other is active. Switch traffic, then rotate the other. Zero downtime.</li>
                    <li><strong>Rotate on events.</strong> Always rotate when a team member leaves, after a security incident, or when credentials may have been exposed.</li>
                    <li><strong>Set a schedule.</strong> At minimum, rotate every 90 days. For production databases with sensitive data, monthly is better.</li>
                </ol>

                <h2>Connection String Security Checklist</h2>
                <ul>
                    <li>Always use TLS/SSL for database connections — <code>sslmode=require</code> in PostgreSQL, <code>--ssl-mode=REQUIRED</code> in MySQL</li>
                    <li>Use connection pooling (PgBouncer, ProxySQL) to limit direct database exposure</li>
                    <li>Restrict database access to specific IP ranges or VPC/VPN</li>
                    <li>Use separate credentials per service and environment (dev, staging, prod)</li>
                    <li>Log all connection attempts and set up alerts for unknown IPs</li>
                    <li>Disable default accounts (postgres, root, admin) and create named users</li>
                </ul>

                <div className="article-cta">
                    <div className="article-cta-icon">🔒</div>
                    <h2>Need to share database credentials?</h2>
                    <p>Create an encrypted one-time link that self-destructs after reading. No signup, no tracking, end-to-end encrypted.</p>
                    <Link href="/" className="btn btn-primary btn-lg">Create a secure link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/blog/how-to-share-api-keys" className="related-article-card">
                        <span>How to Share API Keys Securely</span>
                        <span>Safe ways to share tokens and keys with your team.</span>
                    </Link>
                    <Link href="/blog/team-password-sharing" className="related-article-card">
                        <span>Team Password Sharing Without a Password Manager</span>
                        <span>Practical approaches for small teams.</span>
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
