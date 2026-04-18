import Link from 'next/link';
import InlineCss from '../../../components/InlineCss';

export const metadata = {
    title: 'Firefox Send Alternative — Encrypted One-Time File Sharing | 1time.io',
    description: 'Firefox Send was shut down in 2020. 1time.io offers the same encrypted one-time file sharing with browser-side encryption, optional passphrase, and self-hosting.',
    alternates: { canonical: '/blog/firefox-send-alternative' },
    openGraph: {
        type: 'article',
        title: 'Firefox Send Alternative — Encrypted File Sharing That Still Works',
        description: 'Firefox Send is gone. 1time.io picks up where it left off: encrypted one-time file sharing with zero-knowledge architecture.',
        url: '/blog/firefox-send-alternative',
        images: [{ url: '/1time-og-c1.png', width: 1200, height: 630, alt: 'Firefox Send Alternative — 1time.io' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Firefox Send Alternative — Encrypted File Sharing That Still Works',
        description: 'Firefox Send is gone. 1time.io picks up where it left off: encrypted one-time file sharing with zero-knowledge architecture.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Firefox Send Alternative — Encrypted One-Time File Sharing',
        description: 'Firefox Send was shut down in 2020. 1time.io offers the same encrypted one-time file sharing with browser-side encryption, optional passphrase, and self-hosting.',
        datePublished: '2026-04-04',
        dateModified: '2026-04-04',
        author: { '@type': 'Person', name: 'Igor Ermakov', url: 'https://1time.io/about/' },
        publisher: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io', logo: { '@type': 'ImageObject', url: 'https://1time.io/logo-512.png', width: 512, height: 512 } },
        mainEntityOfPage: 'https://1time.io/blog/firefox-send-alternative/',
        image: ['https://1time.io/1time-og-c1.png'],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://1time.io/blog/' },
            { '@type': 'ListItem', position: 3, name: 'Firefox Send Alternative', item: 'https://1time.io/blog/firefox-send-alternative/' },
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
                <span className="article-tag">Comparison</span>
                <h1>Firefox Send Alternative — Encrypted One-Time File Sharing</h1>
                <p className="article-subtitle">
                    Firefox Send was one of the best ways to share files securely. Mozilla shut it
                    down in 2020. Here is what happened, what the alternatives look like, and why
                    we built a replacement.
                </p>
                <div className="article-meta">By Igor Ermakov &middot; Apr 4, 2026 &middot; 6 min read</div>
            </div>

            <div className="article-body">
                <div className="callout callout-tip">
                    <span className="callout-icon">&#x1F4C1;</span>
                    <p>
                        <strong>Looking for a quick replacement?</strong>{' '}
                        <Link href="/secure-file-sharing/">Try secure file sharing</Link> — encrypted
                        one-time file links, no account needed.
                    </p>
                </div>

                <h2>What Was Firefox Send?</h2>
                <p>
                    Firefox Send launched in 2019 as a free, encrypted file sharing service by Mozilla.
                    The concept was simple: upload a file, get a link, the file gets deleted after download
                    or after a set expiry time. Files were encrypted in the browser before upload, so
                    Mozilla&apos;s servers never saw the contents.
                </p>
                <p>
                    It was fast, free, required no account (for files under 1 GB), and backed by a name
                    people trusted. For anyone who needed to share a file without leaving it sitting in
                    email or a cloud drive forever, Firefox Send was the answer.
                </p>

                <h2>Why Did Mozilla Kill Firefox Send?</h2>
                <p>
                    In September 2020, Mozilla permanently shut down Firefox Send. The reason: abuse.
                    Malware distributors had started using the service to host payloads. The encrypted,
                    ephemeral nature that made it great for privacy also made it attractive for distributing
                    malicious files that were hard to scan or take down.
                </p>
                <p>
                    Mozilla took it offline &quot;temporarily&quot; to add abuse reporting, but it never
                    came back. The project was archived and the service was discontinued for good.
                </p>

                <div className="callout callout-warning">
                    <span className="callout-icon">&#x26A0;&#xFE0F;</span>
                    <p>
                        <strong>The abuse problem is real.</strong> Any encrypted file sharing tool faces this
                        tension. The solution is not to avoid encryption but to add size limits, rate limiting,
                        and short default expiry times that make the tool useful for legitimate one-off sharing
                        but impractical for large-scale abuse.
                    </p>
                </div>

                <h2>What People Liked About Firefox Send</h2>
                <ul>
                    <li><strong>Browser-side encryption</strong> — files were encrypted before upload, so the server never saw the contents.</li>
                    <li><strong>One-time download links</strong> — you could set the link to expire after a single download.</li>
                    <li><strong>No account required</strong> — for files under 1 GB, you could share without signing up.</li>
                    <li><strong>Password protection</strong> — optional extra passphrase for the download link.</li>
                    <li><strong>Expiry controls</strong> — set the link to expire after a number of downloads or a time period.</li>
                    <li><strong>Trusted brand</strong> — backed by Mozilla, a nonprofit known for fighting for user privacy.</li>
                </ul>
                <p>
                    If you are searching for a Firefox Send alternative, you are probably looking for
                    something with most or all of these properties.
                </p>

                <h2>Common Firefox Send Alternatives (and Their Tradeoffs)</h2>

                <h3>WeTransfer</h3>
                <p>
                    WeTransfer is popular for sending large files but has no end-to-end encryption. Files
                    are stored on WeTransfer servers in a form the company can access. Links expire after
                    7 days (free) or are configurable on paid plans. Not a privacy tool — it is a convenience
                    tool.
                </p>

                <h3>OnionShare</h3>
                <p>
                    OnionShare routes transfers through the Tor network and is fully open source. Great for
                    high-threat-model use cases. The downside: both sender and recipient need to install
                    software, the sender&apos;s computer must stay online during the transfer, and Tor speeds
                    are slow. Not practical for quick everyday sharing.
                </p>

                <h3>Wormhole (magic-wormhole)</h3>
                <p>
                    A peer-to-peer encrypted transfer tool. Excellent for developers comfortable with
                    the command line. Requires both parties to be online simultaneously and use a terminal.
                    Not usable by non-technical recipients.
                </p>

                <h3>Send (send.vis.ee and forks)</h3>
                <p>
                    Community forks of the original Firefox Send codebase. Some are still running, but
                    they rely on volunteer hosting with no guarantees of uptime, maintenance, or security
                    updates. The original codebase is archived and no longer receives patches.
                </p>

                <h2>1time.io as a Firefox Send Alternative</h2>
                <p>
                    We built <Link href="/secure-file-sharing/">secure file sharing on 1time.io</Link> to
                    solve the same problem Firefox Send did: share a file once, securely, without it
                    lingering on a server. Here is how it compares.
                </p>

                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>Feature</th>
                            <th>1time.io</th>
                            <th>Firefox Send (was)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Status</strong></td>
                            <td><span className="check">&#x2713;</span> Active</td>
                            <td><span className="cross">&#x2717;</span> Shut down (Sep 2020)</td>
                        </tr>
                        <tr>
                            <td><strong>Browser-side encryption</strong></td>
                            <td><span className="check">&#x2713;</span> AES-256-GCM</td>
                            <td><span className="check">&#x2713;</span> AES-128-GCM</td>
                        </tr>
                        <tr>
                            <td><strong>Zero-knowledge</strong></td>
                            <td><span className="check">&#x2713;</span> Key in URL hash only</td>
                            <td><span className="check">&#x2713;</span> Key in URL hash</td>
                        </tr>
                        <tr>
                            <td><strong>One-time download</strong></td>
                            <td><span className="check">&#x2713;</span> Always one-time</td>
                            <td><span className="partial">~</span> Configurable (1-100 downloads)</td>
                        </tr>
                        <tr>
                            <td><strong>Password protection</strong></td>
                            <td><span className="check">&#x2713;</span></td>
                            <td><span className="check">&#x2713;</span></td>
                        </tr>
                        <tr>
                            <td><strong>Max file size</strong></td>
                            <td>10 MB</td>
                            <td>1 GB (no account) / 2.5 GB (account)</td>
                        </tr>
                        <tr>
                            <td><strong>Account required</strong></td>
                            <td><span className="check">&#x2713;</span> Never</td>
                            <td><span className="check">&#x2713;</span> Not for files under 1 GB</td>
                        </tr>
                        <tr>
                            <td><strong>Text secret sharing</strong></td>
                            <td><span className="check">&#x2713;</span> Built-in</td>
                            <td><span className="cross">&#x2717;</span> Files only</td>
                        </tr>
                        <tr>
                            <td><strong>Self-hostable</strong></td>
                            <td><span className="check">&#x2713;</span> Docker Compose</td>
                            <td><span className="partial">~</span> Was self-hostable</td>
                        </tr>
                        <tr>
                            <td><strong>Open source</strong></td>
                            <td><span className="check">&#x2713;</span> MIT license</td>
                            <td><span className="check">&#x2713;</span> MPL 2.0 (archived)</td>
                        </tr>
                        <tr>
                            <td><strong>CLI</strong></td>
                            <td><span className="check">&#x2713;</span> npm @1time/cli</td>
                            <td><span className="cross">&#x2717;</span></td>
                        </tr>
                    </tbody>
                </table>

                <h2>Where Firefox Send Had the Edge</h2>
                <ul>
                    <li><strong>File size.</strong> Firefox Send supported files up to 2.5 GB. 1time.io currently supports up to 10 MB. For large file transfers, this is a real limitation. 1time.io is designed for sensitive documents, certificates, and config files — not video files or disk images.</li>
                    <li><strong>Multi-download links.</strong> Firefox Send allowed up to 100 downloads per link. 1time.io is strictly one-time — one download, then the file is gone. This is a security feature, not a limitation, but it does mean you cannot share one link with a group.</li>
                    <li><strong>Brand recognition.</strong> Mozilla is a household name. 1time.io is an independent project. You can verify the security model by reading the source code.</li>
                </ul>

                <h2>Where 1time.io Has the Edge</h2>
                <ul>
                    <li><strong>It exists.</strong> Firefox Send has been offline for over five years. 1time.io is actively maintained and running.</li>
                    <li><strong>Stronger encryption.</strong> AES-256-GCM with <Link href="/blog/hkdf-key-derivation-explained/">HKDF key derivation</Link>, compared to Firefox Send&apos;s AES-128-GCM.</li>
                    <li><strong>Text and files.</strong> Firefox Send was files only. 1time.io handles both <Link href="/">text secrets</Link> and <Link href="/secure-file-sharing/">encrypted files</Link> in one tool.</li>
                    <li><strong>CLI support.</strong> Share files and secrets from the terminal with <code>@1time/cli</code>. Firefox Send had no official CLI.</li>
                    <li><strong>Self-hostable today.</strong> Deploy with Docker Compose in 2 minutes. Your files, your server, your rules.</li>
                    <li><strong>Built-in tools.</strong> <Link href="/password-generator">Password generator</Link>, <Link href="/api-key-generator">API key generator</Link>, and <Link href="/share-passwords-with-qr-code">QR code sharing</Link> are all part of the same platform.</li>
                </ul>

                <h2>The 10 MB Limit — Why?</h2>
                <p>
                    Firefox Send handled large files because Mozilla had the infrastructure and funding
                    for it. 1time.io is a solo-maintained, free, open-source project. The 10 MB limit
                    exists to keep the service fast, free, and sustainable.
                </p>
                <p>
                    In practice, 10 MB covers the files that actually need one-time encrypted sharing:
                    PDFs, certificates, <code>.env</code> files, config exports, private keys, screenshots
                    with sensitive data, and most office documents. If you need to transfer a 500 MB
                    video file, a bulk file transfer tool like WeTransfer or rsync is the right choice —
                    the security model is different.
                </p>

                <div className="callout callout-tip">
                    <span className="callout-icon">&#x1F4A1;</span>
                    <p>
                        <strong>Self-hosting removes the limit.</strong> If you deploy 1time.io on your
                        own server, you can adjust the file size limit to whatever your infrastructure supports.
                    </p>
                </div>

                <h2>How to Share a File with 1time.io</h2>
                <ol>
                    <li>Open <Link href="/secure-file-sharing/">1time.io/secure-file-sharing</Link>.</li>
                    <li>Select a file (up to 10 MB).</li>
                    <li>Optionally add a passphrase for extra protection.</li>
                    <li>Click create. Your browser encrypts the file and uploads only the encrypted blob.</li>
                    <li>Copy the one-time download link and send it to the recipient.</li>
                    <li>The recipient opens the link, the browser decrypts the file, and the server copy is destroyed.</li>
                </ol>
                <p>
                    The entire process takes under 15 seconds. No account, no signup, no tracking.
                </p>

                <h2>Who Should Use This?</h2>
                <p>
                    If you used Firefox Send for any of these, 1time.io covers the same use cases:
                </p>
                <ul>
                    <li>Sending an NDA or contract to a client without it sitting in email forever.</li>
                    <li>Sharing a certificate or private key with a developer.</li>
                    <li>Delivering a config export or database backup to a teammate.</li>
                    <li>Sending screenshots with sensitive data that should not persist.</li>
                    <li>Any file handoff where the recipient should get it once and it should not exist after.</li>
                </ul>

                <div className="article-cta">
                    <div className="article-cta-icon">&#x1F4C1;</div>
                    <h2>Share a file like Firefox Send used to</h2>
                    <p>Encrypted in your browser, one-time download, auto-destroyed. No account needed.</p>
                    <Link href="/secure-file-sharing/" className="btn btn-primary btn-lg">Share a file securely</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/blog/bitwarden-send-alternative" className="related-article-card">
                        <span>1time.io vs Bitwarden Send</span>
                        <span>Dedicated tool vs password manager feature for secret sharing.</span>
                    </Link>
                    <Link href="/blog/self-destructing-messages-explained" className="related-article-card">
                        <span>Self-Destructing Messages Explained</span>
                        <span>How one-time messages and files actually work under the hood.</span>
                    </Link>
                    <Link href="/blog/stop-sending-passwords-over-slack" className="related-article-card">
                        <span>Stop Sending Passwords Over Slack</span>
                        <span>Why Slack is dangerous for credentials and how to fix it.</span>
                    </Link>
                </div>
            </div>
        </article>
        </>
    );
}
