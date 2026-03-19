import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: '14-Character Password Generator — Quick & Secure',
    description: 'Generate a secure 14-character password with letters, numbers, and symbols. Meets most site requirements. Generated locally in your browser.',
    alternates: { canonical: '/password-generator-14-characters' },
    openGraph: {
        title: '14-Character Password Generator — Quick & Secure',
        description: 'Generate a secure 14-character password with letters, numbers, and symbols. Meets most site requirements.',
        url: '/password-generator-14-characters',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '14-Character Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '14-Character Password Generator',
    url: 'https://onetimelink.me/password-generator-14-characters',
    description: 'Generate a secure 14-character password with letters, numbers, and symbols. Meets most site requirements. Generated locally in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function PasswordGenerator14CharPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/password-generator-14-characters" />
        </>
    );
}
