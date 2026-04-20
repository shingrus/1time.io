import Link from 'next/link';
import InlineCss from '../../components/InlineCss';
import NewMessage from '../../components/NewMessage';
import {absoluteUrl, siteHost} from '../../utils/siteConfig';

export const metadata = {
    title: `Share Passwords Safely in Microsoft Teams — One-Time Encrypted Links | ${siteHost}`,
    description: 'Stop pasting passwords into Teams chat. Send a one-time encrypted link instead — survives retention policies, eDiscovery, and Purview. Free, zero-knowledge, no signup.',
    alternates: { canonical: '/share-passwords-microsoft-teams' },
    openGraph: {
        title: `Share Passwords Safely in Microsoft Teams | ${siteHost}`,
        description: 'One-time encrypted links for sharing passwords, API keys, and secrets inside Microsoft Teams. Retention-safe, eDiscovery-safe, zero-knowledge.',
        url: '/share-passwords-microsoft-teams',
        images: [{ url: '/1time-og-c1.png', width: 1200, height: 630, alt: 'Share passwords safely in Microsoft Teams with encrypted one-time links' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: `Share Passwords Safely in Microsoft Teams | ${siteHost}`,
        description: 'One-time encrypted links for sharing secrets inside Microsoft Teams. Retention-safe, eDiscovery-safe, zero-knowledge.',
    },
};

const faqItems = [
    {
        question: 'Is it safe to send passwords in Microsoft Teams chat?',
        answer: 'No. Teams messages are retained according to your tenant\'s retention policy (often years), indexed by Microsoft Purview, and discoverable through eDiscovery. Global admins and compliance officers can read the plaintext. Even after you delete a message, copies persist in compliance archives and backups. A password pasted into Teams chat is effectively a long-lived credential leak.',
    },
    {
        question: 'How does a one-time link fix the Teams retention problem?',
        answer: 'The Teams message only contains a URL — not the password itself. Retention captures the wrapper, not the secret. After the recipient opens the link once, the encrypted payload is permanently deleted from 1time.io servers. Anyone reading the retained Teams message later (auditors, admins, attackers who compromise the tenant) just sees a dead link.',
    },
    {
        question: 'Does the Teams link preview burn my one-time secret?',
        answer: 'No. Microsoft Teams fetches link previews, but 1time.io shows an explicit "Read and consume" button on the recipient page. The preview bot sees the landing page, not the decrypted secret. The secret is only revealed when a human clicks the button, so Teams unfurls are safe.',
    },
    {
        question: 'Can my Teams admin or IT see the password I share through 1time.io?',
        answer: 'No. The password is encrypted in the sender\'s browser with AES-256-GCM before it leaves the device. The decryption key lives in the URL fragment (the part after #), which browsers never send to servers. Your Teams admin sees the link in chat history but cannot decrypt the content.',
    },
    {
        question: 'Can this help with GDPR, SOC 2, and ISO 27001 controls?',
        answer: 'One-time links can support data-minimisation and secret-handling controls under frameworks such as GDPR, SOC 2, and ISO 27001 because the secret is encrypted in the browser, shared as a link, and deleted after one read. Whether your organisation is compliant still depends on your broader policies, retention settings, access controls, and legal review.',
    },
    {
        question: 'Can I add an extra passphrase on top of the Teams link?',
        answer: 'Yes. When you create the link, set an optional passphrase and send it through a different channel (voice call, SMS, another Teams chat). The recipient needs both the link and the passphrase to decrypt. This defeats anyone who only has access to the Teams message.',
    },
    {
        question: 'What about sharing API keys, certificates, or config files through Teams?',
        answer: 'The same workflow works for any text secret (API keys, tokens, connection strings) via the text sharing form, and for files up to 10 MB (certificates, .env files, kubeconfig, PDFs) via secure file sharing. Drop the one-time link in Teams chat instead of pasting or attaching the raw content.',
    },
];

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Share Passwords Safely in Microsoft Teams',
        description: 'Send passwords and secrets inside Microsoft Teams through encrypted one-time links. Retention-safe, eDiscovery-safe, zero-knowledge.',
        url: absoluteUrl('/share-passwords-microsoft-teams/'),
        isPartOf: absoluteUrl('/'),
        datePublished: '2026-04-20',
        dateModified: '2026-04-20',
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
            { '@type': 'ListItem', position: 2, name: 'Share Passwords in Microsoft Teams', item: absoluteUrl('/share-passwords-microsoft-teams/') },
        ],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Secure Password Sharing for Microsoft Teams',
        url: absoluteUrl('/share-passwords-microsoft-teams/'),
        description: 'Share passwords, API keys, and files inside Microsoft Teams through encrypted one-time links. End-to-end encrypted in the browser with AES-256-GCM.',
        applicationCategory: 'SecurityApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: 'End-to-end encryption, One-time access, Retention-safe, eDiscovery-safe, Optional passphrase, Zero-knowledge architecture',
    },
];

export default function MicrosoftTeamsPage() {
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
                    <h1>Share Passwords Safely in Microsoft Teams</h1>
                    <p>
                        Pasting a password into Microsoft Teams chat looks harmless, but the message sticks
                        around: retention policies keep it for months or years, Microsoft Purview indexes it,
                        and eDiscovery makes it searchable by compliance officers. Every credential pasted in
                        Teams is a long-lived secret waiting to leak. {siteHost} solves this by turning any
                        password, API key, or file into a one-time encrypted link you can safely drop into
                        any Teams chat, channel, or meeting.
                    </p>

                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f4c1;</div>
                                <h2>Retention-safe</h2>
                            </div>
                            <p>Teams retains the link, not the password. Once read, the secret is destroyed on our server, so retained messages point to nothing.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f50d;</div>
                                <h2>eDiscovery-safe</h2>
                            </div>
                            <p>Purview and eDiscovery can index the URL all they want — the decrypted secret never existed on any Microsoft server.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f6e1;&#xfe0f;</div>
                                <h2>Preview-safe</h2>
                            </div>
                            <p>The Teams link unfurl hits a landing page with an explicit &#34;Read and consume&#34; button. Preview bots do not burn the secret.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-header">
                                <div className="feature-card-icon" aria-hidden="true">&#x1f510;</div>
                                <h2>Zero-knowledge</h2>
                            </div>
                            <p>The decryption key stays in the URL fragment. Microsoft, your IT admin, and {siteHost} all see ciphertext only.</p>
                        </div>
                    </div>

                    <h2>Why you should never paste passwords into Teams chat</h2>
                    <p>
                        Microsoft Teams is convenient, but its architecture is the opposite of what a shared
                        secret needs. Chat messages are stored according to the tenant&apos;s{' '}
                        <a
                            href="https://learn.microsoft.com/en-us/microsoftteams/retention-policies"
                            target="_blank"
                            rel="noopener"
                        >
                            Teams retention policy
                        </a>
                        {' '}— often for the life of the user account.{' '}
                        <a
                            href="https://learn.microsoft.com/en-us/purview/ediscovery"
                            target="_blank"
                            rel="noopener"
                        >
                            Microsoft Purview eDiscovery
                        </a>
                        {' '}indexes every message for compliance search. Global admins, compliance
                        officers, and anyone with eDiscovery rights can read Teams DMs, including ones you
                        deleted. Messages you send to a channel persist in the channel&apos;s SharePoint
                        site. If a tenant is ever compromised, every password ever pasted in Teams is
                        trivially harvestable.
                    </p>
                    <p>
                        A one-time encrypted link inverts the problem. The Teams message contains only a
                        URL. The actual secret lives — briefly — on {siteHost} in ciphertext form, gets read
                        once, and is destroyed. Anyone reading the retained Teams message after that moment
                        (auditor, admin, attacker) sees a dead link with no way to recover the plaintext.
                    </p>

                    <h2>How the Teams workflow works</h2>
                    <ol className="seo-list">
                        <li><strong>Paste the password</strong> into the form above and click &#34;Create secret link&#34;. Encryption happens in your browser with AES-256-GCM before anything leaves your device.</li>
                        <li><strong>Copy the link</strong> and drop it into any Teams chat, channel post, or meeting chat.</li>
                        <li><strong>Teams renders a preview</strong> with a &#34;Read and consume&#34; call to action — no secret is revealed to the preview bot.</li>
                        <li><strong>The recipient clicks through</strong>, confirms they want to read, and the secret is shown exactly once.</li>
                        <li><strong>The server deletes the encrypted payload.</strong> The retained Teams message now points to a link that will never work again.</li>
                    </ol>

                    <h2>When to use one-time links inside Teams</h2>
                    <ul className="seo-list">
                        <li><strong>Onboarding a new hire</strong> — send initial credentials for VPN, ERP, or admin tools in their welcome Teams chat.</li>
                        <li><strong>Rotating a shared service account password</strong> across the team without leaving 30 copies in channel history.</li>
                        <li><strong>Sharing an API key or token</strong> with a dev in another squad through their Teams DM.</li>
                        <li><strong>Handing off a kubeconfig or .env file</strong> via secure file sharing dropped into a Teams channel.</li>
                        <li><strong>Vendor or client handoffs</strong> where an external Teams guest needs a one-time credential.</li>
                        <li><strong>Break-glass / incident response</strong> — share root credentials in the incident Teams channel without burning them into permanent history.</li>
                    </ul>

                    <h2>How one-time links support compliance controls</h2>
                    <p>
                        Many security and privacy frameworks expect organisations to minimise plaintext
                        credential exposure in communication tools. GDPR Article 5 emphasises data
                        minimisation. SOC 2 CC6 and ISO 27001 Annex A.10 focus on access control and
                        cryptography for secrets. NIS2 raises the bar further for risk reduction and
                        operational resilience. Pasting a password into Teams chat creates a persistent,
                        discoverable copy that can work against those control goals.
                    </p>
                    <p>
                        Replacing plaintext-in-chat with one-time encrypted links can be a useful control
                        for secret handling. {siteHost} stores ciphertext, deletes it after a single read,
                        requires no account, and is open source so your security team can review the
                        implementation. Whether that satisfies your organisation&apos;s compliance obligations
                        still depends on your wider controls, governance, and legal review.
                    </p>

                    <h2>Teams alternatives we compare to</h2>
                    <p>
                        Microsoft&apos;s own suggestion for sharing secrets inside Teams is usually &#34;use
                        a password manager.&#34; That&apos;s the right tool for <em>ongoing</em> shared
                        access inside a team — but it requires both parties to have accounts in the same
                        vault. For one-off handoffs across team boundaries, tenants, or with external
                        guests, a one-time link is faster and leaves no long-term copy anywhere.
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

                    <h2>Related guides and tools</h2>
                    <nav className="seo-nav">
                        <Link href="/share-password-securely/">Share passwords securely</Link>
                        <Link href="/secure-file-sharing/">Send encrypted files</Link>
                        <Link href="/blog/team-password-sharing/">Team password sharing guide</Link>
                        <Link href="/blog/is-slack-safe-for-passwords/">Is Slack safe for passwords?</Link>
                        <Link href="/blog/stop-sending-passwords-over-slack/">Stop sending passwords over Slack</Link>
                        <Link href="/blog/how-to-send-passwords-over-email/">How to send passwords over email</Link>
                        <Link href="/blog/how-to-share-api-keys/">How to share API keys securely</Link>
                        <Link href="/password-generator/">Generate a strong password</Link>
                    </nav>
                </section>
            </div>
        </>
    );
}
