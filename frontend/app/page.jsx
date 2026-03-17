import NewMessage from '../components/NewMessage';

export const metadata = {
    title: 'onetimelink.me — Share Secrets with Encrypted One-Time Links',
    description: 'Share passwords, tokens, and sensitive data through encrypted one-time self-destruct links. End-to-end encrypted — we never see your data. Free, fast, no signup required.',
    alternates: { canonical: '/' },
    openGraph: {
        title: 'onetimelink.me — Share Secrets with Self-Destruct Links',
        description: 'Send passwords and sensitive data through encrypted one-time links. End-to-end encrypted, auto-destroyed after reading.',
        url: '/',
    },
};

export default function HomePage() {
    return <NewMessage />;
}
