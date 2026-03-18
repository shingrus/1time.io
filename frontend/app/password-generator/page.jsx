import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Free Password Generator — onetimelink.me',
    description: 'Generate strong, random passwords and passphrases in your browser. Client-side only, nothing sent to a server. Free, fast, and open source.',
    alternates: { canonical: '/password-generator' },
    openGraph: {
        title: 'Free Password Generator — onetimelink.me',
        description: 'Generate strong, random passwords and passphrases in your browser. Client-side only, nothing sent to a server.',
        url: '/password-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Free Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Free Password Generator',
    url: 'https://onetimelink.me/password-generator',
    description: 'Generate strong, random passwords and passphrases in your browser. Client-side only, nothing sent to a server.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function PasswordGeneratorPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/password-generator" />
        </>
    );
}
