import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Passphrase Generator — Memorable & Secure Multi-Word Passwords',
    description: 'Generate memorable multi-word passphrases that are easy to type and hard to crack. Uses cryptographic randomness, runs entirely in your browser.',
    alternates: { canonical: '/passphrase-generator' },
    openGraph: {
        title: 'Passphrase Generator — Memorable & Secure Multi-Word Passwords',
        description: 'Generate memorable multi-word passphrases that are easy to type and hard to crack. Uses cryptographic randomness.',
        url: '/passphrase-generator',
    },
};

export default function PassphraseGeneratorPage() {
    return <PasswordGenerator presetPath="/passphrase-generator" />;
}
