import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'WiFi Password Generator — onetimelink.me',
    description: 'Generate strong, random WiFi passwords that are secure yet easy to type. Created locally in your browser. Free, instant, and private.',
    alternates: { canonical: '/wifi-password-generator' },
    openGraph: {
        title: 'WiFi Password Generator — onetimelink.me',
        description: 'Generate strong WiFi passwords that are secure yet easy to type. Created in your browser.',
        url: '/wifi-password-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'WiFi Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'WiFi Password Generator',
    url: 'https://onetimelink.me/wifi-password-generator',
    description: 'Generate strong, random WiFi passwords that are secure yet easy to type. Created locally in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function WifiPasswordGeneratorPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PasswordGenerator presetPath="/wifi-password-generator" />
        </>
    );
}
