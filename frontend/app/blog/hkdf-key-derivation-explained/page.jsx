import Link from 'next/link';

export const metadata = {
    title: 'What Is HKDF and Why We Use It for End-to-End Encryption — 1time.io',
    description: 'A plain-language explanation of HKDF (HMAC-based Key Derivation Function), why it is better than using raw SHA-256 hashes, and how 1time.io uses it to separate encryption keys from server-side auth tokens.',
    alternates: { canonical: '/blog/hkdf-key-derivation-explained' },
    openGraph: {
        title: 'What Is HKDF and Why We Use It for End-to-End Encryption',
        description: 'How 1time.io uses HKDF to derive separate encryption and authentication keys from one master secret.',
        url: '/blog/hkdf-key-derivation-explained',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'HKDF Key Derivation Explained' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'What Is HKDF and Why We Use It for End-to-End Encryption',
        description: 'How 1time.io uses HKDF to derive separate encryption and authentication keys from one master secret.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'What Is HKDF and Why We Use It for End-to-End Encryption',
        description: 'A plain-language explanation of HKDF and how 1time.io uses it to separate encryption keys from server-side auth tokens.',
        datePublished: '2026-03-21',
        dateModified: '2026-03-21',
        author: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io' },
        publisher: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io', logo: { '@type': 'ImageObject', url: 'https://1time.io/logo-512.png', width: 512, height: 512 } },
        mainEntityOfPage: 'https://1time.io/blog/hkdf-key-derivation-explained',
        image: ['https://1time.io/og-image.png'],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://1time.io/blog' },
            { '@type': 'ListItem', position: 3, name: 'HKDF Key Derivation Explained', item: 'https://1time.io/blog/hkdf-key-derivation-explained' },
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
                <span className="article-tag">How It Works</span>
                <h1>What Is HKDF and Why We Use It for End-to-End Encryption</h1>
                <p className="article-subtitle">
                    We recently upgraded <Link href="/">1time.io</Link> from simple SHA-256 hashing to HKDF-based key derivation.
                    Here is what that means in plain language, why it matters, and how it makes your secrets safer.
                </p>
                <div className="article-meta">Mar 21, 2026 &middot; 8 min read</div>
            </div>

            <div className="article-body">
                <h2>The Problem We Needed to Solve</h2>
                <p>
                    When you create a one-time link on <Link href="/">1time.io</Link>, your browser needs to do two things
                    with a single random key:
                </p>
                <ol>
                    <li><strong>Encrypt your secret</strong> — so nobody can read it, not even our server</li>
                    <li><strong>Identify the secret on the server</strong> — so the recipient can look it up and retrieve it</li>
                </ol>
                <p>
                    The challenge: if we use the same key for both, the server could potentially use the
                    lookup identifier to decrypt the secret. We need two separate keys — one for encryption,
                    one for authentication — derived from a single master key. That is exactly what HKDF does.
                </p>

                {/* Diagram: The problem */}
                <div className="diagram">
                    <div className="diagram-title">The problem: one key, two jobs</div>
                    <div className="diagram-flow">
                        <div className="diagram-step">
                            <span className="diagram-step-icon">🔑</span>
                            <span className="diagram-step-label">One random key</span>
                            <span className="diagram-step-desc">Generated in your browser</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-danger">
                            <span className="diagram-step-icon">❓</span>
                            <span className="diagram-step-label">Same key for both?</span>
                            <span className="diagram-step-desc">Encrypt AND identify?</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-danger">
                            <span className="diagram-step-icon">⚠️</span>
                            <span className="diagram-step-label">Security risk</span>
                            <span className="diagram-step-desc">Server could decrypt</span>
                        </div>
                    </div>
                </div>

                <h2>What Is HKDF?</h2>
                <p>
                    HKDF stands for <strong>HMAC-based Key Derivation Function</strong>. It is defined
                    in <a href="https://datatracker.ietf.org/doc/html/rfc5869" target="_blank" rel="noopener noreferrer">RFC 5869</a> and
                    is one of the most widely used key derivation standards in modern cryptography.
                </p>
                <p>
                    In simple terms: HKDF takes one piece of secret material (your key) and produces
                    multiple independent keys from it. Each derived key is cryptographically independent —
                    knowing one tells you nothing about the others.
                </p>
                <p>
                    Think of it like a tree. You plant one seed (your master key), and it grows into
                    separate branches (derived keys). Each branch is strong on its own, and cutting one
                    branch does not affect the others.
                </p>

                <h2>HKDF Has Two Steps</h2>
                <p>
                    HKDF works in two phases:
                </p>

                <h3>Step 1: Extract</h3>
                <p>
                    The extract step takes your input key material (which might not be uniformly random)
                    and a salt value, and produces a fixed-length pseudorandom key (PRK). This
                    "concentrates" the randomness into a clean, uniformly distributed key.
                </p>
                <p>
                    At <Link href="/">1time.io</Link>, our input is a 20-character random string generated using the
                    Web Crypto API, and our salt is <code>onetimelink:v2</code>.
                </p>

                <h3>Step 2: Expand</h3>
                <p>
                    The expand step takes the PRK from step 1 and an "info" string, and produces
                    as many derived keys as you need. The info string acts as a label — different labels
                    produce completely different keys.
                </p>
                <p>
                    We use two info strings:
                </p>
                <ul>
                    <li><code>encrypt</code> — produces the AES-GCM-256 encryption key</li>
                    <li><code>auth</code> — produces the authentication token sent to the server</li>
                </ul>

                {/* Diagram: HKDF flow */}
                <div className="diagram">
                    <div className="diagram-title">How HKDF derives two keys from one</div>
                    <div className="diagram-flow">
                        <div className="diagram-step">
                            <span className="diagram-step-icon">🔑</span>
                            <span className="diagram-step-label">Master key</span>
                            <span className="diagram-step-desc">Random 16-char string</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🧬</span>
                            <span className="diagram-step-label">HKDF Extract</span>
                            <span className="diagram-step-desc">Salt: onetimelink:v2</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔀</span>
                            <span className="diagram-step-label">HKDF Expand</span>
                            <span className="diagram-step-desc">Two separate outputs</span>
                        </div>
                    </div>
                </div>

                <div className="diagram" style={{marginTop: '1rem'}}>
                    <div className="diagram-title">The two derived keys</div>
                    <div className="diagram-flow">
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔒</span>
                            <span className="diagram-step-label">Encryption key</span>
                            <span className="diagram-step-desc">info: "encrypt" → AES-GCM-256</span>
                        </div>
                        <span className="diagram-arrow" style={{visibility: 'hidden'}}>→</span>
                        <div className="diagram-step">
                            <span className="diagram-step-icon">🏷️</span>
                            <span className="diagram-step-label">Auth token</span>
                            <span className="diagram-step-desc">info: "auth" → server lookup ID</span>
                        </div>
                    </div>
                </div>

                <h2>Why Not Just Use SHA-256?</h2>
                <p>
                    Our previous approach was simple: take the master key, hash it with SHA-256, and use
                    the hash as both the server identifier and part of the encryption process. This worked,
                    but it had a subtle weakness.
                </p>

                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>Property</th>
                            <th>Raw SHA-256</th>
                            <th>HKDF</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Key separation</strong></td>
                            <td><span className="cross">✗</span> One hash for everything</td>
                            <td><span className="check">✓</span> Independent keys per purpose</td>
                        </tr>
                        <tr>
                            <td><strong>Formal security proof</strong></td>
                            <td><span className="cross">✗</span> Ad-hoc construction</td>
                            <td><span className="check">✓</span> Proven in RFC 5869</td>
                        </tr>
                        <tr>
                            <td><strong>Domain separation</strong></td>
                            <td><span className="cross">✗</span> No labeling mechanism</td>
                            <td><span className="check">✓</span> Info parameter separates contexts</td>
                        </tr>
                        <tr>
                            <td><strong>Salt support</strong></td>
                            <td><span className="partial">~</span> Manual concatenation</td>
                            <td><span className="check">✓</span> Built-in salt parameter</td>
                        </tr>
                        <tr>
                            <td><strong>Industry standard</strong></td>
                            <td><span className="cross">✗</span> Custom scheme</td>
                            <td><span className="check">✓</span> Used by TLS 1.3, Signal, WireGuard</td>
                        </tr>
                    </tbody>
                </table>

                <p>
                    The core issue with raw SHA-256 is that there is no formal separation between
                    the encryption key and the auth token. They are mathematically related in a way
                    that, while not practically exploitable today, does not follow cryptographic best
                    practices. HKDF guarantees that the two derived keys are cryptographically
                    independent — knowing the auth token gives you zero information about the
                    encryption key.
                </p>

                <div className="callout callout-tip">
                    <span className="callout-icon">💡</span>
                    <p>
                        <strong>Who else uses HKDF?</strong> TLS 1.3 (every HTTPS connection), the
                        Signal Protocol (WhatsApp, Signal), WireGuard VPN, and the Noise Framework
                        all use HKDF for key derivation. We are in good company.
                    </p>
                </div>

                <h2>How <Link href="/">1time.io</Link> Uses HKDF</h2>
                <p>
                    Here is the complete flow when you create a one-time link:
                </p>

                <h3>Creating a link (sender)</h3>
                <ol>
                    <li>Your browser generates a random 16-character key using the Web Crypto API</li>
                    <li>HKDF derives two keys from it:
                        <ul>
                            <li><strong>Encryption key</strong> (info: <code>encrypt</code>) — AES-GCM-256</li>
                            <li><strong>Auth token</strong> (info: <code>auth</code>) — 256-bit hex string</li>
                        </ul>
                    </li>
                    <li>Your browser encrypts the secret using the encryption key</li>
                    <li>The encrypted blob + auth token are sent to the server</li>
                    <li>The master key goes into the URL fragment (<code>#</code>) — never sent to the server</li>
                </ol>

                {/* Diagram: Creating a link */}
                <div className="diagram">
                    <div className="diagram-title">Creating a link — what goes where</div>
                    <div className="diagram-flow">
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔑</span>
                            <span className="diagram-step-label">Master key</span>
                            <span className="diagram-step-desc">Stays in URL # fragment</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔒</span>
                            <span className="diagram-step-label">Encrypted blob</span>
                            <span className="diagram-step-desc">Sent to server (unreadable)</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step">
                            <span className="diagram-step-icon">🏷️</span>
                            <span className="diagram-step-label">Auth token</span>
                            <span className="diagram-step-desc">Server uses as lookup key</span>
                        </div>
                    </div>
                </div>

                <h3>Opening a link (recipient)</h3>
                <ol>
                    <li>The recipient clicks the link</li>
                    <li>The browser reads the master key from the URL fragment (never sent to server)</li>
                    <li>HKDF derives the same two keys: encryption key + auth token</li>
                    <li>The browser sends the auth token to the server to fetch the encrypted blob</li>
                    <li>The server returns the blob and permanently deletes it</li>
                    <li>The browser decrypts the blob using the encryption key</li>
                    <li>The secret is displayed to the recipient</li>
                </ol>

                <p>
                    At no point does the server have access to the master key or the encryption key.
                    It only ever sees the auth token (which cannot be reversed to obtain the encryption key)
                    and the encrypted blob (which is meaningless without the encryption key).
                </p>

                <h2>Why the URL Fragment Matters</h2>
                <p>
                    The master key lives in the URL fragment — the part after the <code>#</code> symbol.
                    This is critical because URL fragments are never sent to the server. They are
                    a client-side-only feature defined in the HTTP specification.
                </p>
                <p>
                    When your browser requests <code>https://1time.io/v#abc123</code>, it sends
                    a request for <code>/v</code> — the <code>#abc123</code> part stays entirely in the browser.
                    This is not a custom security feature — it is how every browser has worked since the
                    beginning of the web.
                </p>

                <div className="callout callout-warning">
                    <span className="callout-icon">⚠️</span>
                    <p>
                        <strong>Important distinction:</strong> Query parameters (<code>?key=abc123</code>) ARE
                        sent to the server. URL fragments (<code>#abc123</code>) are NOT. This is why the key must
                        be in the fragment, not in a query parameter. Many other secret-sharing services get
                        this wrong.
                    </p>
                </div>

                <h2>When Should You Use HKDF?</h2>
                <p>
                    HKDF is the right tool whenever you need to:
                </p>
                <ul>
                    <li><strong>Derive multiple keys from one secret</strong> — the most common use case</li>
                    <li><strong>Separate concerns</strong> — encryption, authentication, signing should use different keys</li>
                    <li><strong>Convert non-uniform randomness</strong> — HKDF's extract step normalizes entropy</li>
                    <li><strong>Version your key scheme</strong> — changing the salt or info string produces completely new keys without changing the master key</li>
                </ul>
                <p>
                    HKDF is NOT the right tool for:
                </p>
                <ul>
                    <li><strong>Password hashing</strong> — use Argon2, bcrypt, or scrypt instead (HKDF is not designed to be slow)</li>
                    <li><strong>Generating keys from weak passwords</strong> — HKDF assumes the input already has sufficient entropy</li>
                </ul>

                <h2>The Full Cryptographic Flow</h2>
                <p>
                    For developers who want to implement something similar or audit our approach,
                    here is the complete flow step by step.
                </p>

                <h3>1. Key material generation</h3>
                <p>
                    A 20-character random string is generated using <code>crypto.getRandomValues()</code>. The character set
                    is <code>A-Za-z0-9-_</code> (64 URL-safe characters). If the user set an optional passphrase,
                    it is prepended to the random string to form the full secret
                    key: <code>fullSecretKey = userPassphrase + randomKey</code>.
                </p>

                <h3>2. HKDF key derivation</h3>
                <p>
                    The full secret key is imported as raw key material into the Web Crypto API
                    with algorithm <code>HKDF</code>. Two independent outputs are derived:
                </p>
                <ul>
                    <li>
                        <strong>Encryption key</strong> — <code>crypto.subtle.deriveKey()</code> with
                        HKDF params <code>(hash: SHA-256, salt: "onetimelink:v2", info: "encrypt")</code>,
                        producing an AES-GCM key with 256-bit length
                    </li>
                    <li>
                        <strong>Auth token</strong> — <code>crypto.subtle.deriveBits()</code> with
                        HKDF params <code>(hash: SHA-256, salt: "onetimelink:v2", info: "auth")</code>,
                        producing 256 bits, hex-encoded to a 64-character string
                    </li>
                </ul>

                <h3>3. Encryption</h3>
                <p>
                    A random 12-byte initialization vector (IV) is generated
                    via <code>crypto.getRandomValues()</code>. The secret message is encrypted
                    with AES-GCM using the derived encryption key and this IV.
                    The output ciphertext includes the GCM authentication tag (built into the Web Crypto API).
                </p>
                <p>
                    The final encrypted payload is formatted
                    as <code>base64url(iv).base64url(ciphertext)</code> — the IV and ciphertext
                    concatenated with a dot separator, both URL-safe base64 encoded.
                </p>

                <h3>4. Storage and URL structure</h3>
                <p>
                    The encrypted payload and the hex-encoded auth token are sent to the server
                    via <code>POST /api/saveSecret</code>. The server stores the encrypted blob
                    keyed by a server-generated ID and indexed by the auth token.
                </p>
                <p>
                    The generated URL has the
                    format: <code>https://1time.io/v/#randomKeyServerId</code>.
                    The random key lives in the URL fragment
                    after <code>#</code> — it is never sent to the server by the browser. The server ID is
                    appended so the recipient&#39;s browser knows which blob to request.
                </p>

                <h3>5. Decryption (recipient side)</h3>
                <p>
                    The recipient&#39;s browser extracts the random key from the URL fragment,
                    re-derives the auth token using the same HKDF process, and sends it to the server
                    to fetch the encrypted blob. Then it re-derives the encryption key, splits the
                    payload at the dot to recover the IV and ciphertext, and decrypts with AES-GCM.
                    The server permanently deletes the blob after returning it.
                </p>

                <p>
                    The entire implementation is open source — about 200 lines of JavaScript with
                    zero dependencies beyond the Web Crypto API. You can read
                    the <a href="https://github.com/shingrus/1time/blob/main/frontend/utils/util.js" target="_blank" rel="noopener noreferrer">full encryption code on GitHub</a> and
                    verify every claim in this article yourself.
                </p>

                <div className="article-cta">
                    <div className="article-cta-icon">🔒</div>
                    <h2>See HKDF in action</h2>
                    <p>Create an encrypted one-time link. Your secret is protected by HKDF-derived AES-GCM-256 encryption, entirely in your browser.</p>
                    <Link href="/" className="btn btn-primary btn-lg">Create a secure link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/blog/self-destructing-messages-explained" className="related-article-card">
                        <span>Self-Destructing Messages Explained</span>
                        <span>How one-time links work under the hood.</span>
                    </Link>
                    <Link href="/blog/onetimesecret-alternative" className="related-article-card">
                        <span>1time.io vs OneTimeSecret</span>
                        <span>Why encryption model matters when choosing a tool.</span>
                    </Link>
                    <Link href="/blog/how-to-share-api-keys" className="related-article-card">
                        <span>How to Share API Keys Securely</span>
                        <span>Safe ways to share tokens and keys with your team.</span>
                    </Link>
                </div>
            </div>
        </article>
    );
}
