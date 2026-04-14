import Link from 'next/link';
import InlineCss from '../../../components/InlineCss';
import NewMessage from '../../../components/NewMessage';
import {siteHost, siteUrl} from '../../../utils/siteConfig';

export const metadata = {
    title: `Self-Destructing Links: How They Work + Free Generator | ${siteHost}`,
    description: 'Create a self-destructing link that deletes itself after one read. Free, end-to-end encrypted, zero-knowledge. Learn how self-destruct links work and generate one instantly.',
    alternates: { canonical: '/blog/self-destructing-messages-explained' },
    openGraph: {
        title: 'Self-Destructing Links: How They Work + Free Generator',
        description: 'Generate a free self-destructing link. End-to-end encrypted, one-time access, permanently deleted after reading.',
        url: '/blog/self-destructing-messages-explained',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Self-Destructing Link Generator' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Self-Destructing Links: How They Work + Free Generator',
        description: 'Generate a free self-destructing link. End-to-end encrypted, one-time access, permanently deleted after reading.',
    },
};

const faqItems = [
    {
        question: 'What is a self-destructing link?',
        answer: 'A self-destructing link is a URL that reveals its content exactly once. The moment the recipient opens it, the underlying data is permanently deleted from the server and the same link becomes a dead 404 forever after. 1time.io generates free self-destructing links that are end-to-end encrypted in your browser.',
    },
    {
        question: 'How do I create a self-destructing link?',
        answer: 'Paste your secret into the form at the top of this page, click the button to generate a one-time link, and copy it. Share the link with your recipient. When they open it, the secret is decrypted in their browser and the server immediately deletes the encrypted data. No signup, no account, free.',
    },
    {
        question: 'How long does a self-destructing link last?',
        answer: 'A self-destructing link expires the instant it is read — that is the "self-destruct" trigger. As a safety net, unread links also auto-expire after a configurable window (1 to 30 days on 1time.io) so nothing sits on the server forever if the recipient never opens it.',
    },
    {
        question: 'Is the self-destructing link generator free?',
        answer: 'Yes. 1time.io is free and open source (MIT licensed). There is no paid tier, no signup, no usage limits for normal sharing, and no ads. You can also self-host the source code from GitHub if you want full control.',
    },
    {
        question: 'Can a self-destructing link be recovered after it is read?',
        answer: 'No. Once the recipient opens the link, the ciphertext is deleted from the server and cannot be restored. There is no admin backdoor, no backup, and no recovery path — even we cannot retrieve it. If you lose access, you have to create a new link.',
    },
    {
        question: 'Are self-destructing links really deleted or just hidden?',
        answer: 'On 1time.io, the encrypted blob is deleted from the database at the moment of first read — not hidden, not archived, not flagged. The server never saw the plaintext in the first place because encryption happens in your browser and the decryption key lives only in the URL fragment, which is never transmitted to the server.',
    },
    {
        question: 'Can I send a self-destructing link from the terminal?',
        answer: 'Yes. 1time.io ships a CLI you can install with `npm install -g @1time/cli`. Use `printf \'secret\' | 1time send` to generate a self-destructing link directly from your shell or a CI/CD pipeline.',
    },
];

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Self-Destructing Links: How They Work + Free Generator',
        description: 'Create a self-destructing link that deletes itself after one read. Learn how self-destruct links work and generate one for free.',
        datePublished: '2025-12-08',
        dateModified: '2026-04-14',
        author: { '@type': 'Person', name: 'Igor Ermakov', url: `${siteUrl}/about/` },
        publisher: { '@type': 'Organization', name: siteHost, url: siteUrl, logo: { '@type': 'ImageObject', url: `${siteUrl}/logo-512.png`, width: 512, height: 512 } },
        mainEntityOfPage: `${siteUrl}/blog/self-destructing-messages-explained/`,
        image: [`${siteUrl}/og-image.png`],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog/` },
            { '@type': 'ListItem', position: 3, name: 'Self-Destructing Links: How They Work', item: `${siteUrl}/blog/self-destructing-messages-explained/` },
        ],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
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
                <span className="article-tag">How It Works</span>
                <h1>Self-Destructing Links: How They Work + Free Generator</h1>
                <p className="article-subtitle">
                    A self-destructing link reveals a secret once, then deletes itself forever.
                    Generate one below — or read on to learn exactly how self-destruct links work under the hood.
                </p>
                <div className="article-meta">By Igor Ermakov &middot; Updated Apr 14, 2026 &middot; 6 min read</div>
            </div>

            <div className="article-embed">
                <NewMessage />
            </div>

            <div className="article-body">
                <h2>What is a self-destructing link?</h2>
                <p>
                    A <strong>self-destructing link</strong> (also called a <em>self-destruct link</em>,{' '}
                    <em>one-time link</em>, or <em>disappearing link</em>) is a URL that reveals its content
                    exactly once. The moment the recipient opens it, the underlying data is permanently
                    deleted from the server. There is no cache, no backup, no second read — the link becomes
                    a dead 404 the instant it is used.
                </p>
                <p>
                    {siteHost} generates self-destructing links that are end-to-end encrypted in your browser
                    using AES-256-GCM. The decryption key lives in the URL fragment and never touches the
                    server, so even we cannot read what you share. Paste a secret above, hit the button, and
                    copy the one-time link — that is the whole flow.
                </p>

                <h2>The Concept: Why Messages Should Self-Destruct</h2>
                <p>
                    Most digital messages live forever by default. Emails sit in inboxes for years.
                    Slack messages are searchable indefinitely. Text messages get backed up to cloud
                    services. This persistence creates a massive attack surface — every stored message
                    is a potential leak in a future breach.
                </p>
                <p>
                    Self-destructing messages flip this model. Instead of storing data by default and
                    hoping it stays safe, they <strong>delete data by default</strong> and only make
                    it available for the minimum time needed. This is the principle of data minimization
                    — you cannot leak what you do not store.
                </p>

                <h2>The Three Types of "Disappearing" Messages</h2>
                <p>
                    Not all self-destructing messages work the same way. There are three distinct
                    approaches, and they offer very different levels of actual privacy.
                </p>

                <h3>Type 1: Timer-Based Deletion (Weakest)</h3>
                <p>
                    Apps like Snapchat and Instagram use timer-based deletion. The message displays
                    for a set number of seconds, then the app hides it from the interface. The problem?
                    The data often persists on the server, in backups, in device caches, or in
                    notification logs. Screenshots capture it trivially. This is <strong>UI-level
                    deletion</strong>, not data-level deletion.
                </p>

                <h3>Type 2: Time-to-Live Server Deletion (Better)</h3>
                <p>
                    Services like Signal and Telegram (secret chats) delete messages from their servers
                    after a set period. This is more robust — the data actually gets removed from the
                    server. But the message still exists on both devices until the timer expires, and
                    the sender has no control over what happens on the recipient device.
                </p>

                <h3>Type 3: One-Time Access with Immediate Deletion (Strongest)</h3>
                <p>
                    This is the approach used by one-time secret sharing tools. The message can only
                    be accessed once. The moment the recipient reads it, the server permanently deletes
                    the encrypted data. There is no window of vulnerability, no timer to beat, no
                    second chance. Read once, gone forever.
                </p>

                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>Feature</th>
                            <th>Timer-Based</th>
                            <th>TTL Server</th>
                            <th>One-Time Access</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Deleted from server</td>
                            <td><span className="cross">✗</span> Often retained</td>
                            <td><span className="check">✓</span> After timer</td>
                            <td><span className="check">✓</span> Immediately</td>
                        </tr>
                        <tr>
                            <td>Screenshot-proof</td>
                            <td><span className="cross">✗</span></td>
                            <td><span className="cross">✗</span></td>
                            <td><span className="cross">✗</span></td>
                        </tr>
                        <tr>
                            <td>End-to-end encrypted</td>
                            <td><span className="cross">✗</span> Usually not</td>
                            <td><span className="check">✓</span> Some apps</td>
                            <td><span className="check">✓</span> Always</td>
                        </tr>
                        <tr>
                            <td>Zero-knowledge server</td>
                            <td><span className="cross">✗</span></td>
                            <td><span className="partial">~</span> Varies</td>
                            <td><span className="check">✓</span></td>
                        </tr>
                        <tr>
                            <td>No account needed</td>
                            <td><span className="cross">✗</span></td>
                            <td><span className="cross">✗</span></td>
                            <td><span className="check">✓</span></td>
                        </tr>
                    </tbody>
                </table>

                <h2>Under the Hood: How 1time.io Self-Destructs</h2>
                <p>
                    Let us walk through exactly what happens when you create and share a self-destructing
                    message on 1time.io, step by step.
                </p>

                <div className="diagram">
                    <div className="diagram-title">Step 1 — Creating the message</div>
                    <div className="diagram-flow">
                        <div className="diagram-step">
                            <span className="diagram-step-icon">✍️</span>
                            <span className="diagram-step-label">You type a secret</span>
                            <span className="diagram-step-desc">In your browser</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔐</span>
                            <span className="diagram-step-label">Browser generates key</span>
                            <span className="diagram-step-desc">Random AES-GCM key</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔒</span>
                            <span className="diagram-step-label">Encrypted locally</span>
                            <span className="diagram-step-desc">Plaintext never leaves</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step">
                            <span className="diagram-step-icon">☁️</span>
                            <span className="diagram-step-label">Ciphertext stored</span>
                            <span className="diagram-step-desc">On server, no key</span>
                        </div>
                    </div>
                </div>

                <div className="diagram">
                    <div className="diagram-title">Step 2 — Reading and destruction</div>
                    <div className="diagram-flow">
                        <div className="diagram-step">
                            <span className="diagram-step-icon">🔗</span>
                            <span className="diagram-step-label">Recipient opens link</span>
                            <span className="diagram-step-desc">URL contains the key</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step">
                            <span className="diagram-step-icon">📥</span>
                            <span className="diagram-step-label">Fetch ciphertext</span>
                            <span className="diagram-step-desc">One-time retrieval</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔓</span>
                            <span className="diagram-step-label">Decrypt in browser</span>
                            <span className="diagram-step-desc">Key from URL hash</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🗑️</span>
                            <span className="diagram-step-label">Server deletes data</span>
                            <span className="diagram-step-desc">Permanent, immediate</span>
                        </div>
                    </div>
                </div>

                <h3>The Key Insight: Separation of Key and Data</h3>
                <p>
                    The critical design principle is that the <strong>encryption key never touches the
                    server</strong>. It lives only in the URL fragment (the part after the <code>#</code>
                    symbol), which browsers do not send to servers. The server stores only meaningless
                    ciphertext — even if the server is compromised, the attacker gets encrypted
                    gibberish with no way to decrypt it.
                </p>

                <div className="callout callout-tip">
                    <span className="callout-icon">💡</span>
                    <p>
                        <strong>Why the URL hash matters:</strong> When you visit
                        <code> example.com/v/#secretkey</code>, your browser sends a request for
                        <code> /v/</code> to the server. The <code>#secretkey</code> part
                        stays entirely in the browser. This is a fundamental web standard, not a
                        workaround — it is how URL fragments have always worked.
                    </p>
                </div>

                <h2>What "Zero-Knowledge" Really Means</h2>
                <p>
                    The term gets thrown around a lot, so let us be precise. A zero-knowledge
                    architecture means:
                </p>
                <ul>
                    <li><strong>The server never sees the plaintext.</strong> Encryption and decryption happen exclusively in the browser using the Web Crypto API.</li>
                    <li><strong>The server never sees the encryption key.</strong> It is embedded in the URL fragment, which is never transmitted to the server.</li>
                    <li><strong>Even the service operator cannot read your messages.</strong> There is no master key, no admin backdoor, no way to "recover" a lost secret.</li>
                    <li><strong>The source code proves it.</strong> Open-source tools let anyone verify these claims by reading the code.</li>
                </ul>

                <h2>The Limits of Self-Destruction</h2>
                <p>
                    No self-destructing message system is perfect. Here is what even the best
                    implementations cannot prevent:
                </p>
                <ul>
                    <li><strong>Screenshots.</strong> Once the recipient sees the message, they can take a screenshot. No technology prevents this.</li>
                    <li><strong>Copy-paste.</strong> The recipient can copy the decrypted text before the page is closed.</li>
                    <li><strong>Compromised devices.</strong> If the recipient device has malware or a keylogger, the secret is exposed regardless of encryption.</li>
                </ul>
                <p>
                    This is why self-destructing messages are a <strong>risk reduction</strong> tool,
                    not an absolute guarantee. They dramatically reduce the window of exposure
                    and eliminate the permanent storage risk, but they cannot control what happens
                    after the message is displayed on a screen.
                </p>

                <div className="callout callout-warning">
                    <span className="callout-icon">⚠️</span>
                    <p>
                        <strong>Be wary of apps that claim to be "screenshot-proof."</strong> Any app
                        that claims it can prevent screenshots is either misleading you or relies on
                        easily-bypassed device restrictions. The honest approach is to acknowledge
                        this limitation and focus on what can actually be secured: the transmission
                        and storage of data.
                    </p>
                </div>

                <h2>When to Use Self-Destructing Messages</h2>
                <p>
                    Self-destructing messages are ideal for sharing data that is <strong>needed
                    once and should not persist</strong>:
                </p>
                <ul>
                    <li>Passwords and login credentials</li>
                    <li>API keys and access tokens</li>
                    <li>Two-factor authentication backup codes</li>
                    <li>SSH keys and certificates</li>
                    <li>Sensitive personal information (SSNs, account numbers)</li>
                    <li>Temporary access codes or PINs</li>
                </ul>

                <h2>Frequently asked questions about self-destructing links</h2>
                {faqItems.map((item) => (
                    <section key={item.question}>
                        <h3>{item.question}</h3>
                        <p>{item.answer}</p>
                    </section>
                ))}

                <div className="article-cta">
                    <div className="article-cta-icon">💬</div>
                    <h2>Generate a self-destructing link</h2>
                    <p>End-to-end encrypted, zero-knowledge, destroyed after one read. Free, no signup.</p>
                    <Link href="/" className="btn btn-primary btn-lg">Create a self-destructing link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/blog/privnote-alternative" className="related-article-card">
                        <span>1time.io vs Privnote</span>
                        <span>Why encryption matters more than just deleting messages.</span>
                    </Link>
                    <Link href="/blog/how-to-share-passwords-securely" className="related-article-card">
                        <span>How to Share Passwords Securely</span>
                        <span>The complete guide to secure credential sharing.</span>
                    </Link>
                    <Link href="/blog/onetimesecret-alternative" className="related-article-card">
                        <span>1time.io vs OneTimeSecret</span>
                        <span>A transparent feature-by-feature comparison.</span>
                    </Link>
                </div>
            </div>
        </article>
        </>
    );
}
