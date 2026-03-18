import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'API Key Generator — onetimelink.me',
    description: 'Generate random API keys and tokens in your browser. Cryptographically secure, customizable length, no server involved. Free and open source.',
    alternates: { canonical: '/api-key-generator' },
    openGraph: {
        title: 'API Key Generator — onetimelink.me',
        description: 'Generate random API keys and tokens in your browser. Cryptographically secure and instant.',
        url: '/api-key-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'API Key Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'API Key Generator',
    url: 'https://onetimelink.me/api-key-generator',
    description: 'Generate random API keys and tokens in your browser. Cryptographically secure, customizable length, no server involved.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function ApiKeyGeneratorPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/api-key-generator" />
        </>
    );
}
