import InlineCss from '../../components/InlineCss';
import PasswordGenerator from '../../components/PasswordGenerator';
import {absoluteUrl, siteHost} from '../../utils/siteConfig';

export const metadata = {
    title: `API Key Generator — ${siteHost}`,
    description: 'Generate random API keys and tokens in your browser. Cryptographically secure, customizable length, no server involved. Free and open source.',
    alternates: { canonical: '/api-key-generator' },
    openGraph: {
        title: `API Key Generator — ${siteHost}`,
        description: 'Generate random API keys and tokens in your browser. Cryptographically secure and instant.',
        url: '/api-key-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'API Key Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'API Key Generator',
    url: absoluteUrl('/api-key-generator'),
    description: 'Generate random API keys and tokens in your browser. Cryptographically secure, customizable length, no server involved.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        { '@type': 'Question', name: 'Why 32 characters by default?', acceptedAnswer: { '@type': 'Answer', text: 'A 32-character alphanumeric string provides about 190 bits of entropy — well beyond the 128-bit security level recommended for cryptographic keys. 32 characters is also a common convention for API keys (matching the hex representation of a 128-bit value) and is accepted by virtually all services.' } },
        { '@type': 'Question', name: 'Why no symbols in API keys?', acceptedAnswer: { '@type': 'Answer', text: 'Symbols cause problems in many technical contexts. They require URL-encoding in query strings, can break shell scripts if not properly quoted, and may be rejected by systems that expect alphanumeric-only tokens. At 32 characters, the entropy from alphanumeric characters alone is more than sufficient.' } },
        { '@type': 'Question', name: 'Is it safe to generate API keys in a browser?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. This generator uses the Web Crypto API (crypto.getRandomValues), the same cryptographically secure random number generator your browser uses for HTTPS connections. The key is generated in your browser\'s memory and never transmitted anywhere. You can disconnect from the internet and the generator still works.' } },
        { '@type': 'Question', name: 'How often should I rotate API keys?', acceptedAnswer: { '@type': 'Answer', text: 'Rotate immediately if a key is exposed (committed to a public repo, shared in an unencrypted channel). For routine rotation, every 90 days is a common policy. Automated rotation through a secrets manager is ideal. Always have a plan for rotating keys without downtime — most services support having two active keys simultaneously for this purpose.' } },
    ],
};

export default function ApiKeyGeneratorPage() {
    return (
        <>
            <InlineCss file="styles/generator.css" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <PasswordGenerator presetPath="/api-key-generator" />
        </>
    );
}
