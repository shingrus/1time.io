import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Create a 14-Character Password with Symbols — Quick & Secure',
    description: 'Instantly create a secure 14-character password with letters, numbers, and symbols. Meets most site requirements. Generated locally in your browser.',
    alternates: { canonical: '/create-password-14-symbols' },
    openGraph: {
        title: 'Create a 14-Character Password with Symbols — Quick & Secure',
        description: 'Instantly create a secure 14-character password with letters, numbers, and symbols. Meets most site requirements.',
        url: '/create-password-14-symbols',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '14-Character Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Create a 14-Character Password with Symbols',
    url: 'https://onetimelink.me/create-password-14-symbols',
    description: 'Instantly create a secure 14-character password with letters, numbers, and symbols. Meets most site requirements. Generated locally in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function Create14CharPasswordPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/create-password-14-symbols" />
        </>
    );
}
