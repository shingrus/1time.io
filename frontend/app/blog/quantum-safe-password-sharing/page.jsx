import Link from 'next/link';

export const metadata = {
    title: 'Quantum-Safe Password Sharing — Why 1time.io Uses No RSA or ECC | 1time.io',
    description: 'Most secret sharing tools rely on RSA or ECC, which quantum computers will break. 1time.io uses pure symmetric encryption (AES-256-GCM + HKDF) — a quantum-safe one-time link with no asymmetric cryptography to attack.',
    alternates: { canonical: '/blog/quantum-safe-password-sharing' },
    openGraph: {
        title: 'Quantum-Safe Password Sharing — No RSA, No ECC, No Problem',
        description: 'Most secret sharing tools rely on RSA or ECC, which quantum computers will break. 1time.io uses pure symmetric encryption — quantum-safe password sharing with no asymmetric cryptography.',
        url: '/blog/quantum-safe-password-sharing',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Quantum-Safe Password Sharing — 1time.io' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Quantum-Safe Password Sharing — No RSA, No ECC, No Problem',
        description: 'Most secret sharing tools rely on RSA or ECC, which quantum computers will break. 1time.io uses pure symmetric encryption — quantum-safe password sharing with no asymmetric cryptography.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Quantum-Safe Password Sharing — Why 1time.io Uses No RSA or ECC',
        description: 'Most secret sharing tools rely on RSA or ECC, which quantum computers will break. 1time.io uses pure symmetric encryption (AES-256-GCM + HKDF) — quantum-safe password sharing with no asymmetric cryptography to attack.',
        datePublished: '2026-04-01',
        dateModified: '2026-04-01',
        author: { '@type': 'Person', name: 'Igor Ermakov', url: 'https://1time.io/about/' },
        publisher: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io', logo: { '@type': 'ImageObject', url: 'https://1time.io/logo-512.png', width: 512, height: 512 } },
        mainEntityOfPage: 'https://1time.io/blog/quantum-safe-password-sharing/',
        image: ['https://1time.io/og-image.png'],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://1time.io/blog/' },
            { '@type': 'ListItem', position: 3, name: 'Quantum-Safe Password Sharing', item: 'https://1time.io/blog/quantum-safe-password-sharing/' },
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
                <h1>No RSA, No ECC, No Problem: Why 1time.io Is Already Quantum-Safe</h1>
                <p className="article-subtitle">
                    Quantum computers will break RSA and elliptic-curve cryptography.
                    Most password sharing tools depend on both. 1time.io uses neither —
                    making it a quantum-safe one-time link by design, not by accident.
                </p>
                <div className="article-meta">By Igor Ermakov &middot; Apr 1, 2026 &middot; 7 min read</div>
            </div>

            <div className="article-body">
                <h2>The Quantum Threat in 30 Seconds</h2>
                <p>
                    Today&apos;s public-key cryptography — RSA, ECDSA, ECDH, Diffie-Hellman — relies on
                    mathematical problems that classical computers cannot solve in reasonable time.
                    Quantum computers change this. Two algorithms matter:
                </p>
                <ul>
                    <li>
                        <strong>Shor&apos;s algorithm</strong> breaks RSA, ECC, and Diffie-Hellman completely.
                        A sufficiently powerful quantum computer could factor RSA keys and compute elliptic-curve
                        discrete logarithms in polynomial time. All asymmetric cryptography based on these
                        problems becomes worthless.
                    </li>
                    <li>
                        <strong>Grover&apos;s algorithm</strong> attacks symmetric encryption by effectively halving
                        the key length. AES-128 becomes 64-bit security (breakable). AES-256 becomes 128-bit
                        security — which is still far beyond any known attack, classical or quantum.
                    </li>
                </ul>

                <div className="callout callout-warning">
                    <span className="callout-icon">⚠️</span>
                    <p>
                        <strong>Harvest now, decrypt later.</strong> Adversaries are already collecting encrypted
                        traffic today, planning to decrypt it once quantum computers are powerful enough.
                        If your tool uses RSA key exchange, the ciphertext captured today can be broken tomorrow.
                    </p>
                </div>

                <h2>Why Most Secret Sharing Tools Are Vulnerable</h2>
                <p>
                    The weak point is not the encryption itself — it is the <strong>key exchange</strong>.
                    When two parties need to agree on an encryption key over an untrusted channel, they
                    typically use asymmetric cryptography: RSA, ECDH, or Diffie-Hellman. These are exactly
                    the algorithms that Shor&apos;s algorithm destroys.
                </p>

                <div className="diagram">
                    <div className="diagram-title">How typical secret sharing tools work</div>
                    <div className="diagram-flow">
                        <div className="diagram-step">
                            <span className="diagram-step-icon">✍️</span>
                            <span className="diagram-step-label">Sender encrypts</span>
                            <span className="diagram-step-desc">AES-256 (safe)</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-danger">
                            <span className="diagram-step-icon">🔑</span>
                            <span className="diagram-step-label">Key exchange</span>
                            <span className="diagram-step-desc">RSA / ECC / DH</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step">
                            <span className="diagram-step-icon">📨</span>
                            <span className="diagram-step-label">Ciphertext stored</span>
                            <span className="diagram-step-desc">On server</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-danger">
                            <span className="diagram-step-icon">🔓</span>
                            <span className="diagram-step-label">Key recovery</span>
                            <span className="diagram-step-desc">RSA / ECC / DH</span>
                        </div>
                    </div>
                    <p style={{textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)', marginTop: '12px'}}>
                        The red steps use asymmetric crypto — vulnerable to quantum attack.
                    </p>
                </div>

                <h2>How 1time.io Avoids This Entirely</h2>
                <p>
                    1time.io does not use any asymmetric cryptography. None. The encryption protocol
                    is <strong>pure symmetric</strong>:
                </p>
                <ol>
                    <li>Your browser generates a random 20-character key using the Web Crypto API.</li>
                    <li>HKDF-SHA-256 derives two sub-keys: one for encryption, one for authentication.</li>
                    <li>AES-256-GCM encrypts your secret with a random 96-bit IV.</li>
                    <li>Only the ciphertext and a hashed authentication token are sent to the server.</li>
                    <li>The encryption key is placed in the <strong>URL fragment</strong> (after the #), which browsers never send to the server.</li>
                </ol>

                <div className="diagram">
                    <div className="diagram-title">How 1time.io works — no asymmetric crypto</div>
                    <div className="diagram-flow">
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🎲</span>
                            <span className="diagram-step-label">Random key</span>
                            <span className="diagram-step-desc">Web Crypto API</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔐</span>
                            <span className="diagram-step-label">HKDF + AES-GCM</span>
                            <span className="diagram-step-desc">256-bit symmetric</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step">
                            <span className="diagram-step-icon">📨</span>
                            <span className="diagram-step-label">Ciphertext stored</span>
                            <span className="diagram-step-desc">Server sees nothing</span>
                        </div>
                        <span className="diagram-arrow">→</span>
                        <div className="diagram-step diagram-step-success">
                            <span className="diagram-step-icon">🔗</span>
                            <span className="diagram-step-label">Key in URL #</span>
                            <span className="diagram-step-desc">Never sent to server</span>
                        </div>
                    </div>
                    <p style={{textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)', marginTop: '12px'}}>
                        Every step uses symmetric crypto or randomness — nothing for a quantum computer to attack.
                    </p>
                </div>

                <p>
                    The key insight: there is <strong>no key exchange problem</strong> because the key
                    travels inside the link itself. The URL fragment is the key distribution mechanism.
                    It never touches the server, and it does not require any public-key cryptography.
                    This is what makes 1time.io a genuinely quantum-safe password sharing tool — not
                    a marketing claim bolted onto a vulnerable architecture.
                </p>

                <h2>How Competitors Compare</h2>
                <p>
                    We looked at the cryptographic architecture of four popular secret sharing tools.
                    The results may surprise you.
                </p>

                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>Property</th>
                            <th>1time.io</th>
                            <th>Yopass</th>
                            <th>OneTimeSecret</th>
                            <th>Bitwarden Send</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Encryption algorithm</strong></td>
                            <td>AES-256-GCM</td>
                            <td>OpenPGP (AES-128/256)</td>
                            <td>Server-side (OpenSSL)</td>
                            <td>AES-256-CBC</td>
                        </tr>
                        <tr>
                            <td><strong>Key exchange</strong></td>
                            <td><span className="check">✓</span> None (URL fragment)</td>
                            <td><span className="cross">✗</span> RSA / ECDH (OpenPGP)</td>
                            <td><span className="cross">✗</span> Server-managed</td>
                            <td><span className="cross">✗</span> RSA key wrapping</td>
                        </tr>
                        <tr>
                            <td><strong>Asymmetric crypto used</strong></td>
                            <td><span className="check">✓</span> None</td>
                            <td><span className="cross">✗</span> RSA or ECC</td>
                            <td><span className="cross">✗</span> TLS-dependent</td>
                            <td><span className="cross">✗</span> RSA-OAEP</td>
                        </tr>
                        <tr>
                            <td><strong>Vulnerable to Shor&apos;s</strong></td>
                            <td><span className="check">✓</span> No</td>
                            <td><span className="cross">✗</span> Yes</td>
                            <td><span className="cross">✗</span> Yes (key layer)</td>
                            <td><span className="cross">✗</span> Yes (key wrapping)</td>
                        </tr>
                        <tr>
                            <td><strong>Post-Grover security</strong></td>
                            <td><span className="check">✓</span> 128-bit (safe)</td>
                            <td><span className="partial">~</span> 64-128 bit</td>
                            <td><span className="partial">~</span> Depends on config</td>
                            <td><span className="check">✓</span> 128-bit (safe)</td>
                        </tr>
                        <tr>
                            <td><strong>Zero-knowledge</strong></td>
                            <td><span className="check">✓</span> Yes</td>
                            <td><span className="check">✓</span> Yes</td>
                            <td><span className="cross">✗</span> No</td>
                            <td><span className="partial">~</span> Partial</td>
                        </tr>
                        <tr>
                            <td><strong>Quantum-safe verdict</strong></td>
                            <td><span className="check">✓</span> Yes</td>
                            <td><span className="cross">✗</span> No</td>
                            <td><span className="cross">✗</span> No</td>
                            <td><span className="cross">✗</span> No</td>
                        </tr>
                    </tbody>
                </table>

                <h3>Yopass — OpenPGP Is the Weak Link</h3>
                <p>
                    Yopass uses OpenPGP for client-side encryption. OpenPGP is a well-established standard,
                    but it relies on RSA or ECC for key management. These are exactly the algorithms
                    that Shor&apos;s algorithm targets. The symmetric layer (AES) inside OpenPGP is fine —
                    but the asymmetric key wrapping around it is not.
                </p>
                <p>
                    A quantum adversary who captures a Yopass ciphertext and the associated OpenPGP
                    public key material could recover the session key and decrypt the message.
                </p>

                <h3>OneTimeSecret — Server-Side Means Server-Vulnerable</h3>
                <p>
                    OneTimeSecret encrypts on the server, not in the browser. This means the plaintext
                    travels over TLS to the server before encryption happens. TLS today relies on
                    ECDH or RSA for key exchange. A &ldquo;harvest now, decrypt later&rdquo; attack captures
                    the TLS session, and a future quantum computer recovers the plaintext.
                </p>
                <p>
                    Even worse, the server sees your plaintext — so a compromise of the server
                    (classical or quantum) exposes everything.
                </p>

                <h3>Bitwarden Send — RSA Key Wrapping</h3>
                <p>
                    Bitwarden Send uses AES-256 for encryption (quantum-safe), but wraps the encryption
                    key with RSA-OAEP as part of its account-based key hierarchy. This RSA layer is
                    what a quantum computer would target. Breaking the RSA key wrapping recovers
                    the AES key, which decrypts the message.
                </p>

                <h2>The Honest Caveats</h2>
                <p>
                    We want to be transparent about what &ldquo;quantum-safe&rdquo; means and does not mean
                    for 1time.io:
                </p>

                <div className="callout callout-tip">
                    <span className="callout-icon">💡</span>
                    <p>
                        <strong>What we mean by quantum-safe:</strong> The encryption protocol — key generation,
                        key derivation, encryption, and authentication — uses no algorithms that a quantum
                        computer can break. AES-256-GCM retains 128-bit security under Grover&apos;s algorithm.
                        HKDF-SHA-256 is hash-based and unaffected by known quantum attacks. NIST recommends
                        both for post-quantum use.
                    </p>
                </div>

                <p><strong>What this does NOT protect against:</strong></p>
                <ul>
                    <li>
                        <strong>Link interception.</strong> If someone intercepts the URL (from Slack, email,
                        or a compromised device), they have the key. This is a channel security problem,
                        not a cryptographic one. Quantum computing does not change this threat.
                    </li>
                    <li>
                        <strong>TLS interception.</strong> While the encryption key never leaves your browser
                        (it stays in the URL fragment), the ciphertext does travel over TLS. If TLS itself
                        is broken by a quantum computer, an attacker could capture the ciphertext in transit.
                        However, without the key (which is in the URL fragment, not in the TLS stream),
                        they still cannot decrypt it.
                    </li>
                    <li>
                        <strong>Endpoint compromise.</strong> If the sender&apos;s or recipient&apos;s device is
                        compromised, no encryption helps — classical or quantum.
                    </li>
                </ul>

                <h2>Why This Architecture Was Chosen</h2>
                <p>
                    We did not set out to build a &ldquo;quantum-safe&rdquo; tool. We set out to build the
                    simplest possible zero-knowledge architecture for one-time secret sharing. The
                    URL-fragment-as-key pattern emerged from a practical constraint: we wanted the
                    server to never see the key, and we did not want to require accounts or key exchange
                    protocols.
                </p>
                <p>
                    The result is an architecture with no asymmetric cryptography — not because we
                    were worried about quantum computers, but because we did not need it. The quantum
                    safety is a side effect of simplicity.
                </p>
                <p>
                    This is worth noting because it illustrates a broader principle in security
                    engineering: <strong>simpler systems have fewer attack surfaces</strong>. By
                    eliminating key exchange entirely, we eliminated an entire category of
                    vulnerabilities — including the quantum ones.
                </p>

                <h2>What NIST Says</h2>
                <p>
                    NIST&apos;s post-quantum cryptography standardization effort (FIPS 203, 204, 205)
                    focuses on replacing asymmetric algorithms — RSA, ECDSA, ECDH — with lattice-based
                    and hash-based alternatives. The symmetric algorithms 1time.io uses are explicitly
                    recommended for continued use:
                </p>
                <ul>
                    <li><strong>AES-256</strong> — listed in NIST SP 800-131A as approved for use beyond 2030.</li>
                    <li><strong>SHA-256</strong> — listed in NIST SP 800-131A as approved. HKDF built on SHA-256 inherits this approval.</li>
                    <li><strong>GCM mode</strong> — listed in NIST SP 800-38D as an approved authenticated encryption mode.</li>
                </ul>
                <p>
                    No migration is needed. 1time.io&apos;s encryption is already compliant with NIST&apos;s
                    post-quantum guidance because it never used the algorithms being replaced.
                </p>

                <h2>Should You Care Today?</h2>
                <p>
                    Cryptographically relevant quantum computers do not exist yet. Current estimates
                    range from 5 to 15 years. But the &ldquo;harvest now, decrypt later&rdquo; threat is real
                    today — state-level adversaries are collecting encrypted traffic for future decryption.
                </p>
                <p>
                    For most one-time secrets (passwords, API keys, tokens), this threat is limited
                    because the secrets themselves expire or rotate. But for organizations subject to
                    compliance requirements — SOC 2, ISO 27001, NIST frameworks — being able to say
                    &ldquo;our secret sharing tool uses no quantum-vulnerable cryptography&rdquo; is a
                    meaningful differentiator today.
                </p>

                <div className="article-cta">
                    <div className="article-cta-icon">🛡️</div>
                    <h2>Share passwords with quantum-safe encryption</h2>
                    <p>Quantum-safe one-time links powered by AES-256-GCM + HKDF. No RSA. No ECC. No accounts. Zero-knowledge. Free and open source.</p>
                    <Link href="/" className="btn btn-primary btn-lg">Create a secure link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/blog/hkdf-key-derivation-explained" className="related-article-card">
                        <span>What Is HKDF and Why We Use It</span>
                        <span>Deep dive into our key derivation protocol.</span>
                    </Link>
                    <Link href="/blog/onetimesecret-alternative" className="related-article-card">
                        <span>1time.io vs OneTimeSecret</span>
                        <span>A transparent feature-by-feature comparison.</span>
                    </Link>
                    <Link href="/blog/bitwarden-send-alternative" className="related-article-card">
                        <span>1time.io vs Bitwarden Send</span>
                        <span>Why a dedicated tool beats a password manager add-on.</span>
                    </Link>
                </div>
            </div>
        </article>
    );
}
