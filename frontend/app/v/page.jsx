import InlineCss from '../../components/InlineCss';
import ViewSecretMessage from '../../components/ViewSecretMessage';
import {siteHost} from '../../utils/siteConfig';

export const metadata = {
    robots: 'noindex, nofollow',
    title: `View Secret Message — ${siteHost}`,
    description: 'Open an encrypted one-time secret link shared through 1time.io. The secret is decrypted in your browser and destroyed after reading.',
    openGraph: {
        title: `View Secret Message — ${siteHost}`,
        description: 'Open an encrypted one-time secret link shared through 1time.io.',
        url: '/v/',
        images: [{ url: '/1time-og-v.png', width: 1200, height: 630, alt: `${siteHost} encrypted one-time secret link` }],
    },
    twitter: {
        card: 'summary_large_image',
        title: `View Secret Message — ${siteHost}`,
        description: 'Open an encrypted one-time secret link shared through 1time.io.',
        images: ['/1time-og-v.png'],
    },
};

export default function ViewSecretPage() {
    return (
        <>
            <InlineCss file="styles/view.css" />
            <InlineCss file="styles/qr-panel.css" />
            <ViewSecretMessage />
        </>
    );
}
