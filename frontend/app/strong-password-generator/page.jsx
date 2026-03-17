import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Strong Password Generator — Create Uncrackable Passwords',
    description: 'Generate strong 24+ character passwords with uppercase, lowercase, numbers, and symbols. Cryptographically random, generated in your browser.',
    alternates: { canonical: '/strong-password-generator' },
    openGraph: {
        title: 'Strong Password Generator — Create Uncrackable Passwords',
        description: 'Generate strong 24+ character passwords with uppercase, lowercase, numbers, and symbols. Cryptographically random, generated in your browser.',
        url: '/strong-password-generator',
    },
};

export default function StrongPasswordGeneratorPage() {
    return <PasswordGenerator presetPath="/strong-password-generator" />;
}
