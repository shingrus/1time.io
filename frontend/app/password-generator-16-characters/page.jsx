import InlineCss from '../../components/InlineCss';
import PasswordGenerator from '../../components/PasswordGenerator';
import {absoluteUrl, siteHost} from '../../utils/siteConfig';

export const metadata = {
    title: `16-Character Password Generator — ${siteHost}`,
    description: 'Generate a strong 16-character password with letters, numbers, and symbols. Created in your browser with cryptographic randomness. Free and instant.',
    alternates: { canonical: '/password-generator-16-characters' },
    openGraph: {
        title: `16-Character Password Generator — ${siteHost}`,
        description: 'Generate a strong 16-character password with letters, numbers, and symbols. Created in your browser instantly.',
        url: '/password-generator-16-characters',
        images: [{ url: '/1time-og-main.png', width: 1200, height: 630, alt: '16-Character Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '16-Character Password Generator',
    url: absoluteUrl('/password-generator-16-characters'),
    description: 'Generate a strong 16-character password with letters, numbers, and symbols. Created in your browser with cryptographic randomness.',
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
        { '@type': 'ListItem', position: 3, name: '16-Character Password Generator', item: 'https://1time.io/password-generator-16-characters/' },
    ],
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        { '@type': 'Question', name: 'Is 16 characters overkill for personal accounts?', acceptedAnswer: { '@type': 'Answer', text: 'Not at all. If you\'re using a password manager (which you should be), the length costs you nothing — you never type it manually. 16 characters provides a substantial safety margin against future advances in computing power, including potential quantum computing attacks on weaker passwords.' } },
        { '@type': 'Question', name: 'How does 16 characters compare to 12?', acceptedAnswer: { '@type': 'Answer', text: 'With all character types enabled, 16 characters gives about 105 bits of entropy vs 78 bits for 12 characters. That\'s roughly 10 million times harder to crack. Since password managers handle the complexity, there\'s no reason not to use the longer option.' } },
        { '@type': 'Question', name: 'Will all websites accept 16-character passwords?', acceptedAnswer: { '@type': 'Answer', text: 'Nearly all modern websites accept 16 characters. A few legacy systems have maximum limits of 12 or even 8 characters — in those cases, use the longest length allowed and consider the 14-character generator as an alternative.' } },
        { '@type': 'Question', name: 'Do I need symbols in a 16-character password?', acceptedAnswer: { '@type': 'Answer', text: 'Symbols help but aren\'t critical at this length. A 16-character alphanumeric password (no symbols) has about 95 bits of entropy — still very strong. Adding symbols bumps it to 105 bits. If a site doesn\'t accept symbols, an alphanumeric 16-character password is perfectly secure.' } },
    ],
};

export default function PasswordGenerator16Page() {
    return (
        <>
            <InlineCss file="styles/generator.css" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <PasswordGenerator presetPath="/password-generator-16-characters" />
        </>
    );
}
