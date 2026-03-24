import Link from 'next/link';

export const metadata = {
    title: 'How to Set Up a Secure Home WiFi Network — 1time.io',
    description: 'Step-by-step guide to securing your home WiFi network. Covers strong passwords, WPA3, guest networks, and router settings. Includes a free WiFi password generator.',
    alternates: { canonical: '/blog/secure-home-wifi-setup' },
    openGraph: {
        title: 'How to Set Up a Secure Home WiFi Network',
        description: 'Step-by-step guide to WiFi security: strong passwords, WPA3, and router hardening.',
        url: '/blog/secure-home-wifi-setup',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Secure Home WiFi Setup' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'How to Set Up a Secure Home WiFi Network',
        description: 'Step-by-step guide to WiFi security: strong passwords, WPA3, and router hardening.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'How to Set Up a Secure Home WiFi Network',
        description: 'Step-by-step guide to securing your home WiFi network with strong passwords, WPA3, and proper router configuration.',
        datePublished: '2026-02-20',
        dateModified: '2026-03-21',
        author: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io' },
        publisher: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io', logo: { '@type': 'ImageObject', url: 'https://1time.io/logo-512.png', width: 512, height: 512 } },
        mainEntityOfPage: 'https://1time.io/blog/secure-home-wifi-setup',
        image: ['https://1time.io/og-image.png'],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://1time.io/blog' },
            { '@type': 'ListItem', position: 3, name: 'Secure Home WiFi Setup', item: 'https://1time.io/blog/secure-home-wifi-setup' },
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
                <h1>How to Set Up a Secure Home WiFi Network</h1>
                <p className="article-subtitle">
                    Your WiFi password is the front door to your home network. Every device — laptop, phone,
                    smart TV, baby monitor — connects through it. Here is how to lock it down properly.
                </p>
                <div className="article-meta">Feb 20, 2026 &middot; 7 min read</div>
            </div>

            <div className="article-body">
                <h2>Why Your WiFi Password Matters More Than You Think</h2>
                <p>
                    A weak WiFi password does not just let the neighbor borrow your internet. Anyone on your
                    network can potentially see your traffic, access shared files and printers, attack your
                    smart home devices, and use your connection for illegal activity that traces back to you.
                </p>
                <p>
                    WiFi cracking tools are freely available and can break weak passwords in minutes.
                    The default passwords printed on most routers follow predictable patterns that are
                    included in cracking dictionaries.
                </p>

                <h2>Step 1: Generate a Strong WiFi Password</h2>
                <p>
                    Your WiFi password needs to be strong enough to resist brute-force attacks, but practical
                    enough to type on a phone, TV remote, or game console. That means: no special symbols
                    (they are painful to enter on non-keyboard devices), at least 12 characters, and a mix of
                    upper and lowercase letters with numbers.
                </p>

                <p>
                    <Link href="/wifi-password-generator" className="btn btn-primary">Generate a WiFi password →</Link>
                </p>

                <p>
                    A 12-character alphanumeric password provides roughly 71 bits of entropy. At the speed
                    WPA2 passwords can be cracked (around 500,000 attempts per second with a high-end GPU),
                    this would take approximately 150 billion years. That is plenty.
                </p>

                <div className="callout callout-tip">
                    <span className="callout-icon">💡</span>
                    <p>
                        <strong>Sharing your WiFi password with guests?</strong> Instead of reading out a
                        long random password, create a <Link href="/">one-time link</Link> and text it to them.
                        They open it on their phone, copy the password, and it is permanently deleted.
                    </p>
                </div>

                <h2>Step 2: Choose the Right Encryption Protocol</h2>
                <p>
                    Your router offers several encryption options. Only two are acceptable in 2026:
                </p>

                <table className="comparison-table">
                    <thead>
                        <tr>
                            <th>Protocol</th>
                            <th>Security</th>
                            <th>Compatibility</th>
                            <th>Recommendation</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>WPA3</strong></td>
                            <td>Excellent</td>
                            <td>Newer devices only</td>
                            <td>Use if all your devices support it</td>
                        </tr>
                        <tr>
                            <td><strong>WPA2 (AES)</strong></td>
                            <td>Good</td>
                            <td>Universal</td>
                            <td>Safe fallback if WPA3 is not available</td>
                        </tr>
                        <tr>
                            <td><strong>WPA2 (TKIP)</strong></td>
                            <td>Weak</td>
                            <td>Legacy</td>
                            <td>Avoid — known vulnerabilities</td>
                        </tr>
                        <tr>
                            <td><strong>WEP</strong></td>
                            <td>None</td>
                            <td>Ancient</td>
                            <td>Never use — crackable in seconds</td>
                        </tr>
                    </tbody>
                </table>

                <p>
                    Most modern routers offer a WPA2/WPA3 mixed mode that supports both protocols simultaneously.
                    Use this if you have a mix of older and newer devices.
                </p>

                <h2>Step 3: Change Your Router Admin Password</h2>
                <p>
                    Your router has two passwords: the WiFi password (for connecting) and the admin password
                    (for configuring the router). Most people change the WiFi password but leave the admin
                    password at the factory default — usually something like "admin/admin" or "admin/password".
                </p>
                <p>
                    Anyone on your network who knows the admin password can change your DNS settings (redirecting
                    your traffic through a malicious server), open ports, disable encryption, or update the
                    firmware with a compromised version. Change it immediately.
                </p>

                <h2>Step 4: Set Up a Guest Network</h2>
                <p>
                    Most routers support creating a separate guest network. This is essential if you ever
                    share your WiFi with visitors, because a guest network:
                </p>
                <ul>
                    <li>Isolates guests from your main devices (they cannot see your computers, NAS, or smart home)</li>
                    <li>Can have a different (simpler) password that you change periodically</li>
                    <li>Can be disabled when not needed</li>
                    <li>Often supports bandwidth limits so guests do not affect your speed</li>
                </ul>

                <h2>Step 5: Disable Unnecessary Features</h2>
                <p>
                    Routers ship with features enabled that increase your attack surface. Disable these
                    unless you specifically need them:
                </p>
                <ul>
                    <li><strong>WPS (WiFi Protected Setup)</strong> — has a known brute-force vulnerability that bypasses your password entirely</li>
                    <li><strong>Remote management</strong> — allows accessing your router config from the internet</li>
                    <li><strong>UPnP</strong> — lets devices automatically open ports, which malware exploits</li>
                    <li><strong>SSID broadcast</strong> — hiding your network name adds no real security but can cause connection issues</li>
                </ul>

                <div className="callout callout-warning">
                    <span className="callout-icon">⚠️</span>
                    <p>
                        <strong>WPS is the biggest risk.</strong> Even with a strong WiFi password, WPS can be
                        brute-forced in hours using freely available tools. Disable it in your router settings.
                    </p>
                </div>

                <h2>Step 6: Keep Your Router Updated</h2>
                <p>
                    Router firmware updates fix security vulnerabilities. Many routers never get updated
                    after installation, leaving known exploits open for years. Check for updates at least
                    quarterly, or enable automatic updates if your router supports it.
                </p>

                <h2>Quick Security Checklist</h2>
                <ul>
                    <li>Strong, random WiFi password (12+ characters, no symbols for easy typing)</li>
                    <li>WPA3 or WPA2-AES encryption (never WEP or TKIP)</li>
                    <li>Changed the default admin password</li>
                    <li>Guest network for visitors</li>
                    <li>WPS disabled</li>
                    <li>Remote management disabled</li>
                    <li>UPnP disabled (unless needed)</li>
                    <li>Firmware up to date</li>
                    <li>Changed the default SSID name (removes router model info from attackers)</li>
                </ul>

                <div className="article-cta">
                    <div className="article-cta-icon">🔒</div>
                    <h2>Share your WiFi password securely</h2>
                    <p>Create an encrypted one-time link instead of texting the password. It self-destructs after reading.</p>
                    <Link href="/" className="btn btn-primary btn-lg">Create a secure link</Link>
                </div>
            </div>

            <div className="related-articles">
                <h2>Related Articles</h2>
                <div className="related-articles-grid">
                    <Link href="/blog/how-to-share-wifi-password" className="related-article-card">
                        <span>How to Share Your WiFi Password</span>
                        <span>Safe ways to share WiFi access with guests.</span>
                    </Link>
                    <Link href="/blog/how-to-share-passwords-securely" className="related-article-card">
                        <span>How to Share Passwords Securely</span>
                        <span>The complete guide to secure credential sharing.</span>
                    </Link>
                    <Link href="/blog/self-destructing-messages-explained" className="related-article-card">
                        <span>Self-Destructing Messages Explained</span>
                        <span>How one-time links work under the hood.</span>
                    </Link>
                </div>
            </div>
        </article>
    );
}
