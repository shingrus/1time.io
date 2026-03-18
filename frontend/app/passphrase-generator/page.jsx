import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Passphrase Generator — Memorable & Secure Multi-Word Passwords',
    description: 'Generate memorable multi-word passphrases that are easy to type and hard to crack. Uses cryptographic randomness, runs entirely in your browser.',
    alternates: { canonical: '/passphrase-generator' },
    openGraph: {
        title: 'Passphrase Generator — Memorable & Secure Multi-Word Passwords',
        description: 'Generate memorable multi-word passphrases that are easy to type and hard to crack. Uses cryptographic randomness.',
        url: '/passphrase-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Passphrase Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Passphrase Generator',
    url: 'https://onetimelink.me/passphrase-generator',
    description: 'Generate memorable multi-word passphrases that are easy to type and hard to crack. Uses cryptographic randomness, runs entirely in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function PassphraseGeneratorPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/passphrase-generator" />
        </>
    );
}
