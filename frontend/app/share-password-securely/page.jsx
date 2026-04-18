import Link from 'next/link';
import InlineCss from '../../components/InlineCss';
import NewMessage from '../../components/NewMessage';
import {absoluteUrl, siteHost} from '../../utils/siteConfig';

export const metadata = {
    title: `Share Passwords Securely — Encrypted One-Time Links | ${siteHost}`,
    description: 'Share passwords securely through encrypted one-time links that self-destruct after reading. End-to-end encrypted in your browser, free, no signup required.',
    alternates: { canonical: '/share-password-securely' },
    openGraph: {
        title: `Share Passwords Securely — One-Time Encrypted Links | ${siteHost}`,
        description: 'Send passwords through encrypted one-time links. Zero-knowledge encryption — we never see your password. Link self-destructs after reading.',
        url: '/share-password-securely',
        images: [{ url: '/1time-og-c1.png', width: 1200, height: 630, alt: 'Share passwords securely with encrypted one-time links' }],
    },
};

const faqItems = [
    {
        question: 'How do I share a password securely?',
        answer: 'Paste the password above, click "Create secret link", and send the link to the recipient. The password is encrypted in your browser before being stored. The recipient opens the link, sees the password once, and the data is permanently deleted from the server.',
    },
    {
        question: 'Is it safe to send passwords over email or Slack?',
        answer: 'No. Emails are stored indefinitely on mail servers, and Slack messages persist in searchable history that admins can export. Both channels leave your password exposed long after it was shared. One-time encrypted links solve this: the password is encrypted end-to-end and destroyed after a single view.',
    },
    {
        question: 'Can the server see my password?',
        answer: 'No. Your password is encrypted in the browser using AES-256-GCM before it reaches the server. The decryption key stays in the URL fragment, which is never sent to the server. This is called zero-knowledge architecture — we cannot read your secrets even if we wanted to.',
    },
    {
        question: 'What happens after the recipient reads the password?',
        answer: 'The encrypted data is permanently deleted from the server. The link stops working immediately. Nobody — including the sender — can retrieve the password again. If the link is not opened, it expires automatically after the set time period (1 to 30 days).',
    },
    {
        question: 'Can I add extra protection to the shared password?',
        answer: 'Yes. You can set an additional passphrase when creating the link. The recipient will need both the link and the passphrase to decrypt the password. This adds a second factor in case the link is intercepted.',
    },
    {
        question: 'Is this better than using a password manager for sharing?',
        answer: 'They serve different purposes. Password managers are best for ongoing shared access within a team. One-time links are better for one-off handoffs: onboarding a new team member, sending credentials to a client, sharing a WiFi password with a guest, or any situation where the recipient does not need permanent access.',
    },
];

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Secure Password Sharing',
        url: absoluteUrl('/share-password-securely/'),
        description: 'Share passwords securely through encrypted one-time links. End-to-end encrypted in your browser with AES-256-GCM. Free, open source, no signup.',
        applicationCategory: 'SecurityApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: 'End-to-end encryption, One-time access, Optional passphrase, Auto-expiry, Zero-knowledge architecture',
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
            { '@type': 'ListItem', position: 2, name: 'Share Passwords Securely', item: absoluteUrl('/share-password-securely/') },
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

export default function SharePasswordSecurelyPage() {
    return (
        <>
            <InlineCss file="styles/home.css" />
            {jsonLd.map((schema, index) => (
                <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
            ))}

            <div className="share-flow-page">
                <nav className="share-mode-nav" aria-label="Choose sharing mode">
                    <Link href="/share-password-securely/" className="share-mode-link share-mode-link-active">
                        Text Secret
                    </Link>
                    <Link href="/secure-file-sharing/" className="share-mode-link">
                        Secure File Sharing
                    </Link>
                </nav>
                <NewMessage />

                <section className="seo-section">
                    <h1>Share Passwords Securely with Encrypted One-Time Links</h1>
                    <p>
                        Stop pasting passwords into Slack messages, emails, and spreadsheets where they sit indefinitely.{' '}
                        {siteHost} lets you share a password through an encrypted one-time link that self-destructs
                        after the recipient reads it. The password is encrypted in your browser using AES-256-GCM
                        before it ever touches the server. No signup, no account, completely free.
                    </p>

                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f512;</div>
                                <h2>End-to-end encrypted</h2>
                            </div>
                            <p>Your password is encrypted in the browser. The server stores only ciphertext it cannot read.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4a5;</div>
                                <h2>Self-destructing link</h2>
                            </div>
                            <p>The link works exactly once. After the password is read, it is permanently deleted.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f6e1;&#xfe0f;</div>
                                <h2>Zero-knowledge</h2>
                            </div>
                            <p>The decryption key stays in the URL fragment and never reaches the server. We cannot read your password.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f510;</div>
                                <h2>Optional passphrase</h2>
                            </div>
                            <p>Add a second factor so the link alone is not enough to decrypt the password.</p>
                        </div>
                    </div>

                    <h2>Why you should never send passwords in plain text</h2>
                    <p>
                        When you paste a password into a Slack DM, it is stored in Slack&#39;s servers indefinitely.
                        Workspace admins can export and read all messages, including DMs. The same applies to email:
                        messages persist on mail servers, in backups, and in the recipient&#39;s inbox forever.
                        Even if you delete the message, copies remain in server logs and compliance archives.
                        A one-time encrypted link solves this by ensuring the password exists only for a single
                        viewing, and no copy persists on any server after it is read.
                    </p>

                    <h2>How secure password sharing works</h2>
                    <p>
                        Paste your password above and click &#34;Create secret link&#34;. Your browser generates
                        a random encryption key, encrypts the password with AES-256-GCM, and sends only the
                        ciphertext to the server. The encryption key is placed in the URL fragment (the part
                        after the # symbol), which browsers never transmit to servers. You send the full link
                        to the recipient. When they open it, their browser fetches the ciphertext, decrypts it
                        locally, and the server permanently deletes its copy. The password is never visible to
                        anyone except the sender and recipient.
                    </p>

                    <h2>When to use one-time links vs a password manager</h2>
                    <p>
                        Password managers like 1Password and Bitwarden are the right tool for ongoing shared
                        access within a team. But they require both parties to have accounts and be part of
                        the same organization. One-time links are better for situations where a password manager
                        is impractical:
                    </p>
                    <ul className="seo-list">
                        <li><strong>Onboarding a new hire</strong> who does not have a password manager account yet.</li>
                        <li><strong>Sharing credentials with a client</strong> or external contractor.</li>
                        <li><strong>Sending a WiFi password</strong> to a guest or Airbnb visitor.</li>
                        <li><strong>Handing off API keys</strong> to a developer on another team.</li>
                        <li><strong>Any one-time handoff</strong> where the recipient does not need permanent access.</li>
                    </ul>

                    <h2>Share passwords safely across any channel</h2>
                    <p>
                        Because the password is encrypted before it leaves your browser, you can safely send
                        the one-time link over any channel — email, Slack, Teams, SMS, WhatsApp, or even a
                        post-it note. The link itself does not contain the password in readable form. Even if
                        someone intercepts the link after it has been used, they get nothing — the data is
                        already destroyed. For additional security, send the optional passphrase through a
                        different channel than the link.
                    </p>

                    <h2>Frequently asked questions</h2>
                    {faqItems.map((item) => (
                        <div key={item.question} className="feature-card" style={{marginBottom: 12}}>
                            <div className="feature-card-header">
                                <h3>{item.question}</h3>
                            </div>
                            <p>{item.answer}</p>
                        </div>
                    ))}

                    <h2>More ways to share securely</h2>
                    <nav className="seo-nav">
                        <Link href="/secure-file-sharing/">Send encrypted files</Link>
                        <Link href="/share-passwords-with-qr-code/">Share via QR code</Link>
                        <Link href="/password-generator/">Generate a strong password</Link>
                        <Link href="/wifi-password-generator/">WiFi password generator</Link>
                        <Link href="/api-key-generator/">API key generator</Link>
                        <Link href="/blog/how-to-share-passwords-securely/">Guide: How to share passwords securely</Link>
                        <Link href="/blog/team-password-sharing/">Guide: Team password sharing</Link>
                        <Link href="/blog/is-slack-safe-for-passwords/">Is Slack safe for passwords?</Link>
                        <Link href="/blog/how-to-send-passwords-over-email/">How to send passwords over email</Link>
                    </nav>
                </section>
            </div>
        </>
    );
}
