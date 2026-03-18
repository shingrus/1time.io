import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: '16-Character Password Generator — onetimelink.me',
    description: 'Generate a strong 16-character password with letters, numbers, and symbols. Created in your browser with cryptographic randomness. Free and instant.',
    alternates: { canonical: '/password-generator-16-characters' },
    openGraph: {
        title: '16-Character Password Generator — onetimelink.me',
        description: 'Generate a strong 16-character password with letters, numbers, and symbols. Created in your browser instantly.',
        url: '/password-generator-16-characters',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '16-Character Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '16-Character Password Generator',
    url: 'https://onetimelink.me/password-generator-16-characters',
    description: 'Generate a strong 16-character password with letters, numbers, and symbols. Created in your browser with cryptographic randomness.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function PasswordGenerator16Page() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/password-generator-16-characters" />
        </>
    );
}
