export const siteHostDefault = '1time.io';
export const siteHost = import.meta.env.PUBLIC_SITE_HOST || siteHostDefault;
export const siteUrl = `https://${siteHost}`;

export const chromeStoreUrl = 'https://chromewebstore.google.com/detail/1time-%E2%80%94-one-time-secret-l/oclenaeccacnolionlpiefekmmbppgkb';

export function isSelfHosted() {
    return import.meta.env.PUBLIC_SELF_HOSTED === 'true';
}

export const selfHostedTitle = '1time.io — One-time secret';

export function absoluteUrl(path = '/') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return new URL(normalizedPath, `${siteUrl}/`).toString();
}
