import Link from 'next/link';
import InlineCss from '../../components/InlineCss';
import SecureFileShare from '../../components/SecureFileShare';
import {absoluteUrl, siteHost} from '../../utils/siteConfig';

export const metadata = {
    title: `Secure File Sharing — Send Encrypted Files with One-Time Links | ${siteHost}`,
    description: 'Send files securely through end-to-end encrypted one-time links. Share documents, PDFs, certificates, and confidential files with auto-expiry and zero-knowledge encryption.',
    alternates: { canonical: '/secure-file-sharing' },
    openGraph: {
        title: `Secure File Sharing with One-Time Links | ${siteHost}`,
        description: 'Encrypted file sharing with one-time download links. Files are encrypted in your browser and destroyed after download or expiry.',
        url: '/secure-file-sharing',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Secure file sharing with encrypted one-time links' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: `Secure File Sharing with One-Time Links | ${siteHost}`,
        description: 'Encrypted file sharing with one-time download links. Files are encrypted in your browser and destroyed after download or expiry.',
    },
};

const faqItems = [
    {
        question: 'How does secure file sharing work on 1time.io?',
        answer: 'Your file is packed and encrypted in the browser before upload. The server stores only encrypted bytes. The download link works once, and the file is deleted after it is downloaded or when the expiry time is reached.',
    },
    {
        question: 'Can the server see my file name or contents?',
        answer: 'No. The file contents and file metadata stay inside the encrypted payload. For now, the filename, MIME type, and size are not stored separately on the server.',
    },
    {
        question: 'Can I protect the file link with an extra passphrase?',
        answer: 'Yes. Add an optional passphrase when creating the link. The recipient will need both the link and that passphrase to decrypt the file.',
    },
    {
        question: 'What files can I send securely?',
        answer: 'Any file up to 10 MB, including PDFs, text files, archives, certificates, configuration exports, screenshots, and private documents.',
    },
];

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Secure File Sharing',
        description: 'Send encrypted files with one-time links. Browser-side encryption, optional passphrase, and auto-expiry.',
        url: absoluteUrl('/secure-file-sharing/'),
        isPartOf: absoluteUrl('/'),
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
            { '@type': 'ListItem', position: 2, name: 'Secure File Sharing', item: absoluteUrl('/secure-file-sharing/') },
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

export default function SecureFileSharingPage() {
    return (
        <>
            <InlineCss file="styles/home.css" />
            <InlineCss file="styles/file-sharing.css" />
            {jsonLd.map((schema, index) => (
                <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
            ))}

            <div className="share-flow-page">
                <nav className="share-mode-nav" aria-label="Choose sharing mode">
                    <Link href="/" className="share-mode-link">
                        Text Secret
                    </Link>
                    <Link href="/secure-file-sharing/" className="share-mode-link share-mode-link-active">
                        Secure File Sharing
                    </Link>
                </nav>
                <SecureFileShare />

                <section className="seo-section">
                    <h1>Send Files Securely with Encrypted One-Time Links</h1>
                    <h2>Why use one-time encrypted file sharing?</h2>
                    <p>
                        Regular file sharing leaves copies sitting in chat history, email inboxes, and cloud
                        folders for far longer than necessary. {siteHost} is built for the opposite use case:
                        deliver a sensitive file once, let the recipient download it, and remove it from the server.
                    </p>

                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4c2;</div>
                                <h2>Encrypted before upload</h2>
                            </div>
                            <p>The browser encrypts the file first. The server only receives encrypted bytes.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f510;</div>
                                <h2>Optional passphrase</h2>
                            </div>
                            <p>Add a second factor so the link alone is not enough to decrypt the file.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4a3;</div>
                                <h2>One-time download</h2>
                            </div>
                            <p>Once the recipient downloads the file, the stored copy is deleted from the server.</p>
                        </div>
                        <Link href="/" className="feature-card feature-card-link">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4dd;</div>
                                <h2>Text Secret Sharing</h2>
                            </div>
                            <p>Need to send a password, token, or short note instead of a file? Use the text flow.</p>
                        </Link>
                    </div>

                    <h2>What secure file sharing is good for</h2>
                    <p>
                        This page is best for one-off handoffs: configuration exports, client certificates,
                        NDA PDFs, database backups, screenshots with sensitive data, support bundles, and internal
                        documents that should not live forever in Slack, email, or a shared drive.
                    </p>

                    <h2>How the encrypted file flow works</h2>
                    <p>
                        Choose a file, optionally add a passphrase, and create the link. The browser packs the file
                        together with its metadata, encrypts the whole payload locally, and uploads only the encrypted blob.
                        The recipient gets a one-time download link. On open, the browser decrypts the file locally and
                        the server-side copy is destroyed.
                    </p>

                    <h2>Frequently asked questions</h2>
                    {faqItems.map((item) => (
                        <div key={item.question} className="feature-card" style={{marginBottom: 12}}>
                            <div className="feature-card-header">
                                <h2>{item.question}</h2>
                            </div>
                            <p>{item.answer}</p>
                        </div>
                    ))}

                    <h2>Learn more</h2>
                    <nav className="seo-nav">
                        <Link href="/">Share passwords and secrets</Link>
                        <Link href="/blog/how-to-share-passwords-securely">How to share passwords securely</Link>
                        <Link href="/blog/how-to-share-api-keys">How to share API keys securely</Link>
                        <Link href="/blog/stop-sending-passwords-over-slack">Stop sending passwords over Slack</Link>
                        <Link href="/blog/share-secrets-from-terminal">Share secrets from terminal</Link>
                        <Link href="/about">About 1time.io</Link>
                    </nav>
                </section>
            </div>
        </>
    );
}
