import ViewSecretMessage from '../../components/ViewSecretMessage';
import {siteHost} from '../../utils/siteConfig';

export const metadata = {
    robots: 'noindex, nofollow',
    title: `View Secret Message — ${siteHost}`,
};

export default function ViewSecretPage() {
    return <ViewSecretMessage />;
}
