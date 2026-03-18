import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Secure Password Generator — onetimelink.me',
    description: 'Generate cryptographically secure passwords in your browser. Uses the Web Crypto API for true randomness. Nothing is sent to a server. Free and open source.',
    alternates: { canonical: '/secure-password-generator' },
    openGraph: {
        title: 'Secure Password Generator — onetimelink.me',
        description: 'Generate cryptographically secure passwords in your browser. True randomness, nothing sent to a server.',
        url: '/secure-password-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Secure Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Secure Password Generator',
    url: 'https://onetimelink.me/secure-password-generator',
    description: 'Generate cryptographically secure passwords in your browser. Uses the Web Crypto API for true randomness. Nothing is sent to a server.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function SecurePasswordGeneratorPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/secure-password-generator" />
        </>
    );
}
