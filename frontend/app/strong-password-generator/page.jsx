import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Strong Password Generator — Create Uncrackable Passwords',
    description: 'Generate strong 24+ character passwords with uppercase, lowercase, numbers, and symbols. Cryptographically random, generated in your browser.',
    alternates: { canonical: '/strong-password-generator' },
    openGraph: {
        title: 'Strong Password Generator — Create Uncrackable Passwords',
        description: 'Generate strong 24+ character passwords with uppercase, lowercase, numbers, and symbols. Cryptographically random, generated in your browser.',
        url: '/strong-password-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Strong Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Strong Password Generator',
    url: 'https://onetimelink.me/strong-password-generator',
    description: 'Generate strong 24+ character passwords with uppercase, lowercase, numbers, and symbols. Cryptographically random, generated in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function StrongPasswordGeneratorPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/strong-password-generator" />
        </>
    );
}
