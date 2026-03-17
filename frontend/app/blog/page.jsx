import Link from 'next/link';

export const metadata = {
    title: 'Blog — onetimelink.me',
    description: 'Guides on secure password sharing, self-destructing messages, and protecting sensitive data online. Learn best practices for zero-knowledge encryption.',
    alternates: { canonical: '/blog' },
    openGraph: {
        title: 'Blog — onetimelink.me',
        description: 'Guides on secure password sharing, self-destructing messages, and protecting sensitive data online.',
        url: '/blog',
    },
};

const articles = [
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
