import InlineCss from '../../components/InlineCss';
import ViewSecretFile from '../../components/ViewSecretFile';
import {siteHost} from '../../utils/siteConfig';

export const metadata = {
    robots: 'noindex, nofollow',
    title: `Download Encrypted File — ${siteHost}`,
};

export default function ViewFilePage() {
    return (
        <>
            <InlineCss file="styles/view.css" />
            <ViewSecretFile />
        </>
    );
}
