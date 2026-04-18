import Link from 'next/link';
import InlineCss from '../../../components/InlineCss';

export const metadata = {
    title: 'Stop Sending Passwords Over Slack: Here\'s What I Built Instead — 1time.io',
    description: 'I caught plaintext credentials sitting in our Slack history for months. So I built an open-source zero-knowledge secret sharing tool. Here\'s the full story.',
    alternates: { canonical: '/blog/stop-sending-passwords-over-slack' },
    openGraph: {
        type: 'article',
        title: 'Stop Sending Passwords Over Slack: Here\'s What I Built Instead',
        description: 'I caught plaintext credentials sitting in our Slack history for months. So I built an open-source secret sharing tool with real zero-knowledge encryption.',
        url: '/blog/stop-sending-passwords-over-slack',
        images: [{ url: '/1time-og-c1.png', width: 1200, height: 630, alt: 'Stop Sending Passwords Over Slack' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Stop Sending Passwords Over Slack: Here\'s What I Built Instead',
        description: 'I caught plaintext credentials sitting in our Slack history for months. So I built an open-source secret sharing tool with real zero-knowledge encryption.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Stop Sending Passwords Over Slack: Here\'s What I Built Instead',
        description: 'I caught plaintext credentials sitting in our Slack history for months. So I built an open-source zero-knowledge secret sharing tool. Here\'s the full story.',
        datePublished: '2026-03-31',
        dateModified: '2026-03-31',
        author: { '@type': 'Person', name: 'Igor Ermakov', url: 'https://1time.io/about/' },
        publisher: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io', logo: { '@type': 'ImageObject', url: 'https://1time.io/logo-512.png', width: 512, height: 512 } },
        mainEntityOfPage: 'https://1time.io/blog/stop-sending-passwords-over-slack/',
        image: ['https://1time.io/1time-og-c1.png'],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://1time.io/blog/' },
            { '@type': 'ListItem', position: 3, name: 'Stop Sending Passwords Over Slack', item: 'https://1time.io/blog/stop-sending-passwords-over-slack/' },
        ],
    },
];

function EncryptionFlowDiagram() {
    return (
        <div className="diagram">
            <div className="diagram-title">The Encryption Flow</div>
            <img
                className="blog-diagram-image"
                src="/blogs/diag1-stop-share-slack.png"
                alt="Three-column encryption flow showing the sender browser encrypting locally, the server storing only ciphertext, and the recipient browser decrypting locally"
                width="782"
                height="680"
            />
        </div>
    );
}

function ServerSeesDiagram() {
    return (
        <div
            className="diagram trust-diagram"
            role="img"
            aria-label="Two-column comparison showing what the server can see versus what the server cannot see"
        >
            <div className="diagram-title">What the Server Sees</div>
            <div className="trust-diagram-grid">
                <section className="trust-diagram-panel trust-diagram-panel-neutral">
                    <div className="trust-diagram-panel-title">
                        <span aria-hidden="true">✅</span>
                        <span>Server Can See</span>
                    </div>
                    <ul className="trust-diagram-list">
                        <li>Encrypted blob</li>
                        <li>Hashed auth token</li>
                        <li>Expiry timer (TTL)</li>
                        <li>Request timestamp</li>
                        <li>IP address (14d logs)</li>
                    </ul>
                </section>
                <section className="trust-diagram-panel trust-diagram-panel-secure">
                    <div className="trust-diagram-panel-title">
                        <span aria-hidden="true">🔒</span>
                        <span>Server Cannot See</span>
                    </div>
                    <ul className="trust-diagram-list">
                        <li>Your message</li>
                        <li>Encryption key</li>
                        <li>URL fragment (#)</li>
                        <li>Who reads it</li>
                        <li>What it says</li>
                    </ul>
                </section>
            </div>
        </div>
    );
}

function ArchitectureDiagram() {
    return (
        <div className="diagram">
            <div className="diagram-title">Architecture — 3 Docker Containers</div>
            <img
                className="blog-diagram-image"
                src="/blogs/diag3-stop-share-slack.png"
                alt="Architecture diagram showing browser-side encryption before traffic reaches Docker Compose with Nginx, Go API, and Redis"
                width="945"
                height="546"
            />
        </div>
    );
}

export default function Article() {
    return (
        <>
            <InlineCss file="styles/article.css" />
            <article className="article article-wide">
            {jsonLd.map((schema, i) => (
                <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
            ))}
            <div className="article-header">
                <span className="article-tag">DevOps</span>
                <h1>Stop Sending Passwords Over Slack: Here&apos;s What I Built Instead</h1>
                <p className="article-subtitle">
                    I caught plaintext credentials sitting in our Slack history for months.
                    So I built an open-source tool that encrypts secrets in the browser and
                    destroys them after one read.
                </p>
                <div className="article-meta">By Igor Ermakov &middot; Mar 31, 2026 &middot; 8 min read</div>
            </div>

            <div className="article-body">
                <p>
                    We&apos;ve all done it. A contractor needs access to the staging database. You open
                    Slack, type the password, hit send. Maybe you add &quot;delete this after&quot; — as
                    if that means anything.
                </p>
                <p>
                    I ran into this problem on my own team. We needed to send tokens, API keys, and
                    database credentials to contractors. Regularly. And every time, the same awkward
                    dance: a Slack DM, an email, or — worst case — a shared Google Doc called
                    &quot;Credentials (DO NOT SHARE).&quot;
                </p>
                <p>
                    One day I searched our Slack history for &quot;password&quot; and found credentials
                    from six months ago sitting in plaintext. Anyone with workspace access could read
                    them. That was the moment I decided to build something.
                </p>

                <h2>The Problem Nobody Talks About</h2>
                <p>
                    If your team uses a password manager like Bitwarden or 1Password, you&apos;re
                    covered <em>internally</em>. You share a vault, everyone has access, life is good.
                </p>
                <p>
                    But what about the contractor who&apos;s not in your password manager? The
                    client&apos;s developer who needs an API key for a week? The new hire on day one,
                    before they even have Bitwarden set up?
                </p>
                <p>
                    <strong>That&apos;s the gap.</strong> The last mile of credential sharing where
                    your password manager can&apos;t reach.
                </p>
                <p>Most teams solve it with:</p>
                <ul>
                    <li><strong>Slack DMs</strong> — searchable, persistent, visible to workspace admins</li>
                    <li><strong>Email</strong> — forwarded, backed up, sitting in inboxes forever</li>
                    <li><strong>Shared docs</strong> — no expiry, no access control, no audit trail</li>
                    <li><strong>SMS</strong> — unencrypted, stored by carriers</li>
                </ul>
                <p>
                    All of these leave secrets lying around long after they&apos;re needed.
                </p>

                <h2>What I Wanted</h2>
                <p>Simple requirements:</p>
                <ol>
                    <li><strong>Encrypt in the browser</strong> — the server should never see the plaintext</li>
                    <li><strong>One-time read</strong> — link works once, then the data is gone forever</li>
                    <li><strong>No signup</strong> — the recipient shouldn&apos;t need an account</li>
                    <li><strong>Self-hostable</strong> — I want to control where my secrets live</li>
                    <li><strong>CLI support</strong> — because I live in the terminal</li>
                </ol>
                <p>
                    I looked at existing tools. <Link href="/blog/onetimesecret-alternative/">OneTimeSecret</Link> has
                    been around forever, but its encryption happens server-side — the server sees your
                    plaintext before encrypting it. <Link href="/blog/privnote-alternative/">Privnote</Link> works
                    but there&apos;s no self-hosting option and the security model is
                    opaque. Yopass is solid but lacks a CLI and built-in generators.
                </p>
                <p>
                    So I built <Link href="/">1time.io</Link>.
                </p>

                <h2>How It Works</h2>

                <p>
                    The core idea is zero-knowledge encryption. The server never sees your secret.
                </p>
                <h3>Here&apos;s the flow</h3>
                <EncryptionFlowDiagram />

                <h3>When you create a secret</h3>
                <ol>
                    <li>Your browser generates a random 20-character key</li>
                    <li>The key is fed through <Link href="/blog/hkdf-key-derivation-explained/">HKDF-SHA256</Link> to
                        derive two things: an <strong>encryption key</strong> and an <strong>auth token</strong></li>
                    <li>Your message is encrypted with AES-256-GCM using the derived key</li>
                    <li>The browser sends the <strong>encrypted blob + auth token</strong> to the server</li>
                    <li>The server stores it and returns a storage ID</li>
                    <li>Your browser builds the link: <code>https://1time.io/v/#[key][storageId]</code></li>
                </ol>

                <p>
                    The critical part: <strong>the decryption key lives in the URL
                    fragment</strong> (the part after <code>#</code>). URL fragments are never sent
                    to the server. Not in the HTTP request, not in server logs, not anywhere. The
                    server only ever sees ciphertext.
                </p>

                <h3>When the recipient opens the link</h3>
                <ol>
                    <li>Their browser extracts the key from the URL fragment</li>
                    <li>Derives the same auth token using HKDF</li>
                    <li>Requests the encrypted message from the server (using the auth token)</li>
                    <li>Server returns the ciphertext and <strong>deletes it permanently</strong></li>
                    <li>Browser decrypts locally and displays the message</li>
                </ol>

                <p>
                    After step 4, the data is gone from the server. Even if someone gets the link
                    later, there&apos;s nothing to retrieve.
                </p>

                <ServerSeesDiagram />

                <p>
                    This is what &quot;zero-knowledge&quot; actually means. Not a marketing
                    term — a verifiable architectural property. You can read the{' '}
                    <a href="https://github.com/shingrus/1time" target="_blank" rel="noopener noreferrer">
                    source code</a> and verify it yourself.
                </p>

                <h2>The Tech Stack</h2>

                <p>
                    I built this solo. The whole thing is deliberately minimal:
                </p>
                <ul>
                    <li>
                        <strong>Backend:</strong> Go standard library. No frameworks, no ORM. About
                        1,000 lines of code handling three API endpoints.
                    </li>
                    <li>
                        <strong>Storage:</strong> Redis with TTL-based auto-expiry. Secrets expire
                        even if nobody reads them (1 to 30 days, your choice).
                    </li>
                    <li>
                        <strong>Frontend:</strong> Next.js, statically exported. Encryption happens
                        via the Web Crypto API — the same primitives your browser uses for HTTPS.
                    </li>
                    <li>
                        <strong>CLI:</strong> Node.js, published
                        as <code>@1time/cli</code> on npm.
                    </li>
                </ul>
                <p>
                    No third-party analytics. No cookies. No tracking scripts. The{' '}
                    <Link href="/privacy/">privacy policy</Link> is short because there&apos;s
                    nothing to disclose.
                </p>

                <h2>Self-Host It in 2 Minutes</h2>

                {/* DIAGRAM 3: Architecture — 3 Docker containers */}

                <p>
                    The whole thing runs as three Docker containers: Nginx (static frontend),
                    Go API (three endpoints), and Redis (TTL expiry). Pre-built images for
                    amd64 and arm64.
                </p>
                <ArchitectureDiagram />

                <pre><code>{`curl -O https://raw.githubusercontent.com/shingrus/1time/master/docker-compose.yml
curl -O https://raw.githubusercontent.com/shingrus/1time/master/.env.example
cp .env.example .env
# Set APP_HOSTNAME to your domain
docker compose up -d`}</code></pre>

                <p>
                    The <code>.env</code> file has four variables:
                </p>

                <pre><code>{`DATA_DIR=./data
APP_HOSTNAME=your-domain.com
APP_PORT=8080
SHOW_BLOG=false`}</code></pre>

                <p>Your secrets, your server, your rules.</p>

                <h2>Use It from the Terminal</h2>
                <p>
                    If you&apos;re like me and prefer not to leave the terminal:
                </p>

                <pre><code>{`npm install -g @1time/cli`}</code></pre>

                <p>Pipe a secret directly:</p>
                <pre><code>{`printf 'sk_live_abc123' | 1time send
# → https://1time.io/v/#aBcDeFgHiJkLmNoPqRsT...`}</code></pre>

                <p>Read a secret:</p>
                <pre><code>{`1time read 'https://1time.io/v/#aBcDeFgHiJkLmNoPqRsT...'
# → sk_live_abc123`}</code></pre>

                <p>Point it at your self-hosted instance:</p>
                <pre><code>{`1TIME_SECRET="$DB_PASSWORD" 1time send --host your-domain.com`}</code></pre>

                <p>
                    Check out the full <Link href="/blog/share-secrets-from-terminal/">CLI guide</Link> for
                    more examples.
                </p>

                <h2>What It&apos;s Not</h2>
                <p>Let me be honest about what 1time.io doesn&apos;t replace:</p>
                <ul>
                    <li>
                        <strong>It&apos;s not a password manager.</strong> Use Bitwarden, 1Password, or
                        KeePass for storing and sharing credentials within your team.
                    </li>
                    <li>
                        <strong>It&apos;s not a secrets manager.</strong> Use Vault, AWS Secrets
                        Manager, or Doppler for application secrets in your infrastructure.
                    </li>
                    <li>
                        <strong>It&apos;s not for recurring access.</strong> If someone needs a
                        credential repeatedly, give them proper access.
                    </li>
                </ul>
                <p>
                    1time.io solves one specific problem: <strong>sending a secret to someone
                    one time, securely, without leaving a trace.</strong> That goes for text
                    secrets and for <Link href="/secure-file-sharing/">encrypted file sharing</Link> — same
                    zero-knowledge model, one-time download, auto-expiry.
                </p>
                <p>
                    The contractor who needs the staging DB password. The client&apos;s developer
                    who needs your API key. The new hire who needs the WiFi password before their
                    accounts are set up.
                </p>

                <h2>Try It</h2>
                <p>
                    The hosted version is free at <Link href="/">1time.io</Link> — no signup, no
                    tracking, no limits.
                </p>
                <p>
                    The source code is on{' '}
                    <a href="https://github.com/shingrus/1time" target="_blank" rel="noopener noreferrer">
                    GitHub</a> — MIT licensed, ~1,000 lines of Go, zero-dependency backend.
                </p>
                <p>
                    If you have questions about the crypto implementation, the code is
                    open — read it, audit it, break it. That&apos;s the point of open source.
                </p>

                <div className="article-cta">
                    <div className="article-cta-icon">🔒</div>
                    <h2>Share a secret without leaving a trace</h2>
                    <p>Create an encrypted one-time link. It takes 10 seconds and self-destructs after one read.</p>
                    <Link href="/" className="btn btn-primary btn-lg">Create a secure link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/blog/is-slack-safe-for-passwords" className="related-article-card">
                        <span>Is Slack Safe for Sharing Passwords?</span>
                        <span>Slack stores messages forever and admins can read DMs. Here&apos;s why that matters.</span>
                    </Link>
                    <Link href="/blog/how-to-share-api-keys" className="related-article-card">
                        <span>How to Share API Keys Securely</span>
                        <span>Best practices for sharing tokens and keys with your team.</span>
                    </Link>
                    <Link href="/blog/share-secrets-from-terminal" className="related-article-card">
                        <span>Share Secrets from the Terminal</span>
                        <span>Use the 1time CLI to share encrypted secrets without leaving your terminal.</span>
                    </Link>
                </div>
            </div>
        </article>
        </>
    );
}
