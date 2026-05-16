export const siteHostDefault = '1time.io';
export const siteHost = import.meta.env.PUBLIC_SITE_HOST || siteHostDefault;
export const siteUrl = `https://${siteHost}`;

export function isBlogEnabled() {
    return import.meta.env.PUBLIC_SHOW_BLOG !== 'false';
}

export function absoluteUrl(path = '/') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return new URL(normalizedPath, `${siteUrl}/`).toString();
}
