import InlineCss from '../components/InlineCss';
import NewMessage from '../components/NewMessage';
import {siteHost, siteUrl} from '../utils/siteConfig';

export const metadata = {
    title: `Share Passwords Securely — Free Encrypted One-Time Links | ${siteHost}`,
    description: 'Share passwords and secrets through encrypted one-time links and QR codes that self-destruct after reading. Zero-knowledge encryption, free, open source.',
    alternates: { canonical: '/' },
    openGraph: {
        title: `${siteHost} — Free Encrypted One-Time Secret Links`,
        description: 'Send passwords and sensitive data through encrypted one-time links and QR codes. Zero-knowledge encryption, auto-destroyed after reading.',
        url: '/',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${siteHost} — Encrypted One-Time Secret Links` }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteHost,
    url: siteUrl,
    description: 'Share passwords, tokens, and sensitive data through encrypted one-time self-destruct links. End-to-end encrypted — we never see your data.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: 'End-to-end encryption, One-time access, QR code sharing, Auto-expiry, Password generator, CLI, Zero-knowledge architecture, Self-hosted',
};

export default function HomePage() {
    return (
        <>
            <InlineCss file="styles/home.css" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <NewMessage />
        </>
    );
}
