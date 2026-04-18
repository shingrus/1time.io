import InlineCss from '../../components/InlineCss';
import ViewSecretFile from '../../components/ViewSecretFile';
import {siteHost} from '../../utils/siteConfig';

export const metadata = {
    robots: 'noindex, nofollow',
    title: `Download Encrypted File — ${siteHost}`,
    description: 'Open an encrypted one-time file link shared through 1time.io. The file is decrypted in your browser and destroyed after download.',
    openGraph: {
        title: `Download Encrypted File — ${siteHost}`,
        description: 'Open an encrypted one-time file link shared through 1time.io.',
        url: '/f/',
        images: [{ url: '/1time-og-c1b.png', width: 1200, height: 630, alt: `${siteHost} encrypted one-time file link` }],
    },
    twitter: {
        card: 'summary_large_image',
        title: `Download Encrypted File — ${siteHost}`,
        description: 'Open an encrypted one-time file link shared through 1time.io.',
        images: ['/1time-og-c1b.png'],
    },
};

export default function ViewFilePage() {
    return (
        <>
            <InlineCss file="styles/view.css" />
            <ViewSecretFile />
        </>
    );
}
