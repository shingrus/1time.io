import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Random Password Generator — Cryptographically Secure',
    description: 'Generate truly random passwords using the Web Crypto API. No server involved — all passwords created locally in your browser with real cryptographic randomness.',
    alternates: { canonical: '/random-password-generator' },
    openGraph: {
        title: 'Random Password Generator — Cryptographically Secure',
        description: 'Generate truly random passwords using the Web Crypto API. No server involved — all passwords created locally in your browser.',
        url: '/random-password-generator',
    },
};

export default function RandomPasswordGeneratorPage() {
    return <PasswordGenerator presetPath="/random-password-generator" />;
}
