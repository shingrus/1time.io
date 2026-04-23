import InlineCss from '../../components/InlineCss';
import PasswordGenerator from '../../components/PasswordGenerator';
import {absoluteUrl} from '../../utils/siteConfig';

export const metadata = {
    title: '15-Character Password Generator — Free & Secure | 1time.io',
    description: 'Generate a strong 15-character password with letters, numbers, and symbols. Meets enterprise and compliance requirements. Created locally in your browser.',
    alternates: { canonical: '/password-generator-15-characters' },
    openGraph: {
        title: '15-Character Password Generator — Free & Secure | 1time.io',
        description: 'Generate a strong 15-character password with letters, numbers, and symbols. Meets enterprise and compliance requirements.',
        url: '/password-generator-15-characters',
        images: [{ url: '/1time-og-main.png', width: 1200, height: 630, alt: '15-Character Password Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '15-Character Password Generator',
    url: absoluteUrl('/password-generator-15-characters'),
    description: 'Generate a strong 15-character password with letters, numbers, and symbols. Meets enterprise and compliance requirements. Created locally in your browser.',
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
        { '@type': 'ListItem', position: 3, name: '15-Character Password Generator', item: 'https://1time.io/password-generator-15-characters/' },
    ],
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        { '@type': 'Question', name: 'Why choose exactly 15 characters?', acceptedAnswer: { '@type': 'Answer', text: '15 characters is commonly required by enterprise security policies and compliance frameworks like PCI DSS 4.0. Some Active Directory environments historically used 15 characters as a threshold for disabling legacy NTLM hashing. With mixed character types, 15 characters provides about 98 bits of entropy.' } },
        { '@type': 'Question', name: 'Is 15 characters better than 14?', acceptedAnswer: { '@type': 'Answer', text: 'Marginally. Each additional character adds about 6.5 bits of entropy with all character types. The jump from 14 (91 bits) to 15 (98 bits) makes the password about 100 times harder to crack. If your policy requires 15, use 15. Otherwise, any length from 12-20 is practical.' } },
        { '@type': 'Question', name: 'What compliance standards require 15-character passwords?', acceptedAnswer: { '@type': 'Answer', text: 'PCI DSS 4.0 requires at least 12 characters for system accounts. Many SOC 2 auditors recommend 15-16 as a minimum for privileged access. Some enterprise Active Directory policies set 15 as the minimum to ensure NTLM password hashes are not stored, improving security on Windows networks.' } },
        { '@type': 'Question', name: 'Can I use this for my work or corporate account?', acceptedAnswer: { '@type': 'Answer', text: 'Absolutely. This generator creates passwords that meet most corporate security policies — mixed case, numbers, symbols, and 15 characters long. The password is generated in your browser and never sent to any server, so it\'s safe to use for sensitive corporate accounts.' } },
    ],
};

export default function PasswordGenerator15CharPage() {
    return (
        <>
            <InlineCss file="styles/generator.css" />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <PasswordGenerator presetPath="/password-generator-15-characters" />
        </>
    );
}
