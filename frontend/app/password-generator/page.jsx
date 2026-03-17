import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Free Password Generator — onetimelink.me',
    description: 'Generate strong, random passwords and passphrases in your browser. Client-side only, nothing sent to a server. Free, fast, and open source.',
    alternates: { canonical: '/password-generator' },
    openGraph: {
        title: 'Free Password Generator — onetimelink.me',
        description: 'Generate strong, random passwords and passphrases in your browser. Client-side only, nothing sent to a server.',
        url: '/password-generator',
    },
};

export default function PasswordGeneratorPage() {
    return <PasswordGenerator presetPath="/password-generator" />;
}
