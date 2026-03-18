import Link from 'next/link';

export const metadata = {
    title: 'Blog — onetimelink.me',
    description: 'Guides on secure password sharing, self-destructing messages, and protecting sensitive data online. Learn best practices for zero-knowledge encryption.',
    alternates: { canonical: '/blog' },
    openGraph: {
        title: 'Blog — onetimelink.me',
        description: 'Guides on secure password sharing, self-destructing messages, and protecting sensitive data online.',
        url: '/blog',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'onetimelink.me Blog' }],
    },
};

const articles = [
    {
        slug: 'hkdf-key-derivation-explained',
        tag: 'How It Works',
        title: 'What Is HKDF and Why We Use It for End-to-End Encryption',
        excerpt: 'We upgraded from SHA-256 hashing to HKDF key derivation. Here is what that means, why it matters, and how it keeps your secrets safer.',
        date: 'March 2026',
        readTime: '8 min read',
    },
    {
        slug: 'password-for-crypto-wallet',
        tag: 'Security',
        title: 'How to Create a Strong Password for Your Crypto Wallet',
        excerpt: 'Your crypto wallet password is the last line of defense. A weak one can be cracked in hours with no way to recover funds. Learn how to create one that cannot be broken.',
        date: 'March 2026',
        readTime: '6 min read',
    },
    {
        slug: 'database-password-security',
        tag: 'DevOps',
        title: 'Database Password Security Best Practices',
        excerpt: 'How to generate, store, rotate, and share database credentials for PostgreSQL, MySQL, MongoDB, and Redis without putting your data at risk.',
        date: 'March 2026',
        readTime: '8 min read',
    },
    {
        slug: 'secure-home-wifi-setup',
        tag: 'Guide',
        title: 'How to Set Up a Secure Home WiFi Network',
        excerpt: 'Your WiFi password protects every device on your network. Step-by-step guide to strong passwords, WPA3, guest networks, and router hardening.',
        date: 'March 2026',
        readTime: '7 min read',
    },
    {
        slug: 'strong-email-password',
        tag: 'Security',
        title: 'How to Create a Strong Email Password',
        excerpt: 'Your email is the skeleton key to your digital life. Anyone who gets in can reset every other password you have. Here is how to protect it.',
        date: 'March 2026',
        readTime: '6 min read',
    },
    {
        slug: 'team-password-sharing',
        tag: 'Teams',
        title: 'Team Password Sharing Without a Password Manager',
        excerpt: 'Not every team has a password manager. Here are practical, secure approaches to sharing credentials using encrypted one-time links and smart workflows.',
        date: 'March 2026',
        readTime: '7 min read',
    },
    {
        slug: 'is-slack-safe-for-passwords',
        tag: 'Security',
        title: 'Is Slack Safe for Sharing Passwords? (No, and Here Is Why)',
        excerpt: 'Slack stores all messages indefinitely, admins can read DMs, and one compromised account exposes every password ever shared. Here is what to do instead.',
        date: 'March 2026',
        readTime: '6 min read',
    },
    {
        slug: 'how-to-send-passwords-over-email',
        tag: 'Guide',
        title: 'How to Send Passwords Securely Over Email',
        excerpt: 'Email stores messages forever in multiple locations. Learn why emailing passwords is dangerous and how to use encrypted one-time links instead.',
        date: 'March 2026',
        readTime: '6 min read',
    },
    {
        slug: 'how-to-share-api-keys',
        tag: 'Guide',
        title: 'How to Share API Keys Securely with Your Team',
        excerpt: 'API keys in Slack channels are a security disaster waiting to happen. Learn the right way to share credentials with developers at any team size.',
        date: 'March 2026',
        readTime: '7 min read',
    },
    {
        slug: 'how-to-share-wifi-password',
        tag: 'Guide',
        title: 'How to Share Your WiFi Password Securely',
        excerpt: 'Stop writing WiFi passwords on sticky notes. Learn the safest ways to share network credentials with guests, Airbnb visitors, and coworkers.',
        date: 'March 2026',
        readTime: '5 min read',
    },
    {
        slug: 'bitwarden-send-alternative',
        tag: 'Comparison',
        title: 'onetimelink.me vs Bitwarden Send — A Practical Comparison',
        excerpt: 'Bitwarden Send requires an account and multiple steps. Here is how a dedicated one-time link tool compares for quick secret sharing.',
        date: 'March 2026',
        readTime: '5 min read',
    },
    {
        slug: 'privnote-alternative',
        tag: 'Comparison',
        title: 'onetimelink.me vs Privnote — Why Encryption Matters',
        excerpt: 'Privnote deletes messages after reading but does not encrypt them end-to-end. The server sees everything. Here is why that matters.',
        date: 'March 2026',
        readTime: '5 min read',
    },
    {
        slug: 'password-pusher-alternative',
        tag: 'Comparison',
        title: 'onetimelink.me vs Password Pusher — Which Is More Secure?',
        excerpt: 'Password Pusher encrypts on the server. onetimelink.me encrypts in the browser. Compare features, security models, and ease of use.',
        date: 'March 2026',
        readTime: '5 min read',
    },
    {
        slug: 'how-to-share-passwords-securely',
        tag: 'Guide',
        title: 'How to Share Passwords Securely with Your Team',
        excerpt: 'Slack DMs, emails, sticky notes — most password sharing methods are dangerously insecure. Learn the safe alternatives and how one-time links eliminate the risk.',
        date: 'March 2025',
        readTime: '7 min read',
    },
    {
        slug: 'self-destructing-messages-explained',
        tag: 'How It Works',
        title: 'Self-Destructing Messages — How They Actually Work',
        excerpt: 'What happens when a message self-destructs? We break down the encryption, deletion flow, and why most "disappearing message" apps aren\'t as private as they claim.',
        date: 'March 2025',
        readTime: '6 min read',
    },
    {
        slug: 'onetimesecret-alternative',
        tag: 'Comparison',
        title: 'onetimelink.me vs OneTimeSecret — A Transparent Comparison',
        excerpt: 'Both tools let you share secrets via one-time links. But there are real differences in encryption, privacy, and usability. Here\'s an honest side-by-side breakdown.',
        date: 'March 2025',
        readTime: '5 min read',
    },
];

export default function BlogIndex() {
    return (
        <div className="blog-index">
            <h1>Blog</h1>
            <p className="subtitle">Guides on secure sharing, encryption, and protecting sensitive data.</p>

            <div className="blog-list">
                {articles.map((article) => (
                    <Link
                        key={article.slug}
                        href={`/blog/${article.slug}`}
                        className="blog-card"
                    >
                        <span className="blog-card-tag">{article.tag}</span>
                        <h2>{article.title}</h2>
                        <p>{article.excerpt}</p>
                        <div className="blog-card-meta">{article.date} &middot; {article.readTime}</div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
