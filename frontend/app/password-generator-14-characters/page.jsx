import InlineCss from '../../components/InlineCss';
import PasswordGenerator from '../../components/PasswordGenerator';
import {absoluteUrl} from '../../utils/siteConfig';

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
    url: absoluteUrl('/password-generator-14-characters'),
    description: 'Generate a secure 14-character password with letters, numbers, and symbols. Meets most site requirements. Generated locally in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://1time.io' },
        { '@type': 'ListItem', position: 2, name: 'Password Generator', item: 'https://1time.io/password-generator' },
        { '@type': 'ListItem', position: 3, name: '14-Character Password Generator', item: 'https://1time.io/password-generator-14-characters' },
    ],
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        { '@type': 'Question', name: 'Is 14 characters enough for a secure password?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, for the vast majority of use cases. A 14-character password with mixed character types has about 91 bits of entropy — well beyond what\'s needed to resist brute-force attacks. The bigger risk is password reuse, not password length.' } },
        { '@type': 'Question', name: 'What sites require exactly 14 characters?', acceptedAnswer: { '@type': 'Answer', text: 'Few sites set exact requirements, but many set minimums of 8-12 characters with maximum limits of 16-128. A 14-character password comfortably meets almost all minimum requirements while staying well under maximum limits.' } },
        { '@type': 'Question', name: 'Should I use 14 or 16 characters?', acceptedAnswer: { '@type': 'Answer', text: 'If you\'re storing passwords in a manager and don\'t need to type them, go with 16+ characters for extra margin. If you\'re choosing 14 characters for compatibility or convenience, that\'s completely fine for standard accounts.' } },
        { '@type': 'Question', name: 'Can I use this password for my WiFi?', acceptedAnswer: { '@type': 'Answer', text: 'You can, but consider using the WiFi Password Generator instead — it creates passwords without confusing symbols, making them easier to type on phones and smart TVs.' } },
    ],
};

export default function PasswordGenerator14CharPage() {
    return (
        <>
            <InlineCss file="styles/generator.css" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <PasswordGenerator presetPath="/password-generator-14-characters" />
        </>
    );
}
