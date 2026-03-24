import Link from 'next/link';
import CodeBlock from '../../../components/CodeBlock';

export const metadata = {
    title: 'How to Share Secrets from the Terminal with End-to-End Encryption — 1time.io',
    description: 'Use the 1time CLI to share passwords, API keys, and tokens from your terminal as encrypted one-time links. No browser needed — pipe in a secret, get a self-destructing link.',
    alternates: { canonical: '/blog/share-secrets-from-terminal' },
    openGraph: {
        title: 'How to Share Secrets from the Terminal with End-to-End Encryption',
        description: 'Share passwords and API keys from your terminal. Pipe in a secret, get an encrypted self-destructing link. No browser needed.',
        url: '/blog/share-secrets-from-terminal',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Share Secrets from the Terminal' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'How to Share Secrets from the Terminal with End-to-End Encryption',
        description: 'Share passwords and API keys from your terminal. Pipe in a secret, get an encrypted self-destructing link.',
    },
};

const jsonLd = [
    {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'How to Share Secrets from the Terminal with End-to-End Encryption',
        description: 'Use the 1time CLI to share passwords, API keys, and tokens from your terminal as encrypted one-time links. No browser needed.',
        datePublished: '2026-03-22',
        dateModified: '2026-03-22',
        author: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io' },
        publisher: { '@type': 'Organization', name: '1time.io', url: 'https://1time.io', logo: { '@type': 'ImageObject', url: 'https://1time.io/logo-512.png', width: 512, height: 512 } },
        mainEntityOfPage: 'https://1time.io/blog/share-secrets-from-terminal',
        image: ['https://1time.io/og-image.png'],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://1time.io/blog' },
            { '@type': 'ListItem', position: 3, name: 'Share Secrets from the Terminal', item: 'https://1time.io/blog/share-secrets-from-terminal' },
        ],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: 'How do I share a password from the terminal securely?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Install the 1time CLI with npm install -g @1time/cli, then pipe your password: printf \'my-password\' | 1time send. You get an encrypted one-time link that self-destructs after being read.',
                },
            },
            {
                '@type': 'Question',
                name: 'Can I use 1time CLI with a self-hosted server?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes. Use the --host flag to point at your own instance: printf \'secret\' | 1time send --host https://secrets.yourcompany.com',
                },
            },
            {
                '@type': 'Question',
                name: 'Is the 1time CLI end-to-end encrypted?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes. The CLI encrypts your secret locally with AES-256-GCM before sending anything to the server. The server only stores encrypted ciphertext and never sees the plaintext or decryption key.',
                },
            },
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
                <span className="article-tag">DevOps</span>
                <h1>How to Share Secrets from the Terminal with End-to-End Encryption</h1>
                <p className="article-subtitle">
                    You are in a terminal. You need to send a database password to a colleague. Opening a browser
                    feels wrong. Pasting it into Slack feels worse. Here is a better way.
                </p>
                <div className="article-meta">Mar 22, 2026 &middot; 5 min read</div>
            </div>

            <div className="article-body">
                <h2>The problem with sharing secrets in DevOps</h2>
                <p>
                    Every DevOps engineer and sysadmin has been in this situation: you need to share a database
                    connection string, an API key, or a root password with someone on your team. Right now.
                </p>
                <p>
                    The usual options are all bad:
                </p>
                <ul>
                    <li><strong>Slack / Teams:</strong> Persisted in message history, indexed, searchable. One compromised account exposes every secret ever shared.</li>
                    <li><strong>Email:</strong> Stored in multiple mailboxes, backed up to archives, often unencrypted at rest.</li>
                    <li><strong>Shared docs / wikis:</strong> Credentials rot in Confluence pages that nobody remembers to update or delete.</li>
                    <li><strong>Verbal / phone:</strong> Secure, but try dictating <code>xK9#mP2$vL7@nQ4</code> over a call.</li>
                </ul>
                <p>
                    Secret managers like Vault and AWS Secrets Manager solve the storage problem, but not the
                    ad-hoc sharing problem. When you are onboarding a contractor, debugging a production issue
                    at 2 AM, or rotating credentials during an incident, you need something faster.
                </p>

                <h2>One-time links from the terminal</h2>
                <p>
                    The <a href="https://www.npmjs.com/package/@1time/cli" target="_blank" rel="noopener noreferrer">1time CLI</a> lets
                    you create encrypted, self-destructing links directly from your terminal:
                </p>
                <CodeBlock>{`$ npm install -g @1time/cli

$ printf '%s' "$DATABASE_URL" | 1time send
https://1time.io/v/#eyJpZCI6ImFiYzEyMyIsImtleSI6...`}</CodeBlock>
                <p>
                    That is it. You get a one-time link. Send it to your colleague over whatever channel you
                    want &mdash; Slack, email, SMS. Once they open it, the secret is decrypted in their browser
                    and permanently deleted from the server. If nobody opens it, it expires automatically.
                </p>

                <h2>How the encryption works</h2>
                <p>
                    The CLI uses the same encryption protocol as the{' '}
                    <Link href="/">1time.io web app</Link>:
                </p>
                <ol>
                    <li>A random key is generated locally on your machine</li>
                    <li>Your secret is encrypted with <strong>AES-256-GCM</strong> using a key derived via <strong>HKDF-SHA256</strong></li>
                    <li>Only the encrypted ciphertext is sent to the server</li>
                    <li>The decryption key lives in the URL fragment (<code>#</code>), which is <strong>never sent to the server</strong></li>
                </ol>
                <p>
                    The server stores an encrypted blob it cannot decrypt. Even with full database access and
                    server compromise, your secrets remain unreadable. This is zero-knowledge architecture &mdash; the
                    same principle behind end-to-end encrypted messaging apps.
                </p>

                <h2>Real-world workflows</h2>

                <h3>Pipe from any command</h3>
                <p>
                    The CLI reads from <code>stdin</code>, so you can pipe output from any command:
                </p>
                <CodeBlock>{`# Share an environment variable
printf '%s' "$DATABASE_URL" | 1time send

# Share output from a secrets manager
vault kv get -field=password secret/prod/db | 1time send

# Share a generated password
openssl rand -base64 32 | 1time send`}</CodeBlock>

                <h3>Read a secret someone sent you</h3>
                <CodeBlock>{`$ 1time read 'https://1time.io/v/#eyJpZCI6...'
postgres://admin:s3cret@db.prod.internal:5432/myapp`}</CodeBlock>
                <p>
                    The secret is decrypted locally and printed to stdout. You can pipe it into another
                    command, write it to a file, or use it in a script.
                </p>

                <h3>Self-hosted instances</h3>
                <p>
                    If your team runs a{' '}
                    <a href="https://github.com/shingrus/1time" target="_blank" rel="noopener noreferrer">self-hosted 1time instance</a>,
                    point the CLI at your own server:
                </p>
                <CodeBlock>{`printf 'secret' | 1time send --host https://secrets.yourcompany.com`}</CodeBlock>
                <p>
                    Data never leaves your infrastructure. The CLI enforces HTTPS for remote hosts and only
                    allows plain HTTP for loopback addresses during local development.
                </p>

                <h2>Security considerations</h2>
                <p>
                    The CLI is designed for the security-conscious:
                </p>
                <ul>
                    <li>
                        <strong>Prefer <code>stdin</code> over arguments:</strong> Use{' '}
                        <code>printf &apos;secret&apos; | 1time send</code> instead of <code>1time send &apos;secret&apos;</code>.
                        Command-line arguments are visible in <code>ps</code> output and shell history.
                    </li>
                    <li>
                        <strong>Environment variable input:</strong> For CI/CD pipelines, you can also use{' '}
                        <code>1TIME_SECRET</code> as an environment variable.
                    </li>
                    <li>
                        <strong>No config files:</strong> The CLI does not write any files to disk. No credentials
                        stored, no state files, no logs.
                    </li>
                    <li>
                        <strong>Minimal dependencies:</strong> Uses Node.js built-in <code>crypto</code> module.
                        No third-party encryption libraries.
                    </li>
                </ul>

                <h2>Compared to alternatives</h2>
                <p>
                    There are other ways to share one-time secrets. Here is how the 1time CLI compares:
                </p>
                <ul>
                    <li>
                        <strong>Yopass CLI:</strong> Also end-to-end encrypted with a CLI. Requires a Go toolchain
                        to install or pre-built binaries. 1time installs with a single <code>npm install</code> and
                        requires only Node.js, which most DevOps teams already have.
                    </li>
                    <li>
                        <strong>Password Pusher:</strong> Has a CLI, but the server-side encryption means the
                        server can read your secrets. 1time uses client-side encryption &mdash; the server
                        never sees plaintext.
                    </li>
                    <li>
                        <strong>OneTimeSecret:</strong> No official CLI. Server-side encryption only. Ruby stack
                        is heavier for self-hosting.
                    </li>
                    <li>
                        <strong>GPG-encrypted email:</strong> Secure, but requires key exchange and is painful
                        for one-off credential sharing.
                    </li>
                    <li>
                        <strong>age / sops:</strong> Excellent for encrypting files and secrets at rest, but not
                        designed for one-time sharing links.
                    </li>
                </ul>

                <h2>Getting started</h2>
                <CodeBlock>{`npm install -g @1time/cli`}</CodeBlock>
                <p>
                    Requires Node.js 20 or later. The CLI is{' '}
                    <a href="https://github.com/shingrus/1time/tree/master/cli" target="_blank" rel="noopener noreferrer">open source</a> (MIT
                    license) and the full encryption implementation is about 200 lines of JavaScript you can audit yourself.
                </p>
                <p>
                    Or use the web version at <Link href="/">1time.io</Link> &mdash; same encryption, no install required.
                </p>
            </div>
        </article>
    );
}
