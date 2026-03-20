import PasswordGenerator from '../../components/PasswordGenerator';
import {absoluteUrl} from '../../utils/siteConfig';

export const metadata = {
    title: 'Passphrase Generator — Memorable & Secure Multi-Word Passwords',
    description: 'Generate memorable multi-word passphrases that are easy to type and hard to crack. Uses cryptographic randomness, runs entirely in your browser.',
    alternates: { canonical: '/passphrase-generator' },
    openGraph: {
        title: 'Passphrase Generator — Memorable & Secure Multi-Word Passwords',
        description: 'Generate memorable multi-word passphrases that are easy to type and hard to crack. Uses cryptographic randomness.',
        url: '/passphrase-generator',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Passphrase Generator' }],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Passphrase Generator',
    url: absoluteUrl('/passphrase-generator'),
    description: 'Generate memorable multi-word passphrases that are easy to type and hard to crack. Uses cryptographic randomness, runs entirely in your browser.',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        { '@type': 'Question', name: 'Are passphrases more secure than passwords?', acceptedAnswer: { '@type': 'Answer', text: 'They can be. A 5-word passphrase has roughly 64 bits of entropy — comparable to a 10-character random password. The advantage is memorability: you can remember "Timber-Canoe-Frozen-Maple-97" but not "kX9#mR2$pL". For maximum security per character, random passwords win. For something you need to type and remember, passphrases are superior.' } },
        { '@type': 'Question', name: 'How many words should my passphrase have?', acceptedAnswer: { '@type': 'Answer', text: 'At minimum 4 words for basic accounts. Use 5 words for important accounts (email, banking). Use 6+ words for your password manager master password or full-disk encryption. Each additional word roughly doubles the number of possible combinations.' } },
        { '@type': 'Question', name: 'Can I modify the generated passphrase?', acceptedAnswer: { '@type': 'Answer', text: 'You can, but be careful. Adding a word or number increases security. Removing a word decreases it. Replacing a random word with a personally meaningful one (like a pet\'s name) can weaken the passphrase if an attacker knows you.' } },
        { '@type': 'Question', name: 'What separator should I use between words?', acceptedAnswer: { '@type': 'Answer', text: 'Any separator works. Hyphens are popular because they\'re easy to type. Spaces work if the system allows them. The separator itself adds minimal entropy — it\'s the word count that matters most.' } },
    ],
};

export default function PassphraseGeneratorPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <PasswordGenerator presetPath="/passphrase-generator" />
        </>
    );
}
