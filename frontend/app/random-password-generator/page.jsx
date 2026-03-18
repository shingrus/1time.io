import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Random Password Generator — Cryptographically Secure',
    description: 'Generate truly random passwords using the Web Crypto API. No server involved — all passwords created locally in your browser with real cryptographic randomness.',
    alternates: { canonical: '/random-password-generator' },
    openGraph: {
        title: 'Random Password Generator — Cryptographically Secure',
        description: 'Generate truly random passwords using the Web Crypto API. No server involved — all passwords created locally in your browser.',
        url: '/random-password-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Random Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Random Password Generator',
    url: 'https://onetimelink.me/random-password-generator',
    description: 'Generate truly random passwords using the Web Crypto API. No server involved — all passwords created locally in your browser with real cryptographic randomness.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function RandomPasswordGeneratorPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/random-password-generator" />
        </>
    );
}
