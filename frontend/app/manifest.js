import {siteHost} from '../utils/siteConfig';

export const dynamic = 'force-static';

export default function manifest() {
    return {
        short_name: siteHost,
        name: `${siteHost} — One-Time Secret Links`,
        icons: [
            {
                src: 'favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
            },
        ],
        start_url: '/',
        display: 'standalone',
        theme_color: '#EA580C',
        background_color: '#FAF9F6',
    };
}
