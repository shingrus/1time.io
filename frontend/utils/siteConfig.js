export const siteHostDefault = 'onetimelink.me';
export const siteHost = process.env.NEXT_PUBLIC_SITE_HOST || siteHostDefault;
export const siteUrl = `https://${siteHost}`;

export function isBlogEnabled() {
    return process.env.NEXT_PUBLIC_SHOW_BLOG !== 'false';
}

export function absoluteUrl(path = '/') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return new URL(normalizedPath, `${siteUrl}/`).toString();
}
