import PasswordGenerator from '../../components/PasswordGenerator';

export const metadata = {
    title: 'Create a 14-Character Password with Symbols — Quick & Secure',
    description: 'Instantly create a secure 14-character password with letters, numbers, and symbols. Meets most site requirements. Generated locally in your browser.',
    alternates: { canonical: '/create-password-14-symbols' },
    openGraph: {
        title: 'Create a 14-Character Password with Symbols — Quick & Secure',
        description: 'Instantly create a secure 14-character password with letters, numbers, and symbols. Meets most site requirements.',
        url: '/create-password-14-symbols',
    },
};

export default function Create14CharPasswordPage() {
    return <PasswordGenerator presetPath="/create-password-14-symbols" />;
}
