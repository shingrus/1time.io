import {absoluteUrl} from '../utils/siteConfig';

export const dynamic = 'force-static';

export default function robots() {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/*.pdf$', '/*.png$'],
        },
        sitemap: absoluteUrl('/sitemap.xml'),
    };
}
