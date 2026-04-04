import {notFound} from 'next/navigation';
import {isBlogEnabled} from '../../utils/siteConfig';

export default function BlogLayout({children}) {
    if (!isBlogEnabled()) {
        notFound();
    }

    return children;
}
