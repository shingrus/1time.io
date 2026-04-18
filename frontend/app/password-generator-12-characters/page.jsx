import InlineCss from '../../components/InlineCss';
import PasswordGenerator from '../../components/PasswordGenerator';
import {absoluteUrl} from '../../utils/siteConfig';

export const metadata = {
    title: '12-Character Password Generator — Free & Secure | 1time.io',
    description: 'Generate a secure 12-character password with letters, numbers, and symbols. The minimum recommended length for most accounts. Created locally in your browser.',
    alternates: { canonical: '/password-generator-12-characters' },
    openGraph: {
        title: '12-Character Password Generator — Free & Secure | 1time.io',
        description: 'Generate a secure 12-character password with letters, numbers, and symbols. The minimum recommended length for most accounts.',
        url: '/password-generator-12-characters',
        images: [{ url: '/1time-og-c1.png', width: 1200, height: 630, alt: '12-Character Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '12-Character Password Generator',
    url: absoluteUrl('/password-generator-12-characters'),
    description: 'Generate a secure 12-character password with letters, numbers, and symbols. The minimum recommended length for most accounts. Created locally in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io/' },
        { '@type': 'ListItem', position: 2, name: 'Password Generator', item: 'https://1time.io/password-generator/' },
        { '@type': 'ListItem', position: 3, name: '12-Character Password Generator', item: 'https://1time.io/password-generator-12-characters/' },
    ],
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        { '@type': 'Question', name: 'Is 12 characters enough for a secure password?', acceptedAnswer: { '@type': 'Answer', text: 'Yes for most accounts. 12 chars with mixed types gives ~78 bits of entropy. NIST and OWASP both recommend 12+ as a minimum. The real danger is password reuse, not length.' } },
        { '@type': 'Question', name: 'When should I use more than 12 characters?', acceptedAnswer: { '@type': 'Answer', text: 'For high-value accounts (email, banking, password manager vault) use 16+. For service accounts and API keys, use 20+. 12 is a solid minimum but longer is always better if your password manager handles it.' } },
        { '@type': 'Question', name: 'How long would it take to crack a 12-character password?', acceptedAnswer: { '@type': 'Answer', text: 'With all character types and 10 billion guesses per second, about 5,000 years. That\'s well beyond any realistic threat. GPU clusters and cloud computing can increase speed, but 12 random characters remain infeasible to brute-force.' } },
        { '@type': 'Question', name: 'Why do some sites still only require 8 characters?', acceptedAnswer: { '@type': 'Answer', text: 'Legacy policies. Many organizations haven\'t updated their requirements since the early 2000s. The industry consensus has moved to 12+ characters minimum. Always use at least 12 regardless of what a site requires.' } },
    ],
};

export default function PasswordGenerator12CharPage() {
    return (
        <>
            <InlineCss file="styles/generator.css" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <PasswordGenerator presetPath="/password-generator-12-characters" />
        </>
    );
}
